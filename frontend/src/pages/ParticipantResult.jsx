import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getParticipantResult } from "../api.js";
import { useAdminAuth } from "../context/AuthContext.jsx";
import { SkeletonAdminDetail } from "../components/SkeletonAdmin.jsx";
import Icon from "../components/Icon.jsx";
import QuestionFigure from "../components/QuestionFigure.jsx";
import { mathParts } from "../components/MathText.jsx";
import { studioPath } from "../studio/panels.js";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function ParticipantResult() {
  const { sessionId, participantId } = useParams();
  const { token } = useAdminAuth();
  // The result remembers which candidate it belongs to, so opening another one never shows the
  // previous one while it loads.
  const key = `${sessionId}/${participantId}`;
  const [loaded, setLoaded] = useState({ key: "", data: null, error: "" });
  const [activeModuleId, setActiveModuleId] = useState(null);
  const data = loaded.key === key ? loaded.data : null;
  const error = loaded.key === key ? loaded.error : "";

  useEffect(() => {
    let alive = true;
    getParticipantResult(token, sessionId, participantId)
      .then((d) => {
        if (!alive) return;
        setLoaded({ key, data: d, error: "" });
        setActiveModuleId(d.modules[0]?.moduleId);
      })
      .catch((e) => alive && setLoaded({ key, data: null, error: e.message || "Couldn't load this result" }));
    return () => {
      alive = false;
    };
  }, [token, sessionId, participantId, key]);

  if (error) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Couldn't load this result</h2>
        <p style={{ color: "var(--ink-soft)" }}>{error}</p>
        <Link to={studioPath(`/sessions/${sessionId}`)} className="btn btn-secondary">
          Back to session
        </Link>
      </div>
    );
  }
  if (!data) return <SkeletonAdminDetail />;

  const activeModule = data.modules.find((m) => m.moduleId === activeModuleId);

  return (
    <div>
      <Link to={studioPath(`/sessions/${sessionId}`)} className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }}>
        ← Back to session
      </Link>

      <div className="page-header">
        <div>
          {/* The account can be deleted while its exam record is still here. */}
          <h1>{data.user ? `${data.user.firstName} ${data.user.lastName}` : "Deleted candidate"}</h1>
          <p>
            {data.user ? `${data.user.email} · Candidate ID ${data.user.candidateId} · ` : ""}
            {data.session.name}
          </p>
        </div>
      </div>

      {/* The test is locked: this candidate left the page while a module was running. Letting
          them back in is done from the session's page. */}
      {data.cancelled && (
        <div className="exam-cancelled" role="status" style={{ margin: "0 0 20px" }}>
          <Icon name="warning" size={18} />
          <div>
            <strong>This test was cancelled</strong>
            The candidate {data.cancelled.reason}
            {data.cancelled.moduleName ? ` during ${data.cancelled.moduleName}` : ""}, {new Date(data.cancelled.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. Modules handed in before that keep their marks; the
            one they were in is not marked. You can let them back in from the session's page.
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {data.modules.map((m) => (
          <button
            key={m.moduleId}
            className={"btn btn-sm " + (m.moduleId === activeModuleId ? "btn-primary" : "btn-secondary")}
            onClick={() => setActiveModuleId(m.moduleId)}
          >
            {m.name} {m.status === "completed" ? `(${m.raw}/${m.max})` : ""}
          </button>
        ))}
      </div>

      {activeModule && activeModule.status === "not_started" && (
        <div className="empty-state card">{data.cancelled ? "The test was cancelled before this module was started." : "This candidate hasn't started this module yet."}</div>
      )}
      {activeModule && activeModule.status === "in_progress" && (
        <div className="empty-state card">
          {data.cancelled ? "The test was cancelled during this module, so it isn't marked." : "This module is in progress — check back once it's submitted."}
        </div>
      )}

      {activeModule && activeModule.status === "completed" && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <strong>
              Score: {activeModule.raw} / {activeModule.max}
            </strong>
            {activeModule.overtimeSeconds > 0 && (
              <div className="hint" style={{ marginTop: 6, color: "var(--warn)" }}>
                Handed in about {Math.max(1, Math.round(activeModule.overtimeSeconds / 60))} min after the time limit ended.
              </div>
            )}
          </div>
          {activeModule.questions.map((q, i) => (
            <div className="card" key={q.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  {q.passage && (
                    <p style={{ fontSize: 13, color: "var(--ink-soft)", fontStyle: "italic", marginTop: 0 }}>{q.passage}</p>
                  )}
                  <QuestionFigure src={q.passageImage} alt="Figure for the passage" />
                  <p style={{ fontWeight: 500, margin: "0 0 10px" }}>
                    Q{i + 1}. {mathParts(q.prompt)}
                  </p>
                  <QuestionFigure src={q.promptImage} alt="Figure for the question" />

                  {q.type === "mcq" ? (
                    <div>
                      {q.options.map((opt, idx) => {
                        const isCorrectAnswer = idx === q.correctIndex;
                        const isGiven = idx === q.givenAnswer;
                        return (
                          <div
                            key={idx}
                            style={{
                              fontSize: 14,
                              padding: "4px 0",
                              color: isCorrectAnswer ? "var(--good)" : isGiven ? "var(--danger)" : "var(--ink)"
                            }}
                          >
                            {LETTERS[idx]}. {mathParts(opt)}
                            {isCorrectAnswer ? <>  <Icon name="check" size={12} strokeWidth={3} /> correct answer</> : ""}
                            {isGiven && !isCorrectAnswer ? "  ← candidate's answer" : ""}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 14 }}>
                      <div>
                        Candidate's answer:{" "}
                        <span className={q.isCorrect ? "answer-correct" : "answer-wrong"}>
                          {q.givenAnswer ?? "(blank)"}
                        </span>
                      </div>
                      <div>Correct answer: {q.correctAnswer}</div>
                    </div>
                  )}
                </div>
                <span className={q.isCorrect ? "badge badge-good" : "badge badge-warn"}>
                  {q.isCorrect ? "Correct" : "Incorrect"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
