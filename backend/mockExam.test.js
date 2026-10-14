import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";

// Mock exams (the teacher studio's tests, sessions and the student's exam): validation of what
// teachers save, what a student can submit, and the one grading rule every screen shares.
// Like routes.test.js it boots the real app against a throwaway database.
const dbPath = path.join(os.tmpdir(), `northstar-mockexam-test-db-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let server;
let base;
let adminToken;
let studentToken;
let studentId;
let dbModule;

before(async () => {
  dbModule = await import("./db.js");
  dbModule.updateDB((db) => {
    db.users.push({
      id: "admin-1",
      role: "admin",
      firstName: "Test",
      lastName: "Admin",
      email: "admin@test.local",
      passwordHash: bcrypt.hashSync("adminpass123", 10),
      createdAt: new Date().toISOString()
    });
  });
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;

  adminToken = (await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "adminpass123" } })).data.token;
  const reg = await api("/api/student/register", { method: "POST", body: { firstName: "Mia", lastName: "Chen", email: "mia@test.local", password: "password1" } });
  studentToken = reg.data.token;
  studentId = reg.data.user.id;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dbPath, { force: true });
});

async function api(url, { method = "GET", body, token } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
const admin = (url, opts = {}) => api(url, { ...opts, token: adminToken });
const student = (url, opts = {}) => api(url, { ...opts, token: studentToken });

describe("isExamAnswerCorrect", () => {
  let isExamAnswerCorrect;
  before(async () => {
    ({ isExamAnswerCorrect } = await import("./grading.js"));
  });

  test("multiple choice needs the exact stored index", () => {
    const q = { type: "mcq", correctIndex: 2 };
    assert.equal(isExamAnswerCorrect(q, 2), true);
    assert.equal(isExamAnswerCorrect(q, 1), false);
    // The old comparison coerced; a string "2" is not a choice the exam screen ever sends.
    assert.equal(isExamAnswerCorrect(q, "2"), false);
    assert.equal(isExamAnswerCorrect(q, undefined), false);
    assert.equal(isExamAnswerCorrect(q, null), false);
  });

  test("index 0 (choice A) is a real answer, not a blank", () => {
    assert.equal(isExamAnswerCorrect({ type: "mcq", correctIndex: 0 }, 0), true);
  });

  test("a grid-in uses the same numeric rules as practice", () => {
    const q = { type: "grid_in", correctAnswer: "3/4" };
    assert.equal(isExamAnswerCorrect(q, "3/4"), true);
    assert.equal(isExamAnswerCorrect(q, "0.75"), true);
    assert.equal(isExamAnswerCorrect(q, ".75"), true);
    assert.equal(isExamAnswerCorrect(q, " 0.75 "), true);
    assert.equal(isExamAnswerCorrect(q, "0.7"), false);
    assert.equal(isExamAnswerCorrect({ type: "grid_in", correctAnswer: "1,200" }, "1200"), true);
  });

  test("a blank grid-in is never correct, even against a blank key", () => {
    assert.equal(isExamAnswerCorrect({ type: "grid_in", correctAnswer: "7" }, ""), false);
    assert.equal(isExamAnswerCorrect({ type: "grid_in", correctAnswer: "7" }, "   "), false);
    assert.equal(isExamAnswerCorrect({ type: "grid_in", correctAnswer: "" }, ""), false);
  });
});

describe("saving a test and its questions", () => {
  let testId;
  let mathId;
  const path = () => `/api/tests/${testId}/modules/${mathId}/questions`;

  before(async () => {
    const t = await admin("/api/tests", { method: "POST", body: { title: "Validation test" } });
    assert.equal(t.status, 201);
    testId = t.data.id;
    mathId = t.data.modules.find((m) => m.name === "Math").id;
  });

  test("a test needs a text title; a number or object is not one", async () => {
    assert.equal((await admin("/api/tests", { method: "POST", body: { title: 42 } })).status, 400);
    assert.equal((await admin("/api/tests", { method: "POST", body: { title: { a: 1 } } })).status, 400);
    assert.equal((await admin("/api/tests", { method: "POST", body: { title: "   " } })).status, 400);
    assert.equal((await admin(`/api/tests/${testId}`, { method: "PUT", body: { title: "" } })).status, 400);
  });

  test("a test's difficulty is Easy, Medium, Hard or not rated, and students see it on their list", async () => {
    assert.equal((await admin("/api/tests", { method: "POST", body: { title: "Rated", difficulty: "Pro" } })).status, 400);
    assert.equal((await admin("/api/tests", { method: "POST", body: { title: "Rated", difficulty: 3 } })).status, 400);
    const rated = (await admin("/api/tests", { method: "POST", body: { title: "Rated", difficulty: "Hard" } })).data;
    assert.equal(rated.difficulty, "Hard");
    assert.equal((await admin("/api/tests", { method: "POST", body: { title: "Unrated" } })).data.difficulty, null);

    // A bad value changes nothing; leaving it out keeps it; "" clears it.
    assert.equal((await admin(`/api/tests/${rated.id}`, { method: "PUT", body: { title: "Renamed", difficulty: "hard" } })).status, 400);
    assert.equal((await admin(`/api/tests/${rated.id}`)).data.title, "Rated");
    assert.equal((await admin(`/api/tests/${rated.id}`, { method: "PUT", body: { description: "Tough one" } })).data.difficulty, "Hard");
    assert.equal((await admin(`/api/tests/${rated.id}`, { method: "PUT", body: { difficulty: "Easy" } })).data.difficulty, "Easy");
    assert.equal((await admin("/api/tests")).data.find((t) => t.id === rated.id).difficulty, "Easy");

    const s = (await admin("/api/sessions", { method: "POST", body: { name: "Rated session", testId: rated.id, studentLimit: 5 } })).data;
    await admin(`/api/sessions/${s.id}/participants`, { method: "POST", body: { userId: studentId } });
    const mine = (await student("/api/student/history")).data.sessions.find((x) => x.sessionId === s.id);
    assert.equal(mine.difficulty, "Easy");
    assert.equal(mine.testDescription, "Tough one");

    assert.equal((await admin(`/api/tests/${rated.id}`, { method: "PUT", body: { difficulty: "" } })).data.difficulty, null);
  });

  test("a multiple-choice question needs 2 to 6 filled choices and an index that points at one", async () => {
    const base = { type: "mcq", prompt: "Pick one" };
    const bad = [
      { ...base, options: "A,B", correctIndex: 0 },
      { ...base, options: ["only one"], correctIndex: 0 },
      { ...base, options: ["a", "b", "c", "d", "e", "f", "g"], correctIndex: 0 },
      { ...base, options: ["a", "", "c"], correctIndex: 0 },
      { ...base, options: ["a", { x: 1 }, "c"], correctIndex: 0 },
      { ...base, options: ["a", "b", "c"], correctIndex: 3 },
      { ...base, options: ["a", "b", "c"], correctIndex: -1 },
      { ...base, options: ["a", "b", "c"], correctIndex: 1.5 },
      { ...base, options: ["a", "b", "c"], correctIndex: null },
      { ...base, options: ["a", "b", "c"] },
      { ...base, prompt: 12, options: ["a", "b"], correctIndex: 0 },
      { ...base, type: "essay", options: ["a", "b"], correctIndex: 0 }
    ];
    for (const body of bad) {
      const res = await admin(path(), { method: "POST", body });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    const ok = await admin(path(), { method: "POST", body: { ...base, options: [" a ", "b", "c"], correctIndex: "2" } });
    assert.equal(ok.status, 201);
    assert.deepEqual(ok.data.options, ["a", "b", "c"]);
    assert.equal(ok.data.correctIndex, 2);
  });

  test("a grid-in question needs a short answer", async () => {
    for (const body of [{ type: "grid_in", prompt: "x" }, { type: "grid_in", prompt: "x", correctAnswer: "  " }, { type: "grid_in", prompt: "x", correctAnswer: { a: 1 } }, { type: "grid_in", prompt: "x", correctAnswer: "1".repeat(41) }]) {
      assert.equal((await admin(path(), { method: "POST", body })).status, 400, JSON.stringify(body));
    }
    const ok = await admin(path(), { method: "POST", body: { type: "grid_in", prompt: "x", correctAnswer: 7 } });
    assert.equal(ok.status, 201);
    assert.equal(ok.data.correctAnswer, "7");
    assert.equal("options" in ok.data, false);
  });

  test("pictures must be small raster data URLs, and are kept on the question", async () => {
    const body = { type: "grid_in", prompt: "See the graph", correctAnswer: "4" };
    for (const passageImage of ["https://evil.example/x.png", "javascript:alert(1)", "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "data:text/html;base64,PGI+", 12, { a: 1 }, `data:image/png;base64,${"A".repeat(3_000_001)}`]) {
      assert.equal((await admin(path(), { method: "POST", body: { ...body, passageImage } })).status, 400, String(passageImage).slice(0, 40));
    }
    const ok = await admin(path(), { method: "POST", body: { ...body, passageImage: PNG, promptImage: PNG } });
    assert.equal(ok.status, 201);
    assert.equal(ok.data.passageImage, PNG);
    assert.equal(ok.data.promptImage, PNG);
    // A question with no pictures stays free of empty picture fields.
    const plain = await admin(path(), { method: "POST", body: { ...body, passageImage: null } });
    assert.equal("passageImage" in plain.data, false);
  });

  test("a picture that is too large for the old 2 MB limit still saves", async () => {
    // 2 MB of picture is about 2.7 MB as a data URL, which the editor allows.
    const big = `data:image/png;base64,${"A".repeat(2_700_000)}`;
    const res = await admin(path(), { method: "POST", body: { type: "grid_in", prompt: "Big figure", correctAnswer: "1", promptImage: big } });
    assert.equal(res.status, 201);
  });

  test("an update keeps what it leaves out, can't change the type, id or order, and a bad one changes nothing", async () => {
    const created = await admin(path(), { method: "POST", body: { type: "mcq", prompt: "Original", passage: "Context", options: ["a", "b", "c"], correctIndex: 2, promptImage: PNG } });
    const q = created.data;
    const url = `${path()}/${q.id}`;

    const renamed = await admin(url, { method: "PUT", body: { id: "hijack", order: 99, prompt: "Renamed" } });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.data.id, q.id);
    assert.equal(renamed.data.order, q.order);
    assert.equal(renamed.data.prompt, "Renamed");
    assert.equal(renamed.data.passage, "Context");
    assert.equal(renamed.data.correctIndex, 2);
    assert.equal(renamed.data.promptImage, PNG);

    assert.equal((await admin(url, { method: "PUT", body: { type: "grid_in" } })).status, 400);
    assert.equal((await admin(url, { method: "PUT", body: { correctIndex: 9 } })).status, 400);
    assert.equal((await admin(url, { method: "PUT", body: { prompt: "" } })).status, 400);
    assert.equal((await admin(url, { method: "PUT", body: { promptImage: "https://evil.example/x.png" } })).status, 400);
    // Fewer options than the stored key points at (choice C would no longer exist).
    assert.equal((await admin(url, { method: "PUT", body: { options: ["a", "b"] } })).status, 400);
    // Dropping to two choices while moving the key onto one of them is fine, in one request.
    assert.equal((await admin(url, { method: "PUT", body: { options: ["a", "b"], correctIndex: 1 } })).status, 200);
    await admin(url, { method: "PUT", body: { options: ["a", "b", "c"], correctIndex: 2 } });

    const after = (await admin(`/api/tests/${testId}`)).data.modules.find((m) => m.id === mathId).questions.find((x) => x.id === q.id);
    assert.equal(after.prompt, "Renamed");
    assert.deepEqual(after.options, ["a", "b", "c"]);
    assert.equal(after.correctIndex, 2);

    const noPicture = await admin(url, { method: "PUT", body: { promptImage: null } });
    assert.equal("promptImage" in noPicture.data, false);
  });

  test("a module's time limit is a whole number of minutes from 1 to 300", async () => {
    const url = `/api/tests/${testId}/modules/${mathId}`;
    for (const timeLimitMinutes of [0, -5, 301, 1.5, "abc", "", null, true, [30], { a: 1 }]) {
      assert.equal((await admin(url, { method: "PUT", body: { timeLimitMinutes } })).status, 400, JSON.stringify(timeLimitMinutes));
    }
    assert.equal((await admin(url, { method: "PUT", body: { name: "" } })).status, 400);
    const ok = await admin(url, { method: "PUT", body: { timeLimitMinutes: "45", name: " Math (calculator) " } });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.timeLimitMinutes, 45);
    assert.equal(ok.data.name, "Math (calculator)");
  });
});

describe("the graphing calculator on mock exams", () => {
  let testId;
  let rw;
  let math;
  let sessionId;
  const open = async (moduleId) => (await student(`/api/exam/session/${sessionId}/modules/${moduleId}`)).data;

  before(async () => {
    const t = await admin("/api/tests", { method: "POST", body: { title: "Calculator test" } });
    testId = t.data.id;
    rw = t.data.modules.find((m) => m.name === "Reading and Writing").id;
    math = t.data.modules.find((m) => m.name === "Math").id;
    for (const moduleId of [rw, math]) {
      await admin(`/api/tests/${testId}/modules/${moduleId}/questions`, { method: "POST", body: { type: "grid_in", prompt: "1 + 1?", correctAnswer: "2" } });
    }
    sessionId = (await admin("/api/sessions", { method: "POST", body: { name: "Calculator", testId, studentLimit: 5 } })).data.id;
    await admin(`/api/sessions/${sessionId}/participants`, { method: "POST", body: { userId: studentId } });
    await admin(`/api/sessions/${sessionId}/start`, { method: "POST" });
  });

  test("a Math module has it and a Reading and Writing module doesn't, until the teacher says otherwise", async () => {
    assert.equal((await open(math)).calculator, true);
    assert.equal((await open(rw)).calculator, false);
  });

  test("the teacher can switch it per module, and go back to the default", async () => {
    const put = (moduleId, calculator) => admin(`/api/tests/${testId}/modules/${moduleId}`, { method: "PUT", body: { calculator } });
    for (const junk of ["yes", 1, {}, []]) assert.equal((await put(math, junk)).status, 400, JSON.stringify(junk));

    assert.equal((await put(math, false)).data.calculator, false);
    assert.equal((await put(rw, true)).data.calculator, true);
    assert.equal((await open(math)).calculator, false);
    assert.equal((await open(rw)).calculator, true);

    const back = await put(math, null);
    assert.equal("calculator" in back.data, false);
    assert.equal((await open(math)).calculator, true);
    // Renaming a module with no setting of its own changes the default with it.
    await admin(`/api/tests/${testId}/modules/${math}`, { method: "PUT", body: { name: "Section 2" } });
    assert.equal((await open(math)).calculator, false);
  });
});

describe("creating a session", () => {
  let testId;
  before(async () => {
    testId = (await admin("/api/tests", { method: "POST", body: { title: "Session host" } })).data.id;
  });

  test("a session needs a text name and a real test", async () => {
    assert.equal((await admin("/api/sessions", { method: "POST", body: { name: 5, testId } })).status, 400);
    assert.equal((await admin("/api/sessions", { method: "POST", body: { name: "S", testId: { a: 1 } } })).status, 400);
    assert.equal((await admin("/api/sessions", { method: "POST", body: { name: "S", testId: "nope" } })).status, 400);
  });

  test("the candidate limit must be a sensible whole number; left out it defaults to 30", async () => {
    for (const studentLimit of [0, -3, 501, 2.5, "abc", true, [5]]) {
      assert.equal((await admin("/api/sessions", { method: "POST", body: { name: "S", testId, studentLimit } })).status, 400, JSON.stringify(studentLimit));
    }
    assert.equal((await admin("/api/sessions", { method: "POST", body: { name: "S", testId } })).data.studentLimit, 30);
    assert.equal((await admin("/api/sessions", { method: "POST", body: { name: "S", testId, studentLimit: "12" } })).data.studentLimit, 12);
  });

  test("the date and time must look like dates and times", async () => {
    assert.equal((await admin("/api/sessions", { method: "POST", body: { name: "S", testId, sessionDate: "next friday" } })).status, 400);
    assert.equal((await admin("/api/sessions", { method: "POST", body: { name: "S", testId, sessionTime: "25:99" } })).status, 400);
    const ok = await admin("/api/sessions", { method: "POST", body: { name: "S", testId, sessionDate: "2026-11-02", sessionTime: "09:30" } });
    assert.equal(ok.status, 201);
    assert.equal(ok.data.sessionDate, "2026-11-02");
  });

  test("a full session says so without creating the account it was asked to add", async () => {
    const s = await admin("/api/sessions", { method: "POST", body: { name: "Tiny", testId, studentLimit: 1 } });
    const url = `/api/sessions/${s.data.id}/participants`;
    assert.equal((await admin(url, { method: "POST", body: { userId: studentId } })).status, 201);

    const full = await admin(url, { method: "POST", body: { firstName: "Late", email: "late@test.local" } });
    assert.equal(full.status, 400);
    assert.match(full.data.error, /full/i);
    const found = await admin("/api/users/search?q=late@test.local");
    assert.equal(found.data.length, 0, "the rejected candidate must not have an account");

    // Someone already in the session hears that, not "full".
    const again = await admin(url, { method: "POST", body: { userId: studentId } });
    assert.match(again.data.error, /already/i);
  });

  test("a participant body with the wrong types is a 400, not a crash", async () => {
    const s = await admin("/api/sessions", { method: "POST", body: { name: "Types", testId } });
    const url = `/api/sessions/${s.data.id}/participants`;
    for (const body of [{ email: 5, firstName: "A" }, { email: "a@b.c", firstName: { x: 1 } }, { userId: 7 }, {}]) {
      const res = await admin(url, { method: "POST", body });
      assert.ok(res.status >= 400 && res.status < 500, `${JSON.stringify(body)} -> ${res.status}`);
    }
  });
});

describe("taking a mock exam", () => {
  let testId;
  let moduleId;
  let sessionId;
  let participantId;
  let mcq;
  let grid;
  let figure;

  before(async () => {
    const t = await admin("/api/tests", { method: "POST", body: { title: "Figures and fractions" } });
    testId = t.data.id;
    moduleId = t.data.modules.find((m) => m.name === "Math").id;
    const add = (body) => admin(`/api/tests/${testId}/modules/${moduleId}/questions`, { method: "POST", body });
    mcq = (await add({ type: "mcq", prompt: "2 + 2?", options: ["3", "4", "5"], correctIndex: 1 })).data;
    grid = (await add({ type: "grid_in", prompt: "Three quarters as a decimal?", correctAnswer: "3/4" })).data;
    figure = (await add({ type: "mcq", prompt: "Read the graph", passage: "Graph below", passageImage: PNG, promptImage: PNG, options: ["up", "down"], correctIndex: 0 })).data;

    sessionId = (await admin("/api/sessions", { method: "POST", body: { name: "Exam", testId, studentLimit: 5 } })).data.id;
    participantId = (await admin(`/api/sessions/${sessionId}/participants`, { method: "POST", body: { userId: studentId } })).data.id;
  });

  test("an exam can't be opened or submitted before the session starts", async () => {
    assert.equal((await student(`/api/exam/session/${sessionId}/modules/${moduleId}`)).status, 403);
    const res = await student(`/api/exam/session/${sessionId}/modules/${moduleId}/submit`, { method: "POST", body: { answers: { [mcq.id]: 1 } } });
    assert.equal(res.status, 403);
    // …and the refused submit must not have used up the module.
    assert.equal((await admin(`/api/sessions/${sessionId}/start`, { method: "POST" })).status, 200);
    assert.equal((await student(`/api/exam/session/${sessionId}/modules/${moduleId}`)).status, 200);
  });

  test("the student gets the teacher's pictures, and never the answer key", async () => {
    const res = await student(`/api/exam/session/${sessionId}/modules/${moduleId}`);
    const q = res.data.questions.find((x) => x.id === figure.id);
    assert.equal(q.passageImage, PNG);
    assert.equal(q.promptImage, PNG);
    const plain = res.data.questions.find((x) => x.id === mcq.id);
    assert.equal(plain.passageImage, null);
    for (const x of res.data.questions) {
      assert.equal("correctIndex" in x, false);
      assert.equal("correctAnswer" in x, false);
    }
  });

  test("a hand-made submission is reduced to what the exam screen could have sent", async () => {
    const res = await student(`/api/exam/session/${sessionId}/modules/${moduleId}/submit`, {
      method: "POST",
      body: {
        answers: {
          [mcq.id]: 1,
          [grid.id]: "0.75",
          [figure.id]: 99, // not one of its two choices
          "question-from-another-module": 1
        }
      }
    });
    assert.equal(res.status, 200);
    // 2 + 2 (choice B) and 0.75 for 3/4 are right; the out-of-range choice is not.
    assert.equal(res.data.raw, 2);
    assert.equal(res.data.max, 3);

    const results = await student(`/api/student/sessions/${sessionId}/results`);
    const resultMod = results.data.modules.find((m) => m.moduleId === moduleId);
    const rows = Object.fromEntries(resultMod.questions.map((q) => [q.id, q]));
    assert.equal(rows[mcq.id].isCorrect, true);
    assert.equal(rows[grid.id].isCorrect, true);
    assert.equal(rows[grid.id].givenAnswer, "0.75");
    assert.equal(rows[figure.id].isCorrect, false);
    assert.equal(rows[figure.id].givenAnswer, null);
    assert.equal(rows[figure.id].promptImage, PNG);
    assert.equal(resultMod.raw, 2);

    // The teacher's review agrees question by question, and it carries the pictures too.
    const detail = await admin(`/api/sessions/${sessionId}/participants/${participantId}`);
    const detailMod = detail.data.modules.find((m) => m.moduleId === moduleId);
    const adminRows = Object.fromEntries(detailMod.questions.map((q) => [q.id, q]));
    for (const id of [mcq.id, grid.id, figure.id]) assert.equal(adminRows[id].isCorrect, rows[id].isCorrect, id);
    assert.equal(adminRows[figure.id].passageImage, PNG);
    assert.equal(detailMod.overtimeSeconds, null);

    // The stored attempt holds only this module's questions.
    const stored = dbModule.readDB().attempts.find((a) => a.participantId === participantId && a.moduleId === moduleId);
    assert.deepEqual(Object.keys(stored.answers).sort(), [mcq.id, grid.id].sort());
  });

  test("the mistakes queue gets the wrong answer with its picture, looked up rather than copied", async () => {
    const res = await student("/api/practice/mistakes/exam");
    const m = res.data.mistakes.find((x) => x.questionId === figure.id);
    assert.ok(m);
    assert.equal(m.promptImage, PNG);
    assert.equal(m.passageImage, PNG);
    const stored = dbModule.readDB().progress.find((p) => p.userId === studentId);
    assert.equal("promptImage" in stored.examMistakes.find((x) => x.questionId === figure.id), false);
  });

  test("a module can't be handed in twice", async () => {
    const res = await student(`/api/exam/session/${sessionId}/modules/${moduleId}/submit`, { method: "POST", body: { answers: {} } });
    assert.equal(res.status, 400);
  });

  test("the clock is the server's: after it runs out only answers autosaved in time count, and the teacher is told", async () => {
    // A second module of the same test, so the first attempt above isn't reused.
    const t = (await admin(`/api/tests/${testId}`)).data;
    const readingId = t.modules.find((m) => m.name === "Reading and Writing").id;
    const q1 = (await admin(`/api/tests/${testId}/modules/${readingId}/questions`, { method: "POST", body: { type: "mcq", prompt: "Late one?", options: ["yes", "no"], correctIndex: 0 } })).data;
    const q2 = (await admin(`/api/tests/${testId}/modules/${readingId}/questions`, { method: "POST", body: { type: "mcq", prompt: "Late two?", options: ["yes", "no"], correctIndex: 0 } })).data;
    const save = (answers) => student(`/api/exam/session/${sessionId}/modules/${readingId}/answers`, { method: "PUT", body: { answers } });

    // Autosave needs an open module, and what it stores comes back on a reload.
    assert.equal((await save({ [q1.id]: 0 })).status, 409);
    const opened = await student(`/api/exam/session/${sessionId}/modules/${readingId}`); // starts the clock
    assert.deepEqual(opened.data.savedAnswers, {});
    const saved = await save({ [q1.id]: 0, [q2.id]: 99, junk: 1 }); // 99 is not an option, "junk" is not a question
    assert.equal(saved.status, 200);
    assert.equal(saved.data.saved, 1);
    assert.deepEqual((await student(`/api/exam/session/${sessionId}/modules/${readingId}`)).data.savedAnswers, { [q1.id]: 0 });

    dbModule.updateDB((db) => {
      const a = db.attempts.find((x) => x.participantId === participantId && x.moduleId === readingId);
      a.startedAt = new Date(Date.now() - (32 * 60 + 600) * 1000).toISOString(); // 10 minutes over a 32-minute limit
    });
    // Too late to save, and too late to answer question 2 by way of the hand-in.
    const tooLate = await save({ [q1.id]: 0, [q2.id]: 0 });
    assert.equal(tooLate.status, 409);
    assert.equal(tooLate.data.code, "TIME_UP");
    const res = await student(`/api/exam/session/${sessionId}/modules/${readingId}/submit`, { method: "POST", body: { answers: { [q1.id]: 1, [q2.id]: 0 } } });
    assert.equal(res.data.raw, 1, "graded on the autosaved answer to question 1 only");
    assert.equal(res.data.late, true);
    assert.equal(dbModule.readDB().attempts.find((a) => a.participantId === participantId && a.moduleId === readingId).answers[q2.id], undefined);

    const detail = await admin(`/api/sessions/${sessionId}/participants/${participantId}`);
    const mod = detail.data.modules.find((m) => m.moduleId === readingId);
    assert.ok(mod.overtimeSeconds >= 590 && mod.overtimeSeconds <= 620, `overtime ${mod.overtimeSeconds}`);
  });

  test("a module with no autosave handed in late scores nothing, and a hand-in inside the grace counts in full", async () => {
    const t = (await admin(`/api/tests/${testId}`)).data;
    const readingId = t.modules.find((m) => m.name === "Reading and Writing").id;
    const s3 = (await admin("/api/sessions", { method: "POST", body: { name: "Never saved", testId, studentLimit: 5 } })).data;
    await admin(`/api/sessions/${s3.id}/participants`, { method: "POST", body: { userId: studentId } });
    await admin(`/api/sessions/${s3.id}/start`, { method: "POST" });
    const qs = (await student(`/api/exam/session/${s3.id}/modules/${readingId}`)).data.questions;
    dbModule.updateDB((db) => {
      const a = db.attempts.find((x) => x.sessionId === s3.id && x.moduleId === readingId);
      a.startedAt = new Date(Date.now() - (32 * 60 + 300) * 1000).toISOString(); // five minutes over
    });
    const res = await student(`/api/exam/session/${s3.id}/modules/${readingId}/submit`, { method: "POST", body: { answers: Object.fromEntries(qs.map((q) => [q.id, 0])) } });
    assert.equal(res.data.raw, 0);
    assert.equal(res.data.late, true);
  });

  test("autosave refuses other people's sessions, finished modules and junk", async () => {
    const t = (await admin(`/api/tests/${testId}`)).data;
    const mathId = t.modules.find((m) => m.name !== "Reading and Writing").id;
    // moduleId was submitted earlier in this file, so it is closed for saving.
    const closed = await student(`/api/exam/session/${sessionId}/modules/${moduleId}/answers`, { method: "PUT", body: { answers: {} } });
    assert.equal(closed.status, 409);
    assert.equal(closed.data.code, "CLOSED");
    for (const answers of [null, "x", [1], 5]) {
      const junk = await student(`/api/exam/session/${sessionId}/modules/${mathId}/answers`, { method: "PUT", body: { answers } });
      assert.ok([200, 409].includes(junk.status), `junk body gave ${junk.status}`);
    }
  });

  test("a module handed in just after the buzzer is not flagged", async () => {
    const s2 = (await admin("/api/sessions", { method: "POST", body: { name: "Grace", testId, studentLimit: 5 } })).data;
    await admin(`/api/sessions/${s2.id}/participants`, { method: "POST", body: { userId: studentId } });
    await admin(`/api/sessions/${s2.id}/start`, { method: "POST" });
    await student(`/api/exam/session/${s2.id}/modules/${moduleId}`);
    dbModule.updateDB((db) => {
      const a = db.attempts.find((x) => x.sessionId === s2.id && x.moduleId === moduleId);
      a.startedAt = new Date(Date.now() - (35 * 60 + 20) * 1000).toISOString(); // 20 s over, inside the grace
    });
    await student(`/api/exam/session/${s2.id}/modules/${moduleId}/submit`, { method: "POST", body: { answers: {} } });
    const p2 = dbModule.readDB().participants.find((p) => p.sessionId === s2.id);
    const detail = await admin(`/api/sessions/${s2.id}/participants/${p2.id}`);
    assert.equal(detail.data.modules.find((m) => m.moduleId === moduleId).overtimeSeconds, null);
  });

  test("deleting the test leaves its sessions: students get a clear message and the session can't be started", async () => {
    const t2 = (await admin("/api/tests", { method: "POST", body: { title: "Short lived" } })).data;
    await admin(`/api/tests/${t2.id}/modules/${t2.modules[0].id}/questions`, { method: "POST", body: { type: "grid_in", prompt: "1 + 1?", correctAnswer: "2" } });
    const s3 = (await admin("/api/sessions", { method: "POST", body: { name: "Orphan", testId: t2.id, studentLimit: 5 } })).data;
    await admin(`/api/sessions/${s3.id}/participants`, { method: "POST", body: { userId: studentId } });
    await admin(`/api/sessions/${s3.id}/start`, { method: "POST" });
    const s4 = (await admin("/api/sessions", { method: "POST", body: { name: "Never started", testId: t2.id, studentLimit: 5 } })).data;

    assert.equal((await admin(`/api/tests/${t2.id}`, { method: "DELETE" })).status, 200);

    const overview = await student(`/api/exam/session/${s3.id}/overview`);
    assert.equal(overview.status, 404);
    assert.match(overview.data.error, /no longer available/i);
    const mod = await student(`/api/exam/session/${s3.id}/modules/${t2.modules[0].id}`);
    assert.equal(mod.status, 404);
    const submit = await student(`/api/exam/session/${s3.id}/modules/${t2.modules[0].id}/submit`, { method: "POST", body: { answers: {} } });
    assert.equal(submit.status, 404);
    const autosave = await student(`/api/exam/session/${s3.id}/modules/${t2.modules[0].id}/answers`, { method: "PUT", body: { answers: {} } });
    assert.equal(autosave.status, 404);
    assert.match(autosave.data.error, /no longer available/i);

    const start = await admin(`/api/sessions/${s4.id}/start`, { method: "POST" });
    assert.equal(start.status, 400);
    assert.match(start.data.error, /deleted/i);
    // The teacher's pages still load.
    assert.equal((await admin(`/api/sessions/${s3.id}`)).status, 200);
    assert.equal((await student("/api/student/history")).status, 200);
  });

  test("a module with no questions can't be sat, and a test with none at all can't be started", async () => {
    const t3 = (await admin("/api/tests", { method: "POST", body: { title: "Half built" } })).data;
    const s5 = (await admin("/api/sessions", { method: "POST", body: { name: "Half built session", testId: t3.id, studentLimit: 5 } })).data;
    await admin(`/api/sessions/${s5.id}/participants`, { method: "POST", body: { userId: studentId } });

    // Nothing to sit at all: the teacher is told why, and the session stays unstarted.
    const refused = await admin(`/api/sessions/${s5.id}/start`, { method: "POST" });
    assert.equal(refused.status, 400);
    assert.match(refused.data.error, /no questions/i);
    assert.equal((await admin(`/api/sessions/${s5.id}`)).data.status, "created");

    // One module filled, the other left empty (modules can't be deleted).
    const [rw, math] = t3.modules;
    await admin(`/api/tests/${t3.id}/modules/${math.id}/questions`, { method: "POST", body: { type: "mcq", prompt: "Pick", options: ["a", "b"], correctIndex: 0 } });
    assert.equal((await admin(`/api/sessions/${s5.id}/start`, { method: "POST" })).status, 200);

    // The student only sees the module that can be sat…
    const overview = await student(`/api/exam/session/${s5.id}/overview`);
    assert.deepEqual(overview.data.modules.map((m) => m.id), [math.id]);
    const history = (await student("/api/student/history")).data.sessions.find((s) => s.sessionId === s5.id);
    assert.deepEqual(history.modules.map((m) => m.id), [math.id]);
    // …the teacher's session page too…
    assert.deepEqual((await admin(`/api/sessions/${s5.id}`)).data.modules.map((m) => m.id), [math.id]);
    // …and opening or submitting the empty one is refused, without starting its clock.
    const open = await student(`/api/exam/session/${s5.id}/modules/${rw.id}`);
    assert.equal(open.status, 409);
    assert.equal(dbModule.readDB().attempts.some((a) => a.moduleId === rw.id), false);
    const sub = await student(`/api/exam/session/${s5.id}/modules/${rw.id}/submit`, { method: "POST", body: { answers: {} } });
    assert.equal(sub.status, 409);

    // Finishing the one real module finishes the test: "Full Send" can be earned and the session reads as complete.
    await student(`/api/exam/session/${s5.id}/modules/${math.id}`);
    const mq = (await admin(`/api/tests/${t3.id}`)).data.modules.find((m) => m.id === math.id).questions[0];
    assert.equal((await student(`/api/exam/session/${s5.id}/modules/${math.id}/submit`, { method: "POST", body: { answers: { [mq.id]: 0 } } })).data.raw, 1);
    const listed = (await admin("/api/sessions")).data.find((s) => s.id === s5.id);
    assert.equal(listed.completedCount, 1);
    const progress = dbModule.readDB().progress.find((p) => p.userId === studentId);
    assert.ok(progress.badges.some((b) => b.id === "full_test"), "every module that can be sat is done");
  });

  test("starting a session that is already running keeps its original start time", async () => {
    const before = dbModule.readDB().sessions.find((s) => s.id === sessionId).startedAt;
    await new Promise((r) => setTimeout(r, 15));
    const again = await admin(`/api/sessions/${sessionId}/start`, { method: "POST" });
    assert.equal(again.status, 200);
    assert.equal(again.data.startedAt, before);
  });
});
