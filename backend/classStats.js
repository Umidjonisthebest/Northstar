// What a class sees of itself: classmates and the week they are having, each other's study
// sessions, the weekly class goal, how the classes stand next to each other, and cheers.
//
// Everything here is worked out from what the server already graded (XP logs and answer logs).
// Nothing is self-reported, and nothing here pays XP: leagues are global, so a reward only
// students in a class could earn would tilt them.
//
// What classmates see of each other is effort: when they studied, for how long, how many
// questions, their XP, streak and level. How many they got right stays their own; the class only
// ever gets it as an average (and only with three or more students in it, so it can't be worked
// back to one person).
import { nanoid } from "nanoid";
import { dayDiff, dayOffset, dayStartMs, levelInfo, streakOf, todayKey, weekKey } from "./gamification.js";
import { TIERS, weekXp } from "./leagues.js";
import { describeSitting, sittingMinutes, sittings } from "./studySessions.js";
import { allClasses, classById, classInfo, classMembers, inClass, publicClassmate, sameClass } from "./classrooms.js";
import { activeAmong } from "./presence.js";

const iso = (ms) => new Date(ms).toISOString();
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const currentWeek = (now = Date.now()) => weekKey(todayKey(new Date(now)));

// ---------- One student's week ----------
// `p` is the student's progress record straight from the database (it may be missing, or older
// than some of its fields), so nothing here assumes a field exists.
export function weekStudy(p, week, qmap) {
  const from = iso(dayStartMs(week));
  const to = iso(dayStartMs(dayOffset(week, 7)));
  const log = (p?.answerLog || []).filter((e) => e.at && e.at >= from && e.at < to);
  const sits = sittings(log, qmap);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = dayOffset(week, i);
    return { date, label: DAY_LABELS[i], xp: p?.xpLog?.[date] || 0, minutes: 0, questions: 0 };
  });
  for (const g of sits) {
    const day = days.find((d) => d.date === todayKey(new Date(g.startT)));
    if (!day) continue;
    day.minutes += sittingMinutes(g);
    day.questions += g.count;
  }
  return {
    xp: p ? weekXp(p, week) : 0,
    minutes: sits.reduce((s, g) => s + sittingMinutes(g), 0),
    questions: log.length,
    correct: log.filter((e) => e.ok).length,
    days: days.filter((d) => d.xp > 0).length,
    byDay: days,
    sittings: sits
  };
}

// The four numbers classmates may see of each other's week.
const effort = (w) => ({ xp: w.xp, minutes: w.minutes, questions: w.questions, days: w.days });

// A sitting as a classmate sees it: no right-answer count.
function publicSitting(g) {
  const s = describeSitting(g);
  delete s.correct;
  return s;
}

// Everything the class pages need about a class, worked out once per request. `id` is the id of a
// class that exists.
export function classSnapshot(db, id, now = Date.now()) {
  const week = currentWeek(now);
  const today = todayKey(new Date(now));
  const qmap = new Map(db.practiceQuestions.map((q) => [q.id, q]));
  const progress = new Map(db.progress.map((p) => [p.userId, p]));
  const users = classMembers(db, id);
  const online = new Set(activeAmong(users.map((u) => u.id), now));
  const members = users.map((u) => {
    const p = progress.get(u.id) || null;
    const w = weekStudy(p, week, qmap);
    const streak = p?.days && p.streak ? streakOf(p, today).current : 0;
    return { user: u, p, week: w, streak, level: levelInfo(p?.xp || 0).level, tier: TIERS[Math.max(0, Math.min(TIERS.length - 1, p?.league?.tier ?? 0))], studying: online.has(u.id) };
  });
  return { classId: id, classroom: classInfo(classById(db, id)), week, today, members, total: members.reduce((s, m) => s + m.week.xp, 0) };
}

// A classmate as a row of the class list.
const row = (m, meId, cheered = new Set()) => ({
  ...publicClassmate(m.user),
  you: m.user.id === meId,
  level: m.level,
  league: m.tier,
  streak: m.streak,
  studying: m.studying,
  week: effort(m.week),
  cheered: cheered.has(m.user.id)
});

// Whom this student has cheered today.
const cheeredToday = (db, userId, today) => new Set(db.cheers.filter((c) => c.from === userId && c.day === today).map((c) => c.to));

// The class list: most XP this week first, then whoever studied longest; the rest by name.
export function classmatesView(db, snap, meId) {
  const cheered = cheeredToday(db, meId, snap.today);
  return snap.members
    .map((m) => row(m, meId, cheered))
    .sort((a, b) => b.week.xp - a.week.xp || b.week.minutes - a.week.minutes || a.name.localeCompare(b.name));
}

