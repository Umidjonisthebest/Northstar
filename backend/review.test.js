import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

// Round 2, Part 6: the spaced-review schedule, the student's "why I missed it" tags and the trap
// profile. The schedule's rules are tested on their own first, then everything over HTTP against a
// throwaway database (like practice.test.js).
const dbPath = path.join(os.tmpdir(), `northstar-review-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_AUTH_TOKEN = "";

let server;
let base;
let token;
let userId;
let readDB;
let updateDB;
let G; // gamification.js
let R; // review.js

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  G = await import("./gamification.js");
  R = await import("./review.js");
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  const reg = await api("/api/student/register", { method: "POST", body: { firstName: "Rae", lastName: "V", email: "rae-review@test.local", password: "password1" } });
  token = reg.data.token;
  userId = reg.data.user.id;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dbPath, { force: true });
});

async function api(p, { method = "GET", body, auth } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...((auth ?? token) ? { authorization: `Bearer ${auth ?? token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const progress = () => readDB().progress.find((p) => p.userId === userId);
const change = (fn) => updateDB((db) => fn(G.getProgress(db, userId), db));
// Starter multiple-choice questions on one skill, each used by one test so they don't disturb each other.
let pool;
const takeQ = (pred = () => true) => {
  pool ||= readDB().practiceQuestions.filter((q) => q.type !== "grid_in" && !q.promptImage);
  const i = pool.findIndex(pred);
  assert.ok(i >= 0, "ran out of questions for the test");
  return pool.splice(i, 1)[0];
};
const wrongOf = (q) => (q.correctIndex + 1) % q.options.length;
const answer = (q, value, extra = {}) => api(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: value, ...extra } });
// Moves a question's review day, as if that many days had gone by.
const dueInDays = (q, days) => change((p) => (p.review[q.id].due = G.dayOffset(G.todayKey(), days)));

describe("the review schedule (rules)", () => {
  const day = (n) => G.dayOffset("2026-10-01", n);
  const fresh = () => ({ review: {}, reviewGraduated: 0 });

  test("a miss comes back the next day, then after 3, 7 and 14 days, and then leaves", () => {
    const p = fresh();
    assert.deepEqual(G.REVIEW_GAPS, [1, 3, 7, 14]);
    assert.deepEqual(G.scheduleReview(p, "q", { correct: false, today: day(0) }), { state: "scheduled", box: 0, due: day(1), days: 1 });

    let today = day(1);
    for (const [box, gap] of [[1, 3], [2, 7], [3, 14]]) {
      const r = G.scheduleReview(p, "q", { correct: true, today });
      assert.deepEqual(r, { state: "advanced", box, due: G.dayOffset(today, gap), days: gap });
      today = r.due;
    }
    assert.equal(G.scheduleReview(p, "q", { correct: true, today }).state, "graduated");
    assert.equal("q" in p.review, false);
    assert.equal(p.reviewGraduated, 1);
  });

  test("a right answer before the review day changes nothing, so a question can't be crammed through", () => {
    const p = fresh();
    G.scheduleReview(p, "q", { correct: false, today: day(0) });
    const r = G.scheduleReview(p, "q", { correct: true, today: day(0) });
    assert.equal(r.state, "early");
    assert.equal(r.days, 1);
    assert.deepEqual(p.review.q, { box: 0, due: day(1), lapses: 0 });
  });

  test("a right answer with help keeps the box and comes back tomorrow", () => {
    const p = fresh();
    p.review.q = { box: 2, due: day(0), lapses: 0 };
    assert.deepEqual(G.scheduleReview(p, "q", { correct: true, assisted: true, today: day(4) }), { state: "again", box: 2, due: day(5), days: 1 });
  });

  test("a miss at any point starts again from the first box, and counts as a lapse", () => {
    const p = fresh();
    p.review.q = { box: 3, due: day(9), lapses: 0 };
    assert.equal(G.scheduleReview(p, "q", { correct: false, today: day(2) }).state, "lapsed");
    assert.deepEqual(p.review.q, { box: 0, due: day(3), lapses: 1 });
    // A second wrong try the same day is not another lapse.
    assert.equal(G.scheduleReview(p, "q", { correct: false, today: day(2) }).state, "scheduled");
    assert.equal(p.review.q.lapses, 1);
  });

  test("a question that was never missed is not in the schedule", () => {
    const p = fresh();
    assert.equal(G.scheduleReview(p, "q", { correct: true, today: day(0) }), null);
    assert.deepEqual(p.review, {});
  });

  test("the status counts what is due (overdue included), what is next, and ignores deleted questions", () => {
    const p = fresh();
    p.review = { a: { box: 0, due: day(-3) }, b: { box: 1, due: day(0) }, c: { box: 2, due: day(2) }, d: { box: 2, due: day(2) }, gone: { box: 0, due: day(0) } };
    const s = G.reviewStatus(p, (id) => id !== "gone", day(0));
    assert.equal(s.due, 2);
    assert.equal(s.scheduled, 4);
    assert.deepEqual(s.next, { date: day(2), days: 2, count: 2 });
    assert.deepEqual(s.week.map((d) => d.count), [2, 0, 2, 0, 0, 0, 0]);
    assert.deepEqual(s.boxes.map((b) => b.count), [1, 1, 2, 0]);
  });

  test("a student who already had a mistakes queue starts with it on the schedule", () => {
    const lastAt = "2026-09-20T08:00:00.000Z";
    const db = { progress: [{ userId: "old", xp: 0, xpLog: {}, saved: ["m1", "ok1"], answered: { m1: { attempts: 1, correct: 0, lastCorrect: false, lastAt }, ok1: { attempts: 2, correct: 1, lastCorrect: true, lastAt } }, badges: [], drills: [], vocab: {}, plan: {} }] };
    const p = G.getProgress(db, "old");
    assert.deepEqual(p.review, { m1: { box: 0, due: "2026-09-21", lapses: 0 } });
    assert.equal(G.reviewStatus(p).due, 1);
  });
});

