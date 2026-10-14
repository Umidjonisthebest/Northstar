// Monthly recap: what a student did in a calendar month (in the app's
// timezone). A month's recap becomes available on the 1st of the next month.
// It is worked out once, then kept in progress.recaps, so the history list
// stays the same even after the answer log has moved on:
//   { month: "2026-09", label, answers, correct, solved, accuracy,
//     previousAccuracy, accuracyChange, bestStreak, activeDays, stars, xp,
//     improved: { skill, section, from, to } | null,
//     hardest: { id, title, skill, section, difficulty } | null, generatedAt }
// The share image is an SVG drawn here from those numbers: no outside service.

import { dayOffset, getProgress, todayKey } from "./gamification.js";
import { isDemoUser } from "./users.js";

const KEEP = 36; // months of history
const MIN_SKILL_ANSWERS = 3; // answers on a skill in each month before "most improved" compares them
const LEVEL = { Easy: 0, Medium: 1, Hard: 2, Challenging: 3 };

export const monthOf = (day) => day.slice(0, 7);
export const monthLabel = (month) => new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const shift = (month, by) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 15));
  return d.toISOString().slice(0, 7);
};
export const prevMonth = (month) => shift(month, -1);
export const nextMonth = (month) => shift(month, 1);
// The month whose recap is the newest one available: last month.
export const lastCompletedMonth = (now = Date.now()) => prevMonth(monthOf(todayKey(new Date(now))));

const monthOfEntry = (e) => monthOf(todayKey(new Date(e.at)));
const hasData = (r) => r.answers > 0 || r.activeDays > 0 || r.stars > 0;

// Everything the recap shows for one month.
export function monthStats(db, p, userId, month) {
  const before = prevMonth(month);
  const log = p.answerLog.filter((e) => e.at && monthOfEntry(e) === month);
  const earlier = p.answerLog.filter((e) => e.at && monthOfEntry(e) === before);
  const questions = new Map(db.practiceQuestions.map((q) => [q.id, q]));
  const accuracyOf = (list) => (list.length ? list.filter((e) => e.ok).length / list.length : null);
  const accuracy = accuracyOf(log);
  const previousAccuracy = accuracyOf(earlier);

  // The longest run of studied days inside the month, and how many days were studied.
  let bestStreak = 0;
  let run = 0;
  let activeDays = 0;
  let xp = 0;
  for (let day = `${month}-01`; monthOf(day) === month; day = dayOffset(day, 1)) {
    xp += p.xpLog?.[day] || 0;
    if (p.days?.[day]) {
      run += 1;
      activeDays += 1;
      bestStreak = Math.max(bestStreak, run);
    } else run = 0;
  }

  // Most improved skill: the biggest rise in accuracy on a skill practised in both months.
  const bySkill = (list) => {
    const out = new Map();
    for (const e of list) {
      const q = questions.get(e.q);
      if (!q) continue;
      const s = out.get(q.topic) || { n: 0, ok: 0, section: q.section };
      s.n += 1;
      if (e.ok) s.ok += 1;
      out.set(q.topic, s);
    }
    return out;
  };
  const then = bySkill(earlier);
  let improved = null;
  for (const [skill, s] of bySkill(log)) {
    const b = then.get(skill);
    if (!b || s.n < MIN_SKILL_ANSWERS || b.n < MIN_SKILL_ANSWERS) continue;
    const rise = s.ok / s.n - b.ok / b.n;
    if (rise > 0 && (!improved || rise > improved.to - improved.from)) improved = { skill, section: s.section, from: b.ok / b.n, to: s.ok / s.n };
  }

  // Hardest question solved: the highest difficulty, then the one the fewest
  // students get right, then the most recent.
  const solved = new Map();
  for (const e of log) if (e.ok && questions.has(e.q)) solved.set(e.q, e.at);
  const classAccuracy = (id) => {
    let attempts = 0;
    let correct = 0;
    const demo = new Set((db.users || []).filter(isDemoUser).map((u) => u.id));
    for (const other of db.progress) {
      if (demo.has(other.userId)) continue;
      const a = other.answered?.[id];
      if (!a) continue;
      attempts += a.attempts || 0;
      correct += a.correct || 0;
    }
    return attempts ? correct / attempts : 1;
  };
  const hardest = [...solved.entries()]
    .map(([id, at]) => ({ q: questions.get(id), at, share: classAccuracy(id) }))
    .sort((a, b) => (LEVEL[b.q.difficulty] ?? 1) - (LEVEL[a.q.difficulty] ?? 1) || a.share - b.share || b.at.localeCompare(a.at))[0];

  return {
    month,
    label: monthLabel(month),
    answers: log.length,
    correct: log.filter((e) => e.ok).length,
    solved: new Set(log.filter((e) => e.ok).map((e) => e.q)).size,
    accuracy,
    previousAccuracy,
    // In percentage points, against the month before (null when either month has no answers).
    accuracyChange: accuracy == null || previousAccuracy == null ? null : Math.round((accuracy - previousAccuracy) * 100),
    bestStreak,
    activeDays,
    stars: db.dailyStars.filter((s) => monthOf(s.date) === month && s.answers?.[userId]?.correct).length,
    xp,
    improved,
    hardest: hardest ? { id: hardest.q.id, title: hardest.q.title || "", skill: hardest.q.topic, section: hardest.q.section, difficulty: hardest.q.difficulty } : null
  };
}

