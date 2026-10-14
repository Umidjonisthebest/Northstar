import React, { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { leavePracticeTestRun, practiceMeta, practiceTestModule, savePracticeTestModule, submitPracticeTestModule } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import MathText from "../../components/MathText.jsx";
import RichText, { RichInline } from "../../components/RichText.jsx";
import { richPlain } from "../../components/richPlain.js";
import { Modal, Pop, useClickOutside } from "../practice/PlayerParts.jsx";
import GraphingCalculator from "../../components/calculator/GraphingCalculator.jsx";
import { LockEnded, LockGate } from "../../lock/LockScreens.jsx";
import { exitFullscreen, useExamLock, useLeaveReport } from "../../lock/useExamLock.js";
import { TESTS_URL, resultsUrl, runUrl } from "./ptUtils.js";
import "../../shell.css";
import "../../player.css";
import "../../diagnostic.css";
import "../../practicetest.css";

// One module of a practice test, full screen at /practice-test/:runId/:module. It is the
// diagnostic's test screen (answers chosen, not checked; no hints; mark for review; cross-out;
// the calculator in Math) with two differences: the questions are drawn from the tests' own
// mark-up (RichText), and the sitting may be untimed. Timed, the clock is the server's and the
// module is handed in when it runs out; untimed, a stopwatch only counts the time spent on
// questions. Timed or not, it is locked (lock/useExamLock.js): leaving the page before the module
// is handed in cancels the whole sitting. The warning is on the sitting's page (PracticeTestRun),
// and this screen only opens for someone who has come through it.

// (The file tests have four choices; a question typed in the studio can have up to six.)
const LETTERS = "ABCDEF";
const SAVE_DELAY = 1200;
const SAVE_EVERY = 15000;
const SECTION = { rw: "Reading & Writing", math: "Math" };

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function readFont() {
  try {
    const v = Number(localStorage.getItem("pl_font"));
    return [0, 1, 2].includes(v) ? v : 1;
  } catch {
    return 1;
  }
}

const isAnswered = (answers, q) => answers[q.id] !== undefined && answers[q.id] !== "";

function Tiles({ questions, answers, flags, current, onPick }) {
  return (
    <div className="dg-tiles">
      {questions.map((q, i) => {
        const done = isAnswered(answers, q);
        const flagged = flags.includes(q.id);
        return (
          <button
            key={q.id}
            className={`dg-tile ${done ? "done" : ""} ${i === current ? "current" : ""}`}
            onClick={() => onPick(i)}
            aria-label={`Question ${q.n}${done ? ", answered" : ", not answered"}${flagged ? ", marked for review" : ""}`}
            aria-current={i === current ? "true" : undefined}
          >
            {q.n}
            {flagged && (
              <span className="dg-tile-flag">
                <Icon name="bookmarkFilled" size={13} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function NavPopover({ title, questions, answers, flags, current, onPick, onReview, onClose }) {
  const box = useRef(null);
  useClickOutside(box, onClose);
  return (
    <div className="pl-nav dg-nav" ref={box} role="dialog" aria-label="Question navigator">
      <div className="pl-nav-head">
        <b>{title}</b>
        <button className="pl-iconbtn" onClick={onClose} aria-label="Close navigator">
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="pl-nav-legend">
        <span>
          <i className="dg-key done" /> Answered
        </span>
        <span>
          <i className="dg-key" /> Unanswered
        </span>
        <span>
          <Icon name="bookmarkFilled" size={14} className="dg-key-flag" /> For review
        </span>
      </div>
      <div className="pl-nav-scroll">
        <Tiles questions={questions} answers={answers} flags={flags} current={current} onPick={onPick} />
      </div>
      <button className="ns-btn ns-btn-outline ns-btn-sm dg-nav-review" onClick={onReview}>
        Go to the review page
      </button>
    </div>
  );
}

export default function PracticeTestModule() {
  const { runId, module: moduleKey } = useParams();
  const { token } = useStudentAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  // Opening a module starts its clock, so it isn't opened by an address alone: the warning first.
  const warnedIn = Boolean(useLocation().state?.warned);

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flags, setFlags] = useState([]);
  const [crossed, setCrossed] = useState({});
  const [crossMode, setCrossMode] = useState(false);
  const [clock, setClock] = useState(0); // timed: seconds left; untimed: seconds spent
  const [hideTimer, setHideTimer] = useState(false);
  const [page, setPage] = useState("question");
  const [confirm, setConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [font, setFont] = useState(readFont);
  const [split, setSplit] = useState(50);
  const [saveState, setSaveState] = useState("saved");
  const [version, setVersion] = useState(0);

  // Timers, autosave and hand-in read the latest values through refs (synced after each render, below).
  const answersRef = useRef(answers);
  const flagsRef = useRef(flags);
  const timesRef = useRef({});
  const deadlineRef = useRef(0);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const doneRef = useRef(false);
  const submitRef = useRef(() => {});
  const bodyRef = useRef(null);
  const warned = useRef(false);
  const toastRef = useRef(toast);

  const timed = Boolean(data?.run.timed);
  const spent = () => Math.round(Object.values(timesRef.current).reduce((s, ms) => s + ms, 0) / 1000);

  // ---- The lock: the first time the module isn't the page in front, the sitting is cancelled ----
  const {
    ended,
    end: endSitting,
    show: showEnded,
    resume: resumeLeave,
    forget: forgetLeave
  } = useLeaveReport(`pt:${runId}:${moduleKey}`, (kind) => leavePracticeTestRun(token, runId, moduleKey, kind));
  const lock = useExamLock({
    active: Boolean(data) && !submitting && !ended,
    onLeave: (kind) => {
      doneRef.current = true; // nothing more is saved or handed in from here
      endSitting(kind);
    }
  });
  // Out of the module by its own doing (handed in, or closed by the clock): the lock is off.
  const out = useCallback(
    (to) => {
      exitFullscreen();
      nav(to, { replace: true });
    },
    [nav]
  );

  // ---- Load (opening the module starts its clock on the server, the first time) ----
  useEffect(() => {
    if (!warnedIn) return undefined;
    let alive = true;
    doneRef.current = false;
    practiceTestModule(token, runId, moduleKey)
      .then((d) => {
        if (!alive) return;
        // A leave this browser saw but never got to the server: the sitting is over all the same.
        if (resumeLeave()) {
          doneRef.current = true;
          return;
        }
        setError("");
        setPage("question");
        timesRef.current = { ...d.times };
        setAnswers(d.answers || {});
        setFlags(d.flags || []);
        if (d.run.timed) {
          deadlineRef.current = Date.now() + d.remainingSeconds * 1000;
          warned.current = d.remainingSeconds <= 300;
          setClock(d.remainingSeconds);
        } else {
          setClock(Math.round(Object.values(d.times || {}).reduce((s, ms) => s + ms, 0) / 1000));
        }
        // Coming back? Pick up at the first unanswered question.
        const open = d.questions.findIndex((q) => !isAnswered(d.answers || {}, q));
        setIndex(open > 0 ? open : 0);
        setData(d);
      })
      .catch((e) => {
        if (!alive) return;
        // Already handed in (perhaps by the clock), or not this module's turn: the sitting's page says where things stand.
        // Finished or cancelled (the page was reloaded, which is leaving): the results page says which.
        if (e.code === "FINISHED" || e.code === "CANCELLED") {
          forgetLeave();
          out(resultsUrl(runId));
        } else if (e.code === "CLOSED" || e.code === "ORDER") {
          forgetLeave();
          out(runUrl(runId));
        } else setError(e.message);
      });
    practiceMeta(token)
      .then((m) => alive && setMeta(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, runId, moduleKey, warnedIn, out, resumeLeave, forgetLeave]);

  // ---- Saving ----
  const save = useCallback(
    async (keepalive = false) => {
      if (!data || doneRef.current || savingRef.current || !dirtyRef.current) return;
      savingRef.current = true;
      dirtyRef.current = false;
      setSaveState("saving");
      try {
        await savePracticeTestModule(token, runId, moduleKey, { answers: answersRef.current, flags: flagsRef.current, times: timesRef.current }, keepalive);
        setSaveState("saved");
      } catch (e) {
        dirtyRef.current = true;
        setSaveState("error");
        // The clock closed the module while this page was open somewhere it couldn't tick.
        if (e.code === "CLOSED" || e.code === "FINISHED") {
          doneRef.current = true;
          toastRef.current.info("Time's up. The module was handed in with the answers saved until then.");
          out(e.code === "FINISHED" ? resultsUrl(runId) : runUrl(runId));
        } else if (e.code === "CANCELLED") {
          // The leave was seen somewhere else (this module open in a second tab or on another device).
          doneRef.current = true;
          showEnded();
        }
      } finally {
        savingRef.current = false;
      }
    },
    [data, token, runId, moduleKey, out, showEnded]
  );
  const touch = () => {
    dirtyRef.current = true;
    setVersion((v) => v + 1);
  };
  useEffect(() => {
    if (!version) return undefined;
    const t = setTimeout(() => save(), SAVE_DELAY);
    return () => clearTimeout(t);
  }, [version, save]);
  useEffect(() => {
    if (!data) return undefined;
    const every = setInterval(() => {
      dirtyRef.current = true; // time on the current question keeps growing
      save();
    }, SAVE_EVERY);
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      dirtyRef.current = true;
      save(true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(every);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [data, save]);

  // ---- Handing in ----
  const submit = async (auto = false) => {
    if (!data || doneRef.current) return;
    doneRef.current = true;
    setConfirm(null);
    setSubmitting(true);
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await submitPracticeTestModule(token, runId, moduleKey, { answers: answersRef.current, flags: flagsRef.current, times: timesRef.current, auto });
        if (auto) toast.info("Time's up. Your answers were handed in.");
        else if (r.late) toast.info("Time had already run out, so the module was marked on the answers saved until then.");
        // The last module: straight to the results. Otherwise back to the sitting's page for the next one.
        out(r.run.status === "in_progress" ? runUrl(runId) : resultsUrl(runId));
        return;
      } catch (e) {
        if (e.code === "CANCELLED") {
          setSubmitting(false);
          showEnded();
          return;
        }
        // When the clock ran out, keep trying for a while: the answers are already saved.
        if (!auto || attempt >= 4) {
          doneRef.current = false;
          setSubmitting(false);
          toast.error(e.code === "NETWORK" ? "Your answers haven't been sent yet: no connection to the server. They are still here." : e.message);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      }
    }
  };
  useEffect(() => {
    answersRef.current = answers;
    flagsRef.current = flags;
    toastRef.current = toast;
    submitRef.current = submit;
  });

  // ---- The clock: counts down to the server's deadline, or (untimed) shows the time spent ----
  useEffect(() => {
    if (!data) return undefined;
    const t = setInterval(() => {
      if (!data.run.timed) return setClock(spent());
      const s = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setClock(s);
      if (s <= 300 && !warned.current) {
        warned.current = true;
        toastRef.current.warning("5 minutes left in this module.");
      }
      if (s <= 0) {
        clearInterval(t);
        submitRef.current(true);
      }
      return undefined;
    }, 500);
    return () => clearInterval(t);
  }, [data]);

  // Time spent on each question (only while it's on screen and the page is in front).
  const q = data?.questions[index] || null;
  const qid = q?.id;
  useEffect(() => {
    if (!qid || page !== "question") return undefined;
    const t = setInterval(() => {
      if (!document.hidden) timesRef.current[qid] = (timesRef.current[qid] || 0) + 1000;
    }, 1000);
    return () => clearInterval(t);
  }, [qid, page]);

  // ---- Answering ----
  const choose = (i) => {
    if (!q) return;
    setAnswers((a) => {
      const next = { ...a };
      if (next[q.id] === i) delete next[q.id];
      else next[q.id] = i;
      return next;
    });
    setCrossed((c) => ({ ...c, [q.id]: (c[q.id] || []).filter((x) => x !== i) }));
    touch();
  };
  const toggleCross = (i) => {
    const list = crossed[q.id] || [];
    const on = !list.includes(i);
    setCrossed((c) => ({ ...c, [q.id]: on ? [...list, i] : list.filter((x) => x !== i) }));
    if (on && answers[q.id] === i) {
      setAnswers((a) => {
        const next = { ...a };
        delete next[q.id];
        return next;
      });
      touch();
    }
  };
  const setGrid = (value) => {
    const v = value.slice(0, 12);
    setAnswers((a) => {
      const next = { ...a };
      if (v.trim()) next[q.id] = v;
      else delete next[q.id];
      return next;
    });
    touch();
  };
  const toggleFlag = () => {
    if (!q) return;
    setFlags((f) => (f.includes(q.id) ? f.filter((x) => x !== q.id) : [...f, q.id]));
    touch();
  };

  // ---- Moving around ----
  const total = data?.questions.length || 0;
  const goTo = (i) => {
    setPage("question");
    setNavOpen(false);
    setIndex(Math.max(0, Math.min(total - 1, i)));
  };
  const next = () => (index >= total - 1 ? setPage("review") : goTo(index + 1));
  const prev = () => (page === "review" ? setPage("question") : goTo(index - 1));
  // Leaving through the Exit button is still leaving: the sitting is cancelled.
  const leave = () => {
    setConfirm(null);
    doneRef.current = true;
    endSitting("exit");
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || confirm || refOpen || submitting || !q) return;
      const t = e.target;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.closest?.(".gcalc")) return;
      if (e.key === "ArrowRight") return next();
      if (e.key === "ArrowLeft" && (page === "review" || index > 0)) return prev();
      if (page !== "question" || !q.options) return;
      const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const opt = LETTERS.indexOf(k);
      if (opt >= 0 && opt < q.options.length) choose(opt);
      else if (/^[1-6]$/.test(k) && Number(k) <= q.options.length) choose(Number(k) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- Split pane (passage | question) ----
  const startDrag = (e) => {
    e.preventDefault();
    const rect = bodyRef.current.getBoundingClientRect();
    const move = (ev) => setSplit(Math.max(28, Math.min(72, ((ev.clientX - rect.left) / rect.width) * 100)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const pickFont = (i) => {
    setFont(i);
    try {
      localStorage.setItem("pl_font", String(i));
    } catch {
      // not remembered next time
    }
  };

  // ---- Render ----
  if (!warnedIn) return <Navigate to={runUrl(runId)} replace />;
  // The student left the module: nothing of it stays on the screen.
  if (ended) return <LockEnded ended={ended} kind="practice" backLabel="Back to Practice Tests" onBack={() => nav(TESTS_URL, { replace: true })} />;
  if (error) {
    return (
      <div className="pl-empty">
        <Nova size={90} mood="oops" />
        <h2>Couldn't open this module</h2>
        <p>{error}</p>
        <button className="ns-btn ns-btn-primary" onClick={() => nav("/mock")}>
          Back to Practice Tests
        </button>
      </div>
    );
  }
  // Nothing yet, or still the module that was open before this address.
  if (!data || !q || data.run.id !== runId || data.module.key !== moduleKey) {
    return (
      <div className="pl-empty">
        <div className="ns-spinner" />
      </div>
    );
  }

  const mod = data.module;
  const isMath = mod.section === "math";
  const answeredCount = data.questions.filter((x) => isAnswered(answers, x)).length;
  const unanswered = total - answeredCount;
  const flagged = flags.includes(q.id);
  const isGrid = q.type === "grid_in";
  const directions = meta?.directions?.[SECTION[mod.section]] || [];
  const crossedHere = crossed[q.id] || [];
  const low = timed && clock <= 300;
  const moduleName = `${mod.title}: Module ${mod.label.replace(/^.*Module\s*/i, "") || mod.index}`;
  const handInLabel = mod.last ? "Hand in and see my results" : "Hand in this module";

  const questionPane = (
    <div className="pl-qpane">
      <div className="pl-qhead">
        <span className="pl-qnum">{q.n}</span>
        <button className={`pl-mark ${flagged ? "on" : ""}`} onClick={toggleFlag} aria-pressed={flagged}>
          <Icon name={flagged ? "bookmarkFilled" : "bookmark"} size={18} /> Mark for Review
        </button>
        <span className="pl-qhead-spacer" />
        {!isGrid && (
          <button
            className={`pl-strike ${crossMode ? "on" : ""}`}
            aria-pressed={crossMode}
            aria-label="Cross out answer choices"
            title="Cross out answer choices"
            onClick={() => setCrossMode((m) => !m)}
          >
            <Icon name="strike" size={20} />
          </button>
        )}
      </div>

      <RichText className="pl-prompt pt-prompt" nodes={q.prompt} />

      {isGrid ? (
        <div className="pl-grid">
          <label htmlFor="pt-grid-input">Your answer</label>
          <div className="pl-grid-row">
            <input
              id="pt-grid-input"
              value={answers[q.id] ?? ""}
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. 3/4 or 0.75"
              onChange={(e) => setGrid(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") next();
              }}
            />
          </div>
          <p className="dg-grid-hint">
            Type a whole number, a fraction like 7/2 or a decimal like 3.5. Start a negative answer with a minus sign. Leave out units, commas and percent signs;
            if a decimal is long, type its first four digits.
          </p>
        </div>
      ) : (
        <div className={`pl-options ${crossMode ? "crossing" : ""}`} role="radiogroup" aria-label="Answer choices">
          {q.options.map((opt, i) => {
            const selected = answers[q.id] === i;
            const x = crossedHere.includes(i);
            return (
              <div key={i} className="pl-optrow">
                <button role="radio" aria-checked={selected} aria-label={`Choice ${LETTERS[i]}: ${richPlain(opt)}`} className={`pl-opt dg-opt ${selected ? "sel" : ""} ${x ? "crossed" : ""}`} onClick={() => choose(i)}>
                  <span className="pl-letter">{LETTERS[i]}</span>
                  <RichInline className="pl-opt-text" nodes={opt} />
                </button>
                {crossMode &&
                  (x ? (
                    <button className="pl-undo" onClick={() => toggleCross(i)}>
                      Undo
                    </button>
                  ) : (
                    <button className="pl-xbtn" aria-label={`Cross out choice ${LETTERS[i]}`} onClick={() => toggleCross(i)}>
                      <span>{LETTERS[i]}</span>
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const reviewPage = (
    <section className="pl-single" aria-label="Check your work">
      <div className="dg-check">
        <Nova size={64} mood="thinking" sparkles={false} />
        <h2>Check your work</h2>
        <p>
          You can still change any answer in this module. Unanswered questions count as wrong and there's no penalty for guessing, so answer every question
          before you hand it in. {mod.last ? "This is the last module: your results come next." : "Once it is handed in you can't come back to it."}
        </p>
        <div className="dg-check-stats">
          <span>
            <b>{answeredCount}</b> of {total} answered
          </span>
          <span>
            <b>{flags.length}</b> marked for review
          </span>
          <span>
            <b>{mmss(clock)}</b> {timed ? "left" : "spent"}
          </span>
        </div>
        <div className="dg-check-tiles">
          <p className="pl-nav-label">{moduleName}</p>
          <Tiles questions={data.questions} answers={answers} flags={flags} current={-1} onPick={goTo} />
        </div>
      </div>
    </section>
  );

  return (
    <div className={`pl-root dg-root pt-root fs-${font}`}>
      <div className="pl-main">
        <header className="pl-top">
          <div className="pl-top-left">
            <button className="pl-back" onClick={() => setConfirm("exit")}>
              <Icon name="chevronLeft" size={18} /> Exit
            </button>
            <Pop
              className="pl-dir-pop"
              button={({ open, toggle }) => (
                <button className="pl-dir" aria-expanded={open} onClick={toggle}>
                  {moduleName} <Icon name={open ? "chevronUp" : "chevronDown"} size={16} />
                </button>
              )}
            >
              <p className="pl-pop-title">
                {data.run.title} · module {mod.index} of {mod.of}
              </p>
              {(directions.length ? directions : ["Answer every question. Your answers are saved as you go."]).map((d, i) => (
                <p key={i} className="pl-dir-text">
                  {d}
                </p>
              ))}
              <p className="pl-dir-text">
                {timed
                  ? `${mod.questions} questions in ${mod.minutes} minutes. When the clock reaches 0:00 the module is handed in with the answers you have given.`
                  : `${mod.questions} questions and no clock: the stopwatch only shows the time you have spent on them.`}
              </p>
            </Pop>
          </div>
          <div className="pl-timer">
            <span className={`pl-time dg-time ${low ? "low" : ""}`} aria-live="off" aria-label={`${mmss(clock)} ${timed ? "left" : "spent"}`}>
              {hideTimer ? <Icon name={timed ? "clock" : "stopwatch"} size={20} /> : mmss(clock)}
            </span>
            <div className="pl-timer-ctrls">
              {!timed && !hideTimer && <span className="pt-untimed">Untimed</span>}
              <button className="pl-hide" onClick={() => setHideTimer((h) => !h)}>
                {hideTimer ? "Show" : "Hide"}
              </button>
            </div>
          </div>
          <div className="pl-top-right">
            {isMath && page === "question" && (
              <button className={`pl-tool wide pl-calc ${calcOpen ? "open" : ""}`} aria-pressed={calcOpen} title="Graphing calculator" onClick={() => setCalcOpen((o) => !o)}>
                <Icon name="calc" size={19} /> <span className="pl-lbl">Calculator</span>
              </button>
            )}
            {isMath && meta?.mathReference && (
              <button className="pl-tool wide" onClick={() => setRefOpen(true)} title="Math reference sheet">
                <Icon name="note" size={19} /> <span className="pl-lbl">Reference</span>
              </button>
            )}
            <Pop
              align="right"
              className="pl-more-pop"
              button={({ open, toggle }) => (
                <button className="pl-tool outline" aria-label="More options" aria-expanded={open} onClick={toggle}>
                  <Icon name="more" size={20} />
                </button>
              )}
            >
              <div className="pl-fontrow">
                <span>Text size</span>
                {["A", "A", "A"].map((a, i) => (
                  <button key={i} className={font === i ? "on" : ""} style={{ fontSize: 13 + i * 3 }} aria-label={["Small text", "Medium text", "Large text"][i]} onClick={() => pickFont(i)}>
                    {a}
                  </button>
                ))}
              </div>
              <button className="ns-menu-item" onClick={() => setPage("review")}>
                <Icon name="checklist" size={16} /> Review page
              </button>
            </Pop>
          </div>
        </header>

        <div className="pl-body" ref={bodyRef}>
          {page === "review" ? (
            reviewPage
          ) : q.passage ? (
            <>
              <section className="pl-left" style={{ flexBasis: `${split}%` }} aria-label="Passage">
                <RichText className="pl-passage" nodes={q.passage} />
              </section>
              <div className="pl-divider" onPointerDown={startDrag} role="separator" aria-orientation="vertical" aria-label="Resize passage and question">
                <span />
              </div>
              <section className="pl-right" aria-label="Question">
                {questionPane}
              </section>
            </>
          ) : (
            <section className="pl-single" aria-label="Question">
              {questionPane}
            </section>
          )}
        </div>

        <footer className="pl-bottom">
          <div className="pl-pop-anchor">
            <button className="pl-counter" aria-expanded={navOpen} onClick={() => setNavOpen((o) => !o)}>
              {page === "review" ? "Review" : `Question ${index + 1} of ${total}`} <Icon name={navOpen ? "chevronUp" : "chevronDown"} size={16} />
            </button>
            {navOpen && (
              <NavPopover
                title={moduleName}
                questions={data.questions}
                answers={answers}
                flags={flags}
                current={page === "review" ? -1 : index}
                onPick={goTo}
                onReview={() => {
                  setNavOpen(false);
                  setPage("review");
                }}
                onClose={() => setNavOpen(false)}
              />
            )}
          </div>
          <div className="pl-bottom-right">
            <span className={`dg-saved ${saveState}`} role="status">
              {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved yet" : "Saved"}
            </span>
            <button className="pl-bb step" onClick={prev} disabled={page === "question" && index === 0}>
              Back
            </button>
            {page === "review" ? (
              <button className="pl-bb dg-submit" onClick={() => setConfirm("submit")} disabled={submitting}>
                Hand in module
              </button>
            ) : (
              <button className="pl-bb step" onClick={next}>
                {index === total - 1 ? "Review" : "Next"}
              </button>
            )}
          </div>
        </footer>
      </div>

      <GraphingCalculator open={calcOpen && isMath && page === "question" && !submitting} warm={isMath} locked onClose={() => setCalcOpen(false)} />
      {/* Out of full screen (Escape, or the page opened again): the module is covered until they are back in. */}
      {lock.needFullscreen && <LockGate onEnter={lock.enterFullscreen} />}
      {confirm === "exit" && (
        <Modal onClose={() => setConfirm(null)} label="Leave this module">
          <div className="pl-modal-head">
            <h3>Leave and cancel this attempt?</h3>
          </div>
          <p className="pl-modal-sub">
            This module is locked: if you leave before you hand it in, the whole attempt is cancelled and you get no score. To keep your work, go to the
            review page and hand in what you have{mod.last ? "." : "; you can stop between modules."}
          </p>
          <div className="pl-modal-actions">
            <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={leave}>
              Leave and cancel it
            </button>
            <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={() => setConfirm(null)}>
              Keep going
            </button>
          </div>
        </Modal>
      )}
      {confirm === "submit" && (
        <Modal onClose={() => setConfirm(null)} label="Hand in this module">
          <div className="pl-modal-head">
            <h3>Hand in {moduleName}?</h3>
          </div>
          <p className="pl-modal-sub">
            {unanswered > 0
              ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} still unanswered and will count as wrong. `
              : "You've answered every question. "}
            You can't change this module's answers after you hand it in.
          </p>
          <div className="pl-modal-actions">
            <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={() => setConfirm(null)}>
              Keep working
            </button>
            <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={() => submit(false)} disabled={submitting}>
              {handInLabel}
            </button>
          </div>
        </Modal>
      )}
      {refOpen && (
        <Modal onClose={() => setRefOpen(false)} label="Math reference sheet">
          <div className="pl-modal-head">
            <h3>Reference sheet</h3>
            <button className="pl-iconbtn" onClick={() => setRefOpen(false)} aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </div>
          <table className="pl-ref dg-ref">
            <tbody>
              {(meta?.mathReference || []).map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <MathText as="td" text={v} />
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
      {submitting && (
        <div className="dg-scoring" role="status">
          <Nova size={84} mood="thinking" float />
          <p>Handing in your module…</p>
        </div>
      )}
    </div>
  );
}
