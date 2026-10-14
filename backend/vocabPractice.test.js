import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

// The vocabulary modes: what the page builds a round from (frontend/src/pages/hub/vocab/exercises.js,
// plain JS) and what the server does with the answers (vocabPractice.js, POST /practice/vocab/answers).
const dbPath = path.join(os.tmpdir(), `northstar-vocab-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";

let server;
let base;
let token;
let readDB;
let updateDB;
let XP;
let VOCAB_PRACTICE;
let nearWords;
let VOCAB_WORDS;
let VOCAB_NEAR;
let ex;

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  ({ XP } = await import("./gamification.js"));
  ({ VOCAB_PRACTICE, nearWords } = await import("./vocabPractice.js"));
  ({ VOCAB_WORDS, VOCAB_NEAR } = await import("./practiceContent.js"));
  ex = await import("../frontend/src/pages/hub/vocab/exercises.js");
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  token = (await signUp("ada-vocab@test.local")).token;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dbPath, { force: true });
});

async function api(p, { method = "GET", body, auth } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${auth ?? token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const signUp = async (email) => (await api("/api/student/register", { method: "POST", body: { firstName: "Ada", lastName: "L", email, password: "password1" }, auth: "" })).data;
const answers = (body, auth) => api("/api/practice/vocab/answers", { method: "POST", body, auth });
const deck = async (auth) => (await api("/api/practice/vocab", { auth })).data;
const idOf = (word) => readDB().vocab.find((w) => w.word === word).id;

// A repeatable stand-in for Math.random.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("building a round (exercises.js)", () => {
  test("a sentence's gap is the word as the sentence has it", () => {
    const cut = (example, word) => ex.blankOut(example, word);
    assert.deepEqual(cut("The connection was tenuous, not causal.", "tenuous"), { before: "The connection was ", gap: "tenuous", after: ", not causal." });
    assert.equal(cut("The author substantiates each claim.", "substantiate").gap, "substantiates");
    assert.equal(cut("Reviewers scrutinized the paper's methods.", "scrutinize").gap, "scrutinized");
    assert.equal(cut("Critics lauded the novel for its plot.", "laud").gap, "lauded");
    assert.equal(cut("The report implied a delay.", "imply").gap, "implied");
    assert.equal(cut("Diligent note-taking made the review painless.", "diligent").gap, "Diligent");
    assert.equal(cut("They kept the status quo for years.", "status quo").gap, "status quo");
    // The whole word, not a longer one that happens to start with it.
    assert.equal(cut("The novelist wrote a novel method.", "novel").gap, "novel");
    assert.equal(cut("She undertook the survey herself.", "undertake"), null);
    assert.equal(cut("", "tenuous"), null);
    assert.equal(cut("A sentence without it.", "tenuous"), null);
  });

  test("every starter word's example can be turned into a sentence question", () => {
    const without = VOCAB_WORDS.filter((w) => !ex.blankOut(w.example, w.word)).map((w) => w.word);
    assert.deepEqual(without, []);
    for (const w of VOCAB_WORDS) {
      const { before, gap, after } = ex.blankOut(w.example, w.word);
      assert.equal(before + gap + after, w.example);
    }
  });

  test("a round is the weakest words, and words on the same mastery come in a changing order", () => {
    const words = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}`, word: `w${i}`, mastery: i < 5 ? 60 : i < 12 ? 10 : 0 }));
    const round = ex.pickRound(words, 10, seeded(1));
    assert.equal(round.length, 10);
    assert.ok(round.every((w) => w.mastery === 0));
    assert.notDeepEqual(round.map((w) => w.id), ex.pickRound(words, 10, seeded(2)).map((w) => w.id));
    // With fewer weak words than the round, the next weakest fill it.
    assert.deepEqual(ex.pickRound(words.slice(0, 14), 10, seeded(3)).map((w) => w.mastery).sort((a, b) => a - b), [0, 0, 10, 10, 10, 10, 10, 10, 10, 60]);
    assert.equal(ex.pickRound(words.slice(0, 3), 10).length, 3);
  });

  test("the choices hold the word once, and never a near-synonym while others are left", async () => {
    const { words } = await deck();
    const byId = new Map(words.map((w) => [w.id, w]));
    for (let seed = 1; seed <= 4; seed++) {
      const rand = seeded(seed);
      for (const w of words) {
        const q = ex.sentenceQuestion(w, words, rand);
        assert.equal(q.kind, "sentence");
        assert.equal(q.choices.length, 4);
        assert.equal(new Set(q.choices.map((c) => c.id)).size, 4);
        assert.equal(q.choices.filter((c) => c.id === w.id).length, 1);
        for (const c of q.choices) if (c.id !== w.id) assert.ok(!w.near.includes(c.id), `${c.word} offered for ${w.word}`);
        // Same part of speech as the word, so grammar doesn't give the answer away.
        for (const c of q.choices) assert.equal(byId.get(c.id).partOfSpeech, w.partOfSpeech, `${c.word} offered for ${w.word}`);
      }
    }
    // A deck too small for that still gets a question.
    const tiny = words.slice(0, 3).map((w) => ({ ...w, near: words.slice(0, 3).map((x) => x.id) }));
    assert.equal(ex.sentenceQuestion(tiny[0], tiny).choices.length, 3);
    assert.equal(ex.sentenceQuestion({ ...tiny[0], example: "" }, tiny).kind, "word");
  });

  test("a match board is the right size, one tile a side per word, without near-synonyms", async () => {
    const { words } = await deck();
    for (let seed = 1; seed <= 20; seed++) {
      const board = ex.pickBoard(words, 6, seeded(seed));
      assert.equal(new Set(board.map((w) => w.id)).size, 6);
      for (const a of board) for (const b of board) assert.ok(a === b || !a.near.includes(b.id), `${a.word} and ${b.word} on one board`);
      const tiles = ex.boardTiles(board, seeded(seed));
      assert.equal(tiles.length, 12);
      assert.equal(new Set(tiles.map((t) => t.key)).size, 12);
      for (const w of board) assert.deepEqual(tiles.filter((t) => t.id === w.id).map((t) => t.side).sort(), ["meaning", "word"]);
    }
    assert.equal(ex.pickBoard(words.slice(0, 4), 6).length, 4);
    assert.deepEqual(ex.boards([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5).map((b) => b.length), [5, 5]);
    assert.deepEqual(ex.boards([1, 2, 3, 4, 5, 6], 5).map((b) => b.length), [6]);
    assert.deepEqual(ex.boards([1, 2, 3, 4, 5, 6, 7], 5).map((b) => b.length), [5, 2]);
    // A round's near-synonyms land on different boards.
    const round = ["viable", "feasible", "rigid", "austere", "lament", "thrive", "innate", "debunk", "hinder", "digress"].map((word) => words.find((w) => w.word === word));
    const [one, two] = ex.boards(round, 5).map((b) => b.map((w) => w.word));
    assert.deepEqual([one.length, two.length], [5, 5]);
    assert.notEqual(one.includes("viable"), one.includes("feasible"));
    assert.notEqual(one.includes("rigid"), one.includes("austere"));
  });

  test("times and mastery bands read as the page shows them", () => {
    assert.deepEqual([0, 42.34, 59.96, 75.5].map(ex.clock), ["0:00.0", "0:42.3", "1:00.0", "1:15.5"]);
    assert.deepEqual([0, 1, 79, 80, 100].map(ex.band), ["new", "learning", "learning", "mastered", "mastered"]);
  });
});

