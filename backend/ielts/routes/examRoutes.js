import express from "express";
import { readDB, updateDB } from "../../db.js";
import { ieltsCandidateLimiter } from "../../rateLimit.js";
import { requireCandidate, signCandidateToken } from "../auth.js";
import { countSlots } from "../lib/questions.js";
import { CANCELLED_MESSAGE, cancelledView, lockRound, staleReport } from "../../examLock.js";
import {
  GRACE_MS,
  SECTIONS,
  buildSectionContent,
  cancelExam,
  ensureExam,
  finalizeIfExpired,
  hasAnyContent,
  partRecords,
  remainingSeconds,
  sectionDurationSeconds,
  startSection,
  submitSection
} from "../lib/exam.js";

const router = express.Router();

export const NO_ACTIVE_SESSION = "User has no active session with STARTED status";
const CANCELLED = { status: 409, code: "CANCELLED", error: CANCELLED_MESSAGE };

export function activeSessionFor(db, userId) {
  return (
    db.ieltsSessions
      .filter((s) => s.status === "started" && (s.participantIds || []).includes(userId))
      .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")))[0] || null
  );
}

// Creates (or resumes) the candidate's exam in a started session and issues the
// exam-scoped token. Shared by the candidate-ID login below and the Northstar
// student hub (routes/studentRoutes.js). `pickSession` runs inside the write.
export function openExam(user, pickSession) {
  const result = updateDB((db) => {
    const session = pickSession(db);
    if (!session) return { status: 409, error: NO_ACTIVE_SESSION };
    const exam = ensureExam(db, session, user.id);
    if (exam.cancelled) return CANCELLED;
    finalizeIfExpired(db, exam);
    if (!hasAnyContent(db, exam)) return { status: 409, error: "No test content is available for this session yet" };
    if (exam.step === "done") return { status: 409, error: "You have already completed this mock test" };
    return { session, exam };
  });
  if (result.error) return result;
  return {
    token: signCandidateToken({ userId: user.id, sessionId: result.session.id, examId: result.exam.id }),
    candidate: { id: user.id, candidateId: user.candidateId ?? null, firstName: user.firstName, lastName: user.lastName },
    session: { id: result.session.id, name: result.session.name }
  };
}

function loadContext(db, req) {
  const exam = db.ieltsExams.find((e) => e.id === req.candidate.examId);
  if (!exam || exam.userId !== req.candidate.userId) return { status: 401, error: "Your exam could not be found. Please log in again." };
  const session = db.ieltsSessions.find((s) => s.id === exam.sessionId);
  const user = db.users.find((u) => u.id === exam.userId);
  if (!session || !user) return { status: 401, error: "Your exam could not be found. Please log in again." };
  if (session.status !== "started") return { status: 409, code: "SESSION_CLOSED", error: "This session has been closed by the administrator." };
  // The candidate left the test page mid-section: nothing more until a teacher lets them back in.
  if (exam.cancelled) return CANCELLED;
  return { exam, session, user };
}

function sendError(res, ctx) {
  return res.status(ctx.status).json({ error: ctx.error, code: ctx.code });
}

function buildState(db, { exam, session, user }) {
  const sections = {};
  let totalSeconds = 0;
  for (const s of SECTIONS) {
    const state = exam.sections[s];
    const records = partRecords(db, exam, s);
    const partCount = records.length;
    const durationSeconds = partCount ? sectionDurationSeconds(db, exam, s) : 0;
    const questionCount = s === "writing" ? partCount : records.reduce((n, r) => n + countSlots(r.groups), 0);
    totalSeconds += durationSeconds;
    sections[s] = { status: state.status, partCount, questionCount, durationSeconds, remainingSeconds: remainingSeconds(state) };
  }
  return {
    candidate: { id: user.id, candidateId: user.candidateId ?? null, firstName: user.firstName, lastName: user.lastName },
    session: { id: session.id, name: session.name },
    step: exam.step,
    steps: SECTIONS.filter((s) => sections[s].partCount > 0),
    sections,
    totalSeconds,
    // Sent back with a leave report (see examLock.js).
    examId: exam.id,
    lockRound: lockRound(exam)
  };
}

