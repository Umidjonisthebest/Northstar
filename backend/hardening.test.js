import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Security and safety fixes: sign-up and password rules, honest password reset, temporary passwords,
// Nova's answer key, the AI spending caps, the seed script, the demo account, CORS and CSP.
// Boots the real app against a throwaway database. Nova's AI path talks to a local fake of the
// model API, so nothing leaves the machine and the test can read exactly what would have been sent.
const dbPath = path.join(os.tmpdir(), `northstar-hardening-test-db-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";
process.env.TUTOR_DAILY_PER_STUDENT = "3";
process.env.TUTOR_DAILY_TOTAL = "100";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;
delete process.env.MAIL_WEBHOOK_URL;
delete process.env.APP_URL;

let server;
let base;
let adminToken;
let dbModule;
const aiCalls = []; // what the fake model API received
let fakeAi;
const mails = []; // what the fake mail relay received
let fakeMail;

const listen = (srv) => new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve(srv.address().port)));

before(async () => {
  dbModule = await import("./db.js");
  dbModule.updateDB((db) => {
    db.users.push({ id: "admin-1", role: "admin", firstName: "Test", lastName: "Admin", email: "admin@test.local", passwordHash: bcrypt.hashSync("adminpass123", 10), createdAt: new Date().toISOString() });
  });

  fakeAi = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        aiCalls.push(JSON.parse(body));
      } catch {
        aiCalls.push({ raw: body });
      }
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "fake model API: always refuses" } }));
    });
  });
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${await listen(fakeAi)}`;

  fakeMail = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      mails.push(JSON.parse(body));
      res.writeHead(200).end("ok");
    });
  });
  const mailPort = await listen(fakeMail);
  process.env.__MAIL_URL = `http://127.0.0.1:${mailPort}/send`;

  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  adminToken = (await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "adminpass123" } })).data.token;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fakeAi.close();
  fakeMail.close();
  fs.rmSync(dbPath, { force: true });
});

async function api(url, { method = "GET", body, token, headers = {} } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}
const admin = (url, opts = {}) => api(url, { ...opts, token: adminToken });

let counter = 0;
async function newStudent(password = "password1") {
  const email = `s${++counter}-${Date.now()}@test.local`;
  const res = await api("/api/student/register", { method: "POST", body: { firstName: `Stu${counter}`, email, password } });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return { email, password, token: res.data.token, id: res.data.user.id };
}

// Raw GET with an Origin header (Node's fetch won't always let a script set one).
const rawGet = (urlPath, headers) =>
  new Promise((resolve, reject) => {
    http.get(base + urlPath, { headers }, (res) => {
      res.resume();
      res.on("end", () => resolve(res));
    }).on("error", reject);
  });

