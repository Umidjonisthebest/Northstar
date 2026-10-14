import React, { useEffect, useState } from "react";
import { adminAnalytics } from "../../api.js";
import { useAdminAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import { Kpi, Empty, accClass } from "../../components/adminUi.jsx";

const pct = (a) => (a === null || a === undefined ? "—" : `${Math.round(a * 100)}%`);

export default function Analytics() {
  const { token } = useAdminAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [testId, setTestId] = useState(null);
  const [allTopics, setAllTopics] = useState(false);

  useEffect(() => {
    let alive = true;
    adminAnalytics(token)
      .then((r) => {
        if (!alive) return;
        setD(r);
        const withData = r.tests.find((t) => t.modules.some((m) => m.submissions > 0));
        setTestId((withData || r.tests[0])?.id || null);
      })
      .catch((e) => alive && setError(e.message || "Couldn't load the analytics"));
    return () => {
      alive = false;
    };
  }, [token]);

  if (!d && error) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Couldn't load the analytics</h2>
        <p style={{ color: "var(--ink-soft)" }}>{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }
  if (!d)
    return (
      <div className="ns-loading">
        <div className="ns-spinner" />
      </div>
    );

  const test = d.tests.find((t) => t.id === testId);
  const practised = d.topics.filter((t) => t.accuracy !== null);
  const weakest = practised[0];
  const strongest = practised.at(-1);
  const totalSubs = d.tests.reduce((s, t) => s + t.modules.reduce((x, m) => x + m.submissions, 0), 0);

  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <span className="ad-eyebrow">Insights</span>
          <h1>Class analytics</h1>
          <p>Where the class is strong, where it struggles, and which questions trip people up.</p>
        </div>
      </div>

      <div className="ad-grid-4">
        <Kpi icon="target" tone="violet" label="Practice answers" value={d.practice.totalAttempts} sub={`${d.practice.untouched} questions not tried yet`} />
        <Kpi icon="mock" tone="rose" label="Mock submissions" value={totalSubs} sub={`across ${d.tests.length} tests`} />
        <Kpi icon="warning" tone="amber" label="Weakest topic" value={weakest ? pct(weakest.accuracy) : "—"} sub={weakest ? weakest.topic : "needs practice data"} />
        <Kpi icon="success" tone="green" label="Strongest topic" value={strongest && strongest !== weakest ? pct(strongest.accuracy) : "—"} sub={strongest && strongest !== weakest ? strongest.topic : "needs more data"} />
      </div>

      <div className="ad-grid-2e">
        <div className="ad-card">
          <div className="ad-card-head">
            <h3>
              <Icon name="pin" size={18} /> Topic mastery (class)
            </h3>
            <span>weakest first</span>
          </div>
          {practised.length === 0 && <Empty icon="target">No practice answers yet — topics appear once students start drilling.</Empty>}
          {(allTopics ? practised : practised.slice(0, 10)).map((t) => (
            <div key={t.topic} className="ad-topic-row">
              <span>
                {t.topic}
                <small className="ad-muted" style={{ display: "block", fontWeight: 500 }}>
                  {t.section} · {t.attempts} answers
                </small>
              </span>
              <div className="ad-bar">
                <i className={accClass(t.accuracy)} style={{ width: pct(t.accuracy) }} />
              </div>
              <b>{pct(t.accuracy)}</b>
            </div>
          ))}
          {practised.length > 10 && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setAllTopics((v) => !v)}>
              {allTopics ? "Show fewer" : `Show all ${practised.length} topics`}
            </button>
          )}
        </div>

        <div className="ad-card">
          <div className="ad-card-head">
            <h3>
              <Icon name="warning" size={18} /> Hardest practice questions
            </h3>
          </div>
          {d.practice.hardest.length === 0 && <Empty icon="target">No data yet.</Empty>}
          {d.practice.hardest.map((q, i) => (
            <div key={q.id} className="ad-q-row">
              <em>{i + 1}</em>
              <div>
                <p>{q.title}</p>
                <small>
                  {q.topic} · {q.difficulty} · {q.students} student{q.students === 1 ? "" : "s"}
                </small>
              </div>
              <div className="ad-bar">
                <i className={accClass(q.accuracy)} style={{ width: pct(q.accuracy) }} />
              </div>
              <b>{pct(q.accuracy)}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="ad-card">
        <div className="ad-card-head">
          <h3>
            <Icon name="layers" size={18} /> Mock test results
          </h3>
          {d.tests.length > 0 && (
            <select className="ad-input" value={testId || ""} onChange={(e) => setTestId(e.target.value)}>
              {d.tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
        </div>
        {!test && <Empty icon="layers">Create a test to see results here.</Empty>}
        {test && (
          <div className="ad-grid-2e">
            {test.modules.map((m) => {
              const max = Math.max(1, ...m.buckets.map((b) => b.count));
              return (
                <div key={m.id} className="ad-card" style={{ boxShadow: "none" }}>
                  <div className="ad-card-head">
                    <h3>{m.name}</h3>
                    <span>
                      {m.submissions} submitted{m.avgScaled ? ` · avg ${m.avgScaled}` : ""}
                    </span>
                  </div>
                  {m.submissions === 0 ? (
                    <Empty icon="mock">No submissions yet.</Empty>
                  ) : (
                    <>
                      <p className="ad-small ad-muted" style={{ margin: 0 }}>
                        Score distribution (estimated section score)
                      </p>
                      <div className="ad-dist">
                        {m.buckets.map((b, i) => (
                          <div key={b.label}>
                            <b>{b.count || ""}</b>
                            <i style={{ height: `${(b.count / max) * 100}%`, animationDelay: `${i * 60}ms`, opacity: b.count ? 1 : 0.25 }} />
                            <span>{b.label}</span>
                          </div>
                        ))}
                      </div>
                      <p className="ad-small ad-muted" style={{ margin: "18px 0 4px" }}>
                        Questions, hardest first
                      </p>
                      {m.questions.slice(0, 5).map((q) => (
                        <div key={q.id} className="ad-q-row">
                          <em>Q{q.order}</em>
                          <div>
                            <p>{q.prompt}</p>
                            <small>
                              {q.type === "mcq" ? "Multiple choice" : "Grid-in"} · {q.correct}/{q.total} correct
                            </small>
                          </div>
                          <div className="ad-bar">
                            <i className={accClass(q.accuracy ?? 0)} style={{ width: pct(q.accuracy) }} />
                          </div>
                          <b>{pct(q.accuracy)}</b>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
