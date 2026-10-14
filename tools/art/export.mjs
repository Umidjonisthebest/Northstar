// Writes the finished art into the project as small WebP files, with the face position of each.
import fs from "fs";
import sharp from "sharp";
import { load } from "./lib.mjs";

const OUT = "./out";
const FE = "C:/Users/NotebookService/Desktop/Mock App Project/northstar-sat/frontend";
const BE = "C:/Users/NotebookService/Desktop/Mock App Project/northstar-sat/backend";
const NOVA = `${FE}/src/assets/nova`;
const AV = `${FE}/public/avatars`;
const AVB = `${BE}/assets/avatars`;
for (const d of [NOVA, AV, AVB]) fs.mkdirSync(d, { recursive: true });

// The screen frame: the largest dark navy blob that doesn't touch the picture's edge
// (so a navy tile behind an avatar isn't mistaken for it). Returned in 0..100 units.
async function face(file) {
  const img = await load(file);
  const { w, h } = img, n = w * h, seen = new Uint8Array(n);
  const dark = (i) => { const r = img.data[i * 4], g = img.data[i * 4 + 1], b = img.data[i * 4 + 2], a = img.data[i * 4 + 3]; return a > 200 && r < 88 && g < 82 && b < 125 && b >= r - 8; };
  let best = null;
  for (let i = 0; i < n; i++) {
    if (seen[i] || !dark(i)) continue;
    const comp = [i]; seen[i] = 1; let x0 = w, y0 = h, x1 = 0, y1 = 0, edge = false;
    for (let k = 0; k < comp.length; k++) {
      const c = comp[k], x = c % w, y = (c / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      for (const j of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1]) if (j >= 0 && !seen[j] && dark(j)) { seen[j] = 1; comp.push(j); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (edge || bw < w * 0.18 || bh < h * 0.14) continue;
    // a frame is a ring: its pixels are a small share of its box
    const area = bw * bh;
    if (!best || area > best.area) best = { x: x0, y: y0, w: bw, h: bh, area };
  }
  const r = (v) => Math.round(v * 1000) / 10;
  return best && { x: r(best.x / w), y: r(best.y / h), w: r(best.w / w), h: r(best.h / h) };
}

const data = { nova: {}, friends: {}, avatars: {} };

const emotions = ["happy", "thinking", "cheer", "surprised", "calm", "dim", "proud"]; // "angry" is deliberately not exported
for (const e of emotions) {
  const src = `${OUT}/nova-${e}.png`;
  await sharp(src).resize(384, 384, { kernel: "lanczos3" }).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(`${NOVA}/nova-${e}.webp`);
  data.nova[e] = await face(src);
}
for (const f of ["moon", "comet", "planet", "cloud", "ember", "sunny"]) {
  const src = `${OUT}/friend-${f}.png`;
  await sharp(src).resize(384, 384, { kernel: "lanczos3" }).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(`${NOVA}/friend-${f}.webp`);
  data.friends[f] = await face(src);
}
await sharp(`${OUT}/nova-3d.png`).resize(800, 800, { kernel: "lanczos3" }).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toFile(`${NOVA}/nova-3d.webp`);
data.nova["3d"] = await face(`${OUT}/nova-3d.png`);

for (let k = 1; k <= 30; k++) {
  const id = String(k).padStart(2, "0");
  const src = `${OUT}/avatar-${id}-tile.png`;
  const buf = await sharp(src).resize(192, 192, { fit: "cover", kernel: "lanczos3" }).webp({ quality: 86, effort: 6 }).toBuffer();
  fs.writeFileSync(`${AV}/${id}.webp`, buf);
  fs.writeFileSync(`${AVB}/${id}.webp`, buf);
  // measured on a square copy, the way it is shown
  const sq = `${OUT}/avatar-${id}-sq.png`;
  await sharp(src).resize(192, 192, { fit: "cover" }).png().toFile(sq);
  data.avatars[id] = await face(sq);
}
fs.writeFileSync(`${OUT}/faces.json`, JSON.stringify(data, null, 1));
const kb = (dir) => fs.readdirSync(dir).reduce((s, f) => s + fs.statSync(`${dir}/${f}`).size, 0) / 1024;
console.log(JSON.stringify(data));
console.log(`nova ${kb(NOVA).toFixed(0)} KB in ${fs.readdirSync(NOVA).length} files; avatars ${kb(AV).toFixed(0)} KB in ${fs.readdirSync(AV).length} files`);
