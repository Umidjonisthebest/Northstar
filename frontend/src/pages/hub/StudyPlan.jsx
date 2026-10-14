import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getRoadmap } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { Loading } from "./Home.jsx";
import Icon from "../../components/Icon.jsx";
import { EmptyArt } from "../../components/Art.jsx";
import { PLAN_COUNTS, SECTION_KEY, SECTION_SHORT, fmtDay, pct, planTaskCount, planTaskUrl, playerUrl } from "./hubUtils.js";
import "../../planning.css";
import "../../planner.css";

const ICON = { drill: "target", mixed: "shuffle", vocab: "book", mock: "mock", mistakes: "mistakes" };
const PHASE = { build: "Build", sharpen: "Sharpen", final: "Final week" };
const PHASE_NOTE = {
  build: "Easy and medium questions on the skills with the most to gain.",
  sharpen: "Medium and hard questions, with timed practice.",
  final: "A lighter week: review, one timed module, and rest."
};
const EXTRA = { mock: "a timed mock module", mistakes: "a mistakes review", rest: "rest the day before the test" };
const FIRST_WEEKS = 6;
const shortDay = (key) => fmtDay(key, { month: "short", day: "numeric" });

// The weeks from today to the SAT date, weighted toward the skills where the student can gain the
// most. The server rebuilds it from their answers every time (planning.js). Each week folds away;
// only the current one starts open.
function Weeks({ plan }) {
  const [all, setAll] = useState(false);
  const weeks = all ? plan.weeks : plan.weeks.slice(0, FIRST_WEEKS);
  return (
    <div className="ns-pl-weeks">
      {weeks.map((w) => (
        <details key={w.n} className={`ns-pl-week ${w.n === 1 ? "now" : ""}`} open={w.n === 1}>
          <summary>
            <b>{w.n === 1 ? "This week" : `Week ${w.n}`}</b>
            <span className="ns-pl-dates">{w.start === w.end ? shortDay(w.start) : `${shortDay(w.start)} – ${shortDay(w.end)}`}</span>
            <span className="ns-pl-skills">
              {w.focus.length} skill{w.focus.length === 1 ? "" : "s"}
            </span>
            <span className="ns-road-phase">{PHASE[w.phase]}</span>
            <Icon name="chevronDown" size={18} className="ns-pl-chev" />
          </summary>
          <div className="ns-pl-week-body">
            <div className="ns-road-focus">
              {w.focus.map((f) => (
                <Link key={f.skill} to={playerUrl({ source: "drill", sec: SECTION_KEY[f.section], skills: [f.skill], difficulty: f.levels, size: f.questions, from: "/plan" })}>
                  <b>{f.skill}</b>
                  <span>
                    {SECTION_SHORT[f.section]} · {f.questions} questions · {f.attempts ? `${pct(f.accuracy)} so far` : "new to you"}
                  </span>
                </Link>
              ))}
            </div>
            <p className="ns-road-extras">
              {PHASE_NOTE[w.phase]} Also {w.extras.map((x) => EXTRA[x]).join(", ")}.
            </p>
          </div>
        </details>
      ))}
      {plan.weeks.length > FIRST_WEEKS && (
        <button className="ns-pill-btn" style={{ alignSelf: "center" }} aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer weeks" : `Show all ${plan.weeks.length} weeks`}
        </button>
      )}
      {plan.truncated && <p className="ns-pl-fine">Your test is more than a year away, so the plan covers the first 52 weeks for now.</p>}
    </div>
  );
}