// The student's week next to the class's: the average of the classmates who studied this week,
// and the best figure in the class for each number.
export function compareView(snap, meId) {
  const me = snap.members.find((m) => m.user.id === meId);
  const active = snap.members.filter((m) => m.week.xp > 0 || m.week.questions > 0);
  const avg = (key) => (active.length ? Math.round(active.reduce((s, m) => s + m.week[key], 0) / active.length) : 0);
  const best = (key) => Math.max(0, ...snap.members.map((m) => m.week[key]));
  const keys = ["xp", "minutes", "questions", "days"];
  const answered = active.filter((m) => m.week.questions > 0);
  const byXp = [...snap.members].sort((a, b) => b.week.xp - a.week.xp);
  return {
    me: effort(me.week),
    average: Object.fromEntries(keys.map((k) => [k, avg(k)])),
    best: Object.fromEntries(keys.map((k) => [k, best(k)])),
    studied: active.length,
    students: snap.members.length,
    rank: me.week.xp > 0 ? byXp.findIndex((m) => m.user.id === meId) + 1 : null,
    accuracy: {
      me: me.week.questions ? me.week.correct / me.week.questions : null,
      // An average of one or two people says too much about each of them.
      class: answered.length >= 3 ? answered.reduce((s, m) => s + m.week.correct, 0) / answered.reduce((s, m) => s + m.week.questions, 0) : null
    }
  };
}

// The class's recent study sessions, newest first (the last seven days).
export function feedView(db, snap, meId, limit = 40, now = Date.now()) {
  const qmap = new Map(db.practiceQuestions.map((q) => [q.id, q]));
  const since = iso(now - 7 * 86400000);
  const out = [];
  for (const m of snap.members) {
    const log = (m.p?.answerLog || []).filter((e) => e.at && e.at >= since);
    for (const g of sittings(log, qmap)) out.push({ who: publicClassmate(m.user), you: m.user.id === meId, ...publicSitting(g) });
  }
  return out.sort((a, b) => b.end.localeCompare(a.end)).slice(0, limit);
}

// One student's side of "you and a classmate": the week, day by day, and their latest sessions.
function side(db, snap, m, own, now) {
  const qmap = new Map(db.practiceQuestions.map((q) => [q.id, q]));
  const since = iso(now - 14 * 86400000);
  const recent = sittings((m.p?.answerLog || []).filter((e) => e.at && e.at >= since), qmap).reverse().slice(0, 8);
  return {
    ...publicClassmate(m.user),
    level: m.level,
    league: m.tier,
    streak: m.streak,
    studying: m.studying,
    badges: m.p?.badges?.length || 0,
    week: effort(m.week),
    days: m.week.byDay,
    sessions: recent.map(own ? describeSitting : publicSitting)
  };
}

export function classmateView(db, snap, meId, otherId, now = Date.now()) {
  const me = snap.members.find((m) => m.user.id === meId);
  const them = snap.members.find((m) => m.user.id === otherId);
  if (!me || !them) return null;
  return {
    week: { start: snap.week, end: dayOffset(snap.week, 6) },
    them: { ...side(db, snap, them, false, now), cheered: cheeredToday(db, meId, snap.today).has(otherId) },
    me: side(db, snap, me, true, now)
  };
}

// Who is studying right now, apart from the student asking.
export const studyingNow = (snap, meId) => snap.members.filter((m) => m.studying && m.user.id !== meId).map((m) => publicClassmate(m.user));

// ---------- The weekly class goal ----------
// Each class has one XP goal a week, sized to how many of its students have been studying lately,
// and everyone's XP counts toward it. Reaching it adds a star to the class's shelf. It is fixed
// the first time anyone looks in a week, so it can't move while the class works on it.
export const QUEST = {
  perStudent: 150, // XP a week for each student who has been studying
  min: 300, // a class of one or two still gets a goal worth reaching
  step: 50,
  activeDays: 14, // "has been studying": earned XP in the two weeks before this one
  history: 8, // past weeks shown on the shelf
  keep: 26
};

function goalFor(db, id, week) {
  const progress = new Map(db.progress.map((p) => [p.userId, p]));
  const lately = Array.from({ length: QUEST.activeDays }, (_, i) => dayOffset(week, -1 - i));
  const students = classMembers(db, id).filter((u) => lately.some((d) => (progress.get(u.id)?.xpLog?.[d] || 0) > 0)).length;
  const target = Math.max(QUEST.min, Math.ceil((students * QUEST.perStudent) / QUEST.step) * QUEST.step);
  return { students: Math.max(1, students), target };
}

function classWeekXp(db, id, week) {
  const progress = new Map(db.progress.map((p) => [p.userId, p]));
  return classMembers(db, id).reduce((s, u) => s + (progress.has(u.id) ? weekXp(progress.get(u.id), week) : 0), 0);
}

