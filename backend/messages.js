// Direct messages between a student and the developers: "Message Developers" in the student hub,
// "Messages" in the studio. One conversation per student, kept as plain rows in `db.messages`:
//   { id, userId, from: "student" | "team", body, topic?, by?, createdAt, readAt? }
// `userId` is always the student the conversation belongs to; `by` is the admin who wrote a reply.
// `readAt` is set when the other side opens the conversation.
import { nanoid } from "nanoid";
import { isDemoUser } from "./users.js";
import { publicAvatar } from "./avatars.js";

export const MESSAGE_MAX = 2000;
// How much one student can send. Counted from the stored messages, not per server instance, so the
// cap holds wherever the app runs.
export const HOURLY_LIMIT = 20;
export const DAILY_LIMIT = 60;

// What a message is about. Optional; it only helps the developers sort their inbox.
export const TOPICS = [
  { id: "bug", label: "Something is broken" },
  { id: "idea", label: "An idea" },
  { id: "question", label: "A question" }
];
const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));

const HOUR = 60 * 60 * 1000;

// Request bodies are untrusted: only a real string is a message. Line endings become "\n", control
// characters go, and a run of blank lines is cut to one. Returns { body } or { error }.
// (Class chats use it too, with their own, shorter limit: classChat.js.)
export function cleanBody(v, max = MESSAGE_MAX) {
  if (typeof v !== "string") return { error: "Write a message first" };
  const body = v
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!body) return { error: "Write a message first" };
  // Refused, not cut: half a message would be sent without the student knowing.
  if (body.length > max) return { error: `That message is too long (${max.toLocaleString("en-US")} characters at most)` };
  return { body };
}

export const cleanTopic = (v) => (TOPIC_IDS.has(v) ? v : undefined);

export const threadOf = (db, userId) => db.messages.filter((m) => m.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

// Replies the student hasn't opened yet (the badge in their menu).
export const unreadForStudent = (db, userId) => db.messages.filter((m) => m.userId === userId && m.from === "team" && !m.readAt).length;

// Why this student can't send right now, or null. The demo account is one login shared by every
// visitor, so anything written there would be shown to the next stranger: it can read, not send.
export function sendBlock(db, user, now = Date.now()) {
  if (isDemoUser(user)) return { code: 403, reason: "demo", error: "The demo account can't send messages. Create a free account to write to the developers." };
  const mine = db.messages.filter((m) => m.userId === user.id && m.from === "student").map((m) => Date.parse(m.createdAt));
  if (mine.filter((t) => now - t < HOUR).length >= HOURLY_LIMIT || mine.filter((t) => now - t < 24 * HOUR).length >= DAILY_LIMIT) {
    return { code: 429, reason: "limit", error: "You've sent a lot of messages. Please wait a while before sending more." };
  }
  return null;
}

export function addMessage(db, { userId, from, body, topic, by }) {
  const m = { id: nanoid(10), userId, from, body, createdAt: new Date().toISOString() };
  if (topic) m.topic = topic;
  if (by) m.by = by;
  db.messages.push(m);
  return m;
}

// Marks everything `from` wrote in this conversation as read. Returns how many were new.
export function markRead(db, userId, from) {
  const at = new Date().toISOString();
  let n = 0;
  for (const m of db.messages) {
    if (m.userId !== userId || m.from !== from || m.readAt) continue;
    m.readAt = at;
    n++;
  }
  return n;
}

// What either side is shown of a message. `by` (which admin replied) stays in the studio.
export const publicMessage = (m) => ({ id: m.id, from: m.from, body: m.body, topic: m.topic, createdAt: m.createdAt, read: Boolean(m.readAt) });

const fullName = (u) => `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "Student";

export const publicStudent = (u) => ({ id: u.id, name: fullName(u), email: u.email || "", candidateId: u.candidateId, avatar: publicAvatar(u) });

// The studio's inbox: one row per student who has a conversation, newest first.
export function conversations(db) {
  const byUser = new Map();
  for (const m of db.messages) {
    if (!byUser.has(m.userId)) byUser.set(m.userId, []);
    byUser.get(m.userId).push(m);
  }
  const rows = [];
  for (const [userId, list] of byUser) {
    const u = db.users.find((x) => x.id === userId && x.role === "student");
    if (!u) continue;
    const last = list.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
    rows.push({
      student: publicStudent(u),
      count: list.length,
      unread: list.filter((m) => m.from === "student" && !m.readAt).length,
      last: { from: last.from, preview: last.body.replace(/\s+/g, " ").slice(0, 140), topic: last.topic, createdAt: last.createdAt }
    });
  }
  return rows.sort((a, b) => b.last.createdAt.localeCompare(a.last.createdAt));
}

// Conversations waiting for the developers (the badge on the studio's menu).
export const waitingCount = (db) => new Set(db.messages.filter((m) => m.from === "student" && !m.readAt && db.users.some((u) => u.id === m.userId)).map((m) => m.userId)).size;
