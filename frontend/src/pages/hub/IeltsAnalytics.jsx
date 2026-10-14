import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ieltsAnalytics } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import LoadFailed from "../../components/LoadFailed.jsx";
import { Loading } from "./Home.jsx";
import { accClass } from "./hubUtils.js";
import { band } from "./ieltsShared.jsx";

// IELTS analytics: what the student's own practice shows, by skill, question type and part.
// Every number comes from marked work (backend ielts/lib/analytics.js); nothing is self-reported.

const SKILL = {
  listening: ["Listening", "headphones", "Part"],
  reading: ["Reading", "book", "Passage"],
  writing: ["Writing", "pencil", "Task"]
};
const pctText = (p) => (p == null ? "—" : `${p}%`);

function timeSpent(seconds) {
  const minutes = Math.round((seconds || 0) / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

// The last few results as a line: scores for Listening and Reading, word counts for Writing.
function Spark({ values, max, label }) {
  if (values.length < 2) return <p className="ns-ia-spark-note">{values.length ? "One result so far. The line starts with your second." : "Nothing to draw yet."}</p>;
  const w = 260;
  const h = 56;
  const top = Math.max(max, ...values, 1);
  const x = (i) => 6 + (i * (w - 12)) / (values.length - 1);
  const y = (v) => h - 6 - (v / top) * (h - 12);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="ns-ia-spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} preserveAspectRatio="none">
      <polyline points={points} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1))} r="4" />
    </svg>
  );
}

function Bar({ label, sub, value }) {
  return (
    <div className="ns-skillbar ns-ia-bar">
      <span>
        {label}
        {sub && <span className="ns-skill-extra"> · {sub}</span>}
      </span>
      <div className="ns-skillbar-track">
        <div className={accClass(value == null ? null : value / 100)} style={{ width: `${value ?? 0}%` }} />
      </div>
      <b>{pctText(value)}</b>
    </div>
  );
}

function MarkedSkill({ kind, s }) {
  const [name, icon, unit] = SKILL[kind];
  const last = s.trend.at(-1);
  return (
    <div className={`ns-card2 ns-an-card ns-ia-skill ${kind}`}>
      <div className="ns-ia-skill-head">
        <span className={`ns-ip-kind ${kind}`}>
          <Icon name={icon} size={18} />
        </span>
        <h3>{name}</h3>
        <b className="ns-ia-band">{band(s.estimate?.band)}</b>
      </div>
      <p>
        {s.estimate
          ? `Band estimate from your best ${s.estimate.correct} of ${s.estimate.total} answers. ${pctText(s.accuracy)} right over ${s.attempts} ${s.attempts === 1 ? "try" : "tries"}.`
          : `No ${name.toLowerCase()} work handed in yet.`}
      </p>
      <Spark values={s.trend.map((t) => t.pct)} max={100} label={`${name}: share of answers right in your last ${s.trend.length} tries`} />
      {last && (
        <span className="ns-ia-last">
          Latest: {unit} {last.number}, {last.correct}/{last.total}
        </span>
      )}
    </div>
  );
}

