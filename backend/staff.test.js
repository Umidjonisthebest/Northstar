import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";

// The two panels: the admin's and the teacher's. One sign-in for both (the account's role decides
// which panel it opens), teacher accounts kept by the admin, which routes are the admin's alone
// and which are shared, and what a teacher sees inside the shared ones (students of the classes
// only). Over HTTP against a throwaway database.
const dbPath = path.join(os.tmpdir(), `northstar-staff-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";

let server;
let base;
let readDB;
let updateDB;
let adminToken;
let teacherToken;
let teacherId;
let teacherPassword;
// The classes (made before the tests): K.a "7A" with ana, K.b "8B" with dil, K.c "9C" with nobody.
// Said they have no class: eli. Hasn't answered: fay. The demo account: demo.
let K;
let ana;
let dil;
let eli;
let fay;
let demo;

async function api(p, { method = "GET", body, auth } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
const admin = (p, opts = {}) => api(p, { ...opts, auth: adminToken });
const teacher = (p, opts = {}) => api(p, { ...opts, auth: teacherToken });
const signIn = (email, password, where = "/api/auth/staff/login") => api(where, { method: "POST", body: { email, password } });
const register = async (firstName, lastName, extra = {}) => {
  const email = `${firstName.toLowerCase()}-staff@test.local`;
  const r = await api("/api/student/register", { method: "POST", body: { firstName, lastName, email, password: "password1", ...extra } });
  return { token: r.data?.token, id: r.data?.user?.id, email };
};
const ids = (list) => list.map((s) => s.id).sort();

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  updateDB((db) => {
    db.users.push({ id: "admin-1", role: "admin", firstName: "Ada", lastName: "Min", email: "admin@test.local", passwordHash: bcrypt.hashSync("adminpass123", 10), createdAt: new Date().toISOString() });
  });
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  ana = await register("Ana", "Alimova");
  dil = await register("Dil", "Davron");
  eli = await register("Eli", "Ergashev");
  fay = await register("Fay", "Fozilova");
  // Ana and Dil join their classes with the class codes; Eli says they have no class.
  const { createClass } = await import("./classrooms.js");
  K = updateDB((db) => ({ a: createClass(db, "7A", "admin-1"), b: createClass(db, "8B", "admin-1"), c: createClass(db, "9C", "admin-1") }));
  const membership = (who, body) => api("/api/class/membership", { method: "PUT", body, auth: who.token });
  await membership(ana, { code: K.a.code });
  await membership(dil, { code: K.b.code });
  await membership(eli, { leave: true });
  demo = await register("Demo", "Visitor");
  updateDB((db) => (db.users.find((u) => u.id === demo.id).demo = true));
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dbPath, { force: true });
});

describe("one sign-in, two panels", () => {
  test("the admin's email and password open the admin panel", async () => {
    const r = await signIn("admin@test.local", "adminpass123");
    assert.equal(r.status, 200);
    assert.equal(r.data.user.role, "admin");
    adminToken = r.data.token;
    assert.equal((await admin("/api/auth/staff/me")).data.role, "admin");
  });

  test("the admin makes a teacher account and gets its temporary password once", async () => {
    const r = await admin("/api/admin/teachers", { method: "POST", body: { firstName: "Tess", lastName: "Teacher", email: "Tess@School.Example" } });
    assert.equal(r.status, 201);
    assert.equal(r.data.teacher.email, "tess@school.example");
    assert.match(r.data.tempPassword, /^sat-[a-z2-9]{10}$/);
    teacherId = r.data.teacher.id;
    teacherPassword = r.data.tempPassword;
    const stored = readDB().users.find((u) => u.id === teacherId);
    assert.equal(stored.role, "teacher");
    assert.ok(!JSON.stringify(stored).includes(teacherPassword), "only the hash is stored");
    const list = await admin("/api/admin/teachers");
    assert.deepEqual(list.data.teachers.map((t) => t.email), ["tess@school.example"]);
    assert.equal(list.data.teachers[0].lastSignInAt, null);
  });

  test("any other email and password on the same page open the teacher studio", async () => {
    const r = await signIn("tess@school.example", teacherPassword);
    assert.equal(r.status, 200);
    assert.equal(r.data.user.role, "teacher");
    teacherToken = r.data.token;
    assert.equal((await teacher("/api/auth/staff/me")).data.role, "teacher");
    // The address the page used before teachers had accounts answers the same way.
    assert.equal((await signIn("tess@school.example", teacherPassword, "/api/auth/admin/login")).data.user.role, "teacher");
    assert.ok((await admin("/api/admin/teachers")).data.teachers[0].lastSignInAt, "the admin sees that the account is in use");
  });

  test("a wrong password, an unknown address and a student's login are all refused alike", async () => {
    for (const [email, password] of [
      ["tess@school.example", "not-the-password"],
      ["nobody@school.example", teacherPassword],
      [ana.email, "password1"]
    ]) {
      const r = await signIn(email, password);
      assert.equal(r.status, 401);
      assert.equal(r.data.error, "Invalid credentials");
    }
  });

  test("a student's token opens neither panel, and a teacher's opens no student page", async () => {
    assert.equal((await api("/api/admin/overview", { auth: ana.token })).status, 403);
    assert.equal((await api("/api/admin/teachers", { auth: ana.token })).status, 403);
    assert.equal((await teacher("/api/practice/progress")).status, 403);
    assert.equal((await api("/api/admin/overview")).status, 401);
  });
});

describe("what is the admin's alone", () => {
  const ADMIN_ONLY = [
    ["GET", "/api/admin/teachers"],
    ["POST", "/api/admin/teachers", { firstName: "X", email: "x@school.example" }],
    ["GET", "/api/admin/practice/questions"],
    ["POST", "/api/admin/practice/questions", { prompt: "2 + 2?", options: ["3", "4"], correctIndex: 1 }],
    ["POST", "/api/admin/practice/questions/import", []],
    ["GET", "/api/admin/practice/stats"],
    ["GET", "/api/admin/practice/reports"],
    ["GET", "/api/admin/practice/vocab"],
    ["POST", "/api/admin/practice/vocab", { word: "lucid", definition: "clear" }],
    ["GET", "/api/admin/messages"],
    ["GET", "/api/admin/messages/waiting"],
    ["GET", "/api/admin/leagues"],
    ["GET", "/api/admin/stories"],
    ["POST", "/api/admin/stories", { name: "A", quote: "B" }],
    ["GET", "/api/ielts/admin/content/listening"],
    ["GET", "/api/ielts/admin/content/sources"],
    ["GET", "/api/ielts/admin/users"],
    ["POST", "/api/ielts/admin/users", { firstName: "New", lastName: "User" }]
  ];

  test("a teacher is refused every one of them, and nothing is written", async () => {
    const before = JSON.stringify({ q: readDB().practiceQuestions.length, v: readDB().vocab.length, s: readDB().stories.length, u: readDB().users.length });
    for (const [method, url, body] of ADMIN_ONLY) {
      const r = await teacher(url, { method, body });
      assert.equal(r.status, 403, `${method} ${url}`);
    }
    assert.equal((await teacher(`/api/ielts/admin/users/${ana.id}`, { method: "DELETE" })).status, 403);
    assert.equal((await teacher(`/api/ielts/admin/users/${ana.id}`, { method: "PUT", body: { firstName: "Hacked", lastName: "Name" } })).status, 403);
    assert.equal((await teacher(`/api/admin/messages/${ana.id}`, { method: "POST", body: { body: "hello" } })).status, 403);
    assert.equal(JSON.stringify({ q: readDB().practiceQuestions.length, v: readDB().vocab.length, s: readDB().stories.length, u: readDB().users.length }), before);
    assert.equal(readDB().users.find((u) => u.id === ana.id).firstName, "Ana");
  });

  test("the admin is let into all of them", async () => {
    for (const [method, url] of ADMIN_ONLY.filter(([m]) => m === "GET")) {
      assert.equal((await admin(url)).status, 200, url);
    }
  });
});

describe("what both panels share", () => {
  const SHARED = [
    "/api/admin/overview",
    "/api/admin/students",
    "/api/admin/analytics",
    "/api/admin/announcements",
    "/api/admin/classes",
    "/api/admin/classes/waiting",
    "/api/admin/classes/reports",
    "/api/admin/homework",
    "/api/admin/practice/domains",
    "/api/tests",
    "/api/sessions",
    "/api/users/search?q=a",
    "/api/ielts/admin/sessions"
  ];

  test("teacher and admin both get in", async () => {
    for (const url of [...SHARED, `/api/admin/classes/${K.a.id}`]) {
      assert.equal((await teacher(url)).status, 200, `teacher ${url}`);
      assert.equal((await admin(url)).status, 200, `admin ${url}`);
    }
  });

  test("a teacher sets homework and posts an announcement", async () => {
    const drawn = await teacher("/api/admin/homework/draw", { method: "POST", body: { count: 3 } });
    assert.equal(drawn.status, 200);
    const due = (await teacher("/api/admin/homework")).data.limits.due.min;
    const set = await teacher("/api/admin/homework", { method: "POST", body: { title: "Week 1", classIds: [K.a.id], questionIds: drawn.data.questions.map((q) => q.id), due } });
    assert.equal(set.status, 201, JSON.stringify(set.data));
    assert.equal(readDB().homework.at(-1).by, "Tess Teacher");
    const said = await teacher("/api/admin/announcements", { method: "POST", body: { title: "Mock on Friday", classIds: [K.a.id, K.b.id] } });
    assert.equal(said.status, 201);
  });

  test("a teacher makes a class, names it, renames it, gives it a new code and deletes it; so can the admin", async () => {
    for (const [who, name] of [[teacher, "Tess's class"], [admin, "The admin's class"]]) {
      const made = await who("/api/admin/classes", { method: "POST", body: { name } });
      assert.equal(made.status, 201, name);
      assert.equal(made.data.name, name);
      const path = `/api/admin/classes/${made.data.id}`;
      assert.equal((await who(path, { method: "PUT", body: { name: `${name} 2` } })).data.name, `${name} 2`);
      assert.notEqual((await who(`${path}/code`, { method: "POST" })).data.code, made.data.code);
      assert.equal((await who(path, { method: "DELETE" })).status, 200);
    }
    assert.equal(readDB().classes.length, 3);
    assert.equal(readDB().classes.find((c) => c.id === K.a.id).by, "admin-1");
    const mine = await teacher("/api/admin/classes", { method: "POST", body: { name: "Made by Tess" } });
    assert.equal(mine.data.by, "Tess Teacher", "a class says who made it");
    assert.equal((await teacher(`/api/admin/classes/${mine.data.id}`, { method: "DELETE" })).status, 200);
  });
});

describe("a teacher works with the students of the classes only", () => {
  test("the students list and the overview leave out everyone outside a class", async () => {
    assert.deepEqual(ids((await teacher("/api/admin/students")).data.students), ids([ana, dil]));
    assert.deepEqual(ids((await admin("/api/admin/students")).data.students), ids([ana, dil, eli, fay, demo]));
    assert.equal((await teacher("/api/admin/overview")).data.counts.students, 2);
    assert.equal((await admin("/api/admin/overview")).data.counts.students, 4, "everyone but the demo account");
    assert.deepEqual((await teacher("/api/admin/students?q=eli")).data.students, []);
  });

  test("a student outside a class can't be opened, edited or given a new password by a teacher", async () => {
    for (const s of [eli, fay, demo]) {
      assert.equal((await teacher(`/api/admin/students/${s.id}`)).status, 404);
      assert.equal((await teacher(`/api/admin/students/${s.id}`, { method: "PUT", body: { classId: K.a.id } })).status, 404);
      assert.equal((await teacher(`/api/admin/students/${s.id}/reset-password`, { method: "POST" })).status, 404);
    }
    assert.equal((await api("/api/student/login", { method: "POST", body: { email: eli.email, password: "password1" } })).status, 200, "their password is untouched");
    assert.deepEqual([eli, fay].map((s) => readDB().users.find((u) => u.id === s.id).classId), [undefined, undefined], "and nobody was put in a class");
    assert.equal((await admin(`/api/admin/students/${eli.id}`)).status, 200);
  });

  test("for a class student a teacher moves the class and pauses the chat, but the name and email are the admin's", async () => {
    assert.equal((await teacher(`/api/admin/students/${ana.id}`)).status, 200);
    for (const body of [{ firstName: "Changed" }, { lastName: "Changed" }, { email: "changed@test.local" }, { firstName: "Changed", chatMuted: true }]) {
      const r = await teacher(`/api/admin/students/${ana.id}`, { method: "PUT", body });
      assert.equal(r.status, 403);
      assert.equal(r.data.code, "ADMIN_ONLY");
    }
    const kept = readDB().users.find((u) => u.id === ana.id);
    assert.equal(kept.firstName, "Ana");
    assert.equal(kept.chatMuted, undefined, "a refused request changes nothing");

    assert.equal((await teacher(`/api/admin/students/${ana.id}`, { method: "PUT", body: { chatMuted: true } })).status, 200);
    assert.equal((await teacher(`/api/admin/students/${ana.id}`, { method: "PUT", body: { classId: K.c.id } })).status, 200);
    const moved = readDB().users.find((u) => u.id === ana.id);
    assert.equal(moved.classId, K.c.id);
    assert.equal(moved.chatMuted, true);
    assert.equal((await teacher(`/api/admin/students/${ana.id}`, { method: "PUT", body: { chatMuted: false, classId: K.a.id } })).status, 200);
    assert.equal(readDB().users.find((u) => u.id === ana.id).classId, K.a.id);

    assert.equal((await admin(`/api/admin/students/${ana.id}`, { method: "PUT", body: { firstName: "Anna" } })).status, 200);
    assert.equal(readDB().users.find((u) => u.id === ana.id).firstName, "Anna");
  });

  test("the classes page tells only the admin how many students are outside the classes", async () => {
    assert.equal((await teacher("/api/admin/classes")).data.outside, null);
    assert.deepEqual((await admin("/api/admin/classes")).data.outside, { elsewhere: 1, notAsked: 1 });
  });

  test("a mock session: a teacher adds class students, and can't reach outside or create accounts", async () => {
    const made = await teacher("/api/tests", { method: "POST", body: { title: "Class test" } });
    assert.equal(made.status, 201);
    const session = await teacher("/api/sessions", { method: "POST", body: { name: "Grade 7 mock", testId: made.data.id } });
    assert.equal(session.status, 201);
    const url = `/api/sessions/${session.data.id}/participants`;

    assert.deepEqual((await teacher("/api/users/search?q=staff@test")).data.map((u) => u.id).sort(), ids([ana, dil]));
    assert.equal((await teacher(url, { method: "POST", body: { userId: ana.id } })).status, 201);
    assert.equal((await teacher(url, { method: "POST", body: { userId: eli.id } })).status, 404);
    const users = readDB().users.length;
    for (const body of [{ email: eli.email }, { email: "brand-new@test.local", firstName: "Brand", lastName: "New" }]) {
      const r = await teacher(url, { method: "POST", body });
      assert.equal(r.status, 403);
      assert.equal(r.data.code, "ADMIN_ONLY");
    }
    assert.equal(readDB().users.length, users, "no account was made");
    assert.equal(readDB().participants.filter((p) => p.sessionId === session.data.id).length, 1);

    // The admin still can, as before.
    assert.equal((await admin(url, { method: "POST", body: { userId: eli.id } })).status, 201);
    const created = await admin(url, { method: "POST", body: { email: "brand-new@test.local", firstName: "Brand", lastName: "New" } });
    assert.equal(created.status, 201);
    assert.ok(created.data.tempPassword);
  });

  test("an IELTS session: the same, and one student's dashboard only for a class student", async () => {
    const made = await teacher("/api/ielts/admin/sessions", { method: "POST", body: { name: "IELTS mock", studentLimit: 10, date: "2026-11-02", time: "09:00" } });
    assert.equal(made.status, 201, JSON.stringify(made.data));
    const url = `/api/ielts/admin/sessions/${made.data.id}`;

    assert.deepEqual(ids((await teacher(`${url}/available-users`)).data.items), ids([ana, dil]));
    assert.ok((await admin(`${url}/available-users`)).data.items.some((u) => u.id === eli.id));
    assert.equal((await teacher(`${url}/participants`, { method: "POST", body: { userId: dil.id } })).status, 201);
    assert.equal((await teacher(`${url}/participants`, { method: "POST", body: { userId: eli.id } })).status, 404);
    assert.equal((await teacher(`${url}/participants/new`, { method: "POST", body: { firstName: "Walk", lastName: "In" } })).status, 403);
    assert.equal((await admin(`${url}/participants/new`, { method: "POST", body: { firstName: "Walk", lastName: "In" } })).status, 201);
    assert.equal((await teacher(url)).status, 200);

    assert.equal((await teacher(`/api/ielts/admin/users/${dil.id}/dashboard`)).status, 200);
    assert.equal((await teacher(`/api/ielts/admin/users/${eli.id}/dashboard`)).status, 404);
    assert.equal((await teacher("/api/ielts/admin/users/admin-1/dashboard")).status, 404);
    assert.equal((await admin(`/api/ielts/admin/users/${eli.id}/dashboard`)).status, 200);
  });
});

describe("teacher accounts", () => {
  test("an address belongs to one account, whatever its kind", async () => {
    for (const email of ["tess@school.example", "ADMIN@test.local", ana.email]) {
      const r = await admin("/api/admin/teachers", { method: "POST", body: { firstName: "Dup", email } });
      assert.equal(r.status, 400, email);
    }
    assert.equal((await admin("/api/admin/teachers", { method: "POST", body: { firstName: "", email: "ok@school.example" } })).status, 400);
    assert.equal((await admin("/api/admin/teachers", { method: "POST", body: { firstName: "No", email: "not-an-email" } })).status, 400);
    const taken = await api("/api/student/register", { method: "POST", body: { firstName: "Copy", lastName: "Cat", email: "tess@school.example", password: "password1" } });
    assert.notEqual(taken.status, 201, "a student can't sign up with a teacher's address");
    assert.equal(readDB().users.filter((u) => u.role === "teacher").length, 1);
  });

  test("the IELTS users page neither lists nor edits a teacher", async () => {
    const list = await admin("/api/ielts/admin/users?perPage=100");
    assert.ok(!list.data.items.some((u) => u.id === teacherId));
    assert.equal((await admin(`/api/ielts/admin/users/${teacherId}`)).status, 404);
    assert.equal((await admin(`/api/ielts/admin/users/${teacherId}`, { method: "PUT", body: { firstName: "Tess", lastName: "Teacher", email: "tess@school.example" } })).status, 404);
    assert.equal((await admin(`/api/ielts/admin/users/${teacherId}`, { method: "DELETE" })).status, 404);
    assert.equal(readDB().users.find((u) => u.id === teacherId).role, "teacher");
  });

  test("a teacher chooses their own password, and the temporary one stops working", async () => {
    const wrong = await teacher("/api/auth/staff/password", { method: "POST", body: { current: "not-it", next: "my-own-password-1" } });
    assert.equal(wrong.status, 400);
    assert.equal((await teacher("/api/auth/staff/password", { method: "POST", body: { current: teacherPassword, next: "short" } })).status, 400);
    assert.equal((await teacher("/api/auth/staff/password", { method: "POST", body: { current: teacherPassword, next: teacherPassword } })).status, 400);
    const ok = await teacher("/api/auth/staff/password", { method: "POST", body: { current: teacherPassword, next: "my-own-password-1" } });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.user.role, "teacher");
    teacherToken = ok.data.token;
    assert.equal((await teacher("/api/admin/overview")).status, 200, "the new token carries on");
    assert.equal((await signIn("tess@school.example", teacherPassword)).status, 401);
    assert.equal((await signIn("tess@school.example", "my-own-password-1")).status, 200);
  });

  test("the admin edits the account and hands out a new temporary password, which signs the teacher out", async () => {
    const edited = await admin(`/api/admin/teachers/${teacherId}`, { method: "PUT", body: { firstName: "Tessa", lastName: "Teacher", email: "tess@school.example" } });
    assert.equal(edited.data.teacher.firstName, "Tessa");
    assert.equal((await admin("/api/admin/teachers/admin-1", { method: "PUT", body: { firstName: "No", email: "no@school.example" } })).status, 404, "only teacher accounts");
    assert.equal((await admin(`/api/admin/teachers/${ana.id}/reset-password`, { method: "POST" })).status, 404);

    // Tokens are stamped in whole seconds: wait one out, so the session to end is older than the reset.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const reset = await admin(`/api/admin/teachers/${teacherId}/reset-password`, { method: "POST" });
    assert.equal(reset.status, 200);
    assert.equal((await teacher("/api/admin/overview")).status, 401, "the open session ends");
    assert.equal((await signIn("tess@school.example", "my-own-password-1")).status, 401);
    const again = await signIn("tess@school.example", reset.data.tempPassword);
    assert.equal(again.status, 200);
    teacherToken = again.data.token;
  });

  test("taking the account away ends its session; what the teacher set stays", async () => {
    assert.equal((await admin(`/api/admin/teachers/${ana.id}`, { method: "DELETE" })).status, 404, "a student is not a teacher account");
    assert.equal((await admin(`/api/admin/teachers/${teacherId}`, { method: "DELETE" })).status, 200);
    assert.equal((await teacher("/api/admin/overview")).status, 401);
    assert.equal((await teacher("/api/admin/homework")).status, 401);
    assert.deepEqual((await admin("/api/admin/teachers")).data.teachers, []);
    assert.ok(readDB().homework.some((h) => h.title === "Week 1"));
    assert.ok(readDB().users.some((u) => u.id === ana.id), "students are untouched");
  });
});

describe("the development seed", () => {
  test("adds a teacher login outside production, and never in production", async () => {
    const { seedDatabase } = await import("./seed.js");
    const empty = () => ({ users: [], tests: [], sessions: [], participants: [] });
    const dev = empty();
    const notes = seedDatabase(dev, {});
    assert.equal(dev.users.filter((u) => u.role === "teacher").length, 1);
    assert.ok(notes.some((n) => /teacher login/.test(n)));
    seedDatabase(dev, {});
    assert.equal(dev.users.filter((u) => u.role === "teacher").length, 1, "once");
    const live = empty();
    seedDatabase(live, { NODE_ENV: "production", SEED_ADMIN_EMAIL: "head@school.example", SEED_ADMIN_PASSWORD: "long-enough-1" });
    assert.equal(live.users.filter((u) => u.role === "teacher").length, 0);
  });
});
