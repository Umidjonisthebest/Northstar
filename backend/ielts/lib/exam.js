// Candidate exam engine: builds each candidate's shuffled test, runs the
// section clock on the server, and grades sections on submit.
//
// Parts are stored one per record (listening section 1-4, reading passage 1-3,
// writing task 1-2). Every candidate gets one active record per part number,
// picked independently per part — so a candidate's test mixes parts from
// different source tests, and within a session the least-used variant wins.

import { nanoid } from "nanoid";
import { contentOf } from "../store.js";
import { gradeGroup, groupSlots, numberGroups, publicGroup } from "./questions.js";
import { countWords, overallBand, rawToBand } from "./scoring.js";
import { cancellation, reinstate } from "../../examLock.js";

export const SECTIONS = ["listening", "reading", "writing"];
export const SCORE_SECTIONS = ["listening", "reading", "writing", "speaking"];
export const LISTENING_REVIEW_SECONDS = 120;
export const WRITING_SECONDS = 60 * 60;
export const GRACE_MS = 60_000;

const PART_COUNTS = { listening: 4, reading: 3, writing: 2 };
const PART_FIELD = { listening: "section", reading: "part", writing: "task" };

// Practice-only records (see lib/practice.js) never go into mock sessions.
// (Not the students' own material: section practice, or a part that belongs to a practice test.)
const isActive = (record) => record.active !== false && !record.deletedAt && record.use !== "practice" && record.use !== "test";

export function pickAssignment(db, session) {
  const usage = new Map();
  for (const exam of db.ieltsExams) {
    if (exam.sessionId !== session.id) continue;
    for (const section of SECTIONS) {
      for (const id of exam.assignment?.[section] || []) usage.set(id, (usage.get(id) || 0) + 1);
    }
  }
  const assignment = {};
  for (const section of SECTIONS) {
    const field = PART_FIELD[section];
    const records = contentOf(db, section).filter(isActive);
    assignment[section] = [];
    for (let n = 1; n <= PART_COUNTS[section]; n++) {
      const pool = records.filter((r) => Number(r[field]) === n);
      if (!pool.length) continue;
      const least = Math.min(...pool.map((r) => usage.get(r.id) || 0));
      const candidates = pool.filter((r) => (usage.get(r.id) || 0) === least);
      assignment[section].push(candidates[Math.floor(Math.random() * candidates.length)].id);
    }
  }
  return assignment;
}

export function emptySectionState() {
  return { status: "pending", startedAt: null, deadline: null, submittedAt: null, answers: {}, flags: [], autoSubmitted: false };
}

export function emptyScores() {
  return Object.fromEntries(SCORE_SECTIONS.map((s) => [s, { band: null, notes: "", updatedAt: null }]));
}

export function partRecords(db, exam, section) {
  const records = contentOf(db, section);
  return (exam.assignment?.[section] || []).map((id) => records.find((r) => r.id === id)).filter(Boolean);
}

function firstOpenStep(db, exam) {
  for (const section of SECTIONS) {
    if (exam.sections[section].status !== "submitted" && partRecords(db, exam, section).length > 0) return section;
  }
  return "done";
}

export function findExam(db, sessionId, userId) {
  return db.ieltsExams.find((e) => e.sessionId === sessionId && e.userId === userId) || null;
}

