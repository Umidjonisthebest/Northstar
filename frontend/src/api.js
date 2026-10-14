const BASE = "/api";

// A 401 means the token itself is invalid or expired (not just "not allowed
// for this resource"), so the stored session is dead — clear it and send the
// user back to the right login instead of leaving the app stuck retrying
// with a token that will never work again.
function handleExpiredToken(token) {
  if (!token) return;
  if (localStorage.getItem("student_token") === token) {
    localStorage.removeItem("student_token");
    localStorage.removeItem("student_user");
    if (!/^\/(admin|teacher)(\/|$)/.test(location.pathname)) location.href = "/login";
  } else if (localStorage.getItem("admin_token") === token) {
    // The staff session (admin or teacher): both sign in on the teacher sign-in page.
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    location.href = "/teacher/login";
  }
}

// `keepalive` lets a save finish while the page is being hidden or closed.
// Errors carry the HTTP status and the server's `code` (e.g. TIME_UP).
async function request(path, { method = "GET", body, token, keepalive = false } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      keepalive,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    // The browser's own message is "Failed to fetch" (or "Load failed"): say what it means.
    const err = new Error("Can't reach the server. Check your connection and try again.");
    err.status = 0;
    err.code = "NETWORK";
    throw err;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (res.status === 401) handleExpiredToken(token);
  // A temporary password only works for choosing a new one: send the student there.
  if (res.status === 403 && data?.code === "PASSWORD_CHANGE_REQUIRED" && token && localStorage.getItem("student_token") === token) {
    try {
      const u = JSON.parse(localStorage.getItem("student_user") || "{}");
      localStorage.setItem("student_user", JSON.stringify({ ...u, mustChangePassword: true }));
    } catch {
      // the screen asks the server again
    }
    if (location.pathname !== "/change-password") location.href = "/change-password";
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
}

// ---- Staff sign-in: one page for the admin and for teachers ----
// The answer's user.role ("admin" | "teacher") says which panel the account opens.
export const staffLogin = (email, password) => request("/auth/staff/login", { method: "POST", body: { email, password } });
// { current, next } -> { token, user }: the new token replaces the one in use.
export const staffChangePassword = (token, body) => request("/auth/staff/password", { method: "POST", body, token });

// ---- Teacher accounts (admin panel) ----
export const adminTeachers = (token) => request("/admin/teachers", { token });
// Both answer with { tempPassword }: shown once, to hand to the teacher.
export const adminCreateTeacher = (token, body) => request("/admin/teachers", { method: "POST", body, token });
export const adminResetTeacherPassword = (token, id) => request(`/admin/teachers/${id}/reset-password`, { method: "POST", token });
export const adminUpdateTeacher = (token, id, body) => request(`/admin/teachers/${id}`, { method: "PUT", body, token });
export const adminDeleteTeacher = (token, id) => request(`/admin/teachers/${id}`, { method: "DELETE", token });

// ---- Cover page (public) + its success stories (admin) ----
export const publicOverview = () => request("/public/overview");
export const adminStories = (token) => request("/admin/stories", { token });
export const adminCreateStory = (token, body) => request("/admin/stories", { method: "POST", body, token });
export const adminUpdateStory = (token, id, body) => request(`/admin/stories/${id}`, { method: "PUT", body, token });
export const adminDeleteStory = (token, id) => request(`/admin/stories/${id}`, { method: "DELETE", token });

// ---- Tests ----
export const listTests = (token) => request("/tests", { token });
export const createTest = (token, body) => request("/tests", { method: "POST", body, token });
export const getTest = (token, id) => request(`/tests/${id}`, { token });
export const updateTest = (token, id, body) => request(`/tests/${id}`, { method: "PUT", body, token });
export const deleteTest = (token, id) => request(`/tests/${id}`, { method: "DELETE", token });
export const updateModule = (token, testId, moduleId, body) =>
  request(`/tests/${testId}/modules/${moduleId}`, { method: "PUT", body, token });
export const addQuestion = (token, testId, moduleId, body) =>
  request(`/tests/${testId}/modules/${moduleId}/questions`, { method: "POST", body, token });
export const updateQuestion = (token, testId, moduleId, questionId, body) =>
  request(`/tests/${testId}/modules/${moduleId}/questions/${questionId}`, { method: "PUT", body, token });
export const deleteQuestion = (token, testId, moduleId, questionId) =>
  request(`/tests/${testId}/modules/${moduleId}/questions/${questionId}`, { method: "DELETE", token });

// The test editor works on either kind of SAT test the studio builds, through one of these: the
// teacher mocks above (run as a session), or the practice tests students sit alone (below).
const testApi = (base) => ({
  get: (token, id) => request(`${base}/${id}`, { token }),
  create: (token, body) => request(base, { method: "POST", body, token }),
  update: (token, id, body) => request(`${base}/${id}`, { method: "PUT", body, token }),
  remove: (token, id) => request(`${base}/${id}`, { method: "DELETE", token }),
  updateModule: (token, testId, moduleId, body) => request(`${base}/${testId}/modules/${moduleId}`, { method: "PUT", body, token }),
  addQuestion: (token, testId, moduleId, body) => request(`${base}/${testId}/modules/${moduleId}/questions`, { method: "POST", body, token }),
  updateQuestion: (token, testId, moduleId, questionId, body) => request(`${base}/${testId}/modules/${moduleId}/questions/${questionId}`, { method: "PUT", body, token }),
  deleteQuestion: (token, testId, moduleId, questionId) => request(`${base}/${testId}/modules/${moduleId}/questions/${questionId}`, { method: "DELETE", token })
});
export const mockTestApi = testApi("/tests");
export const satPracticeApi = testApi("/admin/sat-tests");

// ---- SAT practice tests in the staff panels (backend routes/adminSatTestRoutes.js) ----
// { canEdit, tests (made in the studio), builtIn (the ten that came as files), mocks (to copy from) }
export const adminSatTests = (token) => request("/admin/sat-tests", { token });
export const adminSatTestFromMock = (token, mockId) => request(`/admin/sat-tests/from-mock/${mockId}`, { method: "POST", token });
// A draft is the admin's until it is published; a published test is on every student's list.
export const adminPublishSatTest = (token, id, published) => request(`/admin/sat-tests/${id}/publish`, { method: "PUT", body: { published }, token });
export const adminHideBuiltInSatTest = (token, key, hidden) => request(`/admin/sat-tests/built-in/${key}`, { method: "PUT", body: { hidden }, token });
// Students' finished sittings (a teacher gets their class students'), and one of them question by question.
export const adminSatTestResults = (token) => request("/admin/sat-tests/results", { token });
export const adminSatTestResult = (token, runId) => request(`/admin/sat-tests/results/${runId}`, { token });

// ---- Sessions ----
export const listSessions = (token) => request("/sessions", { token });
export const createSession = (token, body) => request("/sessions", { method: "POST", body, token });
export const getSession = (token, id) => request(`/sessions/${id}`, { token });
export const startSession = (token, id) => request(`/sessions/${id}/start`, { method: "POST", token });
export const addParticipant = (token, sessionId, body) =>
  request(`/sessions/${sessionId}/participants`, { method: "POST", body, token });
export const removeParticipant = (token, sessionId, participantId) =>
  request(`/sessions/${sessionId}/participants/${participantId}`, { method: "DELETE", token });
export const getParticipantResult = (token, sessionId, participantId) =>
  request(`/sessions/${sessionId}/participants/${participantId}`, { token });
// Lets a student back into a sitting that was cancelled for leaving the test page.
export const reinstateParticipant = (token, sessionId, participantId) =>
  request(`/sessions/${sessionId}/participants/${participantId}/reinstate`, { method: "POST", token });

// ---- Users ----
export const searchUsers = (token, q) => request(`/users/search?q=${encodeURIComponent(q || "")}`, { token });

// ---- Student account ----
export const studentRegister = (body) => request("/student/register", { method: "POST", body });
export const studentLogin = (email, password) => request("/student/login", { method: "POST", body: { email, password } });
export const forgotPassword = (email) => request("/student/forgot-password", { method: "POST", body: { email } });
export const resetPassword = (body) => request("/student/reset-password", { method: "POST", body });
export const changePassword = (token, body) => request("/student/change-password", { method: "POST", body, token });
export const studentMe = (token) => request("/student/me", { token });
// avatar: { id, accessory, frame } or null for initials. Returns the updated user.
export const updateAvatar = (token, avatar) => request("/student/avatar", { method: "PUT", body: { avatar }, token });
export const studentHistory = (token) => request("/student/history", { token });
export const studentSessionResults = (token, sessionId) => request(`/student/sessions/${sessionId}/results`, { token });
// Rewards earned in a mock exam are only shown on its results page; this records that they were.
export const markExamRewardsSeen = (token, sessionId) => request(`/student/sessions/${sessionId}/rewards/seen`, { method: "POST", token });

// ---- Student exam (session-scoped) ----
export const examOverview = (token, sessionId) => request(`/exam/session/${sessionId}/overview`, { token });
export const getModule = (token, sessionId, moduleId) => request(`/exam/session/${sessionId}/modules/${moduleId}`, { token });
// `timestamps` is { questionId: { seen, answered } } in seconds from the module's start (for the ghost run).
// Autosave while the module is open. The server keeps these, and a hand-in after time is graded on them.
export const saveModuleAnswers = (token, sessionId, moduleId, answers, keepalive = false) =>
  request(`/exam/session/${sessionId}/modules/${moduleId}/answers`, { method: "PUT", body: { answers }, token, keepalive });
export const submitModule = (token, sessionId, moduleId, answers, timestamps = {}) =>
  request(`/exam/session/${sessionId}/modules/${moduleId}/submit`, { method: "POST", body: { answers, timestamps }, token });
// The student left a running module (another tab or window, the page closed): the sitting is
// cancelled. `round` is the module's `lockRound` (see frontend/src/lock/).
export const leaveExam = (token, sessionId, kind, round) =>
  request(`/exam/session/${sessionId}/leave`, { method: "POST", body: { kind, round }, token, keepalive: true });

// ---- Practice hub (student) ----
export const practiceQuestions = (token, params = {}) => {
  const entries = Object.entries(params)
    .map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v])
    .filter(([, v]) => v !== undefined && v !== "");
  return request(`/practice/questions?${new URLSearchParams(entries)}`, { token });
};
export const practiceDomains = (token) => request("/practice/domains", { token });
export const practiceMeta = (token) => request("/practice/meta", { token });
export const practiceBank = (token) => request("/practice/bank", { token });
export const practiceSkillTable = (token, sec, params = {}) => {
  const entries = Object.entries(params)
    .map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v])
    .filter(([, v]) => v !== undefined && v !== "" && v !== null);
  return request(`/practice/bank/${sec}/skills?${new URLSearchParams(entries)}`, { token });
};
export const practiceAnalytics = (token) => request("/practice/analytics", { token });
export const studySessions = (token, limit = 30) => request(`/practice/sessions?limit=${limit}`, { token });
// extra: { timeMs, retry } — retry marks a second try in the same sitting.
export const answerPractice = (token, id, answer, inDrill = false, extra = {}) =>
  request(`/practice/questions/${id}/answer`, { method: "POST", body: { answer, inDrill, ...extra }, token });
