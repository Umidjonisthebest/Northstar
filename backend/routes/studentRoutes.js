import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../db.js";
import { signToken, requireStudent } from "../auth.js";
import { authLimiter, loginLimiter, registerLimiter } from "../rateLimit.js";
import { nextCandidateId } from "../users.js";
import { isExamAnswerCorrect } from "../grading.js";
import { examRewardsFor, getProgress, markExamRewardsSeen } from "../gamification.js";
import { appUrl, mailConfigured, sendMail } from "../mailer.js";
import { isEmail, passwordProblem, secret, text } from "../validate.js";
import { cleanAvatar, publicAvatar } from "../avatars.js";
import { lockedPart } from "../shop.js";
import { classFields } from "../classrooms.js";
import { cancelledView } from "../examLock.js";

const router = Router();
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");
// Accounts created by the IELTS admin may have no email. Trimmed so an address saved
// with stray spaces (a phone keyboard's trailing space) still matches what people type.
const emailOf = (u) => (u.email || "").trim().toLowerCase();

// Tokens issued before this moment stop working (see requireStudent in auth.js).
const signOutEverywhere = (user) => {
  user.passwordChangedAt = new Date().toISOString();
};

function publicUser(db, u) {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    candidateId: u.candidateId,
    createdAt: u.createdAt || null, // "Joined" on the settings page
    // Set on a temporary password: the app sends the student to choose their own first.
    mustChangePassword: u.mustChangePassword === true,
    avatar: publicAvatar(u), // profile picture choice, or null (initials)
    // Their class when they have joined one with its code (classrooms.js), and whether the class
    // question is answered: `classroom` is { id, name, mark } or null.
    ...classFields(db, u)
  };
}

// Self-service registration — students can create their own account,
// separate from admin-created ones (admin can still add them to a session by email).
// Nobody is put in a class here: a class is joined afterwards, with the class code a teacher gives
// (PUT /api/class/membership). A class named in the form is ignored.
router.post("/register", registerLimiter, (req, res) => {
  const firstName = text(req.body?.firstName, 60);
  const lastName = text(req.body?.lastName, 60);
  const email = text(req.body?.email, 120);
  const password = secret(req.body?.password);
  if (!firstName || !email || !password) return res.status(400).json({ error: "firstName, email and password required" });
  if (!isEmail(email)) return res.status(400).json({ error: "Enter a valid email address" });
  const weak = passwordProblem(password);
  if (weak) return res.status(400).json({ error: weak });

  const result = updateDB((db) => {
    // An address that already belongs to an account is never handed over, even an account with no
    // password yet (a teacher added the student by email, or the IELTS desk made it). Registering
    // with such an address used to let anyone who typed it set the password and take the account.
    // Its owner proves they own the mailbox through "Forgot password", or the teacher gives a
    // temporary password.
    if (db.users.some((u) => emailOf(u) === email.toLowerCase())) {
      return { error: "An account with this email already exists. Sign in, or use “Forgot password” to set a password for it.", code: 409 };
    }
    const user = {
      id: nanoid(10),
      role: "student",
      firstName,
      lastName: lastName || "",
      email,
      candidateId: nextCandidateId(db),
      passwordHash: bcrypt.hashSync(password, 10),
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    return { user, view: publicUser(db, user) };
  });

  if (result.error) return res.status(result.code).json({ error: result.error });
  const token = signToken({ role: "student", userId: result.user.id }, "7d");
  res.status(201).json({ token, user: result.view });
});

router.post("/login", loginLimiter, (req, res) => {
  const email = text(req.body?.email, 120);
  const password = secret(req.body?.password);
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  if (password.length > 200) return res.status(401).json({ error: "Invalid email or password" });

  const db = readDB();
  const user = db.users.find((u) => u.role === "student" && emailOf(u) === email.toLowerCase());
  if (!user || !user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ role: "student", userId: user.id }, "7d");
  res.json({ token, user: publicUser(db, user) });
});

