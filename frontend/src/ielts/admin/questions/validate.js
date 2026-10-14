import { groupSlots, multiCount, TYPE_DEFS } from "../../lib/questionTypes.js";
import { isHtmlEmpty } from "../../lib/richHtml.jsx";

// Returns an error message for the first problem found, or null.
export function validateGroup(group, startNumber = 1) {
  const def = TYPE_DEFS[group.type];
  const slots = groupSlots(group);
  if (!slots.length) {
    if (def.kind === "text-blanks" || def.kind === "option-blanks") return "Add at least one blank — put the cursor in the text and press Ctrl+K.";
    if (def.kind === "text-markers" || def.kind === "option-markers") return group.image ? "Click on the image to place at least one gap." : "Upload an image first.";
    if (group.type === "matching_headings") return "Add at least one paragraph (use “Sync with passage”).";
    return "Add at least one question.";
  }
  if (["map_select", "diagram_completion", "diagram_dnd", "map_dnd"].includes(group.type) && !group.image?.url) return "Please upload the image.";

  const needsOptionText = ["option-blanks", "option-items", "option-markers"].includes(def.kind) && group.type !== "map_select";
  if (needsOptionText) {
    if ((group.options || []).length < 2) return "Add at least two options.";
    const blank = (group.options || []).find((o) => !o.text.trim());
    if (blank) return `Option ${blank.key} has no text.`;
  }

  if (["text-items", "choice-items", "fixed-items", "multi-items", "option-items"].includes(def.kind)) {
    const idx = (group.items || []).findIndex((it) => !String(it.text || "").trim());
    if (idx !== -1) return `Question ${startNumber + idx} has no text.`;
  }
  if (def.kind === "choice-items") {
    for (const [i, it] of group.items.entries()) {
      const empty = it.options.find((o) => !o.text.trim());
      if (empty) return `Question ${startNumber + i}: option ${empty.key} has no text.`;
    }
  }
  if (def.kind === "multi-items") {
    let n = startNumber;
    for (const it of group.items) {
      const count = multiCount(it);
      const empty = it.options.find((o) => !o.text.trim());
      if (empty) return `Questions ${n}-${n + count - 1}: option ${empty.key} has no text.`;
      if ((it.correct || []).length !== count) return `Questions ${n}-${n + count - 1}: tick exactly ${count} correct options.`;
      n += count;
    }
    return null;
  }

  for (const [i, slot] of slots.entries()) {
    const value = group.answers?.[slot.id]?.value;
    if (!String(value || "").trim()) return `Question ${startNumber + i} has no correct answer.`;
  }
  return null;
}

export function groupPreviewText(group) {
  const def = TYPE_DEFS[group.type];
  if (group.items?.length) return group.items.map((it) => it.text).filter(Boolean).join(" · ");
  if (def.from === "content" && !isHtmlEmpty(group.contentHtml)) return group.contentHtml.replace(/<span[^>]*ql-blank[^>]*><\/span>/g, " ____ ").replace(/<[^>]+>/g, " ");
  if (def.from === "steps") return (group.steps || []).map((s) => s.html.replace(/<[^>]+>/g, " ")).join(" → ");
  if (def.from === "table") return `${group.table?.rows?.length || 0} rows × ${group.table?.columns?.length || 0} columns`;
  if (group.markers) return `${group.markers.length} gap(s) on the image`;
  return "";
}
