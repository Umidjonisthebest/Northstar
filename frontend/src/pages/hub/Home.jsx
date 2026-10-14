import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { studentAnnouncements, studySessions, updateSettings } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon, { Medal } from "../../components/Icon.jsx";
import { useTrophyCard } from "../../components/TrophyCard.jsx";
import { EmptyArt, TargetArt } from "../../components/Art.jsx";
import Nova from "../../components/Nova.jsx";
import { SkyCard } from "../../components/Sky.jsx";
import DailyPrompt from "../../components/DailyPrompt.jsx";
import ClassPrompt from "../../components/ClassPrompt.jsx";
import LeagueCard from "../../components/LeagueCard.jsx";
import RecapPrompt from "../../components/RecapPrompt.jsx";
import ReviewPrompt from "../../components/ReviewPrompt.jsx";
import { SECTION_KEY, SECTION_SHORT, accClass, fmtClock, fmtDay, fmtTime, greeting, pct, planTaskCount, planTaskUrl, playerUrl } from "./hubUtils.js";
import "../../diagnostic.css";
import "../../planning.css";

// A card that sends students without a diagnostic result to take one, or back
// to one they left running. `status` is progress.diagnostic (or ieltsDiagnostic).
export function DiagnosticPrompt({ status, exam, dismissKey }) {
  const nav = useNavigate();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(dismissKey) === "1";
    } catch {
      return false;
    }
  });
  if (!status) return null;
  const page = exam === "ielts" ? "/ielts-prep/diagnostic" : "/diagnostic";
  const open = status.open;
  if (open) {
    const running = open.status === undefined || open.status === "in_progress";
    const to = open.timedOut ? page : exam === "ielts" ? `/ielts-diagnostic/${open.id}` : `/diagnostic/test/${open.id}`;
    return (
      <div className="dg-prompt">
        <Nova size={56} mood="wink" sparkles={false} />
        <div>
          <b>{open.timedOut ? "Your diagnostic's time is up" : running ? "Your diagnostic is waiting for you" : "Your diagnostic is ready"}</b>
          <p>
            {open.timedOut
              ? "Your answers were handed in when the clock ran out. Open it to see how it went."
              : running
                ? `${fmtClock(open.remainingSeconds)} left on the clock, and it keeps running while you're away.`
                : "Your part has been picked. The clock starts when you press Start test."}
          </p>
        </div>
        <div className="dg-prompt-actions">
          <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={() => nav(to)}>
            {open.timedOut ? "See my result" : running ? "Continue" : "Open"}
          </button>
        </div>
      </div>
    );
  }
  if (status.latest || hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      /* private mode */
    }
  };
  return (
    <div className="dg-prompt">
      <Nova size={56} mood="happy" extra="cap" sparkles={false} />
      <div>
        <b>{exam === "ielts" ? "Find your starting band" : "Find your starting score"}</b>
        <p>
          {exam === "ielts"
            ? "Take one random Listening or Reading part you haven't seen, under test conditions, and get a band estimate with your CEFR level."
            : "Take a 20-minute diagnostic with 14 questions you haven't seen. You'll get a score estimate and a study plan built around your weak spots."}
        </p>
      </div>
      <div className="dg-prompt-actions">
        <Link to={page} className="ns-btn ns-btn-primary ns-btn-sm">
          <Icon name="compass" size={16} /> Take the diagnostic
        </Link>
        <button className="dg-x" onClick={dismiss} aria-label="Hide this suggestion">
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  );
}

const ESTIMATE_NOTE = { "diagnostic test": "From your diagnostic test", "mock exam": "From your latest mock test", practice: "Estimated from your practice" };

export function useCountdown(iso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return null;
  const s = Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), secs: s % 60 };
}

export function Loading() {
  return (
    <div className="ns-loading">
      <div className="ns-spinner" />
    </div>
  );
}

