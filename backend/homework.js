// Homework: a set of question-bank questions a teacher gives to one class, to several, or to all.
//
// db.homework rows: { id, title, note, classIds: [class id], questionIds, due: "YYYY-MM-DD", createdAt, by }
// `classIds` are the classes it was set for when it was set ("all classes" is every class there was
// then: a class made later doesn't inherit old homework).
//
// Nothing is handed in and nothing is ticked. A student's progress on a homework is read from
// their answer log:
//   - a question is DONE once they have answered it, anywhere in the app, after the homework was
//     set. One they solved last month has to be answered again;
//   - it is RIGHT when that first answer was right and unaided. Trying every choice until one is
//     right, or opening the explanation first, gets the question done but not right.
// The homework is finished when every question is done, and on time when that happened on or
// before the due day.
//
// Homework pays no XP of its own (each answer pays what it always pays): leagues are global, and
// only students in a class get homework.
import { nanoid } from "nanoid";
import { dayDiff, dayOffset, todayKey } from "./gamification.js";
import { DIFFICULTIES, DIFFICULTY_RANK, SKILLS } from "./practiceSkills.js";
import { classById, classInfo, classMembers, cleanClassIds, fullName, inClass } from "./classrooms.js";

export const HOMEWORK = {
  titleMax: 120,
  noteMax: 600,
  maxQuestions: 40,
  maxDaysAhead: 120, // how far ahead a due date can be
  showDays: 45 // a homework leaves the student's list this many days after its due date
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SECTIONS = Object.keys(SKILLS);
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// What a question looks like in a homework list: enough to recognise it, nothing that answers it.
export const questionCard = (q) => ({ id: q.id, title: q.title, section: q.section, topic: q.topic, difficulty: q.difficulty, type: q.type || "mcq", picture: Boolean(q.promptImage) });

const bankOrder = (a, b) =>
  SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || String(a.topic).localeCompare(String(b.topic)) || (DIFFICULTY_RANK[a.difficulty] ?? 1) - (DIFFICULTY_RANK[b.difficulty] ?? 1) || String(a.title).localeCompare(String(b.title));

function shuffled(list, rnd) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- Choosing the questions (studio) ----------
// What the teacher asks for: { section?, skills?, difficulty?, count, exclude? }. Returns { spec } or { error }.
export function cleanDraw(body) {
  const section = SECTIONS.includes(body?.section) ? body.section : null;
  const known = new Set(Object.entries(SKILLS).flatMap(([sec, domains]) => (section && sec !== section ? [] : Object.values(domains).flat())));
  const skills = Array.isArray(body?.skills) ? [...new Set(body.skills.filter((s) => typeof s === "string" && known.has(s)))] : [];
  const difficulty = Array.isArray(body?.difficulty) ? DIFFICULTIES.filter((d) => body.difficulty.includes(d)) : [];
  const count = typeof body?.count === "number" ? body.count : NaN;
  if (!Number.isInteger(count) || count < 1 || count > HOMEWORK.maxQuestions) return { error: `Choose between 1 and ${HOMEWORK.maxQuestions} questions` };
  const exclude = new Set(Array.isArray(body?.exclude) ? body.exclude.filter((x) => typeof x === "string") : []);
  return { spec: { section, skills, difficulty, count, exclude } };
}

// Draws the questions: at random, but spread over the skills asked for (one from each in turn),
// so "20 questions on four skills" is five of each when the bank has them.
export function drawQuestions(db, spec, rnd = Math.random) {
  const pool = db.practiceQuestions.filter(
    (q) => (!spec.section || q.section === spec.section) && (!spec.skills.length || spec.skills.includes(q.topic)) && (!spec.difficulty.length || spec.difficulty.includes(q.difficulty)) && !spec.exclude.has(q.id)
  );
  const piles = new Map();
  for (const q of shuffled(pool, rnd)) {
    if (!piles.has(q.topic)) piles.set(q.topic, []);
    piles.get(q.topic).push(q);
  }
  const order = shuffled([...piles.values()], rnd);
  const picked = [];
  while (picked.length < spec.count && order.some((pile) => pile.length)) {
    for (const pile of order) {
      if (picked.length >= spec.count) break;
      if (pile.length) picked.push(pile.pop());
    }
  }
  return { questions: picked.sort(bankOrder), available: pool.length };
}

// ---------- Setting a homework (studio) ----------
// `classIds` from the studio is "all" or a list of class ids. Returns { homework } (without id and
// dates) or { error }.
export function cleanHomework(db, body, today = todayKey()) {
  const title = text(body?.title, HOMEWORK.titleMax);
  if (!title) return { error: "Give the homework a title" };
  const classIds = cleanClassIds(db, body?.classIds);
  if (!classIds.length) return { error: db.classes.length ? "Choose at least one class" : "Make a class first: homework is set for a class" };
  const due = typeof body?.due === "string" ? body.due : "";
  if (!DAY.test(due) || Number.isNaN(Date.parse(`${due}T12:00:00Z`))) return { error: "Choose a due date" };
  if (due < today) return { error: "The due date can't be in the past" };
  if (dayDiff(due, today) > HOMEWORK.maxDaysAhead) return { error: `The due date can be at most ${HOMEWORK.maxDaysAhead} days ahead` };
  const live = new Set(db.practiceQuestions.map((q) => q.id));
  const ids = Array.isArray(body?.questionIds) ? [...new Set(body.questionIds.filter((x) => typeof x === "string"))] : [];
  if (!ids.length) return { error: "Choose the questions first" };
  if (ids.length > HOMEWORK.maxQuestions) return { error: `A homework can have ${HOMEWORK.maxQuestions} questions at most` };
  if (ids.some((id) => !live.has(id))) return { error: "Some of these questions are no longer in the bank. Choose the questions again." };
  return { homework: { title, note: text(body?.note, HOMEWORK.noteMax), classIds, questionIds: ids, due } };
}

export function addHomework(db, homework, by, now = Date.now()) {
  const hw = { id: nanoid(10), ...homework, createdAt: new Date(now).toISOString(), by: by || "" };
  db.homework.push(hw);
  return hw;
}

// ---------- A student's progress ----------
// `p` is the student's progress record (may be missing). `live` is the set of question ids still
// in the bank: a question deleted since the homework was set is no longer part of it.
export function homeworkProgress(hw, p, live) {
  const ids = new Set(live ? hw.questionIds.filter((id) => live.has(id)) : hw.questionIds);
  const first = new Map();
  for (const e of p?.answerLog || []) {
    if (!e.at || e.at < hw.createdAt || !ids.has(e.q) || first.has(e.q)) continue;
    first.set(e.q, e);
  }
  const answers = [...first.values()];
  const finishedAt = ids.size > 0 && first.size === ids.size ? answers.reduce((m, e) => (e.at > m ? e.at : m), "") : null;
  return {
    total: ids.size,
    done: first.size,
    correct: answers.filter((e) => e.ok && !e.a).length,
    // The first question still to do, so "Continue" opens where the student left off.
    next: hw.questionIds.find((id) => ids.has(id) && !first.has(id)) || null,
    finishedAt,
    late: Boolean(finishedAt) && todayKey(new Date(finishedAt)) > hw.due
  };
}

// The class a homework is read against: the student's, when they are in one.
const classIdOf = (user) => (inClass(user) ? user.classId : null);
const givenTo = (hw, classId) => Boolean(classId) && Array.isArray(hw.classIds) && hw.classIds.includes(classId);
const assignedTo = (hw, classId, today) => givenTo(hw, classId) && dayDiff(today, hw.due) <= HOMEWORK.showDays;

// What a homework is about, from its questions: the sections, and the skills with the most questions.
function about(questions) {
  const count = new Map();
  for (const q of questions) count.set(q.topic, (count.get(q.topic) || 0) + 1);
  const skills = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([topic]) => topic);
  return { sections: SECTIONS.filter((s) => questions.some((q) => q.section === s)), skills: skills.slice(0, 3), moreSkills: Math.max(0, skills.length - 3) };
}