function sectionPayload(db, exam, section) {
  const state = exam.sections[section];
  const content = buildSectionContent(db, exam, section);
  const durationSeconds = sectionDurationSeconds(db, exam, section);
  const remaining = remainingSeconds(state);
  return {
    section,
    status: state.status,
    durationSeconds,
    remainingSeconds: remaining,
    elapsedSeconds: remaining == null ? 0 : Math.max(0, durationSeconds - remaining),
    parts: content.parts,
    totalQuestions: content.totalQuestions,
    answers: state.answers || {},
    flags: state.flags || []
  };
}

function sanitizeAnswers(input, section) {
  const out = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  const maxLen = section === "writing" ? 30000 : 300;
  let count = 0;
  for (const [key, value] of Object.entries(input)) {
    if (++count > 600) break;
    const k = String(key).slice(0, 120);
    if (Array.isArray(value)) out[k] = value.slice(0, 10).map((x) => String(x).slice(0, 20));
    else if (value !== null && value !== undefined) out[k] = String(value).slice(0, maxLen);
  }
  return out;
}

function sanitizeFlags(input) {
  return Array.isArray(input) ? input.slice(0, 300).map((x) => String(x).slice(0, 120)) : [];
}

function withinTime(state) {
  return state.deadline && Date.now() <= Date.parse(state.deadline) + GRACE_MS;
}

