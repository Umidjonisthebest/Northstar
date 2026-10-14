// Second emotion sheet (nova-emotions-2.png): labelled poses with ground shadows.
import fs from "fs";
import sharp from "sharp";
import { load, crop, cutout, despeckle, squareOf, toSharp } from "./lib.mjs";

const SRC = "C:/Users/NotebookService/Desktop/Mock App Project/_inbox/characters/nova-emotions-2.png";
const OUT = "./out";
const sheet = await load(SRC);

// x0, y0, x1, y1 (generous; labels and ground shadows are removed below)
const BOX = {
  wink: [30, 140, 218, 348],
  wave: [220, 140, 420, 348],
  stern: [422, 215, 602, 405],
  excited: [604, 215, 802, 402],
  puzzled: [40, 468, 228, 670],
  laugh: [232, 495, 428, 680],
  determined: [424, 515, 602, 698],
  serene: [612, 528, 795, 702]
};

// Remove wide, flat islands near the bottom (ground shadows) and anything that is label text.
function dropShadows(img) {
  const { w, h } = img, n = w * h, seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (seen[i] || img.data[i * 4 + 3] < 30) continue;
    const comp = [i]; seen[i] = 1; let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let k = 0; k < comp.length; k++) {
      const c = comp[k], x = c % w, y = (c / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1]) if (j >= 0 && !seen[j] && img.data[j * 4 + 3] >= 30) { seen[j] = 1; comp.push(j); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const flat = bw / bh > 3.2 && y0 > h * 0.75 && bw > 30;
    if (flat) for (const c of comp) img.data[c * 4 + 3] = 0;
  }
  return img;
}

const names = [];
for (const [name, [x0, y0, x1, y1]] of Object.entries(BOX)) {
  const cut = dropShadows(despeckle(cutout(crop(sheet, x0, y0, x1 - x0, y1 - y0), { bg: [255, 255, 255], tol: 22, band: 2 }), 8));
  const sq = squareOf(cut, { margin: 0.04 });
  await toSharp(sq.data, sq.side, sq.side).png().toFile(`${OUT}/nova2-${name}.png`);
  names.push(name);
  console.log(name, sq.side);
}
const T = 300, comps = [];
for (let r = 0; r < 4; r++) comps.push({ input: { create: { width: T * 4, height: T, channels: 4, background: r % 2 ? "#141234" : "#f5f7fc" } }, left: 0, top: r * T });
for (const [i, n] of names.entries()) {
  const buf = await sharp(`${OUT}/nova2-${n}.png`).resize(T, T, { kernel: "lanczos3" }).png().toBuffer();
  comps.push({ input: buf, left: (i % 4) * T, top: Math.floor(i / 4) * T * 2 }, { input: buf, left: (i % 4) * T, top: Math.floor(i / 4) * T * 2 + T });
}
await sharp({ create: { width: T * 4, height: T * 4, channels: 4, background: "#fff" } }).composite(comps).png().toFile(`${OUT}/sheet-emotions2.png`);
