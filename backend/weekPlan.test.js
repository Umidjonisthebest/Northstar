// The weekly study plan: the tasks are fixed for the week and finished by the student's own graded
// work, never by a tick. The counting rules are checked on a small made-up database first, then
// the whole thing over HTTP against a throwaway database (like practice.test.js).
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

const dbPath = path.join(os.tmpdir(), `northstar-weekplan-test-${Date.now()}.json`);
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
let W; // weekPlan.js

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  G = await import("./gamification.js");
  W = await import("./weekPlan.js");
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  const reg = await api("/api/student/register", { method: "POST", body: { firstName: "Wren", lastName: "P", email: "wren-weekplan@test.local", password: "password1" } });
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
  return { status: res.status, data: await res.json().catch(() => null) };
}

// ---------- A made-up bank: 20 questions on each of six skills, and 4 on a small one ----------
const MON = "2026-10-05";
const day = (n) => G.dayOffset(MON, n);
// A moment on a day of that week, in the app's timezone.
const at = (n, hour = 12) => new Date(G.dayStartMs(day(n)) + hour * 3600000).toISOString();
const SKILLS = { "Reading & Writing": ["Boundaries", "Inferences", "Transitions"], Math: ["Circles", "Ratios", "Probability"] };
const WEAKEST = (section) => SKILLS[section];
const qid = (skill, i) => `${skill}-${i}`;

function world() {
  const practiceQuestions = [];
  for (const [section, skills] of Object.entries(SKILLS)) for (const topic of skills) for (let i = 0; i < 20; i++) practiceQuestions.push({ id: qid(topic, i), section, topic });
  for (let i = 0; i < 4; i++) practiceQuestions.push({ id: qid("Tiny", i), section: "Math", topic: "Tiny" });
  const db = { practiceQuestions, vocab: Array.from({ length: 30 }, (_, i) => ({ id: `w${i}` })), progress: [], participants: [], sessions: [], tests: [], attempts: [] };
  return { db, p: G.getProgress(db, "u1") };
}
const log = (p, id, when, ok = true, extra = {}) => p.answerLog.push({ q: id, at: when, ok, ...extra });
const settle = (db, p, n = 3, extra = {}) => W.settlePlan(db, p, WEAKEST, { today: day(n), ...extra });
const view = (db, p, n = 3) => W.planView(db, p, day(n)).tasks;

describe("the week's tasks", () => {
  test("seven tasks from the weakest skills, fifteen questions each", () => {
    const { db, p } = world();
    const tasks = W.planTasks(db, p, WEAKEST, day(3));
    assert.deepEqual(tasks.map((t) => t.kind), ["drill", "drill", "vocab", "drill", "drill", "mixed", "mistakes"]);
    assert.deepEqual(tasks.filter((t) => t.kind === "drill").map((t) => t.topic), ["Boundaries", "Circles", "Inferences", "Ratios"]);
    assert.deepEqual(tasks.filter((t) => t.kind === "drill").map((t) => t.count), [12, 12, 12, 12], "60% of a 20-question skill");
    assert.deepEqual(tasks.map((t) => t.date), [0, 1, 2, 3, 4, 5, 6].map(day));
    assert.equal(tasks[2].count, W.PLAN.words);
  });

  test("a skill with plenty of questions asks for fifteen, and a small one for a share of what it has", () => {
    const { db, p } = world();
    for (let i = 20; i < 60; i++) db.practiceQuestions.push({ id: qid("Boundaries", i), section: "Reading & Writing", topic: "Boundaries" });
    const tasks = W.planTasks(db, p, (section) => (section === "Math" ? ["Tiny", "Circles"] : SKILLS[section]), day(0));
    assert.equal(tasks[0].count, W.PLAN.questions);
    assert.equal(W.PLAN.questions, 15);
    assert.equal(tasks[1].topic, "Tiny");
    assert.equal(tasks[1].count, 2);
  });

  test("Saturday is a mock module only when one is waiting to be sat", () => {
    const { db, p } = world();
    assert.equal(W.planTasks(db, p, WEAKEST, day(0))[5].kind, "mixed");
    assert.deepEqual(W.planTasks(db, p, WEAKEST, day(0))[5].except, ["Boundaries", "Circles", "Inferences", "Ratios"]);
    db.tests.push({ id: "t1", modules: [{ id: "m1", questions: [{ id: "x" }] }] });
    db.sessions.push({ id: "s1", testId: "t1", status: "created" });
    db.participants.push({ id: "part1", sessionId: "s1", userId: "u1" });
    assert.equal(W.planTasks(db, p, WEAKEST, day(0))[5].kind, "mixed", "the session hasn't started");
    db.sessions[0].status = "started";
    assert.equal(W.planTasks(db, p, WEAKEST, day(0))[5].kind, "mock");
    db.attempts.push({ participantId: "part1", moduleId: "m1", submittedAt: at(-3) });
    assert.equal(W.planTasks(db, p, WEAKEST, day(0))[5].kind, "mixed", "its only module is already handed in");
  });

  test("the mistakes review asks for what is on the mistakes list, up to ten", () => {
    const { db, p } = world();
    assert.equal(W.planTasks(db, p, WEAKEST, day(0))[6].count, 1, "nothing missed yet");
    p.saved.push(qid("Ratios", 1), qid("Ratios", 2), "a-deleted-question");
    p.review[qid("Ratios", 2)] = { box: 0, due: day(0), lapses: 0 };
    p.review[qid("Circles", 5)] = { box: 1, due: day(9), lapses: 0 };
    assert.equal(W.planTasks(db, p, WEAKEST, day(0))[6].count, 3);
    for (let i = 0; i < 20; i++) p.saved.push(qid("Transitions", i));
    assert.equal(W.planTasks(db, p, WEAKEST, day(0))[6].count, W.PLAN.mistakes);
  });
});

