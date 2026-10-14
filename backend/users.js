// Helpers for the shared `users` collection (SAT and IELTS routes both use them).
import { randomInt } from "crypto";

// The "Try the demo" account (seed.js). It is a real login so visitors can look around, but it must
// never count as a student: not in leagues, rankings, class averages or the teacher's overview.
// Older databases have it without the flag, so the seeded address counts too.
export const DEMO_EMAIL = "student@example.com";
export const isDemoUser = (u) => u?.demo === true || (u?.email || "").trim().toLowerCase() === DEMO_EMAIL;

// Candidate IDs are short numeric strings ("101", "102", …) that students type on
// exam-room computers for the IELTS mock; new ones continue from the highest in use.
export function nextCandidateId(db) {
  const used = db.users.map((u) => Number(u.candidateId)).filter((n) => Number.isInteger(n) && n > 0);
  return String(Math.max(100, ...used) + 1);
}

// A temporary password the teacher hands to a student ("sat-k7m2q9xpd4"). It comes from the
// crypto generator, not Math.random (which is predictable), is always the same length (14
// characters: "sat-" and 10 random ones, about 50 bits), and leaves out the look-alike characters
// (0/o, 1/l/i) because it is read off a screen and typed in by hand. The account is flagged
// `mustChangePassword`, so the student replaces it at first sign-in.
const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function tempPassword() {
  let out = "sat-";
  for (let i = 0; i < 10; i++) out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  return out;
}
