// The practice question bank and the vocabulary deck: the admin's. They are what every student
// gets, in a class or not, so a teacher doesn't edit them. Only the list of skills is shared: the
// teacher's homework screen draws questions by skill.
import { Router } from "express";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../db.js";
import { requireAdmin, requireStaff } from "../auth.js";
import { DOMAINS } from "../practiceContent.js";
import { DIFFICULTIES as LEVELS, SKILLS } from "../practiceSkills.js";
import { isDemoUser } from "../users.js";

const router = Router();
router.get("/domains", requireStaff, (req, res) => res.json({ domains: DOMAINS, skills: SKILLS }));
router.use(requireAdmin);

const SECTIONS = ["Reading & Writing", "Math"];
const TYPES = ["mcq", "grid_in"];

// Only real strings/numbers count as text. `String({})` used to save the literal "[object Object]".
const text = (v, max) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "");

// Optional explanation fields. Only fields present in the body are returned,
// so an edit from a client that doesn't know about them never wipes them.
function cleanExtras(body, q) {
  const out = {};
  if (body.passage !== undefined) out.passage = text(body.passage, 6000);
  if (body.hint !== undefined) out.hint = text(body.hint, 500);
  if (body.keyQuote !== undefined) out.keyQuote = text(body.keyQuote, 400);
  if (body.rationales !== undefined) {
    const list = (Array.isArray(body.rationales) ? body.rationales : []).map((r) => text(r, 800));
    out.rationales = q.type === "mcq" && list.some(Boolean) ? q.options.map((_, i) => list[i] || "") : [];
  }
  if (body.steps !== undefined) {
    out.steps = (Array.isArray(body.steps) ? body.steps : [])
      .map((s) => ({ title: text(s?.title, 120), body: text(s?.body, 1500) }))
      .filter((s) => s.title || s.body)
      .slice(0, 8);
  }
  return out;
}

function cleanQuestion(body) {
  const type = TYPES.includes(body.type) ? body.type : "mcq";
  const section = SECTIONS.includes(body.section) ? body.section : "Reading & Writing";
  const domains = DOMAINS[section];
  const domain = domains.includes(body.domain) ? body.domain : domains[0];
  const q = {
    type,
    section,
    domain,
    topic: text(body.topic, 120) || SKILLS[section][domain][0],
    difficulty: LEVELS.includes(body.difficulty) ? body.difficulty : "Medium",
    title: text(body.title, 200),
    prompt: text(body.prompt, 6000),
    explanation: text(body.explanation, 6000)
  };
  if (!q.prompt) return { error: "Question text is required" };

  let extrasBody = body;
  if (type === "mcq") {
    // `options` must be a list. Blank entries are dropped, and `correctIndex` / `rationales`
    // (which refer to the list as sent) are re-pointed so the answer key can't shift onto a
    // different option when a blank one sits before the correct answer.
    const raw = Array.isArray(body.options) ? body.options.map((o) => text(o, 1000)) : [];
    const keep = raw.map((o, i) => (o ? i : -1)).filter((i) => i >= 0);
    const options = keep.map((i) => raw[i]);
    // (`Number(null)` is 0, so a missing/null index must not quietly mean "option A".)
    const ci = body.correctIndex;
    let correctIndex = typeof ci === "number" || (typeof ci === "string" && ci.trim() !== "") ? Number(ci) : NaN;
    if (Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < raw.length) {
      if (!raw[correctIndex]) return { error: "The option marked correct is empty" };
      correctIndex = keep.indexOf(correctIndex);
    }
    if (options.length < 2 || options.length > 6) return { error: "Provide 2–6 answer options" };
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length)
      return { error: "Pick which option is correct" };
    q.options = options;
    q.correctIndex = correctIndex;
    if (Array.isArray(body.rationales) && body.rationales.length === raw.length && raw.length !== options.length) {
      extrasBody = { ...body, rationales: keep.map((i) => body.rationales[i]) };
    }
  } else {
    const correctAnswer = text(body.correctAnswer, 60);
    if (!correctAnswer) return { error: "Provide the correct numeric answer" };
    q.correctAnswer = correctAnswer;
  }

  if (!q.title) q.title = (text(body.passage, 6000) || q.prompt).slice(0, 60);
  Object.assign(q, cleanExtras(extrasBody, q));
  if (q.keyQuote && q.passage !== undefined && !q.passage.includes(q.keyQuote)) return { error: "The key evidence must be copied exactly from the passage" };
  return { q };
}

// ---- Reports sent from the student practice player ----
router.get("/reports", (req, res) => {
  const db = readDB();
  const reports = db.questionReports
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => {
      const q = db.practiceQuestions.find((x) => x.id === r.questionId);
      const u = db.users.find((x) => x.id === r.userId);
      return { ...r, questionTitle: q?.title || "(deleted question)", section: q?.section || null, student: u ? `${u.firstName} ${u.lastName || ""}`.trim() : "Unknown student" };
    });
  res.json({ reports });
});

router.delete("/reports/:id", (req, res) => {
  updateDB((db) => {
    db.questionReports = db.questionReports.filter((r) => r.id !== req.params.id);
  });
  res.json({ ok: true });
});

router.get("/stats", (req, res) => {
  const db = readDB();
  const students = db.users.filter((u) => u.role === "student" && !isDemoUser(u));
  // The all-time XP leaderboard that used to be here was replaced by weekly leagues (GET /api/admin/leagues).
  res.json({ questions: db.practiceQuestions.length, vocab: db.vocab.length, students: students.length });
});

