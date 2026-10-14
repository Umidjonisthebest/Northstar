import fs from "fs";
import sharp from "sharp";
import { load, crop, runs, cutout, despeckle, faceBox, squareOf, toSharp, borderColor } from "./lib.mjs";

const IMG = "C:/Users/NOTEBO~1/AppData/Local/Temp/claude/C--Users-NotebookService-Desktop-Mock-App-Project/4e4eeb36-80c0-49cb-a453-1c25a7836448/images";
const OUT = "./out";
fs.mkdirSync(OUT, { recursive: true });
const meta = {};

async function save(name, cut, margin = 0.04) {
  const sq = squareOf(cut, { margin });
  const face = faceBox(cut);
  meta[name] = { side: sq.side, face: face && { x: +((face.x + sq.ox) / sq.side).toFixed(4), y: +((face.y + sq.oy) / sq.side).toFixed(4), w: +(face.w / sq.side).toFixed(4), h: +(face.h / sq.side).toFixed(4) } };
  await toSharp(sq.data, sq.side, sq.side).png().toFile(`${OUT}/${name}.png`);
  return name;
}

async function contact(file, names, cols, T = 220, grounds = ["#f5f7fc", "#141234"]) {
  const rows = Math.ceil(names.length / cols);
  const comps = [];
  for (let r = 0; r < rows * grounds.length; r++) comps.push({ input: { create: { width: T * cols, height: T, channels: 4, background: grounds[r % grounds.length] } }, left: 0, top: r * T });
  for (const [i, n] of names.entries()) {
    const buf = await sharp(`${OUT}/${n}.png`).resize(T, T, { kernel: "lanczos3" }).png().toBuffer();
    for (let g = 0; g < grounds.length; g++) comps.push({ input: buf, left: (i % cols) * T, top: (Math.floor(i / cols) * grounds.length + g) * T });
  }
  await sharp({ create: { width: T * cols, height: T * rows * grounds.length, channels: 4, background: "#fff" } }).composite(comps).png().toFile(file);
}

const which = process.argv[2] || "all";

if (which === "all" || which === "friends") {
  const sheet = await load(`${IMG}/13.jpg`);
  const names = ["moon", "comet", "planet", "cloud", "ember", "sunny"];
  const cw = sheet.w / 3, ch = sheet.h / 2;
  const done = [];
  for (let i = 0; i < 6; i++) {
    const c = crop(sheet, (i % 3) * cw + 6, Math.floor(i / 3) * ch + 6, cw - 12, ch - 12);
    const bg = borderColor(c, 2);
    const cut = despeckle(cutout(c, { bg, tol: Number(process.argv[3] || 34), band: 2 }), 10);
    done.push(await save(`friend-${names[i]}`, cut));
    console.log(names[i], "bg", bg);
  }
  await contact(`${OUT}/sheet-friends.png`, done, 3, 300);
}

if (which === "all" || which === "master") {
  const img = await load(`${IMG}/11.jpg`);
  const bg = borderColor(img, 2);
  console.log("master bg", bg);
  const cut = despeckle(cutout(img, { bg, tol: Number(process.argv[3] || 30), band: 3 }), 30);
  await save("nova-3d", cut, 0.02);
  await contact(`${OUT}/sheet-master.png`, ["nova-3d"], 1, 600, ["#f5f7fc", "#141234", "#7a5cd6"]);
}

if (which === "all" || which === "avatars") {
  const done = [];
  let k = 0;
  for (const f of ["9.jpg", "10.jpg"]) {
    const sheet = await load(`${IMG}/${f}`);
    const ink = (p) => p[0] < 240 || p[1] < 240 || p[2] < 240;
    const rows = runs(sheet, "y", ink, 4, 80);
    for (const [y0, y1] of rows) {
      const cols = runs(sheet, "x", ink, 4, 80, 0, sheet.w, y0, y1);
      for (const [x0, x1] of cols) {
        k++;
        const inset = 13; // inside the tile's rounded corners
        const tile = crop(sheet, x0 + inset, y0 + inset, x1 - x0 - inset * 2, y1 - y0 - inset * 2);
        const bg = borderColor(tile, 1);
        const cut = despeckle(cutout(tile, { bg, tol: Number(process.argv[3] || 24), band: 2 }), 14);
        const name = `avatar-${String(k).padStart(2, "0")}`;
        await save(name, cut, 0.05);
        meta[name].tile = "#" + bg.map((v) => v.toString(16).padStart(2, "0")).join("");
        // the untouched tile as well, for comparison and as a fallback
        await toSharp(tile.data, tile.w, tile.h).png().toFile(`${OUT}/${name}-tile.png`);
        done.push(name);
      }
    }
  }
  console.log("avatars", done.length);
  await contact(`${OUT}/sheet-avatars-a.png`, done.slice(0, 15), 5, 200, ["#ffffff", "#141234", "#ff8a5c"]);
  await contact(`${OUT}/sheet-avatars-b.png`, done.slice(15), 5, 200, ["#ffffff", "#141234", "#ff8a5c"]);
}

const prev = fs.existsSync(`${OUT}/rest.json`) ? JSON.parse(fs.readFileSync(`${OUT}/rest.json`, "utf8")) : {};
fs.writeFileSync(`${OUT}/rest.json`, JSON.stringify({ ...prev, ...meta }, null, 1));
