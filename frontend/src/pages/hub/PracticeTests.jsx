import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { startPracticeTest } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import { fmtDate } from "./hubUtils.js";
import { SCOPE_NAME, minutesLabel, moduleShort, resultsUrl, runUrl, sittingLabel } from "../practicetest/ptUtils.js";
import "../../mock.css";
import "../../practicetest.css";

// The practice tests on the Practice Tests page (/mock, its first tab): one card per test, and the dialog a
// test is started from. A student chooses what to sit (the whole test, or one of its two
// sections) and whether it is timed. See backend/practiceTests.js.

// Card tints: the sidebar's colour family (blue, indigo, violet, orchid), in turn.
const TINTS = ["#4f7df3", "#6a63ec", "#8a5fe6", "#b05fd6"];

const SCOPES = [
  ["full", "Full test", "All four modules, as on test day"],
  ["rw", "Reading and Writing", "The section's two modules"],
  ["math", "Math", "The section's two modules"]
];
const TIMINGS = [
  [true, "Timed", "timer", "Each module has its own clock and is handed in when it runs out, like the real test."],
  [false, "Untimed", "stopwatch", "No clock. Take as long as you need; a stopwatch shows the time you spend."]
];

const scopeModules = (test, scope) => test.modules.filter((m) => scope === "full" || m.section === scope);
// Attempts that were sat to an end. A cancelled one (the student left a locked module) has no
// score and no answers to review: it is only listed.
const satAttempts = (test) => test.attempts.filter((a) => a.status !== "cancelled");
// "1310", "R&W 690", or the raw count when a section wasn't finished.
function scoreText(run) {
  if (run.status === "cancelled") return "Cancelled";
  if (run.total != null) return String(run.total);
  if (run.rw != null) return `R&W ${run.rw}`;
  if (run.math != null) return `Math ${run.math}`;
  return run.count ? `${run.correct}/${run.count}` : "—";
}