describe("spaced review in the practice player", () => {
  let q;

  test("a wrong answer schedules the question for tomorrow; nothing is due yet", async () => {
    q = takeQ();
    const res = await answer(q, wrongOf(q));
    assert.equal(res.data.correct, false);
    assert.deepEqual(res.data.review, { state: "scheduled", box: 0, due: G.dayOffset(G.todayKey(), 1), days: 1 });

    const status = (await api("/api/practice/review")).data;
    assert.equal(status.scheduled, 1);
    assert.equal(status.due, 0);
    assert.equal(status.next.days, 1);
    assert.equal(status.xp, G.XP.spacedReview);
    assert.equal((await api("/api/practice/questions?source=review")).data.total, 0);
  });

  test("getting it right in the same sitting clears the mistake but not the review", async () => {
    const res = await answer(q, q.correctIndex, { retry: true });
    assert.equal(res.data.correct, true);
    assert.equal(res.data.review.state, "early");
    assert.equal(progress().review[q.id].box, 0);
  });

  test("on its review day it is listed, and a clean right answer moves it on and pays the review XP", async () => {
    dueInDays(q, 0);
    const list = (await api("/api/practice/questions?source=review")).data;
    assert.deepEqual(list.questions.map((x) => x.id), [q.id]);
    assert.deepEqual(list.questions[0].review, { box: 0, due: G.todayKey() });
    assert.equal((await api("/api/practice/progress")).data.review.due, 1);

    const before = progress().xp;
    const res = await answer(q, q.correctIndex);
    assert.deepEqual(res.data.review, { state: "advanced", box: 1, due: G.dayOffset(G.todayKey(), 3), days: 3 });
    // The question's own XP was partly paid by the assisted answer; the review XP comes on top.
    assert.ok(res.data.reward.xpGained >= G.XP.spacedReview);
    assert.equal(progress().xp - before, res.data.reward.xpGained);
    assert.equal((await api("/api/practice/questions?source=review")).data.total, 0);
    assert.equal((await api("/api/practice/progress")).data.review.next.days, 3);
  });

  test("answering it again the same day earns no second review, and no review XP", async () => {
    const res = await answer(q, q.correctIndex);
    assert.equal(res.data.review.state, "early");
    assert.ok(res.data.reward.xpGained < G.XP.spacedReview);
  });

  test("opening the explanation first brings it back tomorrow instead of moving it on", async () => {
    dueInDays(q, -2);
    // (It was solved, so "revealed" is set by hand here: the explanation endpoint only marks unsolved questions.)
    change((p) => p.revealed.push(q.id));
    const res = await answer(q, q.correctIndex);
    assert.deepEqual(res.data.review, { state: "again", box: 1, due: G.dayOffset(G.todayKey(), 1), days: 1 });
  });

  test("the last review graduates the question", async () => {
    change((p) => (p.review[q.id] = { box: G.REVIEW_GAPS.length - 1, due: G.todayKey(), lapses: 0 }));
    const res = await answer(q, q.correctIndex);
    assert.equal(res.data.review.state, "graduated");
    const status = (await api("/api/practice/review")).data;
    assert.equal(status.graduated, 1);
    assert.equal(status.scheduled, 0);
    assert.equal(q.id in progress().review, false);
  });

  test("the review set is ordered: longest overdue first", async () => {
    const [a, b, c] = [takeQ(), takeQ(), takeQ()];
    for (const x of [a, b, c]) await answer(x, wrongOf(x));
    dueInDays(a, -1);
    dueInDays(b, -5);
    dueInDays(c, 0);
    const list = (await api("/api/practice/questions?source=review")).data.questions;
    assert.deepEqual(list.map((x) => x.id), [b.id, a.id, c.id]);
    // Tidy up for the tests below: none of these is due.
    for (const x of [a, b, c]) dueInDays(x, 5);
  });

  test("a miss in the diagnostic or the Daily Star is scheduled too (they share the answer record)", () => {
    const p = { review: {}, reviewGraduated: 0, answered: {}, daily: { date: null } };
    const out = G.recordAnswer(p, { id: "x1", difficulty: "Easy" }, { correct: false });
    assert.equal(out.review.state, "scheduled");
    assert.equal(p.review.x1.box, 0);
  });
});

