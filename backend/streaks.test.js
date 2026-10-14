// Streaks over HTTP against a throwaway database: the sky in the progress
// payload, the repair drill (window and completion checked by the server) and
// the welcome-back gift. The date rules themselves are unit-tested in
// gamification.test.js.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

const dbPath = path.join(os.tmpdir(), `northstar-streaks-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_AUTH_TOKEN = "";

let server;
let base;
let readDB;
let updateDB;
let g;

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  g = await import("./gamification.js");
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

async function register(name) {
  const res = await api("/api/student/register", { method: "POST", body: { firstName: name, lastName: "T", email: `${name.toLowerCase()}-streaks@test.local`, password: "password1" } });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return { token: res.data.token, id: res.data.user.id };
}

const ago = (n) => g.dayOffset(g.todayKey(), -n);
// Gives a student a study history: active on the days `n` days ago.
function studied(userId, ...daysAgo) {
  updateDB((db) => {
    const p = g.getProgress(db, userId);
    for (const n of daysAgo) p.days[ago(n)] = "active";
    p.streak.lastDate = Object.keys(p.days).sort().at(-1);
  });
}
const progress = async (token) => (await api("/api/practice/progress", { token })).data;
const wrongAnswer = (q) => (q.type === "grid_in" ? "123456" : (q.correctIndex + 1) % q.options.length);

describe("the sky in the progress payload", () => {
  let student;

  test("a new student has an empty sky, nothing to repair and no welcome-back", async () => {
    student = await register("Nova");
    const p = await progress(student.token);
    assert.equal(p.sky.start, null);
    assert.equal(p.sky.marks, "");
    assert.deepEqual(p.streak, { current: 0, longest: 0, lastDate: null, activeToday: false });
    assert.equal(p.repair, null);
    assert.deepEqual(p.welcomeBack, { eligible: false, daysAway: 0, pending: null });
  });

  test("the first answer lights the first star", async () => {
    const q = readDB().practiceQuestions[0];
    await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", token: student.token, body: { answer: wrongAnswer(q) } });
    const p = await progress(student.token);
    assert.equal(p.sky.start, g.todayKey());
    assert.equal(p.sky.marks, "1");
    assert.equal(p.sky.lit, 1);
    assert.equal(p.streak.current, 1);
    assert.equal(p.streak.activeToday, true);
    assert.equal(p.stats.streak, 1);
  });

  test("missed days stay in the sky as dim stars", async () => {
    studied(student.id, 6, 5);
    const p = await progress(student.token);
    assert.equal(p.sky.start, ago(6));
    assert.equal(p.sky.marks, "1100001");
    assert.deepEqual([p.sky.lit, p.sky.missed, p.sky.toward], [3, 4, 3]);
    assert.equal(p.streak.current, 1);
  });
});

describe("repair drill", () => {
  let student;
  let drill;

  test("with exactly one missed day, the progress payload offers the repair", async () => {
    student = await register("Rhea");
    studied(student.id, 4, 3, 2);
    const p = await progress(student.token);
    assert.equal(p.streak.current, 0);
    assert.equal(p.repair.day, ago(1));
    assert.equal(p.repair.streak, 3);
    assert.equal(p.repair.total, 10);
    assert.equal(p.repair.started, false);
    assert.ok(Date.parse(p.repair.closesAt) > Date.now());
    assert.equal(p.welcomeBack.eligible, false);
  });

  test("starting it gives ten questions from across the bank, without their answers", async () => {
    const res = await api("/api/practice/repair/start", { method: "POST", token: student.token });
    assert.equal(res.status, 200);
    drill = res.data.questions;
    assert.equal(drill.length, 10);
    assert.equal(new Set(drill.map((q) => q.id)).size, 10);
    assert.equal(new Set(drill.map((q) => q.section)).size, 2, "both sections");
    assert.equal(drill.filter((q) => q.section === "Math").length, 5, "the sections take turns");
    assert.equal(new Set(drill.map((q) => q.topic)).size, 10, "ten different skills");
    for (const q of drill) for (const k of ["correctIndex", "correctAnswer", "rationales", "steps", "explanation"]) assert.equal(k in q, false);
    assert.equal(res.data.repair.started, true);
    assert.equal(res.data.repair.answered, 0);
  });

  test("starting again resumes the same drill", async () => {
    const again = await api("/api/practice/repair/start", { method: "POST", token: student.token });
    assert.deepEqual(again.data.questions.map((q) => q.id), drill.map((q) => q.id));
  });

  test("the day is only relit by the last answer, and the score doesn't matter", async () => {
    const bank = new Map(readDB().practiceQuestions.map((q) => [q.id, q]));
    for (const [i, dq] of drill.entries()) {
      const res = await api(`/api/practice/questions/${dq.id}/answer`, { method: "POST", token: student.token, body: { answer: wrongAnswer(bank.get(dq.id)) } });
      assert.equal(res.data.correct, false);
      if (i < 9) {
        assert.equal(res.data.repair.state, "open");
        assert.equal(res.data.repair.remaining, 9 - i);
      } else {
        assert.equal(res.data.repair.state, "repaired");
        assert.equal(res.data.repair.streak, 5);
        assert.ok(res.data.reward.newBadges.some((b) => b.id === "streak_3"), "the rejoined streak earns its badge");
      }
    }
    const p = await progress(student.token);
    assert.equal(p.sky.marks, "111r1");
    assert.equal(p.sky.repaired, 1);
    assert.equal(p.streak.current, 5);
    assert.equal(p.streak.longest, 5);
    assert.equal(p.repair, null);
  });

  test("an answer outside a drill doesn't report on one", async () => {
    const q = readDB().practiceQuestions.find((x) => !drill.some((d) => d.id === x.id));
    const res = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", token: student.token, body: { answer: wrongAnswer(q) } });
    assert.equal("repair" in res.data, false);
  });

  test("there is nothing left to repair afterwards", async () => {
    const res = await api("/api/practice/repair/start", { method: "POST", token: student.token });
    assert.equal(res.status, 409);
    assert.equal(res.data.code, "NO_REPAIR");
  });

  test("the server refuses a repair when two days were missed", async () => {
    const other = await register("Mira");
    studied(other.id, 5, 4, 3);
    assert.equal((await progress(other.token)).repair, null);
    assert.equal((await api("/api/practice/repair/start", { method: "POST", token: other.token })).status, 409);
    assert.equal(readDB().progress.find((p) => p.userId === other.id).repair, null);
  });

  test("answering drill questions without starting the drill repairs nothing", async () => {
    const other = await register("Juno");
    studied(other.id, 4, 3, 2);
    for (const q of readDB().practiceQuestions.slice(0, 12)) {
      const res = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", token: other.token, body: { answer: wrongAnswer(q) } });
      assert.equal("repair" in res.data, false);
    }
    const p = await progress(other.token);
    assert.equal(p.sky.marks, "11101");
    assert.equal(p.repair.day, ago(1), "still repairable, through the drill");
    assert.equal(p.streak.current, 1);
  });
});

describe("welcome back", () => {
  let student;

  test("back after several days: the gift is due", async () => {
    student = await register("Lyra");
    studied(student.id, 8, 7, 6);
    const p = await progress(student.token);
    assert.deepEqual(p.welcomeBack, { eligible: true, daysAway: 6, pending: null });
    assert.equal(p.repair, null);
  });

  test("the server gives it with nothing to do, and keeps it waiting until it is seen", async () => {
    const res = await api("/api/practice/welcome-back", { method: "POST", token: student.token });
    assert.equal(res.data.granted, true);
    assert.deepEqual(res.data.welcomeBack.pending, { daysAway: 6, xp: g.XP.welcomeBack, newBadge: true });
    const p = await progress(student.token);
    assert.equal(p.xp, g.XP.welcomeBack);
    assert.ok(p.badges.find((b) => b.id === "returning_star").earned);
    assert.equal(p.welcomeBack.eligible, false);
    assert.ok(p.welcomeBack.pending);
    assert.equal(p.sky.marks.at(-1), "t", "today's star waits for real study");
    assert.equal(p.streak.activeToday, false);
  });

  test("it can't be claimed again", async () => {
    const res = await api("/api/practice/welcome-back", { method: "POST", token: student.token });
    assert.equal(res.data.granted, false);
    assert.equal((await progress(student.token)).xp, g.XP.welcomeBack);
  });

  test("acknowledging the screen clears it", async () => {
    await api("/api/practice/welcome-back/seen", { method: "POST", token: student.token });
    assert.equal((await progress(student.token)).welcomeBack.pending, null);
  });

  test("a new student, or one who was away for a day, gets nothing", async () => {
    const fresh = await register("Vega");
    assert.equal((await api("/api/practice/welcome-back", { method: "POST", token: fresh.token })).data.granted, false);
    studied(fresh.id, 3, 2);
    assert.equal((await api("/api/practice/welcome-back", { method: "POST", token: fresh.token })).data.granted, false);
    assert.equal((await progress(fresh.token)).xp, 0);
  });

  test("these routes need a student token", async () => {
    assert.equal((await api("/api/practice/welcome-back", { method: "POST" })).status, 401);
    assert.equal((await api("/api/practice/repair/start", { method: "POST" })).status, 401);
  });
});
