import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { practiceAnalytics } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import ActivityChart from "../../components/ActivityChart.jsx";
import LoadFailed from "../../components/LoadFailed.jsx";
import { Loading } from "./Home.jsx";
import { accClass, fmtDay, fmtTime, pct, playerUrl } from "./hubUtils.js";
import { EmptyArt } from "../../components/Art.jsx";

function AccBar({ value }) {
  return (
    <div className="ns-skillbar-track">
      <div className={accClass(value)} style={{ width: `${value == null ? 0 : Math.round(value * 100)}%` }} />
    </div>
  );
}

function SectionCard({ s }) {
  return (
    <div className="ns-card2 ns-an-card">
      <h3>{s.section}</h3>
      <p>
        {s.attempts ? `${pct(s.accuracy)} accuracy over ${s.attempts} answers` : "No answers yet"} · tap a skill to practice it
      </p>
      {s.domains.map((d) => (
        <div key={d.domain} className="ns-an-domain">
          <div className="ns-an-domain-head">
            {d.domain} <span>{d.attempts ? pct(d.accuracy) : "—"}</span>
          </div>
          <div className="ns-skillbars">
            {d.skills.map((k) => (
              <Link key={k.skill} to={playerUrl({ source: "drill", sec: s.key, skills: [k.skill], size: 10, from: "/analytics" })} className="ns-skillbar" title={k.avgSec ? `About ${k.avgSec}s per question` : undefined}>
                <span>
                  {k.skill}
                  <span className="ns-skill-extra">
                    {" "}
                    · {k.answered}/{k.total}
                    {k.avgSec ? ` · ${k.avgSec}s avg` : ""}
                  </span>
                </span>
                <AccBar value={k.accuracy} />
                <b>{k.attempts ? pct(k.accuracy) : "—"}</b>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { token } = useStudentAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const loc = useLocation();

  useEffect(() => {
    practiceAnalytics(token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => {
    if (data && loc.hash === "#sessions") document.getElementById("sessions")?.scrollIntoView({ behavior: "smooth" });
  }, [data, loc.hash]);

  if (error) return <LoadFailed title="Couldn't load your analytics" message={error} />;
  if (!data) return <Loading />;
  const s = data.stats;
  const byDay = [];
  for (const sess of data.sessions) {
    const last = byDay.at(-1);
    if (last && last.date === sess.date) last.items.push(sess);
    else byDay.push({ date: sess.date, items: [sess] });
  }

  return (
    <div className="ns-page" style={{ gap: 36, paddingTop: 12 }}>
      <div>
        <h1 className="ns-h1">
          <Icon name="chart" size={32} /> Analytics
        </h1>
        <p className="ns-lead">Everything you've practiced, by skill, difficulty and week.</p>
      </div>

      <div className="ns-stats">
        <div className="ns-stat2">
          <span className="ns-stat2-label">Questions Attempted</span>
          <div className="ns-stat2-row">
            <span className="ns-stat2-value">{s.attempts.toLocaleString("en-US")}</span>
          </div>
          <span className="ns-stat2-sub">{s.questionsAnswered} different questions</span>
        </div>
        <div className="ns-stat2">
          <span className="ns-stat2-label">Current Accuracy</span>
          <div className="ns-stat2-row">
            <span className="ns-stat2-value">{pct(s.accuracy)}</span>
          </div>
          <span className="ns-stat2-sub">
            {s.correct} correct · {s.wrong} wrong
          </span>
        </div>
        <div className="ns-stat2">
          <span className="ns-stat2-label">Avg. time per question</span>
          <div className="ns-stat2-row">
            <span className="ns-stat2-value">{data.avgSec == null ? "—" : `${data.avgSec}s`}</span>
          </div>
          <span className="ns-stat2-sub">Target: about 71s R&W, 95s Math</span>
        </div>
        <div className="ns-stat2">
          <span className="ns-stat2-label">Recent Errors</span>
          <div className="ns-stat2-row">
            <span className="ns-stat2-value">{s.recentErrors}</span>
            {s.recentErrors > 0 && (
              <Link to={playerUrl({ source: "errors", from: "/analytics" })} className="ns-pill-btn sm">
                Start Review
              </Link>
            )}
          </div>
          <span className="ns-stat2-sub">wrong in the last 30 days</span>
        </div>
      </div>

      <section className="ns-card2 ns-trend-card">
        <h3>Activity trend</h3>
        <p>Wrong in red, correct in green. Harder questions look darker and sit below easier ones in each color. Each bar is one calendar week.</p>
        <ActivityChart trend={data.trend} />
      </section>

      <div className="ns-an-grid">
        {data.sections.map((sec) => (
          <SectionCard key={sec.key} s={sec} />
        ))}
      </div>

      <div className="ns-an-grid">
        <div className="ns-card2 ns-an-card">
          <h3>By difficulty</h3>
          <p>Accuracy on easy, medium, hard and challenging questions.</p>
          <div className="ns-diff-bars">
            {Object.entries(data.byDifficulty).map(([level, v]) => (
              <div key={level} className="ns-diff-row">
                <span className={`ns-tag2 ${level.toLowerCase()}`}>{level}</span>
                <AccBar value={v.attempts ? v.correct / v.attempts : null} />
                <b>
                  {v.attempts ? pct(v.correct / v.attempts) : "—"} <small className="ns-muted2">({v.attempts})</small>
                </b>
              </div>
            ))}
          </div>
          {data.mock.length > 0 && (
            <>
              <h3 style={{ marginTop: 26 }}>Mock exam modules</h3>
              <p>Estimated section score (200–800) for each module you've submitted.</p>
              <div className="ns-skillbars">
                {data.mock.slice(-6).map((m, i) => (
                  <div key={i} className="ns-skillbar" style={{ cursor: "default" }}>
                    <span>
                      {m.name} <span className="ns-skill-extra">· {m.test}</span>
                    </span>
                    <div className="ns-skillbar-track">
                      <div className="acc-good" style={{ width: `${((m.scaled - 200) / 600) * 100}%`, background: "var(--primary)" }} />
                    </div>
                    <b>{m.scaled}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="ns-card2 ns-an-card" id="sessions">
          <h3>Study sessions</h3>
          <p>Answers less than 20 minutes apart count as one sitting.</p>
          {byDay.length === 0 ? (
            <div className="ns-empty2">
              <EmptyArt name="chart" />
              <b>No sessions yet</b>
              Start practicing and your sessions will show up here.
            </div>
          ) : (
            byDay.map((d) => (
              <div key={d.date} style={{ marginBottom: 16 }}>
                <p className="ns-sess-day">{fmtDay(d.date, { weekday: "long", month: "short", day: "numeric" })}</p>
                <div className="ns-sess-list">
                  {d.items.map((x) => (
                    <div key={x.start} className="ns-sess">
                      <div className="ns-sess-top">{x.title}</div>
                      <div className="ns-sess-body">
                        <div className="ns-sess-times">
                          <span>Started {fmtTime(x.start)}</span>
                          <span className="end">Ended {fmtTime(x.end)}</span>
                        </div>
                        <div className="ns-sess-dur">
                          <b>{x.minutes}m</b>
                          <small>
                            {x.correct}/{x.count} correct
                          </small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
