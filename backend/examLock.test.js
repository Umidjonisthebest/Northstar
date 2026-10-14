import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";

// The test lock (examLock.js): a mock test or a diagnostic test that the student leaves is
// cancelled, a teacher can let a student back into a mock test, and leaving the homework page is
// counted for the teacher. The real app over HTTP, against a throwaway database.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-lock-test-"));
process.env.DB_PATH = path.join(tmpDir, "db.json");
process.env.UPLOAD_DIR = path.join(tmpDir, "uploads");
process.env.JWT_SECRET = "test-secret-not-for-real-use";

let server;
let base;
let readDB;
let updateDB;
let L; // examLock.js
let G; // gamification.js
let adminToken;
let mia; // sits the mock tests and the diagnostics
let K; // the classes: K.a "7A" (ana, ben) and K.b "8B" (nobody)
let ana; // in 7A
let ben; // in 7A
let eli; // not in a class

async function api(p, { method = "GET", body, auth } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const type = res.headers.get("content-type") || "";
  const data = type.includes("json") ? await res.json().catch(() => null) : await res.text();
  return { status: res.status, data };
}
const as = (who) => (p, opts = {}) => api(p, { ...opts, auth: who.token });
const admin = (p, opts = {}) => api(p, { ...opts, auth: adminToken });
const register = async (firstName, extra = {}) => {
  const r = await api("/api/student/register", { method: "POST", body: { firstName, lastName: "Lock", email: `${firstName.toLowerCase()}-lock@test.local`, password: "password1", ...extra } });
  return { token: r.data.token, id: r.data.user.id };
};
const minutesAgo = (n) => new Date(Date.now() - n * 60000).toISOString();
const near = (a, b, slack = 3000) => Math.abs(a - b) <= slack;

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  L = await import("./examLock.js");
  G = await import("./gamification.js");
  updateDB((db) => {
    db.users.push({ id: "admin-1", role: "admin", firstName: "Tea", lastName: "Cher", email: "admin@test.local", passwordHash: bcrypt.hashSync("adminpass123", 10), createdAt: new Date().toISOString() });
  });
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  adminToken = (await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "adminpass123" } })).data.token;
  mia = await register("Mia");
  ana = await register("Ana");
  ben = await register("Ben");
  eli = await register("Eli");
  // Two classes; Ana and Ben join the first with its class code; Eli says they have no class.
  const { createClass } = await import("./classrooms.js");
  K = updateDB((db) => ({ a: createClass(db, "7A", "admin-1"), b: createClass(db, "8B", "admin-1") }));
  for (const who of [ana, ben]) await as(who)("/api/class/membership", { method: "PUT", body: { code: K.a.code } });
  await as(eli)("/api/class/membership", { method: "PUT", body: { leave: true } });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("the rules on their own", () => {
  test("a leave is one of four kinds; anything else counts as a hidden page", () => {
    for (const kind of L.LEAVE_KINDS) assert.equal(L.leaveKind(kind), kind);
    for (const junk of [undefined, null, "", "focus", 3, {}, ["blur"]]) assert.equal(L.leaveKind(junk), "hidden");
    for (const kind of L.LEAVE_KINDS) assert.ok(L.LEAVE_TEXT[kind]);
  });

  test("letting a student back in starts a new round and says how long the test was closed", () => {
    const now = Date.parse("2026-10-10T10:00:00Z");
    const holder = { cancelled: L.cancellation("blur", { moduleId: "m1" }, now - 5 * 60000) };
    assert.equal(L.lockRound(holder), 0);
    assert.equal(L.reinstate(holder, "Tea Cher", now), 5 * 60000);
    assert.equal(holder.cancelled, undefined);
    assert.equal(L.lockRound(holder), 1);
    assert.deepEqual(holder.lockLog[0], { at: "2026-10-10T09:55:00.000Z", kind: "blur", moduleId: "m1", reinstatedAt: "2026-10-10T10:00:00.000Z", by: "Tea Cher" });
    assert.equal(L.reinstate(holder, "Tea Cher", now), 0, "nothing to let back in twice");
    assert.equal(L.lockRound(holder), 1);
  });

  test("a report from before the teacher's decision is out of date", () => {
    const holder = { lockLog: [{}] };
    assert.equal(L.staleReport(holder, { round: 0 }), true);
    assert.equal(L.staleReport(holder, { round: 1 }), false);
    assert.equal(L.staleReport(holder, {}), false, "no round: counts for the current one");
    assert.equal(L.staleReport(holder, { round: "0" }), false);
    assert.equal(L.staleReport({}, { round: 0 }), false);
  });

  test("what is shown of a cancellation", () => {
    assert.equal(L.cancelledView(null), null);
    assert.deepEqual(L.cancelledView({ at: "2026-10-10T09:55:00.000Z", kind: "closed", moduleId: "m1" }), { at: "2026-10-10T09:55:00.000Z", kind: "closed", reason: "closed or reloaded the test page" });
  });
});

