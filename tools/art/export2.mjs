import fs from "fs";
import sharp from "sharp";
import { load, faceBox } from "./lib.mjs";
const NOVA = "C:/Users/NotebookService/Desktop/Mock App Project/northstar-sat/frontend/src/assets/nova";
const out = {};
for (const e of ["wink", "wave", "excited", "puzzled", "laugh", "determined", "serene"]) {
  const src = `./out/nova2-${e}.png`;
  await sharp(src).resize(384, 384, { kernel: "lanczos3" }).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(`${NOVA}/nova-${e}.webp`);
  const img = await load(src);
  const f = faceBox(img);
  const r = (v) => Math.round(v * 1000) / 10;
  out[e] = { x: r(f.x / img.w), y: r(f.y / img.h), w: r(f.w / img.w), h: r(f.h / img.h) };
}
console.log(JSON.stringify(out));
// night-sky backgrounds for the skill map and the hero
const BG = "C:/Users/NotebookService/Desktop/Mock App Project/_inbox/backgrounds";
const DEST = "C:/Users/NotebookService/Desktop/Mock App Project/northstar-sat/frontend/src/assets/sky";
fs.mkdirSync(DEST, { recursive: true });
await sharp(`${BG}/night-sky-landscape.jpg`).resize(1600, null, { kernel: "lanczos3" }).webp({ quality: 78, effort: 6 }).toFile(`${DEST}/night-sky-wide.webp`);
await sharp(`${BG}/night-sky-portrait.jpg`).resize(800, null, { kernel: "lanczos3" }).webp({ quality: 78, effort: 6 }).toFile(`${DEST}/night-sky-tall.webp`);
for (const f of fs.readdirSync(DEST)) console.log(f, Math.round(fs.statSync(`${DEST}/${f}`).size / 1024) + " KB");