describe("what counts toward a task", () => {
  test("a question counts when the first answer of the day is right and unaided", () => {
    const { db, p } = world();
    settle(db, p);
    log(p, qid("Boundaries", 0), at(0)); // right first time
    log(p, qid("Boundaries", 1), at(0, 9), false); // wrong...
    log(p, qid("Boundaries", 1), at(0, 10)); // ...then right the same day: no
    log(p, qid("Boundaries", 2), at(1), true, { a: true }); // right after the explanation: no
    log(p, qid("Boundaries", 3), at(1), false); // wrong on Tuesday...
    log(p, qid("Boundaries", 3), at(2)); // ...right on Wednesday: yes
    log(p, qid("Boundaries", 0), at(2)); // the same question again: still one
    log(p, qid("Boundaries", 4), at(-2)); // last week
    log(p, qid("Boundaries", 5), at(8)); // next week
    log(p, "a-deleted-question", at(1));
    assert.equal(view(db, p)[0].have, 2);
    assert.equal(view(db, p)[0].need, 12);
    assert.equal(view(db, p)[0].done, false);
  });

  test("clicking through the choices finishes nothing", () => {
    const { db, p } = world();
    settle(db, p);
    for (let i = 0; i < 20; i++) {
      log(p, qid("Boundaries", i), at(1, 9), false);
      log(p, qid("Boundaries", i), at(1, 10), true, { a: true });
      log(p, qid("Boundaries", i), at(1, 11)); // even sent as a clean answer, it isn't the day's first
    }
    assert.equal(view(db, p)[0].have, 0);
    assert.deepEqual(settle(db, p).finished, []);
  });

  test("each skill task counts its own skill, and mixed practice counts the rest", () => {
    const { db, p } = world();
    settle(db, p);
    for (let i = 0; i < 3; i++) log(p, qid("Circles", i), at(1));
    for (let i = 0; i < 5; i++) log(p, qid("Transitions", i), at(1));
    log(p, qid("Probability", 0), at(2));
    assert.deepEqual(view(db, p).map((t) => t.have), [0, 3, 0, 0, 0, 6, 0]);
  });

  test("flashcards: different words rated this week", () => {
    const { db, p } = world();
    settle(db, p, 3, { word: "w1" });
    settle(db, p, 3, { word: "w1" });
    settle(db, p, 3, { word: "w2" });
    assert.equal(view(db, p)[2].have, 2);
  });

  test("a mistakes review counts a question missed on an earlier day and solved now", () => {
    const { db, p } = world();
    settle(db, p);
    log(p, qid("Ratios", 1), at(-10), false); // missed long ago
    log(p, qid("Ratios", 1), at(1)); // solved this week: yes
    log(p, qid("Ratios", 2), at(1, 9), false); // missed on Tuesday...
    log(p, qid("Ratios", 2), at(1, 15)); // ...and retried that day: no
    log(p, qid("Ratios", 3), at(1), false); // missed on Tuesday...
    log(p, qid("Ratios", 3), at(3)); // ...solved on Thursday: yes
    log(p, qid("Ratios", 4), at(2)); // never missed: not a review
    assert.equal(view(db, p)[6].have, 1, "capped at the one this plan asks for");
    p.weekPlan.tasks[6].count = 10;
    assert.equal(view(db, p)[6].have, 2);
  });

  test("a mock module handed in this week", () => {
    const { db, p } = world();
    db.tests.push({ id: "t1", modules: [{ id: "m1", questions: [{ id: "x" }] }, { id: "m2", questions: [{ id: "y" }] }] });
    db.sessions.push({ id: "s1", testId: "t1", status: "started" });
    db.participants.push({ id: "part1", sessionId: "s1", userId: "u1" }, { id: "part2", sessionId: "s1", userId: "someone-else" });
    settle(db, p);
    assert.equal(view(db, p)[5].kind, "mock");
    db.attempts.push({ participantId: "part2", moduleId: "m1", submittedAt: at(1) }, { participantId: "part1", moduleId: "m1", submittedAt: null }, { participantId: "part1", moduleId: "m2", submittedAt: at(-1) });
    assert.equal(view(db, p)[5].have, 0, "someone else's, an unfinished one and last week's");
    db.attempts[1].submittedAt = at(2);
    assert.equal(view(db, p)[5].have, 1);
    assert.deepEqual(settle(db, p).finished, [{ index: 5, title: "Timed mock module" }]);
  });
});