describe("mistake reasons", () => {
  let q;

  test("the player gets the list of reasons with the rest of its reference data", async () => {
    const { data } = await api("/api/practice/meta");
    assert.deepEqual(data.mistakeReasons.map((r) => r.id), ["misread", "careless", "concept", "trap", "time", "guess"]);
    assert.ok(data.mistakeReasons.every((r) => r.label && r.short && r.tip));
  });

  test("only a question the student has missed can be tagged, and only with a known reason", async () => {
    q = takeQ();
    const tag = (reason) => api(`/api/practice/questions/${q.id}/reason`, { method: "POST", body: { reason } });
    assert.equal((await tag("careless")).status, 409);
    assert.equal((await api("/api/practice/questions/nope/reason", { method: "POST", body: { reason: "careless" } })).status, 404);

    await answer(q, wrongOf(q));
    assert.equal((await tag("bad luck")).status, 400);
    const ok = await tag("careless");
    assert.equal(ok.status, 200);
    assert.equal(ok.data.reason, "careless");
  });

  test("the tag comes back with the question and with its next answer, can be changed, and can be taken back", async () => {
    const find = async () => (await api(`/api/practice/questions?source=saved`)).data.questions.find((x) => x.id === q.id);
    assert.equal((await find()).reason, "careless");
    await api(`/api/practice/questions/${q.id}/reason`, { method: "POST", body: { reason: "trap" } });
    assert.equal((await find()).reason, "trap");
    assert.equal((await answer(q, wrongOf(q), { retry: true })).data.reason, "trap");

    assert.equal((await api(`/api/practice/questions/${q.id}/reason`, { method: "POST", body: { reason: null } })).data.reason, null);
    assert.equal((await find()).reason, null);
    assert.equal(q.id in progress().reasons, false);
  });

  test("a mock-exam mistake can be tagged too, and keeps its tag in the profile after it is cleared", async () => {
    change((p) => p.examMistakes.push({ key: "m1:q1", source: "exam", testTitle: "T", moduleName: "Math", type: "grid_in", prompt: "1 + 1?", givenAnswer: "3", correctAnswer: "2", at: new Date().toISOString() }));
    assert.equal((await api("/api/practice/mistakes/exam/nope/reason", { method: "POST", body: { reason: "time" } })).status, 404);
    assert.equal((await api("/api/practice/mistakes/exam/m1%3Aq1/reason", { method: "POST", body: { reason: "nope" } })).status, 400);
    assert.equal((await api("/api/practice/mistakes/exam/m1%3Aq1/reason", { method: "POST", body: { reason: "time" } })).data.reason, "time");
    assert.equal((await api("/api/practice/mistakes/exam")).data.mistakes[0].reason, "time");
    assert.deepEqual({ r: progress().reasons["exam:m1:q1"].r, section: progress().reasons["exam:m1:q1"].section }, { r: "time", section: "Math" });

    await api("/api/practice/mistakes/exam/m1%3Aq1/clear", { method: "POST" });
    const { data } = await api("/api/practice/traps");
    assert.equal(data.reasons.find((r) => r.id === "time").count, 1);
  });
});