export default function IeltsAnalytics() {
  const { token } = useStudentAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    ieltsAnalytics(token)
      .then(setData)
      .catch((e) => setError(e.message || "Couldn't load your analytics"));
  }, [token]);

  if (error) return <LoadFailed title="Couldn't load your IELTS analytics" message={error} />;
  if (!data) return <Loading />;
  const t = data.totals;
  const w = data.skills.writing;
  const stats = [
    ["Parts handed in", t.attempts, `${t.sections} whole test ${t.sections === 1 ? "section" : "sections"} among them`],
    ["Answers right", pctText(t.accuracy), `${t.correct} of ${t.questions} questions`],
    ["Time spent", timeSpent(t.seconds), "inside practice parts"],
    ["Days studied", t.days, "with IELTS work handed in"]
  ];

  if (!t.attempts) {
    return (
      <div className="ns-page" style={{ gap: 24, paddingTop: 12 }}>
        <div>
          <h1 className="ns-h1">
            <Icon name="chart" size={32} /> IELTS analytics
          </h1>
          <p className="ns-lead">Your bands, your question types and your parts, from the work you hand in.</p>
        </div>
        <div className="ns-empty2" style={{ padding: 40 }}>
          <Nova size={70} mood="thinking" float />
          <b style={{ marginTop: 12 }}>Nothing to show yet</b>
          Hand in one listening part or reading passage and this page starts filling in.
          <Link to="/ielts-prep/practice" className="ns-btn ns-btn-primary" style={{ marginTop: 16 }}>
            Open section practice
          </Link>
        </div>
      </div>
    );
  }

  const weakest = data.focus?.weakest;
  return (
    <div className="ns-page" style={{ gap: 32, paddingTop: 12 }}>
      <div>
        <h1 className="ns-h1">
          <Icon name="chart" size={32} /> IELTS analytics
        </h1>
        <p className="ns-lead">Your bands, your question types and your parts, from the work you hand in. Your target is band {band(data.target)}.</p>
      </div>

      <div className="ns-stats">
        {stats.map(([label, value, sub]) => (
          <div key={label} className="ns-stat2">
            <span className="ns-stat2-label">{label}</span>
            <div className="ns-stat2-row">
              <span className="ns-stat2-value">{value}</span>
            </div>
            <span className="ns-stat2-sub">{sub}</span>
          </div>
        ))}
      </div>

      <div className="ns-ia-skills">
        <MarkedSkill kind="listening" s={data.skills.listening} />
        <MarkedSkill kind="reading" s={data.skills.reading} />
        <div className="ns-card2 ns-an-card ns-ia-skill writing">
          <div className="ns-ia-skill-head">
            <span className="ns-ip-kind writing">
              <Icon name="pencil" size={18} />
            </span>
            <h3>Writing</h3>
            <b className="ns-ia-band">{w.attempts}</b>
          </div>
          <p>{w.attempts ? `${w.attempts === 1 ? "Essay" : "Essays"} written, ${w.averageWords} words on average. A teacher gives the band.` : "No essays handed in yet."}</p>
          <Spark values={w.trend.map((e) => e.words)} max={250} label={`Writing: words in your last ${w.trend.length} essays`} />
          {w.trend.at(-1) && (
            <span className="ns-ia-last">
              Latest: Task {w.trend.at(-1).number}, {w.trend.at(-1).words} words
            </span>
          )}
        </div>
      </div>

      <div className="ns-an-grid">
        <div className="ns-card2 ns-an-card">
          <h3>Question types</h3>
          <p>From your latest try at each part, weakest first.</p>
          {data.types.length === 0 ? (
            <p className="ns-ia-none">Hand in a listening part or a reading passage to see your question types.</p>
          ) : (
            <div className="ns-skillbars">
              {data.types.map((q) => (
                <Bar key={q.type} label={q.label} sub={`${q.correct}/${q.total}${q.enough ? "" : " · too few to judge"}`} value={q.accuracy} />
              ))}
            </div>
          )}
          {weakest && weakest.accuracy < 80 && (
            <button className="ns-ia-ask" onClick={() => nav("/nova", { state: { ask: `How do I get better at "${weakest.label}" questions in IELTS ${weakest.skill === "both" ? "Listening and Reading" : SKILL[weakest.skill][0]}?` } })}>
              <Nova size={30} sparkles={false} />
              <span>
                <b>{weakest.label} is your weakest type</b>
                <small>Ask Nova for a way to tackle it</small>
              </span>
              <Icon name="chevronRight" size={16} />
            </button>
          )}
        </div>

        <div className="ns-card2 ns-an-card">
          <h3>By part</h3>
          <p>The parts get harder as the test goes on. This is where your marks are going.</p>
          {["listening", "reading"].map((kind) => (
            <div key={kind} className="ns-an-domain">
              <div className="ns-an-domain-head">
                {SKILL[kind][0]} <span>{pctText(data.skills[kind].accuracy)}</span>
              </div>
              <div className="ns-skillbars">
                {data.parts[kind].map((p) => (
                  <Bar key={p.number} label={`${SKILL[kind][2]} ${p.number}`} sub={p.attempts ? `${p.correct}/${p.total}` : "not tried"} value={p.accuracy} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <section>
        <div className="ns-section-head">
          <h2>
            <Icon name="history" size={22} /> Recent work
          </h2>
          <Link to="/ielts-prep/practice-tests?tab=tests" className="ns-pill-btn">
            Practice tests
          </Link>
        </div>
        <div className="ns-ip-recent">
          {data.recent.map((a) => (
            <Link key={a.id} to={a.testAttemptId ? `/ielts-test/review/${a.testAttemptId}` : `/ielts-practice/${a.kind}/${a.refId}`} className="ns-ip-row">
              <span className={`ns-ip-kind ${a.kind}`}>
                <Icon name={SKILL[a.kind][1]} size={17} />
              </span>
              <span className="ns-ip-row-main">
                <b>{a.title}</b>
                <small>
                  {SKILL[a.kind][0]} {SKILL[a.kind][2].toLowerCase()} {a.number} · {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ·{" "}
                  {a.testAttemptId ? "practice test, open to review" : a.diagnostic ? "diagnostic" : "section practice"}
                </small>
              </span>
              <span className="ns-ip-row-score">{a.kind === "writing" ? `${a.words} words` : `${a.correct}/${a.total}`}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
