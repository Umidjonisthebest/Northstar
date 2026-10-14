import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

// Throwaway DB, and no AI key: Nova must answer from the built-in tutor.
const dbPath = path.join(os.tmpdir(), `northstar-practice-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_AUTH_TOKEN = "";

let server;
let base;
let token;
let adminToken;
let db;
let XP;

before(async () => {
  const { updateDB, readDB } = await import("./db.js");
  ({ XP } = await import("./gamification.js"));
  const bcrypt = (await import("bcryptjs")).default;
  updateDB((d) => {
    d.users.push({ id: "admin-1", role: "admin", firstName: "Test", lastName: "Admin", email: "admin@test.local", passwordHash: bcrypt.hashSync("adminpass123", 10) });
  });
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  db = readDB;
  const reg = await api("/api/student/register", { method: "POST", body: { firstName: "Ada", lastName: "L", email: "ada-practice@test.local", password: "password1" } });
  token = reg.data.token;
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

// Reads a Nova reply: returns { source, text, done }.
async function ask(body) {
  const res = await fetch(`${base}/api/practice/tutor`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/event-stream/);
  const raw = await res.text();
  const out = { source: null, text: "", done: null };
  for (const block of raw.split("\n\n")) {
    const ev = block.match(/^event: (\w+)/)?.[1];
    const data = block.match(/data: (.*)$/m)?.[1];
    if (!ev || !data) continue;
    const d = JSON.parse(data);
    if (ev === "meta") out.source = d.source;
    if (ev === "delta") out.text += d.text;
    if (ev === "done") out.done = d;
  }
  return out;
}

const findQ = (pred) => db().practiceQuestions.find(pred);

describe("question bank", () => {
  test("the bank lists both sections with the full starter set", async () => {
    const { status, data } = await api("/api/practice/bank");
    assert.equal(status, 200);
    assert.deepEqual(data.sections.map((s) => s.key), ["rw", "math"]);
    assert.ok(data.sections.every((s) => s.total >= 50));
    assert.equal(data.trend.length, 12);
  });

  test("the skills table groups the official skills by domain", async () => {
    const { data } = await api("/api/practice/bank/rw/skills?difficulty=Hard");
    assert.equal(data.domains.length, 4);
    const craft = data.domains.find((d) => d.domain === "Craft and Structure");
    assert.deepEqual(craft.skills.map((s) => s.skill), ["Words in Context", "Text Structure and Purpose", "Cross-Text Connections"]);
    const all = data.domains.flatMap((d) => d.skills);
    assert.ok(all.every((s) => s.total >= 0 && s.answered === 0 && s.accuracy === null));
    assert.equal(data.matching, data.total);
  });

  test("skill names with commas filter correctly (skills are |-separated)", async () => {
    const one = await api(`/api/practice/questions?skills=${encodeURIComponent("Ratios, rates, and units")}`);
    assert.ok(one.data.questions.length >= 5);
    assert.ok(one.data.questions.every((q) => q.topic === "Ratios, rates, and units"));
    const two = await api(`/api/practice/questions?skills=${encodeURIComponent("Ratios, rates, and units|Form, Structure, and Sense")}`);
    assert.deepEqual([...new Set(two.data.questions.map((q) => q.topic))].sort(), ["Form, Structure, and Sense", "Ratios, rates, and units"]);
    const drill = await api("/api/practice/drill", { method: "POST", body: { topic: "Form, Structure, and Sense", size: 3 } });
    assert.equal(drill.data.questions.length, 3);
    assert.ok(drill.data.questions.every((q) => q.topic === "Form, Structure, and Sense"));
  });

  test("questions come with their passage but never their answers", async () => {
    const { data } = await api("/api/practice/questions?sec=rw&skills=Cross-Text%20Connections");
    assert.ok(data.questions.length >= 5);
    for (const q of data.questions) {
      assert.ok(q.passage.includes("Text 1"));
      for (const k of ["correctIndex", "rationales", "steps", "keyQuote"]) assert.equal(k in q, false);
    }
  });
});

describe("practice player", () => {
  test("opening the explanation first makes the next correct answer assisted", async () => {
    const q = findQ((x) => x.key === "rw-tr-02");
    const ex = await api(`/api/practice/questions/${q.id}/explanation`);
    assert.equal(ex.data.correctIndex, q.correctIndex);
    assert.equal(ex.data.steps.length, 3);
    const r = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: q.correctIndex, timeMs: 42000 } });
    assert.equal(r.data.correct, true);
    assert.equal(r.data.assisted, true);
    assert.equal(r.data.xpKind, "assisted");
    assert.equal(r.data.reward.xpGained, Math.ceil(XP.question[q.difficulty] * XP.assistedShare));
  });

  test("XP follows difficulty, and a solved question can't be farmed", async () => {
    const hard = findQ((x) => x.key === "rw-wic-02");
    const easy = findQ((x) => x.key === "rw-tr-06");
    assert.deepEqual([hard.difficulty, easy.difficulty], ["Hard", "Easy"]);
    const post = (q) => api(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: q.correctIndex } });
    const first = await post(hard);
    assert.equal(first.data.xpKind, "solve");
    assert.equal(first.data.reward.xpGained, XP.question.Hard);
    assert.equal((await post(easy)).data.reward.xpGained, XP.question.Easy);

    const before = (await api("/api/practice/progress")).data.xp;
    const repeat = await post(hard);
    assert.equal(repeat.data.xpKind, "review");
    assert.equal(repeat.data.reward.xpGained, XP.review);
    for (let i = 0; i < 6; i++) assert.equal((await post(hard)).data.reward.xpGained, 0);
    assert.equal((await api("/api/practice/progress")).data.xp, before + XP.review);
  });

  test("a drill bonus comes from graded answers, not from what the client claims", async () => {
    const start = (await api("/api/practice/progress")).data.xp;
    // Nothing answered: claiming a perfect drill earns nothing.
    await api("/api/practice/drill", { method: "POST", body: { section: "math", size: 5 } });
    const forged = await api("/api/practice/drill/complete", { method: "POST", body: { total: 5, correct: 5 } });
    assert.equal(forged.data.reward, null);
    assert.equal((await api("/api/practice/progress")).data.xp, start);

    // A real one: five unsolved Math questions, all right on the first try.
    const drill = (await api("/api/practice/drill", { method: "POST", body: { section: "math", size: 5 } })).data.questions;
    assert.equal(drill.length, 5);
    for (const dq of drill) {
      const full = findQ((x) => x.id === dq.id);
      const answer = full.type === "grid_in" ? full.correctAnswer : full.correctIndex;
      assert.equal((await api(`/api/practice/questions/${dq.id}/answer`, { method: "POST", body: { answer, inDrill: true } })).data.correct, true);
    }
    const done = await api("/api/practice/drill/complete", { method: "POST" });
    assert.deepEqual([done.data.total, done.data.correct], [5, 5]);
    assert.equal(done.data.reward.xpGained, XP.drillComplete + XP.drillPerfect);
    assert.ok(done.data.reward.newBadges.some((b) => b.id === "perfect_drill"));
    // Claiming it again does nothing.
    assert.equal((await api("/api/practice/drill/complete", { method: "POST" })).data.reward, null);
  });

  test("flashcards pay once, and no route marks a plan task done", async () => {
    const word = db().vocab[0];
    const rate = () => api(`/api/practice/vocab/${word.id}/rate`, { method: "POST", body: { rating: "good" } });
    assert.equal((await rate()).data.reward.xpGained, XP.vocab);
    assert.equal((await rate()).data.reward.xpGained, 0);

    // Plan tasks finish from graded work only (weekPlan.test.js); the tick routes are gone.
    for (const route of ["toggle", "complete"]) assert.equal((await api(`/api/practice/plan/0/${route}`, { method: "POST" })).status, 404);
  });

  test("the progress payload carries the XP rules for the pages that show them", async () => {
    const { data } = await api("/api/practice/progress");
    assert.deepEqual(data.xpRules.question, XP.question);
    assert.ok(data.xpGuide.length >= 6);
  });

  test("a retry after a wrong answer is graded but stays in the mistakes queue", async () => {
    const q = findQ((x) => x.key === "rw-tr-03");
    const wrong = (q.correctIndex + 1) % 4;
    const first = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: wrong } });
    assert.equal(first.data.correct, false);
    assert.equal(first.data.saved, true);
    assert.ok(first.data.rationale.length > 10);
    const second = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: q.correctIndex, retry: true } });
    assert.equal(second.data.correct, true);
    assert.equal(second.data.saved, true);
    assert.equal(second.data.result, "corrected");
  });

  test("grid-in answers accept equivalent forms", async () => {
    const q = findQ((x) => x.type === "grid_in" && /^-?\d+$/.test(x.correctAnswer));
    const v = Number(q.correctAnswer);
    const r = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: `${v * 2}/2` } });
    assert.equal(r.data.correct, true);
  });

  test("notes save and clear; reports reach the admin", async () => {
    const q = findQ((x) => x.key === "rw-bnd-03");
    assert.equal((await api(`/api/practice/questions/${q.id}/note`, { method: "POST", body: { text: "semicolon = period" } })).data.note, "semicolon = period");
    const list = await api("/api/practice/questions?sec=rw&skills=Boundaries");
    assert.equal(list.data.questions.find((x) => x.id === q.id).note, "semicolon = period");
    assert.equal((await api(`/api/practice/questions/${q.id}/note`, { method: "POST", body: { text: "" } })).data.note, "");

    await api(`/api/practice/questions/${q.id}/report`, { method: "POST", body: { reason: "typo", comment: "double space" } });
    const reports = await api("/api/admin/practice/reports", { auth: adminToken });
    const mine = reports.data.reports.find((r) => r.questionId === q.id);
    assert.equal(mine.reason, "typo");
    assert.equal(mine.student, "Ada L");
  });

  test("a math remix is a fresh generated question that grades correctly", async () => {
    const q = findQ((x) => x.key === "m-percentages-3");
    const remix = await api("/api/practice/remix", { method: "POST", body: { questionId: q.id } });
    assert.equal(remix.data.kind, "generated");
    const rq = remix.data.question;
    assert.match(rq.id, /^rmx\./);
    assert.equal(rq.topic, "Percentages");
    assert.equal("correctIndex" in rq, false);
    const ex = await api(`/api/practice/remix/${rq.id}/explanation`);
    const graded = await api(`/api/practice/remix/${rq.id}/answer`, { method: "POST", body: { answer: ex.data.correctIndex } });
    assert.equal(graded.data.correct, true);
  });

  test("an R&W remix is a different question on the same skill", async () => {
    const q = findQ((x) => x.key === "rw-wic-03");
    const remix = await api("/api/practice/remix", { method: "POST", body: { questionId: q.id } });
    assert.equal(remix.data.kind, "similar");
    assert.equal(remix.data.question.topic, "Words in Context");
    assert.notEqual(remix.data.question.id, q.id);
  });

  test("study sessions and analytics reflect the answers above", async () => {
    const s = await api("/api/practice/sessions");
    assert.equal(s.data.sessions.length, 1);
    assert.ok(s.data.sessions[0].count >= 4);
    const a = await api("/api/practice/analytics");
    assert.ok(a.data.stats.attempts >= 4);
    assert.ok(a.data.trend.at(-1).correct.Medium + a.data.trend.at(-1).correct.Hard + a.data.trend.at(-1).correct.Easy >= 3);
  });
});

describe("Nova (built-in tutor)", () => {
  test("highlights the key evidence of an R&W question", async () => {
    const q = findQ((x) => x.key === "rw-ctc-01");
    const r = await ask({ questionId: q.id, messages: [{ role: "user", content: "Highlight the key part of the passage" }], intent: "highlight" });
    assert.equal(r.source, "built-in");
    assert.ok(q.passage.includes(r.done.highlight));
    assert.ok(r.text.length > 20);
  });

  test("won't give the answer on the first ask, will on the second", async () => {
    const q = findQ((x) => x.key === "rw-cid-04");
    const first = await ask({ questionId: q.id, messages: [{ role: "user", content: "Just tell me the answer" }] });
    assert.doesNotMatch(first.text, /The answer is/);
    assert.equal(first.done.tutor.askedAnswer, true);
    const second = await ask({ questionId: q.id, tutor: first.done.tutor, messages: [{ role: "user", content: "Just tell me the answer" }] });
    assert.match(second.text, new RegExp(`The answer is \\*\\*${"ABCD"[q.correctIndex]}\\*\\*`));
  });

  test("walks through steps and pauses before the final one", async () => {
    const q = findQ((x) => x.key === "rw-inf-05");
    let tutor = {};
    const step1 = await ask({ questionId: q.id, messages: [{ role: "user", content: "Explain this step by step" }], intent: "steps" });
    assert.match(step1.text, /Step 1/);
    tutor = step1.done.tutor;
    const step2 = await ask({ questionId: q.id, tutor, messages: [{ role: "user", content: "next" }] });
    assert.match(step2.text, /Step 2/);
    const gate = await ask({ questionId: q.id, tutor: step2.done.tutor, messages: [{ role: "user", content: "next" }] });
    assert.match(gate.text, /before I finish/);
    const last = await ask({ questionId: q.id, tutor: gate.done.tutor, messages: [{ role: "user", content: "next" }] });
    assert.match(last.text, /Step 3/);
  });

  test("the Ask Nova page gives a skill strategy with a practice action", async () => {
    const r = await ask({ messages: [{ role: "user", content: "How do I get better at comma splices?" }] });
    assert.match(r.text, /Boundaries/);
    assert.deepEqual(r.done.action, { type: "practice", skill: "Boundaries" });
  });
});

describe("admin editing", () => {
  test("an edit that omits the explanation fields keeps them", async () => {
    const q = findQ((x) => x.key === "rw-wic-05");
    const body = { type: "mcq", section: q.section, domain: q.domain, topic: q.topic, difficulty: q.difficulty, title: "Not a word wasted (edited)", prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation };
    const res = await api(`/api/admin/practice/questions/${q.id}`, { method: "PUT", auth: adminToken, body });
    assert.equal(res.status, 200);
    const after = findQ((x) => x.id === q.id);
    assert.equal(after.title, "Not a word wasted (edited)");
    assert.equal(after.steps.length, 3);
    assert.equal(after.rationales.length, 4);
    assert.equal(after.passage, q.passage);
    assert.ok(after.updatedAt);
  });

  test("new explanation fields save, and key evidence must come from the passage", async () => {
    const base = { type: "mcq", section: "Reading & Writing", domain: "Expression of Ideas", topic: "Transitions", difficulty: "Easy", prompt: TRANSITION_PROMPT, options: ["However,", "Therefore,"], correctIndex: 0 };
    const bad = await api("/api/admin/practice/questions", { method: "POST", auth: adminToken, body: { ...base, passage: "It rained. ______ we went out.", keyQuote: "not in the passage" } });
    assert.equal(bad.status, 400);
    const ok = await api("/api/admin/practice/questions", {
      method: "POST",
      auth: adminToken,
      body: { ...base, passage: "It rained. ______ we went out.", keyQuote: "It rained.", hint: "Contrast?", rationales: ["Right: contrast.", "No cause here."], steps: [{ title: "Relationship", body: "Contrast." }, { title: "", body: "" }] }
    });
    assert.equal(ok.status, 201);
    assert.deepEqual(ok.data.rationales, ["Right: contrast.", "No cause here."]);
    assert.equal(ok.data.steps.length, 1);
    assert.equal(ok.data.hint, "Contrast?");
  });
});

const TRANSITION_PROMPT = "Which choice completes the text with the most logical transition?";

describe("starter upgrade", () => {
  test("a legacy starter question is upgraded in place and keeps its id", async () => {
    const { syncStarterQuestions } = await import("./app.js");
    const legacy = { id: "old-1", section: "Math", topic: "Percentages", domain: "Problem-Solving and Data Analysis", difficulty: "Medium", title: "A table with a hidden rate", prompt: "old", options: ["20%", "25%", "80%", "125%"], correctIndex: 1, explanation: "old", createdAt: "2026-09-22T12:31:49.197Z" };
    const custom = { id: "admin-1", section: "Reading & Writing", topic: "Pronouns", domain: "Standard English Conventions", difficulty: "Easy", title: "Mine", prompt: "x", options: ["a", "b"], correctIndex: 0 };
    const fake = { practiceQuestions: [legacy, custom] };
    syncStarterQuestions(fake);
    const up = fake.practiceQuestions.find((q) => q.id === "old-1");
    assert.equal(up.key, "mc-03");
    assert.equal(up.title, "Percent increase on a price");
    assert.equal(up.steps.length, 3);
    assert.equal(fake.practiceQuestions.find((q) => q.id === "admin-1").topic, "Form, Structure, and Sense");
    assert.equal(fake.practiceQuestions.filter((q) => q.key === "mc-03").length, 1);
    assert.ok(fake.practiceQuestions.length > 150);
  });
});

describe("the Challenging tier", () => {
  test("the bank filters on it, sorts it after Hard, and never sends its answers", async () => {
    const { data } = await api("/api/practice/questions?difficulty=Challenging");
    assert.ok(data.questions.every((q) => q.difficulty === "Challenging" && !("correctIndex" in q) && !("correctAnswer" in q)));
    // The owner's 65 originals (the question pack may add its own Challenging items on top).
    const originals = data.questions.filter((q) => findQ((x) => x.id === q.id).key.startsWith("ns-"));
    assert.equal(originals.length, 65);
    assert.equal(originals.filter((q) => q.section === "Math").length, 45);
    assert.equal(originals.filter((q) => q.type === "grid_in").length, 19);
    const skill = (await api("/api/practice/questions?sec=math&skills=Circles&order=easy")).data.questions.map((q) => q.difficulty);
    assert.equal(skill.at(-1), "Challenging");
    assert.ok(skill.indexOf("Challenging") > skill.lastIndexOf("Hard"));
    const table = (await api("/api/practice/bank/rw/skills?difficulty=Challenging")).data;
    // Two per skill from the first set of originals; the owner's own question bank adds more.
    assert.ok(table.domains.flatMap((d) => d.skills).every((s) => s.total >= 2));
  });

  test("a Challenging answer pays the most XP, counts as hard in the weekly chart, and has its own analytics row", async () => {
    // Earlier tests answer questions picked at random, so take two this student hasn't met yet.
    const fresh = (await api("/api/practice/questions?difficulty=Challenging&type=grid_in&status=unanswered")).data.questions.map((x) => findQ((y) => y.id === x.id));
    assert.ok(fresh.length >= 2);
    const [q, other] = fresh;
    const bank = async () => (await api("/api/practice/bank")).data.trend.at(-1);
    const rows = async () => (await api("/api/practice/analytics")).data.byDifficulty;
    const [weekBefore, rowsBefore] = [await bank(), await rows()];
    const wrong = await api(`/api/practice/questions/${other.id}/answer`, { method: "POST", body: { answer: "-999" } });
    assert.equal(wrong.data.correct, false);
    const r = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: q.correctAnswer } });
    assert.equal(r.data.correct, true);
    assert.equal(r.data.xpKind, "solve");
    assert.ok(r.data.reward.xpGained >= XP.question.Challenging);
    assert.ok(XP.question.Challenging > XP.question.Hard);
    const week = await bank();
    assert.equal(week.correct.Hard, weekBefore.correct.Hard + 1);
    assert.equal(week.wrong.Hard, weekBefore.wrong.Hard + 1);
    assert.deepEqual(Object.keys(week.correct), ["Easy", "Medium", "Hard"]);
    const after = await rows();
    assert.deepEqual(Object.keys(after), ["Easy", "Medium", "Hard", "Challenging"]);
    assert.deepEqual(after.Challenging, { attempts: rowsBefore.Challenging.attempts + 2, correct: rowsBefore.Challenging.correct + 1 });
  });

  test("its explanation has steps and a hint, and a Math remix comes back as a Hard variant", async () => {
    const q = findQ((x) => x.key === "ns-m-044");
    const ex = (await api(`/api/practice/questions/${q.id}/explanation`)).data;
    assert.equal(ex.correctIndex, 2);
    assert.equal(ex.rationales.length, 4);
    assert.ok(ex.steps.length >= 2 && ex.hint);
    const remix = await api("/api/practice/remix", { method: "POST", body: { questionId: q.id } });
    assert.equal(remix.status, 200);
    assert.equal(remix.data.kind, "generated");
    assert.equal(remix.data.question.difficulty, "Hard");
    assert.equal(remix.data.question.topic, "Circles");
    const similar = await api("/api/practice/remix", { method: "POST", body: { questionId: findQ((x) => x.key === "ns-e-015").id } });
    assert.equal(similar.data.question.topic, "Transitions");
  });

  test("a teacher can rate a question Challenging, and an edit keeps the rating", async () => {
    const made = await api("/api/admin/practice/questions", {
      method: "POST",
      auth: adminToken,
      body: { type: "grid_in", section: "Math", domain: "Algebra", topic: "Linear functions", difficulty: "Challenging", prompt: "What is 6 x 7?", correctAnswer: "42" }
    });
    assert.equal(made.status, 201);
    assert.equal(made.data.difficulty, "Challenging");
    const q = findQ((x) => x.key === "ns-e-019");
    const edited = await api(`/api/admin/practice/questions/${q.id}`, { method: "PUT", auth: adminToken, body: { ...q, title: "One collection" } });
    assert.equal(edited.data.difficulty, "Challenging");
    assert.equal((await api("/api/admin/practice/questions", { method: "POST", auth: adminToken, body: { ...made.data, difficulty: "Impossible" } })).data.difficulty, "Medium");
  });
});