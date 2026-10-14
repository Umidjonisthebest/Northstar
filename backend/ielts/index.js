// IELTS mock module: computer-delivered Listening → Reading → Writing with an
// admin panel for tests, sessions, candidates, results and exports.
// Everything is mounted under /api/ielts and shares Northstar's users and admin login.
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import examRoutes from "./routes/examRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import practiceRoutes from "./routes/practiceRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import testAdminRoutes from "./routes/testAdminRoutes.js";
import diagnosticRoutes from "./routes/diagnosticRoutes.js";
import contentRoutes, { UPLOADS_ROOT } from "./routes/contentRoutes.js";
import sessionRoutes, { attemptRouter } from "./routes/sessionRoutes.js";
import userRoutes, { dashboardRouter } from "./routes/userRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, "seed", "assets");

export { ensureIeltsContent, ensureIeltsPractice, ensureIeltsPracticeTests, separateIeltsPracticeTests } from "./seed/starter.js";
export { ieltsSummaryFor } from "./lib/summary.js";
export { diagnosticStatus as ieltsDiagnosticStatus } from "./lib/diagnostic.js";

export function mountIelts(app) {
  app.use("/api/ielts/exam", examRoutes); // candidate (exam-room) API
  app.use("/api/ielts/student/practice", practiceRoutes); // self-study practice in the hub
  app.use("/api/ielts/student/tests", testRoutes); // whole practice tests, a section at a time
  app.use("/api/ielts/student/diagnostic", diagnosticRoutes); // a new student's starting band
  app.use("/api/ielts/student", studentRoutes); // Northstar student hub
  app.use("/api/ielts/admin/content", contentRoutes);
  app.use("/api/ielts/admin/tests", testAdminRoutes); // practice tests: both panels look (tests, results), the admin builds
  app.use("/api/ielts/admin/sessions", sessionRoutes);
  app.use("/api/ielts/admin/attempts", attemptRouter);
  app.use("/api/ielts/admin/users", dashboardRouter); // one student's dashboard: both panels
  app.use("/api/ielts/admin/users", userRoutes); // accounts: admin only
  app.use("/api/ielts", (req, res) => res.status(404).json({ error: "Not found" }));

  app.use("/uploads", express.static(UPLOADS_ROOT, { maxAge: "7d", fallthrough: false }));
  app.use("/ielts-assets", express.static(ASSETS_DIR, { maxAge: "7d", fallthrough: false }));
}
