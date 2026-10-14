import express from "express";
import { updateDB } from "../../db.js";
import { requireStudent } from "../../auth.js";
import { answersForPart } from "../lib/practice.js";
import {
  beginDiagnostic,
  cancelDiagnostic,
  completeDiagnostic,
  createDiagnostic,
  diagnosticPayload,
  freshParts,
  isOpen,
  publicSummary,
  recordOf,
  remainingSeconds
} from "../lib/diagnostic.js";

// The IELTS diagnostic test in the student hub (see lib/diagnostic.js). Mounted
// at /api/ielts/student/diagnostic.
const router = express.Router();
router.use(requireStudent);

const NONE_LEFT = "You've already tried every listening part and reading passage, so there's nothing new for a diagnostic. Your teacher can share more practice material.";

const mine = (db, req) => db.ieltsDiagnostics.filter((d) => d.userId === req.studentUserId);
const findMine = (db, req) => mine(db, req).find((d) => d.id === req.params.id) || null;

function settle(db, d, now = Date.now()) {
  return d.status === "in_progress" && !isOpen(d, now) ? completeDiagnostic(db, d, { auto: true, now }) : null;
}

// Only this part's answers, with the same size limits as the exam room.
function cleanAnswers(db, d, input) {
  const record = recordOf(db, d);
  if (!record || !input || typeof input !== "object" || Array.isArray(input)) return {};
  const out = {};
  for (const [key, value] of Object.entries(answersForPart(d.kind, record, input))) {
    if (Array.isArray(value)) out[key] = value.slice(0, 10).map((x) => String(x).slice(0, 20));
    else if (value !== null && value !== undefined && value !== "") out[key] = String(value).slice(0, 300);
  }
  return out;
}
const cleanFlags = (input) => (Array.isArray(input) ? input.slice(0, 100).map((x) => String(x).slice(0, 120)) : []);

router.get("/", (req, res) => {
  const out = updateDB((db) => {
    const now = Date.now();
    for (const d of mine(db, req)) settle(db, d, now);
    const list = mine(db, req);
    const open = list.find((d) => d.status === "created" || d.status === "in_progress") || null;
    const fresh = freshParts(db, req.studentUserId);
    return {
      open: open ? publicSummary(open, now) : null,
      history: list
        .filter((d) => d.status === "completed" || d.status === "expired" || d.status === "cancelled")
        .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
        .map((d) => publicSummary(d, now)),
      available: { listening: fresh.listening.length, reading: fresh.reading.length },
      canStart: Boolean(open) || fresh.listening.length + fresh.reading.length > 0,
      reason: open || fresh.listening.length + fresh.reading.length > 0 ? null : NONE_LEFT
    };
  });
  res.json(out);
});

// Picks a random new part, or returns the diagnostic already assigned.
router.post("/start", (req, res) => {
  const out = updateDB((db) => {
    const now = Date.now();
    for (const d of mine(db, req)) settle(db, d, now);
    const d = mine(db, req).find((x) => x.status === "created" || x.status === "in_progress") || createDiagnostic(db, req.studentUserId);
    if (!d) return { status: 409, error: NONE_LEFT };
    return { diagnostic: publicSummary(d, now) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out);
});

router.get("/:id", (req, res) => {
  const out = updateDB((db) => {
    const d = findMine(db, req);
    if (!d) return { status: 404, error: "Diagnostic not found" };
    settle(db, d);
    return diagnosticPayload(db, d);
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out);
});

// Starts the clock (idempotent while the test is running).
router.post("/:id/begin", (req, res) => {
  const out = updateDB((db) => {
    const d = findMine(db, req);
    if (!d) return { status: 404, error: "Diagnostic not found" };
    settle(db, d);
    if (d.status === "created") {
      if (!recordOf(db, d)) return { status: 409, error: "This part is no longer available. Go back and start a new diagnostic." };
      beginDiagnostic(db, d);
    }
    if (d.status !== "in_progress") return { status: 409, code: "CLOSED", error: "This diagnostic is already finished" };
    return diagnosticPayload(db, d);
  });
  if (out.error) return res.status(out.status).json({ error: out.error, code: out.code });
  res.json(out);
});

router.put("/:id/answers", (req, res) => {
  const out = updateDB((db) => {
    const d = findMine(db, req);
    if (!d) return { status: 404, error: "Diagnostic not found" };
    if (d.status !== "in_progress") return { status: 409, code: "CLOSED", error: "This diagnostic is not running" };
    if (!isOpen(d)) return { status: 409, code: "TIME_UP", error: "Time is up for this diagnostic" };
    d.answers = cleanAnswers(db, d, req.body?.answers);
    d.flags = cleanFlags(req.body?.flags);
    d.savedAt = new Date().toISOString();
    return { ok: true, remainingSeconds: remainingSeconds(d) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error, code: out.code });
  res.json(out);
});

// The test screen saw the student leave (another tab or window, the page closed): the diagnostic
// is cancelled, with no band. { kind }. One that hasn't started or has already ended is left alone.
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

// Idempotent: a marked diagnostic just returns its review again.
router.post("/:id/submit", (req, res) => {
  const out = updateDB((db) => {
    const d = findMine(db, req);
    if (!d) return { status: 404, error: "Diagnostic not found" };
    if (d.status === "created") return { status: 409, error: "This diagnostic hasn't started yet" };
    let reward = null;
    if (d.status === "in_progress") {
      const open = isOpen(d);
      if (open && req.body?.answers && typeof req.body.answers === "object") {
        d.answers = cleanAnswers(db, d, req.body.answers);
        d.flags = cleanFlags(req.body.flags);
      }
      reward = completeDiagnostic(db, d, { auto: Boolean(req.body?.auto) || !open }).reward;
    }
    return { ...diagnosticPayload(db, d), reward };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out);
});

export default router;
