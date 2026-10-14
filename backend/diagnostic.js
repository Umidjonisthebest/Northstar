// SAT diagnostic test: a short, timed placement test that shows a new student
// where they are starting from. The form covers every content domain of both
// sections at a spread of difficulties and only uses questions the student
// has never met, in practice or in an earlier diagnostic. There are no hints
// and no answers until it is submitted. The result feeds the score estimate,
// the study plan (through the answers it records) and the mistakes queue.

import { XP, award, generatedXp, getProgress, logAnswer, recordAnswer, scaled } from "./gamification.js";
import { isCorrectAnswer, questionMedia } from "./grading.js";
import { SECTION_KEYS, SKILLS } from "./practiceSkills.js";
import { generateMath, hasGenerator, parseRemixId, remixId } from "./content/mathGen.js";
import { cancellation, cancelledView } from "./examLock.js";

// One slot per question: [domain, target difficulty]. Each section gets two
// easy, three medium and two hard questions.
export const BLUEPRINT = {
  "Reading & Writing": [
    ["Craft and Structure", "Easy"],
    ["Craft and Structure", "Medium"],
    ["Information and Ideas", "Medium"],
    ["Information and Ideas", "Hard"],
    ["Standard English Conventions", "Easy"],
    ["Standard English Conventions", "Hard"],
    ["Expression of Ideas", "Medium"]
  ],
  Math: [
    ["Algebra", "Easy"],
    ["Problem-Solving and Data Analysis", "Easy"],
    ["Algebra", "Medium"],
    ["Advanced Math", "Medium"],
    ["Geometry and Trigonometry", "Medium"],
    ["Advanced Math", "Hard"],
    ["Problem-Solving and Data Analysis", "Hard"]
  ]
};
export const MIN_QUESTIONS = 10;
// Seconds per question on the real test: R&W is 32 min for 27, Math 35 min for 22.
export const PACE = { "Reading & Writing": 71, Math: 95 };
export const GRACE_MS = 60_000;

// The blueprint asks for Easy, Medium and Hard only. A Challenging question can still land in a
// test as the last resort ("any unseen question in the section"), so it has a weight and a rank.
const WEIGHT = { Easy: 1, Medium: 2, Hard: 3, Challenging: 4 };
const LEVEL_ORDER = { Easy: 0, Medium: 1, Hard: 2, Challenging: 3 };
const NEAR = { Easy: ["Medium", "Hard"], Medium: ["Easy", "Hard"], Hard: ["Medium", "Easy"] };

// Starting level for a total score. Labels, not an official scale.
const PLACEMENT = [
  [1450, "Expert"],
  [1250, "Advanced"],
  [1050, "Intermediate"],
  [850, "Developing"],
  [0, "Foundation"]
];
export const placementFor = (total) => (total == null ? null : PLACEMENT.find(([min]) => total >= min)[1]);

const iso = (ms) => new Date(ms).toISOString();

function shuffled(list, rnd) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Admin-made questions can be half finished; those never go into a diagnostic.
export function isUsable(q) {
  if (!SKILLS[q.section]) return false;
  if ((q.type || "mcq") === "grid_in") return String(q.correctAnswer ?? "").trim() !== "";
  return Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length;
}

// Every question the student has already met: answered, explained, saved,
// flagged or noted in practice, or served in an earlier diagnostic.
export function seenQuestionIds(db, p, userId) {
  const seen = new Set([...Object.keys(p.answered || {}), ...(p.revealed || []), ...(p.saved || []), ...(p.flagged || []), ...Object.keys(p.notes || {})]);
  for (const d of db.diagnostics) if (d.userId === userId) for (const it of d.items || []) seen.add(it.id);
  return seen;
}

const itemOf = (q, gen) => ({ id: q.id, section: q.section, domain: q.domain, topic: q.topic, difficulty: q.difficulty, type: q.type || "mcq", ...(gen ? { gen: true } : {}) });

