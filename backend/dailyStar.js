// The daily Northstar question: one practice question a day, the same for
// every student. Each day has a star designation worked out from the date
// (two letters and four digits, like "JB1347"). A student gets one attempt,
// and solving the question "discovers" that day's star. The records live in
// db.dailyStars, one per day, created the first time anyone opens the day:
//   { date, designation, questionId, pass, section, topic, difficulty,
//     createdAt, answers: { userId: { correct, given, at } } }

import { dayDiff, todayKey } from "./gamification.js";
import { isUsable } from "./diagnostic.js";

const ANCHOR = "2026-01-01";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODES = 26 * 26 * 10000;
// STEP shares no factor with CODES (2^6 · 5^4 · 13^2), so stepping by it
// reaches every code once before any repeats: over 18,000 years of days.
const STEP = 2718281;
const SHIFT = 1618033;

// Stable and unique per day: the same date always gives the same designation,
// and no two dates share one.
export function designationFor(date) {
  const code = (((STEP * dayDiff(date, ANCHOR) + SHIFT) % CODES) + CODES) % CODES;
  return LETTERS[Math.floor(code / 260000)] + LETTERS[Math.floor(code / 10000) % 26] + String(code % 10000).padStart(4, "0");
}

function hashOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The day's question is picked from the ones that haven't had their day in
// the current pass through the bank, so nothing repeats until the bank is used
// up. The pick depends only on the date and on what earlier days used, so it
// is the same whoever opens the day first.
export function pickDailyQuestion(db, date) {
  const bank = db.practiceQuestions.filter(isUsable).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!bank.length) return null;
  const earlier = db.dailyStars.filter((s) => s.date < date).sort((a, b) => a.date.localeCompare(b.date));
  const last = earlier.at(-1);
  let pass = last?.pass ?? 0;
  const used = new Set(earlier.filter((s) => s.pass === pass).map((s) => s.questionId));
  let pool = bank.filter((q) => !used.has(q.id));
  if (!pool.length) {
    // Every question has had its day: the next pass begins, without repeating yesterday's.
    pass += 1;
    pool = bank.length > 1 ? bank.filter((q) => q.id !== last?.questionId) : bank;
  }
  return { question: pool[hashOf(date) % pool.length], pass };
}

// The record for a day, created (and its question fixed) on first use. Null
// when the bank has no usable question.
export function ensureDailyStar(db, date = todayKey()) {
  const existing = db.dailyStars.find((s) => s.date === date);
  if (existing) return existing;
  const pick = pickDailyQuestion(db, date);
  if (!pick) return null;
  const q = pick.question;
  const star = { date, designation: designationFor(date), questionId: q.id, pass: pick.pass, section: q.section, topic: q.topic, difficulty: q.difficulty, createdAt: new Date().toISOString(), answers: {} };
  db.dailyStars.push(star);
  return star;
}

// How everyone did. Shown to a student only after their own attempt.
export function starStats(star) {
  const all = Object.values(star.answers);
  const correct = all.filter((a) => a.correct).length;
  return { answered: all.length, solved: correct, percentCorrect: all.length ? Math.round((correct / all.length) * 100) : null };
}

// The student's "Discovered stars": every day they solved, newest first.
export function catalogFor(db, userId) {
  const mine = db.dailyStars.filter((s) => s.answers[userId]).sort((a, b) => b.date.localeCompare(a.date));
  const found = mine.filter((s) => s.answers[userId].correct);
  return {
    attempted: mine.length,
    discovered: found.length,
    stars: found.map((s) => ({ date: s.date, designation: s.designation, section: s.section, topic: s.topic, difficulty: s.difficulty, at: s.answers[userId].at, ...starStats(s) }))
  };
}

// A result to share: the star, the outcome and how the class did. Nothing
// about the question or its answer, so it can't spoil the day for anyone.
export function shareText(star, mine, discovered) {
  const day = new Date(`${star.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const { percentCorrect } = starStats(star);
  return [
    `Northstar daily star, ${day}`,
    mine.correct ? `I discovered ${star.designation}.` : `I went looking for ${star.designation}. It stays hidden for now.`,
    `${percentCorrect}% of students solved today's question.`,
    `Stars I've discovered: ${discovered}`
  ].join("\n");
}

// For the dashboard and the sidebar: where the student stands today. Reads
// only: the day's record is created by the Daily Star page, not by this.
export function dailyStatus(db, userId, date = todayKey()) {
  const star = db.dailyStars.find((s) => s.date === date);
  const mine = star?.answers[userId] || null;
  return {
    date,
    attempted: Boolean(mine),
    discovered: Boolean(mine?.correct),
    designation: mine ? star.designation : null,
    total: db.dailyStars.filter((s) => s.answers[userId]?.correct).length
  };
}

// While today's question is still waiting for the student's one attempt, it
// can't be checked, explained or remixed in the practice player.
export function dailyLockedId(db, userId, date = todayKey()) {
  const star = db.dailyStars.find((s) => s.date === date);
  return star && !star.answers[userId] ? star.questionId : null;
}
