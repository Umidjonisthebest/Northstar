// Integrity checks for the starter practice bank and the Math generators.
// Run after editing anything in content/ or practiceSkills.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { PRACTICE_QUESTIONS, DOMAINS } from "./practiceContent.js";
import { DIFFICULTIES, SKILLS } from "./practiceSkills.js";
import { LEVELS, generateMath, parseRemixId, remixId } from "./content/mathGen.js";
import { CHALLENGING_RW } from "./content/challengingRW.js";
import { CHALLENGING_MATH } from "./content/challengingMath.js";
import { gradeGrid } from "./grading.js";

// `levels` is what the question may be rated: the whole scale for the bank, and
// only the generator levels (which stop at Hard) for generated questions.
function problems(q, { passageRequired = false, levels = DIFFICULTIES } = {}) {
  const out = [];
  const text = JSON.stringify(q);
  if (!DOMAINS[q.section]?.includes(q.domain)) out.push(`domain ${q.domain}`);
  if (!SKILLS[q.section]?.[q.domain]?.includes(q.topic)) out.push(`skill ${q.topic}`);
  if (!levels.includes(q.difficulty)) out.push(`difficulty ${q.difficulty}`);
  if (!q.title || !q.prompt || !q.explanation || !q.hint) out.push("missing title/prompt/explanation/hint");
  if (/undefined|NaN|Infinity|\[object Object\]/.test(text)) out.push("bad token");
  if (/\{[A-D]\}/.test(text)) out.push("unresolved {X} option placeholder");
  if (!Array.isArray(q.steps) || q.steps.length < 2 || q.steps.some((s) => !s.title || !s.body)) out.push("steps");
  if (q.type === "grid_in") {
    if (!/^-?\d+(\.\d+)?(\/\d+)?$/.test(q.correctAnswer || "")) out.push(`grid answer ${q.correctAnswer}`);
  } else {
    if (q.options?.length !== 4 || new Set(q.options).size !== 4) out.push("options must be 4 distinct values");
    if (!(q.correctIndex >= 0 && q.correctIndex < 4)) out.push("correctIndex");
    if (q.rationales?.length !== q.options?.length) out.push("one rationale per option");
    else if (!q.rationales[q.correctIndex].startsWith("Correct") || q.rationales.some((r, i) => i !== q.correctIndex && r.startsWith("Correct"))) out.push("only the correct option's rationale starts with 'Correct'");
  }
  if (passageRequired && !q.passage) out.push("no passage");
  if (q.keyQuote && !`${q.passage} ${q.prompt}`.includes(q.keyQuote)) out.push("keyQuote isn't in the passage");
  return out;
}

test("every starter question is complete and consistent", () => {
  const bad = [];
  const keys = new Set();
  for (const q of PRACTICE_QUESTIONS) {
    if (keys.has(q.key)) bad.push(`${q.key}: duplicate key`);
    keys.add(q.key);
    for (const p of problems(q, { passageRequired: q.section === "Reading & Writing" })) bad.push(`${q.key}: ${p}`);
  }
  assert.deepEqual(bad, []);
});

test("every skill has starter questions", () => {
  for (const [section, domains] of Object.entries(SKILLS)) {
    for (const skills of Object.values(domains)) {
      for (const skill of skills) assert.ok(PRACTICE_QUESTIONS.filter((q) => q.section === section && q.topic === skill).length >= 5, skill);
    }
  }
});

test("Reading & Writing answers are spread evenly over A–D", () => {
  const counts = [0, 0, 0, 0];
  for (const q of PRACTICE_QUESTIONS.filter((x) => x.section === "Reading & Writing")) counts[q.correctIndex] += 1;
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `counts ${counts}`);
});

