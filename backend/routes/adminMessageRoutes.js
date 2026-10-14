// The admin panel's inbox: what students wrote to the developers, and the replies (see
// messages.js). Admin only: these are written to the people who make the app, not to a teacher.
import { Router } from "express";
import { readDB, updateDB } from "../db.js";
import { requireAdmin } from "../auth.js";
import { MESSAGE_MAX, TOPICS, addMessage, cleanBody, conversations, markRead, publicMessage, publicStudent, threadOf, waitingCount } from "../messages.js";

const router = Router();
router.use(requireAdmin);

const studentOf = (db, id) => db.users.find((u) => u.id === id && u.role === "student");
// A reply also shows who in the studio wrote it.
const studioMessage = (db, m) => {
  const by = m.by ? db.users.find((u) => u.id === m.by) : null;
  return { ...publicMessage(m), by: by ? `${by.firstName || ""} ${by.lastName || ""}`.trim() || by.email : undefined };
};

router.get("/", (req, res) => {
  const db = readDB();
  res.json({ conversations: conversations(db), waiting: waitingCount(db), max: MESSAGE_MAX, topics: TOPICS });
});

// Just the number, for the badge on the studio's menu.
router.get("/waiting", (req, res) => res.json({ waiting: waitingCount(readDB()) }));

router.get("/:userId", (req, res) => {
  const db = readDB();
  const u = studentOf(db, req.params.userId);
  if (!u) return res.status(404).json({ error: "Student not found" });
  res.json({ student: publicStudent(u), messages: threadOf(db, u.id).map((m) => studioMessage(db, m)) });
});

router.post("/:userId", (req, res) => {
  const { body, error } = cleanBody(req.body?.body);
  if (error) return res.status(400).json({ error });
  const out = updateDB((db) => {
    const u = studentOf(db, req.params.userId);
    if (!u) return null;
    markRead(db, u.id, "student"); // answering a conversation is reading it
    return studioMessage(db, addMessage(db, { userId: u.id, from: "team", body, by: req.user.userId }));
  });
  if (!out) return res.status(404).json({ error: "Student not found" });
  res.status(201).json({ message: out });
});

router.post("/:userId/read", (req, res) => {
  const db = readDB();
  if (!studentOf(db, req.params.userId)) return res.status(404).json({ error: "Student not found" });
  if (db.messages.some((m) => m.userId === req.params.userId && m.from === "student" && !m.readAt)) updateDB((d) => markRead(d, req.params.userId, "student"));
  res.json({ ok: true, waiting: waitingCount(readDB()) });
});

// Removes a whole conversation, for the student as well (spam, or a thread that is finished with).
router.delete("/:userId", (req, res) => {
  const removed = updateDB((db) => {
    const before = db.messages.length;
    db.messages = db.messages.filter((m) => m.userId !== req.params.userId);
    return before - db.messages.length;
  });
  res.json({ ok: true, removed });
});

export default router;
