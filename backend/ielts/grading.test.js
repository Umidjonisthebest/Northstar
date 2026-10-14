import test from "node:test";
import assert from "node:assert/strict";
import { blankIdsInHtml, gradeGroup, groupSlots, normalizeText, publicGroup, textMatches, validateGroups } from "./lib/questions.js";
import { countWords, overallBand, parseBand, rawToBand } from "./lib/scoring.js";

const blank = (id) => `<span class="ql-blank" data-id="${id}"></span>`;

test("blank ids are read in document order, whatever the attribute order", () => {
  const html = `<p>A ${blank("x1")} b <span data-id="x2" class="ql-blank"></span> c ${blank("x3")}</p>`;
  assert.deepEqual(blankIdsInHtml(html), ["x1", "x2", "x3"]);
});

test("text answers are normalised before comparing", () => {
  assert.equal(normalizeText("  The   Harbour. "), "the harbour");
  assert.equal(normalizeText("£85"), "85");
  assert.equal(normalizeText("4,000"), "4000");
  assert.equal(normalizeText("9.30"), normalizeText("9:30"));
  assert.ok(textMatches("KOWALSKI", ["Kowalski"]));
  assert.ok(textMatches("paintbrushes", ["brushes", "paintbrushes"]));
  assert.ok(!textMatches("", ["anything"]));
  assert.ok(!textMatches("brush", ["brushes"]));
});

test("completion groups grade each blank with variations", () => {
  const group = {
    id: "g",
    type: "note_completion",
    contentHtml: `<p>${blank("b1")} and ${blank("b2")}</p>`,
    answers: { b1: { value: "school", variations: ["my school"] }, b2: { value: "3", variations: ["three"] } }
  };
  const rows = gradeGroup(group, { b1: "My School", b2: "four" });
  assert.deepEqual(rows.map((r) => r.correct), [true, false]);
  assert.deepEqual(groupSlots(group).map((s) => s.id), ["b1", "b2"]);
});

test("table and flow-chart blanks are collected across cells and steps", () => {
  const table = { id: "t", type: "table_completion", table: { columns: [{}, {}], rows: [[{ html: blank("a") }, { html: blank("b") }], [{ html: "x" }, { html: blank("c") }]] } };
  assert.deepEqual(groupSlots(table).map((s) => s.id), ["a", "b", "c"]);
  const flow = { id: "f", type: "flowchart_dnd", steps: [{ html: blank("s1") }, { html: `${blank("s2")} ${blank("s3")}` }] };
  assert.deepEqual(groupSlots(flow).map((s) => [s.id, s.mode]), [["s1", "option"], ["s2", "option"], ["s3", "option"]]);
});

test("choice and matching answers compare option keys case-insensitively", () => {
  const group = { id: "g", type: "matching_headings", items: [{ id: "p1" }, { id: "p2" }], options: [], answers: { p1: { value: "iv" }, p2: { value: "ii" } } };
  const rows = gradeGroup(group, { p1: "iv", p2: "iii" });
  assert.deepEqual(rows.map((r) => r.correct), [true, false]);
});

test("multiple-answer items give one mark per correct option, in any order", () => {
  const group = { id: "g", type: "multiple_answers", items: [{ id: "m", count: 2, options: [], correct: ["A", "C"] }] };
  assert.deepEqual(groupSlots(group).map((s) => s.id), ["m#0", "m#1"]);
  assert.equal(gradeGroup(group, { m: ["C", "A"] }).filter((r) => r.correct).length, 2);
  assert.equal(gradeGroup(group, { m: ["C", "B"] }).filter((r) => r.correct).length, 1);
  assert.equal(gradeGroup(group, {}).filter((r) => r.correct).length, 0);
});

test("public groups never include answers", () => {
  const group = { id: "g", type: "multiple_answers", instructionHtml: "", items: [{ id: "m", count: 2, options: [{ key: "A", text: "a" }], correct: ["A", "B"] }], answers: { x: { value: "y" } } };
  const pub = publicGroup(group);
  assert.equal(pub.answers, undefined);
  assert.equal(pub.items[0].correct, undefined);
  assert.equal(pub.items[0].options.length, 1);
});

test("validateGroups rejects blocks without answers", () => {
  const ok = { id: "g", type: "tfng", items: [{ id: "t1" }], answers: { t1: { value: "TRUE" } } };
  assert.equal(validateGroups([ok]), null);
  assert.match(validateGroups([{ ...ok, answers: {} }]), /missing a correct answer/);
  assert.match(validateGroups([{ id: "g", type: "note_completion", contentHtml: "<p>no blanks</p>" }]), /no questions/);
});

test("raw scores convert to bands, scaled when a test is not 40 questions", () => {
  assert.equal(rawToBand("listening", 40, 40), 9);
  assert.equal(rawToBand("listening", 30, 40), 7);
  assert.equal(rawToBand("reading", 30, 40), 7);
  assert.equal(rawToBand("reading", 26, 40), 6);
  assert.equal(rawToBand("listening", 15, 20), 7);
  assert.equal(rawToBand("reading", 0, 0), 0);
});

test("overall band rounds to the nearest half band, .25 and .75 up", () => {
  assert.equal(overallBand([6.5, 6.5, 5, 7]), 6.5);
  assert.equal(overallBand([6, 6, 6, 7]), 6.5);
  assert.equal(overallBand([6, 6, 6, 6.5]), 6);
  assert.equal(overallBand([7, 7, 7, 6]), 7);
  assert.equal(overallBand([6, null, 6, 6]), null);
});

test("band input is validated", () => {
  assert.deepEqual(parseBand("7"), { band: 7 });
  assert.deepEqual(parseBand("6,5"), { band: 6.5 });
  assert.deepEqual(parseBand(""), { band: null });
  assert.ok(parseBand("6.3").error);
  assert.ok(parseBand("10").error);
});

test("word count ignores punctuation and counts contractions once", () => {
  assert.equal(countWords("It's a well-known fact, isn't it?"), 6);
  assert.equal(countWords("   "), 0);
});
