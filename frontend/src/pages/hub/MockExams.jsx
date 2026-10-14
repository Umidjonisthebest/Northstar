import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { practiceTests, studentHistory } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { Loading } from "./Home.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import LoadFailed from "../../components/LoadFailed.jsx";
import { fmtDate, playerUrl } from "./hubUtils.js";
import "../../mock.css";
import { EmptyArt } from "../../components/Art.jsx";
import PracticeTestCards from "./PracticeTests.jsx";

// Card tints: the sidebar's colour family (blue, indigo, violet, orchid), in turn.
const TINTS = ["#4f7df3", "#6a63ec", "#8a5fe6", "#b05fd6"];
const TABS = [
  ["todo", "To do"],
  ["done", "Finished"],
  ["all", "All tests"]
];

const doneCount = (s) => s.modules.filter((m) => m.status === "completed").length;

// Where a test stands for this student. "gone" = the teacher deleted the test, so nothing can be sat.
function stateOf(s) {
  const done = doneCount(s);
  if (s.modules.length === 0) return { key: "gone", label: "No longer available" };
  if (done === s.modules.length) return { key: "done", label: "Completed" };
  // The student left the test page while a module was running (lock/useExamLock.js).
  if (s.cancelled) return { key: "cancelled", label: "Cancelled" };
  if (s.sessionStatus !== "started") return { key: "waiting", label: "Waiting for your teacher" };
  if (done > 0 || s.modules.some((m) => m.status === "in_progress")) return { key: "going", label: "In progress" };
  return { key: "ready", label: "Ready to start" };
}

function moduleNote(m) {
  if (m.status === "completed") return `${m.raw}/${m.questionCount} correct`;
  if (m.status === "in_progress") return "In progress";
  return `${m.timeLimitMinutes} min · ${m.questionCount} Qs`;
}

