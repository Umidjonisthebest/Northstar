// IELTS inside Northstar, end to end over HTTP against a throwaway database:
// the admin creates a session, the candidate (a Northstar student) can only log
// in once it is started, takes all three sections, and the admin sees graded
// results, enters Writing/Speaking and exports. Also covers the Northstar
// touch points: shared users/admin login, the student hub and the student profile.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-ielts-test-"));
process.env.DB_PATH = path.join(tmpDir, "db.json");
process.env.UPLOAD_DIR = path.join(tmpDir, "uploads");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const { default: app } = await import("../app.js");
const { updateDB, readDB } = await import("../db.js");
const { ensureIeltsContent } = await import("./index.js");
// Importing app.js loaded the IELTS starter tests into the empty database.
const afterBoot = readDB();

const blank = (id) => `<span class="ql-blank" data-id="${id}"></span>`;
let server;
let root;
let base;
const state = {};

async function api(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const type = res.headers.get("content-type") || "";
  const data = type.includes("json") ? await res.json() : await res.arrayBuffer();
  return { status: res.status, data, type };
}

before(async () => {
  const now = new Date().toISOString();
  updateDB((db) => {
    db.users.push({ id: "admin-1", role: "admin", firstName: "Admin", lastName: "User", email: "admin@test.dev", passwordHash: bcrypt.hashSync("secret1", 4), createdAt: now });
    db.users.push({ id: "stud-1", role: "student", firstName: "Test", lastName: "Candidate", email: "cand@test.dev", candidateId: "150", passwordHash: bcrypt.hashSync("student1", 4), createdAt: now });
    // Replace the auto-loaded starter tests with one small test, so the assignment is predictable.
    db.ieltsListening = [
      {
        id: "L1",
        groupId: "t1",
        title: "Section One",
        section: 1,
        level: "MEDIUM",
        durationMinutes: 5,
        audio: { url: "/uploads/ielts/audio/x.mp3" },
        active: true,
        groups: [
          { id: "g1", type: "note_completion", instructionHtml: "<p>One word</p>", contentHtml: `<p>Go to ${blank("L1b1")} and ${blank("L1b2")}</p>`, answers: { L1b1: { value: "school", variations: [] }, L1b2: { value: "home", variations: [] } } },
          { id: "g2", type: "multiple_choice", items: [{ id: "L1q3", text: "Pick", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }] }], answers: { L1q3: { value: "B" } } }
        ],
        createdAt: now,
        updatedAt: now
      }
    ];
    db.ieltsReading = [
      {
        id: "R1",
        groupId: "t1",
        globalTitle: "Test",
        title: "Passage",
        part: 1,
        contentHtml: "<p>Text</p>",
        durationMinutes: 20,
        active: true,
        groups: [{ id: "g3", type: "tfng", items: [{ id: "R1t1", text: "S1" }, { id: "R1t2", text: "S2" }], answers: { R1t1: { value: "TRUE" }, R1t2: { value: "NOT GIVEN" } } }],
        createdAt: now,
        updatedAt: now
      }
    ];
    db.ieltsWriting = [
      { id: "W1", groupId: "t1", task: 1, title: "Writing Task 1", questionHtml: "<p>Describe</p>", active: true, createdAt: now, updatedAt: now },
      { id: "W2", groupId: "t1", task: 2, title: "Writing Task 2", questionHtml: "<p>Discuss</p>", active: true, createdAt: now, updatedAt: now }
    ];
  });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  root = `http://127.0.0.1:${server.address().port}`;
  base = `${root}/api`;
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("starter tests load into an empty database, and only then", async () => {
  // Mock-test content, the self-study practice set (seed/practice.js, use: "practice"), and the
  // two practice tests' own parts (use: "test": four listening, three reading, two writing each).
  const count = (list, use) => list.filter((r) => (r.use || "mock") === use).length;
  assert.deepEqual([count(afterBoot.ieltsListening, "mock"), count(afterBoot.ieltsReading, "mock"), count(afterBoot.ieltsWriting, "mock")], [6, 4, 4]);
  assert.deepEqual([count(afterBoot.ieltsListening, "practice"), count(afterBoot.ieltsReading, "practice"), count(afterBoot.ieltsWriting, "practice")], [4, 3, 4]);
  assert.deepEqual([count(afterBoot.ieltsListening, "test"), count(afterBoot.ieltsReading, "test"), count(afterBoot.ieltsWriting, "test")], [8, 6, 4]);
  assert.equal(afterBoot.ieltsPracticeTests.length, 2);
  assert.equal(afterBoot.practiceQuestions.length > 0, true);
  const audioUrl = afterBoot.ieltsListening[0].audio.url;
  assert.match(audioUrl, /^\/ielts-assets\/audio\/L[AB]\d\.wav$/);

  const db = readDB();
  assert.equal(ensureIeltsContent(db), false);
  assert.equal(db.ieltsListening.length, 1);

  const audio = await fetch(root + audioUrl);
  assert.equal(audio.status, 200);
  const soundTest = await fetch(`${root}/ielts-assets/sound-test.wav`);
  assert.equal(soundTest.status, 200);
  assert.match(soundTest.headers.get("content-type"), /audio/);
  assert.equal((await fetch(`${root}/ielts-assets/missing.wav`)).status, 404);
});

