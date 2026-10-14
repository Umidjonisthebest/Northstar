// Takes the practice tests out of the HTML files the owner supplies (one self-contained page per
// test, "SAT-Practice-Test-A.html" …) and writes them as backend/content/practiceTests/test-<x>.json,
// where the app reads them (backend/content/practiceTests.js).
//
//   node tools/practice-tests/extract.mjs <folder with the .html files> [output folder]
//
// Each page keeps its questions in one line, `const DATA = {…};`, and its raw-score-to-scaled-score
// table in `const CURVE = […]`. Both are read as text and parsed as JSON: nothing in the page is
// run. The questions are written out exactly as they are in the page, one per line.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [from, to = path.join(here, "..", "..", "backend", "content", "practiceTests")] = process.argv.slice(2);
if (!from) {
  console.error("usage: node tools/practice-tests/extract.mjs <folder with the .html files> [output folder]");
  process.exit(1);
}

function readTest(file) {
  const html = fs.readFileSync(file, "utf-8");
  const dataLine = html.split(/\r?\n/).find((l) => l.startsWith("const DATA = "));
  if (!dataLine) throw new Error("no `const DATA = …` line");
  const data = JSON.parse(dataLine.replace(/^const DATA = /, "").replace(/;\s*$/, ""));
  if (!Array.isArray(data.modules) || !data.modules.length) throw new Error("no modules in DATA");
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1]?.trim();
  if (!title) throw new Error("no <title>");
  // [[0,200],[.1,250],…]: JavaScript's ".1" is not JSON.
  const curveText = (html.match(/const CURVE = (\[\[[^;]*\]\]);/) || [])[1];
  if (!curveText) throw new Error("no `const CURVE = …`");
  const curve = JSON.parse(curveText.replace(/(^|[^0-9])\.(\d)/g, "$10.$2"));
  return { title, curve, modules: data.modules };
}

// One question per line, so a later correction shows up as one changed line.
function write(file, test, source) {
  const head = JSON.stringify({ title: test.title, source, curve: test.curve }).slice(0, -1);
  const modules = test.modules.map((m) => {
    const { qs, ...rest } = m;
    return `${JSON.stringify(rest).slice(0, -1)},"qs":[\n${qs.map((q) => JSON.stringify(q)).join(",\n")}\n]}`;
  });
  fs.writeFileSync(file, `${head},"modules":[\n${modules.join(",\n")}\n]}\n`);
}

fs.mkdirSync(to, { recursive: true });
const seen = new Set();
for (const name of fs.readdirSync(from).filter((f) => /\.html?$/i.test(f)).sort()) {
  try {
    const test = readTest(path.join(from, name));
    // "SAT Practice Test A" -> test-a.json
    const key = (test.title.match(/Test\s+([A-Za-z0-9]+)\s*$/) || [])[1]?.toLowerCase();
    if (!key) throw new Error(`can't tell which test "${test.title}" is`);
    if (seen.has(key)) throw new Error(`a second test called ${key}`);
    seen.add(key);
    const out = path.join(to, `test-${key}.json`);
    write(out, test, name);
    // What was written must read back as what was in the page.
    const back = JSON.parse(fs.readFileSync(out, "utf-8"));
    if (JSON.stringify(back.modules) !== JSON.stringify(test.modules)) throw new Error("the written file doesn't match the page");
    console.log(`${name} -> test-${key}.json  (${test.modules.map((m) => `${m.key} ${m.qs.length}`).join(", ")})`);
  } catch (e) {
    console.error(`${name}: ${e.message}`);
    process.exitCode = 1;
  }
}