// A brand-new Math question for the slot, for students who have already used
// up that part of the bank. Generated questions are graded from their id.
function freshMath(domain, level, rnd, skillsUsed) {
  const skills = (SKILLS.Math[domain] || []).filter(hasGenerator);
  if (!skills.length) return null;
  const unused = skills.filter((s) => !skillsUsed.has(s));
  const list = unused.length ? unused : skills;
  const skill = list[Math.floor(rnd() * list.length)];
  const seed = 1 + Math.floor(rnd() * 2_000_000_000);
  const q = generateMath(skill, level, seed);
  return q ? { ...q, id: remixId(skill, level, seed) } : null;
}

// Picks the questions for a new diagnostic. Each slot wants its domain and
// difficulty with a skill not used yet in the section; when the student has
// already seen those, Math makes a fresh question and Reading & Writing falls
// back to a nearby difficulty, then to any unseen question in the section.
export function buildDiagnostic(db, p, userId, rnd = Math.random) {
  const seen = seenQuestionIds(db, p, userId);
  const items = [];
  for (const [section, slots] of Object.entries(BLUEPRINT)) {
    const pool = shuffled(
      db.practiceQuestions.filter((q) => q.section === section && isUsable(q) && !seen.has(q.id)),
      rnd
    );
    const taken = new Set();
    const skillsUsed = new Set();
    const find = (...tests) => {
      for (const test of tests) {
        const q = pool.find((x) => !taken.has(x.id) && test(x));
        if (q) return q;
      }
      return null;
    };
    const picked = [];
    for (const [domain, level] of slots) {
      const inSlot = (x) => x.domain === domain && x.difficulty === level;
      let q = find((x) => inSlot(x) && !skillsUsed.has(x.topic), inSlot);
      let gen = false;
      if (!q && section === "Math") {
        q = freshMath(domain, level, rnd, skillsUsed);
        gen = Boolean(q);
      }
      if (!q) {
        q = find(
          ...NEAR[level].map((l) => (x) => x.domain === domain && x.difficulty === l),
          (x) => x.difficulty === level && !skillsUsed.has(x.topic),
          (x) => x.difficulty === level,
          () => true
        );
      }
      if (!q) continue;
      taken.add(q.id);
      skillsUsed.add(q.topic);
      picked.push(itemOf(q, gen));
    }
    // Like the real test: R&W grouped by domain, easier questions first; Math from easier to harder.
    const domainRank = (d) => {
      const i = slots.findIndex(([dom]) => dom === d);
      return i < 0 ? 99 : i;
    };
    picked.sort(
      (a, b) => (section === "Math" ? 0 : domainRank(a.domain) - domainRank(b.domain)) || (LEVEL_ORDER[a.difficulty] ?? 1) - (LEVEL_ORDER[b.difficulty] ?? 1)
    );
    items.push(...picked);
  }
  return items;
}

export const limitSeconds = (items) => Math.ceil(items.reduce((s, it) => s + (PACE[it.section] || 90), 0) / 60) * 60;
export const remainingSeconds = (d, now = Date.now()) => Math.max(0, Math.round((Date.parse(d.deadline) - now) / 1000));
// Answers are accepted for a minute after the clock hits zero, for slow connections.
export const isOpen = (d, now = Date.now()) => d.status === "in_progress" && now <= Date.parse(d.deadline) + GRACE_MS;

export function questionFor(db, item) {
  if (item.gen) {
    const r = parseRemixId(item.id);
    const q = r ? generateMath(r.skill, r.level, r.seed) : null;
    return q ? { ...q, id: item.id } : null;
  }
  return db.practiceQuestions.find((q) => q.id === item.id) || null;
}

// What the test screen shows: no answer, skill or difficulty.
export function testQuestion(q, n) {
  const grid = (q.type || "mcq") === "grid_in";
  return {
    id: q.id,
    n,
    section: q.section,
    type: grid ? "grid_in" : "mcq",
    passage: q.passage || "",
    table: q.table || null,
    figure: q.figure || null,
    ...questionMedia(q),
    prompt: q.prompt,
    options: grid ? null : q.options
  };
}

// ---------- Input from the test screen ----------
export function cleanAnswers(d, input) {
  const out = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const it of d.items) {
    const v = input[it.id];
    if (v === undefined || v === null || v === "") continue;
    if (it.type === "grid_in") {
      const s = String(v).trim().slice(0, 12);
      if (s) out[it.id] = s;
    } else {
      const i = Number(v);
      if (Number.isInteger(i) && i >= 0 && i < 6) out[it.id] = i;
    }
  }
  return out;
}

