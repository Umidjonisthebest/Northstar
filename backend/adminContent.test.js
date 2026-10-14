import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";

// The teacher's content tools — the practice bank and the vocabulary deck — and the database
// file beneath them. Like routes.test.js it boots the real app against a throwaway database.
const dbPath = path.join(os.tmpdir(), `northstar-admincontent-test-db-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";

let server;
let base;
let adminToken;
let dbModule;
let appModule;

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
  appModule = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = appModule.default.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  adminToken = (await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "adminpass123" } })).data.token;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  const dir = path.dirname(dbPath);
  const stem = path.basename(dbPath);
  for (const f of fs.readdirSync(dir)) if (f.startsWith(stem)) fs.rmSync(path.join(dir, f), { force: true });
});

async function api(url, { method = "GET", body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { "content-type": "application/json", ...(adminToken ? { authorization: `Bearer ${adminToken}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

describe("vocabulary deck", () => {
  test("a word needs text for its spelling and definition; other types are a 400, not a crash", async () => {
    for (const body of [{ word: true, definition: "x" }, { word: { a: 1 }, definition: "x" }, { word: "ok", definition: ["x"] }, { word: "  ", definition: "x" }, {}]) {
      assert.equal((await api("/api/admin/practice/vocab", { method: "POST", body })).status, 400, JSON.stringify(body));
    }
    const ok = await api("/api/admin/practice/vocab", { method: "POST", body: { word: "  limpid ", definition: " clear ", example: 5, pronunciation: { x: 1 } } });
    assert.equal(ok.status, 201);
    assert.equal(ok.data.word, "limpid");
    assert.equal(ok.data.definition, "clear");
    assert.equal(ok.data.example, "5");
    assert.equal(ok.data.pronunciation, "");
  });

  test("an edit can't empty a word or its definition, and ignores values that aren't text", async () => {
    const made = (await api("/api/admin/practice/vocab", { method: "POST", body: { word: "lucid", definition: "easy to understand", example: "A lucid talk." } })).data;
    const url = `/api/admin/practice/vocab/${made.id}`;
    assert.equal((await api(url, { method: "PUT", body: { definition: "" } })).status, 400);
    assert.equal((await api(url, { method: "PUT", body: { word: { a: 1 } } })).status, 400);
    const kept = await api(url, { method: "PUT", body: { example: { a: 1 }, partOfSpeech: "adj." } });
    assert.equal(kept.status, 200);
    assert.equal(kept.data.example, "A lucid talk.");
    assert.equal(kept.data.partOfSpeech, "adj.");
    assert.equal(kept.data.definition, "easy to understand");
    assert.equal((await api("/api/admin/practice/vocab/nope", { method: "PUT", body: { example: "x" } })).status, 404);
  });

  test("a starter word a teacher deletes stays deleted when the server restarts", async () => {
    const { VOCAB_WORDS } = await import("./practiceContent.js");
    const starter = VOCAB_WORDS[0];
    const present = () => dbModule.readDB().vocab.find((w) => w.word.toLowerCase() === starter.word.toLowerCase());
    assert.ok(present(), "the starter deck is loaded");
    assert.equal((await api(`/api/admin/practice/vocab/${present().id}`, { method: "DELETE" })).status, 200);
    assert.equal(present(), undefined);

    // What the server does at every start (and `node --watch` restarts it on each backend edit).
    dbModule.updateDB((db) => appModule.syncStarterVocab(db));
    assert.equal(present(), undefined, "the deleted word came back");
    // Words nobody deleted are still topped up.
    dbModule.updateDB((db) => {
      db.vocab = db.vocab.filter((w) => w.word.toLowerCase() !== VOCAB_WORDS[1].word.toLowerCase());
      appModule.syncStarterVocab(db);
    });
    assert.ok(dbModule.readDB().vocab.some((w) => w.word.toLowerCase() === VOCAB_WORDS[1].word.toLowerCase()));
  });
});

describe("practice bank", () => {
  test("a starter question a teacher deletes stays deleted when the server restarts", async () => {
    const starter = dbModule.readDB().practiceQuestions.find((q) => q.key);
    assert.ok(starter, "starter questions are loaded");
    assert.equal((await api(`/api/admin/practice/questions/${starter.id}`, { method: "DELETE" })).status, 200);

    dbModule.updateDB((db) => appModule.syncStarterQuestions(db));
    assert.equal(dbModule.readDB().practiceQuestions.some((q) => q.key === starter.key), false, "the deleted question came back");
    // …while a question nobody deleted keeps being kept up to date.
    assert.ok(dbModule.readDB().practiceQuestions.filter((q) => q.key).length > 100);
  });

  test("a bulk import with junk entries reports them instead of failing the whole request", async () => {
    const valid = { type: "mcq", section: "Math", prompt: "What is 1 + 1?", options: ["1", "2", "3"], correctIndex: 1 };
    const res = await api("/api/admin/practice/questions/import", { method: "POST", body: [null, 5, "text", [], {}, valid] });
    assert.equal(res.status, 200);
    assert.equal(res.data.imported, 1);
    assert.equal(res.data.errors.length, 5);
  });

  test("changing a question from multiple choice to grid-in drops its old choices and key", async () => {
    const made = (await api("/api/admin/practice/questions", { method: "POST", body: { type: "mcq", section: "Math", prompt: "Pick", options: ["a", "b"], correctIndex: 1 } })).data;
    const edited = await api(`/api/admin/practice/questions/${made.id}`, { method: "PUT", body: { type: "grid_in", section: "Math", prompt: "Pick", correctAnswer: "4" } });
    assert.equal(edited.status, 200);
    assert.equal(edited.data.correctAnswer, "4");
    assert.equal("options" in edited.data, false);
    assert.equal("correctIndex" in edited.data, false);
  });
});

describe("teacher tools", () => {
  let ana;
  let ben;
  before(async () => {
    const reg = (firstName, email) => api("/api/student/register", { method: "POST", body: { firstName, lastName: "Test", email, password: "password1" } });
    ana = (await reg("Ana", "ana@test.local")).data.user;
    ben = (await reg('=HYPERLINK("http://evil.example","click")', "ben@test.local")).data.user;
  });

  test("editing a student checks the email, trims, and refuses values that aren't text", async () => {
    const url = `/api/admin/students/${ana.id}`;
    assert.equal((await api(url, { method: "PUT", body: { email: "not-an-email" } })).status, 400);
    assert.equal((await api(url, { method: "PUT", body: { email: { a: 1 } } })).status, 400);
    assert.equal((await api(url, { method: "PUT", body: { email: "ben@test.local" } })).status, 400);
    assert.equal((await api(url, { method: "PUT", body: { email: "  BEN@test.local " } })).status, 400, "a duplicate with other case and spaces still counts");

    const ok = await api(url, { method: "PUT", body: { firstName: { a: 1 }, lastName: "  Rivera ", email: " ana.r@test.local " } });
    assert.equal(ok.status, 200);
    const s = (await api(url)).data;
    assert.equal(s.firstName, "Ana", "an object is not a first name");
    assert.equal(s.lastName, "Rivera");
    assert.equal(s.email, "ana.r@test.local");
  });

  test("a deleted student's token stops working instead of resurrecting an empty account", async () => {
    const reg = await fetch(`${base}/api/student/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName: "Gone", lastName: "Soon", email: "gone@test.local", password: "password1" })
    });
    const { token, user } = await reg.json();
    const mine = (path) => fetch(`${base}${path}`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal((await mine("/api/practice/progress")).status, 200);

    // The IELTS users screen deletes accounts (and everything attached to them).
    assert.equal((await api(`/api/ielts/admin/users/${user.id}`, { method: "DELETE" })).status, 200);

    const after = await mine("/api/practice/progress");
    assert.equal(after.status, 401);
    assert.match((await after.json()).error, /no longer exists/i);
    assert.equal(dbModule.readDB().progress.some((p) => p.userId === user.id), false, "no ghost progress record");
  });

  test("temporary passwords are long enough, unambiguous and different every time", async () => {
    const { tempPassword } = await import("./users.js");
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      const p = tempPassword();
      assert.match(p, /^sat-[abcdefghjkmnpqrstuvwxyz23456789]{10}$/); // 14 characters in all
      assert.ok(p.length >= 10);
      seen.add(p);
    }
    assert.equal(seen.size, 500);
    // The teacher's reset hands one out and it really works at sign-in.
    const reset = await api(`/api/admin/students/${ana.id}/reset-password`, { method: "POST" });
    assert.match(reset.data.tempPassword, /^sat-[a-z2-9]{10}$/);
    const login = await fetch(`${base}/api/student/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ana.r@test.local", password: reset.data.tempPassword })
    });
    assert.equal(login.status, 200);
  });

  test("an announcement needs a text title, and 'false' is not pinned", async () => {
    assert.equal((await api("/api/admin/announcements", { method: "POST", body: { title: { a: 1 } } })).status, 400);
    assert.equal((await api("/api/admin/announcements", { method: "POST", body: { title: 7 } })).status, 400);
    const made = await api("/api/admin/announcements", { method: "POST", body: { title: " Mock on Saturday ", body: { a: 1 }, pinned: "false" } });
    assert.equal(made.status, 201);
    assert.equal(made.data.title, "Mock on Saturday");
    assert.equal(made.data.body, "");
    assert.equal(made.data.pinned, false);
  });

  test("the results export can't smuggle a spreadsheet formula in through a student's name", async () => {
    const t = (await api("/api/tests", { method: "POST", body: { title: "Export test" } })).data;
    const s = (await api("/api/sessions", { method: "POST", body: { name: "Export session", testId: t.id } })).data;
    await api(`/api/sessions/${s.id}/participants`, { method: "POST", body: { userId: ben.id } });

    const res = await fetch(`${base}/api/admin/sessions/${s.id}/export.csv`, { headers: { authorization: `Bearer ${adminToken}` } });
    assert.equal(res.status, 200);
    const csv = await res.text();
    assert.ok(csv.includes("HYPERLINK"), "the name is still in the export");
    assert.doesNotMatch(csv, /(^|,|\n)"?=HYPERLINK/, "a cell must not start with =");
    assert.match(csv, /"'=HYPERLINK\(""http:\/\/evil\.example"",""click""\)"/);
  });

  test("a submission late in the evening is counted on the app's own calendar day", async (t) => {
    const { TZ, todayKey, dayOffset } = await import("./gamification.js");
    if (TZ !== "Asia/Tashkent") return t.skip("written for the default timezone, UTC+5 all year");
    const today = todayKey();
    const early = new Date(`${today}T00:30:00+05:00`).toISOString(); // the 19:30 UTC of the day before
    assert.notEqual(early.slice(0, 10), today, "the instant must fall on a different UTC date");
    dbModule.updateDB((db) => {
      db.attempts.push({ id: "late-1", participantId: "p", sessionId: "s", moduleId: "m", answers: {}, startedAt: early, submittedAt: early, raw: 1, max: 2 });
    });
    const overview = (await api("/api/admin/overview")).data;
    const on = (date) => overview.activity.find((d) => d.date === date).submissions;
    assert.equal(on(today), 1);
    assert.equal(on(dayOffset(today, -1)), 0);
  });
});

describe("sign-in limits", () => {
  const signIn = (email, password) =>
    fetch(`${base}/api/student/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });

  test("a class signing in together from one address is never locked out by its own successes", async () => {
    for (let i = 0; i < 30; i++) assert.equal((await signIn("ben@test.local", "password1")).status, 200, `sign-in ${i + 1}`);
  });

  test("twenty wrong passwords from one address shut it out for a while", async () => {
    for (let i = 0; i < 20; i++) assert.equal((await signIn("ben@test.local", "wrong-password")).status, 401, `try ${i + 1}`);
    const blocked = await signIn("ben@test.local", "wrong-password");
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error, /too many/i);
  });
});

describe("the database file", () => {
  test("an unreadable file is never replaced by an empty database", async () => {
    const original = fs.readFileSync(dbPath, "utf-8");
    fs.writeFileSync(dbPath, original.slice(0, Math.floor(original.length / 2))); // a half-written file
    try {
      assert.throws(() => dbModule.readDB(), (e) => e.code === "DB_UNREADABLE");
      // A write must not go through on top of it either.
      assert.throws(() => dbModule.updateDB((db) => db.users.push({ id: "x" })), (e) => e.code === "DB_UNREADABLE");
      // The damaged file is still there for the teacher to repair, and a copy sits next to it.
      assert.equal(fs.readFileSync(dbPath, "utf-8"), original.slice(0, Math.floor(original.length / 2)));
      const copies = fs.readdirSync(path.dirname(dbPath)).filter((f) => f.startsWith(path.basename(dbPath) + ".unreadable-"));
      assert.equal(copies.length, 1);
      // The API fails loudly, without crashing the process (the server logs it; muted here).
      const logged = console.error;
      console.error = () => {};
      try {
        assert.equal((await api("/api/admin/practice/vocab")).status, 500);
      } finally {
        console.error = logged;
      }
    } finally {
      fs.writeFileSync(dbPath, original);
    }
    assert.ok(dbModule.readDB().users.some((u) => u.id === "admin-1"), "restored file reads again");
  });

  test("an empty file counts as a fresh database", () => {
    const original = fs.readFileSync(dbPath, "utf-8");
    try {
      fs.writeFileSync(dbPath, "  \n");
      const db = dbModule.readDB();
      assert.deepEqual(db.users, []);
      assert.deepEqual(db.removedStarters, []);
    } finally {
      fs.writeFileSync(dbPath, original);
    }
  });
});
