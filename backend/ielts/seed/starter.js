// Starter IELTS tests (content.js + the generated audio/images in assets/, served
// at /ielts-assets). Loaded automatically on first run and by `npm run seed:ielts`.
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import { LISTENING, READING, WRITING } from "./content.js";
import { PRACTICE_LISTENING, PRACTICE_READING, PRACTICE_WRITING } from "./practice.js";
import { TEST2_LISTENING, TEST2_READING, TEST2_WRITING } from "./test2.js";
import { PRACTICE_TESTS } from "./tests.js";
import { contentOf } from "../store.js";
import { TEST_USE, useOf } from "../lib/practice.js";
import { TEST_KINDS, ownTestParts, testGroupId } from "../lib/practiceTests.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readManifest = () => JSON.parse(fs.readFileSync(path.join(__dirname, "assets", "audio", "manifest.json"), "utf-8"));
const minutesOf = (manifest, key) => Math.ceil(((manifest[key] || 300) / 60) * 10) / 10;

export function starterContent() {
  const manifest = readManifest();
  const now = new Date().toISOString();
  // "LA1" → test "A": parts of the same source test share a groupId, so the editor opens them together.
  const groupFor = (key) => `seed-${key.slice(1, 2)}`;
  return {
    ieltsListening: LISTENING.map((l) => ({
      id: nanoid(10),
      groupId: groupFor(l.key),
      title: l.title,
      section: l.section,
      level: l.level,
      source: l.source,
      durationMinutes: minutesOf(manifest, l.key),
      audio: { url: `/ielts-assets/audio/${l.key}.wav`, name: `${l.key}.wav`, mime: "audio/wav", size: null },
      groups: structuredClone(l.groups),
      active: true,
      createdAt: now,
      updatedAt: now
    })),
    ieltsReading: READING.map((r) => ({
      id: nanoid(10),
      groupId: groupFor(r.key),
      globalTitle: r.globalTitle,
      title: r.title,
      part: r.part,
      level: r.level,
      source: r.source,
      contentHtml: r.contentHtml,
      durationMinutes: 20,
      groups: structuredClone(r.groups),
      active: true,
      createdAt: now,
      updatedAt: now
    })),
    ieltsWriting: WRITING.map((w) => ({
      id: nanoid(10),
      groupId: groupFor(w.key),
      task: w.task,
      title: w.title,
      source: w.source,
      level: "MEDIUM",
      questionHtml: w.questionHtml,
      image: w.image ? { ...w.image } : null,
      active: true,
      createdAt: now,
      updatedAt: now
    }))
  };
}

// First run (or a database from before IELTS was merged in): load the starter
// tests so the IELTS mock works out of the box. Never touches existing content.
export function ensureIeltsContent(db) {
  if (db.ieltsListening.length || db.ieltsReading.length || db.ieltsWriting.length) return false;
  Object.assign(db, starterContent());
  return true;
}

const seedHash = (content) => createHash("sha1").update(JSON.stringify(content)).digest("hex").slice(0, 16);

// Every seeded part that students work on alone, as the content a record holds: the section
// practice set (practice.js) and the second practice test's own material (test2.js).
function seededParts() {
  const manifest = readManifest();
  const parts = { listening: new Map(), reading: new Map(), writing: new Map() };
  for (const l of [...PRACTICE_LISTENING, ...TEST2_LISTENING]) {
    parts.listening.set(l.seedKey, {
      source: l.source,
      content: {
        title: l.title,
        section: l.section,
        level: l.level,
        durationMinutes: minutesOf(manifest, l.seedKey),
        audio: { url: `/ielts-assets/audio/${l.seedKey}.wav`, name: `${l.seedKey}.wav`, mime: "audio/wav", size: null },
        transcriptHtml: l.transcriptHtml,
        groups: structuredClone(l.groups)
      }
    });
  }
  for (const r of [...PRACTICE_READING, ...TEST2_READING]) {
    parts.reading.set(r.seedKey, { source: r.source, content: { globalTitle: r.globalTitle, title: r.title, part: r.part, level: r.level, contentHtml: r.contentHtml, durationMinutes: 20, groups: structuredClone(r.groups) } });
  }
  for (const w of [...PRACTICE_WRITING, ...TEST2_WRITING]) {
    parts.writing.set(w.seedKey, { source: w.source, content: { task: w.task, title: w.title, level: w.level, questionHtml: w.questionHtml, image: w.image ? { ...w.image } : null, modelAnswerHtml: w.modelAnswerHtml } });
  }
  return parts;
}