describe("near-synonyms (vocabPractice.js)", () => {
  test("the starter deck's groups name real words, and are near both ways", () => {
    const known = new Set(VOCAB_WORDS.map((w) => w.word));
    for (const group of VOCAB_NEAR) for (const word of group) assert.ok(known.has(word), `${word} is not a starter word`);
    const vocab = readDB().vocab;
    const near = nearWords(vocab);
    for (const [a, b] of [["viable", "feasible"], ["ephemeral", "transient"], ["prevalent", "ubiquitous"], ["disparage", "deride"], ["novel", "unprecedented"]]) {
      assert.ok(near.get(idOf(a)).includes(idOf(b)), `${a} / ${b}`);
      assert.ok(near.get(idOf(b)).includes(idOf(a)), `${b} / ${a}`);
    }
    for (const w of vocab) assert.ok(!near.get(w.id).includes(w.id));
    // Every word still has plenty of words of its own kind left to choose from.
    for (const w of vocab) {
      const left = vocab.filter((x) => x.id !== w.id && x.partOfSpeech === w.partOfSpeech && !near.get(w.id).includes(x.id)).length;
      assert.ok(left >= 3, `${w.word} has only ${left}`);
    }
  });

  test("a teacher's own words are told apart by their definitions", () => {
    const vocab = [
      { id: "a", word: "brief", definition: "Lasting only a short time." },
      { id: "b", word: "fleeting", definition: "Lasting for a very short time." },
      { id: "c", word: "loud", definition: "Making a lot of noise." },
      { id: "d", word: "noisy", definition: "Loud and unpleasant." }
    ];
    const near = nearWords(vocab);
    assert.deepEqual(near.get("a"), ["b"]);
    assert.deepEqual(near.get("c"), ["d"]); // "noisy" is defined with the word "loud"
    assert.deepEqual(near.get("d"), ["c"]);
  });
});

