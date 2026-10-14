import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";

// Point the DB at a throwaway file before anything imports db.js, so this
// suite never touches the real dev database.
const dbPath = path.join(os.tmpdir(), `northstar-test-db-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";

let server;
let base;
let adminToken;
let studentToken;

before(async () => {
  const { updateDB } = await import("./db.js");
  updateDB((db) => {
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
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dbPath, { force: true });
});

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

describe("health", () => {
  test("GET /api/health", async () => {
    const { status, data } = await api("/api/health");
    assert.equal(status, 200);
    assert.equal(data.ok, true);
  });
});

describe("auth", () => {
  test("student can register, then log in with the same credentials", async () => {
    const reg = await api("/api/student/register", {
      method: "POST",
      body: { firstName: "Ada", lastName: "Lovelace", email: "ada@test.local", password: "password1" }
    });
    assert.equal(reg.status, 201);
    assert.ok(reg.data.token);
    studentToken = reg.data.token;

    const login = await api("/api/student/login", { method: "POST", body: { email: "ada@test.local", password: "password1" } });
    assert.equal(login.status, 200);
    assert.ok(login.data.token);
  });

  test("registration rejects a short password", async () => {
    const res = await api("/api/student/register", {
      method: "POST",
      body: { firstName: "X", email: "short@test.local", password: "123" }
    });
    assert.equal(res.status, 400);
  });

  test("admin login works with seeded credentials and rejects a wrong password", async () => {
    const ok = await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "adminpass123" } });
    assert.equal(ok.status, 200);
    adminToken = ok.data.token;

    const bad = await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "wrong" } });
    assert.equal(bad.status, 401);
  });

  test("admin-only routes reject requests with no token", async () => {
    const res = await api("/api/admin/overview");
    assert.equal(res.status, 401);
  });

  test("a student token cannot access admin routes", async () => {
    const res = await api("/api/admin/overview", { token: studentToken });
    assert.equal(res.status, 403);
  });
});

describe("practice bank — grid-in questions", () => {
  let gridInId;

  test("admin can create a grid-in question", async () => {
    const res = await api("/api/admin/practice/questions", {
      method: "POST",
      token: adminToken,
      body: { type: "grid_in", section: "Math", topic: "Arithmetic", difficulty: "Easy", prompt: "What is 6 x 7?", correctAnswer: "42", explanation: "6 x 7 = 42." }
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.type, "grid_in");
    assert.equal(res.data.correctAnswer, "42");
    gridInId = res.data.id;
  });

  test("creating a grid-in question without an answer is rejected", async () => {
    const res = await api("/api/admin/practice/questions", {
      method: "POST",
      token: adminToken,
      body: { type: "grid_in", section: "Math", topic: "Arithmetic", difficulty: "Easy", prompt: "What is 2 x 2?" }
    });
    assert.equal(res.status, 400);
  });

  test("the student-facing question never leaks the correct answer", async () => {
    const res = await api("/api/practice/questions", { token: studentToken });
    const q = res.data.questions.find((x) => x.id === gridInId);
    assert.ok(q);
    assert.equal(q.options, null);
    assert.equal("correctAnswer" in q, false);
  });

  test("an exact-match answer is graded correct and not saved as a mistake", async () => {
    const res = await api(`/api/practice/questions/${gridInId}/answer`, { method: "POST", token: studentToken, body: { answer: "42" } });
    assert.equal(res.status, 200);
    assert.equal(res.data.correct, true);
    assert.equal(res.data.saved, false);
  });

  test("a wrong answer is graded incorrect and auto-saved to the mistakes queue", async () => {
    // Re-answer so it's wrong this time (toggle isn't needed — grading is independent per call).
    const res = await api(`/api/practice/questions/${gridInId}/answer`, { method: "POST", token: studentToken, body: { answer: "41" } });
    assert.equal(res.status, 200);
    assert.equal(res.data.correct, false);
    assert.equal(res.data.correctAnswer, "42");
    assert.equal(res.data.saved, true);

    const list = await api("/api/practice/questions?saved=1", { token: studentToken });
    assert.ok(list.data.questions.some((q) => q.id === gridInId));
  });
});

describe("mock exams — mistakes linked into the queue", () => {
  let sessionId;
  let moduleId;
  let wrongQuestionId;
  let rightQuestionId;

  test("set up: a test with a math module, a session, and the student as participant", async () => {
    const t = await api("/api/tests", { method: "POST", token: adminToken, body: { title: "QA Test" } });
    assert.equal(t.status, 201);
    const mathModuleId = t.data.modules.find((m) => m.name === "Math").id;

    const q1 = await api(`/api/tests/${t.data.id}/modules/${mathModuleId}/questions`, {
      method: "POST",
      token: adminToken,
      body: { type: "mcq", prompt: "2 + 2?", options: ["3", "4", "5"], correctIndex: 1 }
    });
    const q2 = await api(`/api/tests/${t.data.id}/modules/${mathModuleId}/questions`, {
      method: "POST",
      token: adminToken,
      body: { type: "grid_in", prompt: "10 - 3?", correctAnswer: "7" }
    });
    rightQuestionId = q1.data.id;
    wrongQuestionId = q2.data.id;
    moduleId = mathModuleId;

    const s = await api("/api/sessions", { method: "POST", token: adminToken, body: { name: "QA session", testId: t.data.id, studentLimit: 10 } });
    sessionId = s.data.id;

    const me = await api("/api/student/me", { token: studentToken });
    await api(`/api/sessions/${sessionId}/participants`, { method: "POST", token: adminToken, body: { userId: me.data.id } });
    await api(`/api/sessions/${sessionId}/start`, { method: "POST", token: adminToken });
  });

  test("submitting the module with one right and one wrong answer grades correctly", async () => {
    await api(`/api/exam/session/${sessionId}/modules/${moduleId}`, { token: studentToken }); // starts the attempt
    const answers = { [rightQuestionId]: 1, [wrongQuestionId]: "not seven" };
    const res = await api(`/api/exam/session/${sessionId}/modules/${moduleId}/submit`, { method: "POST", token: studentToken, body: { answers } });
    assert.equal(res.status, 200);
    assert.equal(res.data.raw, 1);
    assert.equal(res.data.max, 2);
    // Exam mode is game-free: the submission doesn't carry XP, badges or a level-up.
    assert.equal("reward" in res.data, false);
  });

  test("the module's reward waits on the results page until it has been seen", async () => {
    const history = await api("/api/student/history", { token: studentToken });
    assert.equal(history.data.sessions.find((s) => s.sessionId === sessionId).rewardsWaiting, 1);

    const results = await api(`/api/student/sessions/${sessionId}/results`, { token: studentToken });
    const { rewards } = results.data;
    assert.equal(rewards.unseen, 1);
    assert.equal(rewards.items.length, 1);
    assert.equal(rewards.items[0].moduleId, moduleId);
    assert.equal(rewards.items[0].seen, false);
    assert.equal(rewards.items[0].xpGained, 25 + 1 * 10);
    assert.equal(rewards.totalXp, 35);
    assert.ok(rewards.items[0].newBadges.some((b) => b.id === "mock_finisher"));

    const seen = await api(`/api/student/sessions/${sessionId}/rewards/seen`, { method: "POST", token: studentToken });
    assert.equal(seen.data.marked, 1);
    const after = await api(`/api/student/sessions/${sessionId}/results`, { token: studentToken });
    assert.equal(after.data.rewards.unseen, 0);
    assert.equal(after.data.rewards.items[0].seen, true);
    assert.equal(after.data.rewards.totalXp, 35);
    const historyAfter = await api("/api/student/history", { token: studentToken });
    assert.equal(historyAfter.data.sessions.find((s) => s.sessionId === sessionId).rewardsWaiting, 0);
  });

  test("another session's rewards can't be marked by a student who isn't in it", async () => {
    const res = await api("/api/student/sessions/not-my-session/rewards/seen", { method: "POST", token: studentToken });
    assert.equal(res.status, 403);
  });

  test("the wrong exam answer shows up in the exam-mistakes queue with the right source info", async () => {
    const res = await api("/api/practice/mistakes/exam", { token: studentToken });
    assert.equal(res.data.mistakes.length, 1);
    const m = res.data.mistakes[0];
    assert.equal(m.moduleId, moduleId);
    assert.equal(m.questionId, wrongQuestionId);
    assert.equal(m.givenAnswer, "not seven");
    assert.equal(m.correctAnswer, "7");
  });

  test("clearing an exam mistake removes it and awards xp", async () => {
    const before = await api("/api/practice/mistakes/exam", { token: studentToken });
    const key = before.data.mistakes[0].key;

    const cleared = await api(`/api/practice/mistakes/exam/${encodeURIComponent(key)}/clear`, { method: "POST", token: studentToken });
    assert.equal(cleared.status, 200);
    assert.ok(cleared.data.reward.xpGained > 0);

    const after = await api("/api/practice/mistakes/exam", { token: studentToken });
    assert.equal(after.data.mistakes.length, 0);
  });

  test("clearing an already-cleared mistake 404s", async () => {
    const res = await api(`/api/practice/mistakes/exam/${encodeURIComponent(`${moduleId}:${wrongQuestionId}`)}/clear`, { method: "POST", token: studentToken });
    assert.equal(res.status, 404);
  });
});
