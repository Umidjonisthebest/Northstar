// SAT practice tests made in the studio, over HTTP against a throwaway database: the admin drafts
// one in the mock-test editor's shape and publishes it, a student sits it through the same engine
// as the ten file tests, staff see the results (a teacher: their class students'), a test can be
// taken off the students' list without losing what was earned, and a teacher mock can be copied in.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-sat-studio-"));
process.env.DB_PATH = path.join(tmpDir, "db.json");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const { default: app } = await import("./app.js");
const { updateDB, readDB } = await import("./db.js");
const { studioKey } = await import("./satPracticeStudio.js");

let server;
let base;
let ada;
let ben;
let admin;
let teacher;

async function api(method, url, { auth, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const register = async (name) => (await api("POST", "/api/student/register", { body: { firstName: name, lastName: "S", email: `${name.toLowerCase()}@studio.test`, password: "password1" } })).data.token;
const STUDIO = "/api/admin/sat-tests";
const HUB = "/api/practice-tests";
const listFor = async (auth) => (await api("GET", HUB, { auth })).data.tests;

before(async () => {
  updateDB((db) => {
    const at = new Date().toISOString();
    db.users.push({ id: "admin-1", role: "admin", firstName: "Admin", lastName: "User", email: "admin@studio.test", passwordHash: bcrypt.hashSync("secret1", 4), createdAt: at });
    db.users.push({ id: "teacher-1", role: "teacher", firstName: "Tess", lastName: "Teacher", email: "tess@studio.test", passwordHash: bcrypt.hashSync("secret2", 4), createdAt: at });
  });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  ada = await register("Ada");
  ben = await register("Ben");
  admin = (await api("POST", "/api/auth/staff/login", { body: { email: "admin@studio.test", password: "secret1" } })).data.token;
  teacher = (await api("POST", "/api/auth/staff/login", { body: { email: "tess@studio.test", password: "secret2" } })).data.token;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

let testId;
let key;
let mods;
const questions = {};

test("a draft is the admin's: the digital SAT's four modules, and nobody else sees it yet", async () => {
  for (const auth of [ada, null]) assert.ok([401, 403].includes((await api("GET", STUDIO, { auth })).status));
  assert.equal((await api("POST", STUDIO, { auth: teacher, body: { title: "A teacher's" } })).status, 403);
  assert.equal((await api("POST", STUDIO, { auth: admin, body: { title: "  " } })).status, 400);

  const made = await api("POST", STUDIO, { auth: admin, body: { title: " October Practice Test ", description: "Written by our teachers", difficulty: "Hard" } });
  assert.equal(made.status, 201);
  testId = made.data.id;
  key = studioKey(testId);
  mods = made.data.modules;
  assert.deepEqual([made.data.title, made.data.published, made.data.difficulty], ["October Practice Test", false, "Hard"]);
  assert.deepEqual(mods.map((m) => [m.name, m.section, m.timeLimitMinutes, m.questions.length]), [
    ["Reading and Writing, Module 1", "rw", 32, 0],
    ["Reading and Writing, Module 2", "rw", 32, 0],
    ["Math, Module 1", "math", 35, 0],
    ["Math, Module 2", "math", 35, 0]
  ]);
  // It isn't a teacher mock: the two kinds are kept apart.
  assert.deepEqual((await api("GET", "/api/tests", { auth: admin })).data, []);

  const mine = (await api("GET", STUDIO, { auth: admin })).data;
  assert.equal(mine.canEdit, true);
  assert.deepEqual(mine.tests.map((t) => [t.id, t.published, t.live, t.questionCount, t.sittings]), [[testId, false, false, 0, 0]]);
  assert.deepEqual([mine.builtIn.length, mine.builtIn[0].key, mine.builtIn[0].questionCount, mine.builtIn[0].hidden], [10, "a", 98, false]);
  const theirs = (await api("GET", STUDIO, { auth: teacher })).data;
  assert.deepEqual([theirs.canEdit, theirs.tests.length, theirs.builtIn.length, theirs.mocks.length], [false, 0, 10, 0]);
  assert.equal((await listFor(ada)).length, 10);
  // Nothing to sit yet, so it can't be given to students.
  const early = await api("PUT", `${STUDIO}/${testId}/publish`, { auth: admin, body: { published: true } });
  assert.equal(early.status, 400);
  assert.equal((await api("POST", `${HUB}/${key}/start`, { auth: ada, body: { scope: "full", timed: false } })).status, 404);
});

test("questions are typed in the editor, and publishing puts the test at the top of the students' list", async () => {
  const add = (mod, body, auth = admin) => api("POST", `${STUDIO}/${testId}/modules/${mod.id}/questions`, { auth, body });
  const choice = { type: "mcq", passage: "The first line.\n\nThe second line.", prompt: "Which choice is best?", options: ["one", "two", "three", "four"], correctIndex: 2, explanation: "Three, because it is." };
  assert.equal((await add(mods[0], choice, teacher)).status, 403);
  const q1 = await add(mods[0], choice);
  assert.equal(q1.status, 201);
  assert.equal(q1.data.explanation, "Three, because it is.");
  const q2 = await add(mods[2], { type: "grid_in", prompt: "What is x^2 when x = 1/2 of 3?", correctAnswer: "9/4" });
  assert.equal(q2.status, 201);
  assert.equal(q2.data.explanation, undefined);
  Object.assign(questions, { rw: q1.data, math: q2.data });
  assert.equal((await add(mods[0], { type: "mcq", prompt: "No choices" })).status, 400);
  // A teacher can open it to read; changing a module or a question is the admin's.
  assert.equal((await api("GET", `${STUDIO}/${testId}`, { auth: teacher })).status, 200);
  assert.equal((await api("PUT", `${STUDIO}/${testId}/modules/${mods[0].id}`, { auth: teacher, body: { timeLimitMinutes: 5 } })).status, 403);
  assert.equal((await api("DELETE", `${STUDIO}/${testId}`, { auth: teacher })).status, 403);
  assert.equal((await api("PUT", `${STUDIO}/${testId}/publish`, { auth: teacher, body: { published: true } })).status, 403);

  const out = await api("PUT", `${STUDIO}/${testId}/publish`, { auth: admin, body: { published: true } });
  assert.deepEqual([out.status, out.data.published, out.data.live], [200, true, true]);
  assert.equal((await api("PUT", `${STUDIO}/${testId}/publish`, { auth: admin, body: {} })).status, 400);

  const list = await listFor(ada);
  assert.equal(list.length, 11);
  const first = list[0];
  assert.deepEqual([first.key, first.title, first.description, first.difficulty, first.questions, first.minutes], [key, "October Practice Test", "Written by our teachers", "Hard", 2, 67]);
  // Only the modules that have questions, named the way the file tests name theirs.
  assert.deepEqual(first.modules.map((m) => [m.key, m.section, m.label, m.title, m.minutes, m.questions]), [
    [mods[0].id, "rw", "Section 1, Module 1", "Reading and Writing", 32, 1],
    [mods[2].id, "math", "Section 2, Module 1", "Math", 35, 1]
  ]);
  assert.doesNotMatch(JSON.stringify(list), /"(correctIndex|explanation|answer|prompt|passage)":/);
  assert.equal((await api("GET", STUDIO, { auth: teacher })).data.tests.length, 1);
});

let runId;

test("a student sits it like any practice test, and a typed answer is marked like a mock's", async () => {
  const started = await api("POST", `${HUB}/${key}/start`, { auth: ada, body: { scope: "full", timed: false } });
  assert.equal(started.status, 201);
  runId = started.data.run.id;
  assert.deepEqual(started.data.run.modules.map((m) => [m.key, m.status]), [[mods[0].id, "not_started"], [mods[2].id, "not_started"]]);

  const rw = await api("GET", `${HUB}/runs/${runId}/modules/${mods[0].id}`, { auth: ada });
  assert.equal(rw.status, 200);
  const q = rw.data.questions[0];
  // Plain text goes out as "mx" pieces, which the page draws with the app's own math drawing.
  assert.deepEqual(q.passage, [{ t: "p", c: [{ t: "mx", c: "The first line." }] }, { t: "p", c: [{ t: "mx", c: "The second line." }] }]);
  assert.deepEqual(q.prompt, [{ t: "p", c: [{ t: "mx", c: "Which choice is best?" }] }]);
  assert.deepEqual(q.options, [[{ t: "mx", c: "one" }], [{ t: "mx", c: "two" }], [{ t: "mx", c: "three" }], [{ t: "mx", c: "four" }]]);
  assert.doesNotMatch(JSON.stringify(rw.data), /"(correctIndex|explanation|answer)":/);
  const handIn = (mod, answers, auth = ada, id = runId) => api("POST", `${HUB}/runs/${id}/modules/${mod.id}/submit`, { auth, body: { answers } });
  assert.equal((await handIn(mods[0], { [questions.rw.id]: 2 })).data.run.status, "in_progress");

  const math = await api("GET", `${HUB}/runs/${runId}/modules/${mods[2].id}`, { auth: ada });
  assert.deepEqual([math.data.questions[0].type, math.data.questions[0].options, math.data.questions[0].passage], ["grid_in", null, null]);
  // 9/4 typed as a decimal is the same answer, as in a teacher mock.
  const done = await handIn(mods[2], { [questions.math.id]: "2.25" });
  assert.deepEqual([done.data.run.status, done.data.run.total, done.data.run.rw, done.data.run.math, done.data.run.correct, done.data.run.count], ["completed", 1600, 800, 800, 2, 2]);

  const results = (await api("GET", `${HUB}/runs/${runId}/results`, { auth: ada })).data;
  const item = results.modules[0].items[0];
  assert.deepEqual([item.correct, item.given, item.correctIndex, item.explanation], [true, 2, 2, [{ t: "mx", c: "Three, because it is." }]]);
  assert.deepEqual([results.modules[1].items[0].shown, results.modules[1].items[0].correct, results.modules[1].items[0].explanation], ["9/4", true, []]);
  // A studio test's questions aren't sorted into domains, so there is no breakdown to show.
  assert.deepEqual(results.result.sections.rw.domains, []);
  assert.ok(results.reward.xpGained > 0);

  // Another student misses both.
  const other = (await api("POST", `${HUB}/${key}/start`, { auth: ben, body: { scope: "full", timed: false } })).data.run.id;
  await api("GET", `${HUB}/runs/${other}/modules/${mods[0].id}`, { auth: ben });
  await handIn(mods[0], { [questions.rw.id]: 0 }, ben, other);
  await api("GET", `${HUB}/runs/${other}/modules/${mods[2].id}`, { auth: ben });
  const missed = await handIn(mods[2], { [questions.math.id]: "2.2" }, ben, other);
  assert.deepEqual([missed.data.run.correct, missed.data.run.total], [0, 400]);
  assert.equal((await listFor(ada))[0].best.total, 1600);
});

test("staff see the results: the admin everyone's, a teacher their class students'", async () => {
  assert.ok([401, 403].includes((await api("GET", `${STUDIO}/results`, { auth: ada })).status));
  const all = (await api("GET", `${STUDIO}/results`, { auth: admin })).data;
  assert.equal(all.total, 2);
  assert.deepEqual(all.rows.map((r) => [r.student.name, r.title, r.status, r.total, r.correct, r.count]).sort(), [["Ada S", "October Practice Test", "completed", 1600, 2, 2], ["Ben S", "October Practice Test", "completed", 400, 0, 2]]);
  assert.deepEqual(all.tests, [{ key, title: "October Practice Test" }]);
  const mine = (await api("GET", STUDIO, { auth: admin })).data.tests[0];
  assert.deepEqual([mine.sittings, mine.students, mine.average], [2, 2, 1000]);

  const sheet = (await api("GET", `${STUDIO}/results/${runId}`, { auth: admin })).data;
  assert.deepEqual([sheet.student.name, sheet.total, sheet.modules.length, sheet.reward], ["Ada S", 1600, 2, undefined]);
  assert.deepEqual(sheet.modules[0].items, [{ n: 1, type: "mcq", text: "Which choice is best?", given: 2, correctIndex: 2, shown: null, answered: true, correct: true, flagged: false, seconds: 0 }]);
  assert.deepEqual([sheet.modules[1].items[0].given, sheet.modules[1].items[0].shown, sheet.modules[1].items[0].correct], ["2.25", "9/4", true]);
  assert.equal((await api("GET", `${STUDIO}/results/nope`, { auth: admin })).status, 404);

  // The teacher has no class students yet; once Ada is in a class, she is theirs to see.
  assert.deepEqual((await api("GET", `${STUDIO}/results`, { auth: teacher })).data.rows, []);
  assert.equal((await api("GET", `${STUDIO}/results/${runId}`, { auth: teacher })).status, 404);
  updateDB((db) => {
    db.classes.push({ id: "class-7a", name: "7A Math", code: "ABC234", createdAt: new Date().toISOString() });
    db.users.find((u) => u.email === "ada@studio.test").classId = "class-7a";
  });
  const theirs = (await api("GET", `${STUDIO}/results`, { auth: teacher })).data;
  assert.deepEqual(theirs.rows.map((r) => [r.student.name, r.student.classroom.name]), [["Ada S", "7A Math"]]);
  assert.equal((await api("GET", `${STUDIO}/results/${runId}`, { auth: teacher })).status, 200);
  assert.equal((await api("GET", STUDIO, { auth: teacher })).data.tests[0].sittings, 1);
});

test("a test can be taken off the students' list; what was earned on it stays", async () => {
  await api("PUT", `${STUDIO}/${testId}/publish`, { auth: admin, body: { published: false } });
  assert.equal((await listFor(ada)).length, 10);
  assert.equal((await api("POST", `${HUB}/${key}/start`, { auth: ada, body: { scope: "full", timed: false } })).status, 404);
  assert.equal((await api("GET", `${HUB}/runs/${runId}/results`, { auth: ada })).status, 200);
  assert.equal((await api("GET", STUDIO, { auth: teacher })).data.tests.length, 0);

  // The ten that came as files can be hidden the same way, one by one.
  const hide = (k, hidden) => api("PUT", `${STUDIO}/built-in/${k}`, { auth: admin, body: { hidden } });
  assert.equal((await hide("zz", true)).status, 404);
  assert.equal((await api("PUT", `${STUDIO}/built-in/a`, { auth: admin, body: {} })).status, 400);
  assert.equal((await api("PUT", `${STUDIO}/built-in/a`, { auth: teacher, body: { hidden: true } })).status, 403);
  assert.deepEqual((await hide("a", true)).data, { key: "a", hidden: true });
  const list = await listFor(ada);
  assert.deepEqual([list.length, list[0].key], [9, "b"]);
  assert.equal((await api("POST", `${HUB}/a/start`, { auth: ada, body: { scope: "rw", timed: true } })).status, 404);
  assert.equal((await api("GET", STUDIO, { auth: admin })).data.builtIn[0].hidden, true);
  assert.deepEqual((await api("GET", STUDIO, { auth: teacher })).data.builtIn.map((t) => t.key).slice(0, 2), ["b", "c"]);
  assert.deepEqual((await hide("a", false)).data, { key: "a", hidden: false });
  assert.equal((await listFor(ada)).length, 10);
  await api("PUT", `${STUDIO}/${testId}/publish`, { auth: admin, body: { published: true } });
  assert.equal((await listFor(ada))[0].key, key);
});

test("a teacher mock can be copied into a draft, and a test changed under a sitting doesn't break anything", async () => {
  // A teacher's mock, with one question.
  const mock = (await api("POST", "/api/tests", { auth: teacher, body: { title: "Friday mock" } })).data;
  await api("POST", `/api/tests/${mock.id}/modules/${mock.modules[1].id}/questions`, { auth: teacher, body: { type: "grid_in", prompt: "2 + 2?", correctAnswer: "4" } });
  assert.deepEqual((await api("GET", STUDIO, { auth: admin })).data.mocks, [{ id: mock.id, title: "Friday mock", questionCount: 1 }]);
  assert.equal((await api("POST", `${STUDIO}/from-mock/${mock.id}`, { auth: teacher })).status, 403);
  assert.equal((await api("POST", `${STUDIO}/from-mock/nope`, { auth: admin })).status, 404);
  const copy = await api("POST", `${STUDIO}/from-mock/${mock.id}`, { auth: admin });
  assert.equal(copy.status, 201);
  assert.deepEqual([copy.data.title, copy.data.published, copy.data.copiedFrom], ["Friday mock", false, mock.id]);
  assert.deepEqual(copy.data.modules.map((m) => [m.section, m.questions.length]), [["rw", 0], ["math", 1]]);
  assert.notEqual(copy.data.modules[1].questions[0].id, (await api("GET", `/api/tests/${mock.id}`, { auth: teacher })).data.modules[1].questions[0].id);
  // The mock is still a mock and nothing else.
  assert.equal((await api("GET", "/api/tests", { auth: teacher })).data.length, 1);
  assert.equal((await api("DELETE", `${STUDIO}/${copy.data.id}`, { auth: admin })).status, 200);
  assert.equal((await api("GET", `/api/tests/${mock.id}`, { auth: teacher })).status, 200);

  // Ada starts the studio test again; the admin then empties the module she would sit first.
  const again = (await api("POST", `${HUB}/${key}/start`, { auth: ada, body: { scope: "full", timed: true } })).data.run.id;
  assert.equal((await api("DELETE", `${STUDIO}/${testId}/modules/${mods[0].id}/questions/${questions.rw.id}`, { auth: admin })).status, 200);
  // Her new sitting no longer fits the test, so it is gone; the list and the staff pages still work.
  assert.equal((await api("GET", `${HUB}/runs/${again}`, { auth: ada })).status, 404);
  const list = await listFor(ada);
  assert.deepEqual([list[0].key, list[0].modules.length, list[0].open, list[0].attempts.length], [key, 1, null, 0]);
  assert.equal((await api("GET", `${STUDIO}/results`, { auth: admin })).status, 200);
  assert.equal((await api("GET", `${STUDIO}/results/${runId}`, { auth: admin })).status, 410);
  assert.equal((await api("GET", "/api/practice/progress", { auth: ada })).status, 200);

  // Deleted: off the list, and the ten file tests are untouched.
  assert.equal((await api("DELETE", `${STUDIO}/${testId}`, { auth: admin })).status, 200);
  assert.equal((await api("DELETE", `${STUDIO}/${testId}`, { auth: admin })).status, 404);
  assert.deepEqual((await listFor(ada)).map((t) => t.key), ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
  assert.equal(readDB().satPracticeTests.length, 0);
});
