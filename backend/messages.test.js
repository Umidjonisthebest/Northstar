import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";

// Messages between a student and the developers: the rules in messages.js, then both sides over
// HTTP against a throwaway database (like practice.test.js).
const dbPath = path.join(os.tmpdir(), `northstar-messages-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";

let server;
let base;
let readDB;
let updateDB;
let M; // messages.js
let adminToken;
let ana; // { token, id }
let ben;
let demo;

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  M = await import("./messages.js");
  updateDB((db) => {
    db.users.push({ id: "admin-1", role: "admin", firstName: "Dev", lastName: "Team", email: "admin@test.local", passwordHash: bcrypt.hashSync("adminpass123", 10), createdAt: new Date().toISOString() });
  });
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  adminToken = (await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "adminpass123" } })).data.token;
  const register = async (firstName, email) => {
    const r = await api("/api/student/register", { method: "POST", body: { firstName, lastName: "T", email, password: "password1" } });
    return { token: r.data.token, id: r.data.user.id };
  };
  ana = await register("Ana", "ana-msg@test.local");
  ben = await register("Ben", "ben-msg@test.local");
  demo = await register("Demo", "demo-msg@test.local");
  updateDB((db) => (db.users.find((u) => u.id === demo.id).demo = true));
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dbPath, { force: true });
});

async function api(p, { method = "GET", body, auth } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
const send = (who, body, extra = {}) => api("/api/messages", { method: "POST", auth: who.token, body: { body, ...extra } });
const thread = (who) => api("/api/messages", { auth: who.token });
const inbox = () => api("/api/admin/messages", { auth: adminToken });

describe("message text (rules)", () => {
  test("only real text is a message", () => {
    for (const v of [undefined, null, 7, {}, ["hi"], "", "   \n\t  "]) assert.ok(M.cleanBody(v).error, JSON.stringify(v));
  });

  test("it is trimmed, line endings are unified, control characters go, blank runs are cut to one", () => {
    assert.equal(M.cleanBody("  hi\r\nthere\r").body, "hi\nthere");
    assert.equal(M.cleanBody("a\u0000b\u0007c\u007f").body, "abc");
    assert.equal(M.cleanBody("a\n\n\n\n\nb").body, "a\n\nb");
    assert.equal(M.cleanBody("tab\there").body, "tab\there");
  });

  test("a message over the limit is refused, not cut", () => {
    assert.equal(M.cleanBody("x".repeat(M.MESSAGE_MAX)).body.length, M.MESSAGE_MAX);
    assert.match(M.cleanBody("x".repeat(M.MESSAGE_MAX + 1)).error, /too long/);
  });

  test("an unknown topic is dropped", () => {
    assert.equal(M.cleanTopic("bug"), "bug");
    for (const v of ["nonsense", "", 3, null, { id: "bug" }]) assert.equal(M.cleanTopic(v), undefined);
  });
});

describe("a student writes to the developers", () => {
  test("signing in is required, and the studio's sign-in doesn't open a student's messages", async () => {
    assert.equal((await api("/api/messages")).status, 401);
    assert.equal((await api("/api/messages", { auth: adminToken })).status, 403);
    assert.equal((await api("/api/messages", { method: "POST", auth: adminToken, body: { body: "hi" } })).status, 403);
    assert.equal((await api("/api/admin/messages")).status, 401);
    assert.equal((await api("/api/admin/messages", { auth: ana.token })).status, 403);
    assert.equal((await api(`/api/admin/messages/${ana.id}`, { method: "POST", auth: ana.token, body: { body: "hi" } })).status, 403);
  });

  test("an empty conversation says what can be sent", async () => {
    const r = await thread(ana);
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.messages, []);
    assert.equal(r.data.unread, 0);
    assert.equal(r.data.canSend, true);
    assert.equal(r.data.max, M.MESSAGE_MAX);
    assert.deepEqual(r.data.topics.map((t) => t.id), ["bug", "idea", "question"]);
  });

  test("a message is saved with its topic and shown back; junk is a 400", async () => {
    for (const body of [undefined, "", "   ", 5, { a: 1 }, "x".repeat(M.MESSAGE_MAX + 1)]) assert.equal((await send(ana, body)).status, 400, JSON.stringify(body)?.slice(0, 30));
    assert.equal((await api("/api/messages", { method: "POST", auth: ana.token })).status, 400);

    const r = await send(ana, "  The timer froze on question 4.  ", { topic: "bug" });
    assert.equal(r.status, 201);
    assert.equal(r.data.message.body, "The timer froze on question 4.");
    assert.equal(r.data.message.from, "student");
    assert.equal(r.data.message.topic, "bug");
    assert.equal(r.data.message.read, false);
    assert.equal((await send(ana, "And thank you!", { topic: "made-up" })).data.message.topic, undefined);

    const t = await thread(ana);
    assert.deepEqual(t.data.messages.map((m) => m.body), ["The timer froze on question 4.", "And thank you!"]);
    // Whoever the request names, a message belongs to the student who is signed in.
    const sneaky = await api("/api/messages", { method: "POST", auth: ben.token, body: { body: "from Ben", userId: ana.id, from: "team" } });
    assert.equal(sneaky.data.message.from, "student");
    assert.equal(readDB().messages.find((m) => m.body === "from Ben").userId, ben.id);
  });

  test("students never see each other's conversations", async () => {
    assert.deepEqual((await thread(ben)).data.messages.map((m) => m.body), ["from Ben"]);
    assert.equal((await thread(ana)).data.messages.some((m) => m.body === "from Ben"), false);
  });
});

describe("the studio's inbox", () => {
  test("lists each conversation, newest first, with what is waiting", async () => {
    // Ben wrote last; make that certain even if both requests landed in the same millisecond.
    updateDB((db) => {
      for (const m of db.messages) if (m.userId === ana.id) m.createdAt = new Date(Date.parse(m.createdAt) - 5000).toISOString();
    });
    const r = await inbox();
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.conversations.map((c) => c.student.name), ["Ben T", "Ana T"]);
    const a = r.data.conversations.find((c) => c.student.id === ana.id);
    assert.equal(a.count, 2);
    assert.equal(a.unread, 2);
    assert.equal(a.last.preview, "And thank you!");
    assert.equal(a.student.email, "ana-msg@test.local");
    assert.equal(r.data.waiting, 2);
    assert.equal((await api("/api/admin/messages/waiting", { auth: adminToken })).data.waiting, 2);
  });

  test("opening a conversation shows it; marking it read clears the count", async () => {
    const r = await api(`/api/admin/messages/${ana.id}`, { auth: adminToken });
    assert.equal(r.status, 200);
    assert.equal(r.data.student.name, "Ana T");
    assert.equal(r.data.messages.length, 2);
    assert.equal((await inbox()).data.waiting, 2, "reading the list alone marks nothing");

    const read = await api(`/api/admin/messages/${ana.id}/read`, { method: "POST", auth: adminToken });
    assert.equal(read.data.waiting, 1);
    assert.equal((await inbox()).data.conversations.find((c) => c.student.id === ana.id).unread, 0);
    // The student sees that it was read.
    assert.ok((await thread(ana)).data.messages.every((m) => m.read));
  });

  test("a reply reaches the student as unread, and answering marks the conversation read", async () => {
    for (const body of ["", 9, "x".repeat(M.MESSAGE_MAX + 1)]) assert.equal((await api(`/api/admin/messages/${ben.id}`, { method: "POST", auth: adminToken, body: { body } })).status, 400);
    const r = await api(`/api/admin/messages/${ben.id}`, { method: "POST", auth: adminToken, body: { body: "Thanks Ben, looking into it." } });
    assert.equal(r.status, 201);
    assert.equal(r.data.message.from, "team");
    assert.equal(r.data.message.by, "Dev Team");
    assert.equal((await inbox()).data.waiting, 0);

    const t = await thread(ben);
    assert.equal(t.data.unread, 1);
    assert.deepEqual(t.data.messages.map((m) => [m.from, m.body]), [["student", "from Ben"], ["team", "Thanks Ben, looking into it."]]);
    assert.equal("by" in t.data.messages[1], false, "which admin replied stays in the studio");
    assert.equal((await api("/api/practice/progress", { auth: ben.token })).data.messages.unread, 1);
    assert.equal((await api("/api/practice/progress", { auth: ana.token })).data.messages.unread, 0);

    assert.equal((await api("/api/messages/read", { method: "POST", auth: ben.token })).data.unread, 0);
    assert.equal((await thread(ben)).data.unread, 0);
    assert.equal((await api("/api/practice/progress", { auth: ben.token })).data.messages.unread, 0);
    assert.equal((await api(`/api/admin/messages/${ben.id}`, { auth: adminToken })).data.messages[1].read, true);
  });

  test("an unknown student is a 404", async () => {
    assert.equal((await api("/api/admin/messages/nobody", { auth: adminToken })).status, 404);
    assert.equal((await api("/api/admin/messages/nobody", { method: "POST", auth: adminToken, body: { body: "hi" } })).status, 404);
    assert.equal((await api("/api/admin/messages/admin-1", { method: "POST", auth: adminToken, body: { body: "hi" } })).status, 404);
    assert.equal((await api("/api/admin/messages/nobody/read", { method: "POST", auth: adminToken })).status, 404);
  });
});

describe("limits", () => {
  test("the demo account can read but not send", async () => {
    const t = await thread(demo);
    assert.equal(t.data.canSend, false);
    assert.equal(t.data.blocked.reason, "demo");
    const r = await send(demo, "hello from a visitor");
    assert.equal(r.status, 403);
    assert.equal(readDB().messages.some((m) => m.userId === demo.id), false);
  });

  test("a student can send 20 messages an hour and 60 a day", () => {
    const user = { id: "u-limit", email: "u-limit@test.local" };
    const now = Date.parse("2026-10-09T12:00:00Z");
    const at = (minutesAgo) => ({ userId: user.id, from: "student", body: "x", createdAt: new Date(now - minutesAgo * 60000).toISOString() });
    const db = { messages: Array.from({ length: M.HOURLY_LIMIT - 1 }, (_, i) => at(i + 1)) };
    assert.equal(M.sendBlock(db, user, now), null);
    db.messages.push(at(30));
    assert.equal(M.sendBlock(db, user, now).code, 429);
    // An hour on, the same messages no longer count against the hour.
    assert.equal(M.sendBlock(db, user, now + 61 * 60000), null);
    // Replies from the team and other students' messages never count.
    const other = { messages: [...Array.from({ length: 80 }, () => ({ ...at(5), from: "team" })), ...Array.from({ length: 80 }, () => ({ ...at(5), userId: "someone-else" }))] };
    assert.equal(M.sendBlock(other, user, now), null);
    const day = { messages: Array.from({ length: M.DAILY_LIMIT }, (_, i) => at(90 + i * 20)) };
    assert.equal(M.sendBlock(day, user, now).code, 429);
  });

  test("over the limit the server answers 429 and saves nothing", async () => {
    const stamp = new Date().toISOString();
    updateDB((db) => {
      for (let i = 0; i < M.HOURLY_LIMIT; i++) db.messages.push({ id: `flood-${i}`, userId: ana.id, from: "student", body: "flood", createdAt: stamp });
    });
    const before = readDB().messages.length;
    const r = await send(ana, "one more");
    assert.equal(r.status, 429);
    assert.equal(readDB().messages.length, before);
    const t = await thread(ana);
    assert.equal(t.data.canSend, false);
    assert.equal(t.data.blocked.reason, "limit");
    updateDB((db) => (db.messages = db.messages.filter((m) => !m.id.startsWith("flood-"))));
  });
});

describe("clearing up", () => {
  test("deleting a conversation removes it for both sides", async () => {
    const r = await api(`/api/admin/messages/${ben.id}`, { method: "DELETE", auth: adminToken });
    assert.equal(r.data.removed, 2);
    assert.deepEqual((await thread(ben)).data.messages, []);
    assert.equal((await inbox()).data.conversations.some((c) => c.student.id === ben.id), false);
    assert.equal((await thread(ana)).data.messages.length, 2, "other conversations are untouched");
  });

  test("deleting a student takes their conversation with them", async () => {
    const { removeUser } = await import("./ielts/lib/users.js");
    assert.ok(readDB().messages.some((m) => m.userId === ana.id));
    updateDB((db) => removeUser(db, ana.id));
    assert.equal(readDB().messages.some((m) => m.userId === ana.id), false);
    assert.deepEqual((await inbox()).data.conversations, []);
  });

  test("messages left behind by a student who is gone don't show or count", async () => {
    updateDB((db) => db.messages.push({ id: "orphan", userId: "gone", from: "student", body: "hello?", createdAt: new Date().toISOString() }));
    const r = await inbox();
    assert.deepEqual(r.data.conversations, []);
    assert.equal(r.data.waiting, 0);
  });
});
