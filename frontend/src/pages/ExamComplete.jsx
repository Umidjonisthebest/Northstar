import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStudentAuth } from "../context/AuthContext.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

// The last exam screen. It stays plain like the rest of exam mode: what the
// session earned (XP, badges) is shown on the results page it leads to.
export default function ExamComplete() {
  const { user } = useStudentAuth();
  const { sessionId } = useParams();
  const nav = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => nav(`/results/${sessionId}`, { replace: true }), 5000);
    return () => clearTimeout(t);
  }, [nav, sessionId]);

  return (
    <div className="complete-screen">
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>Theme</span>
            <ThemeToggle />
          </div>
        </div>
        <h1>Session complete{user?.firstName ? `, ${user.firstName}` : ""}.</h1>
        <p>Your answers are saved. Your results are ready, with what this session earned you.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => nav(`/results/${sessionId}`, { replace: true })}>
            See my results
          </button>
          <button className="btn btn-secondary" onClick={() => nav("/dashboard")}>
            Go to dashboard
          </button>
        </div>
        <p className="hint" style={{ marginTop: 20 }}>
          Opening your results automatically…
        </p>
      </div>
    </div>
  );
}
