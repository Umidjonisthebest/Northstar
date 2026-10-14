// A student's class: one a teacher made, which the student joined with its class code. Mounted at
// /api/class. The rules are in classrooms.js (the classes, and who is in which), classStats.js
// (study sessions, the weekly goal, cheers), homework.js and classChat.js. The studio's side is
// routes/adminClassRoutes.js.
import { Router } from "express";
import { readDB, updateDB } from "../db.js";
import { requireStudent } from "../auth.js";
import { isDemoUser } from "../users.js";
import { CLASS_CHANGE_DAYS, CODE_LENGTH, chooseClass, classChangeOpensAt, classFields, classMembers, classOf, joinWithCode, publicClassmate } from "../classrooms.js";
import { cheer, cheersFor, classSnapshot, classmateView, classmatesView, compareView, cupView, ensureQuests, feedView, questView, studyingNow } from "../classStats.js";
import { homeworkFor, homeworkSummary, noteHomeworkLeave } from "../homework.js";
import { CHAT, REPORT_REASONS, markRoomRead, postMessage, removeOwn, reportMessage, resolveRoom, roomList, roomMessages, sendBlock, unreadTotal } from "../classChat.js";

const router = Router();
router.use(requireStudent);

const me = (db, req) => db.users.find((u) => u.id === req.studentUserId);

// Everything except the class page itself and joining is for students who are in a class.
const NOT_IN_CLASS = { status: 403, error: "This is for students who are in a class. You can join yours with its class code in Settings.", code: "NOT_IN_CLASS" };
const NO_ROOM = { status: 404, error: "That chat isn't open to you" };
const member = (db, req) => {
  const user = me(db, req);
  return classOf(db, user) ? user : null;
};
// Sends a refusal ({ status, error, code? }) and returns true, or returns false for anything else.
function refused(res, out) {
  if (!out?.error) return false;
  res.status(out.status || out.code || 400).json({ error: out.error, ...(typeof out.code === "string" ? { code: out.code } : {}) });
  return true;
}

// Reads the database with this week's class goals in place. Like the leagues, it only writes when
// something changed: a new week, or a class that has just reached its goal.
function dbWithQuests() {
  const db = readDB();
  if (!ensureQuests(db)) return db;
  return updateDB((fresh) => {
    ensureQuests(fresh);
    return fresh;
  });
}

const membership = (db, user) => {
  const opens = classChangeOpensAt(user);
  return { ...classFields(db, user), codeLength: CODE_LENGTH, demo: isDemoUser(user), changeDays: CLASS_CHANGE_DAYS, canChangeAt: opens ? new Date(opens).toISOString() : null };
};

// The class page: who is in it, the week so far, the class goal, and what is waiting. A student
// who isn't in a class gets what the "enter your class code" screen needs instead.
router.get("/", (req, res) => {
  const db = dbWithQuests();
  const user = me(db, req);
  const cls = classOf(db, user);
  if (!cls) return res.json({ member: false, ...membership(db, user) });
  const snap = classSnapshot(db, cls.id);
  res.json({
    member: true,
    ...membership(db, user),
    students: snap.members.length,
    studyingNow: studyingNow(snap, user.id),
    compare: compareView(snap, user.id),
    quest: questView(db, snap, user.id),
    cup: cupView(db, Date.now(), cls.id),
    feed: feedView(db, snap, user.id),
    cheers: cheersFor(db, user),
    homework: homeworkSummary(db, user),
    chat: { unread: unreadTotal(db, user), muted: user.chatMuted === true }
  });
});

// Join a class, or move to another, with its class code: { code }. Leave the class, or answer "I
// don't have a class": { leave: true }. Naming a class gets nobody in; only its code does.
router.put("/membership", (req, res) => {
  const body = req.body || {};
  const leaving = body.leave === true && body.code === undefined;
  if (!leaving && typeof body.code !== "string") return res.status(400).json({ error: "Enter the class code your teacher gave you" });
  const out = updateDB((db) => {
    const user = me(db, req);
    const done = leaving ? chooseClass(user, null) : joinWithCode(db, user, body.code);
    return done.error ? done : { view: membership(db, user) };
  });
  if (refused(res, out)) return;
  res.json(out.view);
});

// ---------- Classmates ----------
router.get("/classmates", (req, res) => {
  const db = readDB();
  const user = member(db, req);
  if (!user) return refused(res, NOT_IN_CLASS);
  const snap = classSnapshot(db, user.classId);
  res.json({ classroom: snap.classroom, week: { start: snap.week }, classmates: classmatesView(db, snap, user.id) });
});

