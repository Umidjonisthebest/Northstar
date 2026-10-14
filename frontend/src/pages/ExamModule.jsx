import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getModule, leaveExam, saveModuleAnswers, submitModule } from "../api.js";
import { useStudentAuth } from "../context/AuthContext.jsx";
import { SkeletonExam } from "../components/Skeleton.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import Icon from "../components/Icon.jsx";
import QuestionFigure from "../components/QuestionFigure.jsx";
import MathText from "../components/MathText.jsx";
import GraphingCalculator from "../components/calculator/GraphingCalculator.jsx";
import { ghostLine } from "./examGhost.js";
import { LockEnded, LockGate } from "../lock/LockScreens.jsx";
import { exitFullscreen, useExamLock, useLeaveReport } from "../lock/useExamLock.js";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const STORAGE_KEY = "satmock_exam_";
const AUTO_SAVE_DELAY = 1000;
const SERVER_SAVE_DELAY = 4000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = "sine";
    gainNode.gain.value = 0.1;
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.2);
    oscillator.onended = () => ctx.close();
  } catch {
    // ignore audio errors
  }
}

// Exam mode is game-free: no XP, badges, level-ups or confetti here. What a
// module earns is queued on the server and shown on the results page.
// The one optional extra is the ghost run: pacing against the student's own
// previous attempt at this test, off until they ask for it.
export default function ExamModule() {
  const { sessionId, moduleId } = useParams();
  const { token, user } = useStudentAuth();
  const nav = useNavigate();
  // Per student: on a shared computer, one student's unfinished answers must never be
  // pre-filled for the next person who signs in and opens the same module.
  const storageKey = `${STORAGE_KEY}${user?.id || "anon"}_${sessionId}_${moduleId}`;

  const [mod, setMod] = useState(null);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [totalSeconds, setTotalSeconds] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [timeWarning5, setTimeWarning5] = useState(false);
  const [timeWarning1, setTimeWarning1] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("saved");
  const [onServer, setOnServer] = useState(false); // the server has the latest answers
  const lastServerSaveRef = useRef("");
  const [textSize, setTextSize] = useState(() => {
    // The slider runs 80–150. A stored value outside that (or not a number) used to set the whole
    // exam's scale to NaN.
    const saved = parseInt(localStorage.getItem("satmock_exam_textSize"), 10);
    return Number.isFinite(saved) && saved >= 80 && saved <= 150 ? saved : 100;
  });
  const submittedRef = useRef(false);
  const mountedRef = useRef(true); // a submit that is still retrying must stop once the page is left
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const answersRef = useRef({});
  const flaggedRef = useRef(new Set());
  const autoSaveTimeoutRef = useRef(null);
  const warning5PlayedRef = useRef(false);
  const warning1PlayedRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);
  // The clock is a fixed deadline, not a chain of 1-second timeouts: browsers throttle timers
  // in background tabs (to once a minute), which left the countdown far behind the server's.
  const deadlineRef = useRef(0);
  const prevLeftRef = useRef(null);
  // Per-question timestamps, in seconds from the module's start: when each
  // question was first opened and last answered. Sent with the submission.
  const timesRef = useRef({});
  const startedAtRef = useRef(0);
  const [ghostOpen, setGhostOpen] = useState(false);
  // The Desmos calculator, on modules that have one (`mod.calculator`: Math, unless the teacher changed it).
  const [calcOpen, setCalcOpen] = useState(false);
  const elapsedNow = useCallback(() => Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)), []);

  // The test lock (lock/useExamLock.js): the module must stay open and in front until it is
  // handed in. The first time it isn't, the whole sitting is cancelled on the server and this
  // screen is over. A teacher can let the student back in (a new `lockRound`).
  const lockRoundRef = useRef(0);
  const { ended, end: endTest, show: showCancelled, resume: resumeLeave } = useLeaveReport(`mock:${sessionId}`, (kind, round) => leaveExam(token, sessionId, kind, round));
  const lock = useExamLock({
    active: Boolean(mod) && secondsLeft !== null && !submitting && !ended,
    onLeave: (kind) => {
      submittedRef.current = true; // nothing more is saved or handed in from here
      endTest(kind, lockRoundRef.current);
    }
  });

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    flaggedRef.current = flagged;
  }, [flagged]);

  const saveToStorage = useCallback(() => {
    const data = {
      answers: answersRef.current,
      flagged: Array.from(flaggedRef.current),
      current,
      times: timesRef.current,
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // Storage is full or refused. The answers still go to the server at submit, so say
      // nothing; the "saved on this device" note simply isn't claimed.
      setAutoSaveStatus("unsaved");
      return;
    }
    setAutoSaveStatus("saving");
    setTimeout(() => setAutoSaveStatus("saved"), 500);
  }, [current, storageKey]);

  useEffect(() => {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(saveToStorage, AUTO_SAVE_DELAY);
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [answers, flagged, current, saveToStorage]);

  // Autosave to the server too: it holds the answers if this browser's copy is lost, and a hand-in
  // that arrives after the clock is graded on them. Sent a few seconds after the last change, and
  // when the tab is hidden or closed. A failed save is silent: the next one tries again, and the
  // footer keeps saying "on this device" until one gets through.
  const saveToServer = useCallback(
    (keepalive = false) => {
      if (!mod || submittedRef.current) return;
      const body = answersRef.current;
      const signature = JSON.stringify(body);
      if (signature === lastServerSaveRef.current) return;
      saveModuleAnswers(token, sessionId, moduleId, body, keepalive)
        .then(() => {
          lastServerSaveRef.current = signature;
          if (mountedRef.current) setOnServer(true);
        })
        .catch((err) => {
          if (!mountedRef.current) return;
          // Cancelled from somewhere else (the same test left on another device).
          if (err.code === "CANCELLED") {
            submittedRef.current = true;
            showCancelled();
          } else setOnServer(false);
        });
    },
    [mod, token, sessionId, moduleId, showCancelled]
  );
  useEffect(() => {
    const id = setTimeout(() => saveToServer(false), SERVER_SAVE_DELAY);
    return () => clearTimeout(id);
  }, [answers, saveToServer]);
  useEffect(() => {
    const flush = () => document.visibilityState !== "visible" && saveToServer(true);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [saveToServer]);

  useEffect(() => {
    try {
      localStorage.setItem("satmock_exam_textSize", textSize.toString());
    } catch {
      // not remembered next time; the exam still scales
    }
    document.documentElement.style.setProperty("--exam-text-scale", textSize / 100);
  }, [textSize]);

  useEffect(() => {
    setMod(null);
    setError("");
    setSubmitError("");
    submittedRef.current = false;
    warning5PlayedRef.current = false;
    warning1PlayedRef.current = false;
    prevLeftRef.current = null;
    lastSubmitTimeRef.current = 0;
    setGhostOpen(false);
    setCalcOpen(false);

    // Pick up where a reload left off: answers, flags, position and timestamps.
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || "{}") || {};
    } catch {
      saved = {}; // corrupt storage: start clean
    }
    // Blank entries (a grid-in cleared before the reload) are not answers.
    const restored = {};
    if (saved.answers && typeof saved.answers === "object") {
      for (const [id, v] of Object.entries(saved.answers)) if (!(typeof v === "string" && !v.trim())) restored[id] = v;
    }
    setAnswers(restored);
    setFlagged(new Set(Array.isArray(saved.flagged) ? saved.flagged : []));
    setCurrent(Number.isInteger(saved.current) && saved.current >= 0 ? saved.current : 0);
    timesRef.current = saved.times && typeof saved.times === "object" ? saved.times : {};

    // A reply for a module the student has already left must not be applied to the next one.
    let alive = true;
    getModule(token, sessionId, moduleId)
      .then((data) => {
        if (!alive) return;
        lockRoundRef.current = data.lockRound || 0;
        // A leave this browser saw but never got to the server (it was offline, or the page was
        // closed first): the test is over, and the report goes out now.
        if (resumeLeave(lockRoundRef.current)) {
          submittedRef.current = true;
          return;
        }
        // The module's clock runs on the server, so the start is worked back from what is left.
        startedAtRef.current = Date.now() - (data.timeLimitMinutes * 60 - data.remainingSeconds) * 1000;
        deadlineRef.current = Date.now() + data.remainingSeconds * 1000;
        setCurrent((c) => Math.min(c, Math.max(0, data.questions.length - 1)));
        // Answers the server kept from autosave fill in anything this browser doesn't have (a new
        // device, cleared storage). This browser's own copy wins where both have an answer.
        if (data.savedAnswers && Object.keys(data.savedAnswers).length) setAnswers((prev) => ({ ...data.savedAnswers, ...prev }));
        setMod(data);
        setSecondsLeft(data.remainingSeconds);
        setTotalSeconds(data.timeLimitMinutes * 60);
      })
      .catch((err) => {
        if (!alive) return;
        if (err.code === "CANCELLED") showCancelled();
        else setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [token, sessionId, moduleId, storageKey, resumeLeave, showCancelled]);

  useEffect(() => {
    const shown = mod?.questions[current];
    if (!shown) return;
    const t = timesRef.current[shown.id];
    if (t?.seen === undefined) timesRef.current[shown.id] = { ...t, seen: elapsedNow() };
  }, [mod, current, elapsedNow]);

  // Every answer goes through here, so the time it was given is kept with it.
  const answerQuestion = useCallback(
    (questionId, value) => {
      // A grid-in cleared back to blank is "unanswered", not an answer of "" (that inflated the
      // answered count, the nav pill and the submit dialog).
      const blank = typeof value === "string" && !value.trim();
      if (!blank) timesRef.current[questionId] = { ...timesRef.current[questionId], answered: elapsedNow() };
      setAnswers((prev) => {
        if (!blank) return { ...prev, [questionId]: value };
        if (!(questionId in prev)) return prev;
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    },
    [elapsedNow]
  );

  // Tick against the fixed deadline, and re-read it the moment the tab becomes visible again.
  useEffect(() => {
    if (!mod) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [mod]);

  // Time's up: hand in whatever is on screen.
  useEffect(() => {
    if (secondsLeft === 0) handleSubmit(true);
    // handleSubmit only reads refs and values fixed for this module, so a stale copy is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  // Five-minute and one-minute warnings fire when the clock *crosses* the mark, so a jump of
  // several seconds (a throttled tab waking up) can't skip them, and a module resumed with 4
  // minutes left doesn't announce "5 min".
  useEffect(() => {
    if (secondsLeft === null) return;
    const prev = prevLeftRef.current;
    prevLeftRef.current = secondsLeft;
    if (prev === null) return;
    if (!warning5PlayedRef.current && prev > 300 && secondsLeft <= 300) {
      warning5PlayedRef.current = true;
      setTimeWarning5(true);
      playBeep();
      setTimeout(() => setTimeWarning5(false), 3000);
    }
    if (!warning1PlayedRef.current && prev > 60 && secondsLeft <= 60) {
      warning1PlayedRef.current = true;
      setTimeWarning1(true);
      playBeep();
      setTimeout(() => setTimeWarning1(false), 5000);
    }
  }, [secondsLeft]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (!mod || showSubmitConfirm || submitting) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.closest?.(".gcalc")) return;

      switch (e.key) {
        case "ArrowRight":
        case "n":
        case "N":
          if (current < mod.questions.length - 1) setCurrent((c) => c + 1);
          break;
        case "ArrowLeft":
        case "p":
        case "P":
          if (current > 0) setCurrent((c) => c - 1);
          break;
        case "f":
        case "F":
          toggleFlag();
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6": {
          const idx = parseInt(e.key, 10) - 1;
          const q = mod.questions[current];
          if (q.type === "mcq" && idx < q.options.length) answerQuestion(q.id, idx);
          break;
        }
        case "Enter":
          if (e.ctrlKey || e.metaKey) handleSubmit(false);
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mod, current, showSubmitConfirm, submitting]);

  const toggleFlag = useCallback(() => {
    setFlagged((prev) => {
      const next = new Set(prev);
      const q = mod.questions[current];
      if (next.has(q.id)) next.delete(q.id);
      else next.add(q.id);
      return next;
    });
  }, [mod, current]);

  async function handleSubmit(auto = false) {
    if (submittedRef.current) return;
    if (!auto) {
      // Only opening the confirm dialog is debounced. The real submit must never be swallowed:
      // with the debounce on both paths a quick "Yes, submit", or time running out right after a
      // click, silently did nothing.
      const now = Date.now();
      if (now - lastSubmitTimeRef.current < 1000) return;
      lastSubmitTimeRef.current = now;
      setShowSubmitConfirm(true);
      return;
    }
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    const finish = () => {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // nothing to clean up
      }
      // The module is handed in: the lock is off until the next one starts.
      exitFullscreen();
      nav(`/exam/${sessionId}`);
    };
    // A dropped connection or a server hiccup must not cost the student their answers. Retry a
    // few times first (they are still on screen), and only then say so and offer "Try again".
    for (let attempt = 0; ; attempt++) {
      try {
        await submitModule(token, sessionId, moduleId, answersRef.current, timesRef.current);
        return finish();
      } catch (err) {
        if (!mountedRef.current) return;
        // An earlier try got through even though its reply never arrived.
        if (err.status === 400 && /already submitted/i.test(err.message)) return finish();
        if (err.code === "CANCELLED") {
          setSubmitting(false);
          return showCancelled();
        }
        const transient = err.code === "NETWORK" || err.status >= 500;
        if (!transient || attempt >= 4) {
          setSubmitError(err.code === "NETWORK" ? "Your answers haven't been sent yet: no connection to the server. They are still here." : `${err.message} Your answers are still here.`);
          submittedRef.current = false;
          setSubmitting(false);
          return;
        }
        await sleep(1200 * (attempt + 1));
        if (!mountedRef.current) return;
      }
    }
  }

  function handleConfirmSubmit() {
    setShowSubmitConfirm(false);
    handleSubmit(true);
  }

  // The student left the test: nothing of it stays on the screen.
  if (ended) return <LockEnded ended={ended} kind="mock" backLabel="Back to the test's page" onBack={() => nav(`/exam/${sessionId}`)} />;

  if (error) {
    return (
      <div className="center-screen">
        <div className="login-card">
          <h1>Couldn't load this module</h1>
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={() => nav("/dashboard")}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!mod || secondsLeft === null) return <SkeletonExam />;

  const q = mod.questions[current];
  const answeredCount = Object.keys(answers).length;
  const flaggedCount = flagged.size;
  const progress = totalSeconds ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;
  const low = secondsLeft <= 300;
  const isFlagged = flagged.has(q.id);

  function setAnswer(value) {
    answerQuestion(q.id, value);
  }

  const totalQuestions = mod.questions.length;

  return (
    <div className="exam-shell">
      <header className="exam-header">
        <div className="exam-brand">
          <span className="tag">SAT</span>
          {mod.name}
        </div>
        <div className="exam-header-right">
          {mod.calculator && (
            <button type="button" className="exam-calc-btn" aria-pressed={calcOpen} title="Graphing calculator" onClick={() => setCalcOpen((o) => !o)}>
              <Icon name="calc" size={17} /> <span>Calculator</span>
            </button>
          )}
          <div className="exam-accessibility">
            <ThemeToggle />
            <div className="text-size-control" title="Text size">
              <span className="text-size-label">A</span>
              <input
                type="range"
                min="80"
                max="150"
                step="5"
                value={textSize}
                onChange={(e) => setTextSize(parseInt(e.target.value, 10))}
                aria-label="Text size"
              />
              <span className="text-size-label large">A</span>
            </div>
          </div>
          <div className={"exam-timer" + (low ? " low" : "") + (timeWarning5 || timeWarning1 ? " warning" : "")}>
            {formatTime(secondsLeft)}
            {timeWarning5 && <span className="timer-warning"><Icon name="warning" size={13} /> 5 min</span>}
            {timeWarning1 && <span className="timer-warning"><Icon name="warning" size={13} /> 1 min</span>}
          </div>
          <div className="progress-ring" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle
                className="progress-ring-bg"
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="var(--border)"
                strokeWidth="4"
              />
              <circle
                className="progress-ring-fill"
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke={low ? "var(--danger)" : "var(--primary)"}
                strokeWidth="4"
                strokeDasharray={113.1}
                strokeDashoffset={113.1 * (1 - progress / 100)}
                strokeLinecap="round"
                style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
          </div>
        </div>
      </header>

      <div className="exam-progress-bar" role="progressbar" aria-valuenow={answeredCount} aria-valuemin={0} aria-valuemax={totalQuestions}>
        <div className="exam-progress-fill" style={{ width: `${(answeredCount / totalQuestions) * 100}%` }} />
        <div className="exam-progress-labels">
          <span>{answeredCount}/{totalQuestions} answered</span>
          {flaggedCount > 0 && <span className="flagged-count"><Icon name="flag" size={13} /> {flaggedCount} flagged</span>}
        </div>
      </div>

      {submitError && (
        <div className="exam-submit-error" role="alert">
          <Icon name="warning" size={16} />
          <span>{submitError}</span>
          <button className="btn btn-primary btn-sm" onClick={() => handleSubmit(true)} disabled={submitting}>
            {submitting ? "Sending…" : "Try again"}
          </button>
        </div>
      )}

      <div className="exam-body">
        {(q.passage || q.passageImage) && (
          <div className="exam-pane passage">
            <div className="passage-header">
              <h3>Passage</h3>
              {isFlagged && <span className="question-flag" title="Flagged for review"><Icon name="flag" size={14} /></span>}
            </div>
            {q.passage && <div className="exam-divider-note passage-text">{q.passage}</div>}
            <QuestionFigure src={q.passageImage} alt="Figure for the passage" />
          </div>
        )}
        <div className="exam-pane" style={{ flex: q.passage || q.passageImage ? 1 : 1.4 }}>
          <div className="question-block">
            <div className="question-header">
              <span className="question-number">{q.order}</span>
              <MathText className="question-prompt" text={q.prompt} />
            </div>
            <QuestionFigure src={q.promptImage} alt="Figure for the question" />
            {isFlagged && <div className="flag-indicator"><Icon name="flag" size={14} /> This question is flagged for review</div>}

            {q.type === "mcq" &&
              q.options.map((opt, i) => (
                <div
                  key={i}
                  className={"option-row" + (answers[q.id] === i ? " selected" : "") + (isFlagged ? " flagged-question" : "")}
                  onClick={() => setAnswer(i)}
                  role="radio"
                  aria-checked={answers[q.id] === i}
                  aria-label={`Option ${LETTERS[i]}: ${opt}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setAnswer(i);
                    }
                  }}
                >
                  <span className="option-letter">{LETTERS[i]}</span>
                  <MathText text={opt} />
                  {answers[q.id] === i && <span className="option-check"><Icon name="check" size={14} strokeWidth={3} /></span>}
                </div>
              ))}

            {q.type === "grid_in" && (
              <div className="grid-in-wrapper">
                <label className="grid-in-label" htmlFor="grid-in-answer">Enter your numeric answer</label>
                <input
                  id="grid-in-answer"
                  className="grid-in-input"
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="e.g., 81 or 3/4"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                />
                <div className="grid-in-hint">Answers can be integers, decimals, or fractions (e.g., 3/4)</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="exam-footer">
        <div className="exam-footer-left">
          <button className="btn btn-secondary btn-sm" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)} aria-label="Previous question">
            ← Prev
          </button>
          <button className="btn btn-secondary btn-sm" disabled={current === mod.questions.length - 1} onClick={() => setCurrent((c) => c + 1)} aria-label="Next question">
            Next →
          </button>
          <button className="btn btn-ghost btn-sm flag-btn" onClick={toggleFlag} aria-pressed={isFlagged} aria-label={isFlagged ? "Unflag question" : "Flag for review"}>
            <Icon name="flag" size={14} /> {isFlagged ? "Flagged" : "Flag"}
          </button>
        </div>

        <div className="question-nav" role="navigation" aria-label="Question navigation">
          {mod.questions.map((qq, i) => (
            <button
              key={qq.id}
              className={"question-pill" + (answers[qq.id] !== undefined ? " answered" : "") + (flagged.has(qq.id) ? " flagged" : "") + (i === current ? " current" : "")}
              onClick={() => setCurrent(i)}
              aria-label={`Question ${qq.order}${answers[qq.id] !== undefined ? ", answered" : ""}${flagged.has(qq.id) ? ", flagged" : ""}${i === current ? ", current" : ""}`}
              aria-current={i === current ? "true" : "false"}
            >
              {qq.order}
              {flagged.has(qq.id) && <span className="pill-flag"><Icon name="flag" size={9} /></span>}
            </button>
          ))}
        </div>

        <div className="exam-footer-right">
          {/* Say where the answers are saved: in this browser always, and on the server once an
              autosave has got through. */}
          <div className="auto-save-status" aria-live="polite">
            <span className={autoSaveStatus === "saving" ? "saving" : ""}>
              {autoSaveStatus === "saving" ? (
                <><Icon name="clock" size={13} /> Saving…</>
              ) : autoSaveStatus === "unsaved" ? (
                <><Icon name="warning" size={13} /> Not saved<span className="auto-save-extra"> on this device</span></>
              ) : (
                <><Icon name="check" size={13} strokeWidth={2.6} /> Saved<span className="auto-save-extra">{onServer ? " to your account" : " on this device"}</span></>
              )}
            </span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => handleSubmit(false)} disabled={submitting} aria-label="Submit module">
            {submitting ? "Submitting…" : "Submit module"}
          </button>
        </div>
      </footer>

      {/* Ghost run: hidden unless a previous attempt exists, closed until asked for, and it never moves or makes a sound. */}
      {mod.ghost && (
        <div className="exam-ghost">
          <button
            type="button"
            className="exam-ghost-btn"
            aria-expanded={ghostOpen}
            aria-controls="exam-ghost-panel"
            title="Compare your pace with your last attempt at this test"
            onClick={() => setGhostOpen((o) => !o)}
          >
            Pace
          </button>
          {ghostOpen && (
            <div id="exam-ghost-panel" className="exam-ghost-panel">
              <p>{ghostLine(mod.ghost, totalSeconds - secondsLeft)}</p>
              <small>You're on Q{q.order} now.</small>
            </div>
          )}
        </div>
      )}

      {mod.calculator && <GraphingCalculator key={moduleId} open={calcOpen && !showSubmitConfirm && !submitting} warm locked onClose={() => setCalcOpen(false)} />}

      {/* Out of full screen (Escape, or the page opened again): the test is covered until they are back in. */}
      {lock.needFullscreen && <LockGate onEnter={lock.enterFullscreen} />}

      {showSubmitConfirm && (
        <div className="modal-backdrop" onClick={() => setShowSubmitConfirm(false)}>
          <div className="modal modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submit Module?</h2>
            </div>
            <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
              You have answered <strong>{answeredCount} of {totalQuestions}</strong> questions.
              {flaggedCount > 0 && (
                <>
                  <br />
                  <strong>{flaggedCount}</strong> question{flaggedCount > 1 ? "s are" : " is"} flagged for review.
                </>
              )}{" "}
              Once submitted, you cannot change your answers.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowSubmitConfirm(false)}>
                Continue working
              </button>
              <button className="btn btn-primary" onClick={handleConfirmSubmit} disabled={submitting}>
                {submitting ? "Submitting…" : "Yes, submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}