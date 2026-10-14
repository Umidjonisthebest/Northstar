// Study sessions ("sittings"), reconstructed from a student's answer log: answers less than
// 20 minutes apart belong to the same sitting. Nothing is stored for them. The student's own list
// (GET /api/practice/sessions) and their class's activity (classStats.js) both come from here.
import { TZ, todayKey } from "./gamification.js";

const GAP_MS = 20 * 60000;

// The sittings in an answer log, oldest first. `qmap` is Map(questionId -> question), used for the
// section a sitting was mostly about. Each sitting: { startT, endT, count, correct, diagnostic, sections }.
export function sittings(log, qmap) {
  const entries = (log || []).filter((e) => e.at).sort((a, b) => a.at.localeCompare(b.at));
  const groups = [];
  let cur = null;
  for (const e of entries) {
    const t = Date.parse(e.at);
    if (!cur || t - cur.endT > GAP_MS) {
      cur = { startT: t - Math.min(e.ms || 60000, 10 * 60000), endT: t, count: 0, correct: 0, diagnostic: 0, sections: {} };
      groups.push(cur);
    }
    cur.endT = t;
    cur.count += 1;
    if (e.ok) cur.correct += 1;
    if (e.d) cur.diagnostic += 1;
    const q = qmap.get(e.q);
    if (q) cur.sections[q.section] = (cur.sections[q.section] || 0) + 1;
  }
  return groups;
}

export const sittingMinutes = (g) => Math.max(1, Math.round((g.endT - g.startT) / 60000));

const fmt = (opts, d) => new Intl.DateTimeFormat("en-US", { ...opts, timeZone: TZ }).format(d);

// A sitting as the pages show it: "Tuesday Evening Math", when, how long, how many questions.
export function describeSitting(g) {
  const start = new Date(g.startT);
  const hour = Number(fmt({ hour: "numeric", hour12: false }, start)) % 24;
  const part = hour < 5 ? "Night" : hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Night";
  const [top, n] = Object.entries(g.sections).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const label = g.diagnostic / g.count >= 0.8 ? "Diagnostic Test" : top && n / g.count >= 0.8 ? top : "Question Bank";
  return {
    title: `${fmt({ weekday: "long" }, start)} ${part} ${label}`,
    date: todayKey(start),
    start: start.toISOString(),
    end: new Date(g.endT).toISOString(),
    minutes: sittingMinutes(g),
    count: g.count,
    correct: g.correct,
    section: label
  };
}

// A student's own sessions, newest first.
export function studySessions(db, p, limit = 30) {
  const qmap = new Map(db.practiceQuestions.map((q) => [q.id, q]));
  return sittings(p.answerLog, qmap).reverse().slice(0, limit).map(describeSitting);
}
