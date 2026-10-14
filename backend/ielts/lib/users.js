import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { nextCandidateId } from "../../users.js";
import { cleanString } from "./http.js";
import { passwordProblem } from "../../validate.js";
import { forgetUser as forgetInClassChats } from "../../classChat.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s()-]{2,29}$/;

// Returns { value } or { error }. Pass `existingId` when editing.
export function validateUserInput(db, input, { existingId = null, creating = false } = {}) {
  const role = input.role === "admin" ? "admin" : "student";
  const firstName = cleanString(input.firstName, 60);
  const lastName = cleanString(input.lastName, 60);
  const email = cleanString(input.email, 120).toLowerCase();
  const phone = cleanString(input.phone, 30);
  const status = input.status === "inactive" ? "inactive" : "active";
  // Only a real string counts: `String({})` used to make "[object Object]" an admin's password.
  const password = typeof input.password === "string" ? input.password : "";

  if (!firstName) return { error: "First name is required" };
  if (!lastName) return { error: "Last name is required" };
  if (email && !EMAIL_RE.test(email)) return { error: "Please enter a valid email address" };
  if (email && db.users.some((u) => u.id !== existingId && (u.email || "").toLowerCase() === email)) {
    return { error: "A user with this email already exists" };
  }
  if (phone && phone !== "+998" && !PHONE_RE.test(phone)) return { error: "Please enter a valid phone number" };
  if (role === "admin") {
    if (!email) return { error: "Email is required for admin accounts" };
    const current = existingId ? db.users.find((u) => u.id === existingId) : null;
    const needsPassword = creating || !current?.passwordHash;
    const weak = (needsPassword || password) && passwordProblem(password);
    if (weak) return { error: `Admin ${weak.charAt(0).toLowerCase()}${weak.slice(1)}` };
  }
  return {
    // Email is optional for students; Northstar code expects a string.
    value: { role, firstName, lastName, email, phone: phone === "+998" ? null : phone || null, status },
    password: role === "admin" && password ? password : null
  };
}

export async function hashPassword(password) {
  return password ? bcrypt.hash(password, 10) : null;
}

// Students get the next candidate ID — that is what they type to start an IELTS mock.
export function insertUser(db, value, passwordHash) {
  const user = { id: nanoid(10), ...value, createdAt: new Date().toISOString() };
  if (user.role === "student") user.candidateId = nextCandidateId(db);
  if (passwordHash) user.passwordHash = passwordHash;
  db.users.push(user);
  return user;
}

// Deletes a user everywhere: IELTS sessions/exams/attempts and Northstar's SAT
// sessions and practice progress, so nothing is left pointing at a missing user.
export function removeUser(db, id) {
  db.users = db.users.filter((u) => u.id !== id);

  for (const s of db.ieltsSessions) s.participantIds = (s.participantIds || []).filter((pid) => pid !== id);
  const examIds = new Set(db.ieltsExams.filter((e) => e.userId === id).map((e) => e.id));
  db.ieltsExams = db.ieltsExams.filter((e) => !examIds.has(e.id));
  db.ieltsAttempts = db.ieltsAttempts.filter((a) => !examIds.has(a.examId));
  db.ieltsPracticeAttempts = db.ieltsPracticeAttempts.filter((a) => a.userId !== id);
  db.ieltsTestAttempts = (db.ieltsTestAttempts || []).filter((a) => a.userId !== id);
  db.ieltsDiagnostics = db.ieltsDiagnostics.filter((d) => d.userId !== id);

  const participantIds = new Set(db.participants.filter((p) => p.userId === id).map((p) => p.id));
  db.participants = db.participants.filter((p) => !participantIds.has(p.id));
  db.attempts = db.attempts.filter((a) => !participantIds.has(a.participantId));
  db.progress = db.progress.filter((p) => p.userId !== id);
  db.diagnostics = db.diagnostics.filter((d) => d.userId !== id);
  db.messages = db.messages.filter((m) => m.userId !== id);
  for (const star of db.dailyStars) delete star.answers[id];
  for (const league of db.leagues) for (const group of league.groups) group.members = group.members.filter((m) => m !== id);
  // Their class chat messages, private chats, reports and cheers.
  forgetInClassChats(db, id);
}
