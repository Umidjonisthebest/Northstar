// The practice tests: content/practiceTests/test-*.json, full-length digital-SAT forms the owner
// supplied on 2026-10-12 as ten self-contained pages ("SAT Practice Test A" … "J"). Each page says
// its questions were written for it; tools/practice-tests/extract.mjs takes a page's questions and
// its score table out and writes them here unchanged. To add a test, run that tool on the new page:
// every test-*.json in the folder is loaded.
//
// A test is four modules (two Reading and Writing, two Math). Its questions are not part of the
// question bank: a student should meet them for the first time in the test.
//
// The questions are written with a little mark-up: <i>x</i>, <sup>2</sup>, a stacked fraction
// (<span class="fr">), a root (<span class="rt">), a source line, "Text 1" labels, notes, tables
// and drawn figures (SVG). It is read here, once, into a small tree that the page draws with its
// own elements (frontend components/RichText.jsx): nothing from these files reaches a browser as
// HTML. Only the tags, classes and attributes the tests use are known. Anything else stops the
// conversion, and a test with a question that can't be converted is left out whole and reported,
// never shown with a hole in it.
//
//   blocks (a passage, a question):  p · src · label · eq · notes · table · fig
//   inline (a choice, an explanation, inside a block):  text · i · u · sup · sub · frac · root · br
//
//   { t: "p" | "src" | "label" | "eq", c: inline }      { t: "notes", items: [inline] }
//   { t: "table", caption?: inline, head: [[cell]], rows: [[cell]] }   cell = { h?: true, c: inline }
//   { t: "fig", w, box, label, svg: [{ e, a, c? }], caption?: inline }
//   { t: "i" | "u" | "sup" | "sub" | "root", c: inline }   { t: "frac", n: inline, d: inline }   { t: "br" }

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SKILLS } from "../practiceSkills.js";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "practiceTests");
const FILE = /^test-([a-z0-9]+)\.json$/;
export const SECTION_NAME = { rw: "Reading & Writing", math: "Math" };

// ---------- Reading the mark-up ----------
// "<" starts a tag only when a letter follows: the texts write inequalities with a bare "<".
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z][a-zA-Z0-9:-]*="[^"]*")*)\s*(\/?)>/y;
const VOID = new Set(["br"]);

export function parseMarkup(src) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  let text = "";
  const flush = () => {
    if (!text) return;
    if (/&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(text)) throw new Error(`a character written as an entity in "${text.slice(0, 40)}"`);
    stack.at(-1).children.push(text);
    text = "";
  };
  for (let i = 0; i < src.length; ) {
    if (src[i] === "<" && /[a-zA-Z/]/.test(src[i + 1] || "")) {
      TAG.lastIndex = i;
      const m = TAG.exec(src);
      if (!m) throw new Error(`a tag that can't be read: "${src.slice(i, i + 40)}"`);
      flush();
      const [, closing, tag, attrText, selfClosing] = m;
      if (closing) {
        if (stack.length < 2 || stack.at(-1).tag !== tag) throw new Error(`</${tag}> closes nothing`);
        stack.pop();
      } else {
        const attrs = {};
        for (const a of attrText.matchAll(/([a-zA-Z][a-zA-Z0-9:-]*)="([^"]*)"/g)) attrs[a[1]] = a[2];
        const el = { tag, attrs, children: [] };
        stack.at(-1).children.push(el);
        if (!selfClosing && !VOID.has(tag)) stack.push(el);
      }
      i = TAG.lastIndex;
    } else {
      text += src[i++];
    }
  }
  flush();
  if (stack.length !== 1) throw new Error(`<${stack.at(-1).tag}> is never closed`);
  return root.children;
}

const isEl = (n, tag, cls) => typeof n === "object" && n.tag === tag && (cls === undefined || n.attrs.class === cls);
const attrNames = (el) => Object.keys(el.attrs).sort().join(" ");
const elements = (el) => el.children.filter((c) => typeof c !== "string" || c.trim());
function only(el, names = "") {
  if (attrNames(el) !== names) throw new Error(`<${el.tag}> with attributes it shouldn't have (${attrNames(el) || "none"})`);
}

