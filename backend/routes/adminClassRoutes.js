// The studio's side of classes: making a class and naming it, its class code, every class at a
// glance, one class's students and chat, and the messages students have reported. Mounted at
// /api/admin/classes. Homework is in adminHomeworkRoutes.js; moving a student between classes and
// pausing their messages go through PUT /api/admin/students/:id (adminRoutes.js).
import { Router } from "express";
import { readDB, updateDB } from "../db.js";
import { requireStaff } from "../auth.js";
import { isTeacher } from "../staffScope.js";
import { isDemoUser } from "../users.js";
import { publicAvatar } from "../avatars.js";
import { CLASS, allClasses, classById, classInfo, cleanClassName, createClass, deleteClass, fullName, inClass, renewClassCode } from "../classrooms.js";
import { classSnapshot, cupView, ensureQuests } from "../classStats.js";
import { teacherHomework } from "../homework.js";
import { classRoom, dismissReports, openReports, teacherRemove, teacherReports, teacherRoom } from "../classChat.js";

const router = Router();
// Both panels: teachers make and run the classes, and the admin has to be able to act on a
// reported message when no teacher has.
router.use(requireStaff);

const DAY_MS = 86400000;
const NO_CLASS = { error: "There is no such class" };

function dbWithQuests() {
  const db = readDB();
  if (!ensureQuests(db)) return db;
  return updateDB((fresh) => {
    ensureQuests(fresh);
    return fresh;
  });
}

// A class as the studio's list and pickers show it: its name, its code and who made it.
function studioClass(db, cls) {
  const by = cls.by ? db.users.find((u) => u.id === cls.by) : null;
  return { ...classInfo(cls), code: cls.code, createdAt: cls.createdAt, by: by ? fullName(by) : "" };
}

// Every class: how many students, how the week is going, what is set and what needs a look.
router.get("/", (req, res) => {
  const db = dbWithQuests();
  const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const homework = teacherHomework(db);
  const cup = new Map(cupView(db).map((c) => [c.id, c]));
  const classes = allClasses(db).map((cls) => {
    const snap = classSnapshot(db, cls.id);
    const room = classRoom(cls.id);
    return {
      ...studioClass(db, cls),
      students: snap.members.length,
      studied: snap.members.filter((m) => m.week.xp > 0 || m.week.questions > 0).length,
      xp: snap.total,
      minutes: snap.members.reduce((s, m) => s + m.week.minutes, 0),
      goal: cup.has(cls.id) ? { target: cup.get(cls.id).target, percent: cup.get(cls.id).percent, reached: cup.get(cls.id).reached, rank: cup.get(cls.id).rank } : null,
      homeworkOpen: homework.filter((h) => h.classIds.includes(cls.id) && !h.past).length,
      messagesWeek: db.classMessages.filter((m) => m.room === room && m.createdAt >= since && !m.deletedAt).length
    };
  });
  const students = db.users.filter((u) => u.role === "student" && !isDemoUser(u) && !inClass(u));
  res.json({
    classes,
    limits: { name: CLASS.nameMax },
    // Students who aren't in a class: the ones who said they have none, and the ones who haven't
    // entered a class code or answered yet. They have no teacher, so only the admin is told.
    outside: isTeacher(req) ? null : { elsewhere: students.filter((u) => u.noClass === true).length, notAsked: students.filter((u) => u.noClass !== true).length },
    reports: openReports(db)
  });
});

// A teacher makes a class and names it: { name }. The class gets its code there and then.
router.post("/", (req, res) => {
  const out = updateDB((db) => {
    if (db.classes.length >= CLASS.max) return { error: "There are a great many classes already. Delete the ones nobody uses first." };
    const { name, error } = cleanClassName(db, req.body?.name);
    if (error) return { error };
    return { made: studioClass(db, createClass(db, name, req.user.userId)) };
  });
  if (out.error) return res.status(400).json({ error: out.error });
  res.status(201).json(out.made);
});

// The count on the studio menu's "Classes" link.
router.get("/waiting", (req, res) => res.json({ reports: openReports(readDB()) }));

// Messages students have reported, with the few before each one.
router.get("/reports", (req, res) => res.json({ reports: teacherReports(readDB()) }));

// The reported message is fine: the reports go, the message stays.
router.post("/reports/:messageId/dismiss", (req, res) => {
  updateDB((db) => dismissReports(db, req.params.messageId));
  res.json({ ok: true });
});

// Remove a message from a chat (class room or private). Students see "Message removed".
router.delete("/messages/:id", (req, res) => {
  const ok = updateDB((db) => teacherRemove(db, req.params.id));
  if (!ok) return res.status(404).json({ error: "Message not found" });
  res.json({ ok: true });
});

// A new code for a class. The old one stops working at once; the students already in stay.
router.post("/:id/code", (req, res) => {
  const out = updateDB((db) => (renewClassCode(db, req.params.id) ? studioClass(db, classById(db, req.params.id)) : null));
  if (!out) return res.status(404).json(NO_CLASS);
  res.json(out);
});

// Rename a class: { name }.
router.put("/:id", (req, res) => {
  const out = updateDB((db) => {
    const cls = classById(db, req.params.id);
    if (!cls) return { status: 404, ...NO_CLASS };
    const { name, error } = cleanClassName(db, req.body?.name, cls.id);
    if (error) return { status: 400, error };
    cls.name = name;
    return { made: studioClass(db, cls) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out.made);
});

// Delete a class: its students are in no class again, and its chat, goals and class-only homework
// go with it (classrooms.js: deleteClass).
router.delete("/:id", (req, res) => {
  const gone = updateDB((db) => {
    const students = db.users.filter((u) => inClass(u) && u.classId === req.params.id).length;
    return deleteClass(db, req.params.id) ? { students } : null;
  });
  if (!gone) return res.status(404).json(NO_CLASS);
  res.json({ ok: true, ...gone });
});

// One class: its code, its students with the week each is having, and its chat room.
router.get("/:id", (req, res) => {
  const db = dbWithQuests();
  const cls = classById(db, req.params.id);
  if (!cls) return res.status(404).json(NO_CLASS);
  const snap = classSnapshot(db, cls.id);
  const goal = cupView(db).find((c) => c.id === cls.id) || null;
  res.json({
    classroom: studioClass(db, cls),
    code: cls.code,
    week: { start: snap.week },
    goal: goal ? { target: goal.target, xp: goal.xp, percent: goal.percent, reached: goal.reached, rank: goal.rank } : null,
    students: snap.members
      .map((m) => ({
        id: m.user.id,
        name: fullName(m.user),
        email: m.user.email || "",
        candidateId: m.user.candidateId,
        avatar: publicAvatar(m.user),
        level: m.level,
        streak: m.streak,
        muted: m.user.chatMuted === true,
        lastActive: m.p?.streak?.lastDate || null,
        week: { xp: m.week.xp, minutes: m.week.minutes, questions: m.week.questions, days: m.week.days, accuracy: m.week.questions ? m.week.correct / m.week.questions : null }
      }))
      .sort((a, b) => b.week.xp - a.week.xp || a.name.localeCompare(b.name)),
    homework: teacherHomework(db)
      .filter((h) => h.classIds.includes(cls.id))
      .map((h) => {
        const { students, started, finished, left, score } = h.classes.find((c) => c.id === cls.id);
        return { id: h.id, title: h.title, due: h.due, past: h.past, count: h.count, students, started, finished, left, score };
      }),
    chat: teacherRoom(db, cls.id)
  });
});

export default router;
