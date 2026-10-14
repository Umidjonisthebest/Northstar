// IELTS diagnostic test over HTTP against a throwaway database: a random
// listening part or reading passage the student has never tried, run on the
// server clock, closed in practice meanwhile, and marked into a band.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-ielts-diagnostic-"));
process.env.DB_PATH = path.join(tmpDir, "db.json");
process.env.UPLOAD_DIR = path.join(tmpDir, "uploads");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const { default: app } = await import("../app.js");
const { updateDB, readDB } = await import("../db.js");
const lib = await import("./lib/diagnostic.js");
const { groupSlots } = await import("./lib/questions.js");
const { practiceRecords } = await import("./lib/practice.js");

let server;
let base;
let token;
let userId;

async function api(method, url, { auth = token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function register(firstName, email) {
  const { data } = await api("POST", "/api/student/register", { auth: null, body: { firstName, lastName: "D", email, password: "password1" } });
  return { token: data.token, id: data.user.id };
}

before(async () => {
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  ({ token, id: userId } = await register("Iris", "iris-diag@test.dev"));
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// The full answer key of a part, in the shape the exam screen sends.
function keyAnswers(kind, id) {
  const record = readDB()[kind === "listening" ? "ieltsListening" : "ieltsReading"].find((r) => r.id === id);
  const answers = {};
  for (const g of record.groups) {
    for (const s of groupSlots(g)) {
      if (s.mode === "multi") answers[s.itemId] = (g.items.find((it) => it.id === s.itemId).correct || []).slice();
      else answers[s.id] = g.answers[s.id].value;
    }
  }
  return answers;
}

test("the pick is random between skills and only ever uses parts the student hasn't tried", () => {
  const db = readDB();
  const listening = practiceRecords(db, "listening");
  const reading = practiceRecords(db, "reading");
  // rnd < 0.5 picks listening, >= 0.5 reading (both have new parts).
  assert.equal(lib.pickPart(db, "nobody", () => 0.1).kind, "listening");
  assert.equal(lib.pickPart(db, "nobody", () => 0.9).kind, "reading");

  // Tried in practice, in an earlier diagnostic, or in a mock: all excluded.
  db.ieltsPracticeAttempts.push(...listening.slice(0, -1).map((r) => ({ userId: "u1", refId: r.id })));
  db.ieltsDiagnostics.push({ userId: "u1", refId: listening[listening.length - 1].id });
  db.ieltsAttempts.push({ userId: "u1", refId: reading[0].id });
  const fresh = lib.freshParts(db, "u1");
  assert.equal(fresh.listening.length, 0);
  assert.deepEqual(fresh.reading.map((r) => r.id), reading.slice(1).map((r) => r.id));
  for (let i = 0; i < 20; i++) {
    const pick = lib.pickPart(db, "u1");
    assert.equal(pick.kind, "reading");
    assert.ok(pick.record.id !== reading[0].id);
  }
  // Mock-only material is never a diagnostic.
  assert.ok([...fresh.reading].every((r) => r.use === "practice" || r.use === "both"));
  assert.equal(lib.cefrFor(6.5), "B2");
  assert.equal(lib.cefrFor(7), "C1");
  assert.equal(lib.cefrFor(3.5), "Below B1");
});

let diag;

test("the overview counts new parts, and starting assigns one that stays put", async () => {
  assert.equal((await api("GET", "/api/ielts/student/diagnostic", { auth: null })).status, 401);
  const overview = (await api("GET", "/api/ielts/student/diagnostic")).data;
  // The section-practice set. The parts of the practice tests are theirs alone: never a diagnostic.
  assert.deepEqual(overview.available, { listening: 4, reading: 3 });
  assert.equal(overview.canStart, true);
  assert.equal(overview.open, null);

  const start = await api("POST", "/api/ielts/student/diagnostic/start");
  assert.equal(start.status, 200);
  diag = start.data.diagnostic;
  assert.ok(["listening", "reading"].includes(diag.kind));
  assert.equal(diag.status, "created");
  // Starting again (or reloading) doesn't reroll the part.
  for (let i = 0; i < 5; i++) assert.equal((await api("POST", "/api/ielts/student/diagnostic/start")).data.diagnostic.id, diag.id);

  // Meanwhile the part is closed in section practice.
  const list = (await api("GET", "/api/ielts/student/practice")).data;
  assert.equal(list[diag.kind].find((i) => i.id === diag.refId).inDiagnostic, true);
  assert.equal((await api("GET", `/api/ielts/student/practice/${diag.kind}/${diag.refId}`)).status, 409);
  assert.equal((await api("POST", `/api/ielts/student/practice/${diag.kind}/${diag.refId}/submit`, { body: { answers: {} } })).status, 409);
});

test("the part is sent without its key, and the clock starts on begin", async () => {
  const before = (await api("GET", `/api/ielts/student/diagnostic/${diag.id}`)).data;
  assert.equal(before.diagnostic.status, "created");
  assert.equal(before.diagnostic.remainingSeconds, null);
  assert.equal(before.review, null);
  const text = JSON.stringify(before.part);
  assert.ok(!text.includes('"answers"') && !text.includes('"correct"') && !text.includes("transcriptHtml"));
  assert.equal(before.part.refId, diag.refId);

  const begun = (await api("POST", `/api/ielts/student/diagnostic/${diag.id}/begin`)).data;
  assert.equal(begun.diagnostic.status, "in_progress");
  const expected = diag.kind === "reading" ? 20 * 60 : Math.round(readDB().ieltsListening.find((r) => r.id === diag.refId).durationMinutes * 60) + 60;
  assert.equal(begun.diagnostic.durationSeconds, expected);
  assert.ok(begun.diagnostic.remainingSeconds <= expected && begun.diagnostic.remainingSeconds >= expected - 2);
  assert.ok(begun.diagnostic.elapsedSeconds <= 2);
  // Begin is idempotent: a reload keeps the same deadline.
  const deadline = readDB().ieltsDiagnostics.find((d) => d.id === diag.id).deadline;
  await api("POST", `/api/ielts/student/diagnostic/${diag.id}/begin`);
  assert.equal(readDB().ieltsDiagnostics.find((d) => d.id === diag.id).deadline, deadline);
});

test("answers autosave, keeping only this part's questions", async () => {
  const key = keyAnswers(diag.kind, diag.refId);
  const [firstSlot, firstValue] = Object.entries(key)[0];
  const res = await api("PUT", `/api/ielts/student/diagnostic/${diag.id}/answers`, { body: { answers: { [firstSlot]: firstValue, "not-a-slot": "x" }, flags: [firstSlot] } });
  assert.equal(res.status, 200);
  const stored = readDB().ieltsDiagnostics.find((d) => d.id === diag.id);
  assert.deepEqual(stored.answers, { [firstSlot]: firstValue });
  assert.deepEqual(stored.flags, [firstSlot]);
  assert.deepEqual((await api("GET", `/api/ielts/student/diagnostic/${diag.id}`)).data.diagnostic.answers, stored.answers);
});

test("submitting marks it into a band, counts it as a practice attempt and reopens the part", async () => {
  const key = keyAnswers(diag.kind, diag.refId);
  const slots = Object.keys(key);
  const answers = { ...key };
  delete answers[slots[0]];
  const { status, data } = await api("POST", `/api/ielts/student/diagnostic/${diag.id}/submit`, { body: { answers, flags: [] } });
  assert.equal(status, 200);
  const r = data.diagnostic.result;
  assert.equal(data.diagnostic.status, "completed");
  assert.equal(r.total, data.item.questionCount);
  assert.ok(r.correct >= r.total - 2 && r.correct < r.total, `${r.correct}/${r.total}`);
  assert.equal(r.cefr, lib.cefrFor(r.band));
  assert.ok(data.review.rows.length === r.total && Object.keys(data.review.keys).length > 0);
  if (diag.kind === "listening") assert.ok(data.review.transcriptHtml);
  assert.ok(data.reward.newBadges.some((b) => b.id === "pathfinder"));

  const attempt = readDB().ieltsPracticeAttempts.find((a) => a.diagnosticId === diag.id);
  assert.equal(attempt.userId, userId);
  assert.equal(attempt.correct, r.correct);
  const list = (await api("GET", "/api/ielts/student/practice")).data;
  const item = list[diag.kind].find((i) => i.id === diag.refId);
  assert.equal(item.attempts, 1);
  assert.equal(item.inDiagnostic, false);
  assert.equal((await api("GET", `/api/ielts/student/practice/${diag.kind}/${diag.refId}`)).status, 200);

  // The hub dashboard and the teacher's profile both see the band.
  const progress = (await api("GET", "/api/practice/progress")).data;
  assert.equal(progress.ieltsDiagnostic.bands[diag.kind].band, r.band);
  assert.equal(progress.ieltsDiagnostic.open, null);
  const again = await api("POST", `/api/ielts/student/diagnostic/${diag.id}/submit`, { body: { answers: {} } });
  assert.equal(again.data.diagnostic.result.correct, r.correct);
  assert.equal(again.data.reward, null);
});

// The first `slots` questions of a part's key (a "choose TWO" item counts as two).
function someAnswers(kind, id, slots) {
  const out = {};
  let n = 0;
  for (const [key, value] of Object.entries(keyAnswers(kind, id))) {
    if (n >= slots) break;
    out[key] = value;
    n += Array.isArray(value) ? value.length : 1;
  }
  return { answers: out, n };
}
const expire = (id) =>
  updateDB((db) => {
    const d = db.ieltsDiagnostics.find((x) => x.id === id);
    d.deadline = new Date(Date.now() - 3 * 60000).toISOString();
  });

test("the next diagnostic is a different part; when time runs out it's marked if at least half is answered", async () => {
  const next = (await api("POST", "/api/ielts/student/diagnostic/start")).data.diagnostic;
  assert.notEqual(next.refId, diag.refId);
  const begun = (await api("POST", `/api/ielts/student/diagnostic/${next.id}/begin`)).data;
  const { answers, n } = someAnswers(next.kind, next.refId, Math.ceil(begun.item.questionCount / 2));
  await api("PUT", `/api/ielts/student/diagnostic/${next.id}/answers`, { body: { answers } });
  expire(next.id);
  const late = await api("PUT", `/api/ielts/student/diagnostic/${next.id}/answers`, { body: { answers: {} } });
  assert.equal(late.data.code, "TIME_UP");
  const closed = (await api("GET", `/api/ielts/student/diagnostic/${next.id}`)).data.diagnostic;
  assert.equal(closed.status, "completed");
  assert.equal(closed.auto, true);
  assert.equal(closed.result.correct, n);

  // Walked away after one answer: no band, and the part still counts as seen.
  const third = (await api("POST", "/api/ielts/student/diagnostic/start")).data.diagnostic;
  assert.ok(![diag.refId, next.refId].includes(third.refId));
  await api("POST", `/api/ielts/student/diagnostic/${third.id}/begin`);
  await api("PUT", `/api/ielts/student/diagnostic/${third.id}/answers`, { body: { answers: someAnswers(third.kind, third.refId, 1).answers } });
  expire(third.id);
  const overview = (await api("GET", "/api/ielts/student/diagnostic")).data;
  assert.equal(overview.history.length, 3);
  const gone = overview.history.find((h) => h.id === third.id);
  assert.equal(gone.status, "expired");
  assert.equal(gone.result, null);
  assert.ok(gone.answered >= 1);
  assert.equal(overview.available.listening + overview.available.reading, 4);
  assert.ok(!readDB().ieltsPracticeAttempts.some((a) => a.diagnosticId === third.id));
});

test("with every part tried there's nothing to start; nothing answered means no band", async () => {
  const other = await register("Noor", "noor-diag@test.dev");
  const started = (await api("POST", "/api/ielts/student/diagnostic/start", { auth: other.token })).data.diagnostic;
  await api("POST", `/api/ielts/student/diagnostic/${started.id}/begin`, { auth: other.token });
  const empty = await api("POST", `/api/ielts/student/diagnostic/${started.id}/submit`, { auth: other.token, body: { answers: {} } });
  assert.equal(empty.data.diagnostic.status, "expired");
  assert.equal(empty.data.diagnostic.result, null);
  assert.equal(empty.data.reward, null);

  updateDB((db) => {
    for (const kind of ["listening", "reading"]) {
      for (const r of practiceRecords(db, kind)) db.ieltsPracticeAttempts.push({ id: `x-${r.id}`, userId: other.id, kind, refId: r.id, correct: 1, total: 10, createdAt: new Date().toISOString() });
    }
  });
  const overview = (await api("GET", "/api/ielts/student/diagnostic", { auth: other.token })).data;
  assert.equal(overview.canStart, false);
  assert.match(overview.reason, /already tried every/);
  assert.equal((await api("POST", "/api/ielts/student/diagnostic/start", { auth: other.token })).status, 409);
  // And nobody can open someone else's diagnostic.
  assert.equal((await api("GET", `/api/ielts/student/diagnostic/${diag.id}`, { auth: other.token })).status, 404);
});
