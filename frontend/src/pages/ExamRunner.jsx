import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { examOverview } from "../api.js";
import { useStudentAuth } from "../context/AuthContext.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import Icon from "../components/Icon.jsx";
import { SkeletonExam } from "../components/Skeleton.jsx";
import { LockNotice } from "../lock/LockScreens.jsx";
import { enterFullscreen } from "../lock/useExamLock.js";

export default function ExamRunner() {
  const { sessionId } = useParams();
  const { token, user } = useStudentAuth();
  const nav = useNavigate();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  // The module the student is about to start: the lock's warning is shown first, every time.
  const [starting, setStarting] = useState(null);

  useEffect(() => {
    examOverview(token, sessionId)
      .then((data) => {
        setOverview(data);
        const next = data.modules.find((m) => m.status !== "completed");
        if (!next) nav(`/exam/${sessionId}/complete`, { replace: true });
      })
      .catch((err) => setError(err.message));
  }, [sessionId]);

  // The click that starts the module is what lets the browser go to full screen.
  function startModule(moduleId) {
    enterFullscreen();
    nav(`/exam/${sessionId}/module/${moduleId}`);
  }

  if (error) {
    return (
      <div className="center-screen">
        <div className="login-card">
          <h1>Something went wrong</h1>
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={() => nav("/dashboard")}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!overview) return <SkeletonExam />;

  const cancelled = overview.cancelled;
  const nextModule = cancelled ? null : overview.modules.find((m) => m.status !== "completed");

  return (
    <div className="center-screen">
      <div className="login-card" style={{ maxWidth: 460 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>Theme</span>
            <ThemeToggle />
          </div>
        </div>
        <h1>{overview.testTitle}</h1>
        <p>
          {user?.firstName} {user?.lastName} · {overview.sessionName}
        </p>

        {cancelled && (
          <div className="exam-cancelled" role="alert">
            <Icon name="warning" size={18} />
            <div>
              <strong>This test was cancelled</strong>
              You {cancelled.reason} while a module was running. Your teacher can see this, and can let you back in if it was a mistake.
            </div>
          </div>
        )}

        <div style={{ margin: "20px 0" }}>
          {overview.modules.map((m) => (
            <div key={m.id} className="list-row" style={{ marginBottom: 8 }}>
              <div>
                <div className="list-row-title">{m.name}</div>
                <div className="list-row-meta">
                  {m.questionCount} questions · {m.timeLimitMinutes} min
                  {m.status === "completed" && m.raw !== null ? ` · scored ${m.raw}/${m.questionCount}` : ""}
                </div>
              </div>
              <span
                className={
                  "badge " +
                  (m.status === "completed" ? "badge-good" : m.status === "in_progress" ? "badge-warn" : "badge-muted")
                }
              >
                {m.status === "completed" ? "Done" : cancelled ? "Cancelled" : m.status === "in_progress" ? "In progress" : "Not started"}
              </span>
            </div>
          ))}
        </div>

        {nextModule && (
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setStarting(nextModule)}>
            {nextModule.status === "in_progress" ? "Resume" : "Start"} {nextModule.name}
          </button>
        )}

        <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} onClick={() => nav("/dashboard")}>
          ← Back to dashboard
        </button>

        {!cancelled && (
          <p className="hint" style={{ marginTop: 16 }}>
            Once you start a module, its timer runs until you hand it in, and the test is locked: leaving the page cancels it.
          </p>
        )}
      </div>

      {starting && (
        <LockNotice
          kind="mock"
          title="This test is locked"
          lead={`${starting.name}: ${starting.questionCount} questions, ${starting.timeLimitMinutes} minutes. From the moment you start until you hand it in, this page has to stay open and in front.`}
          startLabel={`I understand. ${starting.status === "in_progress" ? "Resume" : "Start"}`}
          onCancel={() => setStarting(null)}
          onStart={() => startModule(starting.id)}
        />
      )}
    </div>
  );
}
