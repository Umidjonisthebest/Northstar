// SAT practice tests in the student hub (see practiceTests.js): the list of tests, starting a
// sitting (the whole test or one section, timed or not), a module's questions, autosave, hand-in,
// the leave report that cancels a sitting, ending early, and the results. Mounted at
// /api/practice-tests.

import { Router } from "express";
import { readDB, updateDB } from "../db.js";
import { requireStudent } from "../auth.js";
import {
  SCOPES,
  cancelRun,
  catalogue,
  completeModule,
  endRun,
  listedTests,
  modulePayload,
  needsSettling,
  newRun,
  nextModule,
  openModule,
  remainingSeconds,
  resultPayload,
  runFits,
  runSummary,
  scopeModules,
  settleRun,
  takeInput,
  testOf
} from "../practiceTests.js";

const router = Router();
router.use(requireStudent);

const GONE = { status: 404, error: "This practice test is no longer available." };
const CANCELLED = { status: 409, code: "CANCELLED", error: "This attempt was cancelled because you left the test page. You can start the test again." };
const settleMine = (db, req) => {
  for (const run of db.practiceTestRuns) if (run.userId === req.studentUserId) settleRun(db, run);
};

// For requests that only look. The database is written only when there is something to write: a
// module the clock has closed since the last look (it is handed in first), or what `mustWrite`
// names. A write stores the whole database, so a page that is only being read shouldn't cause one.
function look(req, fn, mustWrite = () => false) {
  const db = readDB();
  const stale = db.practiceTestRuns.some((r) => r.userId === req.studentUserId && needsSettling(r));
  if (!stale && !mustWrite(db)) return fn(db);
  return updateDB((fresh) => {
    settleMine(fresh, req);
    return fn(fresh);
  });
}

// The student's own run and its test.
function load(db, req) {
  const run = db.practiceTestRuns.find((r) => r.id === req.params.id && r.userId === req.studentUserId);
  if (!run) return { status: 404, error: "Practice test not found" };
  const test = testOf(db, run.test);
  // Gone, or changed in the studio so much that this sitting no longer fits it.
  return runFits(test, run) ? { run, test } : GONE;
}

// A module of the run that can be worked on now: modules are sat in order, one at a time.
function loadModule(db, req) {
  const found = load(db, req);
  if (found.error) return found;
  const { run, test } = found;
  const rm = run.modules.find((m) => m.key === req.params.module);
  if (!rm) return { status: 404, error: "Module not found" };
  if (run.status === "cancelled") return CANCELLED;
  if (run.status !== "in_progress") return { status: 409, code: "FINISHED", error: "This practice test is already finished." };
  if (rm.status === "completed") return { status: 409, code: "CLOSED", error: "This module has already been handed in." };
  if (nextModule(run) !== rm) return { status: 409, code: "ORDER", error: "Finish the module before this one first." };
  return { run, test, rm, mod: test.modules.find((m) => m.key === rm.key) };
}

const send = (res, out) => (out.error ? res.status(out.status).json({ error: out.error, code: out.code, runId: out.runId }) : res.json(out));

// Every practice test, with this student's sitting in progress and their finished ones.
router.get("/", (req, res) => {
  res.json(look(req, (db) => ({ tests: catalogue(db, req.studentUserId) })));
});

// Starts a sitting: { scope: "full" | "rw" | "math", timed: true | false }. One sitting of a test
// at a time: with one still going, the answer says which, so the page can offer to resume it.
router.post("/:test/start", (req, res) => {
  // Only a test on the student's list can be started: not a draft, and not one the admin has hidden.
  const test = listedTests(readDB()).find((t) => t.key === req.params.test);
  if (!test) return send(res, GONE);
  const scope = req.body?.scope;
  const timed = req.body?.timed;
  if (!SCOPES.includes(scope) || !scopeModules(test, scope).length) return res.status(400).json({ error: "Choose the full test or one of its sections" });
  if (typeof timed !== "boolean") return res.status(400).json({ error: "Choose timed or untimed" });
  const out = updateDB((db) => {
    settleMine(db, req);
    const open = db.practiceTestRuns.find((r) => r.userId === req.studentUserId && r.test === test.key && r.status === "in_progress");
    if (open) return { status: 409, code: "OPEN", runId: open.id, error: "You already have this test in progress. Resume it, or end it first." };
    const run = newRun(test, req.studentUserId, { scope, timed });
    db.practiceTestRuns.push(run);
    return { run: runSummary(run, test) };
  });
  if (!out.error) res.status(201);
  send(res, out);
});

// Where a sitting stands: its modules, and which one is next.
router.get("/runs/:id", (req, res) => {
  const out = look(req, (db) => {
    const found = load(db, req);
    return found.error ? found : { run: runSummary(found.run, found.test) };
  });
  send(res, out);
});

