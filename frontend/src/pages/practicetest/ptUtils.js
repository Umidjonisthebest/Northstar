// Small helpers shared by the practice-test screens: where each one lives, and the words for a
// sitting's two choices (what is sat, and whether it is timed).

// The practice tests' own tab: without ?kind= the page opens on a teacher's test that is waiting.
export const TESTS_URL = "/mock?kind=practice";
// The page between modules (full screen), a module (full screen), and the results (in the hub).
export const runUrl = (runId) => `/practice-test/${runId}`;
export const moduleUrl = (runId, module) => `/practice-test/${runId}/${module}`;
export const resultsUrl = (runId) => `/mock/practice/${runId}`;

export const SCOPE_NAME = { full: "Full test", rw: "Reading and Writing", math: "Math" };
export const SECTION_TITLE = { rw: "Reading and Writing", math: "Math" };
export const SECTION_SHORT = { rw: "R&W", math: "Math" };
// "Full test, timed" · "Math, untimed"
export const sittingLabel = (run) => `${SCOPE_NAME[run.scope] || run.scope}, ${run.timed ? "timed" : "untimed"}`;
// "R&W 1", "Math 2": a module's short name, from its place in its section.
export function moduleShort(modules, m) {
  const same = modules.filter((x) => x.section === m.section);
  return `${SECTION_SHORT[m.section] || m.title} ${same.indexOf(m) + 1}`;
}

// 134 -> "2 h 14 min", 64 -> "1 h 4 min", 35 -> "35 min"
export function minutesLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

// Seconds -> "28:14", or "1:02:09" past the hour.
export function clockLabel(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
