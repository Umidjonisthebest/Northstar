// Weekly leagues. Each week students are put in groups of about twenty with
// others near their level and ranked by the XP they earn that week (the XP
// rules themselves are in gamification.js). The week runs Monday to Sunday in
// the app's timezone. When it ends, the top of each group moves up a tier and
// the bottom moves down one.
//
// db.leagues holds one record per week:
//   { week: <Monday>, createdAt, groups: [{ id, members: [userId] }], settledAt, results }
// A student's tier and past weeks are in progress.league: { tier, history }.
//
// There is no scheduler: the first league request after Monday 00:00 closes
// the old week and opens the new one (ensureLeagueWeek).

import { nanoid } from "nanoid";
import { isDemoUser } from "./users.js";
import { publicAvatar } from "./avatars.js";
import { dayDiff, dayOffset, dayStartMs, levelInfo, todayKey, weekKey } from "./gamification.js";

export const TIERS = ["Comet", "Nebula", "Pulsar", "Quasar", "Supernova"];
export const GROUP_SIZE = 20;
const MOVERS = 5; // top 5 move up, bottom 5 move down
const LATE_ROOM = 5; // a group can take this many students who join mid-week
const KEEP_WEEKS = 12;
const HISTORY = 26;

const iso = (ms) => new Date(ms).toISOString();
export const currentWeek = (now = Date.now()) => weekKey(todayKey(new Date(now)));

// How many move at each end. Five in a full group; fewer in a small one, so
// the two zones never meet and there is always a middle that stays.
export const zoneSize = (size) => Math.min(MOVERS, Math.floor(size / 3));

export function weekXp(p, week) {
  let xp = 0;
  for (let i = 0; i < 7; i++) xp += p?.xpLog?.[dayOffset(week, i)] || 0;
  return xp;
}

const tierOf = (p) => Math.max(0, Math.min(TIERS.length - 1, p?.league?.tier ?? 0));

function leagueOf(p) {
  if (!p.league || typeof p.league !== "object") p.league = { tier: 0, history: [] };
  if (!Array.isArray(p.league.history)) p.league.history = [];
  return p.league;
}

// Students join the leagues once they have earned any XP, so accounts that
// were never used don't fill the tables.
function lookup(db) {
  // The demo account is never in a league (isDemoUser), so a standing table is only real students.
  const users = new Map(db.users.filter((u) => u.role === "student" && !isDemoUser(u)).map((u) => [u.id, u]));
  const progress = new Map(db.progress.map((p) => [p.userId, p]));
  const describe = (userId) => {
    const p = progress.get(userId);
    return users.has(userId) && p ? { userId, tier: tierOf(p), level: levelInfo(p.xp || 0).level, xp: p.xp || 0 } : null;
  };
  const eligible = [...users.keys()].filter((id) => (progress.get(id)?.xp || 0) > 0);
  return { users, progress, describe, eligible };
}

// Groups of about twenty with similar levels: students are lined up by tier,
// then level, and the line is cut into equal parts. Fewer than twenty
// students make one group.
export function makeGroups(members) {
  const sorted = [...members].sort((a, b) => b.tier - a.tier || b.level - a.level || b.xp - a.xp || (a.userId < b.userId ? -1 : 1));
  const count = Math.ceil(sorted.length / GROUP_SIZE);
  const groups = [];
  let at = 0;
  for (let g = 0; g < count; g++) {
    const size = Math.floor(sorted.length / count) + (g < sorted.length % count ? 1 : 0);
    groups.push({ id: nanoid(8), members: sorted.slice(at, at + size).map((m) => m.userId) });
    at += size;
  }
  return groups;
}

