// Monthly recap: the numbers for a month as pure checks on a made-up record,
// when a recap becomes available, the share image, and the endpoints over HTTP
// against a throwaway database.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

const dbPath = path.join(os.tmpdir(), `northstar-recap-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_AUTH_TOKEN = "";

let server;
let base;
let readDB;
let updateDB;
let g;
let R;

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  g = await import("./gamification.js");
  R = await import("./recap.js");
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

async function api(p, { method = "GET", body, token, raw = false } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, type: res.headers.get("content-type"), data: raw ? await res.text() : await res.json().catch(() => null) };
}

// Noon (app time) on a day, as an ISO timestamp.
const at = (day, minutes = 0) => new Date(g.dayStartMs(day) + 12 * 3600000 + minutes * 60000).toISOString();
const Q = (id, topic, difficulty, section = "Math") => ({ id, topic, difficulty, section, title: `Question ${id}`, prompt: "?", options: ["a", "b"], correctIndex: 0 });

// A student with answers in August and September 2026.
function fixture() {
  const db = {
    practiceQuestions: [Q("p1", "Percentages", "Easy"), Q("p2", "Percentages", "Medium"), Q("p3", "Percentages", "Hard"), Q("b1", "Boundaries", "Hard", "Reading & Writing"), Q("b2", "Boundaries", "Hard", "Reading & Writing"), Q("c1", "Circles", "Medium")],
    dailyStars: [
      { date: "2026-09-10", designation: "AA0001", questionId: "p1", answers: { u1: { correct: true }, other: { correct: true } } },
      { date: "2026-09-11", designation: "AA0002", questionId: "p2", answers: { u1: { correct: false } } },
      { date: "2026-09-12", designation: "AA0003", questionId: "p3", answers: { u1: { correct: true } } },
      { date: "2026-08-30", designation: "AA0004", questionId: "c1", answers: { u1: { correct: true } } }
    ],
    progress: []
  };
  const p = g.getProgress(db, "u1");
  const log = (q, day, ok, m = 0) => p.answerLog.push({ q, at: at(day, m), ok });
  // August: Percentages 1 of 4, Boundaries 2 of 3.
  log("p1", "2026-08-05", false);
  log("p2", "2026-08-05", false, 1);
  log("p3", "2026-08-06", false);
  log("p1", "2026-08-06", true, 1);
  log("b1", "2026-08-20", true);
  log("b2", "2026-08-20", true, 1);
  log("b1", "2026-08-21", false);
  // September: Percentages 3 of 4, Boundaries 2 of 3, Circles 1 of 1.
  log("p1", "2026-09-02", true);
  log("p2", "2026-09-02", true, 1);
  log("p3", "2026-09-03", false);
  log("p3", "2026-09-04", true);
  log("b1", "2026-09-10", true);
  log("b2", "2026-09-11", true);
  log("b2", "2026-09-12", false);
  log("c1", "2026-09-30", true);
  for (const d of ["2026-08-05", "2026-08-06", "2026-08-20", "2026-08-21", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-30"]) p.days[d] = "active";
  p.xpLog = { "2026-08-31": 500, "2026-09-02": 20, "2026-09-04": 18, "2026-09-30": 12, "2026-10-01": 900 };
  // How the class does on the two hard Boundaries questions: b2 is the tougher one.
  p.answered = { b1: { attempts: 2, correct: 2 }, b2: { attempts: 2, correct: 1 }, p3: { attempts: 2, correct: 1 } };
  db.progress.push({ userId: "other", answered: { b1: { attempts: 10, correct: 9 }, b2: { attempts: 10, correct: 2 }, p3: { attempts: 10, correct: 8 } } });
  return { db, p };
}

describe("months", () => {
  test("previous and next month cross the year boundary", () => {
    assert.equal(R.prevMonth("2026-01"), "2025-12");
    assert.equal(R.nextMonth("2026-12"), "2027-01");
    assert.equal(R.prevMonth("2026-10"), "2026-09");
    assert.equal(R.monthLabel("2026-09"), "September 2026");
  });

  test("a month's recap is available from the 1st of the next month, app time", () => {
    assert.equal(R.lastCompletedMonth(g.dayStartMs("2026-10-01")), "2026-09", "midnight on the 1st");
    assert.equal(R.lastCompletedMonth(g.dayStartMs("2026-10-01") - 1), "2026-08", "a moment before, September isn't over");
    assert.equal(R.lastCompletedMonth(g.dayStartMs("2026-10-31") + 80000000), "2026-09");
    assert.equal(R.lastCompletedMonth(g.dayStartMs("2027-01-01")), "2026-12");
  });
});

describe("a month's numbers", () => {
  test("questions solved, accuracy and its change from the month before", () => {
    const { db, p } = fixture();
    const r = R.monthStats(db, p, "u1", "2026-09");
    assert.equal(r.label, "September 2026");
    assert.deepEqual([r.answers, r.correct, r.solved], [8, 6, 6]);
    assert.equal(r.accuracy, 0.75);
    assert.equal(Math.round(r.previousAccuracy * 100), 43);
    assert.equal(r.accuracyChange, 32, "from 3 of 7 to 6 of 8, in points");
  });

  test("best streak and days studied are counted inside the month", () => {
    const { db, p } = fixture();
    const r = R.monthStats(db, p, "u1", "2026-09");
    assert.equal(r.bestStreak, 4, "Sep 1 to 4; Aug 31 belongs to August");
    assert.equal(r.activeDays, 8);
    assert.equal(r.xp, 50);
    assert.equal(R.monthStats(db, p, "u1", "2026-08").bestStreak, 2);
  });

  test("stars discovered are the daily questions solved that month", () => {
    const { db, p } = fixture();
    assert.equal(R.monthStats(db, p, "u1", "2026-09").stars, 2);
    assert.equal(R.monthStats(db, p, "u1", "2026-08").stars, 1);
  });

  test("most improved skill needs answers in both months and a real rise", () => {
    const { db, p } = fixture();
    const r = R.monthStats(db, p, "u1", "2026-09");
    assert.deepEqual(r.improved, { skill: "Percentages", section: "Math", from: 0.25, to: 0.75 });
    // Boundaries stayed at 2 of 3, and Circles has no August to compare with.
    assert.equal(R.monthStats(db, p, "u1", "2026-08").improved, null, "nothing to compare August with");
  });

  test("hardest question solved: the highest difficulty, then the one fewest students get right", () => {
    const { db, p } = fixture();
    const r = R.monthStats(db, p, "u1", "2026-09");
    assert.deepEqual(r.hardest, { id: "b2", title: "Question b2", skill: "Boundaries", section: "Reading & Writing", difficulty: "Hard" });
    // With no hard question solved, the hardest is a medium one.
    const none = fixture();
    none.p.answerLog = none.p.answerLog.filter((e) => !["p3", "b1", "b2"].includes(e.q));
    assert.equal(R.monthStats(none.db, none.p, "u1", "2026-09").hardest.difficulty, "Medium");
  });

  test("a month with nothing in it", () => {
    const { db, p } = fixture();
    const r = R.monthStats(db, p, "u1", "2026-05");
    assert.deepEqual([r.answers, r.solved, r.accuracy, r.accuracyChange, r.bestStreak, r.stars, r.improved, r.hardest], [0, 0, null, null, 0, 0, null, null]);
  });
});

describe("keeping the recaps", () => {
  test("each completed month with activity gets a recap once, newest first", () => {
    const { db, p } = fixture();
    const october = g.dayStartMs("2026-10-03");
    assert.equal(R.ensureRecaps(db, "u1", october), true);
    assert.deepEqual(p.recaps.map((r) => r.month), ["2026-09", "2026-08"]);
    assert.equal(p.recapThrough, "2026-09");
    assert.ok(p.recaps[0].generatedAt);
    assert.equal(R.ensureRecaps(db, "u1", october), false, "nothing new until November");
    assert.equal(p.recaps.length, 2);
  });

  test("the month in progress has no recap yet, and gets one on the 1st", () => {
    const { db, p } = fixture();
    R.ensureRecaps(db, "u1", g.dayStartMs("2026-09-30") + 80000000);
    assert.deepEqual(p.recaps.map((r) => r.month), ["2026-08"], "September isn't over");
    R.ensureRecaps(db, "u1", g.dayStartMs("2026-10-01"));
    assert.deepEqual(p.recaps.map((r) => r.month), ["2026-09", "2026-08"]);
  });

  test("a kept recap doesn't change when the answers behind it do", () => {
    const { db, p } = fixture();
    R.ensureRecaps(db, "u1", g.dayStartMs("2026-10-03"));
    const kept = structuredClone(p.recaps[0]);
    p.answerLog = [];
    p.days = {};
    R.ensureRecaps(db, "u1", g.dayStartMs("2026-10-20"));
    assert.deepEqual(p.recaps[0], kept);
  });

  test("months without activity are skipped, and a new student has none", () => {
    const { db, p } = fixture();
    R.ensureRecaps(db, "u1", g.dayStartMs("2027-01-05"));
    assert.deepEqual(p.recaps.map((r) => r.month), ["2026-09", "2026-08"], "October only has XP that wasn't study (a gift); November and December have nothing");
    assert.equal(p.recapThrough, "2026-12");
    const empty = { practiceQuestions: [], dailyStars: [], progress: [] };
    assert.equal(R.ensureRecaps(empty, "new", g.dayStartMs("2026-10-03")), false);
    assert.deepEqual(g.getProgress(empty, "new").recaps, []);
  });

  test("the dashboard knows when last month's recap is waiting", () => {
    const { db, p } = fixture();
    const now = g.dayStartMs("2026-10-03");
    assert.deepEqual(R.recapStatus(p, now), { month: "2026-09", label: "September 2026", ready: true, unseen: true });
    R.ensureRecaps(db, "u1", now);
    p.recapSeen = "2026-09";
    assert.deepEqual(R.recapStatus(p, now), { month: "2026-09", label: "September 2026", ready: true, unseen: false });
    assert.equal(R.recapStatus(g.getProgress({ progress: [] }, "x"), now).ready, false);
  });
});

describe("the share image", () => {
  test("an SVG with the month, the name and the six numbers", () => {
    const { db, p } = fixture();
    const svg = R.recapSvg(R.monthStats(db, p, "u1", "2026-09"), "Ada");
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1080" height="1080"/);
    for (const text of ["September 2026", "Ada&apos;s month of study", "QUESTIONS SOLVED", ">6<", "75%", "32 points above August", "4 days", "8 days studied", "STARS DISCOVERED", ">2<", "Percentages", "from 25% to 75%", "HARDEST QUESTION SOLVED", ">Hard<", "Boundaries"]) {
      assert.ok(svg.includes(text), text);
    }
    assert.ok(svg.trimEnd().endsWith("</svg>"));
    assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)/, "nothing is loaded from anywhere");
    assert.doesNotMatch(svg, /<image|<script|href=/);
  });

  test("names and skills are escaped, and an empty month still draws", () => {
    const { db, p } = fixture();
    const svg = R.recapSvg({ ...R.monthStats(db, p, "u1", "2026-05"), improved: { skill: "Ratios <&> rates", section: "Math", from: 0.1, to: 0.9 } }, '<b>"Zoë"</b>');
    assert.ok(svg.includes("&lt;b&gt;&quot;Zoë&quot;&lt;/b&gt;"));
    assert.ok(svg.includes("Ratios &lt;&amp;&gt; rates"));
    assert.ok(!svg.includes("<b>"));
    assert.ok(svg.includes("no answers this month") && svg.includes("none solved this month"));
  });
});

describe("recaps over HTTP", () => {
  let token;
  let userId;
  const last = () => R.lastCompletedMonth();

  test("a new student has no recap yet, and is told when the first one comes", async () => {
    const reg = await api("/api/student/register", { method: "POST", body: { firstName: "Rae", lastName: "Cap", email: "rae-recap@test.local", password: "password1" } });
    token = reg.data.token;
    userId = reg.data.user.id;
    const { status, data } = await api("/api/recaps", { token });
    assert.equal(status, 200);
    assert.deepEqual(data.recaps, []);
    assert.equal(data.latest, last());
    assert.equal(data.next.month, R.monthOf(g.todayKey()));
    assert.equal(data.next.availableOn, `${R.nextMonth(R.monthOf(g.todayKey()))}-01`);
    assert.equal((await api("/api/practice/progress", { token })).data.recap.ready, false);
  });

  test("last month's activity becomes a recap, kept in the history", async () => {
    const month = last();
    const qs = readDB().practiceQuestions.slice(0, 3);
    updateDB((db) => {
      const p = g.getProgress(db, userId);
      qs.forEach((q, i) => p.answerLog.push({ q: q.id, at: at(`${month}-1${i}`), ok: i !== 1 }));
      for (const d of ["10", "11", "12"]) p.days[`${month}-${d}`] = "active";
    });
    const waiting = (await api("/api/practice/progress", { token })).data.recap;
    assert.deepEqual([waiting.month, waiting.ready, waiting.unseen], [month, true, true]);

    const { data } = await api("/api/recaps", { token });
    assert.equal(data.recaps.length, 1);
    const r = data.recaps[0];
    assert.deepEqual([r.month, r.answers, r.solved, r.bestStreak, r.activeDays, r.stars], [month, 3, 2, 3, 3, 0]);
    assert.equal(r.hardest.id.length > 0, true);
    assert.equal(readDB().progress.find((p) => p.userId === userId).recaps.length, 1, "saved");
    // Asking again doesn't make another one.
    assert.equal((await api("/api/recaps", { token })).data.recaps.length, 1);
  });

  test("opening it marks it seen", async () => {
    await api("/api/recaps/seen", { method: "POST", token });
    const status = (await api("/api/practice/progress", { token })).data.recap;
    assert.deepEqual([status.ready, status.unseen], [true, false]);
    assert.equal((await api("/api/recaps", { token })).data.seen, last());
  });

  test("the share image is served as an SVG, only for a month that has a recap", async () => {
    const img = await api(`/api/recaps/${last()}/image.svg`, { token, raw: true });
    assert.equal(img.status, 200);
    assert.match(img.type, /image\/svg\+xml/);
    assert.ok(img.data.startsWith("<svg") && img.data.includes("Rae&apos;s month of study") && img.data.includes(R.monthLabel(last())));
    assert.equal((await api("/api/recaps/1999-01/image.svg", { token })).status, 404);
    assert.equal((await api(`/api/recaps/${last()}/image.svg`)).status, 401);
    assert.equal((await api("/api/recaps")).status, 401);
  });
});
