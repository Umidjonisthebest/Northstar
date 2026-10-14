const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function toISODate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// "2026-01-09" -> "January 9th, 2026"
export function formatLongDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${ordinal(d)}, ${y}`;
}

// "2026-01-10", "10:00" -> "10 Jan 2026, 10:00"
export function formatSessionDate(date, time) {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m - 1]} ${y}${time ? `, ${time}` : ""}`;
}

export function formatShortDate(date) {
  if (!date) return "";
  const [y, m, d] = String(date).slice(0, 10).split("-").map(Number);
  return `${m}/${d}/${y}`;
}

export function formatDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US");
}

export function formatBand(band) {
  return band === null || band === undefined ? "–" : Number(band).toFixed(1);
}

export function fullName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ");
}

export function initials(user) {
  return ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() || "?";
}

export function clock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function humanDuration(totalSeconds) {
  const minutes = Math.round((totalSeconds || 0) / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} hour${h > 1 ? "s" : ""} ${m} minutes`;
  if (h) return `${h} hour${h > 1 ? "s" : ""}`;
  return `${m} minutes`;
}

export function pluralize(n, word, plural = `${word}s`) {
  return `${n} ${n === 1 ? word : plural}`;
}

export function countWords(text) {
  const matches = String(text || "").match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}