// A student who joins mid-week goes to the group whose members are closest to
// their tier and level. When that group is full, a group about as close takes
// them (within one tier), and otherwise a new group opens: a beginner is never
// dropped into a far stronger group just because it has room.
function place(league, member, describe) {
  const ranked = league.groups
    .map((g) => {
      const others = g.members.map(describe).filter(Boolean);
      const avg = (key) => (others.length ? others.reduce((s, m) => s + m[key], 0) / others.length : 0);
      return { g, gap: Math.abs(avg("tier") - member.tier) * 100 + Math.abs(avg("level") - member.level) };
    })
    .sort((a, b) => a.gap - b.gap);
  let home = ranked.find((x) => x.gap < ranked[0].gap + 100 && x.g.members.length < GROUP_SIZE + LATE_ROOM)?.g;
  if (!home) {
    home = { id: nanoid(8), members: [] };
    league.groups.push(home);
  }
  home.members.push(member.userId);
}

// A group's table for a week: most XP first, and for equal XP whoever got
// there first. Students with no XP yet that week are ordered by who studied
// most recently. `zone` says who is set to move: "up", "down" or null. Moving
// up needs some XP that week, and nobody moves past the top or bottom tier.
export function standings(db, week, group, maps = lookup(db)) {
  const rows = group.members
    .map((userId) => {
      const user = maps.users.get(userId);
      const p = maps.progress.get(userId);
      return user && p ? { userId, user, xp: weekXp(p, week), level: levelInfo(p.xp || 0).level, tier: tierOf(p), at: p.lastXpAt || "" } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.xp - a.xp || (a.xp ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)) || (a.userId < b.userId ? -1 : 1));
  const zone = zoneSize(rows.length);
  rows.forEach((r, i) => {
    r.rank = i + 1;
    r.zone = i < zone && r.xp > 0 && r.tier < TIERS.length - 1 ? "up" : i >= rows.length - zone && r.tier > 0 ? "down" : null;
  });
  return rows;
}

// Closes a week: the final tables are kept with the week, and each student's
// tier and league history are updated.
export function settleLeague(db, league, now = Date.now()) {
  const maps = lookup(db);
  league.results = league.groups.map((g) => {
    const rows = standings(db, league.week, g, maps);
    return {
      groupId: g.id,
      rows: rows.map((r) => {
        const info = leagueOf(maps.progress.get(r.userId));
        const to = r.tier + (r.zone === "up" ? 1 : r.zone === "down" ? -1 : 0);
        const entry = { week: league.week, rank: r.rank, size: rows.length, xp: r.xp, move: r.zone || "stay", from: r.tier, to };
        info.tier = to;
        info.history.unshift(entry);
        if (info.history.length > HISTORY) info.history.length = HISTORY;
        return { userId: r.userId, rank: r.rank, xp: r.xp, move: entry.move, from: r.tier, to };
      })
    };
  });
  league.settledAt = iso(now);
}

// Makes sure this week's league exists: closes any week that has ended, forms
// the new groups, and adds students who have earned their first XP since.
// `changed` tells the caller whether anything needs saving.
export function ensureLeagueWeek(db, now = Date.now()) {
  const week = currentWeek(now);
  let changed = false;
  let league = db.leagues.find((l) => l.week === week);
  if (!league) {
    for (const old of db.leagues) if (!old.settledAt && old.week < week) settleLeague(db, old, now);
    const maps = lookup(db);
    league = { week, createdAt: iso(now), groups: makeGroups(maps.eligible.map(maps.describe)), settledAt: null, results: null };
    db.leagues.push(league);
    if (db.leagues.length > KEEP_WEEKS) db.leagues.splice(0, db.leagues.length - KEEP_WEEKS);
    changed = true;
  }
  const maps = lookup(db);
  const placed = new Set(league.groups.flatMap((g) => g.members));
  for (const userId of maps.eligible) {
    if (placed.has(userId)) continue;
    place(league, maps.describe(userId), maps.describe);
    changed = true;
  }
  return { league, changed };
}

const weekInfo = (week, now) => ({
  start: week,
  end: dayOffset(week, 6),
  resetsAt: iso(dayStartMs(dayOffset(week, 7))),
  daysLeft: dayDiff(dayOffset(week, 7), todayKey(new Date(now)))
});

