// Public data for the cover page: what the platform holds, and the success
// stories a teacher chose to publish. No auth, and nothing student-private.
import { Router } from "express";
import { readDB } from "../db.js";
import { BADGES } from "../gamification.js";
import { SKILLS } from "../practiceSkills.js";
import { contentOf } from "../ielts/store.js";
import { publicStory } from "../stories.js";

const router = Router();

router.get("/overview", (req, res) => {
  const db = readDB();
  const inSection = (section) => db.practiceQuestions.filter((q) => q.section === section).length;
  const skills = Object.values(SKILLS).reduce((n, domains) => n + Object.values(domains).flat().length, 0);
  res.json({
    stats: {
      questions: db.practiceQuestions.length,
      rw: inSection("Reading & Writing"),
      math: inSection("Math"),
      skills,
      vocab: db.vocab.length,
      badges: Object.keys(BADGES).length,
      ielts: {
        listening: contentOf(db, "listening").length,
        reading: contentOf(db, "reading").length,
        writing: contentOf(db, "writing").length
      }
    },
    stories: db.stories
      .filter((s) => s.published)
      .slice()
      .reverse()
      .slice(0, 12)
      .map(publicStory)
  });
});

export default router;
