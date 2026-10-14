// The owner's own question bank (content/originals/*.json): the LaTeX-to-plain converter, the
// conversion of every question checked against its source file, and what reaches a student.

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { latexToPlain, mathToPlain } from "./content/latexPlain.js";
import { BANK_ORIGINALS, BANK_ORIGINALS_PROBLEMS, convertOriginal, loadOriginals } from "./content/originals.js";
import { DIFFICULTIES, SKILLS } from "./practiceSkills.js";
import { isCorrectAnswer } from "./grading.js";

const SOURCE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "content", "originals");
const source = ["batch1.json", "batch2.json"].flatMap((f) => JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, f), "utf-8")).questions);
// The third file is written another way (see content/originals.js): two lists, plain text, each
// choice with its own explanation.
const file3 = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, "batch3.json"), "utf-8"));
const source3 = [...file3.math, ...file3.ebrw];
const byKey = new Map(BANK_ORIGINALS.map((q) => [q.key, q]));
const made = (id) => byKey.get(`nb-${id.toLowerCase()}`);
// The first two files' questions (M-001…, RW-001…), and the third's (MATH-001…, EBRW-001…).
const FIRST = BANK_ORIGINALS.filter((q) => /^nb-(m|rw)-\d{3}$/.test(q.key));
const THIRD = BANK_ORIGINALS.filter((q) => /^nb-(math|ebrw)-\d{3}$/.test(q.key));
// The two practice workbooks (batch4 and batch5, made from their PDFs by tools/workbook), in the
// third file's form: WBM-101…150 and WBRW-101…150 from the first, …-201…250 from the second.
const books = ["batch4.json", "batch5.json"].map((f) => JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, f), "utf-8")));
const sourceBooks = books.flatMap((b) => [...b.math, ...b.ebrw]);
const WORKBOOKS = BANK_ORIGINALS.filter((q) => /^nb-wb(m|rw)-\d{3}$/.test(q.key));

