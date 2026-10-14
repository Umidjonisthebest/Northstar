// The owner's own question bank: content/originals/*.json, exactly as they supplied it (500
// questions in two files on 2026-10-08: M-001…M-300 and RW-001…RW-200). All of it is original to
// Northstar; nothing official is reproduced (see each file's `meta`).
//
// The files are kept as they came, with math in LaTeX, and are turned into the bank's shape here
// when the server starts. To add a batch, drop the file into content/originals/ and add its name
// to FILES. A question that can't be converted is left out and reported, never half shown.
//
// What a question becomes (see also CLAUDE.md, "Practice question shape"):
//   key            "nb-" + its id in lower case (nb-m-001, nb-rw-101)
//   stem           -> prompt (a $$…$$ equation goes on its own line)
//   choices A–D    -> options, in the file's order, so the letters in `explanation` stay right
//   choice_rationales -> rationales          accepted_answers -> acceptedAnswers
//   passage2       -> "Text 1" / "Text 2"    notes -> "• " lines under the lead-in
//   <u>…</u>       -> underline: [start, end) in the passage
// They have no hints or steps, so they are synced beside PRACTICE_QUESTIONS, not as part of it.
//
// batch3.json (2026-10-12: MATH-001…100 and EBRW-001…100, also original) is written another way:
// no LaTeX (the math is already in the player's plain notation), the two lists are `math` and
// `ebrw`, and each choice carries its own explanation. convertChoiceList() below reads that form:
//   key            nb-math-001, nb-ebrw-001
//   question       -> prompt                options[].text -> options, in the file's order
//   options[].explanation -> rationales (the right choice's also becomes `explanation`)
//   "Text 1: …"    -> "Text 1" / "Text 2"   a table written out as lines of text stays as it is
//
// batch4.json and batch5.json (2026-10-13) are the two "Digital SAT 100-Question Practice
// Workbook" PDFs, also original, turned into batch3's form by tools/workbook (its README says what
// that changes). Keys nb-wbm-101 … nb-wbrw-250: workbook 1 or 2, then the question's number.
// Their `skill` is already the bank's name (the workbook's own is kept as `subskill`), and a
// table printed with its headings comes as `table`, the bank's own shape.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SKILLS } from "../practiceSkills.js";
import { latexToPlain } from "./latexPlain.js";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "originals");
const FILES = ["batch1.json", "batch2.json", "batch3.json", "batch4.json", "batch5.json"];
export const ORIGINALS_SOURCE = "northstar-bank";

const SECTION = { Math: "Math", "Reading and Writing": "Reading & Writing" };
const LEVEL = { medium: "Medium", hard: "Hard", challenging: "Challenging", easy: "Easy" };
// The files use College Board's full skill names; the bank's taxonomy shortens some.
const SKILL = {
  "Systems of two linear equations in two variables": "Systems of linear equations",
  "Linear inequalities in one or two variables": "Linear inequalities",
  "Nonlinear equations in one variable and systems of equations in two variables": "Nonlinear equations and systems",
  "Ratios, rates, proportional relationships, and units": "Ratios, rates, and units",
  "One-variable data: Distributions and measures of center and spread": "One-variable data",
  "Two-variable data: Models and scatterplots": "Two-variable data",
  "Probability and conditional probability": "Probability",
  "Inference from sample statistics and margin of error": "Sample statistics and margin of error",
  "Evaluating statistical claims: Observational studies and experiments": "Studies and experiments"
};
// batch3 splits some of those names and writes others in lower case, so its skills are looked up
// without regard to case, with these on top.
const SKILL_ANY_CASE = new Map(
  Object.entries({
    ...SKILL,
    "Systems of two linear equations": "Systems of linear equations",
    "Nonlinear equations in one variable": "Nonlinear equations and systems",
    "Systems of equations in two variables": "Nonlinear equations and systems",
    "Command of Evidence (Textual)": "Command of Evidence",
    "Command of Evidence (Quantitative)": "Command of Evidence"
  }).map(([from, to]) => [from.toLowerCase(), to])
);
const LETTERS = "ABCD";
const U_OPEN = "";
const U_CLOSE = "";
const NUMBER = /^-?\d*\.?\d+(\/\d+)?$/;

