import { Router } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../db.js";
import { requireStaff } from "../auth.js";
import { isExamAnswerCorrect, liveModules } from "../grading.js";
import { nextCandidateId, tempPassword as makeTempPassword } from "../users.js";
import { cancelledView, lockRound, reinstate } from "../examLock.js";
import { ADMIN_ONLY, canSeeStudent, isTeacher } from "../staffScope.js";

const router = Router();
router.use(requireStaff);

const id = () => nanoid(10);

// A sitting cancelled because the student left the test page (examLock.js), with the module they
// were in. `letBackIn` is how many times a teacher has already let this student back in.
function lockView(participant, modules) {
  const c = participant.cancelled;
  return {
    cancelled: c ? { ...cancelledView(c), moduleId: c.moduleId || null, moduleName: modules.find((m) => m.id === c.moduleId)?.name || null } : null,
    letBackIn: lockRound(participant)
  };
}

function participantView(db, p) {
  const user = db.users.find((u) => u.id === p.userId);
  const session = db.sessions.find((s) => s.id === p.sessionId);
  const test = session ? db.tests.find((t) => t.id === session.testId) : null;
  // Only modules that can be sat: an empty one would read "Not started" for ever.
  const modules = liveModules(test);

  const moduleInfo = modules.map((m) => {
    const attempt = db.attempts.find((a) => a.participantId === p.id && a.moduleId === m.id);
    return {
      moduleId: m.id,
      name: m.name,
      status: attempt ? (attempt.submittedAt ? "completed" : "in_progress") : "not_started",
      raw: attempt?.raw ?? null,
      max: attempt ? m.questions.length : null,
      submittedAt: attempt?.submittedAt || null
    };
  });

  return {
    id: p.id,
    user: user
      ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, candidateId: user.candidateId }
      : null,
    modules: moduleInfo,
    ...lockView(p, test?.modules || [])
  };
}

// List sessions with summary info
router.get("/", (req, res) => {
  const db = readDB();
  const list = db.sessions
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((s) => {
      const test = db.tests.find((t) => t.id === s.testId);
      const participants = db.participants.filter((p) => p.sessionId === s.id);
      const completed = participants.filter((p) => {
        const mods = liveModules(test);
        return mods.length > 0 && mods.every((m) => db.attempts.some((a) => a.participantId === p.id && a.moduleId === m.id && a.submittedAt));
      }).length;
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        status: s.status,
        sessionDate: s.sessionDate,
        sessionTime: s.sessionTime,
        studentLimit: s.studentLimit,
        testId: s.testId,
        testTitle: test?.title || "(deleted test)",
        participantCount: participants.length,
        completedCount: completed
      };
    });
  res.json(list);
});

