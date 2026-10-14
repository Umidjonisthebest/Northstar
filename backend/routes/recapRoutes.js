// Monthly recaps (see recap.js). Mounted at /api/recaps.
import { Router } from "express";
import { readDB, updateDB } from "../db.js";
import { requireStudent } from "../auth.js";
import { getProgress, todayKey } from "../gamification.js";
import { avatarDataUri, publicAvatar } from "../avatars.js";
import { ensureRecaps, lastCompletedMonth, monthLabel, monthOf, nextMonth, recapSvg } from "../recap.js";

const router = Router();
router.use(requireStudent);

// The database with this student's recaps worked out. It only writes when a
// new month has become available.
function dbWithRecaps(userId) {
  const db = readDB();
  if (!ensureRecaps(db, userId)) return db;
  return updateDB((fresh) => {
    ensureRecaps(fresh, userId);
    return fresh;
  });
}

// Every recap so far, newest first, and when the next one arrives.
router.get("/", (req, res) => {
  const db = dbWithRecaps(req.studentUserId);
  const p = getProgress(db, req.studentUserId);
  const current = monthOf(todayKey());
  res.json({
    recaps: p.recaps,
    latest: lastCompletedMonth(),
    seen: p.recapSeen,
    // This month's recap arrives on the 1st of the next one.
    next: { month: current, label: monthLabel(current), availableOn: `${nextMonth(current)}-01` }
  });
});

// The recap page calls this once it has shown the newest recap.
router.post("/seen", (req, res) => {
  updateDB((db) => {
    const p = getProgress(db, req.studentUserId);
    if (p.recaps[0]) p.recapSeen = p.recaps[0].month;
  });
  res.json({ ok: true });
});

// The share image for one month, as an SVG the browser can save or turn into a PNG.
router.get("/:month/image.svg", (req, res) => {
  const db = dbWithRecaps(req.studentUserId);
  const recap = getProgress(db, req.studentUserId).recaps.find((r) => r.month === req.params.month);
  if (!recap) return res.status(404).json({ error: "There's no recap for that month." });
  const user = db.users.find((u) => u.id === req.studentUserId);
  const avatar = publicAvatar(user);
  res.type("image/svg+xml").send(recapSvg(recap, user?.firstName || "", avatar ? avatarDataUri(avatar.id) : null));
});

export default router;
