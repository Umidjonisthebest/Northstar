// Question-group model shared by listening sections and reading passages.
//
// A part holds `groups` (one per "Questions 1-6" block). Every group has a
// `type`, rich-text `instructionHtml`, and type-specific content. A group
// produces ordered *slots* — one per numbered question. Answers live in
// `group.answers[slotId] = { value, variations }`, except multiple-answer items
// which keep `item.correct = ['A','C']` and occupy `item.count` slots.
//
//   text-blanks    blanks (<span class="ql-blank" data-id>) in contentHtml / table cells / flow-chart steps; typed answers
//   option-blanks  same blanks, filled by dragging an option from group.options
//   text-items     group.items, one typed answer each (short answers)
//   choice-items   group.items with their own item.options (multiple choice)
//   fixed-items    group.items answered TRUE/FALSE/NOT GIVEN or YES/NO/NOT GIVEN
//   option-items   group.items matched to a shared group.options bank (matching, headings, map grid)
//   multi-items    group.items where the candidate picks item.count options (Choose TWO letters)
//   text-markers   group.markers on group.image, typed answers
//   option-markers group.markers on group.image, filled by dragging options

export const QUESTION_TYPES = {
  note_completion: { kind: "text-blanks", from: "content" },
  table_completion: { kind: "text-blanks", from: "table" },
  flowchart_completion: { kind: "text-blanks", from: "steps" },
  flowchart_dnd: { kind: "option-blanks", from: "steps" },
  summary_completion: { kind: "text-blanks", from: "content" },
  summary_dnd: { kind: "option-blanks", from: "content" },
  form_completion: { kind: "text-blanks", from: "content" },
  sentence_completion: { kind: "text-blanks", from: "content" },
  short_answer: { kind: "text-items" },
  multiple_choice: { kind: "choice-items" },
  multiple_answers: { kind: "multi-items" },
  tfng: { kind: "fixed-items", values: ["TRUE", "FALSE", "NOT GIVEN"] },
  ynng: { kind: "fixed-items", values: ["YES", "NO", "NOT GIVEN"] },
  matching_features: { kind: "option-items" },
  matching_information: { kind: "option-items" },
  matching_sentence_endings: { kind: "option-items" },
  matching_headings: { kind: "option-items" },
  map_select: { kind: "option-items" },
  diagram_completion: { kind: "text-markers" },
  diagram_dnd: { kind: "option-markers" },
  map_dnd: { kind: "option-markers" }
};

const BLANK_TAG = /<span\b[^>]*\bql-blank\b[^>]*>/gi;
const DATA_ID = /\bdata-id\s*=\s*["']([^"']+)["']/i;

export function blankIdsInHtml(html) {
  const ids = [];
  for (const match of String(html || "").matchAll(BLANK_TAG)) {
    const id = DATA_ID.exec(match[0])?.[1];
    if (id) ids.push(id);
  }
  return ids;
}

export function groupBlankIds(group) {
  const def = QUESTION_TYPES[group.type];
  let ids = [];
  if (def?.from === "content") ids = blankIdsInHtml(group.contentHtml);
  else if (def?.from === "table") ids = (group.table?.rows || []).flatMap((row) => row.flatMap((cell) => blankIdsInHtml(cell?.html)));
  else if (def?.from === "steps") ids = (group.steps || []).flatMap((step) => blankIdsInHtml(step?.html));
  return [...new Set(ids)];
}

export function multiCount(item) {
  const n = Number(item?.count);
  if (Number.isInteger(n) && n > 0) return n;
  return Math.max(1, item?.correct?.length || 2);
}

export function groupSlots(group) {
  const def = QUESTION_TYPES[group?.type];
  if (!def) return [];
  const items = group.items || [];
  const markers = group.markers || [];
  switch (def.kind) {
    case "text-blanks":
      return groupBlankIds(group).map((id) => ({ id, mode: "text" }));
    case "option-blanks":
      return groupBlankIds(group).map((id) => ({ id, mode: "option" }));
    case "text-items":
      return items.map((it) => ({ id: it.id, mode: "text" }));
    case "choice-items":
    case "fixed-items":
    case "option-items":
      return items.map((it) => ({ id: it.id, mode: "option" }));
    case "multi-items":
      return items.flatMap((it) =>
        Array.from({ length: multiCount(it) }, (_, index) => ({ id: `${it.id}#${index}`, mode: "multi", itemId: it.id, index }))
      );
    case "text-markers":
      return markers.map((m) => ({ id: m.id, mode: "text" }));
    case "option-markers":
      return markers.map((m) => ({ id: m.id, mode: "option" }));
    default:
      return [];
  }
}

