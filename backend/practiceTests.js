// SAT practice tests in the student hub: the full-length forms in content/practiceTests, which a
// student sits on their own, whenever they like. (Mock exams are the other kind: a teacher sets
// those up as a session. IELTS has its own practice tests in ielts/lib/practiceTests.js.)
//
// A sitting ("run") is one student, one test, and two choices made at the start:
//   scope   "full" (all four modules), or one section: "rw" or "math" (its two modules)
//   timed   true: each module has its own clock, kept here on the server, and is handed in when it
//           runs out. false: no clock; the time spent is only counted.
// Modules are sat in order, one at a time. Nothing is marked until a module is handed in, and
// answers and explanations are shown only once the sitting is over.
//
// A module that is being sat is locked, timed or not, the way a mock exam is (examLock.js): the
// module's screen reports the moment it isn't the page in front, and the sitting is cancelled
// there and then, with no score and no results. Nobody can let the student back in: they start
// the test again. Between two modules (the sitting's own page) the lock is off.
//
// Stored as db.practiceTestRuns (see db.js). The questions themselves stay where the test is kept:
// the ten that came as files are in content/practiceTests, and the ones the admin builds in the
// studio are db.satPracticeTests (satPracticeStudio.js turns one into the same shape). The admin
// can hide a file test (db.satPracticeHidden) and a studio test is a draft until it is published;
// a test that isn't on the list can't be started, but a sitting already under way and results
// already earned stay open.

import { nanoid } from "nanoid";
import { PRACTICE_TESTS, SECTION_NAME, scaledScore } from "./content/practiceTests.js";
import { cancellation, cancelledView } from "./examLock.js";
import { award, getProgress, scorePracticeTestModule } from "./gamification.js";
import { SKILLS } from "./practiceSkills.js";
import { isLiveStudioTest, isStudioKey, studioAnswerRight, studioRecord, studioTest } from "./satPracticeStudio.js";

export const SCOPES = ["full", "rw", "math"];
// Answers are accepted for a minute after a module's clock hits zero, for slow connections.
export const GRACE_MS = 60_000;
const ANSWER_CHARS = 12;

const iso = (ms) => new Date(ms).toISOString();
const TEST_BY_KEY = new Map(PRACTICE_TESTS.map((t) => [t.key, t]));
// Any test that exists, listed for students or not.
export function testOf(db, key) {
  if (!isStudioKey(key)) return TEST_BY_KEY.get(key) || null;
  const record = studioRecord(db, key);
  return record ? studioTest(record) : null;
}
export const hiddenKeys = (db) => new Set(db.satPracticeHidden || []);
// The tests a student can start, in the order the list shows them: the admin's own first.
export function listedTests(db) {
  const hidden = hiddenKeys(db);
  const own = (db.satPracticeTests || []).filter(isLiveStudioTest).map(studioTest);
  return [...own, ...PRACTICE_TESTS.filter((t) => !hidden.has(t.key))];
}
export const isListed = (db, key) => listedTests(db).some((t) => t.key === key);
export const scopeModules = (test, scope) => test.modules.filter((m) => scope === "full" || m.section === scope);
const moduleOf = (test, key) => test.modules.find((m) => m.key === key) || null;
// A studio test can be changed after a student started it. A sitting whose modules are no longer
// all in the test can't be shown or carried on: it is treated like a sitting of a deleted test.
export const runFits = (test, run) => Boolean(test) && run.modules.every((rm) => moduleOf(test, rm.key));

export function newRun(test, userId, { scope, timed }, now = Date.now()) {
  return {
    id: nanoid(10),
    userId,
    test: test.key,
    scope,
    timed,
    status: "in_progress",
    startedAt: iso(now),
    finishedAt: null,
    modules: scopeModules(test, scope).map((m) => ({ key: m.key, status: "not_started", answers: {}, flags: [], times: {} })),
    result: null,
    rewards: []
  };
}

