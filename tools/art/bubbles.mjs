// Splits the 3D Nova cut-out into the star itself and each loose bubble, so the page can move
// the bubbles one by one. Reads out/nova-3d.png (made by rest.mjs).
import fs from "fs";
import sharp from "sharp";
import { load, toSharp } from "./lib.mjs";

const NOVA = "C:/Users/NotebookService/Desktop/Mock App Project/northstar-sat/frontend/src/assets/nova";
const img = await load("./out/nova-3d.png");
const { w, h } = img, n = w * h;
const label = new Int32Array(n).fill(-1);
const comps = [];
for (let i = 0; i < n; i++) {
  if (label[i] >= 0 || img.data[i * 4 + 3] < 24) continue;
  const id = comps.length, list = [i];
  label[i] = id;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let k = 0; k < list.length; k++) {
    const c = list[k], x = c % w, y = (c / w) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    for (const j of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1]) if (j >= 0 && label[j] < 0 && img.data[j * 4 + 3] >= 24) { label[j] = id; list.push(j); }
  }
  comps.push({ id, size: list.length, x0, y0, x1, y1 });
}
comps.sort((a, b) => b.size - a.size);
const body = comps[0];
const bubbles = comps.slice(1).filter((c) => c.size > 80);
console.log("components", comps.length, "body", body.size, "bubbles", bubbles.map((b) => b.size));

const OUT = 800;
const scale = OUT / w;
// the star alone
const base = Buffer.from(img.data);
for (let i = 0; i < n; i++) if (label[i] !== body.id) base[i * 4 + 3] = 0;
await toSharp(base, w, h).resize(OUT, OUT, { kernel: "lanczos3" }).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toFile(`${NOVA}/nova-3d.webp`);

const meta = [];
for (const [k, b] of bubbles.entries()) {
  const pad = 4;
  const bx = Math.max(0, b.x0 - pad), by = Math.max(0, b.y0 - pad);
  const bw = Math.min(w, b.x1 + pad + 1) - bx, bh = Math.min(h, b.y1 + pad + 1) - by;
  const buf = Buffer.alloc(bw * bh * 4);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const s = (by + y) * w + bx + x;
    if (label[s] !== b.id) continue;
    img.data.copy(buf, (y * bw + x) * 4, s * 4, s * 4 + 4);
  }
  const file = `nova-3d-bubble-${k + 1}.webp`;
  await toSharp(buf, bw, bh).resize(Math.max(8, Math.round(bw * scale * 1.5)), null, { kernel: "lanczos3" }).webp({ quality: 88, alphaQuality: 100 }).toFile(`${NOVA}/${file}`);
  const r = (v) => Math.round(v * 1000) / 10;
  meta.push({ file, x: r(bx / w), y: r(by / h), w: r(bw / w), h: r(bh / h) });
}
console.log(JSON.stringify(meta));
// preview
const comp = [{ input: await sharp(`${NOVA}/nova-3d.webp`).resize(500, 500).png().toBuffer(), left: 0, top: 0 }];
await sharp({ create: { width: 500, height: 500, channels: 4, background: "#17134a" } }).composite(comp).png().toFile("./out/sheet-nova3d-base.png");