export function countSlots(groups) {
  return (groups || []).reduce((sum, g) => sum + groupSlots(g).length, 0);
}

// Everything a candidate may see: answers and editor-only deltas are removed.
export function publicGroup(group) {
  const { answers: _answers, instructionDelta: _i, contentDelta: _c, ...rest } = group;
  const out = { ...rest };
  if (group.table) {
    out.table = {
      columns: group.table.columns || [],
      rows: (group.table.rows || []).map((row) => row.map((cell) => ({ html: cell?.html || "" })))
    };
  }
  if (group.steps) out.steps = group.steps.map((s) => ({ html: s?.html || "" }));
  if (group.items) out.items = group.items.map(({ correct: _correct, ...item }) => item);
  return out;
}

// Assigns running question numbers to every slot of the given groups.
export function numberGroups(groups, start) {
  let n = start;
  const numbered = (groups || []).map((g) => {
    const slots = groupSlots(g).map((s) => ({ ...s, n: n++ }));
    return { group: g, slots };
  });
  return { numbered, next: n };
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/^[£$€]\s*/, "")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/(\d)\s*[:.]\s*(\d{2})\b/g, "$1:$2")
    .replace(/[.,;:!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function acceptedAnswers(key) {
  if (!key) return [];
  const list = [key.value, ...(key.variations || [])].flat();
  return list.map((v) => String(v ?? "").trim()).filter(Boolean);
}

export function textMatches(given, accepted) {
  const g = normalizeText(given);
  if (!g) return false;
  return accepted.some((a) => normalizeText(a) === g);
}

// Grades one group. `responses` maps slotId -> string, and multi-answer
// itemId -> string[]. Returns one row per slot, in slot order.
export function gradeGroup(group, responses = {}) {
  const rows = [];
  const multiDone = new Set();
  for (const slot of groupSlots(group)) {
    if (slot.mode === "multi") {
      if (multiDone.has(slot.itemId)) continue;
      multiDone.add(slot.itemId);
      const item = (group.items || []).find((it) => it.id === slot.itemId);
      const n = multiCount(item);
      const correctSet = (item?.correct || []).map(String);
      const raw = responses[slot.itemId];
      const selected = (Array.isArray(raw) ? raw : []).map(String).slice(0, n);
      const hits = selected.filter((k) => correctSet.includes(k));
      const misses = selected.filter((k) => !correctSet.includes(k));
      const missing = correctSet.filter((k) => !selected.includes(k));
      for (let k = 0; k < n; k++) {
        const isCorrect = k < hits.length;
        rows.push({
          slotId: `${slot.itemId}#${k}`,
          given: isCorrect ? hits[k] : misses[k - hits.length] ?? "",
          expected: isCorrect ? [hits[k]] : missing.length ? [missing[Math.min(k - hits.length, missing.length - 1)]] : [],
          correct: isCorrect
        });
      }
      continue;
    }
    const key = group.answers?.[slot.id];
    const given = responses[slot.id];
    const accepted = acceptedAnswers(key);
    let correct = false;
    if (slot.mode === "text") {
      correct = textMatches(given, accepted);
    } else {
      correct = given != null && given !== "" && accepted.length > 0 && String(given).toUpperCase() === String(accepted[0]).toUpperCase();
    }
    rows.push({ slotId: slot.id, given: Array.isArray(given) ? given.join(", ") : String(given ?? ""), expected: accepted, correct });
  }
  return rows;
}

// Server-side sanity checks for content coming from the admin editors.
export function validateGroups(groups) {
  if (!Array.isArray(groups)) return "Questions must be a list";
  for (const [i, g] of groups.entries()) {
    if (!g || typeof g !== "object") return `Question block ${i + 1} is invalid`;
    if (!QUESTION_TYPES[g.type]) return `Question block ${i + 1} has an unknown type`;
    if (!g.id) return `Question block ${i + 1} is missing an id`;
    const slots = groupSlots(g);
    if (slots.length === 0) return `Question block ${i + 1} has no questions`;
    const def = QUESTION_TYPES[g.type];
    if (def.kind === "multi-items") {
      for (const item of g.items || []) {
        if ((item.correct || []).length !== multiCount(item)) return `Question block ${i + 1}: choose exactly ${multiCount(item)} correct options`;
      }
    } else {
      for (const s of slots) {
        if (acceptedAnswers(g.answers?.[s.id]).length === 0) return `Question block ${i + 1} is missing a correct answer`;
      }
    }
  }
  return null;
}
