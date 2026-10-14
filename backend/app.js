import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { nanoid } from "nanoid";
import { updateDB } from "./db.js";
import { DOMAINS, PACK_MEDIA_DIR, PRACTICE_QUESTIONS, SLIM_QUESTIONS, VOCAB_WORDS } from "./practiceContent.js";
import { TOPIC_ALIASES, skillDomain } from "./practiceSkills.js";
import { retireGradeClasses } from "./classrooms.js";
import authRoutes from "./routes/authRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import practiceRoutes from "./routes/practiceRoutes.js";
import diagnosticRoutes from "./routes/diagnosticRoutes.js";
import practiceTestRoutes from "./routes/practiceTestRoutes.js";
import dailyRoutes from "./routes/dailyRoutes.js";
import presenceRoutes from "./routes/presenceRoutes.js";
import leagueRoutes from "./routes/leagueRoutes.js";
import recapRoutes from "./routes/recapRoutes.js";
import adminPracticeRoutes from "./routes/adminPracticeRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import adminMessageRoutes from "./routes/adminMessageRoutes.js";
import classRoutes from "./routes/classRoutes.js";
import adminClassRoutes from "./routes/adminClassRoutes.js";
import adminHomeworkRoutes from "./routes/adminHomeworkRoutes.js";
import adminTeacherRoutes from "./routes/adminTeacherRoutes.js";
import adminSatTestRoutes from "./routes/adminSatTestRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import { ensureIeltsContent, ensureIeltsPractice, ensureIeltsPracticeTests, mountIelts, separateIeltsPracticeTests } from "./ielts/index.js";

// Fields a starter question owns. When the starter set changes, databases
// seeded from an older version pick up the new content on the next start,
// except for questions an admin has edited (those have `updatedAt`).
const STARTER_FIELDS = ["type", "section", "domain", "topic", "difficulty", "title", "passage", "table", "figure", "prompt", "options", "correctIndex", "correctAnswer", "explanation", "rationales", "steps", "keyQuote", "hint", "gen", "image", "promptImage", "explanationImage", "underline", "acceptedAnswers", "source"];
const starterRecord = ({ legacyTitle, ...q }) => q;
// Everything that is synced by `key`: the starter set, then the owner's question pack and their
// own question bank (both stored slim, see db.js).
const SYNCED_QUESTIONS = [...PRACTICE_QUESTIONS, ...SLIM_QUESTIONS];

// Starter content a teacher deleted. Without this the sync below put it straight back at the next
// start (and `node --watch` restarts the server on every backend edit).
const removedKeys = (db, kind) => new Set((db.removedStarters || []).filter((r) => r.kind === kind).map((r) => r.key));

export function syncStarterQuestions(db) {
  const now = new Date().toISOString();
  const gone = removedKeys(db, "question");
  if (db.practiceQuestions.length === 0) {
    db.practiceQuestions = SYNCED_QUESTIONS.filter((q) => !gone.has(q.key)).map((q) => ({ id: nanoid(10), ...starterRecord(q), createdAt: now }));
    return `Loaded ${db.practiceQuestions.length} starter practice questions`;
  }
  let added = 0;
  let upgraded = 0;
  let remapped = 0;
  const byKey = new Map(db.practiceQuestions.filter((q) => q.key).map((q) => [q.key, q]));
  for (const s of SYNCED_QUESTIONS) {
    let q = byKey.get(s.key);
    // Starter questions from before keys existed are matched by their old title,
    // so they keep their id (and every student's progress on them).
    if (!q && s.legacyTitle) {
      q = db.practiceQuestions.find((x) => !x.key && x.section === s.section && x.title === s.legacyTitle);
      if (q) q.key = s.key;
    }
    if (!q) {
      if (gone.has(s.key)) continue;
      db.practiceQuestions.push({ id: nanoid(10), ...starterRecord(s), createdAt: now });
      added++;
      continue;
    }
    if (q.updatedAt) continue;
    let changed = false;
    for (const f of STARTER_FIELDS) {
      if (JSON.stringify(q[f]) === JSON.stringify(s[f])) continue;
      if (s[f] === undefined) delete q[f];
      else q[f] = s[f];
      changed = true;
    }
    if (changed) upgraded++;
  }
  // Admin-created questions: move old skill names onto the official taxonomy.
  for (const q of db.practiceQuestions) {
    if (q.key) continue;
    const alias = TOPIC_ALIASES[q.topic];
    if (alias) {
      q.topic = alias;
      const home = skillDomain(alias);
      if (home?.section === q.section) q.domain = home.domain;
      remapped++;
    }
    if (!q.domain) q.domain = DOMAINS[q.section]?.[0] || DOMAINS["Reading & Writing"][0];
  }
  return added || upgraded || remapped ? `Practice bank: ${added} new, ${upgraded} updated, ${remapped} remapped starter question(s)` : null;
}

export function syncStarterVocab(db) {
  const goneWords = removedKeys(db, "vocab");
  if (db.vocab.length === 0) {
    db.vocab = VOCAB_WORDS.filter((w) => !goneWords.has(w.word.toLowerCase())).map((w) => ({ id: nanoid(10), ...w }));
    return `Loaded ${db.vocab.length} starter vocabulary words`;
  }
  const known = new Set(db.vocab.map((w) => String(w.word || "").toLowerCase()));
  const additions = VOCAB_WORDS.filter((w) => !known.has(w.word.toLowerCase()) && !goneWords.has(w.word.toLowerCase())).map((w) => ({ id: nanoid(10), ...w }));
  if (!additions.length) return null;
  db.vocab.push(...additions);
  return `Added ${additions.length} new starter vocabulary word(s)`;
}

