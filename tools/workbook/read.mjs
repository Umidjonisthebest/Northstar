// Reads one "Digital SAT 100-Question Practice Workbook" PDF into its parts, as plain data: the
// 50 Math and 50 Reading and Writing questions (Parts I and II), the compact answer key (Part III)
// and the choice-by-choice explanations (Part IV). Nothing is interpreted here; see build.mjs.
//
// The PDFs are text, not pictures. Two things about how that text is stored:
// - √, ≥ and the like are set in another font over a space of the main font, so the spaces in the
//   stored text are wrong around them ("12√ 2", "x ≥2"). Spaces are therefore worked out from where
//   each run of text starts and ends, and the stored spaces between runs are ignored.
// - Paragraphs are told apart by the gap above a line: about 14 to 15 points inside a paragraph,
//   17 or more above a new one.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const LEVELS = "Easy|Medium|Hard";
const QUESTION_HEAD = new RegExp(`^(\\d\\d)\\. ([^|]+) \\| (.+) \\| (${LEVELS})$`);
const ANSWER_HEAD = new RegExp(`^(\\d\\d)\\. Answer ([A-D]) \\| ([^·]+) · (.+) · (${LEVELS})$`);
const PAGE_HEAD = /^DIGITAL SAT PRACTICE WORKBOOK \| ORIGINAL QUESTIONS/;
const PAGE_FOOT = /^Independent practice resource • (Pack \d+ • )?Page \d+$/;
const SAME_PARAGRAPH = 15.6; // points between two lines of one paragraph, at most
const OPTION_INDENT = 62; // the question's own lines start at 56, choices at 65 or 69

async function pageLines(pdfjs, page) {
  const { items } = await page.getTextContent();
  const rows = new Map();
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ x: item.transform[4], end: item.transform[4] + item.width, str: item.str });
  }
  const lines = [];
  for (const y of [...rows.keys()].sort((a, b) => b - a)) {
    const runs = rows.get(y).sort((a, b) => a.x - b.x);
    let text = "";
    let end = null;
    for (const run of runs) {
      if (end !== null && run.x - end > 1.2 && !text.endsWith(" ") && !run.str.startsWith(" ")) text += " ";
      text += run.str;
      end = run.end;
    }
    lines.push({ x: runs[0].x, y, text: text.replace(/\s+/g, " ").trim() });
  }
  return lines;
}

// Lines of one paragraph -> its text. A line broken at a hyphen ("public-" / "transit") is joined
// without a space.
function joinLines(lines) {
  return lines.reduce((text, line) => (!text ? line : /[a-z]-$/.test(text) && /^[a-z]/.test(line) ? text + line : `${text} ${line}`), "");
}

// The lines under one heading -> the question's paragraphs and its four choices.
function splitBody(lines, where) {
  const paragraphs = [];
  const choices = [];
  for (const line of lines) {
    if (line.x >= OPTION_INDENT) {
      const start = /^([A-D])\. (.*)$/.exec(line.text);
      if (start && start[1] === "ABCD"[choices.length]) choices.push({ label: start[1], lines: [start[2]] });
      else if (choices.length) choices.at(-1).lines.push(line.text);
      else throw new Error(`${where}: an indented line before choice A: "${line.text}"`);
      continue;
    }
    if (choices.length) throw new Error(`${where}: question text after the choices: "${line.text}"`);
    // A new page gives no gap to measure; a line there carries on the paragraph before it.
    const fresh = !paragraphs.length || (line.gap !== null && line.gap > SAME_PARAGRAPH) || /^(- |Text \d: )/.test(line.text) || line.text.includes(" | ") || paragraphs.at(-1).at(-1).includes(" | ");
    if (fresh) paragraphs.push([line.text]);
    else paragraphs.at(-1).push(line.text);
  }
  if (choices.map((c) => c.label).join("") !== "ABCD") throw new Error(`${where}: choices are "${choices.map((c) => c.label).join("")}", not A to D`);
  return { paragraphs: paragraphs.map(joinLines), choices: choices.map((c) => ({ label: c.label, text: joinLines(c.lines) })) };
}

