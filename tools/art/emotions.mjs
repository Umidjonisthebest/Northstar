import fs from "fs";
import sharp from "sharp";
import { load, crop, runs, cutout, despeckle, faceBox, squareOf, toSharp, bbox } from "./lib.mjs";

const IMG = "C:/Users/NOTEBO~1/AppData/Local/Temp/claude/C--Users-NotebookService-Desktop-Mock-App-Project/4e4eeb36-80c0-49cb-a453-1c25a7836448/images";
const OUT = "./out";
fs.mkdirSync(OUT, { recursive: true });

const sheet = await load(`${IMG}/12.jpg`);
const ink = (p) => p[0] < 236 || p[1] < 236 || p[2] < 236;
const rows = runs(sheet, "y", ink, 5, 60);
console.log("rows", rows);
const cells = [];
for (const [y0, y1] of rows) {
  const cols = runs(sheet, "x", ink, 40, 60, 0, sheet.w, y0, y1);
  console.log("  cols", cols);
  for (const [x0, x1] of cols) cells.push({ x: x0 - 8, y: y0 - 8, w: x1 - x0 + 16, h: y1 - y0 + 16 });
}
const names = ["happy", "thinking", "cheer", "angry", "surprised", "calm", "dim", "proud"];
const meta = {};
const tiles = [];
for (const [i, c] of cells.entries()) {
  const name = names[i] || `e${i}`;
  const cut = despeckle(cutout(crop(sheet, c.x, c.y, c.w, c.h), { bg: [255, 255, 255], tol: 26, band: 2 }), 10);
  const sq = squareOf(cut, { margin: 0.04 });
  const face = faceBox(cut);
  meta[name] = { src: c, side: sq.side, face: face && { x: (face.x + sq.ox) / sq.side, y: (face.y + sq.oy) / sq.side, w: face.w / sq.side, h: face.h / sq.side } };
  await toSharp(sq.data, sq.side, sq.side).png().toFile(`${OUT}/nova-${name}.png`);
  tiles.push({ name, side: sq.side });
}
fs.writeFileSync(`${OUT}/emotions.json`, JSON.stringify(meta, null, 1));
console.log(JSON.stringify(meta));

// Contact sheet: each sprite at 2x on a light and a dark ground.
const T = 300;
const comps = [];
for (const [i, t] of tiles.entries()) {
  const buf = await sharp(`${OUT}/nova-${t.name}.png`).resize(T, T, { kernel: "lanczos3" }).png().toBuffer();
  comps.push({ input: buf, left: (i % 4) * T, top: Math.floor(i / 4) * T * 2 });
  comps.push({ input: buf, left: (i % 4) * T, top: Math.floor(i / 4) * T * 2 + T });
}
const bgRows = [];
for (let r = 0; r < 4; r++) bgRows.push({ input: { create: { width: T * 4, height: T, channels: 4, background: r % 2 ? "#141234" : "#f5f7fc" } }, left: 0, top: r * T });
await sharp({ create: { width: T * 4, height: T * 4, channels: 4, background: "#fff" } }).composite([...bgRows, ...comps]).png().toFile(`${OUT}/sheet-emotions.png`);
