// The weekly study plan: seven tasks, fixed for the week, that the student's own graded work
// finishes. Nothing is ticked by hand. A task is done when the server has counted enough for it:
//  - a skill task: questions of that skill solved (see `weekWork` for what "solved" means);
//  - mixed practice: the same, on the skills the week's skill tasks don't cover;
//  - vocab: different words practised (a flashcard rated, or a word answered right in Learn or Match);
//  - mock: a mock-exam module handed in (or a timed module of a practice test);
//  - mistakes review: questions missed on an earlier day, solved now.
// The tasks are chosen once, the first time the plan is asked for in a week (`progress.weekPlan`),
// so a task can't change under the student while they work on it. Finished tasks are recorded in
// `progress.plan[week]` and stay finished.

import { dayOffset, dayStartMs, scorePlanTask, todayKey, weekKey } from "./gamification.js";
import { timedModules } from "./practiceTests.js";

export const PLAN = {
  questions: 15, // a skill or mixed task: questions to solve
  skillShare: 0.6, // ...but never more than this share of the skill's questions (a few skills have a dozen)
  words: 20, // the vocab task: different words to practise
  mistakes: 10, // the mistakes review: earlier misses to solve
  modules: 1, // the mock task: modules to hand in
  badgeAt: 5 // finished tasks in one week for the Plan Keeper badge
};

const clamp = (n, max) => Math.max(1, Math.min(max, n));
const iso = (day) => new Date(dayStartMs(day)).toISOString();
// The mock exams this student is in: their participant ids, and whether a module is waiting to be sat.
function mockSeat(db, userId) {
  const mine = db.participants.filter((x) => x.userId === userId);
  const open = mine.some((part) => {
    const session = db.sessions.find((s) => s.id === part.sessionId);
    const test = session?.status === "started" ? db.tests.find((t) => t.id === session.testId) : null;
    return Boolean(test?.modules.some((m) => m.questions.length && !db.attempts.some((a) => a.participantId === part.id && a.moduleId === m.id && a.submittedAt)));
  });
  return { ids: new Set(mine.map((x) => x.id)), open };
}

// The student's mistakes list, which a mistakes review draws on: the bank questions on the
// review schedule or in the saved queue (GET /questions?source=mistakes lists the same ones).
export const onMistakesList = (p, id) => Boolean(p.review[id]) || p.saved.includes(id);

// The week's seven tasks. `weakest(section)` lists that section's skills, weakest first.
// `count` is what the task asks for; it doesn't change once the week's plan is fixed.
export function planTasks(db, p, weakest, today = todayKey()) {
  const perSkill = {};
  for (const q of db.practiceQuestions) perSkill[q.topic] = (perSkill[q.topic] || 0) + 1;
  const rw = weakest("Reading & Writing");
  const math = weakest("Math");
  const skill = (section, topic, minutes) => ({
    kind: "drill",
    section,
    topic,
    title: topic || section,
    minutes,
    count: topic ? clamp(Math.floor(perSkill[topic] * PLAN.skillShare), PLAN.questions) : PLAN.questions,
    unit: "questions"
  });
  const planned = [rw[0], math[0], rw[1], math[1]].filter(Boolean);
  // A mock module needs a teacher's session. Without one waiting, Saturday is mixed practice on
  // the skills the rest of the week leaves out.
  const saturday = mockSeat(db, p.userId).open
    ? { kind: "mock", title: "Timed mock module", minutes: 35, count: PLAN.modules, unit: "module" }
    : {
        kind: "mixed",
        title: "Mixed practice",
        except: planned,
        minutes: 30,
        count: clamp(db.practiceQuestions.filter((q) => !planned.includes(q.topic)).length, PLAN.questions),
        unit: "questions"
      };
  const monday = weekKey(today);
  return [
    skill("Reading & Writing", rw[0], 25),
    skill("Math", math[0], 30),
    { kind: "vocab", section: "Reading & Writing", title: "Vocab", minutes: 15, count: clamp(db.vocab.length, PLAN.words), unit: "words" },
    skill("Reading & Writing", rw[1], 25),
    skill("Math", math[1], 30),
    saturday,
    // A student with nothing on the list yet is asked for one: this week's first miss, solved on a later day.
    { kind: "mistakes", title: "Mistakes review", minutes: 15, count: clamp(db.practiceQuestions.filter((q) => onMistakesList(p, q.id)).length, PLAN.mistakes), unit: "questions" }
  ].map((t, i) => ({ ...t, day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i], date: dayOffset(monday, i) }));
}

