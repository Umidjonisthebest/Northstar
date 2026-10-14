// Class chats: one room for the whole class, and private rooms between two classmates.
//
// db.classMessages rows: { id, room, from, body, q?, re?, createdAt, deletedAt?, deletedBy? }
//   room  "class:<class id>" (everyone in that class) or "dm:<userId>:<userId>" (the two ids in order)
//   q     a question-bank id: the message shares that question ("can anyone help with this one?")
//   re    the id of the message it answers
// A class's room is there from the moment the class has a student: nothing has to be opened, the
// first student to join can write. A room belongs to the class as it is now: a student who moves to
// another class stops seeing the old class's room, and a private room is open only while both
// students are in the same class.
//
// Keeping it safe (the students are children):
//   - The demo account is never in a class (classrooms.js), so it can't read or write here.
//   - Teachers can read every class room from the studio and remove any message.
//   - Private rooms aren't open to teachers, but either student can report a message, and the
//     report shows the teacher the messages just before it.
//   - A teacher can pause a student's messages (user.chatMuted): they can read but not write.
//   - Text only, 1,000 characters, and at most 12 messages a minute and 300 a day per student,
//     counted from the stored rows so the limit holds wherever the app runs.
import { nanoid } from "nanoid";
import { cleanBody } from "./messages.js";
import { classById, classMembers, classOf, classRoom, classmateName, fullName, publicClassmate, sameClass } from "./classrooms.js";
import { questionCard } from "./homework.js";

export const CHAT = {
  max: 1000,
  perMinute: 12,
  perDay: 300,
  keep: 1000, // messages kept per room; older ones go
  page: 100, // messages sent to the page at a time
  reportsPerDay: 20,
  newDays: 3 // a room never opened counts only its last few days as unread
};

export const REPORT_REASONS = [
  { id: "unkind", label: "Unkind or bullying" },
  { id: "spam", label: "Spam or off-topic" },
  { id: "unsafe", label: "It makes me uncomfortable" },
  { id: "other", label: "Something else" }
];
const REASON_IDS = new Set(REPORT_REASONS.map((r) => r.id));

const MINUTE = 60000;
const DAY_MS = 86400000;
const iso = (ms) => new Date(ms).toISOString();

export { classRoom };
export const dmRoom = (a, b) => `dm:${[a, b].sort().join(":")}`;
const dmPair = (room) => (room.startsWith("dm:") ? room.slice(3).split(":") : null);
const otherOf = (room, meId) => {
  const pair = dmPair(room);
  return pair && pair.length === 2 && pair.includes(meId) ? (pair[0] === meId ? pair[1] : pair[0]) : null;
};

// The page names a room from the student's side: "class", or "dm-<the other student's id>".
// Returns { room, kind, other? } or null when this student can't be in that room.
export function resolveRoom(db, me, key) {
  const cls = classOf(db, me);
  if (!cls || typeof key !== "string") return null;
  if (key === "class") return { room: classRoom(cls.id), kind: "class", key };
  if (!key.startsWith("dm-")) return null;
  const other = db.users.find((u) => u.id === key.slice(3));
  if (!other || other.id === me.id || !sameClass(me, other)) return null;
  return { room: dmRoom(me.id, other.id), kind: "dm", key, other };
}

// Whether this student can see a stored room right now.
function canSee(db, me, room) {
  const cls = classOf(db, me);
  if (!cls) return false;
  if (room === classRoom(cls.id)) return true;
  const otherId = otherOf(room, me.id);
  return Boolean(otherId) && sameClass(me, db.users.find((u) => u.id === otherId));
}

// Why this student can't write right now, or null.
export function sendBlock(db, me, now = Date.now()) {
  if (me.chatMuted) return { code: 403, reason: "muted", error: "A teacher has paused your messages for now. You can still read the chat." };
  const mine = db.classMessages.filter((m) => m.from === me.id).map((m) => Date.parse(m.createdAt));
  if (mine.filter((t) => now - t < MINUTE).length >= CHAT.perMinute) return { code: 429, reason: "limit", error: "You're sending messages very fast. Wait a moment, then try again." };
  if (mine.filter((t) => now - t < DAY_MS).length >= CHAT.perDay) return { code: 429, reason: "limit", error: "You've sent a lot of messages today. You can write again tomorrow." };
  return null;
}

