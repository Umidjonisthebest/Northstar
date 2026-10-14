import { IELTS_HOME } from "./paths.js";

const BASE = "/api/ielts";

// Staff (the admin or a teacher) sign in on Northstar's teacher sign-in page (see context/AuthContext.jsx).
const ADMIN_TOKEN_KEY = "admin_token";
const ADMIN_USER_KEY = "admin_user";
export const CANDIDATE_TOKEN_KEY = "ielts_candidate_token";
// {id, candidateId, firstName, lastName, session, returnTo?} — returnTo is set when the
// exam was opened from the Northstar student hub, so the candidate goes back there.
export const CANDIDATE_INFO_KEY = "ielts_candidate_info";

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const adminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY);
export const candidateToken = () => localStorage.getItem(CANDIDATE_TOKEN_KEY);

export function startCandidateSession({ token, candidate, session }, returnTo = null) {
  localStorage.setItem(CANDIDATE_TOKEN_KEY, token);
  localStorage.setItem(CANDIDATE_INFO_KEY, JSON.stringify({ ...candidate, session, returnTo }));
}

export function candidateInfo() {
  try {
    return JSON.parse(localStorage.getItem(CANDIDATE_INFO_KEY) || "null");
  } catch {
    return null;
  }
}

export function clearCandidateSession() {
  localStorage.removeItem(CANDIDATE_TOKEN_KEY);
  localStorage.removeItem(CANDIDATE_INFO_KEY);
}

// A 401 means the stored token is dead: drop it and send the user to the right login.
function handleUnauthorized(kind) {
  if (kind === "admin") {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    if (!location.pathname.startsWith("/teacher/login")) location.href = "/teacher/login";
  } else if (kind === "candidate") {
    const returnTo = candidateInfo()?.returnTo;
    clearCandidateSession();
    const target = returnTo || IELTS_HOME;
    if (location.pathname !== target) location.href = target;
  }
}

async function request(path, { method = "GET", body, auth = null, keepalive = false } = {}) {
  const token = auth === "admin" ? adminToken() : auth === "candidate" ? candidateToken() : null;
  const init = { method, keepalive, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } };
  if (body !== undefined) init.body = JSON.stringify(body);
  let res;
  try {
    res = await fetch(BASE + path, init);
  } catch {
    throw new ApiError("Network error — please check your connection and try again.", 0, "NETWORK");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401 && auth) handleUnauthorized(auth);
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.code);
  return data;
}

const qs = (params) => {
  const entries = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return entries.length ? `?${new URLSearchParams(entries)}` : "";
};

// ---------- Content (listening / reading / writing) ----------
// `scope` is where the material is used: "practice" (section practice) or "mock" (teacher mocks).
export const listContent = (kind, q, scope) => request(`/admin/content/${kind}${qs({ q, scope })}`, { auth: "admin" });
export const getContent = (kind, id) => request(`/admin/content/${kind}/${id}`, { auth: "admin" });
export const saveContent = (kind, body) => request(`/admin/content/${kind}/save`, { method: "POST", body, auth: "admin" });
export const setContentActive = (kind, id, active) => request(`/admin/content/${kind}/${id}`, { method: "PATCH", body: { active }, auth: "admin" });
export const setContentUse = (kind, id, use) => request(`/admin/content/${kind}/${id}`, { method: "PATCH", body: { use }, auth: "admin" });
export const deleteContent = (kind, id) => request(`/admin/content/${kind}/${id}`, { method: "DELETE", auth: "admin" });
export const previewContent = (kind, id) => request(`/admin/content/${kind}/${id}/preview`, { auth: "admin" });
export const listSources = () => request("/admin/content/sources", { auth: "admin" });
export const listReadingTitles = () => request("/admin/content/reading-titles", { auth: "admin" });

// ---------- Practice tests (whole tests students take alone; a test owns its parts) ----------
// { canEdit, tests, library }: `library` is what can be copied into a test (admin only).
export const listPracticeTests = () => request("/admin/tests", { auth: "admin" });
export const getPracticeTest = (id) => request(`/admin/tests/${id}`, { auth: "admin" });
// A new test is a title: { title, description, level }. Its parts are added on its own page.
export const createPracticeTest = (body) => request("/admin/tests", { method: "POST", body, auth: "admin" });
export const updatePracticeTest = (id, body) => request(`/admin/tests/${id}`, { method: "PUT", body, auth: "admin" });
export const setPracticeTestActive = (id, active) => request(`/admin/tests/${id}`, { method: "PATCH", body: { active }, auth: "admin" });
export const deletePracticeTest = (id) => request(`/admin/tests/${id}`, { method: "DELETE", auth: "admin" });
// Copies a section-practice or mock part into the test (the copy is the test's own), and takes a part out.
export const copyPartIntoTest = (id, kind, from) => request(`/admin/tests/${id}/parts`, { method: "POST", body: { kind, from }, auth: "admin" });
export const removeTestPart = (id, kind, partId) => request(`/admin/tests/${id}/parts/${kind}/${partId}`, { method: "DELETE", auth: "admin" });
// Students' finished sections (a teacher gets their class students'), and one of them answer by answer.
export const listTestResults = () => request("/admin/tests/results", { auth: "admin" });
export const getTestResult = (attemptId) => request(`/admin/tests/results/${attemptId}`, { auth: "admin" });