export const practiceExplanation = (token, id) => request(`/practice/questions/${id}/explanation`, { token });
export const savePracticeNote = (token, id, text) => request(`/practice/questions/${id}/note`, { method: "POST", body: { text }, token });
export const reportPracticeQuestion = (token, id, body) => request(`/practice/questions/${id}/report`, { method: "POST", body, token });
export const remixPractice = (token, questionId) => request("/practice/remix", { method: "POST", body: { questionId }, token });
export const answerRemix = (token, id, answer, retry = false) =>
  request(`/practice/remix/${encodeURIComponent(id)}/answer`, { method: "POST", body: { answer, retry }, token });
export const remixExplanation = (token, id) => request(`/practice/remix/${encodeURIComponent(id)}/explanation`, { token });

// Nova replies stream as server-sent events: meta, delta*, then done (or error).
export async function tutorStream(token, body, { onMeta, onDelta, onDone, onError, signal } = {}) {
  const res = await fetch(`${BASE}/practice/tutor`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal
  });
  if (res.status === 401) handleExpiredToken(token);
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  const handlers = { meta: onMeta, delta: onDelta, done: onDone, error: onError };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const event = /^event: (\w+)/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (event && data) handlers[event]?.(JSON.parse(data));
    }
  }
}
export const toggleSavePractice = (token, id) => request(`/practice/questions/${id}/save`, { method: "POST", token });
export const toggleFlagPractice = (token, id) => request(`/practice/questions/${id}/flag`, { method: "POST", token });
export const getExamMistakes = (token) => request("/practice/mistakes/exam", { token });
export const clearExamMistake = (token, key) => request(`/practice/mistakes/exam/${encodeURIComponent(key)}/clear`, { method: "POST", token });
// Why the student missed a question: one of the ids in practiceMeta().mistakeReasons, or null to take it back.
export const setMistakeReason = (token, id, reason) => request(`/practice/questions/${id}/reason`, { method: "POST", body: { reason }, token });
export const setExamMistakeReason = (token, key, reason) => request(`/practice/mistakes/exam/${encodeURIComponent(key)}/reason`, { method: "POST", body: { reason }, token });
// Spaced review (what is due and what is coming) and the trap profile.
export const getReview = (token) => request("/practice/review", { token });
export const getTraps = (token) => request("/practice/traps", { token });
export const buildDrill = (token, body) => request("/practice/drill", { method: "POST", body, token });
// The server works the bonus out from the answers it graded since the drill was built.
export const completeDrill = (token) => request("/practice/drill/complete", { method: "POST", token });
export const getVocab = (token) => request("/practice/vocab", { token });
export const rateVocab = (token, id, rating) => request(`/practice/vocab/${id}/rate`, { method: "POST", body: { rating }, token });
// Learn mode and Match: what the student picked, for the server to mark. `body` is
// { mode: "learn" | "match", answers: [{ id, kind, pick }], seconds? }.
export const sendVocabAnswers = (token, body) => request("/practice/vocab/answers", { method: "POST", body, token });
export const getProgress = (token) => request("/practice/progress", { token });
// Streaks: the repair drill for a missed day, and the welcome-back gift. The
// server decides whether either is available; these only ask.
export const startRepair = (token) => request("/practice/repair/start", { method: "POST", token });
export const claimWelcomeBack = (token) => request("/practice/welcome-back", { method: "POST", token });
export const ackWelcomeBack = (token) => request("/practice/welcome-back/seen", { method: "POST", token });
export const updateSettings = (token, body) => request("/practice/settings", { method: "PUT", body, token });
// Comet chunks: how they are earned and spent plus the recent ins and outs, and buying from the shop.
export const getShop = (token) => request("/practice/shop", { token });
export const buyShopItem = (token, id) => request("/practice/shop/buy", { method: "POST", body: { id }, token });

