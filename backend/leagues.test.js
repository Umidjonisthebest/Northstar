// Weekly leagues: grouping, ranking and the Monday rollover as pure checks on
// small made-up databases, then the student and teacher views over HTTP
// against a throwaway database.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

const dbPath = path.join(os.tmpdir(), `northstar-leagues-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_AUTH_TOKEN = "";

let server;
let base;
let readDB;
let updateDB;
let g;
let L;

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  g = await import("./gamification.js");
  L = await import("./leagues.js");
  const bcrypt = (await import("bcryptjs")).default;
  updateDB((db) => {
    db.users.push({ id: "admin-1", role: "admin", firstName: "Test", lastName: "Admin", email: "admin@test.local", passwordHash: bcrypt.hashSync("adminpass123", 10) });
  });
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dbPath, { force: true });
});

async function api(p, { method = "GET", body, token } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

// A Wednesday at noon in the app's timezone, and the weeks around it.
const WEEK = "2026-09-28"; // a Monday
const noon = (day) => g.dayStartMs(day) + 12 * 3600000;
const NOW = () => noon(g.dayOffset(WEEK, 2));
const NEXT = () => noon(g.dayOffset(WEEK, 9));

// A made-up class: student i has lifetime XP `xp`, tier `tier`, and earned `week` XP this week.
function fakeDb(students) {
  const db = { users: [], progress: [], leagues: [] };
  students.forEach((s, i) => {
    const id = s.id || `s${String(i).padStart(2, "0")}`;
    db.users.push({ id, role: "student", firstName: s.name || `Student${i}`, lastName: "Test", email: `${id}@test.local` });
    if (s.xp === undefined && s.week === undefined) return;
    db.progress.push({ userId: id, xp: s.xp ?? s.week ?? 0, xpLog: s.week ? { [g.dayOffset(WEEK, 1)]: s.week } : {}, league: { tier: s.tier || 0, history: [] }, lastXpAt: s.at || "" });
  });
  return db;
}
const many = (n, fn = (i) => ({ xp: 100 + i, week: 10 + i })) => Array.from({ length: n }, (_, i) => fn(i));
const tierOf = (db, id) => db.progress.find((p) => p.userId === id).league.tier;

describe("the league week", () => {
  test("runs Monday to Sunday in the app's timezone", () => {
    assert.equal(L.currentWeek(g.dayStartMs("2026-09-28")), "2026-09-28", "Monday 00:00 starts the week");
    assert.equal(L.currentWeek(g.dayStartMs("2026-09-28") - 1), "2026-09-21", "a millisecond earlier is still last week");
    assert.equal(L.currentWeek(noon("2026-10-04")), "2026-09-28", "Sunday belongs to the week");
    assert.equal(L.currentWeek(g.dayStartMs("2026-10-05")), "2026-10-05");
  });

  test("weekly XP is the XP logged on its seven days", () => {
    const p = { xpLog: { "2026-09-27": 500, "2026-09-28": 10, "2026-10-01": 25, "2026-10-04": 7, "2026-10-05": 900 } };
    assert.equal(L.weekXp(p, "2026-09-28"), 42);
    assert.equal(L.weekXp(null, "2026-09-28"), 0);
  });
});

describe("grouping", () => {
  const members = (n) => Array.from({ length: n }, (_, i) => ({ userId: `u${String(i).padStart(3, "0")}`, tier: 0, level: 1 + (i % 9), xp: i * 10 }));
  const sizes = (n) => L.makeGroups(members(n)).map((x) => x.members.length);

  test("fewer than twenty students make one group", () => {
    assert.deepEqual(sizes(0), []);
    assert.deepEqual(sizes(1), [1]);
    assert.deepEqual(sizes(7), [7]);
    assert.deepEqual(sizes(19), [19]);
    assert.deepEqual(sizes(20), [20]);
  });

  test("more students are split into even groups of about twenty, never more", () => {
    assert.deepEqual(sizes(21), [11, 10]);
    assert.deepEqual(sizes(45), [15, 15, 15]);
    assert.deepEqual(sizes(61), [16, 15, 15, 15]);
    assert.ok(sizes(137).every((s) => s >= 19 && s <= 20));
  });

  test("everyone is placed exactly once", () => {
    const groups = L.makeGroups(members(73));
    const all = groups.flatMap((x) => x.members);
    assert.equal(all.length, 73);
    assert.equal(new Set(all).size, 73);
  });

  test("groups hold students with similar levels: by tier first, then level", () => {
    const list = [
      ...Array.from({ length: 20 }, (_, i) => ({ userId: `low${i}`, tier: 0, level: 1 + (i % 3), xp: i })),
      ...Array.from({ length: 20 }, (_, i) => ({ userId: `high${i}`, tier: 2, level: 8 + (i % 3), xp: 2000 + i }))
    ];
    const [top, bottom] = L.makeGroups(list);
    assert.ok(top.members.every((id) => id.startsWith("high")));
    assert.ok(bottom.members.every((id) => id.startsWith("low")));
    // Within one tier, the split follows level.
    const sameTier = Array.from({ length: 40 }, (_, i) => ({ userId: `m${String(i).padStart(2, "0")}`, tier: 1, level: i < 20 ? 2 : 9, xp: i }));
    const [strong] = L.makeGroups(sameTier);
    assert.ok(strong.members.every((id) => Number(id.slice(1)) >= 20));
  });
});

describe("who moves", () => {
  test("five at each end of a full group, fewer in a small one", () => {
    assert.deepEqual([20, 15, 12, 6, 3, 2, 1, 0].map(L.zoneSize), [5, 5, 4, 2, 1, 0, 0, 0]);
  });

  test("the table is ranked by weekly XP, and equal XP by who reached it first", () => {
    const db = fakeDb([
      { id: "a", week: 50, at: "2026-09-30T10:00:00.000Z" },
      { id: "b", week: 80 },
      { id: "c", week: 50, at: "2026-09-29T10:00:00.000Z" },
      { id: "d", xp: 300 }
    ]);
    const rows = L.standings(db, WEEK, { members: ["a", "b", "c", "d"] });
    assert.deepEqual(rows.map((r) => r.userId), ["b", "c", "a", "d"]);
    assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3, 4]);
    assert.deepEqual(rows.map((r) => r.xp), [80, 50, 50, 0]);
  });

  test("with no XP yet this week, whoever studied most recently ranks higher", () => {
    const db = fakeDb([
      { id: "old", xp: 400, at: "2026-08-01T10:00:00.000Z" },
      { id: "recent", xp: 100, at: "2026-09-26T10:00:00.000Z" },
      { id: "never", xp: 50 }
    ]);
    assert.deepEqual(L.standings(db, WEEK, { members: ["old", "never", "recent"] }).map((r) => r.userId), ["recent", "old", "never"]);
  });

  test("the student is told how much XP would change their place", () => {
    // Twelve students: four move at each end. XP runs 120, 110, ..., 10.
    const db = fakeDb(many(12, (i) => ({ xp: 900, week: 120 - i * 10, tier: 1 })));
    L.ensureLeagueWeek(db, NOW());
    const view = (id) => L.leagueView(db, id, NOW()).you;
    assert.deepEqual(view("s00"), { rank: 1, zone: "up", toPromote: null, toStay: null });
    assert.deepEqual(view("s05"), { rank: 6, zone: null, toPromote: 21, toStay: null }, "fourth place has 90, sixth has 70");
    assert.deepEqual(view("s10"), { rank: 11, zone: "down", toPromote: 71, toStay: 31 }, "eighth place has 50, eleventh has 20");
    assert.equal(L.leagueView(db, "nobody", NOW()).you, null);
  });

  test("top five are set to move up and bottom five down in a group of twenty", () => {
    const db = fakeDb(many(20, (i) => ({ xp: 500, week: 200 - i * 10, tier: 2 })));
    const rows = L.standings(db, WEEK, { members: db.users.map((u) => u.id) });
    assert.deepEqual(rows.slice(0, 5).map((r) => r.zone), Array(5).fill("up"));
    assert.deepEqual(rows.slice(5, 15).map((r) => r.zone), Array(10).fill(null));
    assert.deepEqual(rows.slice(15).map((r) => r.zone), Array(5).fill("down"));
  });

  test("nobody moves up without XP, past the top tier, or down from the lowest", () => {
    const idle = fakeDb(many(9, () => ({ xp: 50, tier: 1 })));
    assert.ok(L.standings(idle, WEEK, { members: idle.users.map((u) => u.id) }).slice(0, 3).every((r) => r.zone === null));
    const top = fakeDb(many(9, (i) => ({ xp: 900, week: 90 - i, tier: 4 })));
    assert.ok(L.standings(top, WEEK, { members: top.users.map((u) => u.id) }).slice(0, 3).every((r) => r.zone === null));
    const lowest = fakeDb(many(9, (i) => ({ xp: 90, week: 90 - i, tier: 0 })));
    assert.ok(L.standings(lowest, WEEK, { members: lowest.users.map((u) => u.id) }).slice(-3).every((r) => r.zone === null));
  });
});

describe("the weekly rollover", () => {
  test("the first request of a week forms the groups from students who have XP", () => {
    const db = fakeDb([...many(8), { name: "Never" }, { xp: 0 }]);
    const { league, changed } = L.ensureLeagueWeek(db, NOW());
    assert.equal(changed, true);
    assert.equal(league.week, WEEK);
    assert.equal(league.groups.length, 1);
    assert.equal(league.groups[0].members.length, 8, "accounts with no XP wait outside");
    assert.equal(L.ensureLeagueWeek(db, NOW()).changed, false, "nothing to save the second time");
    assert.equal(db.leagues.length, 1);
  });

  test("a student who earns their first XP mid-week joins a group", () => {
    const db = fakeDb([...many(8), { id: "late" }]);
    L.ensureLeagueWeek(db, NOW());
    db.progress.push({ userId: "late", xp: 12, xpLog: { [g.dayOffset(WEEK, 2)]: 12 } });
    const { league, changed } = L.ensureLeagueWeek(db, NOW());
    assert.equal(changed, true);
    assert.ok(league.groups[0].members.includes("late"));
    assert.equal(league.groups[0].members.length, 9);
    assert.equal(L.ensureLeagueWeek(db, NOW()).changed, false);
  });

  test("late joiners go to the group nearest their level, and a full group isn't stretched forever", () => {
    const db = fakeDb([...many(20, (i) => ({ xp: 5000 + i, tier: 3, week: 5 })), ...many(20, (i) => ({ xp: 30 + i, tier: 0, week: 5 }))]);
    L.ensureLeagueWeek(db, NOW());
    for (let i = 0; i < 8; i++) {
      db.users.push({ id: `new${i}`, role: "student", firstName: `New${i}`, lastName: "T" });
      db.progress.push({ userId: `new${i}`, xp: 10, xpLog: { [g.dayOffset(WEEK, 2)]: 10 } });
    }
    const { league } = L.ensureLeagueWeek(db, NOW());
    const sizes = league.groups.map((x) => x.members.length);
    assert.deepEqual(sizes, [20, 25, 3], "five join the beginners' group, then a new one opens");
    assert.ok(!league.groups[0].members.some((id) => id.startsWith("new")));
  });

  test("Monday closes the old week: tiers change, history is written, new groups form", () => {
    const db = fakeDb(many(20, (i) => ({ xp: 1000, week: 300 - i * 10, tier: 1 })));
    L.ensureLeagueWeek(db, NOW());
    const order = db.users.map((u) => u.id);
    const { league, changed } = L.ensureLeagueWeek(db, NEXT());
    assert.equal(changed, true);
    assert.equal(league.week, g.dayOffset(WEEK, 7));
    assert.deepEqual(order.slice(0, 5).map((id) => tierOf(db, id)), [2, 2, 2, 2, 2], "top five promoted");
    assert.deepEqual(order.slice(5, 15).map((id) => tierOf(db, id)), Array(10).fill(1));
    assert.deepEqual(order.slice(15).map((id) => tierOf(db, id)), [0, 0, 0, 0, 0], "bottom five relegated");
    const old = db.leagues.find((l) => l.week === WEEK);
    assert.ok(old.settledAt);
    assert.equal(old.results[0].rows.length, 20);
    assert.deepEqual(db.progress[0].league.history[0], { week: WEEK, rank: 1, size: 20, xp: 300, move: "up", from: 1, to: 2 });
    assert.equal(db.progress[19].league.history[0].move, "down");
    assert.equal(db.progress[10].league.history[0].move, "stay");
    // The new week starts from zero.
    assert.equal(L.standings(db, league.week, league.groups[0])[0].xp, 0);
    // Settling happens once.
    L.ensureLeagueWeek(db, NEXT());
    assert.equal(db.progress[0].league.history.length, 1);
    assert.equal(tierOf(db, order[0]), 2);
  });

  test("a week nobody opened is skipped, and the last open week still closes", () => {
    const db = fakeDb(many(6, (i) => ({ xp: 200, week: 60 - i * 10, tier: 1 })));
    L.ensureLeagueWeek(db, NOW());
    const later = noon(g.dayOffset(WEEK, 23));
    const { league } = L.ensureLeagueWeek(db, later);
    assert.equal(league.week, g.dayOffset(WEEK, 21));
    assert.deepEqual(db.leagues.map((l) => l.week), [WEEK, g.dayOffset(WEEK, 21)]);
    assert.ok(db.leagues[0].settledAt);
    assert.equal(tierOf(db, "s00"), 2);
  });

  test("only the last twelve weeks are kept", () => {
    const db = fakeDb(many(4));
    for (let w = 0; w < 15; w++) L.ensureLeagueWeek(db, noon(g.dayOffset(WEEK, w * 7 + 1)));
    assert.equal(db.leagues.length, 12);
    assert.equal(db.leagues.at(-1).week, g.dayOffset(WEEK, 98));
  });
});

describe("leagues over HTTP", () => {
  const students = [];
  const week = () => L.currentWeek();

  async function register(name, last = "Tester") {
    const res = await api("/api/student/register", { method: "POST", body: { firstName: name, lastName: last, email: `${name.toLowerCase()}-league@test.local`, password: "password1" } });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    return { token: res.data.token, id: res.data.user.id, name };
  }
  // Gives a student XP today, the way award() would.
  const earn = (userId, xp) =>
    updateDB((db) => {
      g.award(g.getProgress(db, userId), xp);
    });

  test("a student with no XP yet isn't in a league, and is told how to join", async () => {
    students.push(await register("Ava", "Stone"));
    const { status, data } = await api("/api/leagues/me", { token: students[0].token });
    assert.equal(status, 200);
    assert.equal(data.joined, false);
    assert.equal(data.group, null);
    assert.deepEqual(data.tier, { index: 0, name: "Comet" });
    assert.deepEqual(data.tiers, ["Comet", "Nebula", "Pulsar", "Quasar", "Supernova"]);
    assert.equal(data.week.start, week());
    assert.equal(data.week.end, g.dayOffset(week(), 6));
    assert.equal(Date.parse(data.week.resetsAt), g.dayStartMs(g.dayOffset(week(), 7)), "resets on Monday 00:00");
    assert.ok(data.week.daysLeft >= 1 && data.week.daysLeft <= 7);
  });

  test("earning XP puts students in one group, ranked by this week's XP", async () => {
    for (const name of ["Bo", "Cy", "Di"]) students.push(await register(name));
    const xp = [40, 90, 15, 60];
    students.forEach((s, i) => earn(s.id, xp[i]));
    const { data } = await api("/api/leagues/me", { token: students[0].token });
    assert.equal(data.joined, true);
    assert.equal(data.xp, 40);
    assert.equal(data.group.size, 4);
    assert.equal(data.group.movers, 1);
    assert.deepEqual(data.group.rows.map((r) => [r.rank, r.name, r.xp, r.you]), [
      [1, "Bo T.", 90, false],
      [2, "Di T.", 60, false],
      [3, "You", 40, true],
      [4, "Cy T.", 15, false]
    ]);
    assert.equal(data.group.rows[0].zone, "up");
    assert.equal(data.group.rows[3].zone, null, "the lowest tier has nowhere to move down to");
    // Other students appear by first name and initial only.
    const text = JSON.stringify(data);
    for (const s of students) assert.ok(!text.includes(s.id));
    assert.ok(!text.includes("@test.local") && !text.includes("Tester") && !text.includes("Stone"));
    assert.equal(readDB().leagues.length, 1, "the week was saved");
  });

  test("teachers see every group with full names; students can't open that view", async () => {
    assert.equal((await api("/api/admin/leagues", { token: students[0].token })).status, 403);
    assert.equal((await api("/api/admin/leagues")).status, 401);
    const admin = (await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "adminpass123" } })).data.token;
    const waiting = await register("Eli");
    const { status, data } = await api("/api/admin/leagues", { token: admin });
    assert.equal(status, 200);
    assert.equal(data.students, 4);
    assert.equal(data.waiting, 1, "Eli has an account but no XP yet");
    assert.equal(data.groups.length, 1);
    assert.deepEqual(data.groups[0].rows.map((r) => r.name), ["Bo Tester", "Di Tester", "Ava Stone", "Cy Tester"]);
    assert.equal(data.groups[0].rows[0].userId, students[1].id);
    assert.deepEqual(data.tiers.map((t) => t.students), [4, 0, 0, 0, 0]);
    assert.equal(data.last, null);
    assert.equal((await api("/api/leagues/me", { token: admin })).status, 403);
    students.push(waiting);
  });

  test("when the week turns, last week's result is waiting and the tier has moved", async () => {
    // Move the open week one week into the past, with its XP.
    updateDB((db) => {
      const league = db.leagues[0];
      const from = league.week;
      league.week = g.dayOffset(from, -7);
      for (const p of db.progress) {
        const today = g.todayKey();
        if (p.xpLog?.[today]) {
          p.xpLog[g.dayOffset(today, -7)] = p.xpLog[today];
          delete p.xpLog[today];
        }
      }
    });
    const { data } = await api("/api/leagues/me", { token: students[1].token });
    assert.deepEqual(data.tier, { index: 1, name: "Nebula" }, "Bo finished first and moved up");
    assert.equal(data.xp, 0, "a new week starts from zero");
    assert.equal(data.last.rank, 1);
    assert.equal(data.last.size, 4);
    assert.equal(data.last.move, "up");
    assert.deepEqual([data.last.fromName, data.last.toName], ["Comet", "Nebula"]);
    assert.equal(data.last.week, g.dayOffset(week(), -7));
    assert.equal(data.group.rows.length, 4);
    const ava = (await api("/api/leagues/me", { token: students[0].token })).data;
    assert.equal(ava.last.move, "stay");
    assert.deepEqual(ava.tier, { index: 0, name: "Comet" });
    const db = readDB();
    assert.equal(db.leagues.length, 2);
    assert.ok(db.leagues[0].settledAt);
  });

  test("deleting a student takes them out of the tables", async () => {
    const { removeUser } = await import("./ielts/lib/users.js");
    updateDB((db) => removeUser(db, students[3].id));
    const { data } = await api("/api/leagues/me", { token: students[0].token });
    assert.equal(data.group.size, 3);
    assert.ok(!data.group.rows.some((r) => r.name.startsWith("Di")));
  });
});
