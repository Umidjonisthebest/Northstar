// Turns one workbook PDF into a bank file, backend/content/originals/batchN.json, in the form
// content/originals.js already reads (the form of batch3.json: two lists, plain text, a reason
// beside each choice). See README.md for what is changed on the way and why.
//
//   node build.mjs <pdfjs-dist folder> <workbook.pdf> <series> <out.json> [check]
//
// <series> is 1 for the first workbook, 2 for "Pack 2": question 26 of workbook 1's Reading and
// Writing part becomes WBRW-126, question 7 of workbook 2's Math part WBM-207.
// "check" prints the report and writes nothing.

import { writeFileSync } from "node:fs";
import { readWorkbook } from "./read.mjs";

// ---- Where each of the workbook's own skill names sits in the bank's taxonomy (practiceSkills.js).
// Chosen by hand, by what the question asks; the workbook's name is kept beside it as `subskill`.
const SKILLS = {
  Algebra: {
    "Linear equations in one variable": ["Linear equations in one variable", "Linear equations with parentheses", "Linear equations in context", "Equivalent equations and parameters"],
    "Linear equations in two variables": ["Slope of a line", "Slope from two points"],
    "Linear functions": ["Linear models in context", "Linear models and unit rates", "Evaluating a linear function"],
    "Systems of linear equations": ["Systems of two linear equations", "Systems of linear equations", "Solving a linear system by elimination", "Parallel lines and systems"],
    "Linear inequalities": ["Linear inequalities", "Linear inequalities in two variables"]
  },
  "Advanced Math": {
    "Equivalent expressions": ["Equivalent expressions with exponents", "Exponent rules with negative exponents"],
    "Nonlinear equations and systems": [
      "Solving quadratic equations by factoring",
      "Radical equations and extraneous solutions",
      "Discriminant and number of real roots",
      "Exponential equations",
      "Exponential equations with common bases",
      "Exponential equations with different bases",
      "Rational equations",
      "Rational equations and restrictions",
      "Absolute value equations",
      "Sum of roots of a quadratic"
    ],
    "Nonlinear functions": [
      "Exponential growth",
      "Exponential decay in context",
      "Vertex of a quadratic function",
      "Vertex of a quadratic in standard form",
      "Quadratic functions in vertex form",
      "Quadratic functions from roots",
      "Building a quadratic from its roots",
      "Interpreting a quadratic model",
      "Domain of a rational function",
      "Zeros of polynomial functions",
      "Polynomial factor theorem",
      "Composite functions",
      "Interpreting transformations of absolute-value graphs"
    ]
  },
  "Problem-Solving and Data Analysis": {
    "Ratios, rates, and units": ["Ratios and proportional relationships", "Scale drawings and proportional relationships", "Rates and combined work", "Unit conversion", "Converting rates between units", "Unit rate", "Average speed"],
    Percentages: ["Percent change", "Percent discounts", "Percent concentration and mixtures", "Successive percent changes"],
    "One-variable data": ["Mean of a data set", "Weighted means", "Interquartile range", "Effect of transformations on data", "Effects of scaling on standard deviation"],
    "Two-variable data": ["Linear model and prediction", "Interpreting a linear model", "Interpreting a scatterplot trend"],
    Probability: ["Probability", "Probability of independent events", "Probability without replacement", "Conditional probability", "Conditional probability and two-way tables", "Two-way table interpretation"],
    "Sample statistics and margin of error": ["Margin of error and sample estimates", "Interpreting observational data", "Sampling and causal claims"],
    "Studies and experiments": ["Experiments and causal claims", "Interpreting correlation"]
  },
  "Geometry and Trigonometry": {
    "Area and volume": ["Area of a circle", "Area of a triangle", "Area of a trapezoid", "Area scaling in similar figures", "Volume of rectangular prisms", "Volume of cylinders", "Volume of a cone"],
    "Lines, angles, and triangles": ["Angles formed by parallel lines", "Triangle angle relationships", "Similar triangles and scale factors", "Midpoint in the coordinate plane", "Perpendicular lines"],
    "Right triangles and trigonometry": [
      "Special right triangles",
      "30-60-90 right triangles",
      "Sine in a right triangle",
      "Tangent and sine ratios",
      "Trigonometric ratios and the Pythagorean theorem",
      "Pythagorean theorem in a real context",
      "Distance in the coordinate plane"
    ],
    Circles: ["Equations of circles", "Circle equation from center and point", "Arc length", "Area of a sector", "Circle chords and perpendicular distances", "Tangents and right triangles"]
  },
  "Information and Ideas": {
    "Central Ideas and Details": ["Central ideas and details"],
    "Command of Evidence": ["Command of textual evidence", "Command of quantitative evidence"],
    Inferences: ["Inferences", "Inferences from scientific descriptions"]
  },
  "Craft and Structure": {
    "Words in Context": ["Words in context"],
    "Text Structure and Purpose": ["Text structure and purpose", "Author’s use of examples"],
    "Cross-Text Connections": ["Cross-text connections"]
  },
  "Expression of Ideas": {
    "Rhetorical Synthesis": ["Rhetorical synthesis"],
    Transitions: ["Transitions"]
  },
  "Standard English Conventions": {
    Boundaries: [/^Boundaries: /],
    "Form, Structure, and Sense": [/^Form, structure, and sense: /]
  }
};