// ---- Daily Northstar question: one shared question a day, one attempt ----
export const getDaily = (token) => request("/daily", { token });
export const answerDaily = (token, answer, timeMs = 0) => request("/daily/answer", { method: "POST", body: { answer, timeMs }, token });
export const dailyCatalog = (token) => request("/daily/catalog", { token });
// "Studying now": the hub's heartbeat. The reply is an anonymous count.
export const presencePing = (token) => request("/presence/ping", { method: "POST", token });

// ---- Planning: the plan back from the SAT date, and the point-gap map ----
export const getRoadmap = (token) => request("/practice/roadmap", { token });
export const getGapMap = (token) => request("/practice/gap-map", { token });
export const getSkillSky = (token) => request("/practice/skill-sky", { token });

// ---- Monthly recaps: one per completed month, with a share image ----
export const getRecaps = (token) => request("/recaps", { token });
export const markRecapSeen = (token) => request("/recaps/seen", { method: "POST", token });
// The share image for a month, as SVG text (the page previews it and can save it as a PNG).
export async function recapImage(token, month) {
  const res = await fetch(`${BASE}/recaps/${month}/image.svg`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) handleExpiredToken(token);
  if (!res.ok) throw new Error("Couldn't load the share image");
  return res.text();
}

// ---- Weekly leagues: the student's tier and their group's table for the week ----
export const getLeague = (token) => request("/leagues/me", { token });
export const adminLeagues = (token) => request("/admin/leagues", { token });