describe("finishing tasks", () => {
  test("a task finishes itself at its count, pays once, and stays finished", () => {
    const { db, p } = world();
    settle(db, p);
    for (let i = 0; i < 11; i++) log(p, qid("Boundaries", i), at(1));
    assert.deepEqual(settle(db, p), { xp: 0, badges: [], finished: [] });
    assert.equal(W.planIsSettled(db, p, day(3)), true);
    log(p, qid("Boundaries", 11), at(2));
    assert.equal(W.planIsSettled(db, p, day(3)), false, "a finished task is waiting to be recorded");
    assert.deepEqual(settle(db, p), { xp: G.XP.planTask, badges: [], finished: [{ index: 0, title: "Boundaries" }] });
    assert.deepEqual(p.plan[MON], [0]);
    assert.equal(W.planIsSettled(db, p, day(3)), true);
    assert.deepEqual(settle(db, p), { xp: 0, badges: [], finished: [] });
    const task = view(db, p)[0];
    assert.deepEqual([task.have, task.need, task.done, task.overdue], [12, 12, true, false]);
  });

  test("the plan is fixed for the week, and a new one comes on Monday", () => {
    const { db, p } = world();
    settle(db, p, 0);
    const fixed = structuredClone(p.weekPlan.tasks);
    // The student's weakest skills change; this week's tasks don't.
    W.settlePlan(db, p, (section) => [...SKILLS[section]].reverse(), { today: day(4) });
    assert.deepEqual(p.weekPlan.tasks, fixed);
    assert.equal(W.planIsSettled(db, p, day(6)), true);
    assert.equal(W.planIsSettled(db, p, day(7)), false, "next Monday");
    W.settlePlan(db, p, (section) => [...SKILLS[section]].reverse(), { today: day(7), word: "w1" });
    assert.equal(p.weekPlan.week, day(7));
    assert.equal(p.weekPlan.tasks[0].topic, "Transitions");
    assert.deepEqual(p.weekPlan.words, ["w1"]);
  });

  test("the fifth finished task brings the Plan Keeper badge", () => {
    const { db, p } = world();
    settle(db, p);
    for (const skill of ["Boundaries", "Circles", "Inferences", "Ratios"]) for (let i = 0; i < 12; i++) log(p, qid(skill, i), at(1));
    const four = settle(db, p);
    assert.equal(four.xp, 4 * G.XP.planTask);
    assert.deepEqual(four.badges, []);
    for (let i = 0; i < 15; i++) log(p, qid("Transitions", i), at(2));
    const fifth = settle(db, p);
    assert.deepEqual(fifth.finished, [{ index: 5, title: "Mixed practice" }]);
    assert.deepEqual(fifth.badges, ["planner"]);
  });

  test("a task ticked by hand before the counting existed has to be earned, and isn't paid twice", () => {
    const { db, p } = world();
    p.plan[MON] = [1, 6];
    p.planPaid = { [MON]: [1, 6] };
    for (let i = 0; i < 5; i++) log(p, qid("Circles", i), at(0)); // real work from earlier in the week still counts
    settle(db, p);
    assert.deepEqual(view(db, p).map((t) => t.done), [false, false, false, false, false, false, false]);
    assert.equal(view(db, p)[1].have, 5);
    for (let i = 5; i < 12; i++) log(p, qid("Circles", i), at(1));
    assert.deepEqual(settle(db, p), { xp: 0, badges: [], finished: [{ index: 1, title: "Circles" }] });
    assert.equal(view(db, p)[1].done, true);
  });
});