// ---------- Inline: text and the math written into it ----------
const PLAIN_INLINE = new Set(["i", "u", "sup", "sub"]);
function inline(children) {
  return children.map((n) => {
    if (typeof n === "string") return n;
    if (PLAIN_INLINE.has(n.tag)) {
      only(n);
      return { t: n.tag, c: inline(n.children) };
    }
    if (n.tag === "br") {
      only(n);
      return { t: "br" };
    }
    if (isEl(n, "span", "fr")) {
      only(n, "class");
      const [top, bottom, ...rest] = n.children;
      if (!isEl(top, "span") || !isEl(bottom, "span") || rest.length) throw new Error("a fraction that isn't two parts");
      only(top);
      only(bottom);
      return { t: "frac", n: inline(top.children), d: inline(bottom.children) };
    }
    if (isEl(n, "span", "rt")) {
      only(n, "class");
      const [sign, under, ...rest] = n.children;
      if (sign !== "√" || !isEl(under, "span") || rest.length) throw new Error("a root that isn't a sign and what is under it");
      only(under);
      return { t: "root", c: inline(under.children) };
    }
    throw new Error(`<${n.tag}${n.attrs.class ? ` class="${n.attrs.class}"` : ""}> isn't known here`);
  });
}

// ---------- Figures ----------
// Drawn with a handful of SVG shapes. Each attribute is checked against what it may hold, so a
// figure can't carry a link, a script or a style. Colours are the page's own ink (currentColor)
// or its surface; the font is the page's.
const NUMBER = /^-?\d*\.?\d+$/;
const PAINT = /^(currentColor|none|var\(--surface\)|url\(#[a-zA-Z][\w-]*\))$/;
const TRANSFORM = /^(translate|rotate|scale)\([-0-9 .,]+\)( (translate|rotate|scale)\([-0-9 .,]+\))*$/;
const SVG_ATTR = {
  x: NUMBER, y: NUMBER, x1: NUMBER, x2: NUMBER, y1: NUMBER, y2: NUMBER, cx: NUMBER, cy: NUMBER, r: NUMBER, width: NUMBER, height: NUMBER,
  "font-size": NUMBER, "stroke-width": NUMBER, "stroke-opacity": NUMBER,
  fill: PAINT, stroke: PAINT,
  d: /^[MLHVZAmlhvza0-9 .,-]+$/, points: /^[-0-9 .,]+$/, "stroke-dasharray": /^[0-9 .,]+$/,
  "text-anchor": /^(start|middle|end)$/, "font-style": /^(italic|normal)$/,
  transform: TRANSFORM, patternTransform: TRANSFORM, patternUnits: /^userSpaceOnUse$/,
  id: /^[a-zA-Z][\w-]*$/
};
const SVG_NAME = { "font-size": "fontSize", "stroke-width": "strokeWidth", "stroke-opacity": "strokeOpacity", "stroke-dasharray": "strokeDasharray", "text-anchor": "textAnchor", "font-style": "fontStyle" };
const SHAPE = ["fill", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "transform"];
const FONT = ["font-size", "font-style", "text-anchor"];
const SVG_ELEMENT = {
  g: [...SHAPE, ...FONT],
  line: ["x1", "y1", "x2", "y2", ...SHAPE],
  rect: ["x", "y", "width", "height", ...SHAPE],
  circle: ["cx", "cy", "r", ...SHAPE],
  path: ["d", ...SHAPE],
  polyline: ["points", ...SHAPE],
  text: ["x", "y", "fill", "transform", ...FONT],
  tspan: ["fill", ...FONT],
  defs: [],
  pattern: ["id", "width", "height", "patternUnits", "patternTransform"]
};
export const SVG_ELEMENTS = Object.keys(SVG_ELEMENT);
const TEXT_HOLDERS = new Set(["text", "tspan"]);

// `scope` is put in front of every id, so two figures on one page (the answer review lists many
// questions) can't pick up each other's patterns.
function svgNode(el, scope) {
  const allowed = SVG_ELEMENT[el.tag];
  if (!allowed) throw new Error(`<${el.tag}> isn't a shape the figures use`);
  const a = {};
  for (const [name, value] of Object.entries(el.attrs)) {
    if (name === "font-family" && value === "var(--f-ui)") continue; // the page's own font
    if (!allowed.includes(name) || !SVG_ATTR[name].test(value)) throw new Error(`<${el.tag} ${name}="${value.slice(0, 30)}"> isn't allowed in a figure`);
    a[SVG_NAME[name] || name] = name === "id" ? `${scope}-${value}` : value.replace(/^url\(#(.+)\)$/, (_, id) => `url(#${scope}-${id})`);
  }
  const holdsText = TEXT_HOLDERS.has(el.tag);
  const c = [];
  for (const child of el.children) {
    if (typeof child === "string") {
      if (holdsText) c.push(child);
      else if (child.trim()) throw new Error(`text outside a label in a figure: "${child.trim().slice(0, 30)}"`);
    } else {
      if (holdsText && child.tag !== "tspan") throw new Error(`<${child.tag}> inside a figure's label`);
      c.push(svgNode(child, scope));
    }
  }
  return { e: el.tag, a, ...(c.length ? { c } : {}) };
}

function figure(el, scope) {
  if (!["class", "class style"].includes(attrNames(el)) || el.attrs.class !== "fig") throw new Error("a <figure> that isn't a test figure");
  const width = el.attrs.style === undefined ? 340 : Number((/^max-width:(\d{2,3})px$/.exec(el.attrs.style) || [])[1]);
  if (!width) throw new Error(`a figure styled "${el.attrs.style}"`);
  const [svg, caption, ...rest] = elements(el);
  if (!isEl(svg, "svg") || rest.length || (caption !== undefined && !isEl(caption, "figcaption"))) throw new Error("a figure that isn't a drawing and its caption");
  if (attrNames(svg) !== "aria-label role viewBox" || svg.attrs.role !== "img") throw new Error("a drawing without a description");
  const box = svg.attrs.viewBox.split(" ").map(Number);
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n)) || box[2] <= 0 || box[3] <= 0) throw new Error(`viewBox "${svg.attrs.viewBox}"`);
  if (caption) only(caption);
  return {
    t: "fig",
    w: width,
    box: box.join(" "),
    label: svg.attrs["aria-label"],
    svg: elements(svg).map((child) => {
      if (typeof child === "string") throw new Error("text outside a label in a figure");
      return svgNode(child, scope);
    }),
    ...(caption ? { caption: inline(caption.children) } : {})
  };
}

// ---------- Tables ----------
function table(el) {
  only(el, "class");
  if (el.attrs.class !== "tbl") throw new Error("a <table> that isn't a test table");
  const parts = elements(el);
  const caption = isEl(parts[0], "caption") ? parts.shift() : null;
  const [thead, tbody, ...rest] = parts;
  if (!isEl(thead, "thead") || !isEl(tbody, "tbody") || rest.length) throw new Error("a table that isn't a caption, a head and a body");
  // A cell is { c: its text } and a heading cell { h: true, c }: a table can be laid on its side,
  // with the headings down the first column.
  const rowsOf = (part) =>
    elements(part).map((tr) => {
      if (!isEl(tr, "tr")) throw new Error("something other than rows in a table");
      only(tr);
      return elements(tr).map((cell) => {
        if (typeof cell === "string" || !["td", "th"].includes(cell.tag)) throw new Error("something other than cells in a table row");
        only(cell);
        return { ...(cell.tag === "th" ? { h: true } : {}), c: inline(cell.children) };
      });
    });
  for (const part of [thead, tbody, ...(caption ? [caption] : [])]) only(part);
  const head = rowsOf(thead);
  const rows = rowsOf(tbody);
  const width = head[0]?.length;
  if (!width || !rows.length || [...head, ...rows].some((r) => r.length !== width)) throw new Error("table rows and columns don't line up");
  return { t: "table", ...(caption && caption.children.length ? { caption: inline(caption.children) } : {}), head, rows };
}

// ---------- Blocks ----------
// A passage or a question: its blocks in order, with the text between them as paragraphs.
function blocks(children, scope) {
  const out = [];
  let run = [];
  const flush = () => {
    if (run.some((n) => typeof n !== "string" || n.trim())) out.push({ t: "p", c: inline(run) });
    run = [];
  };
  let figures = 0;
  for (const n of children) {
    let block = null;
    if (isEl(n, "span", "src") || isEl(n, "span", "tlabel")) {
      only(n, "class");
      block = { t: n.attrs.class === "src" ? "src" : "label", c: inline(n.children) };
    } else if (isEl(n, "div", "eq")) {
      only(n, "class");
      block = { t: "eq", c: inline(n.children) };
    } else if (isEl(n, "ul", "notes")) {
      only(n, "class");
      block = {
        t: "notes",
        items: elements(n).map((li) => {
          if (!isEl(li, "li")) throw new Error("something other than notes in the list of notes");
          only(li);
          return inline(li.children);
        })
      };
      if (!block.items.length) throw new Error("an empty list of notes");
    } else if (isEl(n, "div", "tbl-wrap")) {
      only(n, "class");
      const [inner, ...rest] = elements(n);
      if (!isEl(inner, "table") || rest.length) throw new Error("a table wrapper without its table");
      block = table(inner);
    } else if (isEl(n, "table")) {
      block = table(n);
    } else if (isEl(n, "figure")) {
      block = figure(n, `${scope}-f${++figures}`);
    }
    if (block) {
      flush();
      out.push(block);
    } else run.push(n);
  }
  flush();
  return out;
}

// The text of a tree and nothing else, in order: what the tests check a conversion against, and
// what "two choices read the same" compares.
export function rawText(node) {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(rawText).join("");
  if (!node) return "";
  if (node.t === "root") return `√${rawText(node.c)}`;
  if (node.t === "fig") return rawText(node.svg) + rawText(node.caption); // a figure's caption is under it, a table's above
  return [node.caption, node.c, node.n, node.d, node.head, node.rows, node.items].map(rawText).join("");
}

export function parseBlocks(src, scope = "q") {
  if (typeof src !== "string" || !src.trim()) throw new Error("empty");
  return blocks(parseMarkup(src), scope);
}
export function parseInline(src) {
  if (typeof src !== "string" || !src.trim()) throw new Error("empty");
  return inline(parseMarkup(src));
}

// ---------- Questions ----------
const LETTERS = "ABCD";
// One question from a file -> what the app keeps. Throws with the reason when it can't be done.
export function convertTestQuestion(q, { test, module, n }) {
  const id = `${test}-${module.key}-${n}`;
  const section = SECTION_NAME[module.section];
  if (!SKILLS[section]?.[q.d]) throw new Error(`"${q.d}" isn't a domain of ${section || module.section}`);
  if (typeof q.s !== "string" || !q.s.trim()) throw new Error("no skill");
  const part = (what, fn) => {
    try {
      return fn();
    } catch (e) {
      throw new Error(`${what}: ${e.message}`);
    }
  };
  const rec = { id, n, domain: q.d, skill: q.s.trim() };
  rec.passage = q.p === undefined ? null : part("the passage", () => parseBlocks(q.p, `${id}-p`));
  if (module.section === "rw" && !rec.passage) throw new Error("no passage");
  rec.prompt = part("the question", () => parseBlocks(q.q, `${id}-q`));
  rec.explanation = part("the explanation", () => parseInline(q.e));

  if (q.type === "mc") {
    if (!Array.isArray(q.c) || q.c.length !== LETTERS.length) throw new Error("not four choices");
    rec.type = "mcq";
    rec.options = q.c.map((c, i) => part(`choice ${LETTERS[i]}`, () => parseInline(c)));
    if (new Set(rec.options.map((o) => JSON.stringify(o))).size !== LETTERS.length) throw new Error("two choices read the same");
    if (!Number.isInteger(q.a) || q.a < 0 || q.a >= LETTERS.length) throw new Error(`answer ${q.a}`);
    rec.correctIndex = q.a;
  } else if (q.type === "spr") {
    rec.type = "grid_in";
    if (!Array.isArray(q.ans) || !q.ans.length || q.ans.some((a) => typeof a !== "number" || !Number.isFinite(a))) throw new Error(`answer ${JSON.stringify(q.ans)} isn't a number`);
    if (typeof q.show !== "string" || !q.show.trim()) throw new Error("no answer to show");
    rec.accepted = q.ans;
    rec.shown = q.show.trim();
  } else {
    throw new Error(`type "${q.type}"`);
  }
  return rec;
}

// Raw score -> scaled section score, the way the tests' own pages do it: a straight line between
// the points of the test's table, rounded to the nearest ten. An estimate, and the pages say so.
export function scaledScore(curve, raw, total) {
  if (!total) return null;
  const p = Math.max(0, Math.min(1, raw / total));
  for (let i = 1; i < curve.length; i++) {
    const [p0, s0] = curve[i - 1];
    const [p1, s1] = curve[i];
    if (p <= p1) return Math.round((s0 + ((s1 - s0) * (p - p0)) / (p1 - p0)) / 10) * 10;
  }
  return curve.at(-1)[1];
}

function validCurve(curve) {
  return (
    Array.isArray(curve) &&
    curve.length >= 2 &&
    curve.every((pt) => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite)) &&
    curve[0][0] === 0 &&
    curve.at(-1)[0] === 1 &&
    curve.every((pt, i) => i === 0 || (pt[0] > curve[i - 1][0] && pt[1] >= curve[i - 1][1]))
  );
}