// ---- Diagnostic test (SAT): a timed placement test of unseen questions ----
export const diagnosticOverview = (token) => request("/diagnostic", { token });
export const startDiagnostic = (token) => request("/diagnostic/start", { method: "POST", token });
export const getDiagnostic = (token, id) => request(`/diagnostic/${id}`, { token });
export const saveDiagnostic = (token, id, body, keepalive = false) => request(`/diagnostic/${id}/answers`, { method: "PUT", body, token, keepalive });
export const submitDiagnostic = (token, id, body) => request(`/diagnostic/${id}/submit`, { method: "POST", body, token });
// The student left the running diagnostic: it is cancelled, with no score.
export const leaveDiagnostic = (token, id, kind) => request(`/diagnostic/${id}/leave`, { method: "POST", body: { kind }, token, keepalive: true });

// ---- SAT practice tests: full-length tests a student sits alone (the whole test or one section, timed or not) ----
export const practiceTests = (token) => request("/practice-tests", { token });
// { scope: "full" | "rw" | "math", timed: true | false }
export const startPracticeTest = (token, test, body) => request(`/practice-tests/${test}/start`, { method: "POST", body, token });
export const practiceTestRun = (token, runId) => request(`/practice-tests/runs/${runId}`, { token });
// Opening a module for the first time starts its clock.
export const practiceTestModule = (token, runId, module) => request(`/practice-tests/runs/${runId}/modules/${module}`, { token });
export const savePracticeTestModule = (token, runId, module, body, keepalive = false) =>
  request(`/practice-tests/runs/${runId}/modules/${module}/answers`, { method: "PUT", body, token, keepalive });