// ---------- Over HTTP ----------
const mine = () => readDB().progress.find((p) => p.userId === userId);
const change = (fn) => updateDB((db) => fn(G.getProgress(db, userId), db));
const plan = async () => (await api("/api/practice/progress")).data.plan;
const answer = (q, value, extra = {}) => api(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: value, ...extra } });
const right = (q) => (q.type === "grid_in" ? q.correctAnswer : q.correctIndex);
const ofSkill = (topic) => readDB().practiceQuestions.filter((q) => q.topic === topic);

describe("the plan over HTTP", () => {
  let first; // the Monday task

  test("the first look fixes the week's plan, and every task starts at nothing", async () => {
    const p = await plan();
    assert.equal(p.week, G.weekKey());
    assert.equal(p.tasks.length, 7);
    for (const t of p.tasks) assert.deepEqual([t.have, t.done, t.need], [0, false, t.count]);
    assert.deepEqual(mine().weekPlan.tasks.map((t) => t.title), p.tasks.map((t) => t.title));
    first = p.tasks[0];
    assert.equal(first.kind, "drill");
  });

  test("nothing marks a task done except the work", async () => {
    for (const route of ["toggle", "complete"]) assert.equal((await api(`/api/practice/plan/0/${route}`, { method: "POST" })).status, 404);
    assert.equal((await plan()).tasks[0].done, false);
  });

  test("solving the task's questions moves it on, and the last one finishes and pays it", async () => {
    const pool = ofSkill(first.topic).filter((q) => q.type !== "grid_in");
    assert.ok(pool.length > first.need + 1);
    // A wrong answer, and a retry of it, add nothing.
    const missed = pool.pop();
    await answer(missed, (missed.correctIndex + 1) % missed.options.length);
    assert.equal((await answer(missed, missed.correctIndex, { retry: true })).data.plan, undefined);
    assert.equal((await plan()).tasks[0].have, 0);

    for (const q of pool.slice(0, first.need - 1)) assert.equal((await answer(q, right(q))).data.plan, undefined);
    const before = await plan();
    assert.deepEqual([before.tasks[0].have, before.tasks[0].done], [first.need - 1, false]);
    const xpBefore = mine().xp;

    const last = pool[first.need - 1];
    const r = (await answer(last, right(last))).data;
    assert.deepEqual(r.plan.finished, [{ index: 0, title: first.title }]);
    assert.equal(r.plan.reward.xpGained, G.XP.planTask);
    assert.equal(mine().xp, xpBefore + r.reward.xpGained + G.XP.planTask);

    const done = (await plan()).tasks[0];
    assert.deepEqual([done.have, done.done], [first.need, true]);
    // The same skill's next answer has nothing more to pay.
    const extra = pool[first.need];
    assert.equal((await answer(extra, right(extra))).data.plan, undefined);
  });

  test("the plan keeps its tasks though the student's weakest skills have changed", async () => {
    assert.deepEqual((await plan()).tasks.map((t) => t.title), mine().weekPlan.tasks.map((t) => t.title));
    assert.equal((await plan()).tasks[0].topic, first.topic);
  });

  test("rating flashcards finishes the vocab task", async () => {
    const task = (await plan()).tasks[2];
    const words = readDB().vocab.slice(0, task.need);
    const rate = (w) => api(`/api/practice/vocab/${w.id}/rate`, { method: "POST", body: { rating: "good" } });
    assert.equal((await rate(words[0])).data.plan, undefined);
    assert.equal((await rate(words[0])).data.plan, undefined);
    assert.equal((await plan()).tasks[2].have, 1);
    let lastReply;
    for (const w of words.slice(1)) lastReply = (await rate(w)).data;
    assert.deepEqual(lastReply.plan.finished, [{ index: 2, title: "Vocab" }]);
    assert.equal((await plan()).tasks[2].done, true);
  });

  test("a mixed-practice drill is drawn from the skills the other tasks leave out", async () => {
    const tasks = (await plan()).tasks;
    const mixed = tasks[5];
    assert.equal(mixed.kind, "mixed");
    const drill = (await api("/api/practice/drill", { method: "POST", body: { size: 20, plan: mixed.index } })).data.questions;
    assert.equal(drill.length, 20);
    for (const q of drill) assert.equal(mixed.except.includes(q.topic), false);
    // Without the task's index, a drill of one of those skills is still what was asked for.
    const own = (await api("/api/practice/drill", { method: "POST", body: { size: 5, skills: first.topic } })).data.questions;
    for (const q of own) assert.equal(q.topic, first.topic);
  });

  test("the mistakes review lists the mistakes list, and an old miss solved now counts", async () => {
    const [q] = ofSkill(tasksTopicOtherThan(first.topic)).filter((x) => x.type !== "grid_in");
    // Missed three days ago: on the review schedule and in the saved queue since then.
    change((p) => {
      p.answerLog.push({ q: q.id, at: new Date(Date.now() - 3 * 86400000).toISOString(), ok: false });
      p.answered[q.id] = { attempts: 1, correct: 0, lastCorrect: false, lastAt: new Date(Date.now() - 3 * 86400000).toISOString(), xp: 0 };
      p.saved.push(q.id);
      p.review[q.id] = { box: 0, due: G.dayOffset(G.todayKey(), -2), lapses: 0 };
    });
    const listed = (await api("/api/practice/questions?source=mistakes")).data.questions;
    assert.ok(listed.some((x) => x.id === q.id));
    assert.ok(listed.every((x) => x.status !== "new"));
    const task = (await plan()).tasks[6];
    assert.deepEqual([task.kind, task.have], ["mistakes", 0]);
    const r = (await answer(q, right(q))).data;
    assert.deepEqual(r.plan.finished, [{ index: 6, title: "Mistakes review" }]);
    assert.equal((await plan()).tasks[6].done, true);
  });

  test("work that doesn't settle the plan itself is picked up by the next look at the plan", async () => {
    // As a diagnostic or the Daily Star would: answers written to the log by another route.
    const tasks = (await plan()).tasks;
    const task = tasks[1];
    assert.equal(task.done, false);
    const pool = ofSkill(task.topic).slice(0, task.need);
    const xpBefore = mine().xp;
    change((p) => pool.forEach((q) => p.answerLog.push({ q: q.id, at: new Date().toISOString(), ok: true, d: 1 })));
    const after = (await plan()).tasks[1];
    assert.deepEqual([after.have, after.done], [task.need, true]);
    assert.equal(mine().xp, xpBefore + G.XP.planTask);
    assert.equal((await plan()).tasks[1].done, true);
    assert.equal(mine().xp, xpBefore + G.XP.planTask, "paid once");
  });

  test("five finished tasks earn the Plan Keeper badge", async () => {
    // Monday, Tuesday, vocab and the mistakes review are done; Thursday's task makes five.
    const tasks = (await plan()).tasks;
    assert.equal(tasks.filter((t) => t.done).length, 4);
    const task = tasks[3];
    const pool = ofSkill(task.topic).filter((q) => q.type !== "grid_in" && !mine().answered[q.id]).slice(0, task.need);
    let lastReply;
    for (const q of pool) lastReply = (await answer(q, right(q))).data;
    assert.deepEqual(lastReply.plan.finished, [{ index: 3, title: task.title }]);
    assert.ok(lastReply.plan.reward.newBadges.some((b) => b.id === "planner"));
    assert.ok(mine().badges.some((b) => b.id === "planner"));
  });
});

// A planned skill other than the given one (so a test's answers don't feed an earlier test's task).
function tasksTopicOtherThan(topic) {
  return mine().weekPlan.tasks.find((t) => t.kind === "drill" && t.topic !== topic).topic;
}
