// Vocabulary practice the server marks: the Learn mode's exercises and the Match game.
// (A flashcard is the student's own rating of their recall: POST /practice/vocab/:id/rate.)
// The page builds each exercise from the deck it already shows, and sends what the student
// picked; whether that was right, what it does to the word's mastery and what it pays are
// decided here.
//
// One answer is { id, kind, pick }: `id` is the word that was asked about and `pick` the word
// the student chose for it.
//  - match:    the word `id` was paired with the meaning of `pick`;
//  - sentence: `pick` was put in the gap of `id`'s example sentence;
//  - word:     `pick` was chosen for `id`'s meaning (a word with no usable sentence).
// It is right when the two are the same word.

import { todayKey } from "./gamification.js";
import { VOCAB_NEAR } from "./practiceContent.js";

export const VOCAB_PRACTICE = {
  round: 10, // words in one Learn or Flashcards round
  pairs: 6, // pairs on a Match board
  penalty: 2, // seconds a wrong pair adds to a Match time
  marks: { match: [6, -4], sentence: [12, -10], word: [12, -10] }, // mastery for a right / a wrong answer
  maxAnswers: 200, // answers one request may carry (a board played with many wrong pairs is long)
  minPerPair: 0.3, // a Match time under this many seconds a pair is not a time anyone played
  maxSeconds: 3600
};

const clamp = (n) => Math.max(0, Math.min(100, n));

// The answers of a request body, or null when it isn't a list of them.
export function cleanVocabAnswers(body) {
  const list = body?.answers;
  if (!Array.isArray(list) || !list.length || list.length > VOCAB_PRACTICE.maxAnswers) return null;
  const out = [];
  for (const a of list) {
    if (!a || typeof a.id !== "string" || typeof a.pick !== "string" || !Object.hasOwn(VOCAB_PRACTICE.marks, a.kind)) return null;
    out.push({ id: a.id, kind: a.kind, pick: a.pick });
  }
  return out;
}

// Marks the answers and moves each word's mastery. Only the first answer to a word in each
// kind of exercise counts, so trying the choices one after another earns nothing. Answers
// about a word that is no longer in the deck are left out.
// Returns { results: [{ id, kind, ok }], right: [word id], touched: [word id] }.
export function markVocab(db, p, answers) {
  const deck = new Set(db.vocab.map((w) => w.id));
  const counted = new Set();
  const right = new Set();
  const touched = new Set();
  const results = [];
  for (const a of answers) {
    if (!deck.has(a.id)) continue;
    const ok = a.pick === a.id;
    results.push({ id: a.id, kind: a.kind, ok });
    const key = `${a.kind}|${a.id}`;
    if (counted.has(key)) continue;
    counted.add(key);
    const [gain, loss] = VOCAB_PRACTICE.marks[a.kind];
    p.vocab[a.id] = clamp((p.vocab[a.id] ?? 0) + (ok ? gain : loss));
    touched.add(a.id);
    if (ok) right.add(a.id);
  }
  return { results, right: [...right], touched: [...touched] };
}

// A finished Match board's time: the seconds the page counted plus the penalty for every wrong
// pair, or null when the board wasn't finished or the time can't be one. The best one is kept.
// (Nothing is paid for a time, so the page's clock is taken at its word within sane bounds.)
export function matchTime(p, results, seconds) {
  const pairs = new Set(results.filter((r) => r.kind === "match" && r.ok).map((r) => r.id)).size;
  const wrong = results.filter((r) => r.kind === "match" && !r.ok).length;
  const sane = typeof seconds === "number" && Number.isFinite(seconds) && seconds >= pairs * VOCAB_PRACTICE.minPerPair && seconds <= VOCAB_PRACTICE.maxSeconds;
  if (pairs < VOCAB_PRACTICE.pairs || !sane) return null;
  const time = Math.round((seconds + wrong * VOCAB_PRACTICE.penalty) * 10) / 10;
  const games = (p.vocabGames ||= {});
  const before = games.matchBest?.seconds ?? null;
  const record = before === null || time < before;
  if (record) games.matchBest = { seconds: time, at: new Date().toISOString() };
  return { seconds: time, wrong, best: games.matchBest.seconds, record };
}

// ---- Words too close in meaning to be each other's wrong choices ----
// Words that say little about a meaning; a definition's other words of four letters or more are
// compared by their first five letters ("logic" and "logical" are one).
const PLAIN = new Set(
  "something someone that this with from than rather very more most being have having especially often only about into other another when what which their there them they also such some many much been done like kind quality person thing things people manner particular based showing great able easily easy likely make made".split(" ")
);
const roots = (text) => new Set((String(text || "").toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => !PLAIN.has(w)).map((w) => w.slice(0, 5)));

// For each word of the deck, the ids of the words that must not be offered as a wrong choice for
// it: the starter deck's near-synonyms (VOCAB_NEAR), a word that the other's definition uses,
// and words whose definitions share a telling word ("lasting for a very short time" and "lasting
// only for a short time"). The last rule also catches pairs that aren't synonyms; that only
// makes the choices for a word a little fewer.
export function nearWords(vocab) {
  const near = new Map(vocab.map((w) => [w.id, new Set()]));
  const link = (a, b) => {
    if (a === b) return;
    near.get(a).add(b);
    near.get(b).add(a);
  };
  const byWord = new Map(vocab.map((w) => [String(w.word || "").trim().toLowerCase(), w.id]));
  for (const group of VOCAB_NEAR) {
    const ids = group.map((word) => byWord.get(word)).filter(Boolean);
    for (const a of ids) for (const b of ids) link(a, b);
  }
  const told = vocab.map((w) => ({ id: w.id, name: String(w.word || "").trim().toLowerCase().slice(0, 5), roots: roots(w.definition) }));
  for (let i = 0; i < told.length; i++) {
    for (let j = i + 1; j < told.length; j++) {
      const [a, b] = [told[i], told[j]];
      if (a.roots.has(b.name) || b.roots.has(a.name) || [...a.roots].some((r) => b.roots.has(r))) link(a.id, b.id);
    }
  }
  return new Map([...near].map(([id, set]) => [id, [...set]]));
}

// What the vocabulary page needs besides the deck: the sizes of a round and a board, the
// student's best Match time and how many different words they have practised today.
export function vocabGames(p) {
  return {
    round: VOCAB_PRACTICE.round,
    pairs: VOCAB_PRACTICE.pairs,
    penalty: VOCAB_PRACTICE.penalty,
    matchBest: p.vocabGames?.matchBest?.seconds ?? null,
    today: p.daily?.date === todayKey() ? (p.daily.vocab || []).length : 0
  };
}