// Multipart upload with progress (fetch can't report upload progress).
export function uploadFile(kind, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/admin/content/uploads/${kind}`);
    const token = adminToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status === 401) handleUnauthorized("admin");
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(data?.error || `Upload failed (${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Upload failed — network error", 0, "NETWORK"));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

// ---------- Sessions ----------
export const listSessions = (params) => request(`/admin/sessions${qs(params)}`, { auth: "admin" });
export const createSession = (body) => request("/admin/sessions", { method: "POST", body, auth: "admin" });
export const updateSession = (id, body) => request(`/admin/sessions/${id}`, { method: "PUT", body, auth: "admin" });
export const deleteSession = (id) => request(`/admin/sessions/${id}`, { method: "DELETE", auth: "admin" });
export const setSessionStatus = (id, status) => request(`/admin/sessions/${id}/status`, { method: "POST", body: { status }, auth: "admin" });
export const getSession = (id) => request(`/admin/sessions/${id}`, { auth: "admin" });
export const availableUsers = (id, params) => request(`/admin/sessions/${id}/available-users${qs(params)}`, { auth: "admin" });
export const addParticipant = (id, userId) => request(`/admin/sessions/${id}/participants`, { method: "POST", body: { userId }, auth: "admin" });
export const createParticipant = (id, body) => request(`/admin/sessions/${id}/participants/new`, { method: "POST", body, auth: "admin" });
export const removeParticipant = (id, userId) => request(`/admin/sessions/${id}/participants/${userId}`, { method: "DELETE", auth: "admin" });
export const getParticipant = (id, userId) => request(`/admin/sessions/${id}/participants/${userId}`, { auth: "admin" });
export const getParticipantResults = (id, userId) => request(`/admin/sessions/${id}/participants/${userId}/results`, { auth: "admin" });
export const saveParticipantScore = (id, userId, section, body) =>
  request(`/admin/sessions/${id}/participants/${userId}/scores/${section}`, { method: "PUT", body, auth: "admin" });
export const getAttempt = (attemptId) => request(`/admin/attempts/${attemptId}`, { auth: "admin" });
// Lets a candidate back into an exam that was cancelled for leaving the test page.
export const reinstateParticipant = (id, userId) => request(`/admin/sessions/${id}/participants/${userId}/reinstate`, { method: "POST", auth: "admin" });

export async function downloadSessionExport(id, format, filename) {
  let res;
  try {
    res = await fetch(`${BASE}/admin/sessions/${id}/export?format=${format}`, { headers: { Authorization: `Bearer ${adminToken()}` } });
  } catch {
    throw new ApiError("Network error — please try again.", 0, "NETWORK");
  }
  if (res.status === 401) handleUnauthorized("admin");
  if (!res.ok) throw new ApiError("Export failed", res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ---------- Users ----------
export const listUsers = (params) => request(`/admin/users${qs(params)}`, { auth: "admin" });
export const createUser = (body) => request("/admin/users", { method: "POST", body, auth: "admin" });
export const updateUser = (id, body) => request(`/admin/users/${id}`, { method: "PUT", body, auth: "admin" });
export const deleteUser = (id) => request(`/admin/users/${id}`, { method: "DELETE", auth: "admin" });
export const getUserDashboard = (id) => request(`/admin/users/${id}/dashboard`, { auth: "admin" });

// ---------- Candidate exam ----------
export const candidateLogin = (candidateId) => request("/exam/login", { method: "POST", body: { candidateId } });
export const examState = () => request("/exam/state", { auth: "candidate" });
export const preloadListening = () => request("/exam/section/listening/preload", { auth: "candidate" });
export const startSection = (section) => request(`/exam/section/${section}/start`, { method: "POST", auth: "candidate" });
export const resumeSection = (section) => request(`/exam/section/${section}`, { auth: "candidate" });
export const saveAnswers = (section, answers, flags, keepalive = false) =>
  request(`/exam/section/${section}/answers`, { method: "PUT", body: { answers, flags }, auth: "candidate", keepalive });
export const submitSection = (section, answers, flags, auto = false) =>
  request(`/exam/section/${section}/submit`, { method: "POST", body: { answers, flags, auto }, auth: "candidate" });
// The candidate left a running section: the exam is cancelled. `round` is the state's `lockRound`.
export const leaveExam = (kind, round) => request("/exam/leave", { method: "POST", body: { kind, round }, auth: "candidate", keepalive: true });
