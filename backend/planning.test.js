// Study planning: the point-gap map and the plan back from test day as pure
// checks, then the SAT date setting and both endpoints over HTTP against a
// throwaway database.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

const dbPath = path.join(os.tmpdir(), `northstar-planning-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_AUTH_TOKEN = "";

let server;
let base;
let token;
let readDB;
let g;
let P;

before(async () => {
  ({ readDB } = await import("./db.js"));
  g = await import("./gamification.js");
  P = await import("./planning.js");
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  const reg = await api("/api/student/register", { method: "POST", body: { firstName: "Pia", lastName: "Plan", email: "pia-plan@test.local", password: "password1" } });
  token = reg.data.token;
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

const stats = (obj) => new Map(Object.entries(obj).map(([skill, [attempts, correct]]) => [skill, { attempts, correct }]));
const WED = "2026-09-30"; // a Wednesday

describe("the test blueprint", () => {
  test("54 Reading & Writing and 44 Math questions over the 29 skills", () => {
    const all = P.testBlueprint();
    assert.equal(all.length, 29);
    const sum = (section) => Math.round(all.filter((b) => b.section === section).reduce((s, b) => s + b.questions, 0) * 1000) / 1000;
    assert.equal(sum("Reading & Writing"), 54);
    assert.equal(sum("Math"), 44);
    // A domain's questions are shared evenly by its skills.
    assert.equal(all.find((b) => b.skill === "Boundaries").questions, 7);
    assert.equal(all.find((b) => b.skill === "Percentages").questions, 1);
  });
});

describe("point-gap map", () => {
  test("a skill's gain is its questions on the test times the distance to the target", () => {
    const map = P.gapMap(stats({ Boundaries: [10, 5], Transitions: [8, 8] }), 0.9);
    const sec = map.sections.find((s) => s.section === "Reading & Writing").domains.find((d) => d.domain === "Standard English Conventions");
    const boundaries = sec.skills.find((k) => k.skill === "Boundaries");
    assert.deepEqual([boundaries.questions, boundaries.accuracy, boundaries.enough, boundaries.gain], [7, 0.5, true, 2.8]);
    assert.equal(sec.gain, 2.8, "the domain adds up its measured skills");
    assert.equal(sec.questions, 14);
    const transitions = map.sections[0].domains.flatMap((d) => d.skills).find((k) => k.skill === "Transitions");
    assert.equal(transitions.gain, 0, "already above the target");
  });

  test("too few answers on a skill means no estimate, not a guess", () => {
    const map = P.gapMap(stats({ Inferences: [2, 0] }), 0.9);
    const inf = map.sections[0].domains.flatMap((d) => d.skills).find((k) => k.skill === "Inferences");
    assert.deepEqual([inf.enough, inf.gain, inf.accuracy], [false, null, 0]);
    assert.deepEqual(map.top, []);
    assert.equal(map.measured, 0);
    assert.equal(map.gain, 0);
  });

  test("the top three are the skills worth the most questions", () => {
    const map = P.gapMap(
      stats({
        Boundaries: [10, 5], // 7 questions x 0.4 = 2.8
        "Words in Context": [10, 3], // 5 x 0.6 = 3
        Percentages: [10, 0], // 1 x 0.9 = 0.9
        "Linear functions": [10, 6], // 3 x 0.3 = 0.9
        "Equivalent expressions": [10, 5], // 5 x 0.4 = 2
        Transitions: [10, 10]
      }),
      0.9
    );
    assert.deepEqual(map.top.map((t) => [t.skill, t.gain]), [
      ["Words in Context", 3],
      ["Boundaries", 2.8],
      ["Equivalent expressions", 2]
    ]);
    assert.equal(map.top[0].section, "Reading & Writing");
    assert.equal(map.measured, 6);
    assert.equal(map.gain, 9.6);
  });

  test("a different target accuracy changes the gains", () => {
    const s = stats({ Boundaries: [10, 8] });
    assert.equal(P.gapMap(s, 0.7).gain, 0);
    assert.equal(P.gapMap(s, 0.9).gain, 0.7);
    assert.equal(P.gapMap(s, 1).gain, 1.4);
    assert.equal(P.cleanTarget(0.42), 0.9);
    assert.equal(P.cleanTarget("0.8"), 0.8);
  });

  test("only raw question counts: nothing in it is a scaled score", () => {
    const text = JSON.stringify(P.gapMap(stats({ Boundaries: [10, 5] })));
    assert.doesNotMatch(text, /scaled|score|800|1600/i);
  });
});

describe("the plan back from test day", () => {
  const plan = (over = {}) => P.studyPlan({ stats: stats({}), examDay: g.dayOffset(WED, 31), today: WED, ...over });

  test("weeks run from today to the day before the test", () => {
    const p = plan();
    assert.equal(p.daysLeft, 31);
    assert.equal(p.weeksLeft, 5);
    assert.deepEqual(p.weeks.map((w) => [w.start, w.end, w.days]), [
      ["2026-09-30", "2026-10-04", 5],
      ["2026-10-05", "2026-10-11", 7],
      ["2026-10-12", "2026-10-18", 7],
      ["2026-10-19", "2026-10-25", 7],
      ["2026-10-26", "2026-10-30", 5]
    ]);
    assert.equal(p.weeks.reduce((s, w) => s + w.days, 0), 31);
    assert.deepEqual(p.weeks.map((w) => w.phase), ["build", "build", "sharpen", "sharpen", "final"]);
  });

  test("a week has up to three skills, never the same one twice, and the last week is lighter", () => {
    const p = plan();
    for (const w of p.weeks) {
      assert.ok(w.focus.length >= 1 && w.focus.length <= 3);
      assert.equal(new Set(w.focus.map((f) => f.skill)).size, w.focus.length);
    }
    assert.equal(p.weeks.at(-1).focus.length, 2);
    assert.deepEqual(p.weeks.at(-1).extras, ["mock", "mistakes", "rest"]);
    assert.deepEqual(p.weeks[0].focus[0].levels, ["Easy", "Medium"]);
    assert.deepEqual(p.weeks[2].focus[0].levels, ["Medium", "Hard"]);
  });

  test("it is weighted toward weak skills", () => {
    const weak = stats({ Boundaries: [20, 2], "Words in Context": [20, 19], "Linear functions": [20, 19] });
    const p = plan({ stats: weak, examDay: g.dayOffset(WED, 80) });
    const count = (skill) => p.weeks.reduce((n, w) => n + w.focus.filter((f) => f.skill === skill).length, 0);
    assert.equal(p.weeks[0].focus[0].skill, "Boundaries", "the weakest skill comes first");
    assert.ok(count("Boundaries") > count("Words in Context") * 2);
    assert.ok(count("Boundaries") > count("Linear functions"));
  });

  test("it recalculates as performance changes", () => {
    const before = plan({ stats: stats({ Boundaries: [20, 2] }) });
    const after = plan({ stats: stats({ Boundaries: [40, 39], Inferences: [20, 1] }) });
    assert.equal(before.weeks[0].focus[0].skill, "Boundaries");
    assert.equal(after.weeks[0].focus[0].skill, "Inferences");
    assert.ok(!after.weeks[0].focus.some((f) => f.skill === "Boundaries"));
  });

  test("a weak mock section pulls untried skills in that section forward", () => {
    const share = (mock) => {
      const p = plan({ mock, examDay: g.dayOffset(WED, 100) });
      const all = p.weeks.flatMap((w) => w.focus);
      return all.filter((f) => f.section === "Math").length / all.length;
    };
    assert.ok(share({ Math: 0.2, "Reading & Writing": 0.9 }) > share({}) + 0.1);
  });

  test("no plan without a date, or once the test day has come", () => {
    assert.deepEqual(plan({ examDay: null }).weeks, []);
    assert.equal(plan({ examDay: null }).daysLeft, null);
    assert.deepEqual(plan({ examDay: WED }).weeks, []);
    assert.equal(plan({ examDay: WED }).daysLeft, 0);
    assert.deepEqual(plan({ examDay: g.dayOffset(WED, -3) }).weeks, []);
  });

  test("the day before the test still gets a plan", () => {
    const p = plan({ examDay: g.dayOffset(WED, 1) });
    assert.equal(p.weeks.length, 1);
    assert.deepEqual([p.weeks[0].start, p.weeks[0].end, p.weeks[0].phase], [WED, WED, "final"]);
    assert.deepEqual(p.weeks[0].extras, ["mock", "mistakes"]);
  });

  test("a far-off date is planned a year ahead and says so", () => {
    const p = plan({ examDay: g.dayOffset(WED, 600) });
    assert.equal(p.weeks.length, 52);
    assert.equal(p.truncated, true);
    assert.ok(p.weeks.every((w) => w.phase !== "final"));
  });
});

describe("planning over HTTP", () => {
  const today = () => g.todayKey();

  test("until a date is chosen, the next official SAT date stands in", async () => {
    const { data } = await api("/api/practice/roadmap");
    assert.equal(data.exam.chosen, false);
    assert.equal(data.exam.custom, false);
    assert.ok(data.exam.daysLeft > 0);
    assert.equal(data.daysLeft, data.exam.daysLeft);
    assert.equal(data.today, today());
    assert.ok(data.officialDates.length >= 1);
    assert.equal(data.weeks[0].start, today());
    assert.equal(data.weeks.at(-1).end, g.dayOffset(data.exam.day, -1));
    assert.equal(data.basis.answers, 0);
  });

  test("the student sets their own SAT date, and the plan follows it", async () => {
    const day = g.dayOffset(today(), 45);
    const saved = await api("/api/practice/settings", { method: "PUT", body: { examDate: day } });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.examDate, day);
    const progress = (await api("/api/practice/progress")).data;
    assert.deepEqual([progress.nextExam.day, progress.nextExam.custom, progress.nextExam.chosen, progress.nextExam.daysLeft], [day, true, true, 45]);
    assert.equal(g.todayKey(new Date(progress.nextExam.iso)), day);
    const plan = (await api("/api/practice/roadmap")).data;
    assert.equal(plan.daysLeft, 45);
    assert.equal(plan.weeks.at(-1).end, g.dayOffset(day, -1));
    assert.equal(plan.weeks.at(-1).phase, "final");
  });

  test("dates in the past, too far ahead or malformed are refused", async () => {
    for (const examDate of [g.dayOffset(today(), -1), today(), g.dayOffset(today(), 900), "2027-13-45", "next spring"]) {
      const res = await api("/api/practice/settings", { method: "PUT", body: { examDate } });
      assert.equal(res.status, 400, examDate);
    }
    assert.equal((await api("/api/practice/progress")).data.nextExam.daysLeft, 45, "the saved date is untouched");
  });

  test("an official date can be chosen too, and clearing goes back to the next one", async () => {
    const official = (await api("/api/practice/progress")).data.satDates.at(-1);
    await api("/api/practice/settings", { method: "PUT", body: { examDate: official.iso } });
    let next = (await api("/api/practice/progress")).data.nextExam;
    assert.deepEqual([next.iso, next.custom, next.chosen], [official.iso, false, true]);
    await api("/api/practice/settings", { method: "PUT", body: { examDate: null } });
    next = (await api("/api/practice/progress")).data.nextExam;
    assert.equal(next.chosen, false);
  });

  test("the gap map starts empty and fills in from graded answers", async () => {
    const empty = (await api("/api/practice/gap-map")).data;
    assert.deepEqual([empty.top.length, empty.measured, empty.skills, empty.target], [0, 0, 29, 0.9]);
    assert.deepEqual(empty.sections.map((s) => s.questions), [54, 44]);
    assert.deepEqual((await api("/api/practice/progress")).data.worthMost, []);

    // Three wrong answers on one skill.
    const qs = readDB().practiceQuestions.filter((q) => q.topic === "Boundaries" && (q.type || "mcq") === "mcq").slice(0, 3);
    for (const q of qs) await api(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: (q.correctIndex + 1) % q.options.length } });
    const map = (await api("/api/practice/gap-map")).data;
    assert.deepEqual(map.top.map((t) => [t.skill, t.gain, t.accuracy]), [["Boundaries", 6.3, 0]]);
    assert.equal(map.answers, 3);
    assert.equal((await api("/api/practice/gap-map?target=1")).data.top[0].gain, 7);
    assert.equal((await api("/api/practice/progress")).data.worthMost[0].skill, "Boundaries");
    // And the plan now opens with that skill.
    const plan = (await api("/api/practice/roadmap")).data;
    assert.equal(plan.weeks[0].focus[0].skill, "Boundaries");
    assert.equal(plan.basis.answers, 3);
  });

  test("the target accuracy is a saved setting", async () => {
    const saved = await api("/api/practice/settings", { method: "PUT", body: { targetAccuracy: 0.8 } });
    assert.equal(saved.data.targetAccuracy, 0.8);
    assert.equal((await api("/api/practice/gap-map")).data.target, 0.8);
    assert.equal((await api("/api/practice/gap-map")).data.top[0].gain, 5.6);
    assert.equal((await api("/api/practice/settings", { method: "PUT", body: { targetAccuracy: 2 } })).data.targetAccuracy, 0.9);
  });

  test("both need a student token", async () => {
    assert.equal((await api("/api/practice/roadmap", { auth: "" })).status, 401);
    assert.equal((await api("/api/practice/gap-map", { auth: "" })).status, 401);
  });
});
