// Exports the cut-outs into the app and builds the social preview image.
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { load } from "./lib.mjs";

const IMG = path.resolve("..", "..", "images");
const APP = "C:/Users/NotebookService/Desktop/Mock App Project/northstar-sat/frontend";
const ART = `${APP}/src/assets/art`;

// 1. Drop-in pictures.
await sharp("out/target.png").resize({ width: 640 }).webp({ quality: 92, alphaQuality: 100 }).toFile(`${ART}/target.webp`);
await sharp("out/trail.png").resize({ width: 880 }).webp({ quality: 90, alphaQuality: 100 }).toFile(`${ART}/trail.webp`);
for (const f of fs.readdirSync("out").filter((f) => f.startsWith("spot-"))) {
  await sharp(`out/${f}`).webp({ quality: 94, alphaQuality: 100 }).toFile(`${ART}/${f.replace(".png", ".webp")}`);
}

// 2. Social preview, 1200x630.
const src = await load(path.join(IMG, "13.png"));
const at = (x, y) => { const i = (y * src.w + x) * 4; return [src.data[i], src.data[i + 1], src.data[i + 2]]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// The generated picture has a paler rectangle over its left half. Find its right edge...
let seam = 0, jump = 0;
for (let x = 300; x < 800; x++) { const d = dist(at(x, 30), at(x + 2, 30)); if (d > jump) { jump = d; seam = x; } }
console.log("seam at", seam, "jump", jump.toFixed(1));
// ...and repaint that rectangle's sky with the sky to its right, row by row. Hills are left alone.
const edge = seam + 8;
// Sky colour per row on each side, frozen at the first row where that column stops being sky.
const skyOf = (x) => { const out = []; let live = true; for (let y = 0; y < src.h; y++) { if (y && live && dist(at(x, y), at(x, y - 1)) > 5) live = false; out.push(live ? at(x, y) : out[y - 1]); } return out; };
const skyL = skyOf(3), skyR = skyOf(edge);
for (let x = 0; x < edge; x++) {
  for (let y = 0; y < src.h; y++) {
    if (dist(at(x, y), skyL[y]) >= 12) break; // reached a hill: leave everything below alone
    const i = (y * src.w + x) * 4, R = skyR[y];
    src.data[i] = R[0]; src.data[i + 1] = R[1]; src.data[i + 2] = R[2];
  }
}
const W = 1200, H = 630, scale = H / src.h, left = Math.round(src.w * scale) - W;
const base = await sharp(src.data, { raw: { width: src.w, height: src.h, channels: 4 } }).resize({ height: H }).extract({ left, top: 0, width: W, height: H }).png().toBuffer();

const INK = "#2b2553";
const mark = (s) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="a" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#ffa3cf"/><stop offset=".5" stop-color="#e89fe6"/><stop offset="1" stop-color="#a49cf4"/></linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f1ff"/><stop offset="1" stop-color="#ddd4fb"/></linearGradient>
  </defs>
  <polygon points="50,13 63,35.5 88.5,41 71,60.5 73.8,86.5 50,76 26.2,86.5 29,60.5 11.5,41 37,35.5" fill="url(#a)" stroke="url(#a)" stroke-width="15" stroke-linejoin="round"/>
  <ellipse cx="29" cy="40" rx="7" ry="3.4" fill="#fff" opacity=".55" transform="rotate(-24 29 40)"/>
  <path d="M50 3 L56.5 16 L50 31 L43.5 16 Z" fill="${INK}"/><path d="M50 3 L56.5 16 L50 20 L43.5 16 Z" fill="#ff7a6b"/>
  <rect x="27" y="39" width="46" height="35" rx="10" fill="url(#b)" stroke="${INK}" stroke-width="5.5"/>
  <g fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"><path d="M36.5 54 q4 -5 8 0"/><path d="M55.5 54 q4 -5 8 0"/><path d="M43.5 62 q6.5 6 13 0"/></g>
</svg>`);
const text = (t, font, file, color, spacing = 0) =>
  sharp({ text: { text: `<span foreground="${color}">${t}</span>`, font, fontfile: file, rgba: true, dpi: 72, spacing } }).png().toBuffer();

const nova = await sharp(`${APP}/src/assets/nova/nova-3d.webp`).resize({ height: 190 }).toBuffer();
const novaMeta = await sharp(nova).metadata();
// The clear patch on the path, in the source picture, is centred near (740, 258).
const px = Math.round(740 * scale) - left, py = Math.round(262 * scale);
const shadow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><ellipse cx="100" cy="20" rx="78" ry="12" fill="#3a3690" opacity=".18"/></svg>`);

await sharp(base)
  .composite([
    { input: shadow, left: px - 100, top: py - 22 },
    { input: nova, left: px - Math.round(novaMeta.width / 2), top: py - novaMeta.height + 6 },
    { input: mark(72), left: 70, top: 84 },
    { input: await text("northstar", "Fredoka Semi-Bold 46", "fonts/fredoka.ttf", "#17152f"), left: 156, top: 100 },
    { input: await text("Digital SAT and IELTS\npractice with Nova", "Fredoka Semi-Bold 62", "fonts/fredoka.ttf", "#17152f", 8), left: 70, top: 214 },
    { input: await text("Practice questions, timed mock tests\nand a weekly study plan. Free.", "Nunito Semi-Bold 30", "fonts/nunito.ttf", "#55526f", 8), left: 72, top: 392 }
  ])
  .png({ compressionLevel: 9 })
  .toFile(`${APP}/public/social-preview.png`);

// 3. App icon: the mark on lilac paper.
await sharp({ create: { width: 180, height: 180, channels: 4, background: "#f1eefc" } })
  .composite([{ input: mark(140), left: 20, top: 20 }])
  .png()
  .toFile(`${APP}/public/apple-touch-icon.png`);

console.log(fs.readdirSync(ART).join(", "));
