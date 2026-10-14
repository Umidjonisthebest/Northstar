// A tiny file-based "database".
// Not built for scale, but it is a real persistence layer with atomic writes
// that survives server restarts -- good enough for a mock-test platform used
// by a class, and easy to later swap for Postgres/SQLite (see README).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SLIM_QUESTIONS } from "./practiceContent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Overridable so tests can point at a throwaway file instead of the real dev database.
export const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "db.json");

const DEFAULT_DATA = {
  users: [], // {id, role: 'admin'|'student', firstName, lastName, email, phone, passwordHash?, candidateId?, status?: 'active'|'inactive'}
  tests: [], // {id, title, subject, description, modules: [{id, name, timeLimitMinutes, order, questions: [...]}]}
  sessions: [], // {id, name, description, studentLimit, sessionDate, sessionTime, status, testId, createdAt}
  participants: [], // {id, sessionId, userId, moduleStatus: {moduleId: 'not_started'|'in_progress'|'completed'}, moduleScores: {moduleId: {raw, max}}}
  attempts: [], // {id, participantId, sessionId, moduleId, answers: {questionId: answer}, startedAt, submittedAt, raw, max, seconds, timestamps: {questionId: {seen, answered}}} — timestamps are seconds from the module's start (ghost run, routes/examRoutes.js)
  // ---- Practice hub (merged from Northstar) ----
  practiceQuestions: [], // {id, section, domain, topic, difficulty, title, prompt, options, correctIndex, explanation, createdAt}
  vocab: [], // {id, word, pronunciation, partOfSpeech, definition, example}
  announcements: [], // {id, title, body, tone, pinned, createdAt}
  progress: [], // one per student, see routes/practiceRoutes.js -> getProgress()
  questionReports: [], // {id, questionId, userId, reason, comment, createdAt} — "Report" in the practice player
  messages: [], // {id, userId, from: 'student'|'team', body, topic?, by?, createdAt, readAt?} — a student's conversation with the developers, see messages.js
  stories: [], // {id, name, detail, exam, before, after, quote, tone, published, createdAt} — success stories on the cover page, see stories.js
  diagnostics: [], // SAT diagnostic tests: {id, userId, status, items, answers, flags, times, startedAt, deadline, limitSeconds, submittedAt, outcome, result} — see diagnostic.js
  practiceTestRuns: [], // a student's sittings of the practice tests: {id, userId, test, scope: 'full'|'rw'|'math', timed, status ('in_progress'|'completed'|'ended'|'cancelled'), cancelled: {at, kind, module}, startedAt, finishedAt, modules: [{key, status, startedAt, deadline, answers, flags, times, submittedAt, raw, max, answered, seconds, auto}], result, rewards, rewardSeenAt} — see practiceTests.js
  satPracticeTests: [], // practice tests the admin builds in the studio, in the shape of `tests` plus `published` and a `section` on each module — see satPracticeStudio.js
  satPracticeHidden: [], // keys of the file practice tests ("a" … "j") the admin has taken off the students' list
  leagues: [], // weekly leagues, one per week: {week, createdAt, groups: [{id, members: [userId]}], settledAt, results} — see leagues.js
  dailyStars: [], // the daily Northstar question, one per day: {date, designation, questionId, pass, section, topic, difficulty, createdAt, answers: {userId: {correct, given, at}}} — see dailyStar.js
  // ---- IELTS mock (see ielts/) — separate from the SAT sessions/attempts above ----
  ieltsListening: [], // one record per listening section (part 1-4), see ielts/lib/questions.js for `groups`
  ieltsReading: [], // one record per reading passage (part 1-3)
  ieltsWriting: [], // one record per writing task (1-2)
  ieltsSessions: [], // {id, name, description, date, time, studentLimit, status: 'created'|'started'|'completed', participantIds: [userId]}
  ieltsExams: [], // one per (session, candidate): assigned parts, section timers and answers, results, admin band scores
  ieltsAttempts: [], // one per submitted part — what the admin's "Attempt details" shows
  ieltsPracticeAttempts: [], // self-study practice in the student hub, see ielts/lib/practice.js
  ieltsDiagnostics: [], // IELTS diagnostic tests (one random listening or reading part), see ielts/lib/diagnostic.js
  ieltsPracticeTests: [], // full practice tests a student takes alone: {id, seedKey?, title, level, parts: {listening: [recordId], reading: [...], writing: [...]}, active} — see ielts/lib/practiceTests.js
  ieltsTestAttempts: [], // one per finished section of a practice test: {id, userId, testId, kind, correct?, total?, band?, words?, seconds, partAttemptIds, createdAt}
  // ---- Classes (made and named by teachers, joined with a class code; see classrooms.js) ----
  classes: [], // {id, name, code, createdAt, by?, codeAt?} — a class a teacher made; `code` is what a student types to join it
  homework: [], // {id, title, note, classIds: [classId], questionIds, due: 'YYYY-MM-DD', createdAt, by} — see homework.js
  classMessages: [], // {id, room: 'class:<classId>' | 'dm:<userId>:<userId>', from: userId, body, q?: questionId, re?: messageId, createdAt, deletedAt?, deletedBy?} — see classChat.js
  classReads: [], // {userId, room, at} — when a student last opened a chat room
  classReports: [], // {id, messageId, by: userId, reason, createdAt} — chat messages a student reported to the teachers
  classQuests: [], // {classId, week, students, target, createdAt, reachedAt, total?, closed?} — the weekly class goal, see classStats.js
  cheers: [], // {id, from: userId, to: userId, day, createdAt} — one classmate cheering another, once a day
  removedStarters: [], // {kind: "question"|"vocab", key} — starter content a teacher deleted, so the startup sync (app.js) doesn't bring it back
  aiUsage: [] // {date, total, byUser: {userId: count}} — Nova's AI replies per day, for the caps in aiLimits.js (the last 14 days)
};

