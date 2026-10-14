// Teacher accounts, kept by the admin. Mounted at /api/admin/teachers, admin only.
// A teacher signs in on the same page as the admin and lands in the teacher studio (authRoutes.js).
// Nobody can sign up as a teacher: the admin makes the account and hands over a temporary
// password, which the teacher replaces from the studio's menu (POST /api/auth/staff/password).
import { Router } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { readDB, updateDB } from "../db.js";
import { requireAdmin } from "../auth.js";
import { tempPassword } from "../users.js";
import { isEmail, text } from "../validate.js";

const router = Router();
router.use(requireAdmin);

const emailOf = (u) => (u.email || "").trim().toLowerCase();
const teacherView = (u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName || "", email: u.email, createdAt: u.createdAt, lastSignInAt: u.lastSignInAt || null });

// Returns { value } or { error }. An address may belong to one account only, whatever its kind:
// sign-in looks staff up by email, and a student with a teacher's address would be a muddle.
function cleanTeacher(db, body, existingId = null) {
  const firstName = text(body?.firstName, 60);
  const lastName = text(body?.lastName, 60);
  const email = text(body?.email, 120).toLowerCase();
  if (!firstName) return { error: "First name is required" };
  if (!isEmail(email)) return { error: "Enter a valid email address" };
  if (db.users.some((u) => u.id !== existingId && emailOf(u) === email)) return { error: "Another account already uses this email" };
  return { value: { firstName, lastName, email } };
}

router.get("/", (req, res) => {
  const teachers = readDB()
    .users.filter((u) => u.role === "teacher")
    .map(teacherView)
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  res.json({ teachers });
});

// The temporary password is in this answer and nowhere else: only its hash is stored.
router.post("/", (req, res) => {
  const temp = tempPassword();
  const out = updateDB((db) => {
    const { value, error } = cleanTeacher(db, req.body);
    if (error) return { error };
    const teacher = { id: nanoid(10), role: "teacher", ...value, passwordHash: bcrypt.hashSync(temp, 10), createdAt: new Date().toISOString() };
    db.users.push(teacher);
    return { teacher };
  });
  if (out.error) return res.status(400).json({ error: out.error });
  res.status(201).json({ teacher: teacherView(out.teacher), tempPassword: temp });
});

router.put("/:id", (req, res) => {
  const out = updateDB((db) => {
    const u = db.users.find((x) => x.id === req.params.id && x.role === "teacher");
    if (!u) return { error: "Teacher not found", code: 404 };
    const { value, error } = cleanTeacher(db, req.body, u.id);
    if (error) return { error, code: 400 };
    Object.assign(u, value);
    return { teacher: u };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json({ teacher: teacherView(out.teacher) });
});

// A new temporary password. The old one stops working and the teacher is signed out everywhere.
router.post("/:id/reset-password", (req, res) => {
  const temp = tempPassword();
  const ok = updateDB((db) => {
    const u = db.users.find((x) => x.id === req.params.id && x.role === "teacher");
    if (!u) return false;
    u.passwordHash = bcrypt.hashSync(temp, 10);
    u.passwordChangedAt = new Date().toISOString();
    return true;
  });
  if (!ok) return res.status(404).json({ error: "Teacher not found" });
  res.json({ tempPassword: temp });
});

// Taking the account away signs the teacher out at their next request (auth.js). What they set
// stays: homework and announcements belong to the classes, not to the account.
router.delete("/:id", (req, res) => {
  const ok = updateDB((db) => {
    const before = db.users.length;
    db.users = db.users.filter((u) => !(u.id === req.params.id && u.role === "teacher"));
    return db.users.length !== before;
  });
  if (!ok) return res.status(404).json({ error: "Teacher not found" });
  res.json({ ok: true });
});

export default router;
