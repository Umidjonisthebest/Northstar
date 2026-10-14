// Building blocks for seeded IELTS content (content.js, practice.js).

export const blank = (id) => `<span class="ql-blank" data-id="${id}"></span>`;
export const headingSlot = (id) => `<div class="ql-heading-slot" data-id="${id}"></div>`;
export const key = (value, ...variations) => ({ value, variations });

// Replaces {{n}} tokens with blanks whose ids are `${prefix}-b${n}`.
export function blanks(prefix, html) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, n) => blank(`${prefix}-b${n}`));
}
export function blankAnswers(prefix, map) {
  return Object.fromEntries(Object.entries(map).map(([n, v]) => [`${prefix}-b${n}`, Array.isArray(v) ? key(v[0], ...v.slice(1)) : key(v)]));
}
export const opts = (...texts) => texts.map((text, i) => ({ key: String.fromCharCode(65 + i), text }));
export const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