// ---------- The clock ----------
export const remainingSeconds = (rm, now = Date.now()) => (rm.deadline ? Math.max(0, Math.round((Date.parse(rm.deadline) - now) / 1000)) : null);
export const isModuleOpen = (rm, now = Date.now()) => rm.status === "in_progress" && (!rm.deadline || now <= Date.parse(rm.deadline) + GRACE_MS);
// The module a sitting is at: the first one not handed in. Null once every module is.
export const nextModule = (run) => run.modules.find((m) => m.status === "not_started" || m.status === "in_progress") || null;

// Opens a module: the first time, its clock starts (when the sitting is timed).
export function openModule(run, test, rm, now = Date.now()) {
  if (rm.status !== "not_started") return;
  rm.status = "in_progress";
  rm.startedAt = iso(now);
  if (run.timed) rm.deadline = iso(now + moduleOf(test, rm.key).minutes * 60_000);
}

// ---------- Input from the test screen ----------
export function cleanAnswers(mod, input) {
  const out = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const q of mod.questions) {
    const v = input[q.id];
    if (v === undefined || v === null || v === "") continue;
    if (q.type === "grid_in") {
      if (typeof v !== "string" && typeof v !== "number") continue;
      const s = String(v).trim().slice(0, ANSWER_CHARS);
      if (s) out[q.id] = s;
    } else if (Number.isInteger(v) && v >= 0 && v < q.options.length) out[q.id] = v;
  }
  return out;
}

export function cleanFlags(mod, input) {
  if (!Array.isArray(input)) return [];
  const ids = new Set(mod.questions.map((q) => q.id));
  return [...new Set(input.map(String))].filter((id) => ids.has(id));
}

// Time on each question (ms). The screen sends running totals, so the larger value is kept.
export function mergeTimes(mod, current, input) {
  const out = { ...(current || {}) };
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const q of mod.questions) {
    const ms = Math.round(Number(input[q.id]));
    if (Number.isFinite(ms) && ms > 0) out[q.id] = Math.max(out[q.id] || 0, Math.min(ms, 6 * 3_600_000));
  }
  return out;
}

export function takeInput(rm, mod, body) {
  rm.answers = cleanAnswers(mod, body?.answers);
  rm.flags = cleanFlags(mod, body?.flags);
  rm.times = mergeTimes(mod, rm.times, body?.times);
}

// ---------- Marking ----------
// A typed answer as a number: 7/2, 3.5, .56 and -3 (or −3) are read; anything else isn't an answer.
export function typedValue(v) {
  const s = String(v ?? "").trim().replace(/−/g, "-");
  if (!/^-?(\d+\/\d+|\d*\.?\d+)$/.test(s)) return null; // "3 1/2" is not 31/2: a mixed number isn't read
  if (!s.includes("/")) return Number(s);
  const [n, d] = s.replace("-", "").split("/").map(Number);
  return d ? ((s.startsWith("-") ? -1 : 1) * n) / d : null;
}

// The tests' own rule: a whole-number answer must be matched exactly, and any other to within a
// thousandth, so 2/3 can be typed as 2/3, .6666, .6667 or 0.667 (but not 0.66).
export function isRight(q, given) {
  if (given === undefined || given === null || given === "") return false;
  if (q.type !== "grid_in") return given === q.correctIndex;
  // A question typed in the studio has one answer, as text: marked as a teacher mock marks it.
  if (q.answer !== undefined) return studioAnswerRight(q, given);
  const x = typedValue(given);
  return x !== null && q.accepted.some((a) => Math.abs(x - a) < (Number.isInteger(a) ? 1e-9 : 0.001));
}

const isAnswered = (rm, q) => rm.answers?.[q.id] !== undefined && rm.answers[q.id] !== "";

