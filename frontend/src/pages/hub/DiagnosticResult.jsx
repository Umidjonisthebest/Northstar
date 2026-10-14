import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getDiagnostic } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import { Loading } from "./Home.jsx";
import { SECTION_KEY, SECTION_SHORT, fmtClock, fmtDate, playerUrl } from "./hubUtils.js";
import "../../diagnostic.css";

// Results of one SAT diagnostic (/diagnostic/results/:id). There is no answer
// key here on purpose: each question reopens in the practice player, where
// Nova gives hints and steps before answers.

const SECTION_NAME = { rw: "Reading and Writing", math: "Math" };

function Scale({ total, target }) {
  const pos = (v) => `${Math.max(0, Math.min(100, ((v - 400) / 1200) * 100))}%`;
  const gap = target ? target - total : null;
  return (
    <div className="dg-scale-wrap">
      <div className="dg-scale" role="img" aria-label={`Estimated score ${total} on the 400 to 1600 scale${target ? `, target ${target}` : ""}`}>
        {target ? (
          <div className="dg-scale-target" style={{ left: pos(target) }}>
            <span>Target {target}</span>
          </div>
        ) : null}
        <div className="dg-scale-mark" style={{ left: pos(total) }}>
          <span>You {total}</span>
        </div>
      </div>
      <div className="dg-scale-ends">
        <span>400</span>
        <span>1000</span>
        <span>1600</span>
      </div>
      {gap != null && (
        <p className="dg-scale-gap">
          {gap > 0
            ? `${gap} points to your target of ${target}. Your study plan now starts with the skills you missed.`
            : `You're already at your target of ${target}. Time to aim higher? You can change it on your dashboard.`}
        </p>
      )}
    </div>
  );
}

function Verdict({ row }) {
  if (row.missing) return <span className="dg-verdict skip">Not counted</span>;
  if (row.correct)
    return (
      <span className="dg-verdict right">
        <Icon name="check" size={16} strokeWidth={2.8} /> Correct
      </span>
    );
  if (row.answered)
    return (
      <span className="dg-verdict wrong">
        <Icon name="cross" size={16} strokeWidth={2.8} /> Incorrect
      </span>
    );
  return <span className="dg-verdict skip">Skipped</span>;
}