// For list rows and reports: the first words of the question, with exponent mark-up flattened.
function shortTitle(text) {
  const flat = text
    .replace(/^Text 1\n/, "")
    .replace(/^While researching a topic, a student has taken the following notes:\n• /, "")
    .replace(/\^\{([^}]*)\}/g, "^$1")
    .replace(/\s+/g, " ")
    .replace(/_{3,}/g, "…")
    .trim();
  if (flat.length <= 58) return flat;
  const cut = flat.slice(0, 58);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:—(-]+$/, "")}…`;
}

// A question written with its choices as a list (batch3.json) -> the bank's record.
function convertChoiceList(q) {
  const section = SECTION[q.section];
  const topic = SKILL_ANY_CASE.get(String(q.skill || "").toLowerCase()) || q.skill;
  if (!section || !SKILLS[section]?.[q.domain]?.includes(topic)) throw new Error(`no place in the taxonomy for ${q.section} / ${q.domain} / ${q.skill}`);
  const difficulty = LEVEL[String(q.difficulty || "").toLowerCase()];
  if (!difficulty) throw new Error(`difficulty "${q.difficulty}"`);
  if (!/^[A-Z]+-\d+$/.test(q.id || "")) throw new Error(`id "${q.id}"`);
  const rec = { key: `nb-${q.id.toLowerCase()}`, source: ORIGINALS_SOURCE, section, domain: q.domain, topic, difficulty };

  const plain = (v, what) => {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) throw new Error(`${what} is empty`);
    if (/<\/?[a-z][^>]*>|\$\$|\\[a-zA-Z]/.test(s)) throw new Error(`mark-up in ${what}`);
    return s;
  };
  if (q.passage !== undefined) {
    // Two texts come as "Text 1: … (blank line) Text 2: …"; the player reads the labels on their own lines.
    const two = /^Text 1: ([\s\S]+?)\n\nText 2: ([\s\S]+)$/.exec(plain(q.passage, "the passage"));
    rec.passage = two ? `Text 1\n${two[1].trim()}\n\nText 2\n${two[2].trim()}` : plain(q.passage, "the passage");
  }
  if (section === "Reading & Writing" && !rec.passage) throw new Error("no passage");
  rec.prompt = plain(q.question, "the question text");
  if (/underlined/.test(rec.prompt)) throw new Error("asks about an underlined part that isn't marked");
  if (q.table !== undefined) {
    const columns = (q.table?.columns || []).map((c) => plain(c, "a table heading"));
    const rows = (q.table?.rows || []).map((r) => (Array.isArray(r) ? r.map((c) => plain(c, "a table cell")) : []));
    if (!columns.length || !rows.length || rows.some((r) => r.length !== columns.length)) throw new Error("table rows and columns don't line up");
    rec.table = { columns, rows };
  }
  rec.title = shortTitle(rec.passage || rec.prompt);

  const options = Array.isArray(q.options) ? q.options : [];
  if (options.map((o) => o?.label).join("") !== LETTERS) throw new Error("choices aren't A to D");
  rec.type = "mcq";
  rec.options = options.map((o) => plain(o.text, `choice ${o.label}`));
  if (new Set(rec.options).size !== 4) throw new Error("two choices read the same, or one is empty");
  const right = options.filter((o) => o.is_correct === true);
  rec.correctIndex = LETTERS.indexOf(q.correct_answer);
  if (rec.correctIndex < 0 || right.length !== 1 || right[0].label !== q.correct_answer) throw new Error(`answer "${q.correct_answer}" doesn't match the one choice marked correct`);
  // The player tells the right choice's reason from the others by its first word.
  const reasons = options.map((o) => plain(o.explanation, `the explanation of choice ${o.label}`));
  if (reasons.some((r) => /^Correct\b/.test(r))) throw new Error("an explanation already starts with \"Correct\"");
  rec.rationales = reasons.map((r, i) => (i === rec.correctIndex ? `Correct. ${r}` : r));
  rec.explanation = reasons[rec.correctIndex];
  return rec;
}