// The student's homework, with how far they are. `withClass` adds how many classmates have
// finished each one (the class page shows it; the menu's badge doesn't need it).
export function homeworkFor(db, user, { withClass = false, now = Date.now() } = {}) {
  const classId = classIdOf(user);
  if (!classId) return [];
  const today = todayKey(new Date(now));
  const byId = new Map(db.practiceQuestions.map((q) => [q.id, q]));
  const live = new Set(byId.keys());
  const progress = new Map(db.progress.map((p) => [p.userId, p]));
  const mates = withClass ? classMembers(db, classId) : [];
  const list = [];
  for (const hw of db.homework) {
    if (!assignedTo(hw, classId, today)) continue;
    const mine = homeworkProgress(hw, progress.get(user.id), live);
    if (!mine.total) continue;
    const questions = hw.questionIds.map((id) => byId.get(id)).filter(Boolean);
    list.push({
      id: hw.id,
      title: hw.title,
      note: hw.note || "",
      due: hw.due,
      daysLeft: dayDiff(hw.due, today),
      createdAt: hw.createdAt,
      ...about(questions),
      ...mine,
      state: mine.finishedAt ? "done" : today > hw.due ? "overdue" : "open",
      ...(withClass ? { class: { students: mates.length, finished: mates.filter((u) => homeworkProgress(hw, progress.get(u.id), live).finishedAt).length } } : {})
    });
  }
  // What still needs doing first, the nearest due date on top; then what is finished, newest first.
  const open = list.filter((h) => h.state !== "done").sort((a, b) => a.due.localeCompare(b.due) || a.createdAt.localeCompare(b.createdAt));
  const done = list.filter((h) => h.state === "done").sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  return [...open, ...done];
}

