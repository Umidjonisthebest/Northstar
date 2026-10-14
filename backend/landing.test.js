import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

// The cover page's public data and the teacher-managed success stories.
const dbPath = path.join(os.tmpdir(), `northstar-landing-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";

let server;
let base;
let adminToken;
let studentToken;

before(async () => {
  const { updateDB } = await import("./db.js");
  const bcrypt = (await import("bcryptjs")).default;
  updateDB((d) => {
    d.users.push({ id: "admin-1", role: "admin", firstName: "Test", lastName: "Admin", email: "admin@test.local", passwordHash: bcrypt.hashSync("adminpass123", 10) });
  });
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  adminToken = (await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "adminpass123" } })).data.token;
  studentToken = (await api("/api/student/register", { method: "POST", body: { firstName: "Ada", lastName: "L", email: "ada-landing@test.local", password: "password1" } })).data.token;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dbPath, { force: true });
});

async function api(p, { method = "GET", body, auth } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

test("the cover page overview is public and counts the real content", async () => {
  const { status, data } = await api("/api/public/overview");
  assert.equal(status, 200);
  assert.equal(data.stats.questions, data.stats.rw + data.stats.math);
  assert.ok(data.stats.questions >= 180);
  assert.equal(data.stats.skills, 29);
  assert.ok(data.stats.vocab >= 100);
  assert.equal(data.stats.badges, 27);
  assert.ok(data.stats.ielts.listening > 0 && data.stats.ielts.reading > 0 && data.stats.ielts.writing > 0);
  assert.deepEqual(data.stories, []);
});

test("stories are validated per exam", async () => {
  const bad = [
    { exam: "SAT", before: 1190, after: 1470 },
    { name: "Aziza K.", exam: "SAT", before: 1190, after: 1475 },
    { name: "Aziza K.", exam: "SAT", before: 1300, after: 1250 },
    { name: "Aziza K.", exam: "IELTS", before: 6, after: 7.3 },
    { name: "Aziza K.", exam: "IELTS", before: 6.5, after: 10 }
  ];
  for (const body of bad) {
    const r = await api("/api/admin/stories", { method: "POST", body, auth: adminToken });
    assert.equal(r.status, 400, JSON.stringify(body));
  }
});

test("a teacher publishes, edits, hides and deletes a story", async () => {
  const created = await api("/api/admin/stories", {
    method: "POST",
    auth: adminToken,
    body: { name: "  Aziza   K. ", detail: "Class of 2027", exam: "IELTS", before: 6, after: 7.5, quote: "Nova's hints made Reading click.", tone: "mint" }
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.name, "Aziza K.");
  assert.equal(created.data.published, true);

  let pub = (await api("/api/public/overview")).data.stories;
  assert.equal(pub.length, 1);
  assert.deepEqual(Object.keys(pub[0]).sort(), ["after", "before", "detail", "exam", "id", "name", "quote", "tone"]);

  const edited = await api(`/api/admin/stories/${created.data.id}`, { method: "PUT", auth: adminToken, body: { after: 8 } });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.after, 8);
  assert.equal(edited.data.quote, "Nova's hints made Reading click.");
  const invalid = await api(`/api/admin/stories/${created.data.id}`, { method: "PUT", auth: adminToken, body: { after: 5 } });
  assert.equal(invalid.status, 400);

  await api(`/api/admin/stories/${created.data.id}`, { method: "PUT", auth: adminToken, body: { published: false } });
  pub = (await api("/api/public/overview")).data.stories;
  assert.equal(pub.length, 0);
  assert.equal((await api("/api/admin/stories", { auth: adminToken })).data.stories.length, 1);

  await api(`/api/admin/stories/${created.data.id}`, { method: "DELETE", auth: adminToken });
  assert.equal((await api("/api/admin/stories", { auth: adminToken })).data.stories.length, 0);
});

test("students can't manage stories", async () => {
  const r = await api("/api/admin/stories", { method: "POST", auth: studentToken, body: { name: "Me", exam: "SAT", before: 400, after: 1600 } });
  assert.ok(r.status === 401 || r.status === 403);
  assert.equal((await api("/api/admin/stories")).status, 401);
});
