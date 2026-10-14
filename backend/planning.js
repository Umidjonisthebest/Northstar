// Study planning: the week-by-week plan from today to the student's SAT date,
// and the point-gap map. Both are worked out from the student's own answers
// each time they are asked for, so they follow performance. Nothing here is
// stored, and nothing here is a score prediction: gains are counted in raw
// questions on test day, never in scaled scores.

import { SKILLS } from "./practiceSkills.js";
import { dayDiff, dayOffset, weekKey } from "./gamification.js";

// Questions per domain on the digital SAT (54 Reading & Writing, 44 Math),
// from the College Board's published domain weights. Within a domain the
// questions are split evenly over its skills, which is an estimate: the
// per-skill mix isn't published.
export const DOMAIN_QUESTIONS = {
  "Reading & Writing": { "Craft and Structure": 15, "Information and Ideas": 14, "Standard English Conventions": 14, "Expression of Ideas": 11 },
  Math: { Algebra: 15, "Advanced Math": 15, "Problem-Solving and Data Analysis": 7, "Geometry and Trigonometry": 7 }
};

export const TARGET_ACCURACIES = [0.7, 0.8, 0.9, 1];
export const DEFAULT_TARGET = 0.9;
export const MIN_ANSWERS = 3; // answers on a skill before its accuracy is used in the gap map
const PRIOR_ANSWERS = 4; // how strongly the section's general level stands in for a skill with few answers
const PRIOR_ACCURACY = 0.6;
const MAX_WEEKS = 52;
const SLOT_QUESTIONS = { build: 10, sharpen: 12, final: 10 };
const LEVELS = { build: ["Easy", "Medium"], sharpen: ["Medium", "Hard"], final: ["Medium", "Hard"] };

const round1 = (x) => Math.round(x * 10) / 10;
export const cleanTarget = (t) => (TARGET_ACCURACIES.includes(Number(t)) ? Number(t) : DEFAULT_TARGET);

// Every skill in the taxonomy with its estimated number of questions on the test.
export function testBlueprint() {
  const out = [];
  for (const [section, domains] of Object.entries(SKILLS)) {
    for (const [domain, skills] of Object.entries(domains)) {
      for (const skill of skills) out.push({ section, domain, skill, questions: (DOMAIN_QUESTIONS[section]?.[domain] || 0) / skills.length });
    }
  }
  return out;
}

// ---------- Point-gap map ----------
// For each skill: the student's accuracy, and how many more questions they
// would get right on test day at the target accuracy. `stats` maps a skill to
// { attempts, correct } from practice (including diagnostic tests).
export function gapMap(stats, target = DEFAULT_TARGET) {
  const rows = testBlueprint().map((b) => {
    const s = stats.get(b.skill) || { attempts: 0, correct: 0 };
    const accuracy = s.attempts ? s.correct / s.attempts : null;
    const enough = s.attempts >= MIN_ANSWERS;
    return { ...b, attempts: s.attempts, correct: s.correct, accuracy, enough, gain: enough ? b.questions * Math.max(0, target - accuracy) : null };
  });
  const sections = Object.entries(SKILLS).map(([section, domains]) => {
    const list = Object.keys(domains).map((domain) => {
      const skills = rows.filter((r) => r.section === section && r.domain === domain);
      const attempts = skills.reduce((s, r) => s + r.attempts, 0);
      const correct = skills.reduce((s, r) => s + r.correct, 0);
      const measured = skills.filter((r) => r.enough);
      return {
        domain,
        questions: DOMAIN_QUESTIONS[section]?.[domain] || 0,
        attempts,
        accuracy: attempts ? correct / attempts : null,
        gain: measured.length ? round1(measured.reduce((s, r) => s + r.gain, 0)) : null,
        skills: skills.map((r) => ({ skill: r.skill, questions: round1(r.questions), attempts: r.attempts, accuracy: r.accuracy, enough: r.enough, gain: r.gain == null ? null : round1(r.gain) }))
      };
    });
    return { section, questions: list.reduce((s, d) => s + d.questions, 0), domains: list };
  });
  const top = rows
    .filter((r) => r.enough && r.gain > 0)
    .sort((a, b) => b.gain - a.gain || a.accuracy - b.accuracy)
    .slice(0, 3)
    .map((r) => ({ skill: r.skill, section: r.section, domain: r.domain, accuracy: r.accuracy, attempts: r.attempts, questions: round1(r.questions), gain: round1(r.gain) }));
  const measured = rows.filter((r) => r.enough);
  return {
    target,
    targets: TARGET_ACCURACIES,
    minAnswers: MIN_ANSWERS,
    sections,
    top,
    measured: measured.length,
    skills: rows.length,
    gain: round1(measured.reduce((s, r) => s + r.gain, 0)),
    answers: rows.reduce((s, r) => s + r.attempts, 0)
  };
}

// ---------- Skill constellation map ----------
// Every skill as a star, every domain as a constellation (the "Skills" tab of /sky). A star's state
// comes from the student's own answers and only ever describes how far along they are:
//   new       no answers yet
//   started   fewer than MIN_ANSWERS (too few to call)
//   learning  under 70%
//   strong    70% or more
//   mastered  90% or more over at least MASTERED_ANSWERS answers
// Nothing is locked and no state is a penalty: a star never goes dark.
// `focus` is where the marker and Nova sit: the skill worth the most questions on test day (the
// gap map's first), or, before there is enough data for that, the first skill not yet tried.
export const SKILL_STATES = ["new", "started", "learning", "strong", "mastered"];
export const MASTERED_ANSWERS = 10;

