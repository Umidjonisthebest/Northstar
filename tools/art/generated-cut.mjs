// Cuts the owner's generated pictures out of their flat grounds. Writes PNGs to ./out and a contact sheet.
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { load, cutout, despeckle, borderColor, crop } from "./lib.mjs";

const IMG = path.resolve("..", "..", "images");
const OUT = path.resolve("out");
fs.mkdirSync(OUT, { recursive: true });

const save = (img, name) => sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } }).png().toFile(path.join(OUT, name));

// Bounding boxes of opaque islands of at least `min` pixels.
function islands(img, min) {
  const { w, h } = img, n = w * h, seen = new Uint8Array(n), out = [];
  for (let i = 0; i < n; i++) {
    if (seen[i] || img.data[i * 4 + 3] < 40) continue;
    const comp = [i]; seen[i] = 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let k = 0; k < comp.length; k++) {
      const c = comp[k], x = c % w, y = (c / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1]) if (j >= 0 && !seen[j] && img.data[j * 4 + 3] >= 40) { seen[j] = 1; comp.push(j); }
    }
    if (comp.length >= min) out.push({ x0, y0, x1, y1, size: comp.length });
  }
  return out;
}
function trim(img, pad = 6) {
  const b = islands(img, 1).reduce((a, c) => ({ x0: Math.min(a.x0, c.x0), y0: Math.min(a.y0, c.y0), x1: Math.max(a.x1, c.x1), y1: Math.max(a.y1, c.y1) }), { x0: img.w, y0: img.h, x1: 0, y1: 0 });
  return crop(img, b.x0 - pad, b.y0 - pad, b.x1 - b.x0 + 1 + pad * 2, b.y1 - b.y0 + 1 + pad * 2);
}

const what = process.argv[2] || "all";

if (what === "all" || what === "target") {
  const img = await load(path.join(IMG, "9.png"));
  console.log("target border", borderColor(img));
  const cut = despeckle(cutout(img, { tol: 22, band: 2 }), 30);
  await save(trim(cut, 8), "target.png");
}

if (what === "all" || what === "trail") {
  const img = await load(path.join(IMG, "10.png"));
  const bg = borderColor(img);
  const at = (x, y) => [...img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 3)];
  console.log("trail border", bg, "circle", at(512, 300), at(300, 700), "corner", at(20, 20), at(1000, 1000));
  const tol = Number(process.argv[3]) || 5;
  const cut = despeckle(cutout(img, { tol, band: 1 }), 8);
  await save(cut, "trail.png");
}

if (what === "all" || what === "spots") {
  const img = await load(path.join(IMG, "11.png"));
  console.log("spots border", borderColor(img));
  const cut = despeckle(cutout(img, { tol: 46, band: 2 }), 60);
  const found = islands(cut, 4000).sort((a, b) => (Math.abs(a.y0 - b.y0) > 80 ? a.y0 - b.y0 : a.x0 - b.x0));
  console.log("spots found", found.length, found.map((f) => `${f.x0},${f.y0} ${f.x1 - f.x0}x${f.y1 - f.y0}`).join(" | "));
  const names = ["checklist", "bullseye", "chart", "calendar", "target", "trophy", "note", "bookmark"];
  for (const [i, f] of found.entries()) await save(crop(cut, f.x0 - 4, f.y0 - 4, f.x1 - f.x0 + 9, f.y1 - f.y0 + 9), `spot-${names[i] || i}.png`);
}

// Contact sheet on light and dark.
const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".png") && !f.startsWith("sheet"));
const cell = 260;
const comps = [];
for (const [i, f] of files.entries()) {
  const buf = await sharp(path.join(OUT, f)).resize(cell - 20, cell - 20, { fit: "inside" }).toBuffer();
  comps.push({ input: buf, left: 10 + (i % 6) * cell, top: 10 + Math.floor(i / 6) * cell });
}
const rows = Math.ceil(files.length / 6);
for (const [name, bgc] of [["light", "#f6f5fb"], ["dark", "#1a1738"]]) {
  await sharp({ create: { width: cell * 6, height: cell * rows, channels: 4, background: bgc } }).composite(comps).png().toFile(path.join(OUT, `sheet-${name}.png`));
}
console.log("files", files.join(", "));
