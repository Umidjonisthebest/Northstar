// Why a student misses questions: the reasons they give ("mistake tags") and the trap profile
// worked out from those and from their answers. The review schedule itself (when a missed
// question comes back) is in gamification.js, under "Spaced review".

import { dayOffset, dayStartMs, reviewStatus, todayKey } from "./gamification.js";
import { DIFFICULTIES, SKILL_LESSONS } from "./practiceSkills.js";

// The reasons a student can give for a miss. `tip` is what to do about it; the trap profile
// shows it for the reason that comes up most.
export const MISTAKE_REASONS = [
  {
    id: "misread",
    label: "Misread the question",
    short: "Misread it",
    tip: "Before you choose, say in your own words what the question asks for. Check the last line: is it x, x + y, or the opposite of what you found?"
  },
  {
    id: "careless",
    label: "Careless slip",
    short: "Careless slip",
    tip: "Write each step down, and check the signs and the last operation before you answer. Slips gather at the end of a solution."
  },
  {
    id: "concept",
    label: "Didn't know how to do it",
    short: "Didn't know how",
    tip: "That's a gap in a skill, not a slip. Open the Masterclass for the skill, then do a short drill on it."
  },
  {
    id: "trap",
    label: "Fell for a trap answer",
    short: "Trap answer",
    tip: "A trap answer is what a common wrong step gives. Before you choose, ask which mistake each wrong choice is waiting for."
  },
  {
    id: "time",
    label: "Rushed it",
    short: "Rushed it",
    tip: "Speed comes from method, not from hurrying. Turn on the pace guide, and mark a long question to come back to instead of forcing it."
  },
  {
    id: "guess",
    label: "Guessed",
    short: "Guessed",
    tip: "A guess hides what you don't know yet. Cross out what you can, answer, and mark the question so you look at it again."
  }
];
const REASON_IDS = new Set(MISTAKE_REASONS.map((r) => r.id));
export const isReason = (id) => REASON_IDS.has(id);

const REASON_LIMIT = 3000;
// The key a mock-exam mistake is tagged under (bank questions use their own id).
export const examReasonKey = (key) => `exam:${key}`;

// Sets, changes or (with a blank reason) removes the reason for one miss. `extra` is kept with it:
// mock-exam mistakes carry their section, because they aren't in the bank to look it up.
export function setReason(p, key, reason, extra = {}) {
  if (!reason) {
    delete p.reasons[key];
    return null;
  }
  p.reasons[key] = { r: reason, at: new Date().toISOString(), ...extra };
  const keys = Object.keys(p.reasons);
  if (keys.length > REASON_LIMIT) {
    keys.sort((a, b) => String(p.reasons[a].at).localeCompare(String(p.reasons[b].at)));
    for (const k of keys.slice(0, keys.length - REASON_LIMIT)) delete p.reasons[k];
  }
  return reason;
}

export const reasonOf = (p, key) => p.reasons[key]?.r || null;

// ---------- The trap profile ----------
// Seconds per question the real test allows (the practice player's pace guide uses the same).
const PACE = { "Reading & Writing": 71, Math: 95 };
const RUSHED = 0.4; // a miss in under 40% of the pace was rushed
const SLOW = 1.8; // a miss after 180% of it means being stuck
const WINDOW_DAYS = 90;
const share = (n, of) => (of ? n / of : 0);

