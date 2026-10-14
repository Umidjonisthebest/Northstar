import express from "express";
import { readDB, updateDB } from "../../db.js";
import { requireAdmin, requireStaff } from "../../auth.js";
import { canSeeStudent, isTeacher } from "../../staffScope.js";
import { nextCandidateId } from "../../users.js";
import { SECTIONS, effectiveBand, examOverall, sectionStatus } from "../lib/exam.js";
import { asyncHandler, byCandidateIdDesc, fullName, matchesQuery, paginate, publicUser } from "../lib/http.js";
import { hashPassword, insertUser, removeUser, validateUserInput } from "../lib/users.js";

// The IELTS "Users" page works on Northstar's shared users collection. Accounts are the admin's:
// everything here is admin only, except one student's IELTS dashboard (registered at the end of
// this file, on `dashboardRouter`), which a teacher may open for a student of the classes.
// Teacher accounts are kept on their own page (routes/adminTeacherRoutes.js) and are left out of
// this one: its form knows two roles, and saving a teacher through it would make them a student.
const router = express.Router();
export const dashboardRouter = express.Router();
router.use(requireAdmin);
const notTeacher = (u) => u.role !== "teacher";

router.get("/", (req, res) => {
  const db = readDB();
  const q = String(req.query.q || "").trim();
  const role = ["student", "admin"].includes(req.query.role) ? req.query.role : null;
  const status = ["active", "inactive"].includes(req.query.status) ? req.query.status : null;
  const filtered = db.users
    .filter(notTeacher)
    .filter((u) => (!role || u.role === role) && (!status || (u.status || "active") === status))
    .filter((u) => matchesQuery([fullName(u), u.email, u.phone, u.candidateId], q))
    .sort(byCandidateIdDesc)
    .map(publicUser);
  res.json({ ...paginate(filtered, req.query), totalAll: db.users.filter(notTeacher).length });
});

router.get("/:id", (req, res) => {
  const user = readDB().users.find((u) => u.id === req.params.id && notTeacher(u));
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(publicUser(user));
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const check = validateUserInput(readDB(), req.body || {}, { creating: true });
    if (check.error) return res.status(400).json({ error: check.error });
    const passwordHash = await hashPassword(check.password);
    const out = updateDB((db) => {
      const result = validateUserInput(db, req.body || {}, { creating: true });
      if (result.error) return { error: result.error };
      return { user: insertUser(db, result.value, passwordHash) };
    });
    if (out.error) return res.status(400).json({ error: out.error });
    res.status(201).json(publicUser(out.user));
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const current = readDB().users.find((u) => u.id === id && notTeacher(u));
    if (!current) return res.status(404).json({ error: "User not found" });
    const check = validateUserInput(readDB(), req.body || {}, { existingId: id });
    if (check.error) return res.status(400).json({ error: check.error });
    if (id === req.user.userId && (check.value.role !== "admin" || check.value.status === "inactive")) {
      return res.status(400).json({ error: "You cannot remove your own admin access" });
    }
    const passwordHash = await hashPassword(check.password);
    const out = updateDB((db) => {
      const user = db.users.find((u) => u.id === id);
      if (!user) return { status: 404, error: "User not found" };
      const result = validateUserInput(db, req.body || {}, { existingId: id });
      if (result.error) return { status: 400, error: result.error };
      Object.assign(user, result.value, { updatedAt: new Date().toISOString() });
      // Students keep their Northstar password; only admins set one here.
      if (passwordHash) user.passwordHash = passwordHash;
      if (user.role === "student" && !user.candidateId) user.candidateId = nextCandidateId(db);
      return { user };
    });
    if (out.error) return res.status(out.status).json({ error: out.error });
    res.json(publicUser(out.user));
  })
);

