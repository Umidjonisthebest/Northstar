// A student's IELTS analytics, worked out from what they have handed in on their own: section
// practice, practice tests and the diagnostic all store one row per part in ieltsPracticeAttempts.
// Nothing here is self-reported, and nothing is stored: it is read from the attempts each time.

import { contentOf } from "../store.js";
import { gradeGroup } from "./questions.js";
import { inPractice, inTest } from "./practice.js";
import { rawToBand } from "./scoring.js";

// Question types as a student knows them. Drag-and-drop variants count with their typed twin.
const TYPE_FAMILY = {
  form_completion: ["forms", "Form and note completion"],
  note_completion: ["forms", "Form and note completion"],
  table_completion: ["tables", "Table and flow-chart completion"],
  flowchart_completion: ["tables", "Table and flow-chart completion"],
  flowchart_dnd: ["tables", "Table and flow-chart completion"],
  summary_completion: ["summary", "Summary completion"],
  summary_dnd: ["summary", "Summary completion"],
  sentence_completion: ["sentences", "Sentence completion"],
  short_answer: ["short", "Short answers"],
  multiple_choice: ["mcq", "Multiple choice"],
  multiple_answers: ["multi", "Choose two or more"],
  tfng: ["tfng", "True / False / Not Given"],
  ynng: ["ynng", "Yes / No / Not Given"],
  matching_headings: ["headings", "Matching headings"],
  matching_information: ["information", "Matching information"],
  matching_features: ["features", "Matching features"],
  matching_sentence_endings: ["endings", "Sentence endings"],
  map_select: ["maps", "Maps and diagrams"],
  map_dnd: ["maps", "Maps and diagrams"],
  diagram_completion: ["maps", "Maps and diagrams"],
  diagram_dnd: ["maps", "Maps and diagrams"]
};
export const MIN_TYPE_ANSWERS = 3; // fewer than this says nothing about a question type
const TREND = 12;
const share = (correct, total) => (total ? Math.round((correct / total) * 100) : null);

// Each skill's band from the best attempt at every part tried: section-practice parts and the
// parts of practice tests alike (analytics is everything a student has done alone).
function bandEstimate(db, kind, attempts) {
  let correct = 0;
  let total = 0;
  const tried = new Set(attempts.map((a) => a.refId));
  for (const record of contentOf(db, kind)) {
    if (!tried.has(record.id) || record.deletedAt || !(inPractice(record) || inTest(record))) continue;
    const mine = attempts.filter((a) => a.refId === record.id && a.total);
    if (!mine.length) continue;
    const best = mine.reduce((b, a) => (a.correct / a.total > b.correct / b.total ? a : b));
    correct += best.correct;
    total += best.total;
  }
  return total ? { band: rawToBand(kind, correct, total), correct, total } : null;
}

function markedSkill(db, kind, attempts) {
  const mine = attempts.filter((a) => a.kind === kind && a.total);
  const correct = mine.reduce((n, a) => n + (a.correct || 0), 0);
  const total = mine.reduce((n, a) => n + a.total, 0);
  return {
    attempts: mine.length,
    questions: total,
    correct,
    accuracy: share(correct, total),
    estimate: bandEstimate(db, kind, mine),
    trend: mine.slice(-TREND).map((a) => ({ at: a.createdAt, title: a.title, number: a.number, correct: a.correct, total: a.total, pct: share(a.correct, a.total), band: a.band ?? rawToBand(kind, a.correct, a.total) }))
  };
}

// Accuracy by question type, from the latest attempt at each part (a part done five times would
// otherwise count five times). The stored answers are marked again against the part as it is now.
function byType(db, attempts) {
  const latest = new Map();
  for (const a of attempts) if ((a.kind === "listening" || a.kind === "reading") && a.answers) latest.set(a.refId, a);
  const families = new Map();
  for (const a of latest.values()) {
    const record = contentOf(db, a.kind).find((r) => r.id === a.refId);
    if (!record) continue;
    for (const g of record.groups || []) {
      const [key, label] = TYPE_FAMILY[g.type] || [];
      if (!key) continue;
      const rows = gradeGroup(g, a.answers);
      const f = families.get(key) || { type: key, label, correct: 0, total: 0, listening: 0, reading: 0 };
      f.correct += rows.filter((r) => r.correct).length;
      f.total += rows.length;
      f[a.kind] += rows.length;
      families.set(key, f);
    }
  }
  return [...families.values()]
    .map((f) => ({ type: f.type, label: f.label, correct: f.correct, total: f.total, accuracy: share(f.correct, f.total), skill: f.listening && f.reading ? "both" : f.listening ? "listening" : "reading", enough: f.total >= MIN_TYPE_ANSWERS }))
    .sort((a, b) => Number(b.enough) - Number(a.enough) || a.accuracy - b.accuracy || b.total - a.total);
}

// Accuracy by part number: Listening parts 1-4 and Reading passages 1-3 get harder as they go.
function byPart(kind, attempts, count) {
  return Array.from({ length: count }, (_, i) => {
    const mine = attempts.filter((a) => a.kind === kind && a.number === i + 1 && a.total);
    const correct = mine.reduce((n, a) => n + (a.correct || 0), 0);
    const total = mine.reduce((n, a) => n + a.total, 0);
    return { number: i + 1, attempts: mine.length, correct, total, accuracy: share(correct, total) };
  });
}

export function ieltsAnalytics(db, userId, target = null) {
  const attempts = (db.ieltsPracticeAttempts || []).filter((a) => a.userId === userId).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const essays = attempts.filter((a) => a.kind === "writing");
  const marked = attempts.filter((a) => a.total);
  const correct = marked.reduce((n, a) => n + (a.correct || 0), 0);
  const questions = marked.reduce((n, a) => n + a.total, 0);
  const words = essays.reduce((n, a) => n + (a.words || 0), 0);
  const types = byType(db, attempts);
  const rated = types.filter((t) => t.enough);
  return {
    target,
    totals: {
      attempts: attempts.length,
      questions,
      correct,
      accuracy: share(correct, questions),
      seconds: attempts.reduce((n, a) => n + (a.seconds || 0), 0),
      days: new Set(attempts.map((a) => String(a.createdAt).slice(0, 10))).size,
      sections: (db.ieltsTestAttempts || []).filter((a) => a.userId === userId).length
    },
    skills: {
      listening: markedSkill(db, "listening", attempts),
      reading: markedSkill(db, "reading", attempts),
      writing: {
        attempts: essays.length,
        words,
        averageWords: essays.length ? Math.round(words / essays.length) : null,
        trend: essays.slice(-TREND).map((a) => ({ at: a.createdAt, title: a.title, number: a.number, words: a.words || 0 }))
      }
    },
    types,
    // The weakest and strongest question types with enough answers to say so.
    focus: rated.length >= 2 ? { weakest: rated[0], strongest: rated[rated.length - 1] } : null,
    parts: { listening: byPart("listening", attempts, 4), reading: byPart("reading", attempts, 3) },
    recent: attempts
      .slice(-10)
      .reverse()
      .map((a) => ({ id: a.id, kind: a.kind, refId: a.refId, title: a.title, number: a.number, correct: a.correct ?? null, total: a.total ?? null, band: a.band ?? null, words: a.words ?? null, seconds: a.seconds ?? null, testAttemptId: a.testAttemptId || null, diagnostic: Boolean(a.diagnosticId), createdAt: a.createdAt }))
  };
}
