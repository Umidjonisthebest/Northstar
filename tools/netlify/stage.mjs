// Copies what Netlify needs into a clean folder, to deploy from there:
//   node tools/netlify/stage.mjs <folder>
// Netlify's upload tool sends everything in the folder it runs in. From this folder that would
// include node_modules (built for Windows, which breaks the build on Netlify's Linux machines),
// the development database and its backups. The staged copy has the source, the question pack,
// the starter IELTS files and the seed database only.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const target = process.argv[2] && path.resolve(process.argv[2]);
if (!target) throw new Error("Usage: node tools/netlify/stage.mjs <folder>");
if (target === root || root.startsWith(target + path.sep)) throw new Error("Choose a folder outside the project");
const seed = path.join(root, "backend", "data", "netlify-seed.json");
if (!fs.existsSync(seed)) throw new Error("backend/data/netlify-seed.json is missing: run tools/netlify/seed.mjs first");

const SKIP_DIRS = new Set(["node_modules", "dist", "uploads", "data", ".netlify", ".git"]);
const skip = (src) => {
  const name = path.basename(src);
  if (fs.statSync(src).isDirectory()) return SKIP_DIRS.has(name);
  return name === ".env" || name.endsWith(".test.js");
};

fs.rmSync(target, { recursive: true, force: true });
for (const part of ["backend", "frontend", "netlify", path.join("tools", "netlify"), "netlify.toml"]) {
  fs.cpSync(path.join(root, part), path.join(target, part), { recursive: true, filter: (src) => !skip(src) });
}
fs.mkdirSync(path.join(target, "backend", "data"), { recursive: true });
fs.copyFileSync(seed, path.join(target, "backend", "data", "netlify-seed.json"));

let files = 0;
let bytes = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else {
      files++;
      bytes += fs.statSync(full).size;
    }
  }
};
walk(target);
console.log(`Staged ${files} files (${(bytes / 1048576).toFixed(1)} MB) in ${target}`);