// Other students are shown by first name and last initial.
const shortName = (u) => `${u.firstName || "Student"}${u.lastName ? ` ${u.lastName[0].toUpperCase()}.` : ""}`;
const fullName = (u) => `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "Student";

// What a student sees: their tier, their group's table and how last week went.
export function leagueView(db, userId, now = Date.now()) {
  const week = currentWeek(now);
  const league = db.leagues.find((l) => l.week === week) || null;
  const p = db.progress.find((x) => x.userId === userId);
  const tier = tierOf(p);
  const group = league?.groups.find((g) => g.members.includes(userId)) || null;
  const rows = group ? standings(db, week, group) : [];
  const last = p?.league?.history?.[0] || null;
  // How much more XP would change where the student stands: enough to pass
  // the last place in the promotion zone, or the last place above the lower one.
  const me = rows.find((r) => r.userId === userId);
  const movers = zoneSize(rows.length);
  const goal = { toPromote: null, toStay: null };
  if (me && movers > 0) {
    if (me.zone !== "up" && me.tier < TIERS.length - 1) goal.toPromote = Math.max(1, rows[movers - 1].xp - me.xp + 1);
    if (me.zone === "down") goal.toStay = Math.max(1, rows[rows.length - movers - 1].xp - me.xp + 1);
  }
  return {
    week: weekInfo(week, now),
    tiers: TIERS,
    tier: { index: tier, name: TIERS[tier] },
    xp: weekXp(p, week),
    joined: Boolean(group),
    you: me ? { rank: me.rank, zone: me.zone, ...goal } : null,
    group: group
      ? {
          size: rows.length,
          movers: zoneSize(rows.length),
          rows: rows.map((r) => ({ rank: r.rank, name: r.userId === userId ? "You" : shortName(r.user), you: r.userId === userId, avatar: publicAvatar(r.user), xp: r.xp, level: r.level, tier: TIERS[r.tier], zone: r.zone }))
        }
      : null,
    last: last ? { ...last, fromName: TIERS[last.from], toName: TIERS[last.to] } : null
  };
}

// What a teacher sees: every group this week, and how the last week closed.
export function adminLeagueView(db, now = Date.now()) {
  const week = currentWeek(now);
  const league = db.leagues.find((l) => l.week === week) || null;
  const maps = lookup(db);
  const groups = (league?.groups || []).map((g, i) => {
    const rows = standings(db, week, g, maps);
    return {
      id: g.id,
      number: i + 1,
      size: rows.length,
      movers: zoneSize(rows.length),
      rows: rows.map((r) => ({ rank: r.rank, userId: r.userId, name: fullName(r.user), email: r.user.email || "", avatar: publicAvatar(r.user), xp: r.xp, level: r.level, tier: TIERS[r.tier], zone: r.zone }))
    };
  });
  const placed = groups.flatMap((g) => g.rows);
  const previous = db.leagues.filter((l) => l.settledAt && l.week < week).sort((a, b) => b.week.localeCompare(a.week))[0] || null;
  return {
    week: weekInfo(week, now),
    tiers: TIERS.map((name) => ({ name, students: placed.filter((r) => r.tier === name).length })),
    students: placed.length,
    // Students with an account but no XP yet: they join with their first XP.
    waiting: maps.users.size - maps.eligible.length,
    groups,
    last: previous
      ? {
          week: previous.week,
          end: dayOffset(previous.week, 6),
          rows: (previous.results || [])
            .flatMap((g) => g.rows)
            .filter((r) => maps.users.has(r.userId))
            .map((r) => ({ userId: r.userId, name: fullName(maps.users.get(r.userId)), rank: r.rank, xp: r.xp, move: r.move, from: TIERS[r.from], to: TIERS[r.to] }))
        }
      : null
  };
}
