import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ieltsStudentSessions, ieltsTests } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import LoadFailed from "../../components/LoadFailed.jsx";
import { Loading } from "./Home.jsx";
import { IeltsSessionCard, band, useEnterIelts } from "./ieltsShared.jsx";

// IELTS practice tests: a whole test the student takes alone, one section at a time
// (runs at /ielts-test/…). Listening and Reading are marked at once; Writing gets quick checks
// and a model answer. The teacher's mock tests are the third tab of the same page.

const SECTIONS = [
  ["listening", "Listening", "headphones"],
  ["reading", "Reading", "book"],
  ["writing", "Writing", "pencil"]
];
const LEVEL = { EASY: ["Easy", "easy"], MEDIUM: ["Medium", "medium"], HARD: ["Hard", "hard"] };
const NAME = Object.fromEntries(SECTIONS.map(([k, n]) => [k, n]));
const ICON = Object.fromEntries(SECTIONS.map(([k, , i]) => [k, i]));

function sectionMeta(kind, s) {
  if (kind === "writing") return `${s.parts === 1 ? "1 task" : `${s.parts} tasks`} · ${s.minutes} min`;
  return `${s.questionCount} questions · ${kind === "listening" ? `about ${s.minutes} min` : `${s.minutes} min`}`;
}

function SectionRow({ test, kind, s }) {
  const done = s.attempts > 0;
  const pct = s.best ? Math.round((s.best.correct / s.best.total) * 100) : null;
  return (
    <div className={`ns-pt-row ${kind}`}>
      <span className={`ns-ip-kind ${kind}`}>
        <Icon name={ICON[kind]} size={18} />
      </span>
      <div className="ns-pt-row-main">
        <b>{NAME[kind]}</b>
        <small>{sectionMeta(kind, s)}</small>
      </div>
      <div className="ns-pt-row-score">
        {kind === "writing" ? (
          done ? (
            <span>
              {s.attempts} {s.attempts === 1 ? "time" : "times"} · {s.last.words} words
            </span>
          ) : (
            <span className="ns-ip-muted">Not written yet</span>
          )
        ) : s.best ? (
          <>
            <b>
              {s.best.correct}/{s.best.total}
            </b>
            <span>Band {band(s.best.band)}</span>
            <div className="ns-ip-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Best ${NAME[kind]} score`}>
              <i className={pct >= 70 ? "good" : pct >= 50 ? "mid" : "low"} style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <span className="ns-ip-muted">Not taken yet</span>
        )}
      </div>
      <div className="ns-pt-row-go">
        {s.inDiagnostic ? (
          // Kept closed while one of its parts is the student's diagnostic (ielts/routes/testRoutes.js).
          <Link className="btn btn-secondary btn-sm" to="/ielts-prep/diagnostic">
            <Icon name="compass" size={15} /> In your diagnostic
          </Link>
        ) : (
          <>
            {done && (
              <Link className="ns-pt-review" to={`/ielts-test/review/${s.last.id}`}>
                Review last
              </Link>
            )}
            <Link className={`btn ${done ? "btn-secondary" : "btn-primary"} btn-sm`} to={`/ielts-test/${test.id}/${kind}`}>
              {done ? "Retake" : "Start"} <Icon name="arrowRight" size={15} />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function TestCard({ test, chunks }) {
  const [levelLabel, levelClass] = LEVEL[test.level] || LEVEL.MEDIUM;
  const finished = test.done === test.of;
  return (
    <article className="ns-pt-card">
      <header className="ns-pt-head">
        <div>
          <div className="ns-pt-tags">
            <span className={`ns-tag2 ${levelClass}`}>{levelLabel}</span>
            {finished ? (
              <span className="ns-tag2 done">
                <Icon name="check" size={13} /> Finished
              </span>
            ) : (
              <span className="ns-pt-count">
                {test.done} of {test.of} sections done
              </span>
            )}
          </div>
          <h2>{test.title}</h2>
          {test.description && <p>{test.description}</p>}
        </div>
        <div className="ns-pt-estimate" title="The mean of your best Listening and Reading bands in this test">
          <b>{band(test.estimate)}</b>
          <span>Listening + Reading</span>
        </div>
      </header>
      <div className="ns-pt-rows">
        {SECTIONS.filter(([k]) => test.sections[k]).map(([k]) => (
          <SectionRow key={k} test={test} kind={k} s={test.sections[k]} />
        ))}
      </div>
      {!finished && (
        <p className="ns-pt-foot">
          <Icon name="comet" size={16} /> {chunks.section} comet chunks for each section you finish, and {chunks.whole} more for the whole test.
        </p>
      )}
    </article>
  );
}

const TABS = [
  ["tests", "Practice tests"],
  ["results", "Results"],
  ["teacher", "Teacher mocks"]
];
// A mock that is open to sit, or waiting for the teacher to start it.
const isWaiting = (s) => s.canEnter || s.status === "created";

// IELTS > Practice Tests in the student hub. Every IELTS test a student can take is here, in three
// tabs: the practice tests they take on their own; their results; and the mock tests a teacher
// runs for a group (a mock is a practice test too: it is only run by a teacher, who also marks
// Writing and Speaking). The SAT side has the same page: /mock.
export default function IeltsPracticeTests() {
  const { token, user } = useStudentAuth();
  const [data, setData] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [params, setParams] = useSearchParams();
  const { enter, entering } = useEnterIelts(token);

  useEffect(() => {
    ieltsTests(token)
      .then(setData)
      .catch((e) => setError(e.message || "Couldn't load the practice tests"));
    ieltsStudentSessions(token)
      .then((d) => setSessions(d.sessions))
      .catch((e) => setError(e.message || "Couldn't load your teacher's tests"));
  }, [token]);

  if (error) return <LoadFailed title="Couldn't load the practice tests" message={error} />;
  if (!data || !sessions) return <Loading />;
  const s = data.stats;
  const stats = [
    ["Tests available", data.tests.length, "each taken a section at a time"],
    ["Tests finished", s.finished, "all sections taken"],
    ["Sections taken", s.sections, "retakes included"],
    ["Best estimate", band(s.bestEstimate), s.bestEstimate == null ? "take Listening and Reading of one test" : "Listening and Reading"]
  ];
  const results = data.results || data.recent;
  // Mocks the teacher has closed, with the bands they gave.
  const marked = sessions.filter((x) => x.results);
  // Which tab is showing (?tab= in the address). A mock from the teacher that is waiting comes
  // first; otherwise the practice tests.
  const asked = params.get("tab");
  const tab = TABS.some(([k]) => k === asked) ? asked : sessions.some(isWaiting) ? "teacher" : "tests";
  const count = { tests: data.tests.length, results: results.length + marked.length, teacher: sessions.length };

  return (
    <div className="ns-page" style={{ gap: 24, paddingTop: 12 }}>
      <div>
        <h1 className="ns-h1">
          <Icon name="mock" size={32} /> Practice Tests
        </h1>
        <p className="ns-lead">Every IELTS test in one place: practice tests you take on your own, a section at a time; your results; and the mock tests your teacher runs.</p>
      </div>

      <div className="ns-capsule" role="group" aria-label="Practice tests, results or teacher mocks">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? "on" : ""} aria-pressed={tab === key} onClick={() => setParams({ tab: key }, { replace: true })}>
            {label} <span>{count[key]}</span>
          </button>
        ))}
      </div>

      {tab === "tests" && (
        <>
          <p className="ns-lead" style={{ marginTop: -6 }}>
            Whole tests: forty Listening questions, forty Reading questions and both Writing tasks. Listening and Reading are marked the moment you finish. A section is locked while you
            take it: it opens in full screen, and switching to another tab, window or app, or closing or reloading the page, cancels it with nothing saved.
          </p>
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

          {data.tests.length === 0 ? (
            <div className="ns-empty2" style={{ padding: 40 }}>
              <Nova size={70} mood="thinking" float />
              <b style={{ marginTop: 12 }}>No practice tests yet</b>
              None are open at the moment. Section practice has single parts to work on meanwhile.
            </div>
          ) : (
            <div className="ns-pt-list">
              {data.tests.map((t) => (
                <TestCard key={t.id} test={t} chunks={data.chunks} />
              ))}
            </div>
          )}

          <p className="ns-ip-note">
            <Nova size={26} sparkles={false} /> The band shown is an estimate from Listening and Reading. Writing and Speaking are marked by a teacher, so a full band comes from a teacher's
            mock test.
          </p>
        </>
      )}

      {tab === "results" && (
        <>
          {results.length === 0 && marked.length === 0 && (
            <div className="ns-empty2" style={{ padding: 40 }}>
              <Nova size={70} mood="thinking" float />
              <b style={{ marginTop: 12 }}>No results yet</b>
              Finish a section of a practice test, or a teacher's mock test, and it is kept here.
            </div>
          )}
          {results.length > 0 && (
            <section>
              <div className="ns-section-head">
                <h2>
                  <Icon name="history" size={22} /> Practice tests
                </h2>
              </div>
              <div className="ns-ip-recent">
                {results.map((a) => (
                  <Link key={a.id} to={`/ielts-test/review/${a.id}`} className="ns-ip-row">
                    <span className={`ns-ip-kind ${a.kind}`}>
                      <Icon name={ICON[a.kind]} size={17} />
                    </span>
                    <span className="ns-ip-row-main">
                      <b>
                        {a.title} · {NAME[a.kind]}
                      </b>
                      <small>{new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · open to review your answers</small>
                    </span>
                    <span className="ns-ip-row-score">{a.kind === "writing" ? `${a.words} words` : `${a.correct}/${a.total} · ${band(a.band)}`}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {marked.length > 0 && (
            <section>
              <div className="ns-section-head">
                <h2>
                  <Icon name="calendar" size={22} /> Teacher mocks
                </h2>
              </div>
              <div className="ns-session-list">
                {marked.map((x) => (
                  <IeltsSessionCard key={x.id} s={x} entering={entering === x.id} onEnter={enter} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {tab === "teacher" &&
        (sessions.length === 0 ? (
          <div className="ns-empty2" style={{ padding: 40 }}>
            <Nova size={80} mood="thinking" float />
            <b style={{ marginTop: 12 }}>No mock tests from your teacher yet</b>
            Computer-delivered Listening, Reading and Writing, run by your teacher; Speaking is face to face. Ask your teacher to add you to a session with your Candidate ID{" "}
            <b style={{ display: "inline" }}>{user?.candidateId}</b>.
          </div>
        ) : (
          <>
            <p className="ns-lead" style={{ marginTop: -6 }}>Computer-delivered Listening, Reading and Writing, run by your teacher. Speaking is face to face.</p>
            <div className="ns-session-list">
              {sessions.map((x) => (
                <IeltsSessionCard key={x.id} s={x} entering={entering === x.id} onEnter={enter} />
              ))}
            </div>
          </>
        ))}
    </div>
  );
}