test("Northstar admin login works for the IELTS admin API", async () => {
  const bad = await api("POST", "/auth/admin/login", { body: { email: "admin@test.dev", password: "nope" } });
  assert.equal(bad.status, 401);
  const ok = await api("POST", "/auth/admin/login", { body: { email: "ADMIN@test.dev", password: "secret1" } });
  assert.equal(ok.status, 200);
  state.admin = ok.data.token;
  const list = await api("GET", "/ielts/admin/content/listening", { token: state.admin });
  assert.equal(list.status, 200);
  assert.equal(list.data[0].title, "Section One");
});

test("session validation and participants", async () => {
  const bad = await api("POST", "/ielts/admin/sessions", { token: state.admin, body: { name: "S", studentLimit: 3, date: "2026-10-01", time: "10:00" } });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /at least 5/);
  const created = await api("POST", "/ielts/admin/sessions", { token: state.admin, body: { name: "Saturday, 10am", studentLimit: 5, date: "2026-10-01", time: "10:00" } });
  assert.equal(created.status, 201);
  assert.equal(created.data.status, "created");
  assert.equal(typeof created.data.id, "string");
  state.sessionId = created.data.id;
  const added = await api("POST", `/ielts/admin/sessions/${state.sessionId}/participants`, { token: state.admin, body: { userId: "stud-1" } });
  assert.equal(added.status, 201);
  assert.equal(added.data.user.candidateId, "150");
  assert.equal((await api("POST", `/ielts/admin/sessions/${state.sessionId}/participants`, { token: state.admin, body: { userId: "stud-1" } })).status, 409);
  const available = await api("GET", `/ielts/admin/sessions/${state.sessionId}/available-users?q=test`, { token: state.admin });
  assert.equal(available.data.total, 0);
  // Only IELTS collections are used — SAT sessions are untouched.
  assert.equal(readDB().sessions.length, 0);
});

test("candidate logs in with the Northstar candidate ID once the session is started", async () => {
  const early = await api("POST", "/ielts/exam/login", { body: { candidateId: "150" } });
  assert.equal(early.status, 409);
  assert.equal(early.data.error, "User has no active session with STARTED status");
  assert.equal((await api("POST", "/ielts/exam/login", { body: { candidateId: "999" } })).status, 404);
  const started = await api("POST", `/ielts/admin/sessions/${state.sessionId}/status`, { token: state.admin, body: { status: "started" } });
  assert.equal(started.data.status, "started");
  const login = await api("POST", "/ielts/exam/login", { body: { candidateId: " 0150 " } });
  assert.equal(login.status, 200);
  assert.equal(login.data.candidate.id, "stud-1");
  assert.equal(login.data.candidate.candidateId, "150");
  state.cand = login.data.token;
});

