// Student practice hub: question bank, the practice player (answers,
// explanations, notes, reports, remixes), Nova the tutor, drills, saved
// mistakes, vocabulary, study plan, analytics and progress/XP. All progress is
// stored server-side per student account.

import { Router } from "express";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../db.js";
import { requireStudent } from "../auth.js";
import {
  BADGES,
  XP,
  ackWelcomeBack,
  award,
  badgeLadder,
  claimWelcomeBack,
  getProgress,
  levelInfo,
  logAnswer,
  repairStatus,
  reviewStatus,
  scaled,
  scoreDrill,
  scorePracticeAnswer,
  scoreRemixAnswer,
  scoreVocabReview,
  settleRepair,
  skyOf,
  startDrill,
  startRepair,
  streakOf,
  todayKey,
  dayDiff,
  dayOffset,
  dayStartMs,
  weekKey,
  welcomeBackStatus,
  xpGuide
} from "../gamification.js";
import { DOMAINS, SAT_DATES } from "../practiceContent.js";
import { DIFFICULTIES, DIFFICULTY_RANK, MATH_REFERENCE, SECTION_DIRECTIONS, SECTION_KEYS, SKILLS, SKILL_LESSONS, generatorLevel } from "../practiceSkills.js";
import { generateMath, hasGenerator, mulberry32, parseRemixId, remixId } from "../content/mathGen.js";
import { handleTutor } from "../tutor.js";
import { takeAiReply } from "../aiLimits.js";
import { CHUNKS, buyItem, chunkGuide, giveChunks, spendChunks, walletView } from "../shop.js";
import { isCorrectAnswer, questionMedia } from "../grading.js";
import { diagnosticStatus, isUsable, latestDiagnostic, lockedQuestionIds } from "../diagnostic.js";
import { timedModules } from "../practiceTests.js";
import { SCORE_SECTIONS, effectiveBand, examOverall, findExam } from "../ielts/lib/exam.js";
import { diagnosticStatus as ieltsDiagnosticStatus } from "../ielts/lib/diagnostic.js";
import { dailyLockedId, dailyStatus } from "../dailyStar.js";
import { cleanTarget, gapMap, skillSky, studyPlan } from "../planning.js";
import { onMistakesList, planIsSettled, planView, settlePlan } from "../weekPlan.js";
import { cleanVocabAnswers, markVocab, matchTime, nearWords, vocabGames } from "../vocabPractice.js";
import { recapStatus } from "../recap.js";
import { unreadForStudent } from "../messages.js";
import { MISTAKE_REASONS, examReasonKey, isReason, reasonOf, setReason, trapProfile, trapSummary } from "../review.js";
import { studySessions } from "../studySessions.js";
import { classFields, classOf } from "../classrooms.js";
import { homeworkFinishedBy, homeworkQuestions, homeworkSummary } from "../homework.js";
import { unreadTotal } from "../classChat.js";

const router = Router();
router.use(requireStudent);

const LETTERS = "ABCDEF";
const LEVEL_ORDER = DIFFICULTY_RANK;
const DAY_MS = 86400000;

// ---------- Ordering (the bank's "Normal" order follows the skill taxonomy) ----------
const SECTION_ORDER = Object.keys(SKILLS);
const DOMAIN_ORDER = {};
const SKILL_ORDER = {};
{
  let d = 0;
  let s = 0;
  for (const [section, domains] of Object.entries(SKILLS)) {
    for (const [domain, skills] of Object.entries(domains)) {
      DOMAIN_ORDER[`${section}|${domain}`] = d++;
      for (const skill of skills) SKILL_ORDER[`${section}|${skill}`] = s++;
    }
  }
}
function bankOrder(a, b) {
  return (
    SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) ||
    (DOMAIN_ORDER[`${a.section}|${a.domain}`] ?? 99) - (DOMAIN_ORDER[`${b.section}|${b.domain}`] ?? 99) ||
    (SKILL_ORDER[`${a.section}|${a.topic}`] ?? 999) - (SKILL_ORDER[`${b.section}|${b.topic}`] ?? 999) ||
    String(a.topic).localeCompare(String(b.topic)) ||
    (LEVEL_ORDER[a.difficulty] ?? 1) - (LEVEL_ORDER[b.difficulty] ?? 1) ||
    String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
  );
}

// ---------- Shapes ----------
function resultOf(a) {
  if (!a) return null;
  if (!a.lastCorrect) return "incorrect";
  return a.attempts > a.correct ? "corrected" : "correct";
}

const publicQuestion = (q, p) => {
  const a = p.answered[q.id];
  return {
    id: q.id,
    type: q.type || "mcq",
    section: q.section,
    domain: q.domain || null,
    topic: q.topic,
    difficulty: q.difficulty,
    title: q.title,
    passage: q.passage || "",
    table: q.table || null,
    figure: q.figure || null,
    ...questionMedia(q),
    prompt: q.prompt,
    options: q.type === "grid_in" ? null : q.options,
    saved: p.saved.includes(q.id),
    flagged: p.flagged.includes(q.id),
    status: !a ? "new" : a.lastCorrect ? "solved" : "missed",
    result: resultOf(a),
    attempts: a?.attempts || 0,
    lastAt: a?.lastAt || null,
    revealed: p.revealed.includes(q.id),
    note: p.notes[q.id] || "",
    // Why the student says they missed it (review.js), and where it is in the review schedule.
    reason: reasonOf(p, q.id),
    review: p.review[q.id] ? { box: p.review[q.id].box, due: p.review[q.id].due } : null,
    canRemix: q.section === "Math" ? hasGenerator(q.topic) : true
  };
};

// A generated "Remix" question: same shape, never saved to the bank.
const publicGenerated = (q, id) => ({
  id,
  type: q.type,
  section: q.section,
  domain: q.domain,
  topic: q.topic,
  difficulty: q.difficulty,
  title: q.title,
  passage: "",
  table: q.table || null,
  figure: q.figure || null,
  prompt: q.prompt,
  options: q.type === "grid_in" ? null : q.options,
  saved: false,
  flagged: false,
  status: "new",
  result: null,
  attempts: 0,
  revealed: false,
  note: "",
  canRemix: true,
  remix: true
});

const explanationOf = (q) => ({
  correctIndex: q.type === "grid_in" ? null : q.correctIndex,
  correctAnswer: q.type === "grid_in" ? q.correctAnswer : null,
  explanation: q.explanation || "",
  explanationImage: q.explanationImage || null,
  rationales: q.rationales || null,
  steps: q.steps || null,
  keyQuote: q.keyQuote || null,
  hint: q.hint || null
});

function regenerate(id) {
  const r = parseRemixId(id);
  return r ? generateMath(r.skill, r.level, r.seed) : null;
}

// While a diagnostic test is running, its questions can't be checked,
// explained, remixed or discussed with Nova here (see diagnostic.js).
const IN_DIAGNOSTIC = "This question is in your diagnostic test. Finish the test first, then practise it here.";
// Today's Northstar question is closed here too, until the student has used their one attempt at it.
const IN_DAILY = "This is today's Northstar question. Answer it on the Daily Star page first, then practise it here.";
// Why a question can't be checked, explained, remixed or discussed right now (null when it can).
function lockReason(db, userId, id) {
  if (lockedQuestionIds(db, userId).has(id)) return IN_DIAGNOSTIC;
  return dailyLockedId(db, userId) === id ? IN_DAILY : null;
}
// Every question that is closed to this student at the moment.
function lockedFor(db, userId) {
  const locked = lockedQuestionIds(db, userId);
  const daily = dailyLockedId(db, userId);
  if (daily) locked.add(daily);
  return locked;
}

