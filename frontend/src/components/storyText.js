// Formatting for success stories (StoryCard, the cover page's quote band).

export function scoreText(exam, v) {
  if (v === "" || v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return exam === "IELTS" ? Number(v).toFixed(1) : String(v);
}

export function jumpText(exam, before, after) {
  const d = Number(after) - Number(before);
  if (!Number.isFinite(d) || d <= 0) return "";
  return exam === "IELTS" ? `+${d % 1 ? d.toFixed(1) : d} band${d === 1 ? "" : "s"}` : `+${d} points`;
}