export function cleanFlags(d, input) {
  if (!Array.isArray(input)) return [];
  const ids = new Set(d.items.map((it) => it.id));
  return [...new Set(input.map(String))].filter((id) => ids.has(id));
}

// Time on each question (ms). The screen sends running totals, so keep the larger value.
export function mergeTimes(d, input) {
  const out = { ...(d.times || {}) };
  if (!input || typeof input !== "object") return out;
  for (const it of d.items) {
    const ms = Math.round(Number(input[it.id]));
    if (Number.isFinite(ms) && ms > 0) out[it.id] = Math.max(out[it.id] || 0, Math.min(ms, 3_600_000));
  }
  return out;
}

// ---------- Marking ----------
export function gradeDiagnostic(db, d) {
  return d.items.map((it, i) => {
    const q = questionFor(db, it);
    const given = d.answers?.[it.id];
    const answered = given !== undefined && given !== null && String(given).trim() !== "";
    return {
      n: i + 1,
      id: it.id,
      section: it.section,
      domain: it.domain,
      topic: it.topic,
      difficulty: it.difficulty,
      gen: Boolean(it.gen),
      missing: !q,
      answered,
      correct: Boolean(q && answered && isCorrectAnswer(q, given)),
      ms: d.times?.[it.id] || 0
    };
  });
}

// Section scores weight harder questions more (easy 1, medium 2, hard 3) and
// map onto 200-800 the same way as the practice estimate (gamification.js).
export function scoreRows(rows) {
  const scored = rows.filter((r) => !r.missing);
  const sections = {};
  for (const [key, section] of Object.entries(SECTION_KEYS)) {
    const mine = scored.filter((r) => r.section === section);
    if (!mine.length) {
      sections[key] = null;
      continue;
    }
    const weight = mine.reduce((s, r) => s + (WEIGHT[r.difficulty] || 2), 0);
    const earned = mine.reduce((s, r) => s + (r.correct ? WEIGHT[r.difficulty] || 2 : 0), 0);
    const order = Object.keys(SKILLS[section]);
    const domains = [];
    for (const r of mine) {
      let dm = domains.find((x) => x.domain === r.domain);
      if (!dm) domains.push((dm = { domain: r.domain, correct: 0, total: 0 }));
      dm.total += 1;
      if (r.correct) dm.correct += 1;
    }
    const rank = (dm) => (order.includes(dm.domain) ? order.indexOf(dm.domain) : 99);
    domains.sort((a, b) => rank(a) - rank(b));
    sections[key] = { section, score: scaled(earned / weight), correct: mine.filter((r) => r.correct).length, total: mine.length, domains };
  }
  const total = sections.rw && sections.math ? sections.rw.score + sections.math.score : null;
  // Skills to work on first: missed easy questions before missed hard ones.
  const focus = new Map();
  for (const r of scored.filter((x) => !x.correct).sort((a, b) => (LEVEL_ORDER[a.difficulty] ?? 1) - (LEVEL_ORDER[b.difficulty] ?? 1))) {
    if (!focus.has(r.topic)) focus.set(r.topic, { skill: r.topic, section: r.section, domain: r.domain });
  }
  return {
    total,
    level: placementFor(total),
    sections,
    correct: scored.filter((r) => r.correct).length,
    answered: scored.filter((r) => r.answered).length,
    count: scored.length,
    focus: [...focus.values()].slice(0, 4)
  };
}

