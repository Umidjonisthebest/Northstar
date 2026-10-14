import React, { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { practiceBank } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import { BookArt, MathArt } from "../../components/Art.jsx";
import ActivityChart from "../../components/ActivityChart.jsx";
import LoadFailed from "../../components/LoadFailed.jsx";
import { Loading } from "./Home.jsx";
import { SECTION_KEY, pct, playerUrl } from "./hubUtils.js";

const ART = { rw: BookArt, math: MathArt };

export default function QuestionBank() {
  const { token } = useStudentAuth();
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    practiceBank(token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);

  // Older links: /practice?drill=1&topic=Transitions
  if (params.get("drill") === "1") {
    const topic = params.get("topic");
    return <Navigate replace to={playerUrl({ source: "drill", skills: topic ? [topic] : [], size: 10, from: "/practice" })} />;
  }
  if (error) return <LoadFailed title="Couldn't load the question bank" message={error} />;
  if (!data) return <Loading />;
  const s = data.stats;

  return (
    <div className="ns-bank-page ns-page">
      <section>
        <div className="ns-section-head" style={{ marginBottom: 0 }}>
          <h1 className="ns-h1">
            <Icon name="bank" size={34} /> Question Bank
          </h1>
          <Link to={playerUrl({ source: "drill", size: 5, from: "/practice" })} className="ns-btn ns-btn-soft ns-btn-sm">
            <Icon name="bolt" size={16} /> Quick 5-question drill
          </Link>
        </div>
        <div className="ns-bank-cards">
          {data.sections.map((sec) => {
            const Art = ART[sec.key];
            const done = sec.total ? sec.solved / sec.total : 0;
            return (
              <Link key={sec.key} to={`/practice/${sec.key}`} className={`ns-bank-card ${sec.key}`}>
                <h3>{sec.section}</h3>
                <div className="ns-bank-meta">
                  <span>
                    {sec.solved.toLocaleString("en-US")} of {sec.total.toLocaleString("en-US")} solved
                  </span>
                  <span>{Math.round(done * 100)}%</span>
                </div>
                <div className="ns-bank-bar" role="progressbar" aria-valuenow={Math.round(done * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${sec.section} progress`}>
                  <div style={{ width: `${Math.max(done * 100, sec.solved ? 3 : 0)}%` }} />
                </div>
                <span className="ns-bank-open">
                  Open <Icon name="chevronRight" size={16} />
                </span>
                <Art />
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="ns-section-head">
          <h2 style={{ fontSize: 30, fontWeight: 600 }}>
            <Icon name="chart" size={30} /> Question Analytics
          </h2>
          <Link to="/analytics" className="ns-pill-btn">
            View all analytics <Icon name="chevronRight" size={15} />
          </Link>
        </div>
        <div className="ns-stats">
          <div className="ns-stat2">
            <span className="ns-stat2-label">Questions Attempted</span>
            <div className="ns-stat2-row">
              <span className="ns-stat2-value">{s.attempts.toLocaleString("en-US")}</span>
            </div>
            <span className="ns-stat2-ghost">
              <Icon name="success" size={86} strokeWidth={1.4} />
            </span>
          </div>
          <div className="ns-stat2">
            <span className="ns-stat2-label">Current Accuracy</span>
            <div className="ns-stat2-row">
              <span className="ns-stat2-value">{pct(s.accuracy)}</span>
            </div>
            <span className="ns-stat2-ghost">
              <Icon name="chart" size={86} strokeWidth={1.4} />
            </span>
          </div>
          <div className="ns-stat2">
            <span className="ns-stat2-label">Saved Questions</span>
            <div className="ns-stat2-row">
              <span className="ns-stat2-value">{s.flagged}</span>
              <Link to={s.flagged ? playerUrl({ source: "flagged", from: "/practice" }) : "/mistakes"} className="ns-pill-btn sm">
                View
              </Link>
            </div>
            <span className="ns-stat2-ghost">
              <Icon name="bookmark" size={86} strokeWidth={1.4} />
            </span>
          </div>
          <div className="ns-stat2">
            <span className="ns-stat2-label">Study Streak</span>
            <div className="ns-stat2-row">
              <span className="ns-stat2-value">{s.streak}</span>
            </div>
            <span className="ns-stat2-ghost">
              <Icon name="northStar" size={86} strokeWidth={1.4} />
            </span>
          </div>
        </div>
      </section>

      <section className="ns-card2 ns-trend-card">
        <h3>Activity trend</h3>
        <p>Wrong in red, correct in green. Harder questions look darker and sit below easier ones in each color. Each bar is one calendar week.</p>
        <ActivityChart trend={data.trend} />
      </section>

      <p className="ns-muted2" style={{ margin: "-20px 0 0", fontSize: 14 }}>
        Tip: open a section to filter by skill and difficulty, or jump into{" "}
        <Link to={playerUrl({ source: "drill", sec: SECTION_KEY["Reading & Writing"], size: 10, from: "/practice" })}>10 unseen Reading & Writing questions</Link>.
      </p>
    </div>
  );
}
