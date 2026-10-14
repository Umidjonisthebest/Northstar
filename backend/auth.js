import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { userAuthState } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set JWT_SECRET as an environment variable in any real deployment. Without
// one, we generate a random secret on first run and persist it next to the
// database so tokens survive restarts without ever shipping a known default.
function resolveSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production.");
  }

  const secretPath = path.join(__dirname, "data", ".jwt-secret");
  try {
    return fs.readFileSync(secretPath, "utf-8").trim();
  } catch {
    const generated = crypto.randomBytes(48).toString("hex");
    fs.mkdirSync(path.dirname(secretPath), { recursive: true });
    fs.writeFileSync(secretPath, generated);
    console.warn(
      "[auth] No JWT_SECRET set — generated one and saved it to backend/data/.jwt-secret for local dev. " +
        "Set JWT_SECRET yourself before deploying anywhere real."
    );
    return generated;
  }
}

export const JWT_SECRET = resolveSecret();

export function signToken(payload, expiresIn = "12h") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// The two kinds of staff, each with its own panel. An admin runs the platform: the content every
// student gets, the accounts, the public site. A teacher runs the Presidential School classes.
// Which API belongs to whom is decided where a router (or one route) is guarded: `requireAdmin`
// for the admin alone, `requireStaff` for both. What a teacher may see inside a shared route is in
// staffScope.js.
export const STAFF_ROLES = ["admin", "teacher"];

function staffGuard(roles, refusal) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    if (!roles.includes(payload.role)) return res.status(403).json({ error: refusal });
    // The account may have been removed, or be something else now, since this token was issued:
    // an admin who takes a teacher's account away must not leave their open session working.
    const state = userAuthState(payload.userId);
    if (!state || state.role !== payload.role) return res.status(401).json({ error: "This account no longer exists" });
    if (typeof payload.iat === "number" && payload.iat < Math.floor(state.signedOutBefore / 1000)) {
      return res.status(401).json({ error: "Your password was changed. Please sign in again." });
    }
    req.user = payload;
    next();
  };
}

export const requireAdmin = staffGuard(["admin"], "Admin only");
export const requireStaff = staffGuard(STAFF_ROLES, "Teachers and admins only");

// Persistent student login: token just carries { role: 'student', userId }.
// Which session/module a student can act on is resolved per-request from the
// database (see routes/examRoutes.js), so one account works across every
// session they've ever been added to.
export function requireStudent(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  if (payload.role !== "student") return res.status(403).json({ error: "Student only" });
  // The account may have been deleted since this token was issued. (Outside the try: an
  // unreadable database is a server problem, not an expired token.)
  const state = userAuthState(payload.userId);
  if (!state) return res.status(401).json({ error: "This account no longer exists" });
  // A password reset signs out every session that began before it: someone who knew the old
  // password (or held a stolen token) is out as soon as the password changes.
  if (typeof payload.iat === "number" && payload.iat < Math.floor(state.signedOutBefore / 1000)) {
    return res.status(401).json({ error: "Your password was changed. Please sign in again." });
  }
  // A temporary password only opens the screen where the student chooses their own.
  if (state.mustChangePassword && !PASSWORD_CHANGE_PATHS.has(req.originalUrl.split("?")[0])) {
    return res.status(403).json({ error: "Please choose a new password before you continue.", code: "PASSWORD_CHANGE_REQUIRED" });
  }
  req.studentUserId = payload.userId;
  next();
}

const PASSWORD_CHANGE_PATHS = new Set(["/api/student/me", "/api/student/change-password"]);
