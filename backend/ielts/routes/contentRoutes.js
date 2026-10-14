import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../../db.js";
import { requireAdmin } from "../../auth.js";
import { countSlots, validateGroups } from "../lib/questions.js";
import { assembleParts } from "../lib/exam.js";
import { TEST_USE, USES, inMocks, inPractice, inTest, useOf } from "../lib/practice.js";
import { relistParts, testGroupId } from "../lib/practiceTests.js";
import { cleanString, matchesQuery } from "../lib/http.js";
import { contentOf } from "../store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/uploads is served at /uploads; IELTS files go in its ielts/ folder.
export const UPLOADS_ROOT = process.env.UPLOAD_DIR || path.join(__dirname, "..", "..", "uploads");
const IELTS_UPLOADS = path.join(UPLOADS_ROOT, "ielts");
const UPLOAD_URL = "/uploads/ielts";
// Starter content (seed/assets) is served at /ielts-assets.
const ASSET_URL = "/ielts-assets/";
export const MAX_AUDIO_MB = 20;
export const MAX_IMAGE_MB = 5;

const KINDS = {
  listening: { field: "section", max: 4 },
  reading: { field: "part", max: 3 },
  writing: { field: "task", max: 2 }
};
const LEVELS = ["EASY", "MEDIUM", "HARD"];
const READING_START = { 1: 1, 2: 14, 3: 27 };

// IELTS tests are the admin's: the same sections serve every student's own practice and the
// diagnostic, not only the mocks a teacher runs. (A session doesn't choose its content, so the
// teacher's session screens never call this router.)
const router = express.Router();
router.use(requireAdmin);

// ---------- helpers ----------

function summarize(kind, r) {
  const base = {
    id: r.id,
    groupId: r.groupId,
    title: r.title,
    source: r.source || null,
    level: r.level || "MEDIUM",
    active: r.active !== false,
    use: useOf(r),
    // Set on a part that belongs to a practice test (use: "test").
    testId: r.testId || null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  };
  if (kind === "listening") {
    return { ...base, section: r.section, questionCount: countSlots(r.groups), durationMinutes: r.durationMinutes, hasAudio: Boolean(r.audio?.url) };
  }
  if (kind === "reading") {
    return { ...base, part: r.part, globalTitle: r.globalTitle || "", questionCount: countSlots(r.groups), durationMinutes: r.durationMinutes || 20 };
  }
  return { ...base, task: r.task, hasImage: Boolean(r.image?.url) };
}

function referencedUploads(db) {
  const urls = new Set();
  const add = (u) => u && urls.add(u);
  for (const kind of Object.keys(KINDS)) {
    for (const r of contentOf(db, kind)) {
      add(r.audio?.url);
      add(r.image?.url);
      for (const g of r.groups || []) add(g.image?.url);
    }
  }
  return urls;
}

function uploadUrlsOf(record) {
  const urls = [record?.audio?.url, record?.image?.url, ...(record?.groups || []).map((g) => g.image?.url)];
  return urls.filter((u) => typeof u === "string" && u.startsWith(`${UPLOAD_URL}/`));
}

function removeUnreferenced(db, candidates) {
  const keep = referencedUploads(db);
  for (const url of candidates) {
    if (keep.has(url)) continue;
    const [sub, file, ...rest] = url.slice(UPLOAD_URL.length + 1).split("/");
    if (rest.length || !["audio", "images"].includes(sub) || !file || file !== path.basename(file)) continue;
    fs.promises.unlink(path.join(IELTS_UPLOADS, sub, file)).catch(() => {});
  }
}

function asUpload(value, prefix) {
  if (!value || typeof value !== "object" || typeof value.url !== "string") return null;
  if (!value.url.startsWith(prefix) && !value.url.startsWith(ASSET_URL)) return null;
  return {
    url: value.url,
    name: cleanString(value.name, 200) || path.basename(value.url),
    size: Number(value.size) || null,
    mime: cleanString(value.mime, 100) || null,
    ...(value.width ? { width: Number(value.width), height: Number(value.height) } : {})
  };
}