// The first month the student has anything on record for.
function firstMonth(p) {
  const days = [...Object.keys(p.days || {}), ...Object.keys(p.xpLog || {})].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const first = p.answerLog.find((e) => e.at);
  if (first) days.push(todayKey(new Date(first.at)));
  return days.length ? monthOf(days.sort()[0]) : null;
}

// Works out the recap for every completed month that doesn't have one yet,
// and keeps them. Months with nothing on record get no recap. Returns whether
// anything changed (so the caller knows to save).
export function ensureRecaps(db, userId, now = Date.now()) {
  const p = getProgress(db, userId);
  const last = lastCompletedMonth(now);
  const start = p.recapThrough ? nextMonth(p.recapThrough) : firstMonth(p);
  if (!start || start > last) return false;
  for (let month = start; month <= last; month = nextMonth(month)) {
    const stats = monthStats(db, p, userId, month);
    if (hasData(stats)) p.recaps.unshift({ ...stats, generatedAt: new Date(now).toISOString() });
    p.recapThrough = month;
  }
  if (p.recaps.length > KEEP) p.recaps.length = KEEP;
  return true;
}

// For the dashboard: is last month's recap there to be read, and has it been opened?
export function recapStatus(p, now = Date.now()) {
  const month = lastCompletedMonth(now);
  const stored = p.recaps.some((r) => r.month === month);
  // Not worked out yet, but there will be one: the student studied that month.
  const pending = !stored && (p.recapThrough || "") < month && Object.keys(p.days || {}).some((d) => monthOf(d) === month);
  return { month, label: monthLabel(month), ready: stored || pending, unseen: (stored || pending) && p.recapSeen !== month };
}

