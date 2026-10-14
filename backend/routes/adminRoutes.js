// What both panels share (the overview, students, analytics, announcements, the CSV export and
// test duplication) and two things that are the admin's alone: the weekly leagues and the cover
// page's success stories. A teacher's numbers and lists are worked out from the students of the
// classes only (staffScope.js).
import { Router } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../db.js";
import { requireAdmin, requireStaff } from "../auth.js";
import { isExamAnswerCorrect } from "../grading.js";
import { isDemoUser, tempPassword } from "../users.js";
import { publicAvatar } from "../avatars.js";
import { BADGES, levelInfo, scaled, todayKey, dayOffset } from "../gamification.js";
import { ieltsSummaryFor } from "../ielts/index.js";
import { publicSummary as satDiagnosticSummary } from "../diagnostic.js";
import { publicSummary as ieltsDiagnosticSummary } from "../ielts/lib/diagnostic.js";
import { cleanStory } from "../stories.js";
import { adminLeagueView } from "../leagues.js";
import { dbWithLeague } from "./leagueRoutes.js";
import { allClasses, classInfo, classOf, cleanClassChoice, cleanClassIds, placeStudent } from "../classrooms.js";
import { cancelledView } from "../examLock.js";
import { ADMIN_ONLY, canSeeStudent, isTeacher, visibleStudents } from "../staffScope.js";

const router = Router();
router.use(requireStaff);

