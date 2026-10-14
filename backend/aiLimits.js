// Spending limits for Nova's AI replies. Every AI-backed reply costs money, so a student (or a
// script holding a student's token) can't run it up: each student gets a daily allowance, and the
// whole school shares a daily total. When either is used up Nova answers from the built-in tutor
// in tutor.js instead, which is free and never runs out.
//
// Counts live in `db.aiUsage` (one row per day, the last 14 kept). The day follows APP_TIMEZONE,
// like streaks and the daily question (todayKey).

import { todayKey } from "./gamification.js";

const KEEP_DAYS = 14;
const whole = (v, fallback) => (Number.isInteger(Number(v)) && Number(v) >= 0 && v !== "" && v != null ? Number(v) : fallback);

// Read on every call so a test (or a redeploy-free .env change on restart) can change them.
export function aiLimits(env = process.env) {
  return {
    perStudent: whole(env.TUTOR_DAILY_PER_STUDENT, 30),
    total: whole(env.TUTOR_DAILY_TOTAL, 400),
    maxTokens: Math.max(200, whole(env.TUTOR_MAX_TOKENS, 1500))
  };
}

// Takes one AI reply from the student's allowance and the daily total, or says why it can't.
// Call it inside updateDB, before the request to the model: a failed request still counts, which
// stops a retry loop from being free.
export function takeAiReply(db, userId, now = new Date(), limits = aiLimits()) {
  const date = todayKey(now);
  let row = db.aiUsage.find((r) => r.date === date);
  if (!row) {
    row = { date, total: 0, byUser: {} };
    db.aiUsage.push(row);
    db.aiUsage.sort((a, b) => b.date.localeCompare(a.date));
    db.aiUsage.length = Math.min(db.aiUsage.length, KEEP_DAYS);
  }
  const mine = row.byUser[userId] || 0;
  if (mine >= limits.perStudent) return { ok: false, reason: "student", used: mine, limit: limits.perStudent };
  if (row.total >= limits.total) return { ok: false, reason: "daily", used: row.total, limit: limits.total };
  row.byUser[userId] = mine + 1;
  row.total += 1;
  return { ok: true, used: mine + 1, limit: limits.perStudent };
}
