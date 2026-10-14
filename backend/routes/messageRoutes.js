// A student's conversation with the developers (see messages.js for the rules).
import { Router } from "express";
import { readDB, updateDB } from "../db.js";
import { requireStudent } from "../auth.js";
import { MESSAGE_MAX, TOPICS, addMessage, cleanBody, cleanTopic, markRead, publicMessage, sendBlock, threadOf, unreadForStudent } from "../messages.js";

const router = Router();
router.use(requireStudent);

const me = (db, req) => db.users.find((u) => u.id === req.studentUserId);

// The whole conversation. Opening it doesn't mark anything read: the page says when it has shown
// the replies (POST /read), so a reply fetched in a background tab stays new.
router.get("/", (req, res) => {
  const db = readDB();
  const block = sendBlock(db, me(db, req));
  res.json({
    messages: threadOf(db, req.studentUserId).map(publicMessage),
    unread: unreadForStudent(db, req.studentUserId),
    canSend: !block,
    blocked: block ? { reason: block.reason, message: block.error } : null,
    max: MESSAGE_MAX,
    topics: TOPICS
  });
});

router.post("/", (req, res) => {
  const { body, error } = cleanBody(req.body?.body);
  if (error) return res.status(400).json({ error });
  const topic = cleanTopic(req.body?.topic);
  const out = updateDB((db) => {
    const block = sendBlock(db, me(db, req));
    if (block) return block;
    return { message: addMessage(db, { userId: req.studentUserId, from: "student", body, topic }) };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.status(201).json({ message: publicMessage(out.message) });
});

router.post("/read", (req, res) => {
  // Most opens have nothing new: only write when there is.
  if (unreadForStudent(readDB(), req.studentUserId)) updateDB((db) => markRead(db, req.studentUserId, "team"));
  res.json({ ok: true, unread: 0 });
});

export default router;
