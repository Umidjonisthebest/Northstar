import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

// Comet chunks: the wallet, how chunks are earned (never from XP itself), what a message to Nova
// costs and where, and buying and wearing things from the Comet Shop.
const dbPath = path.join(os.tmpdir(), `northstar-shop-test-db-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";
delete process.env.ANTHROPIC_API_KEY; // the built-in tutor answers

let server;
let base;
let dbModule;
let G;
let S;

before(async () => {
  dbModule = await import("./db.js");
  G = await import("./gamification.js");
  S = await import("./shop.js");
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

async function api(url, { method = "GET", body, token } = {}) {
  const res = await fetch(base + url, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}
async function newStudent(firstName) {
  const res = await api("/api/student/register", { method: "POST", body: { firstName, lastName: "Tester", email: `${firstName.toLowerCase()}-${Date.now()}@test.local`, password: "password1" } });
  return { token: res.data.token, id: res.data.user.id };
}
const balance = async (s) => (await api("/api/practice/progress", { token: s.token })).data.chunks.balance;
const setChunks = (s, n) => dbModule.updateDB((db) => (G.getProgress(db, s.id).wallet.chunks = n));
const ask = (s, body) => api("/api/practice/tutor", { method: "POST", token: s.token, body: { messages: [{ role: "user", content: "How do I pace each module?" }], ...body } });

describe("the wallet", () => {
  const fresh = () => G.getProgress({ progress: [] }, "u");
  const Q = (id, difficulty = "Medium") => ({ id, difficulty });

  test("a new account starts with the starter chunks and owns nothing", () => {
    const p = fresh();
    assert.equal(p.wallet.chunks, S.CHUNKS.starter);
    assert.deepEqual(p.wallet.owned, []);
    assert.equal(p.wallet.log.length, 1);
  });

  test("an account from before chunks gets what its levels and trophies would have paid, and keeps what it wears", () => {
    const db = {
      users: [{ id: "old", avatar: { id: "12", accessory: "crown", frame: "aurora" } }],
      progress: [{ userId: "old", xp: 250, xpLog: {}, streak: { current: 0, longest: 0, lastDate: null }, combo: 0, bestCombo: 0, answered: {}, saved: [], vocab: {}, plan: {}, drills: [], badges: [{ id: "first_steps", earnedAt: "2026-09-01T00:00:00.000Z" }], targetScore: 1400, dailyGoal: 50 }]
    };
    const p = G.getProgress(db, "old");
    assert.equal(G.levelInfo(250).level, 3);
    assert.equal(p.wallet.chunks, S.CHUNKS.starter + 2 * S.CHUNKS.levelUp + S.CHUNKS.trophy);
    assert.deepEqual(p.wallet.owned.sort(), ["acc:crown", "frame:aurora"]);
    // Opened once: a second look changes nothing.
    p.wallet.chunks = 3;
    assert.equal(G.getProgress(db, "old").wallet.chunks, 3);
  });

  test("chunks come at milestones, not with every XP: first answer of the day, then nothing until the next one", () => {
    const p = fresh();
    const start = p.wallet.chunks;
    const first = G.award(p, 12, G.scorePracticeAnswer(p, Q("a"), { correct: true }).badges);
    // The first answer ever: today's first work and the First Steps trophy.
    assert.equal(first.chunksGained, S.CHUNKS.firstStudy + S.CHUNKS.trophy);
    const second = G.award(p, 12, G.scorePracticeAnswer(p, Q("b"), { correct: true }).badges);
    assert.equal(second.xpGained, 12);
    assert.equal(second.chunksGained, 0, "XP alone pays no chunks");
    assert.equal(p.wallet.chunks, start + first.chunksGained);
    assert.equal(p.xp, 24, "and paying chunks never touches XP");
  });

  test("the daily goal, a new level, a trophy and the caller's own reason each pay their amount", () => {
    const p = fresh();
    G.award(p, 1); // today's first work is out of the way
    const before = p.wallet.chunks;
    const goal = G.award(p, p.dailyGoal); // reaches the goal (and the Goal Crusher trophy), not a level
    assert.equal(goal.chunksGained, S.CHUNKS.dailyGoal + S.CHUNKS.trophy);
    const level = G.award(p, 300); // 351 XP: level 1 to level 3 (and no new trophy)
    assert.equal(level.level, 3);
    assert.equal(level.chunksGained, 2 * S.CHUNKS.levelUp);
    const star = G.award(p, 0, [], { chunks: [S.CHUNKS.dailyStar, "Daily star discovered"] });
    assert.equal(star.chunksGained, S.CHUNKS.dailyStar);
    assert.equal(p.wallet.chunks, before + goal.chunksGained + level.chunksGained + star.chunksGained);
    assert.equal(p.wallet.log[0].why, "Daily star discovered");
    // A gift that isn't study doesn't count as the day's first work.
    const quiet = fresh();
    assert.equal(G.award(quiet, 0, [], { activity: false }).chunksGained, 0);
  });

  test("spending: never below zero, the same thing on one day is one line, and a refund cancels it", () => {
    const p = fresh();
    p.wallet.chunks = 2;
    assert.equal(S.spendChunks(p, 1, "Messages to Nova"), true);
    assert.equal(S.spendChunks(p, 1, "Messages to Nova"), true);
    assert.equal(S.spendChunks(p, 1, "Messages to Nova"), false);
    assert.equal(p.wallet.chunks, 0);
    assert.deepEqual([p.wallet.log[0].why, p.wallet.log[0].n], ["Messages to Nova", -2]);
    S.giveChunks(p, 1, "Messages to Nova");
    S.giveChunks(p, 1, "Messages to Nova");
    assert.equal(p.wallet.chunks, 2);
    assert.notEqual(p.wallet.log[0].why, "Messages to Nova", "the line is gone once it nets to nothing");
    for (let i = 0; i < 80; i++) S.giveChunks(p, 1, `reason ${i}`);
    assert.ok(p.wallet.log.length <= 30);
  });

  test("buying: the price comes off once, and an item can't be bought twice or without enough chunks", () => {
    const p = fresh();
    p.wallet.chunks = 50;
    const crown = S.SHOP.find((i) => i.id === "acc:crown");
    assert.deepEqual(S.buyItem(p, "acc:crown"), { item: crown });
    assert.equal(p.wallet.chunks, 50 - crown.price);
    assert.equal(S.buyItem(p, "acc:crown").code, 409);
    assert.equal(S.buyItem(p, "frame:galaxy").code, 402);
    assert.equal(S.buyItem(p, "acc:jetpack").code, 404);
    assert.equal(p.wallet.chunks, 50 - crown.price);
    assert.deepEqual(p.wallet.owned, ["acc:crown"]);
  });

  test("the catalogue only sells parts a picture can really wear, and the free ones stay free", async () => {
    const { AVATAR_ACCESSORIES, AVATAR_FRAMES, AVATAR_IDS } = await import("./avatars.js");
    const lists = { accessory: AVATAR_ACCESSORIES, frame: AVATAR_FRAMES, avatar: AVATAR_IDS };
    for (const item of S.SHOP) {
      assert.ok(lists[item.kind]?.includes(item.value), item.id);
      assert.ok(Number.isInteger(item.price) && item.price > 0, item.id);
    }
    assert.equal(new Set(S.SHOP.map((i) => i.id)).size, S.SHOP.length);
    const p = fresh();
    assert.equal(S.lockedPart(p, { id: "05", accessory: null, frame: "sky" }), null);
    assert.equal(S.lockedPart(p, null), null);
    assert.equal(S.lockedPart(p, { id: "05", accessory: "cap", frame: "none" }).id, "acc:cap");
  });
});

describe("over HTTP", () => {
  test("progress carries the balance and the catalogue; the shop adds the rules and the log", async () => {
    const s = await newStudent("Ada");
    const { chunks, xp } = (await api("/api/practice/progress", { token: s.token })).data;
    assert.equal(xp, 0);
    assert.equal(chunks.balance, S.CHUNKS.starter);
    assert.equal(chunks.novaCost, 1);
    assert.equal(chunks.items.length, S.SHOP.length);
    const shop = (await api("/api/practice/shop", { token: s.token })).data;
    assert.equal(shop.balance, S.CHUNKS.starter);
    assert.ok(shop.earn.length >= 5 && shop.spend.length >= 2);
    assert.equal(shop.log[0].n, S.CHUNKS.starter);
    assert.equal((await api("/api/practice/shop")).status, 401);
  });

  test("a message on the Ask Nova page costs one chunk; Nova beside a question is free", async () => {
    const s = await newStudent("Bo");
    const start = await balance(s);
    assert.equal((await ask(s)).status, 200);
    assert.equal(await balance(s), start - 1);
    const q = dbModule.readDB().practiceQuestions[0];
    assert.equal((await ask(s, { questionId: q.id, messages: [{ role: "user", content: "Give me a hint" }] })).status, 200);
    assert.equal(await balance(s), start - 1, "a hint inside a question is free");
    // A made-up question id is still a chat on the page.
    assert.equal((await ask(s, { questionId: "no-such-question" })).status, 200);
    assert.equal(await balance(s), start - 2);
    // An empty request is refused before anything is charged.
    assert.equal((await api("/api/practice/tutor", { method: "POST", token: s.token, body: { messages: [] } })).status, 400);
    assert.equal(await balance(s), start - 2);
  });

  test("with no chunks left the page chat is refused, the question chat and the explanation still work", async () => {
    const s = await newStudent("Cy");
    setChunks(s, 0);
    const refused = await ask(s);
    assert.equal(refused.status, 402);
    assert.equal(refused.data.code, "no_chunks");
    assert.equal(await balance(s), 0);
    const q = dbModule.readDB().practiceQuestions[0];
    assert.equal((await ask(s, { questionId: q.id, messages: [{ role: "user", content: "Give me a hint" }] })).status, 200);
    assert.equal((await api(`/api/practice/questions/${q.id}/explanation`, { token: s.token })).status, 200);
    assert.equal(await balance(s), 0, "the explanation is free");
  });

  test("buying, then wearing: a shop part is refused until it is bought", async () => {
    const s = await newStudent("Di");
    const wear = (avatar) => api("/api/student/avatar", { method: "PUT", token: s.token, body: { avatar } });
    const locked = await wear({ id: "12", accessory: "crown", frame: "none" });
    assert.equal(locked.status, 403);
    assert.match(locked.data.error, /Comet Shop/);
    assert.equal((await wear({ id: "12", accessory: null, frame: "rose" })).status, 200, "free parts need nothing");

    const poor = await api("/api/practice/shop/buy", { method: "POST", token: s.token, body: { id: "acc:crown" } });
    assert.equal(poor.status, 402);
    assert.match(poor.data.error, /25 more comet chunks/);
    setChunks(s, 60);
    const bought = await api("/api/practice/shop/buy", { method: "POST", token: s.token, body: { id: "acc:crown" } });
    assert.equal(bought.status, 200);
    assert.equal(bought.data.balance, 20);
    assert.deepEqual(bought.data.owned, ["acc:crown"]);
    assert.equal(bought.data.log[0].why, "Bought: Crown");
    assert.equal((await api("/api/practice/shop/buy", { method: "POST", token: s.token, body: { id: "acc:crown" } })).status, 409);
    assert.equal((await api("/api/practice/shop/buy", { method: "POST", token: s.token, body: { id: "nope" } })).status, 404);
    assert.equal(await balance(s), 20);

    const worn = await wear({ id: "12", accessory: "crown", frame: "rose" });
    assert.equal(worn.status, 200);
    assert.deepEqual(worn.data.avatar, { id: "12", accessory: "crown", frame: "rose" });
    assert.equal((await wear({ id: "12", accessory: "crown", frame: "galaxy" })).status, 403, "the frame is a separate purchase");
  });

  test("a student who already wore a shop part keeps it when their wallet is first opened", async () => {
    const s = await newStudent("Eli");
    // As it was before the shop: the part is on the picture and there is no wallet yet.
    dbModule.updateDB((db) => {
      db.users.find((u) => u.id === s.id).avatar = { id: "03", accessory: "shades", frame: "dawn" };
      db.progress = db.progress.filter((p) => p.userId !== s.id);
    });
    const chunks = (await api("/api/practice/progress", { token: s.token })).data.chunks;
    assert.deepEqual(chunks.owned.sort(), ["acc:shades", "frame:dawn"]);
    const kept = await api("/api/student/avatar", { method: "PUT", token: s.token, body: { avatar: { id: "09", accessory: "shades", frame: "dawn" } } });
    assert.equal(kept.status, 200);
  });

  test("an answer pays XP and, the first time that day, comet chunks, as two separate numbers", async () => {
    const s = await newStudent("Fay");
    const q = dbModule.readDB().practiceQuestions.find((x) => x.type !== "grid_in");
    const before = (await api("/api/practice/progress", { token: s.token })).data;
    const res = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", token: s.token, body: { answer: q.correctIndex } });
    assert.equal(res.status, 200);
    assert.ok(res.data.reward.xpGained > 0);
    assert.equal(res.data.reward.chunksGained, S.CHUNKS.firstStudy + S.CHUNKS.trophy);
    const now = (await api("/api/practice/progress", { token: s.token })).data;
    assert.equal(now.xp, before.xp + res.data.reward.xpGained);
    assert.equal(now.chunks.balance, before.chunks.balance + res.data.reward.chunksGained);
  });
});
