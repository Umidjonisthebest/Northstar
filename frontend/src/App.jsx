import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AdminAuthProvider, StudentAuthProvider, useAdminAuth, useStudentAuth } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import { ConfirmProvider } from "./components/Confirm.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";

import Landing from "./pages/landing/Landing.jsx";
import Auth from "./pages/landing/Auth.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import { ProgressProvider } from "./context/ProgressContext.jsx";
import { IELTS_SESSIONS, IELTS_TESTS, PANELS, SAT_MOCKS, SAT_SESSIONS, STAFF_LOGIN, panelHas } from "./studio/panels.js";
import * as Ielts from "./ielts/pages.js";

// Everything after the cover page and sign-in screens loads on demand, one chunk per route group
// (see pages/groups/*): a visitor to the cover page no longer downloads the teacher studio, the
// exam screens and every hub page. A group's chunk is fetched once, the first time one of its
// pages is opened. The named export becomes the lazy component.
const group = (load) => (name) => lazy(() => load().then((m) => ({ default: m[name] })));
const admin = group(() => import("./pages/groups/admin.js"));
const hub = group(() => import("./pages/groups/hub.js"));
const player = group(() => import("./pages/groups/player.js"));
const exam = group(() => import("./pages/groups/exam.js"));

const StaffLogin = admin("StaffLogin");
const StudioLayout = admin("StudioLayout");
const Teachers = admin("Teachers");
const SatTests = admin("SatTests");
const TestEditor = admin("TestEditor");
const SessionDetail = admin("SessionDetail");
const ParticipantResult = admin("ParticipantResult");
const PracticeBank = admin("PracticeBank");
const VocabAdmin = admin("VocabAdmin");
const AdminOverview = admin("AdminOverview");
const StudentsList = admin("StudentsList");
const StudentProfile = admin("StudentProfile");
const Analytics = admin("Analytics");
const Announcements = admin("Announcements");
const AdminMessages = admin("AdminMessages");
const Stories = admin("Stories");
const AdminLeagues = admin("AdminLeagues");
const AdminClasses = admin("AdminClasses");
const AdminHomework = admin("AdminHomework");

const StudentShell = hub("StudentShell");
const Home = hub("Home");
const IeltsHome = hub("IeltsHome");
const IeltsPractice = hub("IeltsPractice");
const IeltsPracticeTests = hub("IeltsPracticeTests");
const IeltsAnalytics = hub("IeltsAnalytics");
const IeltsBandCalc = hub("IeltsBandCalc");
const MockExams = hub("MockExams");
const QuestionBank = hub("QuestionBank");
const BankSection = hub("BankSection");
const Mistakes = hub("Mistakes");
const StudentAnalytics = hub("StudentAnalytics");
const Vocab = hub("Vocab");
const ScoreCalc = hub("ScoreCalc");
const StudyPlan = hub("StudyPlan");
const Coach = hub("Coach");
const Trophies = hub("Trophies");
const Shop = hub("Shop");
const Sky = hub("Sky");
const Daily = hub("Daily");
const Leagues = hub("Leagues");
const Profile = hub("Profile");
const Messages = hub("Messages");
const Classroom = hub("Classroom");
const PointGap = hub("PointGap");
const Recap = hub("Recap");
const Diagnostic = hub("Diagnostic");
const DiagnosticResult = hub("DiagnosticResult");
const PracticeTestResult = hub("PracticeTestResult");
const IeltsDiagnostic = hub("IeltsDiagnostic");
const Welcome = hub("Welcome");

const Player = player("Player");
const DiagnosticTest = player("DiagnosticTest");
const PracticeTestRun = player("PracticeTestRun");
const PracticeTestModule = player("PracticeTestModule");

const ExamRunner = exam("ExamRunner");
const ExamModule = exam("ExamModule");
const ExamComplete = exam("ExamComplete");
const StudentResultView = exam("StudentResultView");

// Development only: every character picture on one page (pages/dev/ArtGallery.jsx).
const ArtGallery = import.meta.env.DEV ? lazy(() => import("./pages/dev/ArtGallery.jsx")) : null;

const PageLoading = () => (
  <div className="ns-loading">
    <div className="ns-spinner" />
  </div>
);

