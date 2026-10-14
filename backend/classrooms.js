// Classes: which ones there are, and who is in which.
//
// A class is made by a teacher in the studio, who gives it its name. There are no ready-made
// classes (the fixed grades 5 to 11 this started with are gone, see retireGradeClasses). Every
// class has a class code, and a student gets into a class by typing its code: sign-up doesn't ask,
// and nobody can put themselves in a chat of children by naming a class. Everyone who isn't in a
// class uses the app on their own exactly as before: no class, no teacher, no homework.
//
// db.classes rows: { id, name, code, createdAt, by?, codeAt? }
//
// On the user record:
//   classId     the class the student is in. Always a class that exists: deleteClass takes its
//               students out (classOf still answers null for one that doesn't)
//   noClass     true when they said "I don't have a class", or a teacher took them out of one:
//               the hub stops offering them the class code question
//   classSetAt  when the student last changed their class themselves (see classChangeOpensAt)
//   codeTries   { since, count }: wrong class codes typed lately (see joinWithCode)
//   chatMuted   true when a teacher has stopped the student writing in class chats (classChat.js)
//
// What a class does is elsewhere: classStats.js (study sessions, the weekly goal, cheers),
// homework.js and classChat.js.
import crypto from "crypto";
import { nanoid } from "nanoid";
import { isDemoUser } from "./users.js";
import { publicAvatar } from "./avatars.js";

export const CLASS = { nameMax: 40, max: 300 };
// A student who is in a class can move themselves to another one (or out) once in this many days.
// Joining is open to anyone with the code, and the first move is free, so a student who typed
// another class's code can be put right; after that it is rare on purpose: a class has a chat, and
// nobody should be able to wander through them. A teacher can always move a student from the studio.
export const CLASS_CHANGE_DAYS = 30;
// A class code: six characters a teacher can read out or write on a board. No I, L, O, 0 or 1,
// which are read as each other.
export const CODE_LENGTH = 6;
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
// Wrong codes one student may type before they have to wait: a code is given, never guessed.
export const CODE_TRIES = { max: 8, minutes: 30 };

const DAY_MS = 86400000;
const iso = (ms) => new Date(ms).toISOString();

// What stands for a class where a picture would go: "7A Math" is "7A", "Grade 7" is "G7",
// "Olympiad team" is "OT". Worked out here so every screen shows the same.
export function classMark(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const [first, second] = words;
  // A short first word with a digit in it is the class's own label ("7A", "10B").
  if (first.length <= 3 && /\d/.test(first)) return first.toUpperCase();
  return ([...first][0] + (second ? [...second][0] : [...first][1] || "")).toUpperCase();
}

// A class as the app shows it.
export const classInfo = (cls) => ({ id: cls.id, name: cls.name, mark: classMark(cls.name) });
export const classById = (db, id) => (typeof id === "string" ? db.classes.find((c) => c.id === id) || null : null);
// Every class, in the order of their names ("7A" before "10B").
export const allClasses = (db) => [...db.classes].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }));

// Whether a user is in a class at all, without looking the class up. The demo account is one login
// shared by every visitor, so it is never in a class, whatever its record says: a stranger would
// otherwise read, and write in, a chat of real students.
export const inClass = (user) => Boolean(user) && user.role === "student" && !isDemoUser(user) && typeof user.classId === "string" && user.classId !== "";

// The class a user is in ({ id, name, mark }), or null.
export function classOf(db, user) {
  const cls = inClass(user) ? classById(db, user.classId) : null;
  return cls ? classInfo(cls) : null;
}

// Whether the student has answered the class question: they are in a class, or said they have
// none. A new account hasn't, and the hub offers it the question.
export const schoolAsked = (db, user) => isDemoUser(user) || user?.noClass === true || classOf(db, user) !== null;

// What the app shows of a student's own class: goes out with their profile and with /progress.
export const classFields = (db, user) => ({ classroom: classOf(db, user), schoolAsked: schoolAsked(db, user) });

// Every student in a class.
export const classMembers = (db, id) => db.users.filter((u) => inClass(u) && u.classId === id);
export const sameClass = (a, b) => inClass(a) && inClass(b) && a.classId === b.classId;

// The room of a class's own chat (classChat.js); private rooms are "dm:<id>:<id>".
export const classRoom = (id) => `class:${id}`;

// ---------- Classes (the studio makes them) ----------
function newCode(taken) {
  for (;;) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!taken.has(code)) return code;
  }
}

// A class's name as a teacher typed it. Two classes can't share a name: the pickers and the
// students' own pages tell classes apart by it. Returns { name } or { error }.
export function cleanClassName(db, v, exceptId) {
  const name = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, CLASS.nameMax) : "";
  if (!name) return { error: "Give the class a name" };
  if (db.classes.some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase())) return { error: `There is already a class called ${name}` };
  return { name };
}

