import express from "express";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../../db.js";
import { requireStudent } from "../../auth.js";
import { award, getProgress, scoreIeltsEssay, scoreIeltsPart } from "../../gamification.js";
import { CHUNKS } from "../../shop.js";
import { isPending } from "../lib/diagnostic.js";
import { answersForPart, partNumberOf } from "../lib/practice.js";
import { rawToBand } from "../lib/scoring.js";
import {
  TEST_KINDS,
  attemptReview,
  checkWriting,
  findTest,
  gradeSection,
  liveTests,
  sectionContent,
  sectionCounts,
  sectionRecords,
  testAttemptsOf,
  testView
} from "../lib/practiceTests.js";

// IELTS practice tests in the student hub: a whole test taken alone, one section at a time, marked
// on submit (Listening, Reading) or checked automatically against a model answer (Writing).
// Mounted at /api/ielts/student/tests.
const router = express.Router();
router.use(requireStudent);

const MAX_STORED_ATTEMPTS = 25000;
const RESULTS_SHOWN = 60;
const NAME = { listening: "Listening", reading: "Reading", writing: "Writing" };
const IN_DIAGNOSTIC = "A part of this section is in your diagnostic test. Finish the diagnostic first, then take it here.";
const lockedRefIds = (db, userId) => new Set(db.ieltsDiagnostics.filter((d) => d.userId === userId && isPending(d)).map((d) => d.refId));

function kindParam(req, res) {
  const kind = req.params.kind;
  if (!TEST_KINDS.includes(kind)) {
    res.status(404).json({ error: "Unknown section" });
    return null;
  }
  return kind;
}

const publicAttempt = (a, title) => ({
  id: a.id,
  testId: a.testId,
  title,
  kind: a.kind,
  correct: a.correct ?? null,
  total: a.total ?? null,
  band: a.band ?? null,
  words: a.words ?? null,
  seconds: a.seconds ?? null,
  createdAt: a.createdAt
});

router.get("/", (req, res) => {
  const db = readDB();
  const mine = testAttemptsOf(db, req.studentUserId);
  const locked = lockedRefIds(db, req.studentUserId);
  const tests = liveTests(db)
    .map((t) => {
      const view = testView(db, t, mine);
      for (const kind of Object.keys(view.sections)) view.sections[kind].inDiagnostic = (t.parts?.[kind] || []).some((id) => locked.has(id));
      return view;
    })
    .filter((t) => t.of > 0);
  const titleOf = new Map(tests.map((t) => [t.id, t.title]));
  const estimates = tests.map((t) => t.estimate).filter((b) => b != null);
  res.json({
    tests,
    stats: {
      sections: mine.length,
      finished: tests.filter((t) => t.done === t.of).length,
      bestEstimate: estimates.length ? Math.max(...estimates) : null
    },
    // What finishing pays in comet chunks (shop.js), so the page's copy follows the rules.
    chunks: { section: CHUNKS.ieltsSection, whole: CHUNKS.ieltsTest },
    // Every finished section, newest first: the page's Results tab. (`recent` is its first eight.)
    results: mine
      .slice(-RESULTS_SHOWN)
      .reverse()
      .map((a) => publicAttempt(a, titleOf.get(a.testId) || a.title || "Practice test")),
    recent: mine
      .slice(-8)
      .reverse()
      .map((a) => publicAttempt(a, titleOf.get(a.testId) || a.title || "Practice test"))
  });
});

// A finished section again, with the student's answers, the marking and the key.
router.get("/attempts/:attemptId", (req, res) => {
  const db = readDB();
  const attempt = testAttemptsOf(db, req.studentUserId).find((a) => a.id === req.params.attemptId);
  if (!attempt) return res.status(404).json({ error: "This attempt isn't available" });
  const review = attemptReview(db, attempt);
  if (!review) return res.status(410).json({ error: "The material of this attempt has been removed" });
  const { records, answers } = review;
  const test = (db.ieltsPracticeTests || []).find((t) => t.id === attempt.testId);
  const head = { attempt: publicAttempt(attempt, test?.title || attempt.title || "Practice test"), test: { id: attempt.testId, title: test?.title || attempt.title || "Practice test" } };
  if (attempt.kind === "writing") return res.json({ ...head, section: sectionContent("writing", records), answers, essays: review.essays });
  const { rows, keys, perPart, correct, total, band } = review;
  res.json({
    ...head,
    section: sectionContent(attempt.kind, records),
    answers,
    correct,
    total,
    band,
    rows: rows.map(({ slotId, n, given, expected, correct: ok }) => ({ slotId, n, given, expected, correct: ok })),
    keys,
    parts: perPart.map(({ rows: _rows, ...p }) => p),
    transcripts: attempt.kind === "listening" ? Object.fromEntries(records.filter((r) => r.transcriptHtml).map((r) => [r.id, r.transcriptHtml])) : {}
  });
});

router.get("/:id/:kind", (req, res) => {
  const kind = kindParam(req, res);
  if (!kind) return;
  const db = readDB();
  const test = findTest(db, req.params.id);
  const records = test ? sectionRecords(db, test, kind) : [];
  if (!records.length) return res.status(404).json({ error: "This practice test section isn't available" });
  const locked = lockedRefIds(db, req.studentUserId);
  if (records.some((r) => locked.has(r.id))) return res.status(409).json({ error: IN_DIAGNOSTIC, code: "IN_DIAGNOSTIC" });
  const view = testView(db, test, testAttemptsOf(db, req.studentUserId));
  res.json({ test: { id: view.id, title: view.title, level: view.level }, progress: view.sections[kind], section: sectionContent(kind, records) });
});

