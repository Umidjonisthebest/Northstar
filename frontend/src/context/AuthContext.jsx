import React, { createContext, useContext, useState, useCallback } from "react";

const AdminAuthCtx = createContext(null);
const StudentAuthCtx = createContext(null);

// (Each tab keeps the session it started with. Following the stored session across tabs was tried
// and dropped: a second sign-in in another tab would swap the identity of a tab that is in the
// middle of an exam.)

// A corrupt stored profile (e.g. the string "undefined") must not take the whole app down at
// startup; treat it as "no profile" instead of letting JSON.parse throw inside a state initializer.
function readStoredUser(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

// The staff session: an admin's or a teacher's (one at a time; the names are from when the admin
// was the only kind of staff). `role` says which panel the session belongs to. A session stored
// before teachers had accounts has no role and is an admin's. The server checks the role on every
// request, so editing what is stored here shows a panel whose every request is refused.
export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("admin_token"));
  const [admin, setAdmin] = useState(() => readStoredUser("admin_user"));
  const role = admin?.role === "teacher" ? "teacher" : "admin";

  const login = useCallback((token, user) => {
    localStorage.setItem("admin_token", token);
    localStorage.setItem("admin_user", JSON.stringify(user));
    setToken(token);
    setAdmin(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setToken(null);
    setAdmin(null);
  }, []);

  return <AdminAuthCtx.Provider value={{ token, admin, role, login, logout }}>{children}</AdminAuthCtx.Provider>;
}

export function useAdminAuth() {
  return useContext(AdminAuthCtx);
}

export function StudentAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("student_token"));
  const [user, setUser] = useState(() => readStoredUser("student_user"));

  const login = useCallback((token, user) => {
    localStorage.setItem("student_token", token);
    localStorage.setItem("student_user", JSON.stringify(user));
    setToken(token);
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("student_token");
    localStorage.removeItem("student_user");
    setToken(null);
    setUser(null);
  }, []);

  return <StudentAuthCtx.Provider value={{ token, user, login, logout }}>{children}</StudentAuthCtx.Provider>;
}

export function useStudentAuth() {
  return useContext(StudentAuthCtx);
}