describe("POST /api/practice/vocab/answers", () => {
  test("the deck comes with what a round needs", async () => {
    const { words, games } = await deck();
    assert.equal(words.length, VOCAB_WORDS.length);
    assert.ok(words.every((w) => Array.isArray(w.near) && w.mastery === 0));
    assert.deepEqual(games, { round: VOCAB_PRACTICE.round, pairs: VOCAB_PRACTICE.pairs, penalty: VOCAB_PRACTICE.penalty, matchBest: null, today: 0 });
  });

  test("answers are marked on the server; only the first one for a word in an exercise counts", async () => {
    const [a, b, c] = ["tenuous", "cogent", "candid"].map(idOf);
    const [right, wrong] = VOCAB_PRACTICE.marks.sentence;
    const res = await answers({
      mode: "learn",
      answers: [
        { id: a, kind: "sentence", pick: a },
        { id: b, kind: "sentence", pick: a },
        { id: b, kind: "sentence", pick: b }, // a second try at the same question
        { id: c, kind: "match", pick: c }
      ]
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.results.map((r) => r.ok), [true, false, true, true]);
    const mastery = Object.fromEntries(res.data.words.map((w) => [w.id, w.mastery]));
    assert.deepEqual(mastery, { [a]: right, [b]: Math.max(0, wrong), [c]: VOCAB_PRACTICE.marks.match[0] });
    // Paid like a flashcard: the two words answered right, once each.
    assert.equal(res.data.reward.xpGained, 2 * XP.vocab);
    assert.equal(res.data.games.today, 2);

    // The same words again the same day: mastery moves, nothing more is paid.
    const again = await answers({ mode: "learn", answers: [{ id: a, kind: "sentence", pick: a }] });
    assert.equal(again.data.words[0].mastery, 2 * right);
    assert.equal(again.data.reward.xpGained, 0);
    // A flashcard for a word already paid today pays nothing either.
    assert.equal((await api(`/api/practice/vocab/${a}/rate`, { method: "POST", body: { rating: "good" } })).data.reward.xpGained, 0);
  });

  test("mastery stays between 0 and 100, and mastering words earns the badge", async () => {
    const fresh = (await signUp("grace-vocab@test.local")).token;
    const id = idOf("lucid");
    assert.equal((await answers({ mode: "learn", answers: [{ id, kind: "word", pick: idOf("rigid") }] }, fresh)).data.words[0].mastery, 0);
    updateDB((db) => {
      const p = db.progress.find((x) => x.userId === db.users.find((u) => u.email === "grace-vocab@test.local").id);
      for (const w of db.vocab.slice(0, 9)) p.vocab[w.id] = 100;
      p.vocab[id] = 95;
    });
    const res = await answers({ mode: "learn", answers: [{ id, kind: "word", pick: id }] }, fresh);
    assert.equal(res.data.words[0].mastery, 100);
    assert.equal(res.data.mastered, 10);
    assert.ok(res.data.reward.newBadges.some((x) => x.id === "word_nerd"));
  });

  test("bad requests are refused and change nothing; unknown words are left out", async () => {
    const before = JSON.stringify(readDB().progress);
    const id = idOf("tenuous");
    const bad = [
      {},
      { answers: [] },
      { answers: "all of them" },
      { answers: [{ id, kind: "sentence" }] },
      { answers: [{ id, kind: "spelling", pick: id }] },
      { answers: [{ id: 5, kind: "match", pick: id }] },
      { answers: [null] },
      { answers: Array.from({ length: VOCAB_PRACTICE.maxAnswers + 1 }, () => ({ id, kind: "match", pick: id })) }
    ];
    for (const body of bad) assert.equal((await answers(body)).status, 400, JSON.stringify(body).slice(0, 80));
    assert.equal(JSON.stringify(readDB().progress), before);

    const res = await answers({ mode: "learn", answers: [{ id: "no-such-word", kind: "match", pick: "no-such-word" }] });
    assert.equal(res.status, 200);
    assert.deepEqual([res.data.results, res.data.words, res.data.reward], [[], [], null]);
    assert.equal(JSON.stringify(readDB().progress), before);
    assert.equal((await api("/api/practice/vocab/answers", { method: "POST", body: { answers: [] }, auth: "" })).status, 401);
  });

  test("a finished Match board gets a time: the clock plus the penalties, and the best is kept", async () => {
    const fresh = (await signUp("joan-vocab@test.local")).token;
    const ids = readDB().vocab.slice(20, 20 + VOCAB_PRACTICE.pairs).map((w) => w.id);
    const pairs = ids.map((id) => ({ id, kind: "match", pick: id }));
    const miss = { id: ids[0], kind: "match", pick: ids[1] };

    const first = await answers({ mode: "match", seconds: 30.04, answers: [miss, miss, ...pairs] }, fresh);
    assert.deepEqual(first.data.match, { seconds: 30 + 2 * VOCAB_PRACTICE.penalty, wrong: 2, best: 30 + 2 * VOCAB_PRACTICE.penalty, record: true });
    assert.equal(first.data.games.matchBest, 34);
    // The word that was first put with the wrong meaning loses a little; the rest gain.
    const mastery = Object.fromEntries(first.data.words.map((w) => [w.id, w.mastery]));
    assert.equal(mastery[ids[0]], 0);
    assert.equal(mastery[ids[1]], VOCAB_PRACTICE.marks.match[0]);
    assert.equal(first.data.reward.xpGained, (VOCAB_PRACTICE.pairs - 1) * XP.vocab);

    const slower = await answers({ mode: "match", seconds: 50, answers: pairs }, fresh);
    assert.deepEqual([slower.data.match.seconds, slower.data.match.best, slower.data.match.record], [50, 34, false]);
    const faster = await answers({ mode: "match", seconds: 21.5, answers: pairs }, fresh);
    assert.deepEqual([faster.data.match.best, faster.data.match.record], [21.5, true]);
    assert.equal((await deck(fresh)).games.matchBest, 21.5);

    // No time for a board that wasn't finished, a clock no one could have played, or Learn mode.
    for (const body of [
      { mode: "match", seconds: 5, answers: pairs.slice(1) },
      { mode: "match", seconds: 0.2, answers: pairs },
      { mode: "match", seconds: -3, answers: pairs },
      { mode: "match", seconds: "fast", answers: pairs },
      { mode: "match", answers: pairs },
      { mode: "learn", seconds: 5, answers: pairs }
    ]) {
      const res = await answers(body, fresh);
      assert.equal(res.status, 200);
      assert.equal(res.data.match, undefined, JSON.stringify(body).slice(0, 60));
    }
    assert.equal((await deck(fresh)).games.matchBest, 21.5);
  });

  test("words answered right count toward the study plan's vocab task, wrong ones don't", async () => {
    const fresh = (await signUp("mary-vocab@test.local")).token;
    const plan = async () => (await api("/api/practice/progress", { auth: fresh })).data.plan.tasks.find((t) => t.kind === "vocab");
    const task = await plan();
    const ids = readDB().vocab.slice(40, 40 + task.need).map((w) => w.id);
    const right = (id) => ({ id, kind: "sentence", pick: id });

    await answers({ mode: "learn", answers: [...ids.slice(0, 5).map(right), { id: ids[5], kind: "sentence", pick: ids[6] }] }, fresh);
    assert.equal((await plan()).have, 5);
    // The same words again add nothing; a flashcard for another word does.
    await answers({ mode: "learn", answers: ids.slice(0, 5).map(right) }, fresh);
    await api(`/api/practice/vocab/${ids[5]}/rate`, { method: "POST", body: { rating: "hard" }, auth: fresh });
    assert.equal((await plan()).have, 6);

    const last = await answers({ mode: "match", answers: ids.slice(6).map((id) => ({ id, kind: "match", pick: id })) }, fresh);
    assert.deepEqual(last.data.plan.finished.map((t) => t.title), ["Vocab"]);
    assert.equal(last.data.plan.reward.xpGained, XP.planTask);
    assert.equal((await plan()).done, true);
  });
});