// Adds a message to a room the caller has already resolved. `questionId` shares a bank question
// (the text is then optional); `replyTo` is the message being answered.
export function postMessage(db, me, room, { body, questionId, replyTo } = {}, now = Date.now()) {
  const block = sendBlock(db, me, now);
  if (block) return block;
  const sharing = questionId !== undefined && questionId !== null;
  let textBody = "";
  if (!(sharing && (body === undefined || body === null || (typeof body === "string" && !body.trim())))) {
    const clean = cleanBody(body, CHAT.max);
    if (clean.error) return { code: 400, error: clean.error };
    textBody = clean.body;
  }
  const m = { id: nanoid(10), room, from: me.id, body: textBody, createdAt: iso(now) };
  if (sharing) {
    const q = db.practiceQuestions.find((x) => x.id === questionId);
    if (!q) return { code: 404, error: "That question isn't in the question bank" };
    m.q = q.id;
  }
  if (typeof replyTo === "string") {
    const parent = db.classMessages.find((x) => x.id === replyTo && x.room === room && !x.deletedAt);
    if (parent) m.re = parent.id;
  }
  db.classMessages.push(m);
  // A room keeps its newest messages; reports about ones that have gone go with them.
  const inRoom = db.classMessages.filter((x) => x.room === room);
  if (inRoom.length > CHAT.keep) {
    const drop = new Set(inRoom.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, inRoom.length - CHAT.keep).map((x) => x.id));
    db.classMessages = db.classMessages.filter((x) => !drop.has(x.id));
    db.classReports = db.classReports.filter((r) => !drop.has(r.messageId));
  }
  return { message: m };
}

const preview = (m, questions) => (m.deletedAt ? "Message removed" : (m.body || (m.q ? `Question: ${questions.get(m.q)?.title || "a shared question"}` : "")).replace(/\s+/g, " ").slice(0, 120));

// Turns stored rows into what a student's page gets. Built once per request (it indexes the
// users, messages and questions).
function shaper(db, meId) {
  const users = new Map(db.users.map((u) => [u.id, u]));
  const byId = new Map(db.classMessages.map((m) => [m.id, m]));
  const questions = new Map(db.practiceQuestions.map((q) => [q.id, q]));
  const who = (id) => (users.has(id) ? publicClassmate(users.get(id)) : { id: null, name: "Former classmate", avatar: null });
  const shape = (m) => {
    const parent = m.re ? byId.get(m.re) : null;
    const q = m.q && !m.deletedAt ? questions.get(m.q) : null;
    return {
      id: m.id,
      mine: m.from === meId,
      from: who(m.from),
      body: m.deletedAt ? "" : m.body,
      deleted: Boolean(m.deletedAt),
      // A shared question: its card, or a note that it has left the bank since.
      question: m.q && !m.deletedAt ? (q ? questionCard(q) : { gone: true }) : null,
      replyTo: parent ? { id: parent.id, name: who(parent.from).name, preview: preview(parent, questions) } : null,
      createdAt: m.createdAt
    };
  };
  return { shape, questions, users };
}

