// SAT practice tests made in the studio (db.satPracticeTests). They are built in the same editor
// as the teacher mocks, so they are stored the same way: a title and modules of questions, typed
// as plain text (routes/testRoutes.js). A student sits one through the practice-test engine
// (practiceTests.js), which was written for the tests that come as files (content/practiceTests):
// this file turns a studio test into that engine's shape.
//
//   { id, title, description, difficulty, published, createdAt, updatedAt,
//     modules: [{ id, name, section: "rw" | "math", order, timeLimitMinutes, calculator?, questions }] }
//
// A test is a draft until it is published: students only ever see published tests, and only the
// modules that have questions.

import { nanoid } from "nanoid";
import { SECTION_NAME } from "./content/practiceTests.js";
import { gradeGrid } from "./grading.js";

// A studio test's key among the practice tests: "s-<id>" (the file tests are "a" … "j").
const PREFIX = "s-";
export const studioKey = (id) => `${PREFIX}${id}`;
export const isStudioKey = (key) => typeof key === "string" && key.startsWith(PREFIX);

// Raw share right -> scaled section score: the table the ten file tests share. A studio test can
// be any length, so its score is this estimate from the share of questions right.
export const DEFAULT_CURVE = [[0, 200], [0.1, 250], [0.2, 310], [0.3, 370], [0.4, 430], [0.5, 490], [0.6, 540], [0.7, 590], [0.8, 650], [0.9, 710], [0.95, 750], [1, 800]];

// The digital SAT's shape: two Reading and Writing modules of 32 minutes, two Math of 35.
const SHAPE = [
  ["rw", "Reading and Writing, Module 1", 32],
  ["rw", "Reading and Writing, Module 2", 32],
  ["math", "Math, Module 1", 35],
  ["math", "Math, Module 2", 35]
];
export const blankPracticeTest = () => ({
  published: false,
  modules: SHAPE.map(([section, name, timeLimitMinutes], i) => ({ id: nanoid(10), name, section, order: i + 1, timeLimitMinutes, questions: [] }))
});

export const sectionOf = (mod) => (SECTION_NAME[mod?.section] ? mod.section : /math/i.test(mod?.name || "") ? "math" : "rw");
const SECTION_TITLE = { rw: "Reading and Writing", math: "Math" };
const SECTION_ORDER = ["rw", "math"];

// A copy of a teacher mock (db.tests) as a practice-test draft: new ids throughout, so the two
// are separate from then on.
export function copyOfMock(mock) {
  return {
    title: mock.title,
    description: mock.description || "",
    difficulty: mock.difficulty || null,
    published: false,
    copiedFrom: mock.id,
    modules: (mock.modules || []).map((m, i) => ({
      id: nanoid(10),
      name: m.name,
      section: sectionOf(m),
      order: i + 1,
      timeLimitMinutes: m.timeLimitMinutes,
      ...(typeof m.calculator === "boolean" ? { calculator: m.calculator } : {}),
      questions: (m.questions || []).map((q, j) => ({ ...structuredClone(q), id: nanoid(10), order: j + 1 }))
    }))
  };
}

// ---------- Studio text -> the engine's trees ----------
// The editor's text is plain, with math in the player's notation ("(x − 2)/3", "x^2", "√(x + 4)").
// It goes to the page as { t: "mx", c: text }, which the page draws with MathText like the rest of
// the app's plain-text questions. A picture (a data URL the editor read from a file, checked when
// it was saved) is an "img" block.
const mx = (text) => [{ t: "mx", c: text }];
function blocksOf(text, image) {
  const out = [];
  if (image) out.push({ t: "img", src: image });
  for (const line of String(text || "").split(/\n+/).map((s) => s.trim()).filter(Boolean)) out.push({ t: "p", c: mx(line) });
  return out;
}

function question(q, n) {
  const passage = blocksOf(q.passage, q.passageImage);
  const rec = {
    id: q.id,
    n,
    domain: null,
    skill: null,
    passage: passage.length ? passage : null,
    prompt: blocksOf(q.prompt, q.promptImage),
    explanation: q.explanation ? mx(q.explanation) : []
  };
  if (q.type === "grid_in") return { ...rec, type: "grid_in", answer: String(q.correctAnswer), shown: String(q.correctAnswer) };
  return { ...rec, type: "mcq", options: q.options.map((o) => mx(o)), correctIndex: q.correctIndex };
}

// A typed answer to a studio question is marked the way a teacher mock marks it (grading.js).
export const studioAnswerRight = (q, given) => String(given).trim() !== "" && gradeGrid(given, q.answer);

function convert(test) {
  const live = (test.modules || []).filter((m) => m.questions?.length);
  const modules = [];
  for (const section of SECTION_ORDER) {
    const mods = live.filter((m) => sectionOf(m) === section).sort((a, b) => a.order - b.order);
    mods.forEach((m, i) => {
      modules.push({
        key: m.id,
        section,
        label: `Section ${SECTION_ORDER.indexOf(section) + 1}, Module ${i + 1}`,
        title: SECTION_TITLE[section],
        minutes: m.timeLimitMinutes,
        questions: m.questions
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((q, j) => question(q, j + 1))
      });
    });
  }
  return { key: studioKey(test.id), studio: true, title: test.title, description: test.description || "", difficulty: test.difficulty || null, source: null, curve: DEFAULT_CURVE, modules };
}

// The database is read afresh for every request, so the conversion is kept by the test's id and
// the stamp of its last change.
const cache = new Map();
export function studioTest(test) {
  const stamp = `${test.updatedAt || test.createdAt || ""}|${test.title}`;
  const hit = cache.get(test.id);
  if (hit && hit.stamp === stamp) return hit.test;
  const made = convert(test);
  cache.set(test.id, { stamp, test: made });
  return made;
}

export const studioRecord = (db, key) => (isStudioKey(key) ? (db.satPracticeTests || []).find((t) => studioKey(t.id) === key) || null : null);
// Ready for students: published, with at least one module that has questions.
export const isLiveStudioTest = (t) => Boolean(t.published) && (t.modules || []).some((m) => m.questions?.length);