// First run (or an older db.json): load the starter practice bank + vocab
// deck, and merge in anything added to the starter content since.
updateDB((db) => {
  const bankNote = syncStarterQuestions(db);
  if (bankNote) console.log(bankNote);
  const vocabNote = syncStarterVocab(db);
  if (vocabNote) console.log(vocabNote);
  if (ensureIeltsContent(db)) {
    console.log(`Loaded IELTS starter tests: ${db.ieltsListening.length} listening sections, ${db.ieltsReading.length} reading passages, ${db.ieltsWriting.length} writing tasks`);
  }
  const practice = ensureIeltsPractice(db);
  if (practice.added || practice.updated) console.log(`IELTS practice for students: ${practice.added} added, ${practice.updated} updated`);
  // An older database shares its practice tests' parts with section practice: each test gets its own.
  const own = separateIeltsPracticeTests(db);
  if (own.copied || own.moved) console.log(`IELTS practice tests now own their parts: ${own.copied} copied from section practice, ${own.moved} moved out of it`);
  const tests = ensureIeltsPracticeTests(db);
  if (tests.added || tests.updated) console.log(`IELTS practice tests: ${tests.added} added, ${tests.updated} updated`);
  // An older database still has the fixed grade classes: they are gone, teachers make the classes.
  const classNote = retireGradeClasses(db);
  if (classNote) console.log(classNote);
});

const app = express();

// Behind a reverse proxy (nginx, a hosting platform's router) every request seems to come from the
// proxy's address, so the rate limiters would treat the whole school as one client. Set
// TRUST_PROXY to the number of proxies in front of the app (usually 1) so the real client address is used.
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set("trust proxy", Number.isInteger(hops) ? hops : process.env.TRUST_PROXY);
}

// Content security policy for what this server sends: JSON, plus uploaded audio and pictures. None
// of it should run script or be framed, so the policy is closed by default and opens only what the
// uploads need (images and audio from this server, data: for inline pictures). The pages themselves
// are served by the frontend host, which sets its own policy (see frontend/vite.config.js).
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        "default-src": ["'none'"],
        "img-src": ["'self'", "data:"],
        "media-src": ["'self'"],
        "style-src": ["'none'"],
        "script-src": ["'none'"],
        "base-uri": ["'none'"],
        "form-action": ["'none'"],
        "frame-ancestors": ["'none'"]
      }
    },
    // The frontend may be on another origin and loads uploaded audio and pictures from here.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
  })
);

// Which websites may call this API from a browser. CORS_ORIGINS is a comma-separated list; APP_URL
// is always allowed. Outside production the Vite dev server is allowed as well. A request with no
// Origin header (curl, the server's own pages, tests) is not a cross-site browser request and passes.
// Anything else gets no CORS headers, so the browser refuses to hand the response to the page.
export function allowedOrigins(env = process.env) {
  const list = (env.CORS_ORIGINS || "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  if (env.APP_URL) list.push(env.APP_URL.trim().replace(/\/+$/, ""));
  if (env.NODE_ENV !== "production") list.push("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173");
  return new Set(list);
}
const corsOrigins = allowedOrigins();
app.use(cors({ origin: (origin, cb) => cb(null, !origin || corsOrigins.has(origin)) }));
// IELTS reading passages and question HTML can be large; so can a mock-exam question, which may
// carry two pictures (the editor allows 2 MB each, about 2.7 MB as a data URL). Everything else
// keeps the 2 MB cap.
app.use("/api/ielts/admin/content", express.json({ limit: "6mb" }));
app.use("/api/tests", express.json({ limit: "6mb" }));
app.use("/api/admin/sat-tests", express.json({ limit: "6mb" }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Pictures that belong to bank questions (graphs, and questions that exist only as a picture).
// They sit under /api so every host that already forwards /api serves them, and they are public
// because an <img> can't send a sign-in token; the file names are content hashes, not guessable.
app.use("/api/bank-media", express.static(PACK_MEDIA_DIR, { maxAge: "30d", immutable: true, index: false, fallthrough: false }));

app.use("/api/auth", authRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/exam", examRoutes);
app.use("/api/users", userRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/practice", practiceRoutes);
app.use("/api/diagnostic", diagnosticRoutes);
app.use("/api/practice-tests", practiceTestRoutes);
app.use("/api/daily", dailyRoutes);
app.use("/api/presence", presenceRoutes);
app.use("/api/leagues", leagueRoutes);
app.use("/api/recaps", recapRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/class", classRoutes);
app.use("/api/admin/practice", adminPracticeRoutes);
app.use("/api/admin/messages", adminMessageRoutes);
app.use("/api/admin/classes", adminClassRoutes);
app.use("/api/admin/homework", adminHomeworkRoutes);
app.use("/api/admin/teachers", adminTeacherRoutes);
app.use("/api/admin/sat-tests", adminSatTestRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);
mountIelts(app);

app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request is too large" });
  if (err?.status === 404 || err?.statusCode === 404) return res.status(404).json({ error: "Not found" });
  // Client errors raised on purpose (httpError) or by body parsing (malformed JSON).
  if (err?.status >= 400 && err.status < 500) return res.status(err.status).json({ error: err.expose === false ? "Bad request" : err.message });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