// ---------- Filtering ----------
// Comma-separated query values (?difficulty=Easy,Hard) -> ["Easy","Hard"]; "All"/blank -> [].
function multi(v, sep = ",") {
  const list = Array.isArray(v) ? v : String(v || "").split(sep);
  return list.map((x) => String(x).trim()).filter((x) => x && x !== "All");
}
// Skill names can contain commas ("Ratios, rates, and units"), so skill lists
// use "|" and a single `topic` is never split.
const skillList = (skills, topic) => [...multi(skills, "|"), ...(topic && !Array.isArray(topic) ? [String(topic).trim()] : multi(topic, "|"))];

function sectionOf(query) {
  return SECTION_KEYS[query.sec] || (query.section && query.section !== "All" ? query.section : null);
}

function selectQuestions(db, p, query) {
  const section = sectionOf(query);
  const difficulties = multi(query.difficulty);
  const domains = multi(query.domain);
  const skills = skillList(query.skills, query.topic);
  const statuses = multi(query.status);
  const needle = String(query.q || "").toLowerCase();
  const type = query.type === "mcq" || query.type === "grid_in" ? query.type : null;
  const source = query.source || (query.saved === "1" ? "saved" : "bank");
  const cutoff = Date.now() - 30 * DAY_MS;
  const today = todayKey();

  // A finished diagnostic's bank questions in test order (?diag=<id>, &only=missed).
  let from = db.practiceQuestions;
  if (source === "diagnostic") {
    const d = db.diagnostics.find((x) => x.id === query.diag && x.userId === p.userId && x.status === "completed");
    const missed = new Set((d?.outcome || []).filter((o) => !o.correct).map((o) => o.id));
    const byId = new Map(db.practiceQuestions.map((q) => [q.id, q]));
    from = (d?.items || []).filter((it) => !it.gen && (query.only !== "missed" || missed.has(it.id))).map((it) => byId.get(it.id)).filter(Boolean);
  }
  // A homework's questions in the order the teacher set them (?homework=<id>): only for the
  // classes it was given to.
  if (source === "homework") {
    from = homeworkQuestions(db, db.users.find((u) => u.id === p.userId), String(query.homework || "")) || [];
  }
  // Questions named one by one (?ids=a,b): a question a classmate shared in the class chat.
  if (source === "shared") {
    const byId = new Map(db.practiceQuestions.map((q) => [q.id, q]));
    from = multi(query.ids).slice(0, 50).map((id) => byId.get(id)).filter(Boolean);
  }

  let list = from.filter((x) => {
    if (section && x.section !== section) return false;
    if (difficulties.length && !difficulties.includes(x.difficulty)) return false;
    if (domains.length && !domains.includes(x.domain)) return false;
    if (skills.length && !skills.includes(x.topic)) return false;
    if (type && (x.type || "mcq") !== type) return false;
    if (needle && !`${x.title} ${x.topic} ${x.section} ${x.prompt} ${x.passage || ""}`.toLowerCase().includes(needle)) return false;
    const a = p.answered[x.id];
    // saved=1 / flagged=1 narrow any source (AND), unlike `status`, whose values are alternatives (OR).
    if ((source === "saved" || query.saved === "1") && !p.saved.includes(x.id)) return false;
    if ((source === "flagged" || query.flagged === "1") && !p.flagged.includes(x.id)) return false;
    if (source === "errors" && !(a && !a.lastCorrect && Date.parse(a.lastAt) >= cutoff)) return false;
    // Spaced review: the missed questions whose review day has come.
    if (source === "review" && !(p.review[x.id] && p.review[x.id].due <= today)) return false;
    // The whole mistakes list, due or not: what the study plan's mistakes review works through.
    if (source === "mistakes" && !onMistakesList(p, x.id)) return false;
    if (
      statuses.length &&
      !statuses.some(
        (s) =>
          (s === "unanswered" && !a) ||
          (s === "correct" && a?.lastCorrect) ||
          (s === "incorrect" && a && !a.lastCorrect) ||
          (s === "flagged" && p.flagged.includes(x.id)) ||
          (s === "saved" && p.saved.includes(x.id))
      )
    )
      return false;
    return true;
  });

  const order = query.order || (source === "errors" ? "recent" : source === "diagnostic" || source === "homework" || source === "shared" ? "test" : source === "review" || source === "mistakes" ? "due" : "normal");
  if (order !== "test") list.sort(bankOrder);
  if (order === "shuffle") {
    const rnd = mulberry32(Number(query.seed) || 7);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  } else if (order === "easy" || order === "hard") {
    const dir = order === "easy" ? 1 : -1;
    list.sort((a, b) => dir * ((LEVEL_ORDER[a.difficulty] ?? 1) - (LEVEL_ORDER[b.difficulty] ?? 1)) || bankOrder(a, b));
  } else if (order === "unanswered") {
    list.sort((a, b) => Number(Boolean(p.answered[a.id])) - Number(Boolean(p.answered[b.id])) || bankOrder(a, b));
  } else if (order === "recent") {
    list.sort((a, b) => String(p.answered[b.id]?.lastAt || "").localeCompare(String(p.answered[a.id]?.lastAt || "")));
  } else if (order === "due") {
    // Longest overdue first; among those, the ones the student has kept right the fewest times.
    const card = (x) => p.review[x.id] || { due: "9999", box: 9 };
    list.sort((a, b) => card(a).due.localeCompare(card(b).due) || card(a).box - card(b).box || bankOrder(a, b));
  }
  const limit = Number(query.limit);
  if (limit > 0) list = list.slice(0, Math.min(200, limit));
  return list;
}

router.get("/domains", (req, res) => res.json({ domains: DOMAINS, skills: SKILLS }));

// Static reference data for the player: directions, lessons, math formulas.
router.get("/meta", (req, res) => res.json({ skills: SKILLS, lessons: SKILL_LESSONS, directions: SECTION_DIRECTIONS, mathReference: MATH_REFERENCE, mistakeReasons: MISTAKE_REASONS }));

// ---------- Question bank ----------
router.get("/questions", (req, res) => {
  const db = readDB();
  const p = getProgress(db, req.studentUserId);
  const list = selectQuestions(db, p, req.query);
  const topics = [...new Set(db.practiceQuestions.map((x) => x.topic))].sort();
  res.json({ questions: list.map((x) => publicQuestion(x, p)), topics, total: list.length });
});

function overallStats(db, p) {
  const ids = Object.keys(p.answered);
  const attempts = ids.reduce((s, id) => s + p.answered[id].attempts, 0);
  const correct = ids.reduce((s, id) => s + p.answered[id].correct, 0);
  const cutoff = Date.now() - 30 * DAY_MS;
  return {
    attempts,
    correct,
    wrong: attempts - correct,
    accuracy: attempts ? correct / attempts : null,
    questionsAnswered: ids.length,
    flagged: p.flagged.length,
    mistakes: p.saved.length + p.examMistakes.length,
    recentErrors: ids.filter((id) => !p.answered[id].lastCorrect && Date.parse(p.answered[id].lastAt) >= cutoff).length,
    streak: streakOf(p).current
  };
}

