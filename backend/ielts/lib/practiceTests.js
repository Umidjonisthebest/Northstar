// Practice tests: a whole IELTS test a student takes alone from the hub, one section at a time
// (Listening parts 1-4, Reading passages 1-3, Writing tasks 1-2).
//
// A test owns its parts. Each part is a content record like any other (so the editors, the exam
// screen and the marking are the same), but with `use: "test"` and the test's id (`testId`): it is
// in that test and nowhere else. Practice tests and section practice are separate things: a part
// of a test is never listed in section practice, a diagnostic never picks one, and doing a test
// leaves the section-practice parts untried (and the other way round). Material that is wanted in
// both places is copied into the test (cloneForTest), and the copy is the test's own from then on.
//
//   db.ieltsPracticeTests  { id, seedKey?, title, level, source, parts: { listening, reading, writing }, active }
//   db.ieltsTestAttempts   one per finished section: { id, userId, testId, kind, correct?, total?, band?, words?, … }
//
// Every part of a finished section is stored as one row in ieltsPracticeAttempts (with
// `testAttemptId`), which is where the review, the XP rules and the analytics read it from. Those
// rows point at the test's own parts, so section practice never sees them.

import { nanoid } from "nanoid";
import { contentOf } from "../store.js";
import { assembleParts, gradePart } from "./exam.js";
import { countSlots, groupSlots } from "./questions.js";
import { PRACTICE_KINDS, TEST_USE, inTest, partNumberOf, writingFeedback } from "./practice.js";
import { overallBand, rawToBand } from "./scoring.js";

export const TEST_KINDS = Object.keys(PRACTICE_KINDS); // listening, reading, writing
export const PART_LIMIT = { listening: 4, reading: 3, writing: 2 };
export const LISTENING_CHECK_SECONDS = 120; // after the recording, as in the computer-delivered test
export const WRITING_MINUTES = 60;
export const LEVELS = ["EASY", "MEDIUM", "HARD"];

const isLive = (record) => record && record.active !== false && !record.deletedAt && inTest(record);
// The editors open the parts of one test's section together: they share this group.
export const testGroupId = (testId, kind) => `pt-${testId}-${kind}`;

export const liveTests = (db) => (db.ieltsPracticeTests || []).filter((t) => t.active !== false && !t.deletedAt);
export const findTest = (db, id) => liveTests(db).find((t) => t.id === id) || null;

// The records of one section, in part order. A part that was deleted or switched off simply drops
// out, so a test never breaks: the section is shorter (or missing) instead.
export function sectionRecords(db, test, kind) {
  const byId = new Map(contentOf(db, kind).map((r) => [r.id, r]));
  return (test.parts?.[kind] || [])
    .map((id) => byId.get(id))
    .filter(isLive)
    .sort((a, b) => partNumberOf(kind, a) - partNumberOf(kind, b));
}

export function sectionSeconds(kind, records) {
  if (kind === "listening") return Math.round(records.reduce((sum, r) => sum + (Number(r.durationMinutes) || 0) * 60, 0)) + LISTENING_CHECK_SECONDS;
  if (kind === "reading") return records.reduce((sum, r) => sum + (Number(r.durationMinutes) || 20) * 60, 0);
  return WRITING_MINUTES * 60;
}

// What the student's screen needs to run a section. Questions are numbered 1-40 across the parts.
export function sectionContent(kind, records, { withAnswers = false } = {}) {
  const content = assembleParts(kind, records, { withAnswers });
  for (const [i, part] of content.parts.entries()) part.partNumber = partNumberOf(kind, records[i]);
  return { ...content, seconds: sectionSeconds(kind, records) };
}

export function sectionSummary(kind, records) {
  const seconds = sectionSeconds(kind, records);
  return {
    kind,
    parts: records.length,
    questionCount: kind === "writing" ? records.length : records.reduce((n, r) => n + countSlots(r.groups), 0),
    minutes: Math.max(1, Math.round(seconds / 60)),
    titles: records.map((r) => r.title || "")
  };
}

