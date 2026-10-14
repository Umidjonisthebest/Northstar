import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ieltsPractice } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import { Loading } from "./Home.jsx";
import { band } from "./ieltsShared.jsx";

// IELTS section practice: single listening parts, reading passages and
// writing tasks the student takes on their own (runs at /ielts-practice/…).

const KINDS = [
  ["listening", "Listening", "headphones", "Four parts, from everyday conversations to an academic lecture. Take them under test conditions or pause and replay."],
  ["reading", "Reading", "book", "Academic passages with the question types you'll meet in the test, from easier to harder."],
  ["writing", "Writing", "pencil", "Task 1 reports and Task 2 essays. After you submit you get quick checks and a model answer."]
];
const LEVEL = { EASY: ["Easy", "easy"], MEDIUM: ["Medium", "medium"], HARD: ["Hard", "hard"] };
const TAB_KEY = "ns_ielts_practice_tab";
const EMPTY = { listening: [], reading: [], writing: [], stats: null, recent: [] };

function readTab() {
  try {
    const t = sessionStorage.getItem(TAB_KEY);
    return KINDS.some(([k]) => k === t) ? t : "listening";
  } catch {
    return "listening";
  }
}

const unit = (kind) => (kind === "writing" ? "Task" : "Part");

function meta(kind, item) {
  if (kind === "listening") return `${item.questionCount} questions · ${item.minutes} min audio`;
  if (kind === "reading") return `${item.questionCount} questions · ${item.minutes} min`;
  return `${item.minWords}+ words · ${item.minutes} min`;
}

function PracticeCard({ kind, item }) {
  const [levelLabel, levelClass] = LEVEL[item.level] || LEVEL.MEDIUM;
  const pct = item.best ? Math.round((item.best.correct / item.best.total) * 100) : null;
  return (
    <article className={`ns-ip-card ${kind}`}>
      <div className="ns-ip-top">
        <span className="ns-ip-part">
          {unit(kind)} {item.number}
        </span>
        <span className={`ns-tag2 ${levelClass}`}>{levelLabel}</span>
      </div>
      <h3>{item.title}</h3>
      <p className="ns-ip-meta">{meta(kind, item)}</p>
      <div className="ns-ip-progress">
        {kind === "writing" ? (
          item.attempts ? (
            <span>
              {item.attempts} {item.attempts === 1 ? "essay" : "essays"} · last one {item.last.words} words
            </span>
          ) : (
            <span className="ns-ip-muted">Not written yet</span>
          )
        ) : item.best ? (
          <>
            <div className="ns-ip-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Best score">
              <i className={pct >= 70 ? "good" : pct >= 50 ? "mid" : "low"} style={{ width: `${pct}%` }} />
            </div>
            <span>
              Best {item.best.correct}/{item.best.total} · {item.attempts} {item.attempts === 1 ? "try" : "tries"}
            </span>
          </>
        ) : (
          <span className="ns-ip-muted">Not tried yet</span>
        )}
      </div>
      {item.inDiagnostic ? (
        // Kept closed while it's the student's diagnostic part (see ielts/routes/practiceRoutes.js).
        <Link className="btn btn-secondary btn-sm ns-ip-go" to="/ielts-prep/diagnostic">
          <Icon name="compass" size={15} /> In your diagnostic
        </Link>
      ) : (
        <Link className={`btn ${item.attempts ? "btn-secondary" : "btn-primary"} btn-sm ns-ip-go`} to={`/ielts-practice/${kind}/${item.id}`}>
          {item.attempts ? "Try again" : "Start"} <Icon name="arrowRight" size={15} />
        </Link>
      )}
    </article>
  );
}

export default function IeltsPractice() {
  const { token } = useStudentAuth();
  const [data, setData] = useState(null);
  const [tab, setTabState] = useState(readTab);

  useEffect(() => {
    ieltsPractice(token)
      .then(setData)
      .catch(() => setData(EMPTY));
  }, [token]);

  const setTab = (k) => {
    setTabState(k);
    try {
      sessionStorage.setItem(TAB_KEY, k);
    } catch {
      /* private mode */
    }
  };

  if (!data) return <Loading />;
  const [, , , blurb] = KINDS.find(([k]) => k === tab);
  const items = data[tab] || [];
  const s = data.stats;
  const stats = [
    ["Practice sessions", s?.attempts ?? 0, "across all skills"],
    ["Listening estimate", s?.listening ? band(s.listening.band) : "—", s?.listening ? `from ${s.listening.correct}/${s.listening.total} best answers` : "try a listening part"],
    ["Reading estimate", s?.reading ? band(s.reading.band) : "—", s?.reading ? `from ${s.reading.correct}/${s.reading.total} best answers` : "try a reading passage"],
    ["Essays written", s?.essays ?? 0, "Task 1 and Task 2"]
  ];

  return (
    <div className="ns-page" style={{ gap: 24, paddingTop: 12 }}>
      <div>
        <h1 className="ns-h1">
          <Icon name="layers" size={32} /> IELTS section practice
        </h1>
        <p className="ns-lead">Practise one part at a time. Listening and Reading are marked instantly, and Writing gets quick checks and a model answer.</p>
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

      <div className="ns-ip-head">
        <div className="ns-tabs2" role="tablist" aria-label="Skill">
          {KINDS.map(([k, label, icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              <Icon name={icon} size={17} /> {label} <span>{data[k]?.length || 0}</span>
            </button>
          ))}
        </div>
        <p className="ns-ip-blurb">{blurb}</p>
      </div>

      {items.length === 0 ? (
        <div className="ns-empty2" style={{ padding: 40 }}>
          <Nova size={70} mood="thinking" float />
          <b style={{ marginTop: 12 }}>Nothing here yet</b>
          Your teacher hasn't shared any {tab} practice yet.
        </div>
      ) : (
        <div className="ns-ip-grid">
          {items.map((item) => (
            <PracticeCard key={item.id} kind={tab} item={item} />
          ))}
        </div>
      )}

      {data.recent.length > 0 && (
        <section>
          <div className="ns-section-head">
            <h2>
              <Icon name="history" size={22} /> Recent practice
            </h2>
          </div>
          <div className="ns-ip-recent">
            {data.recent.map((a) => (
              <Link key={a.id} to={`/ielts-practice/${a.kind}/${a.refId}`} className="ns-ip-row">
                <span className={`ns-ip-kind ${a.kind}`}>
                  <Icon name={KINDS.find(([k]) => k === a.kind)[2]} size={17} />
                </span>
                <span className="ns-ip-row-main">
                  <b>{a.title}</b>
                  <small>
                    {KINDS.find(([k]) => k === a.kind)[1]} {unit(a.kind)} {a.number} ·{" "}
                    {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </small>
                </span>
                <span className="ns-ip-row-score">{a.kind === "writing" ? `${a.words} words` : `${a.correct}/${a.total}`}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="ns-ip-note">
        <Nova size={26} sparkles={false} /> All practice material is written for Northstar in the IELTS format. Your teacher can share more from the studio.
      </p>
    </div>
  );
}