// A teacher makes a class: it gets its code there and then. `name` comes from cleanClassName.
export function createClass(db, name, by, now = Date.now()) {
  const cls = { id: nanoid(10), name, code: newCode(new Set(db.classes.map((c) => c.code))), createdAt: iso(now), ...(by ? { by } : {}) };
  db.classes.push(cls);
  return cls;
}

// A new code for a class, for one that has travelled further than the class. The old code stops
// working at once; the students already in stay. Returns the code, or null for no such class.
export function renewClassCode(db, id, now = Date.now()) {
  const cls = classById(db, id);
  if (!cls) return null;
  cls.code = newCode(new Set(db.classes.map((c) => c.code)));
  cls.codeAt = iso(now);
  return cls.code;
}

// A teacher deletes a class. Its students are simply in no class again (and can join another with
// its code straight away); what belonged to the class goes with it: its chat room, its weekly
// goals, and the homework and announcements that were for this class alone. Private chats between
// two students stay, and open again if they meet in another class. Returns the class, or null.
export function deleteClass(db, id) {
  const cls = classById(db, id);
  if (!cls) return null;
  db.classes = db.classes.filter((c) => c.id !== id);
  for (const u of db.users) {
    if (u.classId !== id) continue;
    delete u.classId;
    delete u.classSetAt;
  }
  const room = classRoom(id);
  const gone = new Set(db.classMessages.filter((m) => m.room === room).map((m) => m.id));
  db.classMessages = db.classMessages.filter((m) => !gone.has(m.id));
  db.classReports = db.classReports.filter((r) => !gone.has(r.messageId));
  db.classReads = db.classReads.filter((r) => r.room !== room);
  db.classQuests = db.classQuests.filter((q) => q.classId !== id);
  // Homework and announcements given to several classes stay for the others.
  const without = (rows) =>
    rows.filter((row) => {
      if (!Array.isArray(row.classIds) || !row.classIds.includes(id)) return true;
      row.classIds = row.classIds.filter((x) => x !== id);
      return row.classIds.length > 0;
    });
  db.homework = without(db.homework);
  db.announcements = without(db.announcements);
  return cls;
}

// The classes something is for, from what the studio sends: "all" (every class there is now) or a
// list of class ids. Unknown ids are dropped; the result is in the classes' own order.
export function cleanClassIds(db, v) {
  const asked = v === "all" ? null : new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  return allClasses(db).filter((c) => !asked || asked.has(c.id)).map((c) => c.id);
}

// ---------- Who is in which class ----------
// Puts a user in a class, or (null) out of every class. Only this writes classId and noClass.
export function placeStudent(user, id) {
  if (id) {
    user.classId = id;
    delete user.noClass;
  } else {
    delete user.classId;
    user.noClass = true;
  }
}

// What the studio sends to put a student in a class, move them or take them out: { classId }, a
// class's id or null. Staff choose the class directly; a student needs its code (joinWithCode).
// Returns { asked: false } when nothing was sent, { asked: true, classId } or { error }.
export function cleanClassChoice(db, body) {
  const v = body?.classId;
  if (v === undefined) return { asked: false };
  if (v === null || v === "") return { asked: true, classId: null };
  if (!classById(db, v)) return { error: "That class doesn't exist any more. Choose another." };
  return { asked: true, classId: v };
}

// When a student who is in a class may next move themselves (epoch ms), or 0 when they may now.
export function classChangeOpensAt(user, now = Date.now()) {
  if (!inClass(user)) return 0;
  const last = Date.parse(user.classSetAt || "");
  if (!last) return 0;
  const opens = last + CLASS_CHANGE_DAYS * DAY_MS;
  return opens > now ? opens : 0;
}

// A student's own change of class: into class `id` once its code has been checked (joinWithCode),
// or out of their class (null), which is also the answer "I don't have a class". Returns
// { changed } or { error, code }.
export function chooseClass(user, id, now = Date.now()) {
  if (isDemoUser(user)) return { code: 403, error: "The demo account can't join a class. Create a free account to join yours." };
  const current = inClass(user) ? user.classId : null;
  if (id ? current === id : !current && user.noClass === true) return { changed: false };
  const opens = classChangeOpensAt(user, now);
  if (opens) {
    const day = new Date(opens).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: process.env.APP_TIMEZONE || "Asia/Tashkent" });
    return { code: 409, error: `You changed your class recently. You can change it again on ${day}, or ask your teacher to move you.` };
  }
  placeStudent(user, id);
  if (current) user.classSetAt = iso(now); // leaving a class, or swapping it for another
  return { changed: true };
}

