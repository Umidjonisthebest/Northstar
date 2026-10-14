import express from "express";
import ExcelJS from "exceljs";
import { AlignmentType, Document, HeadingLevel, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../../db.js";
import { requireAdmin, requireStaff } from "../../auth.js";
import { canSeeStudent } from "../../staffScope.js";
import { contentOf } from "../store.js";
import {
  SCORE_SECTIONS,
  SECTIONS,
  assembleParts,
  buildSectionContent,
  ensureExam,
  examOverall,
  finalizeSessionExams,
  findExam,
  gradePart,
  reinstateExam,
  sectionStatus
} from "../lib/exam.js";
import { cancelledView, lockRound } from "../../examLock.js";
import { parseBand } from "../lib/scoring.js";
import { asyncHandler, byCandidateIdDesc, cleanString, fullName, matchesQuery, paginate, publicUser } from "../lib/http.js";
import { insertUser, validateUserInput } from "../lib/users.js";

// Running IELTS mocks and marking them is in both panels. A teacher adds students of the classes;
// making a new candidate account is the admin's.
const router = express.Router();
router.use(requireStaff);

const STATUSES = ["created", "started", "completed"];
const MIN_STUDENTS = 5;

function sessionSortKey(s) {
  return `${s.date || ""}T${s.time || "00:00"}`;
}

function validateSessionInput(body) {
  const name = cleanString(body.name, 120);
  const description = cleanString(body.description, 500);
  const studentLimit = Number(body.studentLimit);
  const date = String(body.date || "");
  const time = String(body.time || "");
  if (!name) return { error: "Session name is required" };
  if (!Number.isInteger(studentLimit) || studentLimit < MIN_STUDENTS) return { error: `Student limit must be at least ${MIN_STUDENTS}` };
  if (studentLimit > 1000) return { error: "Student limit is too large" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return { error: "Please choose a session date" };
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: "Please choose a session time" };
  return { value: { name, description, studentLimit, date, time } };
}

function participantsOf(db, session) {
  return (session.participantIds || []).map((id) => db.users.find((u) => u.id === id)).filter(Boolean);
}

function sessionCard(db, session) {
  const participants = participantsOf(db, session).map((u) => ({ id: u.id, candidateId: u.candidateId ?? null, firstName: u.firstName, lastName: u.lastName }));
  return { ...session, participants, participantCount: participants.length };
}

function findSession(db, id) {
  return db.ieltsSessions.find((s) => s.id === String(id)) || null;
}

function participantRow(db, session, user) {
  const exam = findExam(db, session.id, user.id);
  const sections = Object.fromEntries(SCORE_SECTIONS.map((s) => [s, sectionStatus(exam, s)]));
  return {
    user: { id: user.id, candidateId: user.candidateId ?? null, firstName: user.firstName, lastName: user.lastName, email: user.email || null, phone: user.phone || null },
    sections,
    overall: examOverall(exam),
    step: exam?.step || null,
    results: exam?.results || {},
    // Cancelled because the candidate left the test page (examLock.js), and how many times a
    // teacher has already let them back in.
    cancelled: exam?.cancelled ? { ...cancelledView(exam.cancelled), section: exam.cancelled.section || null } : null,
    letBackIn: lockRound(exam)
  };
}

// ---------- sessions ----------

router.get("/", (req, res) => {
  const db = readDB();
  const q = String(req.query.q || "").trim();
  const filtered = db.ieltsSessions
    .filter((s) => matchesQuery([s.name, s.description], q))
    .sort((a, b) => sessionSortKey(b).localeCompare(sessionSortKey(a)) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const page = paginate(filtered, req.query);
  res.json({ ...page, items: page.items.map((s) => sessionCard(db, s)), totalAll: db.ieltsSessions.length });
});

router.post("/", (req, res) => {
  const result = validateSessionInput(req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  const session = updateDB((db) => {
    const s = {
      id: nanoid(10),
      ...result.value,
      status: "created",
      participantIds: [],
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null
    };
    db.ieltsSessions.push(s);
    return sessionCard(db, s);
  });
  res.status(201).json(session);
});

router.put("/:id", (req, res) => {
  const result = validateSessionInput(req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  const out = updateDB((db) => {
    const session = findSession(db, req.params.id);
    if (!session) return { status: 404, error: "Session not found" };
    if (result.value.studentLimit < (session.participantIds || []).length) {
      return { status: 400, error: "Student limit cannot be lower than the number of participants" };
    }
    Object.assign(session, result.value, { updatedAt: new Date().toISOString() });
    return { session: sessionCard(db, session) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out.session);
});

router.delete("/:id", (req, res) => {
  const ok = updateDB((db) => {
    const session = findSession(db, req.params.id);
    if (!session) return false;
    db.ieltsSessions = db.ieltsSessions.filter((s) => s.id !== session.id);
    const examIds = new Set(db.ieltsExams.filter((e) => e.sessionId === session.id).map((e) => e.id));
    db.ieltsExams = db.ieltsExams.filter((e) => !examIds.has(e.id));
    db.ieltsAttempts = db.ieltsAttempts.filter((a) => !examIds.has(a.examId));
    return true;
  });
  if (!ok) return res.status(404).json({ error: "Session not found" });
  res.json({ ok: true });
});

router.post("/:id/status", (req, res) => {
  const status = String(req.body?.status || "");
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
  const out = updateDB((db) => {
    const session = findSession(db, req.params.id);
    if (!session) return { status: 404, error: "Session not found" };
    const now = new Date().toISOString();
    if (status === "started") session.startedAt = now;
    if (status === "completed") {
      finalizeSessionExams(db, session.id);
      session.completedAt = now;
    }
    session.status = status;
    return { session: sessionCard(db, session) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out.session);
});

router.get("/:id", (req, res) => {
  const db = readDB();
  const session = findSession(db, req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const rows = participantsOf(db, session).map((u) => participantRow(db, session, u));
  const completion = {};
  for (const s of SECTIONS) {
    const done = rows.filter((r) => r.sections[s].completed).length;
    completion[s] = rows.length ? Math.round((done / rows.length) * 100) : 0;
  }
  res.json({ session: sessionCard(db, session), participants: rows, completion });
});

// ---------- participants ----------

router.get("/:id/available-users", (req, res) => {
  const db = readDB();
  const session = findSession(db, req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const q = String(req.query.q || "").trim();
  const inSession = new Set(session.participantIds || []);
  const users = db.users
    .filter((u) => canSeeStudent(req, u) && u.status !== "inactive" && !inSession.has(u.id))
    .filter((u) => matchesQuery([fullName(u), u.email, u.phone, u.candidateId], q))
    .sort(byCandidateIdDesc)
    .map((u) => ({ id: u.id, candidateId: u.candidateId ?? null, firstName: u.firstName, lastName: u.lastName, email: u.email || null, phone: u.phone || null }));
  res.json(paginate(users, req.query));
});

function addParticipant(db, session, userId) {
  if (session.status === "completed") return { status: 409, error: "This session is already completed" };
  if ((session.participantIds || []).includes(userId)) return { status: 409, error: "User is already a participant" };
  if ((session.participantIds || []).length >= session.studentLimit) return { status: 409, error: "This session is full" };
  session.participantIds = [...(session.participantIds || []), userId];
  return null;
}

router.post("/:id/participants", (req, res) => {
  const userId = String(req.body?.userId ?? "");
  const out = updateDB((db) => {
    const session = findSession(db, req.params.id);
    if (!session) return { status: 404, error: "Session not found" };
    const user = db.users.find((u) => u.id === userId && canSeeStudent(req, u));
    if (!user) return { status: 404, error: "Student not found" };
    const err = addParticipant(db, session, userId);
    if (err) return err;
    return { row: participantRow(db, session, user) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.status(201).json(out.row);
});

router.post("/:id/participants/new", requireAdmin, (req, res) => {
  const out = updateDB((db) => {
    const session = findSession(db, req.params.id);
    if (!session) return { status: 404, error: "Session not found" };
    const result = validateUserInput(db, { ...req.body, role: "student" }, { creating: true });
    if (result.error) return { status: 400, error: result.error };
    if (session.status === "completed") return { status: 409, error: "This session is already completed" };
    if ((session.participantIds || []).length >= session.studentLimit) return { status: 409, error: "This session is full" };
    const user = insertUser(db, result.value, null);
    addParticipant(db, session, user.id);
    return { row: participantRow(db, session, user), user: publicUser(user) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.status(201).json(out);
});

router.delete("/:id/participants/:userId", (req, res) => {
  const userId = String(req.params.userId);
  const out = updateDB((db) => {
    const session = findSession(db, req.params.id);
    if (!session) return { status: 404, error: "Session not found" };
    if (!(session.participantIds || []).includes(userId)) return { status: 404, error: "Participant not found" };
    const exam = findExam(db, session.id, userId);
    if (exam && SECTIONS.some((s) => exam.sections[s].status !== "pending")) {
      return { status: 409, error: "This participant has already started the test and cannot be removed" };
    }
    session.participantIds = session.participantIds.filter((id) => id !== userId);
    if (exam) db.ieltsExams = db.ieltsExams.filter((e) => e.id !== exam.id);
    return { ok: true };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json({ ok: true });
});

function loadParticipant(db, req) {
  const session = findSession(db, req.params.id);
  if (!session) return { status: 404, error: "Session not found" };
  const userId = String(req.params.userId);
  if (!(session.participantIds || []).includes(userId)) return { status: 404, error: "Participant not found" };
  const user = db.users.find((u) => u.id === userId);
  if (!user) return { status: 404, error: "User not found" };
  return { session, user };
}

router.get("/:id/participants/:userId", (req, res) => {
  const db = readDB();
  const ctx = loadParticipant(db, req);
  if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
  const row = participantRow(db, ctx.session, ctx.user);
  res.json({ ...row, user: publicUser(ctx.user), session: { id: ctx.session.id, name: ctx.session.name, status: ctx.session.status } });
});

// Let a candidate back into an exam that was cancelled for leaving the test page. The section they
// were in gets back the time it was closed for.
router.post("/:id/participants/:userId/reinstate", (req, res) => {
  const out = updateDB((db) => {
    const ctx = loadParticipant(db, req);
    if (ctx.error) return ctx;
    const exam = findExam(db, ctx.session.id, ctx.user.id);
    if (!exam?.cancelled) return { status: 409, error: "This exam isn't cancelled" };
    const by = db.users.find((u) => u.id === req.user.userId);
    reinstateExam(exam, fullName(by || {}));
    return { row: participantRow(db, ctx.session, ctx.user) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out.row);
});

function attemptMeta(a) {
  if (a.section === "writing") return `Task: ${a.partNumber} • Words: ${a.words ?? 0}`;
  return `Part: ${a.partNumber} • Correct: ${a.correct ?? 0}/${a.total ?? 0}`;
}

router.get("/:id/participants/:userId/results", (req, res) => {
  const db = readDB();
  const ctx = loadParticipant(db, req);
  if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
  const exam = findExam(db, ctx.session.id, ctx.user.id);
  const sections = {};
  for (const s of SCORE_SECTIONS) {
    const attempts = exam
      ? db.ieltsAttempts
          .filter((a) => a.examId === exam.id && a.section === s)
          .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)) || b.partNumber - a.partNumber)
          .map((a) => ({ id: a.id, title: a.title, meta: attemptMeta(a), completedAt: a.completedAt }))
      : [];
    sections[s] = {
      score: exam?.scores?.[s] || { band: null, notes: "", updatedAt: null },
      autoBand: exam?.results?.[s]?.band ?? null,
      raw: exam?.results?.[s]?.raw ?? null,
      total: exam?.results?.[s]?.total ?? null,
      status: sectionStatus(exam, s),
      attempts
    };
  }
  res.json({
    user: publicUser(ctx.user),
    session: { id: ctx.session.id, name: ctx.session.name },
    sections,
    overall: examOverall(exam)
  });
});

router.put("/:id/participants/:userId/scores/:section", (req, res) => {
  const section = req.params.section;
  if (!SCORE_SECTIONS.includes(section)) return res.status(404).json({ error: "Unknown section" });
  const parsed = parseBand(req.body?.band);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const notes = cleanString(req.body?.notes, 4000);
  const out = updateDB((db) => {
    const ctx = loadParticipant(db, req);
    if (ctx.error) return ctx;
    const exam = ensureExam(db, ctx.session, ctx.user.id);
    const hasValue = parsed.band != null || notes;
    exam.scores[section] = { band: parsed.band, notes, updatedAt: hasValue ? new Date().toISOString() : null };
    return { row: participantRow(db, ctx.session, ctx.user) };
  });
  if (out.error) return res.status(out.status).json({ error: out.error });
  res.json(out.row);
});

// ---------- export ----------

function bandText(b) {
  return b == null ? "" : Number(b).toFixed(1);
}

function exportRows(db, session) {
  return participantsOf(db, session).map((u) => {
    const row = participantRow(db, session, u);
    const r = row.results || {};
    return {
      id: u.candidateId || "",
      name: fullName(u),
      email: u.email || "",
      phone: u.phone || "",
      listeningRaw: r.listening ? `${r.listening.raw}/${r.listening.total}` : "",
      listening: bandText(row.sections.listening.band),
      readingRaw: r.reading ? `${r.reading.raw}/${r.reading.total}` : "",
      reading: bandText(row.sections.reading.band),
      writing: bandText(row.sections.writing.band),
      speaking: bandText(row.sections.speaking.band),
      overall: bandText(row.overall)
    };
  });
}

const EXPORT_COLUMNS = [
  { key: "id", header: "Candidate ID", width: 14 },
  { key: "name", header: "Full name", width: 28 },
  { key: "email", header: "Email", width: 30 },
  { key: "phone", header: "Phone", width: 18 },
  { key: "listeningRaw", header: "Listening (raw)", width: 15 },
  { key: "listening", header: "Listening", width: 11 },
  { key: "readingRaw", header: "Reading (raw)", width: 14 },
  { key: "reading", header: "Reading", width: 10 },
  { key: "writing", header: "Writing", width: 10 },
  { key: "speaking", header: "Speaking", width: 10 },
  { key: "overall", header: "Overall", width: 10 }
];

function safeFileName(name) {
  return String(name || "session").replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 60) || "session";
}

router.get(
  "/:id/export",
  asyncHandler(async (req, res) => {
    const db = readDB();
    const session = findSession(db, req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    const format = req.query.format === "docx" ? "docx" : "xlsx";
    const rows = exportRows(db, session);
    const base = `${safeFileName(session.name)}-results`;

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      wb.creator = "IELTS Mock Admin";
      const ws = wb.addWorksheet("Results");
      ws.addRow([`${session.name} — results`]).font = { bold: true, size: 14 };
      ws.addRow([`Date: ${session.date} ${session.time}   Participants: ${rows.length}`]);
      ws.addRow([]);
      const header = ws.addRow(EXPORT_COLUMNS.map((c) => c.header));
      header.font = { bold: true, color: { argb: "FFFFFFFF" } };
      header.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2534B" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      for (const r of rows) ws.addRow(EXPORT_COLUMNS.map((c) => r[c.key]));
      EXPORT_COLUMNS.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));
      ws.views = [{ state: "frozen", ySplit: 4 }];
      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${base}.xlsx"`);
      return res.send(Buffer.from(buffer));
    }

    const cell = (text, bold = false) =>
      new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: String(text ?? ""), bold, size: 18 })] })]
      });
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: EXPORT_COLUMNS.map((c) => cell(c.header, true)) }),
        ...rows.map((r) => new TableRow({ children: EXPORT_COLUMNS.map((c) => cell(r[c.key])) }))
      ]
    });
    const doc = new Document({
      creator: "IELTS Mock Admin",
      title: `${session.name} results`,
      sections: [
        {
          properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
          children: [
            new Paragraph({ text: `${session.name} — results`, heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ children: [new TextRun({ text: `${session.date} ${session.time}   •   ${rows.length} participants`, color: "555555" })] }),
            new Paragraph({ text: "" }),
            table
          ]
        }
      ]
    });
    const buffer = await Packer.toBuffer(doc);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${base}.docx"`);
    res.send(buffer);
  })
);

// ---------- attempt review (mounted at /api/ielts/admin/attempts) ----------

export const attemptRouter = express.Router();
attemptRouter.use(requireStaff);

attemptRouter.get("/:attemptId", (req, res) => {
  const db = readDB();
  const attempt = db.ieltsAttempts.find((a) => a.id === String(req.params.attemptId));
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });
  const user = db.users.find((u) => u.id === attempt.userId);
  const session = db.ieltsSessions.find((s) => s.id === attempt.sessionId);
  const exam = db.ieltsExams.find((e) => e.id === attempt.examId);
  const record = contentOf(db, attempt.section)?.find((r) => r.id === attempt.refId) || null;

  let part = null;
  if (exam) part = buildSectionContent(db, exam, attempt.section, { withAnswers: true }).parts.find((p) => p.refId === attempt.refId) || null;
  if (!part && record) part = assembleParts(attempt.section, [record], { withAnswers: true }).parts[0];

  const review = part && attempt.section !== "writing" ? gradePart(part, attempt.answers || {}) : [];
  res.json({
    attempt,
    user: user ? { id: user.id, candidateId: user.candidateId ?? null, name: fullName(user), email: user.email || null } : null,
    session: session ? { id: session.id, name: session.name } : null,
    part,
    review
  });
});

export default router;