// A number with a pencil that turns into an input (current / target score).
export function EditableScore({ value, placeholder = "—", label, note, onSave, min = 400, max = 1600, step = 10 }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const input = useRef(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);
  const save = async () => {
    setEditing(false);
    const v = draft.trim();
    if (v === String(value ?? "")) return;
    await onSave(v === "" ? null : Number(v));
  };
  return (
    <div className="ns-score-item">
      <div className="ns-score-num">
        {editing ? (
          <input
            ref={input}
            type="number"
            min={min}
            max={max}
            step={step}
            value={draft}
            aria-label={label}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <>
            {value ?? placeholder}
            <button
              aria-label={`Edit ${label.toLowerCase()}`}
              onClick={() => {
                setDraft(value == null ? "" : String(value));
                setEditing(true);
              }}
            >
              <Icon name="pencil" size={17} />
            </button>
          </>
        )}
      </div>
      <div className="ns-score-label">{label}</div>
      {note && <div className="ns-score-note">{note}</div>}
    </div>
  );
}

function ExamDatePicker({ progress, onPick }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const date = progress.nextExam;
  return (
    <span className="ns-countdown-date ns-pop-anchor" ref={box}>
      {date ? new Date(date.iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Tashkent" }) : "No date set"}
      <button aria-label="Change SAT date" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="swap" size={16} />
      </button>
      {open && (
        <div className="ns-pop ns-pop-right ns-date-pop" role="menu">
          <p className="ns-pop-title">Your SAT date</p>
          {progress.satDates.map((d) => (
            <button
              key={d.iso}
              role="menuitemradio"
              aria-checked={d.iso === date?.iso}
              className={`ns-menu-item ${d.iso === date?.iso ? "on" : ""}`}
              onClick={() => {
                setOpen(false);
                onPick(d.iso);
              }}
            >
              {d.label}
              {d.iso === date?.iso && <Icon name="check" size={16} strokeWidth={2.6} style={{ marginLeft: "auto" }} />}
            </button>
          ))}
          <Link to="/profile" role="menuitem" className="ns-menu-item" onClick={() => setOpen(false)}>
            Another date… <Icon name="chevronRight" size={15} style={{ marginLeft: "auto" }} />
          </Link>
        </div>
      )}
    </span>
  );
}

// A study-plan task. The mark isn't a button: the task finishes itself when the student's own
// work reaches its count (backend/weekPlan.js), and the bar shows how far that is.
function TaskCard({ task, onStart }) {
  return (
    <div className={`ns-task ${task.done ? "done" : ""}`}>
      <div className="ns-task-top">
        <span className="ns-task-check" role="img" aria-label={task.done ? "Done" : "Not done yet"}>
          {task.done && <Icon name="check" size={15} strokeWidth={3} />}
        </span>
        <span className="ns-task-title">{task.title}</span>
        {task.overdue && <span className="ns-tag2 carried">Carried over</span>}
        {task.overdue && <span className="ns-task-date">{fmtDay(task.date)}</span>}
      </div>
      <div className="ns-task-bottom">
        {task.section && <span className={`ns-tag2 ${SECTION_KEY[task.section]}`}>{SECTION_SHORT[task.section]}</span>}
        <span>
          <Icon name="clock" size={17} /> {task.minutes}m
        </span>
        <span className="ns-dotsep">{planTaskCount(task)}</span>
        {!task.done && (
          <button className="ns-btn ns-btn-soft ns-btn-sm" onClick={onStart}>
            {task.have ? "Continue" : "Start"} <Icon name="chevronRight" size={15} />
          </button>
        )}
      </div>
      {!task.done && (
        <div className="ns-progress thin" aria-hidden="true">
          <div style={{ width: `${(task.have / task.need) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

function SessionCard({ s, longest }) {
  return (
    <Link to="/analytics#sessions" className="ns-sess">
      <div className="ns-sess-top">
        {s.title} <Icon name="chevronRight" size={16} />
      </div>
      <div className="ns-sess-body">
        <div className="ns-sess-times">
          <span>Started {fmtTime(s.start)}</span>
          <span className="end">Ended {fmtTime(s.end)}</span>
        </div>
        <div className="ns-sess-dur">
          <b>{s.minutes}m</b>
          <small>
            {s.correct}/{s.count} correct
          </small>
          <div className="ns-sess-bar">
            <div style={{ width: `${Math.max(8, Math.round((s.minutes / longest) * 100))}%` }} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const { user, token } = useStudentAuth();
  const { progress, refresh } = useProgress();
  const { toast } = useToast();
  const [sessions, setSessions] = useState(null);
  const [pinned, setPinned] = useState([]);
  const nav = useNavigate();
  const cd = useCountdown(progress?.nextExam?.iso);
  const trophy = useTrophyCard(progress?.badges);

  useEffect(() => {
    studySessions(token, 12)
      .then((d) => setSessions(d.sessions))
      .catch(() => setSessions([]));
    studentAnnouncements(token)
      .then((d) => setPinned((d.announcements || []).filter((a) => a.pinned)))
      .catch(() => {});
  }, [token]);

  if (!progress) return <Loading />;

  const stats = progress.stats;
  const tasks = progress.plan.tasks;
  const overdue = tasks.filter((t) => t.overdue);
  // Most recent first; the rest are one click away in the plan.
  const overdueOpen = overdue.slice().reverse();
  const todays = tasks.filter((t) => t.isToday);
  const upcoming = tasks.filter((t) => !t.done && !t.overdue && !t.isToday);
  const nextUp = todays.find((t) => !t.done) || overdueOpen[0];
  const est = progress.estimate.total;
  const current = progress.currentScore ?? est;
  const { rw: estRw, math: estMath } = progress.estimate;
  const estNote = estRw?.source === estMath?.source ? ESTIMATE_NOTE[estRw?.source] : "From your mock tests and practice";

  const save = async (body, msg) => {
    try {
      await updateSettings(token, body);
      await refresh();
      if (msg) toast.success(msg);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const startToday = () => nav(nextUp ? planTaskUrl(nextUp) : playerUrl({ source: "drill", size: 10, from: "/dashboard" }));

  const day = (sessions || [])[0]?.date;
  const daySessions = (sessions || []).filter((s) => s.date === day).slice(0, 3);
  const longest = Math.max(1, ...daySessions.map((s) => s.minutes));
  const weakest = progress.topics.filter((t) => t.attempts >= 1).slice(0, 5);

  return (
    <div className="ns-home ns-page">
      <div className="ns-hero-row">
        <div className="ns-hello">
          <h1>
            {greeting()}, <span>{user?.firstName}</span>
          </h1>
          <div className="ns-hello-actions">
            <button className="ns-btn ns-btn-primary" onClick={startToday}>
              <Icon name="play2" size={16} /> Start today's session
            </button>
            <Link to="/plan" className="ns-btn ns-btn-outline">
              See weekly plan <Icon name="chevronRight" size={16} />
            </Link>
          </div>
        </div>
        <div className="ns-countdown">
          <div className="ns-countdown-label">
            SAT Countdown
            <br />
            <ExamDatePicker progress={progress} onPick={(iso) => save({ examDate: iso }, "SAT date updated")} />
          </div>
          {cd && (
            <div className="ns-countdown-nums" aria-label={`${cd.days} days, ${cd.hours} hours and ${cd.minutes} minutes until your SAT`}>
              {[
                [cd.days, "days"],
                [String(cd.hours).padStart(2, "0"), "hrs"],
                [String(cd.minutes).padStart(2, "0"), "min"]
              ].map(([v, l]) => (
                <div key={l}>
                  <b>{v}</b>
                  <span>{l}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ClassPrompt progress={progress} />

      <DailyPrompt daily={progress.daily} />

      <ReviewPrompt review={progress.review} />

      <RecapPrompt recap={progress.recap} />

      <DiagnosticPrompt status={progress.diagnostic} exam="sat" dismissKey="ns_diag_hide_sat" />

      {pinned.length > 0 && (
        <div className="ns-news-banner">
          <Icon name="megaphone" size={22} />
          <div>
            <b>{pinned[0].title}</b>
            <p>{pinned[0].body}</p>
          </div>
        </div>
      )}

      <section>
        <div className="ns-section-head">
          <h2>
            <Icon name="chart" size={22} /> Analytics
          </h2>
          <Link to="/analytics" className="ns-pill-btn">
            View all analytics
          </Link>
        </div>
        <div className="ns-stats">
          <div className="ns-stat2">
            <span className="ns-stat2-label">Questions Attempted</span>
            <div className="ns-stat2-row">
              <span className="ns-stat2-value">{stats.attempts.toLocaleString("en-US")}</span>
            </div>
          </div>
          <div className="ns-stat2">
            <span className="ns-stat2-label">Current Accuracy</span>
            <div className="ns-stat2-row">
              <span className="ns-stat2-value">{pct(stats.accuracy)}</span>
            </div>
          </div>
          <div className="ns-stat2">
            <span className="ns-stat2-label">Saved Questions</span>
            <div className="ns-stat2-row">
              <span className="ns-stat2-value">{stats.flagged}</span>
              <Link to={stats.flagged ? playerUrl({ source: "flagged", from: "/dashboard" }) : "/mistakes"} className="ns-pill-btn sm">
                View
              </Link>
            </div>
          </div>
          <div className="ns-stat2">
            <span className="ns-stat2-label">Recent Errors</span>
            <div className="ns-stat2-row">
              <span className="ns-stat2-value">{stats.recentErrors}</span>
              {stats.recentErrors > 0 && (
                <Link to={playerUrl({ source: "errors", from: "/dashboard" })} className="ns-pill-btn sm">
                  Start Review
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="ns-two-col">
        <div className="ns-col">
          <section>
            <div className="ns-section-head">
              <h2>
                <Icon name="checklist" size={22} /> My Study Plan
              </h2>
              <Link to="/plan" className="ns-pill-btn">
                View full plan
              </Link>
            </div>
            {overdueOpen.length > 0 && (
              <>
                <p className="ns-plan-when">Carried over</p>
                <div className="ns-tasks" style={{ marginBottom: 22 }}>
                  {overdueOpen.slice(0, 2).map((t) => (
                    <TaskCard key={t.index} task={t} onStart={() => nav(planTaskUrl(t))} />
                  ))}
                  {overdueOpen.length > 2 && (
                    <Link to="/plan" className="ns-more-link">
                      +{overdueOpen.length - 2} more still open in your plan <Icon name="chevronRight" size={15} />
                    </Link>
                  )}
                </div>
              </>
            )}
            <p className="ns-plan-when">Today · {fmtDay(progress.today.date)}</p>
            <div className="ns-tasks">
              {todays.map((t) => (
                <TaskCard key={t.index} task={t} onStart={() => nav(planTaskUrl(t))} />
              ))}
              {todays.every((t) => t.done) && upcoming[0] && (
                <>
                  <p className="ns-plan-when" style={{ margin: "6px 0 0" }}>
                    Up next · {fmtDay(upcoming[0].date)}
                  </p>
                  <TaskCard task={upcoming[0]} onStart={() => nav(planTaskUrl(upcoming[0]))} />
                </>
              )}
            </div>
          </section>

          {/* The three skills worth the most raw questions on test day (the point-gap map). */}
          {progress.worthMost?.length > 0 && (
            <section>
              <div className="ns-section-head">
                <h2>
                  <Icon name="northStar" size={22} /> Worth the most points for you
                </h2>
                <Link to="/gap" className="ns-pill-btn">
                  Point-gap map
                </Link>
              </div>
              <div className="ns-card2 ns-worth">
                {progress.worthMost.map((t) => (
                  <Link key={t.skill} to={playerUrl({ source: "drill", sec: SECTION_KEY[t.section], skills: [t.skill], size: 10, from: "/dashboard" })}>
                    <div>
                      <b>{t.skill}</b>
                      <span>
                        {SECTION_SHORT[t.section]} · {pct(t.accuracy)} now
                      </span>
                    </div>
                    <em>
                      about +{t.gain} question{t.gain === 1 ? "" : "s"}
                    </em>
                    <Icon name="chevronRight" size={16} />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {weakest.length > 0 && (
            <section>
              <div className="ns-section-head">
                <h2>
                  <Icon name="target" size={22} /> Focus skills
                </h2>
                <Link to="/practice" className="ns-pill-btn">
                  Question Bank
                </Link>
              </div>
              <div className="ns-skillbars ns-card2" style={{ padding: 8 }}>
                {weakest.map((t) => (
                  <Link key={t.topic} to={playerUrl({ source: "drill", sec: SECTION_KEY[t.section], skills: [t.topic], size: 10, from: "/dashboard" })} className="ns-skillbar">
                    <span>{t.topic}</span>
                    <div className="ns-skillbar-track">
                      <div className={accClass(t.accuracy)} style={{ width: `${Math.round(t.accuracy * 100)}%` }} />
                    </div>
                    <b>{pct(t.accuracy)}</b>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="ns-col">
          <div className="ns-score">
            <EditableScore
              value={current}
              label="Current Score"
              note={progress.currentScore == null && est ? estNote : progress.currentScore == null ? "Take the diagnostic test, or add your latest SAT or PSAT score" : null}
              onSave={(v) => save({ currentScore: v }, "Current score saved")}
            />
            <EditableScore value={progress.targetScore} label="Target Score" onSave={(v) => save({ targetScore: v ?? 1400 }, "Target score saved")} />
            <TargetArt />
          </div>

          <SkyCard
            progress={progress}
            onRepair={() => nav(playerUrl({ source: "repair", from: "/dashboard" }))}
            onFirstStar={() => nav(playerUrl({ source: "drill", size: 10, from: "/dashboard" }))}
          />

          <LeagueCard token={token} />

          <section>
            <div className="ns-section-head">
              <h2>
                <Icon name="clock" size={22} /> Study Sessions
              </h2>
              <Link to="/analytics#sessions" className="ns-pill-btn">
                View all sessions
              </Link>
            </div>
            {!sessions ? null : daySessions.length === 0 ? (
              <div className="ns-empty2">
                <EmptyArt name="note" />
                <b>No sessions yet</b>
                Your practice sessions show up here with their start and end times.
              </div>
            ) : (
              <>
                <p className="ns-sess-day">{fmtDay(day)}</p>
                <div className="ns-sess-list">
                  {daySessions.map((s) => (
                    <SessionCard key={s.start} s={s} longest={longest} />
                  ))}
                </div>
              </>
            )}
          </section>

          <section>
            <div className="ns-section-head">
              <h2>
                <Icon name="trophy" size={22} /> Trophies
              </h2>
              <Link to="/trophies" className="ns-pill-btn">
                All trophies
              </Link>
            </div>
            <div className="ns-trophy-row">
              {progress.badges
                .slice()
                .sort((a, b) => Number(b.earned) - Number(a.earned) || (b.earnedAt || "").localeCompare(a.earnedAt || ""))
                .slice(0, 4)
                .map((b) =>
                  b.earned ? (
                    <button key={b.id} type="button" className="ns-badge-mini earned" title={b.desc} aria-haspopup="dialog" onClick={() => trophy.open(b.id)}>
                      <Medal id={b.id} size={48} />
                      <small>{b.name}</small>
                    </button>
                  ) : (
                    <div key={b.id} className="ns-badge-mini" title={b.desc}>
                      <Medal id={b.id} earned={false} size={48} />
                      <small>{b.name}</small>
                    </div>
                  )
                )}
            </div>
          </section>
        </div>
      </div>
      {trophy.card}
    </div>
  );
}
