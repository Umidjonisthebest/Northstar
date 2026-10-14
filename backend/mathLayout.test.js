// Drawn math (frontend components/mathLayout.js, drawn by MathText.jsx): which slashes are
// fractions and which brackets go, roots, exponents and subscripts, what is left alone, and the
// whole question bank run through it.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { findFractions, mathLine, mathTree } from "../frontend/src/components/mathLayout.js";
import { mathToPlain } from "./content/latexPlain.js";
import { PRACTICE_QUESTIONS, SLIM_QUESTIONS } from "./practiceContent.js";
import { MATH_REFERENCE, SKILLS, SKILL_LESSONS } from "./practiceSkills.js";

// The layout written out on one line: ⟦numerator|denominator⟧ for a fraction, √⟨…⟩ for a root,
// ^{…} and _{…} for an exponent and a subscript however they were written (x² stays x²).
const drawn = (nodes) =>
  nodes
    .map((n) => {
      if (typeof n === "string") return n;
      if (n.type === "frac") return `⟦${drawn(n.num)}|${drawn(n.den)}⟧`;
      if (n.type === "root") return `${n.sign}⟨${drawn(n.children)}⟩`;
      if (n.type === "b") return `**${drawn(n.children)}**`;
      return n.form === "chars" ? n.raw : `${n.type === "sup" ? "^" : "_"}{${drawn(n.children)}}`;
    })
    .join("");
const draw = (text) => drawn(mathTree(text));

// The text a layout came from, with everything it doesn't draw put back.
const source = (nodes) =>
  nodes
    .map((n) => {
      if (typeof n === "string") return n;
      if (n.raw) return n.raw;
      const group = (part, brackets) => (brackets ? `(${source(part)})` : source(part));
      if (n.type === "b") return `**${source(n.children)}**`;
      if (n.type === "root") return n.sign + group(n.children, n.brackets);
      if (n.type === "frac") {
        const fraction = `${group(n.num, n.numBrackets)}/${group(n.den, n.denBrackets)}`;
        return n.wrap ? `(${fraction})` : fraction;
      }
      const mark = n.type === "sup" ? "^" : "_";
      return { braces: `${mark}{${source(n.children)}}`, brackets: `${mark}(${source(n.children)})`, bare: mark + source(n.children) }[n.form];
    })
    .join("");
const hasFraction = (nodes) => nodes.some((n) => typeof n !== "string" && (n.type === "frac" || hasFraction(n.children || [])));

const bank = [...PRACTICE_QUESTIONS, ...SLIM_QUESTIONS];
const textsOf = (q) =>
  [q.prompt, q.passage, q.explanation, q.hint, q.correctAnswer, ...(q.options || []), ...(q.rationales || []), ...(q.steps || []).flatMap((s) => [s.title, s.body]), ...(q.acceptedAnswers || [])].filter(
    (t) => typeof t === "string"
  );

