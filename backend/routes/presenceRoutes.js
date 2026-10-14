// "Studying now" (see presence.js). Mounted at /api/presence.
import { Router } from "express";
import { requireStudent } from "../auth.js";
import { beat, presenceSummary } from "../presence.js";

const router = Router();
router.use(requireStudent);

// The hub's heartbeat, about once a minute while it is open. The reply is
// anonymous: a count, or `few` when fewer than three students are active.
router.post("/ping", (req, res) => {
  beat(req.studentUserId);
  res.json(presenceSummary());
});

export default router;
