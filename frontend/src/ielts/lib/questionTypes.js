// Mirrors backend/lib/questions.js — keep the two in sync.

const COMPLETE = (what, words = "ONE WORD ONLY") => `<p>Complete the ${what} below.</p><p>Write <strong>${words}</strong> for each answer.</p>`;

export const TYPE_DEFS = {
  note_completion: { label: "Note Completion", kind: "text-blanks", from: "content", helper: "Complete the notes.", instruction: COMPLETE("notes") },
  table_completion: { label: "Table Completion", kind: "text-blanks", from: "table", helper: "Complete the table.", instruction: COMPLETE("table") },
  flowchart_completion: { label: "Flow-chart completion", kind: "text-blanks", from: "steps", helper: "Complete the flow-chart.", instruction: COMPLETE("flow-chart") },
  flowchart_dnd: {
    label: "Flow-chart completion (Drag and Drop)",
    kind: "option-blanks",
    from: "steps",
    helper: "Complete the flow-chart by dragging options into the gaps.",
    instruction: "<p>Complete the flow-chart below.</p><p>Drag the correct letter into each gap.</p>"
  },
  summary_completion: {
    label: "Summary Completion (Regular)",
    kind: "text-blanks",
    from: "content",
    helper: "Complete the concept with word(s) from the text.",
    instruction: COMPLETE("summary", "NO MORE THAN TWO WORDS")
  },
  summary_dnd: {
    label: "Summary Completion (Drag and Drop)",
    kind: "option-blanks",
    from: "content",
    helper: "Complete the summary using a list of words.",
    instruction: "<p>Complete the summary using the list of words below.</p>"
  },
  form_completion: { label: "Form Completion", kind: "text-blanks", from: "content", helper: "Complete the form.", instruction: COMPLETE("form", "ONE WORD AND/OR A NUMBER") },
  sentence_completion: { label: "Sentence Completion", kind: "text-blanks", from: "content", helper: "Complete the sentences.", instruction: COMPLETE("sentences") },
  short_answer: {
    label: "Short Answers",
    kind: "text-items",
    helper: "Answer the questions with a few words.",
    instruction: "<p>Answer the questions below.</p><p>Write <strong>NO MORE THAN THREE WORDS AND/OR A NUMBER</strong> for each answer.</p>"
  },
  multiple_choice: { label: "Multiple Choice", kind: "choice-items", helper: "Choose the correct letter.", instruction: "<p>Choose the correct letter, <strong>A, B or C</strong>.</p>" },
  multiple_answers: { label: "Multiple Answers", kind: "multi-items", helper: "Choose more than one correct letter.", instruction: "<p>Choose <strong>TWO</strong> letters, <strong>A–E</strong>.</p>" },
  matching_features: {
    label: "Matching Features (drag and drop)",
    kind: "option-items",
    helper: "Match each question with an option from the box.",
    instruction: "<p>Drag the correct letter next to each question.</p>",
    reuse: true
  },
  matching_information: {
    label: "Matching Information (drag and drop)",
    kind: "option-items",
    helper: "Which paragraph contains the information?",
    instruction: "<p>Which paragraph contains the following information?</p><p><em>NB</em> You may use any letter more than once.</p>",
    reuse: true,
    readingOnly: true
  },
  matching_sentence_endings: {
    label: "Matching Sentence Endings (drag and drop)",
    kind: "option-items",
    helper: "Complete each sentence with the correct ending.",
    instruction: "<p>Complete each sentence with the correct ending below.</p>",
    readingOnly: true
  },
  matching_headings: {
    label: "Matching Headings (drag and drop)",
    kind: "option-items",
    helper: "Choose the correct heading for each paragraph (uses the Ctrl+H heading gaps in the passage).",
    instruction: "<p>Choose the correct heading for each paragraph from the list of headings below.</p>",
    readingOnly: true
  },
  tfng: {
    label: "True / False / Not Given",
    kind: "fixed-items",
    values: ["TRUE", "FALSE", "NOT GIVEN"],
    helper: "Do the statements agree with the information in the text?",
    instruction:
      "<p>Choose <strong>TRUE</strong> if the statement agrees with the information given in the text, choose <strong>FALSE</strong> if the statement contradicts the information, or choose <strong>NOT GIVEN</strong> if there is no information on this.</p>",
    readingOnly: true
  },
  ynng: {
    label: "Yes / No / Not Given",
    kind: "fixed-items",
    values: ["YES", "NO", "NOT GIVEN"],
    helper: "Do the statements agree with the claims of the writer?",
    instruction:
      "<p>Choose <strong>YES</strong> if the statement agrees with the claims of the writer, choose <strong>NO</strong> if the statement contradicts the claims of the writer, or choose <strong>NOT GIVEN</strong> if it is impossible to say what the writer thinks about this.</p>",
    readingOnly: true
  },
  diagram_completion: {
    label: "Diagram Label Completion",
    kind: "text-markers",
    helper: "Label the diagram — candidates type into boxes placed on the image.",
    instruction: "<p>Label the diagram below.</p><p>Write <strong>NO MORE THAN TWO WORDS</strong> for each answer.</p>"
  },
  diagram_dnd: {
    label: "Diagram Labelling (drag and drop)",
    kind: "option-markers",
    helper: "Label the diagram by dragging options onto it.",
    instruction: "<p>Label the diagram below.</p><p>Drag the correct answer onto each gap.</p>"
  },
  map_dnd: {
    label: "Diagram and map labelling (drag and drop)",
    kind: "option-markers",
    helper: "Label the map by dragging options onto it.",
    instruction: "<p>Label the map below.</p><p>Drag the correct answer onto each gap.</p>"
  },
  map_select: {
    label: "Diagram and map labelling (select options)",
    kind: "option-items",
    helper: "Candidates choose a letter from the map for each place.",
    instruction: "<p>Label the map below.</p><p>Choose the correct letter, <strong>A–H</strong>, next to each place.</p>"
  }
};