// ---- Question-pack records are stored slim ----
// The owner's question pack (content/pack) is about 1,650 questions and 3 MB of text. Copied into
// the database whole, like the starter set, it would be parsed on every read and written again on
// every answer. So a pack question is stored as its id and key plus only what a teacher changed,
// and gets the rest of its content from the pack file each time the database is read. A field a
// teacher removed is stored as null. Everything outside this file sees ordinary, complete records.
// The owner's own question bank (content/originals, keys "nb-…") is stored the same way.
const PACK_BY_KEY = new Map(SLIM_QUESTIONS.map((q) => [q.key, q]));
const ALWAYS_STORED = new Set(["id", "key", "createdAt", "updatedAt"]);
const isPackKey = (key) => typeof key === "string" && /^(qb|nb)-/.test(key);
function slimQuestion(q) {
  const base = PACK_BY_KEY.get(q.key);
  if (!base) return q;
  const out = {};
  // Unchanged fields are the pack's own values (the same string, or the very same array).
  for (const k of Object.keys(q)) if (ALWAYS_STORED.has(k) || q[k] !== base[k]) out[k] = q[k];
  for (const k of Object.keys(base)) if (!(k in q)) out[k] = null;
  return out;
}
// Pack questions in the file when this checkout has no pack (or a pack without them) can't be shown,
// but they are a teacher's edits and every student's progress on those ids: they are kept aside on
// read and written back untouched.
const ASIDE = "__packQuestionsWithoutContent";
let warnedAside = false;
// The exception: the College Board question pack (keys "qb-…") was taken out of the app for good
// on 2026-10-13, at the owner's decision. A database from before still has its rows. They are
// dropped on read, so the next save writes the file without them (the day's backup, made before
// that save, still has them). Students' answers on those ids are left as they are.
const isRetiredKey = (key) => typeof key === "string" && key.startsWith("qb-");
let saidRetired = false;
function fillQuestions(data) {
  const kept = [];
  const aside = [];
  let retired = 0;
  for (const q of data.practiceQuestions) {
    const base = PACK_BY_KEY.get(q?.key);
    if (base) kept.push({ ...base, ...q });
    else if (isRetiredKey(q?.key)) retired += 1;
    else if (isPackKey(q?.key)) aside.push(q);
    else kept.push(q);
  }
  data.practiceQuestions = kept;
  if (retired && !saidRetired) {
    saidRetired = true;
    console.log(`[db] ${retired} question(s) of the removed question pack are no longer in the bank; their rows go at the next save.`);
  }
  if (aside.length) {
    Object.defineProperty(data, ASIDE, { value: aside, enumerable: false });
    if (!warnedAside) {
      warnedAside = true;
      console.error(`[db] ${aside.length} question(s) are in the database whose content this checkout doesn't have (backend/content/pack/questions.json, or the files in backend/content/originals). They are hidden, not deleted; restore the files to bring them back.`);
    }
  }
}

function ensureFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

// ---- Daily rotating backups ----
// The first write of each day copies the file as it stood just before that write into
// `backups/db-YYYY-MM-DD.json` next to the database, and only the newest DB_BACKUP_KEEP (7) are
// kept. A copy is only taken from a file that still parses, so a damaged file never becomes a backup.
const BACKUP_KEEP = Math.max(1, Number(process.env.DB_BACKUP_KEEP) || 7);
const backupDir = () => process.env.DB_BACKUP_DIR || path.join(path.dirname(DB_PATH), "backups");
const BACKUP_NAME = /^db-(\d{4}-\d{2}-\d{2})\.json$/;
let lastBackupDay = "";
// Switch off with DB_BACKUPS=off. Tests (node --test sets NODE_TEST_CONTEXT) use throwaway databases
// in the system temp folder, which shouldn't collect backups; a test that checks backups sets DB_BACKUPS=on.
const backupsEnabled = () => (process.env.DB_BACKUPS ? process.env.DB_BACKUPS !== "off" : !process.env.NODE_TEST_CONTEXT);

const isDatabaseObject = (v) => v && typeof v === "object" && !Array.isArray(v);

function backupFiles() {
  if (!backupsEnabled()) return [];
  try {
    return fs.readdirSync(backupDir()).filter((f) => BACKUP_NAME.test(f)).sort().reverse(); // newest first
  } catch {
    return [];
  }
}

function backupBeforeWrite() {
  if (!backupsEnabled()) return;
  const day = new Date().toISOString().slice(0, 10);
  if (day === lastBackupDay) return;
  try {
    const dir = backupDir();
    const target = path.join(dir, `db-${day}.json`);
    if (!fs.existsSync(target) && fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      if (isDatabaseObject(JSON.parse(raw))) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(target, raw);
      }
    }
    for (const old of backupFiles().slice(BACKUP_KEEP)) fs.rmSync(path.join(dir, old), { force: true });
    lastBackupDay = day;
  } catch {
    // A backup that can't be taken (full disk, an unreadable file) must never block the write itself.
  }
}

// The newest backup that still parses, or null.
function newestValidBackup() {
  for (const f of backupFiles()) {
    try {
      const raw = fs.readFileSync(path.join(backupDir(), f), "utf-8");
      if (isDatabaseObject(JSON.parse(raw))) return { file: f, raw };
    } catch {
      // try the next one
    }
  }
  return null;
}

// A database that can't be read is never replaced by an empty one. The damaged file is copied aside
// (once, as `<db>.unreadable-<time>`) so nothing recoverable is lost. Then the newest valid daily
// backup is restored; with no usable backup the error is raised: the request, or the server's start,
// fails loudly instead of quietly starting from zero.
let preservedUnreadable = false;
function unreadable(raw, reason) {
  if (!preservedUnreadable) {
    preservedUnreadable = true;
    try {
      fs.writeFileSync(`${DB_PATH}.unreadable-${Date.now()}`, raw);
    } catch {
      // best effort: the original file is still there
    }
  }
  const err = new Error(`The database file ${DB_PATH} could not be read (${reason}). A copy was saved next to it; repair or restore the file, then restart.`);
  err.code = "DB_UNREADABLE";
  return err;
}

