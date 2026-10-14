import { Router } from "express";
import bcrypt from "bcryptjs";
import { readDB, updateDB } from "../db.js";
import { signToken, requireStaff, STAFF_ROLES } from "../auth.js";
import { loginLimiter } from "../rateLimit.js";
import { passwordProblem, secret, text } from "../validate.js";

const router = Router();

const staffView = (u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role });
const emailOf = (u) => (u.email || "").trim().toLowerCase();

// One sign-in for both kinds of staff. The account's role, not anything the page sends, decides
// what the token is good for: the admin's email and password open the admin panel, a teacher's
// open the teacher studio. A wrong email and a wrong password get the same answer.
function staffLogin(req, res) {
  // Only strings are valid here: a number/object password used to throw inside bcrypt (a 500).
  const email = text(req.body?.email, 120);
  const password = secret(req.body?.password);
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  if (password.length > 200) return res.status(401).json({ error: "Invalid credentials" });

  const db = readDB();
  const user = db.users.find((u) => STAFF_ROLES.includes(u.role) && emailOf(u) === email.toLowerCase());
  if (!user || !user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // When a teacher last signed in, for the admin's list of teacher accounts.
  if (user.role === "teacher") {
    updateDB((d) => {
      const u = d.users.find((x) => x.id === user.id);
      if (u) u.lastSignInAt = new Date().toISOString();
    });
  }

  const token = signToken({ role: user.role, userId: user.id, email: user.email });
  res.json({ token, user: staffView(user) });
}

router.post("/staff/login", loginLimiter, staffLogin);
// The address from before teachers had accounts of their own.
router.post("/admin/login", loginLimiter, staffLogin);

function me(req, res) {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.userId);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(staffView(user));
}
router.get("/staff/me", requireStaff, me);
router.get("/admin/me", requireStaff, me);

// A member of staff chooses a new password for themselves. The admin hands a teacher a temporary
// one, and this is how it stops being a password someone else knows. Every other session of the
// account ends; this one carries on with the new token.
router.post("/staff/password", loginLimiter, requireStaff, (req, res) => {
  const current = secret(req.body?.current);
  const next = secret(req.body?.next);
  const weak = passwordProblem(next);
  if (weak) return res.status(400).json({ error: weak });
  const out = updateDB((db) => {
    const u = db.users.find((x) => x.id === req.user.userId);
    if (!u?.passwordHash || !bcrypt.compareSync(current, u.passwordHash)) return { error: "Your current password isn't right", code: 400 };
    if (current === next) return { error: "Choose a password you haven't been using", code: 400 };
    u.passwordHash = bcrypt.hashSync(next, 10);
    u.passwordChangedAt = new Date().toISOString(); // tokens from before this moment are dead (auth.js)
    return { user: u };
  });
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json({ token: signToken({ role: out.user.role, userId: out.user.id, email: out.user.email }), user: staffView(out.user) });
});

export default router;