describe("fractions in the plain notation", () => {
  const cases = [
    ["5/3", "⟦5|3⟧"],
    ["x = −11/9.", "x = −⟦11|9⟧."],
    ["2t/3 + 11c/28", "⟦2t|3⟧ + ⟦11c|28⟧"],
    ["1/(2x) + 1/x² = 3/k", "⟦1|2x⟧ + ⟦1|x²⟧ = ⟦3|k⟧"],
    ["2.5y/0.4y = 16,200/33.75", "⟦2.5y|0.4y⟧ = ⟦16,200|33.75⟧"],
    ["120°/360° of the circle", "⟦120°|360°⟧ of the circle"],
    // A bracketed numerator or denominator loses its brackets: the bar does their job.
    ["(x − 2)/3", "⟦x − 2|3⟧"],
    ["(18x² + 27x − 31)/(kx − 2) = −6x − 5 − 41/(kx − 2)", "⟦18x² + 27x − 31|kx − 2⟧ = −6x − 5 − ⟦41|kx − 2⟧"],
    ["(5(x − 2))/3 − (x − 2)/2 = 14", "⟦5(x − 2)|3⟧ − ⟦x − 2|2⟧ = 14"],
    ["x/(x − 3) + 2/x = 9/(x(x − 3))", "⟦x|x − 3⟧ + ⟦2|x⟧ = ⟦9|x(x − 3)⟧"],
    ["f(5)/(f(2))", "⟦f(5)|f(2)⟧"],
    ["x⁻²y³/((x²y⁻¹)⁻³)", "⟦x⁻²y³|(x²y⁻¹)⁻³⟧"],
    ["(−6)/(−9) + 2/(−5)", "⟦−6|−9⟧ + ⟦2|−5⟧"],
    ["1/(x + 1)²", "⟦1|(x + 1)²⟧"],
    ["(number of red marbles)/(total marbles)", "⟦number of red marbles|total marbles⟧"],
    // Fractions in fractions.
    ["(1/2)/3", "⟦⟦1|2⟧|3⟧"],
    ["2π/5/(2π) = 1/5", "⟦⟦2π|5⟧|2π⟧ = ⟦1|5⟧"],
    ["(a + 1/2)/(b − 1/3)", "⟦a + ⟦1|2⟧|b − ⟦1|3⟧⟧"],
    // Letters: one a side, or a ratio of segments.
    ["x/a + y/b = 1", "⟦x|a⟧ + ⟦y|b⟧ = 1"],
    ["The slope is −a/b, and r/s + s/r?", "The slope is −⟦a|b⟧, and ⟦r|s⟧ + ⟦s|r⟧?"],
    ["EF/BC = DE/AB, so EF = 10 × 3/2", "⟦EF|BC⟧ = ⟦DE|AB⟧, so EF = 10 × ⟦3|2⟧"],
    ["a = bR/(b − R)", "a = ⟦bR|b − R⟧"],
    ["sin(x)/2", "⟦sin(x)|2⟧"],
    // Markup still works round them.
    ["**Note:** 3/4 of x^{2}", "**Note:** ⟦3|4⟧ of x^{2}"]
  ];
  for (const [text, expected] of cases) test(text, () => assert.equal(draw(text), expected));

  test("a mixed number keeps its fraction close", () => {
    const [whole, fraction] = mathTree("66 2/3 degrees");
    assert.equal(whole, "66 ");
    assert.equal(fraction.mixed, true);
    assert.equal(mathTree("x = 2/3")[1].mixed, false);
  });

  test("½ and its like are fractions too", () => {
    assert.equal(draw("A = ½bh"), "A = ⟦1|2⟧bh");
    const [whole, third] = mathTree("5⅓");
    assert.equal(whole, "5");
    assert.deepEqual({ num: third.num, den: third.den, raw: third.raw, mixed: third.mixed, len: third.len }, { num: ["1"], den: ["3"], raw: "⅓", mixed: true, len: 1 });
  });
});

describe("brackets round a whole fraction", () => {
  // [text, drawn]: gone where the fraction is a coefficient or sits beside an operator…
  const dropped = [
    ["(3/4)(8x − 12)", "⟦3|4⟧(8x − 12)"],
    ["(5/6)u − 3 = (1/2)u + 9", "⟦5|6⟧u − 3 = ⟦1|2⟧u + 9"],
    ["y = −(1/3)x + 5", "y = −⟦1|3⟧x + 5"],
    ["15 ÷ (9/5) = 25/3", "15 ÷ ⟦9|5⟧ = ⟦25|3⟧"],
    ["x · ((a + b)/(ab)) = 1", "x · ⟦a + b|ab⟧ = 1"],
    ["(7π/12) · (180/π) = 105", "⟦7π|12⟧ · ⟦180|π⟧ = 105"],
    ["(1/3)πr²h and (√3/4)s²", "⟦1|3⟧πr²h and ⟦√⟨3⟩|4⟧s²"],
    ["(1/2)(36²)(5π/9)", "⟦1|2⟧(36²)(⟦5π|9⟧)"],
    ["(1.96/0.8)(V²/R)", "⟦1.96|0.8⟧(⟦V²|R⟧)"]
  ];
  for (const [text, expected] of dropped) test(text, () => assert.equal(draw(text), expected));

  // …and kept where they mean something.
  const kept = [
    ["f(14/3)", "f(⟦14|3⟧)"],
    ["16(1/16) and 3(14/3)", "16(⟦1|16⟧) and 3(⟦14|3⟧)"],
    ["(5/3)² and (1/2)^{20/8}", "(⟦5|3⟧)² and (⟦1|2⟧)^{⟦20|8⟧}"],
    ["(−5/3)(−2)", "(−⟦5|3⟧)(−2)"],
    ["(5/3 − 1/2)(x − 2)", "(⟦5|3⟧ − ⟦1|2⟧)(x − 2)"],
    ["The point is (17/3, 17/3).", "The point is (⟦17|3⟧, ⟦17|3⟧)."],
    ["about a third (1/3) of them", "about a third (⟦1|3⟧) of them"]
  ];
  for (const [text, expected] of kept) test(text, () => assert.equal(draw(text), expected));
});