// Reset links go out by email only when a mail relay is configured (mailer.js). Otherwise nothing
// is sent, and the response says so: `emailed: false` tells the screen to send the student to their
// teacher instead of promising a message that never comes. (Outside production the link is also
// printed in the server console, so it can be tried in development.)
//
// The answer never depends on whether the address has an account, so this can't be used to find out
// which emails are registered; `emailed` reflects the server's setup, not the account.
router.post("/forgot-password", authLimiter, async (req, res) => {
  const email = text(req.body?.email, 120).toLowerCase();
  if (!email) return res.status(400).json({ error: "Email required" });
  if (!isEmail(email)) return res.status(400).json({ error: "Enter a valid email address" });

  const emailed = mailConfigured();
  const link = updateDB((db) => {
    // Any account with this address, including a student a teacher added who has no password yet:
    // opening the link from their own mailbox is how they claim it.
    const user = db.users.find((u) => u.role === "student" && emailOf(u) === email);
    if (!user) return null;
    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = hashToken(rawToken);
    user.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
    return `${appUrl() || "http://localhost:5173"}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
  });

  if (link) {
    if (emailed) {
      await sendMail({
        to: email,
        subject: "Reset your Northstar password",
        text: `Someone asked to reset the password for this email address on Northstar.\n\nChoose a new password here (the link works for one hour):\n${link}\n\nIf this wasn't you, ignore this message; your password has not changed.`
      });
    } else if (process.env.NODE_ENV !== "production") {
      console.log(`[password reset] email isn't set up, link for ${email}: ${link} (valid 1 hour)`);
    }
  }

  res.json(
    emailed
      ? { ok: true, emailed: true, message: "If that email has an account, we've sent a reset link. It works for one hour." }
      : { ok: true, emailed: false, message: "This server can't send email yet, so no link was sent. Ask your teacher to reset your password; they'll give you a temporary one." }
  );
});

router.post("/reset-password", authLimiter, (req, res) => {
  const email = text(req.body?.email, 120).toLowerCase();
  const token = text(req.body?.token, 200);
  const password = secret(req.body?.password);
  if (!email || !token || !password) return res.status(400).json({ error: "Email, token and new password are required" });
  const weak = passwordProblem(password);
  if (weak) return res.status(400).json({ error: weak });

  const out = updateDB((db) => {
    const user = db.users.find((u) => u.role === "student" && emailOf(u) === email);
    if (!user || !user.resetToken || !user.resetTokenExpires) return { error: "Invalid or expired reset link", code: 400 };
    if (new Date(user.resetTokenExpires).getTime() < Date.now()) return { error: "This reset link has expired", code: 400 };
    if (user.resetToken !== hashToken(token)) return { error: "Invalid or expired reset link", code: 400 };

    user.passwordHash = bcrypt.hashSync(password, 10);
    delete user.resetToken;
    delete user.resetTokenExpires;
    delete user.mustChangePassword;
    signOutEverywhere(user); // every session that began before now is dead
    return { ok: true };
  });

  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json({ ok: true });
});

// Choosing a new password while signed in. It is also how a temporary password is replaced: the
// student must do this before anything else works (see requireStudent). Other devices are signed
// out; this one gets a fresh token.
router.post("/change-password", requireStudent, loginLimiter, (req, res) => {
  const current = secret(req.body?.currentPassword);
  const next = secret(req.body?.newPassword);
  const weak = passwordProblem(next);
  if (!current) return res.status(400).json({ error: "Enter your current password" });
  if (weak) return res.status(400).json({ error: weak });
  if (next === current) return res.status(400).json({ error: "Choose a password you haven't used before" });

  const out = updateDB((db) => {
    const user = db.users.find((u) => u.id === req.studentUserId && u.role === "student");
    if (!user || !user.passwordHash || !bcrypt.compareSync(current, user.passwordHash)) return { error: "Your current password isn't right", code: 400 }; // not 401: the app treats a 401 as "signed out"
    user.passwordHash = bcrypt.hashSync(next, 10);
    delete user.mustChangePassword;
    delete user.resetToken;
    delete user.resetTokenExpires;
    signOutEverywhere(user);
    return { user, view: publicUser(db, user) };
  });

  if (out.error) return res.status(out.code).json({ error: out.error });
  // The new token is issued a moment after the cut-off second, so it isn't caught by it.
  res.json({ token: signToken({ role: "student", userId: out.user.id }, "7d"), user: out.view });
});

// The student's profile picture: one of the 30 characters, something for it to wear, and a frame
// colour. `{ avatar: null }` goes back to initials. Unknown values are dropped (avatars.js).
router.put("/avatar", requireStudent, (req, res) => {
  const wanted = req.body?.avatar;
  const avatar = cleanAvatar(wanted);
  if (wanted !== null && !avatar) return res.status(400).json({ error: "Choose one of the profile pictures" });
  const out = updateDB((db) => {
    const u = db.users.find((x) => x.id === req.studentUserId);
    if (!u) return null;
    // Something from the Comet Shop can only be worn once it has been bought.
    const locked = lockedPart(getProgress(db, u.id), avatar);
    if (locked) return { error: `The ${locked.name.toLowerCase()} is in the Comet Shop: get it there first` };
    if (avatar) u.avatar = avatar;
    else delete u.avatar;
    return { view: publicUser(db, u) };
  });
  if (!out) return res.status(404).json({ error: "Not found" });
  if (out.error) return res.status(403).json({ error: out.error });
  res.json(out.view);
});