// What the student's answers this week add up to.
// A question is "solved" when the first answer to it on some day was right and unaided: a second
// try the same day, or an answer after opening the explanation, doesn't count, so a task can't be
// finished by clicking through the choices. It is "reviewed" when, on top of that, it had been
// missed on an earlier day. Each question counts once a week.
function weekWork(db, p, week) {
  const from = iso(week);
  const to = iso(dayOffset(week, 7));
  const bank = new Map(db.practiceQuestions.map((q) => [q.id, q]));
  const missedOn = new Map(); // question id -> the first day it was missed ("" = before this week)
  const answers = [];
  for (const e of p.answerLog) {
    if (!e.at || e.at >= to || !bank.has(e.q)) continue;
    if (e.at >= from) answers.push(e);
    else if (!e.ok) missedOn.set(e.q, "");
  }
  answers.sort((a, b) => a.at.localeCompare(b.at));
  const tried = new Set(); // "question|day"
  const solved = new Set();
  const reviewed = new Set();
  for (const e of answers) {
    const day = todayKey(new Date(e.at));
    const first = !tried.has(`${e.q}|${day}`);
    tried.add(`${e.q}|${day}`);
    if (first && e.ok && !e.a) {
      solved.add(e.q);
      if (missedOn.has(e.q) && missedOn.get(e.q) < day) reviewed.add(e.q);
    }
    if (!e.ok && !missedOn.has(e.q)) missedOn.set(e.q, day);
  }
  const seat = mockSeat(db, p.userId);
  // A timed module of a practice test counts like a mock-exam module: it is the same sitting.
  const modules =
    db.attempts.filter((a) => seat.ids.has(a.participantId) && a.submittedAt >= from && a.submittedAt < to).length +
    timedModules(db, p.userId).filter((m) => m.at >= from && m.at < to).length;
  return { bank, solved, reviewed, modules };
}

// How far each task of a fixed plan has got: [{ have, need }], in task order.
function planCounts(db, p, record) {
  const work = weekWork(db, p, record.week);
  const solvedWhere = (test) => [...work.solved].filter((id) => test(work.bank.get(id))).length;
  return record.tasks.map((t) => {
    const have =
      t.kind === "drill"
        ? solvedWhere((q) => (t.topic ? q.topic === t.topic : q.section === t.section))
        : t.kind === "mixed"
          ? solvedWhere((q) => !t.except.includes(q.topic))
          : t.kind === "vocab"
            ? record.words.length
            : t.kind === "mock"
              ? work.modules
              : work.reviewed.size;
    return { have: Math.min(have, t.count), need: t.count };
  });
}

const isCurrent = (p, today) => p.weekPlan?.week === weekKey(today);

// Whether there is nothing to write: this week's plan is fixed and every task that has reached
// its count is recorded as finished.
export function planIsSettled(db, p, today = todayKey()) {
  if (!isCurrent(p, today)) return false;
  const done = p.plan[p.weekPlan.week] || [];
  return planCounts(db, p, p.weekPlan).every((c, i) => c.have < c.need || done.includes(i));
}

// Fixes this week's plan if it is new, counts the vocabulary just practised (`word`: a flashcard
// that was rated; `words`: words answered right in Learn or Match), and records and pays the
// tasks that have reached their count. Call it inside updateDB after anything that can move the
// plan on. Returns the XP and badges to award and the tasks just finished.
export function settlePlan(db, p, weakest, { word = null, words = [], today = todayKey() } = {}) {
  if (!isCurrent(p, today)) {
    p.weekPlan = { week: weekKey(today), tasks: planTasks(db, p, weakest, today), words: [] };
    // A task already marked done in a week that is only now being fixed was ticked by hand, before
    // tasks were counted. The mark goes; the week's answers still count, and what the tick paid
    // stays paid (`planPaid`), so finishing the task for real doesn't pay twice.
    delete p.plan[p.weekPlan.week];
  }
  const record = p.weekPlan;
  for (const id of [word, ...words]) if (id && !record.words.includes(id)) record.words.push(id);
  const done = new Set(p.plan[record.week] || []);
  const finished = [];
  let xp = 0;
  planCounts(db, p, record).forEach((c, i) => {
    if (c.have < c.need || done.has(i)) return;
    done.add(i);
    xp += scorePlanTask(p, record.week, i);
    finished.push({ index: i, title: record.tasks[i].title });
  });
  if (finished.length) p.plan[record.week] = [...done];
  return { xp, badges: finished.length && done.size >= PLAN.badgeAt ? ["planner"] : [], finished };
}

// The settled plan as the hub shows it: each task with how far it has got (`have` of `need`).
export function planView(db, p, today = todayKey()) {
  const record = p.weekPlan;
  const done = p.plan[record.week] || [];
  const counts = planCounts(db, p, record);
  return {
    week: record.week,
    tasks: record.tasks.map((t, i) => {
      const isDone = done.includes(i);
      return { ...t, index: i, ...counts[i], done: isDone, overdue: !isDone && t.date < today, isToday: t.date === today };
    })
  };
}