describe("a SAT mock test", () => {
  let sessionId;
  let participantId;
  let first;
  let second;
  let q1;
  let q2;
  const mod = (m) => `/api/exam/session/${sessionId}/modules/${m.id}`;
  const leave = (body, who = mia) => as(who)(`/api/exam/session/${sessionId}/leave`, { method: "POST", body });
  const participant = () => readDB().participants.find((p) => p.id === participantId);

  before(async () => {
    const t = (await admin("/api/tests", { method: "POST", body: { title: "Lock test" } })).data;
    [first, second] = t.modules;
    const add = (m, body) => admin(`/api/tests/${t.id}/modules/${m.id}/questions`, { method: "POST", body });
    q1 = (await add(first, { type: "mcq", prompt: "2 + 2?", options: ["3", "4", "5"], correctIndex: 1 })).data;
    q2 = (await add(second, { type: "mcq", prompt: "3 + 3?", options: ["6", "7"], correctIndex: 0 })).data;
    sessionId = (await admin("/api/sessions", { method: "POST", body: { name: "Locked sitting", testId: t.id, studentLimit: 5 } })).data.id;
    participantId = (await admin(`/api/sessions/${sessionId}/participants`, { method: "POST", body: { userId: mia.id } })).data.id;
    await admin(`/api/sessions/${sessionId}/start`, { method: "POST" });
  });

  test("with no module running there is nothing to cancel", async () => {
    const res = await leave({ kind: "hidden", round: 0 });
    assert.equal(res.status, 200);
    assert.equal(res.data.cancelled, null);
    const overview = (await as(mia)(`/api/exam/session/${sessionId}/overview`)).data;
    assert.equal(overview.cancelled, null);
    assert.equal(overview.lockRound, 0);
  });

  test("only someone sitting the session can report a leave", async () => {
    assert.equal((await leave({ kind: "hidden" }, eli)).status, 403);
    assert.equal((await api(`/api/exam/session/${sessionId}/leave`, { method: "POST", body: {} })).status, 401);
    assert.equal((await as(mia)("/api/exam/session/nope/leave", { method: "POST", body: {} })).status, 404);
  });

  test("leaving a running module cancels the whole sitting", async () => {
    const opened = await as(mia)(mod(first));
    assert.equal(opened.status, 200);
    assert.equal(opened.data.lockRound, 0);
    assert.equal((await as(mia)(`${mod(first)}/answers`, { method: "PUT", body: { answers: { [q1.id]: 1 } } })).status, 200);

    const res = await leave({ kind: "blur", round: 0 });
    assert.equal(res.status, 200);
    assert.equal(res.data.cancelled.kind, "blur");
    assert.equal(res.data.cancelled.reason, "switched to another window");
    assert.equal(participant().cancelled.moduleId, first.id);
    // A second report changes nothing (the first one stands).
    assert.equal((await leave({ kind: "closed", round: 0 })).data.cancelled.kind, "blur");
  });

  test("a cancelled sitting can't be opened, saved or handed in", async () => {
    for (const res of [
      await as(mia)(mod(first)),
      await as(mia)(mod(second)),
      await as(mia)(`${mod(first)}/answers`, { method: "PUT", body: { answers: { [q1.id]: 0 } } }),
      await as(mia)(`${mod(first)}/submit`, { method: "POST", body: { answers: { [q1.id]: 1 } } })
    ]) {
      assert.equal(res.status, 409);
      assert.equal(res.data.code, "CANCELLED");
      assert.match(res.data.error, /cancelled because you left/);
    }
    // Nothing was marked, and the answer saved before the leave is still there for the teacher.
    const attempt = readDB().attempts.find((a) => a.participantId === participantId && a.moduleId === first.id);
    assert.equal(attempt.submittedAt, null);
    assert.deepEqual(attempt.answers, { [q1.id]: 1 });
    assert.equal(readDB().attempts.some((a) => a.participantId === participantId && a.moduleId === second.id), false);
  });

  test("the student and the teacher both see that it was cancelled, and why", async () => {
    const overview = (await as(mia)(`/api/exam/session/${sessionId}/overview`)).data;
    assert.equal(overview.cancelled.reason, "switched to another window");
    const mine = (await as(mia)("/api/student/history")).data.sessions.find((s) => s.sessionId === sessionId);
    assert.equal(mine.cancelled.kind, "blur");
    assert.equal((await as(mia)(`/api/student/sessions/${sessionId}/results`)).data.cancelled.kind, "blur");

    const row = (await admin(`/api/sessions/${sessionId}`)).data.participants.find((p) => p.id === participantId);
    assert.equal(row.cancelled.moduleName, first.name);
    assert.equal(row.cancelled.reason, "switched to another window");
    assert.equal(row.letBackIn, 0);
    assert.equal((await admin(`/api/sessions/${sessionId}/participants/${participantId}`)).data.cancelled.moduleId, first.id);
    const csv = (await admin(`/api/admin/sessions/${sessionId}/export.csv`)).data;
    assert.match(csv.split("\n")[0], /,Note$/);
    assert.match(csv, /Cancelled: switched to another window/);
  });

  test("a teacher lets the student back in, with the time the module was closed for", async () => {
    assert.equal((await as(mia)(`/api/sessions/${sessionId}/participants/${participantId}/reinstate`, { method: "POST" })).status, 403);
    assert.equal((await admin(`/api/sessions/${sessionId}/participants/nope/reinstate`, { method: "POST" })).status, 404);
    // Say the leave was five minutes ago.
    updateDB((db) => (db.participants.find((p) => p.id === participantId).cancelled.at = minutesAgo(5)));
    const before = Date.parse(readDB().attempts.find((a) => a.participantId === participantId && a.moduleId === first.id).startedAt);

    const res = await admin(`/api/sessions/${sessionId}/participants/${participantId}/reinstate`, { method: "POST" });
    assert.equal(res.status, 200);
    assert.equal(res.data.cancelled, null);
    assert.equal(res.data.letBackIn, 1);
    const after = Date.parse(readDB().attempts.find((a) => a.participantId === participantId && a.moduleId === first.id).startedAt);
    assert.ok(near(after - before, 5 * 60000), `the start moved ${after - before} ms`);
    assert.equal(participant().lockLog[0].by, "Tea Cher");
    assert.equal((await admin(`/api/sessions/${sessionId}/participants/${participantId}/reinstate`, { method: "POST" })).status, 409);
  });

  test("a report left over from before the teacher's decision doesn't cancel it again", async () => {
    const stale = await leave({ kind: "closed", round: 0 });
    assert.equal(stale.data.stale, true);
    assert.equal(stale.data.cancelled, null);
    const overview = (await as(mia)(`/api/exam/session/${sessionId}/overview`)).data;
    assert.equal(overview.cancelled, null);
    assert.equal(overview.lockRound, 1);
  });

  test("the student carries on where they were, and the module is marked as usual", async () => {
    const opened = await as(mia)(mod(first));
    assert.equal(opened.status, 200);
    assert.equal(opened.data.lockRound, 1);
    assert.deepEqual(opened.data.savedAnswers, { [q1.id]: 1 });
    assert.ok(opened.data.remainingSeconds > first.timeLimitMinutes * 60 - 30, "almost the whole module is left");
    const done = await as(mia)(`${mod(first)}/submit`, { method: "POST", body: { answers: { [q1.id]: 1 } } });
    assert.equal(done.status, 200);
    assert.equal(done.data.raw, 1);
    // Between modules a leave is nothing.
    assert.equal((await leave({ kind: "hidden", round: 1 })).data.cancelled, null);
  });

  test("leaving the next module cancels again, in the new round", async () => {
    assert.equal((await as(mia)(mod(second))).status, 200);
    const res = await leave({ kind: "nonsense", round: 1 });
    assert.equal(res.data.cancelled.kind, "hidden");
    const row = (await admin(`/api/sessions/${sessionId}`)).data.participants.find((p) => p.id === participantId);
    assert.equal(row.cancelled.moduleName, second.name);
    assert.equal(row.letBackIn, 1);
    // The module handed in before the leave keeps its score.
    assert.equal(row.modules.find((m) => m.moduleId === first.id).raw, 1);
    assert.equal(q2.id.length > 0, true);
  });
});