function TestCard({ s, tint }) {
  const nav = useNavigate();
  const state = stateOf(s);
  const done = doneCount(s);
  const next = s.modules.find((m) => m.status !== "completed");
  const open = s.sessionStatus === "started" && next && !s.cancelled;
  const minutes = s.modules.reduce((sum, m) => sum + m.timeLimitMinutes, 0);
  const questions = s.modules.reduce((sum, m) => sum + m.questionCount, 0);
  const go = !next ? "" : next.status === "in_progress" ? "Resume" : done > 0 ? "Continue" : "Start";
  const meta = [
    s.testTitle !== s.sessionName && s.testTitle,
    s.sessionDate,
    s.modules.length > 0 && `${s.modules.length} ${s.modules.length === 1 ? "module" : "modules"} · ${questions} questions`
  ].filter(Boolean);

  return (
    <article className="ns-fl-card" style={{ "--tint": tint }}>
      <div className="ns-fl-art">
        <div className="ns-fl-sheet">
          <div className="ns-fl-sheet-top">
            <span className={`ns-fl-state ${state.key}`}>
              <i /> {state.label}
            </span>
            {minutes > 0 && (
              <span className="ns-fl-time">
                <Icon name="clock" size={15} /> {minutes} min
              </span>
            )}
          </div>
          {s.modules.length === 0 ? (
            <p className="ns-fl-gone">Your teacher removed this test.</p>
          ) : (
            <ol className="ns-fl-route">
              {s.modules.map((m, i) => (
                <li key={m.id} className={`ns-fl-stop ${m.status}${open && m === next ? " next" : ""}`}>
                  <span className="ns-fl-node">{m.status === "completed" ? <Icon name="check" size={15} /> : i + 1}</span>
                  <b>{m.name}</b>
                  <small>{moduleNote(m)}</small>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="ns-fl-body">
        <div className="ns-fl-head">
          <h3>{s.sessionName}</h3>
          {s.difficulty && <span className={`ns-fl-diff ${s.difficulty.toLowerCase()}`}>{s.difficulty}</span>}
        </div>
        {s.testDescription && <p className="ns-fl-desc">{s.testDescription}</p>}
        {meta.length > 0 && <p className="ns-fl-meta">{meta.join(" · ")}</p>}

        <div className="ns-fl-actions">
          {open && (
            <button className="ns-btn ns-btn-primary" aria-label={`${go} ${next.name}`} onClick={() => nav(`/exam/${s.sessionId}`)}>
              {go} <Icon name="chevronRight" size={18} />
            </button>
          )}
          {state.key === "waiting" && (
            <span className="ns-fl-wait">
              <Icon name="lock" size={15} /> Opens when your teacher starts it
            </span>
          )}
          {state.key === "cancelled" && (
            <span className="ns-fl-wait cancelled">
              <Icon name="warning" size={16} />
              <span>Cancelled: you {s.cancelled.reason} while a module was running. Your teacher can let you back in.</span>
            </span>
          )}
          {done > 0 && (
            <button className="ns-pill-btn" onClick={() => nav(`/results/${s.sessionId}`)}>
              Review answers
            </button>
          )}
          {s.rewardsWaiting > 0 && (
            <span className="ns-session-rewards">
              <Icon name="bolt" size={14} /> Your rewards are waiting in the results
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

const KINDS = [
  ["practice", "Practice tests"],
  ["results", "Results"],
  ["teacher", "Teacher mocks"]
];

const SCOPE_NAME = { full: "Full test", rw: "Reading and Writing", math: "Math" };
// "1310", "R&W 690", or the raw count when a section wasn't finished.
function runScore(run) {
  if (run.status === "cancelled") return "Cancelled";
  if (run.total != null) return String(run.total);
  if (run.rw != null) return `R&W ${run.rw}`;
  if (run.math != null) return `Math ${run.math}`;
  return run.count ? `${run.correct}/${run.count}` : "—";
}

// Everything the student has finished, newest first: sittings of practice tests, and the teacher
// mocks they have handed modules in for. Each row opens its answers.
function Results({ tests, history, scores }) {
  const rows = [
    ...tests.flatMap((t) =>
      t.attempts.map((a) => ({
        key: `p-${a.id}`,
        at: a.finishedAt,
        to: `/mock/practice/${a.id}`,
        kind: "practice",
        title: t.title,
        note: `Practice test · ${SCOPE_NAME[a.scope] || a.scope}, ${a.timed ? "timed" : "untimed"}${a.status === "ended" ? " · ended early" : ""}${a.status === "cancelled" ? ` · you ${a.cancelled?.reason || "left the test page"}` : ""}`,
        score: runScore(a)
      }))
    ),
    ...history
      .filter((s) => doneCount(s) > 0)
      .map((s) => {
        const done = s.modules.filter((m) => m.status === "completed");
        return {
          key: `t-${s.sessionId}`,
          at: s.sessionDate || "",
          to: `/results/${s.sessionId}`,
          kind: "teacher",
          title: s.sessionName,
          note: `Teacher mock · ${done.length} of ${s.modules.length} modules handed in`,
          score: `${done.reduce((n, m) => n + (m.raw || 0), 0)}/${done.reduce((n, m) => n + m.questionCount, 0)}`
        };
      })
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return (
    <>
      {rows.length === 0 ? (
        <div className="ns-empty2" style={{ padding: 40 }}>
          <EmptyArt name="chart" />
          <b>No results yet</b>
          Finish a practice test or a teacher mock and its score and answers are kept here.
        </div>
      ) : (
        <div className="ns-ip-recent">
          {rows.map((r) => (
            <Link key={r.key} to={r.to} className="ns-ip-row">
              <span className={`ns-ip-kind ${r.kind === "teacher" ? "writing" : ""}`}>
                <Icon name={r.kind === "teacher" ? "calendar" : "mock"} size={17} />
              </span>
              <span className="ns-ip-row-main">
                <b>{r.title}</b>
                <small>
                  {r.note}
                  {r.at ? ` · ${fmtDate(r.at)}` : ""}
                </small>
              </span>
              <span className="ns-ip-row-score">{r.score}</span>
              <Icon name="chevronRight" size={16} />
            </Link>
          ))}
        </div>
      )}

      {scores.length > 0 && (
        <div className="ns-card">
          <h3>Score trend</h3>
          <p className="ns-muted ns-small">Estimated section score (200–800) for each module you've handed in: teacher mocks and timed practice tests.</p>
          <div className="ns-trend">
            {scores.map((h, i) => (
              <div key={i} className="ns-trend-col" title={`${h.test} · ${h.name}: ${h.raw}/${h.max}`}>
                <b>{h.scaled}</b>
                <div className={`ns-trend-bar ${/math/i.test(h.name) ? "math" : "rw"}`} style={{ height: `${((h.scaled - 150) / 650) * 100}%` }} />
                <span>{/math/i.test(h.name) ? "Math" : "R&W"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// SAT > Practice Tests in the student hub. Every SAT test a student can sit is here, in three tabs:
// the practice tests they sit on their own, whenever they like (PracticeTests.jsx); their results;
// and the mocks a teacher sets up as a session. (A mock is a practice test too: it is only run by
// a teacher.) The IELTS side has the same page: /ielts-prep/practice-tests.
export default function MockExams() {
  const { token, user } = useStudentAuth();
  const { progress } = useProgress();
  const [history, setHistory] = useState(null);
  const [tests, setTests] = useState(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(null);
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();

  const loadTests = useCallback(() => {
    practiceTests(token)
      .then((d) => setTests(d.tests))
      .catch((e) => setError(e.message || "Couldn't load the practice tests"));
  }, [token]);
  useEffect(() => {
    studentHistory(token)
      .then((d) => setHistory(d.sessions))
      .catch((e) => setError(e.message || "Couldn't load your tests"));
    loadTests();
  }, [token, loadTests]);

  if (error) return <LoadFailed title="Couldn't load your tests" message={error} />;
  if (!history || !tests) return <Loading />;
  const scores = progress?.estimate.history || [];

  const lists = {
    todo: history.filter((s) => ["ready", "going", "waiting", "cancelled"].includes(stateOf(s).key)),
    done: history.filter((s) => stateOf(s).key === "done"),
    all: history
  };
  // Opens on what is still to sit; with nothing waiting, on everything.
  const tab = picked || (lists.todo.length ? "todo" : "all");
  const shown = lists[tab];
  // Which tab is showing (?kind= in the address). A mock from the teacher that is waiting comes
  // first; otherwise the practice tests, which are always there.
  const asked = params.get("kind");
  const kind = KINDS.some(([k]) => k === asked) ? asked : lists.todo.length || !tests.length ? "teacher" : "practice";
  const finished = tests.reduce((n, t) => n + t.attempts.length, 0) + history.filter((s) => doneCount(s) > 0).length;
  const kindCount = { practice: tests.length, results: finished, teacher: history.length };

  return (
    <div className="ns-page" style={{ gap: 22, paddingTop: 12 }}>
      <div>
        <h1 className="ns-h1">
          <Icon name="mock" size={32} /> Practice Tests
        </h1>
        <p className="ns-lead">
          Every SAT test in one place: practice tests you can sit on your own whenever you like, your results, and the mocks your teacher sets up.
        </p>
      </div>

      <div className="ns-capsule" role="group" aria-label="Practice tests, results or teacher mocks">
        {KINDS.map(([key, label]) => (
          <button key={key} type="button" className={kind === key ? "on" : ""} aria-pressed={kind === key} onClick={() => setParams({ kind: key }, { replace: true })}>
            {label} <span>{kindCount[key]}</span>
          </button>
        ))}
      </div>

      {kind === "practice" &&
        (tests.length > 0 ? (
          <PracticeTestCards tests={tests} onChange={loadTests} />
        ) : (
          <div className="ns-empty2" style={{ padding: 40 }}>
            <Nova size={80} mood="thinking" float />
            <b style={{ marginTop: 12 }}>No practice tests right now</b>
            None are open at the moment. The question bank and drills are there meanwhile.
          </div>
        ))}

      {kind === "results" && <Results tests={tests} history={history} scores={scores} />}

      {kind === "teacher" && history.length === 0 && (
        <div className="ns-empty2" style={{ padding: 40 }}>
          <Nova size={80} mood="thinking" float />
          <b style={{ marginTop: 12 }}>No mocks from your teacher yet</b>
          Ask your teacher to add you to a session using your email or Candidate ID {user?.candidateId}.{" "}
          {tests.length > 0 ? "Meanwhile, the practice tests are yours to sit whenever you like." : "Meanwhile, drills keep your streak going."}
          <div style={{ marginTop: 14 }}>
            {tests.length > 0 ? (
              <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={() => setParams({ kind: "practice" }, { replace: true })}>
                See the practice tests
              </button>
            ) : (
              <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={() => nav(playerUrl({ source: "drill", size: 10, from: "/mock" }))}>
                Start a drill
              </button>
            )}
          </div>
        </div>
      )}

      {kind === "teacher" && history.length > 0 && (
        <>
          <div className="ns-capsule" role="group" aria-label="Which tests to show">
            {TABS.map(([key, label]) => (
              <button key={key} type="button" className={tab === key ? "on" : ""} aria-pressed={tab === key} onClick={() => setPicked(key)}>
                {label} <span>{lists[key].length}</span>
              </button>
            ))}
          </div>

          <div className="ns-fl-note">
            <Nova size={56} mood="explain" />
            <div>
              <h2>Before you start</h2>
              <p>
                Each test runs one module at a time, and a module's clock keeps going once you open it. A running module is locked: it opens in
                full screen, and switching to another tab, window or app, or closing or reloading the page, ends the test and cancels it. Your
                answers save to your account as you work. The score is an estimate for planning your study, not an official College Board score.
                {progress?.xpRules ? ` Each correct answer earns ${progress.xpRules.examCorrect} XP, shown with your results once you finish.` : ""}
              </p>
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="ns-empty2">
              <EmptyArt name="checklist" />
              <b>{tab === "todo" ? "Nothing waiting for you" : "No finished tests yet"}</b>
              {tab === "todo" ? "You've finished every test you were given." : "A test moves here once you've handed in all of its modules."}
            </div>
          ) : (
            <div className="ns-fl-grid">
              {shown.map((s) => (
                <TestCard key={s.sessionId} s={s} tint={TINTS[history.indexOf(s) % TINTS.length]} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