describe("LaTeX to the player's plain notation", () => {
  const cases = [
    ["2(kx-5)=6x+c", "2(kx − 5) = 6x + c"],
    ["\\frac{ax+12}{x-3}=5", "(ax + 12)/(x − 3) = 5"],
    ["\\frac{5(x-2)}{3}-\\frac{x-2}{2}=14", "(5(x − 2))/3 − (x − 2)/2 = 14"],
    // A fraction that multiplies what follows it, or follows × ÷ ·, gets its own brackets.
    ["\\tfrac{2}{3}(9x-6)-\\frac{1}{2}(4x+10)=3x-2", "(2/3)(9x − 6) − (1/2)(4x + 10) = 3x − 2"],
    ["y=-\\tfrac{1}{3}x+5", "y = −(1/3)x + 5"],
    ["15\\div\\tfrac{9}{5}=\\tfrac{25}{3}", "15 ÷ (9/5) = 25/3"],
    ["x\\cdot\\frac{a+b}{ab}=1", "x · ((a + b)/(ab)) = 1"],
    ["\\dfrac{x}{x-3}+\\dfrac{2}{x+1}=\\dfrac{12}{(x-3)(x+1)}", "x/(x − 3) + 2/(x + 1) = 12/((x − 3)(x + 1))"],
    ["66\\frac{2}{3}", "66 2/3"],
    ["\\left(\\tfrac{13}{3},3\\right)", "(13/3, 3)"],
    // Signs and operators.
    ["c\\neq -10", "c ≠ −10"],
    ["-3<\\frac{k-2x}{4}\\le 5", "−3 < (k − 2x)/4 ≤ 5"],
    ["\\frac{7-13}{1-(-2)}=-2", "(7 − 13)/(1 − (−2)) = −2"],
    ["k=\\pm 6", "k = ±6"],
    ["x=3\\pm 2\\sqrt{k}", "x = 3 ± 2√k"],
    ["f(x)=|x-4|-3", "f(x) = |x − 4| − 3"],
    ["a:b=9:12", "a:b = 9:12"],
    ["n=4,8,12", "n = 4, 8, 12"],
    // Powers, roots, thousands, degrees, trigonometry.
    ["x^2+\\dfrac{1}{x^2}", "x² + 1/x²"],
    ["A(t)=2{,}500(1.015)^{4t}", "A(t) = 2,500(1.015)^{4t}"],
    ["\\left(x^2y^{-1}\\right)^{-3}=x^{-6}y^{3}", "(x²y⁻¹)⁻³ = x⁻⁶y³"],
    ["x^{-2-(-6)}y^{3-3}=x^{4}", "x^{−2−(−6)}y^{3−3} = x⁴"],
    ["200\\left(\\tfrac{1}{2}\\right)^{2.5}\\approx 35.4", "200(1/2)^{2.5} ≈ 35.4"],
    ["\\sqrt{2x+15}=x", "√(2x + 15) = x"],
    ["\\sqrt[4]{16x^{12}y^{2}}", "∜(16x¹²y²)"],
    ["x-1=27^{2/3}=\\left(\\sqrt[3]{27}\\right)^2=9", "x − 1 = 27^{2/3} = (∛27)² = 9"],
    ["6\\cdot\\frac{\\sqrt{3}}{4}s^2=54\\sqrt{3}", "6 · (√3/4)s² = 54√3"],
    ["\\sin(3x-8)^\\circ=\\cos(2x+13)^\\circ", "sin(3x − 8)° = cos(2x + 13)°"],
    ["\\sin^2A+\\cos^2A=1", "sin² A + cos² A = 1"],
    ["\\cos x^\\circ=\\sin 37^\\circ", "cos x° = sin 37°"],
    ["40\\sin 60^\\circ", "40 sin 60°"],
    ["\\sin\\theta=-\\frac{3}{5}", "sin θ = −3/5"],
    ["\\pi<\\theta<\\frac{3\\pi}{2}", "π < θ < 3π/2"],
    ["s+\\ell=11", "s + ℓ = 11"]
  ];
  test("each kind of expression in the files comes out as written here", () => {
    for (const [latex, plain] of cases) assert.equal(mathToPlain(latex), plain, latex);
  });

  test("a whole text: inline math, dollar signs, and an equation on its own line", () => {
    assert.equal(latexToPlain("A shop charges \\$0.12 per page. If $x$ pages cost \\$41.50, what is $x$?"), "A shop charges $0.12 per page. If x pages cost $41.50, what is x?");
    assert.equal(latexToPlain("$$3x+7y=41$$ $$7x+3y=59$$ The solution is $(x,y)$. What is $x-y$?", { display: "line" }), "3x + 7y = 41\n7x + 3y = 59\nThe solution is (x, y). What is x − y?");
    assert.equal(latexToPlain("Solving $$\\frac{x}{2}=4$$ gives $x=8$."), "Solving x/2 = 4 gives x = 8.");
    assert.equal(latexToPlain("The $x$-intercept is $(c,0)$, and 40\\% of it is $0.4c$."), "The x-intercept is (c, 0), and 40% of it is 0.4c.");
  });

  test("notation it doesn't know stops the conversion instead of slipping through", () => {
    assert.throws(() => mathToPlain("\\int_0^1 x\\,dx"), /unknown LaTeX command|subscripts/);
    assert.throws(() => mathToPlain("x_1+x_2"), /subscripts/);
    assert.throws(() => latexToPlain("costs $5 and $x$"), /unpaired \$/);
    assert.throws(() => mathToPlain("2^{3^{n}}"), /exponent inside an exponent/);
  });
});

// The digits of a text, in order, with superscripts and root signs read back as their numbers.
const SUPER = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "∛": "3", "∜": "4" };
const digitsOf = (s) => [...String(s).replace(/[⁰¹²³⁴-⁹∛∜]/g, (c) => SUPER[c])].filter((c) => /\d/.test(c)).join("");
const sourceDigits = (s) => digitsOf(String(s).replace(/\\sqrt\[(\d)\]/g, "$1"));