// Cuts a part into its numbered items. A long heading runs onto a second line ("… · Form,
// structure, and sense: agreement with intervening phrases ·" / "Medium"); the two are read as one.
// What stands before the first heading is the part's introduction, kept for the report.
function splitAt(lines, head, intro) {
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    const whole = /^\d\d\. /.test(line.text) && !head.test(line.text) && next && head.test(`${line.text} ${next.text}`);
    const m = head.exec(whole ? `${line.text} ${next.text}` : line.text);
    if (whole) i += 1;
    if (m) blocks.push({ m, lines: [] });
    else if (blocks.length) blocks.at(-1).lines.push(line);
    else intro.push(line.text);
  }
  return blocks;
}

export async function readWorkbook(pdfjsDir, pdfPath) {
  const pdfjs = await import(pathToFileURL(join(pdfjsDir, "legacy", "build", "pdf.mjs")).href);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(pdfPath)), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
  const meta = (await doc.getMetadata().catch(() => null))?.info || {};

  const lines = [];
  for (let n = 1; n <= doc.numPages; n++) {
    let above = null;
    for (const line of await pageLines(pdfjs, await doc.getPage(n))) {
      if (PAGE_HEAD.test(line.text) || PAGE_FOOT.test(line.text)) continue;
      lines.push({ ...line, page: n, gap: above === null ? null : above - line.y });
      above = line.y;
    }
  }

  const at = (re) => {
    const i = lines.findIndex((l) => re.test(l.text));
    if (i < 0) throw new Error(`no line like ${re}`);
    return i;
  };
  const marks = [at(/^PART I — MATH$/), at(/^PART II — READING AND WRITING$/), at(/^PART III — ANSWER KEY$/), at(/^PART IV — FULL EXPLANATIONS$/)];
  const rwExplained = at(/^Reading and Writing explanations$/);
  const closing = at(/^Official preparation resources$/); // a last page of links, after the explanations
  const part = (from, to) => lines.slice(from + 1, to);
  const intro = [];

  const questions = (from, to, section) =>
    splitAt(part(from, to), QUESTION_HEAD, intro).map(({ m, lines: body }) => {
      const where = `${section} ${m[1]}`;
      return { n: Number(m[1]), domain: m[2].trim(), skill: m[3].trim(), difficulty: m[4], page: body[0]?.page, ...splitBody(body, where) };
    });
  const explained = (from, to, section) =>
    splitAt(part(from, to), ANSWER_HEAD, intro).map(({ m, lines: body }) => {
      const where = `${section} ${m[1]} explained`;
      const { paragraphs, choices } = splitBody(body, where);
      return {
        n: Number(m[1]),
        answer: m[2],
        domain: m[3].trim(),
        skill: m[4].trim(),
        difficulty: m[5],
        paragraphs,
        choices: choices.map((c) => {
          const verdict = /^(Correct|Incorrect) — (.+)$/.exec(c.text);
          if (!verdict) throw new Error(`${where}: choice ${c.label} has no verdict: "${c.text}"`);
          return { label: c.label, correct: verdict[1] === "Correct", text: verdict[2] };
        })
      };
    });

  // The key: rows of numbers, each followed by a row of as many letters.
  const keyLines = part(marks[2], marks[3]).map((l) => l.text);
  const key = { math: "", rw: "" };
  let into = null;
  for (const line of keyLines) {
    if (line === "Math") into = "math";
    else if (line === "Reading and Writing") into = "rw";
    else if (into && /^[A-D]{10}$/.test(line.replace(/\s/g, ""))) key[into] += line.replace(/\s/g, "");
  }

  const read = {
    title: meta.Title || "",
    subject: meta.Subject || "",
    math: questions(marks[0], marks[1], "Math"),
    rw: questions(marks[1], marks[2], "Reading and Writing"),
    key,
    mathExplained: explained(marks[3], rwExplained, "Math"),
    rwExplained: explained(rwExplained, closing, "Reading and Writing")
  };
  return { ...read, intro };
}

// node read.mjs <pdfjs-dist folder> <workbook.pdf>   prints what was read, for a look by eye.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [pdfjsDir, pdfPath] = process.argv.slice(2);
  console.log(JSON.stringify(await readWorkbook(pdfjsDir, pdfPath), null, 1));
}