// Exam-room login with the numeric candidate ID (Northstar's users[].candidateId).
router.post("/login", ieltsCandidateLimiter, (req, res) => {
  const raw = String(req.body?.candidateId ?? "").trim();
  if (!/^\d{1,12}$/.test(raw)) return res.status(400).json({ error: "Please enter a valid candidate ID" });
  const wanted = Number(raw);

  const db = readDB();
  const user = db.users.find((u) => u.role === "student" && u.candidateId != null && Number(u.candidateId) === wanted);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.status === "inactive") return res.status(403).json({ error: "This candidate account is inactive" });
  if (!activeSessionFor(db, user.id)) return res.status(409).json({ error: NO_ACTIVE_SESSION });

  const result = openExam(user, (data) => activeSessionFor(data, user.id));
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

router.get("/state", requireCandidate, (req, res) => {
  const out = updateDB((db) => {
    const ctx = loadContext(db, req);
    if (ctx.error) return ctx;
    finalizeIfExpired(db, ctx.exam);
    return { state: buildState(db, ctx) };
  });
  if (out.error) return sendError(res, out);
  res.json(out.state);
});

// The exam screen saw the candidate leave a running section (another tab or window, the page
// closed): the exam is cancelled. { kind, round }. Between sections there is nothing to cancel.
router.post("/leave", requireCandidate, (req, res) => {
  const out = updateDB((db) => {
    const exam = db.ieltsExams.find((e) => e.id === req.candidate.examId);
    if (!exam || exam.userId !== req.candidate.userId) return { status: 401, error: "Your exam could not be found. Please log in again." };
    if (exam.cancelled) return { cancelled: cancelledView(exam.cancelled) };
    if (staleReport(exam, req.body)) return { cancelled: null, stale: true };
    const session = db.ieltsSessions.find((s) => s.id === exam.sessionId);
    if (session?.status !== "started") return { cancelled: null };
    cancelExam(exam, req.body?.kind);
    return { cancelled: cancelledView(exam.cancelled) };
  });
  if (out.error) return sendError(res, out);
  res.json(out);
});

// Audio URLs only, so the browser can download the listening audio before the clock starts.
router.get("/section/listening/preload", requireCandidate, (req, res) => {
  const db = readDB();
  const ctx = loadContext(db, req);
  if (ctx.error) return sendError(res, ctx);
  if (ctx.exam.step !== "listening") return res.status(409).json({ error: "Listening is not the current section" });
  const parts = partRecords(db, ctx.exam, "listening").map((p, i) => ({
    partNumber: i + 1,
    audioUrl: p.audio?.url || null,
    durationSeconds: Math.round((Number(p.durationMinutes) || 0) * 60)
  }));
  res.json({ parts });
});

router.post("/section/:name/start", requireCandidate, (req, res) => {
  const section = req.params.name;
  if (!SECTIONS.includes(section)) return res.status(404).json({ error: "Unknown section" });
  const out = updateDB((db) => {
    const ctx = loadContext(db, req);
    if (ctx.error) return ctx;
    finalizeIfExpired(db, ctx.exam);
    if (ctx.exam.step !== section) return { status: 409, code: "WRONG_STEP", error: "This section is not available right now" };
    startSection(db, ctx.exam, section);
    return { payload: sectionPayload(db, ctx.exam, section) };
  });
  if (out.error) return sendError(res, out);
  res.json(out.payload);
});

router.get("/section/:name", requireCandidate, (req, res) => {
  const section = req.params.name;
  if (!SECTIONS.includes(section)) return res.status(404).json({ error: "Unknown section" });
  const out = updateDB((db) => {
    const ctx = loadContext(db, req);
    if (ctx.error) return ctx;
    finalizeIfExpired(db, ctx.exam);
    if (ctx.exam.step !== section || ctx.exam.sections[section].status !== "in_progress") {
      return { status: 409, code: "WRONG_STEP", error: "This section is not in progress" };
    }
    return { payload: sectionPayload(db, ctx.exam, section) };
  });
  if (out.error) return sendError(res, out);
  res.json(out.payload);
});

router.put("/section/:name/answers", requireCandidate, (req, res) => {
  const section = req.params.name;
  if (!SECTIONS.includes(section)) return res.status(404).json({ error: "Unknown section" });
  const answers = sanitizeAnswers(req.body?.answers, section);
  const flags = sanitizeFlags(req.body?.flags);
  const out = updateDB((db) => {
    const ctx = loadContext(db, req);
    if (ctx.error) return ctx;
    const state = ctx.exam.sections[section];
    if (ctx.exam.step !== section || state.status !== "in_progress") return { status: 409, code: "WRONG_STEP", error: "This section is not in progress" };
    if (!withinTime(state)) return { status: 409, code: "TIME_UP", error: "Time is up for this section" };
    state.answers = answers;
    state.flags = flags;
    state.savedAt = new Date().toISOString();
    return { remainingSeconds: remainingSeconds(state) };
  });
  if (out.error) return sendError(res, out);
  res.json({ ok: true, remainingSeconds: out.remainingSeconds });
});

router.post("/section/:name/submit", requireCandidate, (req, res) => {
  const section = req.params.name;
  if (!SECTIONS.includes(section)) return res.status(404).json({ error: "Unknown section" });
  const hasAnswers = req.body && typeof req.body.answers === "object" && req.body.answers !== null;
  const answers = sanitizeAnswers(req.body?.answers, section);
  const flags = sanitizeFlags(req.body?.flags);
  const out = updateDB((db) => {
    const ctx = loadContext(db, req);
    if (ctx.error) return ctx;
    const state = ctx.exam.sections[section];
    if (state.status !== "submitted") {
      if (ctx.exam.step !== section || state.status !== "in_progress") return { status: 409, code: "WRONG_STEP", error: "This section is not in progress" };
      if (hasAnswers && withinTime(state)) {
        state.answers = answers;
        state.flags = flags;
      }
      submitSection(db, ctx.exam, section, { auto: Boolean(req.body?.auto) });
    }
    return { state: buildState(db, ctx) };
  });
  if (out.error) return sendError(res, out);
  res.json(out.state);
});

export default router;