export default function StudyPlan() {
  const { token } = useStudentAuth();
  const { progress } = useProgress();
  const nav = useNavigate();
  const [picked, setPicked] = useState(undefined); // the day row that is open; undefined = today's
  const [road, setRoad] = useState({ plan: null, error: "" });

  const loadRoad = useCallback(() => {
    getRoadmap(token)
      .then((plan) => setRoad({ plan, error: "" }))
      .catch((e) => setRoad({ plan: null, error: e.message || "Couldn't load your plan to test day" }));
  }, [token]);
  useEffect(() => {
    loadRoad();
  }, [loadRoad]);

  if (!progress) return <Loading />;

  const tasks = progress.plan.tasks;
  const done = tasks.filter((t) => t.done).length;
  const { plan } = road;
  const openDay = picked === undefined ? (tasks.find((t) => t.isToday) || tasks.find((t) => !t.done))?.index : picked;

  const go = (t) => nav(planTaskUrl({ ...t, from: "/plan" }));

  return (
    <div className="ns-page" style={{ gap: 26, paddingTop: 12 }}>
      <div>
        <h1 className="ns-h1">
          <Icon name="calendar" size={32} /> Study Planner
        </h1>
        <p className="ns-lead">This week's tasks first, then the weeks to your SAT. Both follow the skills where you have the most to gain.</p>
      </div>

      <div className="ns-pl-top">
        <div className="ns-pl-count">
          {plan?.exam ? (
            <>
              <b>{plan.daysLeft}</b>
              <div>
                <span>
                  day{plan.daysLeft === 1 ? "" : "s"} to your SAT
                </span>
                <small>
                  {plan.exam.label}
                  {plan.exam.chosen ? "" : " (next official date)"} · <Link to="/profile?tab=goals">{plan.exam.chosen ? "Change" : "Set your date"}</Link>
                </small>
              </div>
            </>
          ) : (
            <div>
              <span>No SAT date yet</span>
              <small>
                <Link to="/profile?tab=goals">Set your date</Link> to count down to it
              </small>
            </div>
          )}
        </div>
        <div className="ns-pl-progress">
          <div className="ns-pl-progress-top">
            <span>
              <b>{done}</b> of {tasks.length} tasks done this week
            </span>
            <small>{done === tasks.length ? "This week's plan is finished. New tasks on Monday." : done >= 5 ? "Plan Keeper badge earned" : `${5 - done} more for the Plan Keeper badge`}</small>
          </div>
          <div className="ns-progress thin" role="img" aria-label={`${done} of ${tasks.length} tasks done`}>
            <div style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <section aria-labelledby="ns-pl-days-title">
        <div className="ns-section-head">
          <h2 id="ns-pl-days-title">
            <Icon name="checklist" size={22} /> This week
          </h2>
          <span className="ns-pl-fine">
            A task finishes by itself when your practice reaches its count (+{progress.xpRules?.planTask ?? 15} XP). New tasks every Monday.
          </span>
        </div>
        <div className="ns-pl-days">
          {tasks.map((t) => {
            const open = openDay === t.index;
            return (
              <div key={t.index} className={`ns-pl-day ${t.done ? "done" : ""} ${t.isToday ? "today" : ""} ${open ? "open" : ""}`}>
                <div className="ns-pl-day-row">
                  {/* Not a button: only the student's graded work finishes a task. */}
                  <span className="ns-check" role="img" aria-label={t.done ? "Done" : "Not done yet"}>
                    {t.done && <Icon name="check" size={16} strokeWidth={3} />}
                  </span>
                  <button type="button" className="ns-pl-day-head" aria-expanded={open} onClick={() => setPicked(open ? null : t.index)}>
                    <span className="ns-pl-dow">{t.day}</span>
                    <span className={`ns-plan-icon k-${t.kind}`}>
                      <Icon name={ICON[t.kind]} size={15} />
                    </span>
                    <b>{t.title}</b>
                    {!t.done && (
                      <span className="ns-pl-have">
                        {t.have}/{t.need}
                      </span>
                    )}
                    {t.done ? <em className="done">Done</em> : t.isToday ? <em className="today">Today</em> : t.overdue ? <em>Still open</em> : null}
                    <Icon name="chevronDown" size={18} className="ns-pl-chev" />
                  </button>
                </div>
                {!t.done && (
                  <div className="ns-progress thin ns-pl-bar" role="img" aria-label={`${planTaskCount(t)} done`}>
                    <div style={{ width: `${(t.have / t.need) * 100}%` }} />
                  </div>
                )}
                {open && (
                  <div className="ns-pl-day-body">
                    <dl>
                      <div>
                        <dt>When</dt>
                        <dd>{fmtDay(t.date)}</dd>
                      </div>
                      {t.section && (
                        <div>
                          <dt>Section</dt>
                          <dd>{t.section}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Takes about</dt>
                        <dd>{t.minutes} min</dd>
                      </div>
                      <div>
                        <dt>{t.done ? "Size" : "Counted so far"}</dt>
                        <dd>{planTaskCount(t)}</dd>
                      </div>
                    </dl>
                    <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={() => go(t)}>
                      {t.done ? "Do it again" : t.have ? "Continue" : "Start"} <Icon name="chevronRight" size={16} />
                    </button>
                    {!t.done && <p className="ns-pl-fine ns-pl-rule">{PLAN_COUNTS[t.kind]}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="ns-pl-weeks-title">
        <div className="ns-section-head">
          <h2 id="ns-pl-weeks-title">
            <Icon name="northStar" size={22} /> The weeks to test day
          </h2>
          <Link to="/gap" className="ns-pill-btn">
            Point-gap map
          </Link>
        </div>
        {road.error ? (
          <div className="ns-empty2">
            <b>Couldn't load your plan to test day</b>
            {road.error}
            <div style={{ marginTop: 12 }}>
              <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={loadRoad}>
                Try again
              </button>
            </div>
          </div>
        ) : !plan ? (
          <Loading />
        ) : !plan.exam ? (
          <div className="ns-empty2">
            <EmptyArt name="calendar" />
            <b>Set your SAT date to get a plan</b>
            There's no official date coming up. Add your own date and the weeks to it appear here.
            <div style={{ marginTop: 12 }}>
              <Link to="/profile?tab=goals" className="ns-btn ns-btn-primary ns-btn-sm">
                Set my SAT date
              </Link>
            </div>
          </div>
        ) : (
          <>
            <Weeks plan={plan} />
            <p className="ns-pl-fine ns-pl-basis">
              <Icon name="info" size={15} /> A study plan, not a prediction. It is built from{" "}
              {plan.basis.answers ? `your ${plan.basis.answers} practice answer${plan.basis.answers === 1 ? "" : "s"}${plan.basis.mockSections ? " and your latest mock modules" : ""}` : "the test's question mix, until you have some answers"} and changes as they do.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
