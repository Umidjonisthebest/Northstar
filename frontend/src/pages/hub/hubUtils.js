// Small helpers shared by the student hub pages and the practice player.

export const TZ = "Asia/Tashkent";
export const SECTION_KEY = { "Reading & Writing": "rw", Math: "math" };
export const SECTION_NAME = { rw: "Reading & Writing", math: "Math" };
export const SECTION_SHORT = { "Reading & Writing": "R&W", Math: "Math" };

// URL of the full-screen practice player. `skills` is a list of skill names,
// joined with "|" because some names contain commas. `diag` (with
// source "diagnostic") reopens a finished diagnostic's questions; `only:
// "missed"` keeps the ones it got wrong. `homework` (with source "homework")
// opens a class homework, and `ids` (with source "shared") the questions named.
export function playerUrl({ source, sec, skills, difficulty, status, flagged, saved, type, order, seed, start, size, plan, diag, only, homework, ids, from } = {}) {
  const p = new URLSearchParams();
  const put = (k, v) => {
    if (v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && v.length === 0)) return;
    p.set(k, Array.isArray(v) ? v.join(k === "skills" ? "|" : ",") : v === true ? "1" : String(v));
  };
  put("source", source);
  put("sec", sec);
  put("skills", skills);
  put("difficulty", difficulty);
  put("status", status);
  put("flagged", flagged);
  put("saved", saved);
  put("type", type);
  put("order", order);
  put("seed", seed);
  put("start", start);
  put("size", size);
  put("plan", plan);
  put("diag", diag);
  put("only", only);
  put("homework", homework);
  put("ids", ids);
  put("from", from);
  return `/practice/solve?${p}`;
}

// "2026-09-25" -> "Fri, Sep 25"
export function fmtDay(key, opts = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

// ISO timestamp -> "Sep 30, 2026"
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ }) : "");
// Seconds -> "19:05"
export function fmtClock(s) {
  const t = Math.max(0, Math.round(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
}

export function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(new Date()));
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 22) return "Good evening";
  return "Good late night";
}

// Spaced review. "tomorrow" / "in 3 days", and what an answer did to a question's review
// schedule (`schedule` is the `review` object the answer route returns).
export const inDays = (n) => (n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);
export function reviewLine(schedule) {
  if (!schedule) return "";
  if (schedule.state === "scheduled" || schedule.state === "lapsed") return `This one comes back for review ${inDays(schedule.days)}.`;
  if (schedule.state === "early") return `It comes back for review ${inDays(schedule.days)}. Getting it right then is what counts.`;
  if (schedule.state === "again") return "You had help this time, so it comes back tomorrow.";
  if (schedule.state === "advanced") return `Remembered. Next review ${inDays(schedule.days)}.`;
  if (schedule.state === "graduated") return "Remembered every time. It has left your review schedule.";
  return "";
}

export const pct = (x) => (x == null ? "—" : `${Math.round(x * 100)}%`);
export const accClass = (x) => (x == null ? "" : x >= 0.7 ? "acc-good" : x >= 0.5 ? "acc-mid" : "acc-bad");

// Where a study-plan task's "Start" goes. Nothing here finishes the task: the server counts the
// student's graded work and finishes it (backend/weekPlan.js). A mixed-practice set carries the
// task index so the server leaves out the skills the week's other tasks cover.
export function planTaskUrl(task) {
  const from = task.from || "/dashboard";
  if (task.kind === "drill") return playerUrl({ source: "drill", sec: SECTION_KEY[task.section], skills: task.topic ? [task.topic] : [], size: task.count || 15, from });
  if (task.kind === "mixed") return playerUrl({ source: "drill", size: task.count || 15, plan: task.index, from });
  if (task.kind === "mistakes") return playerUrl({ source: "mistakes", size: 20, from });
  if (task.kind === "vocab") return "/vocab";
  return "/mock";
}

// "7 of 15 questions": how far the student's own work has taken a study-plan task.
export function planTaskCount(task) {
  const unit = task.need === 1 ? task.unit.replace(/s$/, "") : task.unit;
  return task.done ? `${task.need} ${unit}` : `${task.have} of ${task.need} ${unit}`;
}

// What counts toward each kind of task, as the planner explains it.
export const PLAN_COUNTS = {
  drill: "A question counts when you get it right on your first try of the day, without opening the explanation first.",
  mixed: "Any skill outside this week's four counts. A question counts when you get it right on your first try of the day, without opening the explanation first.",
  vocab: "Every different word counts once this week: a flashcard you rate, or a word you get right in Learn mode or Match.",
  mock: "Handing in one module of a mock exam this week finishes it.",
  mistakes: "A question counts when you missed it on an earlier day and get it right now, on the first try."
};

// An answer or a flashcard rating that finished study-plan tasks carries
// `plan: { finished: [{ title }], reward }`. This is the line the student sees for it.
export function planFinishedLine(plan) {
  const names = plan.finished.map((t) => t.title).join(" and ");
  const xp = plan.reward?.xpGained ? ` +${plan.reward.xpGained} XP` : "";
  return `Study plan: ${names} finished.${xp}`;
}
