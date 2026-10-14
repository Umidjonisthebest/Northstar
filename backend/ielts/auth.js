import jwt from "jsonwebtoken";
import { JWT_SECRET, signToken } from "../auth.js";

// Candidate tokens are scoped to one exam (session + user) — see routes/examRoutes.js.
// They carry their own role, so Northstar's student and admin routes never accept them.
export const CANDIDATE_ROLE = "ielts_candidate";

export function signCandidateToken({ userId, sessionId, examId }) {
  return signToken({ role: CANDIDATE_ROLE, userId, sessionId, examId }, "10h");
}

export function requireCandidate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== CANDIDATE_ROLE) return res.status(403).json({ error: "Candidate only" });
    req.candidate = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
