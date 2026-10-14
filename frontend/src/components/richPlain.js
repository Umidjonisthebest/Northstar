// What a RichText tree says, as plain text: for labels read by a screen reader, where a stacked
// fraction or a root has to be put into words.
export function richPlain(node) {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(richPlain).join("");
  if (!node) return "";
  if (node.t === "frac") return `${richPlain(node.n)} over ${richPlain(node.d)}`;
  if (node.t === "root") return `the square root of ${richPlain(node.c)}`;
  if (node.t === "sup") return ` to the power ${richPlain(node.c)}`;
  return richPlain(node.c);
}