// Body fields are untrusted: only plain strings count, a number/object used to be stored as is.
const text = (v, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const MAX_CANDIDATES = 500;

// Create session
router.post("/", (req, res) => {
  const name = text(req.body?.name, 120);
  const testId = text(req.body?.testId, 60);
  const description = text(req.body?.description, 1000);
  const sessionDate = text(req.body?.sessionDate, 10);
  const sessionTime = text(req.body?.sessionTime, 5);
  if (!name || !testId) return res.status(400).json({ error: "name and testId required" });
  if (sessionDate && !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return res.status(400).json({ error: "Date must look like 2026-10-31" });
  if (sessionTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(sessionTime)) return res.status(400).json({ error: "Time must look like 09:30" });

  // The limit is optional (it defaults to 30), but when given it must be a sensible whole number:
  // 0 or a negative number used to be saved and left the session full from the start.
  let studentLimit = 30;
  const rawLimit = req.body?.studentLimit;
  if (rawLimit !== undefined && rawLimit !== null && rawLimit !== "") {
    studentLimit = typeof rawLimit === "boolean" || typeof rawLimit === "object" ? NaN : Number(rawLimit);
    if (!Number.isInteger(studentLimit) || studentLimit < 1 || studentLimit > MAX_CANDIDATES) {
      return res.status(400).json({ error: `Candidate limit must be a whole number from 1 to ${MAX_CANDIDATES}` });
    }
  }

  const session = updateDB((db) => {
    if (!db.tests.find((t) => t.id === testId)) return null;
    const s = {
      id: id(),
      name,
      description,
      studentLimit,
      sessionDate: sessionDate || null,
      sessionTime: sessionTime || null,
      testId,
      status: "created",
      createdAt: new Date().toISOString()
    };
    db.sessions.push(s);
    return s;
  });

  if (!session) return res.status(400).json({ error: "Invalid testId" });
  res.status(201).json(session);
});

// Session detail
router.get("/:sessionId", (req, res) => {
  const db = readDB();
  const session = db.sessions.find((s) => s.id === req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const test = db.tests.find((t) => t.id === session.testId);
  const participants = db.participants.filter((p) => p.sessionId === session.id).map((p) => participantView(db, p));

  res.json({
    ...session,
    testTitle: test?.title || "(deleted test)",
    modules: liveModules(test).map((m) => ({ id: m.id, name: m.name, timeLimitMinutes: m.timeLimitMinutes })),
    participants
  });
});

// Start session (allows candidate login)
router.post("/:sessionId/start", (req, res) => {
  const session = updateDB((db) => {
    const s = db.sessions.find((s) => s.id === req.params.sessionId);
    if (!s) return null;
    // Deleting a test leaves its sessions behind, but they can't be started: there'd be no exam.
    const test = db.tests.find((t) => t.id === s.testId);
    if (!test) return { error: "This session's test has been deleted, so it can't be started." };
    if (s.status === "started") return s; // already running: keep the original start time
    if (!liveModules(test).length) return { error: `"${test.title}" has no questions yet. Add some to a module before starting the session.` };
    s.status = "started";
    s.startedAt = new Date().toISOString();
    return s;
  });
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.error) return res.status(400).json({ error: session.error });
  res.json(session);
});

// Add a participant: find-or-create student user, then link to session.
// Brand-new users get a generated temp password so they can log in persistently
// (returned once in the response so the admin can share it) — if the email
// already belongs to a registered student, we just link them, untouched.
// A teacher adds students of the classes, picked from the search (userId). Looking an account up
// by email and making a new one are the admin's: both reach outside the classes.
router.post("/:sessionId/participants", (req, res) => {
  if (isTeacher(req) && !req.body?.userId) return res.status(403).json({ ...ADMIN_ONLY, error: "Pick a student from your classes. Only an admin can create a new account." });
  const userId = text(req.body?.userId, 60);
  const email = text(req.body?.email);
  const firstName = text(req.body?.firstName, 60);
  const lastName = text(req.body?.lastName, 60);
  const phone = text(req.body?.phone, 30);

  const result = updateDB((db) => {
    const session = db.sessions.find((s) => s.id === req.params.sessionId);
    if (!session) return { error: "Session not found", code: 404 };

    // 1. Resolve the user without creating anything yet. (updateDB saves the database even when
    //    this returns an error, so an account must never be created before every check passes.)
    let user = null;
    if (userId) {
      user = db.users.find((u) => u.id === userId);
      if (!user || (isTeacher(req) && !canSeeStudent(req, user))) return { error: "User not found", code: 404 };
    } else {
      if (!email) return { error: "email required", code: 400 };
      // An email that already belongs to a student just links them (no name needed); a name is
      // only required when a brand-new account has to be created.
      user = db.users.find((u) => u.role === "student" && (u.email || "").trim().toLowerCase() === email.toLowerCase());
      if (!user && !firstName) return { error: "firstName required to create a new student", code: 400 };
    }

    // 2. Duplicate and capacity checks. The duplicate test comes first so a full session still
    //    says "already in" for someone who is.
    if (user && db.participants.some((p) => p.sessionId === session.id && p.userId === user.id)) {
      return { error: "Participant already in this session", code: 400 };
    }
    if (db.participants.filter((p) => p.sessionId === session.id).length >= session.studentLimit) {
      return { error: "Session is full", code: 400 };
    }

    // 3. Only now create the account, if there isn't one.
    let tempPassword = null;
    if (!user) {
      tempPassword = makeTempPassword();
      user = {
        id: nanoid(10),
        role: "student",
        firstName,
        lastName: lastName || "",
        email,
        phone: phone || "",
        candidateId: nextCandidateId(db),
        passwordHash: bcrypt.hashSync(tempPassword, 10),
        mustChangePassword: true, // a temporary password: the student chooses their own at first sign-in
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
    }

    const participant = { id: nanoid(10), sessionId: session.id, userId: user.id, createdAt: new Date().toISOString() };
    db.participants.push(participant);
    return { participant, user, tempPassword };
  });

  if (result.error) return res.status(result.code).json({ error: result.error });

  const db = readDB();
  res.status(201).json({ ...participantView(db, result.participant), tempPassword: result.tempPassword || null });
});

// Remove a participant
router.delete("/:sessionId/participants/:participantId", (req, res) => {
  const removed = updateDB((db) => {
    const before = db.participants.length;
    db.participants = db.participants.filter((p) => p.id !== req.params.participantId);
    db.attempts = db.attempts.filter((a) => a.participantId !== req.params.participantId);
    return db.participants.length < before;
  });
  if (!removed) return res.status(404).json({ error: "Participant not found" });
  res.json({ ok: true });
});

// Full result detail for one participant (admin review)
router.get("/:sessionId/participants/:participantId", (req, res) => {
  const db = readDB();
  const session = db.sessions.find((s) => s.id === req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const participant = db.participants.find((p) => p.id === req.params.participantId);
  if (!participant) return res.status(404).json({ error: "Participant not found" });
  const test = db.tests.find((t) => t.id === session.testId);
  const user = db.users.find((u) => u.id === participant.userId);

  const modules = (test?.modules || []).map((m) => {
    const attempt = db.attempts.find((a) => a.participantId === participant.id && a.moduleId === m.id);
    const questions = m.questions.map((q) => {
      const givenAnswer = attempt?.answers?.[q.id];
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        passage: q.passage,
        passageImage: q.passageImage || null,
        promptImage: q.promptImage || null,
        options: q.options,
        correctIndex: q.correctIndex,
        correctAnswer: q.correctAnswer,
        givenAnswer: givenAnswer ?? null,
        // Only a handed-in module is marked: an attempt still in progress has no answers on the
        // server yet, and showing every question as wrong would be misleading.
        isCorrect: attempt?.submittedAt ? isExamAnswerCorrect(q, givenAnswer) : null
      };
    });
    return {
      moduleId: m.id,
      name: m.name,
      status: attempt ? (attempt.submittedAt ? "completed" : "in_progress") : "not_started",
      raw: attempt?.raw ?? null,
      max: m.questions.length,
      submittedAt: attempt?.submittedAt || null,
      // Set only when the module was handed in well after its clock ran out (see examRoutes.js).
      overtimeSeconds: attempt?.overtimeSeconds ?? null,
      questions
    };
  });

  res.json({
    user: user
      ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, candidateId: user.candidateId }
      : null,
    session: { id: session.id, name: session.name },
    modules,
    ...lockView(participant, test?.modules || [])
  });
});

// Let a student back into a sitting that was cancelled for leaving the test page. The module they
// were in gets back the time it was closed for, so they carry on with what they had left.
router.post("/:sessionId/participants/:participantId/reinstate", (req, res) => {
  const out = updateDB((db) => {
    const participant = db.participants.find((p) => p.id === req.params.participantId && p.sessionId === req.params.sessionId);
    if (!participant) return { error: "Participant not found", code: 404 };
    if (!participant.cancelled) return { error: "This sitting isn't cancelled", code: 409 };
    const moduleId = participant.cancelled.moduleId;
    const by = db.users.find((u) => u.id === req.user.userId);
    const closedFor = reinstate(participant, `${by?.firstName || ""} ${by?.lastName || ""}`.trim());
    const attempt = db.attempts.find((a) => a.participantId === participant.id && a.moduleId === moduleId && !a.submittedAt);
    if (attempt) attempt.startedAt = new Date(Date.parse(attempt.startedAt) + closedFor).toISOString();
    return { participant };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(participantView(readDB(), out.participant));
});

export default router;
