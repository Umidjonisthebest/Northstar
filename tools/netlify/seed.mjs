// Makes backend/data/netlify-seed.json: the database a new Netlify site starts from. It is a copy
// of backend/data/db.json with the admin's development password replaced by a random one, which is
// written to netlify-admin-login.txt next to netlify.toml (never printed).
//
// Run once before the first deploy: node tools/netlify/seed.mjs
// The live site only reads the seed while it has no database of its own; later deploys don't touch its data.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const bcrypt = createRequire(path.join(root, "backend", "package.json"))("bcryptjs");

const db = JSON.parse(fs.readFileSync(path.join(root, "backend", "data", "db.json"), "utf-8"));
const admins = (db.users || []).filter((u) => u.role === "admin");
if (!admins.length) throw new Error("db.json has no admin account: run `npm run seed` in backend first");

const lines = ["Northstar on Netlify: teacher studio sign-in (at /admin/login)", ""];
for (const admin of admins) {
  const password = crypto.randomBytes(12).toString("base64url");
  admin.passwordHash = bcrypt.hashSync(password, 10);
  admin.passwordChangedAt = new Date().toISOString();
  lines.push(`Email:    ${admin.email}`, `Password: ${password}`, "");
}
lines.push("Keep this file private and out of any repository.");

fs.writeFileSync(path.join(root, "backend", "data", "netlify-seed.json"), JSON.stringify(db, null, 2));
fs.writeFileSync(path.join(root, "netlify-admin-login.txt"), lines.join("\n") + "\n");
console.log(`Seed written (${admins.length} admin account(s)); the new sign-in is in netlify-admin-login.txt`);
