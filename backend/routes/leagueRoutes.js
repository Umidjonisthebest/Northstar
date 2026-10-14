// Weekly leagues for students (see leagues.js). Mounted at /api/leagues.
// The teacher's view is GET /api/admin/leagues in adminRoutes.js.
import { Router } from "express";
import { readDB, updateDB } from "../db.js";
import { requireStudent } from "../auth.js";
import { ensureLeagueWeek, leagueView } from "../leagues.js";

const router = Router();
router.use(requireStudent);

// Reads the database with this week's league in place. It only writes when
// something changed: a new week, or students who have just earned their first XP.
export function dbWithLeague() {
  const db = readDB();
  if (!ensureLeagueWeek(db).changed) return db;
  return updateDB((fresh) => {
    ensureLeagueWeek(fresh);
    return fresh;
  });
}

// The student's tier, their group's table for the week, and last week's result.
router.get("/me", (req, res) => res.json(leagueView(dbWithLeague(), req.studentUserId)));

export default router;