// The Challenging tier is the owner's pack of Northstar originals (NS-E-001…020, NS-M-001…045).
// These are the pack's own answers, so an edit to the content can't quietly change one. Reading &
// Writing is pinned by the correct option's text, because its letters are rebalanced over A–D;
// Math by the pack's letter, or by the answer for a student-produced response.
const CHALLENGING_RW_KEY = {
  "ns-e-001": "Ilse finds that the workshop meets her with indifference instead of the blame she had expected.",
  "ns-e-002": "The fish spent about as much of the day inside the coral but swam farther from it at dusk.",
  "ns-e-003": "Children correctly produced the irregular forms of verbs they heard often well before the irregular forms of verbs they heard rarely.",
  "ns-e-004": "After 8 weeks of cold storage, 58% of seeds germinated at 15°C but only 27% at 25°C, although the rates with no cold storage were nearly the same.",
  "ns-e-005": "the settlement's inhabitants began fishing from boats at some point during its occupation.",
  "ns-e-006": "many of the additional rides were trips within the outlying neighborhoods that were no longer than a typical ride.",
  "ns-e-007": "unreserved",
  "ns-e-008": "calculated",
  "ns-e-009": "To present evidence that calls for revising a long-accepted account of how the island's forests were cleared",
  "ns-e-010": "It qualifies a common emphasis by pointing to a different benefit, which the next sentence illustrates.",
  "ns-e-011": "By arguing that it gives too much credit to one technology whose effect depended on other conditions",
  "ns-e-012": "By proposing that any advantage comes from saying the steps aloud, not from the sensation of motion",
  "ns-e-013": "Built in 1874 to carry grain barges, the Tessaly Canal now serves about 40,000 pleasure boats per year as a recreational waterway.",
  "ns-e-014": "Because 17 of the 42 people analyzed had strontium ratios that did not match the local geology, the team concluded that many of those buried at the site had grown up elsewhere.",
  "ns-e-015": "In fact,",
  "ns-e-016": "however,",
  "ns-e-017": "watchmaker—",
  "ns-e-018": "1952;",
  "ns-e-019": "gives",
  "ns-e-020": "the researchers concluded that the contamination was confined to the northern field."
};
const CHALLENGING_MATH_KEY = {
  "ns-m-001": "B", "ns-m-002": "72", "ns-m-003": "D", "ns-m-004": "41.5", "ns-m-005": "A",
  "ns-m-006": "84", "ns-m-007": "B", "ns-m-008": "4.5", "ns-m-009": "C", "ns-m-010": "8",
  "ns-m-011": "C", "ns-m-012": "42", "ns-m-013": "7", "ns-m-014": "D", "ns-m-015": "7",
  "ns-m-016": "C", "ns-m-017": "12", "ns-m-018": "A", "ns-m-019": "B", "ns-m-020": "8",
  "ns-m-021": "B", "ns-m-022": "B", "ns-m-023": "19", "ns-m-024": "D", "ns-m-025": "8",
  "ns-m-026": "D", "ns-m-027": "28", "ns-m-028": "B", "ns-m-029": "B", "ns-m-030": "C",
  "ns-m-031": "22", "ns-m-032": "B", "ns-m-033": "5/8", "ns-m-034": "C", "ns-m-035": "D",
  "ns-m-036": "D", "ns-m-037": "A", "ns-m-038": "200", "ns-m-039": "B", "ns-m-040": "135",
  "ns-m-041": "C", "ns-m-042": "12", "ns-m-043": "B", "ns-m-044": "C", "ns-m-045": "360"
};

test("the Challenging tier is the owner's 65 originals, with the pack's answers", () => {
  const tier = PRACTICE_QUESTIONS.filter((q) => q.difficulty === "Challenging");
  assert.deepEqual(tier.map((q) => q.key).sort(), [...Object.keys(CHALLENGING_RW_KEY), ...Object.keys(CHALLENGING_MATH_KEY)].sort());
  assert.equal(CHALLENGING_RW.length, 20);
  assert.equal(CHALLENGING_MATH.length, 45);
  const bad = [];
  for (const q of CHALLENGING_RW) {
    if (q.options[q.correctIndex] !== CHALLENGING_RW_KEY[q.key]) bad.push(`${q.key}: answer is "${q.options[q.correctIndex]}"`);
    // Step quotes are highlighted in the passage, so they have to be in it word for word.
    for (const s of q.steps) if (s.quote && !q.passage.includes(s.quote)) bad.push(`${q.key}: step quote isn't in the passage`);
    if (!q.keyQuote) bad.push(`${q.key}: no keyQuote`);
  }
  for (const q of CHALLENGING_MATH) {
    const key = CHALLENGING_MATH_KEY[q.key];
    if (q.type === "grid_in" ? !gradeGrid(key, q.correctAnswer) : "ABCD"[q.correctIndex] !== key) bad.push(`${q.key}: answer doesn't match the pack's ${key}`);
  }
  assert.deepEqual(bad, []);
});

test("every skill has Challenging questions, and the tier sits above Hard", () => {
  assert.deepEqual(DIFFICULTIES, ["Easy", "Medium", "Hard", "Challenging"]);
  for (const [section, domains] of Object.entries(SKILLS)) {
    for (const skill of Object.values(domains).flat()) {
      assert.ok(PRACTICE_QUESTIONS.filter((q) => q.section === section && q.topic === skill && q.difficulty === "Challenging").length >= 2, skill);
    }
  }
  // The pack's equivalent forms of a student-produced response are all accepted.
  const byKey = new Map(CHALLENGING_MATH.map((q) => [q.key, q]));
  for (const [key, forms] of [["ns-m-004", ["41.5", "83/2"]], ["ns-m-008", ["4.5", "9/2"]], ["ns-m-033", ["5/8", ".625", "0.625"]]]) {
    for (const form of forms) assert.ok(gradeGrid(form, byKey.get(key).correctAnswer), `${key} accepts ${form}`);
  }
});

test("Math generators are valid, deterministic, and remixable", () => {
  const bad = [];
  for (const skill of Object.values(SKILLS.Math).flat()) {
    for (const level of LEVELS) {
      for (let s = 1; s <= 60; s++) {
        const seed = s * 7919 + level.length;
        const q = generateMath(skill, level, seed);
        for (const p of problems(q, { levels: LEVELS })) bad.push(`${skill}/${level}/${seed}: ${p}`);
        if (JSON.stringify(generateMath(skill, level, seed)) !== JSON.stringify(q)) bad.push(`${skill}/${level}/${seed}: not deterministic`);
        const back = parseRemixId(remixId(skill, level, seed));
        if (back?.skill !== skill || back.level !== level || back.seed !== seed) bad.push(`${skill}: remix id round trip`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
});
