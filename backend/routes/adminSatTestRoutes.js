// SAT practice tests in the staff panels ("SAT > Practice tests"): the tests a student sits alone.
// Mounted at /api/admin/sat-tests.
//
// Both panels can look: the list of tests, and students' results (a teacher's are their class
// students', as everywhere: staffScope.js). Only the admin changes anything: these tests are
// content every student gets, like the question bank. A teacher who wants a test of their own
// builds a teacher mock and runs it as a session (/api/tests, /api/sessions).
//
//   GET    /                     the studio's tests, the ten that came as files, and the mocks that can be copied
//   POST   /                     a new draft, in the digital SAT's shape (four modules)
//   POST   /from-mock/:testId    a draft copied from a teacher mock
//   PUT    /:testId/publish      { published }: show it to students, or take it back
//   PUT    /built-in/:key        { hidden }: take a file test off the students' list, or put it back
//   GET    /results              finished sittings, newest first
//   GET    /results/:runId       one sitting, question by question
//   …and the editor's own routes on a test, its modules and questions (routes/testRoutes.js).

import { Router } from "express";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../db.js";
import { requireAdmin, requireStaff } from "../auth.js";
import { classOf } from "../classrooms.js";
import { PRACTICE_TESTS, rawText } from "../content/practiceTests.js";
import { hiddenKeys, resultPayload, runFits, runSummary, testOf } from "../practiceTests.js";
import { blankPracticeTest, copyOfMock, isLiveStudioTest, sectionOf, studioKey } from "../satPracticeStudio.js";
import { canSeeStudent, visibleStudents } from "../staffScope.js";
import { makeTestRouter } from "./testRoutes.js";

const router = Router();
router.use(requireStaff);

