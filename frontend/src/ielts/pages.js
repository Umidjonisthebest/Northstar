import { lazy } from "react";

// IELTS screens load on demand, so Northstar's own bundle does not grow and the
// admin screens (Quill, Recharts) never reach exam-room computers.
export const IeltsScope = lazy(() => import("./IeltsScope.jsx"));
export const CandidateLogin = lazy(() => import("./exam/CandidateLogin.jsx"));
export const ExamFlow = lazy(() => import("./exam/ExamFlow.jsx"));
export const PracticeRunner = lazy(() => import("./exam/PracticeRunner.jsx"));
export const TestRunner = lazy(() => import("./exam/TestRunner.jsx"));
export const DiagnosticRunner = lazy(() => import("./exam/DiagnosticRunner.jsx"));
export const ContentList = lazy(() => import("./admin/ContentList.jsx"));
export const ListeningEditor = lazy(() => import("./admin/ListeningEditor.jsx"));
export const ReadingEditor = lazy(() => import("./admin/ReadingEditor.jsx"));
export const WritingEditor = lazy(() => import("./admin/WritingEditor.jsx"));
export const PreviewPage = lazy(() => import("./admin/PreviewPage.jsx"));
export const PracticeTestsPage = lazy(() => import("./admin/PracticeTestsPage.jsx"));
export const PracticeTestBuilder = lazy(() => import("./admin/PracticeTestBuilder.jsx"));
export const SectionPracticePage = lazy(() => import("./admin/SectionPracticePage.jsx"));
export const SessionsPage = lazy(() => import("./admin/SessionsPage.jsx"));
export const SessionDetailPage = lazy(() => import("./admin/SessionDetailPage.jsx"));
export const UsersPage = lazy(() => import("./admin/UsersPage.jsx"));
export const UserDashboardPage = lazy(() => import("./admin/UserDashboardPage.jsx"));
