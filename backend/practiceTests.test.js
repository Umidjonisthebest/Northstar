// SAT practice tests (content/practiceTests/*.json, practiceTests.js): the conversion of every
// question checked against its source file, the mark-up reader, marking and scoring, and a
// sitting over HTTP (whole test or one section, timed or not, ended early, closed by the clock,
// cancelled because the student left a running module).

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  PRACTICE_TESTS,
  PRACTICE_TEST_PROBLEMS,
  SVG_ELEMENTS,
  convertTest,
  loadPracticeTests,
  parseBlocks,
  parseInline,
  rawText,
  scaledScore
} from "./content/practiceTests.js";
import { SKILLS } from "./practiceSkills.js";

// Set before anything that could load db.js: the HTTP tests below must never open the real database.
const dbPath = path.join(os.tmpdir(), `northstar-practice-tests-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_AUTH_TOKEN = "";

const SOURCE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "content", "practiceTests");
const sources = fs
  .readdirSync(SOURCE_DIR)
  .filter((f) => /^test-[a-z]\.json$/.test(f))
  .sort()
  .map((f) => ({ key: f.slice(5, 6), data: JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, f), "utf-8")) }));
const everyQuestion = PRACTICE_TESTS.flatMap((t) => t.modules.flatMap((m) => m.questions));

// What a reader sees of a source string: its tags taken away. (A bare "<" is text: "x < 4".)
const stripTags = (s) => String(s).replace(/<\/?[a-zA-Z][^>]*>/g, "");
const squash = (s) => s.replace(/\s+/g, " ").trim();
const count = (kind) => {
  let n = 0;
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    if (node.t === kind || node.e === kind) n += 1;
    Object.values(node).forEach(walk);
  };
  walk(everyQuestion.map((q) => [q.passage, q.prompt, q.options, q.explanation]));
  return n;
};

describe("the ten tests", () => {
  test("all of them load, whole: four modules each, in the digital SAT's shape", () => {
    assert.deepEqual(PRACTICE_TEST_PROBLEMS, []);
    assert.deepEqual(PRACTICE_TESTS.map((t) => t.key), ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
    for (const t of PRACTICE_TESTS) {
      assert.equal(t.title, `SAT Practice Test ${t.key.toUpperCase()}`);
      assert.deepEqual(
        t.modules.map((m) => [m.key, m.section, m.minutes, m.questions.length]),
        [["rw1", "rw", 32, 27], ["rw2", "rw", 32, 27], ["m1", "math", 35, 22], ["m2", "math", 35, 22]]
      );
    }
    assert.equal(everyQuestion.length, 980);
    assert.equal(new Set(everyQuestion.map((q) => q.id)).size, 980);
    assert.equal(everyQuestion.filter((q) => q.type === "mcq").length, 861);
    assert.equal(everyQuestion.filter((q) => q.type === "grid_in").length, 119);
    assert.ok(Object.isFrozen(PRACTICE_TESTS[0].modules[0].questions[0].prompt));
  });

  test("each question matches its source: every word, its place, its answer", () => {
    const bad = [];
    for (const { key, data } of sources) {
      const made = PRACTICE_TESTS.find((t) => t.key === key);
      data.modules.forEach((m, mi) => {
        m.qs.forEach((s, i) => {
          const q = made.modules[mi].questions[i];
          const flag = (msg) => bad.push(`${key} ${m.key} #${i + 1}: ${msg}`);
          if (q.id !== `${key}-${m.key}-${i + 1}` || q.n !== i + 1) flag("id");
          const section = m.section === "rw" ? "Reading & Writing" : "Math";
          if (q.domain !== s.d || !SKILLS[section][q.domain] || q.skill !== s.s) flag("place");
          // Inside a drawing the source has line breaks between shapes that aren't text, so there
          // the comparison leaves all spacing out; everywhere else every space must be where it was.
          const same = (tree, src, what) => {
            const tidy = /<svg/.test(src) ? (x) => x.replace(/\s+/g, "") : squash;
            if (tidy(rawText(tree)) !== tidy(stripTags(src))) flag(`${what} reads differently`);
          };
          if (s.p === undefined ? q.passage !== null : !q.passage) flag("passage");
          if (s.p !== undefined) same(q.passage, s.p, "the passage");
          same(q.prompt, s.q, "the question");
          same(q.explanation, s.e, "the explanation");
          if (s.type === "mc") {
            if (q.type !== "mcq" || q.options.length !== 4 || q.correctIndex !== s.a) flag("answer");
            s.c.forEach((c, ci) => same(q.options[ci], c, `choice ${ci + 1}`));
          } else {
            if (q.type !== "grid_in" || q.options !== undefined || JSON.stringify(q.accepted) !== JSON.stringify(s.ans) || q.shown !== s.show) flag("typed answer");
          }
          if (m.section === "rw" && !q.passage) flag("no passage");
        });
      });
    }
    assert.deepEqual(bad.slice(0, 12), []);
  });

  test("the mark-up is all accounted for: fractions, roots, tables, figures, notes, labels", () => {
    const inSource = (re) => sources.reduce((n, { data }) => n + (JSON.stringify(data.modules).match(re) || []).length, 0);
    assert.equal(count("frac"), inSource(/<span class=\\"fr\\">/g));
    assert.equal(count("root"), inSource(/<span class=\\"rt\\">/g));
    assert.equal(count("table"), inSource(/<table /g));
    assert.equal(count("fig"), inSource(/<figure /g));
    assert.equal(count("notes"), inSource(/<ul class=\\"notes\\">/g));
    assert.equal(count("label"), inSource(/<span class=\\"tlabel\\">/g));
    assert.equal(count("src"), inSource(/<span class=\\"src\\">/g));
    assert.equal(count("eq"), inSource(/<div class=\\"eq\\">/g));
    assert.equal(count("u"), inSource(/<u>/g));
    assert.equal(count("sup"), inSource(/<sup>/g));
    assert.equal(count("sub"), inSource(/<sub>/g));
    assert.deepEqual([count("frac"), count("root"), count("table"), count("fig"), count("notes")], [206, 132, 21, 17, 60]);
    // Every shape in every figure is one the page knows how to draw.
    const shapes = new Set();
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      if (node.e) shapes.add(node.e);
      Object.values(node).forEach(walk);
    };
    walk(everyQuestion.map((q) => [q.passage, q.prompt]));
    assert.ok([...shapes].every((e) => SVG_ELEMENTS.includes(e)));
  });
});