// ---------- Share image ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const clip = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1).trimEnd()}…` : String(s));
const pct = (x) => `${Math.round(x * 100)}%`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// A 1080 x 1080 picture of the month: the six recap numbers on a night sky.
// It carries the student's first name, their profile picture if they chose one (`avatarUri`, a
// data: URI so the file stands alone), and their numbers. Nothing else.
export function recapSvg(recap, firstName = "", avatarUri = null) {
  const picture = typeof avatarUri === "string" && avatarUri.startsWith("data:image/") ? avatarUri : null;
  const before = monthLabel(prevMonth(recap.month)).split(" ")[0];
  const change =
    recap.accuracyChange == null
      ? "first month on record"
      : recap.accuracyChange === 0
        ? `the same as ${before}`
        : `${plural(Math.abs(recap.accuracyChange), "point")} ${recap.accuracyChange > 0 ? "above" : "below"} ${before}`;
  const tiles = [
    ["QUESTIONS SOLVED", String(recap.solved), `${plural(recap.answers, "answer")} given`],
    ["ACCURACY", recap.accuracy == null ? "—" : pct(recap.accuracy), recap.accuracy == null ? "no answers this month" : change],
    ["BEST STREAK", plural(recap.bestStreak, "day"), `${plural(recap.activeDays, "day")} studied`],
    ["STARS DISCOVERED", String(recap.stars), "daily Northstar questions solved"],
    ["MOST IMPROVED SKILL", recap.improved ? clip(recap.improved.skill, 24) : "—", recap.improved ? `from ${pct(recap.improved.from)} to ${pct(recap.improved.to)}` : "needs two months on one skill"],
    ["HARDEST QUESTION SOLVED", recap.hardest ? recap.hardest.difficulty : "—", recap.hardest ? clip(recap.hardest.skill, 34) : "none solved this month"]
  ];
  const sparkle = (x, y, r) => `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;
  // With a picture in the top-right corner, the two stars that sat there make room for it.
  const stars = [...(picture ? [[1030, 80, 12]] : [[930, 120, 26], [1000, 210, 10]]), [850, 70, 8], [70, 1010, 9], [990, 1000, 14], [520, 60, 6]];
  const portrait = picture
    ? `<clipPath id="pic"><rect x="850" y="110" width="170" height="170" rx="44"/></clipPath>
  <rect x="844" y="104" width="182" height="182" rx="50" fill="#ffd76a"/>
  <image href="${picture}" x="850" y="110" width="170" height="170" clip-path="url(#pic)" preserveAspectRatio="xMidYMid slice"/>`
    : "";
  const cells = tiles
    .map(([label, value, note], i) => {
      const x = 60 + (i % 2) * 490;
      const y = 330 + Math.floor(i / 2) * 215;
      const small = value.length > 12;
      return `<g>
    <rect x="${x}" y="${y}" width="470" height="195" rx="26" fill="#ffffff" fill-opacity="0.08"/>
    <text x="${x + 30}" y="${y + 50}" font-size="21" font-weight="700" letter-spacing="2" fill="#b9c2ee">${esc(label)}</text>
    <text x="${x + 30}" y="${y + (small ? 112 : 122)}" font-size="${small ? 38 : 64}" font-weight="700" fill="#ffffff">${esc(value)}</text>
    <text x="${x + 30}" y="${y + 164}" font-size="24" fill="#d5dbf7">${esc(note)}</text>
  </g>`;
    })
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" font-family="Segoe UI, Helvetica, Arial, sans-serif" role="img" aria-label="${esc(`Northstar recap for ${recap.label}`)}">
  <defs>
    <radialGradient id="sky" cx="18%" cy="0%" r="120%">
      <stop offset="0" stop-color="#27398a"/>
      <stop offset="0.5" stop-color="#141d52"/>
      <stop offset="1" stop-color="#0b1030"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#sky)"/>
  ${stars.map(([x, y, r]) => `<path d="${sparkle(x, y, r)}" fill="#ffd76a"/>`).join("\n  ")}
  <text x="60" y="120" font-size="24" font-weight="700" letter-spacing="4" fill="#ffd76a">NORTHSTAR MONTHLY RECAP</text>
  <text x="60" y="205" font-size="76" font-weight="700" fill="#ffffff">${esc(recap.label)}</text>
  <text x="60" y="265" font-size="32" fill="#d5dbf7">${esc(firstName ? `${clip(firstName, 24)}'s month of study` : "A month of study")}</text>
  ${portrait}
  ${cells}
  <text x="60" y="1030" font-size="24" font-weight="700" letter-spacing="1" fill="#b9c2ee">northstar</text>
</svg>`;
}
