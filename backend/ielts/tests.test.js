// IELTS practice tests (whole tests taken alone, a section at a time) over HTTP against a
// throwaway database: the seeded tests are listed without the key, a section is numbered 1-40
// across its parts, marked and stored part by part, XP follows the practice rules, comet chunks
// are paid once per section and once per whole test, and a finished section can be opened again.
// A test owns its parts: they are apart from section practice, the admin builds a test inside the
// test (copying parts in, or writing them in the editors), staff see the results, and a database
// from before all that is put right at startup.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-ielts-tests-"));
process.env.DB_PATH = path.join(tmpDir, "db.json");
process.env.UPLOAD_DIR = path.join(tmpDir, "uploads");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const { default: app } = await import("../app.js");
const { updateDB, readDB } = await import("../db.js");
const { CHUNKS } = await import("../shop.js");
const { XP } = await import("../gamification.js");
const { groupSlots } = await import("./lib/questions.js");
const T = await import("./lib/practiceTests.js");
const { ensureIeltsPracticeTests, separateIeltsPracticeTests } = await import("./seed/starter.js");
const { PRACTICE_TESTS: SEEDED_TESTS } = await import("./seed/tests.js");

let server;
let base;
let token;
let other;
let adminToken;
let teacherToken;

async function api(method, url, { auth, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const register = async (name) => (await api("POST", "/api/student/register", { body: { firstName: name, lastName: "T", email: `${name.toLowerCase()}@test.dev`, password: "password1" } })).data.token;
const balance = async (auth) => (await api("GET", "/api/practice/progress", { auth })).data.chunks.balance;
const seededTest = (seedKey) => readDB().ieltsPracticeTests.find((t) => t.seedKey === seedKey);

// A full answer sheet from the key, with the first `wrong` slots left empty.
function sheet(testId, kind, wrong = 0) {
  const db = readDB();
  const records = T.sectionRecords(db, T.findTest(db, testId), kind);
  const answers = {};
  let skipped = 0;
  for (const r of records) {
    for (const g of r.groups) {
      for (const s of groupSlots(g)) {
        if (s.mode === "multi") answers[s.itemId] = [...g.items.find((it) => it.id === s.itemId).correct];
        else if (skipped++ >= wrong) answers[s.id] = g.answers[s.id].value;
      }
    }
  }
  return answers;
}

const essayOf = (words) => Array.from({ length: words }, (_, i) => (i % 9 === 8 ? "however." : "word")).join(" ");

before(async () => {
  updateDB((db) => {
    const at = new Date().toISOString();
    db.users.push({ id: "admin-1", role: "admin", firstName: "Admin", lastName: "User", email: "admin@test.dev", passwordHash: bcrypt.hashSync("secret1", 4), createdAt: at });
    db.users.push({ id: "teacher-1", role: "teacher", firstName: "Tess", lastName: "Teacher", email: "tess@test.dev", passwordHash: bcrypt.hashSync("secret2", 4), createdAt: at });
  });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  token = await register("Nora");
  other = await register("Omar");
  adminToken = (await api("POST", "/api/auth/staff/login", { body: { email: "admin@test.dev", password: "secret1" } })).data.token;
  teacherToken = (await api("POST", "/api/auth/staff/login", { body: { email: "tess@test.dev", password: "secret2" } })).data.token;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("the seeded practice tests are listed with their three sections and no key", async () => {
  assert.equal((await api("GET", "/api/ielts/student/tests")).status, 401);
  const { status, data } = await api("GET", "/api/ielts/student/tests", { auth: token });
  assert.equal(status, 200);
  assert.deepEqual(data.tests.map((t) => t.title), ["Practice Test 1", "Practice Test 2"]);
  for (const t of data.tests) {
    assert.deepEqual(Object.keys(t.sections), ["listening", "reading", "writing"]);
    assert.equal(t.sections.listening.questionCount, 40);
    assert.equal(t.sections.listening.parts, 4);
    assert.equal(t.sections.reading.questionCount, 40);
    assert.equal(t.sections.reading.minutes, 60);
    assert.equal(t.sections.writing.parts, 2);
    assert.equal(t.sections.writing.minutes, 60);
    assert.equal(t.done, 0);
    assert.equal(t.of, 3);
    assert.equal(t.estimate, null);
  }
  assert.deepEqual(data.chunks, { section: CHUNKS.ieltsSection, whole: CHUNKS.ieltsTest });
  assert.deepEqual(data.stats, { sections: 0, finished: 0, bestEstimate: null });
  const text = JSON.stringify(data);
  assert.ok(!text.includes('"answers"') && !text.includes("modelAnswerHtml") && !text.includes("transcriptHtml"));
});

test("a section is numbered 1 to 40 across its parts and never sends the key", async () => {
  const t2 = seededTest("PT2");
  const { status, data } = await api("GET", `/api/ielts/student/tests/${t2.id}/listening`, { auth: token });
  assert.equal(status, 200);
  assert.equal(data.test.title, "Practice Test 2");
  assert.deepEqual(data.section.parts.map((p) => p.range), [[1, 10], [11, 20], [21, 30], [31, 40]]);
  assert.deepEqual(data.section.parts.map((p) => p.partNumber), [1, 2, 3, 4]);
  assert.ok(data.section.parts.every((p) => /T2L\d\.wav$/.test(p.audioUrl)));
  assert.equal(data.section.totalQuestions, 40);
  // The clock: the four recordings and two minutes to check.
  assert.equal(data.section.seconds, data.section.parts.reduce((n, p) => n + p.durationSeconds, 0) + T.LISTENING_CHECK_SECONDS);
  const text = JSON.stringify(data);
  assert.ok(!text.includes('"answers"') && !text.includes('"correct"') && !text.includes("transcriptHtml"));

  const reading = (await api("GET", `/api/ielts/student/tests/${t2.id}/reading`, { auth: token })).data;
  assert.deepEqual(reading.section.parts.map((p) => p.range), [[1, 13], [14, 26], [27, 40]]);
  assert.equal(reading.section.seconds, 3600);
  const writing = (await api("GET", `/api/ielts/student/tests/${t2.id}/writing`, { auth: token })).data;
  assert.deepEqual(writing.section.parts.map((p) => p.task), [1, 2]);
  assert.ok(!JSON.stringify(writing).includes("modelAnswerHtml"));

  assert.equal((await api("GET", `/api/ielts/student/tests/${t2.id}/speaking`, { auth: token })).status, 404);
  assert.equal((await api("GET", "/api/ielts/student/tests/nope/reading", { auth: token })).status, 404);
});

test("a listening section is marked, stored part by part, and pays XP and chunks once", async () => {
  const t2 = seededTest("PT2");
  const before = await balance(token);
  const res = await api("POST", `/api/ielts/student/tests/${t2.id}/listening/submit`, { auth: token, body: { answers: sheet(t2.id, "listening", 4), seconds: 1500 } });
  assert.equal(res.status, 200);
  assert.equal(res.data.correct, 36);
  assert.equal(res.data.total, 40);
  assert.equal(res.data.band, 8);
  assert.deepEqual(res.data.parts.map((p) => [p.number, p.correct, p.total]), [[1, 6, 10], [2, 10, 10], [3, 10, 10], [4, 10, 10]]);
  assert.deepEqual(res.data.rows.filter((r) => !r.correct).map((r) => r.n), [1, 2, 3, 4]);
  assert.deepEqual(res.data.keys["T2L1-b1"], ["Tennant"]);
  assert.equal(Object.keys(res.data.transcripts).length, 4);
  assert.deepEqual(res.data.bonus, { section: CHUNKS.ieltsSection, whole: 0 });
  // XP by part and level (easy, medium, medium, hard), as in section practice.
  const levels = ["EASY", "MEDIUM", "MEDIUM", "HARD"];
  const worth = [6, 10, 10, 10].reduce((sum, n, i) => sum + XP.ieltsPart + n * XP.ieltsCorrect[levels[i]], 0);
  assert.equal(res.data.reward.xpGained, worth);
  // The first work of the day and the first trophy pay too; the section's own share is in there.
  assert.ok(res.data.reward.chunksGained >= CHUNKS.ieltsSection);
  assert.equal(await balance(token), before + res.data.reward.chunksGained);

  const db = readDB();
  const row = db.ieltsTestAttempts.find((a) => a.id === res.data.attemptId);
  assert.equal(row.testId, t2.id);
  assert.equal(row.correct, 36);
  assert.equal(row.partAttemptIds.length, 4);
  const parts = db.ieltsPracticeAttempts.filter((a) => a.testAttemptId === row.id);
  assert.deepEqual(parts.map((a) => [a.number, a.correct, a.total]), [[1, 6, 10], [2, 10, 10], [3, 10, 10], [4, 10, 10]]);
  // The rows are about the test's own parts, so section practice knows nothing of them: its four
  // listening parts are still untried, and nothing of the test is in its list or its history.
  assert.ok(parts.every((a) => db.ieltsListening.find((r) => r.id === a.refId).testId === t2.id));
  const practice = (await api("GET", "/api/ielts/student/practice", { auth: token })).data;
  assert.equal(practice.listening.length, 4);
  assert.equal(practice.listening.filter((i) => i.attempts > 0).length, 0);
  assert.deepEqual([practice.stats.attempts, practice.recent.length], [0, 0]);

  // Again, perfectly: only the four answers that improved earn XP, and no chunks a second time.
  const again = await api("POST", `/api/ielts/student/tests/${t2.id}/listening/submit`, { auth: token, body: { answers: sheet(t2.id, "listening") } });
  assert.equal(again.data.correct, 40);
  assert.equal(again.data.reward.xpGained, 4 * XP.ieltsCorrect.EASY);
  assert.deepEqual(again.data.bonus, { section: 0, whole: 0 });
  assert.equal(again.data.reward.chunksGained, 0);

  const list = (await api("GET", "/api/ielts/student/tests", { auth: token })).data;
  const view = list.tests.find((t) => t.id === t2.id);
  assert.equal(view.sections.listening.attempts, 2);
  assert.deepEqual(view.sections.listening.best, { id: again.data.attemptId, correct: 40, total: 40, band: 9 });
  assert.equal(view.done, 1);
  assert.equal(view.estimate, null, "an estimate needs Reading too");
  assert.equal(list.recent[0].id, again.data.attemptId);
});

test("a section handed in almost empty is stored but pays no chunks", async () => {
  const t1 = seededTest("PT1");
  const start = await balance(other);
  const res = await api("POST", `/api/ielts/student/tests/${t1.id}/reading/submit`, { auth: other, body: { answers: sheet(t1.id, "reading", 35) } });
  assert.equal(res.status, 200);
  assert.equal(res.data.correct, 5);
  assert.deepEqual(res.data.bonus, { section: 0, whole: 0 });
  // Whatever else the first study of a day pays, the section itself pays nothing.
  assert.equal((await balance(other)) - start, res.data.reward.chunksGained);
  assert.deepEqual(readDB().progress.find((p) => p.userId === readDB().users.find((u) => u.email === "omar@test.dev").id).ieltsTests[t1.id], []);
  // A proper attempt later still earns the section's chunks.
  const good = await api("POST", `/api/ielts/student/tests/${t1.id}/reading/submit`, { auth: other, body: { answers: sheet(t1.id, "reading", 20) } });
  assert.equal(good.data.correct, 20);
  assert.equal(good.data.bonus.section, CHUNKS.ieltsSection);
});

test("writing is checked task by task, and the whole test pays its bonus once", async () => {
  const t2 = seededTest("PT2");
  const db = readDB();
  const [w1, w2] = T.sectionRecords(db, T.findTest(db, t2.id), "writing");

  // Too short: stored, checked, no chunks.
  const short = await api("POST", `/api/ielts/student/tests/${t2.id}/writing/submit`, { auth: token, body: { answers: { [w1.id]: essayOf(160), [w2.id]: "In my view, no." } } });
  assert.equal(short.status, 200);
  assert.deepEqual(short.data.essays.map((e) => [e.task, e.feedback.minWords, e.feedback.words >= e.feedback.minWords]), [[1, 150, true], [2, 250, false]]);
  assert.match(short.data.essays[0].modelAnswerHtml, /line graph/);
  assert.equal(short.data.essays[1].feedback.checks.find((c) => c.title === "Your position").ok, true);
  assert.deepEqual(short.data.bonus, { section: 0, whole: 0 });

  const reading = await api("POST", `/api/ielts/student/tests/${t2.id}/reading/submit`, { auth: token, body: { answers: sheet(t2.id, "reading", 10) } });
  assert.equal(reading.data.correct, 30);
  assert.equal(reading.data.band, 7);
  assert.deepEqual(reading.data.bonus, { section: CHUNKS.ieltsSection, whole: 0 });

  // Both essays long enough: the section pays, and with Listening and Reading done, so does the test.
  const full = await api("POST", `/api/ielts/student/tests/${t2.id}/writing/submit`, { auth: token, body: { answers: { [w1.id]: essayOf(170), [w2.id]: essayOf(260) } } });
  assert.deepEqual(full.data.bonus, { section: CHUNKS.ieltsSection, whole: CHUNKS.ieltsTest });
  assert.equal(full.data.reward.chunksGained, CHUNKS.ieltsSection + CHUNKS.ieltsTest);
  assert.equal(full.data.test.done, 3);
  // Listening 9.0 and Reading 7.0: the mean, rounded the IELTS way.
  assert.equal(full.data.test.estimate, 8);
  const once = await api("POST", `/api/ielts/student/tests/${t2.id}/writing/submit`, { auth: token, body: { answers: { [w1.id]: essayOf(170), [w2.id]: essayOf(260) } } });
  assert.deepEqual(once.data.bonus, { section: 0, whole: 0 });

  const stats = (await api("GET", "/api/ielts/student/tests", { auth: token })).data.stats;
  assert.equal(stats.finished, 1);
  assert.equal(stats.bestEstimate, 8);
  const wallet = (await api("GET", "/api/practice/shop", { auth: token })).data;
  assert.ok(wallet.log.some((l) => l.why === "Finished: Practice Test 2" && l.n === CHUNKS.ieltsTest));
});

test("a finished section can be opened again, by its owner only", async () => {
  const mine = (await api("GET", "/api/ielts/student/tests", { auth: token })).data.recent;
  const listening = mine.find((a) => a.kind === "listening");
  const review = await api("GET", `/api/ielts/student/tests/attempts/${listening.id}`, { auth: token });
  assert.equal(review.status, 200);
  assert.equal(review.data.attempt.kind, "listening");
  assert.equal(review.data.correct, listening.correct);
  assert.equal(review.data.rows.length, 40);
  assert.equal(review.data.section.parts.length, 4);
  assert.equal(review.data.answers["T2L1-b1"], "Tennant");
  assert.deepEqual(review.data.keys["T2L4-b40"], ["chemical"]);
  // The questions come without the key; the key is in `keys`, for the marks.
  assert.ok(!JSON.stringify(review.data.section).includes('"answers"'));
  assert.equal((await api("GET", `/api/ielts/student/tests/attempts/${listening.id}`, { auth: other })).status, 404);

  const writing = mine.find((a) => a.kind === "writing");
  const essays = (await api("GET", `/api/ielts/student/tests/attempts/${writing.id}`, { auth: token })).data;
  assert.equal(essays.essays.length, 2);
  assert.ok(essays.essays.every((e) => e.modelAnswerHtml && e.feedback.checks.length));
});

test("a test's parts are its own: a diagnostic never takes one, and a part switched off drops out", async () => {
  // A diagnostic is a section-practice part, so it can't close a section of a practice test.
  const fresh = await register("Pia");
  const diag = (await api("POST", "/api/ielts/student/diagnostic/start", { auth: fresh })).data;
  const refId = readDB().ieltsDiagnostics.find((d) => d.id === (diag.diagnostic?.id || diag.id)).refId;
  const db = readDB();
  assert.ok(!db.ieltsPracticeTests.some((t) => ["listening", "reading"].some((k) => t.parts[k].includes(refId))));
  for (const t of (await api("GET", "/api/ielts/student/tests", { auth: fresh })).data.tests) {
    for (const kind of ["listening", "reading"]) {
      assert.equal(t.sections[kind].inDiagnostic, false);
      assert.equal((await api("GET", `/api/ielts/student/tests/${t.id}/${kind}`, { auth: fresh })).status, 200);
    }
  }
  // No record is in a test and in section practice, a mock or another test at once.
  const used = new Map();
  for (const t of db.ieltsPracticeTests) {
    for (const kind of T.TEST_KINDS) {
      for (const id of t.parts[kind]) {
        assert.ok(!used.has(id), "one test only");
        used.set(id, t.id);
        const record = db[{ listening: "ieltsListening", reading: "ieltsReading", writing: "ieltsWriting" }[kind]].find((r) => r.id === id);
        assert.deepEqual([record.use, record.testId], ["test", t.id]);
      }
    }
  }
  assert.equal(used.size, 18);

  // The first test's material is also the section-practice set: two records, changed apart.
  const t1 = seededTest("PT1");
  const own = db.ieltsReading.find((r) => r.seedKey === "PT1:PR3");
  const practice = db.ieltsReading.find((r) => r.seedKey === "PR3");
  assert.notEqual(own.id, practice.id);
  assert.deepEqual([own.title, practice.use], [practice.title, "practice"]);
  // Taking the practice passage away changes nothing in the test…
  updateDB((d) => {
    d.ieltsReading.find((r) => r.seedKey === "PR3").use = "mock";
  });
  assert.equal((await api("GET", `/api/ielts/student/tests/${t1.id}/reading`, { auth: token })).data.section.parts.length, 3);
  updateDB((d) => {
    d.ieltsReading.find((r) => r.seedKey === "PR3").use = "practice";
  });
  // …and switching the test's own passage off makes the section shorter; the test still works.
  updateDB((d) => {
    d.ieltsReading.find((r) => r.seedKey === "PT1:PR3").active = false;
  });
  const section = (await api("GET", `/api/ielts/student/tests/${t1.id}/reading`, { auth: token })).data.section;
  assert.equal(section.parts.length, 2);
  assert.equal(section.totalQuestions, 26);
  assert.equal((await api("GET", "/api/ielts/student/practice", { auth: token })).data.reading.length, 3);
  updateDB((d) => {
    d.ieltsReading.find((r) => r.seedKey === "PT1:PR3").active = true;
  });
});

test("analytics come from the work handed in: skills, question types and parts", async () => {
  assert.equal((await api("GET", "/api/ielts/student/analytics")).status, 401);
  const { status, data } = await api("GET", "/api/ielts/student/analytics", { auth: token });
  assert.equal(status, 200);
  assert.equal(data.target, 7);
  // Nora: Listening of Test 2 twice (36, then 40), Reading once (30), Writing three times.
  assert.equal(data.skills.listening.attempts, 8);
  assert.equal(data.skills.listening.correct, 76);
  assert.equal(data.skills.listening.questions, 80);
  assert.deepEqual(data.skills.listening.estimate, { band: 9, correct: 40, total: 40 });
  assert.equal(data.skills.listening.trend.length, 8);
  assert.equal(data.skills.reading.attempts, 3);
  assert.deepEqual(data.skills.reading.estimate, { band: 7, correct: 30, total: 40 });
  assert.equal(data.skills.writing.attempts, 6);
  assert.ok(data.skills.writing.averageWords > 0);
  assert.equal(data.totals.questions, 120);
  assert.equal(data.totals.correct, 106);
  assert.equal(data.totals.accuracy, 88);
  assert.equal(data.totals.sections, 6);
  assert.equal(data.totals.days, 1);

  // Question types use the latest try at each part, so Listening counts as its perfect retake.
  const types = Object.fromEntries(data.types.map((t) => [t.type, t]));
  // Forms and notes: 20 of 20 in Listening parts 1 and 4, and 3 of the 6 notes in the first passage.
  assert.deepEqual([types.forms.correct, types.forms.total, types.forms.skill], [23, 26, "both"]);
  assert.deepEqual([types.tfng.correct, types.tfng.total, types.tfng.skill], [0, 7, "reading"]);
  assert.deepEqual([types.features.correct, types.features.total, types.features.skill], [9, 9, "listening"]);
  assert.equal(data.types[0].type, "tfng", "weakest first");
  assert.equal(data.focus.weakest.type, "tfng");
  assert.equal(data.focus.strongest.accuracy, 100);
  assert.deepEqual(data.parts.listening.map((p) => [p.number, p.correct, p.total]), [[1, 16, 20], [2, 20, 20], [3, 20, 20], [4, 20, 20]]);
  assert.deepEqual(data.parts.reading.map((p) => [p.number, p.correct, p.total]), [[1, 3, 13], [2, 13, 13], [3, 14, 14]]);
  assert.equal(data.recent.length, 10);
  assert.ok(data.recent.every((a) => a.testAttemptId));
  // Never the key, the essays or anybody else's work.
  const text = JSON.stringify(data);
  assert.ok(!text.includes('"answers"') && !text.includes('"essay"'));
  const fresh = (await api("GET", "/api/ielts/student/analytics", { auth: await register("Quinn") })).data;
  assert.equal(fresh.totals.attempts, 0);
  assert.deepEqual(fresh.types, []);
  assert.equal(fresh.focus, null);
  assert.equal(fresh.skills.listening.estimate, null);
});

test("the band calculator gets the tables the marking uses", async () => {
  const { rawToBand } = await import("./lib/scoring.js");
  const { status, data } = await api("GET", "/api/ielts/student/bands", { auth: token });
  assert.equal(status, 200);
  assert.equal(data.outOf, 40);
  for (const kind of ["listening", "reading"]) {
    for (let raw = 0; raw <= 40; raw++) {
      const fromTable = (data[kind].find(([min]) => raw >= min) || [0, 0])[1];
      assert.equal(fromTable, rawToBand(kind, raw, 40), `${kind} ${raw}`);
    }
  }
  assert.equal((await api("GET", "/api/ielts/student/bands")).status, 401);
});

test("the admin builds a test inside the test; teachers look; students get it once it is shown", async () => {
  const LIST = "/api/ielts/admin/tests";
  // Who may: students and visitors nothing; a teacher looks but changes nothing.
  for (const auth of [token, null]) assert.ok([401, 403].includes((await api("GET", LIST, { auth })).status));
  const forTeacher = await api("GET", LIST, { auth: teacherToken });
  assert.equal(forTeacher.status, 200);
  assert.deepEqual([forTeacher.data.canEdit, forTeacher.data.library, forTeacher.data.tests.length], [false, null, 2]);
  assert.equal((await api("POST", LIST, { auth: teacherToken, body: { title: "X" } })).status, 403);

  const listed = (await api("GET", LIST, { auth: adminToken })).data;
  assert.equal(listed.canEdit, true);
  assert.deepEqual(listed.tests.map((t) => [t.title, t.seeded, t.active, t.live, t.filled, t.of]), [["Practice Test 1", true, true, true, 9, 9], ["Practice Test 2", true, true, true, 9, 9]]);
  assert.deepEqual(listed.tests[0].slots.listening.map((s) => [s.number, Boolean(s.part)]), [[1, true], [2, true], [3, true], [4, true]]);
  // What can be copied in: section practice and mock material, never another test's own parts.
  assert.deepEqual([listed.library.listening.length, listed.library.reading.length, listed.library.writing.length], [10, 7, 8]);
  assert.ok(Object.values(listed.library).flat().every((o) => ["practice", "mock", "both"].includes(o.use)));
  assert.ok(listed.tests[1].attempts > 0 && listed.tests[1].students >= 1);
  assert.ok(!JSON.stringify(listed).includes('"answers"'));

  // A new test is a title: empty, and hidden until there is something to show.
  const create = (body) => api("POST", LIST, { auth: adminToken, body });
  assert.equal((await create({ title: "  " })).status, 400);
  const made = await create({ title: " Mixed Test ", description: "Two parts and a passage", level: "HARD" });
  assert.equal(made.status, 201);
  const id = made.data.id;
  assert.deepEqual([made.data.title, made.data.level, made.data.active, made.data.live, made.data.filled], ["Mixed Test", "HARD", false, false, 0]);
  assert.deepEqual([made.data.slots.listening.length, made.data.slots.reading.length, made.data.slots.writing.length], [4, 3, 2]);
  const show = (active) => api("PATCH", `${LIST}/${id}`, { auth: adminToken, body: { active } });
  assert.equal((await show(true)).status, 400, "nothing in it yet");
  assert.ok(!(await api("GET", "/api/ielts/student/tests", { auth: other })).data.tests.some((t) => t.id === id));

  // Step 1 of 2, the quick way: copy a part in. The copy is the test's own; the original stays put.
  const from = listed.library.listening.find((o) => o.number === 2 && o.use === "practice");
  const copyIn = (kind, source) => api("POST", `${LIST}/${id}/parts`, { auth: adminToken, body: { kind, from: source } });
  const copied = await copyIn("listening", from.id);
  assert.equal(copied.status, 201);
  const slot = copied.data.slots.listening[1].part;
  assert.deepEqual([slot.title, slot.questionCount, slot.ready], [from.title, 10, true]);
  assert.notEqual(slot.id, from.id);
  assert.equal((await copyIn("listening", from.id)).status, 409, "one part for each number");
  assert.equal((await copyIn("listening", slot.id)).status, 404, "a test's own part isn't in the library");
  assert.equal((await copyIn("speaking", from.id)).status, 400);
  let db = readDB();
  assert.deepEqual([db.ieltsListening.find((r) => r.id === from.id).use, db.ieltsListening.find((r) => r.id === from.id).testId], ["practice", undefined]);
  const copy = db.ieltsListening.find((r) => r.id === slot.id);
  assert.deepEqual([copy.use, copy.testId, copy.copiedFrom, copy.seedKey], ["test", id, from.id, undefined]);
  // A mock part can be copied too, and stays a mock part.
  const mock = listed.library.reading.find((o) => o.number === 3 && o.use === "mock");
  assert.equal((await copyIn("reading", mock.id)).status, 201);
  // (Mock material carries no `use`: mock is what a record is until it is given another.)
  assert.deepEqual([readDB().ieltsReading.find((r) => r.id === mock.id).use, readDB().ieltsReading.find((r) => r.id === mock.id).testId], [undefined, undefined]);

  // The other way: write a part in its editor, opened from the test. It is saved into the test.
  const SAVE = "/api/ielts/admin/content/reading/save";
  const passage = { part: 1, title: "Written for this test", contentHtml: "<p>A passage.</p>", durationMinutes: 20, level: "EASY", groups: structuredClone(db.ieltsReading.find((r) => r.seedKey === "PR1").groups), active: true, use: "mock" };
  const saved = await api("POST", SAVE, { auth: adminToken, body: { testId: id, globalTitle: "Mixed Test", parts: [passage] } });
  assert.equal(saved.status, 200);
  const written = saved.data.saved[0];
  assert.deepEqual([written.use, written.testId, written.part], ["test", id, 1]);
  const second = await api("POST", SAVE, { auth: adminToken, body: { testId: id, globalTitle: "Mixed Test", parts: [passage] } });
  assert.equal(second.status, 400);
  assert.match(second.data.error, /already has a part 1/);
  assert.equal((await api("POST", SAVE, { auth: adminToken, body: { testId: "nope", globalTitle: "X", parts: [passage] } })).status, 400);
  // Opened again from the test, the editor gets the test's passages together, and a save keeps them the test's.
  const opened = (await api("GET", `/api/ielts/admin/content/reading/${written.id}`, { auth: adminToken })).data;
  assert.deepEqual(opened.siblings.map((r) => r.part), [1, 3]);
  const resaved = await api("POST", SAVE, { auth: adminToken, body: { globalTitle: "Mixed Test", parts: [{ ...passage, id: written.id, title: "Written for this test, again" }] } });
  assert.deepEqual([resaved.data.saved[0].use, resaved.data.saved[0].testId], ["test", id]);
  // It can't be made practice or mock material from a list, and the lists don't show it.
  assert.equal((await api("PATCH", `/api/ielts/admin/content/reading/${written.id}`, { auth: adminToken, body: { use: "practice" } })).data.use, "test");
  const lists = {};
  for (const scope of ["", "practice", "mock"]) lists[scope] = (await api("GET", `/api/ielts/admin/content/reading${scope ? `?scope=${scope}` : ""}`, { auth: adminToken })).data;
  assert.deepEqual([lists[""].length, lists.practice.length, lists.mock.length], [7, 3, 4]);
  assert.ok(Object.values(lists).flat().every((i) => i.use !== "test"));
  assert.ok(lists.practice.every((i) => i.use === "practice") && lists.mock.every((i) => i.use === "mock"));

  const one = (await api("GET", `${LIST}/${id}`, { auth: adminToken })).data;
  assert.deepEqual([one.test.filled, one.test.sections.listening.questionCount, one.test.sections.reading.parts, one.test.sections.writing], [3, 10, 2, undefined]);
  assert.equal((await api("GET", `${LIST}/nope`, { auth: adminToken })).status, 404);

  // Step 2: show it. Students get it with the sections it has; teachers now see it too.
  assert.deepEqual([(await show(true)).data.live, (await api("GET", LIST, { auth: teacherToken })).data.tests.length], [true, 3]);
  let mine = (await api("GET", "/api/ielts/student/tests", { auth: other })).data.tests;
  const view = mine.find((t) => t.id === id);
  assert.deepEqual([Object.keys(view.sections), view.of], [["listening", "reading"], 2]);
  const section = (await api("GET", `/api/ielts/student/tests/${id}/reading`, { auth: other })).data.section;
  assert.deepEqual(section.parts.map((p) => p.partNumber), [1, 3]);
  assert.equal((await api("GET", `/api/ielts/student/tests/${id}/writing`, { auth: other })).status, 404);
  // Taking its Listening leaves the section-practice part it was copied from untried.
  const taken = await api("POST", `/api/ielts/student/tests/${id}/listening/submit`, { auth: other, body: { answers: sheet(id, "listening") } });
  assert.deepEqual([taken.data.correct, taken.data.total], [10, 10]);
  const practice = (await api("GET", "/api/ielts/student/practice", { auth: other })).data;
  assert.equal(practice.listening.find((i) => i.id === from.id).attempts, 0);

  // Results: the admin sees every student's sections; a teacher sees their class students' (none here).
  const results = (await api("GET", `${LIST}/results`, { auth: adminToken })).data;
  assert.equal(results.total, readDB().ieltsTestAttempts.length);
  assert.deepEqual([results.rows[0].id, results.rows[0].title, results.rows[0].kind, results.rows[0].student.name, results.rows[0].correct], [taken.data.attemptId, "Mixed Test", "listening", "Omar T", 10]);
  assert.ok(results.tests.some((t) => t.id === id));
  const detail = (await api("GET", `${LIST}/results/${taken.data.attemptId}`, { auth: adminToken })).data;
  assert.deepEqual([detail.correct, detail.total, detail.rows.length, detail.parts.length, detail.student.name], [10, 10, 10, 1, "Omar T"]);
  assert.ok(detail.rows.every((r) => r.correct && r.given && r.expected));
  const essay = results.rows.find((r) => r.kind === "writing");
  const essays = (await api("GET", `${LIST}/results/${essay.id}`, { auth: adminToken })).data;
  assert.deepEqual([essays.essays.length, essays.essays.every((e) => e.essay && e.checks.length)], [2, true]);
  assert.deepEqual((await api("GET", `${LIST}/results`, { auth: teacherToken })).data.rows, []);
  assert.equal((await api("GET", `${LIST}/results/${taken.data.attemptId}`, { auth: teacherToken })).status, 404);
  assert.ok([401, 403].includes((await api("GET", `${LIST}/results`, { auth: token })).status));

  // Changed, a part removed, hidden, deleted. A teacher can do none of it.
  for (const [method, url, body] of [["PUT", `${LIST}/${id}`, { title: "Z" }], ["PATCH", `${LIST}/${id}`, { active: false }], ["POST", `${LIST}/${id}/parts`, { kind: "writing", from: listed.library.writing[0].id }], ["DELETE", `${LIST}/${id}/parts/listening/${slot.id}`], ["DELETE", `${LIST}/${id}`]]) {
    assert.equal((await api(method, url, { auth: teacherToken, body })).status, 403, `${method} ${url}`);
  }
  const edited = await api("PUT", `${LIST}/${id}`, { auth: adminToken, body: { title: "Mixed Test B", level: "EASY" } });
  assert.deepEqual([edited.data.title, edited.data.level, edited.data.filled], ["Mixed Test B", "EASY", 3]);
  const removed = await api("DELETE", `${LIST}/${id}/parts/listening/${slot.id}`, { auth: adminToken });
  assert.deepEqual([removed.status, removed.data.slots.listening[1].part, removed.data.sections.listening], [200, null, undefined]);
  assert.ok(readDB().ieltsListening.find((r) => r.id === slot.id).deletedAt);
  // (The section a student finished is still theirs to review.)
  assert.equal((await api("GET", `/api/ielts/student/tests/attempts/${taken.data.attemptId}`, { auth: other })).status, 200);
  assert.equal((await show(false)).data.active, false);
  mine = (await api("GET", "/api/ielts/student/tests", { auth: other })).data.tests;
  assert.ok(!mine.some((t) => t.id === id));
  assert.equal((await api("GET", `/api/ielts/student/tests/${id}/reading`, { auth: other })).status, 404);
  assert.equal((await api("DELETE", `${LIST}/${id}`, { auth: adminToken })).status, 200);
  assert.equal((await api("DELETE", `${LIST}/${id}`, { auth: adminToken })).status, 404);
  db = readDB();
  assert.ok(db.ieltsReading.filter((r) => r.testId === id).every((r) => r.deletedAt), "its parts go with it");
  assert.ok(!db.ieltsReading.find((r) => r.id === mock.id).deletedAt);

  // A seeded test the admin changes stays that way after a restart.
  const t1 = seededTest("PT1");
  const renamed = await api("PUT", `${LIST}/${t1.id}`, { auth: adminToken, body: { title: "Starter Test" } });
  assert.deepEqual([renamed.data.title, renamed.data.seeded, renamed.data.filled], ["Starter Test", true, 9]);
  updateDB((d) => ensureIeltsPracticeTests(d));
  assert.equal(seededTest("PT1").title, "Starter Test");
  await api("PUT", `${LIST}/${t1.id}`, { auth: adminToken, body: { title: "Practice Test 1" } });
});

test("startup adds the seeded tests once and leaves a teacher's changes alone", () => {
  const db = readDB();
  const count = () => [db.ieltsListening.length, db.ieltsReading.length, db.ieltsWriting.length];
  const before = count();
  assert.deepEqual(ensureIeltsPracticeTests(db), { added: 0, updated: 0 });
  const t1 = db.ieltsPracticeTests.find((t) => t.seedKey === "PT1");
  const t2 = db.ieltsPracticeTests.find((t) => t.seedKey === "PT2");
  const id = t1.id;
  const parts = structuredClone(t1.parts);
  // (The studio test above saved this one, which marks it as changed by a teacher.)
  Object.assign(t1, { title: "Old", seedHash: "old", customized: false });
  Object.assign(t2, { title: "Teacher's", seedHash: "old", customized: true });
  assert.deepEqual(ensureIeltsPracticeTests(db), { added: 0, updated: 1 });
  assert.equal(t1.title, "Practice Test 1");
  assert.equal(t1.id, id);
  assert.deepEqual(t1.parts, parts);
  assert.equal(t2.title, "Teacher's");
  assert.deepEqual(count(), before, "no part is made twice");
  // A part of a seeded test that a teacher deleted stays out of the test.
  db.ieltsWriting.find((r) => r.seedKey === "PT1:PW3").deletedAt = "2026-10-13T00:00:00.000Z";
  ensureIeltsPracticeTests(db);
  assert.equal(t1.parts.writing.length, 1);
  assert.deepEqual(count(), before);
});

test("a database from before tests owned their parts is put right once, and nothing is lost", () => {
  const db = readDB();
  const lists = { listening: db.ieltsListening, reading: db.ieltsReading, writing: db.ieltsWriting };
  const t1 = db.ieltsPracticeTests.find((t) => t.seedKey === "PT1");
  const t2 = db.ieltsPracticeTests.find((t) => t.seedKey === "PT2");
  const seed1 = SEEDED_TESTS.find((t) => t.seedKey === "PT1");
  // Put the database back the way it was on the morning of 2026-10-13: both tests list
  // section-practice records, and the second test's material is in section practice.
  for (const kind of T.TEST_KINDS) {
    const list = lists[kind];
    for (const r of list.filter((x) => x.testId === t2.id)) {
      Object.assign(r, { use: "practice", seedKey: r.seedKey.split(":")[1], groupId: "seed-practice" });
      delete r.testId;
    }
    for (const r of list.filter((x) => x.testId === t1.id)) list.splice(list.indexOf(r), 1);
    t1.parts[kind] = seed1[kind].map((key) => list.find((r) => r.seedKey === key).id);
  }
  // A student had finished the first test's Listening then: its rows point at the practice parts.
  const user = db.users.find((u) => u.email === "nora@test.dev").id;
  const old = t1.parts.listening.slice();
  db.ieltsTestAttempts.push({ id: "old-attempt", userId: user, testId: t1.id, kind: "listening", correct: 30, total: 40, band: 7, createdAt: "2026-10-13T03:00:00.000Z" });
  old.forEach((refId, i) => db.ieltsPracticeAttempts.push({ id: `old-row-${i}`, userId: user, kind: "listening", refId, number: i + 1, correct: 7, total: 10, testAttemptId: "old-attempt", createdAt: "2026-10-13T03:00:00.000Z" }));
  // And they had done one of those parts in section practice as well: that row is practice's.
  db.ieltsPracticeAttempts.push({ id: "old-practice-row", userId: user, kind: "listening", refId: old[0], number: 1, correct: 9, total: 10, createdAt: "2026-10-12T03:00:00.000Z" });
  const practiceBefore = T.TEST_KINDS.map((k) => lists[k].filter((r) => r.use === "practice").length);
  assert.deepEqual(practiceBefore, [8, 6, 6]);

  assert.deepEqual(separateIeltsPracticeTests(db), { copied: 9, moved: 9 });
  // Section practice is the first set again; each test has its own nine.
  assert.deepEqual(T.TEST_KINDS.map((k) => lists[k].filter((r) => r.use === "practice").length), [4, 3, 4]);
  for (const t of [t1, t2]) {
    for (const kind of T.TEST_KINDS) assert.ok(t.parts[kind].every((id) => lists[kind].find((r) => r.id === id).testId === t.id));
    assert.equal(T.TEST_KINDS.reduce((n, k) => n + T.sectionRecords(db, t, k).length, 0), 9);
  }
  // The first test's parts are copies (new ids, the practice originals untouched); the second's
  // were handed over whole (same ids, so everything students did on them still fits).
  assert.ok(t1.parts.listening.every((id) => !old.includes(id)));
  assert.ok(old.every((id) => lists.listening.find((r) => r.id === id).use === "practice"));
  assert.deepEqual(lists.listening.filter((r) => r.testId === t1.id).map((r) => r.seedKey).sort(), ["PT1:PL1", "PT1:PL2", "PT1:PL3", "PT1:PL4"]);
  assert.deepEqual(lists.reading.filter((r) => r.testId === t2.id).map((r) => r.seedKey).sort(), ["PT2:T2R1", "PT2:T2R2", "PT2:T2R3"]);
  // The finished section follows the test; the practice attempt stays with practice.
  assert.deepEqual(db.ieltsPracticeAttempts.filter((a) => a.testAttemptId === "old-attempt").map((a) => a.refId), t1.parts.listening);
  assert.equal(db.ieltsPracticeAttempts.find((a) => a.id === "old-practice-row").refId, old[0]);
  const review = T.attemptReview(db, db.ieltsTestAttempts.find((a) => a.id === "old-attempt"));
  assert.equal(review.records.length, 4);

  // Once: the second time there is nothing to do, and the seed step finds every part in place.
  const count = () => T.TEST_KINDS.map((k) => lists[k].length);
  const after = count();
  assert.deepEqual(separateIeltsPracticeTests(db), { copied: 0, moved: 0 });
  assert.equal(ensureIeltsPracticeTests(db).added, 0);
  assert.deepEqual(count(), after);
});
