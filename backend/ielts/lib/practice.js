// Self-study practice: students take single listening parts, reading passages
// and writing tasks on their own from the hub, outside teacher-run sessions.
//
// Every content record has a `use`: "mock" (sessions only, the default for
// anything older), "practice" (the student Practice area only) or "both".
// Mock sessions never pick practice-only records, so practice material can't
// spoil a mock test.
//
// A fourth use, "test", is a part that belongs to one practice test (`testId`,
// see lib/practiceTests.js). It is in that test and nowhere else: not in
// section practice, not in a mock, not in a diagnostic. A teacher can't choose
// it for a record by hand; a part gets it by being made inside a test.

import { contentOf } from "../store.js";
import { assembleParts, gradePart } from "./exam.js";
import { countSlots, groupSlots } from "./questions.js";
import { countWords, rawToBand } from "./scoring.js";

// The uses a teacher can give a record in the editors and lists.
export const USES = ["mock", "practice", "both"];
export const TEST_USE = "test";
export const useOf = (record) => (record?.use === TEST_USE || USES.includes(record?.use) ? record.use : "mock");
export const inMocks = (record) => ["mock", "both"].includes(useOf(record));
export const inPractice = (record) => ["practice", "both"].includes(useOf(record));
export const inTest = (record) => useOf(record) === TEST_USE;

export const PRACTICE_KINDS = { listening: "section", reading: "part", writing: "task" };
const READING_START = { 1: 1, 2: 14, 3: 27 };
const isLive = (record) => record.active !== false && !record.deletedAt;

export const partNumberOf = (kind, record) => Number(record[PRACTICE_KINDS[kind]]) || 1;

export function practiceRecords(db, kind) {
  return contentOf(db, kind)
    .filter((r) => isLive(r) && inPractice(r))
    .sort((a, b) => partNumberOf(kind, a) - partNumberOf(kind, b) || String(a.title).localeCompare(String(b.title)));
}

export const findPracticeRecord = (db, kind, id) => practiceRecords(db, kind).find((r) => r.id === id) || null;

// Questions keep their real IELTS numbers (listening part 2 is 11–20, reading passage 3 starts at 27).
function startNumber(kind, record) {
  if (kind === "listening") return (partNumberOf(kind, record) - 1) * 10 + 1;
  if (kind === "reading") return READING_START[partNumberOf(kind, record)] || 1;
  return 1;
}

export function minutesFor(kind, record) {
  if (kind === "listening") return Math.max(1, Math.ceil(Number(record.durationMinutes) || 5));
  if (kind === "reading") return Number(record.durationMinutes) || 20;
  return partNumberOf(kind, record) === 2 ? 40 : 20;
}

export function practicePart(kind, record, { withAnswers = false } = {}) {
  const part = assembleParts(kind, [record], { withAnswers, startNumber: startNumber(kind, record) }).parts[0];
  part.partNumber = partNumberOf(kind, record);
  return part;
}

export function summarizeItem(kind, record, attempts = []) {
  const mine = attempts.filter((a) => a.refId === record.id);
  const last = mine[mine.length - 1] || null;
  const best = kind === "writing" || !mine.length ? null : mine.reduce((b, a) => (a.correct / a.total > b.correct / b.total ? a : b));
  return {
    id: record.id,
    kind,
    number: partNumberOf(kind, record),
    title: record.title || "",
    level: record.level || "MEDIUM",
    source: record.source || null,
    questionCount: kind === "writing" ? 1 : countSlots(record.groups),
    minutes: minutesFor(kind, record),
    minWords: kind === "writing" ? (partNumberOf(kind, record) === 2 ? 250 : 150) : null,
    hasImage: kind === "writing" ? Boolean(record.image?.url) : undefined,
    attempts: mine.length,
    best: best ? { correct: best.correct, total: best.total } : null,
    last: last ? { correct: last.correct ?? null, total: last.total ?? null, words: last.words ?? null, at: last.createdAt } : null
  };
}

// Marks a listening or reading attempt. `keys` holds each slot's accepted
// answers so the review screen can show them next to the student's.
export function gradePractice(kind, record, answers) {
  const part = practicePart(kind, record, { withAnswers: true });
  const rows = gradePart(part, answers || {});
  const correct = rows.filter((r) => r.correct).length;
  const keys = {};
  for (const g of part.groups) {
    for (const s of groupSlots(g)) {
      if (s.mode === "multi") {
        const item = (g.items || []).find((it) => it.id === s.itemId);
        const k = item?.correct?.[s.index];
        if (k) keys[s.id] = [k];
      } else {
        const a = g.answers?.[s.id];
        if (a?.value) keys[s.id] = [a.value, ...(a.variations || [])];
      }
    }
  }
  return { rows, correct, total: rows.length, band: rawToBand(kind, correct, rows.length), keys };
}