test("listening: content has no answers, autosave and submit grade it", async () => {
  const st = await api("GET", "/ielts/exam/state", { token: state.cand });
  assert.equal(st.data.step, "listening");
  assert.deepEqual(st.data.steps, ["listening", "reading", "writing"]);
  assert.equal(st.data.sections.listening.durationSeconds, 5 * 60 + 120);

  assert.equal((await api("POST", "/ielts/exam/section/reading/start", { token: state.cand })).status, 409);
  const started = await api("POST", "/ielts/exam/section/listening/start", { token: state.cand });
  assert.equal(started.status, 200);
  const groups = started.data.parts[0].groups;
  assert.equal(JSON.stringify(started.data).includes('"school"'), false);
  assert.deepEqual(groups.flatMap((g) => g.slots.map((s) => s.n)), [1, 2, 3]);

  const saved = await api("PUT", "/ielts/exam/section/listening/answers", { token: state.cand, body: { answers: { L1b1: "School" }, flags: ["L1b2"] } });
  assert.equal(saved.status, 200);
  const resumed = await api("GET", "/ielts/exam/section/listening", { token: state.cand });
  assert.deepEqual(resumed.data.answers, { L1b1: "School" });
  assert.deepEqual(resumed.data.flags, ["L1b2"]);

  const done = await api("POST", "/ielts/exam/section/listening/submit", { token: state.cand, body: { answers: { L1b1: "School", L1b2: "work", L1q3: "B" } } });
  assert.equal(done.data.step, "reading");
  const exam = readDB().ieltsExams[0];
  assert.equal(exam.results.listening.raw, 2);
  assert.equal(exam.results.listening.total, 3);
});

test("the student hub lists the live session but hides bands until it is completed", async () => {
  const login = await api("POST", "/student/login", { body: { email: "cand@test.dev", password: "student1" } });
  assert.equal(login.status, 200);
  state.student = login.data.token;
  const list = await api("GET", "/ielts/student/sessions", { token: state.student });
  assert.equal(list.status, 200);
  const s = list.data.sessions[0];
  assert.equal(s.id, state.sessionId);
  assert.equal(s.state, "in_progress");
  assert.equal(s.currentSection, "reading");
  assert.equal(s.canEnter, true);
  assert.equal(s.results, null);
  // Entering from the hub resumes the same exam.
  const enter = await api("POST", `/ielts/student/sessions/${state.sessionId}/enter`, { token: state.student });
  assert.equal(enter.status, 200);
  const st = await api("GET", "/ielts/exam/state", { token: enter.data.token });
  assert.equal(st.data.step, "reading");
});

test("reading and writing complete the test", async () => {
  await api("POST", "/ielts/exam/section/reading/start", { token: state.cand });
  const r = await api("POST", "/ielts/exam/section/reading/submit", { token: state.cand, body: { answers: { R1t1: "TRUE", R1t2: "FALSE" } } });
  assert.equal(r.data.step, "writing");
  const w = await api("POST", "/ielts/exam/section/writing/start", { token: state.cand });
  assert.equal(w.data.parts.length, 2);
  assert.equal(w.data.parts[1].minWords, 250);
  const done = await api("POST", "/ielts/exam/section/writing/submit", { token: state.cand, body: { answers: { W1: "one two three", W2: "Essay text here." } } });
  assert.equal(done.data.step, "done");
  const again = await api("POST", "/ielts/exam/login", { body: { candidateId: "150" } });
  assert.equal(again.status, 409);
  assert.match(again.data.error, /already completed/);
  const hub = await api("POST", `/ielts/student/sessions/${state.sessionId}/enter`, { token: state.student });
  assert.equal(hub.status, 409);
});

test("admin sees results, scores writing/speaking and exports", async () => {
  const detail = await api("GET", `/ielts/admin/sessions/${state.sessionId}`, { token: state.admin });
  assert.deepEqual(detail.data.completion, { listening: 100, reading: 100, writing: 100 });
  const row = detail.data.participants[0];
  assert.equal(row.sections.listening.completed, true);
  assert.equal(row.sections.speaking.completed, false);
  assert.equal(row.overall, null);

  const url = `/ielts/admin/sessions/${state.sessionId}/participants/stud-1`;
  const bad = await api("PUT", `${url}/scores/writing`, { token: state.admin, body: { band: "6.3" } });
  assert.equal(bad.status, 400);
  await api("PUT", `${url}/scores/writing`, { token: state.admin, body: { band: "6.5", notes: "Good" } });
  const sp = await api("PUT", `${url}/scores/speaking`, { token: state.admin, body: { band: 7 } });
  assert.equal(sp.data.sections.speaking.completed, true);
  assert.notEqual(sp.data.overall, null);

  const results = await api("GET", `${url}/results`, { token: state.admin });
  assert.equal(results.data.sections.writing.attempts.length, 2);
  assert.match(results.data.sections.writing.attempts[0].meta, /Words:/);
  const readingAttempt = results.data.sections.reading.attempts[0];
  const details = await api("GET", `/ielts/admin/attempts/${readingAttempt.id}`, { token: state.admin });
  assert.deepEqual(details.data.review.map((r) => r.correct), [true, false]);

  const xlsx = await api("GET", `/ielts/admin/sessions/${state.sessionId}/export?format=xlsx`, { token: state.admin });
  assert.equal(xlsx.status, 200);
  assert.match(xlsx.type, /spreadsheetml/);
  const docx = await api("GET", `/ielts/admin/sessions/${state.sessionId}/export?format=docx`, { token: state.admin });
  assert.match(docx.type, /wordprocessingml/);
});

