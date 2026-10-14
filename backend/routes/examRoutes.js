import { Router } from "express";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../db.js";
import { requireStudent } from "../auth.js";
import { isExamAnswerCorrect, liveModules, moduleHasCalculator } from "../grading.js";
import { award, examModuleXp, getProgress, queueExamReward } from "../gamification.js";
import { CANCELLED_MESSAGE, cancellation, cancelledView, lockRound, staleReport } from "../examLock.js";

const router = Router();
router.use(requireStudent);

// A student who left the test page mid-module (examLock.js) has had the whole sitting cancelled:
// nothing more can be opened, saved or handed in until a teacher lets them back in.
const CANCELLED = { status: 409, code: "CANCELLED", error: CANCELLED_MESSAGE };

// The module's clock runs on the server: it started when the student first opened the module
// (`attempt.startedAt`) and ends `timeLimitMinutes` later. The exam screen hands in at zero, a
// moment later because of the network, so the server allows this many seconds of slack for the
// final save and hand-in. After that:
//  - autosaves are refused (409 TIME_UP), and
//  - a hand-in is graded on the answers that were autosaved in time, not on the ones in the
//    request (a hand-made request can't keep answering past the buzzer), and is flagged for the
//    teacher as `overtimeSeconds`.
export const DEADLINE_GRACE_SECONDS = 30;

const allowedSeconds = (mod) => mod.timeLimitMinutes * 60;
const elapsedSeconds = (attempt, now = Date.now()) => Math.max(0, Math.round((now - Date.parse(attempt.startedAt)) / 1000));
export const pastDeadline = (attempt, mod, now = Date.now()) => elapsedSeconds(attempt, now) > allowedSeconds(mod) + DEADLINE_GRACE_SECONDS;

function findParticipant(db, sessionId, userId) {
  return db.participants.find((p) => p.sessionId === sessionId && p.userId === userId);
}

// What the student sent as answers, reduced to what the exam screen can produce for this module:
// a choice index for multiple choice and a short string for a grid-in. Anything else (other
// modules' question ids, objects, enormous strings) is dropped, so a hand-made request can't bloat
// the stored attempt or confuse the review screens that read it back.
export function cleanAnswers(mod, input) {
  const out = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const q of mod.questions) {
    const v = input[q.id];
    if (q.type === "mcq") {
      if (Number.isInteger(v) && v >= 0 && v < (q.options?.length || 0)) out[q.id] = v;
    } else if (typeof v === "string" || typeof v === "number") {
      const s = String(v).trim().slice(0, 40);
      if (s) out[q.id] = s;
    }
  }
  return out;
}

// ---------- Ghost run ----------
// Attempts keep per-question timestamps: for each question, the second of the
// module (from its start) at which it was first opened and last answered. They
// come from the exam screen with the submission, so they are tidied here: only
// this module's questions, whole seconds, and nothing after the attempt ended.
export function cleanTimestamps(mod, input, seconds) {
  const out = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  const limit = Math.max(0, Math.round(seconds));
  const second = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 && v !== null && v !== "" ? Math.min(limit, Math.round(Number(v))) : null);
  for (const q of mod.questions) {
    const t = input[q.id];
    if (!t || typeof t !== "object") continue;
    const seen = second(t.seen);
    const answered = second(t.answered);
    if (seen === null && answered === null) continue;
    out[q.id] = { ...(seen === null ? {} : { seen }), ...(answered === null ? {} : { answered }) };
  }
  return out;
}

// The student's previous attempt at the same module of the same test, in an
// earlier session, as a pacing line: which question they had reached at each
// second. Null when there is none (or it was taken before timestamps were
// kept). It carries question numbers and seconds only, never answers.
export function ghostFor(db, userId, session, mod) {
  const mine = new Set(db.participants.filter((p) => p.userId === userId).map((p) => p.id));
  const previous = db.attempts
    .filter((a) => a.moduleId === mod.id && a.sessionId !== session.id && a.submittedAt && mine.has(a.participantId) && a.timestamps && Object.keys(a.timestamps).length)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
  if (!previous) return null;
  const marks = mod.questions
    .filter((q) => previous.timestamps[q.id]?.seen !== undefined)
    .map((q) => ({ n: q.order, t: previous.timestamps[q.id].seen }))
    .sort((a, b) => a.t - b.t || a.n - b.n);
  if (!marks.length) return null;
  const seconds = previous.seconds ?? Math.round((Date.parse(previous.submittedAt) - Date.parse(previous.startedAt)) / 1000);
  return { takenAt: previous.submittedAt, seconds, marks };
}

