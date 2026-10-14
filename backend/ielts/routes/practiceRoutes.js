import express from "express";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../../db.js";
import { requireStudent } from "../../auth.js";
import { award, getProgress, scoreIeltsEssay, scoreIeltsPart } from "../../gamification.js";
import { rawToBand } from "../lib/scoring.js";
import { isPending } from "../lib/diagnostic.js";
import {
  PRACTICE_KINDS,
  answersForPart,
  findPracticeRecord,
  gradePractice,
  partNumberOf,
  practicePart,
  practiceRecords,
  summarizeItem,
  writingFeedback
} from "../lib/practice.js";

// IELTS Practice in the student hub: single parts taken on the student's own,
// marked instantly (listening, reading) or checked automatically with a model
// answer to compare against (writing). Mounted at /api/ielts/student/practice.
const router = express.Router();
router.use(requireStudent);

const MAX_STORED_ATTEMPTS = 25000;

function kindParam(req, res) {
  const kind = req.params.kind;
  if (!PRACTICE_KINDS[kind]) {
    res.status(404).json({ error: "Unknown practice type" });
    return null;
  }
  return kind;
}

// Section practice's own attempts. A section of a practice test also stores a row for each of its
// parts in the same collection (with `testAttemptId`): those belong to the test, not to this page.
const attemptsOf = (db, userId) => (db.ieltsPracticeAttempts || []).filter((a) => a.userId === userId && !a.testAttemptId);

// Parts waiting in the student's diagnostic test stay closed in practice until
// the diagnostic is finished, so its result stays fair.
const IN_DIAGNOSTIC = "This part is in your diagnostic test. Finish the diagnostic first, then practise it here.";
const lockedRefIds = (db, userId) => new Set(db.ieltsDiagnostics.filter((d) => d.userId === userId && isPending(d)).map((d) => d.refId));

// Band estimate per skill from each item's best attempt (needs a few answers to mean much).
function bandEstimate(db, kind, attempts) {
  let correct = 0;
  let total = 0;
  for (const record of practiceRecords(db, kind)) {
    const mine = attempts.filter((a) => a.refId === record.id && a.total);
    if (!mine.length) continue;
    const best = mine.reduce((b, a) => (a.correct / a.total > b.correct / b.total ? a : b));
    correct += best.correct;
    total += best.total;
  }
  return total ? { band: rawToBand(kind, correct, total), correct, total } : null;
}

const publicAttempt = (a) => ({
  id: a.id,
  kind: a.kind,
  refId: a.refId,
  title: a.title,
  number: a.number,
  correct: a.correct ?? null,
  total: a.total ?? null,
  band: a.band ?? null,
  words: a.words ?? null,
  seconds: a.seconds ?? null,
  createdAt: a.createdAt
});

router.get("/", (req, res) => {
  const db = readDB();
  const locked = lockedRefIds(db, req.studentUserId);
  const out = {};
  const here = new Set();
  for (const kind of Object.keys(PRACTICE_KINDS)) for (const r of practiceRecords(db, kind)) here.add(r.id);
  // Only what is still in section practice: a part that has since gone (deleted, or handed to a
  // practice test) has no page here to open.
  const mine = attemptsOf(db, req.studentUserId).filter((a) => here.has(a.refId));
  for (const kind of Object.keys(PRACTICE_KINDS)) {
    out[kind] = practiceRecords(db, kind).map((r) => ({
      ...summarizeItem(kind, r, mine.filter((a) => a.kind === kind)),
      inDiagnostic: locked.has(r.id)
    }));
  }
  res.json({
    ...out,
    stats: {
      attempts: mine.length,
      listening: bandEstimate(db, "listening", mine),
      reading: bandEstimate(db, "reading", mine),
      essays: mine.filter((a) => a.kind === "writing").length
    },
    recent: mine.slice(-8).reverse().map(publicAttempt)
  });
});

router.get("/:kind/:id", (req, res) => {
  const kind = kindParam(req, res);
  if (!kind) return;
  const db = readDB();
  const record = findPracticeRecord(db, kind, req.params.id);
  if (!record) return res.status(404).json({ error: "This practice item isn't available" });
  if (lockedRefIds(db, req.studentUserId).has(record.id)) return res.status(409).json({ error: IN_DIAGNOSTIC, code: "IN_DIAGNOSTIC" });
  const mine = attemptsOf(db, req.studentUserId).filter((a) => a.kind === kind);
  res.json({ item: summarizeItem(kind, record, mine), part: practicePart(kind, record) });
});

router.post("/:kind/:id/submit", (req, res) => {
  const kind = kindParam(req, res);
  if (!kind) return;
  const answers = req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : {};
  const seconds = Math.max(0, Math.min(4 * 3600, Math.round(Number(req.body?.seconds) || 0)));
  const out = updateDB((db) => {
    const record = findPracticeRecord(db, kind, req.params.id);
    if (!record) return { status: 404, error: "This practice item isn't available" };
    if (lockedRefIds(db, req.studentUserId).has(record.id)) return { status: 409, error: IN_DIAGNOSTIC };
    db.ieltsPracticeAttempts = db.ieltsPracticeAttempts || [];
    const p = getProgress(db, req.studentUserId);
    const base = {
      id: nanoid(10),
      userId: req.studentUserId,
      kind,
      refId: record.id,
      title: record.title || "",
      number: partNumberOf(kind, record),
      seconds,
      createdAt: new Date().toISOString()
    };

    // Earlier attempts at this part: a repeat only earns XP for doing better
    // (see scoreIeltsPart / scoreIeltsEssay in gamification.js).
    const earlier = attemptsOf(db, req.studentUserId).filter((a) => a.refId === record.id);

    let result;
    if (kind === "writing") {
      const task = partNumberOf(kind, record) === 2 ? 2 : 1;
      const essay = String(answers[record.id] ?? "").slice(0, 20000);
      const feedback = writingFeedback(task, essay);
      const longBefore = earlier.length ? earlier.some((a) => (a.words || 0) >= feedback.minWords) : null;
      db.ieltsPracticeAttempts.push({ ...base, essay, words: feedback.words });
      const reward = award(p, scoreIeltsEssay(p, record.id, record.level, feedback.words >= feedback.minWords, longBefore));
      result = { attemptId: base.id, feedback, modelAnswerHtml: record.modelAnswerHtml || null, reward };
    } else {
      const { rows, correct, total, band, keys } = gradePractice(kind, record, answers);
      const bestBefore = earlier.length ? Math.max(...earlier.map((a) => a.correct || 0)) : null;
      db.ieltsPracticeAttempts.push({ ...base, correct, total, band, answers: answersForPart(kind, record, answers) });
      const reward = award(p, scoreIeltsPart(p, record.id, record.level, correct, bestBefore));
      result = {
        attemptId: base.id,
        correct,
        total,
        band,
        rows: rows.map(({ slotId, n, given, expected, correct: ok }) => ({ slotId, n, given, expected, correct: ok })),
        keys,
        transcriptHtml: kind === "listening" ? record.transcriptHtml || null : null,
        reward
      };
    }
    if (db.ieltsPracticeAttempts.length > MAX_STORED_ATTEMPTS) db.ieltsPracticeAttempts.splice(0, db.ieltsPracticeAttempts.length - MAX_STORED_ATTEMPTS);
    return result;
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out);
});

export default router;