describe("sign-up", () => {
  test("an account that exists without a password can't be claimed by registering with its email", async () => {
    dbModule.updateDB((db) => {
      db.users.push({ id: "added-by-teacher", role: "student", firstName: "Added", lastName: "Ahead", email: "added@test.local", candidateId: "777", createdAt: new Date().toISOString() });
    });
    const res = await api("/api/student/register", { method: "POST", body: { firstName: "Mallory", email: "Added@Test.local", password: "attacker-pass-1" } });
    assert.equal(res.status, 409);
    assert.match(res.data.error, /already exists/i);
    const stored = dbModule.readDB().users.find((u) => u.id === "added-by-teacher");
    assert.equal(stored.passwordHash, undefined, "no password was set");
    assert.equal(stored.firstName, "Added", "nothing was overwritten");
    // And the attacker's password gets them nowhere.
    assert.equal((await api("/api/student/login", { method: "POST", body: { email: "added@test.local", password: "attacker-pass-1" } })).status, 401);
  });

  test("an email already in use is refused whatever its capitals, and an admin's address can't be taken", async () => {
    const s = await newStudent();
    assert.equal((await api("/api/student/register", { method: "POST", body: { firstName: "Again", email: s.email.toUpperCase(), password: "password1" } })).status, 409);
    assert.equal((await api("/api/student/register", { method: "POST", body: { firstName: "Imp", email: "admin@test.local", password: "password1" } })).status, 409);
  });

  test("passwords need 8 characters and at most 72 bytes; names, emails and types are checked", async () => {
    const ok = { firstName: "Val", email: `val-${Date.now()}@test.local`, password: "longenough" };
    const post = (extra) => api("/api/student/register", { method: "POST", body: { ...ok, ...extra } });
    const short = await post({ password: "1234567" });
    assert.equal(short.status, 400);
    assert.match(short.data.error, /at least 8/);
    assert.equal((await post({ password: "x".repeat(73) })).status, 400);
    assert.equal((await post({ password: "é".repeat(40) })).status, 400, "80 bytes");
    for (const bad of [{ password: 12345678 }, { password: ["longenough"] }, { email: 5 }, { email: { a: 1 } }, { email: "not-an-email" }, { firstName: 7 }, { firstName: "" }]) {
      assert.equal((await post(bad)).status, 400, JSON.stringify(bad));
    }
    assert.equal((await post({})).status, 201);
  });

  test("sign-in refuses oversize passwords without hashing them, and admin sign-in checks types", async () => {
    assert.equal((await api("/api/student/login", { method: "POST", body: { email: "a@b.co", password: "x".repeat(201) } })).status, 401);
    assert.equal((await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "x".repeat(201) } })).status, 401);
    assert.equal((await api("/api/auth/admin/login", { method: "POST", body: { email: 5, password: "adminpass123" } })).status, 400);
    assert.equal((await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: { a: 1 } } })).status, 400);
  });
});

