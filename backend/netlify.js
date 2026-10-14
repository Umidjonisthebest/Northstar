// Runs the Express app (app.js) as a Netlify Function. See netlify/functions/api.mjs and
// ../netlify.toml.
//
// Netlify has no disk that lasts, and the app keeps everything in one JSON file. So the file lives
// in Netlify Blobs and each request works on a local copy:
//   1. fetch the stored database if it changed since this instance last saw it,
//   2. let the app handle the request against the copy in the temp folder,
//   3. if the copy changed, store it, but only if nobody else stored one in the meantime.
// When someone else did (two students saving in the same instant, on two instances), the request
// is run again on the newer database, so no write is lost. This is fine for a class; it is the
// first thing to replace with a real database at scale.
//
// Uploaded IELTS audio and pictures go to a second blob store and are served from it at /uploads.
// The app itself is untouched: it is started on a local port and requests are passed to it.

import crypto from "crypto";
import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { getStore } from "@netlify/blobs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(os.tmpdir(), "northstar");
const DB_FILE = path.join(WORK_DIR, "db.json");
const UPLOAD_DIR = path.join(WORK_DIR, "uploads");
// The database a new site starts from (made by tools/netlify/seed.mjs). Without it: an empty one.
const SEED_FILE = path.join(__dirname, "data", "netlify-seed.json");
const MAX_ATTEMPTS = 5;
const BACKUP_KEEP = 14;

const dataStore = () => getStore({ name: "northstar", consistency: "strong" });
const uploadStore = () => getStore({ name: "northstar-uploads", consistency: "strong" });

// The stored database as this instance last saw it. `stored` is "" while nothing is stored yet.
let stored = null;
let etag = null;
let lastBackupDay = "";
let port = 0;
let ready = null;

function writeLocal(raw) {
  if (raw) fs.writeFileSync(DB_FILE, raw);
  else fs.rmSync(DB_FILE, { force: true }); // db.js starts an empty database
}

async function pull() {
  const got = await dataStore().getWithMetadata("db", etag ? { etag } : {});
  if (!got) {
    if (stored === null) {
      stored = "";
      etag = null;
      // Its first save puts the seed (or the app's empty database) in the store.
      if (fs.existsSync(SEED_FILE)) fs.copyFileSync(SEED_FILE, DB_FILE);
    }
    return;
  }
  if (got.data === null || got.data === undefined) return; // unchanged
  stored = got.data;
  etag = got.etag;
  writeLocal(stored);
}

// One copy of the database per day, as it stood before that day's first save from this instance.
async function backup(day) {
  try {
    const store = dataStore();
    const { modified } = await store.set(`backups/db-${day}.json`, stored, { onlyIfNew: true });
    if (!modified) return;
    const { blobs } = await store.list({ prefix: "backups/" });
    const old = blobs.map((b) => b.key).sort().reverse().slice(BACKUP_KEEP);
    for (const key of old) await store.delete(key);
  } catch (e) {
    console.error(`[netlify] backup failed: ${e.message}`); // never blocks the save itself
  }
}

// Returns false when someone else saved first; the local copy is then put back as it was.
async function push() {
  if (!fs.existsSync(DB_FILE)) return true;
  const now = fs.readFileSync(DB_FILE, "utf-8");
  if (now === stored) return true;
  const day = new Date().toISOString().slice(0, 10);
  if (stored && day !== lastBackupDay) {
    await backup(day);
    lastBackupDay = day;
  }
  const store = dataStore();
  const res = await store.set("db", now, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
  if (!res.modified) {
    writeLocal(stored);
    return false;
  }
  stored = now;
  etag = res.etag || (await store.getMetadata("db"))?.etag || null;
  return true;
}

// Generated once and kept with the data, so sign-ins survive deploys. JWT_SECRET set on the site wins.
async function jwtSecret() {
  const store = dataStore();
  const existing = await store.get("jwt-secret");
  if (existing) return existing;
  await store.set("jwt-secret", crypto.randomBytes(48).toString("hex"), { onlyIfNew: true });
  return store.get("jwt-secret");
}

async function start(context) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
  process.env.NODE_ENV ||= "production";
  process.env.DB_PATH = DB_FILE;
  process.env.UPLOAD_DIR = UPLOAD_DIR;
  process.env.DB_BACKUPS = "off"; // the temp folder doesn't last; backup() above keeps them instead
  process.env.TRUST_PROXY ||= "1";
  if (!process.env.APP_URL && context?.site?.url) process.env.APP_URL = context.site.url;
  process.env.JWT_SECRET ||= await jwtSecret();
  await pull();
  // Imported only now: app.js reads the settings above, and syncs starter content into the database.
  const { default: app } = await import("./app.js");
  await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      resolve();
    });
    server.on("error", reject);
  });
}