describe("a SAT diagnostic test", () => {
  const xp = async () => (await as(mia)("/api/practice/progress")).data.xp;

  test("leaving it cancels it: no score, nothing recorded, nothing earned", async () => {
    const before = await xp();
    const d = (await as(mia)("/api/diagnostic/start", { method: "POST" })).data.diagnostic;
    assert.equal(d.status, "in_progress");
    const mcq = d.questions.filter((q) => q.type === "mcq");
    const answers = Object.fromEntries(mcq.map((q) => [q.id, 0]));
    assert.equal((await as(mia)(`/api/diagnostic/${d.id}/answers`, { method: "PUT", body: { answers } })).status, 200);

    const res = await as(mia)(`/api/diagnostic/${d.id}/leave`, { method: "POST", body: { kind: "hidden" } });
    assert.equal(res.status, 200);
    assert.equal(res.data.diagnostic.status, "cancelled");
    assert.equal(res.data.diagnostic.cancelled.reason, "switched to another tab or app");
    assert.equal(res.data.diagnostic.total, null);

    // Closed for good: it can't be saved to or handed in for a score.
    assert.equal((await as(mia)(`/api/diagnostic/${d.id}/answers`, { method: "PUT", body: { answers } })).data.code, "CLOSED");
    const submitted = await as(mia)(`/api/diagnostic/${d.id}/submit`, { method: "POST", body: { answers } });
    assert.equal(submitted.data.diagnostic.status, "cancelled");
    assert.equal(submitted.data.diagnostic.result, null);
    assert.equal(submitted.data.reward, null);
    assert.equal((await as(mia)(`/api/diagnostic/${d.id}`)).data.diagnostic.status, "cancelled");

    assert.equal(await xp(), before);
    const p = readDB().progress.find((x) => x.userId === mia.id);
    assert.equal(Object.keys(p?.answered || {}).length, 0, "no answer was recorded as practice");

    const overview = (await as(mia)("/api/diagnostic")).data;
    assert.equal(overview.open, null);
    assert.equal(overview.history[0].id, d.id);
    assert.equal(overview.history[0].status, "cancelled");
    assert.equal(overview.canStart, true);

    // The next one is made of questions the cancelled one didn't show.
    const next = (await as(mia)("/api/diagnostic/start", { method: "POST" })).data.diagnostic;
    assert.notEqual(next.id, d.id);
    const seen = new Set(d.questions.map((q) => q.id));
    assert.equal(next.questions.some((q) => seen.has(q.id)), false);
  });

  test("one that has already been handed in stays as it ended", async () => {
    const open = (await as(mia)("/api/diagnostic")).data.open;
    const d = (await as(mia)(`/api/diagnostic/${open.id}`)).data.diagnostic;
    const answers = Object.fromEntries(d.questions.filter((q) => q.type === "mcq").map((q) => [q.id, 0]));
    const done = await as(mia)(`/api/diagnostic/${d.id}/submit`, { method: "POST", body: { answers } });
    assert.equal(done.data.diagnostic.status, "completed");
    const res = await as(mia)(`/api/diagnostic/${d.id}/leave`, { method: "POST", body: { kind: "closed" } });
    assert.equal(res.data.diagnostic.status, "completed");
    assert.equal(res.data.diagnostic.cancelled, null);
  });

  test("nobody can cancel someone else's", async () => {
    const d = (await as(eli)("/api/diagnostic/start", { method: "POST" })).data.diagnostic;
    assert.equal((await as(mia)(`/api/diagnostic/${d.id}/leave`, { method: "POST", body: {} })).status, 404);
    assert.equal((await as(eli)(`/api/diagnostic/${d.id}`)).data.diagnostic.status, "in_progress");
  });
});

