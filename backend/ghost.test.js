// Ghost run: per-question timestamps are kept with a mock-exam attempt, and a
// later attempt at the same test gets the earlier one's pacing. Over HTTP
// against a throwaway database, plus the tidying of what the client sends.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

const dbPath = path.join(os.tmpdir(), `northstar-ghost-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";

let server;
let base;
let readDB;
let updateDB;
let exam;
let admin;
const students = {};

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  exam = await import("./routes/examRoutes.js");
  const bcrypt = (await import("bcryptjs")).default;
  updateDB((db) => {
    db.users.push({ id: "admin-1", role: "admin", firstName: "Test", lastName: "Admin", email: "admin@test.local", passwordHash: bcrypt.hashSync("adminpass123", 10) });
  });
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  admin = (await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "adminpass123" } })).data.token;
  for (const name of ["Gia", "Hal"]) {
    const reg = await api("/api/student/register", { method: "POST", body: { firstName: name, lastName: "T", email: `${name.toLowerCase()}-ghost@test.local`, password: "password1" } });
    students[name] = { token: reg.data.token, id: reg.data.user.id };
  }
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dbPath, { force: true });
});

async function api(p, { method = "GET", body, token } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

describe("tidying the timestamps the exam screen sends", () => {
  const mod = { questions: [{ id: "q1" }, { id: "q2" }, { id: "q3" }] };

  test("only this module's questions, whole seconds, nothing after the attempt ended", () => {
    const clean = exam.cleanTimestamps(mod, { q1: { seen: 0, answered: 41.6 }, q2: { seen: 50, answered: 9000 }, other: { seen: 5 }, q3: { seen: -4, answered: "soon" } }, 600);
    assert.deepEqual(clean, { q1: { seen: 0, answered: 42 }, q2: { seen: 50, answered: 600 } });
  });

  test("junk in, nothing out", () => {
    for (const junk of [null, undefined, "x", 7, [], [{ seen: 1 }]]) assert.deepEqual(exam.cleanTimestamps(mod, junk, 600), {});
    assert.deepEqual(exam.cleanTimestamps(mod, { q1: null, q2: "x", q3: {} }, 600), {});
    assert.deepEqual(exam.cleanTimestamps(mod, { q1: { seen: null, answered: "" } }, 600), {});
  });
});

describe("ghost run over HTTP", () => {
  let testId;
  let moduleId;
  let questions;
  const sessions = [];

  async function newSession(name, ...who) {
    const s = await api("/api/sessions", { method: "POST", token: admin, body: { name, testId, studentLimit: 10 } });
    for (const w of who) await api(`/api/sessions/${s.data.id}/participants`, { method: "POST", token: admin, body: { userId: students[w].id } });
    await api(`/api/sessions/${s.data.id}/start`, { method: "POST", token: admin });
    sessions.push(s.data.id);
    return s.data.id;
  }
  const open = (sessionId, who) => api(`/api/exam/session/${sessionId}/modules/${moduleId}`, { token: students[who].token });
  const submit = (sessionId, who, body) => api(`/api/exam/session/${sessionId}/modules/${moduleId}/submit`, { method: "POST", token: students[who].token, body });

  test("set up: one test with a three-question Math module", async () => {
    const t = await api("/api/tests", { method: "POST", token: admin, body: { title: "Ghost test" } });
    testId = t.data.id;
    moduleId = t.data.modules.find((m) => m.name === "Math").id;
    questions = [];
    for (const [i, answer] of ["4", "7", "9"].entries()) {
      const q = await api(`/api/tests/${testId}/modules/${moduleId}/questions`, { method: "POST", token: admin, body: { type: "grid_in", prompt: `Question ${i + 1}?`, correctAnswer: answer } });
      questions.push(q.data.id);
    }
    assert.equal(questions.length, 3);
  });

  test("a first attempt has no ghost, and its timestamps are stored with it", async () => {
    const sessionId = await newSession("First sitting", "Gia", "Hal");
    const first = await open(sessionId, "Gia");
    assert.equal(first.status, 200);
    assert.equal(first.data.ghost, null);

    // Make the attempt five minutes old, so the timestamps fit inside it.
    updateDB((db) => {
      db.attempts.find((a) => a.sessionId === sessionId).startedAt = new Date(Date.now() - 300000).toISOString();
    });
    const timestamps = { [questions[0]]: { seen: 0, answered: 40 }, [questions[1]]: { seen: 45, answered: 130 }, [questions[2]]: { seen: 140, answered: 9999 }, stray: { seen: 3 } };
    const done = await submit(sessionId, "Gia", { answers: { [questions[0]]: "4", [questions[1]]: "7", [questions[2]]: "1" }, timestamps });
    assert.equal(done.status, 200);
    assert.equal(done.data.raw, 2);

    const stored = readDB().attempts.find((a) => a.sessionId === sessionId);
    assert.ok(stored.seconds >= 299 && stored.seconds <= 302);
    assert.deepEqual(stored.timestamps[questions[0]], { seen: 0, answered: 40 });
    assert.deepEqual(stored.timestamps[questions[1]], { seen: 45, answered: 130 });
    assert.equal(stored.timestamps[questions[2]].seen, 140);
    assert.equal(stored.timestamps[questions[2]].answered, stored.seconds, "a time after the end is pulled back to the end");
    assert.equal("stray" in stored.timestamps, false);
  });

  test("the next attempt at the same test gets the earlier pacing, and nothing else", async () => {
    const sessionId = await newSession("Second sitting", "Gia", "Hal");
    const { data } = await open(sessionId, "Gia");
    assert.ok(data.ghost);
    assert.deepEqual(data.ghost.marks, [
      { n: 1, t: 0 },
      { n: 2, t: 45 },
      { n: 3, t: 140 }
    ]);
    assert.ok(data.ghost.seconds >= 299);
    assert.ok(data.ghost.takenAt);
    assert.deepEqual(Object.keys(data.ghost).sort(), ["marks", "seconds", "takenAt"]);
    const text = JSON.stringify(data);
    assert.ok(!text.includes("correctAnswer") && !text.includes("correctIndex") && !text.includes('"answers"'), "no answers, old or new");
  });

  test("another student doesn't see someone else's pacing", async () => {
    const { data } = await open(sessions[1], "Hal");
    assert.equal(data.ghost, null);
  });

  test("a submission without timestamps still works, and leaves no ghost behind", async () => {
    const done = await submit(sessions[0], "Hal", { answers: { [questions[0]]: "4" } });
    assert.equal(done.status, 200);
    assert.deepEqual(readDB().attempts.find((a) => a.sessionId === sessions[0] && a.raw === 1).timestamps, {});
    const third = await newSession("Third sitting", "Hal");
    assert.equal((await open(third, "Hal")).data.ghost, null);
  });

  test("the ghost is the most recent earlier attempt", async () => {
    updateDB((db) => {
      db.attempts.find((a) => a.sessionId === sessions[1] && !a.submittedAt && db.participants.find((p) => p.id === a.participantId).userId === students.Gia.id).startedAt = new Date(Date.now() - 200000).toISOString();
    });
    await submit(sessions[1], "Gia", { answers: {}, timestamps: { [questions[0]]: { seen: 2 }, [questions[1]]: { seen: 20 }, [questions[2]]: { seen: 30 } } });
    const fourth = await newSession("Fourth sitting", "Gia");
    const { data } = await open(fourth, "Gia");
    assert.deepEqual(data.ghost.marks.map((m) => m.t), [2, 20, 30]);
  });
});
