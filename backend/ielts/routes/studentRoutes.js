import express from "express";
import { readDB } from "../../db.js";
import { requireStudent } from "../../auth.js";
import { SCORE_SECTIONS, SECTIONS, effectiveBand, examOverall, findExam } from "../lib/exam.js";
import { openExam } from "./examRoutes.js";
import { cancelledView } from "../../examLock.js";
import { ieltsAnalytics } from "../lib/analytics.js";
import { LISTENING_BANDS, READING_BANDS } from "../lib/scoring.js";

// The IELTS side of the Northstar student hub: a signed-in student sees their
// IELTS sessions and can enter a live one without typing the candidate ID.
const router = express.Router();
router.use(requireStudent);

function sessionView(db, session, userId) {
  const exam = findExam(db, session.id, userId);
  const started = Boolean(exam) && SECTIONS.some((s) => exam.sections[s].status !== "pending");
  const state = !started ? "not_started" : exam.step === "done" ? "finished" : "in_progress";
  return {
    id: session.id,
    name: session.name,
    description: session.description || "",
    date: session.date,
    time: session.time,
    status: session.status,
    state,
    currentSection: state === "in_progress" ? exam.step : null,
    sections: Object.fromEntries(SECTIONS.map((s) => [s, exam?.sections[s].status || "pending"])),
    // Cancelled because the student left the test page (examLock.js): closed until a teacher lets them back in.
    cancelled: cancelledView(exam?.cancelled),
    canEnter: session.status === "started" && state !== "finished" && !exam?.cancelled,
    // Bands are released when the admin completes the session (results are announced then).
    results:
      session.status === "completed" && exam
        ? { ...Object.fromEntries(SCORE_SECTIONS.map((s) => [s, effectiveBand(exam, s)])), overall: examOverall(exam) }
        : null
  };
}

router.get("/sessions", (req, res) => {
  const db = readDB();
  const sessions = db.ieltsSessions
    .filter((s) => (s.participantIds || []).includes(req.studentUserId))
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
    .map((s) => sessionView(db, s, req.studentUserId));
  res.json({ sessions });
});

router.post("/sessions/:id/enter", (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.studentUserId && u.role === "student");
  if (!user) return res.status(404).json({ error: "Account not found" });
  if (user.status === "inactive") return res.status(403).json({ error: "This candidate account is inactive" });
  const pick = (data) =>
    data.ieltsSessions.find((s) => s.id === req.params.id && s.status === "started" && (s.participantIds || []).includes(user.id)) || null;
  if (!pick(db)) return res.status(409).json({ error: "This IELTS session is not open right now" });
  const result = openExam(user, pick);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

// The student's own IELTS numbers (lib/analytics.js): skills, question types, parts, recent work.
router.get("/analytics", (req, res) => {
  const db = readDB();
  const target = db.progress.find((p) => p.userId === req.studentUserId)?.ieltsTarget ?? 7;
  res.json(ieltsAnalytics(db, req.studentUserId, target));
});

// The raw-score tables the marking uses, for the band calculator: [least correct of 40, band].
router.get("/bands", (req, res) => {
  res.json({ listening: LISTENING_BANDS, reading: READING_BANDS, outOf: 40 });
});

export default router;
