import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { markExamRewardsSeen, studentSessionResults } from "../api.js";
import { useStudentAuth } from "../context/AuthContext.jsx";
import { useProgress } from "../context/ProgressContext.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import Logo from "../components/Brand.jsx";
import { SkeletonDashboard } from "../components/Skeleton.jsx";
import Icon, { Medal } from "../components/Icon.jsx";
import QuestionFigure from "../components/QuestionFigure.jsx";
import { mathParts } from "../components/MathText.jsx";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

// What the exam earned. Exam screens show no XP or badges, so the server
// queues each module's reward and this page is where the student sees it.
function ExamRewards({ rewards }) {
  if (!rewards?.items.length) return null;
  return (
    <section className="ns-exam-rewards" aria-label="What this exam earned you">
      <div className="ns-exam-rewards-head">
        <span className="ns-exam-rewards-gem">
          <Icon name="bolt" size={22} />
        </span>
        <div>
          <b>This exam earned you {rewards.totalXp} XP</b>
          <span>Rewards stay off the exam screens, so they are collected here.</span>
        </div>
      </div>
      <ul>
        {rewards.items.map((r) => (
          <li key={r.moduleId}>
            <span className="ns-exam-rewards-name">{r.moduleName}</span>
            <b>+{r.xpGained} XP</b>
            {r.chunksGained > 0 && (
              <span className="ns-exam-rewards-tag">
                <Icon name="comet" size={14} /> +{r.chunksGained} comet chunk{r.chunksGained === 1 ? "" : "s"}
              </span>
            )}
            {r.leveledUp && (
              <span className="ns-exam-rewards-tag">
                <Icon name="rocket" size={14} /> Reached level {r.level}
              </span>
            )}
            {r.goalReached && (
              <span className="ns-exam-rewards-tag">
                <Icon name="target" size={14} /> Daily goal reached
              </span>
            )}
            {(r.newBadges || []).map((b) => (
              <span key={b.id} className="ns-exam-rewards-tag badge" title={b.desc}>
                <Medal id={b.id} size={26} /> {b.name}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function StudentResultView() {
  const { sessionId } = useParams();
  const { token } = useStudentAuth();
  const { celebrate } = useProgress();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [activeModuleId, setActiveModuleId] = useState(null);
  const celebrated = useRef(null);

  useEffect(() => {
    let alive = true;
    studentSessionResults(token, sessionId)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setActiveModuleId(d.modules[0]?.moduleId);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [token, sessionId]);

  // Rewards the exam held back are celebrated once, the first time they are seen here.
  useEffect(() => {
    const fresh = (data?.rewards?.items || []).filter((r) => !r.seen);
    if (!fresh.length || celebrated.current === sessionId) return;
    celebrated.current = sessionId;
    celebrate({
      xpGained: fresh.reduce((s, r) => s + (r.xpGained || 0), 0),
      leveledUp: fresh.some((r) => r.leveledUp),
      level: Math.max(...fresh.map((r) => r.level || 1)),
      newBadges: fresh.flatMap((r) => r.newBadges || []),
      goalReached: fresh.some((r) => r.goalReached)
    });
    markExamRewardsSeen(token, sessionId).catch(() => {
      /* they are simply shown as new again next time */
    });
  }, [data, sessionId, token, celebrate]);

  if (error) {
    return (
      <div className="center-screen">
        <div className="login-card">
          <h1>Couldn't load these results</h1>
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={() => nav("/mock")}>
            Back to your tests
          </button>
        </div>
      </div>
    );
  }
  if (!data) return <SkeletonDashboard />;
  const activeModule = data.modules.find((m) => m.moduleId === activeModuleId);

  return (
    <div className="dash-shell">
      <header className="dash-header">
        <Logo to="/dashboard" size={30} />
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "12px" }}>
            <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>Theme</span>
            <ThemeToggle />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => nav("/dashboard")}>
            ← Back to dashboard
          </button>
        </div>
      </header>

      <div className="dash-main">
        <div className="page-header">
          <div>
            <h1>{data.sessionName}</h1>
            <p>{data.testTitle}</p>
          </div>
        </div>

        {/* The test is locked: leaving the page while a module was running cancelled it. */}
        {data.cancelled && (
          <div className="exam-cancelled" role="status" style={{ margin: "0 0 20px" }}>
            <Icon name="warning" size={18} />
            <div>
              <strong>This test was cancelled</strong>
              You {data.cancelled.reason} while a module was running, so the test ended there. Modules you had already handed in keep their results. Your teacher
              can let you back in if it was a mistake.
            </div>
          </div>
        )}

        <ExamRewards rewards={data.rewards} />

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

        {activeModule?.status !== "completed" && (
          <div className="empty-state card">This module isn't finished yet. Its answers appear here once it's submitted.</div>
        )}

        {activeModule?.status === "completed" &&
          activeModule.questions.map((q, i) => (
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
                            {isGiven && !isCorrectAnswer ? "  ← your answer" : ""}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 14 }}>
                      <div>
                        Your answer:{" "}
                        <span className={q.isCorrect ? "answer-correct" : "answer-wrong"}>{q.givenAnswer ?? "(blank)"}</span>
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
    </div>
  );
}