function topicOf(domain, subskill) {
  for (const [topic, names] of Object.entries(SKILLS[domain] || {})) {
    if (names.some((n) => (n instanceof RegExp ? n.test(subskill) : n === subskill))) return topic;
  }
  throw new Error(`no place chosen for "${domain} | ${subskill}"`);
}

// ---- Questions left out, and the one put right by hand. Keyed by series, part and number.
const HELD = {
  "1 rw 26":
    "The sentence already has a comma after the blank (“letters; ______, only a small portion”), so the keyed choice C (“however,”) gives two commas and choice A (“however”) gives the correct sentence. Deleting that comma from the sentence would make C right, as its explanations assume."
};
const HAND = {
  // The fourth "note" is the goal, bulleted by mistake; it belongs with the question.
  "2 rw 44": (paragraphs) => {
    const goal = paragraphs.findIndex((p) => p === "• The student wants to emphasize that the device is still being evaluated.");
    if (goal !== paragraphs.length - 2) throw new Error("2 rw 44 no longer reads the way the hand fix expects");
    return [...paragraphs.slice(0, goal), `${paragraphs[goal].slice(2)} ${paragraphs.at(-1)}`];
  }
};

// ---- The workbook leaves the question unsaid where the task is plain from the blank. The bank
// shows a question on every item, so these get the wording batch3.json uses for the same tasks.
const ASKED = {
  Transitions: "Which choice completes the text with the most logical transition?",
  Boundaries: "Which choice completes the text so that it conforms to the conventions of Standard English?",
  "Form, Structure, and Sense": "Which choice completes the text so that it conforms to the conventions of Standard English?"
};

// ---- Math: the workbook's typed notation -> the player's (frontend mathLayout.js).
const SUPER = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻" };

function closing(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth += 1;
    else if (s[i] === ")" && --depth === 0) return i;
  }
  return -1;
}