export function skillState(attempts, accuracy) {
  if (!attempts) return "new";
  if (attempts < MIN_ANSWERS) return "started";
  if (accuracy >= 0.9 && attempts >= MASTERED_ANSWERS) return "mastered";
  return accuracy >= 0.7 ? "strong" : "learning";
}

export function skillSky(stats, target = DEFAULT_TARGET, lessons = {}) {
  const map = gapMap(stats, target);
  const constellations = map.sections.flatMap((s) =>
    s.domains.map((d) => ({
      section: s.section,
      domain: d.domain,
      accuracy: d.accuracy,
      skills: d.skills.map((k) => ({
        skill: k.skill,
        attempts: k.attempts,
        accuracy: k.accuracy,
        state: skillState(k.attempts, k.accuracy),
        gain: k.gain,
        tip: lessons[k.skill]?.tip || null
      }))
    }))
  );
  const all = constellations.flatMap((c) => c.skills.map((k) => ({ ...k, section: c.section, domain: c.domain })));
  const best = map.top[0];
  const untried = all.find((k) => k.state === "new") || all.find((k) => k.state === "started");
  const weakest = all.filter((k) => k.accuracy != null).sort((a, b) => a.accuracy - b.accuracy)[0];
  const focus = best
    ? { skill: best.skill, reason: "points", gain: best.gain }
    : untried
      ? { skill: untried.skill, reason: "untried", gain: null }
      : weakest
        ? { skill: weakest.skill, reason: "review", gain: null }
        : null;
  const counts = Object.fromEntries(SKILL_STATES.map((s) => [s, all.filter((k) => k.state === s).length]));
  return { target: map.target, minAnswers: MIN_ANSWERS, masteredAnswers: MASTERED_ANSWERS, constellations, focus, counts, skills: all.length };
}

// ---------- The plan back from test day ----------
// How much a skill needs work: its questions on the test times the distance
// to the target. A skill with few answers leans on the section's general
// level (the latest mock module when there is one), so untried skills are
// planned for too.
function needs(stats, mock, target) {
  return testBlueprint().map((b) => {
    const s = stats.get(b.skill) || { attempts: 0, correct: 0 };
    const prior = mock[b.section] ?? PRIOR_ACCURACY;
    const level = (s.correct + prior * PRIOR_ANSWERS) / (s.attempts + PRIOR_ANSWERS);
    return { ...b, attempts: s.attempts, accuracy: s.attempts ? s.correct / s.attempts : null, need: b.questions * Math.max(0.05, target - level) };
  });
}

// Deals skills out in proportion to their need, spread evenly: the weakest
// come up most often, and not twice in the same week.
function dealer(skills) {
  const total = skills.reduce((s, k) => s + k.need, 0) || 1;
  const credit = new Map(skills.map((k) => [k.skill, 0]));
  return (taken) => {
    let best = null;
    for (const k of skills) {
      credit.set(k.skill, credit.get(k.skill) + k.need);
      if (taken.has(k.skill)) continue;
      if (!best || credit.get(k.skill) > credit.get(best.skill)) best = k;
    }
    if (best) credit.set(best.skill, credit.get(best.skill) - total);
    return best;
  };
}

// The weeks from today to the day before the test. The first week runs to
// Sunday, the rest are Monday to Sunday, and the last one ends the day before
// the test. `mock` is the latest mock accuracy per section, when there is any.
export function studyPlan({ stats, mock = {}, examDay, today, target = DEFAULT_TARGET }) {
  const daysLeft = examDay ? dayDiff(examDay, today) : null;
  const out = { daysLeft, weeksLeft: daysLeft == null ? null : Math.max(0, Math.ceil(daysLeft / 7)), target, weeks: [], truncated: false };
  if (daysLeft == null || daysLeft <= 0) return out;

  const lastDay = dayOffset(examDay, -1);
  const spans = [];
  for (let start = today; start <= lastDay && spans.length < MAX_WEEKS; ) {
    const sunday = dayOffset(weekKey(start), 6);
    const end = sunday < lastDay ? sunday : lastDay;
    spans.push({ start, end, days: dayDiff(end, start) + 1 });
    start = dayOffset(end, 1);
  }
  out.truncated = spans.at(-1).end < lastDay;

  const deal = dealer(needs(stats, mock, target).sort((a, b) => b.need - a.need));
  const working = spans.length - 1; // every week but the last
  out.weeks = spans.map((span, i) => {
    const final = i === spans.length - 1 && !out.truncated;
    const phase = final ? "final" : i < Math.ceil(working / 2) ? "build" : "sharpen";
    // Three skills in a full week, fewer in a short one, and a lighter last week.
    const slots = final ? Math.min(2, span.days) : Math.max(1, Math.min(3, Math.round((span.days / 7) * 3)));
    const taken = new Set();
    const focus = [];
    for (let s = 0; s < slots; s++) {
      const k = deal(taken);
      if (!k) break;
      taken.add(k.skill);
      focus.push({ skill: k.skill, section: k.section, domain: k.domain, accuracy: k.accuracy, attempts: k.attempts, questions: SLOT_QUESTIONS[phase], levels: LEVELS[phase] });
    }
    const extras = final ? ["mock", "mistakes", ...(span.days >= 2 ? ["rest"] : [])] : [...(i % 2 === 1 || phase === "sharpen" ? ["mock"] : []), "mistakes"];
    return { n: i + 1, ...span, phase, focus, extras, questions: focus.reduce((s, f) => s + f.questions, 0) };
  });
  return out;
}