// Only the answers that belong to this part are stored.
export function answersForPart(kind, record, answers) {
  const ids = new Set();
  for (const g of record.groups || []) for (const s of groupSlots(g)) ids.add(s.mode === "multi" ? s.itemId : s.id);
  return Object.fromEntries(Object.entries(answers || {}).filter(([k]) => ids.has(k)));
}

// Quick, automatic checks on a practice essay. They are not a band score:
// they cover the things examiners look for first.
const LINKERS = [
  "however", "moreover", "furthermore", "in addition", "therefore", "as a result", "consequently", "for example", "for instance",
  "such as", "although", "even though", "while", "whereas", "on the other hand", "in contrast", "overall", "in conclusion",
  "to sum up", "firstly", "secondly", "finally", "because", "since", "despite", "in my view", "by contrast", "similarly"
];
const STOP = new Set(
  "this that with have from they their there were which would could should about these those than then them when what where while because also only more most much many such into over some other been being very your will just like make made does each both people".split(" ")
);

export function writingFeedback(task, essay) {
  const text = String(essay || "");
  const lower = text.toLowerCase();
  const words = countWords(text);
  const minWords = task === 2 ? 250 : 150;
  const paragraphs = text.split(/\n+/).map((s) => s.trim()).filter(Boolean).length;
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => countWords(s) > 0);
  const avgSentence = sentences.length ? Math.round(words / sentences.length) : 0;
  const linkers = LINKERS.filter((l) => new RegExp(`\\b${l}\\b`).test(lower));
  const counts = {};
  for (const w of lower.match(/[a-z']+/g) || []) if (w.length > 3 && !STOP.has(w)) counts[w] = (counts[w] || 0) + 1;
  const [topWord, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [];
  const wantParas = task === 2 ? 4 : 3;

  const checks = [
    {
      ok: words >= minWords,
      title: "Length",
      text: words >= minWords ? `${words} words: you reached the minimum of ${minWords}.` : `${words} words: Task ${task} asks for at least ${minWords}. Reaching it lets you earn full marks for the task.`
    },
    {
      ok: paragraphs >= wantParas,
      title: "Paragraphs",
      text:
        paragraphs >= wantParas
          ? `${paragraphs} paragraphs: your answer is clearly organised.`
          : `${paragraphs} paragraph${paragraphs === 1 ? "" : "s"}: aim for at least ${wantParas}, each with one main idea, separated by a blank line.`
    }
  ];
  if (task === 1) {
    const ok = /\b(overall|in general|it is clear|generally speaking|in summary)\b/.test(lower);
    checks.push({
      ok,
      title: "Overview",
      text: ok ? "You included an overview of the main features." : "Add an overview (for example, a sentence starting 'Overall, …') that sums up the main trends. Examiners look for it."
    });
  } else {
    const ok = /\b(i believe|i think|in my (view|opinion)|i (strongly |partly |completely )?(agree|disagree)|from my (point of view|perspective)|i would argue)\b/.test(lower);
    checks.push({
      ok,
      title: "Your position",
      text: ok ? "Your opinion is stated clearly." : "Make your own position clear in the introduction and conclusion (for example, 'In my view, …')."
    });
  }
  checks.push({
    ok: linkers.length >= 4,
    title: "Linking words",
    text: `You used ${linkers.length} different linking expression${linkers.length === 1 ? "" : "s"}${linkers.length ? ` (${linkers.slice(0, 5).join(", ")})` : ""}. Aim for a range, used naturally.`
  });
  if (topWord && topCount >= 6) {
    checks.push({ ok: false, title: "Repetition", text: `"${topWord}" appears ${topCount} times. Try some synonyms or pronouns.` });
  }
  if (sentences.length) {
    const ok = avgSentence >= 12 && avgSentence <= 30;
    checks.push({
      ok,
      title: "Sentence length",
      text: ok
        ? `About ${avgSentence} words per sentence: a good mix for this task.`
        : avgSentence < 12
          ? `About ${avgSentence} words per sentence. Join some ideas with 'which', 'although' or 'because' to show a range of structures.`
          : `About ${avgSentence} words per sentence. Some sentences may be too long to follow; split the longest ones.`
    });
  }
  return { words, minWords, paragraphs, checks };
}