describe("roots", () => {
  const cases = [
    ["If √(x + 4) = 7, what is x?", "If √⟨x + 4⟩ = 7, what is x?"],
    ["√(45 + 4) = √49 = 7", "√⟨45 + 4⟩ = √⟨49⟩ = 7"],
    ["x = 3 ± 2√k, so 4√k = 12", "x = 3 ± 2√⟨k⟩, so 4√⟨k⟩ = 12"],
    ["30-60-90: x, x√3, 2x", "30-60-90: x, x√⟨3⟩, 2x"],
    // The sign covers a bracketed group, a number, or one letter, and no more.
    ["√2x and √1,600 and √2.5.", "√⟨2⟩x and √⟨1,600⟩ and √⟨2.5⟩."],
    // Cube and fourth roots; a power before a root is not its index.
    ["∛(x⁵) · √(x³) = x^{k/6}", "∛⟨x⁵⟩ · √⟨x³⟩ = x^{⟦k|6⟧}"],
    ["∜(16x¹²y²) = 2x³√y", "∜⟨16x¹²y²⟩ = 2x³√⟨y⟩"],
    // With fractions: under the sign, over it and beside it.
    ["∛(125/27) = 5/3", "∛⟨⟦125|27⟧⟩ = ⟦5|3⟧"],
    ["49√3/2 and 2(9)/√3", "⟦49√⟨3⟩|2⟧ and ⟦2(9)|√⟨3⟩⟧"],
    ["√(x + 1)/2 + 1/√(x)", "⟦√⟨x + 1⟩|2⟧ + ⟦1|√⟨x⟩⟧"],
    ["x = (−b ± √(b² − 4ac))/(2a)", "x = ⟦−b ± √⟨b² − 4ac⟩|2a⟧"],
    ["√((x − 1)/2)", "√⟨⟦x − 1|2⟧⟩"],
    // Nothing to cover: left as a character.
    ["the √ sign", "the √ sign"]
  ];
  for (const [text, expected] of cases) test(text, () => assert.equal(draw(text), expected));

  test("the sign, its index and its brackets are kept for the drawing", () => {
    const [cube] = mathLine("∛(125/27)");
    assert.deepEqual({ type: cube.type, sign: cube.sign, index: cube.index, brackets: cube.brackets, len: cube.len }, { type: "root", sign: "∛", index: "3", brackets: true, len: 9 });
    const [, square] = mathLine("4√k");
    assert.deepEqual({ index: square.index, brackets: square.brackets, children: square.children, len: square.len }, { index: "", brackets: false, children: ["k"], len: 2 });
    assert.equal(mathLine("∜x")[0].index, "4");
  });
});

describe("exponents and subscripts", () => {
  test("x² is an exponent written with an ordinary 2", () => {
    assert.deepEqual(mathLine("x² − 9"), ["x", { type: "sup", form: "chars", raw: "²", children: ["2"], len: 1 }, " − 9"]);
    assert.deepEqual(mathLine("x⁻⁸y⁶")[1], { type: "sup", form: "chars", raw: "⁻⁸", children: ["−8"], len: 2 });
    assert.deepEqual(mathLine("1200(1.12)ᵗ")[1].children, ["t"]);
    assert.deepEqual(mathLine("(y₂ − y₁)")[1], { type: "sub", form: "chars", raw: "₂", children: ["2"], len: 1 });
    assert.deepEqual(mathLine("CO₂ and ¹³C").map((n) => (typeof n === "string" ? n : `${n.type}:${n.children[0]}`)), ["CO", "sub:2", " and ", "sup:13", "C"]);
  });

  const cases = [
    ["500 · 2^{3t}", "500 · 2^{3t}"],
    ["2^{t/3} and x^{5/3}", "2^{⟦t|3⟧} and x^{⟦5|3⟧}"],
    ["P = 500 · 2^(t/3).", "P = 500 · 2^{⟦t|3⟧}."],
    ["(growth factor)^t = 1200(1.12)^t.", "(growth factor)^{t} = 1200(1.12)^{t}."],
    ["x^2 + y^10", "x^{2} + y^{10}"],
    ["2^{x}/4 and 1/x^{n}", "⟦2^{x}|4⟧ and ⟦1|x^{n}⟧"],
    ["2^(t/3)/5", "⟦2^{⟦t|3⟧}|5⟧"],
    ["x_{1} + H_{2}O", "x_{1} + H_{2}O"],
    // Not exponents or subscripts.
    ["Therefore, ______ and a_b", "Therefore, ______ and a_b"],
    ["^_^ and 2 ^ 3", "^_^ and 2 ^ 3"]
  ];
  for (const [text, expected] of cases) test(text, () => assert.equal(draw(text), expected));

  test("how it was written is kept", () => {
    assert.deepEqual(mathLine("2^{3t}")[1], { type: "sup", form: "braces", children: ["3t"], len: 5 });
    assert.deepEqual(mathLine("2^(3t)")[1], { type: "sup", form: "brackets", children: ["3t"], len: 5 });
    assert.deepEqual(mathLine("2^t.")[1], { type: "sup", form: "bare", children: ["t"], len: 2 });
  });
});