// A module's questions, without answers. Opening it for the first time starts its clock.
router.get("/runs/:id/modules/:module", (req, res) => {
  const unopened = (db) => {
    const found = loadModule(db, req);
    return !found.error && found.rm.status === "not_started";
  };
  const out = look(
    req,
    (db) => {
      const found = loadModule(db, req);
      if (found.error) return found;
      openModule(found.run, found.test, found.rm);
      return modulePayload(found.run, found.test, found.rm);
    },
    unopened
  );
  send(res, out);
});

// Autosave: { answers, flags, times }. They replace the stored copy (so clearing an answer sticks)
// and are what a module the clock closes is marked on.
router.put("/runs/:id/modules/:module/answers", (req, res) => {
  const out = updateDB((db) => {
    settleMine(db, req);
    const found = loadModule(db, req);
    if (found.error) return found;
    const { rm, mod } = found;
    if (rm.status !== "in_progress") return { status: 409, code: "NOT_STARTED", error: "Open the module before saving answers" };
    // (A module whose time is up was handed in by settleMine above, so it answers CLOSED.)
    takeInput(rm, mod, req.body);
    rm.savedAt = new Date().toISOString();
    return { ok: true, remainingSeconds: remainingSeconds(rm) };
  });
  send(res, out);
});

// Hands a module in: { answers, flags, times, auto }. Handing in a module that is already in (a
// second click, or the clock closed it a moment before) answers the same way, so it is safe to
// repeat. `late` says the clock had closed it first: it was marked on what had been saved.
router.post("/runs/:id/modules/:module/submit", (req, res) => {
  const out = updateDB((db) => {
    settleMine(db, req);
    const found = load(db, req);
    if (found.error) return found;
    const { run, test } = found;
    const rm = run.modules.find((m) => m.key === req.params.module);
    if (!rm) return { status: 404, error: "Module not found" };
    if (run.status === "cancelled") return CANCELLED;
    if (rm.status === "in_progress") {
      if (req.body?.answers && typeof req.body.answers === "object") takeInput(rm, test.modules.find((m) => m.key === rm.key), req.body);
      completeModule(db, run, test, rm, { auto: Boolean(req.body?.auto) });
    } else if (rm.status !== "completed") {
      return { status: 409, code: "NOT_STARTED", error: "This module hasn't been started." };
    }
    return { run: runSummary(run, test), late: rm.auto && !req.body?.auto ? true : undefined };
  });
  send(res, out);
});

// The module's screen saw the student leave it (another tab or window, the page closed, the Exit
// button): the sitting is cancelled, with no score. { module, kind }. A report about a module that
// isn't running any more (handed in, closed by its clock, the sitting already over) changes nothing.
router.post("/runs/:id/leave", (req, res) => {
  const out = updateDB((db) => {
    settleMine(db, req);
    const found = load(db, req);
    if (found.error) return found;
    const { run, test } = found;
    const rm = run.modules.find((m) => m.key === req.body?.module);
    if (run.status === "in_progress" && rm?.status === "in_progress") cancelRun(run, rm, req.body?.kind);
    return { run: runSummary(run, test) };
  });
  send(res, out);
});

// Ends a sitting early. The module in progress is handed in as it stands; modules never opened
// are left out. With nothing handed in at all, the sitting is simply removed (`run: null`).
router.post("/runs/:id/end", (req, res) => {
  const out = updateDB((db) => {
    settleMine(db, req);
    const found = load(db, req);
    if (found.error) return found;
    const { run, test } = found;
    if (run.status !== "in_progress") return { run: runSummary(run, test) };
    return endRun(db, run, test) ? { run: runSummary(run, test) } : { run: null };
  });
  send(res, out);
});

// Scores, and each question with its answer and explanation. Only once the sitting is over. A
// cancelled sitting answers with what it was and why it ended (`cancelled`), and nothing else.
router.get("/runs/:id/results", (req, res) => {
  const out = look(req, (db) => {
    const found = load(db, req);
    if (found.error) return found;
    if (found.run.status === "in_progress") return { status: 409, code: "IN_PROGRESS", error: "This practice test isn't finished yet." };
    return resultPayload(found.run, found.test);
  });
  send(res, out);
});

// The results page calls this once it has shown what the sitting earned.
router.post("/runs/:id/rewards/seen", (req, res) => {
  const out = updateDB((db) => {
    const found = load(db, req);
    if (found.error) return found;
    if (found.run.status !== "in_progress" && !found.run.rewardSeenAt) found.run.rewardSeenAt = new Date().toISOString();
    return { ok: true };
  });
  send(res, out);
});

export default router;