export function ensureExam(db, session, userId) {
  let exam = findExam(db, session.id, userId);
  if (!exam) {
    exam = {
      id: nanoid(12),
      sessionId: session.id,
      userId,
      assignment: pickAssignment(db, session),
      step: "listening",
      sections: Object.fromEntries(SECTIONS.map((s) => [s, emptySectionState()])),
      results: {},
      scores: emptyScores(),
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    exam.step = firstOpenStep(db, exam);
    db.ieltsExams.push(exam);
  }
  return exam;
}

export function hasAnyContent(db, exam) {
  return SECTIONS.some((s) => partRecords(db, exam, s).length > 0);
}

export function sectionDurationSeconds(db, exam, section) {
  const parts = partRecords(db, exam, section);
  if (section === "listening") {
    const audio = parts.reduce((sum, p) => sum + (Number(p.durationMinutes) || 0) * 60, 0);
    return Math.round(audio) + LISTENING_REVIEW_SECONDS;
  }
  if (section === "reading") return parts.reduce((sum, p) => sum + (Number(p.durationMinutes) || 20) * 60, 0);
  return WRITING_SECONDS;
}

export function remainingSeconds(state) {
  if (!state?.deadline) return null;
  return Math.max(0, Math.round((Date.parse(state.deadline) - Date.now()) / 1000));
}

// Numbers the parts' questions consecutively (1..40) and strips answers unless
// withAnswers is set (admin previews and reviews).
export function assembleParts(section, parts, { withAnswers = false, startNumber = 1 } = {}) {
  let n = startNumber;
  const out = parts.map((p, index) => {
    if (section === "writing") {
      const task = Number(p.task) === 2 ? 2 : 1;
      return {
        index,
        refId: p.id,
        partNumber: index + 1,
        task,
        title: p.title || `Writing Task ${task}`,
        questionHtml: p.questionHtml || "",
        image: p.image || null,
        minWords: task === 1 ? 150 : 250,
        minutes: task === 1 ? 20 : 40
      };
    }
    const { numbered, next } = numberGroups(p.groups, n);
    const range = next > n ? [n, next - 1] : null;
    n = next;
    const part = {
      index,
      refId: p.id,
      partNumber: index + 1,
      title: p.title || "",
      range,
      groups: numbered.map(({ group, slots }) => ({
        ...(withAnswers ? group : publicGroup(group)),
        slots: slots.map((s) => ({ id: s.id, n: s.n, mode: s.mode, itemId: s.itemId, index: s.index }))
      }))
    };
    if (section === "listening") {
      part.audioUrl = p.audio?.url || null;
      part.durationSeconds = Math.round((Number(p.durationMinutes) || 0) * 60);
    } else {
      part.contentHtml = p.contentHtml || "";
    }
    return part;
  });
  return { section, parts: out, totalQuestions: n - startNumber };
}

export function buildSectionContent(db, exam, section, options) {
  return assembleParts(section, partRecords(db, exam, section), options);
}

export function startSection(db, exam, section) {
  const state = exam.sections[section];
  if (state.status === "pending") {
    const now = Date.now();
    state.status = "in_progress";
    state.startedAt = new Date(now).toISOString();
    state.deadline = new Date(now + sectionDurationSeconds(db, exam, section) * 1000).toISOString();
  }
  return state;
}

function answerKeysForPart(part) {
  const keys = new Set();
  for (const g of part.groups) {
    for (const s of groupSlots(g)) keys.add(s.mode === "multi" ? s.itemId : s.id);
  }
  return keys;
}

export function gradePart(part, answers) {
  const rows = [];
  for (const g of part.groups) {
    const slots = g.slots || [];
    const numberOf = new Map(slots.map((s) => [s.id, s.n]));
    for (const row of gradeGroup(g, answers)) rows.push({ ...row, n: numberOf.get(row.slotId) ?? null });
  }
  return rows;
}

export function submitSection(db, exam, section, { auto = false } = {}) {
  const state = exam.sections[section];
  if (state.status === "submitted") return;
  const now = new Date().toISOString();
  state.status = "submitted";
  state.submittedAt = now;
  state.startedAt = state.startedAt || now;
  state.autoSubmitted = auto;
  const base = { examId: exam.id, sessionId: exam.sessionId, userId: exam.userId, section, startedAt: state.startedAt, completedAt: now };

  if (section === "writing") {
    const words = {};
    for (const p of partRecords(db, exam, section)) {
      const essay = String(state.answers?.[p.id] || "");
      const task = Number(p.task) === 2 ? 2 : 1;
      words[`task${task}`] = countWords(essay);
      db.ieltsAttempts.push({ id: nanoid(10), ...base, refId: p.id, title: p.title || `Writing Task ${task}`, partNumber: task, essay, words: countWords(essay) });
    }
    exam.results.writing = { words };
  } else {
    let raw = 0;
    let total = 0;
    for (const part of buildSectionContent(db, exam, section, { withAnswers: true }).parts) {
      const rows = gradePart(part, state.answers || {});
      const correct = rows.filter((r) => r.correct).length;
      raw += correct;
      total += rows.length;
      const keys = answerKeysForPart(part);
      const answers = Object.fromEntries(Object.entries(state.answers || {}).filter(([k]) => keys.has(k)));
      db.ieltsAttempts.push({ id: nanoid(10), ...base, refId: part.refId, title: part.title, partNumber: part.partNumber, correct, total: rows.length, answers });
    }
    exam.results[section] = { raw, total, band: rawToBand(section, raw, total) };
  }

  exam.step = firstOpenStep(db, exam);
  if (exam.step === "done") exam.completedAt = now;
}

// A cancelled exam (the candidate left the test page, see ../../examLock.js) is never marked: its
// running section stays as it was, so a teacher who lets the candidate back in finds it there.
export function finalizeIfExpired(db, exam) {
  const section = exam.step;
  if (exam.cancelled || !SECTIONS.includes(section)) return false;
  const state = exam.sections[section];
  if (state.status === "in_progress" && Date.now() > Date.parse(state.deadline) + GRACE_MS) {
    submitSection(db, exam, section, { auto: true });
    return true;
  }
  return false;
}

// When the admin closes a session, anything still in progress is submitted
// with the last autosaved answers.
export function finalizeSessionExams(db, sessionId) {
  for (const exam of db.ieltsExams) {
    if (exam.sessionId !== sessionId || exam.cancelled) continue;
    for (const section of SECTIONS) {
      if (exam.sections[section].status === "in_progress") submitSection(db, exam, section, { auto: true });
    }
  }
}

// The candidate left the test page while a section was running: the exam is cancelled.
// Returns false when there is nothing running to cancel.
export function cancelExam(exam, kind, now = Date.now()) {
  const section = exam.step;
  if (exam.cancelled || !SECTIONS.includes(section) || exam.sections[section].status !== "in_progress") return false;
  exam.cancelled = cancellation(kind, { section }, now);
  return true;
}

// A teacher lets the candidate back in: the section they were in gets back the time it was closed for.
export function reinstateExam(exam, by = "", now = Date.now()) {
  const section = exam.cancelled?.section;
  const closedFor = reinstate(exam, by, now);
  const state = exam.sections[section];
  if (state?.status === "in_progress" && state.deadline) state.deadline = new Date(Date.parse(state.deadline) + closedFor).toISOString();
}

export function effectiveBand(exam, section) {
  if (!exam) return null;
  const override = exam.scores?.[section]?.band;
  if (override != null) return override;
  if (section === "listening" || section === "reading") return exam.results?.[section]?.band ?? null;
  return null;
}

export function sectionStatus(exam, section) {
  if (!exam) return { completed: false, completedAt: null, band: null };
  if (section === "speaking") {
    const s = exam.scores?.speaking;
    return { completed: s?.band != null, completedAt: s?.updatedAt || null, band: s?.band ?? null };
  }
  const st = exam.sections?.[section];
  return { completed: st?.status === "submitted", completedAt: st?.submittedAt || null, band: effectiveBand(exam, section) };
}

export function examOverall(exam) {
  if (!exam) return null;
  return overallBand(SCORE_SECTIONS.map((s) => effectiveBand(exam, s)));
}