// Marks a listening or reading section. `keys` holds each slot's accepted answers for the review.
export function gradeSection(kind, records, answers) {
  const { parts } = sectionContent(kind, records, { withAnswers: true });
  const rows = [];
  const keys = {};
  const perPart = [];
  for (const part of parts) {
    const partRows = gradePart(part, answers || {});
    rows.push(...partRows);
    perPart.push({ refId: part.refId, title: part.title, number: part.partNumber, correct: partRows.filter((r) => r.correct).length, total: partRows.length, rows: partRows });
    for (const g of part.groups) {
      for (const s of groupSlots(g)) {
        if (s.mode === "multi") {
          const k = (g.items || []).find((it) => it.id === s.itemId)?.correct?.[s.index];
          if (k) keys[s.id] = [k];
        } else {
          const a = g.answers?.[s.id];
          if (a?.value) keys[s.id] = [a.value, ...(a.variations || [])];
        }
      }
    }
  }
  const correct = rows.filter((r) => r.correct).length;
  return { rows, keys, perPart, correct, total: rows.length, band: rawToBand(kind, correct, rows.length) };
}

// The automatic checks on both essays of a writing section.
export function checkWriting(records, answers) {
  return records.map((r) => {
    const task = partNumberOf("writing", r) === 2 ? 2 : 1;
    const essay = String(answers?.[r.id] ?? "").slice(0, 20000);
    return { refId: r.id, task, title: r.title || `Writing Task ${task}`, essay, feedback: writingFeedback(task, essay) };
  });
}

// "Finished properly", which is what the comet chunks are paid for: a section handed in empty or
// nearly empty earns nothing. A quarter of the answers right, or every essay at its minimum length.
export const SECTION_PASS_SHARE = 0.25;
export function sectionCounts(kind, result) {
  if (kind === "writing") return result.essays.length > 0 && result.essays.every((e) => e.feedback.words >= e.feedback.minWords);
  return result.total > 0 && result.correct >= Math.ceil(result.total * SECTION_PASS_SHARE);
}

// ---- What a student has done in a test ----

export const testAttemptsOf = (db, userId) => (db.ieltsTestAttempts || []).filter((a) => a.userId === userId);

function sectionProgress(kind, attempts) {
  const mine = attempts.filter((a) => a.kind === kind);
  const last = mine[mine.length - 1] || null;
  if (kind === "writing") return { attempts: mine.length, best: null, last: last && { id: last.id, words: last.words ?? 0, at: last.createdAt } };
  const best = mine.length ? mine.reduce((b, a) => ((a.correct || 0) / (a.total || 1) > (b.correct || 0) / (b.total || 1) ? a : b)) : null;
  return {
    attempts: mine.length,
    best: best && { id: best.id, correct: best.correct, total: best.total, band: best.band },
    last: last && { id: last.id, correct: last.correct, total: last.total, band: last.band, at: last.createdAt }
  };
}

// A test as the hub lists it. Sections with no live parts are left out.
export function testView(db, test, attempts = []) {
  const mine = attempts.filter((a) => a.testId === test.id);
  const sections = {};
  for (const kind of TEST_KINDS) {
    const records = sectionRecords(db, test, kind);
    if (!records.length) continue;
    sections[kind] = { ...sectionSummary(kind, records), ...sectionProgress(kind, mine) };
  }
  const kinds = Object.keys(sections);
  const marked = ["listening", "reading"].filter((k) => sections[k]);
  const bands = marked.map((k) => sections[k].best?.band ?? null);
  return {
    id: test.id,
    title: test.title || "Practice test",
    description: test.description || "",
    level: LEVELS.includes(test.level) ? test.level : "MEDIUM",
    source: test.source || null,
    sections,
    done: kinds.filter((k) => sections[k].attempts > 0).length,
    of: kinds.length,
    // The mean of the best Listening and Reading bands, rounded the IELTS way. Writing and Speaking
    // need a teacher, so this is an estimate from the two marked skills, not an overall band.
    estimate: marked.length && bands.every((b) => b != null) ? overallBand(bands) : null
  };
}

// ---- A finished section again (the student's review, and the staff's) ----