// Called with the damaged file's text. Returns the restored data, or throws DB_UNREADABLE.
function recover(raw, reason) {
  const err = unreadable(raw, reason); // keeps the bad file
  const backup = newestValidBackup();
  if (!backup) throw err;
  const tmp = DB_PATH + ".tmp";
  fs.writeFileSync(tmp, backup.raw);
  fs.renameSync(tmp, DB_PATH);
  preservedUnreadable = false; // a later, separate failure gets its own copy
  console.error(`[db] ${DB_PATH} was unreadable (${reason}). Restored it from backups/${backup.file}; anything written since that backup was taken is only in the .unreadable-* copy next to it.`);
  return JSON.parse(backup.raw);
}

export function readDB() {
  ensureFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  let data;
  if (raw.trim() === "") {
    data = structuredClone(DEFAULT_DATA); // an empty file holds nothing to lose
  } else {
    try {
      data = JSON.parse(raw);
    } catch (e) {
      data = recover(raw, e.message);
    }
    if (!isDatabaseObject(data)) data = recover(raw, "it is not a JSON object");
  }
  // Backfill collections added after a db.json was first created, so older
  // databases keep working without a re-seed.
  for (const key of Object.keys(DEFAULT_DATA)) {
    if (!Array.isArray(data[key])) data[key] = [];
  }
  fillQuestions(data);
  return data;
}

// Whether a user id still exists. Sign-in checks it on every request, so the database is only
// re-read when its file has changed (a stat is far cheaper than parsing it). Without this a
// deleted student's token kept working for days, and each request quietly created an empty
// progress record for them again.
let knownUsers = { stamp: "", byId: new Map() };
// A user's sign-in state, or null when the account is gone. `signedOutBefore` is when their password
// last changed (reset, new temporary password): tokens issued before it are dead. `mustChangePassword`
// is set on a temporary password until the student chooses their own. `role` is what the account is
// now: a token signed for a teacher stops working when the account is removed or changed.
export function userAuthState(id) {
  ensureFile();
  const st = fs.statSync(DB_PATH);
  const stamp = `${st.mtimeMs}:${st.size}`;
  if (stamp !== knownUsers.stamp) {
    knownUsers = {
      stamp,
      byId: new Map(
        readDB().users.map((u) => [u.id, { role: u.role, signedOutBefore: Date.parse(u.passwordChangedAt || "") || 0, mustChangePassword: u.mustChangePassword === true }])
      )
    };
  }
  return knownUsers.byId.get(id) || null;
}
export const userExists = (id) => userAuthState(id) !== null;

export function writeDB(data) {
  ensureFile();
  backupBeforeWrite();
  const tmp = DB_PATH + ".tmp";
  const stored = Array.isArray(data?.practiceQuestions) ? { ...data, practiceQuestions: [...data.practiceQuestions.map(slimQuestion), ...(data[ASIDE] || [])] } : data;
  fs.writeFileSync(tmp, JSON.stringify(stored, null, 2));
  // On Windows the rename can fail for a moment (EPERM / EBUSY) while an antivirus scanner or
  // the search indexer holds the old file open. Retry briefly instead of failing the request.
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(tmp, DB_PATH);
      return;
    } catch (err) {
      if (attempt >= 6 || !["EPERM", "EBUSY", "EACCES"].includes(err.code)) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * (attempt + 1));
    }
  }
}

// Convenience: run a mutation against the DB and persist it.
export function updateDB(mutator) {
  const data = readDB();
  const result = mutator(data);
  writeDB(data);
  return result;
}
