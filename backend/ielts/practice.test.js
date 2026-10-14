// IELTS Practice (self-study in the student hub) over HTTP against a throwaway
// database: the seeded practice set is listed without leaking answers, parts
// are marked with the real question numbers, essays get automatic checks and a
// model answer, and practice-only content never reaches a mock session.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-ielts-practice-"));
process.env.DB_PATH = path.join(tmpDir, "db.json");
process.env.UPLOAD_DIR = path.join(tmpDir, "uploads");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const { default: app } = await import("../app.js");
const { updateDB, readDB } = await import("../db.js");
const { pickAssignment } = await import("./lib/exam.js");

let server;
let base;
let token;
let adminToken;

async function api(method, url, { auth, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

before(async () => {
  updateDB((db) => {
    db.users.push({ id: "admin-1", role: "admin", firstName: "Admin", lastName: "User", email: "admin@test.dev", passwordHash: bcrypt.hashSync("secret1", 4), createdAt: new Date().toISOString() });
  });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  token = (await api("POST", "/api/student/register", { body: { firstName: "Ivy", lastName: "P", email: "ivy@test.dev", password: "password1" } })).data.token;
  adminToken = (await api("POST", "/api/auth/admin/login", { body: { email: "admin@test.dev", password: "secret1" } })).data.token;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const seeded = (kind, seedKey) => readDB()[{ listening: "ieltsListening", reading: "ieltsReading", writing: "ieltsWriting" }[kind]].find((r) => r.seedKey === seedKey);

test("the practice list shows only practice content, without answers", async () => {
  assert.equal((await api("GET", "/api/ielts/student/practice")).status, 401);
  const { status, data } = await api("GET", "/api/ielts/student/practice", { auth: token });
  assert.equal(status, 200);
  // The section-practice set (seed/practice.js). The parts of the practice tests are the tests'
  // own and are never listed here, though the first test was made from this same material.
  assert.deepEqual(data.listening.map((i) => i.number), [1, 2, 3, 4]);
  assert.deepEqual(data.reading.map((i) => i.number), [1, 2, 3]);
  assert.equal(data.writing.length, 4);
  assert.equal(data.listening.reduce((n, i) => n + i.questionCount, 0), 40);
  assert.equal(data.reading.reduce((n, i) => n + i.questionCount, 0), 40);
  assert.ok(!JSON.stringify(data).includes("answers"));
  // The mock-test starter content isn't practice material.
  assert.ok(data.listening.every((i) => i.source?.startsWith("Northstar practice")));
});

test("a part keeps its real question numbers and never sends the key", async () => {
  const pl2 = seeded("listening", "PL2");
  const { data } = await api("GET", `/api/ielts/student/practice/listening/${pl2.id}`, { auth: token });
  assert.deepEqual(data.part.range, [11, 20]);
  assert.match(data.part.audioUrl, /PL2\.wav$/);
  const text = JSON.stringify(data.part);
  assert.ok(!text.includes('"answers"') && !text.includes('"correct"'));
  assert.ok(!text.includes("transcriptHtml"));

  const pr3 = seeded("reading", "PR3");
  const reading = (await api("GET", `/api/ielts/student/practice/reading/${pr3.id}`, { auth: token })).data;
  assert.deepEqual(reading.part.range, [27, 40]);
  assert.ok(reading.part.contentHtml.includes("Boredom"));
});

test("listening and reading are marked, stored and rewarded", async () => {
  const pl1 = seeded("listening", "PL1");
  const answers = {
    "PL1-b1": "Ashworth",
    "PL1-b2": "07915346802",
    "PL1-b3": "lighthouse",
    "PL1-b4": "19",
    "PL1-b5": "three",
    "PL1-b6": "seat",
    "PL1-b7": "Aquarium",
    "PL1-b8": "9:30",
    "PL1-b9": "gloves",
    "PL1-b10": "£96"
  };
  const full = await api("POST", `/api/ielts/student/practice/listening/${pl1.id}/submit`, { auth: token, body: { answers, seconds: 250 } });
  assert.equal(full.status, 200);
  assert.equal(full.data.correct, 10);
  assert.equal(full.data.total, 10);
  assert.equal(full.data.band, 9);
  assert.ok(full.data.reward);
  assert.match(full.data.transcriptHtml, /Ashworth/);

  const partly = await api("POST", `/api/ielts/student/practice/listening/${pl1.id}/submit`, {
    auth: token,
    body: { answers: { ...answers, "PL1-b3": "Castle", "PL1-b4": "12th" } }
  });
  assert.equal(partly.data.correct, 8);
  // XP follows the part's level, and repeating a part only pays for a better score.
  const { XP } = await import("../gamification.js");
  assert.equal(full.data.reward.xpGained, XP.ieltsPart + 10 * XP.ieltsCorrect[pl1.level]);
  assert.equal(partly.data.reward.xpGained, 0);
  const wrong = partly.data.rows.filter((r) => !r.correct).map((r) => r.n);
  assert.deepEqual(wrong, [3, 4]);
  assert.deepEqual(partly.data.keys["PL1-b3"], ["Lighthouse"]);

  // "Choose TWO" items are scored per letter, in any order.
  const pl3 = seeded("listening", "PL3");
  const multi = await api("POST", `/api/ielts/student/practice/listening/${pl3.id}/submit`, {
    auth: token,
    body: { answers: { "PL3-m21": ["D", "A"], "PL3-m23": ["B", "C"] } }
  });
  assert.equal(multi.data.correct, 3);
  assert.equal(multi.data.total, 10);

  const list = (await api("GET", "/api/ielts/student/practice", { auth: token })).data;
  const item = list.listening.find((i) => i.id === pl1.id);
  assert.equal(item.attempts, 2);
  assert.deepEqual(item.best, { correct: 10, total: 10 });
  assert.equal(list.stats.attempts, 3);
  assert.ok(list.stats.listening.band > 0);
  assert.equal(list.recent[0].refId, pl3.id);
  const stored = readDB().ieltsPracticeAttempts.find((a) => a.refId === pl1.id);
  assert.deepEqual(Object.keys(stored.answers).sort(), Object.keys(answers).sort());
});

test("essays get automatic checks and the model answer", async () => {
  const pw3 = seeded("writing", "PW3");
  const part = (await api("GET", `/api/ielts/student/practice/writing/${pw3.id}`, { auth: token })).data.part;
  assert.equal(part.task, 2);
  assert.equal(part.minWords, 250);
  const short = await api("POST", `/api/ielts/student/practice/writing/${pw3.id}/submit`, {
    auth: token,
    body: { answers: { [pw3.id]: "Schools should teach money. I think it is useful." } }
  });
  assert.equal(short.status, 200);
  assert.equal(short.data.feedback.minWords, 250);
  assert.equal(short.data.feedback.checks.find((c) => c.title === "Length").ok, false);
  assert.equal(short.data.feedback.checks.find((c) => c.title === "Your position").ok, true);
  assert.match(short.data.modelAnswerHtml, /personal finance/);
  const saved = readDB().ieltsPracticeAttempts.find((a) => a.refId === pw3.id);
  assert.equal(saved.words, 9);
});

test("startup refreshes changed seed items, but not ones a teacher edited", async () => {
  const { ensureIeltsPractice } = await import("./seed/starter.js");
  const db = readDB();
  const pw1 = db.ieltsWriting.find((r) => r.seedKey === "PW1");
  const pw2 = db.ieltsWriting.find((r) => r.seedKey === "PW2");
  const id = pw1.id;
  Object.assign(pw1, { title: "Old title", seedHash: "old" });
  Object.assign(pw2, { title: "Teacher's title", seedHash: "old", customized: true });
  assert.deepEqual(ensureIeltsPractice(db), { added: 0, updated: 1 });
  assert.equal(pw1.title, "Task 1 – Books read by age group");
  assert.equal(pw1.id, id);
  assert.equal(pw2.title, "Teacher's title");
});

test("practice-only content never goes into a mock session, and teachers can share content both ways", async () => {
  const db = readDB();
  const practiceIds = new Set(["ieltsListening", "ieltsReading", "ieltsWriting"].flatMap((c) => db[c].filter((r) => r.use === "practice").map((r) => r.id)));
  for (let i = 0; i < 20; i++) {
    const assignment = pickAssignment(db, { id: `s${i}` });
    for (const ids of Object.values(assignment)) for (const id of ids) assert.ok(!practiceIds.has(id));
  }

  // A mock test marked "both" appears in the practice list too.
  const mock = db.ieltsReading.find((r) => !r.seedKey);
  const listed = await api("GET", "/api/ielts/admin/content/reading", { auth: adminToken });
  assert.equal(listed.data.find((r) => r.id === mock.id).use, "mock");
  const patched = await api("PATCH", `/api/ielts/admin/content/reading/${mock.id}`, { auth: adminToken, body: { use: "both" } });
  assert.equal(patched.data.use, "both");
  const list = (await api("GET", "/api/ielts/student/practice", { auth: token })).data;
  assert.ok(list.reading.some((r) => r.id === mock.id));
  // Practice is for student accounts only.
  assert.equal((await api("GET", `/api/ielts/student/practice/reading/${seeded("reading", "PR1").id}`, { auth: adminToken })).status, 403);
});

test("saving a practice task in the editor keeps its level and stores the model answer", async () => {
  const pw4 = seeded("writing", "PW4");
  assert.equal(pw4.level, "HARD");
  const save = (part) => api("POST", "/api/ielts/admin/content/writing/save", { auth: adminToken, body: { groupId: pw4.groupId, source: pw4.source, parts: [part] } });
  const base = { id: pw4.id, task: 2, title: pw4.title, questionHtml: pw4.questionHtml, image: null, active: true };

  // An editor that sends no level or use leaves both as they were.
  assert.equal((await save(base)).status, 200);
  let stored = seeded("writing", "PW4");
  assert.equal(stored.level, "HARD");
  assert.equal(stored.use, "practice");
  assert.equal(stored.customized, true);

  const res = await save({ ...base, level: "MEDIUM", use: "both", modelAnswerHtml: "<p>A teacher's sample.</p>" });
  assert.equal(res.data.saved[0].use, "both");
  stored = seeded("writing", "PW4");
  assert.equal(stored.level, "MEDIUM");
  const essay = await api("POST", `/api/ielts/student/practice/writing/${pw4.id}/submit`, { auth: token, body: { answers: { [pw4.id]: "Short essay." } } });
  assert.equal(essay.data.modelAnswerHtml, "<p>A teacher's sample.</p>");

  // New content without a level starts at MEDIUM.
  const created = await save({ task: 1, title: "New task", questionHtml: "<p>Describe the chart.</p>" });
  assert.equal(created.data.saved[0].level, "MEDIUM");
  assert.equal(created.data.saved[0].use, "mock");
});