test("bands reach the student hub and the admin profile once the session is completed", async () => {
  const profileBefore = await api("GET", "/admin/students/stud-1", { token: state.admin });
  assert.equal(profileBefore.data.ielts.length, 1);
  assert.equal(profileBefore.data.ielts[0].bands.writing, 6.5);

  await api("POST", `/ielts/admin/sessions/${state.sessionId}/status`, { token: state.admin, body: { status: "completed" } });
  const list = await api("GET", "/ielts/student/sessions", { token: state.student });
  const s = list.data.sessions[0];
  assert.equal(s.state, "finished");
  assert.equal(s.canEnter, false);
  assert.equal(s.results.writing, 6.5);
  assert.equal(s.results.speaking, 7);
  assert.notEqual(s.results.overall, null);
});

test("tokens stay in their lane", async () => {
  assert.equal((await api("GET", "/ielts/exam/state", { token: state.admin })).status, 403);
  assert.equal((await api("GET", "/ielts/exam/state", { token: state.student })).status, 403);
  assert.equal((await api("GET", "/ielts/admin/users", { token: state.cand })).status, 403);
  assert.equal((await api("GET", "/student/me", { token: state.cand })).status, 403);
  assert.equal((await api("GET", "/ielts/student/sessions", { token: state.admin })).status, 403);
});

test("IELTS user admin works on Northstar's users without breaking their Northstar login", async () => {
  // Editing a student in the IELTS panel keeps their student-hub password.
  const edit = await api("PUT", "/ielts/admin/users/stud-1", { token: state.admin, body: { role: "student", firstName: "Tess", lastName: "Candidate", email: "cand@test.dev", phone: "+998 90 123 45 67" } });
  assert.equal(edit.status, 200);
  assert.equal(edit.data.passwordHash, undefined);
  assert.equal(edit.data.hasPassword, true);
  assert.equal((await api("POST", "/student/login", { body: { email: "cand@test.dev", password: "student1" } })).status, 200);

  // New students get the next candidate ID; no email is fine and Northstar's login still works.
  const created = await api("POST", "/ielts/admin/users", { token: state.admin, body: { role: "student", firstName: "Sardor", lastName: "Samadov", email: "" } });
  assert.equal(created.status, 201);
  assert.equal(created.data.candidateId, "151");
  assert.equal((await api("POST", "/student/login", { body: { email: "nobody@test.dev", password: "whatever" } })).status, 401);
  const search = await api("GET", "/ielts/admin/users?q=151", { token: state.admin });
  assert.deepEqual(search.data.items.map((u) => u.firstName), ["Sardor"]);

  // Deleting cascades to IELTS exams and Northstar data.
  updateDB((db) => {
    db.participants.push({ id: "p-1", sessionId: "sat-1", userId: "stud-1", createdAt: new Date().toISOString() });
    db.attempts.push({ id: "a-1", participantId: "p-1", sessionId: "sat-1", moduleId: "m-1", answers: {} });
  });
  assert.equal((await api("DELETE", "/ielts/admin/users/admin-1", { token: state.admin })).status, 400);
  assert.equal((await api("DELETE", "/ielts/admin/users/stud-1", { token: state.admin })).status, 200);
  const db = readDB();
  assert.equal(db.users.some((u) => u.id === "stud-1"), false);
  assert.equal(db.ieltsExams.length, 0);
  assert.equal(db.ieltsAttempts.length, 0);
  assert.deepEqual(db.ieltsSessions[0].participantIds, []);
  assert.equal(db.participants.length, 0);
  assert.equal(db.attempts.length, 0);
});

test("unknown IELTS API routes answer with JSON", async () => {
  const res = await api("GET", "/ielts/nope", { token: state.admin });
  assert.equal(res.status, 404);
  assert.equal(res.data.error, "Not found");
});