const fullName = (u) => `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email;

// Request bodies are untrusted: only real strings count as text. `String({})` used to save the
// literal "[object Object]" as a name, an email or an announcement.
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// The calendar day an ISO timestamp falls on in the app's own timezone (the one `todayKey()` and
// every streak use). Slicing the UTC string put late-evening submissions on the wrong day.
const dayOf = (iso) => (iso ? todayKey(new Date(iso)) : null);

// ---------- helpers ----------
function moduleCtx(db, attempt) {
  const session = db.sessions.find((s) => s.id === attempt.sessionId);
  const test = db.tests.find((t) => t.id === session?.testId);
  const mod = test?.modules.find((m) => m.id === attempt.moduleId);
  const participant = db.participants.find((p) => p.id === attempt.participantId);
  const user = db.users.find((u) => u.id === participant?.userId);
  return { session, test, mod, participant, user };
}

const isCorrect = isExamAnswerCorrect;

// What the class numbers are computed from: the demo account ("Try the demo") is left out of every
// count, average and ranking, so a visitor playing with it can't skew what the teacher sees.
// For a teacher it is the students of the classes and their work; for the admin, every student.
function realData(db, req) {
  const students = visibleStudents(req, db).filter((u) => !isDemoUser(u));
  if (isTeacher(req)) {
    const ids = new Set(students.map((u) => u.id));
    const parts = new Set(db.participants.filter((p) => ids.has(p.userId)).map((p) => p.id));
    return { students, progress: db.progress.filter((p) => ids.has(p.userId)), attempts: db.attempts.filter((a) => parts.has(a.participantId)) };
  }
  const demoIds = new Set(db.users.filter(isDemoUser).map((u) => u.id));
  const demoParts = new Set(db.participants.filter((p) => demoIds.has(p.userId)).map((p) => p.id));
  return {
    students,
    progress: db.progress.filter((p) => !demoIds.has(p.userId)),
    attempts: db.attempts.filter((a) => !demoParts.has(a.participantId))
  };
}

function studentSummary(db, u) {
  const p = db.progress.find((x) => x.userId === u.id);
  const answered = p ? Object.values(p.answered || {}) : [];
  const attempts = answered.reduce((s, a) => s + a.attempts, 0);
  const correct = answered.reduce((s, a) => s + a.correct, 0);
  const myParts = db.participants.filter((x) => x.userId === u.id).map((x) => x.id);
  const mocks = db.attempts.filter((a) => myParts.includes(a.participantId) && a.submittedAt && a.max);
  const avgMock = mocks.length ? mocks.reduce((s, a) => s + a.raw / a.max, 0) / mocks.length : null;
  const lastDates = [p?.streak?.lastDate, ...mocks.map((m) => dayOf(m.submittedAt))].filter(Boolean).sort();
  const today = todayKey();
  const streakAlive = p?.streak?.lastDate === today || p?.streak?.lastDate === dayOffset(today, -1);
  return {
    id: u.id,
    name: fullName(u),
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    candidateId: u.candidateId,
    createdAt: u.createdAt,
    hasPassword: Boolean(u.passwordHash),
    demo: isDemoUser(u) || undefined, // listed for the teacher, but left out of every count
    avatar: publicAvatar(u),
    // Their class ({ id, name, mark }), or null for a student outside one. `chatMuted`: a teacher
    // has paused their messages in class chats.
    classroom: classOf(db, u),
    chatMuted: u.chatMuted === true,
    xp: p?.xp || 0,
    level: levelInfo(p?.xp || 0).level,
    streak: streakAlive ? p?.streak?.current || 0 : 0,
    lastActive: lastDates.at(-1) || null,
    practiceAnswered: answered.length,
    practiceAccuracy: attempts ? correct / attempts : null,
    mockModules: mocks.length,
    mockAvgScaled: avgMock === null ? null : scaled(avgMock),
    savedCount: p?.saved?.length || 0,
    badges: p?.badges?.length || 0
  };
}

// ---------- overview ----------
router.get("/overview", (req, res) => {
  const db = readDB();
  const { students, progress, attempts } = realData(db, req);
  const today = todayKey();
  const days = Array.from({ length: 14 }, (_, i) => dayOffset(today, i - 13));
  const submitted = attempts.filter((a) => a.submittedAt);

  const activity = days.map((d) => ({
    date: d,
    xp: progress.reduce((s, p) => s + (p.xpLog?.[d] || 0), 0),
    submissions: submitted.filter((a) => dayOf(a.submittedAt) === d).length,
    active: progress.filter((p) => (p.xpLog?.[d] || 0) > 0).length
  }));

  const recent = submitted
    .slice()
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 8)
    .map((a) => {
      const { session, test, mod, user, participant } = moduleCtx(db, a);
      return {
        id: a.id,
        at: a.submittedAt,
        student: user ? fullName(user) : "Unknown",
        studentId: user?.id,
        test: test?.title || "(deleted test)",
        module: mod?.name || "",
        raw: a.raw,
        max: a.max,
        scaled: a.max ? scaled(a.raw / a.max) : null,
        sessionId: session?.id,
        participantId: participant?.id
      };
    });

  const summaries = students.map((u) => studentSummary(db, u));
  const activeToday = progress.filter((p) => (p.xpLog?.[today] || 0) > 0).length;
  const weekKeys = days.slice(-7);
  const activeWeek = progress.filter((p) => weekKeys.some((d) => (p.xpLog?.[d] || 0) > 0)).length;
  const scaledAll = submitted.filter((a) => a.max).map((a) => scaled(a.raw / a.max));

  res.json({
    counts: {
      students: students.length,
      activeToday,
      activeWeek,
      tests: db.tests.length,
      practiceQuestions: db.practiceQuestions.length,
      sessionsLive: db.sessions.filter((s) => s.status === "started").length,
      sessions: db.sessions.length,
      submissions: submitted.length,
      submissionsWeek: submitted.filter((a) => weekKeys.includes(dayOf(a.submittedAt))).length,
      avgSectionScore: scaledAll.length ? Math.round(scaledAll.reduce((s, x) => s + x, 0) / scaledAll.length / 10) * 10 : null,
      xpWeek: weekKeys.reduce((s, d) => s + progress.reduce((t, p) => t + (p.xpLog?.[d] || 0), 0), 0)
    },
    activity,
    recent,
    topStudents: summaries.sort((a, b) => b.xp - a.xp).slice(0, 6),
    liveSessions: db.sessions
      .filter((s) => s.status === "started")
      .slice(-5)
      .reverse()
      .map((s) => {
        const test = db.tests.find((t) => t.id === s.testId);
        const parts = db.participants.filter((p) => p.sessionId === s.id);
        const done = parts.filter((p) =>
          (test?.modules || []).every((m) => db.attempts.some((a) => a.participantId === p.id && a.moduleId === m.id && a.submittedAt))
        ).length;
        return { id: s.id, name: s.name, test: test?.title, participants: parts.length, finished: done };
      }),
    announcements: db.announcements.slice(-3).reverse()
  });
});

// ---------- students ----------
router.get("/students", (req, res) => {
  const db = readDB();
  const q = String(req.query.q || "").toLowerCase().trim();
  const list = visibleStudents(req, db)
    .filter((u) => !q || `${fullName(u)} ${u.email || ""} ${u.candidateId || ""}`.toLowerCase().includes(q))
    .map((u) => studentSummary(db, u));
  // `classes`: every class there is, for the list's class filter.
  res.json({ students: list, classes: allClasses(db).map(classInfo) });
});

router.get("/students/:id", (req, res) => {
  const db = readDB();
  const u = db.users.find((x) => x.id === req.params.id && canSeeStudent(req, x));
  if (!u) return res.status(404).json({ error: "Student not found" });
  const p = db.progress.find((x) => x.userId === u.id);

  const topics = {};
  for (const q of db.practiceQuestions) {
    const a = p?.answered?.[q.id];
    if (!a) continue;
    topics[q.topic] ||= { topic: q.topic, section: q.section, attempts: 0, correct: 0 };
    topics[q.topic].attempts += a.attempts;
    topics[q.topic].correct += a.correct;
  }

  const myParts = db.participants.filter((x) => x.userId === u.id);
  const sessions = myParts.map((part) => {
    const s = db.sessions.find((x) => x.id === part.sessionId);
    const t = db.tests.find((x) => x.id === s?.testId);
    return {
      sessionId: s?.id,
      participantId: part.id,
      name: s?.name,
      test: t?.title,
      modules: (t?.modules || []).map((m) => {
        const a = db.attempts.find((x) => x.participantId === part.id && x.moduleId === m.id);
        return { name: m.name, status: a ? (a.submittedAt ? "completed" : "in_progress") : "not_started", raw: a?.raw ?? null, max: m.questions.length, at: a?.submittedAt || null };
      })
    };
  });

  const today = todayKey();
  res.json({
    ...studentSummary(db, u),
    // Every class there is, for the "move to another class" choice in the Edit dialog.
    classes: allClasses(db).map(classInfo),
    lvl: levelInfo(p?.xp || 0),
    longestStreak: p?.streak?.longest || 0,
    bestCombo: p?.bestCombo || 0,
    targetScore: p?.targetScore || 1400,
    drills: p?.drills?.length || 0,
    vocabMastered: Object.values(p?.vocab || {}).filter((m) => m >= 80).length,
    heatmap: Array.from({ length: 28 }, (_, i) => {
      const d = dayOffset(today, i - 27);
      return { date: d, xp: p?.xpLog?.[d] || 0 };
    }),
    topics: Object.values(topics).map((t) => ({ ...t, accuracy: t.correct / t.attempts })).sort((a, b) => a.accuracy - b.accuracy),
    badges: Object.entries(BADGES).map(([id, b]) => {
      const got = p?.badges?.find((x) => x.id === id);
      return { id, ...b, earned: Boolean(got), earnedAt: got?.earnedAt || null };
    }),
    sessions,
    ielts: ieltsSummaryFor(db, u.id),
    // Diagnostic tests (the student's starting level), newest first.
    diagnostics: [
      ...db.diagnostics.filter((d) => d.userId === u.id).map((d) => ({ exam: "sat", ...satDiagnosticSummary(d) })),
      ...db.ieltsDiagnostics.filter((d) => d.userId === u.id && d.status !== "created").map((d) => ({ exam: "ielts", ...ieltsDiagnosticSummary(d) }))
    ].sort((a, b) => String(b.submittedAt || b.startedAt).localeCompare(String(a.submittedAt || a.startedAt)))
  });
});

// A teacher moves a student between classes and pauses their chat messages. The name and the
// email (what the student signs in with) are account details, and those are the admin's.
router.put("/students/:id", (req, res) => {
  const body = req.body || {};
  if (isTeacher(req) && ["firstName", "lastName", "email"].some((k) => body[k] !== undefined)) return res.status(403).json(ADMIN_ONLY);
  const firstName = text(body.firstName, 60);
  const lastName = text(body.lastName, 60);
  const email = text(body.email, 120);
  if (body.email !== undefined && body.email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address" });
  if (body.chatMuted !== undefined && typeof body.chatMuted !== "boolean") return res.status(400).json({ error: "chatMuted must be true or false" });
  const out = updateDB((db) => {
    const u = db.users.find((x) => x.id === req.params.id && canSeeStudent(req, x));
    if (!u) return { error: "Student not found", code: 404 };
    // { classId } puts the student in that class, moves them, or (null) takes them out of every
    // class. Staff don't need the class code, and aren't held to the student's own once-a-month
    // limit (classrooms.js).
    const move = cleanClassChoice(db, body);
    if (move.error) return { error: move.error, code: 400 };
    // Compared trimmed and lower-cased, the way sign-in matches an address.
    if (email && db.users.some((x) => x.id !== u.id && x.role === "student" && (x.email || "").trim().toLowerCase() === email.toLowerCase()))
      return { error: "Another student already uses this email", code: 400 };
    if (move.asked && isDemoUser(u)) return { error: "The demo account can't be in a class: it is one login shared by every visitor", code: 400 };
    if (firstName) u.firstName = firstName;
    if (typeof body.lastName === "string") u.lastName = lastName;
    if (email) u.email = email;
    if (move.asked) placeStudent(u, move.classId);
    if (body.chatMuted === true) u.chatMuted = true;
    if (body.chatMuted === false) delete u.chatMuted;
    return { ok: true };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out);
});

router.post("/students/:id/reset-password", (req, res) => {
  const temp = tempPassword();
  const ok = updateDB((db) => {
    const u = db.users.find((x) => x.id === req.params.id && canSeeStudent(req, x));
    if (!u) return false;
    u.passwordHash = bcrypt.hashSync(temp, 10);
    u.mustChangePassword = true; // the student must replace it at first sign-in
    u.passwordChangedAt = new Date().toISOString(); // and any session open under the old password ends
    delete u.resetToken;
    delete u.resetTokenExpires;
    return true;
  });
  if (!ok) return res.status(404).json({ error: "Student not found" });
  res.json({ tempPassword: temp });
});

// ---------- weekly leagues (admin) ----------
// Every group this week with its table, and how the last week closed. Leagues are global: they
// mix class students with everyone else, so they are not a teacher's to look through.
router.get("/leagues", requireAdmin, (req, res) => res.json(adminLeagueView(dbWithLeague())));

// ---------- analytics ----------
router.get("/analytics", (req, res) => {
  const db = readDB();

  const real = realData(db, req);
  // Practice bank: per-question and per-topic accuracy across all students.
  const qStats = db.practiceQuestions.map((q) => {
    let attempts = 0;
    let correct = 0;
    let students = 0;
    for (const p of real.progress) {
      const a = p.answered?.[q.id];
      if (!a) continue;
      students += 1;
      attempts += a.attempts;
      correct += a.correct;
    }
    return { id: q.id, title: q.title, section: q.section, topic: q.topic, difficulty: q.difficulty, attempts, students, accuracy: attempts ? correct / attempts : null };
  });
  const topicMap = {};
  for (const q of qStats) {
    topicMap[q.topic] ||= { topic: q.topic, section: q.section, attempts: 0, correct: 0, questions: 0 };
    topicMap[q.topic].questions += 1;
    topicMap[q.topic].attempts += q.attempts;
    topicMap[q.topic].correct += q.accuracy === null ? 0 : q.accuracy * q.attempts;
  }
  const topics = Object.values(topicMap)
    .map((t) => ({ ...t, correct: Math.round(t.correct), accuracy: t.attempts ? t.correct / t.attempts : null }))
    .sort((a, b) => (a.accuracy ?? 2) - (b.accuracy ?? 2));

  // Mock exams: score distribution per test module + hardest exam questions.
  const tests = db.tests.map((t) => {
    const sessionIds = db.sessions.filter((s) => s.testId === t.id).map((s) => s.id);
    const modules = t.modules.map((m) => {
      const atts = real.attempts.filter((a) => a.moduleId === m.id && a.submittedAt && sessionIds.includes(a.sessionId));
      const buckets = [200, 300, 400, 500, 600, 700].map((lo) => ({ label: `${lo}–${lo + 99 + (lo === 700 ? 1 : 0)}`, count: 0 }));
      for (const a of atts) {
        const s = a.max ? scaled(a.raw / a.max) : 200;
        buckets[Math.min(5, Math.floor((s - 200) / 100))].count += 1;
      }
      const questions = m.questions.map((q) => {
        const right = atts.filter((a) => isCorrect(q, a.answers?.[q.id])).length;
        return { id: q.id, order: q.order, prompt: q.prompt, type: q.type, correct: right, total: atts.length, accuracy: atts.length ? right / atts.length : null };
      });
      return {
        id: m.id,
        name: m.name,
        submissions: atts.length,
        avgScaled: atts.length ? Math.round(atts.reduce((s, a) => s + scaled(a.raw / (a.max || 1)), 0) / atts.length / 10) * 10 : null,
        buckets,
        questions: questions.sort((a, b) => (a.accuracy ?? 2) - (b.accuracy ?? 2))
      };
    });
    return { id: t.id, title: t.title, modules };
  });

  res.json({
    practice: {
      hardest: qStats.filter((q) => q.attempts > 0).sort((a, b) => a.accuracy - b.accuracy).slice(0, 8),
      untouched: qStats.filter((q) => q.attempts === 0).length,
      totalAttempts: qStats.reduce((s, q) => s + q.attempts, 0)
    },
    topics,
    tests
  });
});

// ---------- announcements ----------
// An announcement goes to the students who are in a class: to every class, or to the ones listed
// in `classIds`. Students outside a class have no teacher and see none
// (GET /api/practice/announcements does the filtering).
router.get("/announcements", (req, res) => res.json({ announcements: readDB().announcements.slice().reverse() }));

router.post("/announcements", (req, res) => {
  const { tone = "info", pinned = false } = req.body || {};
  const title = text(req.body?.title, 120);
  if (!title) return res.status(400).json({ error: "Title is required" });
  // `classIds` left out or "all" means all classes, the ones made later too: stored as no list.
  const asked = req.body?.classIds;
  const toAll = asked === undefined || asked === null || asked === "all";
  const item = updateDB((db) => {
    const classIds = toAll ? [] : cleanClassIds(db, asked);
    if (!toAll && !classIds.length) return null;
    const a = {
      id: nanoid(10),
      title,
      body: text(req.body?.body, 1000),
      tone: ["info", "success", "warning", "celebrate"].includes(tone) ? tone : "info",
      pinned: pinned === true || pinned === "true",
      createdAt: new Date().toISOString()
    };
    if (classIds.length) a.classIds = classIds;
    db.announcements.push(a);
    return a;
  });
  if (!item) return res.status(400).json({ error: "Choose at least one class, or all classes" });
  res.status(201).json(item);
});

router.put("/announcements/:id", (req, res) => {
  const item = updateDB((db) => {
    const a = db.announcements.find((x) => x.id === req.params.id);
    if (!a) return null;
    if (req.body?.pinned !== undefined) a.pinned = Boolean(req.body.pinned);
    return a;
  });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

router.delete("/announcements/:id", (req, res) => {
  updateDB((db) => {
    db.announcements = db.announcements.filter((x) => x.id !== req.params.id);
  });
  res.json({ ok: true });
});

// ---------- success stories on the cover page (admin) ----------
router.get("/stories", requireAdmin, (req, res) => res.json({ stories: readDB().stories.slice().reverse() }));

router.post("/stories", requireAdmin, (req, res) => {
  const { story, error } = cleanStory(req.body);
  if (error) return res.status(400).json({ error });
  const item = updateDB((db) => {
    const s = { id: nanoid(10), ...story, createdAt: new Date().toISOString() };
    db.stories.push(s);
    return s;
  });
  res.status(201).json(item);
});

router.put("/stories/:id", requireAdmin, (req, res) => {
  const out = updateDB((db) => {
    const s = db.stories.find((x) => x.id === req.params.id);
    if (!s) return { code: 404, error: "Not found" };
    const { story, error } = cleanStory({ ...s, ...(req.body || {}) });
    if (error) return { code: 400, error };
    Object.assign(s, story, { updatedAt: new Date().toISOString() });
    return { item: s };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json(out.item);
});

router.delete("/stories/:id", requireAdmin, (req, res) => {
  updateDB((db) => {
    db.stories = db.stories.filter((x) => x.id !== req.params.id);
  });
  res.json({ ok: true });
});

// ---------- exports & tools ----------
// A spreadsheet runs a text cell that starts with = + - @ (or a tab / carriage return) as a formula,
// and a student picks their own name, so a name like =HYPERLINK(...) would run on the teacher's
// machine when they open the export. A leading apostrophe makes it plain text. Numbers are left alone.
const csvCell = (v) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get("/sessions/:id/export.csv", (req, res) => {
  const db = readDB();
  const session = db.sessions.find((s) => s.id === req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const test = db.tests.find((t) => t.id === session.testId);
  const modules = test?.modules || [];
  // The last column says when a sitting was cancelled for leaving the test page (examLock.js).
  const header = ["Candidate ID", "First name", "Last name", "Email", ...modules.flatMap((m) => [`${m.name} raw`, `${m.name} max`, `${m.name} est. score`, `${m.name} submitted`]), "Est. total", "Note"];
  const rows = db.participants
    .filter((p) => p.sessionId === session.id)
    .map((p) => {
      const u = db.users.find((x) => x.id === p.userId) || {};
      let total = 0;
      let complete = true;
      const cells = modules.flatMap((m) => {
        const a = db.attempts.find((x) => x.participantId === p.id && x.moduleId === m.id && x.submittedAt);
        if (!a) {
          complete = false;
          return ["", m.questions.length, "", ""];
        }
        const s = scaled(a.raw / (a.max || 1));
        total += s;
        return [a.raw, a.max, s, a.submittedAt];
      });
      const note = p.cancelled ? `Cancelled: ${cancelledView(p.cancelled).reason}` : "";
      return [u.candidateId, u.firstName, u.lastName, u.email, ...cells, complete && modules.length ? total : "", note];
    });
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const safe = (session.name || "session").replace(/[^a-z0-9-_]+/gi, "_");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}_results.csv"`);
  res.send("﻿" + csv);
});

router.post("/tests/:id/duplicate", (req, res) => {
  const copy = updateDB((db) => {
    const t = db.tests.find((x) => x.id === req.params.id);
    if (!t) return null;
    const c = structuredClone(t);
    c.id = nanoid(10);
    c.title = `${t.title} (copy)`;
    c.createdAt = new Date().toISOString();
    for (const m of c.modules) {
      m.id = nanoid(10);
      for (const q of m.questions) q.id = nanoid(10);
    }
    db.tests.push(c);
    return c;
  });
  if (!copy) return res.status(404).json({ error: "Test not found" });
  res.status(201).json({ id: copy.id, title: copy.title });
});

export default router;