// A room's messages, oldest first: the newest page, or the page before `before` (an ISO time).
export function roomMessages(db, me, room, { before } = {}) {
  const { shape } = shaper(db, me.id);
  const all = db.classMessages.filter((m) => m.room === room && (!before || m.createdAt < before)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { messages: all.slice(-CHAT.page).map(shape), more: all.length > CHAT.page };
}

const readsOf = (db, userId) => new Map(db.classReads.filter((r) => r.userId === userId).map((r) => [r.room, r.at]));

// The student's rooms: the class room first, then private rooms, the latest on top. A private
// room appears once it has a message.
export function roomList(db, me, now = Date.now()) {
  const cls = classOf(db, me);
  if (!cls) return [];
  const { questions } = shaper(db, me.id);
  const reads = readsOf(db, me.id);
  const fresh = iso(now - CHAT.newDays * DAY_MS);
  const mates = new Map(classMembers(db, cls.id).filter((u) => u.id !== me.id).map((u) => [u.id, u]));
  const home = classRoom(cls.id);
  const rooms = new Map([[home, { last: null, unread: 0 }]]);
  for (const m of db.classMessages) {
    if (m.room !== home && !mates.has(otherOf(m.room, me.id))) continue;
    if (!rooms.has(m.room)) rooms.set(m.room, { last: null, unread: 0 });
    if (m.deletedAt) continue;
    const r = rooms.get(m.room);
    if (!r.last || m.createdAt > r.last.createdAt) r.last = m;
    if (m.from !== me.id && m.createdAt > (reads.get(m.room) || fresh)) r.unread += 1;
  }
  const out = [];
  for (const [room, r] of rooms) {
    const other = room === home ? null : mates.get(otherOf(room, me.id));
    if (room !== home && !r.last) continue;
    out.push({
      key: room === home ? "class" : `dm-${other.id}`,
      kind: room === home ? "class" : "dm",
      name: room === home ? `${cls.name} chat` : classmateName(other),
      avatar: other ? publicClassmate(other).avatar : null,
      students: room === home ? mates.size + 1 : undefined,
      unread: r.unread,
      last: r.last ? { preview: preview(r.last, questions), at: r.last.createdAt, mine: r.last.from === me.id, name: r.last.from === me.id ? "You" : mates.get(r.last.from)?.firstName || "Classmate" } : null
    });
  }
  return out.sort((a, b) => Number(b.kind === "class") - Number(a.kind === "class") || String(b.last?.at || "").localeCompare(String(a.last?.at || "")));
}

// Messages the student hasn't seen, over all their rooms (the badge on "My Class").
export const unreadTotal = (db, me, now = Date.now()) => roomList(db, me, now).reduce((s, r) => s + r.unread, 0);

export function markRoomRead(db, userId, room, now = Date.now()) {
  const row = db.classReads.find((r) => r.userId === userId && r.room === room);
  if (row) row.at = iso(now);
  else db.classReads.push({ userId, room, at: iso(now) });
}

// A student takes back their own message. The row stays, so the conversation keeps its shape.
export function removeOwn(db, me, id, now = Date.now()) {
  const m = db.classMessages.find((x) => x.id === id);
  if (!m || m.from !== me.id || !canSee(db, me, m.room)) return { code: 404, error: "Message not found" };
  if (!m.deletedAt) {
    m.deletedAt = iso(now);
    m.deletedBy = "author";
  }
  return { ok: true };
}

// A student reports a message to the teachers. Reporting the same one twice changes nothing.
export function reportMessage(db, me, id, reason, now = Date.now()) {
  const m = db.classMessages.find((x) => x.id === id);
  if (!m || m.deletedAt || !canSee(db, me, m.room)) return { code: 404, error: "Message not found" };
  if (m.from === me.id) return { code: 400, error: "That's your own message. You can delete it instead." };
  if (db.classReports.some((r) => r.messageId === id && r.by === me.id)) return { ok: true };
  if (db.classReports.filter((r) => r.by === me.id && now - Date.parse(r.createdAt) < DAY_MS).length >= CHAT.reportsPerDay) return { code: 429, error: "You've sent a lot of reports today. Tell your teacher directly if something is wrong." };
  db.classReports.push({ id: nanoid(10), messageId: id, by: me.id, reason: REASON_IDS.has(reason) ? reason : "other", createdAt: iso(now) });
  return { ok: true };
}

// ---------- The studio's side ----------
function teacherShaper(db) {
  const users = new Map(db.users.map((u) => [u.id, u]));
  const questions = new Map(db.practiceQuestions.map((q) => [q.id, q]));
  const reported = new Map();
  for (const r of db.classReports) reported.set(r.messageId, (reported.get(r.messageId) || 0) + 1);
  const who = (id) => {
    const u = users.get(id);
    return u ? { id: u.id, name: fullName(u), email: u.email || "", className: classOf(db, u)?.name || null, muted: u.chatMuted === true } : { id: null, name: "Deleted account", email: "", className: null, muted: false };
  };
  // The studio sees a removed message's text too: it may be exactly what needs looking at.
  const shape = (m) => ({
    id: m.id,
    from: who(m.from),
    body: m.body,
    deleted: Boolean(m.deletedAt),
    deletedBy: m.deletedBy || null,
    question: m.q ? (questions.has(m.q) ? questionCard(questions.get(m.q)) : { gone: true }) : null,
    reports: reported.get(m.id) || 0,
    createdAt: m.createdAt
  });
  return { shape, who, users };
}

// A class room as the teacher reads it: the newest messages, oldest first.
export function teacherRoom(db, classId, limit = 200) {
  const { shape } = teacherShaper(db);
  const room = classRoom(classId);
  return db.classMessages.filter((m) => m.room === room).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-limit).map(shape);
}