// Makes sure this week's goal exists for a class and closes the weeks before it. `changed` tells
// the caller whether anything needs saving.
export function ensureQuest(db, id, now = Date.now()) {
  const week = currentWeek(now);
  let changed = false;
  let quest = db.classQuests.find((q) => q.classId === id && q.week === week);
  if (!quest) {
    // A week that ended without anyone looking still gets its result: it is counted now.
    for (const old of db.classQuests) {
      if (old.classId !== id || old.closed || old.week >= week) continue;
      old.total = classWeekXp(db, id, old.week);
      if (!old.reachedAt && old.total >= old.target) old.reachedAt = iso(dayStartMs(dayOffset(old.week, 7)) - 1000);
      old.closed = true;
    }
    quest = { classId: id, week, ...goalFor(db, id, week), createdAt: iso(now), reachedAt: null };
    db.classQuests.push(quest);
    const mine = db.classQuests.filter((q) => q.classId === id).sort((a, b) => a.week.localeCompare(b.week));
    const drop = new Set(mine.slice(0, Math.max(0, mine.length - QUEST.keep)));
    if (drop.size) db.classQuests = db.classQuests.filter((q) => !drop.has(q));
    changed = true;
  }
  if (!quest.reachedAt && classWeekXp(db, id, week) >= quest.target) {
    quest.reachedAt = iso(now);
    changed = true;
  }
  return { quest, changed };
}

// Every class that has students gets its goal for the week. Returns whether anything changed.
export function ensureQuests(db, now = Date.now()) {
  let changed = false;
  for (const cls of db.classes) {
    if (classMembers(db, cls.id).length === 0) continue;
    if (ensureQuest(db, cls.id, now).changed) changed = true;
  }
  return changed;
}

const percent = (total, target) => (target > 0 ? Math.round((total / target) * 100) : 0);

// The class goal as a student sees it. Call ensureQuest first.
export function questView(db, snap, meId) {
  const id = snap.classId;
  const quest = db.classQuests.find((q) => q.classId === id && q.week === snap.week);
  if (!quest) return null;
  const givers = snap.members.filter((m) => m.week.xp > 0).sort((a, b) => b.week.xp - a.week.xp);
  const past = db.classQuests
    .filter((q) => q.classId === id && q.week < snap.week)
    .sort((a, b) => b.week.localeCompare(a.week))
    .slice(0, QUEST.history)
    .map((q) => ({ week: q.week, target: q.target, total: q.total ?? classWeekXp(db, id, q.week), reached: Boolean(q.reachedAt) }));
  return {
    week: { start: snap.week, end: dayOffset(snap.week, 6), daysLeft: dayDiff(dayOffset(snap.week, 7), snap.today) },
    target: quest.target,
    total: snap.total,
    percent: percent(snap.total, quest.target),
    reached: Boolean(quest.reachedAt),
    reachedAt: quest.reachedAt,
    mine: snap.members.find((m) => m.user.id === meId)?.week.xp || 0,
    contributors: givers.length,
    top: givers.slice(0, 5).map((m) => ({ ...publicClassmate(m.user), you: m.user.id === meId, xp: m.week.xp })),
    stars: db.classQuests.filter((q) => q.classId === id && q.reachedAt).length,
    history: past
  };
}

// The classes side by side: how far each is toward its own goal this week. A big class and a
// small one are measured against goals of their own size, so the table is fair to both. `mine` is
// the id of the class of the student looking.
export function cupView(db, now = Date.now(), mine = null) {
  const week = currentWeek(now);
  return allClasses(db)
    .map((cls) => {
      const students = classMembers(db, cls.id).length;
      const quest = db.classQuests.find((q) => q.classId === cls.id && q.week === week);
      if (!students || !quest) return null;
      const xp = classWeekXp(db, cls.id, week);
      return { ...classInfo(cls), students, xp, target: quest.target, percent: percent(xp, quest.target), reached: Boolean(quest.reachedAt), you: cls.id === mine };
    })
    .filter(Boolean)
    .sort((a, b) => b.percent - a.percent || b.xp - a.xp) // level classes stay in the order of their names
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

// ---------- Cheers ----------
// A classmate can cheer another once a day. It is only a pat on the back: the other student sees
// who cheered them, and nothing else changes.
const CHEER_KEEP_DAYS = 30;

export function cheer(db, from, to, now = Date.now()) {
  if (from.id === to?.id) return { code: 400, error: "You can't cheer yourself" };
  if (!to || !sameClass(from, to)) return { code: 404, error: "That student isn't in your class" };
  const day = todayKey(new Date(now));
  if (db.cheers.some((c) => c.from === from.id && c.to === to.id && c.day === day)) return { code: 409, error: `You've already cheered ${to.firstName || "them"} today` };
  const oldest = dayOffset(day, -CHEER_KEEP_DAYS);
  db.cheers = db.cheers.filter((c) => c.day >= oldest);
  db.cheers.push({ id: nanoid(10), from: from.id, to: to.id, day, createdAt: iso(now) });
  return { ok: true };
}

// The cheers a student has had: who today, and how many this week.
export function cheersFor(db, user, now = Date.now()) {
  const day = todayKey(new Date(now));
  const week = weekKey(day);
  const mine = db.cheers.filter((c) => c.to === user.id);
  const today = mine
    .filter((c) => c.day === day)
    .map((c) => db.users.find((u) => u.id === c.from))
    .filter((u) => inClass(u))
    .map(publicClassmate);
  return { today, week: mine.filter((c) => c.day >= week).length };
}