function normalizePart(kind, input) {
  const field = KINDS[kind].field;
  const number = Number(input?.[field]);
  if (!Number.isInteger(number) || number < 1 || number > KINDS[kind].max) {
    return { error: `Invalid ${field} number` };
  }
  const label = kind === "listening" ? `Section ${number}` : kind === "reading" ? `Part ${number}` : `Task ${number}`;
  const common = {
    [field]: number,
    // Kept as it is when the editor doesn't send one; new records default to MEDIUM.
    ...(LEVELS.includes(input.level) ? { level: input.level } : {}),
    active: input.active !== false,
    // Mock tests, student practice or both; left as it is when the editor doesn't send it.
    ...(USES.includes(input.use) ? { use: input.use } : {})
  };

  if (kind === "writing") {
    const questionHtml = String(input.questionHtml || "");
    if (!questionHtml.replace(/<[^>]*>/g, "").trim()) return { error: `${label}: question text is required` };
    return {
      value: {
        ...common,
        title: cleanString(input.title, 200) || `Writing Task ${number}`,
        questionHtml,
        questionDelta: input.questionDelta || null,
        image: asUpload(input.image, `${UPLOAD_URL}/images/`),
        // Shown to students after they submit a practice essay.
        ...(typeof input.modelAnswerHtml === "string" ? { modelAnswerHtml: input.modelAnswerHtml } : {})
      }
    };
  }

  const title = cleanString(input.title, 200);
  if (!title) return { error: `${label}: title is required` };
  const groupsError = validateGroups(input.groups || []);
  if (groupsError) return { error: `${label}: ${groupsError}` };
  if (!(input.groups || []).length) return { error: `${label}: add at least one question` };

  if (kind === "listening") {
    const durationMinutes = Number(String(input.durationMinutes ?? "").replace(",", "."));
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 90) {
      return { error: `${label}: audio duration must be between 0 and 90 minutes` };
    }
    const audio = asUpload(input.audio, `${UPLOAD_URL}/audio/`);
    if (!audio) return { error: `${label}: an audio file is required` };
    return { value: { ...common, title, durationMinutes: Math.round(durationMinutes * 100) / 100, audio, groups: input.groups } };
  }

  const contentHtml = String(input.contentHtml || "");
  if (!contentHtml.replace(/<[^>]*>/g, "").trim()) return { error: `${label}: reading content is required` };
  const durationMinutes = Number(input.durationMinutes) || 20;
  return {
    value: {
      ...common,
      title,
      contentHtml,
      contentDelta: input.contentDelta || null,
      durationMinutes: Math.min(120, Math.max(1, durationMinutes)),
      groups: input.groups
    }
  };
}

function kindParam(req, res) {
  const kind = req.params.kind;
  if (!KINDS[kind]) {
    res.status(404).json({ error: "Unknown content type" });
    return null;
  }
  return kind;
}

// ---------- uploads ----------

const AUDIO_TYPES = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/wave": ".wav",
  "audio/vnd.wave": ".wav"
};
const AUDIO_EXTS = [".mp3", ".m4a", ".aac", ".wav"];
const IMAGE_TYPES = { "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/webp": ".webp" };
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

function extensionFor(file, types, exts) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (types[file.mimetype]) return exts.includes(ext) ? ext : types[file.mimetype];
  return exts.includes(ext) ? ext : null;
}

function makeUploader(sub, types, exts, maxMb, typeError) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.join(IELTS_UPLOADS, sub);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => cb(null, nanoid(16) + extensionFor(file, types, exts))
    }),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      if (extensionFor(file, types, exts)) cb(null, true);
      else cb(Object.assign(new Error(typeError), { code: "BAD_TYPE" }));
    }
  }).single("file");
}

const audioUploader = makeUploader("audio", AUDIO_TYPES, AUDIO_EXTS, MAX_AUDIO_MB, "Only MP3, M4A or WAV audio files are allowed");
const imageUploader = makeUploader("images", IMAGE_TYPES, IMAGE_EXTS, MAX_IMAGE_MB, "Only jpg, jpeg, png and webp images are allowed");