// IELTS screens are code-split; `variant` picks their layout (see ielts/IeltsScope.jsx).
function IeltsArea({ variant }) {
  return (
    <Suspense
      fallback={
        <div className="ns-loading">
          <div className="ns-spinner" />
        </div>
      }
    >
      <Ielts.IeltsScope variant={variant} />
    </Suspense>
  );
}

// A staff panel: "admin" or "teacher". Nobody signed in goes to the sign-in page; someone signed
// in as the other kind of staff goes to their own panel, not this one.
function RequireStaff({ panel, children }) {
  const { token, role } = useAdminAuth();
  if (!token) return <Navigate to={STAFF_LOGIN} replace />;
  if (role !== panel) return <Navigate to={`${PANELS[role].base}/overview`} replace />;
  return children;
}

// The screens inside a panel's frame. Both panels are built from this one list: a screen is left
// out of a panel that doesn't have it (studio/panels.js), and an address that isn't in the panel
// goes back to its overview.
function studioRoutes(panel) {
  const on = (key) => panelHas(panel, key);
  const base = PANELS[panel].base;
  // A list that used to be a menu item of its own and is a tab of a section now: its old address
  // (bookmarks, and "back to…" links all over the studio) lands on the tab.
  const moved = (path, to) => <Route key={path} path={path} element={<Navigate to={`${base}${to}`} replace />} />;
  return (
    <>
      <Route index element={<Navigate to="overview" replace />} />
      {on("overview") && <Route path="overview" element={<AdminOverview />} />}
      {on("students") && <Route path="students" element={<StudentsList />} />}
      {on("students") && <Route path="students/:id" element={<StudentProfile />} />}
      {on("teachers") && <Route path="teachers" element={<Teachers />} />}
      {on("leagues") && <Route path="leagues" element={<AdminLeagues />} />}
      {on("classes") && <Route path="classes" element={<AdminClasses />} />}
      {on("homework") && <Route path="homework" element={<AdminHomework />} />}
      {on("analytics") && <Route path="analytics" element={<Analytics />} />}
      {on("announcements") && <Route path="announcements" element={<Announcements />} />}
      {on("messages") && <Route path="messages" element={<AdminMessages />} />}
      {on("stories") && <Route path="stories" element={<Stories />} />}
      {/* SAT > Practice tests: the tests students sit alone, their results, and the teacher mocks
          (the mock tests and their sessions, whose editors and detail pages keep their addresses). */}
      {on("sat-tests") && <Route path="sat/tests" element={<SatTests />} />}
      {on("sat-tests") && <Route path="sat/tests/:testId" element={<TestEditor practice />} />}
      {on("sat-tests") && moved("tests", SAT_MOCKS)}
      {on("sat-tests") && <Route path="tests/:testId" element={<TestEditor />} />}
      {on("sat-tests") && moved("sessions", SAT_SESSIONS)}
      {on("sat-tests") && <Route path="sessions/:sessionId" element={<SessionDetail />} />}
      {on("sat-tests") && <Route path="sessions/:sessionId/participants/:participantId" element={<ParticipantResult />} />}
      {on("practice") && <Route path="practice" element={<PracticeBank />} />}
      {on("vocab") && <Route path="vocab" element={<VocabAdmin />} />}
      <Route path="ielts" element={<IeltsArea variant="admin" />}>
        <Route index element={<Navigate to="tests" replace />} />
        {/* IELTS > Practice tests: the same three tabs, and a page for each practice test. */}
        {on("ielts-tests") && <Route path="tests" element={<Ielts.PracticeTestsPage />} />}
        {on("ielts-tests") && <Route path="tests/:id" element={<Ielts.PracticeTestBuilder />} />}
        {on("ielts-tests") && moved("sessions", IELTS_SESSIONS)}
        {on("ielts-tests") && <Route path="sessions/:id" element={<Ielts.SessionDetailPage />} />}
        {on("ielts-tests") && moved("practice-tests", IELTS_TESTS)}
        {on("ielts-practice") && <Route path="practice" element={<Ielts.SectionPracticePage />} />}
        {on("ielts-practice") && ["listening", "reading", "writing"].map((kind) => moved(kind, `/ielts/practice?kind=${kind}`))}
        {on("ielts-users") && <Route path="users" element={<Ielts.UsersPage />} />}
        {/* One student's IELTS dashboard opens from their profile, so it goes where Students goes. */}
        {on("students") && <Route path="users/:id" element={<Ielts.UserDashboardPage />} />}
      </Route>
      <Route path="*" element={<Navigate to={`${PANELS[panel].base}/overview`} replace />} />
    </>
  );
}