describe("slashes that are not fractions", () => {
  const prose = [
    "appropriate punctuation and/or a conjunction",
    "her collection Precario/Precarious (1983)",
    "the orbit of comet 81P/Wild once lay",
    "Luiseño/Shoshone-Bannock artist, the exhibition Sueños/Yume, señor/a",
    "import/export firms and a cause/effect relationship",
    "I hold the land / As one holds an apple",
    "Slope = (13 − 5) / (6 − 2) = 8 / 4",
    "108 km/h = 108,000 m/h = 30 m/s, at 9.8 m/s²",
    "rate = 110 bottles/min; $5/lb; 12 g/mL; 60 mi/hr",
    "SOH: sin = opposite/hypotenuse",
    "due 10/08/2026",
    "see https://example.com/a/b/v2/3.html",
    "w/o, N/A, c/o, I/O, AM/PM, UI/UX, US/UK",
    "he/she, his/her, a/an, I/me, it’s/its, on/off, yes/no, either/or",
    "/ at the start, at the end /, and // twice"
  ];
  for (const text of prose) test(text, () => assert.deepEqual(findFractions(text), []));

  test("nothing but text comes back for them", () => {
    for (const text of prose) {
      assert.equal(hasFraction(mathTree(text)), false, text);
      assert.equal(draw(text), text);
    }
    assert.deepEqual(mathTree("and/or"), ["and/or"]);
    assert.deepEqual(mathTree(""), []);
    assert.deepEqual(mathTree(null), []);
  });
});

describe("the converter's notation, drawn", () => {
  // LaTeX from the owner's question files -> plain notation -> the same math, drawn.
  const cases = [
    ["\\frac{5(x-2)}{3}-\\frac{x-2}{2}=14", "⟦5(x − 2)|3⟧ − ⟦x − 2|2⟧ = 14"],
    ["\\tfrac{2}{3}(9x-6)-\\frac{1}{2}(4x+10)=3x-2", "⟦2|3⟧(9x − 6) − ⟦1|2⟧(4x + 10) = 3x − 2"],
    ["15\\div\\tfrac{9}{5}=\\tfrac{25}{3}", "15 ÷ ⟦9|5⟧ = ⟦25|3⟧"],
    ["\\dfrac{x}{x-3}+\\dfrac{2}{x+1}=\\dfrac{12}{(x-3)(x+1)}", "⟦x|x − 3⟧ + ⟦2|x + 1⟧ = ⟦12|(x − 3)(x + 1)⟧"],
    ["-3<\\frac{k-2x}{4}\\le 5", "−3 < ⟦k − 2x|4⟧ ≤ 5"],
    ["\\frac{7-13}{1-(-2)}=-2", "⟦7 − 13|1 − (−2)⟧ = −2"],
    ["x\\cdot\\frac{a+b}{ab}=1", "x · ⟦a + b|ab⟧ = 1"],
    ["x=3\\pm 2\\sqrt{k}", "x = 3 ± 2√⟨k⟩"],
    ["\\sqrt{3x+28}=x+2", "√⟨3x + 28⟩ = x + 2"],
    ["\\sqrt[4]{16x^{12}y^{2}}", "∜⟨16x¹²y²⟩"],
    ["\\frac{\\sqrt{3}}{4}s^2", "⟦√⟨3⟩|4⟧s²"],
    ["A(t)=2{,}500(1.015)^{4t}", "A(t) = 2,500(1.015)^{4t}"]
  ];
  for (const [latex, expected] of cases) test(latex, () => assert.equal(draw(mathToPlain(latex)), expected));
});

