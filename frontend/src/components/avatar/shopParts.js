// Which parts of a profile picture have to be bought first. The server decides (backend/shop.js)
// and sends the catalogue and what the student owns with their progress, as `progress.chunks`:
//   { balance, owned: [item id], novaCost, items: [{ id, kind, value, name, price }] }
// `kind` is "avatar" | "accessory" | "frame" and `value` the part's own id.

// The shop item for a part, or null when the part is free.
export const shopItem = (chunks, kind, value) => chunks?.items.find((i) => i.kind === kind && i.value === value) || null;

// The shop item the student still has to buy before wearing this part, or null when they may.
export function lockedItem(chunks, kind, value) {
  const item = shopItem(chunks, kind, value);
  return item && !chunks.owned.includes(item.id) ? item : null;
}

export const chunkWord = (n) => `comet chunk${n === 1 ? "" : "s"}`;