const HOP_HEADERS = new Set(["connection", "keep-alive", "transfer-encoding", "content-length", "upgrade", "expect", "host", "te", "trailer"]);

function callApp(method, target, headers, body) {
  return new Promise((resolve, reject) => {
    // A new connection each time: a kept-alive one may be dead when the instance wakes up again.
    const req = http.request({ host: "127.0.0.1", port, method, path: target, headers, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(body || undefined);
  });
}

function toResponse(res) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(res.headers)) {
    if (HOP_HEADERS.has(name) || value === undefined) continue;
    for (const v of [].concat(value)) headers.append(name, v);
  }
  const empty = [204, 205, 304].includes(res.status);
  return new Response(empty ? null : res.body, { status: res.status, headers });
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

// ---- Uploaded files ----

const UPLOAD_KEY = /^ielts\/(audio|images)\/[A-Za-z0-9_-]+\.[a-z0-9]+$/;
const UPLOAD_TYPES = { ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

// Whatever the app saved in its uploads folder during this request is moved to the blob store.
async function storeUploads() {
  for (const sub of ["audio", "images"]) {
    const dir = path.join(UPLOAD_DIR, "ielts", sub);
    let files;
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      const full = path.join(dir, file);
      const bytes = fs.readFileSync(full);
      await uploadStore().set(`ielts/${sub}/${file}`, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      fs.rmSync(full, { force: true });
    }
  }
}

async function serveUpload(req, url) {
  if (req.method !== "GET" && req.method !== "HEAD") return json(405, { error: "Method not allowed" });
  let key = "";
  try {
    key = decodeURIComponent(url.pathname.slice("/uploads/".length));
  } catch {
    // falls through to Not found
  }
  const type = UPLOAD_TYPES[path.extname(key)];
  if (!UPLOAD_KEY.test(key) || !type) return json(404, { error: "Not found" });
  const data = await uploadStore().get(key, { type: "arrayBuffer" });
  if (!data) return json(404, { error: "Not found" });
  const headers = {
    "content-type": type,
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=604800",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'"
  };
  // Audio players ask for byte ranges (Safari won't play without them).
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  if (range && (range[1] || range[2])) {
    const size = data.byteLength;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    return new Response(req.method === "HEAD" ? null : data.slice(start, end + 1), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}` } });
  }
  return new Response(req.method === "HEAD" ? null : data, { status: 200, headers });
}

// ---- The function ----

export default async function handler(req, context) {
  const url = new URL(req.url);
  if (url.pathname.startsWith("/uploads/")) return serveUpload(req, url);

  if (!ready) ready = start(context).catch((e) => {
    ready = null;
    throw e;
  });
  await ready;

  const body = req.method === "GET" || req.method === "HEAD" ? null : Buffer.from(await req.arrayBuffer());
  const headers = {};
  for (const [name, value] of req.headers) if (!HOP_HEADERS.has(name)) headers[name] = value;
  headers.host = url.host;
  headers["x-forwarded-for"] = context?.ip || "";
  headers["x-forwarded-proto"] = "https";
  if (body) headers["content-length"] = String(body.length);

  for (let attempt = 1; ; attempt++) {
    await pull();
    const res = await callApp(req.method, url.pathname + url.search, headers, body);
    await storeUploads();
    if (await push()) return toResponse(res);
    if (attempt >= MAX_ATTEMPTS) return json(503, { error: "The server is busy. Please try again." });
  }
}
