// The question pack that used to be here (content/pack: 1,657 College Board question-bank items,
// added 2026-10-08) was taken out of the app on 2026-10-13 at the owner's decision. This file
// checks that it is gone and stays gone, and keeps the checks on what the pack shared with the
// owner's own bank (content/originals, keys "nb-…"), which were written against pack questions:
// slim storage, a teacher's edits and deletions, underlines, accepted answer forms, Nova.
// Picture questions (`promptImage`, `explanationImage`, /api/bank-media) have no content left to
// test with; the code for them is still in the app.

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

const dbPath = path.join(os.tmpdir(), `northstar-pack-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_AUTH_TOKEN = "";

let server;
let base;
let token;
let adminToken;
let readDB;
let updateDB;
let PACK;
let MEDIA_DIR;
let ORIGINALS;
let STARTERS;
let isCorrectAnswer;

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  ({ PACK_QUESTIONS: PACK, PACK_MEDIA_DIR: MEDIA_DIR, BANK_ORIGINALS: ORIGINALS, PRACTICE_QUESTIONS: STARTERS } = await import("./practiceContent.js"));
  ({ isCorrectAnswer } = await import("./grading.js"));
  const bcrypt = (await import("bcryptjs")).default;
  updateDB((d) => {
    d.users.push({ id: "admin-1", role: "admin", firstName: "Test", lastName: "Admin", email: "admin@test.local", passwordHash: bcrypt.hashSync("adminpass123", 10) });
  });
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  token = (await api("/api/student/register", { method: "POST", body: { firstName: "Ada", lastName: "L", email: "ada-pack@test.local", password: "password1" } })).data.token;
  adminToken = (await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "adminpass123" } })).data.token;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dbPath, { force: true });
});

async function api(p, { method = "GET", body, auth } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...((auth ?? token) ? { authorization: `Bearer ${auth ?? token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function ask(body) {
  const res = await fetch(`${base}/api/practice/tutor`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const raw = await res.text();
  const out = { text: "", done: null };
  for (const block of raw.split("\n\n")) {
    const ev = block.match(/^event: (\w+)/)?.[1];
    const data = block.match(/data: (.*)$/m)?.[1];
    if (!ev || !data) continue;
    if (ev === "delta") out.text += JSON.parse(data).text;
    if (ev === "done") out.done = JSON.parse(data);
  }
  return out;
}

const stored = (pred) => readDB().practiceQuestions.find(pred);
const rawFile = () => JSON.parse(fs.readFileSync(dbPath, "utf-8"));
const mine = (x) => x.key?.startsWith("nb-");

describe("the College Board pack is out of the app", () => {
  test("no pack file, no pictures, and nothing in the bank that came from it", async () => {
    assert.deepEqual(PACK, []);
    assert.equal(fs.existsSync(path.join(MEDIA_DIR, "..", "questions.json")), false);
    assert.equal(fs.existsSync(MEDIA_DIR), false);
    const db = readDB();
    assert.equal(db.practiceQuestions.filter((q) => q.key?.startsWith("qb-") || q.source === "college-board" || q.promptImage || q.explanationImage || q.image).length, 0);
    // What is left is the starter set and the owner's own bank, every skill still covered.
    assert.equal(db.practiceQuestions.length, STARTERS.length + ORIGINALS.length);
    assert.equal((await api("/api/public/overview")).data.stats.questions, STARTERS.length + ORIGINALS.length);
    assert.equal((await fetch(`${base}/api/bank-media/00012047892a2315.webp`)).status, 404);
  });

  test("a database from before loses the pack's rows at its next save, and nothing else", () => {
    const row = { key: "qb-000000000000", id: "pack-row-1", createdAt: "2026-10-08T00:00:00.000Z" };
    const before = rawFile();
    before.practiceQuestions.push(row, { ...row, key: "qb-000000000001", id: "pack-row-2", title: "Edited by a teacher", updatedAt: "2026-10-09T00:00:00.000Z" });
    fs.writeFileSync(dbPath, JSON.stringify(before));
    // Reading hides them and writes nothing.
    assert.equal(stored((x) => x.id === "pack-row-1" || x.id === "pack-row-2"), undefined);
    assert.equal(rawFile().practiceQuestions.filter((x) => x.key?.startsWith("qb-")).length, 2);
    updateDB((db) => {
      db.vocab[0].touched = true;
    });
    const after = rawFile();
    assert.equal(after.practiceQuestions.filter((x) => x.key?.startsWith("qb-")).length, 0);
    assert.equal(after.practiceQuestions.length, before.practiceQuestions.length - 2);
    // Only the question rows go. What students did (their progress records) is left as it was.
    assert.deepEqual(after.progress, before.progress);
    assert.deepEqual(after.users.map((u) => u.id), before.users.map((u) => u.id));
  });

  test("a question of the owner's bank whose file is missing is still hidden, not lost", () => {
    const orphan = { key: "nb-zz-999", id: "orphan-1", createdAt: "2026-10-08T00:00:00.000Z" };
    const file = rawFile();
    file.practiceQuestions.push(orphan);
    fs.writeFileSync(dbPath, JSON.stringify(file));
    assert.equal(stored((x) => x.id === "orphan-1"), undefined);
    updateDB((db) => {
      db.vocab[0].touched = true;
    });
    assert.deepEqual(rawFile().practiceQuestions.find((x) => x.id === "orphan-1"), orphan);
  });
});

describe("how the database stores the owner's bank", () => {
  test("a teacher's edit is kept as the changed fields only, and a removed field stays removed", async () => {
    const q = stored((x) => mine(x) && x.acceptedAnswers?.length > 1);
    const edited = await api(`/api/admin/practice/questions/${q.id}`, { method: "PUT", auth: adminToken, body: { ...q, title: "Edited by a teacher", correctAnswer: "7" } });
    assert.equal(edited.status, 200);
    const onDisk = rawFile().practiceQuestions.find((x) => x.id === q.id);
    assert.equal(onDisk.title, "Edited by a teacher");
    assert.equal(onDisk.correctAnswer, "7");
    assert.equal(onDisk.acceptedAnswers, null, "the old accepted forms are gone, and stay gone");
    assert.equal("prompt" in onDisk, false, "untouched fields aren't copied into the database");
    const back = stored((x) => x.id === q.id);
    assert.equal(back.prompt, q.prompt);
    assert.ok(isCorrectAnswer(back, "7") && !isCorrectAnswer(back, q.acceptedAnswers.find((a) => a !== "7")));
    // The startup sync leaves an edited question alone.
    const { syncStarterQuestions } = await import("./app.js");
    updateDB((db) => void syncStarterQuestions(db));
    assert.equal(stored((x) => x.id === q.id).title, "Edited by a teacher");
  });

  test("editing a passage keeps its underline on the same words, or drops it when they are gone", async () => {
    const q = stored((x) => mine(x) && x.underline && !x.updatedAt);
    const words = q.passage.slice(...q.underline);
    const put = (passage) => api(`/api/admin/practice/questions/${q.id}`, { method: "PUT", auth: adminToken, body: { ...q, passage } });
    const moved = (await put(`A new first sentence. ${q.passage}`)).data;
    assert.equal(moved.passage.slice(...moved.underline), words);
    assert.equal(moved.underline[0], q.underline[0] + "A new first sentence. ".length);
    const gone = (await put("A passage with none of the old words.")).data;
    assert.equal(gone.underline, undefined);
    assert.equal(stored((x) => x.id === q.id).underline, null, "and it stays gone after a reload");
  });

  test("a deleted question isn't brought back at the next start", async () => {
    const q = stored((x) => mine(x) && x.section === "Reading & Writing" && !x.updatedAt);
    assert.equal((await api(`/api/admin/practice/questions/${q.id}`, { method: "DELETE", auth: adminToken })).status, 200);
    const { syncStarterQuestions } = await import("./app.js");
    updateDB((db) => void syncStarterQuestions(db));
    assert.equal(stored((x) => x.key === q.key), undefined);
  });
});

describe("what a student gets", () => {
  test("a passage's underlined part comes with the question; the answer doesn't", async () => {
    const under = stored((x) => mine(x) && x.underline && !x.updatedAt);
    const list = (await api(`/api/practice/questions?sec=rw&skills=${encodeURIComponent(under.topic)}&difficulty=${under.difficulty}&limit=200`)).data.questions;
    const a = list.find((x) => x.id === under.id);
    assert.deepEqual(a.underline, under.underline);
    assert.equal(a.passage.slice(...a.underline), under.passage.slice(...under.underline));
    for (const k of ["correctIndex", "rationales", "explanation", "source", "explanationImage"]) assert.equal(k in a, false, k);
  });

  test("Nova doesn't hand over an answer she was only asked to explain", async () => {
    const text = stored((x) => mine(x) && x.section === "Reading & Writing" && x.rationales && !x.updatedAt);
    const steps = await ask({ questionId: text.id, messages: [{ role: "user", content: "Explain this step by step" }], intent: "steps" });
    assert.match(steps.text, /Explanation/);
    assert.ok(!steps.text.includes(text.explanation.slice(0, 60)), "the written explanation names the answer, so it isn't given before the student has answered");
    assert.ok(!steps.done.reveals);
  });

  test("the Daily Star still says where a picture or an underline would be", async () => {
    const daily = (await api("/api/daily")).data;
    assert.ok("promptImage" in daily.question && "image" in daily.question && "underline" in daily.question);
    assert.equal(daily.question.promptImage ?? null, null);
  });
});

describe("what a teacher gets", () => {
  test("the bank list says where a question came from, and none came from the pack", async () => {
    const all = (await api("/api/admin/practice/questions", { auth: adminToken })).data.questions;
    assert.equal(all.filter((q) => q.source === "college-board").length, 0);
    assert.ok(all.filter((q) => q.source === "northstar-bank").length >= ORIGINALS.length - 2);
    assert.ok(all.filter((q) => !q.source).length >= 251);
  });
});