describe("reading the mark-up", () => {
  test("text, math and blocks come out as the small tree the page draws", () => {
    assert.deepEqual(parseInline("If <i>x</i><sup>2</sup> < 9, then <i>x</i> < 3"), ["If ", { t: "i", c: ["x"] }, { t: "sup", c: ["2"] }, " < 9, then ", { t: "i", c: ["x"] }, " < 3"]);
    assert.deepEqual(parseInline('<span class="fr"><span><i>x</i> + 2</span><span>3</span></span>'), [{ t: "frac", n: [{ t: "i", c: ["x"] }, " + 2"], d: ["3"] }]);
    assert.deepEqual(parseInline('5<span class="rt">√<span>2</span></span>'), ["5", { t: "root", c: ["2"] }]);
    assert.deepEqual(parseBlocks('<span class="tlabel">Text 1</span>One.<span class="tlabel">Text 2</span>Two.'), [
      { t: "label", c: ["Text 1"] },
      { t: "p", c: ["One."] },
      { t: "label", c: ["Text 2"] },
      { t: "p", c: ["Two."] }
    ]);
    assert.deepEqual(parseBlocks('<div class="eq"><i>x</i> + <i>y</i> = 10<br><i>x</i> − <i>y</i> = 4</div>What is <i>x</i>?'), [
      { t: "eq", c: [{ t: "i", c: ["x"] }, " + ", { t: "i", c: ["y"] }, " = 10", { t: "br" }, { t: "i", c: ["x"] }, " − ", { t: "i", c: ["y"] }, " = 4"] },
      { t: "p", c: ["What is ", { t: "i", c: ["x"] }, "?"] }
    ]);
    assert.deepEqual(parseBlocks('Notes:<ul class="notes"><li>One</li><li>Two</li></ul>'), [{ t: "p", c: ["Notes:"] }, { t: "notes", items: [["One"], ["Two"]] }]);
    // A table on its side keeps its headings down the first column.
    assert.deepEqual(parseBlocks('<div class="tbl-wrap"><table class="tbl"><thead><tr><th><i>x</i></th><td>1</td></tr></thead><tbody><tr><th><i>y</i></th><td>7</td></tr></tbody></table></div>'), [
      { t: "table", head: [[{ h: true, c: [{ t: "i", c: ["x"] }] }, { c: ["1"] }]], rows: [[{ h: true, c: [{ t: "i", c: ["y"] }] }, { c: ["7"] }]] }
    ]);
  });

  test("a figure keeps its shapes, with ids of its own and the page's colours", () => {
    const [fig] = parseBlocks(
      '<figure class="fig" style="max-width:420px"><svg viewBox="0 0 400 270" role="img" aria-label="A bar graph."><defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" stroke-width="2"/></pattern></defs><rect x="10" y="20" width="30" height="40" fill="url(#hatch)" stroke="currentColor" stroke-width="1.2"/><g font-family="var(--f-ui)" font-size="11" fill="currentColor"><text x="5" y="9" text-anchor="end">12 <tspan font-style="italic">x</tspan></text></g></svg><figcaption>Note: not to scale.</figcaption></figure>',
      "a-m1-3-q"
    );
    assert.equal(fig.t, "fig");
    assert.equal(fig.w, 420);
    assert.equal(fig.box, "0 0 400 270");
    assert.equal(fig.label, "A bar graph.");
    assert.deepEqual(fig.caption, ["Note: not to scale."]);
    assert.equal(fig.svg[0].c[0].a.id, "a-m1-3-q-f1-hatch");
    assert.deepEqual(fig.svg[1].a, { x: "10", y: "20", width: "30", height: "40", fill: "url(#a-m1-3-q-f1-hatch)", stroke: "currentColor", strokeWidth: "1.2" });
    assert.deepEqual(fig.svg[2], { e: "g", a: { fontSize: "11", fill: "currentColor" }, c: [{ e: "text", a: { x: "5", y: "9", textAnchor: "end" }, c: ["12 ", { e: "tspan", a: { fontStyle: "italic" }, c: ["x"] }] }] });
  });

  test("anything it doesn't know stops the conversion", () => {
    const svg = (inner) => `<figure class="fig"><svg viewBox="0 0 10 10" role="img" aria-label="x">${inner}</svg></figure>`;
    for (const bad of [
      "<script>alert(1)</script>",
      '<a href="https://example.com">link</a>',
      '<img src="x.png">',
      '<i onclick="x()">x</i>',
      '<span style="color:red">x</span>',
      '<span class="other">x</span>',
      "<b>bold</b>",
      "Tom &amp; Ann",
      "<i>never closed",
      "closed twice</i>",
      "<div>a block where only text may go</div>"
    ]) {
      assert.throws(() => parseInline(bad), Error, bad);
    }
    for (const bad of [
      svg('<image href="https://example.com/x.png"/>'),
      svg("<script>alert(1)</script>"),
      svg('<rect x="1" y="1" width="2" height="2" fill="url(https://example.com/x)"/>'),
      svg('<rect x="1" y="1" width="2" height="2" style="fill:red"/>'),
      svg('<rect x="1" y="1" width="2" height="2" onclick="x()"/>'),
      svg('<a href="x"><text x="1" y="1">t</text></a>'),
      svg("loose text"),
      '<figure class="fig" style="position:fixed"><svg viewBox="0 0 10 10" role="img" aria-label="x"></svg></figure>',
      '<figure class="fig"><svg viewBox="0 0 10 10"></svg></figure>',
      '<table class="tbl"><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>',
      '<ul class="notes"></ul>'
    ]) {
      assert.throws(() => parseBlocks(bad), Error, bad);
    }
    // A choice or an explanation is a line of text: no blocks there.
    assert.throws(() => parseInline('<div class="eq">x</div>'), /isn't known here/);
  });

  test("a test with a question that can't be converted is left out whole, and reported", () => {
    const good = sources[0].data;
    const broken = structuredClone(good);
    broken.modules[1].qs[4].q = "What is <blink>this</blink>?";
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-tests-"));
    fs.writeFileSync(path.join(dir, "test-a.json"), JSON.stringify(good));
    fs.writeFileSync(path.join(dir, "test-b.json"), JSON.stringify(broken));
    fs.writeFileSync(path.join(dir, "notes.txt"), "not a test");
    const out = loadPracticeTests(dir);
    assert.deepEqual(out.tests.map((t) => t.key), ["a"]);
    assert.equal(out.problems.length, 1);
    assert.match(out.problems[0], /test-b\.json: rw2 question 5: the question: <blink> isn't known here/);
    fs.rmSync(dir, { recursive: true, force: true });
    assert.deepEqual(loadPracticeTests(path.join(dir, "gone")), { tests: [], problems: [] });

    const q = good.modules[2].qs.find((x) => x.type === "mc");
    const withQ = (change) => ({ ...good, modules: [{ ...good.modules[2], qs: [{ ...q, ...change }] }] });
    assert.throws(() => convertTest("x", withQ({ a: 4 })), /answer 4/);
    assert.throws(() => convertTest("x", withQ({ c: [q.c[0], q.c[0], q.c[2], q.c[3]] })), /two choices read the same/);
    assert.throws(() => convertTest("x", withQ({ d: "Knitting" })), /isn't a domain/);
    assert.throws(() => convertTest("x", withQ({ type: "spr", ans: ["seven"], show: "7" })), /isn't a number/);
    assert.throws(() => convertTest("x", { ...good, curve: [[0, 200], [0.5, 400]] }), /score table/);
  });
});

describe("marking and scoring", () => {
  let lib;
  before(async () => {
    lib = await import("./practiceTests.js");
  });

  test("the scaled score follows the tests' own table", () => {
    // The pages' function, as written there.
    const CURVE = sources[0].data.curve;
    const scale = (raw, total) => {
      const p = raw / total;
      for (let i = 1; i < CURVE.length; i++) {
        const [p0, s0] = CURVE[i - 1];
        const [p1, s1] = CURVE[i];
        if (p <= p1) return Math.round((s0 + ((s1 - s0) * (p - p0)) / (p1 - p0)) / 10) * 10;
      }
      return 800;
    };
    for (const total of [54, 44]) for (let raw = 0; raw <= total; raw++) assert.equal(scaledScore(CURVE, raw, total), scale(raw, total), `${raw}/${total}`);
    assert.deepEqual([0, 27, 54].map((r) => scaledScore(CURVE, r, 54)), [200, 490, 800]);
    assert.equal(scaledScore(CURVE, 0, 0), null);
  });

  test("a typed answer is read the way the tests' pages read it", () => {
    const { isRight, typedValue } = lib;
    assert.deepEqual(["7/2", "3.5", ".56", "-3", "−3", " 12 ", "0.5"].map(typedValue), [3.5, 3.5, 0.56, -3, -3, 12, 0.5]);
    assert.deepEqual(["", "abc", "3 1/2", "1/0", "5.", "1,000", "3.5.1", "--2"].map(typedValue), [null, null, null, null, null, null, null, null]);
    const whole = { type: "grid_in", accepted: [7] };
    for (const ok of ["7", "7.0", "14/2", "07"]) assert.equal(isRight(whole, ok), true, ok);
    for (const no of ["7.001", "6.999", "-7", "", "seven", null, undefined]) assert.equal(isRight(whole, no), false, String(no));
    const third = { type: "grid_in", accepted: [5 / 3] };
    for (const ok of ["5/3", "1.666", "1.667", "1.6667", "10/6"]) assert.equal(isRight(third, ok), true, ok);
    for (const no of ["1.66", "1.67", "1.7", "2"]) assert.equal(isRight(third, no), false, no);
    assert.equal(isRight({ type: "grid_in", accepted: [-15] }, "−15"), true);
    // Multiple choice: the choice's own number, and nothing that only looks like it.
    assert.equal(isRight({ type: "mcq", correctIndex: 2 }, 2), true);
    assert.equal(isRight({ type: "mcq", correctIndex: 0 }, 0), true);
    for (const no of ["2", 1, null, undefined, ""]) assert.equal(isRight({ type: "mcq", correctIndex: 2 }, no), false);
  });

  test("every typed answer in the tests is marked right in the form the test shows for it", () => {
    const { isRight } = lib;
    const typed = everyQuestion.filter((q) => q.type === "grid_in");
    for (const q of typed) {
      // "14/25 or .56" lists each form the answer can be typed in.
      for (const form of q.shown.split(" or ")) assert.equal(isRight(q, form), true, `${q.id}: ${form}`);
      assert.equal(isRight(q, "98765"), false, q.id);
    }
  });
});

describe("a sitting, over HTTP", () => {
  let server;
  let base;
  let token;
  let db;
  let lib;

  before(async () => {
    db = await import("./db.js");
    assert.equal(db.DB_PATH, dbPath);
    lib = await import("./practiceTests.js");
    const { default: app } = await import("./app.js");
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    base = `http://127.0.0.1:${server.address().port}`;
    token = await student("ada");
  });
  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dbPath, { force: true });
  });

  async function api(p, { method = "GET", body, auth = token } = {}) {
    const res = await fetch(base + p, { method, headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json().catch(() => null) };
  }
  async function student(name) {
    const r = await api("/api/student/register", { method: "POST", auth: null, body: { firstName: name, lastName: "T", email: `${name}-practice-tests@test.local`, password: "password1" } });
    return r.data.token;
  }
  const T = "/api/practice-tests";
  const paper = (key) => PRACTICE_TESTS.find((t) => t.key === key);
  const rightAnswer = (q) => (q.type === "grid_in" ? q.shown.split(" or ")[0] : q.correctIndex);
  // Answers for a module: the first `right` questions answered correctly, the next `wrong` incorrectly, the rest left out.
  function answersFor(mod, right, wrong = 0) {
    const out = {};
    mod.questions.forEach((q, i) => {
      if (i < right) out[q.id] = rightAnswer(q);
      else if (i < right + wrong) out[q.id] = q.type === "grid_in" ? "98765" : (q.correctIndex + 1) % 4;
    });
    return out;
  }
  const start = (key, scope, timed, auth) => api(`${T}/${key}/start`, { method: "POST", body: { scope, timed }, auth });
  const open = (id, mod, auth) => api(`${T}/runs/${id}/modules/${mod}`, { auth });
  const handIn = (id, mod, answers, auth, extra = {}) => api(`${T}/runs/${id}/modules/${mod}/submit`, { method: "POST", body: { answers, ...extra }, auth });
  const xpOf = async (auth) => (await api("/api/practice/progress", { auth })).data.xp;
  // Moves a running module's clock back, as if that much time had passed.
  function age(runId, moduleKey, seconds) {
    db.updateDB((d) => {
      const rm = d.practiceTestRuns.find((r) => r.id === runId).modules.find((m) => m.key === moduleKey);
      rm.startedAt = new Date(Date.parse(rm.startedAt) - seconds * 1000).toISOString();
      rm.deadline = new Date(Date.parse(rm.deadline) - seconds * 1000).toISOString();
    });
  }

  test("the list has all ten, and gives no answers away", async () => {
    const r = await api(T);
    assert.equal(r.status, 200);
    assert.equal(r.data.tests.length, 10);
    const a = r.data.tests[0];
    assert.deepEqual([a.key, a.title, a.questions, a.minutes, a.open, a.attempts.length], ["a", "SAT Practice Test A", 98, 134, null, 0]);
    assert.deepEqual(a.modules.map((m) => [m.key, m.section, m.minutes, m.questions]), [["rw1", "rw", 32, 27], ["rw2", "rw", 32, 27], ["m1", "math", 35, 22], ["m2", "math", 35, 22]]);
    assert.deepEqual(a.best, { total: null, rw: null, math: null });
    assert.doesNotMatch(JSON.stringify(r.data), /"(correctIndex|explanation|accepted|prompt|passage)":/);
    assert.equal((await api(T, { auth: null })).status, 401);
  });

  test("starting: the whole test or a section, timed or not, and one sitting of a test at a time", async () => {
    assert.equal((await start("zz", "full", true)).status, 404);
    for (const body of [{ scope: "half", timed: true }, { scope: "full" }, { scope: "full", timed: "yes" }, { timed: true }, {}]) {
      assert.equal((await api(`${T}/a/start`, { method: "POST", body })).status, 400, JSON.stringify(body));
    }
    const made = await start("a", "full", true);
    assert.equal(made.status, 201);
    assert.deepEqual([made.data.run.scope, made.data.run.timed, made.data.run.status], ["full", true, "in_progress"]);
    assert.deepEqual(made.data.run.modules.map((m) => [m.key, m.status]), [["rw1", "not_started"], ["rw2", "not_started"], ["m1", "not_started"], ["m2", "not_started"]]);
    const again = await start("a", "math", false);
    assert.equal(again.status, 409);
    assert.deepEqual([again.data.code, again.data.runId], ["OPEN", made.data.run.id]);
    // Another test can be going at the same time; one never opened is simply dropped when ended.
    const other = await start("b", "rw", false);
    assert.equal(other.status, 201);
    assert.deepEqual(other.data.run.modules.map((m) => m.key), ["rw1", "rw2"]);
    assert.deepEqual((await api(`${T}/runs/${other.data.run.id}/end`, { method: "POST" })).data, { run: null });
    assert.equal((await api(`${T}/runs/${other.data.run.id}`)).status, 404);
    const list = (await api(T)).data.tests;
    assert.equal(list[0].open.id, made.data.run.id);
    assert.deepEqual([list[1].open, list[1].attempts.length], [null, 0]);
  });

  test("a module: in order, without its answers, on the server's clock, autosaved", async () => {
    const id = (await api(T)).data.tests[0].open.id;
    assert.equal((await open(id, "rw2")).data.code, "ORDER");
    assert.equal((await open(id, "nope")).status, 404);
    assert.equal((await api(`${T}/runs/${id}/modules/rw1/answers`, { method: "PUT", body: { answers: {} } })).data.code, "NOT_STARTED");

    const first = await open(id, "rw1");
    assert.equal(first.status, 200);
    const mod = paper("a").modules[0];
    assert.deepEqual(first.data.module, { key: "rw1", section: "rw", label: "Section 1, Module 1", title: "Reading and Writing", minutes: 32, questions: 27, index: 1, of: 4, last: false });
    assert.deepEqual(first.data.run, { id, test: "a", title: "SAT Practice Test A", scope: "full", timed: true });
    assert.ok(first.data.remainingSeconds > 32 * 60 - 5 && first.data.remainingSeconds <= 32 * 60);
    assert.equal(first.data.questions.length, 27);
    assert.deepEqual(first.data.questions[0], { id: "a-rw1-1", n: 1, type: "mcq", passage: mod.questions[0].passage, prompt: mod.questions[0].prompt, options: mod.questions[0].options });
    assert.doesNotMatch(JSON.stringify(first.data), /"(correctIndex|explanation|accepted|shown|domain|skill)":/);

    // Opening it again doesn't give the time back.
    age(id, "rw1", 600);
    const back = await open(id, "rw1");
    assert.ok(back.data.remainingSeconds <= 22 * 60 && back.data.remainingSeconds > 22 * 60 - 5);

    // What the screen sends is reduced to this module's questions and what they can be answered with.
    const save = await api(`${T}/runs/${id}/modules/rw1/answers`, {
      method: "PUT",
      body: { answers: { "a-rw1-1": 2, "a-rw1-2": 7, "a-rw1-3": "1", "a-rw1-4": { x: 1 }, "a-m1-1": 0, junk: 1 }, flags: ["a-rw1-2", "a-m1-1", 5], times: { "a-rw1-1": 4000, "a-rw1-2": -3, "a-m1-1": 900, "a-rw1-3": "oops" } }
    });
    assert.equal(save.status, 200);
    const kept = await open(id, "rw1");
    assert.deepEqual(kept.data.answers, { "a-rw1-1": 2 });
    assert.deepEqual(kept.data.flags, ["a-rw1-2"]);
    assert.deepEqual(kept.data.times, { "a-rw1-1": 4000 });
    // A cleared answer stays cleared; time on a question never goes down.
    await api(`${T}/runs/${id}/modules/rw1/answers`, { method: "PUT", body: { answers: {}, flags: [], times: { "a-rw1-1": 1000 } } });
    const cleared = await open(id, "rw1");
    assert.deepEqual([cleared.data.answers, cleared.data.times], [{}, { "a-rw1-1": 4000 }]);
    assert.equal((await api(`${T}/runs/${id}/results`)).data.code, "IN_PROGRESS");
  });

  test("the whole test, timed: marked module by module, scored at the end, and paid once", async () => {
    const id = (await api(T)).data.tests[0].open.id;
    const [rw1, rw2, m1, m2] = paper("a").modules;
    const before = await xpOf();

    const one = await handIn(id, "rw1", answersFor(rw1, 20, 5));
    assert.equal(one.status, 200);
    // No marks until the sitting is over.
    assert.deepEqual(one.data.run.modules.map((m) => [m.key, m.status, m.raw, m.answered]), [["rw1", "completed", null, 25], ["rw2", "not_started", null, 0], ["m1", "not_started", null, 0], ["m2", "not_started", null, 0]]);
    assert.equal((await open(id, "rw1")).data.code, "CLOSED");
    assert.equal((await handIn(id, "m1", {})).data.code, "NOT_STARTED");
    // Handing the same module in again changes nothing.
    assert.deepEqual((await handIn(id, "rw1", answersFor(rw1, 27))).data.run.modules[0].answered, 25);

    await open(id, "rw2");
    await handIn(id, "rw2", answersFor(rw2, 27));
    await open(id, "m1");
    await handIn(id, "m1", answersFor(m1, 11, 11));
    const lastOpen = await open(id, "m2");
    assert.deepEqual([lastOpen.data.module.index, lastOpen.data.module.last, lastOpen.data.remainingSeconds > 2000], [4, true, true]);
    const done = await handIn(id, "m2", answersFor(m2, 22));
    // 47 of 54 is 87%: between the table's 80% (650) and 90% (710). 33 of 44 is 75%: between 590 and 650.
    assert.deepEqual([done.data.run.status, done.data.run.total, done.data.run.rw, done.data.run.math], ["completed", 690 + 620, 690, 620]);
    assert.deepEqual(done.data.run.modules.map((m) => m.raw), [20, 27, 11, 22]);

    const curve = paper("a").curve;
    assert.deepEqual([scaledScore(curve, 47, 54), scaledScore(curve, 33, 44)], [690, 620]);
    const res = (await api(`${T}/runs/${id}/results`)).data;
    assert.deepEqual([res.result.total, res.result.correct, res.result.count], [1310, 80, 98]);
    assert.deepEqual([res.result.sections.rw.raw, res.result.sections.rw.total, res.result.sections.rw.score, res.result.sections.rw.modules], [47, 54, 690, 2]);
    assert.deepEqual([res.result.sections.math.raw, res.result.sections.math.total, res.result.sections.math.score], [33, 44, 620]);
    for (const s of Object.values(res.result.sections)) {
      assert.equal(s.domains.reduce((n, d) => n + d.total, 0), s.total);
      assert.equal(s.domains.reduce((n, d) => n + d.correct, 0), s.raw);
    }
    assert.deepEqual(res.result.sections.rw.domains.map((d) => d.domain), Object.keys(SKILLS["Reading & Writing"]));
    assert.deepEqual(res.result.sections.math.domains.map((d) => d.domain), Object.keys(SKILLS.Math));

    // Every question of the modules that were sat, with its answer, the student's and the explanation.
    assert.deepEqual(res.modules.map((m) => [m.key, m.raw, m.items.length]), [["rw1", 20, 27], ["rw2", 27, 27], ["m1", 11, 22], ["m2", 22, 22]]);
    const items = res.modules[0].items;
    assert.deepEqual([items[0].correct, items[0].answered, items[0].given, items[0].correctIndex], [true, true, rw1.questions[0].correctIndex, rw1.questions[0].correctIndex]);
    assert.deepEqual([items[20].correct, items[20].answered], [false, true]);
    assert.deepEqual([items[26].correct, items[26].answered, items[26].given], [false, false, null]);
    assert.deepEqual([items[3].explanation, items[3].domain, items[3].skill], [rw1.questions[3].explanation, rw1.questions[3].domain, rw1.questions[3].skill]);
    const typed = res.modules[2].items.find((x) => x.type === "grid_in");
    assert.deepEqual([typed.correctIndex, typed.shown, typed.options], [null, m1.questions.find((q) => q.id === typed.id).shown, null]);

    // XP: 25 a module, 10 a right answer, 50 for a clean module (rw2 and m2), shown with the results.
    const xp = 4 * 25 + 80 * 10 + 2 * 50;
    assert.equal(res.reward.xpGained, xp);
    assert.equal((await xpOf()) - before, xp);
    assert.deepEqual(res.reward.newBadges.map((b) => b.id).filter((b) => ["mock_finisher", "full_test"].includes(b)).sort(), ["full_test", "mock_finisher"]);
    assert.equal(res.rewardSeen, false);
    await api(`${T}/runs/${id}/rewards/seen`, { method: "POST" });
    assert.equal((await api(`${T}/runs/${id}/results`)).data.rewardSeen, true);

    const listed = (await api(T)).data.tests[0];
    assert.deepEqual([listed.open, listed.attempts.length, listed.attempts[0].total, listed.best], [null, 1, 1310, { total: 1310, rw: 690, math: 620 }]);
    assert.equal((await open(id, "m2")).data.code, "FINISHED");
  });

  test("sitting it again pays only for what got better", async () => {
    const [, , m1, m2] = paper("a").modules;
    const before = await xpOf();
    const id = (await start("a", "math", true)).data.run.id;
    await open(id, "m1");
    await handIn(id, "m1", answersFor(m1, 14)); // 3 more right than before
    await open(id, "m2");
    const done = await handIn(id, "m2", answersFor(m2, 20)); // 2 fewer, and no longer clean
    assert.deepEqual([done.data.run.status, done.data.run.total, done.data.run.rw, done.data.run.math], ["completed", null, null, scaledScore(paper("a").curve, 34, 44)]);
    assert.equal((await xpOf()) - before, 30);
    const res = (await api(`${T}/runs/${id}/results`)).data;
    assert.equal(res.reward.xpGained, 30);
    assert.deepEqual(res.reward.newBadges.filter((b) => ["mock_finisher", "full_test"].includes(b.id)), []);
    assert.deepEqual(res.modules.map((m) => m.key), ["m1", "m2"]);
    assert.equal(res.result.sections.rw, null);
    const listed = (await api(T)).data.tests[0];
    assert.deepEqual([listed.attempts.length, listed.best.total, listed.best.math], [2, 1310, 630]);
  });

  test("one section, untimed: no clock, the time spent is counted, and it isn't a test-day trophy", async () => {
    const me = await student("untimed");
    const [rw1, rw2] = paper("c").modules;
    const id = (await start("c", "rw", false, me)).data.run.id;
    const first = await open(id, "rw1", me);
    assert.deepEqual([first.data.remainingSeconds, first.data.run.timed, first.data.module.of], [null, false, 2]);
    assert.equal(db.readDB().practiceTestRuns.find((r) => r.id === id).modules[0].deadline, undefined);
    await handIn(id, "rw1", answersFor(rw1, 10, 17), me, { times: { "c-rw1-1": 61_000, "c-rw1-2": 30_400 } });
    await open(id, "rw2", me);
    const done = await handIn(id, "rw2", answersFor(rw2, 17), me, { flags: ["c-rw2-5"] });
    assert.deepEqual([done.data.run.status, done.data.run.rw, done.data.run.total], ["completed", scaledScore(paper("c").curve, 27, 54), null]);
    assert.equal(done.data.run.rw, 490);
    const res = (await api(`${T}/runs/${id}/results`, { auth: me })).data;
    assert.equal(res.modules[0].seconds, 91);
    assert.equal(res.modules[1].items[4].flagged, true);
    assert.equal(res.reward.xpGained, 2 * 25 + 27 * 10);
    assert.deepEqual(res.reward.newBadges.filter((b) => ["mock_finisher", "full_test"].includes(b.id)), []);
    // Untimed practice isn't test conditions: it stays out of the score estimate.
    assert.deepEqual((await api("/api/practice/progress", { auth: me })).data.estimate.history, []);
    assert.deepEqual(lib.timedModules(db.readDB(), db.readDB().practiceTestRuns.find((r) => r.id === id).userId), []);
  });

  test("timed modules feed the score estimate, each scaled on its test's own table", async () => {
    const history = (await api("/api/practice/progress")).data.estimate.history;
    assert.equal(history.length, 6);
    assert.ok(history.every((h) => h.test === "SAT Practice Test A"));
    assert.deepEqual(history.slice(0, 2).map((h) => [h.name, h.raw, h.max, h.scaled]), [["Reading and Writing, Module 1", 20, 27, scaledScore(paper("a").curve, 20, 27)], ["Reading and Writing, Module 2", 27, 27, 800]]);
    assert.equal(history.at(-1).name, "Math, Module 2");
    const estimate = (await api("/api/practice/progress")).data.estimate;
    assert.deepEqual([estimate.math.source, estimate.math.score], ["mock exam", scaledScore(paper("a").curve, 20, 22)]);
  });

  test("when the clock runs out, the module is handed in with what was saved", async () => {
    const me = await student("late");
    const [rw1, rw2] = paper("d").modules;
    const id = (await start("d", "rw", true, me)).data.run.id;
    await open(id, "rw1", me);
    await api(`${T}/runs/${id}/modules/rw1/answers`, { method: "PUT", auth: me, body: { answers: answersFor(rw1, 9) } });
    // Inside the grace minute a hand-in still counts in full.
    age(id, "rw1", 32 * 60 + 20);
    const inGrace = await handIn(id, "rw1", answersFor(rw1, 12), me, { auto: true });
    assert.deepEqual([inGrace.status, inGrace.data.late], [200, undefined]);
    assert.equal(db.readDB().practiceTestRuns.find((r) => r.id === id).modules[0].raw, 12);

    await open(id, "rw2", me);
    await api(`${T}/runs/${id}/modules/rw2/answers`, { method: "PUT", auth: me, body: { answers: answersFor(rw2, 6) } });
    age(id, "rw2", 32 * 60 + 61);
    // Too late to save or to change anything: it was closed at its deadline, on the saved answers.
    assert.equal((await api(`${T}/runs/${id}/modules/rw2/answers`, { method: "PUT", auth: me, body: { answers: answersFor(rw2, 27) } })).data.code, "FINISHED");
    const late = await handIn(id, "rw2", answersFor(rw2, 27), me);
    assert.deepEqual([late.status, late.data.late, late.data.run.status], [200, true, "completed"]);
    const res = (await api(`${T}/runs/${id}/results`, { auth: me })).data;
    assert.deepEqual(res.modules.map((m) => [m.raw, m.auto, m.seconds]), [[12, true, 32 * 60], [6, true, 32 * 60]]);
    // A timed-out module is found by the list too, without anyone opening the test.
    const id2 = (await start("e", "math", true, me)).data.run.id;
    await open(id2, "m1", me);
    age(id2, "m1", 36 * 60 + 5);
    const listed = (await api(T, { auth: me })).data.tests.find((t) => t.key === "e");
    assert.deepEqual(listed.open.modules.map((m) => m.status), ["completed", "not_started"]);
    // Nothing was answered in it, so it earned nothing and isn't a study day's work.
    assert.equal(db.readDB().practiceTestRuns.find((r) => r.id === id2).rewards.length, 0);
  });

  test("ending early keeps what was handed in and leaves the rest out", async () => {
    const me = await student("early");
    const [rw1, rw2] = paper("f").modules;
    const id = (await start("f", "full", true, me)).data.run.id;
    await open(id, "rw1", me);
    await handIn(id, "rw1", answersFor(rw1, 27), me);
    await open(id, "rw2", me);
    await api(`${T}/runs/${id}/modules/rw2/answers`, { method: "PUT", auth: me, body: { answers: answersFor(rw2, 13, 3) } });
    const ended = await api(`${T}/runs/${id}/end`, { method: "POST", auth: me });
    assert.deepEqual([ended.data.run.status, ended.data.run.rw, ended.data.run.math, ended.data.run.total], ["ended", scaledScore(paper("f").curve, 40, 54), null, null]);
    assert.deepEqual(ended.data.run.modules.map((m) => [m.key, m.status, m.raw]), [["rw1", "completed", 27], ["rw2", "completed", 13], ["m1", "skipped", null], ["m2", "skipped", null]]);
    const res = (await api(`${T}/runs/${id}/results`, { auth: me })).data;
    assert.deepEqual(res.modules.map((m) => m.items.length), [27, 27, 0, 0]);
    assert.equal(res.result.sections.math, null);
    // Not the whole test, so not the whole-test trophy; ending twice changes nothing.
    assert.deepEqual(res.reward.newBadges.map((b) => b.id).filter((b) => b === "full_test"), []);
    assert.equal((await api(`${T}/runs/${id}/end`, { method: "POST", auth: me })).data.run.status, "ended");
    // The test can be started again straight away.
    assert.equal((await start("f", "math", false, me)).status, 201);

    // One module of a section alone has no scaled score.
    const id2 = (await start("g", "rw", false, me)).data.run.id;
    await open(id2, "rw1", me);
    await api(`${T}/runs/${id2}/modules/rw1/answers`, { method: "PUT", auth: me, body: { answers: answersFor(paper("g").modules[0], 5) } });
    const half = (await api(`${T}/runs/${id2}/end`, { method: "POST", auth: me })).data.run;
    assert.deepEqual([half.status, half.rw, half.correct, half.count], ["ended", null, 5, 27]);
  });

  test("leaving a running module cancels the sitting: no score, no results, and it can be started again", async () => {
    const me = await student("leaver");
    const [rw1, rw2] = paper("h").modules;
    const leave = (id, module, kind, auth = me) => api(`${T}/runs/${id}/leave`, { method: "POST", auth, body: { module, kind } });
    const id = (await start("h", "full", true, me)).data.run.id;
    // Nothing is running yet (the sitting's own page isn't locked), so a report changes nothing.
    assert.equal((await leave(id, "rw1", "hidden")).data.run.status, "in_progress");
    await open(id, "rw1", me);
    await handIn(id, "rw1", answersFor(rw1, 27), me);
    const paid = await xpOf(me);
    // Nor does a report about a module that has been handed in, or one from somebody else.
    assert.equal((await leave(id, "rw1", "hidden")).data.run.status, "in_progress");
    await open(id, "rw2", me);
    assert.equal((await leave(id, "rw2", "hidden", token)).status, 404);

    await api(`${T}/runs/${id}/modules/rw2/answers`, { method: "PUT", auth: me, body: { answers: answersFor(rw2, 27) } });
    const gone = await leave(id, "rw2", "blur");
    assert.equal(gone.status, 200);
    assert.deepEqual([gone.data.run.status, gone.data.run.total, gone.data.run.rw, gone.data.run.correct], ["cancelled", null, null, null]);
    assert.deepEqual([gone.data.run.cancelled.kind, gone.data.run.cancelled.reason], ["blur", "switched to another window"]);
    assert.deepEqual(gone.data.run.modules.map((m) => [m.key, m.status, m.raw]), [["rw1", "completed", null], ["rw2", "cancelled", null], ["m1", "skipped", null], ["m2", "skipped", null]]);
    // A second report (the page closing after the switch) doesn't change why it ended.
    assert.equal((await leave(id, "rw2", "closed")).data.run.cancelled.kind, "blur");

    // The module that was running is closed for good, unmarked and unpaid.
    assert.equal((await open(id, "rw2", me)).data.code, "CANCELLED");
    assert.equal((await api(`${T}/runs/${id}/modules/rw2/answers`, { method: "PUT", auth: me, body: { answers: {} } })).data.code, "CANCELLED");
    assert.equal((await handIn(id, "rw2", answersFor(rw2, 27), me)).data.code, "CANCELLED");
    assert.equal(await xpOf(me), paid);
    // No results: no marks, no answers, no explanations, nothing earned.
    const res = await api(`${T}/runs/${id}/results`, { auth: me });
    assert.deepEqual([res.status, res.data.status, res.data.result, res.data.reward, res.data.cancelled.kind], [200, "cancelled", null, null, "blur"]);
    assert.deepEqual(res.data.modules.map((m) => [m.raw, m.items.length]), [[null, 0], [null, 0], [null, 0], [null, 0]]);
    assert.doesNotMatch(JSON.stringify(res.data), /"(correctIndex|explanation|accepted)":/);
    // Nothing of it reaches the score estimate, and the test can be started again at once.
    assert.deepEqual((await api("/api/practice/progress", { auth: me })).data.estimate.history, []);
    const listed = (await api(T, { auth: me })).data.tests.find((t) => t.key === "h");
    assert.deepEqual([listed.open, listed.attempts.length, listed.attempts[0].status, listed.best], [null, 1, "cancelled", { total: null, rw: null, math: null }]);

    // An untimed module is locked too. A kind the server doesn't know is read as the page being hidden.
    const id2 = (await start("h", "rw", false, me)).data.run.id;
    await open(id2, "rw1", me);
    const gone2 = await leave(id2, "rw1", "something else");
    assert.deepEqual([gone2.data.run.status, gone2.data.run.cancelled.kind], ["cancelled", "hidden"]);
  });

  test("a sitting is its student's alone", async () => {
    const mine = (await api(T)).data.tests[0].attempts[0].id;
    const other = await student("other");
    for (const [p, method] of [
      [`${T}/runs/${mine}`, "GET"],
      [`${T}/runs/${mine}/results`, "GET"],
      [`${T}/runs/${mine}/modules/rw1`, "GET"],
      [`${T}/runs/${mine}/modules/rw1/answers`, "PUT"],
      [`${T}/runs/${mine}/modules/rw1/submit`, "POST"],
      [`${T}/runs/${mine}/end`, "POST"],
      [`${T}/runs/${mine}/leave`, "POST"],
      [`${T}/runs/${mine}/rewards/seen`, "POST"]
    ]) {
      assert.equal((await api(p, { method, auth: other, body: method === "GET" ? undefined : {} })).status, 404, `${method} ${p}`);
    }
    assert.ok((await api(T, { auth: other })).data.tests.every((t) => !t.open && !t.attempts.length));
  });

  test("looking at the list or at results doesn't write the database", async () => {
    const mine = (await api(T)).data.tests[0].attempts[0].id;
    const stamp = () => fs.statSync(dbPath).mtimeMs;
    const before = stamp();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await api(T);
    await api(`${T}/runs/${mine}`);
    await api(`${T}/runs/${mine}/results`);
    assert.equal(stamp(), before);
  });
});