describe("the trap profile", () => {
  test("with nothing answered there is nothing to say, and it says so", () => {
    const db = readDB();
    const p = G.getProgress({ progress: [] }, "nobody");
    const profile = R.trapProfile(db, p);
    assert.equal(profile.headline.kind, "empty");
    assert.equal(profile.signals.misses, 0);
    assert.deepEqual(profile.skills, []);
    assert.equal(R.trapSummary(profile), null);
  });

  test("it counts the reasons given, and the one given most leads when it stands out", async () => {
    const skill = takeQ().topic;
    const three = [takeQ((x) => x.topic === skill), takeQ((x) => x.topic === skill), takeQ((x) => x.topic === skill)];
    for (const x of three) {
      await answer(x, wrongOf(x), { timeMs: 60000 });
      await api(`/api/practice/questions/${x.id}/reason`, { method: "POST", body: { reason: "misread" } });
    }
    const { data } = await api("/api/practice/traps");
    assert.equal(data.reasons[0].id, "misread");
    assert.equal(data.reasons[0].count, 3);
    assert.ok(data.tagged >= 4);
    assert.equal(data.headline.kind, "reason");
    assert.equal(data.headline.reason, "misread");
    assert.match(data.headline.title, /misread the question/);

    // The skill those misses were in is on the list, with its lesson's traps and the reason given for it.
    const row = data.skills.find((s) => s.skill === skill);
    assert.ok(row, "the skill is listed");
    assert.ok(row.misses >= 3);
    assert.equal(row.reason, "misread");
    assert.ok(row.traps.length >= 2);
    assert.ok(row.accuracy >= 0 && row.accuracy <= 1);
    assert.ok(data.untagged >= 1, "misses from earlier tests have no reason yet");
    assert.equal(typeof data.review.due, "number");
  });

  test("what the answers show: rushed misses, slips on easy questions, repeats", () => {
    const db = readDB();
    const easy = db.practiceQuestions.filter((q) => q.section === "Math" && q.difficulty === "Easy").slice(0, 6);
    const p = G.getProgress({ progress: [] }, "sim");
    const at = new Date().toISOString();
    // Six misses on easy Math in ten seconds each, one of them twice; one unhurried right answer.
    p.answerLog = [...easy.map((q) => ({ q: q.id, at, ok: false, ms: 10000 })), { q: easy[0].id, at, ok: false, ms: 10000 }, { q: easy[1].id, at, ok: true, ms: 90000 }];
    const profile = R.trapProfile(db, p);
    assert.equal(profile.signals.misses, 7);
    assert.equal(profile.signals.rushed, 7);
    assert.equal(profile.signals.slow, 0);
    assert.equal(profile.signals.easy, 7);
    assert.equal(profile.signals.repeat, 1);
    assert.deepEqual(profile.signals.bySection.map((s) => [s.name, s.answers, s.misses]), [["Math", 8, 7]]);
    assert.equal(profile.signals.byDifficulty[0].name, "Easy");
    assert.equal(profile.untagged, 6);
    // No tags, so the timing leads.
    assert.equal(profile.headline.kind, "rushed");
    assert.match(R.trapSummary(profile), /go fast/);

    // The same misses at an ordinary pace: now it is the easy questions that stand out.
    p.answerLog = p.answerLog.map((e) => ({ ...e, ms: 80000 }));
    assert.equal(R.trapProfile(db, p).headline.kind, "easy");
  });

  test("answers older than the window, and questions no longer in the bank, are left out", () => {
    const db = readDB();
    const q = db.practiceQuestions[0];
    const p = G.getProgress({ progress: [] }, "sim2");
    const old = new Date(Date.now() - 120 * 86400000).toISOString();
    p.answerLog = [{ q: q.id, at: old, ok: false }, { q: "deleted-question", at: new Date().toISOString(), ok: false }];
    p.reasons = { [q.id]: { r: "guess", at: old } };
    const profile = R.trapProfile(db, p);
    assert.equal(profile.signals.misses, 0);
    assert.equal(profile.tagged, 0);
    assert.equal(profile.headline.kind, "empty");
  });

  test("Nova is told how the student loses points", async () => {
    const res = await fetch(`${base}/api/practice/tutor`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: [{ role: "user", content: "What should I work on?" }] })
    });
    assert.equal(res.status, 200);
    await res.text();
    const { buildSystemPrompt } = await import("./tutor.js");
    const prompt = buildSystemPrompt({ q: null, st: {}, student: { firstName: "Rae", exam: "sat", attempts: 9, accuracy: 0.5, mistakes: 4, traps: "Your most common miss: misread the question." } });
    assert.match(prompt, /How they tend to lose points.*misread the question/);
  });

  test("these routes need a student token", async () => {
    for (const url of ["/api/practice/review", "/api/practice/traps"]) assert.equal((await api(url, { auth: "" })).status, 401);
  });
});