export function convertTest(key, data) {
  if (typeof data?.title !== "string" || !data.title.trim()) throw new Error("no title");
  if (!validCurve(data.curve)) throw new Error("its score table doesn't run from 0 to 1");
  if (!Array.isArray(data.modules) || !data.modules.length) throw new Error("no modules");
  const seen = new Set();
  const modules = data.modules.map((m) => {
    if (!/^[a-z0-9]+$/.test(m.key || "") || seen.has(m.key)) throw new Error(`module key "${m.key}"`);
    seen.add(m.key);
    if (!SECTION_NAME[m.section]) throw new Error(`${m.key}: section "${m.section}"`);
    if (!Number.isInteger(m.minutes) || m.minutes < 1 || m.minutes > 300) throw new Error(`${m.key}: ${m.minutes} minutes`);
    if (!Array.isArray(m.qs) || !m.qs.length) throw new Error(`${m.key}: no questions`);
    const questions = m.qs.map((q, i) => {
      try {
        return convertTestQuestion(q, { test: key, module: m, n: i + 1 });
      } catch (e) {
        throw new Error(`${m.key} question ${i + 1}: ${e.message}`);
      }
    });
    return { key: m.key, section: m.section, label: String(m.label || "").trim(), title: String(m.title || "").trim() || SECTION_NAME[m.section], minutes: m.minutes, questions };
  });
  // Sections come whole and in order (Reading and Writing, then Math), as the test is sat.
  const order = modules.map((m) => m.section);
  if (order.some((s, i) => i > 0 && s !== order[i - 1] && order.indexOf(s) < i)) throw new Error("a section's modules aren't next to each other");
  return { key, title: data.title.trim(), source: typeof data.source === "string" ? data.source : null, curve: data.curve, modules };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

// Every test in the folder, plus what was left out and why.
export function loadPracticeTests(dir = DIR) {
  const tests = [];
  const problems = [];
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => FILE.test(f)).sort();
  } catch (e) {
    // A checkout without the folder simply has no practice tests.
    if (e.code !== "ENOENT") problems.push(`${dir}: ${e.message}`);
  }
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8").replace(/^﻿/, ""));
      tests.push(convertTest(FILE.exec(file)[1], data));
    } catch (e) {
      problems.push(`${file}: ${e.message}`);
    }
  }
  return { tests, problems };
}

const loaded = loadPracticeTests();
for (const p of loaded.problems) console.error(`[content] practice tests: ${p}`);
// Handed out to every request as they are, so frozen.
export const PRACTICE_TESTS = deepFreeze(loaded.tests);
export const PRACTICE_TEST_PROBLEMS = loaded.problems;
