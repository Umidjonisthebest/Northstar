import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

// The skill constellation map: star states from a student's answers, the focus skill, and the
// layout file the page draws from (every skill must have a place in both layouts).
const dbPath = path.join(os.tmpdir(), `northstar-skillsky-test-db-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";

let server;
let base;
let planning;
let SKILLS;

before(async () => {
  planning = await import("./planning.js");
  ({ SKILLS } = await import("./practiceSkills.js"));
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

const allSkills = () => Object.values(SKILLS).flatMap((d) => Object.values(d).flat());

describe("star states", () => {
  test("go from new to mastered with answers and accuracy, and are never a penalty", () => {
    const { skillState } = planning;
    assert.equal(skillState(0, null), "new");
    assert.equal(skillState(1, 0), "started");
    assert.equal(skillState(2, 1), "started");
    assert.equal(skillState(3, 0), "learning");
    assert.equal(skillState(5, 0.6), "learning");
    assert.equal(skillState(5, 0.7), "strong");
    assert.equal(skillState(5, 1), "strong", "perfect, but too few answers to call it mastered");
    assert.equal(skillState(10, 0.9), "mastered");
    assert.equal(skillState(40, 0.89), "strong");
    assert.deepEqual(planning.SKILL_STATES, ["new", "started", "learning", "strong", "mastered"]);
  });

  test("the map has all 29 skills in 8 constellations, each with a state and a tip", async () => {
    const { SKILL_LESSONS } = await import("./practiceSkills.js");
    const sky = planning.skillSky(new Map(), 0.9, SKILL_LESSONS);
    assert.equal(sky.skills, 29);
    assert.equal(sky.constellations.length, 8);
    const names = sky.constellations.flatMap((c) => c.skills.map((k) => k.skill));
    assert.deepEqual(names.slice().sort(), allSkills().sort());
    for (const c of sky.constellations) for (const k of c.skills) {
      assert.equal(k.state, "new");
      assert.ok(k.tip && k.tip.length > 10, `${k.skill} has a tip`);
    }
    assert.equal(sky.counts.new, 29);
    // A brand-new student is pointed at the first skill, as something to try, not as a weakness.
    assert.equal(sky.focus.reason, "untried");
    assert.equal(sky.focus.skill, names[0]);
  });

  test("the marker sits on the skill worth the most points once there is enough data", () => {
    const stats = new Map([
      ["Boundaries", { attempts: 10, correct: 2 }], // weak, and a big domain
      ["Circles", { attempts: 10, correct: 5 }],
      ["Transitions", { attempts: 12, correct: 12 }],
      ["Inferences", { attempts: 2, correct: 0 }]
    ]);
    const sky = planning.skillSky(stats, 0.9, {});
    assert.equal(sky.focus.reason, "points");
    assert.equal(sky.focus.skill, "Boundaries");
    assert.ok(sky.focus.gain > 0);
    const find = (n) => sky.constellations.flatMap((c) => c.skills).find((k) => k.skill === n);
    assert.equal(find("Boundaries").state, "learning");
    assert.equal(find("Transitions").state, "mastered");
    assert.equal(find("Inferences").state, "started");
    assert.equal(find("Circles").state, "learning");
    assert.deepEqual(sky.counts, { new: 25, started: 1, learning: 2, strong: 0, mastered: 1 });
  });

  test("with everything at target the marker moves to what hasn't been tried", () => {
    const stats = new Map(allSkills().map((s) => [s, { attempts: 20, correct: 20 }]));
    const done = planning.skillSky(stats, 0.9, {});
    assert.equal(done.counts.mastered, 29);
    assert.equal(done.focus.reason, "review");
    stats.delete("Percentages");
    assert.deepEqual(planning.skillSky(stats, 0.9, {}).focus, { skill: "Percentages", reason: "untried", gain: null });
  });
});

describe("GET /api/practice/skill-sky", () => {
  test("needs a student, and returns that student's map", async () => {
    assert.equal((await fetch(`${base}/api/practice/skill-sky`)).status, 401);
    const reg = await (await fetch(`${base}/api/student/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: "Sky", email: `sky-${Date.now()}@test.local`, password: "password1" }) })).json();
    const res = await fetch(`${base}/api/practice/skill-sky`, { headers: { authorization: `Bearer ${reg.token}` } });
    assert.equal(res.status, 200);
    const sky = await res.json();
    assert.equal(sky.skills, 29);
    assert.equal(sky.counts.new, 29);
    assert.ok(sky.focus);
    assert.doesNotMatch(JSON.stringify(sky), /correctIndex|explanation/);
  });
});

describe("the page's layout file", () => {
  test("gives every domain a panel and every skill a place in it, inside the box, apart from its neighbours, with a short name", async () => {
    const { CONSTELLATIONS, PANEL, SHORT } = await import("../frontend/src/components/skillsky/layout.js");
    assert.deepEqual(CONSTELLATIONS.map((c) => c.domain).sort(), Object.values(SKILLS).flatMap((d) => Object.keys(d)).sort());
    let count = 0;
    for (const c of CONSTELLATIONS) {
      const box = PANEL[c.section];
      assert.ok(box, `${c.domain} has a panel size for its section`);
      assert.ok(SKILLS[c.section]?.[c.domain], `${c.domain} is filed under its real section`);
      const domainSkills = SKILLS[c.section][c.domain];
      assert.deepEqual(Object.keys(c.stars).sort(), domainSkills.slice().sort(), c.domain);
      const placed = [];
      for (const [name, [x, y]] of Object.entries(c.stars)) {
        // Room for the name under the star and for Nova and the "Next step" tag above it.
        assert.ok(x >= 45 && x <= box.w - 45 && y >= 85 && y <= box.h - 70, `${name} is inside its panel`);
        for (const p of placed) assert.ok(Math.hypot(p.x - x, p.y - y) >= 80, `${name} and ${p.name} are too close`);
        placed.push({ name, x, y });
        assert.ok(SHORT[name], `${name} has a short name`);
        for (const line of SHORT[name].split("\n")) assert.ok(line.length <= 12, `"${line}" fits under a star`);
      }
      for (const [a, b] of c.lines) assert.ok(a < domainSkills.length && b < domainSkills.length, `${c.domain} lines`);
      count += placed.length;
    }
    assert.equal(count, 29);
  });
});