// Reported messages, the latest report first: the message, who reported it and why, and the
// messages just before it in the same room.
export function teacherReports(db) {
  const { shape, who, users } = teacherShaper(db);
  const byMessage = new Map();
  for (const r of db.classReports) {
    if (!byMessage.has(r.messageId)) byMessage.set(r.messageId, []);
    byMessage.get(r.messageId).push(r);
  }
  const out = [];
  for (const [messageId, reports] of byMessage) {
    const m = db.classMessages.find((x) => x.id === messageId);
    if (!m) continue;
    const pair = dmPair(m.room);
    const cls = pair ? null : classById(db, m.room.slice("class:".length));
    const room = pair
      ? { kind: "dm", label: `Private chat: ${pair.map((id) => (users.has(id) ? fullName(users.get(id)) : "deleted account")).join(" and ")}` }
      : { kind: "class", label: `${cls?.name || "A deleted class"} chat`, classId: cls?.id || null };
    const earlier = db.classMessages.filter((x) => x.room === m.room && x.createdAt < m.createdAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-6);
    out.push({
      messageId,
      room,
      message: shape(m),
      context: earlier.map(shape),
      reports: reports.map((r) => ({ by: who(r.by), reason: REPORT_REASONS.find((x) => x.id === r.reason)?.label || "Something else", at: r.createdAt })),
      latest: reports.reduce((a, r) => (r.createdAt > a ? r.createdAt : a), "")
    });
  }
  return out.sort((a, b) => b.latest.localeCompare(a.latest));
}

// Messages waiting for a teacher to look at them (the badge on the studio's "Classes" link).
export const openReports = (db) => new Set(db.classReports.filter((r) => db.classMessages.some((m) => m.id === r.messageId)).map((r) => r.messageId)).size;

// A teacher removes a message: students see "Message removed", and its reports are settled.
export function teacherRemove(db, id, now = Date.now()) {
  const m = db.classMessages.find((x) => x.id === id);
  if (!m) return false;
  if (!m.deletedAt || m.deletedBy !== "teacher") {
    m.deletedAt = m.deletedAt || iso(now);
    m.deletedBy = "teacher";
  }
  db.classReports = db.classReports.filter((r) => r.messageId !== id);
  return true;
}

// A teacher decides a reported message is fine: the reports go, the message stays.
export function dismissReports(db, messageId) {
  const before = db.classReports.length;
  db.classReports = db.classReports.filter((r) => r.messageId !== messageId);
  return before !== db.classReports.length;
}

// Everything a deleted account leaves behind in the chats.
export function forgetUser(db, id) {
  const gone = new Set(db.classMessages.filter((m) => m.from === id || dmPair(m.room)?.includes(id)).map((m) => m.id));
  db.classMessages = db.classMessages.filter((m) => !gone.has(m.id));
  db.classReads = db.classReads.filter((r) => r.userId !== id);
  db.classReports = db.classReports.filter((r) => r.by !== id && !gone.has(r.messageId));
  db.cheers = db.cheers.filter((c) => c.from !== id && c.to !== id);
}