// You next to one classmate: this week day by day, and each other's latest sessions.
router.get("/classmates/:id", (req, res) => {
  const db = readDB();
  const user = member(db, req);
  if (!user) return refused(res, NOT_IN_CLASS);
  const view = req.params.id === user.id ? null : classmateView(db, classSnapshot(db, user.classId), user.id, req.params.id);
  if (!view) return res.status(404).json({ error: "That student isn't in your class" });
  res.json(view);
});

router.post("/classmates/:id/cheer", (req, res) => {
  const out = updateDB((db) => {
    const user = member(db, req);
    return user ? cheer(db, user, db.users.find((u) => u.id === req.params.id)) : NOT_IN_CLASS;
  });
  if (refused(res, out)) return;
  res.status(201).json(out);
});

// ---------- Homework ----------
router.get("/homework", (req, res) => {
  const db = readDB();
  const user = member(db, req);
  if (!user) return refused(res, NOT_IN_CLASS);
  res.json({ classroom: classOf(db, user), homework: homeworkFor(db, user, { withClass: true }) });
});

// The homework page reports when the student leaves it and when they come back (homework.js):
// { event: "left" } or { event: "back", seconds }. The teacher sees the count; nothing is closed.
router.post("/homework/:id/leave", (req, res) => {
  const out = updateDB((db) => {
    const user = member(db, req);
    if (!user) return NOT_IN_CLASS;
    return { noted: Boolean(noteHomeworkLeave(db, user, req.params.id, req.body)) };
  });
  if (refused(res, out)) return;
  res.json(out);
});

// ---------- Chat ----------
// The student's rooms: the class room, and a private room with each classmate they have written with.
router.get("/chat", (req, res) => {
  const db = readDB();
  const user = member(db, req);
  if (!user) return refused(res, NOT_IN_CLASS);
  const block = sendBlock(db, user);
  res.json({
    rooms: roomList(db, user),
    classmates: classMembers(db, user.classId).filter((u) => u.id !== user.id).map(publicClassmate).sort((a, b) => a.name.localeCompare(b.name)),
    max: CHAT.max,
    canSend: !block,
    blocked: block ? { reason: block.reason, message: block.error } : null,
    reportReasons: REPORT_REASONS
  });
});

router.delete("/chat/messages/:id", (req, res) => {
  const out = updateDB((db) => {
    const user = member(db, req);
    return user ? removeOwn(db, user, req.params.id) : NOT_IN_CLASS;
  });
  if (refused(res, out)) return;
  res.json(out);
});

router.post("/chat/messages/:id/report", (req, res) => {
  const out = updateDB((db) => {
    const user = member(db, req);
    return user ? reportMessage(db, user, req.params.id, req.body?.reason) : NOT_IN_CLASS;
  });
  if (refused(res, out)) return;
  res.json(out);
});

// One room: "class", or "dm-<classmate id>". ?before=<time> pages back through older messages.
router.get("/chat/:room", (req, res) => {
  const db = readDB();
  const user = member(db, req);
  if (!user) return refused(res, NOT_IN_CLASS);
  const target = resolveRoom(db, user, req.params.room);
  if (!target) return refused(res, NO_ROOM);
  const before = typeof req.query.before === "string" && !Number.isNaN(Date.parse(req.query.before)) ? req.query.before : undefined;
  res.json({ key: target.key, kind: target.kind, with: target.other ? publicClassmate(target.other) : null, ...roomMessages(db, user, target.room, { before }) });
});

router.post("/chat/:room", (req, res) => {
  const out = updateDB((db) => {
    const user = member(db, req);
    if (!user) return NOT_IN_CLASS;
    const target = resolveRoom(db, user, req.params.room);
    if (!target) return NO_ROOM;
    const sent = postMessage(db, user, target.room, { body: req.body?.body, questionId: req.body?.questionId, replyTo: req.body?.replyTo });
    if (sent.error) return sent;
    markRoomRead(db, user.id, target.room); // writing in a room means you have read it
    return { message: roomMessages(db, user, target.room).messages.find((m) => m.id === sent.message.id) };
  });
  if (refused(res, out)) return;
  res.status(201).json(out);
});

router.post("/chat/:room/read", (req, res) => {
  const db = readDB();
  const user = member(db, req);
  if (!user) return refused(res, NOT_IN_CLASS);
  const target = resolveRoom(db, user, req.params.room);
  if (!target) return refused(res, NO_ROOM);
  // Most opens have nothing new: only write when there is, or when the room was never opened.
  const unread = roomList(db, user).find((r) => r.key === target.key)?.unread;
  if (unread || !db.classReads.some((r) => r.userId === user.id && r.room === target.room)) updateDB((fresh) => markRoomRead(fresh, user.id, target.room));
  res.json({ ok: true });
});

export default router;