// The answers, the marking and the key of one finished section, from its stored part rows.
// Null when the material is gone.
export function attemptReview(db, attempt) {
  const partAttempts = (db.ieltsPracticeAttempts || []).filter((a) => a.testAttemptId === attempt.id && a.userId === attempt.userId);
  const byId = new Map(contentOf(db, attempt.kind).map((r) => [r.id, r]));
  const records = partAttempts
    .map((a) => byId.get(a.refId))
    .filter(Boolean)
    .sort((a, b) => partNumberOf(attempt.kind, a) - partNumberOf(attempt.kind, b));
  if (!records.length) return null;
  if (attempt.kind === "writing") {
    const answers = Object.fromEntries(partAttempts.map((a) => [a.refId, a.essay || ""]));
    const essays = checkWriting(records, answers).map((e) => ({ ...e, modelAnswerHtml: byId.get(e.refId)?.modelAnswerHtml || null }));
    return { records, answers, essays };
  }
  const answers = Object.assign({}, ...partAttempts.map((a) => a.answers || {}));
  return { records, answers, ...gradeSection(attempt.kind, records, answers) };
}

// ---- A test's own parts (the studio, the seed and the startup step) ----

// Every part a test holds, by kind and in part order, switched off or not. (Deleted ones are gone.)
export function ownParts(db, test, kind) {
  const ids = new Set(test.parts?.[kind] || []);
  return contentOf(db, kind)
    .filter((r) => ids.has(r.id) && !r.deletedAt && inTest(r))
    .sort((a, b) => partNumberOf(kind, a) - partNumberOf(kind, b));
}

// Sets a test's part list from the records that say they are its own: called after a part is
// saved, copied in or removed.
export function relistParts(db, test, kind) {
  test.parts = test.parts || {};
  test.parts[kind] = contentOf(db, kind)
    .filter((r) => r.testId === test.id && !r.deletedAt && inTest(r))
    .sort((a, b) => partNumberOf(kind, a) - partNumberOf(kind, b))
    .map((r) => r.id);
}

// A copy of a record as a part of `test`: the test's own from now on, so changing or deleting
// either one leaves the other as it is. Files (audio, pictures) are shared, not copied.
export function cloneForTest(record, test, kind, now = new Date().toISOString()) {
  const { seedKey, seedHash, customized, deletedAt, ...rest } = structuredClone(record);
  return { ...rest, id: nanoid(10), groupId: testGroupId(test.id, kind), use: TEST_USE, testId: test.id, copiedFrom: record.id, active: true, createdAt: now, updatedAt: now };
}

// Before 2026-10-13 a practice test was a list of section-practice parts, shared with section
// practice. This makes every test own its parts, once: a part that still belongs to section
// practice (or a mock) is copied into the test, and the rows of sections students already
// finished are pointed at the copy, so their reviews, bests and XP carry on. `moveWhole(test,
// record)` says a record was only ever a part of that test: it is handed over as it is, id and
// all, and leaves section practice. `seedKeyFor(test, record)` names a seeded part.
// Returns how many parts were copied and moved; nothing happens the second time.
export function ownTestParts(db, { moveWhole = () => false, seedKeyFor = () => null } = {}) {
  const out = { copied: 0, moved: 0 };
  const now = new Date().toISOString();
  for (const test of db.ieltsPracticeTests || []) {
    if (test.deletedAt) continue;
    test.parts = test.parts || {};
    for (const kind of TEST_KINDS) {
      const list = contentOf(db, kind);
      const next = [];
      for (const id of test.parts[kind] || []) {
        const record = list.find((r) => r.id === id);
        if (!record || record.deletedAt) continue;
        if (inTest(record) && record.testId === test.id) {
          next.push(record.id);
          continue;
        }
        const key = seedKeyFor(test, record);
        if (!inTest(record) && moveWhole(test, record)) {
          Object.assign(record, { use: TEST_USE, testId: test.id, groupId: testGroupId(test.id, kind), ...(key ? { seedKey: key } : {}) });
          next.push(record.id);
          out.moved++;
          continue;
        }
        const copy = cloneForTest(record, test, kind, now);
        copy.active = record.active !== false;
        if (key) Object.assign(copy, { seedKey: key, seedHash: record.seedHash });
        list.push(copy);
        next.push(copy.id);
        out.copied++;
        const attemptIds = new Set((db.ieltsTestAttempts || []).filter((a) => a.testId === test.id).map((a) => a.id));
        for (const a of db.ieltsPracticeAttempts || []) if (a.refId === record.id && attemptIds.has(a.testAttemptId)) a.refId = copy.id;
      }
      test.parts[kind] = next;
    }
  }
  return out;
}
