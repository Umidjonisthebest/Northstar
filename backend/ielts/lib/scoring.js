// Raw score (out of 40) -> band, per the commonly published IELTS conversion
// tables. Mock tests that don't have exactly 40 questions are scaled to 40 first.
export const LISTENING_BANDS = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5],
  [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0]
];

export const READING_BANDS = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5],
  [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0]
];

export function rawToBand(section, raw, total) {
  if (!total) return 0;
  const scaled = Math.round((raw * 40) / total);
  const table = section === "listening" ? LISTENING_BANDS : READING_BANDS;
  for (const [min, band] of table) if (scaled >= min) return band;
  return 0;
}

// IELTS rounds the mean of the four skills to the nearest half band, with
// .25 rounding up to .5 and .75 up to the next whole band.
export function overallBand(bands) {
  if (bands.some((b) => b == null || Number.isNaN(b))) return null;
  const mean = bands.reduce((a, b) => a + b, 0) / bands.length;
  return Math.round(mean * 2) / 2;
}

export function parseBand(input) {
  if (input === null || input === undefined || String(input).trim() === "") return { band: null };
  const value = Number(String(input).replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 9 || Math.round(value * 2) !== value * 2) {
    return { error: "Band score must be between 0 and 9 in steps of 0.5" };
  }
  return { band: value };
}

export function countWords(text) {
  const matches = String(text || "").match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}