// Module list + status for one session this student belongs to.
router.get("/session/:sessionId/overview", (req, res) => {
  const db = readDB();
  const session = db.sessions.find((s) => s.id === req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const participant = findParticipant(db, session.id, req.studentUserId);
  if (!participant) return res.status(403).json({ error: "You are not part of this session" });
  if (session.status !== "started") {
    return res.status(403).json({ error: "This session hasn't been started by your admin yet." });
  }

  // The teacher can delete a test that a session still points at.
  const test = db.tests.find((t) => t.id === session.testId);
  if (!test) return res.status(404).json({ error: "This session's test is no longer available. Please ask your teacher." });
  const modules = liveModules(test).map((m) => {
    const attempt = db.attempts.find((a) => a.participantId === participant.id && a.moduleId === m.id);
    return {
      id: m.id,
      name: m.name,
      order: m.order,
      timeLimitMinutes: m.timeLimitMinutes,
      questionCount: m.questions.length,
      status: attempt ? (attempt.submittedAt ? "completed" : "in_progress") : "not_started",
      raw: attempt?.raw ?? null
    };
  });

  res.json({ sessionName: session.name, testTitle: test.title, modules, cancelled: cancelledView(participant.cancelled), lockRound: lockRound(participant) });
});

// The exam screen saw the student leave a running module (another tab or window, the page closed):
// the sitting is cancelled. { kind, round }. Nothing is marked; the answers autosaved so far stay
// with the attempt for the teacher. Outside a running module there is nothing to cancel.
router.post("/session/:sessionId/leave", (req, res) => {
  const out = updateDB((db) => {
    const session = db.sessions.find((s) => s.id === req.params.sessionId);
    if (!session) return { status: 404, error: "Session not found" };
    const participant = findParticipant(db, session.id, req.studentUserId);
    if (!participant) return { status: 403, error: "You are not part of this session" };
    if (participant.cancelled) return { cancelled: cancelledView(participant.cancelled) };
    if (staleReport(participant, req.body)) return { cancelled: null, stale: true };
    const running = db.attempts.find((a) => a.participantId === participant.id && !a.submittedAt);
    if (!running || session.status !== "started") return { cancelled: null };
    participant.cancelled = cancellation(req.body?.kind, { moduleId: running.moduleId });
    return { cancelled: cancelledView(participant.cancelled) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out);
});

// Fetch a module's questions (answers stripped), starting the timer on first load.
router.get("/session/:sessionId/modules/:moduleId", (req, res) => {
  const db = readDB();
  const session = db.sessions.find((s) => s.id === req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const participant = findParticipant(db, session.id, req.studentUserId);
  if (!participant) return res.status(403).json({ error: "You are not part of this session" });
  if (session.status !== "started") return res.status(403).json({ error: "Session not started yet" });
  if (participant.cancelled) return res.status(CANCELLED.status).json({ error: CANCELLED.error, code: CANCELLED.code });

  const test = db.tests.find((t) => t.id === session.testId);
  if (!test) return res.status(404).json({ error: "This session's test is no longer available. Please ask your teacher." });
  const mod = test.modules.find((m) => m.id === req.params.moduleId);
  if (!mod) return res.status(404).json({ error: "Module not found" });
  // Before the clock starts: there is nothing to sit, and an attempt would only run its timer down.
  if (!mod.questions.length) return res.status(409).json({ error: "This module has no questions yet. Please ask your teacher." });

  let attempt = db.attempts.find((a) => a.participantId === participant.id && a.moduleId === mod.id);
  if (attempt?.submittedAt) {
    return res.status(400).json({ error: "This module has already been submitted." });
  }

  if (!attempt) {
    attempt = updateDB((db2) => {
      const a = {
        id: nanoid(10),
        participantId: participant.id,
        sessionId: session.id,
        moduleId: mod.id,
        answers: {},
        startedAt: new Date().toISOString(),
        submittedAt: null,
        raw: null
      };
      db2.attempts.push(a);
      return a;
    });
  }

  const elapsedSeconds = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
  const remainingSeconds = Math.max(0, mod.timeLimitMinutes * 60 - elapsedSeconds);

  const questions = mod.questions
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((q) => ({
      id: q.id,
      order: q.order,
      type: q.type,
      prompt: q.prompt,
      passage: q.passage,
      // Pictures the teacher attached (graphs, figures). Without these a question that depends on
      // its figure can't be answered.
      passageImage: q.passageImage || null,
      promptImage: q.promptImage || null,
      options: q.options || null
    }));

  // Pacing from the last time this student took this test, if they did. The
  // exam screen keeps it hidden unless the student asks for it.
  const ghost = ghostFor(db, req.studentUserId, session, mod);
  // `savedAnswers` is what the server holds from autosave, so a reload (or a second device) picks up where
  // the student was even if the browser's own copy is gone.
  res.json({
    moduleId: mod.id,
    name: mod.name,
    timeLimitMinutes: mod.timeLimitMinutes,
    // Math modules come with the graphing calculator (see moduleHasCalculator).
    calculator: moduleHasCalculator(mod),
    remainingSeconds,
    questions,
    ghost,
    savedAnswers: cleanAnswers(mod, attempt.answers),
    // Sent back with a leave report (see examLock.js).
    lockRound: lockRound(participant)
  });
});

// Autosave: the exam screen sends the answers on screen every few seconds. They replace the stored
// copy (so clearing an answer sticks) and are what a late hand-in is graded on. Nothing is graded here.
router.put("/session/:sessionId/modules/:moduleId/answers", (req, res) => {
  const out = updateDB((db) => {
    const session = db.sessions.find((s) => s.id === req.params.sessionId);
    if (!session) return { status: 404, error: "Session not found" };
    const participant = findParticipant(db, session.id, req.studentUserId);
    if (!participant) return { status: 403, error: "You are not part of this session" };
    if (session.status !== "started") return { status: 403, error: "Session not started yet" };
    if (participant.cancelled) return CANCELLED;
    const test = db.tests.find((t) => t.id === session.testId);
    if (!test) return { status: 404, error: "This session's test is no longer available. Please ask your teacher." };
    const mod = test.modules.find((m) => m.id === req.params.moduleId);
    if (!mod) return { status: 404, error: "Module not found" };
    const attempt = db.attempts.find((a) => a.participantId === participant.id && a.moduleId === mod.id);
    if (!attempt) return { status: 409, code: "NOT_STARTED", error: "Open the module before saving answers" };
    if (attempt.submittedAt) return { status: 409, code: "CLOSED", error: "This module has already been submitted." };
    if (pastDeadline(attempt, mod)) return { status: 409, code: "TIME_UP", error: "Time is up for this module." };

    attempt.answers = cleanAnswers(mod, req.body?.answers);
    attempt.savedAt = new Date().toISOString();
    return { saved: Object.keys(attempt.answers).length, remainingSeconds: Math.max(0, allowedSeconds(mod) - elapsedSeconds(attempt)) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error, code: out.code });
  res.json(out);
});

// Submit a module's answers -> grade immediately.
router.post("/session/:sessionId/modules/:moduleId/submit", (req, res) => {
  const db = readDB();
  const session = db.sessions.find((s) => s.id === req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const participant = findParticipant(db, session.id, req.studentUserId);
  if (!participant) return res.status(403).json({ error: "You are not part of this session" });
  if (session.status !== "started") return res.status(403).json({ error: "Session not started yet" });
  if (participant.cancelled) return res.status(CANCELLED.status).json({ error: CANCELLED.error, code: CANCELLED.code });

  const test = db.tests.find((t) => t.id === session.testId);
  if (!test) return res.status(404).json({ error: "This session's test is no longer available. Please ask your teacher." });
  const mod = test.modules.find((m) => m.id === req.params.moduleId);
  if (!mod) return res.status(404).json({ error: "Module not found" });
  // Nothing was sat, so nothing can be handed in (it would also pay out XP for no questions).
  if (!mod.questions.length) return res.status(409).json({ error: "This module has no questions yet." });

  const existing = db.attempts.find((a) => a.participantId === participant.id && a.moduleId === mod.id);
  if (existing?.submittedAt) return res.status(400).json({ error: "Already submitted" });

  // Marked with the one shared rule (grading.js), the same one the review screens use, so the
  // score handed back here is the score the student and teacher see afterwards.
  // On time (including the slack for the network): the answers in the request. Late: only what was
  // autosaved before the clock ran out, so nothing can be answered after the buzzer.
  const late = existing ? pastDeadline(existing, mod) : false;
  const answers = late ? cleanAnswers(mod, existing.answers) : cleanAnswers(mod, req.body?.answers);
  let raw = 0;
  const wrongQuestions = [];
  for (const q of mod.questions) {
    const given = answers[q.id];
    if (isExamAnswerCorrect(q, given)) raw++;
    else wrongQuestions.push({ q, given });
  }

  const attempt = updateDB((db2) => {
    let a = db2.attempts.find((a) => a.participantId === participant.id && a.moduleId === mod.id);
    if (!a) {
      a = { id: nanoid(10), participantId: participant.id, sessionId: session.id, moduleId: mod.id, startedAt: new Date().toISOString() };
      db2.attempts.push(a);
    }
    a.answers = answers;
    a.submittedAt = new Date().toISOString();
    a.raw = raw;
    a.max = mod.questions.length;
    // How long the module took, and when each question was opened and answered
    // (seconds from the start). A later attempt at the same test can be paced against these.
    const elapsed = elapsedSeconds(a, Date.parse(a.submittedAt));
    const allowed = allowedSeconds(mod);
    a.seconds = Math.min(allowed, elapsed);
    // Handed in after the deadline: graded on the autosaved answers only (above), and shown to the teacher.
    if (late) a.overtimeSeconds = elapsed - allowed;
    else delete a.overtimeSeconds;
    a.timestamps = cleanTimestamps(mod, req.body?.timestamps, a.seconds);

    // Mock exams feed the same XP / streak / badge system as practice.
    const p = getProgress(db2, req.studentUserId);

    // Every wrong answer joins the same Mistakes queue practice mistakes use,
    // so a miss on a mock exam is just as reviewable as a miss on a drill.
    for (const { q, given } of wrongQuestions) {
      const key = `${mod.id}:${q.id}`;
      const entry = {
        key,
        source: "exam",
        testTitle: test.title,
        moduleId: mod.id,
        moduleName: mod.name,
        questionId: q.id,
        type: q.type,
        prompt: q.prompt,
        passage: q.passage || "",
        options: q.options || null,
        correctIndex: q.type === "mcq" ? q.correctIndex : null,
        correctAnswer: q.type === "grid_in" ? q.correctAnswer : null,
        givenAnswer: given ?? null,
        at: new Date().toISOString()
      };
      p.examMistakes = [entry, ...p.examMistakes.filter((m) => m.key !== key)];
    }

    const allDone = liveModules(test).every((m) =>
      db2.attempts.some((x) => x.participantId === participant.id && x.moduleId === m.id && x.submittedAt)
    );
    const badges = ["mock_finisher", ...(allDone ? ["full_test"] : [])];
    // The XP counts now, but exam mode shows no rewards: this one waits for
    // the results page (GET /api/student/sessions/:id/results).
    const reward = award(p, examModuleXp(raw, a.max), badges);
    queueExamReward(p, { sessionId: session.id, moduleId: mod.id, moduleName: mod.name }, reward);
    return a;
  });

  // `late` tells the exam screen the clock had run out, so it can say that only the answers saved
  // before time count.
  res.json({ raw: attempt.raw, max: attempt.max, late: late || undefined });
});

export default router;