const LISTENING_ORDER = [
  "note_completion",
  "table_completion",
  "flowchart_completion",
  "flowchart_dnd",
  "summary_completion",
  "summary_dnd",
  "form_completion",
  "sentence_completion",
  "short_answer",
  "multiple_choice",
  "multiple_answers",
  "matching_features",
  "diagram_completion",
  "diagram_dnd",
  "map_dnd",
  "map_select"
];

const READING_ORDER = [
  "tfng",
  "ynng",
  "matching_headings",
  "matching_information",
  "matching_features",
  "matching_sentence_endings",
  "multiple_choice",
  "multiple_answers",
  "note_completion",
  "summary_completion",
  "summary_dnd",
  "sentence_completion",
  "table_completion",
  "flowchart_completion",
  "flowchart_dnd",
  "short_answer",
  "diagram_completion",
  "diagram_dnd"
];

export function typeOptions(kind) {
  const order = kind === "reading" ? READING_ORDER : LISTENING_ORDER;
  return order.map((value) => ({ value, label: TYPE_DEFS[value].label }));
}

const BLANK_TAG = /<span\b[^>]*\bql-blank\b[^>]*>/gi;
const HEADING_TAG = /<div\b[^>]*\bql-heading-slot\b[^>]*>/gi;
const DATA_ID = /\bdata-id\s*=\s*["']([^"']+)["']/i;

function idsIn(html, re) {
  const ids = [];
  for (const m of String(html || "").matchAll(re)) {
    const id = DATA_ID.exec(m[0])?.[1];
    if (id) ids.push(id);
  }
  return ids;
}

export const blankIdsInHtml = (html) => idsIn(html, BLANK_TAG);
export const headingSlotIdsInHtml = (html) => idsIn(html, HEADING_TAG);

export function groupBlankIds(group) {
  const def = TYPE_DEFS[group.type];
  let ids = [];
  if (def?.from === "content") ids = blankIdsInHtml(group.contentHtml);
  else if (def?.from === "table") ids = (group.table?.rows || []).flatMap((row) => row.flatMap((cell) => blankIdsInHtml(cell?.html)));
  else if (def?.from === "steps") ids = (group.steps || []).flatMap((s) => blankIdsInHtml(s?.html));
  return [...new Set(ids)];
}

export function multiCount(item) {
  const n = Number(item?.count);
  if (Number.isInteger(n) && n > 0) return n;
  return Math.max(1, item?.correct?.length || 2);
}

export function groupSlots(group) {
  const def = TYPE_DEFS[group?.type];
  if (!def) return [];
  const items = group.items || [];
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
      return items.flatMap((it) => Array.from({ length: multiCount(it) }, (_, index) => ({ id: `${it.id}#${index}`, mode: "multi", itemId: it.id, index })));
    case "text-markers":
      return (group.markers || []).map((m) => ({ id: m.id, mode: "text" }));
    case "option-markers":
      return (group.markers || []).map((m) => ({ id: m.id, mode: "option" }));
    default:
      return [];
  }
}

export const slotCount = (group) => groupSlots(group).length;

export function letters(count) {
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

export const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];

export function questionRangeLabel(numbers) {
  if (!numbers.length) return "";
  const first = Math.min(...numbers);
  const last = Math.max(...numbers);
  return first === last ? `Question ${first}` : `Questions ${first}-${last}`;
}

// Whether a slot counts as answered for the footer navigation.
export function isSlotAnswered(slot, answers) {
  if (slot.mode === "multi") {
    const list = answers[slot.itemId];
    return Array.isArray(list) && list.length > slot.index;
  }
  const v = answers[slot.id];
  return v !== undefined && v !== null && String(v).trim() !== "";
}
