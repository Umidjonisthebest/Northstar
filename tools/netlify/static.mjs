// Last step of the Netlify build: copies the files the backend serves from disk into the published
// site, at the same addresses, so Netlify's CDN serves them instead of the function.
//   backend/content/pack/media  -> /api/bank-media  (pictures of bank questions)
//   backend/ielts/seed/assets   -> /ielts-assets    (starter IELTS audio and pictures)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dist = path.join(root, "frontend", "dist");
if (!fs.existsSync(path.join(dist, "index.html"))) throw new Error("frontend/dist is missing: build the frontend first");

const copies = [
  ["backend/content/pack/media", "api/bank-media"],
  ["backend/ielts/seed/assets", "ielts-assets"]
];
for (const [from, to] of copies) {
  const src = path.join(root, from);
  if (!fs.existsSync(src)) {
    console.warn(`[static] ${from} is missing, skipped`);
    continue;
  }
  fs.cpSync(src, path.join(dist, to), { recursive: true });
  console.log(`[static] ${from} -> /${to}`);
}