describe("forgotten passwords", () => {
  test("with no mail relay set up, the answer says plainly that nothing was sent", async () => {
    const s = await newStudent();
    const known = await api("/api/student/forgot-password", { method: "POST", body: { email: s.email } });
    const unknown = await api("/api/student/forgot-password", { method: "POST", body: { email: "nobody@test.local" } });
    assert.equal(known.status, 200);
    assert.equal(known.data.emailed, false);
    assert.match(known.data.message, /can't send email/i);
    assert.doesNotMatch(known.data.message, /has been sent|is on its way/i);
    assert.deepEqual(known.data, unknown.data, "no difference between known and unknown addresses");
    assert.equal((await api("/api/student/forgot-password", { method: "POST", body: { email: "not an email" } })).status, 400);
    assert.equal((await api("/api/student/forgot-password", { method: "POST", body: { email: 5 } })).status, 400);
  });

  test("with a relay, the link is built from APP_URL (never from request headers) and a reset signs out old sessions", async () => {
    process.env.MAIL_WEBHOOK_URL = process.env.__MAIL_URL;
    process.env.APP_URL = "https://prep.example.com/";
    try {
      const s = await newStudent();
      // A session that started before the reset.
      const old = jwt.sign({ role: "student", userId: s.id, iat: Math.floor(Date.now() / 1000) - 120 }, process.env.JWT_SECRET, { expiresIn: "7d" });
      assert.equal((await api("/api/student/me", { token: old })).status, 200);

      mails.length = 0;
      const asked = await api("/api/student/forgot-password", { method: "POST", body: { email: s.email }, headers: { origin: "https://evil.example", host: "evil.example" } });
      assert.equal(asked.data.emailed, true);
      assert.equal(mails.length, 1);
      assert.equal(mails[0].to, s.email);
      const link = mails[0].text.match(/https?:\/\/\S+/)[0];
      assert.ok(link.startsWith("https://prep.example.com/reset-password?token="), link);
      assert.ok(!link.includes("evil.example"));
      const token = new URL(link).searchParams.get("token");

      // The new password has to meet the rules, then it works once.
      const weak = await api("/api/student/reset-password", { method: "POST", body: { email: s.email, token, password: "short" } });
      assert.equal(weak.status, 400);
      const done = await api("/api/student/reset-password", { method: "POST", body: { email: s.email, token, password: "a-new-password" } });
      assert.equal(done.status, 200);
      assert.equal((await api("/api/student/reset-password", { method: "POST", body: { email: s.email, token, password: "another-one-1" } })).status, 400, "single use");

      assert.equal((await api("/api/student/me", { token: old })).status, 401, "the old session is signed out");
      const login = await api("/api/student/login", { method: "POST", body: { email: s.email, password: "a-new-password" } });
      assert.equal(login.status, 200);
      assert.equal((await api("/api/student/me", { token: login.data.token })).status, 200);
      assert.equal((await api("/api/student/login", { method: "POST", body: { email: s.email, password: s.password } })).status, 401, "the old password is dead");
    } finally {
      delete process.env.MAIL_WEBHOOK_URL;
      delete process.env.APP_URL;
    }
  });

  test("a student added by a teacher with no password claims the account through the emailed link", async () => {
    process.env.MAIL_WEBHOOK_URL = process.env.__MAIL_URL;
    process.env.APP_URL = "https://prep.example.com";
    try {
      dbModule.updateDB((db) => {
        db.users.push({ id: "no-pass", role: "student", firstName: "No", lastName: "Pass", email: "nopass@test.local", candidateId: "778", createdAt: new Date().toISOString() });
      });
      mails.length = 0;
      await api("/api/student/forgot-password", { method: "POST", body: { email: "nopass@test.local" } });
      const token = new URL(mails[0].text.match(/https?:\/\/\S+/)[0]).searchParams.get("token");
      assert.equal((await api("/api/student/reset-password", { method: "POST", body: { email: "nopass@test.local", token, password: "chosen-by-owner" } })).status, 200);
      assert.equal((await api("/api/student/login", { method: "POST", body: { email: "nopass@test.local", password: "chosen-by-owner" } })).status, 200);
    } finally {
      delete process.env.MAIL_WEBHOOK_URL;
      delete process.env.APP_URL;
    }
  });
});

describe("temporary passwords", () => {
  test("a teacher's reset gives a strong one that only opens the change-password step", async () => {
    const s = await newStudent();
    const reset = await admin(`/api/admin/students/${s.id}/reset-password`, { method: "POST" });
    assert.equal(reset.status, 200);
    const temp = reset.data.tempPassword;
    assert.ok(temp.length >= 10, temp);

    const login = await api("/api/student/login", { method: "POST", body: { email: s.email, password: temp } });
    assert.equal(login.status, 200);
    assert.equal(login.data.user.mustChangePassword, true);
    const tempToken = login.data.token;

    // Everything but /me and change-password is closed until the password is changed.
    const blocked = await api("/api/practice/progress", { token: tempToken });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.data.code, "PASSWORD_CHANGE_REQUIRED");
    assert.equal((await api("/api/student/history", { token: tempToken })).status, 403);
    assert.equal((await api("/api/student/me", { token: tempToken })).status, 200);

    // The old password no longer works, and the new one must be a real password.
    assert.equal((await api("/api/student/login", { method: "POST", body: { email: s.email, password: s.password } })).status, 401);
    assert.equal((await api("/api/student/change-password", { method: "POST", token: tempToken, body: { currentPassword: "wrong-one", newPassword: "fresh-password-1" } })).status, 400);
    assert.equal((await api("/api/student/change-password", { method: "POST", token: tempToken, body: { currentPassword: temp, newPassword: "short" } })).status, 400);
    assert.equal((await api("/api/student/change-password", { method: "POST", token: tempToken, body: { currentPassword: temp, newPassword: temp } })).status, 400);
    const sessionBefore = jwt.sign({ role: "student", userId: s.id, iat: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET, { expiresIn: "7d" });

    const changed = await api("/api/student/change-password", { method: "POST", token: tempToken, body: { currentPassword: temp, newPassword: "fresh-password-1" } });
    assert.equal(changed.status, 200);
    assert.equal(changed.data.user.mustChangePassword, false);
    assert.equal((await api("/api/practice/progress", { token: changed.data.token })).status, 200, "the new session works everywhere");
    assert.equal((await api("/api/practice/progress", { token: sessionBefore })).status, 401, "sessions from before the change are signed out");
    assert.equal((await api("/api/student/login", { method: "POST", body: { email: s.email, password: "fresh-password-1" } })).data.user.mustChangePassword, false);
  });

  test("a student the teacher adds to a session gets a temporary password that must be changed too", async () => {
    const t = (await admin("/api/tests", { method: "POST", body: { title: "Temp pw test" } })).data;
    const session = (await admin("/api/sessions", { method: "POST", body: { name: "Temp pw", testId: t.id, studentLimit: 5 } })).data;
    const added = await admin(`/api/sessions/${session.id}/participants`, { method: "POST", body: { firstName: "Tess", email: "tess@test.local" } });
    assert.equal(added.status, 201);
    assert.ok(added.data.tempPassword.length >= 10);
    const login = await api("/api/student/login", { method: "POST", body: { email: "tess@test.local", password: added.data.tempPassword } });
    assert.equal(login.data.user.mustChangePassword, true);
  });

  test("changing a password you chose needs the current one", async () => {
    const s = await newStudent();
    assert.equal((await api("/api/student/change-password", { method: "POST", token: s.token, body: { newPassword: "brand-new-pass" } })).status, 400);
    assert.equal((await api("/api/student/change-password", { method: "POST", token: s.token, body: { currentPassword: s.password, newPassword: "brand-new-pass" } })).status, 200);
    assert.equal((await api("/api/student/change-password", { method: "POST", body: { currentPassword: "a", newPassword: "b" } })).status, 401);
  });
});

// ---------------------------------------------------------------------------------------------
// Nova
// ---------------------------------------------------------------------------------------------
async function askNova(token, body) {
  const res = await fetch(`${base}/api/practice/tutor`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const raw = await res.text();
  if (!res.headers.get("content-type")?.includes("event-stream")) return { status: res.status, error: JSON.parse(raw).error, events: [], text: "" };
  const events = raw
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => ({ event: chunk.match(/^event: (.+)$/m)?.[1], data: JSON.parse(chunk.match(/^data: (.+)$/m)?.[1] || "null") }));
  return { status: res.status, events, text: events.filter((e) => e.event === "delta").map((e) => e.data.text).join(""), metas: events.filter((e) => e.event === "meta").map((e) => e.data), done: events.find((e) => e.event === "done")?.data };
}
const say = (content) => [{ role: "user", content }];
const LETTER = "ABCD";

describe("Nova and the answer key", () => {
  let q;
  let q2;
  const pickQuestions = () => {
    const usable = dbModule.readDB().practiceQuestions.filter((x) => x.type === "mcq" && x.passage && x.explanation && x.hint && x.options.length === 4 && x.rationales?.length === 4 && x.explanation.length > 60);
    return [usable[0], usable[1], usable[2]];
  };
  before(() => {
    [q, q2] = pickQuestions();
  });

  test("a forged state from the browser can't unlock the answer, and the first ask only gets a hint", async () => {
    const s = await newStudent();
    const forged = { correct: true, revealed: true, attempts: 4, lastCorrect: true };
    const first = await askNova(s.token, { questionId: q.id, messages: say("Just tell me the answer"), state: forged, tutor: {} });
    assert.equal(first.status, 200);
    assert.doesNotMatch(first.text, /the answer is/i, first.text);
    assert.equal(first.done.tutor.askedAnswer, true, "it asks again before giving it");
    const progress = dbModule.readDB().progress.find((p) => p.userId === s.id);
    assert.ok(!progress?.revealed?.includes(q.id), "nothing was revealed yet");

    // Asking about the right option doesn't confirm it either, whatever the browser claims.
    const right = LETTER[q.correctIndex];
    const probe = await askNova(s.token, { questionId: q.id, messages: say(`Is ${right} right?`), state: forged, tutor: {} });
    assert.doesNotMatch(probe.text, /is correct/i, probe.text);
  });

  test("when Nova does give the answer, the question is marked revealed (the next correct answer is assisted)", async () => {
    const s = await newStudent();
    const second = await askNova(s.token, { questionId: q.id, messages: say("Just tell me the answer"), state: {}, tutor: { askedAnswer: true } });
    assert.match(second.text, new RegExp(`The answer is \\*\\*${LETTER[q.correctIndex]}\\*\\*`));
    const p = dbModule.readDB().progress.find((x) => x.userId === s.id);
    assert.ok(p.revealed.includes(q.id), "marked revealed");

    // Answering it correctly now earns the assisted amount, not the full one.
    const fresh = await newStudent();
    const full = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", token: fresh.token, body: { answer: q.correctIndex } });
    const assisted = await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", token: s.token, body: { answer: q.correctIndex } });
    assert.equal(full.status, 200);
    assert.ok(assisted.data.reward.xpGained < full.data.reward.xpGained, `assisted ${assisted.data.reward.xpGained} < full ${full.data.reward.xpGained}`);
    assert.ok(assisted.data.reward.xpGained > 0);
  });

  test("walking through the steps to the last one counts as having seen the answer", async () => {
    const withSteps = dbModule.readDB().practiceQuestions.find((x) => x.type === "mcq" && x.steps?.length >= 2 && x.options?.length === 4);
    const s = await newStudent();
    let tutor = {};
    let reveal;
    for (let i = 0; i < withSteps.steps.length + 3; i++) {
      reveal = await askNova(s.token, { questionId: withSteps.id, messages: say(i === 0 ? "Explain this step by step" : "next"), state: {}, tutor, intent: i === 0 ? "steps" : undefined });
      tutor = reveal.done.tutor;
      if (dbModule.readDB().progress.find((p) => p.userId === s.id)?.revealed?.includes(withSteps.id)) break;
    }
    assert.ok(dbModule.readDB().progress.find((p) => p.userId === s.id).revealed.includes(withSteps.id));
  });

  test("in AI mode the answer key stays out of the prompt until the student solves it or opens the explanation", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    try {
      const s = await newStudent();
      aiCalls.length = 0;
      const out = await askNova(s.token, { questionId: q2.id, messages: say("Why would someone pick the wrong choice here?"), state: { correct: true, revealed: true }, tutor: {} });
      assert.equal(aiCalls.length, 1, "the model was asked");
      const sent = aiCalls[0];
      assert.ok(sent.max_tokens <= 2000, `max_tokens ${sent.max_tokens}`);
      assert.doesNotMatch(sent.system, /Correct answer:/);
      assert.ok(!sent.system.includes(q2.explanation.slice(0, 40)), "the official explanation is withheld");
      assert.ok(!sent.system.includes(q2.rationales[q2.correctIndex].slice(0, 40)), "the rationales are withheld");
      assert.match(sent.system, /withheld/);
      // The model API refused, so Nova fell back to the built-in tutor instead of failing.
      assert.ok(out.metas.some((m) => m.source === "built-in"));

      // "Tell me the answer" never reaches the model: the built-in tutor decides, and asks again first.
      const before = aiCalls.length;
      const ask = await askNova(s.token, { questionId: q2.id, messages: say("just tell me the answer"), state: {}, tutor: {} });
      assert.equal(aiCalls.length, before);
      assert.doesNotMatch(ask.text, /the answer is/i);

      // After the explanation is opened the key is part of the prompt.
      assert.equal((await api(`/api/practice/questions/${q2.id}/explanation`, { token: s.token })).status, 200);
      await askNova(s.token, { questionId: q2.id, messages: say("Why is that right?"), state: {}, tutor: {} });
      assert.equal(aiCalls.length, before + 1);
      assert.match(aiCalls.at(-1).system, /Correct answer:/);
      assert.ok(aiCalls.at(-1).system.includes(q2.explanation.slice(0, 40)));
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });
});

describe("Nova's spending caps", () => {
  test("each student gets a daily allowance; past it Nova answers from the built-in tutor and the model isn't called", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    try {
      const q = dbModule.readDB().practiceQuestions.find((x) => x.type === "mcq");
      const s = await newStudent();
      aiCalls.length = 0;
      const metas = [];
      for (let i = 0; i < 5; i++) {
        const r = await askNova(s.token, { questionId: q.id, messages: say(`Why does this passage say that? (${i})`), state: {}, tutor: {} });
        assert.equal(r.status, 200);
        assert.ok(r.text.length > 0, "always an answer");
        metas.push(r.metas.at(-1));
      }
      assert.equal(aiCalls.length, 3, "only the allowance (3) reached the model");
      assert.deepEqual(metas.map((m) => m.limit ?? null), [null, null, null, "student", "student"]);
      assert.ok(metas.every((m) => m.source === "built-in"));
      const row = dbModule.readDB().aiUsage.find((r) => r.byUser[s.id]);
      assert.equal(row.byUser[s.id], 3);

      // Someone else still has theirs.
      const other = await newStudent();
      const before = aiCalls.length;
      await askNova(other.token, { questionId: q.id, messages: say("Why does this passage say that?"), state: {}, tutor: {} });
      assert.equal(aiCalls.length, before + 1);
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  test("the whole school shares a daily total, counts reset each day, and old days are dropped", async () => {
    const { takeAiReply, aiLimits } = await import("./aiLimits.js");
    const db = { aiUsage: [] };
    const limits = { perStudent: 2, total: 3, maxTokens: 500 };
    const day = new Date("2026-10-10T08:00:00Z");
    assert.equal(takeAiReply(db, "a", day, limits).ok, true);
    assert.equal(takeAiReply(db, "a", day, limits).ok, true);
    assert.deepEqual(takeAiReply(db, "a", day, limits), { ok: false, reason: "student", used: 2, limit: 2 });
    assert.equal(takeAiReply(db, "b", day, limits).ok, true);
    const full = takeAiReply(db, "c", day, limits);
    assert.equal(full.ok, false);
    assert.equal(full.reason, "daily");
    // Next day: a fresh allowance.
    assert.equal(takeAiReply(db, "a", new Date("2026-10-11T08:00:00Z"), limits).ok, true);
    // Only the last 14 days are kept.
    for (let d = 12; d < 40; d++) takeAiReply(db, "z", new Date(Date.UTC(2026, 9, d, 8)), { ...limits, total: 99 });
    assert.ok(db.aiUsage.length <= 14);
    // Defaults and bad settings.
    assert.deepEqual(aiLimits({}), { perStudent: 30, total: 400, maxTokens: 1500 });
    assert.equal(aiLimits({ TUTOR_DAILY_PER_STUDENT: "banana" }).perStudent, 30);
    assert.equal(aiLimits({ TUTOR_DAILY_PER_STUDENT: "0" }).perStudent, 0, "0 turns the AI off");
  });
});

describe("the seed script", () => {
  test("production has no default admin and no demo student unless asked for", async () => {
    const { seedDatabase } = await import("./seed.js");
    const empty = () => ({ users: [], tests: [], sessions: [], participants: [] });
    assert.throws(() => seedDatabase(empty(), { NODE_ENV: "production" }), /no default admin/i);
    assert.throws(() => seedDatabase(empty(), { NODE_ENV: "production", SEED_ADMIN_PASSWORD: "long-enough-1" }), /SEED_ADMIN_EMAIL/);
    assert.throws(() => seedDatabase(empty(), { NODE_ENV: "production", SEED_ADMIN_EMAIL: "head@school.example", SEED_ADMIN_PASSWORD: "short" }), /at least 8/);
    assert.throws(() => seedDatabase(empty(), { NODE_ENV: "production", SEED_ADMIN_EMAIL: "admin@example.com", SEED_ADMIN_PASSWORD: "long-enough-1" }));

    const db = empty();
    seedDatabase(db, { NODE_ENV: "production", SEED_ADMIN_EMAIL: "head@school.example", SEED_ADMIN_PASSWORD: "long-enough-1" });
    const adminUser = db.users.find((u) => u.role === "admin");
    assert.equal(adminUser.email, "head@school.example");
    assert.ok(bcrypt.compareSync("long-enough-1", adminUser.passwordHash));
    assert.equal(bcrypt.compareSync("admin123", adminUser.passwordHash), false);
    assert.equal(db.users.some((u) => u.role === "student"), false, "no demo account in production");
    assert.equal(db.sessions.length, 0);

    const withDemo = empty();
    seedDatabase(withDemo, { NODE_ENV: "production", SEED_ADMIN_EMAIL: "head@school.example", SEED_ADMIN_PASSWORD: "long-enough-1", SEED_DEMO: "1" });
    assert.equal(withDemo.users.find((u) => u.role === "student").demo, true);
  });

  test("development still seeds the documented logins, and the demo student is flagged", async () => {
    const { seedDatabase } = await import("./seed.js");
    const db = { users: [], tests: [], sessions: [], participants: [] };
    const notes = seedDatabase(db, {});
    assert.ok(notes.some((n) => /development only/.test(n)));
    assert.ok(bcrypt.compareSync("admin123", db.users.find((u) => u.role === "admin").passwordHash));
    const demo = db.users.find((u) => u.role === "student");
    assert.equal(demo.email, "student@example.com");
    assert.equal(demo.demo, true);
    assert.deepEqual(seedDatabase(db, {}), [], "running it again adds nothing");
  });
});

describe("the demo account", () => {
  test("is left out of leagues and the teacher's statistics", async () => {
    const { getProgress } = await import("./gamification.js");
    const { ensureLeagueWeek } = await import("./leagues.js");
    const real = await newStudent();
    const countsBefore = (await admin("/api/admin/overview")).data.counts;
    dbModule.updateDB((db) => {
      db.users.push({ id: "demo-user", role: "student", firstName: "Demo", lastName: "Student", email: "student@example.com", demo: true, candidateId: "101", passwordHash: bcrypt.hashSync("student123", 10), createdAt: new Date().toISOString() });
      getProgress(db, "demo-user").xp = 900;
      getProgress(db, real.id).xp = 50;
      getProgress(db, "demo-user").xpLog = { [new Date().toISOString().slice(0, 10)]: 900 };
    });
    // Not in any league group.
    const inLeague = dbModule.updateDB((db) => {
      ensureLeagueWeek(db);
      return db.leagues.flatMap((l) => l.groups.flatMap((g) => g.members));
    });
    assert.ok(inLeague.includes(real.id), "a real student with XP is in a league");
    assert.equal(inLeague.includes("demo-user"), false);
    const view = await admin("/api/admin/leagues");
    assert.doesNotMatch(JSON.stringify(view.data), /demo-user/);

    // Not in the counts, and not among the top students.
    const overview = (await admin("/api/admin/overview")).data;
    assert.equal(overview.counts.students, countsBefore.students, "the demo isn't counted");
    assert.equal(overview.topStudents.some((u) => u.id === "demo-user"), false);
    // The teacher can still find it, marked as the demo.
    const list = (await admin("/api/admin/students?q=student@example.com")).data.students;
    assert.equal(list.find((u) => u.id === "demo-user")?.demo, true);
  });
});

describe("browser access", () => {
  test("only listed origins get CORS headers", async () => {
    const stranger = await rawGet("/api/health", { origin: "https://evil.example" });
    assert.equal(stranger.headers["access-control-allow-origin"], undefined);
    const dev = await rawGet("/api/health", { origin: "http://localhost:5173" });
    assert.equal(dev.headers["access-control-allow-origin"], "http://localhost:5173");
    const none = await rawGet("/api/health", {});
    assert.equal(none.statusCode, 200);
  });

  test("the allow-list comes from CORS_ORIGINS and APP_URL, and production never adds localhost", async () => {
    const { allowedOrigins } = await import("./app.js");
    assert.deepEqual([...allowedOrigins({ NODE_ENV: "production", CORS_ORIGINS: "https://a.example/, https://b.example", APP_URL: "https://c.example/" })].sort(), ["https://a.example", "https://b.example", "https://c.example"]);
    assert.equal(allowedOrigins({ NODE_ENV: "production" }).size, 0);
    assert.ok(allowedOrigins({}).has("http://localhost:5173"));
  });

  test("the server sends a content security policy that allows no script and no framing", async () => {
    const res = await rawGet("/api/health", {});
    const csp = res.headers["content-security-policy"];
    assert.ok(csp, "a policy is set");
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /script-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(res.headers["cross-origin-resource-policy"], "cross-origin");
  });
});
