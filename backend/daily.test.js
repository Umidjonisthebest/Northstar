// The daily Northstar question and the "studying now" count: the date rules
// as pure checks, then both features over HTTP against a throwaway database.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

const dbPath = path.join(os.tmpdir(), `northstar-daily-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_AUTH_TOKEN = "";

let server;
let base;
let readDB;
let updateDB;
let g;
let daily;
let presence;

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  g = await import("./gamification.js");
  daily = await import("./dailyStar.js");
  presence = await import("./presence.js");
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

async function register(name) {
  const res = await api("/api/student/register", { method: "POST", body: { firstName: name, lastName: "T", email: `${name.toLowerCase()}-daily@test.local`, password: "password1" } });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return { token: res.data.token, id: res.data.user.id };
}

// A small bank of usable questions for the pure checks.
const fakeBank = (n) => Array.from({ length: n }, (_, i) => ({ id: `q${String(i).padStart(2, "0")}`, section: "Math", topic: "Percentages", difficulty: "Medium", prompt: `Prompt ${i}`, options: ["a", "b", "c", "d"], correctIndex: i % 4 }));
const fakeDb = (n) => ({ practiceQuestions: fakeBank(n), dailyStars: [] });
const day = (n) => g.dayOffset("2026-10-01", n);

describe("star designations", () => {
  test("two capital letters and four digits", () => {
    for (let i = 0; i < 400; i++) assert.match(daily.designationFor(day(i)), /^[A-Z]{2}\d{4}$/);
  });

  test("stable for a date", () => {
    assert.equal(daily.designationFor("2026-10-03"), daily.designationFor("2026-10-03"));
    assert.notEqual(daily.designationFor("2026-10-03"), daily.designationFor("2026-10-04"));
  });

  test("unique per day across forty years, on both sides of the anchor date", () => {
    const seen = new Set();
    const days = 40 * 366;
    for (let i = -days / 2; i < days / 2; i++) seen.add(daily.designationFor(g.dayOffset("2026-01-01", i)));
    assert.equal(seen.size, days);
  });
});

describe("picking the day's question", () => {
  test("the same date and history always give the same question", () => {
    const a = daily.pickDailyQuestion(fakeDb(40), "2026-10-03");
    const b = daily.pickDailyQuestion(fakeDb(40), "2026-10-03");
    assert.equal(a.question.id, b.question.id);
    assert.equal(a.pass, 0);
  });

  test("nothing repeats until the whole bank has been used, then a new pass starts", () => {
    const db = fakeDb(6);
    const picked = [];
    for (let i = 0; i < 18; i++) picked.push(daily.ensureDailyStar(db, day(i)));
    for (const pass of [0, 1, 2]) {
      const ids = picked.slice(pass * 6, pass * 6 + 6);
      assert.equal(new Set(ids.map((s) => s.questionId)).size, 6, `pass ${pass} uses every question once`);
      assert.ok(ids.every((s) => s.pass === pass));
    }
    // A new pass never opens with the question that closed the last one.
    assert.notEqual(picked[6].questionId, picked[5].questionId);
    assert.notEqual(picked[12].questionId, picked[11].questionId);
  });

  test("a day's question is fixed once the day has been opened", () => {
    const db = fakeDb(10);
    const first = daily.ensureDailyStar(db, "2026-10-03");
    db.practiceQuestions.push(...fakeBank(30).slice(10));
    assert.equal(daily.ensureDailyStar(db, "2026-10-03"), first);
    assert.equal(db.dailyStars.length, 1);
    assert.equal(first.designation, daily.designationFor("2026-10-03"));
  });

  test("questions added or removed mid-pass don't cause a repeat", () => {
    const db = fakeDb(5);
    const used = [];
    for (let i = 0; i < 3; i++) used.push(daily.ensureDailyStar(db, day(i)).questionId);
    db.practiceQuestions.push({ ...fakeBank(1)[0], id: "new-1" }, { ...fakeBank(1)[0], id: "new-2" });
    db.practiceQuestions = db.practiceQuestions.filter((q) => q.id !== used[0]);
    for (let i = 3; i < 7; i++) used.push(daily.ensureDailyStar(db, day(i)).questionId);
    assert.equal(new Set(used).size, 7, "five originals and two new ones, each once");
    assert.equal(db.dailyStars.at(-1).pass, 0);
  });

  test("half-finished questions are never picked, and an empty bank gives no star", () => {
    const db = { practiceQuestions: [{ id: "broken", section: "Math", options: [], correctIndex: 0 }], dailyStars: [] };
    assert.equal(daily.pickDailyQuestion(db, "2026-10-03"), null);
    assert.equal(daily.ensureDailyStar(db, "2026-10-03"), null);
    assert.deepEqual(db.dailyStars, []);
  });

  test("a bank of one question simply repeats it", () => {
    const db = fakeDb(1);
    assert.equal(daily.ensureDailyStar(db, day(0)).questionId, "q00");
    assert.equal(daily.ensureDailyStar(db, day(1)).questionId, "q00");
  });
});

describe("the shareable result", () => {
  test("names the star and the outcome, and nothing about the question", () => {
    const star = { date: "2026-10-03", designation: "JB1347", questionId: "q01", answers: { a: { correct: true, given: 2 }, b: { correct: false, given: 0 }, c: { correct: true, given: 2 } } };
    const text = daily.shareText(star, star.answers.a, 12);
    assert.match(text, /JB1347/);
    assert.match(text, /I discovered/);
    assert.match(text, /67% of students/);
    assert.match(text, /12/);
    assert.match(text, /Oct 3, 2026/);
    const miss = daily.shareText(star, star.answers.b, 3);
    assert.doesNotMatch(miss, /I discovered/);
    assert.match(miss, /JB1347/);
    for (const t of [text, miss]) assert.doesNotMatch(t, /q01|Prompt|answer [A-D]/i);
  });
});

describe("the daily question over HTTP", () => {
  let ada;
  let ben;
  let question;
  const full = () => readDB().practiceQuestions.find((q) => q.id === question.id);
  const right = () => (full().type === "grid_in" ? full().correctAnswer : full().correctIndex);
  const wrong = () => (full().type === "grid_in" ? "123456" : (full().correctIndex + 1) % full().options.length);

  test("every student gets the same question, without its answer or the star's name", async () => {
    ada = await register("Ada");
    ben = await register("Ben");
    const a = await api("/api/daily", { token: ada.token });
    const b = await api("/api/daily", { token: ben.token });
    assert.equal(a.status, 200);
    question = a.data.question;
    assert.equal(b.data.question.id, question.id);
    assert.equal(a.data.date, g.todayKey());
    assert.deepEqual([a.data.available, a.data.attempted, a.data.designation, a.data.result], [true, false, null, null]);
    for (const k of ["correctIndex", "correctAnswer", "explanation", "rationales", "steps", "hint", "keyQuote"]) assert.equal(k in question, false);
    assert.ok(!JSON.stringify(a.data).includes(daily.designationFor(g.todayKey())));
    assert.equal(readDB().dailyStars.length, 1);
  });

  test("until the attempt is used, the question is closed in the practice player", async () => {
    const ex = await api(`/api/practice/questions/${question.id}/explanation`, { token: ada.token });
    assert.equal(ex.status, 409);
    assert.match(ex.data.error, /today's Northstar question/);
    const ans = await api(`/api/practice/questions/${question.id}/answer`, { method: "POST", token: ada.token, body: { answer: right() } });
    assert.equal(ans.status, 409);
    const remix = await api("/api/practice/remix", { method: "POST", token: ada.token, body: { questionId: question.id } });
    assert.equal(remix.status, 409);
    // It isn't dealt into a drill either.
    for (let i = 0; i < 5; i++) {
      const drill = await api("/api/practice/drill", { method: "POST", token: ada.token, body: { size: 20 } });
      assert.ok(!drill.data.questions.some((q) => q.id === question.id));
    }
    assert.equal(readDB().progress.find((p) => p.userId === ada.id)?.answered?.[question.id], undefined);
    const p = (await api("/api/practice/progress", { token: ada.token })).data;
    assert.deepEqual(p.daily, { date: g.todayKey(), attempted: false, discovered: false, designation: null, total: 0 });
  });

  test("an empty or impossible answer doesn't use up the attempt", async () => {
    for (const answer of [undefined, "", null, 99, "x"]) {
      if (full().type === "grid_in" && (answer === 99 || answer === "x")) continue;
      const res = await api("/api/daily/answer", { method: "POST", token: ada.token, body: { answer } });
      assert.equal(res.status, 400, JSON.stringify(answer));
    }
    assert.equal((await api("/api/daily", { token: ada.token })).data.attempted, false);
  });

  test("solving it discovers the star", async () => {
    const res = await api("/api/daily/answer", { method: "POST", token: ada.token, body: { answer: right(), timeMs: 30000 } });
    assert.equal(res.status, 200);
    assert.equal(res.data.attempted, true);
    assert.equal(res.data.designation, daily.designationFor(g.todayKey()));
    assert.match(res.data.designation, /^[A-Z]{2}\d{4}$/);
    assert.equal(res.data.result.correct, true);
    assert.deepEqual([res.data.result.answered, res.data.result.solved, res.data.result.percentCorrect], [1, 1, 100]);
    assert.equal(res.data.discovered, 1);
    assert.equal(res.data.reward.xpGained, g.XP.question[full().difficulty] + g.XP.dailyStar);
    assert.match(res.data.result.share, new RegExp(`I discovered ${res.data.designation}`));
    assert.ok(!res.data.result.share.includes(full().prompt.slice(0, 20)));
  });

  test("one attempt per day", async () => {
    const again = await api("/api/daily/answer", { method: "POST", token: ada.token, body: { answer: wrong() } });
    assert.equal(again.status, 409);
    assert.equal(again.data.code, "ALREADY_ANSWERED");
    const seen = await api("/api/daily", { token: ada.token });
    assert.equal(seen.data.result.correct, true);
    assert.equal(seen.data.result.answered, 1);
  });

  test("a miss shows the answer and how everyone did, and still names the star", async () => {
    const res = await api("/api/daily/answer", { method: "POST", token: ben.token, body: { answer: wrong() } });
    assert.equal(res.status, 200);
    assert.equal(res.data.result.correct, false);
    assert.equal(res.data.designation, daily.designationFor(g.todayKey()));
    assert.deepEqual([res.data.result.answered, res.data.result.solved, res.data.result.percentCorrect], [2, 1, 50]);
    if (full().type === "grid_in") assert.equal(res.data.result.correctAnswer, full().correctAnswer);
    else assert.equal(res.data.result.correctIndex, full().correctIndex);
    assert.equal(res.data.discovered, 0);
    assert.equal(res.data.reward.xpGained, g.XP.firstMiss);
    assert.doesNotMatch(res.data.result.share, /I discovered/);
    // Like any practice miss, it goes to the mistakes queue.
    assert.ok(readDB().progress.find((p) => p.userId === ben.id).saved.includes(question.id));
    // The first student now sees the updated share of correct answers.
    assert.equal((await api("/api/daily", { token: ada.token })).data.result.percentCorrect, 50);
  });

  test("after the attempt the question opens up in practice, and paid XP isn't paid again", async () => {
    const ex = await api(`/api/practice/questions/${question.id}/explanation`, { token: ada.token });
    assert.equal(ex.status, 200);
    const again = await api(`/api/practice/questions/${question.id}/answer`, { method: "POST", token: ada.token, body: { answer: right() } });
    assert.equal(again.data.xpKind, "review");
  });

  test("the catalog lists the stars a student discovered, newest first", async () => {
    updateDB((db) => {
      db.dailyStars.push(
        { date: g.dayOffset(g.todayKey(), -2), designation: daily.designationFor(g.dayOffset(g.todayKey(), -2)), questionId: "gone", pass: 0, section: "Math", topic: "Percentages", difficulty: "Hard", answers: { [ada.id]: { correct: true, given: 1, at: "2026-10-01T10:00:00.000Z" }, [ben.id]: { correct: false, given: 0, at: "2026-10-01T10:05:00.000Z" } } },
        { date: g.dayOffset(g.todayKey(), -1), designation: daily.designationFor(g.dayOffset(g.todayKey(), -1)), questionId: "gone-2", pass: 0, section: "Math", topic: "Percentages", difficulty: "Easy", answers: { [ada.id]: { correct: false, given: 1, at: "2026-10-02T10:00:00.000Z" } } }
      );
    });
    const a = (await api("/api/daily/catalog", { token: ada.token })).data;
    assert.deepEqual([a.attempted, a.discovered], [3, 2]);
    assert.deepEqual(a.stars.map((s) => s.date), [g.todayKey(), g.dayOffset(g.todayKey(), -2)]);
    assert.equal(a.stars[1].percentCorrect, 50);
    assert.equal(a.stars[1].topic, "Percentages");
    const b = (await api("/api/daily/catalog", { token: ben.token })).data;
    assert.deepEqual([b.attempted, b.discovered, b.stars.length], [2, 0, 0]);
    const p = (await api("/api/practice/progress", { token: ada.token })).data;
    assert.deepEqual(p.daily, { date: g.todayKey(), attempted: true, discovered: true, designation: daily.designationFor(g.todayKey()), total: 2 });
  });

  test("deleting a student removes their answers from every day", async () => {
    const { removeUser } = await import("./ielts/lib/users.js");
    const db = readDB();
    removeUser(db, ben.id);
    assert.ok(db.dailyStars.every((s) => !(ben.id in s.answers)));
    assert.ok(db.dailyStars.some((s) => ada.id in s.answers));
  });

  test("the daily routes need a student token", async () => {
    assert.equal((await api("/api/daily")).status, 401);
    assert.equal((await api("/api/daily/answer", { method: "POST", body: { answer: 0 } })).status, 401);
    assert.equal((await api("/api/daily/catalog")).status, 401);
  });
});

describe("studying now", () => {
  test("counts each student once, for two minutes after their last heartbeat", () => {
    presence.resetPresence();
    const t = 1_000_000_000_000;
    presence.beat("a", t);
    presence.beat("a", t + 30_000);
    presence.beat("b", t);
    presence.beat("c", t + 60_000);
    assert.equal(presence.activeCount(t + 60_000), 3);
    assert.equal(presence.activeCount(t + 120_001), 2, "b's heartbeat is older than two minutes");
    assert.equal(presence.activeCount(t + 150_001), 1);
    assert.equal(presence.activeCount(t + 500_000), 0);
  });

  test("under three students, only 'a few' is given out, never the number", () => {
    presence.resetPresence();
    const t = 1_000_000_000_000;
    assert.deepEqual(presence.presenceSummary(t), { few: true, count: null });
    presence.beat("a", t);
    presence.beat("b", t);
    assert.deepEqual(presence.presenceSummary(t), { few: true, count: null });
    presence.beat("c", t);
    assert.deepEqual(presence.presenceSummary(t), { few: false, count: 3 });
  });

  test("the heartbeat endpoint is anonymous and for students only", async () => {
    presence.resetPresence();
    const students = [];
    for (const name of ["Uma", "Vik", "Wren"]) students.push(await register(name));
    const one = await api("/api/presence/ping", { method: "POST", token: students[0].token });
    assert.equal(one.status, 200);
    assert.deepEqual(one.data, { few: true, count: null });
    await api("/api/presence/ping", { method: "POST", token: students[0].token });
    const two = await api("/api/presence/ping", { method: "POST", token: students[1].token });
    assert.deepEqual(two.data, { few: true, count: null });
    const three = await api("/api/presence/ping", { method: "POST", token: students[2].token });
    assert.deepEqual(three.data, { few: false, count: 3 });
    assert.deepEqual(Object.keys(three.data).sort(), ["count", "few"], "a count and nothing else: no names, no ids");

    assert.equal((await api("/api/presence/ping", { method: "POST" })).status, 401);
    const admin = (await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "adminpass123" } })).data.token;
    assert.equal((await api("/api/presence/ping", { method: "POST", token: admin })).status, 403);
    assert.equal(readDB().presence, undefined, "nothing about who is online is stored");
  });
});
