import { Router } from "express";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../db.js";
import { requireStaff } from "../auth.js";

// The test editor's API, for the two kinds of SAT test the studio builds. Both are a title and
// modules of questions, so they share every route here and differ in where they are kept:
//   db.tests             teacher mocks: a teacher runs one as a session (mounted at /api/tests)
//   db.satPracticeTests  practice tests: a student sits one alone (routes/adminSatTestRoutes.js)
// Building mock tests is in both panels: a teacher writes a test for a class, the admin keeps the
// ones every school can use. `write` is a second guard on everything that changes a test (the
// practice tests are the admin's); `blank` gives a new test its modules and any extra fields.

const id = () => nanoid(10);
const mockModules = () => ({
  modules: [
    { id: id(), name: "Reading and Writing", order: 1, timeLimitMinutes: 32, questions: [] },
    { id: id(), name: "Math", order: 2, timeLimitMinutes: 35, questions: [] }
  ]
});

// Request bodies are untrusted: a number or object where text is expected used to be stored as is
// and then broke the exam screen, and `Object.assign(q, body)` let a request overwrite a
// question's id, order or type. Every field is checked and trimmed here instead.
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const LIMITS = { title: 200, description: 2000, moduleName: 80, prompt: 4000, passage: 20000, option: 1000, answer: 40, explanation: 4000 };
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const MIN_MINUTES = 1;
const MAX_MINUTES = 300;

// The teacher's own rating of a whole test, shown to students as a label on the test's card.
// Same words as the practice bank. Left out, null or "" means "not rated" (no label).
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
function cleanDifficulty(v) {
  if (v === undefined || v === null || v === "") return { value: null };
  if (!DIFFICULTIES.includes(v)) return { error: `Difficulty must be one of ${DIFFICULTIES.join(", ")}, or left empty` };
  return { value: v };
}

// Pictures arrive from the editor as data URLs (it reads the chosen file in the browser). Only
// raster image types are accepted, so a question can't point students' browsers at an arbitrary
// address. A 2 MB file is about 2.7 MB as base64.
const MAX_IMAGE_CHARS = 3_000_000;
const IMAGE_RE = /^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const IMAGE_ERROR = "Images must be a PNG, JPEG, GIF or WebP file under 2 MB.";

function cleanImage(v) {
  if (v === undefined || v === null || v === "") return { value: null };
  if (typeof v !== "string" || v.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(v)) return { error: IMAGE_ERROR };
  return { value: v };
}

// Checks the editable parts of a question and returns them, or an error message. `current` is the
// stored question on an update: a field the request leaves out keeps its stored value, and the
// type can't change (the options / answer key belong to it).
function checkQuestion(body, current) {
  if (current && body.type !== undefined && body.type !== current.type) {
    return { error: "A question's type can't be changed — delete it and add a new one instead." };
  }
  const type = current ? current.type : body.type;
  if (type !== "mcq" && type !== "grid_in") return { error: "type must be mcq or grid_in" };

  const has = (k) => body[k] !== undefined;
  const prompt = has("prompt") ? text(body.prompt, LIMITS.prompt) : current?.prompt || "";
  if (!prompt) return { error: "type and prompt required" };
  const passage = has("passage") ? text(body.passage, LIMITS.passage) : current?.passage || "";

  const passageImage = has("passageImage") ? cleanImage(body.passageImage) : { value: current?.passageImage || null };
  if (passageImage.error) return { error: passageImage.error };
  const promptImage = has("promptImage") ? cleanImage(body.promptImage) : { value: current?.promptImage || null };
  if (promptImage.error) return { error: promptImage.error };

  // Why the answer is the answer. A practice test shows it with the results; optional everywhere.
  const explanation = has("explanation") ? text(body.explanation, LIMITS.explanation) : current?.explanation || "";

  const out = { type, prompt, passage, explanation, passageImage: passageImage.value, promptImage: promptImage.value };

  if (type === "mcq") {
    const rawOptions = has("options") ? body.options : current?.options;
    if (!Array.isArray(rawOptions) || rawOptions.length < MIN_OPTIONS || rawOptions.length > MAX_OPTIONS) {
      return { error: `mcq requires options[] with ${MIN_OPTIONS} to ${MAX_OPTIONS} choices and correctIndex` };
    }
    const options = rawOptions.map((o) => text(o, LIMITS.option));
    if (options.some((o) => !o)) return { error: "Every answer choice needs text" };

    const rawIndex = has("correctIndex") ? body.correctIndex : current?.correctIndex;
    const correctIndex = rawIndex === null || rawIndex === undefined || rawIndex === "" ? NaN : Number(rawIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      return { error: "mcq requires options[] and a correctIndex that points at one of them" };
    }
    return { ...out, options, correctIndex };
  }

  const rawAnswer = has("correctAnswer") ? body.correctAnswer : current?.correctAnswer;
  const correctAnswer = typeof rawAnswer === "string" || typeof rawAnswer === "number" ? String(rawAnswer).trim() : "";
  if (!correctAnswer) return { error: "grid_in requires correctAnswer" };
  if (correctAnswer.length > LIMITS.answer) return { error: `The correct answer can be at most ${LIMITS.answer} characters` };
  return { ...out, correctAnswer };
}

