// Homework in the studio (see homework.js for the rules). Mounted at /api/admin/homework.
// A teacher first draws the questions (POST /draw, which saves nothing), then sets the homework
// with exactly the questions they saw.
import { Router } from "express";
import { readDB, updateDB } from "../db.js";
import { requireStaff } from "../auth.js";
import { allClasses, classInfo, classMembers } from "../classrooms.js";
import { HOMEWORK, addHomework, cleanDraw, cleanHomework, drawQuestions, dueRange, questionCard, teacherHomework, teacherHomeworkDetail } from "../homework.js";

const router = Router();
// Homework is a teacher's screen; the admin panel doesn't have it. The admin's token is still let
// through: nothing here is beyond an admin, and a refusal would only get in the way of support.
router.use(requireStaff);

router.get("/", (req, res) => {
  const db = readDB();
  res.json({
    homework: teacherHomework(db),
    classes: allClasses(db).map((cls) => ({ ...classInfo(cls), students: classMembers(db, cls.id).length })),
    limits: { questions: HOMEWORK.maxQuestions, title: HOMEWORK.titleMax, note: HOMEWORK.noteMax, due: dueRange() }
  });
});

// Questions for a homework, drawn at random from the bank: { section?, skills?, difficulty?, count,
// exclude? }. `exclude` is the ids already chosen, so "draw again" and "add more" bring new ones.
router.post("/draw", (req, res) => {
  const { spec, error } = cleanDraw(req.body);
  if (error) return res.status(400).json({ error });
  const { questions, available } = drawQuestions(readDB(), spec);
  res.json({ questions: questions.map(questionCard), available });
});

router.post("/", (req, res) => {
  const out = updateDB((db) => {
    const { homework, error } = cleanHomework(db, req.body);
    if (error) return { error };
    const by = db.users.find((u) => u.id === req.user.userId);
    return { homework: addHomework(db, homework, `${by?.firstName || ""} ${by?.lastName || ""}`.trim()) };
  });
  if (out.error) return res.status(400).json({ error: out.error });
  res.status(201).json({ id: out.homework.id });
});

router.get("/:id", (req, res) => {
  const view = teacherHomeworkDetail(readDB(), req.params.id);
  if (!view) return res.status(404).json({ error: "Homework not found" });
  res.json(view);
});

// Taking a homework back removes it from every student's list. Their answers stay their answers.
router.delete("/:id", (req, res) => {
  const ok = updateDB((db) => {
    const before = db.homework.length;
    db.homework = db.homework.filter((h) => h.id !== req.params.id);
    return db.homework.length !== before;
  });
  if (!ok) return res.status(404).json({ error: "Homework not found" });
  res.json({ ok: true });
});

export default router;