const RESULT_ROWS = 400;
const fullName = (u) => `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "Student";
const questionsIn = (modules) => modules.reduce((n, m) => n + m.questions.length, 0);
const isOver = (run) => run.status === "completed" || run.status === "ended";

// How a test has been used, by the students this member of staff can see.
function usage(runs, key) {
  const mine = runs.filter((r) => r.test === key);
  const done = mine.filter(isOver);
  const totals = done.map((r) => r.result?.total).filter((n) => n != null);
  return {
    sittings: done.length,
    students: new Set(done.map((r) => r.userId)).size,
    inProgress: mine.filter((r) => r.status === "in_progress").length,
    average: totals.length ? Math.round(totals.reduce((s, n) => s + n, 0) / totals.length / 10) * 10 : null
  };
}

function studioView(test, runs) {
  return {
    id: test.id,
    key: studioKey(test.id),
    title: test.title,
    description: test.description || "",
    difficulty: test.difficulty || null,
    published: Boolean(test.published),
    // Published and with questions: this is when students have it.
    live: isLiveStudioTest(test),
    createdAt: test.createdAt,
    updatedAt: test.updatedAt || test.createdAt,
    questionCount: questionsIn(test.modules),
    modules: test.modules.map((m) => ({ id: m.id, name: m.name, section: sectionOf(m), minutes: m.timeLimitMinutes, questions: m.questions.length })),
    ...usage(runs, studioKey(test.id))
  };
}

router.get("/", (req, res) => {
  const db = readDB();
  const admin = req.user.role === "admin";
  const seen = new Set(visibleStudents(req, db).map((u) => u.id));
  const runs = db.practiceTestRuns.filter((r) => seen.has(r.userId));
  const hidden = hiddenKeys(db);
  res.json({
    canEdit: admin,
    // A draft is the admin's business until it is published.
    tests: db.satPracticeTests
      .filter((t) => admin || isLiveStudioTest(t))
      .map((t) => studioView(t, runs))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    builtIn: PRACTICE_TESTS.filter((t) => admin || !hidden.has(t.key)).map((t) => ({
      key: t.key,
      title: t.title,
      hidden: hidden.has(t.key),
      moduleCount: t.modules.length,
      questionCount: questionsIn(t.modules),
      minutes: t.modules.reduce((n, m) => n + m.minutes, 0),
      ...usage(runs, t.key)
    })),
    // What "copy a teacher mock" can start from.
    mocks: admin ? db.tests.map((t) => ({ id: t.id, title: t.title, questionCount: questionsIn(t.modules) })).filter((t) => t.questionCount > 0) : []
  });
});

router.post("/from-mock/:testId", requireAdmin, (req, res) => {
  const made = updateDB((db) => {
    const mock = db.tests.find((t) => t.id === req.params.testId);
    if (!mock) return null;
    const now = new Date().toISOString();
    const test = { id: nanoid(10), ...copyOfMock(mock), createdAt: now, updatedAt: now };
    db.satPracticeTests.push(test);
    return test;
  });
  if (!made) return res.status(404).json({ error: "Test not found" });
  res.status(201).json(made);
});

router.put("/built-in/:key", requireAdmin, (req, res) => {
  if (typeof req.body?.hidden !== "boolean") return res.status(400).json({ error: "hidden must be true or false" });
  if (!PRACTICE_TESTS.some((t) => t.key === req.params.key)) return res.status(404).json({ error: "Test not found" });
  const hidden = updateDB((db) => {
    const keys = new Set(db.satPracticeHidden || []);
    if (req.body.hidden) keys.add(req.params.key);
    else keys.delete(req.params.key);
    db.satPracticeHidden = [...keys];
    return keys.has(req.params.key);
  });
  res.json({ key: req.params.key, hidden });
});

router.put("/:testId/publish", requireAdmin, (req, res) => {
  if (typeof req.body?.published !== "boolean") return res.status(400).json({ error: "published must be true or false" });
  const out = updateDB((db) => {
    const test = db.satPracticeTests.find((t) => t.id === req.params.testId);
    if (!test) return { status: 404, error: "Test not found" };
    if (req.body.published && !questionsIn(test.modules)) return { status: 400, error: "Add at least one question before students get this test." };
    test.published = req.body.published;
    test.updatedAt = new Date().toISOString();
    return { test: studioView(test, []) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out.test);
});

// ---------- Results ----------
const studentView = (db, u) => ({ id: u.id, name: fullName(u), candidateId: u.candidateId || null, classroom: classOf(db, u) });

router.get("/results", (req, res) => {
  const db = readDB();
  const users = new Map(visibleStudents(req, db).map((u) => [u.id, u]));
  const rows = [];
  for (const run of db.practiceTestRuns) {
    const user = users.get(run.userId);
    if (!user || run.status === "in_progress") continue;
    const test = testOf(db, run.test);
    if (!runFits(test, run)) continue;
    const { modules, ...summary } = runSummary(run, test);
    rows.push({ ...summary, student: studentView(db, user), modules: modules.map((m) => ({ key: m.key, section: m.section, status: m.status, raw: m.raw, questions: m.questions })) });
  }
  rows.sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)));
  const tests = [...new Map(rows.map((r) => [r.test, r.title])).entries()].map(([key, title]) => ({ key, title }));
  res.json({ total: rows.length, rows: rows.slice(0, RESULT_ROWS), tests });
});

// One sitting: its scores, and every question with what the student gave and what was right.
router.get("/results/:runId", (req, res) => {
  const db = readDB();
  const run = db.practiceTestRuns.find((r) => r.id === req.params.runId);
  const user = run && db.users.find((u) => u.id === run.userId);
  if (!run || !canSeeStudent(req, user)) return res.status(404).json({ error: "Result not found" });
  const test = testOf(db, run.test);
  if (!runFits(test, run)) return res.status(410).json({ error: "This test has been removed or changed since it was sat." });
  if (run.status === "in_progress") return res.status(409).json({ error: "This sitting isn't finished yet." });
  const { reward, rewardSeen, modules, ...result } = resultPayload(run, test);
  res.json({
    ...result,
    student: studentView(db, user),
    modules: modules.map((m) => ({
      ...m,
      // The answer sheet, not the paper: each question is its number and a line of its text.
      items: m.items.map((q) => ({
        n: q.n,
        type: q.type,
        text: q.prompt.map((block) => rawText(block)).join(" ").replace(/\s+/g, " ").trim().slice(0, 160),
        given: q.given,
        correctIndex: q.correctIndex,
        shown: q.shown,
        answered: q.answered,
        correct: q.correct,
        flagged: q.flagged,
        seconds: Math.round((q.ms || 0) / 1000)
      }))
    }))
  });
});

// The editor: a test's details, modules and questions. Reading is for both panels, changing is the admin's.
router.use(makeTestRouter({ key: "satPracticeTests", write: requireAdmin, blank: blankPracticeTest }));

export default router;