export const submitPracticeTestModule = (token, runId, module, body) => request(`/practice-tests/runs/${runId}/modules/${module}/submit`, { method: "POST", body, token });
// The module's screen saw the student leave it (lock/useExamLock.js): the sitting is cancelled.
export const leavePracticeTestRun = (token, runId, module, kind) =>
  request(`/practice-tests/runs/${runId}/leave`, { method: "POST", body: { module, kind }, token, keepalive: true });
// Ends a sitting before its last module: what was handed in is kept and marked.
export const endPracticeTestRun = (token, runId) => request(`/practice-tests/runs/${runId}/end`, { method: "POST", token });
export const practiceTestResults = (token, runId) => request(`/practice-tests/runs/${runId}/results`, { token });
export const markPracticeTestRewardSeen = (token, runId) => request(`/practice-tests/runs/${runId}/rewards/seen`, { method: "POST", token });

// ---- Practice hub (admin) ----
export const adminPracticeDomains = (token) => request("/admin/practice/domains", { token });
export const adminPracticeStats = (token) => request("/admin/practice/stats", { token });
export const adminPracticeList = (token) => request("/admin/practice/questions", { token });
export const adminPracticeCreate = (token, body) => request("/admin/practice/questions", { method: "POST", body, token });
export const adminPracticeUpdate = (token, id, body) => request(`/admin/practice/questions/${id}`, { method: "PUT", body, token });
export const adminPracticeDelete = (token, id) => request(`/admin/practice/questions/${id}`, { method: "DELETE", token });
export const adminPracticeImport = (token, questions) => request("/admin/practice/questions/import", { method: "POST", body: questions, token });
export const adminPracticeReports = (token) => request("/admin/practice/reports", { token });
export const adminResolvePracticeReport = (token, id) => request(`/admin/practice/reports/${id}`, { method: "DELETE", token });
export const adminVocabList = (token) => request("/admin/practice/vocab", { token });
export const adminVocabCreate = (token, body) => request("/admin/practice/vocab", { method: "POST", body, token });
export const adminVocabUpdate = (token, id, body) => request(`/admin/practice/vocab/${id}`, { method: "PUT", body, token });
export const adminVocabDelete = (token, id) => request(`/admin/practice/vocab/${id}`, { method: "DELETE", token });