describe("the converted bank", () => {
  test("every question in both files is in, and none was left out", () => {
    assert.deepEqual(BANK_ORIGINALS_PROBLEMS, []);
    assert.equal(source.length, 500);
    assert.equal(FIRST.length, 500);
    assert.equal(FIRST.filter((q) => q.section === "Math").length, 300);
    assert.equal(FIRST.filter((q) => q.section === "Reading & Writing").length, 200);
    assert.equal(BANK_ORIGINALS.length, FIRST.length + THIRD.length + WORKBOOKS.length);
    assert.equal(new Set(BANK_ORIGINALS.map((q) => q.key)).size, BANK_ORIGINALS.length);
    assert.ok(BANK_ORIGINALS.every((q) => q.source === "northstar-bank"));
    // Every skill of both sections has some, Advanced Math included.
    for (const [section, domains] of Object.entries(SKILLS)) {
      for (const skill of Object.values(domains).flat()) assert.ok(FIRST.some((q) => q.section === section && q.topic === skill), skill);
    }
  });

  test("each one matches its source: place, level, answer, numbers, and nothing left unconverted", () => {
    const bad = [];
    for (const s of source) {
      const q = made(s.id);
      if (!q) {
        bad.push(`${s.id}: missing`);
        continue;
      }
      const flag = (msg) => bad.push(`${s.id}: ${msg}`);
      if (!SKILLS[q.section]?.[q.domain]?.includes(q.topic) || q.domain !== s.domain) flag("taxonomy");
      if (!DIFFICULTIES.includes(q.difficulty) || q.difficulty.toLowerCase() !== s.difficulty) flag("difficulty");
      const texts = [q.title, q.prompt, q.passage, q.explanation, ...(q.options || []), ...(q.rationales || []), ...(q.table ? [q.table.title, ...q.table.columns, ...q.table.rows.flat()] : [])].filter(Boolean);
      for (const t of texts) {
        if (/[\\-]|\$\$|<\/?u>/.test(t)) flag(`unconverted: ${t.slice(0, 50)}`);
        // Braces only as the player's own ^{…} mark-up, and brackets that close.
        if (/[{}]/.test(t.replace(/\^\{[^{}]*\}/g, ""))) flag(`stray brace: ${t.slice(0, 50)}`);
        let depth = 0;
        for (const c of t) {
          if (c === "(") depth += 1;
          if (c === ")") depth -= 1;
          if (depth < 0) break;
        }
        // (A title is cut short, so its last bracket may be left open.)
        if (depth !== 0 && t !== q.title) flag(`brackets: ${t.slice(0, 60)}`);
      }
      // No number was lost, doubled or reordered on the way.
      if (digitsOf(q.prompt) !== sourceDigits(s.stem)) flag("numbers in the question");
      if (digitsOf(q.explanation) !== sourceDigits(s.explanation)) flag("numbers in the explanation");
      if (s.type === "mcq") {
        if (q.type !== "mcq" || q.options.length !== 4 || new Set(q.options).size !== 4) flag("options");
        if ("ABCD"[q.correctIndex] !== s.answer) flag("answer");
        "ABCD".split("").forEach((l, i) => {
          if (digitsOf(q.options[i]) !== sourceDigits(s.choices[l])) flag(`numbers in choice ${l}`);
          if (digitsOf(q.rationales[i]) !== sourceDigits(s.choice_rationales[l])) flag(`numbers in the reason for ${l}`);
        });
      } else {
        if (q.type !== "grid_in" || q.correctAnswer !== s.answer) flag("answer");
        for (const form of [s.answer, ...s.accepted_answers]) if (!isCorrectAnswer(q, form)) flag(`accepted form ${form} is marked wrong`);
        if (isCorrectAnswer(q, "-98765")) flag("a wrong answer is marked right");
      }
      if (q.section === "Reading & Writing" && !q.passage) flag("no passage");
    }
    assert.deepEqual(bad.slice(0, 12), []);
  });

  test("passages keep their shape: two texts, notes, an underlined part, a table", () => {
    const two = source.filter((s) => s.passage2);
    assert.equal(two.length, 12);
    for (const s of two) assert.ok(made(s.id).passage.startsWith(`Text 1\n${s.passage}\n\nText 2\n`), s.id);
    const notes = source.filter((s) => s.notes);
    assert.equal(notes.length, 18);
    for (const s of notes) assert.deepEqual(made(s.id).passage.split("\n"), [s.passage, ...s.notes.map((n) => `• ${n}`)], s.id);
    const underlined = source.filter((s) => /<u>/.test(s.passage || ""));
    assert.equal(underlined.length, 10);
    for (const s of underlined) {
      const q = made(s.id);
      assert.equal(q.passage.slice(...q.underline), s.passage.match(/<u>(.*?)<\/u>/)[1], s.id);
      assert.equal(q.passage, s.passage.replace(/<\/?u>/g, ""));
    }
    assert.equal(FIRST.filter((q) => q.underline).length, 10);
    const tables = source.filter((s) => s.table);
    assert.equal(tables.length, 17);
    for (const s of tables) {
      const t = made(s.id).table;
      assert.equal(t.columns.length, s.table.columns.length);
      assert.ok(t.rows.length === s.table.rows.length && t.rows.every((r) => r.length === t.columns.length), s.id);
    }
    assert.deepEqual(made("M-013").table, { columns: ["x", "f(x)"], rows: [["−2", "13"], ["1", "7"], ["4", "1"]] });
  });

  test("a question that can't be converted is reported and left out, and a missing file is no error", () => {
    const good = source.find((s) => s.id === "M-001");
    assert.throws(() => convertOriginal({ ...good, skill: "Knitting" }), /taxonomy/);
    assert.throws(() => convertOriginal({ ...good, stem: "What is $\\mathbb{R}$?" }), /unknown LaTeX command/);
    assert.throws(() => convertOriginal({ ...good, choices: { ...good.choices, B: good.choices.A } }), /two choices read the same/);
    assert.throws(() => convertOriginal({ ...source.find((s) => s.type === "spr"), answer: "about 5" }), /isn't a number/);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-originals-"));
    fs.writeFileSync(path.join(dir, "a.json"), JSON.stringify({ questions: [good, { ...good, id: "M-002", difficulty: "impossible" }, good] }));
    const out = loadOriginals(dir, ["a.json", "not-there.json"]);
    assert.deepEqual(out.questions.map((q) => q.key), ["nb-m-001"]);
    assert.equal(out.problems.length, 2);
    assert.match(out.problems.join("\n"), /difficulty "impossible"/);
    assert.match(out.problems.join("\n"), /same id twice/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("the third file: plain text, and a reason written beside each choice", () => {
  test("all 200 are in, each where its file says it belongs", () => {
    assert.equal(source3.length, 200);
    assert.equal(THIRD.length, 200);
    assert.equal(THIRD.filter((q) => q.section === "Math").length, 100);
    assert.equal(THIRD.filter((q) => q.section === "Reading & Writing").length, 100);
    // The file's own count of each level and domain.
    for (const [list, section, counts] of [[file3.math, "Math", file3.counts.math], [file3.ebrw, "Reading & Writing", file3.counts.ebrw]]) {
      assert.equal(list.length, counts.total);
      for (const [level, n] of Object.entries(counts.by_difficulty)) assert.equal(THIRD.filter((q) => q.section === section && q.difficulty === level).length, n, `${section} ${level}`);
      for (const [domain, n] of Object.entries(counts.by_domain)) assert.equal(THIRD.filter((q) => q.section === section && q.domain === domain).length, n, domain);
    }
  });

  test("each one matches its source word for word: question, choices, answer and reasons", () => {
    const bad = [];
    for (const s of source3) {
      const q = made(s.id);
      if (!q) {
        bad.push(`${s.id}: missing`);
        continue;
      }
      const flag = (msg) => bad.push(`${s.id}: ${msg}`);
      if (!SKILLS[q.section]?.[q.domain]?.includes(q.topic) || q.domain !== s.domain) flag("taxonomy");
      if (q.difficulty !== s.difficulty) flag("difficulty");
      if (q.prompt !== s.question) flag("question");
      if (q.type !== "mcq" || JSON.stringify(q.options) !== JSON.stringify(s.options.map((o) => o.text))) flag("choices");
      if ("ABCD"[q.correctIndex] !== s.correct_answer || !s.options[q.correctIndex].is_correct) flag("answer");
      s.options.forEach((o, i) => {
        // Only the right choice's reason starts with "Correct", which is how the player tells it apart.
        if (q.rationales[i] !== (o.is_correct ? `Correct. ${o.explanation}` : o.explanation)) flag(`reason for ${o.label}`);
      });
      if (q.explanation !== s.options[q.correctIndex].explanation) flag("explanation");
      if (q.section === "Math" ? q.passage !== undefined : !q.passage) flag("passage");
      // Nothing of the passage is lost: the only change is where the "Text 1" labels sit.
      if (s.passage && q.passage.replace(/^Text 1\n/, "Text 1: ").replace(/\n\nText 2\n/, "\n\nText 2: ") !== s.passage) flag("passage text");
      if (!q.title || q.title.length > 60) flag("title");
    }
    assert.deepEqual(bad.slice(0, 12), []);
  });

  test("two texts get their labels, notes stay a list, and a table written as lines stays as written", () => {
    const two = source3.filter((s) => /^Text 1: /.test(s.passage || ""));
    assert.equal(two.length, 5);
    for (const s of two) assert.match(made(s.id).passage, /^Text 1\n[^\n]+\n\nText 2\n[^\n]+$/, s.id);
    assert.equal(made("EBRW-017").passage.split("\n")[1], "Many people believe that goldfish have memories lasting only a few seconds, which supposedly explains why the fish seem content swimming in small bowls.");
    const notes = THIRD.filter((q) => q.topic === "Rhetorical Synthesis");
    assert.equal(notes.length, 11);
    for (const q of notes) assert.match(q.passage, /^While researching a topic, a student has taken the following notes:(\n• .+)+$/, q.key);
    assert.equal(made("EBRW-036").passage.split("\n").slice(0, 3).join(" | "), "Average Daily Screen Time of Teens in a Survey | 2015: 6.5 hours | 2017: 7.1 hours");
    assert.ok(THIRD.every((q) => !q.table && !q.underline && !q.acceptedAnswers));
  });

  test("a question that isn't sound in this form is refused too", () => {
    const good = source3.find((s) => s.id === "EBRW-001");
    const options = (change) => good.options.map((o, i) => ({ ...o, ...change(o, i) }));
    assert.equal(convertOriginal(good).key, "nb-ebrw-001");
    assert.throws(() => convertOriginal({ ...good, skill: "Knitting" }), /taxonomy/);
    assert.throws(() => convertOriginal({ ...good, difficulty: "Impossible" }), /difficulty/);
    assert.throws(() => convertOriginal({ ...good, passage: "A <b>bold</b> claim." }), /mark-up in the passage/);
    assert.throws(() => convertOriginal({ ...good, passage: undefined }), /no passage/);
    assert.throws(() => convertOriginal({ ...good, question: " " }), /question text is empty/);
    assert.throws(() => convertOriginal({ ...good, options: options(() => ({ is_correct: true })) }), /doesn't match the one choice marked correct/);
    assert.throws(() => convertOriginal({ ...good, correct_answer: good.correct_answer === "A" ? "B" : "A" }), /doesn't match/);
    assert.throws(() => convertOriginal({ ...good, options: options((o, i) => (i === 1 ? { text: good.options[0].text } : {})) }), /two choices read the same/);
    assert.throws(() => convertOriginal({ ...good, options: good.options.slice(0, 3) }), /aren't A to D/);
    assert.throws(() => convertOriginal({ ...good, options: options((o) => (o.is_correct ? {} : { explanation: "Correct, in a way." })) }), /already starts with/);
    assert.throws(() => convertOriginal({ ...good, options: options((o, i) => (i === 2 ? { explanation: "" } : {})) }), /explanation of choice C is empty/);
  });
});

describe("the two workbooks: read from their PDFs into the third file's form", () => {
  test("199 of the 200 are in, each where its file says, and the one left out is named with its reason", () => {
    assert.equal(sourceBooks.length, 199);
    assert.equal(WORKBOOKS.length, 199);
    assert.equal(WORKBOOKS.filter((q) => q.section === "Math").length, 100);
    assert.equal(WORKBOOKS.filter((q) => q.section === "Reading & Writing").length, 99);
    for (const [n, book] of books.entries()) {
      for (const [list, section, counts, prefix] of [[book.math, "Math", book.counts.math, "wbm"], [book.ebrw, "Reading & Writing", book.counts.ebrw, "wbrw"]]) {
        const made = WORKBOOKS.filter((q) => q.key.startsWith(`nb-${prefix}-${n + 1}`));
        assert.equal(list.length, counts.total);
        assert.equal(made.length, counts.total, `${prefix} of workbook ${n + 1}`);
        for (const [level, count] of Object.entries(counts.by_difficulty)) assert.equal(made.filter((q) => q.difficulty === level).length, count, `${section} ${level}`);
        for (const [domain, count] of Object.entries(counts.by_domain)) assert.equal(made.filter((q) => q.domain === domain).length, count, domain);
      }
    }
    // A question whose printed answer can't be right is kept out of the file, with why.
    assert.deepEqual(books.map((b) => b.held.map((h) => h.id)), [["WBRW-126"], []]);
    assert.match(books[0].held[0].reason, /comma after the blank/);
    assert.equal(made("WBRW-126"), undefined);
  });

  test("each one matches its file word for word, and sits under a skill the bank has", () => {
    const bad = [];
    for (const s of sourceBooks) {
      const q = made(s.id);
      if (!q) {
        bad.push(`${s.id}: missing`);
        continue;
      }
      const flag = (msg) => bad.push(`${s.id}: ${msg}`);
      // The file names the bank's skill itself; the workbook's own name rides along unused.
      if (q.domain !== s.domain || q.topic !== s.skill || !SKILLS[q.section]?.[q.domain]?.includes(q.topic) || !s.subskill) flag("taxonomy");
      if (q.difficulty !== s.difficulty) flag("difficulty");
      if (q.prompt !== s.question) flag("question");
      if (q.type !== "mcq" || JSON.stringify(q.options) !== JSON.stringify(s.options.map((o) => o.text))) flag("choices");
      if ("ABCD"[q.correctIndex] !== s.correct_answer || !s.options[q.correctIndex].is_correct) flag("answer");
      s.options.forEach((o, i) => {
        if (q.rationales[i] !== (o.is_correct ? `Correct. ${o.explanation}` : o.explanation)) flag(`reason for ${o.label}`);
      });
      if (q.explanation !== s.options[q.correctIndex].explanation) flag("explanation");
      if (q.section === "Math" ? q.passage !== undefined : !q.passage) flag("passage");
      if (s.passage && q.passage.replace(/^Text 1\n/, "Text 1: ").replace(/\n\nText 2\n/, "\n\nText 2: ") !== s.passage) flag("passage text");
      if (JSON.stringify(q.table) !== JSON.stringify(s.table)) flag("table");
      if (!q.title || q.title.length > 60) flag("title");
      // What the PDFs' typed notation must not leave behind: a caret, a typed minus, bold marks.
      for (const t of [q.prompt, q.passage, ...q.options, ...q.rationales].filter(Boolean)) {
        if (/\^(?!\{)|\*\*|[[\]]| - |=\[/.test(t)) flag(`notation: ${t.slice(0, 50)}`);
      }
    }
    assert.deepEqual(bad.slice(0, 12), []);
  });

  test("tables keep their headings, notes are a list, two texts are labelled, and every item asks its question", () => {
    assert.deepEqual(made("WBRW-104").table, { columns: ["Light condition", "Average height after 4 weeks"], rows: [["Low light", "4 cm"], ["Moderate light", "9 cm"], ["Bright light", "10 cm"]] });
    assert.deepEqual(WORKBOOKS.filter((q) => q.table).map((q) => q.key), ["nb-wbrw-104", "nb-wbrw-108", "nb-wbrw-147"]);
    assert.ok(WORKBOOKS.filter((q) => q.table).every((q) => !q.passage.includes(" | ")));
    const notes = WORKBOOKS.filter((q) => /\n• /.test(q.passage || ""));
    assert.deepEqual(notes.map((q) => q.key), ["nb-wbrw-119", "nb-wbrw-120", "nb-wbrw-146", "nb-wbrw-244"]);
    for (const q of notes) assert.match(q.passage, /^[^\n•]+ notes say:(\n• .+){3,4}$/, q.key);
    // The goal the workbook printed as a fourth note is asked with the question instead.
    assert.match(made("WBRW-244").prompt, /^The student wants to emphasize that the device is still being evaluated\. Which choice /);
    // The second workbook's "Passage 1 / Passage 2" are named the bank's way, in the question too.
    assert.deepEqual(WORKBOOKS.filter((q) => /^Text 1\n[^\n]+\n\nText 2\n[^\n]+$/.test(q.passage || "")).map((q) => q.key), ["nb-wbrw-114", "nb-wbrw-117", "nb-wbrw-144", "nb-wbrw-206", "nb-wbrw-224", "nb-wbrw-239"]);
    assert.equal(made("WBRW-224").prompt, "How would the researcher in Text 2 most likely respond to the planner’s argument?");
    assert.ok(WORKBOOKS.filter((q) => q.topic === "Cross-Text Connections").every((q) => ![q.prompt, q.passage, ...q.rationales].some((t) => /passage/i.test(t))));
    // Where the workbook printed only a sentence with a blank, the question is the usual one.
    const blanks = WORKBOOKS.filter((q) => /_{4,}/.test(q.passage || ""));
    assert.equal(blanks.length, 41);
    assert.ok(blanks.every((q) => /^Which choice /.test(q.prompt)));
    assert.equal(made("WBRW-121").prompt, "Which choice completes the text with the most logical transition?");
    assert.equal(made("WBRW-212").prompt, "Which choice completes the text so that it conforms to the conventions of Standard English?");
    assert.ok(WORKBOOKS.filter((q) => q.section !== "Math").every((q) => /[?]$|most nearly means$|agree that( diaries)?$/.test(q.prompt)));
  });

  test("math reads in the player's notation", () => {
    assert.equal(made("WBM-113").options[0], "x⁷/y⁵");
    assert.equal(made("WBM-131").prompt, "If 3^{x + 1} = 81, what is x?");
    assert.equal(made("WBM-119").options[3], "6√2");
    assert.equal(made("WBM-201").prompt, "What is the solution to 3(2x − 1) ≥ 4x + 7?");
    assert.equal(made("WBM-248").prompt, "For x ≠ 1, solve 5/(x − 1) = 2.");
    assert.equal(made("WBM-241").options[1], "y = (1/2)x");
    assert.equal(made("WBM-129").explanation, "x = −b/(2a) = −12/(2(−2)) = 3.");
    // A hyphen that isn't a minus is left alone.
    assert.match(made("WBM-119").prompt, /^A 45°-45°-90° triangle/);
  });

  test("a table that doesn't line up is refused", () => {
    const good = sourceBooks.find((s) => s.id === "WBRW-104");
    assert.equal(convertOriginal(good).key, "nb-wbrw-104");
    assert.throws(() => convertOriginal({ ...good, table: { columns: good.table.columns, rows: [["Low light"]] } }), /don't line up/);
    assert.throws(() => convertOriginal({ ...good, table: { columns: [], rows: [] } }), /don't line up/);
    assert.throws(() => convertOriginal({ ...good, table: { columns: ["A", "<b>B</b>"], rows: [["1", "2"]] } }), /mark-up in a table heading/);
  });
});

describe("in the app", () => {
  const dbPath = path.join(os.tmpdir(), `northstar-originals-test-${Date.now()}.json`);
  let server;
  let base;
  let token;
  let readDB;

  before(async () => {
    process.env.DB_PATH = dbPath;
    process.env.JWT_SECRET = "test-secret-not-for-real-use";
    process.env.ANTHROPIC_API_KEY = "";
    process.env.ANTHROPIC_AUTH_TOKEN = "";
    ({ readDB } = await import("./db.js"));
    const { default: app } = await import("./app.js");
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    base = `http://127.0.0.1:${server.address().port}`;
    token = (await api("/api/student/register", { method: "POST", body: { firstName: "Ada", lastName: "L", email: "ada-originals@test.local", password: "password1" } })).data.token;
  });
  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dbPath, { force: true });
  });
  async function api(p, { method = "GET", body } = {}) {
    const res = await fetch(base + p, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json().catch(() => null) };
  }

  test("the bank has them, stored by id and key only", () => {
    const mine = readDB().practiceQuestions.filter((q) => q.key?.startsWith("nb-"));
    assert.equal(mine.length, 899);
    assert.ok(mine.every((q) => q.prompt && q.explanation && q.id));
    const onDisk = JSON.parse(fs.readFileSync(dbPath, "utf-8")).practiceQuestions.filter((q) => q.key?.startsWith("nb-"));
    assert.equal(onDisk.length, 899);
    assert.ok(onDisk.every((q) => Object.keys(q).sort().join() === "createdAt,id,key"));
  });

  test("a student gets the question without its answer, answers it, and sees a reason for every choice", async () => {
    const q = readDB().practiceQuestions.find((x) => x.key === "nb-m-001");
    const list = (await api(`/api/practice/questions?sec=math&skills=${encodeURIComponent(q.topic)}&difficulty=${q.difficulty}&limit=200`)).data.questions;
    const shown = list.find((x) => x.id === q.id);
    assert.equal(shown.prompt, q.prompt);
    assert.deepEqual(shown.options, q.options);
    for (const k of ["correctIndex", "rationales", "explanation", "source"]) assert.equal(k in shown, false, k);
    const wrong = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: (q.correctIndex + 1) % 4 } });
    assert.equal(wrong.data.correct, false);
    assert.equal(wrong.data.rationale, q.rationales[(q.correctIndex + 1) % 4]);
    const right = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: q.correctIndex, retry: true } });
    assert.equal(right.data.correct, true);
    const ex = (await api(`/api/practice/questions/${q.id}/explanation`)).data;
    assert.equal(ex.rationales.length, 4);
    assert.equal(ex.correctIndex, q.correctIndex);
  });

  test("a question from the third file: asked without its answer, and every choice comes with its reason", async () => {
    const q = readDB().practiceQuestions.find((x) => x.key === "nb-ebrw-017");
    const list = (await api(`/api/practice/questions?sec=rw&skills=${encodeURIComponent(q.topic)}&difficulty=${q.difficulty}&limit=200`)).data.questions;
    const shown = list.find((x) => x.id === q.id);
    assert.equal(shown.passage, q.passage);
    assert.deepEqual(shown.options, q.options);
    for (const k of ["correctIndex", "rationales", "explanation", "source"]) assert.equal(k in shown, false, k);
    const wrong = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: 0 } });
    assert.deepEqual([wrong.data.correct, wrong.data.rationale], [false, "Mori's study involved goldfish in tanks and says nothing about wild fish."]);
    const ex = (await api(`/api/practice/questions/${q.id}/explanation`)).data;
    assert.equal(ex.correctIndex, 3);
    assert.match(ex.rationales[3], /^Correct\. Mori's goldfish still responded/);
    assert.equal(ex.rationales.filter((r) => r.startsWith("Correct")).length, 1);
  });

  test("a workbook question with a table: the table reaches the player, the answer and its reason don't", async () => {
    const q = readDB().practiceQuestions.find((x) => x.key === "nb-wbrw-104");
    const list = (await api(`/api/practice/questions?sec=rw&skills=${encodeURIComponent(q.topic)}&difficulty=${q.difficulty}&limit=200`)).data.questions;
    const shown = list.find((x) => x.id === q.id);
    assert.equal(shown.passage, "A researcher measured the growth of seedlings under three light conditions.");
    assert.deepEqual(shown.table.columns, ["Light condition", "Average height after 4 weeks"]);
    assert.equal(shown.table.rows.length, 3);
    for (const k of ["correctIndex", "rationales", "explanation", "source"]) assert.equal(k in shown, false, k);
    const right = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: 0 } });
    assert.deepEqual([right.data.correct, right.data.rationale], [true, "Correct. The first increase is 9 − 4 = 5 cm, while the second is 10 − 9 = 1 cm."]);
    const ex = (await api(`/api/practice/questions/${q.id}/explanation`)).data;
    assert.equal(ex.rationales.filter((r) => r.startsWith("Correct")).length, 1);
  });

  test("a typed answer takes each form the file lists, and an underlined word reaches the player", async () => {
    const grid = readDB().practiceQuestions.find((x) => x.key?.startsWith("nb-") && x.acceptedAnswers?.length > 1);
    for (const form of grid.acceptedAnswers) {
      const r = await api(`/api/practice/questions/${grid.id}/answer`, { method: "POST", body: { answer: form } });
      assert.equal(r.data.correct, true, form);
    }
    const u = readDB().practiceQuestions.find((x) => x.key === "nb-rw-011");
    const shown = (await api(`/api/practice/questions?sec=rw&skills=${encodeURIComponent(u.topic)}&difficulty=${u.difficulty}&limit=200`)).data.questions.find((x) => x.id === u.id);
    assert.equal(shown.passage.slice(...shown.underline), "entertained");
  });
});