// ---------- Class codes ----------
// What a student typed, as a code is stored: capitals and digits only, so "k7q-m4x" and "K7Q M4X"
// both work. "" when it can't be a code.
export function cleanCode(v) {
  if (typeof v !== "string" || v.length > 40) return "";
  const code = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length === CODE_LENGTH ? code : "";
}

// When a student who has typed too many wrong codes may try again (epoch ms), or 0.
function codeTriesBlock(user, now) {
  const since = Date.parse(user.codeTries?.since || "");
  if (!since) return 0;
  const until = since + CODE_TRIES.minutes * 60000;
  if (until <= now) {
    delete user.codeTries;
    return 0;
  }
  return user.codeTries.count >= CODE_TRIES.max ? until : 0;
}

// A student joining a class with its code: the only way a student gets into one. Returns
// { changed } or { error, code }. Call it inside updateDB: it counts wrong codes on the user.
export function joinWithCode(db, user, typed, now = Date.now()) {
  if (isDemoUser(user)) return { code: 403, error: "The demo account can't join a class. Create a free account to join yours." };
  const code = cleanCode(typed);
  if (!code) return { code: 400, error: `Enter the ${CODE_LENGTH}-character class code your teacher gave you` };
  const blocked = codeTriesBlock(user, now);
  if (blocked) {
    const minutes = Math.max(1, Math.ceil((blocked - now) / 60000));
    return { code: 429, error: `Too many wrong codes. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or ask your teacher for the code.` };
  }
  const cls = db.classes.find((c) => c.code === code);
  if (!cls) {
    user.codeTries = { since: user.codeTries?.since || iso(now), count: (user.codeTries?.count || 0) + 1 };
    return { code: 400, error: "That class code isn't right. Check it with your teacher." };
  }
  delete user.codeTries;
  return chooseClass(user, cls.id, now);
}

// ---------- How students are shown ----------
// Classmates see each other by first name and last initial, like the league tables. Full names and
// email addresses stay in the studio.
export const classmateName = (u) => `${u?.firstName || "Student"}${u?.lastName ? ` ${u.lastName[0].toUpperCase()}.` : ""}`;
export const fullName = (u) => `${u?.firstName || ""} ${u?.lastName || ""}`.trim() || u?.email || "Student";

export const publicClassmate = (u) => ({ id: u.id, name: classmateName(u), avatar: publicAvatar(u) });

// ---------- The fixed classes that came first ----------
// Until 2026-10-12 a class was a grade, 5 to 11, that existed whether or not anyone taught it. The
// owner had them deleted: a class is now something a teacher makes. This takes the old ones out of
// a database that still has them (app.js runs it at startup): their students are in no class and
// are offered the class code question again, and the grade classes' chat rooms, weekly goals,
// codes, homework and class-only announcements go. Private chats and everything a student earned
// stay. Returns a note for the console, or null when there was nothing to do.
export function retireGradeClasses(db) {
  const gradeId = (id) => typeof id === "string" && /^g\d{1,2}$/.test(id);
  const gradeRoom = (room) => typeof room === "string" && /^class:g\d{1,2}$/.test(room);
  const students = db.users.filter((u) => u.school !== undefined || u.grade !== undefined);
  const rooms = db.classMessages.filter((m) => gradeRoom(m.room));
  const homework = db.homework.filter((h) => Array.isArray(h.grades));
  const notices = db.announcements.filter((a) => Array.isArray(a.grades));
  const classNotices = notices.filter((a) => a.grades.length > 0).length;
  const quests = db.classQuests.filter((q) => gradeId(q.classId));
  if (!students.length && !rooms.length && !homework.length && !notices.length && !quests.length && db.classCodes === undefined) return null;
  let moved = 0;
  for (const u of students) {
    if (u.school === "presidential") moved += 1;
    else if (u.school === "other") u.noClass = true; // they had answered: don't ask them again
    delete u.school;
    delete u.grade;
    delete u.classSetAt;
  }
  const gone = new Set(rooms.map((m) => m.id));
  db.classMessages = db.classMessages.filter((m) => !gone.has(m.id));
  db.classReports = db.classReports.filter((r) => !gone.has(r.messageId));
  db.classReads = db.classReads.filter((r) => !gradeRoom(r.room));
  db.classQuests = db.classQuests.filter((q) => !gradeId(q.classId));
  db.homework = db.homework.filter((h) => !Array.isArray(h.grades));
  // An announcement for certain grades has nobody left to read it; one for every class stays.
  db.announcements = db.announcements.filter((a) => !Array.isArray(a.grades) || a.grades.length === 0);
  for (const a of db.announcements) delete a.grades;
  delete db.classCodes;
  return `Retired the fixed grade classes: ${moved} student(s) taken out, ${gone.size} class chat message(s), ${homework.length} homework and ${classNotices} class announcement(s) removed. Teachers now make the classes.`;
}