// The numbers behind the menu's badge and the class page's summary.
export function homeworkSummary(db, user, now = Date.now()) {
  const todo = homeworkFor(db, user, { now }).filter((h) => h.state !== "done");
  const next = todo[0];
  return { open: todo.length, overdue: todo.filter((h) => h.state === "overdue").length, next: next ? { id: next.id, title: next.title, due: next.due, daysLeft: next.daysLeft, done: next.done, total: next.total } : null };
}

// The homework's questions in the order they were set, for the practice player. Null when this
// homework wasn't given to the student's class.
export function homeworkQuestions(db, user, id) {
  const hw = db.homework.find((h) => h.id === id);
  if (!hw || !givenTo(hw, classIdOf(user))) return null;
  const byId = new Map(db.practiceQuestions.map((q) => [q.id, q]));
  return hw.questionIds.map((qid) => byId.get(qid)).filter(Boolean);
}

// The homework this answer has just finished (the player says so). `at` is the answer's time.
export function homeworkFinishedBy(db, user, p, questionId, at) {
  const classId = classIdOf(user);
  if (!classId) return [];
  const live = new Set(db.practiceQuestions.map((q) => q.id));
  const today = todayKey();
  return db.homework
    .filter((hw) => assignedTo(hw, classId, today) && hw.questionIds.includes(questionId))
    .filter((hw) => homeworkProgress(hw, p, live).finishedAt === at)
    .map((hw) => ({ id: hw.id, title: hw.title }));
}

// ---------- Leaving the page while doing a homework ----------
// Homework isn't locked like a test (it is done at home, and a question counts wherever it is
// answered). But the student is told before they start that their teacher sees it when they leave
// the homework page, and the page reports each time: hw.leaves = { userId: { n, seconds, last } }.
// `n` is how many times, `seconds` how long they were away in all (as far as the page could tell:
// it is reported when they come back).
export const LEAVES = { maxCount: 500, maxAwaySeconds: 6 * 3600 };