// Section scores for the modules handed in. A section is scaled (the test's own table) only when
// both of its modules were sat in this sitting; the total needs both sections.
export function scoreRun(test, run) {
  const sections = {};
  for (const key of Object.keys(SECTION_NAME)) {
    const all = test.modules.filter((m) => m.section === key);
    const sat = all.map((m) => run.modules.find((rm) => rm.key === m.key && rm.status === "completed")).filter(Boolean);
    if (!sat.length) {
      sections[key] = null;
      continue;
    }
    const order = Object.keys(SKILLS[SECTION_NAME[key]]);
    const domains = [];
    for (const rm of sat) {
      for (const q of moduleOf(test, rm.key).questions) {
        if (!q.domain) continue; // a studio test's questions aren't sorted into domains
        let dm = domains.find((x) => x.domain === q.domain);
        if (!dm) domains.push((dm = { domain: q.domain, correct: 0, total: 0 }));
        dm.total += 1;
        if (isRight(q, rm.answers[q.id])) dm.correct += 1;
      }
    }
    domains.sort((a, b) => order.indexOf(a.domain) - order.indexOf(b.domain));
    const raw = sat.reduce((s, rm) => s + rm.raw, 0);
    const total = sat.reduce((s, rm) => s + rm.max, 0);
    sections[key] = { raw, total, modules: sat.length, of: all.length, score: sat.length === all.length ? scaledScore(test.curve, raw, total) : null, domains };
  }
  const scored = Object.values(sections).filter(Boolean);
  return {
    sections,
    total: sections.rw?.score != null && sections.math?.score != null ? sections.rw.score + sections.math.score : null,
    correct: scored.reduce((s, x) => s + x.raw, 0),
    count: scored.reduce((s, x) => s + x.total, 0)
  };
}

function finishRun(db, run, test, status, now) {
  run.status = status;
  run.finishedAt = iso(now);
  run.result = scoreRun(test, run);
}

// Hands a module in and marks it. `auto` means the clock closed it: then it ended at its deadline,
// whenever that was noticed. The module pays XP for the best score the student has had on it
// (gamification.js), and the day counts as a study day when something was answered. What is earned
// waits on the run and is shown with the results, as in a mock exam.
export function completeModule(db, run, test, rm, { auto = false, now = Date.now() } = {}) {
  const mod = moduleOf(test, rm.key);
  const started = Date.parse(rm.startedAt);
  const end = Math.max(started, auto && rm.deadline ? Math.min(now, Date.parse(rm.deadline)) : now);
  rm.status = "completed";
  rm.submittedAt = iso(end);
  rm.auto = Boolean(auto);
  rm.max = mod.questions.length;
  rm.raw = mod.questions.filter((q) => isRight(q, rm.answers[q.id])).length;
  rm.answered = mod.questions.filter((q) => isAnswered(rm, q)).length;
  rm.seconds = run.timed
    ? Math.min(mod.minutes * 60, Math.round((end - started) / 1000))
    : Math.round(Object.values(rm.times || {}).reduce((s, ms) => s + ms, 0) / 1000);

  const last = !nextModule(run);
  if (last) finishRun(db, run, test, "completed", end);
  if (!rm.answered) return;
  const p = getProgress(db, run.userId);
  const xp = scorePracticeTestModule(p, `${run.test}:${rm.key}`, rm.raw, rm.max);
  // The trophies are about test conditions: a timed module, and a whole timed test with every module tried.
  const badges = run.timed ? ["mock_finisher"] : [];
  if (last && run.timed && run.scope === "full" && run.modules.every((m) => m.status === "completed" && m.answered > 0)) badges.push("full_test");
  run.rewards.push(award(p, xp, badges));
}

// A timed module whose clock ran out (plus the grace minute) is handed in with what was saved.
export const needsSettling = (run, now = Date.now()) => run.status === "in_progress" && run.modules.some((rm) => rm.status === "in_progress" && !isModuleOpen(rm, now));
export function settleRun(db, run, now = Date.now()) {
  if (run.status !== "in_progress") return;
  const test = testOf(db, run.test);
  if (!runFits(test, run)) return;
  for (const rm of run.modules) {
    if (rm.status === "in_progress" && !isModuleOpen(rm, now)) completeModule(db, run, test, rm, { auto: true, now });
  }
}

