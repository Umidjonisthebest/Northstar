// The daily Northstar question (see dailyStar.js). Mounted at /api/daily.
import { Router } from "express";
import { updateDB, readDB } from "../db.js";
import { requireStudent } from "../auth.js";
import { XP, award, getProgress, logAnswer, scorePracticeAnswer, settleRepair } from "../gamification.js";
import { CHUNKS } from "../shop.js";
import { isCorrectAnswer, questionMedia } from "../grading.js";
import { lockedQuestionIds } from "../diagnostic.js";
import { catalogFor, ensureDailyStar, shareText, starStats } from "../dailyStar.js";

const router = Router();
router.use(requireStudent);

// The question as the student sees it before answering: no answer, no explanation.
const starQuestion = (q) => ({
  id: q.id,
  type: q.type || "mcq",
  section: q.section,
  domain: q.domain || null,
  topic: q.topic,
  difficulty: q.difficulty,
  passage: q.passage || "",
  table: q.table || null,
  figure: q.figure || null,
  ...questionMedia(q),
  prompt: q.prompt,
  options: q.type === "grid_in" ? null : q.options
});

function payload(db, userId) {
  const star = ensureDailyStar(db);
  if (!star) return { available: false, reason: "The practice bank has no questions yet, so there's no star today." };
  const q = db.practiceQuestions.find((x) => x.id === star.questionId) || null;
  const mine = star.answers[userId] || null;
  const catalog = catalogFor(db, userId);
  const grid = q?.type === "grid_in";
  return {
    date: star.date,
    available: Boolean(q) || Boolean(mine),
    reason: q || mine ? null : "Today's question was withdrawn by a teacher. A new star rises tomorrow.",
    attempted: Boolean(mine),
    // The star's name is part of the discovery: it is only sent once the attempt is in.
    designation: mine ? star.designation : null,
    question: q ? starQuestion(q) : null,
    // The answer, the explanation and how everyone did come with the result, never before it.
    result: mine
      ? {
          correct: mine.correct,
          given: mine.given,
          correctIndex: q && !grid ? q.correctIndex : null,
          correctAnswer: q && grid ? q.correctAnswer : null,
          explanation: q?.explanation || "",
          explanationImage: q?.explanationImage || null,
          rationales: q?.rationales || null,
          ...starStats(star),
          share: shareText(star, mine, catalog.discovered)
        }
      : null,
    discovered: catalog.discovered,
    attemptedDays: catalog.attempted
  };
}

// Today's star. Opening it fixes the day's question for everyone.
router.get("/", (req, res) => res.json(updateDB((db) => payload(db, req.studentUserId))));

// The student's one attempt at today's question.
router.post("/answer", (req, res) => {
  const timeMs = Math.max(0, Math.min(3600000, Number(req.body?.timeMs) || 0));
  const out = updateDB((db) => {
    const userId = req.studentUserId;
    const star = ensureDailyStar(db);
    const q = star && db.practiceQuestions.find((x) => x.id === star.questionId);
    if (!q) return { status: 409, code: "UNAVAILABLE", error: "Today's question isn't available. A new star rises tomorrow." };
    if (star.answers[userId]) return { status: 409, code: "ALREADY_ANSWERED", error: "You've had today's try. A new star rises tomorrow." };
    const locked = lockedQuestionIds(db, userId);
    if (locked.has(q.id)) return { status: 409, code: "IN_DIAGNOSTIC", error: "Today's question is in your running diagnostic test. Finish the test first." };

    const raw = req.body?.answer;
    const grid = q.type === "grid_in";
    const given = grid ? String(raw ?? "").trim().slice(0, 12) : Number(raw);
    if (grid ? given === "" : raw === null || raw === undefined || raw === "" || !Number.isInteger(given) || given < 0 || given >= q.options.length) {
      return { status: 400, error: "Choose an answer first." };
    }

    const correct = isCorrectAnswer(q, given);
    star.answers[userId] = { correct, given, at: new Date().toISOString() };

    // Counted like a practice answer (XP by difficulty, the mistakes queue),
    // plus a small bonus for the discovery.
    const p = getProgress(db, userId);
    const assisted = p.revealed.includes(q.id);
    p.revealed = p.revealed.filter((id) => id !== q.id);
    const scored = scorePracticeAnswer(p, q, { correct, assisted });
    logAnswer(p, { q: q.id, at: p.answered[q.id].lastAt, ok: correct, ...(timeMs ? { ms: timeMs } : {}), ...(assisted ? { a: true } : {}), s: 1 });
    const reward = award(p, scored.xp + (correct ? XP.dailyStar : 0), correct ? [...scored.badges, "stargazer"] : scored.badges, {
      chunks: correct ? [CHUNKS.dailyStar, "Daily star discovered"] : null
    });
    // It may also be the last question of an open repair drill.
    if (p.repair?.ids.includes(q.id) && settleRepair(p, (id) => !locked.has(id) && db.practiceQuestions.some((x) => x.id === id)).state === "repaired") {
      reward.newBadges.push(...award(p, 0).newBadges);
    }
    return { ...payload(db, userId), reward };
  });
  if (out.error) return res.status(out.status).json({ error: out.error, code: out.code });
  res.json(out);
});

// "Discovered stars": every daily question the student has solved.
router.get("/catalog", (req, res) => res.json(catalogFor(readDB(), req.studentUserId)));

export default router;