// { event: "left" } when the student leaves, { event: "back", seconds } when they return.
// Returns the student's record, or null when this homework isn't theirs or is already finished.
export function noteHomeworkLeave(db, user, id, body, now = Date.now()) {
  const hw = db.homework.find((h) => h.id === id);
  if (!hw || !givenTo(hw, classIdOf(user))) return null;
  const live = new Set(db.practiceQuestions.map((q) => q.id));
  if (homeworkProgress(hw, db.progress.find((p) => p.userId === user.id), live).finishedAt) return null;
  hw.leaves ||= {};
  const mine = (hw.leaves[user.id] ||= { n: 0, seconds: 0, last: null });
  if (body?.event === "back") {
    const away = Math.round(Number(body.seconds));
    if (Number.isFinite(away) && away > 0) mine.seconds = Math.min(LEAVES.maxAwaySeconds, mine.seconds + away);
  } else {
    mine.n = Math.min(LEAVES.maxCount, mine.n + 1);
    mine.last = new Date(now).toISOString();
  }
  return mine;
}

const leavesOf = (hw, userId) => {
  const l = hw.leaves?.[userId];
  return l?.n ? { n: l.n, seconds: l.seconds || 0, last: l.last || null } : null;
};

// ---------- The studio's view ----------
// The classes a homework was set for that still exist, in the order it was set for them.
const classesOf = (db, hw) => (hw.classIds || []).map((id) => classById(db, id)).filter(Boolean);

function classNumbers(db, hw, live, progress) {
  return classesOf(db, hw).map((cls) => {
    const members = classMembers(db, cls.id);
    const rows = members.map((u) => homeworkProgress(hw, progress.get(u.id), live));
    const finished = rows.filter((r) => r.finishedAt);
    return {
      ...classInfo(cls),
      students: rows.length,
      started: rows.filter((r) => r.done > 0).length,
      finished: finished.length,
      // Students who left the homework page while doing it (see above).
      left: members.filter((u) => leavesOf(hw, u.id)).length,
      // Of the students who finished: the share of questions they got right at the first try.
      score: finished.length ? finished.reduce((s, r) => s + r.correct / r.total, 0) / finished.length : null
    };
  });
}

function teacherRow(db, hw, live, progress, today) {
  return {
    id: hw.id,
    title: hw.title,
    note: hw.note || "",
    classIds: classesOf(db, hw).map((c) => c.id),
    due: hw.due,
    past: today > hw.due,
    createdAt: hw.createdAt,
    by: hw.by || "",
    count: hw.questionIds.filter((id) => live.has(id)).length,
    classes: classNumbers(db, hw, live, progress)
  };
}

// Every homework, newest first.
export function teacherHomework(db, now = Date.now()) {
  const live = new Set(db.practiceQuestions.map((q) => q.id));
  const progress = new Map(db.progress.map((p) => [p.userId, p]));
  const today = todayKey(new Date(now));
  return db.homework.map((hw) => teacherRow(db, hw, live, progress, today)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// One homework with its questions and every student's result.
export function teacherHomeworkDetail(db, id, now = Date.now()) {
  const hw = db.homework.find((h) => h.id === id);
  if (!hw) return null;
  const byId = new Map(db.practiceQuestions.map((q) => [q.id, q]));
  const live = new Set(byId.keys());
  const progress = new Map(db.progress.map((p) => [p.userId, p]));
  const students = classesOf(db, hw).flatMap((cls) =>
    classMembers(db, cls.id).map((u) => ({ id: u.id, name: fullName(u), email: u.email || "", classId: cls.id, className: cls.name, ...homeworkProgress(hw, progress.get(u.id), live), leaves: leavesOf(hw, u.id) }))
  );
  return {
    ...teacherRow(db, hw, live, progress, todayKey(new Date(now))),
    questions: hw.questionIds.map((qid) => byId.get(qid)).filter(Boolean).map(questionCard),
    // Finished first (best score on top), then the ones still working, then the ones who haven't started.
    students: students.sort((a, b) => Number(Boolean(b.finishedAt)) - Number(Boolean(a.finishedAt)) || b.correct - a.correct || b.done - a.done || a.name.localeCompare(b.name))
  };
}

// The first day a due date may be, and the last, for the studio's date picker.
export const dueRange = (today = todayKey()) => ({ min: today, max: dayOffset(today, HOMEWORK.maxDaysAhead) });