describe("an IELTS mock test", () => {
  let sessionId;
  let cand;
  const exam = () => readDB().ieltsExams.find((e) => e.sessionId === sessionId && e.userId === mia.id);
  const leave = (body) => api("/api/ielts/exam/leave", { method: "POST", body, auth: cand });
  const login = () => api("/api/ielts/exam/login", { method: "POST", body: { candidateId: String(readDB().users.find((u) => u.id === mia.id).candidateId) } });

  before(async () => {
    sessionId = (await admin("/api/ielts/admin/sessions", { method: "POST", body: { name: "Locked IELTS", studentLimit: 5, date: "2026-10-12", time: "10:00" } })).data.id;
    await admin(`/api/ielts/admin/sessions/${sessionId}/participants`, { method: "POST", body: { userId: mia.id } });
    await admin(`/api/ielts/admin/sessions/${sessionId}/status`, { method: "POST", body: { status: "started" } });
    cand = (await login()).data.token;
  });

  test("before a section is running there is nothing to cancel", async () => {
    const st = await api("/api/ielts/exam/state", { auth: cand });
    assert.equal(st.status, 200);
    assert.equal(st.data.lockRound, 0);
    assert.equal(typeof st.data.examId, "string");
    assert.equal((await leave({ kind: "hidden", round: 0 })).data.cancelled, null);
    assert.equal((await api("/api/ielts/exam/leave", { method: "POST", body: {} })).status, 401);
  });

  test("leaving a running section cancels the exam", async () => {
    assert.equal((await api("/api/ielts/exam/section/listening/start", { method: "POST", auth: cand })).status, 200);
    assert.equal((await api("/api/ielts/exam/section/listening/answers", { method: "PUT", body: { answers: { x1: "kept" }, flags: [] }, auth: cand })).status, 200);
    const res = await leave({ kind: "closed", round: 0 });
    assert.equal(res.data.cancelled.reason, "closed or reloaded the test page");
    assert.equal(exam().cancelled.section, "listening");

    for (const res2 of [
      await api("/api/ielts/exam/state", { auth: cand }),
      await api("/api/ielts/exam/section/listening", { auth: cand }),
      await api("/api/ielts/exam/section/listening/answers", { method: "PUT", body: { answers: {}, flags: [] }, auth: cand }),
      await api("/api/ielts/exam/section/listening/submit", { method: "POST", body: { answers: {} }, auth: cand })
    ]) {
      assert.equal(res2.status, 409);
      assert.equal(res2.data.code, "CANCELLED");
    }
    // Signing in again doesn't get round it, from the exam room or from the hub.
    const again = await login();
    assert.equal(again.status, 409);
    assert.match(again.data.error, /cancelled because you left/);
    assert.equal((await as(mia)(`/api/ielts/student/sessions/${sessionId}/enter`, { method: "POST" })).status, 409);
  });

  test("the student and the teacher see it; closing the session doesn't mark it", async () => {
    const mine = (await as(mia)("/api/ielts/student/sessions")).data.sessions.find((s) => s.id === sessionId);
    assert.equal(mine.cancelled.kind, "closed");
    assert.equal(mine.canEnter, false);
    const row = (await admin(`/api/ielts/admin/sessions/${sessionId}`)).data.participants.find((p) => p.user.id === mia.id);
    assert.equal(row.cancelled.section, "listening");
    assert.equal(row.letBackIn, 0);

    // Its clock runs out and the teacher closes the session: the section is still not marked.
    updateDB((db) => (db.ieltsExams.find((e) => e.sessionId === sessionId).sections.listening.deadline = minutesAgo(30)));
    await admin(`/api/ielts/admin/sessions/${sessionId}/status`, { method: "POST", body: { status: "completed" } });
    assert.equal(exam().sections.listening.status, "in_progress");
    assert.equal(exam().results.listening, undefined);
    assert.equal(readDB().ieltsAttempts.some((a) => a.examId === exam().id), false);
    await admin(`/api/ielts/admin/sessions/${sessionId}/status`, { method: "POST", body: { status: "started" } });
  });

  test("a teacher lets the candidate back in, with the time the section was closed for", async () => {
    updateDB((db) => {
      const e = db.ieltsExams.find((x) => x.sessionId === sessionId);
      e.cancelled.at = minutesAgo(5);
      e.sections.listening.deadline = new Date(Date.now() + 60000).toISOString();
    });
    const before = Date.parse(exam().sections.listening.deadline);
    const res = await admin(`/api/ielts/admin/sessions/${sessionId}/participants/${mia.id}/reinstate`, { method: "POST" });
    assert.equal(res.status, 200);
    assert.equal(res.data.cancelled, null);
    assert.equal(res.data.letBackIn, 1);
    assert.ok(near(Date.parse(exam().sections.listening.deadline) - before, 5 * 60000));
    assert.equal((await admin(`/api/ielts/admin/sessions/${sessionId}/participants/${mia.id}/reinstate`, { method: "POST" })).status, 409);

    // The old page's report is out of date; the exam carries on with what was saved.
    assert.equal((await leave({ kind: "hidden", round: 0 })).data.stale, true);
    const st = await api("/api/ielts/exam/state", { auth: cand });
    assert.equal(st.status, 200);
    assert.equal(st.data.lockRound, 1);
    const resumed = await api("/api/ielts/exam/section/listening", { auth: cand });
    assert.equal(resumed.status, 200);
    assert.deepEqual(resumed.data.answers, { x1: "kept" });
    const done = await api("/api/ielts/exam/section/listening/submit", { method: "POST", body: { answers: {} }, auth: cand });
    assert.equal(done.status, 200);
    assert.notEqual(done.data.step, "listening");
  });
});

