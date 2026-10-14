// XP, levels, streaks, daily goals and badges — shared by practice and exam
// routes so every kind of study counts toward the same progress.

import { CHUNKS, giveChunks, openWallet } from "./shop.js";

export const TZ = process.env.APP_TIMEZONE || "Asia/Tashkent";

export function todayKey(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
}

export function dayOffset(key, delta) {
  const d = new Date(key + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Monday of the week containing `key`.
export function weekKey(key = todayKey()) {
  const d = new Date(key + "T12:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  return dayOffset(key, -dow);
}

// The instant a calendar day starts in the app's timezone, as epoch ms.
function tzOffsetMs(at) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(at));
  const v = Object.fromEntries(parts.map((x) => [x.type, Number(x.value)]));
  return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - Math.floor(at / 1000) * 1000;
}
export function dayStartMs(key) {
  const utc = Date.parse(key + "T00:00:00Z");
  return utc - tzOffsetMs(utc - tzOffsetMs(utc));
}

// Whole days from `b` to `a` (both YYYY-MM-DD).
export const dayDiff = (a, b) => Math.round((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 86400000);

// The art for each badge lives in the frontend (<Medal id=… />), keyed by id.
// `desc` says how to earn it; `cheer` is the line on the trophy card once it is earned.
export const BADGES = {
  first_steps: { name: "First Steps", desc: "Answer your first practice question", cheer: "Every climb starts with one question. This was yours." },
  pathfinder: { name: "Pathfinder", desc: "Finish a diagnostic test", cheer: "You found out where you stand. Now the map makes sense." },
  combo_5: { name: "On Fire", desc: "Get 5 answers right in a row", cheer: "Five in a row. That is focus, not luck." },
  combo_10: { name: "Unstoppable", desc: "Get 10 answers right in a row", cheer: "Ten clean answers without a slip. Hard to stop you now." },
  streak_3: { name: "Habit Builder", desc: "Study 3 days in a row", cheer: "Three days running. A habit has started." },
  streak_7: { name: "Week Warrior", desc: "Study 7 days in a row", cheer: "A whole week without a gap. That is how scores move." },
  perfect_drill: { name: "Flawless", desc: "Score 100% on a drill of 5+ questions", cheer: "Not one miss in the whole drill. Clean work." },
  mistake_crusher: { name: "Mistake Crusher", desc: "Clear a saved mistake by answering it right", cheer: "You went back to a question that beat you, and won." },
  mock_finisher: { name: "Test Taker", desc: "Complete your first mock exam module", cheer: "A real timed module, from the first question to the last." },
  full_test: { name: "Full Send", desc: "Finish every module of a mock exam", cheer: "Every module, start to finish. You know what test day feels like." },
  word_nerd: { name: "Word Nerd", desc: "Master 10 vocabulary words (80%+)", cheer: "Ten words that are yours for good." },
  planner: { name: "Plan Keeper", desc: "Complete 5 study-plan tasks in one week", cheer: "Five plan tasks finished in one week. Steady work pays off." },
  level_5: { name: "Rising Star", desc: "Reach level 5", cheer: "Level 5. You are well off the ground." },
  goal_crusher: { name: "Goal Crusher", desc: "Hit your daily XP goal", cheer: "You hit your XP goal for the day. That is a full day's work." },
  returning_star: { name: "Returning Star", desc: "A welcome-back gift after some time away", cheer: "You came back. That matters more than the days away." },
  combo_20: { name: "Meteor Shower", desc: "Get 20 answers right in a row", cheer: "Twenty in a row. A run like that takes real control." },
  streak_14: { name: "Fortnight", desc: "Study 14 days in a row", cheer: "Two weeks of showing up, day after day." },
  streak_30: { name: "Full Moon", desc: "Study 30 days in a row", cheer: "Thirty days in a row. Studying is part of your day now." },
  level_10: { name: "Bright Star", desc: "Reach level 10", cheer: "Level 10. That took a lot of questions." },
  level_20: { name: "Giant Star", desc: "Reach level 20", cheer: "Level 20. One of the brightest stars in the sky." },
  century: { name: "Century", desc: "Solve 100 different questions", cheer: "One hundred different questions solved. The bank is starting to feel smaller." },
  galaxy_brain: { name: "Galaxy Brain", desc: "Solve 500 different questions", cheer: "Five hundred solved. There is not much the test can surprise you with now." },
  hard_hitter: { name: "Hard Hitter", desc: "Solve 10 hard questions on the first try", cheer: "Ten hard questions, each one right on the first try." },
  clean_slate: { name: "Clean Slate", desc: "Clear 10 saved mistakes", cheer: "Ten old mistakes, all put right." },
  drill_10: { name: "Drill Captain", desc: "Finish 10 drills", cheer: "Ten drills done. Practice is routine for you now." },
  lexicon: { name: "Lexicon", desc: "Master 50 vocabulary words (80%+)", cheer: "Fifty words mastered. Hard passages read easier now." },
  stargazer: { name: "Stargazer", desc: "Discover a daily star", cheer: "You found the day's star. A new one rises tomorrow." }
};

// Badges that climb the same ladder, lowest rung first. `need` is what each rung takes (the same
// numbers as the rules in award() and scorePracticeAnswer()), `have` counts how far the student is
// and `tally` words that count for the trophy card. The mock exam pair has nothing to count.
const BADGE_LADDERS = [
  { ids: ["combo_5", "combo_10", "combo_20"], need: [5, 10, 20], have: (p) => p.bestCombo || 0, tally: (h, n) => `Best run so far: ${h} of ${n} in a row` },
  { ids: ["streak_3", "streak_7", "streak_14", "streak_30"], need: [3, 7, 14, 30], have: (p) => streakOf(p).current, tally: (h, n) => `Streak right now: ${h} of ${n} days` },
  { ids: ["level_5", "level_10", "level_20"], need: [5, 10, 20], have: (p) => levelInfo(p.xp).level, tally: (h, n) => `Level ${h} of ${n}` },
  { ids: ["century", "galaxy_brain"], need: [100, 500], have: (p) => Object.values(p.answered).filter((e) => e.correct > 0).length, tally: (h, n) => `${h} of ${n} questions solved` },
  { ids: ["word_nerd", "lexicon"], need: [10, 50], have: (p) => Object.values(p.vocab).filter((m) => m >= 80).length, tally: (h, n) => `${h} of ${n} words mastered` },
  { ids: ["mistake_crusher", "clean_slate"], need: [1, 10], have: (p) => Object.values(p.answered).filter((e) => e.clearedBonus).length, tally: (h, n) => `${h} of ${n} mistakes cleared` },
  { ids: ["mock_finisher", "full_test"] }
];

// Where a badge sits on its ladder, for the trophy card: its rung, and the next rung the student
// hasn't earned yet with how far along they are. Null for a badge that stands on its own.
export function badgeLadder(p, id) {
  const ladder = BADGE_LADDERS.find((l) => l.ids.includes(id));
  if (!ladder) return null;
  const at = ladder.ids.indexOf(id);
  const nextAt = ladder.ids.findIndex((x, i) => i > at && !p.badges.some((b) => b.id === x));
  if (nextAt === -1) return { step: at + 1, size: ladder.ids.length, next: null };
  const next = { id: ladder.ids[nextAt] };
  if (ladder.need) {
    next.need = ladder.need[nextAt];
    // A count already past the mark means the badge lands with the next piece of work.
    next.have = Math.min(ladder.have(p), next.need);
    next.tally = ladder.tally(next.have, next.need);
  }
  return { step: at + 1, size: ladder.ids.length, next };
}

// XP needed to go from level L to L+1 grows gently: 100, 150, 200, ...
export function levelInfo(xp) {
  let level = 1;
  let floor = 0;
  let need = 100;
  while (xp >= floor + need) {
    floor += need;
    level += 1;
    need = 100 + (level - 1) * 50;
  }
  return { level, xpIntoLevel: xp - floor, xpForNext: need };
}

export function getProgress(db, userId) {
  let p = db.progress.find((x) => x.userId === userId);
  if (!p) {
    p = {
      userId,
      xp: 0,
      xpLog: {}, // { 'YYYY-MM-DD': xp }
      days: {}, // { 'YYYY-MM-DD': "active" | "repaired" } — the day history behind the streak and the sky
      streak: { current: 0, longest: 0, lastDate: null }, // worked out from `days` (see touchStreak)
      combo: 0,
      bestCombo: 0,
      answered: {}, // { questionId: { attempts, correct, lastCorrect, lastAt } }
      saved: [], // practice question ids in the mistakes queue
      flagged: [], // practice question ids marked "for review" (bank browsing, not a mistake)
      examMistakes: [], // wrong answers from mock exams, mirrored into the same queue (see routes/examRoutes.js)
      vocab: {}, // { vocabId: mastery 0-100 }
      plan: {}, // { weekKey: [taskIndex, ...] } — the study-plan tasks finished each week (weekPlan.js)
      drills: [], // { at, total, correct }
      badges: [], // { id, earnedAt }
      review: {}, // { questionId: { box, due, lapses } } — the spaced-review schedule (see "Spaced review")
      reviewGraduated: 0, // questions that have left the schedule after their last review
      reasons: {}, // { questionId | "exam:<key>": { r, at } } — the student's own "why I missed it" (review.js)
      targetScore: 1400,
      dailyGoal: 50
    };
    db.progress.push(p);
  }
  // Backfill fields added after some progress records already existed.
  if (!Array.isArray(p.examMistakes)) p.examMistakes = [];
  if (!Array.isArray(p.flagged)) p.flagged = [];
  if (!Array.isArray(p.revealed)) p.revealed = []; // question ids whose explanation was opened before a correct answer
  if (!p.notes || typeof p.notes !== "object") p.notes = {}; // { questionId: text } — player notes
  if (p.currentScore === undefined) p.currentScore = null; // self-reported current SAT score (overrides the estimate)
  if (p.examDate === undefined) p.examDate = null; // chosen SAT date: an iso from SAT_DATES or the student's own "YYYY-MM-DD"; null = the next official one
  if (p.targetAccuracy === undefined) p.targetAccuracy = 0.9; // the accuracy the point-gap map and the study plan aim for (planning.js)
  if (p.ieltsTarget === undefined) p.ieltsTarget = 7;
  if (!Array.isArray(p.answerLog)) {
    // One entry per graded answer: { q: questionId, at, ok, ms?, a?: assisted }. Older
    // records only kept the latest attempt per question, so seed the log from that.
    p.answerLog = Object.entries(p.answered || {})
      .filter(([, a]) => a?.lastAt)
      .map(([q, a]) => ({ q, at: a.lastAt, ok: Boolean(a.lastCorrect) }))
      .sort((x, y) => x.at.localeCompare(y.at));
  }
  // XP bookkeeping (see "XP rules" below).
  if (!p.daily || typeof p.daily !== "object") p.daily = { date: null }; // counters that reset each day
  if (!Array.isArray(p.remixPaid)) p.remixPaid = []; // generated-question ids that have paid out
  // { weekKey: [taskIndex] } tasks that have paid out. Tasks ticked before this existed were paid then.
  if (!p.planPaid || typeof p.planPaid !== "object") p.planPaid = Object.fromEntries(Object.entries(p.plan || {}).map(([week, list]) => [week, [...list]]));
  if (p.weekPlan === undefined) p.weekPlan = null; // this week's fixed plan: { week, tasks, words: [vocabId rated this week] } (weekPlan.js)
  if (!p.ieltsXp || typeof p.ieltsXp !== "object") p.ieltsXp = {}; // { ieltsRecordId: xp paid so far }
  if (!p.testXp || typeof p.testXp !== "object") p.testXp = {}; // { "<practice test>:<module>": xp paid so far }
  if (!p.ieltsTests || typeof p.ieltsTests !== "object") p.ieltsTests = {}; // { practiceTestId: [section kinds that have paid their comet chunks, then "whole"] }
  if (p.drill === undefined) p.drill = null; // the drill being worked on: { at, ids, fresh }
  if (!Array.isArray(p.examRewards)) p.examRewards = []; // rewards earned in mock exams, shown on the results page
  // Streaks and the sky (see "Streaks and the Northstar sky" below).
  if (!p.days || typeof p.days !== "object") {
    // Before the day history existed, every day with an XP log entry was an
    // active day, and so were the days the stored streak ran over.
    p.days = {};
    for (const day of Object.keys(p.xpLog || {})) if (DAY_KEY.test(day)) p.days[day] = "active";
    if (p.streak?.lastDate) for (let i = 0; i < (p.streak.current || 0); i++) p.days[dayOffset(p.streak.lastDate, -i)] = "active";
  }
  if (p.repair === undefined) p.repair = null; // the open repair drill: { day, ids, startedAt }
  if (p.returned === undefined) p.returned = null; // { day, daysAway } set by the first activity after a break
  if (p.welcome === undefined) p.welcome = null; // the last welcome-back gift: { at, daysAway, xp, newBadge, seenAt }
  // Weekly leagues (leagues.js): the tier (0 = lowest) and how past weeks ended.
  if (!p.league || typeof p.league !== "object") p.league = { tier: 0, history: [] };
  // Monthly recaps (recap.js): the kept recaps, newest first; the last month
  // worked out; and the newest month the student has opened.
  if (!Array.isArray(p.recaps)) p.recaps = [];
  if (p.recapThrough === undefined) p.recapThrough = null;
  if (p.recapSeen === undefined) p.recapSeen = null;
  // Spaced review. A student who already had a mistakes queue starts with it on the schedule:
  // each question is due the day after it was last missed, so the old ones are due straight away.
  if (!p.review || typeof p.review !== "object") {
    p.review = {};
    for (const id of p.saved) {
      const a = p.answered[id];
      if (a && !a.lastCorrect && a.lastAt) p.review[id] = { box: 0, due: dayOffset(todayKey(new Date(a.lastAt)), REVIEW_GAPS[0]), lapses: 0 };
    }
  }
  if (typeof p.reviewGraduated !== "number") p.reviewGraduated = 0;
  if (!p.reasons || typeof p.reasons !== "object") p.reasons = {};
  // Comet chunks (shop.js). An account from before they existed starts with what its levels and
  // trophies would have paid, and keeps whatever its profile picture is wearing.
  if (!p.wallet || typeof p.wallet !== "object") {
    const earned = CHUNKS.levelUp * (levelInfo(p.xp).level - 1) + CHUNKS.trophy * p.badges.length;
    p.wallet = openWallet({ earned, avatar: db.users?.find((u) => u.id === userId)?.avatar });
  }
  return p;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const LOG_LIMIT = 5000;

export function logAnswer(p, entry) {
  p.answerLog.push(entry);
  if (p.answerLog.length > LOG_LIMIT) p.answerLog.splice(0, p.answerLog.length - LOG_LIMIT);
}

// ---------- Streaks and the Northstar sky ----------
// progress.days is the day history: every day the student studied is a lit
// star, a repaired day is a star of its own kind, and a day that isn't there
// was missed. Nothing is ever removed, so the sky is never wiped. The streak
// numbers are worked out from it.
export const STARS_PER_CONSTELLATION = 7;
const AWAY_DAYS = 3; // days since the last active day that count as "back after a break"
const WELCOME_EVERY_DAYS = 14; // the welcome-back gift comes at most this often
export const REPAIR_SIZE = 10; // questions in a repair drill
const REPAIR_DAYS = 2; // a missed day can be repaired for 48 hours after it ends
const REPAIR_GRACE_MS = 30 * 60000; // to finish a drill that was started inside the window
const DAY_MS = 86400000;

function runEndingAt(days, end) {
  let n = 0;
  for (let d = end; days[d]; d = dayOffset(d, -1)) n += 1;
  return n;
}

// Marks today as an active day (once) and refreshes the cached streak.
function touchStreak(p, today = todayKey()) {
  if (p.days[today]) return;
  const last = p.streak.lastDate;
  p.days[today] = "active";
  p.streak.current = runEndingAt(p.days, today);
  p.streak.longest = Math.max(p.streak.longest, p.streak.current);
  p.streak.lastDate = today;
  // Back after a break. Remembered so the welcome-back gift still arrives when
  // the first thing the student opens is a question rather than the hub.
  if (last && dayDiff(today, last) >= AWAY_DAYS) p.returned = { day: today, daysAway: dayDiff(today, last) };
}

// The streak as it stands today: it is still running if the student studied
// today or yesterday.
export function streakOf(p, today = todayKey()) {
  const current = runEndingAt(p.days, p.days[today] ? today : dayOffset(today, -1));
  return { current, longest: Math.max(p.streak.longest, current), lastDate: p.streak.lastDate, activeToday: Boolean(p.days[today]) };
}

// The whole sky, one mark per day from the first star to today:
// "1" lit, "r" repaired, "0" missed (a dim star), "t" today, not lit yet.
// Every seven lit stars make a constellation, whatever lies between them.
export function skyOf(p, today = todayKey()) {
  const first = Object.keys(p.days).filter((d) => d <= today).sort()[0];
  let marks = "";
  let lit = 0;
  let repaired = 0;
  let missed = 0;
  for (let d = first; d && d <= today; d = dayOffset(d, 1)) {
    const kind = p.days[d];
    if (kind === "repaired") {
      marks += "r";
      lit += 1;
      repaired += 1;
    } else if (kind) {
      marks += "1";
      lit += 1;
    } else if (d === today) {
      marks += "t";
    } else {
      marks += "0";
      missed += 1;
    }
  }
  return {
    start: first || null,
    marks,
    lit,
    repaired,
    missed,
    perConstellation: STARS_PER_CONSTELLATION,
    constellations: Math.floor(lit / STARS_PER_CONSTELLATION),
    toward: lit % STARS_PER_CONSTELLATION
  };
}

// ---------- Repair ----------
// When exactly one day is missing between active days, it can be relit for
// 48 hours after it ended by finishing a repair drill (any score).
function repairOpen(p, day, now, graceMs = 0) {
  if (p.days[day] || !p.days[dayOffset(day, -1)]) return false;
  if (now >= dayStartMs(dayOffset(day, 1 + REPAIR_DAYS)) + graceMs) return false;
  const today = todayKey(new Date(now));
  if (day >= today) return false;
  // Exactly one missed day: every day since then, up to yesterday, was active.
  for (let d = dayOffset(day, 1); d < today; d = dayOffset(d, 1)) if (!p.days[d]) return false;
  return true;
}

export function repairableDay(p, now = Date.now()) {
  const today = todayKey(new Date(now));
  for (let back = 1; back <= REPAIR_DAYS; back++) {
    const day = dayOffset(today, -back);
    if (repairOpen(p, day, now)) return day;
  }
  return null;
}

const repairAnswered = (p, repair) => {
  const since = new Set(p.answerLog.filter((e) => e.at >= repair.startedAt).map((e) => e.q));
  return repair.ids.filter((id) => since.has(id));
};

// What the hub shows: the day that can be relit, until when, and how far the drill is.
export function repairStatus(p, now = Date.now()) {
  const day = repairableDay(p, now);
  if (!day) return null;
  const open = p.repair?.day === day ? p.repair : null;
  return {
    day,
    lastDay: dayOffset(day, REPAIR_DAYS), // the window is open through the end of this day
    closesAt: new Date(dayStartMs(dayOffset(day, 1 + REPAIR_DAYS))).toISOString(),
    streak: runEndingAt(p.days, dayOffset(day, -1)), // the streak the missed day interrupted
    started: Boolean(open),
    total: open ? open.ids.length : REPAIR_SIZE,
    answered: open ? repairAnswered(p, open).length : 0
  };
}

// Opens the repair drill for the day that can be relit, or returns the one
// already open. `pick(n)` supplies the question ids. Null when no day qualifies.
export function startRepair(p, pick, now = Date.now()) {
  const day = repairableDay(p, now);
  if (!day) return null;
  if (p.repair?.day !== day) {
    const ids = pick(REPAIR_SIZE);
    if (!ids.length) return null;
    p.repair = { day, ids, startedAt: new Date(now).toISOString() };
  }
  return p.repair;
}

// Called after every graded answer. Once each drill question has an answer
// logged since the drill began (right or wrong), the missed day becomes a
// repaired star and the streak is joined up again. `inBank(id)` lets a
// question a teacher deleted meanwhile drop out instead of blocking the drill.
export function settleRepair(p, inBank = () => true, now = Date.now()) {
  const repair = p.repair;
  if (!repair) return { state: "none" };
  const ids = repair.ids.filter(inBank);
  if (!ids.length || !repairOpen(p, repair.day, now, Date.parse(repair.startedAt) < dayStartMs(dayOffset(repair.day, 1 + REPAIR_DAYS)) ? REPAIR_GRACE_MS : 0)) {
    p.repair = null;
    return { state: "closed", day: repair.day };
  }
  const answered = repairAnswered(p, { ...repair, ids });
  if (answered.length < ids.length) return { state: "open", day: repair.day, total: ids.length, remaining: ids.length - answered.length };
  p.days[repair.day] = "repaired";
  p.repair = null;
  const last = [p.streak.lastDate, repair.day].filter(Boolean).sort().at(-1);
  p.streak.lastDate = last;
  p.streak.current = runEndingAt(p.days, last);
  p.streak.longest = Math.max(p.streak.longest, p.streak.current);
  return { state: "repaired", day: repair.day, total: ids.length, remaining: 0, streak: streakOf(p, todayKey(new Date(now))).current };
}

// ---------- Welcome back ----------
// A student who returns after a few days away is given a small gift, with
// nothing to do for it: at most once every 14 days, and only when there was
// earlier activity to be away from.
export function welcomeBackStatus(p, now = Date.now()) {
  const today = todayKey(new Date(now));
  let daysAway = 0;
  if (!p.days[today]) daysAway = p.streak.lastDate ? dayDiff(today, p.streak.lastDate) : 0;
  else if (p.returned && dayDiff(today, p.returned.day) <= 1) daysAway = p.returned.daysAway;
  const recent = Boolean(p.welcome) && now - Date.parse(p.welcome.at) < WELCOME_EVERY_DAYS * DAY_MS;
  return {
    eligible: !recent && daysAway >= AWAY_DAYS,
    daysAway,
    // Given but not shown yet: the hub keeps showing the screen until it is acknowledged.
    pending: p.welcome && !p.welcome.seenAt ? { daysAway: p.welcome.daysAway, xp: p.welcome.xp, newBadge: Boolean(p.welcome.newBadge) } : null
  };
}

export function claimWelcomeBack(p, now = Date.now()) {
  const status = welcomeBackStatus(p, now);
  if (!status.eligible) return null;
  // A gift, not study: it doesn't light today's star.
  const reward = award(p, XP.welcomeBack, ["returning_star"], { activity: false });
  p.welcome = { at: new Date(now).toISOString(), daysAway: status.daysAway, xp: XP.welcomeBack, newBadge: reward.newBadges.some((b) => b.id === "returning_star"), seenAt: null };
  p.returned = null;
  return { reward, daysAway: status.daysAway, xp: XP.welcomeBack, newBadge: p.welcome.newBadge };
}

export function ackWelcomeBack(p) {
  if (p.welcome && !p.welcome.seenAt) p.welcome.seenAt = new Date().toISOString();
}

// Award XP, update streak, and collect any newly unlocked badges.
// Returns a "reward" object the frontend uses for celebrations.
// `activity: false` is for gifts that aren't study, so they don't light a star.
// Comet chunks are paid here too, at milestones only (shop.js has the amounts): the first work of
// the day, the daily goal, a new level, a new trophy, and whatever the caller adds as
// `chunks: [amount, why]` (or a list of those). They are a separate count from XP and never change it.
export function award(p, amount, extraBadgeIds = [], { activity = true, chunks = null } = {}) {
  const before = levelInfo(p.xp).level;
  const today = todayKey();
  const goalBefore = (p.xpLog[today] || 0) >= p.dailyGoal;
  const firstToday = activity && !p.days[today];

  p.xp += amount;
  p.xpLog[today] = (p.xpLog[today] || 0) + amount;
  // When the XP total last grew: equal weekly XP in a league is ranked by who got there first.
  if (amount > 0) p.lastXpAt = new Date().toISOString();
  if (activity) touchStreak(p);

  const after = levelInfo(p.xp).level;
  const streak = streakOf(p).current;
  const candidates = [...extraBadgeIds];
  if (streak >= 3) candidates.push("streak_3");
  if (streak >= 7) candidates.push("streak_7");
  if (streak >= 14) candidates.push("streak_14");
  if (streak >= 30) candidates.push("streak_30");
  if (after >= 5) candidates.push("level_5");
  if (after >= 10) candidates.push("level_10");
  if (after >= 20) candidates.push("level_20");
  if (!goalBefore && p.xpLog[today] >= p.dailyGoal) candidates.push("goal_crusher");

  const newBadges = [];
  for (const id of candidates) {
    if (BADGES[id] && !p.badges.some((b) => b.id === id)) {
      p.badges.push({ id, earnedAt: new Date().toISOString() });
      newBadges.push({ id, ...BADGES[id] });
    }
  }

  const goalReached = !goalBefore && p.xpLog[today] >= p.dailyGoal;
  const paid = [
    firstToday && [CHUNKS.firstStudy, "First study of the day"],
    goalReached && [CHUNKS.dailyGoal, "Daily goal reached"],
    after > before && [CHUNKS.levelUp * (after - before), `Reached level ${after}`],
    ...newBadges.map((b) => [CHUNKS.trophy, `Trophy: ${b.name}`]),
    ...(Array.isArray(chunks?.[0]) ? chunks : [chunks])
  ].filter(Boolean);

  return {
    xpGained: amount,
    leveledUp: after > before,
    level: after,
    newBadges,
    goalReached,
    chunksGained: paid.reduce((sum, [n, why]) => sum + giveChunks(p, n, why), 0)
  };
}

// ---------- XP rules ----------
// Every XP amount is decided here. Routes report what happened; these
// functions say what it is worth, and keep the bookkeeping that stops the same
// work from being paid twice (so XP can't be farmed by repeating it).
export const XP = {
  question: { Easy: 8, Medium: 12, Hard: 18, Challenging: 24 }, // a bank question's full XP, paid once per question
  assistedShare: 0.3, // share of the full XP for a retry, or an answer after opening the explanation
  firstMiss: 1, // a wrong first attempt at a question
  review: 1, // answering an already-solved question again, once a day per question
  reviewDailyCap: 10,
  combo: 2, // bonus from the third clean first-time solve in a row
  mistakeCleared: 5, // clearing a saved mistake, once per question
  spacedReview: 3, // still knowing a missed question when it comes back for review, once per review date
  remix: { Easy: 3, Medium: 5, Hard: 7 }, // a generated variant, once per variant
  remixDailyCap: 60,
  drillMin: 5, // questions a drill needs before it can be "perfect"
  drillPerNew: 2, // finishing a drill: per question in it that wasn't solved before...
  drillComplete: 10, // ...up to this much
  drillPerfectPerNew: 4, // a perfect drill: per such question on top...
  drillPerfect: 20, // ...up to this much
  vocab: 2, // a vocabulary word practised (a flashcard rated, or a right answer in Learn or Match), once a day per word
  vocabDailyCap: 40,
  planTask: 15, // a study-plan task, once per task per week
  examMistake: 5, // marking a mock-exam mistake as reviewed
  examModule: 25, // submitting a mock-exam module
  examCorrect: 10, // each correct answer in it
  examPerfect: 50,
  diagnostic: 20, // finishing a diagnostic test, on top of its questions
  welcomeBack: 30, // the gift for returning after a break (nothing to do for it)
  dailyStar: 5, // solving the daily Northstar question, on top of the question's own XP
  ieltsPart: 5, // an IELTS listening or reading part, plus per correct answer by level
  ieltsCorrect: { EASY: 2, MEDIUM: 3, HARD: 4 },
  ieltsEssay: { EASY: 12, MEDIUM: 15, HARD: 20 }, // an essay that reaches the minimum length
  ieltsEssayShort: 5
};

export const questionXp = (difficulty) => XP.question[difficulty] ?? XP.question.Medium;

// The "How to earn XP" list on the Trophies page, so it can't drift from the rules.
export function xpGuide() {
  const q = XP.question;
  return [
    [`${q.Easy}/${q.Medium}/${q.Hard}/${q.Challenging}`, "first correct answer on an easy / medium / hard / challenging question"],
    [`+${XP.combo}`, "combo bonus from 3 new questions right in a row"],
    [`+${XP.mistakeCleared}`, "clearing a saved mistake"],
    [`+${XP.spacedReview}`, "getting a missed question right when it comes back for review"],
    [`${XP.review}`, "solving a question again that you had already solved (once a day each)"],
    [`+${XP.dailyStar}`, "discovering the daily star"],
    [`+${XP.examCorrect}`, `each correct mock-exam answer (+${XP.examModule} per module)`],
    [`+${XP.drillComplete + XP.drillPerfect}`, "perfect drill of new questions"],
    [`${XP.planTask}`, "each study-plan task"],
    [`${XP.vocab}`, "each vocabulary word you practise, once a day per word"]
  ].map(([xp, label]) => ({ xp, label }));
}

// Counters that reset each day: { date, reviewXp, remixXp, vocabXp, vocab: [wordId] }.
function daily(p) {
  const today = todayKey();
  if (p.daily?.date !== today) p.daily = { date: today };
  return p.daily;
}

// Takes up to `amount` XP from what is left of today's `cap` for that counter.
function takeDaily(p, key, amount, cap) {
  const d = daily(p);
  const xp = Math.max(0, Math.min(amount, cap - (d[key] || 0)));
  d[key] = (d[key] || 0) + xp;
  return xp;
}

// Records one graded answer to a bank question and returns the XP it earns.
// A question pays its full XP once: an assisted answer pays a share of it, a
// later clean answer pays the rest, and after that it only pays review XP.
export function recordAnswer(p, q, { correct, assisted = false, at = new Date().toISOString() } = {}) {
  const prev = p.answered[q.id];
  const full = questionXp(q.difficulty);
  // Records from before per-question XP: any earlier correct answer was paid in full.
  const paid = prev ? (prev.xp ?? (prev.correct > 0 ? full : 0)) : 0;
  const entry = { ...prev, attempts: (prev?.attempts || 0) + 1, correct: (prev?.correct || 0) + (correct ? 1 : 0), lastCorrect: Boolean(correct), lastAt: at, xp: paid };
  let xp = 0;
  let kind = "miss";
  if (!correct) {
    if (!prev) xp = XP.firstMiss;
  } else if (paid >= full) {
    kind = "review";
    const today = todayKey();
    if (entry.reviewDay !== today) {
      xp = takeDaily(p, "reviewXp", XP.review, XP.reviewDailyCap);
      if (xp) entry.reviewDay = today;
    }
  } else {
    kind = assisted ? "assisted" : "solve";
    xp = Math.max(0, (assisted ? Math.ceil(full * XP.assistedShare) : full) - paid);
    entry.xp = paid + xp;
  }
  p.answered[q.id] = entry;
  // The review schedule follows every graded answer, wherever it was given (player, diagnostic,
  // Daily Star). Still knowing a question on its review day is worth a little on top.
  const review = scheduleReview(p, q.id, { correct, assisted });
  if (review?.state === "advanced" || review?.state === "graduated") xp += XP.spacedReview;
  return { xp, kind, entry, review };
}

// ---------- Spaced review ----------
// A question the student gets wrong comes back on a schedule: the next day, then 3, 7 and 14 days
// after each time they still know it. Right on all four and it leaves the schedule ("graduated").
// progress.review is { questionId: { box, due, lapses } }: `box` is the place in REVIEW_GAPS and
// `due` the first day the next review counts. The rules:
//  - a wrong answer, at any time, puts the question in box 0, due tomorrow;
//  - a right answer on or after the due day moves it up a box, or out after the last one;
//  - a right answer with help (a second try, or after opening the explanation) keeps the box and
//    brings the question back tomorrow;
//  - a right answer before the due day changes nothing, so a question can't be crammed through
//    its reviews in one sitting.
export const REVIEW_GAPS = [1, 3, 7, 14];

export function scheduleReview(p, questionId, { correct, assisted = false, today = todayKey() } = {}) {
  const card = p.review[questionId];
  if (!correct) {
    // A lapse is a miss on a question that was up for review, not a second wrong try the same day.
    const lapsed = Boolean(card) && (card.box > 0 || card.due <= today);
    const due = dayOffset(today, REVIEW_GAPS[0]);
    p.review[questionId] = { box: 0, due, lapses: (card?.lapses || 0) + (lapsed ? 1 : 0) };
    return { state: lapsed ? "lapsed" : "scheduled", box: 0, due, days: REVIEW_GAPS[0] };
  }
  if (!card) return null;
  if (card.due > today) return { state: "early", box: card.box, due: card.due, days: dayDiff(card.due, today) };
  if (assisted) {
    card.due = dayOffset(today, 1);
    return { state: "again", box: card.box, due: card.due, days: 1 };
  }
  if (card.box >= REVIEW_GAPS.length - 1) {
    delete p.review[questionId];
    p.reviewGraduated = (p.reviewGraduated || 0) + 1;
    return { state: "graduated", box: REVIEW_GAPS.length, due: null, days: null };
  }
  card.box += 1;
  card.due = dayOffset(today, REVIEW_GAPS[card.box]);
  return { state: "advanced", box: card.box, due: card.due, days: REVIEW_GAPS[card.box] };
}

// Where the schedule stands: what is due today, what is coming, and how far along each question is.
// `exists(id)` leaves out questions that are no longer in the bank.
export function reviewStatus(p, exists = () => true, today = todayKey()) {
  const cards = Object.entries(p.review).filter(([id]) => exists(id));
  const later = cards.filter(([, c]) => c.due > today).sort((a, b) => a[1].due.localeCompare(b[1].due));
  const nextDay = later[0]?.[1].due || null;
  return {
    due: cards.length - later.length,
    scheduled: cards.length,
    graduated: p.reviewGraduated || 0,
    // The next day something comes back, once today's are done.
    next: nextDay ? { date: nextDay, days: dayDiff(nextDay, today), count: later.filter(([, c]) => c.due === nextDay).length } : null,
    // How many come back on each of the next seven days (today's count includes anything overdue).
    week: Array.from({ length: 7 }, (_, i) => {
      const date = dayOffset(today, i);
      return { date, count: cards.filter(([, c]) => (i === 0 ? c.due <= today : c.due === date)).length };
    }),
    boxes: REVIEW_GAPS.map((gap, box) => ({ box, gap, count: cards.filter(([, c]) => c.box === box).length })),
    gaps: REVIEW_GAPS
  };
}

// The practice player's answer: the record above, plus the combo and the
// mistakes queue. Only clean first-time solves grow the combo, so repeating
// solved questions can't build one.
export function scorePracticeAnswer(p, q, { correct, assisted = false } = {}) {
  const wasSaved = p.saved.includes(q.id);
  const { xp: base, kind, entry, review } = recordAnswer(p, q, { correct, assisted });
  const badges = [];
  if (Object.keys(p.answered).length === 1) badges.push("first_steps");
  let xp = base;
  let autoSaved = false;
  let cleared = false;
  if (!correct) {
    p.combo = 0;
    if (!wasSaved) {
      p.saved.push(q.id);
      autoSaved = true;
    }
  } else if (!assisted) {
    if (kind === "solve") {
      p.combo += 1;
      p.bestCombo = Math.max(p.bestCombo, p.combo);
      if (p.combo >= 3) xp += XP.combo;
      if (p.combo >= 5) badges.push("combo_5");
      if (p.combo >= 10) badges.push("combo_10");
      if (p.combo >= 20) badges.push("combo_20");
      if (q.difficulty === "Hard" || q.difficulty === "Challenging") {
        p.hardSolved = (p.hardSolved || 0) + 1;
        if (p.hardSolved >= 10) badges.push("hard_hitter");
      }
    }
    if (wasSaved) {
      p.saved = p.saved.filter((id) => id !== q.id);
      cleared = true;
      badges.push("mistake_crusher");
      if (!entry.clearedBonus) {
        entry.clearedBonus = true;
        xp += XP.mistakeCleared;
      }
      if (Object.values(p.answered).filter((e) => e.clearedBonus).length >= 10) badges.push("clean_slate");
    }
  }
  if (correct) {
    const solved = Object.values(p.answered).filter((e) => e.correct > 0).length;
    if (solved >= 100) badges.push("century");
    if (solved >= 500) badges.push("galaxy_brain");
  }
  return { xp, kind, badges, autoSaved, cleared, review };
}

// A generated (remix) question pays once per variant, within a daily cap:
// variants are unlimited, so without the cap they would be too.
const REMIX_MEMORY = 400;
export const generatedXp = (level, assisted = false) => {
  // (The generators stop at Hard; a Challenging bank question that reaches here pays like a Hard one.)
  const full = XP.remix[level === "Challenging" ? "Hard" : level] ?? XP.remix.Medium;
  return assisted ? Math.ceil(full * XP.assistedShare) : full;
};
export function scoreRemixAnswer(p, id, level, { correct, retry = false } = {}) {
  if (!correct || p.remixPaid.includes(id)) return 0;
  p.remixPaid.push(id);
  if (p.remixPaid.length > REMIX_MEMORY) p.remixPaid.splice(0, p.remixPaid.length - REMIX_MEMORY);
  return takeDaily(p, "remixXp", generatedXp(level, retry), XP.remixDailyCap);
}

// A drill is remembered when it is built, so its bonus is worked out from the
// answers the server graded, not from numbers the client sends.
export function startDrill(p, ids) {
  p.drill = { at: new Date().toISOString(), ids, fresh: ids.filter((id) => !(p.answered[id]?.correct > 0)) };
}

// Closes the current drill. The bonus only counts questions that weren't
// solved before the drill, so re-running solved questions earns nothing.
export function scoreDrill(p) {
  const drill = p.drill;
  p.drill = null;
  if (!drill) return null;
  const first = new Map(); // question id -> its first answer since the drill began
  for (const e of p.answerLog) if (e.at >= drill.at && drill.ids.includes(e.q) && !first.has(e.q)) first.set(e.q, e);
  const total = first.size;
  if (!total) return null;
  const correct = [...first.values()].filter((e) => e.ok && !e.a).length;
  const fresh = drill.fresh.filter((id) => first.has(id)).length;
  const perfect = total >= XP.drillMin && correct === total;
  const xp = Math.min(XP.drillComplete, XP.drillPerNew * fresh) + (perfect ? Math.min(XP.drillPerfect, XP.drillPerfectPerNew * fresh) : 0);
  p.drills.push({ at: new Date().toISOString(), total, correct });
  const badges = perfect ? ["perfect_drill"] : [];
  if (p.drills.length >= 10) badges.push("drill_10");
  return { xp, badges, total, correct };
}

export function scoreVocabReview(p, wordId) {
  const d = daily(p);
  d.vocab ||= [];
  if (d.vocab.includes(wordId)) return 0;
  d.vocab.push(wordId);
  return takeDaily(p, "vocabXp", XP.vocab, XP.vocabDailyCap);
}

// A plan task pays once, when the student's work finishes it (weekPlan.js). Only this week is kept.
export function scorePlanTask(p, week, index) {
  const paid = p.planPaid[week] || [];
  if (paid.includes(index)) return 0;
  p.planPaid = { [week]: [...paid, index] };
  return XP.planTask;
}

export const examModuleXp = (raw, max) => XP.examModule + raw * XP.examCorrect + (max > 0 && raw === max ? XP.examPerfect : 0);

// A practice-test module (practiceTests.js) is worth what a mock-exam module is, but a student can
// sit the same one again whenever they like, so it pays for the best score so far: sitting it
// again only earns for the answers that improved. A module with nothing right earns nothing.
// `refId` is "<test>:<module>".
export function scorePracticeTestModule(p, refId, raw, max) {
  const worth = raw > 0 ? examModuleXp(raw, max) : 0;
  const paid = p.testXp[refId] || 0;
  p.testXp[refId] = Math.max(paid, worth);
  return Math.max(0, worth - paid);
}

// IELTS listening and reading parts pay for the best score so far, so
// repeating a part only earns for the answers that improved. `priorBest` is
// the best earlier score for students who tried the part before this existed.
export function scoreIeltsPart(p, refId, level, correct, priorBest = null) {
  const worth = (n) => XP.ieltsPart + (XP.ieltsCorrect[level] ?? XP.ieltsCorrect.MEDIUM) * n;
  const paid = p.ieltsXp[refId] ?? (priorBest == null ? 0 : worth(priorBest));
  const earned = worth(correct);
  p.ieltsXp[refId] = Math.max(paid, earned);
  return Math.max(0, earned - paid);
}

// Essays: the full amount once the minimum length is reached, a little before that.
export function scoreIeltsEssay(p, refId, level, longEnough, priorLongEnough = null) {
  const worth = (ok) => (ok ? (XP.ieltsEssay[level] ?? XP.ieltsEssay.MEDIUM) : XP.ieltsEssayShort);
  const paid = p.ieltsXp[refId] ?? (priorLongEnough == null ? 0 : worth(priorLongEnough));
  const earned = worth(longEnough);
  p.ieltsXp[refId] = Math.max(paid, earned);
  return Math.max(0, earned - paid);
}

// ---------- Exam rewards ----------
// Exam mode has no game UI, so what a mock-exam module earns isn't sent back
// with the submission. It waits here and is shown on that exam's results page.
const EXAM_REWARD_LIMIT = 200;

export function queueExamReward(p, info, reward) {
  p.examRewards.push({ ...info, at: new Date().toISOString(), reward, seenAt: null });
  if (p.examRewards.length > EXAM_REWARD_LIMIT) p.examRewards.splice(0, p.examRewards.length - EXAM_REWARD_LIMIT);
}

export function examRewardsFor(p, sessionId) {
  const items = p.examRewards.filter((r) => r.sessionId === sessionId);
  return {
    items: items.map((r) => ({ moduleId: r.moduleId, moduleName: r.moduleName, at: r.at, seen: Boolean(r.seenAt), ...r.reward })),
    totalXp: items.reduce((s, r) => s + (r.reward?.xpGained || 0), 0),
    unseen: items.filter((r) => !r.seenAt).length
  };
}

export function markExamRewardsSeen(p, sessionId) {
  const now = new Date().toISOString();
  let marked = 0;
  for (const r of p.examRewards) {
    if (r.sessionId !== sessionId || r.seenAt) continue;
    r.seenAt = now;
    marked += 1;
  }
  return marked;
}

// Rough practice estimate: maps accuracy onto the 200–800 section scale.
// Not an official College Board conversion — labeled as an estimate in the UI.
export function scaled(accuracy) {
  return Math.round((200 + 600 * Math.max(0, Math.min(1, accuracy))) / 10) * 10;
}