export default function DiagnosticResult() {
  const { id } = useParams();
  const { token } = useStudentAuth();
  const { progress } = useProgress();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getDiagnostic(token, id)
      .then(({ diagnostic }) => {
        if (diagnostic.status === "in_progress") nav(`/diagnostic/test/${id}`, { replace: true });
        else setD(diagnostic);
      })
      .catch((e) => setError(e.message));
  }, [token, id, nav]);

  const back = (
    <Link to="/diagnostic" className="ns-back">
      <Icon name="chevronLeft" size={18} /> Diagnostic test
    </Link>
  );

  if (error) {
    return (
      <div className="ns-page dg-page">
        {back}
        <div className="ns-empty2">
          <b>Couldn't load these results</b>
          {error}
        </div>
      </div>
    );
  }
  if (!d) return <Loading />;

  if (d.status !== "completed" || !d.result) {
    return (
      <div className="ns-page dg-page">
        {back}
        <div className="ns-empty2" style={{ padding: 40 }}>
          <Nova size={80} mood="sleep" />
          <b style={{ marginTop: 10 }}>{d.status === "cancelled" ? "This diagnostic was cancelled" : "No score for this one"}</b>
          {d.status === "cancelled"
            ? `The test is locked, and you ${d.cancelled?.reason || "left the test page"} while it was running, so it ended with no score.`
            : d.answered
              ? `Time ran out with ${d.answered} of ${d.count} questions answered. A score needs at least half, so this one doesn't count.`
              : "It closed before any question was answered."}{" "}
          Start a new diagnostic whenever you're ready; it will use different questions.
          <div style={{ marginTop: 16 }}>
            <Link to="/diagnostic" className="ns-btn ns-btn-primary ns-btn-sm">
              Back to the diagnostic
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const r = d.result;
  const from = `/diagnostic/results/${d.id}`;
  const missedInBank = d.rows.filter((x) => !x.correct && !x.missing && x.inBank);
  const mood = r.total >= 1300 ? "cheer" : r.total >= 1000 ? "happy" : "wink";
  const target = progress?.targetScore || null;
  const rowsOf = (section, domain) => d.rows.filter((x) => x.section === section && x.domain === domain && !x.missing);

  return (
    <div className="ns-page dg-page">
      {back}

      <section className="dg-score-card">
        <div>
          <span className="dg-kicker">
            <Icon name="compass" size={16} /> Diagnostic results · {fmtDate(d.submittedAt)}
          </span>
          <div className="dg-total">
            <b>{r.total ?? "—"}</b>
            <span>/ 1600</span>
          </div>
          {r.level && <span className="dg-level">{r.level} level</span>}
          <div className="dg-split">
            <div>
              <small>Reading and Writing</small>
              <b>{r.sections.rw?.score ?? "—"}</b>
            </div>
            <div>
              <small>Math</small>
              <b>{r.sections.math?.score ?? "—"}</b>
            </div>
          </div>
        </div>
        <div className="dg-side">
          <Nova size={96} mood={mood} float />
          <p>
            <b>
              {r.correct} of {r.count}
            </b>{" "}
            correct
            <br />
            {fmtClock(d.seconds)} of {fmtClock(d.limitSeconds)} used{d.auto ? ", submitted when time ran out" : ""}
          </p>
        </div>
        {r.total != null && <Scale total={r.total} target={target} />}
        <p className="dg-fineprint">
          An estimate from {r.count} questions, with harder questions counting more. It isn't an official College Board score, and it gets sharper as you
          practise and take full-length tests.
        </p>
      </section>

      <section>
        <div className="ns-section-head">
          <h2>
            <Icon name="chart" size={22} /> Section by section
          </h2>
        </div>
        <div className="dg-sections">
          {["rw", "math"].map((key) => {
            const s = r.sections[key];
            if (!s) return null;
            return (
              <div key={key} className="dg-sec">
                <div className="dg-sec-head">
                  <h3>{SECTION_NAME[key]}</h3>
                  <span className="dg-sec-score">
                    {s.score}
                    <small> / 800</small>
                  </span>
                </div>
                <p>
                  {s.correct} of {s.total} correct
                </p>
                {s.domains.map((dm) => (
                  <div key={dm.domain} className="dg-domain">
                    <span>{dm.domain}</span>
                    <span className="dg-dots">
                      {rowsOf(s.section, dm.domain).map((x) => (
                        <i
                          key={x.id}
                          className={`dg-dot ${x.correct ? "right" : x.answered ? "wrong" : "skip"}`}
                          title={`Question ${x.n}: ${x.correct ? "correct" : x.answered ? "incorrect" : "skipped"} (${x.difficulty})`}
                        >
                          {x.correct ? <Icon name="check" size={12} strokeWidth={3.2} /> : x.answered ? <Icon name="cross" size={12} strokeWidth={3.2} /> : "–"}
                        </i>
                      ))}
                    </span>
                    <b>
                      {dm.correct}/{dm.total}
                    </b>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {r.focus.length > 0 && (
        <section>
          <div className="ns-section-head">
            <h2>
              <Icon name="target" size={22} /> Start with these skills
            </h2>
            <Link to="/plan" className="ns-pill-btn">
              Open my study plan
            </Link>
          </div>
          <div className="dg-focus">
            {r.focus.map((f) => (
              <Link key={f.skill} className="dg-chip" to={playerUrl({ source: "drill", sec: SECTION_KEY[f.section], skills: [f.skill], size: 10, from })}>
                <span className={`ns-tag2 ${SECTION_KEY[f.section]}`}>{SECTION_SHORT[f.section]}</span>
                {f.skill}
                <small>Practise</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="ns-section-head">
          <h2>
            <Icon name="rocket" size={22} /> What to do next
          </h2>
        </div>
        <div className="dg-next">
          {missedInBank.length > 0 ? (
            <Link className="dg-next-card nova" to={playerUrl({ source: "diagnostic", diag: d.id, only: "missed", from })}>
              <span className="dg-next-icon">
                <Nova size={28} sparkles={false} />
              </span>
              <b>Go over your misses with Nova</b>
              <span>
                Try the {missedInBank.length} question{missedInBank.length === 1 ? "" : "s"} you missed again. Nova gives a hint first and explains step by step.
              </span>
            </Link>
          ) : (
            <Link className="dg-next-card nova" to="/practice">
              <span className="dg-next-icon">
                <Icon name="bank" size={22} />
              </span>
              <b>Keep the streak going</b>
              <span>Nothing to fix from this test. Pick any skill in the Question Bank and push into harder questions.</span>
            </Link>
          )}
          <Link className="dg-next-card plan" to="/plan">
            <span className="dg-next-icon">
              <Icon name="calendar" size={22} />
            </span>
            <b>Follow your study plan</b>
            <span>This week's plan is built from your weakest skills, and these answers now count toward it.</span>
          </Link>
          <Link className="dg-next-card" to="/mock">
            <span className="dg-next-icon">
              <Icon name="mock" size={22} />
            </span>
            <b>Take a full-length test</b>
            <span>The most accurate check of your score. Sit a practice test on your own, timed like test day, or a mock exam your teacher sets up.</span>
          </Link>
        </div>
      </section>

      <section>
        <div className="ns-section-head">
          <h2>
            <Icon name="checklist" size={22} /> Question by question
          </h2>
        </div>
        <div className="dg-qrows">
          {d.rows.map((x) => (
            <div key={x.id} className="dg-qrow">
              <span className={`ns-qnum ${String(x.difficulty).toLowerCase()}`}>{x.n}</span>
              <span className="dg-qrow-main">
                <b>{x.topic}</b>
                <span>
                  {SECTION_SHORT[x.section]} · {x.domain} · {x.difficulty}
                </span>
              </span>
              <Verdict row={x} />
              {x.inBank ? (
                <Link className="ns-pill-btn sm" to={playerUrl({ source: "diagnostic", diag: d.id, start: x.id, from })}>
                  {x.correct ? "Review" : "Retry with Nova"}
                </Link>
              ) : x.generated ? (
                <Link className="ns-pill-btn sm" to={playerUrl({ source: "drill", sec: SECTION_KEY[x.section], skills: [x.topic], size: 10, from })}>
                  Practise this skill
                </Link>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
        {missedInBank.length > 0 && (
          <p className="ns-muted2" style={{ fontSize: 14, margin: "12px 2px 0" }}>
            Missed questions are also in <Link to="/mistakes">Saved &amp; Mistakes</Link>. Get them right later to clear them for bonus XP.
          </p>
        )}
      </section>
    </div>
  );
}