// What section practice has: the first set only. The second test's material is that test's own.
const PRACTICE_KEYS = new Set([...PRACTICE_LISTENING, ...PRACTICE_READING, ...PRACTICE_WRITING].map((x) => x.seedKey));
// A part of a seeded test is its own record, named for the test and the part: "PT1:PL1".
const testPartKey = (testKey, partKey) => `${testKey}:${partKey}`;

// Adds a seeded record, or refreshes one whose seed content has changed, unless a teacher has
// edited it in the studio (`customized`) or deleted it (deletion is soft). Existing ids, `use`
// and `active` are kept, so students' history stays linked.
function syncRecord(list, seedKey, seeded, fields, out, now) {
  const hash = seedHash(seeded.content);
  const existing = list.find((r) => r.seedKey === seedKey);
  if (!existing) {
    const record = { id: nanoid(10), seedKey, active: true, source: seeded.source, ...fields, ...seeded.content, seedHash: hash, createdAt: now, updatedAt: now };
    list.push(record);
    out.added++;
    return record;
  }
  if (existing.seedHash !== hash && !existing.customized && !existing.deletedAt) {
    Object.assign(existing, seeded.content, { seedHash: hash, updatedAt: now });
    out.updated++;
  }
  return existing;
}

// The self-study practice set (seed/practice.js, use: "practice"): single parts in the hub's
// Section Practice.
export function ensureIeltsPractice(db) {
  const now = new Date().toISOString();
  const out = { added: 0, updated: 0 };
  const parts = seededParts();
  for (const kind of TEST_KINDS) {
    for (const [seedKey, seeded] of parts[kind]) {
      if (PRACTICE_KEYS.has(seedKey)) syncRecord(contentOf(db, kind), seedKey, seeded, { groupId: "seed-practice", use: "practice" }, out, now);
    }
  }
  return out;
}

// A database from before practice tests owned their parts (2026-10-13): every test gets its own
// (lib/practiceTests.js ownTestParts). The first test was built from the section-practice set, so
// its parts are copied and section practice keeps the originals. The second test's material was
// written for it and was only in section practice because every test part used to be: it moves to
// the test whole. Run between ensureIeltsPractice and ensureIeltsPracticeTests; it does nothing on
// a database that is already in the new form.
export function separateIeltsPracticeTests(db) {
  const plain = (record) => typeof record.seedKey === "string" && !record.seedKey.includes(":");
  return ownTestParts(db, {
    moveWhole: (test, record) => plain(record) && !PRACTICE_KEYS.has(record.seedKey) && useOf(record) === "practice" && PRACTICE_TESTS.some((t) => t.seedKey === test.seedKey && TEST_KINDS.some((k) => t[k].includes(record.seedKey))),
    seedKeyFor: (test, record) => (test.seedKey && plain(record) ? testPartKey(test.seedKey, record.seedKey) : null)
  });
}

// The practice tests that come with Northstar (seed/tests.js). Each has its own records, made
// from the seeded material it names. Run after the two steps above. Like the records, a test a
// teacher has changed (`customized`) or deleted is left alone, and so is a part they deleted.
export function ensureIeltsPracticeTests(db) {
  db.ieltsPracticeTests = db.ieltsPracticeTests || [];
  const now = new Date().toISOString();
  const out = { added: 0, updated: 0 };
  const parts = seededParts();
  for (const t of PRACTICE_TESTS) {
    let test = db.ieltsPracticeTests.find((x) => x.seedKey === t.seedKey);
    if (test && (test.customized || test.deletedAt)) continue;
    const isNew = !test;
    if (isNew) {
      test = { id: nanoid(10), seedKey: t.seedKey, source: "Northstar practice (original)", active: true, parts: {}, createdAt: now, updatedAt: now };
      db.ieltsPracticeTests.push(test);
    }
    const made = { added: 0, updated: 0 };
    const listed = {};
    for (const kind of TEST_KINDS) {
      listed[kind] = [];
      for (const partKey of t[kind]) {
        const seeded = parts[kind].get(partKey);
        if (!seeded) continue;
        const record = syncRecord(contentOf(db, kind), testPartKey(t.seedKey, partKey), seeded, { groupId: testGroupId(test.id, kind), use: TEST_USE, testId: test.id }, made, now);
        if (!record.deletedAt) listed[kind].push(record.id);
      }
    }
    const content = { title: t.title, description: t.description || "", level: t.level || "MEDIUM", parts: listed };
    const hash = seedHash(content);
    if (isNew) {
      Object.assign(test, content, { seedHash: hash });
      out.added++;
    } else if (test.seedHash !== hash || made.added || made.updated) {
      Object.assign(test, content, { seedHash: hash, updatedAt: now });
      out.updated++;
    }
  }
  return out;
}