// What trips this student up, from the last 90 days of graded answers (practice, diagnostic and
// Daily Star) and the reasons they have given:
//  - reasons: how often each reason was given;
//  - signals: what the answers themselves show (rushed misses, slips on easy questions,
//    questions missed more than once, misses by level and by section);
//  - skills: the skills with the most misses, each with the traps its lesson warns about;
//  - headline: the one thing to work on first.
export function trapProfile(db, p, today = todayKey()) {
  const byId = new Map(db.practiceQuestions.map((q) => [q.id, q]));
  const since = dayStartMs(dayOffset(today, -WINDOW_DAYS));
  const log = p.answerLog.filter((e) => e.at && Date.parse(e.at) >= since && byId.has(e.q));
  const misses = log.filter((e) => !e.ok);

  // ---- Reasons the student gave ----
  const tagged = Object.entries(p.reasons).filter(([, v]) => isReason(v.r) && Date.parse(v.at) >= since);
  const reasons = MISTAKE_REASONS.map((r) => {
    const count = tagged.filter(([, v]) => v.r === r.id).length;
    return { ...r, count, share: share(count, tagged.length) };
  }).sort((a, b) => b.count - a.count);
  const missedIds = [...new Set(misses.map((e) => e.q))];
  const untagged = missedIds.filter((id) => !p.reasons[id]).length;

  // ---- What the answers show ----
  const timed = misses.filter((e) => e.ms);
  const pace = (e) => PACE[byId.get(e.q).section] || 90;
  const rushed = timed.filter((e) => e.ms / 1000 < pace(e) * RUSHED).length;
  const slow = timed.filter((e) => e.ms / 1000 > pace(e) * SLOW).length;
  const easy = misses.filter((e) => byId.get(e.q).difficulty === "Easy").length;
  const missCount = new Map();
  for (const e of misses) missCount.set(e.q, (missCount.get(e.q) || 0) + 1);
  const repeat = [...missCount.values()].filter((n) => n >= 2).length;
  const group = (key, names) =>
    names
      .map((name) => {
        const answers = log.filter((e) => byId.get(e.q)[key] === name);
        const wrong = answers.filter((e) => !e.ok).length;
        return { name, answers: answers.length, misses: wrong, rate: share(wrong, answers.length) };
      })
      .filter((row) => row.answers);

  // ---- The skills behind the misses ----
  const skills = new Map();
  for (const e of log) {
    const q = byId.get(e.q);
    const s = skills.get(q.topic) || { skill: q.topic, section: q.section, domain: q.domain, answers: 0, misses: 0, tags: {} };
    s.answers += 1;
    if (!e.ok) s.misses += 1;
    skills.set(q.topic, s);
  }
  for (const [key, v] of tagged) {
    const s = skills.get(byId.get(key)?.topic);
    if (s) s.tags[v.r] = (s.tags[v.r] || 0) + 1;
  }
  const topSkills = [...skills.values()]
    .filter((s) => s.misses > 0)
    .sort((a, b) => b.misses - a.misses || a.answers - b.answers || a.skill.localeCompare(b.skill))
    .slice(0, 5)
    .map(({ tags, ...s }) => {
      const top = Object.entries(tags).sort((a, b) => b[1] - a[1])[0];
      const lesson = SKILL_LESSONS[s.skill];
      return {
        ...s,
        accuracy: share(s.answers - s.misses, s.answers),
        // The reason given most often for misses in this skill, if any were tagged.
        reason: top ? top[0] : null,
        traps: lesson?.traps || [],
        tip: lesson?.tip || null
      };
    });

  const signals = {
    answers: log.length,
    misses: misses.length,
    timed: timed.length,
    rushed,
    slow,
    easy,
    repeat,
    byDifficulty: group("difficulty", DIFFICULTIES),
    bySection: group("section", Object.keys(PACE))
  };

  return {
    days: WINDOW_DAYS,
    reasons,
    tagged: tagged.length,
    untagged,
    signals,
    skills: topSkills,
    headline: headlineOf({ reasons, tagged: tagged.length, signals, skills: topSkills }),
    review: reviewStatus(p, (id) => byId.has(id), today)
  };
}

// The one thing to say first. A reason the student gave themselves outranks what the timing
// suggests; a skill only leads when nothing else stands out.
function headlineOf({ reasons, tagged, signals, skills }) {
  const { misses, timed, rushed, easy } = signals;
  if (!misses && !tagged) {
    return { kind: "empty", title: "Nothing to learn from yet", body: "Answer some questions. When you miss one, this page starts to show what trips you up." };
  }
  const top = reasons[0];
  if (tagged >= 3 && top.share >= 0.4) {
    return { kind: "reason", reason: top.id, title: `Your most common miss: ${top.label.toLowerCase()}`, body: `That's ${top.count} of the ${tagged} misses you've tagged. ${top.tip}` };
  }
  if (timed >= 5 && share(rushed, timed) >= 0.35) {
    return {
      kind: "rushed",
      title: "You miss more when you go fast",
      body: `${rushed} of your ${timed} timed misses came in well under the time the test allows. Slowing down on those costs seconds and saves questions.`
    };
  }
  if (misses >= 5 && share(easy, misses) >= 0.35) {
    return {
      kind: "easy",
      title: "Easy questions are costing you",
      body: `${easy} of your ${misses} misses were on Easy questions. Those are usually slips, not gaps: read the last line of the question again before you answer.`
    };
  }
  const skill = skills[0];
  if (skill && skill.misses >= 2) {
    return {
      kind: "skill",
      skill: skill.skill,
      title: `${skill.skill} trips you up most`,
      body: `${skill.misses} misses there in the last ${WINDOW_DAYS} days.${skill.traps[0] ? ` Watch for this trap: ${skill.traps[0]}` : ""}`
    };
  }
  return { kind: "early", title: "No clear pattern yet", body: "Tag each miss with a reason as you go. A few more and this page can say what to fix first." };
}

// One line about the profile for Nova, so her advice fits how this student actually loses points.
export function trapSummary(profile) {
  const h = profile.headline;
  if (h.kind === "empty" || h.kind === "early") return null;
  return `${h.title}. ${h.body}`;
}