// Answers per calendar week, split by result and difficulty (for the activity chart).
// The chart has three shades, so a Challenging answer is counted with the Hard ones.
function weeklyTrend(db, p, weeks = 12) {
  const level = new Map(db.practiceQuestions.map((q) => [q.id, q.difficulty]));
  const thisWeek = weekKey(todayKey());
  const keys = Array.from({ length: weeks }, (_, i) => dayOffset(thisWeek, (i - weeks + 1) * 7));
  const rows = keys.map((week) => ({
    week,
    label: new Date(`${week}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    correct: { Easy: 0, Medium: 0, Hard: 0 },
    wrong: { Easy: 0, Medium: 0, Hard: 0 }
  }));
  const index = new Map(keys.map((k, i) => [k, i]));
  for (const e of p.answerLog) {
    const i = index.get(weekKey(todayKey(new Date(e.at))));
    if (i === undefined) continue;
    const d = generatorLevel(level.get(e.q)) || "Medium";
    const bucket = rows[i][e.ok ? "correct" : "wrong"];
    bucket[d in bucket ? d : "Medium"] += 1;
  }
  return rows;
}

function sectionSummary(db, p) {
  return Object.entries(SECTION_KEYS).map(([key, section]) => {
    const qs = db.practiceQuestions.filter((q) => q.section === section);
    return {
      key,
      section,
      total: qs.length,
      solved: qs.filter((q) => p.answered[q.id]?.lastCorrect).length,
      attempted: qs.filter((q) => p.answered[q.id]).length,
      skills: Object.values(SKILLS[section]).flat().length
    };
  });
}

router.get("/bank", (req, res) => {
  const db = readDB();
  const p = getProgress(db, req.studentUserId);
  res.json({ sections: sectionSummary(db, p), stats: overallStats(db, p), trend: weeklyTrend(db, p, 12) });
});

// Skill table for one section (Topic · Progress · Accuracy). Progress and
// accuracy respect the difficulty/type filters; `matching` also applies the
// status filters, i.e. how many questions "Start practice" would include.
router.get("/bank/:sec/skills", (req, res) => {
  const section = SECTION_KEYS[req.params.sec];
  if (!section) return res.status(404).json({ error: "Unknown section" });
  const db = readDB();
  const p = getProgress(db, req.studentUserId);
  const difficulties = multi(req.query.difficulty);
  const type = req.query.type === "mcq" || req.query.type === "grid_in" ? req.query.type : null;
  const base = db.practiceQuestions.filter(
    (q) => q.section === section && (!difficulties.length || difficulties.includes(q.difficulty)) && (!type || (q.type || "mcq") === type)
  );
  const matchingIds = new Set(selectQuestions(db, p, { ...req.query, sec: req.params.sec, skills: "", topic: "" }).map((q) => q.id));
  const known = SKILLS[section];
  const extraByDomain = {};
  for (const q of base) {
    if (!Object.values(known).flat().includes(q.topic)) (extraByDomain[q.domain] ||= new Set()).add(q.topic);
  }
  const row = (skill) => {
    const qs = base.filter((q) => q.topic === skill);
    const answered = qs.filter((q) => p.answered[q.id]);
    const attempts = answered.reduce((s, q) => s + p.answered[q.id].attempts, 0);
    const correct = answered.reduce((s, q) => s + p.answered[q.id].correct, 0);
    return {
      skill,
      total: qs.length,
      answered: answered.length,
      solved: answered.filter((q) => p.answered[q.id].lastCorrect).length,
      attempts,
      correct,
      accuracy: attempts ? correct / attempts : null,
      matching: qs.filter((q) => matchingIds.has(q.id)).length
    };
  };
  const domains = Object.entries(known).map(([domain, skills]) => ({
    domain,
    skills: [...skills, ...[...(extraByDomain[domain] || [])].sort()].map(row)
  }));
  res.json({ section, key: req.params.sec, domains, total: base.length, matching: matchingIds.size });
});

// ---------- The practice player ----------
// The answer has been shown (the explanation was opened, or Nova gave it): the student's next
// correct answer to this question counts as assisted. Does nothing once they have solved it.
function markRevealed(p, questionId) {
  if (p.answered[questionId]?.lastCorrect || p.revealed.includes(questionId)) return;
  p.revealed.push(questionId);
  if (p.revealed.length > 3000) p.revealed.splice(0, p.revealed.length - 3000);
}

router.get("/questions/:id/explanation", (req, res) => {
  const out = updateDB((db) => {
    const q = db.practiceQuestions.find((x) => x.id === req.params.id);
    if (!q) return { error: "Question not found", code: 404 };
    const closed = lockReason(db, req.studentUserId, q.id);
    if (closed) return { error: closed, code: 409 };
    const p = getProgress(db, req.studentUserId);
    // Opening the explanation before solving marks the next correct answer as assisted.
    markRevealed(p, q.id);
    return explanationOf(q);
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

router.post("/questions/:id/flag", (req, res) => {
  const out = updateDB((db) => {
    const q = db.practiceQuestions.find((x) => x.id === req.params.id);
    if (!q) return { error: "Question not found", code: 404 };
    const p = getProgress(db, req.studentUserId);
    if (p.flagged.includes(q.id)) p.flagged = p.flagged.filter((id) => id !== q.id);
    else p.flagged.push(q.id);
    return { flagged: p.flagged.includes(q.id) };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

router.post("/questions/:id/note", (req, res) => {
  const text = String(req.body?.text ?? "").slice(0, 2000);
  const out = updateDB((db) => {
    const q = db.practiceQuestions.find((x) => x.id === req.params.id);
    if (!q) return { error: "Question not found", code: 404 };
    const p = getProgress(db, req.studentUserId);
    if (text.trim()) p.notes[q.id] = text;
    else delete p.notes[q.id];
    return { note: p.notes[q.id] || "" };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

const REPORT_REASONS = {
  typo: "Typo or formatting problem",
  wrong_answer: "The answer seems wrong",
  unclear_explanation: "The explanation is unclear",
  confusing: "The question is confusing",
  other: "Something else"
};

router.post("/questions/:id/report", (req, res) => {
  const reason = REPORT_REASONS[req.body?.reason] ? req.body.reason : "other";
  const comment = String(req.body?.comment || "").trim().slice(0, 1000);
  const out = updateDB((db) => {
    const q = db.practiceQuestions.find((x) => x.id === req.params.id);
    if (!q) return { error: "Question not found", code: 404 };
    // One open report per student per question; a new one replaces the old.
    db.questionReports = db.questionReports.filter((r) => !(r.questionId === q.id && r.userId === req.studentUserId));
    db.questionReports.push({ id: nanoid(10), questionId: q.id, userId: req.studentUserId, reason, comment, createdAt: new Date().toISOString() });
    return { ok: true };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

router.post("/questions/:id/answer", (req, res) => {
  const { answer, inDrill, retry } = req.body || {};
  const timeMs = Math.max(0, Math.min(3600000, Number(req.body?.timeMs) || 0));
  const out = updateDB((db) => {
    const q = db.practiceQuestions.find((x) => x.id === req.params.id);
    if (!q) return { error: "Question not found", code: 404 };
    const closed = lockReason(db, req.studentUserId, q.id);
    if (closed) return { error: closed, code: 409 };
    const p = getProgress(db, req.studentUserId);
    const isCorrect = isCorrectAnswer(q, answer);
    // A second try in the same sitting, or an answer after opening the
    // explanation, still counts as practice, but not as a clean solve.
    const assisted = Boolean(retry) || p.revealed.includes(q.id);
    p.revealed = p.revealed.filter((id) => id !== q.id);

    // XP, combo and the mistakes queue all follow the rules in gamification.js.
    const { xp, kind, badges, autoSaved, cleared, review } = scorePracticeAnswer(p, q, { correct: isCorrect, assisted });
    logAnswer(p, { q: q.id, at: p.answered[q.id].lastAt, ok: isCorrect, ...(timeMs ? { ms: timeMs } : {}), ...(assisted ? { a: true } : {}) });

    const reward = award(p, xp, badges);
    const planned = planPayout(db, p);
    // A class homework this answer has just finished (homework.js). It pays nothing: the player
    // only says so.
    const homeworkDone = homeworkFinishedBy(db, db.users.find((u) => u.id === req.studentUserId), p, q.id, p.answered[q.id].lastAt);
    // An answer in the open repair drill: the last one relights the missed day.
    let repair = null;
    if (p.repair?.ids.includes(q.id)) {
      const locked = lockedFor(db, req.studentUserId);
      repair = settleRepair(p, (id) => !locked.has(id) && db.practiceQuestions.some((x) => x.id === id));
      // The rejoined streak can be long enough for a streak badge.
      if (repair.state === "repaired") reward.newBadges.push(...award(p, 0).newBadges);
    }
    return {
      ...(repair ? { repair } : {}),
      correct: isCorrect,
      correctIndex: q.type === "grid_in" ? null : q.correctIndex,
      correctAnswer: q.type === "grid_in" ? q.correctAnswer : null,
      explanation: q.explanation,
      rationale: q.type === "grid_in" ? null : q.rationales?.[Number(answer)] || null,
      combo: p.combo,
      autoSaved,
      cleared,
      assisted,
      // "solve" | "assisted" | "review" (already solved, so little or no XP) | "miss"
      xpKind: kind,
      saved: p.saved.includes(q.id),
      result: resultOf(p.answered[q.id]),
      attempts: p.answered[q.id].attempts,
      // What the answer did to the review schedule: { state, box, due, days }, or null for a
      // question that was never missed.
      review,
      reason: reasonOf(p, q.id),
      reward,
      ...planned,
      ...(homeworkDone.length ? { homework: { finished: homeworkDone } } : {}),
      inDrill: Boolean(inDrill)
    };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

// ---------- Mistake reasons, spaced review and the trap profile ----------
// The student's own reason for a miss: one of MISTAKE_REASONS, or blank to take it back. Only a
// question they have actually got wrong can carry one.
router.post("/questions/:id/reason", (req, res) => {
  const reason = req.body?.reason || null;
  if (reason && !isReason(reason)) return res.status(400).json({ error: "Unknown reason" });
  const out = updateDB((db) => {
    const q = db.practiceQuestions.find((x) => x.id === req.params.id);
    if (!q) return { error: "Question not found", code: 404 };
    const p = getProgress(db, req.studentUserId);
    const a = p.answered[q.id];
    if (!a || a.attempts <= a.correct) return { error: "You can tag a question after you've missed it.", code: 409 };
    return { reason: setReason(p, q.id, reason) };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

// What is due for review, and what is coming up. The questions themselves are GET /questions?source=review.
router.get("/review", (req, res) => {
  const db = readDB();
  const p = getProgress(db, req.studentUserId);
  const ids = new Set(db.practiceQuestions.map((q) => q.id));
  res.json({ ...reviewStatus(p, (id) => ids.has(id)), xp: XP.spacedReview });
});

router.get("/traps", (req, res) => {
  const db = readDB();
  const p = getProgress(db, req.studentUserId);
  res.json({ ...trapProfile(db, p), xp: XP.spacedReview });
});

// ---------- Remix: a fresh variant of the current question ----------
router.post("/remix", (req, res) => {
  const questionId = String(req.body?.questionId || "");
  const db = readDB();
  const closed = lockReason(db, req.studentUserId, questionId);
  if (closed) return res.status(409).json({ error: closed });
  const p = getProgress(db, req.studentUserId);
  const base = db.practiceQuestions.find((x) => x.id === questionId);
  const parsed = base ? null : parseRemixId(questionId);
  const skill = base?.topic || parsed?.skill;
  const level = base?.difficulty || parsed?.level || "Medium";
  const section = base?.section || (parsed ? "Math" : null);
  if (!skill) return res.status(404).json({ error: "Question not found" });

  if (section === "Math" && hasGenerator(skill)) {
    const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
    // The generators have no Challenging level, so a Challenging question remixes into a Hard one.
    const genLevel = generatorLevel(level);
    const q = generateMath(skill, genLevel, seed);
    return res.json({ question: publicGenerated(q, remixId(skill, genLevel, seed)), kind: "generated" });
  }
  // Reading & Writing: a similar bank question (same skill), unseen ones first.
  const rank = (x) => (p.answered[x.id] ? 2 : 0) + (x.difficulty === level ? 0 : 1) + Math.random() * 0.9;
  const pool = db.practiceQuestions
    .filter((x) => x.section === section && x.topic === skill && x.id !== questionId)
    .map((x) => ({ x, r: rank(x) }))
    .sort((a, b) => a.r - b.r);
  if (!pool.length) return res.status(404).json({ error: "There aren't any similar questions for this skill yet." });
  res.json({ question: publicQuestion(pool[0].x, p), kind: "similar" });
});

router.get("/remix/:id/explanation", (req, res) => {
  const q = regenerate(req.params.id);
  if (!q) return res.status(404).json({ error: "Question not found" });
  if (lockReason(readDB(), req.studentUserId, req.params.id)) return res.status(409).json({ error: IN_DIAGNOSTIC });
  res.json(explanationOf(q));
});

router.post("/remix/:id/answer", (req, res) => {
  const q = regenerate(req.params.id);
  if (!q) return res.status(404).json({ error: "Question not found" });
  if (lockReason(readDB(), req.studentUserId, req.params.id)) return res.status(409).json({ error: IN_DIAGNOSTIC });
  const isCorrect = isCorrectAnswer(q, req.body?.answer);
  const out = updateDB((db) => {
    const p = getProgress(db, req.studentUserId);
    const xp = scoreRemixAnswer(p, req.params.id, q.difficulty, { correct: isCorrect, retry: Boolean(req.body?.retry) });
    return { reward: award(p, xp, []) };
  });
  res.json({
    correct: isCorrect,
    correctIndex: q.type === "grid_in" ? null : q.correctIndex,
    correctAnswer: q.type === "grid_in" ? q.correctAnswer : null,
    explanation: q.explanation,
    rationale: q.type === "grid_in" ? null : q.rationales?.[Number(req.body?.answer)] || null,
    result: isCorrect ? "correct" : "incorrect",
    reward: out.reward
  });
});

// ---------- Nova, the tutor (server-sent events) ----------
function ieltsBands(db, userId) {
  const sessions = db.ieltsSessions
    .filter((s) => s.status === "completed" && (s.participantIds || []).includes(userId))
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  for (const s of sessions) {
    const exam = findExam(db, s.id, userId);
    if (!exam) continue;
    const bands = SCORE_SECTIONS.map((k) => `${k} ${effectiveBand(exam, k) ?? "—"}`).join(", ");
    return `${bands}, overall ${examOverall(exam) ?? "—"} (${s.name})`;
  }
  return null;
}

router.post("/tutor", async (req, res) => {
  const db = readDB();
  const p = getProgress(db, req.studentUserId);
  const user = db.users.find((u) => u.id === req.studentUserId);
  const qid = req.body?.questionId ? String(req.body.questionId) : null;
  const closed = qid ? lockReason(db, req.studentUserId, qid) : null;
  if (closed) return res.status(409).json({ error: closed });
  const q = qid ? db.practiceQuestions.find((x) => x.id === qid) || regenerate(qid) : null;
  const cs = req.body?.state && typeof req.body.state === "object" ? req.body.state : {};
  const a = q?.id ? p.answered[q.id] : null;
  const idx = (v) => (Number.isInteger(v) && v >= 0 && v < 6 ? v : null);
  // What decides whether Nova may say the answer (attempts, correct, revealed) comes from the
  // student's saved progress only. The browser's `state` is used just for what the student is
  // looking at (selection, crossed-out options), which can't unlock anything.
  const st = {
    attempts: a?.attempts || 0,
    lastCorrect: Boolean(a?.lastCorrect),
    correct: Boolean(a?.lastCorrect),
    revealed: Boolean(q?.id && p.revealed.includes(q.id)),
    selectedIndex: idx(cs.selected),
    selectedLabel: idx(cs.selected) != null ? LETTERS[cs.selected] : typeof cs.selected === "string" ? cs.selected.slice(0, 20) : null,
    crossed: (Array.isArray(cs.crossed) ? cs.crossed : []).map(idx).filter((x) => x != null).map((i) => LETTERS[i]),
    lastWrongIndex: idx(cs.lastWrong),
    lastWrongLabel: idx(cs.lastWrong) != null ? LETTERS[cs.lastWrong] : null
  };
  const stats = overallStats(db, p);
  const nextExam = pickExamDate(p);
  const student = {
    // How this student tends to lose points (the trap profile's first line), when there is a pattern.
    traps: trapSummary(trapProfile(db, p)),
    firstName: user?.firstName || "",
    exam: req.body?.exam === "ielts" ? "ielts" : "sat",
    targetScore: p.targetScore,
    currentScore: p.currentScore ?? estimate(db, p, req.studentUserId).total,
    daysToExam: nextExam ? Math.max(0, Math.ceil((Date.parse(nextExam.iso) - Date.now()) / DAY_MS)) : null,
    attempts: stats.attempts,
    accuracy: stats.accuracy,
    mistakes: stats.mistakes,
    weakest: topicStats(db, p)
      .filter((t) => t.attempts >= 2)
      .sort((x, y) => x.accuracy - y.accuracy)
      .slice(0, 3),
    ieltsTarget: p.ieltsTarget,
    ieltsBands: ieltsBands(db, req.studentUserId)
  };
  // A message on the Ask Nova page costs a comet chunk. Nova beside a question is free, like the
  // explanation: `q` is the question the server found, so a made-up id doesn't make a chat free.
  const NOVA_WHY = "Messages to Nova";
  const wallet = (fn) => updateDB((d) => fn(getProgress(d, req.studentUserId)));
  await handleTutor(req, res, {
    q,
    st,
    student,
    vocab: db.vocab,
    // Nova gave the answer away: same effect as opening the explanation.
    onReveal: (id) => updateDB((d) => markRevealed(getProgress(d, req.studentUserId), id)),
    takeAiReply: () => updateDB((d) => takeAiReply(d, req.studentUserId)),
    ...(q
      ? {}
      : {
          charge: () => wallet((mine) => spendChunks(mine, CHUNKS.novaMessage, NOVA_WHY)),
          // Nova failed to answer: the chunk goes back.
          refund: () => wallet((mine) => giveChunks(mine, CHUNKS.novaMessage, NOVA_WHY))
        })
  });
});

// ---------- Comet chunks and the Comet Shop (shop.js) ----------
// The catalogue and the balance come with GET /progress (`chunks`); this adds how chunks are
// earned and spent, and the student's recent ins and outs.
router.get("/shop", (req, res) => {
  const p = getProgress(readDB(), req.studentUserId);
  res.json({ ...walletView(p), ...chunkGuide(), log: p.wallet.log });
});

router.post("/shop/buy", (req, res) => {
  const out = updateDB((db) => {
    const p = getProgress(db, req.studentUserId);
    const bought = buyItem(p, String(req.body?.id || ""));
    return bought.error ? bought : { item: bought.item, ...walletView(p), log: p.wallet.log };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

// ---------- Mistakes from mock exams (mirrored into the same queue) ----------
router.get("/mistakes/exam", (req, res) => {
  const db = readDB();
  const p = getProgress(db, req.studentUserId);
  // A question's pictures aren't copied into the queue (each can be megabytes); they're looked up
  // from the test by the same `moduleId:questionId` key, so a graph question stays answerable.
  const figures = new Map();
  for (const t of db.tests) {
    for (const m of t.modules) {
      for (const q of m.questions) {
        if (q.passageImage || q.promptImage) figures.set(`${m.id}:${q.id}`, { passageImage: q.passageImage || null, promptImage: q.promptImage || null });
      }
    }
  }
  res.json({ mistakes: p.examMistakes.map((m) => ({ ...m, ...(figures.get(m.key) || {}), reason: reasonOf(p, examReasonKey(m.key)) })) });
});

router.post("/mistakes/exam/:key/reason", (req, res) => {
  const reason = req.body?.reason || null;
  if (reason && !isReason(reason)) return res.status(400).json({ error: "Unknown reason" });
  const out = updateDB((db) => {
    const p = getProgress(db, req.studentUserId);
    const m = p.examMistakes.find((x) => x.key === req.params.key);
    if (!m) return { error: "Not found", code: 404 };
    return { reason: setReason(p, examReasonKey(m.key), reason, { section: /math/i.test(m.moduleName || "") ? "Math" : "Reading & Writing" }) };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

router.post("/mistakes/exam/:key/clear", (req, res) => {
  const out = updateDB((db) => {
    const p = getProgress(db, req.studentUserId);
    const before = p.examMistakes.length;
    p.examMistakes = p.examMistakes.filter((m) => m.key !== req.params.key);
    if (p.examMistakes.length === before) return { error: "Not found", code: 404 };
    const reward = award(p, XP.examMistake, ["mistake_crusher"]);
    return { reward };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

router.post("/questions/:id/save", (req, res) => {
  const out = updateDB((db) => {
    const q = db.practiceQuestions.find((x) => x.id === req.params.id);
    if (!q) return { error: "Question not found", code: 404 };
    const p = getProgress(db, req.studentUserId);
    if (p.saved.includes(q.id)) p.saved = p.saved.filter((id) => id !== q.id);
    else p.saved.push(q.id);
    return { saved: p.saved.includes(q.id), savedCount: p.saved.length };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

// Build a drill: prefers questions you haven't solved yet.
router.post("/drill", (req, res) => {
  const { section, difficulty, domain, topic, skills, savedOnly, size = 5, plan } = req.body || {};
  const difficulties = multi(difficulty);
  const domains = multi(domain);
  const wanted = skillList(skills, topic);
  const sec = SECTION_KEYS[section] || section;
  const questions = updateDB((db) => {
    const p = getProgress(db, req.studentUserId);
    const closed = lockedFor(db, req.studentUserId);
    // A drill for the plan's mixed-practice task leaves out the skills the week's other tasks cover.
    const task = Number.isInteger(plan) ? p.weekPlan?.tasks[plan] : null;
    const left = task?.kind === "mixed" ? task.except : [];
    const pool = db.practiceQuestions.filter(
      (x) =>
        !closed.has(x.id) &&
        !left.includes(x.topic) &&
        (!sec || sec === "All" || x.section === sec) &&
        (!difficulties.length || difficulties.includes(x.difficulty)) &&
        (!domains.length || domains.includes(x.domain)) &&
        (!wanted.length || wanted.includes(x.topic)) &&
        (!savedOnly || p.saved.includes(x.id))
    );
    const rank = (x) => (!p.answered[x.id] ? 0 : p.answered[x.id].lastCorrect ? 2 : 1);
    const picked = pool
      .map((x) => ({ x, r: rank(x) + Math.random() * 0.9 }))
      .sort((a, b) => a.r - b.r)
      .slice(0, Math.max(1, Math.min(20, Number(size) || 5)))
      .map(({ x }) => x);
    // Remembered so the completion bonus can be checked against graded answers.
    startDrill(p, picked.map((x) => x.id));
    return picked.map((x) => publicQuestion(x, p));
  });
  res.json({ questions });
});

// The bonus comes from the answers the server graded since the drill was
// built; nothing the client sends is counted.
router.post("/drill/complete", (req, res) => {
  const out = updateDB((db) => {
    const p = getProgress(db, req.studentUserId);
    const drill = scoreDrill(p);
    if (!drill) return { reward: null, total: 0, correct: 0 };
    return { reward: award(p, drill.xp, drill.badges), total: drill.total, correct: drill.correct };
  });
  res.json(out);
});

// ---------- Streak repair ----------
// Ten random questions spread over the whole bank. The sections take turns,
// each giving a random question from one of its skills in a random order, and
// a skill only comes round again once every skill in its section has had a
// turn. So the set always covers both sections and as many skills as it can.
function pickRepairIds(db, userId, size, rnd = Math.random) {
  const locked = lockedFor(db, userId);
  const bank = {};
  for (const q of db.practiceQuestions) {
    if (!isUsable(q) || locked.has(q.id)) continue;
    ((bank[q.section] ||= {})[q.topic] ||= []).push(q.id);
  }
  const shuffle = (list) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const sections = shuffle(Object.keys(bank)).map((name) => ({ topics: bank[name], queue: [] }));
  const ids = [];
  for (let turn = 0; ids.length < size && sections.some((s) => Object.keys(s.topics).length); turn++) {
    const s = sections[turn % sections.length];
    if (!Object.keys(s.topics).length) continue;
    if (!s.queue.length) s.queue = shuffle(Object.keys(s.topics));
    const topic = s.queue.pop();
    const pool = s.topics[topic];
    ids.push(...pool.splice(Math.floor(rnd() * pool.length), 1));
    if (!pool.length) delete s.topics[topic];
  }
  return ids;
}

// Opens the repair drill, or returns the one already open with what's been
// answered so far. The server decides whether a day can be repaired, and the
// answer route above closes the drill when its last question is answered.
router.post("/repair/start", (req, res) => {
  const out = updateDB((db) => {
    const p = getProgress(db, req.studentUserId);
    const repair = startRepair(p, (n) => pickRepairIds(db, req.studentUserId, n));
    if (!repair) return { error: "There's no day to repair right now. A day can be relit for 48 hours after it ends.", code: "NO_REPAIR", status: 409 };
    const byId = new Map(db.practiceQuestions.map((q) => [q.id, q]));
    return { repair: repairStatus(p), questions: repair.ids.map((id) => byId.get(id)).filter(Boolean).map((q) => publicQuestion(q, p)) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error, code: out.code });
  res.json(out);
});

// ---------- Welcome back ----------
// The hub calls this when progress says the student is back after a break.
// The server checks the absence and the 14-day gap itself, then gives the gift.
router.post("/welcome-back", (req, res) => {
  const out = updateDB((db) => {
    const p = getProgress(db, req.studentUserId);
    const gift = claimWelcomeBack(p);
    return { granted: Boolean(gift), welcomeBack: welcomeBackStatus(p) };
  });
  res.json(out);
});

router.post("/welcome-back/seen", (req, res) => {
  updateDB((db) => ackWelcomeBack(getProgress(db, req.studentUserId)));
  res.json({ ok: true });
});

// ---------- Vocabulary ----------
router.get("/vocab", (req, res) => {
  const db = readDB();
  const p = getProgress(db, req.studentUserId);
  // `near`: the words too close in meaning to be offered as a wrong choice for this one.
  const near = nearWords(db.vocab);
  res.json({ words: db.vocab.map((w) => ({ ...w, mastery: p.vocab[w.id] ?? 0, near: near.get(w.id) })), games: vocabGames(p) });
});

const VOCAB_BADGES = (mastered) => [...(mastered >= 10 ? ["word_nerd"] : []), ...(mastered >= 50 ? ["lexicon"] : [])];

// Answers from Learn mode or a Match board, marked here (vocabPractice.js). A word that was
// answered right is paid like a flashcard (once a day per word, under the same daily cap) and
// counts toward the study plan's vocab task.
router.post("/vocab/answers", (req, res) => {
  const answers = cleanVocabAnswers(req.body);
  if (!answers) return res.status(400).json({ error: "answers must be a list of { id, kind, pick }" });
  const out = updateDB((db) => {
    const p = getProgress(db, req.studentUserId);
    const marked = markVocab(db, p, answers);
    // Nothing about a word of the deck: no practice happened, so no day is lit for it.
    if (!marked.results.length) return { results: [], words: [], reward: null, games: vocabGames(p) };
    const mastered = Object.values(p.vocab).filter((m) => m >= 80).length;
    const xp = marked.right.reduce((sum, id) => sum + scoreVocabReview(p, id), 0);
    const reward = award(p, xp, VOCAB_BADGES(mastered));
    const match = req.body.mode === "match" ? matchTime(p, marked.results, req.body.seconds) : null;
    return {
      results: marked.results,
      words: marked.touched.map((id) => ({ id, mastery: p.vocab[id] })),
      mastered,
      reward,
      ...(match ? { match } : {}),
      games: vocabGames(p),
      ...planPayout(db, p, { words: marked.right })
    };
  });
  res.json(out);
});

router.post("/vocab/:id/rate", (req, res) => {
  const delta = { again: -15, hard: 5, good: 15, easy: 25 }[req.body?.rating];
  if (delta === undefined) return res.status(400).json({ error: "rating must be again|hard|good|easy" });
  const out = updateDB((db) => {
    const w = db.vocab.find((x) => x.id === req.params.id);
    if (!w) return { error: "Word not found", code: 404 };
    const p = getProgress(db, req.studentUserId);
    const mastery = Math.max(0, Math.min(100, (p.vocab[w.id] ?? 0) + delta));
    p.vocab[w.id] = mastery;
    const mastered = Object.values(p.vocab).filter((m) => m >= 80).length;
    const reward = award(p, scoreVocabReview(p, w.id), VOCAB_BADGES(mastered));
    return { mastery, mastered, reward, ...planPayout(db, p, { word: w.id }) };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

// ---------- Stats helpers ----------
function topicStats(db, p) {
  const stats = {};
  for (const q of db.practiceQuestions) {
    const a = p.answered[q.id];
    const key = q.topic;
    stats[key] ||= { topic: key, section: q.section, domain: q.domain, attempts: 0, correct: 0, total: 0, answered: 0 };
    stats[key].total += 1;
    if (a) {
      stats[key].attempts += a.attempts;
      stats[key].correct += a.correct;
      stats[key].answered += 1;
    }
  }
  return Object.values(stats).map((s) => ({ ...s, accuracy: s.attempts ? s.correct / s.attempts : null }));
}

function examStats(db, userId) {
  const mine = db.participants.filter((x) => x.userId === userId).map((x) => x.id);
  const attempts = db.attempts.filter((a) => mine.includes(a.participantId) && a.submittedAt);
  const bySection = { rw: [], math: [] };
  for (const a of attempts) {
    const session = db.sessions.find((s) => s.id === a.sessionId);
    const test = db.tests.find((t) => t.id === session?.testId);
    const mod = test?.modules.find((m) => m.id === a.moduleId);
    if (!mod || !a.max) continue;
    const key = /math/i.test(mod.name) ? "math" : "rw";
    bySection[key].push({ at: a.submittedAt, acc: a.raw / a.max, raw: a.raw, max: a.max, name: mod.name, test: test.title });
  }
  // Timed modules of the practice tests (practiceTests.js) are sat under the same conditions.
  // They come with their own score table, so their scaled score is read from it (`score`).
  const own = timedModules(db, userId);
  for (const m of own) bySection[m.section].push({ at: m.at, acc: m.raw / m.max, raw: m.raw, max: m.max, name: m.name, test: m.test, score: m.score });
  for (const k of Object.keys(bySection)) bySection[k].sort((x, y) => x.at.localeCompare(y.at));
  return { bySection, count: attempts.length + own.length };
}

function estimate(db, p, userId) {
  const ex = examStats(db, userId);
  const ts = topicStats(db, p);
  const practiceAcc = (section) => {
    const rows = ts.filter((t) => t.section === section && t.attempts);
    const a = rows.reduce((s, r) => s + r.attempts, 0);
    return a ? rows.reduce((s, r) => s + r.correct, 0) / a : null;
  };
  const diag = latestDiagnostic(db, userId);
  // The newer of the latest mock module and the latest diagnostic test, or
  // practice accuracy when there is neither.
  const pick = (key, section) => {
    const last = ex.bySection[key].at(-1);
    const fromDiag = diag?.result?.sections?.[key];
    if (fromDiag && (!last || diag.submittedAt > last.at)) return { score: fromDiag.score, source: "diagnostic test", at: diag.submittedAt };
    if (last) return { score: last.score ?? scaled(last.acc), source: "mock exam", at: last.at };
    const acc = practiceAcc(section);
    return acc === null ? null : { score: scaled(acc), source: "practice" };
  };
  const rw = pick("rw", "Reading & Writing");
  const math = pick("math", "Math");
  const history = [...ex.bySection.rw, ...ex.bySection.math]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((h) => ({ at: h.at, name: h.name, test: h.test, raw: h.raw, max: h.max, scaled: h.score ?? scaled(h.acc) }));
  return {
    rw,
    math,
    total: rw && math ? rw.score + math.score : null,
    history
  };
}

// The student's SAT date: one of the official dates, or their own day
// ("YYYY-MM-DD", for a school-day or other sitting). Until they choose one,
// the next official date stands in (`chosen: false`).
const CUSTOM_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS_AHEAD = 730;
function pickExamDate(p, now = Date.now()) {
  const today = todayKey(new Date(now));
  const withDays = (d, extra) => ({ ...d, ...extra, day: todayKey(new Date(d.iso)), daysLeft: dayDiff(todayKey(new Date(d.iso)), today) });
  if (CUSTOM_DAY.test(p.examDate || "") && p.examDate > today) {
    // Tests start in the morning: 08:00 on the chosen day.
    const iso = new Date(dayStartMs(p.examDate) + 8 * 3600000).toISOString();
    const label = new Date(`${p.examDate}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    return withDays({ iso, label }, { custom: true, chosen: true });
  }
  const upcoming = SAT_DATES.filter((d) => Date.parse(d.iso) > now);
  const mine = upcoming.find((d) => d.iso === p.examDate);
  const date = mine || upcoming[0] || null;
  return date ? withDays(date, { custom: false, chosen: Boolean(mine) }) : null;
}

// Practice results per skill, as the planning functions want them.
const skillStats = (db, p) => new Map(topicStats(db, p).map((t) => [t.topic, { attempts: t.attempts, correct: t.correct }]));
// The latest mock module's accuracy per section, when there is one.
function mockAccuracy(db, userId) {
  const { bySection } = examStats(db, userId);
  const out = {};
  if (bySection.rw.length) out["Reading & Writing"] = bySection.rw.at(-1).acc;
  if (bySection.math.length) out.Math = bySection.math.at(-1).acc;
  return out;
}

// ---------- The weekly study plan (weekPlan.js) ----------
// A section's skills, weakest first: what the week's tasks are chosen from.
const weakestSkills = (db, p) => (section) =>
  topicStats(db, p)
    .filter((t) => t.section === section)
    .sort((a, b) => (a.accuracy ?? 0.6) - (b.accuracy ?? 0.6) || a.attempts - b.attempts || (SKILL_ORDER[`${section}|${a.topic}`] ?? 999) - (SKILL_ORDER[`${section}|${b.topic}`] ?? 999))
    .map((t) => t.topic);

// Records and pays the plan tasks the student's work has just finished. Returns what the response
// carries for them ({ plan: { finished: [{ index, title }], reward } }), or nothing.
function planPayout(db, p, extra) {
  const due = settlePlan(db, p, weakestSkills(db, p), extra);
  return due.finished.length ? { plan: { finished: due.finished, reward: award(p, due.xp, due.badges) } } : {};
}

// Practice sessions are reconstructed from the answer log (studySessions.js).
router.get("/sessions", (req, res) => {
  const db = readDB();
  const p = getProgress(db, req.studentUserId);
  res.json({ sessions: studySessions(db, p, Number(req.query.limit) || 30) });
});

router.get("/analytics", (req, res) => {
  const db = readDB();
  const p = getProgress(db, req.studentUserId);
  const ts = topicStats(db, p);
  const qmap = new Map(db.practiceQuestions.map((q) => [q.id, q]));
  const timing = {};
  for (const e of p.answerLog) {
    const q = qmap.get(e.q);
    if (!q || !e.ms) continue;
    const t = (timing[q.topic] ||= { ms: 0, n: 0 });
    t.ms += e.ms;
    t.n += 1;
  }
  const byDifficulty = Object.fromEntries(DIFFICULTIES.map((level) => [level, { attempts: 0, correct: 0 }]));
  for (const [id, a] of Object.entries(p.answered)) {
    const q = qmap.get(id);
    if (!q || !byDifficulty[q.difficulty]) continue;
    byDifficulty[q.difficulty].attempts += a.attempts;
    byDifficulty[q.difficulty].correct += a.correct;
  }
  const sections = Object.entries(SECTION_KEYS).map(([key, section]) => {
    const domains = Object.entries(SKILLS[section]).map(([domain, skills]) => {
      const rows = skills.map((skill) => {
        const s = ts.find((x) => x.topic === skill && x.section === section) || { attempts: 0, correct: 0, total: 0, answered: 0 };
        const t = timing[skill];
        return { skill, attempts: s.attempts, correct: s.correct, total: s.total, answered: s.answered, accuracy: s.attempts ? s.correct / s.attempts : null, avgSec: t ? Math.round(t.ms / t.n / 1000) : null };
      });
      const attempts = rows.reduce((x, r) => x + r.attempts, 0);
      const correct = rows.reduce((x, r) => x + r.correct, 0);
      return { domain, attempts, correct, accuracy: attempts ? correct / attempts : null, skills: rows };
    });
    const attempts = domains.reduce((x, d) => x + d.attempts, 0);
    const correct = domains.reduce((x, d) => x + d.correct, 0);
    return { key, section, attempts, correct, accuracy: attempts ? correct / attempts : null, domains };
  });
  const timed = p.answerLog.filter((e) => e.ms);
  res.json({
    stats: overallStats(db, p),
    trend: weeklyTrend(db, p, 12),
    sections,
    byDifficulty,
    avgSec: timed.length ? Math.round(timed.reduce((s, e) => s + e.ms, 0) / timed.length / 1000) : null,
    sessions: studySessions(db, p, 20),
    mock: estimate(db, p, req.studentUserId).history
  });
});

// ---------- Progress / dashboard ----------
router.get("/progress", (req, res) => {
  let db = readDB();
  // The week's plan is fixed the first time it is asked for. A task finished by work that doesn't
  // settle the plan itself (a mock module, the Daily Star, a diagnostic) is recorded and paid here;
  // this is not study, so it doesn't light today's star.
  if (!planIsSettled(db, getProgress(db, req.studentUserId))) {
    db = updateDB((d) => {
      const mine = getProgress(d, req.studentUserId);
      const due = settlePlan(d, mine, weakestSkills(d, mine));
      if (due.finished.length) award(mine, due.xp, due.badges, { activity: false });
      return d;
    });
  }
  const p = getProgress(db, req.studentUserId);
  const today = todayKey();
  const lvl = levelInfo(p.xp);
  const answeredIds = Object.keys(p.answered);
  const attempts = answeredIds.reduce((s, id) => s + p.answered[id].attempts, 0);
  const correct = answeredIds.reduce((s, id) => s + p.answered[id].correct, 0);
  const week = Array.from({ length: 7 }, (_, i) => {
    const key = dayOffset(weekKey(today), i);
    return { date: key, label: ["M", "T", "W", "T", "F", "S", "S"][i], xp: p.xpLog[key] || 0, isToday: key === today };
  });
  const last30 = Array.from({ length: 28 }, (_, i) => {
    const key = dayOffset(today, i - 27);
    return { date: key, xp: p.xpLog[key] || 0 };
  });
  const nextExam = pickExamDate(p);
  const ts = topicStats(db, p).filter((t) => t.attempts);

  res.json({
    xp: p.xp,
    ...lvl,
    streak: streakOf(p, today),
    // The day history as a sky, the day that can still be relit (or null),
    // and whether a welcome-back gift is due or waiting to be shown.
    sky: skyOf(p, today),
    repair: repairStatus(p),
    welcomeBack: welcomeBackStatus(p),
    // Today's Northstar question: whether the student has had their attempt, and their stars so far.
    daily: dailyStatus(db, req.studentUserId, today),
    // Last month's recap: whether there is one to read, and whether it has been opened.
    recap: recapStatus(p),
    combo: p.combo,
    bestCombo: p.bestCombo,
    today: { xp: p.xpLog[today] || 0, goal: p.dailyGoal, date: today },
    week,
    heatmap: last30,
    practice: {
      attempted: answeredIds.length,
      solved: answeredIds.filter((id) => p.answered[id].lastCorrect).length,
      total: db.practiceQuestions.length,
      accuracy: attempts ? correct / attempts : null,
      savedCount: p.saved.length + p.examMistakes.length,
      drills: p.drills.length
    },
    stats: overallStats(db, p),
    // Spaced review: how many missed questions are due today, and when the next ones come back.
    review: (() => {
      const ids = new Set(db.practiceQuestions.map((q) => q.id));
      const r = reviewStatus(p, (id) => ids.has(id), today);
      return { due: r.due, scheduled: r.scheduled, graduated: r.graduated, next: r.next };
    })(),
    vocab: {
      total: db.vocab.length,
      mastered: Object.values(p.vocab).filter((m) => m >= 80).length,
      started: Object.keys(p.vocab).length
    },
    topics: ts.sort((a, b) => a.accuracy - b.accuracy),
    estimate: estimate(db, p, req.studentUserId),
    targetScore: p.targetScore,
    currentScore: p.currentScore,
    ieltsTarget: p.ieltsTarget,
    dailyGoal: p.dailyGoal,
    badges: Object.entries(BADGES).map(([id, b]) => {
      const got = p.badges.find((x) => x.id === id);
      return { id, ...b, earned: Boolean(got), earnedAt: got?.earnedAt || null, ladder: got ? badgeLadder(p, id) : null };
    }),
    // Comet chunks, the spendable count that is separate from XP: the balance, what has been
    // bought, the shop's catalogue and what a message to Nova costs (shop.js).
    chunks: walletView(p),
    // XP amounts for the pages that mention them, so the copy follows the rules.
    xpRules: XP,
    xpGuide: xpGuide(),
    // This week's tasks, each with how far the student's own work has taken it (`have` of `need`).
    plan: planView(db, p, today),
    satDates: SAT_DATES.filter((d) => Date.parse(d.iso) > Date.now()),
    nextExam,
    examDate: p.examDate,
    targetAccuracy: cleanTarget(p.targetAccuracy),
    // The three skills worth the most raw questions on test day (see GET /gap-map).
    worthMost: gapMap(skillStats(db, p), cleanTarget(p.targetAccuracy)).top,
    diagnostic: diagnosticStatus(db, req.studentUserId),
    ieltsDiagnostic: ieltsDiagnosticStatus(db, req.studentUserId),
    // Replies from the developers the student hasn't opened (the badge on "Message Developers").
    messages: { unread: unreadForStudent(db, req.studentUserId) },
    // The student's Presidential School class (or null), whether they were ever asked, and what
    // is waiting there: homework still to do and chat messages not yet read (the badge on "My Class").
    ...classStatus(db, req.studentUserId)
  });
});

function classStatus(db, userId) {
  const user = db.users.find((u) => u.id === userId);
  const fields = classFields(db, user);
  if (!fields.classroom) return fields;
  const homework = homeworkSummary(db, user);
  return { ...fields, class: { homework: homework.open, overdue: homework.overdue, unread: unreadTotal(db, user) } };
}

// ---------- Planning ----------
// The week-by-week plan from today to the SAT date. It is rebuilt from the
// student's answers on every request, so it follows their performance. It is a
// study plan, not a prediction.
router.get("/roadmap", (req, res) => {
  const db = readDB();
  const p = getProgress(db, req.studentUserId);
  const exam = pickExamDate(p);
  const today = todayKey();
  const stats = skillStats(db, p);
  const mock = mockAccuracy(db, req.studentUserId);
  res.json({
    exam,
    today,
    officialDates: SAT_DATES.filter((d) => Date.parse(d.iso) > Date.now()),
    ...studyPlan({ stats, mock, examDay: exam?.day || null, today, target: cleanTarget(p.targetAccuracy) }),
    // What the plan is built from, so the page can say so.
    basis: { answers: [...stats.values()].reduce((s, v) => s + v.attempts, 0), mockSections: Object.keys(mock).length }
  });
});

// The point-gap map: accuracy per skill, and the raw questions it would be
// worth on test day at the target accuracy. No scaled scores.
router.get("/gap-map", (req, res) => {
  const db = readDB();
  const p = getProgress(db, req.studentUserId);
  res.json(gapMap(skillStats(db, p), cleanTarget(req.query.target ?? p.targetAccuracy)));
});

// The skill constellation map (the "Skills" tab of /sky): a state, accuracy and tip per skill, and
// the skill the marker sits on. Read-only, worked out from the student's answers each time.
router.get("/skill-sky", (req, res) => {
  const db = readDB();
  const p = getProgress(db, req.studentUserId);
  res.json(skillSky(skillStats(db, p), cleanTarget(p.targetAccuracy), SKILL_LESSONS));
});

router.put("/settings", (req, res) => {
  const { targetScore, dailyGoal, currentScore, examDate, ieltsTarget, targetAccuracy } = req.body || {};
  const out = updateDB((db) => {
    const p = getProgress(db, req.studentUserId);
    if (targetScore !== undefined) p.targetScore = Math.max(400, Math.min(1600, Math.round(Number(targetScore) / 10) * 10 || 1400));
    if (dailyGoal !== undefined) p.dailyGoal = Math.max(10, Math.min(500, Number(dailyGoal) || 50));
    if (currentScore !== undefined) {
      const v = Math.round(Number(currentScore) / 10) * 10;
      p.currentScore = currentScore === null || currentScore === "" || !v ? null : Math.max(400, Math.min(1600, v));
    }
    if (examDate !== undefined) {
      const today = todayKey();
      const custom = CUSTOM_DAY.test(String(examDate || "")) && !Number.isNaN(Date.parse(`${examDate}T12:00:00Z`)) && examDate > today && dayDiff(examDate, today) <= MAX_DAYS_AHEAD;
      if (examDate !== null && examDate !== "" && !custom && !SAT_DATES.some((d) => d.iso === examDate)) return { error: "Choose a date after today and within the next two years.", code: 400 };
      p.examDate = examDate || null;
    }
    if (targetAccuracy !== undefined) p.targetAccuracy = cleanTarget(targetAccuracy);
    if (ieltsTarget !== undefined) p.ieltsTarget = Math.max(4, Math.min(9, Math.round(Number(ieltsTarget) * 2) / 2 || 7));
    return { targetScore: p.targetScore, dailyGoal: p.dailyGoal, currentScore: p.currentScore, examDate: p.examDate, ieltsTarget: p.ieltsTarget, targetAccuracy: cleanTarget(p.targetAccuracy) };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

// There is no route that marks a plan task done: tasks finish from the student's graded work only
// (weekPlan.js). The old tick and "complete" routes let a task be finished without doing it.

// ---------- Announcements (posted by teachers) ----------
// Teachers write to the classes: to all of them, or to the ones an announcement lists
// (`classIds`). A student outside a class has no teacher, and gets none.
router.get("/announcements", (req, res) => {
  const db = readDB();
  const cls = classOf(db, db.users.find((u) => u.id === req.studentUserId));
  if (!cls) return res.json({ announcements: [] });
  const list = db.announcements
    .filter((a) => !Array.isArray(a.classIds) || !a.classIds.length || a.classIds.includes(cls.id))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
  res.json({ announcements: list.slice(0, 5).map(({ classIds, ...a }) => ({ ...a, forClass: Array.isArray(classIds) && classIds.length > 0 })) });
});

export default router;