router.post("/:id/:kind/submit", (req, res) => {
  const kind = kindParam(req, res);
  if (!kind) return;
  const answers = req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : {};
  const seconds = Math.max(0, Math.min(4 * 3600, Math.round(Number(req.body?.seconds) || 0)));
  const out = updateDB((db) => {
    const test = findTest(db, req.params.id);
    const records = test ? sectionRecords(db, test, kind) : [];
    if (!records.length) return { status: 404, error: "This practice test section isn't available" };
    const locked = lockedRefIds(db, req.studentUserId);
    if (records.some((r) => locked.has(r.id))) return { status: 409, error: IN_DIAGNOSTIC };
    db.ieltsPracticeAttempts = db.ieltsPracticeAttempts || [];
    db.ieltsTestAttempts = db.ieltsTestAttempts || [];
    const p = getProgress(db, req.studentUserId);
    const now = new Date().toISOString();
    const attemptId = nanoid(10);
    const earlierOf = (refId) => db.ieltsPracticeAttempts.filter((a) => a.userId === req.studentUserId && a.refId === refId);
    const base = (record) => ({
      id: nanoid(10),
      userId: req.studentUserId,
      kind,
      refId: record.id,
      title: record.title || "",
      number: partNumberOf(kind, record),
      seconds: Math.round(seconds / records.length),
      testAttemptId: attemptId,
      createdAt: now
    });

    // XP is paid part by part under the practice rules (gamification.js), so a section taken
    // again, or a part already done in section practice, only earns for what got better.
    let xp = 0;
    let result;
    const row = { id: attemptId, userId: req.studentUserId, testId: test.id, title: test.title || "", kind, seconds, createdAt: now };
    if (kind === "writing") {
      const essays = checkWriting(records, answers);
      for (const [i, e] of essays.entries()) {
        const earlier = earlierOf(e.refId);
        const longBefore = earlier.length ? earlier.some((a) => (a.words || 0) >= e.feedback.minWords) : null;
        db.ieltsPracticeAttempts.push({ ...base(records[i]), essay: e.essay, words: e.feedback.words });
        xp += scoreIeltsEssay(p, e.refId, records[i].level, e.feedback.words >= e.feedback.minWords, longBefore);
      }
      row.words = essays.reduce((n, e) => n + e.feedback.words, 0);
      result = { kind, essays: essays.map((e, i) => ({ ...e, modelAnswerHtml: records[i].modelAnswerHtml || null })), words: row.words };
    } else {
      const graded = gradeSection(kind, records, answers);
      for (const [i, part] of graded.perPart.entries()) {
        const earlier = earlierOf(part.refId);
        const bestBefore = earlier.length ? Math.max(...earlier.map((a) => a.correct || 0)) : null;
        db.ieltsPracticeAttempts.push({
          ...base(records[i]),
          correct: part.correct,
          total: part.total,
          band: rawToBand(kind, part.correct, part.total),
          answers: answersForPart(kind, records[i], answers)
        });
        xp += scoreIeltsPart(p, part.refId, records[i].level, part.correct, bestBefore);
      }
      Object.assign(row, { correct: graded.correct, total: graded.total, band: graded.band });
      result = {
        kind,
        correct: graded.correct,
        total: graded.total,
        band: graded.band,
        rows: graded.rows.map(({ slotId, n, given, expected, correct: ok }) => ({ slotId, n, given, expected, correct: ok })),
        keys: graded.keys,
        parts: graded.perPart.map(({ rows: _rows, ...part }) => part),
        transcripts: kind === "listening" ? Object.fromEntries(records.filter((r) => r.transcriptHtml).map((r) => [r.id, r.transcriptHtml])) : {}
      };
    }

    // Comet chunks: once per section of a test, and once more when the whole test is done.
    const paid = (p.ieltsTests[test.id] = p.ieltsTests[test.id] || []);
    const chunks = [];
    const bonus = { section: 0, whole: 0 };
    if (sectionCounts(kind, result) && !paid.includes(kind)) {
      paid.push(kind);
      bonus.section = CHUNKS.ieltsSection;
      chunks.push([CHUNKS.ieltsSection, `IELTS practice test: ${NAME[kind]}`]);
    }
    const kinds = TEST_KINDS.filter((k) => sectionRecords(db, test, k).length);
    if (!paid.includes("whole") && kinds.every((k) => paid.includes(k))) {
      paid.push("whole");
      bonus.whole = CHUNKS.ieltsTest;
      chunks.push([CHUNKS.ieltsTest, `Finished: ${test.title || "an IELTS practice test"}`]);
    }

    db.ieltsTestAttempts.push({ ...row, partAttemptIds: db.ieltsPracticeAttempts.filter((a) => a.testAttemptId === attemptId).map((a) => a.id) });
    if (db.ieltsPracticeAttempts.length > MAX_STORED_ATTEMPTS) db.ieltsPracticeAttempts.splice(0, db.ieltsPracticeAttempts.length - MAX_STORED_ATTEMPTS);
    if (db.ieltsTestAttempts.length > MAX_STORED_ATTEMPTS) db.ieltsTestAttempts.splice(0, db.ieltsTestAttempts.length - MAX_STORED_ATTEMPTS);
    const reward = award(p, xp, [], { chunks: chunks.length ? chunks : null });
    return { attemptId, ...result, bonus, reward, test: testView(db, test, testAttemptsOf(db, req.studentUserId)) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out);
});

export default router;