// One question from a file -> the bank's record. Throws with the reason when it can't be done.
export function convertOriginal(q) {
  if (Array.isArray(q?.options)) return convertChoiceList(q);
  const section = SECTION[q.section];
  const topic = SKILL[q.skill] || q.skill;
  if (!section || !SKILLS[section]?.[q.domain]?.includes(topic)) throw new Error(`no place in the taxonomy for ${q.section} / ${q.domain} / ${q.skill}`);
  const difficulty = LEVEL[q.difficulty];
  if (!difficulty) throw new Error(`difficulty "${q.difficulty}"`);
  if (!/^[A-Z]+-\d+$/.test(q.id || "")) throw new Error(`id "${q.id}"`);
  const rec = { key: `nb-${q.id.toLowerCase()}`, source: ORIGINALS_SOURCE, section, domain: q.domain, topic, difficulty };

  // Passage: two texts, a list of notes, and the underlined part, in the conventions the player reads.
  let passage = "";
  if (q.passage2) passage = `Text 1\n${q.passage}\n\nText 2\n${q.passage2}`;
  else if (q.notes?.length) passage = [q.passage, ...q.notes.map((n) => `• ${n}`)].filter(Boolean).join("\n");
  else if (q.passage) passage = q.passage;
  if (passage) {
    const marked = latexToPlain(passage.replace(/<u>/g, U_OPEN).replace(/<\/u>/g, U_CLOSE).replace(/\n\n/g, "\n\n"))
      .replace(/\n?\n?/g, "\n\n");
    if (/<\/?[a-z][^>]*>/i.test(marked)) throw new Error("mark-up other than <u> in the passage");
    const start = marked.indexOf(U_OPEN);
    const end = marked.indexOf(U_CLOSE);
    rec.passage = marked.replace(/[]/g, "");
    if (start >= 0 || end >= 0) {
      if (start < 0 || end < start || marked.indexOf(U_OPEN, start + 1) >= 0) throw new Error("underline mark-up isn't one <u>…</u> pair");
      rec.underline = [start, end - 1];
    }
  }
  if (section === "Reading & Writing" && !rec.passage) throw new Error("no passage");

  rec.prompt = latexToPlain(q.stem, { display: "line" });
  if (!rec.prompt || /<\/?[a-z][^>]*>/i.test(rec.prompt)) throw new Error("the question text is empty or has mark-up in it");
  if (/underlined/.test(rec.prompt) && !rec.underline) throw new Error("asks about an underlined part that isn't marked");
  if (q.table) {
    const columns = (q.table.columns || []).map((c) => latexToPlain(c));
    const rows = (q.table.rows || []).map((r) => r.map((c) => latexToPlain(c)));
    if (!columns.length || !rows.length || rows.some((r) => r.length !== columns.length)) throw new Error("table rows and columns don't line up");
    rec.table = { ...(q.table.title ? { title: latexToPlain(q.table.title) } : {}), columns, rows };
  }
  // The passage's first words; for Math, the sentence of the question (not an equation above it).
  rec.title = shortTitle(rec.passage || rec.prompt.split("\n").at(-1));
  rec.explanation = latexToPlain(q.explanation);
  if (!rec.explanation) throw new Error("no explanation");

  if (q.type === "mcq") {
    if (Object.keys(q.choices || {}).join("") !== LETTERS) throw new Error("choices aren't A to D");
    rec.type = "mcq";
    rec.options = [...LETTERS].map((l) => latexToPlain(q.choices[l]));
    if (rec.options.some((o) => !o) || new Set(rec.options).size !== 4) throw new Error("two choices read the same, or one is empty");
    rec.correctIndex = LETTERS.indexOf(q.answer);
    if (rec.correctIndex < 0) throw new Error(`answer "${q.answer}"`);
    if (q.choice_rationales) {
      if (Object.keys(q.choice_rationales).join("") !== LETTERS) throw new Error("choice_rationales aren't A to D");
      rec.rationales = [...LETTERS].map((l) => latexToPlain(q.choice_rationales[l]));
    }
  } else if (q.type === "spr") {
    rec.type = "grid_in";
    const accepted = (q.accepted_answers || []).map(String);
    if (!NUMBER.test(q.answer) || accepted.some((a) => !NUMBER.test(a))) throw new Error(`answer "${q.answer}" / ${accepted} isn't a number`);
    rec.correctAnswer = String(q.answer);
    const forms = [...new Set([rec.correctAnswer, ...accepted])];
    if (forms.length > 1) rec.acceptedAnswers = forms;
  } else {
    throw new Error(`type "${q.type}"`);
  }
  return rec;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

// Every question from every file, plus what was left out and why.
export function loadOriginals(dir = DIR, files = FILES) {
  const questions = [];
  const problems = [];
  const seen = new Set();
  for (const file of files) {
    let list;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8").replace(/^﻿/, ""));
      // One list (`questions`), or one per section (`math` and `ebrw`).
      list = Array.isArray(data) ? data : data.questions || (Array.isArray(data.math) || Array.isArray(data.ebrw) ? [...(data.math || []), ...(data.ebrw || [])] : null);
      if (!Array.isArray(list)) throw new Error("no list of questions in it");
    } catch (e) {
      // A checkout without the files simply has a smaller bank.
      if (e.code !== "ENOENT") problems.push(`${file}: ${e.message}`);
      continue;
    }
    for (const q of list) {
      try {
        const rec = convertOriginal(q);
        if (seen.has(rec.key)) throw new Error("the same id twice");
        seen.add(rec.key);
        questions.push(rec);
      } catch (e) {
        problems.push(`${file} ${q?.id ?? "?"}: ${e.message}`);
      }
    }
  }
  return { questions, problems };
}

const loaded = loadOriginals();
for (const p of loaded.problems) console.error(`[content] originals: ${p}`);
// Handed out by the database on every read (stored slim, like the question pack), so frozen.
export const BANK_ORIGINALS = deepFreeze(loaded.questions);
export const BANK_ORIGINALS_PROBLEMS = loaded.problems;