function handleUpload(uploader, sub, maxMb) {
  return (req, res) =>
    uploader(req, res, (err) => {
      if (err) {
        const message = err.code === "LIMIT_FILE_SIZE" ? `File must be ${maxMb} MB or smaller` : err.message || "Upload failed";
        return res.status(400).json({ error: message });
      }
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      res.json({ url: `${UPLOAD_URL}/${sub}/${req.file.filename}`, name: req.file.originalname, size: req.file.size, mime: req.file.mimetype });
    });
}

router.post("/uploads/audio", handleUpload(audioUploader, "audio", MAX_AUDIO_MB));
router.post("/uploads/image", handleUpload(imageUploader, "images", MAX_IMAGE_MB));

// ---------- lookups ----------

router.get("/sources", (req, res) => {
  const db = readDB();
  const counts = new Map();
  for (const kind of Object.keys(KINDS)) {
    for (const r of contentOf(db, kind)) {
      if (r.source && !r.deletedAt) counts.set(r.source, (counts.get(r.source) || 0) + 1);
    }
  }
  res.json([...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)));
});

router.get("/reading-titles", (req, res) => {
  const titles = [...new Set(readDB().ieltsReading.filter((r) => !r.deletedAt).map((r) => r.globalTitle).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
  res.json(titles);
});

// ---------- CRUD ----------

// The lists are by where material is used: ?scope=practice is the students' section practice,
// ?scope=mock what a teacher's mock test draws from (a record used in both is in both lists).
// A practice test's own parts are in neither: they are reached through the test.
const SCOPES = { practice: inPractice, mock: inMocks };

router.get("/:kind", (req, res) => {
  const kind = kindParam(req, res);
  if (!kind) return;
  const q = String(req.query.q || "").trim();
  const inScope = SCOPES[req.query.scope] || ((r) => !inTest(r));
  const items = contentOf(readDB(), kind)
    .filter((r) => !r.deletedAt && inScope(r) && matchesQuery([r.title, r.source, r.globalTitle], q))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .map((r) => summarize(kind, r));
  res.json(items);
});

router.get("/:kind/:id", (req, res) => {
  const kind = kindParam(req, res);
  if (!kind) return;
  const records = contentOf(readDB(), kind);
  const record = records.find((r) => r.id === req.params.id && !r.deletedAt);
  if (!record) return res.status(404).json({ error: "Not found" });
  const field = KINDS[kind].field;
  const siblings = records.filter((r) => !r.deletedAt && r.groupId && r.groupId === record.groupId).sort((a, b) => a[field] - b[field]);
  res.json({ record, siblings: siblings.length ? siblings : [record] });
});

router.get("/:kind/:id/preview", (req, res) => {
  const kind = kindParam(req, res);
  if (!kind) return;
  const record = contentOf(readDB(), kind).find((r) => r.id === req.params.id && !r.deletedAt);
  if (!record) return res.status(404).json({ error: "Not found" });
  const startNumber = kind === "listening" ? (record.section - 1) * 10 + 1 : kind === "reading" ? READING_START[record.part] || 1 : 1;
  const content = assembleParts(kind, [record], { withAnswers: true, startNumber });
  const part = content.parts[0];
  if (kind !== "writing") part.partNumber = kind === "listening" ? record.section : record.part;
  res.json({ kind, record: summarize(kind, record), part });
});

router.post("/:kind/save", (req, res) => {
  const kind = kindParam(req, res);
  if (!kind) return;
  const body = req.body || {};
  const parts = Array.isArray(body.parts) ? body.parts : [];
  if (!parts.length) return res.status(400).json({ error: "Nothing to save — fill in at least one part" });

  const field = KINDS[kind].field;
  const normalized = [];
  const seen = new Set();
  for (const input of parts) {
    const result = normalizePart(kind, input);
    if (result.error) return res.status(400).json({ error: result.error });
    if (seen.has(result.value[field])) return res.status(400).json({ error: `Duplicate ${field} ${result.value[field]}` });
    seen.add(result.value[field]);
    normalized.push({ id: typeof input.id === "string" ? input.id : null, value: result.value });
  }

  const source = cleanString(body.source, 120) || null;
  const globalTitle = kind === "reading" ? cleanString(body.globalTitle, 200) : undefined;
  if (kind === "reading" && !globalTitle) return res.status(400).json({ error: "Global reading title is required" });

  const result = updateDB((db) => {
    const list = contentOf(db, kind);
    const now = new Date().toISOString();
    const found = normalized.map(({ id }) => (id ? list.find((r) => r.id === id && !r.deletedAt) : null));

    // Parts of a practice test (the editor was opened from the test's page, or is editing parts
    // that already belong to one): they are the test's own. Everything is checked before anything
    // is changed, because whatever this callback leaves behind is saved.
    const testId = cleanString(body.testId, 40) || found.find((r) => r?.testId)?.testId || null;
    const test = testId ? (db.ieltsPracticeTests || []).find((t) => t.id === testId && !t.deletedAt) : null;
    if (testId && !test) return { error: "This practice test no longer exists." };
    if (test) {
      for (const [i, { value }] of normalized.entries()) {
        if (found[i] && found[i].testId !== test.id) return { error: "One of these parts doesn't belong to this practice test. Copy it into the test from the test's page." };
        const clash = list.find((r) => r.testId === test.id && !r.deletedAt && r[field] === value[field] && r.id !== found[i]?.id);
        if (clash) return { error: `This test already has a ${field} ${value[field]}: "${clash.title}". Open that one to change it, or remove it from the test first.` };
      }
    }

    const groupId = test ? testGroupId(test.id, kind) : cleanString(body.groupId, 40) || nanoid(10);
    const owned = test ? { use: TEST_USE, testId: test.id } : {};
    const replaced = [];
    const out = [];
    for (const [i, { value }] of normalized.entries()) {
      const existing = found[i];
      if (existing) {
        replaced.push(...uploadUrlsOf(existing));
        // A seeded practice item edited here is no longer refreshed from the seed on startup.
        Object.assign(existing, value, owned, { source, groupId, updatedAt: now }, globalTitle !== undefined ? { globalTitle } : {}, existing.seedKey ? { customized: true } : {});
        out.push(existing);
      } else {
        const record = { id: nanoid(10), groupId, level: "MEDIUM", ...value, ...owned, source, ...(globalTitle !== undefined ? { globalTitle } : {}), createdAt: now, updatedAt: now };
        list.push(record);
        out.push(record);
      }
    }
    if (test) {
      relistParts(db, test, kind);
      // A test the seed made is the admin's own from here on (seed/starter.js leaves it alone).
      Object.assign(test, { updatedAt: now }, test.seedKey ? { customized: true } : {});
    }
    removeUnreferenced(db, replaced);
    return { out };
  });
  if (result.error) return res.status(400).json({ error: result.error });
  const saved = result.out;
  res.json({ saved: saved.map((r) => summarize(kind, r)), records: saved });
});

router.patch("/:kind/:id", (req, res) => {
  const kind = kindParam(req, res);
  if (!kind) return;
  const updated = updateDB((db) => {
    const record = contentOf(db, kind).find((r) => r.id === req.params.id && !r.deletedAt);
    if (!record) return null;
    if (typeof req.body?.active === "boolean") record.active = req.body.active;
    // A practice test's own part stays that: it can't be turned into practice or mock material.
    if (USES.includes(req.body?.use) && !inTest(record)) record.use = req.body.use;
    record.updatedAt = new Date().toISOString();
    return record;
  });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(summarize(kind, updated));
});

// Soft delete: candidates' past attempts still point at this content, so it is
// hidden from lists and from new tests but kept for result reviews.
router.delete("/:kind/:id", (req, res) => {
  const kind = kindParam(req, res);
  if (!kind) return;
  const removed = updateDB((db) => {
    const record = contentOf(db, kind).find((r) => r.id === req.params.id && !r.deletedAt);
    if (!record) return null;
    record.deletedAt = new Date().toISOString();
    record.active = false;
    // A practice test's own part leaves the test with it.
    const test = record.testId && (db.ieltsPracticeTests || []).find((t) => t.id === record.testId);
    if (test) {
      relistParts(db, test, kind);
      Object.assign(test, { updatedAt: record.deletedAt }, test.seedKey ? { customized: true } : {});
    }
    return record;
  });
  if (!removed) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

export default router;