describe("an IELTS diagnostic test", () => {
  const diag = (p = "", opts) => as(mia)(`/api/ielts/student/diagnostic${p}`, opts);

  test("leaving it cancels it: no band, no practice attempt, and the next one is another part", async () => {
    const d = (await diag("/start", { method: "POST" })).data.diagnostic;
    assert.equal(d.status, "created");
    // Not started yet: there is nothing to cancel.
    assert.equal((await diag(`/${d.id}/leave`, { method: "POST", body: { kind: "hidden" } })).data.diagnostic.status, "created");
    assert.equal((await diag(`/${d.id}/begin`, { method: "POST" })).data.diagnostic.status, "in_progress");

    const res = await diag(`/${d.id}/leave`, { method: "POST", body: { kind: "exit" } });
    assert.equal(res.data.diagnostic.status, "cancelled");
    assert.equal(res.data.diagnostic.cancelled.reason, "left the test");
    assert.equal(res.data.diagnostic.result, null);

    assert.equal((await diag(`/${d.id}/answers`, { method: "PUT", body: { answers: {} } })).data.code, "CLOSED");
    assert.equal((await diag(`/${d.id}/begin`, { method: "POST" })).data.code, "CLOSED");
    const submitted = await diag(`/${d.id}/submit`, { method: "POST", body: { answers: {} } });
    assert.equal(submitted.data.diagnostic.status, "cancelled");
    assert.equal(submitted.data.reward, null);
    assert.equal(readDB().ieltsPracticeAttempts.some((a) => a.userId === mia.id), false);

    const overview = (await diag()).data;
    assert.equal(overview.open, null);
    assert.equal(overview.history[0].id, d.id);
    assert.equal(overview.history[0].status, "cancelled");
    const next = (await diag("/start", { method: "POST" })).data.diagnostic;
    assert.notEqual(next.refId, d.refId);
  });
});

