import express from "express";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../../db.js";
import { requireAdmin, requireStaff } from "../../auth.js";
import { classOf } from "../../classrooms.js";
import { canSeeStudent, visibleStudents } from "../../staffScope.js";
import { contentOf } from "../store.js";
import { cleanString } from "../lib/http.js";
import { countSlots } from "../lib/questions.js";
import { PRACTICE_KINDS, inTest, partNumberOf, useOf } from "../lib/practice.js";
import { LEVELS, PART_LIMIT, TEST_KINDS, attemptReview, cloneForTest, ownParts, relistParts, sectionRecords, sectionSummary } from "../lib/practiceTests.js";

// IELTS practice tests in the staff panels ("IELTS > Practice tests"): whole tests a student takes
// alone. A test owns its parts (lib/practiceTests.js), so it is built in two steps that never leave
// the test: make it (a title), then fill its sections, either in the Listening, Reading and
// Writing editors opened from the test's page (routes/contentRoutes.js, `testId`) or by copying a
// part that is already in section practice or the mock material. Mounted at /api/ielts/admin/tests.
//
// Both panels can look: the tests, and students' results (a teacher's are their class students').
// Only the admin changes anything: a practice test is content every student gets.
//
//   GET    /                      every test with its slots, and what can be copied in
//   POST   /                      a new, empty test: { title, description, level }. Hidden until it is shown.
//   GET    /results               finished sections, newest first
//   GET    /results/:attemptId    one finished section, answer by answer
//   GET    /:id                   one test (the builder's page)
//   PUT    /:id                   its title, description and level
//   PATCH  /:id                   { active }: show it to students, or hide it
//   POST   /:id/parts             { kind, from }: copy a part in
//   DELETE /:id/parts/:kind/:partId
//   DELETE /:id                   the test and its parts
const router = express.Router();
router.use(requireStaff);