// Closes a diagnostic. It is recorded like practice: answered bank questions
// count as tried (so they never return in a diagnostic), misses go to the
// mistakes queue and the student earns XP.
// Some tests close without a score ("expired"), so they can't drag the
// estimate down: one submitted with nothing answered, and one the clock closed
// with fewer than half answered, which usually means the student walked away.
export function completeDiagnostic(db, d, { auto = false, now = Date.now() } = {}) {
  const rows = gradeDiagnostic(db, d);
  const started = Date.parse(d.startedAt);
  // A test closed because time ran out ended at the deadline, even if nobody
  // looked at it until later.
  const end = Math.max(started, auto ? Math.min(now, Date.parse(d.deadline)) : now);
  d.submittedAt = iso(end);
  d.auto = auto;
  d.seconds = Math.max(0, Math.min(d.limitSeconds || Infinity, Math.round((end - started) / 1000)));
  d.outcome = rows.map(({ id, answered, correct, missing }) => ({ id, answered, correct, missing }));
  const counted = rows.filter((r) => !r.missing);
  const answered = counted.filter((r) => r.answered).length;
  if (!answered || (auto && answered < Math.ceil(counted.length / 2))) {
    d.status = "expired";
    d.result = null;
    return { reward: null };
  }
  d.status = "completed";
  d.result = scoreRows(rows);

  const p = getProgress(db, d.userId);
  const firstEver = Object.keys(p.answered).length === 0;
  // Log each answer at about the time it was given, so the study-session
  // timeline shows the diagnostic with its real length.
  const spent = rows.reduce((s, r) => s + r.ms, 0);
  let clock = started;
  let xp = XP.diagnostic;
  rows.forEach((r, i) => {
    clock = spent ? Math.min(end, clock + r.ms) : started + ((end - started) * (i + 1)) / rows.length;
    if (!r.answered || r.missing) return;
    if (r.gen) {
      if (r.correct) xp += generatedXp(r.difficulty);
      return;
    }
    const at = iso(clock);
    // Paid by difficulty like a practice answer, so the question can't pay again later.
    xp += recordAnswer(p, r, { correct: r.correct, at }).xp;
    logAnswer(p, { q: r.id, at, ok: r.correct, ...(r.ms ? { ms: r.ms } : {}), d: 1 });
    if (!r.correct && !p.saved.includes(r.id)) p.saved.push(r.id);
  });
  const badges = ["pathfinder"];
  if (firstEver && Object.keys(p.answered).length) badges.push("first_steps");
  return { reward: award(p, xp, badges) };
}

// The student left the test page while the diagnostic was running (examLock.js): it is closed
// with no score. Nothing is recorded as practice and nothing is earned. Its questions still count
// as seen (seenQuestionIds), so the next diagnostic is made of new ones.
export function cancelDiagnostic(d, kind, now = Date.now()) {
  if (d.status !== "in_progress") return false;
  const started = Date.parse(d.startedAt);
  d.status = "cancelled";
  d.cancelled = cancellation(kind, {}, now);
  d.submittedAt = iso(Math.max(started, now));
  d.seconds = Math.max(0, Math.min(d.limitSeconds || Infinity, Math.round((now - started) / 1000)));
  d.result = null;
  return true;
}

// ---------- Summaries ----------
export function publicSummary(d) {
  return {
    id: d.id,
    status: d.status,
    cancelled: cancelledView(d.cancelled),
    startedAt: d.startedAt,
    submittedAt: d.submittedAt || null,
    auto: Boolean(d.auto),
    seconds: d.seconds ?? null,
    limitSeconds: d.limitSeconds,
    count: d.items.length,
    answered: d.outcome ? d.outcome.filter((o) => o.answered && !o.missing).length : Object.keys(d.answers || {}).length,
    total: d.result?.total ?? null,
    rw: d.result?.sections?.rw?.score ?? null,
    math: d.result?.sections?.math?.score ?? null,
    correct: d.result?.correct ?? null,
    level: d.result?.level ?? null
  };
}

export function latestDiagnostic(db, userId) {
  return (
    db.diagnostics
      .filter((d) => d.userId === userId && d.status === "completed" && d.result)
      .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))[0] || null
  );
}

// For the dashboard: a test in progress (or timed out and not yet closed) and the latest result.
export function diagnosticStatus(db, userId, now = Date.now()) {
  const open = db.diagnostics.find((d) => d.userId === userId && d.status === "in_progress");
  const latest = latestDiagnostic(db, userId);
  return {
    open: open ? { id: open.id, remainingSeconds: remainingSeconds(open, now), timedOut: !isOpen(open, now), count: open.items.length } : null,
    latest: latest ? publicSummary(latest) : null
  };
}

// Questions the practice player must not check or explain right now: they are
// in the student's running diagnostic.
export function lockedQuestionIds(db, userId, now = Date.now()) {
  const d = db.diagnostics.find((x) => x.userId === userId && isOpen(x, now));
  return new Set(d ? d.items.map((it) => it.id) : []);
}