describe("homework: leaving the page is counted for the teacher", () => {
  let hw;
  let other;
  let questions;
  const leave = (who, id, body) => as(who)(`/api/class/homework/${id}/leave`, { method: "POST", body });
  const row = async (who) => (await admin(`/api/admin/homework/${hw}`)).data.students.find((s) => s.id === who.id);

  before(async () => {
    questions = readDB().practiceQuestions.filter((q) => (q.type || "mcq") === "mcq" && typeof q.correctIndex === "number").slice(0, 2);
    const due = G.dayOffset(G.todayKey(), 1);
    hw = (await admin("/api/admin/homework", { method: "POST", body: { title: "Two questions", classIds: [K.a.id], due, questionIds: questions.map((q) => q.id) } })).data.id;
    other = (await admin("/api/admin/homework", { method: "POST", body: { title: "8B only", classIds: [K.b.id], due, questionIds: [questions[0].id] } })).data.id;
  });

  test("only for a homework given to the student's own class", async () => {
    const out = await leave(eli, hw, { event: "left" });
    assert.equal(out.status, 403);
    assert.equal(out.data.code, "NOT_IN_CLASS");
    assert.equal((await api(`/api/class/homework/${hw}/leave`, { method: "POST", body: {} })).status, 401);
    assert.equal((await leave(ana, other, { event: "left" })).data.noted, false);
    assert.equal((await leave(ana, "nope", { event: "left" })).data.noted, false);
    assert.equal(readDB().homework.find((h) => h.id === other).leaves?.[ana.id], undefined);
  });

  test("each leave is counted, and the time away is added when the student comes back", async () => {
    assert.equal((await leave(ana, hw, { event: "left" })).data.noted, true);
    await leave(ana, hw, { event: "back", seconds: 42 });
    await leave(ana, hw, { event: "left" });
    for (const seconds of [-5, "soon", null, {}, 0]) await leave(ana, hw, { event: "back", seconds });
    const mine = await row(ana);
    assert.equal(mine.leaves.n, 2);
    assert.equal(mine.leaves.seconds, 42);
    assert.ok(near(Date.parse(mine.leaves.last), Date.now(), 10000));
    assert.equal((await row(ben)).leaves, null);

    const listed = (await admin("/api/admin/homework")).data.homework.find((h) => h.id === hw);
    assert.equal(listed.classes[0].left, 1);
    // A student's own homework list says nothing about it.
    const own = (await as(ana)("/api/class/homework")).data.homework.find((h) => h.id === hw);
    assert.equal("leaves" in own, false);
  });

  test("a silly amount of time away is capped", async () => {
    await leave(ben, hw, { event: "left" });
    await leave(ben, hw, { event: "back", seconds: 10 ** 9 });
    assert.equal((await row(ben)).leaves.seconds, 6 * 3600);
  });

  test("once the homework is finished, leaving the page is nobody's business", async () => {
    for (const q of questions) await as(ana)(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: q.correctIndex, timeMs: 20000 } });
    assert.ok((await row(ana)).finishedAt);
    assert.equal((await leave(ana, hw, { event: "left" })).data.noted, false);
    assert.equal((await row(ana)).leaves.n, 2);
  });
});