function RequireStudent({ children }) {
  const { token, user } = useStudentAuth();
  const loc = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  // Signed in with a temporary password: choosing a new one comes first.
  if (user?.mustChangePassword && loc.pathname !== "/change-password") return <Navigate to="/change-password" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
        <ErrorBoundary>
          <AdminAuthProvider>
            <StudentAuthProvider>
              <ProgressProvider>
              <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Auth mode="login" />} />
                <Route path="/signup" element={<Auth mode="signup" />} />
                <Route path="/forgot-password" element={<Auth mode="forgot" />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                {/* A temporary password only opens this screen until the student chooses their own. */}
                <Route
                  path="/change-password"
                  element={
                    <RequireStudent>
                      <ChangePassword />
                    </RequireStudent>
                  }
                />

                {/* One sign-in for the admin and for teachers; the account decides which panel opens.
                    /admin/login is the address from before the two were separate. */}
                <Route path={STAFF_LOGIN} element={<StaffLogin />} />
                <Route path="/admin/login" element={<Navigate to={STAFF_LOGIN} replace />} />

                {/* The admin panel (/admin) and the teacher studio (/teacher). */}
                {Object.keys(PANELS).map((panel) => (
                  <Route
                    key={panel}
                    path={PANELS[panel].base}
                    element={
                      <RequireStaff panel={panel}>
                        <StudioLayout panel={panel} />
                      </RequireStaff>
                    }
                  >
                    {studioRoutes(panel)}
                  </Route>
                ))}

                {/* IELTS editors and previews are full-screen workspaces, and the admin's alone. */}
                <Route
                  path="/admin/ielts"
                  element={
                    <RequireStaff panel="admin">
                      <IeltsArea variant="workspace" />
                    </RequireStaff>
                  }
                >
                  <Route path="listening/new" element={<Ielts.ListeningEditor />} />
                  <Route path="listening/:id/edit" element={<Ielts.ListeningEditor />} />
                  <Route path="reading/new" element={<Ielts.ReadingEditor />} />
                  <Route path="reading/:id/edit" element={<Ielts.ReadingEditor />} />
                  <Route path="writing/new" element={<Ielts.WritingEditor />} />
                  <Route path="writing/:id/edit" element={<Ielts.WritingEditor />} />
                  <Route path=":kind/:id/preview" element={<Ielts.PreviewPage />} />
                </Route>

                {/* IELTS candidate site: exam-room login with the candidate ID, then the test. */}
                <Route path="/ielts" element={<IeltsArea variant="candidate" />}>
                  <Route index element={<Ielts.CandidateLogin />} />
                  <Route path="exam" element={<Ielts.ExamFlow />} />
                </Route>

                {/* IELTS self-study practice from the hub, in the exam-room screen. */}
                <Route
                  path="/ielts-practice"
                  element={
                    <RequireStudent>
                      <IeltsArea variant="candidate" />
                    </RequireStudent>
                  }
                >
                  <Route path=":kind/:id" element={<Ielts.PracticeRunner />} />
                </Route>

                {/* A whole section of an IELTS practice test, and a finished one opened again. */}
                <Route
                  path="/ielts-test"
                  element={
                    <RequireStudent>
                      <IeltsArea variant="candidate" />
                    </RequireStudent>
                  }
                >
                  <Route path="review/:attemptId" element={<Ielts.TestRunner />} />
                  <Route path=":testId/:kind" element={<Ielts.TestRunner />} />
                </Route>

                {/* IELTS diagnostic test: one random listening or reading part, in the exam-room screen. */}
                <Route
                  path="/ielts-diagnostic"
                  element={
                    <RequireStudent>
                      <IeltsArea variant="candidate" />
                    </RequireStudent>
                  }
                >
                  <Route path=":id" element={<Ielts.DiagnosticRunner />} />
                </Route>

                {/* After sign-up: pick an exam, then take its diagnostic test. */}
                <Route
                  path="/welcome"
                  element={
                    <RequireStudent>
                      <Welcome />
                    </RequireStudent>
                  }
                />

                <Route
                  element={
                    <RequireStudent>
                      <StudentShell />
                    </RequireStudent>
                  }
                >
                  <Route path="/dashboard" element={<Home />} />
                  <Route path="/ielts-prep" element={<IeltsHome />} />
                  {/* The teacher's mock tests are a tab of the IELTS Practice Tests page now. */}
                  <Route path="/ielts-prep/tests" element={<Navigate to="/ielts-prep/practice-tests?tab=teacher" replace />} />
                  <Route path="/ielts-prep/practice" element={<IeltsPractice />} />
                  <Route path="/ielts-prep/practice-tests" element={<IeltsPracticeTests />} />
                  <Route path="/ielts-prep/analytics" element={<IeltsAnalytics />} />
                  <Route path="/ielts-prep/score" element={<IeltsBandCalc />} />
                  <Route path="/ielts-prep/diagnostic" element={<IeltsDiagnostic />} />
                  <Route path="/diagnostic" element={<Diagnostic />} />
                  <Route path="/diagnostic/results/:id" element={<DiagnosticResult />} />
                  <Route path="/mock" element={<MockExams />} />
                  <Route path="/mock/practice/:runId" element={<PracticeTestResult />} />
                  <Route path="/practice" element={<QuestionBank />} />
                  <Route path="/practice/:sec" element={<BankSection />} />
                  <Route path="/mistakes" element={<Mistakes />} />
                  <Route path="/analytics" element={<StudentAnalytics />} />
                  <Route path="/vocab" element={<Vocab />} />
                  <Route path="/plan" element={<StudyPlan />} />
                  <Route path="/score" element={<ScoreCalc />} />
                  <Route path="/nova" element={<Coach />} />
                  <Route path="/coach" element={<Navigate to="/nova" replace />} />
                  <Route path="/trophies" element={<Trophies />} />
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/sky" element={<Sky />} />
                  <Route path="/daily" element={<Daily />} />
                  <Route path="/leagues" element={<Leagues />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/class" element={<Classroom />} />
                  <Route path="/gap" element={<PointGap />} />
                  <Route path="/recap" element={<Recap />} />
                </Route>
                {/* The practice player is full screen, like the exam. */}
                <Route
                  path="/practice/solve"
                  element={
                    <RequireStudent>
                      <Player />
                    </RequireStudent>
                  }
                />
                <Route
                  path="/diagnostic/test/:id"
                  element={
                    <RequireStudent>
                      <DiagnosticTest />
                    </RequireStudent>
                  }
                />
                {/* A practice test: the page between its modules, and a module. Full screen too. */}
                <Route
                  path="/practice-test/:runId"
                  element={
                    <RequireStudent>
                      <PracticeTestRun />
                    </RequireStudent>
                  }
                />
                <Route
                  path="/practice-test/:runId/:module"
                  element={
                    <RequireStudent>
                      <PracticeTestModule />
                    </RequireStudent>
                  }
                />
                <Route
                  path="/results/:sessionId"
                  element={
                    <RequireStudent>
                      <StudentResultView />
                    </RequireStudent>
                  }
                />
                <Route
                  path="/exam/:sessionId"
                  element={
                    <RequireStudent>
                      <ExamRunner />
                    </RequireStudent>
                  }
                />
                <Route
                  path="/exam/:sessionId/module/:moduleId"
                  element={
                    <RequireStudent>
                      <ExamModule />
                    </RequireStudent>
                  }
                />
                <Route
                  path="/exam/:sessionId/complete"
                  element={
                    <RequireStudent>
                      <ExamComplete />
                    </RequireStudent>
                  }
                />

                {ArtGallery && <Route path="/dev/art" element={<ArtGallery />} />}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
              </ProgressProvider>
            </StudentAuthProvider>
          </AdminAuthProvider>
        </ErrorBoundary>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
