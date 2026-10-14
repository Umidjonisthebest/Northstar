// IELTS diagnostic test: a new student's starting band from one listening part
// or reading passage, picked at random from the practice material they have
// never tried (in practice, an earlier diagnostic or a mock test). It runs like
// the real test: the recording plays once, reading is timed, answers are
// autosaved, and the part is marked when the time runs out.

import { nanoid } from "nanoid";
import { XP, award, getProgress, scoreIeltsPart } from "../../gamification.js";
import { cancellation, cancelledView } from "../../examLock.js";
import { contentOf } from "../store.js";
import { countSlots } from "./questions.js";
import { answersForPart, gradePractice, minutesFor, partNumberOf, practicePart, practiceRecords, summarizeItem } from "./practice.js";

export const DIAGNOSTIC_KINDS = ["listening", "reading"];
export const CHECK_SECONDS = 60; // after the recording, to check answers
export const GRACE_MS = 60_000;

// The IELTS band ranges published for each CEFR level.
export const cefrFor = (band) => (band == null ? null : band >= 8.5 ? "C2" : band >= 7 ? "C1" : band >= 5.5 ? "B2" : band >= 4 ? "B1" : "Below B1");

const iso = (ms) => new Date(ms).toISOString();

// Parts the student has met anywhere: practice, an earlier diagnostic, or a mock test.
export function triedRefIds(db, userId) {
  const ids = new Set();
  for (const a of db.ieltsPracticeAttempts) if (a.userId === userId) ids.add(a.refId);
  for (const d of db.ieltsDiagnostics) if (d.userId === userId) ids.add(d.refId);
  for (const a of db.ieltsAttempts) if (a.userId === userId) ids.add(a.refId);
  return ids;
}

export function freshParts(db, userId) {
  const tried = triedRefIds(db, userId);
  const out = {};
  for (const kind of DIAGNOSTIC_KINDS) {
    out[kind] = practiceRecords(db, kind).filter((r) => !tried.has(r.id) && countSlots(r.groups) > 0 && (kind !== "listening" || r.audio?.url));
  }
  return out;
}

// Listening or reading at random (whichever still has new parts), then a random part.
export function pickPart(db, userId, rnd = Math.random) {
  const pools = freshParts(db, userId);
  const kinds = DIAGNOSTIC_KINDS.filter((k) => pools[k].length);
  if (!kinds.length) return null;
  const kind = kinds[Math.floor(rnd() * kinds.length)];
  const list = pools[kind];
  return { kind, record: list[Math.floor(rnd() * list.length)] };
}

export const recordOf = (db, d) => contentOf(db, d.kind).find((r) => r.id === d.refId && !r.deletedAt) || null;

export function durationSeconds(kind, record) {
  if (kind === "listening") return Math.round((Number(record.durationMinutes) || 0) * 60) + CHECK_SECONDS;
  return minutesFor(kind, record) * 60;
}

export const remainingSeconds = (d, now = Date.now()) => (d.deadline ? Math.max(0, Math.round((Date.parse(d.deadline) - now) / 1000)) : null);
export const isOpen = (d, now = Date.now()) => d.status === "in_progress" && now <= Date.parse(d.deadline) + GRACE_MS;
// Assigned but not finished: the part can't be opened in practice meanwhile.
export const isPending = (d, now = Date.now()) => d.status === "created" || isOpen(d, now);

export function createDiagnostic(db, userId, rnd = Math.random) {
  const pick = pickPart(db, userId, rnd);
  if (!pick) return null;
  const d = {
    id: nanoid(10),
    userId,
    kind: pick.kind,
    refId: pick.record.id,
    title: pick.record.title || "",
    number: partNumberOf(pick.kind, pick.record),
    status: "created",
    createdAt: iso(Date.now()),
    startedAt: null,
    deadline: null,
    durationSeconds: null,
    answers: {},
    flags: [],
    submittedAt: null,
    result: null
  };
  db.ieltsDiagnostics.push(d);
  return d;
}

// The clock starts when the student reaches the exam screen, not when the part is assigned.
export function beginDiagnostic(db, d, now = Date.now()) {
  if (d.status !== "created") return;
  const record = recordOf(db, d);
  const seconds = record ? durationSeconds(d.kind, record) : 0;
  d.status = "in_progress";
  d.startedAt = iso(now);
  d.durationSeconds = seconds;
  d.deadline = iso(now + seconds * 1000);
}