export function mathNotation(text) {
  let s = text.replace(/=\[/g, "≠"); // how the PDF stores its "not equal" sign
  // A denominator held together by square brackets, "-12/[2(-2)]": the player groups with round ones.
  s = s.replace(/\/\[([^\[\]]+)\]/g, "/($1)");
  if (/[\[\]]/.test(s)) throw new Error(`a square bracket the tool doesn't know: ${text}`);
  // Exponents: x^2 -> x², x^-1 -> x⁻¹, 3^(x + 1) -> 3^{x + 1}, 2^x -> 2^{x}.
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "^") {
      out += s[i];
      continue;
    }
    const whole = /^-?\d+/.exec(s.slice(i + 1));
    const word = /^[A-Za-z]+/.exec(s.slice(i + 1));
    if (s[i + 1] === "(") {
      const end = closing(s, i + 1);
      if (end < 0) throw new Error(`an exponent's bracket doesn't close: ${text}`);
      out += `^{${s.slice(i + 2, end).replace(/-/g, "−")}}`;
      i = end;
    } else if (whole) {
      out += [...whole[0]].map((c) => SUPER[c]).join("");
      i += whole[0].length;
    } else if (word) {
      out += `^{${word[0]}}`;
      i += word[0].length;
    } else throw new Error(`an exponent the tool doesn't know: ${text}`);
  }
  s = out;
  // Minus signs. A hyphen inside a word or a name stays ("x-coordinate", "45°-45°-90°", "6-8-10").
  s = s.replace(/ - /g, " − ").replace(/(^|[\s(=,<>≤≥±×·:/√|])-(?=[\dA-Za-z(.√π])/g, "$1−");
  // "1/2x" is half of x: the player reads a slash's whole right-hand term as the denominator.
  s = s.replace(/(−?)(\d+)\/(\d+) ?x\b/g, "$1($2/$3)x");
  if (/\^(?!\{)/.test(s)) throw new Error(`a caret is left: ${s}`);
  return s;
}

// Reading and Writing: bold marks dropped (the question names the word in quotation marks), and
// a subtraction in an explanation given its minus sign.
const prose = (text) => text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/(\d) - (\d)/g, "$1 − $2");

// ---- The reason beside each choice. "D is correct: subtract 5 …" loses its label (the player
// adds "Correct." itself) and starts with a capital when it starts with a word.
const NOT_WORDS = new Set(["sin", "cos", "tan", "log", "ln"]);
function reasonOf(choice, where) {
  if (!choice.correct) return choice.text;
  const m = new RegExp(`^${choice.label} is correct: (.+)$`).exec(choice.text);
  if (!m) throw new Error(`${where}: the right choice's reason doesn't start "${choice.label} is correct:"`);
  const first = /^([a-z]+)(?=[ ,])/.exec(m[1]);
  const isWord = first && !NOT_WORDS.has(first[1]) && (first[1].length > 1 || (first[1] === "a" && /^a [a-z0-9]/.test(m[1]) && !/^a [=<>+−]/.test(m[1])));
  return isWord ? m[1][0].toUpperCase() + m[1].slice(1) : m[1];
}

// ---- Reading and Writing: which paragraphs are the passage, and which the question.
const OPENER = /(?<=[.?!”] )(As used in the text, |Which |What |How |Why |The goal is |The researcher wants |The student wants )/g;

function shape(paragraphs, topic, where, notes) {
  const out = {};
  const table = paragraphs.filter((p) => p.includes(" | "));
  let rest = paragraphs.filter((p) => !p.includes(" | "));
  if (table.length) {
    const cells = table.map((row) => row.split(" | ").map((c) => c.trim()));
    if (cells.length < 2 || cells.some((r) => r.length !== cells[0].length)) throw new Error(`${where}: the table's rows don't line up`);
    if (paragraphs.indexOf(table[0]) !== 1 || paragraphs.indexOf(table.at(-1)) !== table.length) throw new Error(`${where}: a table that isn't straight after the first paragraph`);
    out.table = { columns: cells[0], rows: cells.slice(1) };
  }
  rest = rest.map((p) => p.replace(/^[-•] /, "• "));
  const blank = rest.some((p) => p.includes("______"));

  if (rest.length === 1 && blank) {
    // Only the sentence with the blank: the question is added.
    if (!ASKED[topic]) throw new Error(`${where}: a blank with no question, in a skill the tool has no wording for`);
    notes.asked.push(where);
    return { ...out, passage: rest[0], question: ASKED[topic] };
  }
  if (rest.length === 1) {
    // Passage and question in one paragraph: cut before the question, or before the sentence that
    // states the goal when there is one.
    const starts = [...rest[0].matchAll(OPENER)];
    const goal = starts.find((m) => /^The /.test(m[1]));
    const cut = goal || starts.at(-1);
    if (!cut) throw new Error(`${where}: no question found in "${rest[0]}"`);
    notes.split.push(`${where}: … ${rest[0].slice(Math.max(0, cut.index - 34), cut.index)}⟂ ${rest[0].slice(cut.index)}`);
    return { ...out, passage: rest[0].slice(0, cut.index).trim(), question: rest[0].slice(cut.index) };
  }
  if (rest.length === 2 && blank && /^Which choice /.test(rest[0]) && rest[1].includes("______")) {
    // Conventions: the question is printed above the sentence.
    return { ...out, passage: rest[1], question: rest[0] };
  }
  const question = rest.at(-1);
  const body = rest.slice(0, -1);
  if (!/[?]$|most nearly means$|agree that( diaries)?$/.test(question)) throw new Error(`${where}: the last paragraph doesn't read as a question: "${question}"`);
  const bullets = body.filter((p) => p.startsWith("• "));
  if (bullets.length) {
    if (body.length !== bullets.length + 1 || body[0].startsWith("• ")) throw new Error(`${where}: notes that aren't one lead-in and a list`);
    return { ...out, passage: body.join("\n"), question };
  }
  // Two texts, or one. (originals.js puts "Text 1" / "Text 2" on lines of their own.)
  return { ...out, passage: body.join("\n\n"), question };
}

const countBy = (list, key) => Object.fromEntries([...new Set(list.map((q) => q[key]))].map((v) => [v, list.filter((q) => q[key] === v).length]));

export async function buildBatch(pdfjsDir, pdfPath, series) {
  const book = await readWorkbook(pdfjsDir, pdfPath);
  const notes = { held: [], hand: [], asked: [], split: [], renamed: [] };
  const lists = { math: [], ebrw: [] };

  for (const [part, section, prefix] of [["math", "Math", "WBM"], ["rw", "Reading and Writing", "WBRW"]]) {
    const asked = book[part];
    const explained = book[`${part}Explained`];
    if (asked.length !== 50 || explained.length !== 50 || book.key[part].length !== 50) throw new Error(`${section}: ${asked.length} questions, ${explained.length} explained, ${book.key[part].length} in the key`);
    for (const [i, q] of asked.entries()) {
      const e = explained[i];
      const tag = `${series} ${part} ${q.n}`;
      const where = `${section} ${q.n}`;
      // The three places an answer is given must agree, and so must the two copies of the heading.
      const marked = e.choices.filter((c) => c.correct).map((c) => c.label).join("");
      if (q.n !== i + 1 || e.n !== q.n) throw new Error(`${where}: out of order`);
      if (book.key[part][i] !== e.answer || marked !== e.answer) throw new Error(`${where}: key ${book.key[part][i]}, heading ${e.answer}, marked ${marked}`);
      if (q.domain !== e.domain || q.skill !== e.skill || q.difficulty !== e.difficulty) throw new Error(`${where}: the two headings differ`);
      // The explanations repeat the question (Math) or its first paragraph (Reading and Writing).
      if (e.paragraphs.join("\n") !== (part === "math" ? q.paragraphs.join("\n") : q.paragraphs[0])) throw new Error(`${where}: the copy in the explanations reads differently`);
      if (HELD[tag]) {
        notes.held.push({ id: `${prefix}-${series}${String(q.n).padStart(2, "0")}`, where: `${section}, question ${q.n}`, reason: HELD[tag] });
        continue;
      }
      // Pack 2 calls a pair of texts "Passage 1" and "Passage 2". The bank, like the test itself,
      // calls them Text 1 and Text 2 (the player draws those as labels), so the name is changed
      // wherever the question uses it: the texts, the question and the reasons.
      const paired = part === "rw" && q.paragraphs.some((p) => p.startsWith("Passage 1: "));
      const named = (text) => (paired ? text.replace(/\bPassage ([12])\b/g, "Text $1").replace(/\bboth passages\b/g, "both texts") : text);
      if (paired) notes.renamed.push(where);
      const write = part === "math" ? mathNotation : (text) => prose(named(text));
      if (paired && /passage/i.test([...q.paragraphs, ...q.choices.map((c) => c.text), ...e.choices.map((c) => c.text)].map(named).join(" "))) throw new Error(`${where}: "passage" is still said somewhere after the renaming`);
      const topic = topicOf(q.domain, q.skill);
      let paragraphs = q.paragraphs;
      if (HAND[tag]) {
        paragraphs = HAND[tag](paragraphs);
        notes.hand.push(where);
      }
      const body = part === "math" ? { question: paragraphs.map(write).join("\n") } : shape(paragraphs.map(write), topic, where, notes);
      lists[part === "math" ? "math" : "ebrw"].push({
        id: `${prefix}-${series}${String(q.n).padStart(2, "0")}`,
        section,
        domain: q.domain,
        skill: topic,
        subskill: q.skill,
        difficulty: q.difficulty,
        ...(body.passage ? { passage: body.passage } : {}),
        ...(body.table ? { table: body.table } : {}),
        question: body.question,
        options: q.choices.map((c, k) => ({ label: c.label, text: write(c.text), is_correct: c.label === e.answer, explanation: write(reasonOf(e.choices[k], where)) })),
        correct_answer: e.answer
      });
    }
  }

  const counts = (list) => ({ total: list.length, by_difficulty: countBy(list, "difficulty"), by_domain: countBy(list, "domain") });
  return {
    notes,
    file: {
      title: book.title,
      description: book.subject,
      notes: [
        "Made from the workbook PDF by tools/workbook/build.mjs; see its README for what was changed on the way.",
        "The workbook says of itself: newly written questions, not copied from official tests, not an official College Board test.",
        "skill is the bank's name for the skill; subskill is the workbook's own."
      ],
      counts: { math: counts(lists.math), ebrw: counts(lists.ebrw) },
      held: notes.held,
      math: lists.math,
      ebrw: lists.ebrw
    }
  };
}

const [pdfjsDir, pdfPath, series, outPath, mode] = process.argv.slice(2);
if (!/^[1-9]$/.test(series || "") || !outPath) throw new Error("usage: node build.mjs <pdfjs-dist folder> <workbook.pdf> <series 1-9> <out.json> [check]");
const { file, notes } = await buildBatch(pdfjsDir, pdfPath, series);
console.log(`${file.title}: ${file.math.length} Math, ${file.ebrw.length} Reading and Writing`);
console.log(`levels  Math ${JSON.stringify(file.counts.math.by_difficulty)}  Reading and Writing ${JSON.stringify(file.counts.ebrw.by_difficulty)}`);
for (const h of notes.held) console.log(`left out  ${h.id} (${h.where}): ${h.reason}`);
for (const h of notes.hand) console.log(`put right by hand  ${h}`);
if (notes.renamed.length) console.log(`"Passage 1 / 2" renamed "Text 1 / 2" (${notes.renamed.length}): ${notes.renamed.join(", ")}`);
console.log(`question added where only a blank was printed (${notes.asked.length}): ${notes.asked.join(", ")}`);
for (const s of notes.split) console.log(`cut  ${s}`);
if (mode !== "check") {
  writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.log(`wrote ${outPath}`);
}
