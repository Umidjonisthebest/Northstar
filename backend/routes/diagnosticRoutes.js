// The SAT diagnostic test in the student hub (see diagnostic.js): start or
// resume the timed test, autosave answers, submit, and read the results.
// Mounted at /api/diagnostic.

import { Router } from "express";
import { nanoid } from "nanoid";
import { updateDB } from "../db.js";
import { requireStudent } from "../auth.js";
import { getProgress } from "../gamification.js";
import {
  MIN_QUESTIONS,
  buildDiagnostic,
  cancelDiagnostic,
  cleanAnswers,
  cleanFlags,
  completeDiagnostic,
  isOpen,
  limitSeconds,
  mergeTimes,
  publicSummary,
  questionFor,
  remainingSeconds,
  testQuestion
} from "../diagnostic.js";

const router = Router();
router.use(requireStudent);

const NOT_ENOUGH =
  "You've already practised almost every Reading & Writing question, so there aren't enough new ones for a fair diagnostic. Your score estimate comes from your practice instead.";

const mine = (db, req) => db.diagnostics.filter((d) => d.userId === req.studentUserId);
const findMine = (db, req) => mine(db, req).find((d) => d.id === req.params.id) || null;

// A test whose time ran out (plus the grace minute) is closed with its autosaved answers.
function settle(db, d, now = Date.now()) {
  return d.status === "in_progress" && !isOpen(d, now) ? completeDiagnostic(db, d, { auto: true, now }) : null;
}

function testPayload(db, d) {
  return {
    ...publicSummary(d),
    deadline: d.deadline,
    remainingSeconds: remainingSeconds(d),
    answers: d.answers || {},
    flags: d.flags || [],
    times: d.times || {},
    questions: d.items.map((it, i) => {
      const q = questionFor(db, it);
      if (q) return testQuestion(q, i + 1);
      // Deleted by a teacher after the test started: shown, but not scored.
      return { id: it.id, n: i + 1, section: it.section, type: it.type, missing: true, passage: "", prompt: "Your teacher removed this question. It won't count, so move on to the next one.", options: it.type === "grid_in" ? null : [] };
    })
  };
}

function resultPayload(db, d) {
  const outcome = new Map((d.outcome || []).map((o) => [o.id, o]));
  const inBank = new Set(db.practiceQuestions.map((q) => q.id));
  return {
    ...publicSummary(d),
    result: d.result || null,
    rows: d.items.map((it, i) => {
      const o = outcome.get(it.id) || {};
      return {
        n: i + 1,
        id: it.id,
        section: it.section,
        domain: it.domain,
        topic: it.topic,
        difficulty: it.difficulty,
        generated: Boolean(it.gen),
        answered: Boolean(o.answered),
        correct: Boolean(o.correct),
        missing: Boolean(o.missing),
        // Bank questions can be reopened in the practice player (with Nova) after the test.
        inBank: !it.gen && inBank.has(it.id)
      };
    })
  };
}

router.get("/", (req, res) => {
  const out = updateDB((db) => {
    const now = Date.now();
    for (const d of mine(db, req)) settle(db, d, now);
    const list = mine(db, req);
    const open = list.find((d) => d.status === "in_progress") || null;
    // What a new test would look like right now (nothing is saved).
    const next = open ? open.items : buildDiagnostic(db, getProgress(db, req.studentUserId), req.studentUserId);
    return {
      open: open ? { ...publicSummary(open), remainingSeconds: remainingSeconds(open, now), answered: Object.keys(open.answers || {}).length } : null,
      history: list
        .filter((d) => d.status !== "in_progress")
        .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
        .map(publicSummary),
      next: {
        questions: next.length,
        rw: next.filter((it) => it.section === "Reading & Writing").length,
        math: next.filter((it) => it.section === "Math").length,
        minutes: Math.round(limitSeconds(next) / 60)
      },
      canStart: Boolean(open) || next.length >= MIN_QUESTIONS,
      reason: open || next.length >= MIN_QUESTIONS ? null : NOT_ENOUGH
    };
  });
  res.json(out);
});

// Starts a new diagnostic, or returns the one already running.
router.post("/start", (req, res) => {
  const out = updateDB((db) => {
    const now = Date.now();
    for (const d of mine(db, req)) settle(db, d, now);
    let d = mine(db, req).find((x) => x.status === "in_progress");
    if (!d) {
      const items = buildDiagnostic(db, getProgress(db, req.studentUserId), req.studentUserId);
      if (items.length < MIN_QUESTIONS) return { status: 409, error: NOT_ENOUGH };
      const limit = limitSeconds(items);
      d = {
        id: nanoid(10),
        userId: req.studentUserId,
        status: "in_progress",
        items,
        answers: {},
        flags: [],
        times: {},
        startedAt: new Date(now).toISOString(),
        deadline: new Date(now + limit * 1000).toISOString(),
        limitSeconds: limit,
        submittedAt: null,
        result: null
      };
      db.diagnostics.push(d);
    }
    return { diagnostic: testPayload(db, d) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out);
});

router.get("/:id", (req, res) => {
  const out = updateDB((db) => {
    const d = findMine(db, req);
    if (!d) return { status: 404, error: "Diagnostic not found" };
    settle(db, d);
    return { diagnostic: d.status === "in_progress" ? testPayload(db, d) : resultPayload(db, d) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out);
});

router.put("/:id/answers", (req, res) => {
  const out = updateDB((db) => {
    const d = findMine(db, req);
    if (!d) return { status: 404, error: "Diagnostic not found" };
    if (d.status !== "in_progress") return { status: 409, code: "CLOSED", error: "This diagnostic is already finished" };
    if (!isOpen(d)) return { status: 409, code: "TIME_UP", error: "Time is up for this diagnostic" };
    d.answers = cleanAnswers(d, req.body?.answers);
    d.flags = cleanFlags(d, req.body?.flags);
    d.times = mergeTimes(d, req.body?.times);
    d.savedAt = new Date().toISOString();
    return { ok: true, remainingSeconds: remainingSeconds(d) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error, code: out.code });
  res.json(out);
});

// The test screen saw the student leave (another tab or window, the page closed): the diagnostic
// is cancelled, with no score. { kind }. A diagnostic that has already ended stays as it ended.
router.post("/:id/leave", (req, res) => {
  const out = updateDB((db) => {
    const d = findMine(db, req);
    if (!d) return { status: 404, error: "Diagnostic not found" };
    settle(db, d);
    cancelDiagnostic(d, req.body?.kind);
    return { diagnostic: publicSummary(d) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out);
});

// Idempotent: submitting a finished diagnostic returns its result again.
router.post("/:id/submit", (req, res) => {
  const out = updateDB((db) => {
    const d = findMine(db, req);
    if (!d) return { status: 404, error: "Diagnostic not found" };
    let reward = null;
    if (d.status === "in_progress") {
      const open = isOpen(d);
      if (open && req.body?.answers && typeof req.body.answers === "object") {
        d.answers = cleanAnswers(d, req.body.answers);
        d.flags = cleanFlags(d, req.body.flags);
        d.times = mergeTimes(d, req.body.times);
      }
      reward = completeDiagnostic(db, d, { auto: Boolean(req.body?.auto) || !open }).reward;
    }
    return { diagnostic: resultPayload(db, d), reward };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out);
});

export default router;