const RESULT_ROWS = 400;
const fullName = (u) => `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "Student";
const liveTest = (db, id) => (db.ieltsPracticeTests || []).find((t) => t.id === id && !t.deletedAt) || null;
const touch = (test, now = new Date().toISOString()) =>
  // `customized` keeps the startup step (seed/starter.js) from putting a seeded test back as it was.
  Object.assign(test, { updatedAt: now }, test.seedKey ? { customized: true } : {});

const partView = (kind, r) => ({
  id: r.id,
  number: partNumberOf(kind, r),
  title: r.title || "",
  level: r.level || "MEDIUM",
  questionCount: kind === "writing" ? 1 : countSlots(r.groups),
  minutes: kind === "writing" ? null : Math.round(Number(r.durationMinutes) || 0),
  // What a student would be missing: a recording, or the part switched off.
  ready: kind !== "listening" || Boolean(r.audio?.url),
  active: r.active !== false
});

function adminView(db, test, attempts = db.ieltsTestAttempts || []) {
  const sections = {};
  const slots = {};
  for (const kind of TEST_KINDS) {
    const mine = ownParts(db, test, kind);
    // One slot for each part a real test has, filled or not.
    slots[kind] = Array.from({ length: PART_LIMIT[kind] }, (_, i) => {
      const record = mine.find((r) => partNumberOf(kind, r) === i + 1);
      return { number: i + 1, part: record ? partView(kind, record) : null };
    });
    const records = sectionRecords(db, test, kind);
    if (records.length) sections[kind] = sectionSummary(kind, records);
  }
  const taken = attempts.filter((a) => a.testId === test.id);
  return {
    id: test.id,
    title: test.title || "",
    description: test.description || "",
    level: LEVELS.includes(test.level) ? test.level : "MEDIUM",
    source: test.source || null,
    active: test.active !== false,
    seeded: Boolean(test.seedKey),
    slots,
    sections,
    // Students see a test once it is shown and has something in it.
    live: test.active !== false && Object.keys(sections).length > 0,
    filled: TEST_KINDS.reduce((n, k) => n + slots[k].filter((s) => s.part).length, 0),
    of: TEST_KINDS.reduce((n, k) => n + PART_LIMIT[k], 0),
    attempts: taken.length,
    students: new Set(taken.map((a) => a.userId)).size,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt
  };
}

// What can be copied into a test: section-practice and mock material, by kind and part number.
function library(db) {
  const out = {};
  for (const kind of TEST_KINDS) {
    out[kind] = contentOf(db, kind)
      .filter((r) => !r.deletedAt && !inTest(r))
      .map((r) => ({ ...partView(kind, r), use: useOf(r), source: r.source || null }))
      .sort((a, b) => a.number - b.number || a.title.localeCompare(b.title));
  }
  return out;
}

function readDetails(body) {
  const title = cleanString(body?.title, 120);
  if (!title) return { error: "Give the test a title." };
  return { fields: { title, description: cleanString(body?.description, 300), level: LEVELS.includes(body?.level) ? body.level : "MEDIUM" } };
}

router.get("/", (req, res) => {
  const db = readDB();
  const admin = req.user.role === "admin";
  const seen = new Set(visibleStudents(req, db).map((u) => u.id));
  const attempts = (db.ieltsTestAttempts || []).filter((a) => seen.has(a.userId));
  const tests = (db.ieltsPracticeTests || [])
    .filter((t) => !t.deletedAt)
    .map((t) => adminView(db, t, attempts))
    // A test students can't see yet is the admin's business.
    .filter((t) => admin || t.live);
  res.json({ canEdit: admin, tests, library: admin ? library(db) : null, kinds: PRACTICE_KINDS, limits: PART_LIMIT });
});

router.post("/", requireAdmin, (req, res) => {
  const parsed = readDetails(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const test = updateDB((db) => {
    db.ieltsPracticeTests = db.ieltsPracticeTests || [];
    const now = new Date().toISOString();
    const made = { id: nanoid(10), ...parsed.fields, source: null, parts: { listening: [], reading: [], writing: [] }, active: false, createdAt: now, updatedAt: now };
    db.ieltsPracticeTests.push(made);
    return adminView(db, made);
  });
  res.status(201).json(test);
});

// ---------- Results ----------
const studentView = (db, u) => ({ id: u.id, name: fullName(u), candidateId: u.candidateId || null, classroom: classOf(db, u) });

router.get("/results", (req, res) => {
  const db = readDB();
  const users = new Map(visibleStudents(req, db).map((u) => [u.id, u]));
  const titles = new Map((db.ieltsPracticeTests || []).map((t) => [t.id, t.title || "Practice test"]));
  const rows = (db.ieltsTestAttempts || [])
    .filter((a) => users.has(a.userId))
    .map((a) => ({
      id: a.id,
      student: studentView(db, users.get(a.userId)),
      testId: a.testId,
      title: titles.get(a.testId) || a.title || "Practice test",
      kind: a.kind,
      correct: a.correct ?? null,
      total: a.total ?? null,
      band: a.band ?? null,
      words: a.words ?? null,
      seconds: a.seconds ?? null,
      createdAt: a.createdAt
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const tests = [...new Map(rows.map((r) => [r.testId, r.title])).entries()].map(([id, title]) => ({ id, title }));
  res.json({ total: rows.length, rows: rows.slice(0, RESULT_ROWS), tests });
});

router.get("/results/:attemptId", (req, res) => {
  const db = readDB();
  const attempt = (db.ieltsTestAttempts || []).find((a) => a.id === req.params.attemptId);
  const user = attempt && db.users.find((u) => u.id === attempt.userId);
  if (!attempt || !canSeeStudent(req, user)) return res.status(404).json({ error: "Result not found" });
  const review = attemptReview(db, attempt);
  if (!review) return res.status(410).json({ error: "The material of this section has been removed." });
  const test = (db.ieltsPracticeTests || []).find((t) => t.id === attempt.testId);
  const head = {
    id: attempt.id,
    student: studentView(db, user),
    title: test?.title || attempt.title || "Practice test",
    kind: attempt.kind,
    seconds: attempt.seconds ?? null,
    createdAt: attempt.createdAt
  };
  if (attempt.kind === "writing") {
    return res.json({ ...head, words: attempt.words ?? null, essays: review.essays.map((e) => ({ task: e.task, title: e.title, essay: e.essay, words: e.feedback.words, minWords: e.feedback.minWords, checks: e.feedback.checks })) });
  }
  res.json({
    ...head,
    correct: review.correct,
    total: review.total,
    band: review.band,
    parts: review.perPart.map((p) => ({ number: p.number, title: p.title, correct: p.correct, total: p.total })),
    rows: review.rows.map(({ n, given, expected, correct }) => ({ n, given, expected, correct }))
  });
});

// ---------- One test ----------
router.get("/:id", (req, res) => {
  const db = readDB();
  const test = liveTest(db, req.params.id);
  if (!test) return res.status(404).json({ error: "Practice test not found" });
  const admin = req.user.role === "admin";
  res.json({ canEdit: admin, test: adminView(db, test), library: admin ? library(db) : null });
});

router.put("/:id", requireAdmin, (req, res) => {
  const parsed = readDetails(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const out = updateDB((db) => {
    const test = liveTest(db, req.params.id);
    if (!test) return null;
    touch(Object.assign(test, parsed.fields));
    return adminView(db, test);
  });
  if (!out) return res.status(404).json({ error: "Practice test not found" });
  res.json(out);
});

router.patch("/:id", requireAdmin, (req, res) => {
  if (typeof req.body?.active !== "boolean") return res.status(400).json({ error: "Nothing to change" });
  const out = updateDB((db) => {
    const test = liveTest(db, req.params.id);
    if (!test) return { status: 404, error: "Practice test not found" };
    if (req.body.active && !TEST_KINDS.some((k) => sectionRecords(db, test, k).length)) return { status: 400, error: "Add at least one part before students get this test." };
    touch(Object.assign(test, { active: req.body.active }));
    return { test: adminView(db, test) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out.test);
});

// Copies a part from section practice or the mock material into the test. The copy is the test's
// own; the original stays where it was, as it was.
router.post("/:id/parts", requireAdmin, (req, res) => {
  const kind = req.body?.kind;
  if (!TEST_KINDS.includes(kind)) return res.status(400).json({ error: "Unknown section" });
  const out = updateDB((db) => {
    const test = liveTest(db, req.params.id);
    if (!test) return { status: 404, error: "Practice test not found" };
    const source = contentOf(db, kind).find((r) => r.id === req.body?.from && !r.deletedAt && !inTest(r));
    if (!source) return { status: 404, error: "That part isn't available to copy any more." };
    const number = partNumberOf(kind, source);
    if (ownParts(db, test, kind).some((r) => partNumberOf(kind, r) === number)) {
      return { status: 409, error: `This test already has ${kind} ${PRACTICE_KINDS[kind]} ${number}. Remove it first to put another in its place.` };
    }
    const copy = cloneForTest(source, test, kind);
    contentOf(db, kind).push(copy);
    relistParts(db, test, kind);
    touch(test);
    return { test: adminView(db, test) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.status(201).json(out.test);
});

// Takes a part out of the test. It was the test's own, so it is deleted (softly: sections students
// already finished keep their review).
router.delete("/:id/parts/:kind/:partId", requireAdmin, (req, res) => {
  const kind = req.params.kind;
  if (!TEST_KINDS.includes(kind)) return res.status(404).json({ error: "Unknown section" });
  const out = updateDB((db) => {
    const test = liveTest(db, req.params.id);
    const record = test && ownParts(db, test, kind).find((r) => r.id === req.params.partId);
    if (!record) return null;
    const now = new Date().toISOString();
    Object.assign(record, { deletedAt: now, active: false });
    relistParts(db, test, kind);
    touch(test, now);
    // With nothing left in it, there is nothing to show students.
    if (!TEST_KINDS.some((k) => sectionRecords(db, test, k).length)) test.active = false;
    return adminView(db, test);
  });
  if (!out) return res.status(404).json({ error: "That part isn't in this test" });
  res.json(out);
});

// Deleting is soft, like the content records: students' finished sections keep their link, and a
// seeded test that was deleted doesn't come back at the next start. Its parts go with it.
router.delete("/:id", requireAdmin, (req, res) => {
  const ok = updateDB((db) => {
    const test = liveTest(db, req.params.id);
    if (!test) return false;
    const now = new Date().toISOString();
    for (const kind of TEST_KINDS) for (const r of ownParts(db, test, kind)) Object.assign(r, { deletedAt: now, active: false });
    Object.assign(test, { deletedAt: now, active: false });
    return true;
  });
  if (!ok) return res.status(404).json({ error: "Practice test not found" });
  res.json({ ok: true });
});

export default router;