// ---- Questions ----
router.get("/questions", (req, res) => res.json({ questions: readDB().practiceQuestions }));

router.post("/questions", (req, res) => {
  const { q, error } = cleanQuestion(req.body || {});
  if (error) return res.status(400).json({ error });
  const created = updateDB((db) => {
    const item = { id: nanoid(10), ...q, createdAt: new Date().toISOString() };
    db.practiceQuestions.push(item);
    return item;
  });
  res.status(201).json(created);
});

router.put("/questions/:id", (req, res) => {
  const { q, error } = cleanQuestion(req.body || {});
  if (error) return res.status(400).json({ error });
  const updated = updateDB((db) => {
    const item = db.practiceQuestions.find((x) => x.id === req.params.id);
    if (!item) return null;
    // A list of accepted answer forms belongs to the old answer: a teacher who changes the answer
    // must not be left with the old forms still being marked right.
    if (item.acceptedAnswers && q.correctAnswer !== item.correctAnswer) delete item.acceptedAnswers;
    // An underlined part is a character range in the passage. When the passage is edited, follow
    // the underlined words to where they are now, or drop the underline if they are gone.
    if (Array.isArray(item.underline) && q.passage !== undefined && q.passage !== item.passage) {
      const words = String(item.passage || "").slice(item.underline[0], item.underline[1]);
      const at = words ? q.passage.indexOf(words) : -1;
      if (at >= 0) item.underline = [at, at + words.length];
      else delete item.underline;
    }
    Object.assign(item, q, { updatedAt: new Date().toISOString() });
    // The answer key of the other question type must not linger (a grid-in that kept its choices).
    if (item.type === "grid_in") {
      delete item.options;
      delete item.correctIndex;
    } else {
      delete item.correctAnswer;
    }
    return item;
  });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.delete("/questions/:id", (req, res) => {
  updateDB((db) => {
    // A starter question carries a `key`; remember that it was deleted so the startup sync
    // (app.js) doesn't add it back.
    const gone = db.practiceQuestions.find((x) => x.id === req.params.id);
    if (gone?.key && !db.removedStarters.some((r) => r.kind === "question" && r.key === gone.key)) {
      db.removedStarters.push({ kind: "question", key: gone.key });
    }
    db.practiceQuestions = db.practiceQuestions.filter((x) => x.id !== req.params.id);
    db.questionReports = db.questionReports.filter((r) => r.questionId !== req.params.id);
    for (const p of db.progress) {
      p.saved = (p.saved || []).filter((id) => id !== req.params.id);
      p.flagged = (p.flagged || []).filter((id) => id !== req.params.id);
      if (p.notes) delete p.notes[req.params.id];
    }
  });
  res.json({ ok: true });
});

// Bulk import: POST an array of questions (same shape as the form).
router.post("/questions/import", (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.questions;
  if (!Array.isArray(items)) return res.status(400).json({ error: "Send a JSON array of questions" });
  const good = [];
  const errors = [];
  items.forEach((raw, i) => {
    // A null, number or nested array in the list is one bad entry, not a crash for the whole import.
    const { q, error } = cleanQuestion(raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {});
    if (error) errors.push(`#${i + 1}: ${error}`);
    else good.push({ id: nanoid(10), ...q, createdAt: new Date().toISOString() });
  });
  updateDB((db) => db.practiceQuestions.push(...good));
  res.json({ imported: good.length, errors });
});

// ---- Vocabulary ----
router.get("/vocab", (req, res) => res.json({ words: readDB().vocab }));

// Field name -> longest value kept. Only strings and numbers count as text (a number or object
// in `word` used to throw on `.trim()`, and `String({})` saved "[object Object]").
const VOCAB_FIELDS = { word: 80, definition: 600, example: 600, pronunciation: 80, partOfSpeech: 30 };

router.post("/vocab", (req, res) => {
  const body = req.body || {};
  const w = {};
  for (const [k, max] of Object.entries(VOCAB_FIELDS)) w[k] = text(body[k], max);
  if (!w.word || !w.definition) return res.status(400).json({ error: "Word and definition are required" });
  const item = updateDB((db) => {
    const added = { id: nanoid(10), ...w };
    db.vocab.push(added);
    return added;
  });
  res.status(201).json(item);
});

router.put("/vocab/:id", (req, res) => {
  const body = req.body || {};
  // The spelling and the definition can be changed but never emptied.
  for (const k of ["word", "definition"]) {
    if (body[k] !== undefined && !text(body[k], VOCAB_FIELDS[k])) return res.status(400).json({ error: "Word and definition are required" });
  }
  const item = updateDB((db) => {
    const w = db.vocab.find((x) => x.id === req.params.id);
    if (!w) return null;
    for (const [k, max] of Object.entries(VOCAB_FIELDS)) {
      // A value that isn't text (an object, a list) leaves the field as it was.
      if (typeof body[k] === "string" || typeof body[k] === "number") w[k] = text(body[k], max);
    }
    return w;
  });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

router.delete("/vocab/:id", (req, res) => {
  updateDB((db) => {
    // Remember the word so the startup sync (app.js) doesn't add a starter word back.
    const gone = db.vocab.find((x) => x.id === req.params.id);
    const key = String(gone?.word || "").toLowerCase();
    if (key && !db.removedStarters.some((r) => r.kind === "vocab" && r.key === key)) db.removedStarters.push({ kind: "vocab", key });
    db.vocab = db.vocab.filter((x) => x.id !== req.params.id);
  });
  res.json({ ok: true });
});

export default router;