// Stores a checked question's fields. Pictures are only kept when there is one, so a question
// without them stays as small as before.
function applyQuestion(q, fields) {
  const { passageImage, promptImage, explanation, ...rest } = fields;
  Object.assign(q, rest);
  if (explanation) q.explanation = explanation;
  else delete q.explanation;
  if (passageImage) q.passageImage = passageImage;
  else delete q.passageImage;
  if (promptImage) q.promptImage = promptImage;
  else delete q.promptImage;
  if (q.type === "mcq") delete q.correctAnswer;
  else {
    delete q.options;
    delete q.correctIndex;
  }
  return q;
}

function summarize(test) {
  const questionCount = test.modules.reduce((sum, m) => sum + m.questions.length, 0);
  return {
    id: test.id,
    title: test.title,
    description: test.description,
    difficulty: test.difficulty || null,
    createdAt: test.createdAt,
    moduleCount: test.modules.length,
    questionCount
  };
}

export function summarizeTest(test) {
  return summarize(test);
}

export function makeTestRouter({ key = "tests", write = null, blank = mockModules } = {}) {
const router = Router();
router.use(requireStaff);
const guard = write || ((req, res, next) => next());
// Every change stamps the test, so a copy worked out from it (practiceTests.js) knows it is stale.
const touch = (test) => {
  test.updatedAt = new Date().toISOString();
  return test;
};

// List tests
router.get("/", (req, res) => {
  const db = readDB();
  res.json(db[key].map(summarize));
});

// Create test (with its default modules: Reading and Writing / Math)
router.post("/", guard, (req, res) => {
  const title = text(req.body?.title, LIMITS.title);
  const description = text(req.body?.description, LIMITS.description);
  if (!title) return res.status(400).json({ error: "Title required" });
  const difficulty = cleanDifficulty(req.body?.difficulty);
  if (difficulty.error) return res.status(400).json({ error: difficulty.error });

  const test = updateDB((db) => {
    const t = {
      id: id(),
      title,
      description,
      difficulty: difficulty.value,
      createdAt: new Date().toISOString(),
      ...blank(req)
    };
    db[key].push(t);
    return t;
  });

  res.status(201).json(test);
});

// Get full test detail
router.get("/:testId", (req, res) => {
  const db = readDB();
  const test = db[key].find((t) => t.id === req.params.testId);
  if (!test) return res.status(404).json({ error: "Test not found" });
  res.json(test);
});

// Update test title/description/difficulty
router.put("/:testId", guard, (req, res) => {
  const body = req.body || {};
  if (body.title !== undefined && !text(body.title, LIMITS.title)) return res.status(400).json({ error: "Title can't be empty" });
  const difficulty = cleanDifficulty(body.difficulty);
  if (difficulty.error) return res.status(400).json({ error: difficulty.error });
  const test = updateDB((db) => {
    const t = db[key].find((t) => t.id === req.params.testId);
    if (!t) return null;
    if (body.title !== undefined) t.title = text(body.title, LIMITS.title);
    if (body.description !== undefined) t.description = text(body.description, LIMITS.description);
    if (body.difficulty !== undefined) t.difficulty = difficulty.value;
    return touch(t);
  });
  if (!test) return res.status(404).json({ error: "Test not found" });
  res.json(test);
});

// Delete test
router.delete("/:testId", guard, (req, res) => {
  const removed = updateDB((db) => {
    const before = db[key].length;
    db[key] = db[key].filter((t) => t.id !== req.params.testId);
    return db[key].length < before;
  });
  if (!removed) return res.status(404).json({ error: "Test not found" });
  res.json({ ok: true });
});

// Update a module (name / time limit / calculator)
router.put("/:testId/modules/:moduleId", guard, (req, res) => {
  const body = req.body || {};
  if (body.name !== undefined && !text(body.name, LIMITS.moduleName)) return res.status(400).json({ error: "Module name can't be empty" });
  // true / false sets it; null goes back to "Math modules only" (see moduleHasCalculator).
  if (body.calculator !== undefined && body.calculator !== null && typeof body.calculator !== "boolean") {
    return res.status(400).json({ error: "calculator must be true, false or null" });
  }
  let minutes;
  if (body.timeLimitMinutes !== undefined) {
    const raw = body.timeLimitMinutes;
    minutes = raw === null || raw === "" || typeof raw === "boolean" || typeof raw === "object" ? NaN : Number(raw);
    if (!Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
      return res.status(400).json({ error: `Time limit must be a whole number of minutes from ${MIN_MINUTES} to ${MAX_MINUTES}` });
    }
  }

  const result = updateDB((db) => {
    const test = db[key].find((t) => t.id === req.params.testId);
    if (!test) return null;
    const mod = test.modules.find((m) => m.id === req.params.moduleId);
    if (!mod) return null;
    if (body.name !== undefined) mod.name = text(body.name, LIMITS.moduleName);
    if (minutes !== undefined) mod.timeLimitMinutes = minutes;
    if (body.calculator === null) delete mod.calculator;
    else if (body.calculator !== undefined) mod.calculator = body.calculator;
    touch(test);
    return mod;
  });
  if (!result) return res.status(404).json({ error: "Module not found" });
  res.json(result);
});

// Add a question to a module
router.post("/:testId/modules/:moduleId/questions", guard, (req, res) => {
  const checked = checkQuestion(req.body || {}, null);
  if (checked.error) return res.status(400).json({ error: checked.error });

  const question = updateDB((db) => {
    const test = db[key].find((t) => t.id === req.params.testId);
    if (!test) return null;
    const mod = test.modules.find((m) => m.id === req.params.moduleId);
    if (!mod) return null;
    const q = applyQuestion({ id: id(), order: mod.questions.length + 1 }, checked);
    mod.questions.push(q);
    touch(test);
    return q;
  });

  if (!question) return res.status(404).json({ error: "Test or module not found" });
  res.status(201).json(question);
});

// Update a question
router.put("/:testId/modules/:moduleId/questions/:questionId", guard, (req, res) => {
  const body = req.body || {};
  const question = updateDB((db) => {
    const test = db[key].find((t) => t.id === req.params.testId);
    if (!test) return null;
    const mod = test.modules.find((m) => m.id === req.params.moduleId);
    if (!mod) return null;
    const q = mod.questions.find((q) => q.id === req.params.questionId);
    if (!q) return null;
    // Validated against the stored question, and written only when it passes. (updateDB saves
    // whatever the callback leaves behind, so nothing may be changed before the check.)
    const checked = checkQuestion(body, q);
    if (checked.error) return { error: checked.error };
    touch(test);
    return applyQuestion(q, checked);
  });
  if (!question) return res.status(404).json({ error: "Question not found" });
  if (question.error) return res.status(400).json({ error: question.error });
  res.json(question);
});

// Delete a question
router.delete("/:testId/modules/:moduleId/questions/:questionId", guard, (req, res) => {
  const removed = updateDB((db) => {
    const test = db[key].find((t) => t.id === req.params.testId);
    if (!test) return false;
    const mod = test.modules.find((m) => m.id === req.params.moduleId);
    if (!mod) return false;
    const before = mod.questions.length;
    mod.questions = mod.questions.filter((q) => q.id !== req.params.questionId);
    mod.questions.forEach((q, i) => (q.order = i + 1));
    touch(test);
    return mod.questions.length < before;
  });
  if (!removed) return res.status(404).json({ error: "Question not found" });
  res.json({ ok: true });
});

return router;
}

// The teacher mocks, at /api/tests.
export default makeTestRouter();