// ---- Admin studio ----
export const adminOverview = (token) => request("/admin/overview", { token });
export const adminStudents = (token, q = "") => request(`/admin/students?q=${encodeURIComponent(q)}`, { token });
export const adminStudent = (token, id) => request(`/admin/students/${id}`, { token });
export const adminUpdateStudent = (token, id, body) => request(`/admin/students/${id}`, { method: "PUT", body, token });
export const adminResetPassword = (token, id) => request(`/admin/students/${id}/reset-password`, { method: "POST", token });
export const adminAnalytics = (token) => request("/admin/analytics", { token });
export const adminAnnouncements = (token) => request("/admin/announcements", { token });
export const adminCreateAnnouncement = (token, body) => request("/admin/announcements", { method: "POST", body, token });
export const adminPinAnnouncement = (token, id, pinned) => request(`/admin/announcements/${id}`, { method: "PUT", body: { pinned }, token });
export const adminDeleteAnnouncement = (token, id) => request(`/admin/announcements/${id}`, { method: "DELETE", token });
export const adminDuplicateTest = (token, id) => request(`/admin/tests/${id}/duplicate`, { method: "POST", token });
export async function adminDownloadSessionCsv(token, id, filename = "results.csv") {
  const res = await fetch(`${BASE}/admin/sessions/${id}/export.csv`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const studentAnnouncements = (token) => request("/practice/announcements", { token });

// ---- Messages between a student and the developers ----
export const getMessages = (token) => request("/messages", { token });
export const sendMessage = (token, body, topic) => request("/messages", { method: "POST", body: { body, topic }, token });
export const markMessagesRead = (token) => request("/messages/read", { method: "POST", token });
// The studio's side: every conversation, one student's, a reply, and clearing up.
export const adminConversations = (token) => request("/admin/messages", { token });
export const adminMessagesWaiting = (token) => request("/admin/messages/waiting", { token });
export const adminConversation = (token, userId) => request(`/admin/messages/${userId}`, { token });
export const adminReply = (token, userId, body) => request(`/admin/messages/${userId}`, { method: "POST", body: { body }, token });
export const adminMarkConversationRead = (token, userId) => request(`/admin/messages/${userId}/read`, { method: "POST", token });
export const adminDeleteConversation = (token, userId) => request(`/admin/messages/${userId}`, { method: "DELETE", token });

// ---- Classes: made and named by teachers, joined with a class code ----
// The class page (or, outside a class, what the "join your class" screen needs).
export const getClass = (token) => request("/class", { token });
// Join a class or move to another with its class code: { code }. Leave, or "I don't have a
// class": { leave: true }.
export const setClassMembership = (token, body) => request("/class/membership", { method: "PUT", body, token });
export const getClassmates = (token) => request("/class/classmates", { token });
export const getClassmate = (token, id) => request(`/class/classmates/${id}`, { token });
export const cheerClassmate = (token, id) => request(`/class/classmates/${id}/cheer`, { method: "POST", token });
export const getClassHomework = (token) => request("/class/homework", { token });
// The homework page tells the teacher when the student leaves it: { event: "left" } or { event: "back", seconds }.
export const homeworkLeave = (token, id, body) => request(`/class/homework/${id}/leave`, { method: "POST", body, token, keepalive: true });
// Chat rooms are named from the student's side: "class", or "dm-<classmate id>".
export const getClassRooms = (token) => request("/class/chat", { token });
export const getClassRoom = (token, room, before) => request(`/class/chat/${room}${before ? `?before=${encodeURIComponent(before)}` : ""}`, { token });
// extra: { questionId } shares a bank question, { replyTo } answers a message.
export const sendClassMessage = (token, room, body, extra = {}) => request(`/class/chat/${room}`, { method: "POST", body: { body, ...extra }, token });
export const markClassRoomRead = (token, room) => request(`/class/chat/${room}/read`, { method: "POST", token });
export const deleteClassMessage = (token, id) => request(`/class/chat/messages/${id}`, { method: "DELETE", token });
export const reportClassMessage = (token, id, reason) => request(`/class/chat/messages/${id}/report`, { method: "POST", body: { reason }, token });
// The studio's side: making a class, every class, one class, reported messages, and homework.
export const adminClasses = (token) => request("/admin/classes", { token });
export const adminClass = (token, id) => request(`/admin/classes/${id}`, { token });
// A teacher makes a class and names it; it comes back with its class code.
export const adminCreateClass = (token, name) => request("/admin/classes", { method: "POST", body: { name }, token });
export const adminRenameClass = (token, id, name) => request(`/admin/classes/${id}`, { method: "PUT", body: { name }, token });
// Deleting a class takes its students out of it, and its chat and class-only homework go too.
export const adminDeleteClass = (token, id) => request(`/admin/classes/${id}`, { method: "DELETE", token });
// A new class code for a class; the old one stops working.
export const adminRenewClassCode = (token, id) => request(`/admin/classes/${id}/code`, { method: "POST", token });
export const adminClassesWaiting = (token) => request("/admin/classes/waiting", { token });
export const adminClassReports = (token) => request("/admin/classes/reports", { token });
export const adminDismissClassReport = (token, messageId) => request(`/admin/classes/reports/${messageId}/dismiss`, { method: "POST", token });
export const adminRemoveClassMessage = (token, id) => request(`/admin/classes/messages/${id}`, { method: "DELETE", token });
export const adminHomework = (token) => request("/admin/homework", { token });
export const adminHomeworkDetail = (token, id) => request(`/admin/homework/${id}`, { token });
export const adminDrawHomework = (token, body) => request("/admin/homework/draw", { method: "POST", body, token });
export const adminCreateHomework = (token, body) => request("/admin/homework", { method: "POST", body, token });
export const adminDeleteHomework = (token, id) => request(`/admin/homework/${id}`, { method: "DELETE", token });

// ---- IELTS (student hub; the exam itself lives in ielts/) ----
export const ieltsStudentSessions = (token) => request("/ielts/student/sessions", { token });
export const ieltsEnterSession = (token, id) => request(`/ielts/student/sessions/${id}/enter`, { method: "POST", token });
// Self-study practice (single listening parts, reading passages, writing tasks)
export const ieltsPractice = (token) => request("/ielts/student/practice", { token });
export const ieltsPracticeItem = (token, kind, id) => request(`/ielts/student/practice/${kind}/${id}`, { token });
export const ieltsPracticeSubmit = (token, kind, id, body) => request(`/ielts/student/practice/${kind}/${id}/submit`, { method: "POST", body, token });

// Whole IELTS practice tests, taken a section at a time (backend ielts/routes/testRoutes.js).
export const ieltsTests = (token) => request("/ielts/student/tests", { token });
export const ieltsTestSection = (token, testId, kind) => request(`/ielts/student/tests/${testId}/${kind}`, { token });
export const ieltsTestSubmit = (token, testId, kind, body) => request(`/ielts/student/tests/${testId}/${kind}/submit`, { method: "POST", body, token });
export const ieltsTestAttempt = (token, attemptId) => request(`/ielts/student/tests/attempts/${attemptId}`, { token });
// The student's own IELTS numbers, and the raw-score tables for the band calculator.
export const ieltsAnalytics = (token) => request("/ielts/student/analytics", { token });
export const ieltsBands = (token) => request("/ielts/student/bands", { token });
// Diagnostic test: one random listening part or reading passage the student hasn't tried
export const ieltsDiagnosticOverview = (token) => request("/ielts/student/diagnostic", { token });
export const ieltsStartDiagnostic = (token) => request("/ielts/student/diagnostic/start", { method: "POST", token });
export const ieltsGetDiagnostic = (token, id) => request(`/ielts/student/diagnostic/${id}`, { token });
export const ieltsBeginDiagnostic = (token, id) => request(`/ielts/student/diagnostic/${id}/begin`, { method: "POST", token });
export const ieltsSaveDiagnostic = (token, id, body, keepalive = false) =>
  request(`/ielts/student/diagnostic/${id}/answers`, { method: "PUT", body, token, keepalive });
export const ieltsSubmitDiagnostic = (token, id, body) => request(`/ielts/student/diagnostic/${id}/submit`, { method: "POST", body, token });
export const ieltsLeaveDiagnostic = (token, id, kind) => request(`/ielts/student/diagnostic/${id}/leave`, { method: "POST", body: { kind }, token, keepalive: true });