// The student ends a sitting before its last module: the module in progress is handed in as it
// stands, and the ones never opened are left out. A sitting with nothing handed in is not kept.
// Returns false when the run was removed.
export function endRun(db, run, test, now = Date.now()) {
  for (const rm of run.modules) {
    if (rm.status === "in_progress") completeModule(db, run, test, rm, { now });
  }
  if (run.status === "in_progress") {
    for (const rm of run.modules) if (rm.status === "not_started") rm.status = "skipped";
    if (!run.modules.some((m) => m.status === "completed")) {
      db.practiceTestRuns = db.practiceTestRuns.filter((r) => r !== run);
      return false;
    }
    finishRun(db, run, test, "ended", now);
  }
  return true;
}

// The student left a module that was running (another tab or window, the page closed, the Exit
// button): the sitting is over and cancelled. The module isn't marked, the ones never opened are
// left out, and the sitting has no score and no results. (XP already paid for a module handed in
// earlier in the sitting stays paid: that module was sat under the lock to its end.)
export function cancelRun(run, rm, kind, now = Date.now()) {
  rm.status = "cancelled";
  for (const m of run.modules) if (m.status === "not_started") m.status = "skipped";
  run.status = "cancelled";
  run.finishedAt = iso(now);
  run.cancelled = cancellation(kind, { module: rm.key }, now);
}

// Everything the sitting earned, as one reward for the results page to show.
export function runReward(run) {
  const list = run.rewards || [];
  if (!list.length) return null;
  const badges = new Map();
  for (const r of list) for (const b of r.newBadges || []) badges.set(b.id, b);
  return {
    xpGained: list.reduce((s, r) => s + (r.xpGained || 0), 0),
    chunksGained: list.reduce((s, r) => s + (r.chunksGained || 0), 0),
    leveledUp: list.some((r) => r.leveledUp),
    level: list.at(-1).level,
    newBadges: [...badges.values()],
    goalReached: list.some((r) => r.goalReached)
  };
}

// ---------- What the pages are sent ----------
const moduleInfo = (m) => ({ key: m.key, section: m.section, label: m.label, title: m.title, minutes: m.minutes, questions: m.questions.length });

export function runSummary(run, test, now = Date.now()) {
  return {
    id: run.id,
    test: run.test,
    title: test.title,
    scope: run.scope,
    timed: run.timed,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    // { at, kind, reason } when the sitting was cancelled because the student left a module.
    cancelled: cancelledView(run.cancelled),
    modules: run.modules.map((rm) => ({
      ...moduleInfo(moduleOf(test, rm.key)),
      status: rm.status,
      // Marks are part of the results: a module's score isn't given out while the sitting is still
      // going, and a cancelled sitting has no results.
      raw: run.status === "in_progress" || run.status === "cancelled" ? null : (rm.raw ?? null),
      answered: rm.status === "completed" ? rm.answered : Object.keys(rm.answers || {}).length,
      remainingSeconds: rm.status === "in_progress" ? remainingSeconds(rm, now) : null,
      seconds: rm.seconds ?? null,
      auto: Boolean(rm.auto)
    })),
    total: run.result?.total ?? null,
    rw: run.result?.sections?.rw?.score ?? null,
    math: run.result?.sections?.math?.score ?? null,
    correct: run.result?.correct ?? null,
    count: run.result?.count ?? null
  };
}

// The list page: every test, with where this student stands on it.
export function catalogue(db, userId, now = Date.now()) {
  const mine = db.practiceTestRuns.filter((r) => r.userId === userId);
  const best = (runs, pick) => runs.reduce((top, r) => (pick(r) != null && (top == null || pick(r) > top) ? pick(r) : top), null);
  return listedTests(db).map((test) => {
    const runs = mine.filter((r) => r.test === test.key && runFits(test, r)).sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
    const open = runs.find((r) => r.status === "in_progress") || null;
    const finished = runs.filter((r) => r.status !== "in_progress");
    return {
      key: test.key,
      title: test.title,
      // Only the tests made in the studio have these.
      description: test.description || "",
      difficulty: test.difficulty || null,
      modules: test.modules.map(moduleInfo),
      questions: test.modules.reduce((s, m) => s + m.questions.length, 0),
      minutes: test.modules.reduce((s, m) => s + m.minutes, 0),
      open: open ? runSummary(open, test, now) : null,
      attempts: finished.map((r) => runSummary(r, test, now)),
      best: { total: best(finished, (r) => r.result?.total), rw: best(finished, (r) => r.result?.sections?.rw?.score), math: best(finished, (r) => r.result?.sections?.math?.score) }
    };
  });
}

