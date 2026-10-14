// What the vocabulary modes are built from: which words a round takes, a sentence with its word
// taken out, the choices of a question and the tiles of a match board. Plain JS, no React, so the
// backend's test runner checks it (backend/vocabPractice.test.js).
//
// A word is the deck's record as GET /practice/vocab sends it:
// { id, word, partOfSpeech, definition, example, mastery, near: [ids too close in meaning] }.
// Every function that draws at random takes `rand` (Math.random by default), so a test can
// pass a seeded one.

export const MASTERED = 80;
export const band = (mastery) => (mastery >= MASTERED ? "mastered" : mastery > 0 ? "learning" : "new");

export function shuffle(list, rand = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The `count` words to practise next: the weakest first. Words on the same mastery come in a
// random order (a new deck is all 0%, and would otherwise always open with the same ten).
export function pickRound(words, count, rand = Math.random) {
  return shuffle(words, rand)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, count);
}

const isNear = (a, b) => Boolean(a.near?.includes(b.id) || b.near?.includes(a.id));

// The words of a Match board: drawn at random from the weakest (three boards' worth), leaving
// out a word too close in meaning to one already on the board while there are others to take.
export function pickBoard(words, count, rand = Math.random) {
  const pool = shuffle(pickRound(words, count * 3, rand), rand);
  const board = [];
  for (const w of pool) if (board.length < count && !board.some((x) => isNear(x, w))) board.push(w);
  for (const w of pool) if (board.length < count && !board.includes(w)) board.push(w);
  return board;
}

// The example sentence with its word taken out: { before, gap, after }, where `gap` is the word
// as the sentence has it ("substantiates" for "substantiate"). Null when the sentence doesn't
// use the word in a form that can be found (an irregular one, or no sentence at all).
export function blankOut(example, word) {
  const text = String(example || "");
  const w = String(word || "").trim().toLowerCase();
  if (!text.trim() || !w) return null;
  const cut = (at, length) => ({ before: text.slice(0, at), gap: text.slice(at, at + length), after: text.slice(at + length) });
  const tokens = [...text.matchAll(/[A-Za-z][A-Za-z'’-]*/g)];
  const exact = tokens.find((m) => m[0].toLowerCase() === w);
  if (exact) return cut(exact.index, exact[0].length);
  if (/\s/.test(w)) {
    const at = text.toLowerCase().indexOf(w);
    return at < 0 ? null : cut(at, w.length);
  }
  // An ending: "scrutinized", "advocates", "implied" (the final e or y gives way to it).
  const stem = w.length > 4 ? w.replace(/[ey]$/, "") : w;
  const form = tokens.find((m) => {
    const t = m[0].toLowerCase();
    return t.startsWith(stem) && t.length >= w.length - 1 && t.length <= w.length + 4;
  });
  return form ? cut(form.index, form[0].length) : null;
}

// The choices for a question about `target`: the word itself and up to `count - 1` others, in a
// random order. Wrong choices are never near-synonyms of the target while the deck has enough
// other words, and the same part of speech comes first, so grammar alone doesn't give it away.
export function choicesFor(target, deck, count = 4, rand = Math.random) {
  const others = shuffle(deck.filter((w) => w.id !== target.id), rand);
  const far = others.filter((w) => !isNear(target, w));
  const same = (w) => (w.partOfSpeech || "") === (target.partOfSpeech || "");
  const ranked = [...far.filter(same), ...far.filter((w) => !same(w)), ...others.filter((w) => isNear(target, w))];
  return shuffle([target, ...ranked.slice(0, count - 1)], rand);
}

// A "complete the sentence" question: the example with a gap, the meaning as the clue (a gap
// alone is not fair: most adjectives fit most sentences) and the words to choose from.
// A word with no usable sentence is asked by its meaning alone (`kind: "word"`).
export function sentenceQuestion(target, deck, rand = Math.random) {
  const cut = blankOut(target.example, target.word);
  return {
    id: target.id,
    kind: cut ? "sentence" : "word",
    ...(cut || {}),
    clue: target.definition,
    choices: choicesFor(target, deck, 4, rand).map((w) => ({ id: w.id, word: w.word }))
  };
}

// The tiles of a match board: one for each word and one for each meaning, mixed.
export function boardTiles(words, rand = Math.random) {
  return shuffle(
    words.flatMap((w) => [
      { key: `w-${w.id}`, id: w.id, side: "word", text: w.word },
      { key: `m-${w.id}`, id: w.id, side: "meaning", text: w.definition }
    ]),
    rand
  );
}

// A round's words in boards of `size`, the last one not left with a single pair. Words too close
// in meaning go on different boards while there is room.
export function boards(words, size) {
  const sizes = [];
  for (let left = words.length; left > 0; left -= size) sizes.push(Math.min(size, left));
  if (sizes.length > 1 && sizes[sizes.length - 1] < 2) sizes[sizes.length - 2] += sizes.pop();
  const out = sizes.map(() => []);
  for (const w of words) {
    const open = out.filter((board, i) => board.length < sizes[i]);
    (open.find((board) => !board.some((x) => isNear(x, w))) || open[0]).push(w);
  }
  return out;
}

// "0:42.3" for a Match time in seconds.
export function clock(seconds) {
  const tenths = Math.round(Math.max(0, seconds) * 10);
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${tenths % 10}`;
}