describe("the question bank", () => {
  const left = (text) => [...draw(text).matchAll(/\S*\/\S*/g)].map((m) => m[0].replace(/[.,;:?]+$/, ""));

  test("no text is changed: every layout spells its source and covers all of it", () => {
    let checked = 0;
    for (const q of bank) {
      for (const text of textsOf(q)) {
        assert.equal(source(mathTree(text)), text, q.key);
        // What the highlighter counts on: the pieces of a line, end to end, are the line.
        for (const line of text.split("\n")) {
          const pieces = mathLine(line);
          assert.equal(source(pieces), line, q.key);
          assert.equal(pieces.reduce((n, p) => n + (typeof p === "string" ? p.length : p.len), 0), line.length, q.key);
        }
        checked += 1;
      }
    }
    assert.ok(checked > 10000, `${checked} texts`);
  });

  test("Reading & Writing has no fractions or roots", () => {
    const drawnIn = (nodes) => nodes.some((n) => typeof n !== "string" && (n.type === "frac" || n.type === "root" || drawnIn(n.children || [])));
    // One explanation does hold a real fraction: a table question's "the increase … is 50/420".
    const real = new Set(["nb-wbrw-108"]);
    for (const q of bank.filter((x) => x.section !== "Math" && !real.has(x.key))) {
      for (const text of textsOf(q)) assert.equal(drawnIn(mathTree(text)), false, `${q.key}: ${text.slice(0, 60)}`);
    }
    const fractions = bank.filter((x) => real.has(x.key)).flatMap((q) => textsOf(q).flatMap((t) => findFractions(t).map((f) => t.slice(f.start, f.end))));
    assert.deepEqual(fractions, ["50/420"]);
  });

  test("in Math every tight slash is stacked, except rates and words", () => {
    const allowed = new Set(["/", "km/h", "m/h", "m/s", "g/cm³", "km/cm", "bottles/min", "distance/time", "opposite/hypotenuse", "adjacent/hypotenuse", "opposite/adjacent", "hypotenuse/adjacent"]);
    let stacked = 0;
    for (const q of bank.filter((x) => x.section === "Math")) {
      for (const text of textsOf(q)) {
        stacked += (draw(text).match(/\|/g) || []).length;
        for (const token of left(text)) assert.ok(allowed.has(token), `${q.key}: "${token}" in "${text.slice(0, 80)}"`);
      }
    }
    assert.ok(stacked > 1100, `${stacked} fractions`);
  });

  test("in Math every root sign is drawn, and every caret is an exponent", () => {
    let roots = 0;
    for (const q of bank.filter((x) => x.section === "Math")) {
      for (const text of textsOf(q)) {
        const out = draw(text);
        roots += (out.match(/[√∛∜]⟨/g) || []).length;
        assert.ok(!/[√∛∜](?!⟨)/.test(out), `${q.key}: a bare root sign in "${text.slice(0, 80)}"`);
        assert.ok(!/\^(?!\{)/.test(out), `${q.key}: a bare caret in "${text.slice(0, 80)}"`);
      }
    }
    assert.ok(roots > 150, `${roots} roots`);
  });
});

describe("lessons and the reference sheet", () => {
  test("the reference sheet's formulas are drawn", () => {
    const sheet = Object.fromEntries(MATH_REFERENCE);
    assert.equal(draw(sheet.Triangle), "A = ⟦1|2⟧bh");
    assert.equal(draw(sheet.Sphere), "V = ⟦4|3⟧πr³");
    assert.equal(draw(sheet.Pyramid), "V = ⟦1|3⟧ℓwh");
    assert.equal(draw(sheet["Special right triangles"]), "30-60-90: x, x√⟨3⟩, 2x   ·   45-45-90: s, s, s√⟨2⟩");
  });

  test("the quadratic formula is one fraction with a root in it", () => {
    const step = SKILL_LESSONS["Nonlinear equations and systems"].steps.find((s) => s.includes("quadratic formula"));
    assert.ok(draw(step).endsWith("x = ⟦−b ± √⟨b² − 4ac⟩|2a⟧."), draw(step));
  });

  test("Reading & Writing lessons are left as prose", () => {
    for (const skill of Object.values(SKILLS["Reading & Writing"]).flat()) {
      const lesson = SKILL_LESSONS[skill];
      if (!lesson) continue;
      for (const text of [lesson.what, ...lesson.steps, ...lesson.traps, lesson.tip]) assert.equal(draw(text), text, skill);
    }
  });
});