// What the test screen shows of a question: no answer, explanation, domain or skill.
const screenQuestion = (q) => ({ id: q.id, n: q.n, type: q.type, passage: q.passage, prompt: q.prompt, options: q.type === "grid_in" ? null : q.options });

export function modulePayload(run, test, rm, now = Date.now()) {
  const mod = moduleOf(test, rm.key);
  const at = run.modules.indexOf(rm);
  return {
    run: { id: run.id, test: run.test, title: test.title, scope: run.scope, timed: run.timed },
    module: { ...moduleInfo(mod), index: at + 1, of: run.modules.length, last: at === run.modules.length - 1 },
    remainingSeconds: remainingSeconds(rm, now),
    answers: rm.answers || {},
    flags: rm.flags || [],
    times: rm.times || {},
    questions: mod.questions.map(screenQuestion)
  };
}

// The results of a finished sitting: scores, and every question of the modules that were sat with
// its answer, the student's answer and the explanation. A cancelled sitting has none of that: only
// what it was and why it ended.
export function resultPayload(run, test) {
  const cancelled = run.status === "cancelled";
  return {
    ...runSummary(run, test),
    result: cancelled ? null : run.result,
    reward: cancelled ? null : runReward(run),
    rewardSeen: Boolean(run.rewardSeenAt),
    modules: run.modules.map((rm) => {
      const mod = moduleOf(test, rm.key);
      const sat = rm.status === "completed" && !cancelled;
      return {
        ...moduleInfo(mod),
        status: rm.status,
        raw: cancelled ? null : (rm.raw ?? null),
        answered: rm.answered ?? 0,
        seconds: rm.seconds ?? null,
        auto: Boolean(rm.auto),
        items: !sat
          ? []
          : mod.questions.map((q) => ({
              ...screenQuestion(q),
              domain: q.domain,
              skill: q.skill,
              correctIndex: q.type === "grid_in" ? null : q.correctIndex,
              shown: q.type === "grid_in" ? q.shown : null,
              explanation: q.explanation,
              given: rm.answers[q.id] ?? null,
              answered: isAnswered(rm, q),
              correct: isRight(q, rm.answers[q.id]),
              flagged: (rm.flags || []).includes(q.id),
              ms: rm.times?.[q.id] || 0
            }))
      };
    })
  };
}

// ---------- For the rest of the app ----------
// Timed modules handed in with something answered: the score estimate and the weekly plan's mock
// task count these beside mock-exam modules (untimed practice isn't test conditions, and nothing
// of a cancelled sitting counts).
export function timedModules(db, userId) {
  const out = [];
  for (const run of db.practiceTestRuns || []) {
    if (run.userId !== userId || !run.timed || run.status === "cancelled") continue;
    const test = testOf(db, run.test);
    if (!runFits(test, run)) continue;
    for (const rm of run.modules) {
      if (rm.status !== "completed" || !rm.answered) continue;
      const mod = moduleOf(test, rm.key);
      // "Reading and Writing, Module 1": the module's label is "Section 1, Module 1".
      const name = `${mod.title}${mod.label ? `, ${mod.label.replace(/^.*,\s*/, "")}` : ""}`;
      out.push({ at: rm.submittedAt, section: mod.section, raw: rm.raw, max: rm.max, score: scaledScore(test.curve, rm.raw, rm.max), name, test: test.title });
    }
  }
  return out;
}
