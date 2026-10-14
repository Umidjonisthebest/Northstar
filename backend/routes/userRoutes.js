import { Router } from "express";
import { readDB } from "../db.js";
import { requireStaff } from "../auth.js";
import { visibleStudents } from "../staffScope.js";

const router = Router();
router.use(requireStaff);

// Search existing student users by name/email (used by "Add Participants")
router.get("/search", (req, res) => {
  const q = String(req.query.q || "").toLowerCase().trim();
  const db = readDB();
  let results = visibleStudents(req, db);
  if (q) {
    results = results.filter(
      (u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        String(u.candidateId || "").includes(q)
    );
  }
  res.json(
    results
      .slice(0, 20)
      .map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, candidateId: u.candidateId }))
  );
});

router.get("/", (req, res) => {
  const db = readDB();
  res.json(
    visibleStudents(req, db)
      .map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, candidateId: u.candidateId }))
  );
});

export default router;