function Choice({ name, checked, onPick, title, text, icon, meta }) {
  return (
    <label className={`pt-choice ${checked ? "on" : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onPick} />
      {icon && (
        <span className="pt-choice-icon">
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className="pt-choice-main">
        <b>{title}</b>
        <small>{text}</small>
      </span>
      {meta && <span className="pt-choice-meta">{meta}</span>}
    </label>
  );
}

// What to sit, and how. Remembers the last choice on this device.
function StartDialog({ test, onClose }) {
  const { token } = useStudentAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const card = useRef(null);
  const [scope, setScope] = useState(() => {
    try {
      const v = localStorage.getItem("pt_scope");
      return SCOPES.some(([k]) => k === v) ? v : "full";
    } catch {
      return "full";
    }
  });
  const [timed, setTimed] = useState(() => {
    try {
      return localStorage.getItem("pt_timed") !== "0";
    } catch {
      return true;
    }
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    card.current?.focus({ preventScroll: true });
    const esc = (e) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose, busy]);

  const mods = scopeModules(test, scope);
  const questions = mods.reduce((s, m) => s + m.questions, 0);
  const minutes = mods.reduce((s, m) => s + m.minutes, 0);

  const start = async () => {
    setBusy(true);
    try {
      localStorage.setItem("pt_scope", scope);
      localStorage.setItem("pt_timed", timed ? "1" : "0");
    } catch {
      // not remembered next time
    }
    try {
      const { run } = await startPracticeTest(token, test.key, { scope, timed });
      nav(runUrl(run.id));
    } catch (e) {
      toast.error(e.message);
      setBusy(false);
      // Already in progress (started in another tab): the list shows it with a Resume button.
      if (e.code === "OPEN") onClose(true);
    }
  };

  return createPortal(
    <div className="pt-dialog-back" onMouseDown={() => !busy && onClose()}>
      <div className="pt-dialog" role="dialog" aria-modal="true" aria-label={`Start ${test.title}`} tabIndex={-1} ref={card} onMouseDown={(e) => e.stopPropagation()}>
        <div className="pt-dialog-head">
          <div>
            <span className="pt-kicker">
              <Icon name="mock" size={16} /> Practice test
            </span>
            <h2>{test.title}</h2>
          </div>
          <button className="pt-dialog-close" onClick={() => onClose()} aria-label="Close" disabled={busy}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <fieldset className="pt-field">
          <legend>What do you want to sit?</legend>
          {SCOPES.map(([key, title, text]) => {
            const list = scopeModules(test, key);
            if (!list.length) return null;
            return (
              <Choice
                key={key}
                name="pt-scope"
                checked={scope === key}
                onPick={() => setScope(key)}
                title={title}
                text={text}
                meta={`${list.reduce((s, m) => s + m.questions, 0)} questions`}
              />
            );
          })}
        </fieldset>

        <fieldset className="pt-field">
          <legend>Timed or untimed?</legend>
          <div className="pt-pair">
            {TIMINGS.map(([value, title, icon, text]) => (
              <Choice key={title} name="pt-timed" checked={timed === value} onPick={() => setTimed(value)} title={title} text={text} icon={icon} />
            ))}
          </div>
        </fieldset>

        <p className="pt-dialog-sum">
          <b>
            {mods.length} modules · {questions} questions{timed ? ` · ${minutesLabel(minutes)}` : " · no time limit"}
          </b>
          {timed ? " A module's clock starts when you open it." : " You can stop between modules and carry on another day."} Each module is locked while you
          sit it: leave the page before you hand it in and the attempt is cancelled. Answers and explanations come at the end.
        </p>

        <div className="pt-dialog-actions">
          <button className="ns-btn ns-btn-outline" onClick={() => onClose()} disabled={busy}>
            Cancel
          </button>
          <button className="ns-btn ns-btn-primary" onClick={start} disabled={busy}>
            {busy ? "Setting it up…" : `Start ${scope === "full" ? "the full test" : SCOPE_NAME[scope]}`} <Icon name="chevronRight" size={18} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function stateOf(test) {
  if (test.open) return { key: "going", label: `In progress · ${sittingLabel(test.open).toLowerCase()}` };
  const sat = satAttempts(test).length;
  if (sat) return { key: "done", label: sat === 1 ? "Sat once" : `Sat ${sat} times` };
  return { key: "ready", label: test.attempts.length ? "Not finished yet" : "Not started" };
}

// What a stop on the card's route says. Marks are only shown for a finished attempt.
function stopNote(m, shown, open) {
  if (!shown) return `${m.minutes} min · ${m.questions} Qs`;
  if (shown.status === "completed") return open ? "Handed in" : `${shown.raw}/${m.questions} correct`;
  if (shown.status === "in_progress") return "In progress";
  if (shown.status === "skipped") return "Not sat";
  return `${m.minutes} min · ${m.questions} Qs`;
}

function PracticeCard({ test, tint, onStart }) {
  const nav = useNavigate();
  const state = stateOf(test);
  // The route shows the sitting in progress, or else the latest finished one.
  const latest = satAttempts(test)[0] || null;
  const shownRun = test.open || latest;
  const next = test.open?.modules.find((m) => m.status === "in_progress" || m.status === "not_started");
  const best = test.best.total ?? null;

  return (
    <article className="ns-fl-card" style={{ "--tint": tint }}>
      <div className="ns-fl-art">
        <div className="ns-fl-sheet">
          <div className="ns-fl-sheet-top">
            <span className={`ns-fl-state ${state.key}`}>
              <i /> {state.label}
            </span>
            <span className="ns-fl-time">
              <Icon name="clock" size={15} /> {minutesLabel(test.minutes)}
            </span>
          </div>
          <ol className="ns-fl-route pt-route">
            {test.modules.map((m) => {
              const shown = shownRun?.modules.find((x) => x.key === m.key) || null;
              const status = shown?.status === "skipped" ? "not_started" : shown?.status || "not_started";
              return (
                <li key={m.key} className={`ns-fl-stop ${status}${next && next.key === m.key ? " next" : ""}${shownRun && !shown ? " pt-out" : ""}`}>
                  <span className="ns-fl-node">{status === "completed" ? <Icon name="check" size={15} /> : test.modules.indexOf(m) + 1}</span>
                  <b>{moduleShort(test.modules, m)}</b>
                  <small>{stopNote(m, shown, Boolean(test.open))}</small>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="ns-fl-body">
        <div className="ns-fl-head">
          <h3>{test.title}</h3>
          {test.difficulty && <span className={`ns-fl-diff ${test.difficulty.toLowerCase()}`}>{test.difficulty}</span>}
          {best != null && <span className="pt-best">Best {best}</span>}
        </div>
        {/* A test made in the studio can carry a line about itself. */}
        {test.description && <p className="ns-fl-desc">{test.description}</p>}
        <p className="ns-fl-meta">
          {test.modules.length} modules · {test.questions} questions
          {best == null && test.best.rw != null ? ` · best R&W ${test.best.rw}` : ""}
          {best == null && test.best.math != null ? ` · best Math ${test.best.math}` : ""}
        </p>

        {test.attempts.length > 0 && (
          <ul className="pt-attempts" aria-label="Your attempts">
            {test.attempts.slice(0, 3).map((a) => (
              <li key={a.id}>
                <Link to={resultsUrl(a.id)}>
                  <b>{scoreText(a)}</b>
                  <span>
                    {sittingLabel(a)} · {fmtDate(a.finishedAt)}
                    {a.status === "ended" ? " · ended early" : ""}
                    {a.status === "cancelled" ? ` · you ${a.cancelled?.reason || "left the test page"}` : ""}
                  </span>
                  <Icon name="chevronRight" size={16} />
                </Link>
              </li>
            ))}
            {test.attempts.length > 3 && <li className="pt-attempts-more">and {test.attempts.length - 3} earlier</li>}
          </ul>
        )}

        <div className="ns-fl-actions">
          {test.open ? (
            <button className="ns-btn ns-btn-primary" onClick={() => nav(runUrl(test.open.id))}>
              Resume <Icon name="chevronRight" size={18} />
            </button>
          ) : (
            <button className="ns-btn ns-btn-primary" aria-label={`${test.attempts.length ? "Sit" : "Start"} ${test.title}${test.attempts.length ? " again" : ""}`} onClick={() => onStart(test)}>
              {test.attempts.length ? "Sit it again" : "Start"} <Icon name="chevronRight" size={18} />
            </button>
          )}
          {latest && !test.open && (
            <button className="ns-pill-btn" onClick={() => nav(resultsUrl(latest.id))}>
              Review answers
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// `tests` is GET /api/practice-tests. `onChange` reloads it (a sitting turned out to be in progress already).
export default function PracticeTestCards({ tests, onChange }) {
  const [starting, setStarting] = useState(null);

  return (
    <>
      <div className="ns-fl-note">
        <Nova size={56} mood="explain" />
        <div>
          <h2>Sit one whenever you like</h2>
          <p>
            A test follows the digital SAT's shape: Reading and Writing modules, then Math modules. Sit the whole test or just one section, timed like
            test day or with no clock. A module is locked while you sit it: it opens in full screen, and switching to another tab, window or app, or closing
            or reloading the page, cancels the attempt. Nothing is marked until the end, when you get your score and every question with its answer. The
            score is an estimate for planning your study, not an official College Board score.
          </p>
        </div>
      </div>

      <div className="ns-fl-grid">
        {tests.map((t, i) => (
          <PracticeCard key={t.key} test={t} tint={TINTS[i % TINTS.length]} onStart={setStarting} />
        ))}
      </div>

      {starting && (
        <StartDialog
          test={starting}
          onClose={(changed) => {
            setStarting(null);
            if (changed) onChange?.();
          }}
        />
      )}
    </>
  );
}