// Marks the part and records it as a practice attempt too, so the practice
// page shows it as tried and counts it in the band estimates. It closes
// without a band ("expired") when nothing was answered, when the clock closed
// it with fewer than half the questions answered (the student most likely
// walked away), or when the part was deleted meanwhile.
export function completeDiagnostic(db, d, { auto = false, now = Date.now() } = {}) {
  const record = recordOf(db, d);
  const started = d.startedAt ? Date.parse(d.startedAt) : now;
  const end = Math.max(started, auto && d.deadline ? Math.min(now, Date.parse(d.deadline)) : now);
  d.submittedAt = iso(end);
  d.auto = auto;
  d.seconds = Math.max(0, Math.min(d.durationSeconds || Infinity, Math.round((end - started) / 1000)));
  const graded = record ? gradePractice(d.kind, record, d.answers) : null;
  d.answered = graded ? graded.rows.filter((r) => String(r.given ?? "").trim() !== "").length : 0;
  if (!graded || !d.answered || (auto && d.answered < Math.ceil(graded.total / 2))) {
    d.status = "expired";
    d.result = null;
    return { reward: null };
  }
  const { correct, total, band } = graded;
  d.status = "completed";
  d.result = { correct, total, band, cefr: cefrFor(band) };
  db.ieltsPracticeAttempts.push({
    id: nanoid(10),
    userId: d.userId,
    kind: d.kind,
    refId: d.refId,
    title: d.title,
    number: d.number,
    seconds: d.seconds,
    createdAt: d.submittedAt,
    correct,
    total,
    band,
    answers: answersForPart(d.kind, record, d.answers),
    diagnosticId: d.id
  });
  const p = getProgress(db, d.userId);
  return { reward: award(p, XP.diagnostic + scoreIeltsPart(p, d.refId, record.level, correct), ["pathfinder"]) };
}

// The student left the test page while the diagnostic was running (../../examLock.js): it is
// closed with no band, no practice attempt and no XP. The part still counts as tried
// (triedRefIds), so the next diagnostic picks another.
export function cancelDiagnostic(d, kind, now = Date.now()) {
  if (d.status !== "in_progress") return false;
  const started = d.startedAt ? Date.parse(d.startedAt) : now;
  d.status = "cancelled";
  d.cancelled = cancellation(kind, {}, now);
  d.submittedAt = iso(Math.max(started, now));
  d.seconds = Math.max(0, Math.min(d.durationSeconds || Infinity, Math.round((now - started) / 1000)));
  d.result = null;
  return true;
}

export function publicSummary(d, now = Date.now()) {
  return {
    id: d.id,
    kind: d.kind,
    refId: d.refId,
    title: d.title,
    number: d.number,
    status: d.status,
    cancelled: cancelledView(d.cancelled),
    createdAt: d.createdAt,
    startedAt: d.startedAt,
    submittedAt: d.submittedAt || null,
    auto: Boolean(d.auto),
    seconds: d.seconds ?? null,
    answered: d.answered ?? null,
    remainingSeconds: d.status === "in_progress" ? remainingSeconds(d, now) : null,
    result: d.result || null
  };
}

// Everything the diagnostic screen needs. Answer keys only after it is marked.
export function diagnosticPayload(db, d, now = Date.now()) {
  const record = recordOf(db, d);
  const duration = d.durationSeconds ?? (record ? durationSeconds(d.kind, record) : null);
  const remaining = d.status === "in_progress" ? remainingSeconds(d, now) : null;
  const diagnostic = {
    ...publicSummary(d, now),
    durationSeconds: duration,
    elapsedSeconds: remaining == null || duration == null ? 0 : Math.max(0, duration - remaining),
    answers: d.answers || {},
    flags: d.flags || []
  };
  if (!record) return { diagnostic, item: null, part: null, review: null };
  let review = null;
  if (d.status === "completed") {
    const graded = gradePractice(d.kind, record, d.answers);
    review = {
      rows: graded.rows.map(({ slotId, n, given, expected, correct }) => ({ slotId, n, given, expected, correct })),
      keys: graded.keys,
      transcriptHtml: d.kind === "listening" ? record.transcriptHtml || null : null
    };
  }
  return { diagnostic, item: summarizeItem(d.kind, record, []), part: practicePart(d.kind, record), review };
}

export function latestDiagnostics(db, userId) {
  const done = db.ieltsDiagnostics
    .filter((d) => d.userId === userId && d.status === "completed" && d.result)
    .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  return { latest: done[0] || null, byKind: Object.fromEntries(DIAGNOSTIC_KINDS.map((k) => [k, done.find((d) => d.kind === k) || null])) };
}

// For the dashboard: an assigned or running diagnostic, and the latest band per skill.
export function diagnosticStatus(db, userId, now = Date.now()) {
  const open = db.ieltsDiagnostics.find((d) => d.userId === userId && (d.status === "created" || d.status === "in_progress"));
  const { latest, byKind } = latestDiagnostics(db, userId);
  return {
    open: open ? { ...publicSummary(open, now), timedOut: open.status === "in_progress" && !isOpen(open, now) } : null,
    latest: latest ? publicSummary(latest, now) : null,
    bands: Object.fromEntries(DIAGNOSTIC_KINDS.map((k) => [k, byKind[k] ? { band: byKind[k].result.band, cefr: byKind[k].result.cefr, at: byKind[k].submittedAt } : null]))
  };
}
