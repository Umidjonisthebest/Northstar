// SAT diagnostic test: the form covers every domain with only unseen
// questions, nothing leaks while it runs, and the result lands in progress,
// the score estimate and the mistakes queue. Pure checks of the form builder,
// then the HTTP flow against a throwaway database.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

const dbPath = path.join(os.tmpdir(), `northstar-diagnostic-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_AUTH_TOKEN = "";

let server;
let base;
let token;
let readDB;
let updateDB;
let lib;

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  const { default: app } = await import("./app.js");
  lib = await import("./diagnostic.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  token = (await register("Dana", "dana-diag@test.local")).token;
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
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function register(firstName, email) {
  const res = await api("/api/student/register", { method: "POST", auth: "", body: { firstName, lastName: "T", email, password: "password1" } });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return { token: res.data.token, id: res.data.user.id };
}

const emptyProgress = () => ({ answered: {}, revealed: [], saved: [], flagged: [], notes: {} });
const tally = (items, key) => items.reduce((m, it) => ({ ...m, [it[key]]: (m[it[key]] || 0) + 1 }), {});
const RW = "Reading & Writing";

// The right answer for a test question, looked up on the server side.
function keyFor(item) {
  const q = lib.questionFor(readDB(), item);
  return q.type === "grid_in" ? q.correctAnswer : q.correctIndex;
}
function wrongFor(item) {
  const q = lib.questionFor(readDB(), item);
  return q.type === "grid_in" ? "123456" : (q.correctIndex + 1) % q.options.length;
}

describe("building the form", () => {
  test("a new student gets 7 + 7 unseen questions over every domain and difficulty", () => {
    const db = readDB();
    for (let run = 0; run < 25; run++) {
      const items = lib.buildDiagnostic(db, emptyProgress(), "nobody");
      assert.equal(items.length, 14);
      assert.equal(new Set(items.map((i) => i.id)).size, 14);
      for (const [section, slots] of Object.entries(lib.BLUEPRINT)) {
        const mine = items.filter((i) => i.section === section);
        assert.equal(mine.length, 7);
        assert.deepEqual(tally(mine, "difficulty"), { Easy: 2, Medium: 3, Hard: 2 });
        assert.deepEqual(new Set(mine.map((i) => i.domain)), new Set(slots.map(([d]) => d)));
        assert.equal(new Set(mine.map((i) => i.topic)).size, 7, "one question per skill");
        assert.ok(mine.every((i) => !i.gen), "the bank is enough for a new student");
      }
      // Test order: R&W grouped by domain (Craft and Structure first), Math easy to hard.
      const rw = items.filter((i) => i.section === RW);
      assert.equal(rw[0].domain, "Craft and Structure");
      assert.equal(rw.at(-1).domain, "Expression of Ideas");
      assert.deepEqual(
        items.filter((i) => i.section === "Math").map((i) => i.difficulty),
        ["Easy", "Easy", "Medium", "Medium", "Medium", "Hard", "Hard"]
      );
      assert.equal(items[0].section, RW);
    }
    assert.equal(lib.limitSeconds(lib.buildDiagnostic(db, emptyProgress(), "nobody")), 20 * 60);
  });

  test("anything the student met in practice or an earlier diagnostic is never picked", () => {
    const db = readDB();
    const rw = db.practiceQuestions.filter((q) => q.section === RW);
    const p = {
      answered: { [rw[0].id]: { attempts: 1, correct: 1, lastCorrect: true, lastAt: new Date().toISOString() } },
      revealed: [rw[1].id],
      saved: [rw[2].id],
      flagged: [rw[3].id],
      notes: { [rw[4].id]: "trap!" }
    };
    db.diagnostics.push({ id: "old", userId: "u-seen", status: "completed", items: [{ id: rw[5].id }] });
    const banned = new Set(rw.slice(0, 6).map((q) => q.id));
    for (let run = 0; run < 40; run++) {
      for (const it of lib.buildDiagnostic(db, p, "u-seen")) assert.ok(!banned.has(it.id));
    }
  });

  test("when the bank runs low, Math is generated fresh and R&W uses what is left", () => {
    const db = readDB();
    const p = emptyProgress();
    const rwLeft = db.practiceQuestions.filter((q) => q.section === RW).slice(-4).map((q) => q.id);
    for (const q of db.practiceQuestions) if (!rwLeft.includes(q.id)) p.answered[q.id] = { attempts: 1, correct: 0, lastCorrect: false };
    const items = lib.buildDiagnostic(db, p, "u-low");
    const math = items.filter((i) => i.section === "Math");
    assert.equal(math.length, 7);
    assert.ok(math.every((i) => i.gen && /^rmx\./.test(i.id)));
    assert.deepEqual(tally(math, "difficulty"), { Easy: 2, Medium: 3, Hard: 2 });
    assert.deepEqual(items.filter((i) => i.section === RW).map((i) => i.id).sort(), rwLeft.slice().sort());
    // Generated questions are rebuilt from their id for marking.
    const q = lib.questionFor(db, math[0]);
    assert.equal(q.id, math[0].id);
    assert.ok(q.prompt && (q.type === "grid_in" ? q.correctAnswer != null : Number.isInteger(q.correctIndex)));

    // Two R&W questions left: 9 in total, which is too few for a fair test.
    p.answered[rwLeft[0]] = p.answered[rwLeft[1]] = { attempts: 1, correct: 1, lastCorrect: true };
    assert.ok(lib.buildDiagnostic(db, p, "u-low").length < lib.MIN_QUESTIONS);
  });

  test("scores weight harder questions and never go outside 200-800", () => {
    const row = (section, difficulty, correct) => ({ section, domain: "D", topic: `${section}-${difficulty}`, difficulty, answered: true, correct, missing: false });
    const all = (correct) => ["Easy", "Easy", "Medium", "Medium", "Medium", "Hard", "Hard"].flatMap((d) => [row(RW, d, correct), row("Math", d, correct)]);
    assert.equal(lib.scoreRows(all(true)).total, 1600);
    assert.equal(lib.scoreRows(all(false)).total, 400);
    const easyOnly = all(false).map((r) => ({ ...r, correct: r.difficulty === "Easy" }));
    const hardOnly = all(false).map((r) => ({ ...r, correct: r.difficulty === "Hard" }));
    const e = lib.scoreRows(easyOnly);
    assert.ok(lib.scoreRows(hardOnly).total > e.total);
    assert.equal(e.sections.rw.correct, 2);
    assert.equal(e.level, lib.placementFor(e.total));
    assert.ok(e.focus.length > 0 && e.focus.every((f) => !f.skill.endsWith("Easy")), "missed skills are the focus");
  });
});

describe("taking the diagnostic", () => {
  let diag;

  test("the overview needs a student and describes the next test", async () => {
    assert.equal((await api("/api/diagnostic", { auth: "" })).status, 401);
    const { status, data } = await api("/api/diagnostic");
    assert.equal(status, 200);
    assert.equal(data.open, null);
    assert.deepEqual(data.history, []);
    assert.deepEqual(data.next, { questions: 14, rw: 7, math: 7, minutes: 20 });
    assert.equal(data.canStart, true);
  });

  test("starting shows the questions without answers, and starting again resumes", async () => {
    const { status, data } = await api("/api/diagnostic/start", { method: "POST" });
    assert.equal(status, 200);
    diag = data.diagnostic;
    assert.equal(diag.status, "in_progress");
    assert.equal(diag.questions.length, 14);
    assert.deepEqual(diag.questions.map((q) => q.n), Array.from({ length: 14 }, (_, i) => i + 1));
    assert.ok(diag.remainingSeconds > 1190 && diag.remainingSeconds <= 1200);
    const text = JSON.stringify(diag.questions);
    for (const secret of ["correctIndex", "correctAnswer", "rationales", "explanation", "steps", "keyQuote", "hint", "difficulty", "topic"]) {
      assert.ok(!text.includes(`"${secret}"`), `${secret} must not be sent`);
    }
    const again = await api("/api/diagnostic/start", { method: "POST" });
    assert.equal(again.data.diagnostic.id, diag.id);
    assert.equal((await api("/api/diagnostic")).data.open.id, diag.id);
  });

  test("while it runs, its questions can't be checked, explained or discussed in practice", async () => {
    const stored = readDB().diagnostics.find((d) => d.id === diag.id);
    const bankItem = stored.items.find((it) => !it.gen);
    assert.equal((await api(`/api/practice/questions/${bankItem.id}/answer`, { method: "POST", body: { answer: 0 } })).status, 409);
    assert.equal((await api(`/api/practice/questions/${bankItem.id}/explanation`)).status, 409);
    assert.equal((await api("/api/practice/remix", { method: "POST", body: { questionId: bankItem.id } })).status, 409);
    assert.equal((await api("/api/practice/tutor", { method: "POST", body: { questionId: bankItem.id, message: "What's the answer?" } })).status, 409);
    // The reviewing view of the player stays empty until it's finished.
    assert.equal((await api(`/api/practice/questions?source=diagnostic&diag=${diag.id}`)).data.questions.length, 0);
    const other = readDB().practiceQuestions.find((q) => !stored.items.some((it) => it.id === q.id));
    assert.equal((await api(`/api/practice/questions/${other.id}/explanation`)).status, 200);
  });

  test("answers autosave, and only valid answers to its own questions are kept", async () => {
    const stored = readDB().diagnostics.find((d) => d.id === diag.id);
    const first = stored.items[0];
    const res = await api(`/api/diagnostic/${diag.id}/answers`, {
      method: "PUT",
      body: { answers: { [first.id]: keyFor(first), nope: 2 }, flags: [first.id, "nope"], times: { [first.id]: 42000 } }
    });
    assert.equal(res.status, 200);
    const saved = readDB().diagnostics.find((d) => d.id === diag.id);
    assert.deepEqual(saved.answers, { [first.id]: keyFor(first) });
    assert.deepEqual(saved.flags, [first.id]);
    assert.equal(saved.times[first.id], 42000);
    // A reload gets them back.
    const reload = (await api(`/api/diagnostic/${diag.id}`)).data.diagnostic;
    assert.deepEqual(reload.answers, saved.answers);
    assert.equal(reload.status, "in_progress");
  });

  test("submitting scores it and records it like practice", async () => {
    const stored = readDB().diagnostics.find((d) => d.id === diag.id);
    // Right on every R&W question, wrong on two Math questions, one Math question skipped.
    const answers = {};
    const math = stored.items.filter((it) => it.section === "Math");
    for (const it of stored.items) answers[it.id] = keyFor(it);
    answers[math[0].id] = wrongFor(math[0]);
    answers[math[1].id] = wrongFor(math[1]);
    delete answers[math[2].id];
    const before = readDB().progress.find((p) => p.userId === stored.userId);
    const { status, data } = await api(`/api/diagnostic/${diag.id}/submit`, { method: "POST", body: { answers, flags: [], times: {} } });
    assert.equal(status, 200);
    const d = data.diagnostic;
    assert.equal(d.status, "completed");
    assert.equal(d.result.sections.rw.score, 800);
    assert.equal(d.result.sections.rw.correct, 7);
    assert.equal(d.result.sections.math.correct, 4);
    assert.ok(d.result.sections.math.score < 800 && d.result.sections.math.score >= 200);
    assert.equal(d.total, d.result.sections.rw.score + d.result.sections.math.score);
    assert.equal(d.result.answered, 13);
    assert.ok(d.level);
    assert.equal(d.rows.length, 14);
    assert.deepEqual(d.rows.filter((r) => !r.correct).map((r) => r.id).sort(), [math[0].id, math[1].id, math[2].id].sort());
    assert.equal(d.rows.find((r) => r.id === math[2].id).answered, false);
    // XP by difficulty for each right answer, 1 for each first-time miss, plus the completion bonus.
    const { XP } = await import("./gamification.js");
    const expected = stored.items.reduce((s, it) => s + (it.id === math[2].id ? 0 : it.id === math[0].id || it.id === math[1].id ? XP.firstMiss : XP.question[it.difficulty]), XP.diagnostic);
    assert.equal(data.reward.xpGained, expected);
    assert.ok(data.reward.newBadges.some((b) => b.id === "pathfinder"));

    const p = readDB().progress.find((x) => x.userId === stored.userId);
    assert.equal(before?.answered?.[math[0].id], undefined);
    assert.equal(p.answered[math[0].id].lastCorrect, false);
    assert.equal(p.answered[stored.items[0].id].lastCorrect, true);
    assert.equal(p.answered[math[2].id], undefined, "a skipped question isn't tried");
    assert.ok(p.saved.includes(math[0].id) && p.saved.includes(math[1].id));
    assert.ok(!p.saved.includes(stored.items[0].id));
    assert.ok(p.answerLog.filter((e) => e.d).length >= 13);
    // Each right answer has now paid in full, so practising it later is a review.
    assert.equal(p.answered[stored.items[0].id].xp, XP.question[stored.items[0].difficulty]);

    // Submitting again is harmless.
    const again = await api(`/api/diagnostic/${diag.id}/submit`, { method: "POST", body: { answers: {} } });
    assert.equal(again.data.diagnostic.total, d.total);
    assert.equal(again.data.reward, null);
  });

  test("the dashboard uses it as the score estimate and the player can review it", async () => {
    const progress = (await api("/api/practice/progress")).data;
    const d = readDB().diagnostics.find((x) => x.id === diag.id);
    assert.equal(progress.estimate.total, d.result.total);
    assert.equal(progress.estimate.rw.source, "diagnostic test");
    assert.equal(progress.diagnostic.latest.id, diag.id);
    assert.equal(progress.diagnostic.open, null);
    assert.ok(progress.badges.find((b) => b.id === "pathfinder").earned);

    const review = await api(`/api/practice/questions?source=diagnostic&diag=${diag.id}&only=missed`);
    const missed = d.outcome.filter((o) => !o.correct).map((o) => o.id);
    const bankMissed = d.items.filter((it) => missed.includes(it.id) && !it.gen).map((it) => it.id);
    assert.deepEqual(review.data.questions.map((q) => q.id), bankMissed, "misses, in test order");
    const all = await api(`/api/practice/questions?source=diagnostic&diag=${diag.id}`);
    assert.deepEqual(all.data.questions.map((q) => q.id), d.items.filter((it) => !it.gen).map((it) => it.id));
    // Now that it's over, practice works on these questions again.
    assert.equal((await api(`/api/practice/questions/${missed[0]}/explanation`)).status, 200);

    const sessions = (await api("/api/practice/sessions")).data.sessions;
    assert.match(sessions[0].title, /Diagnostic Test$/);
  });

  test("a second diagnostic never repeats a question from the first", async () => {
    const first = readDB().diagnostics.find((x) => x.id === diag.id);
    const { data } = await api("/api/diagnostic/start", { method: "POST" });
    const second = data.diagnostic;
    assert.notEqual(second.id, diag.id);
    const old = new Set(first.items.map((it) => it.id));
    assert.ok(second.questions.every((q) => !old.has(q.id)));
    const history = (await api("/api/diagnostic")).data.history;
    assert.equal(history.length, 1);
    assert.equal(history[0].id, diag.id);
  });

  const expire = (id) =>
    updateDB((db) => {
      const d = db.diagnostics.find((x) => x.id === id);
      d.startedAt = new Date(Date.now() - 30 * 60000).toISOString();
      d.deadline = new Date(Date.now() - 5 * 60000).toISOString();
    });

  test("when time runs out it is closed with the saved answers, and scored if at least half are answered", async () => {
    const owner = readDB().diagnostics.find((x) => x.id === diag.id).userId;
    const open = readDB().diagnostics.find((d) => d.status === "in_progress" && d.userId === owner);
    const half = open.items.slice(0, 7);
    await api(`/api/diagnostic/${open.id}/answers`, { method: "PUT", body: { answers: Object.fromEntries(half.map((it) => [it.id, keyFor(it)])) } });
    expire(open.id);
    // Too late to change anything.
    const late = await api(`/api/diagnostic/${open.id}/answers`, { method: "PUT", body: { answers: {} } });
    assert.equal(late.status, 409);
    assert.equal(late.data.code, "TIME_UP");
    const closed = (await api(`/api/diagnostic/${open.id}`)).data.diagnostic;
    assert.equal(closed.status, "completed");
    assert.equal(closed.auto, true);
    assert.equal(closed.result.answered, 7);
    assert.equal(closed.seconds, closed.limitSeconds);
  });

  test("a test the clock closed with under half answered has no score, but a hand-in always counts", async () => {
    // Walked away after three answers: no score, so the estimate isn't dragged down.
    const other = await register("Omar", "omar-diag@test.local");
    const started = (await api("/api/diagnostic/start", { method: "POST", auth: other.token })).data.diagnostic;
    const three = readDB().diagnostics.find((x) => x.id === started.id).items.slice(0, 3);
    await api(`/api/diagnostic/${started.id}/answers`, { method: "PUT", auth: other.token, body: { answers: Object.fromEntries(three.map((it) => [it.id, keyFor(it)])) } });
    expire(started.id);
    const overview = (await api("/api/diagnostic", { auth: other.token })).data;
    assert.equal(overview.open, null);
    assert.equal(overview.history[0].status, "expired");
    assert.equal(overview.history[0].total, null);
    assert.equal(overview.history[0].answered, 3);
    assert.equal((await api("/api/practice/progress", { auth: other.token })).data.estimate.total, null);
    assert.equal(readDB().progress.find((p) => p.userId === other.id)?.answered?.[three[0].id], undefined, "nothing is recorded from it");

    // Handing a test in yourself is scored, even with one answer (the screen warns about the rest).
    const next = (await api("/api/diagnostic/start", { method: "POST", auth: other.token })).data.diagnostic;
    assert.ok(next.questions.every((q) => !three.some((it) => it.id === q.id)), "an unscored test's questions don't come back either");
    const one = readDB().diagnostics.find((x) => x.id === next.id).items[0];
    const handed = (await api(`/api/diagnostic/${next.id}/submit`, { method: "POST", auth: other.token, body: { answers: { [one.id]: keyFor(one) } } })).data.diagnostic;
    assert.equal(handed.status, "completed");
    assert.equal(handed.result.answered, 1);
    const empty = await register("Zed", "zed-diag@test.local");
    const blank = (await api("/api/diagnostic/start", { method: "POST", auth: empty.token })).data.diagnostic;
    const res = (await api(`/api/diagnostic/${blank.id}/submit`, { method: "POST", auth: empty.token, body: { answers: {} } })).data;
    assert.equal(res.diagnostic.status, "expired");
    assert.equal(res.reward, null);
  });

  test("students who have used up the bank are told why they can't start", async () => {
    const heavy = await register("Hana", "hana-diag@test.local");
    const { getProgress } = await import("./gamification.js");
    updateDB((db) => {
      const p = getProgress(db, heavy.id);
      for (const q of db.practiceQuestions.filter((x) => x.section === RW)) p.answered[q.id] = { attempts: 1, correct: 1, lastCorrect: true, lastAt: new Date().toISOString() };
    });
    const overview = (await api("/api/diagnostic", { auth: heavy.token })).data;
    assert.equal(overview.canStart, false);
    assert.match(overview.reason, /Reading & Writing/);
    assert.equal((await api("/api/diagnostic/start", { method: "POST", auth: heavy.token })).status, 409);
  });

  test("other students can't see someone's diagnostic, and teachers see it on the profile", async () => {
    const other = await register("Lola", "lola-diag@test.local");
    assert.equal((await api(`/api/diagnostic/${diag.id}`, { auth: other.token })).status, 404);
    assert.equal((await api(`/api/diagnostic/${diag.id}/submit`, { method: "POST", auth: other.token })).status, 404);

    const bcrypt = (await import("bcryptjs")).default;
    updateDB((db) => {
      db.users.push({ id: "admin-diag", role: "admin", firstName: "T", lastName: "A", email: "admin-diag@test.local", passwordHash: bcrypt.hashSync("adminpass123", 4) });
    });
    const admin = (await api("/api/auth/admin/login", { method: "POST", auth: "", body: { email: "admin-diag@test.local", password: "adminpass123" } })).data.token;
    const owner = readDB().diagnostics.find((x) => x.id === diag.id).userId;
    const profile = (await api(`/api/admin/students/${owner}`, { auth: admin })).data;
    const row = profile.diagnostics.find((x) => x.id === diag.id);
    assert.equal(row.exam, "sat");
    assert.equal(row.total, readDB().diagnostics.find((x) => x.id === diag.id).result.total);
  });
});