router.delete("/:id", (req, res) => {
  const id = req.params.id;
  if (id === req.user.userId) return res.status(400).json({ error: "You cannot delete your own account" });
  const ok = updateDB((db) => {
    if (!db.users.some((u) => u.id === id && notTeacher(u))) return false;
    removeUser(db, id);
    return true;
  });
  if (!ok) return res.status(404).json({ error: "User not found" });
  res.json({ ok: true });
});

// ---------- per-student dashboard ----------

const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

dashboardRouter.get("/:id/dashboard", requireStaff, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.params.id && (isTeacher(req) ? canSeeStudent(req, u) : notTeacher(u)));
  if (!user) return res.status(404).json({ error: "User not found" });

  const sessions = db.ieltsSessions
    .filter((s) => (s.participantIds || []).includes(user.id))
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const exams = db.ieltsExams.filter((e) => e.userId === user.id);
  const attempts = db.ieltsAttempts.filter((a) => a.userId === user.id).sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));

  const sessionRows = sessions.map((s) => {
    const exam = exams.find((e) => e.sessionId === s.id) || null;
    const bands = Object.fromEntries(["reading", "listening", "writing", "speaking"].map((k) => [k, effectiveBand(exam, k)]));
    const completed = Object.fromEntries(["reading", "listening", "writing", "speaking"].map((k) => [k, sectionStatus(exam, k).completed]));
    return { id: s.id, name: s.name, date: s.date, time: s.time, status: s.status, bands, completed, overall: examOverall(exam) };
  });

  const overalls = sessionRows.map((r) => r.overall).filter((b) => b != null);
  let totalSeconds = 0;
  for (const e of exams) {
    for (const s of SECTIONS) {
      const st = e.sections[s];
      if (st.startedAt && st.submittedAt) totalSeconds += Math.max(0, (Date.parse(st.submittedAt) - Date.parse(st.startedAt)) / 1000);
    }
  }

  const scoreOverTime = sessionRows
    .filter((r) => ["reading", "listening", "writing"].some((k) => r.bands[k] != null))
    .map((r) => ({ date: r.date, session: r.name, reading: r.bands.reading, listening: r.bands.listening, writing: r.bands.writing, overall: r.overall }));

  const performance = {};
  const sectionComparison = [];
  const completionRate = [];
  for (const s of ["reading", "listening", "writing"]) {
    const bands = sessionRows.map((r) => r.bands[s]).filter((b) => b != null);
    const done = attempts.filter((a) => a.section === s).length;
    const assigned = exams.reduce((sum, e) => sum + (e.assignment?.[s]?.length || 0), 0);
    performance[s] = { attempts: done, assigned, average: round1(avg(bands)), best: bands.length ? Math.max(...bands) : null };
    const label = s[0].toUpperCase() + s.slice(1);
    sectionComparison.push({ section: label, average: round1(avg(bands)) ?? 0, best: bands.length ? Math.max(...bands) : 0 });
    completionRate.push({ section: label, value: done, assigned });
  }

  const now = new Date();
  const monthlyActivity = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = attempts.filter((a) => String(a.completedAt || "").startsWith(key));
    monthlyActivity.push({
      month: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      reading: inMonth.filter((a) => a.section === "reading").length,
      listening: inMonth.filter((a) => a.section === "listening").length,
      writing: inMonth.filter((a) => a.section === "writing").length
    });
  }

  res.json({
    user: publicUser(user),
    kpis: {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status !== "completed").length,
      averageScore: round1(avg(overalls)),
      bestScore: overalls.length ? Math.max(...overalls) : null,
      totalMinutes: Math.round(totalSeconds / 60),
      attempts: attempts.length
    },
    scoreOverTime,
    sectionComparison,
    completionRate,
    monthlyActivity,
    performance,
    sessions: sessionRows.slice().reverse(),
    recent: attempts.slice(0, 12).map((a) => ({
      id: a.id,
      section: a.section,
      title: a.title,
      completedAt: a.completedAt,
      correct: a.correct ?? null,
      total: a.total ?? null,
      words: a.words ?? null
    }))
  });
});

export default router;