router.get("/me", requireStudent, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.studentUserId);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(publicUser(db, user));
});

// Every session this student has ever been part of, with per-module status.
router.get("/history", requireStudent, (req, res) => {
  const db = readDB();
  const myParticipants = db.participants.filter((p) => p.userId === req.studentUserId);
  const progress = getProgress(db, req.studentUserId);

  const sessions = myParticipants
    .map((p) => {
      const session = db.sessions.find((s) => s.id === p.sessionId);
      if (!session) return null;
      const test = db.tests.find((t) => t.id === session.testId);
      // Modules with no questions can't be sat, so they aren't listed (they would show "Not started"
      // for ever and keep the session from ever reading as finished). One the student has already
      // taken stays, even if its questions were removed since.
      const attemptOf = (m) => db.attempts.find((a) => a.participantId === p.id && a.moduleId === m.id);
      const modules = (test?.modules || [])
        .filter((m) => m.questions.length > 0 || attemptOf(m))
        .map((m) => {
          const attempt = attemptOf(m);
          return {
            id: m.id,
            name: m.name,
            order: m.order,
            timeLimitMinutes: m.timeLimitMinutes,
            questionCount: m.questions.length,
            status: attempt ? (attempt.submittedAt ? "completed" : "in_progress") : "not_started",
            raw: attempt?.raw ?? null,
            submittedAt: attempt?.submittedAt || null,
            timeSpent:
              attempt?.submittedAt && attempt.startedAt
                ? Math.round((new Date(attempt.submittedAt) - new Date(attempt.startedAt)) / 1000)
                : 0
          };
        });
      return {
        sessionId: session.id,
        sessionName: session.name,
        sessionStatus: session.status,
        testTitle: test?.title || "(deleted test)",
        testDescription: test?.description || "",
        // The teacher's rating of the test ("Easy" | "Medium" | "Hard"), or null when not rated.
        difficulty: test?.difficulty || null,
        sessionDate: session.sessionDate,
        sessionTime: session.sessionTime,
        studentLimit: session.studentLimit,
        participantCount: db.participants.filter((x) => x.sessionId === session.id).length,
        // Rewards from this exam that the student hasn't opened the results page for yet.
        rewardsWaiting: examRewardsFor(progress, session.id).unseen,
        // Cancelled because the student left the test page (examLock.js): closed until a teacher lets them back in.
        cancelled: cancelledView(p.cancelled),
        modules
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.sessionDate || "").localeCompare(b.sessionDate || ""))
    .reverse();

  res.json({ sessions });
});

// Review your own answers for a completed session (question-by-question, with correct answers revealed).
router.get("/sessions/:sessionId/results", requireStudent, (req, res) => {
  const db = readDB();
  const session = db.sessions.find((s) => s.id === req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const participant = db.participants.find((p) => p.sessionId === session.id && p.userId === req.studentUserId);
  if (!participant) return res.status(403).json({ error: "You are not part of this session" });
  const test = db.tests.find((t) => t.id === session.testId);

  const attemptOf = (m) => db.attempts.find((a) => a.participantId === participant.id && a.moduleId === m.id);
  const modules = (test?.modules || []).filter((m) => m.questions.length > 0 || attemptOf(m)).map((m) => {
    const attempt = attemptOf(m);
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
        isCorrect: attempt?.submittedAt ? isExamAnswerCorrect(q, givenAnswer) : null
      };
    });
    return {
      moduleId: m.id,
      name: m.name,
      status: attempt ? (attempt.submittedAt ? "completed" : "in_progress") : "not_started",
      raw: attempt?.raw ?? null,
      max: m.questions.length,
      questions: attempt?.submittedAt ? questions : []
    };
  });

  // What the exam earned. It isn't shown during the exam, so this page is where it appears.
  const rewards = examRewardsFor(getProgress(db, req.studentUserId), session.id);
  res.json({ sessionName: session.name, testTitle: test?.title, modules, rewards, cancelled: cancelledView(participant.cancelled) });
});

// The results page calls this once it has shown the exam's rewards.
router.post("/sessions/:sessionId/rewards/seen", requireStudent, (req, res) => {
  const out = updateDB((db) => {
    const participant = db.participants.find((p) => p.sessionId === req.params.sessionId && p.userId === req.studentUserId);
    if (!participant) return { error: "You are not part of this session", code: 403 };
    return { marked: markExamRewardsSeen(getProgress(db, req.studentUserId), req.params.sessionId) };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

export default router;
