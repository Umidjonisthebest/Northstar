// Small helpers shared by the class pages (pages/hub/Classroom.jsx and this folder).
import { fmtDay } from "../hubUtils.js";

// The class page keeps its place in the address: /class?tab=chat&room=dm-<id>.
export const classUrl = (tab, extra = {}) => {
  const p = new URLSearchParams({ ...(tab && tab !== "overview" ? { tab } : {}), ...extra });
  const q = p.toString();
  return q ? `/class?${q}` : "/class";
};

// ISO time -> "just now", "12 min ago", "3 h ago", "yesterday", "Mon, Oct 5"
export function ago(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 2 * 86400) return "yesterday";
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// 135 -> "2 h 15 min"
export function duration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// When a homework is due, in words: { text, tone } where tone is "late", "soon" or "".
export function dueLine(hw) {
  if (hw.state === "done") return { text: hw.late ? "Finished after the due date" : "Finished on time", tone: hw.late ? "soon" : "" };
  const n = hw.daysLeft;
  if (n < 0) return { text: n === -1 ? "Was due yesterday" : `Was due ${-n} days ago`, tone: "late" };
  if (n === 0) return { text: "Due today", tone: "soon" };
  if (n === 1) return { text: "Due tomorrow", tone: "soon" };
  return { text: `Due ${fmtDay(hw.due)}`, tone: "" };
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "Ana A.", "Ana A. and Ben B.", "Ana A., Ben B. and 3 others"
export function nameList(people, max = 2) {
  const names = people.map((p) => p.name);
  if (names.length <= max) return names.join(" and ");
  const rest = names.length - max;
  return `${names.slice(0, max).join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
}
