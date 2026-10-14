import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDiagnostic, leaveDiagnostic, practiceMeta, saveDiagnostic, submitDiagnostic } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import MathText from "../../components/MathText.jsx";
import Figure from "../../components/Figure.jsx";
import HighlightText from "../practice/HighlightText.jsx";
import BankPicture, { isPictureQuestion } from "../practice/BankPicture.jsx";
import { DataTable, Modal, Pop, useClickOutside } from "../practice/PlayerParts.jsx";
import GraphingCalculator from "../../components/calculator/GraphingCalculator.jsx";
import { LockEnded, LockGate } from "../../lock/LockScreens.jsx";
import { exitFullscreen, useExamLock, useLeaveReport } from "../../lock/useExamLock.js";
import "../../shell.css";
import "../../player.css";
import "../../diagnostic.css";

// The SAT diagnostic test, full screen at /diagnostic/test/:id. It looks like
// the practice player, but works like the real test: answers are chosen, not
// checked, there are no hints, the clock is the server's, answers autosave,
// and the test is submitted when the time runs out. It is locked
// (lock/useExamLock.js): leaving the page before it is submitted cancels it.

const LETTERS = "ABCDEF";
const SAVE_DELAY = 1200;
const SAVE_EVERY = 15000;
const SECTION_LABEL = { "Reading & Writing": "Reading and Writing", Math: "Math" };

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

// Question tiles grouped by section, for the navigator and the review page.
function Tiles({ questions, answers, flags, current, onPick }) {
  const sections = [...new Set(questions.map((q) => q.section))];
  return sections.map((section) => (
    <div key={section} className="dg-tiles-group">
      <p className="pl-nav-label">{SECTION_LABEL[section] || section}</p>
      <div className="dg-tiles">
        {questions
          .filter((q) => q.section === section)
          .map((q) => {
            const i = questions.indexOf(q);
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
    </div>
  ));
}

function NavPopover({ questions, answers, flags, current, onPick, onReview, onClose }) {
  const box = useRef(null);
  useClickOutside(box, onClose);
  return (
    <div className="pl-nav dg-nav" ref={box} role="dialog" aria-label="Question navigator">
      <div className="pl-nav-head">
        <b>Diagnostic test</b>
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

export default function DiagnosticTest() {
  const { id } = useParams();
  const { token } = useStudentAuth();
  const { celebrate } = useProgress();
  const { toast } = useToast();
  const nav = useNavigate();

  const [test, setTest] = useState(null);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flags, setFlags] = useState([]);
  const [crossed, setCrossed] = useState({});
  const [crossMode, setCrossMode] = useState(false);
  const [left, setLeft] = useState(0);
  const [hideTimer, setHideTimer] = useState(false);
  const [page, setPage] = useState("question");
  const [confirm, setConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  // The Desmos calculator, as in the real test's Math section.
  const [calcOpen, setCalcOpen] = useState(false);
  const [font, setFont] = useState(readFont);
  const [split, setSplit] = useState(50);
  const [saveState, setSaveState] = useState("saved");
  const [version, setVersion] = useState(0);

  // Timers, autosave and submit read the latest values through refs (synced after each render, below).
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

  // ---- The lock: the first time the test isn't the page in front, it is cancelled ----
  const { ended, end: endTest, resume: resumeLeave, forget: forgetLeave } = useLeaveReport(`diag:${id}`, (kind) => leaveDiagnostic(token, id, kind));
  const lock = useExamLock({
    active: Boolean(test) && !submitting && !ended,
    onLeave: (kind) => {
      doneRef.current = true; // nothing more is saved or submitted from here
      endTest(kind);
    }
  });

  // ---- Load (the server's clock decides how much time is left) ----
  useEffect(() => {
    let alive = true;
    getDiagnostic(token, id)
      .then(({ diagnostic }) => {
        if (!alive) return;
        if (diagnostic.status !== "in_progress") {
          forgetLeave();
          nav(`/diagnostic/results/${id}`, { replace: true });
          return;
        }
        // A leave this browser saw but never got to the server: the test is over all the same.
        if (resumeLeave()) {
          doneRef.current = true;
          return;
        }
        timesRef.current = { ...diagnostic.times };
        deadlineRef.current = Date.now() + diagnostic.remainingSeconds * 1000;
        warned.current = diagnostic.remainingSeconds <= 300;
        setAnswers(diagnostic.answers || {});
        setFlags(diagnostic.flags || []);
        setLeft(diagnostic.remainingSeconds);
        // Coming back? Pick up at the first unanswered question.
        const open = diagnostic.questions.findIndex((q) => !q.missing && !isAnswered(diagnostic.answers || {}, q));
        setIndex(open > 0 ? open : 0);
        setTest(diagnostic);
      })
      .catch((e) => alive && setError(e.message));
    practiceMeta(token)
      .then((m) => alive && setMeta(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, id, nav, resumeLeave, forgetLeave]);

  // ---- Saving ----
  const save = useCallback(
    async (keepalive = false) => {
      if (!test || doneRef.current || savingRef.current || !dirtyRef.current) return;
      savingRef.current = true;
      dirtyRef.current = false;
      setSaveState("saving");
      try {
        await saveDiagnostic(token, test.id, { answers: answersRef.current, flags: flagsRef.current, times: timesRef.current }, keepalive);
        setSaveState("saved");
      } catch (e) {
        dirtyRef.current = true;
        setSaveState("error");
        if (e.code === "TIME_UP") submitRef.current(true);
        else if (e.code === "CLOSED") nav(`/diagnostic/results/${test.id}`, { replace: true });
      } finally {
        savingRef.current = false;
      }
    },
    [test, token, nav]
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
    if (!test) return undefined;
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
    return () => {
      clearInterval(every);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [test, save]);

  // ---- Submitting ----
  const submit = async (auto = false) => {
    if (!test || doneRef.current) return;
    doneRef.current = true;
    setConfirm(null);
    setSubmitting(true);
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await submitDiagnostic(token, test.id, { answers: answersRef.current, flags: flagsRef.current, times: timesRef.current, auto });
        exitFullscreen(); // submitted: the lock is off
        if (auto) toast.info("Time's up. Your answers were submitted.");
        celebrate(r.reward);
        nav(`/diagnostic/results/${test.id}`, { replace: true, state: { fresh: true } });
        return;
      } catch (e) {
        // When the clock ran out, keep trying for a while: the answers are already saved.
        if (!auto || attempt >= 4) {
          doneRef.current = false;
          setSubmitting(false);
          toast.error(e.message);
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

  // ---- The clock ----
  useEffect(() => {
    if (!test) return undefined;
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setLeft(s);
      if (s <= 300 && !warned.current) {
        warned.current = true;
        toastRef.current.warning("5 minutes left.");
      }
      if (s <= 0) {
        clearInterval(t);
        submitRef.current(true);
      }
    }, 500);
    return () => clearInterval(t);
  }, [test]);

  // Time spent on each question (only while it's on screen).
  const q = test?.questions[index] || null;
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
    if (!q || q.missing) return;
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
  const total = test?.questions.length || 0;
  const goTo = (i) => {
    setPage("question");
    setNavOpen(false);
    setIndex(Math.max(0, Math.min(total - 1, i)));
  };
  const next = () => (index >= total - 1 ? setPage("review") : goTo(index + 1));
  const prev = () => (page === "review" ? setPage("question") : goTo(index - 1));
  // Leaving through the Exit button is still leaving: the test is cancelled.
  const leave = () => {
    setConfirm(null);
    doneRef.current = true;
    endTest("exit");
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

  // ---- Render ----
  // The student left the test: nothing of it stays on the screen.
  if (ended) return <LockEnded ended={ended} kind="diagnostic" backLabel="Back to the diagnostic" onBack={() => nav("/diagnostic", { replace: true })} />;
  if (error) {
    return (
      <div className="pl-empty">
        <Nova size={90} mood="oops" />
        <h2>Couldn't open your diagnostic</h2>
        <p>{error}</p>
        <button className="ns-btn ns-btn-primary" onClick={() => nav("/diagnostic")}>
          Back to the diagnostic
        </button>
      </div>
    );
  }
  if (!test || !q) {
    return (
      <div className="pl-empty">
        <div className="ns-spinner" />
      </div>
    );
  }

  const answeredCount = test.questions.filter((x) => isAnswered(answers, x)).length;
  const unanswered = total - answeredCount;
  const flagged = flags.includes(q.id);
  const isGrid = q.type === "grid_in";
  const hasPassage = Boolean(q.passage || q.image);
  const picture = isPictureQuestion(q);
  const directions = meta?.directions?.[q.section] || [];
  const crossedHere = crossed[q.id] || [];

  const questionPane = (
    <div className="pl-qpane">
      <div className="pl-qhead">
        <span className="pl-qnum">{q.n}</span>
        <button className={`pl-mark ${flagged ? "on" : ""}`} onClick={toggleFlag} aria-pressed={flagged}>
          <Icon name={flagged ? "bookmarkFilled" : "bookmark"} size={18} /> Mark for Review
        </button>
        <span className="pl-qhead-spacer" />
        {!isGrid && !q.missing && (
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

      {!hasPassage && q.figure && <Figure figure={q.figure} />}
      {!hasPassage && q.table && <DataTable table={q.table} />}
      {picture && <BankPicture image={q.promptImage} alt={isGrid ? "The question, shown as a picture" : "The question and its answer choices A to D, shown as a picture"} />}

      <div className={`pl-prompt ${picture ? "pl-prompt-note" : ""}`}><HighlightText className="pl-prompt-math" text={q.prompt} inline /></div>

      {q.missing ? null : isGrid ? (
        <div className="pl-grid">
          <label htmlFor="dg-grid-input">Your answer</label>
          <div className="pl-grid-row">
            <input
              id="dg-grid-input"
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
          <p className="dg-grid-hint">Type a whole number, a fraction like 3/4 or a decimal like 0.75. Start negative answers with a minus sign.</p>
        </div>
      ) : (
        <div className={`pl-options ${crossMode ? "crossing" : ""} ${picture ? "pl-options-letters" : ""}`} role="radiogroup" aria-label="Answer choices">
          {q.options.map((opt, i) => {
            const selected = answers[q.id] === i;
            const x = crossedHere.includes(i);
            return (
              <div key={i} className="pl-optrow">
                <button role="radio" aria-checked={selected} className={`pl-opt dg-opt ${selected ? "sel" : ""} ${x ? "crossed" : ""}`} onClick={() => choose(i)}>
                  <span className="pl-letter">{LETTERS[i]}</span>
                  {picture ? <span className="pl-opt-text">Choice {LETTERS[i]}</span> : <MathText className="pl-opt-text" text={opt} />}
                </button>
                {crossMode &&
                  (x ? (
                    <button className="pl-undo" onClick={() => toggleCross(i)}>
                      Undo
                    </button>
                  ) : (
                    <button className="pl-xbtn" aria-label={`Cross out option ${LETTERS[i]}`} onClick={() => toggleCross(i)}>
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
          You can still change any answer. Unanswered questions count as wrong and there's no penalty for guessing, so answer every question before you
          submit.
        </p>
        <div className="dg-check-stats">
          <span>
            <b>{answeredCount}</b> of {total} answered
          </span>
          <span>
            <b>{flags.length}</b> marked for review
          </span>
          <span>
            <b>{mmss(left)}</b> left
          </span>
        </div>
        <div className="dg-check-tiles">
          <Tiles questions={test.questions} answers={answers} flags={flags} current={-1} onPick={goTo} />
        </div>
      </div>
    </section>
  );

  return (
    <div className={`pl-root dg-root fs-${font}`}>
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
                  {SECTION_LABEL[q.section] || q.section} <Icon name={open ? "chevronUp" : "chevronDown"} size={16} />
                </button>
              )}
            >
              <p className="pl-pop-title">{q.section} directions</p>
              {directions.length ? (
                directions.map((d, i) => (
                  <p key={i} className="pl-dir-text">
                    {d}
                  </p>
                ))
              ) : (
                <p className="pl-dir-text">Answer every question. Your answers are saved as you go.</p>
              )}
            </Pop>
          </div>
          <div className="pl-timer">
            <span className={`pl-time dg-time ${left <= 300 ? "low" : ""}`} aria-live="off" aria-label={`${mmss(left)} left`}>
              {hideTimer ? <Icon name="clock" size={20} /> : mmss(left)}
            </span>
            <div className="pl-timer-ctrls">
              <button className="pl-hide" onClick={() => setHideTimer((h) => !h)}>
                {hideTimer ? "Show" : "Hide"}
              </button>
            </div>
          </div>
          <div className="pl-top-right">
            {q.section === "Math" && page === "question" && (
              <button className={`pl-tool wide pl-calc ${calcOpen ? "open" : ""}`} aria-pressed={calcOpen} title="Graphing calculator" onClick={() => setCalcOpen((o) => !o)}>
                <Icon name="calc" size={19} /> <span className="pl-lbl">Calculator</span>
              </button>
            )}
            {q.section === "Math" && meta?.mathReference && (
              <button className="pl-tool wide" onClick={() => setRefOpen(true)} title="Math reference sheet">
                <Icon name="calc" size={19} /> <span className="pl-lbl">Reference</span>
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
                  <button key={i} className={font === i ? "on" : ""} style={{ fontSize: 13 + i * 3 }} aria-label={["Small text", "Medium text", "Large text"][i]} onClick={() => setFont(i)}>
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
          ) : hasPassage ? (
            <>
              <section className="pl-left" style={{ flexBasis: `${split}%` }} aria-label="Passage">
                <BankPicture image={q.image} alt="Graph or table for this question" zoom={1.25} />
                <div className="pl-passage">
                  <HighlightText text={q.passage} underline={q.underline} />
                </div>
                {q.table && <DataTable table={q.table} />}
                {q.figure && <Figure figure={q.figure} />}
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
                questions={test.questions}
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
                Submit test
              </button>
            ) : (
              <button className="pl-bb step" onClick={next}>
                {index === total - 1 ? "Review" : "Next"}
              </button>
            )}
          </div>
        </footer>
      </div>

      <GraphingCalculator open={calcOpen && q.section === "Math" && page === "question" && !submitting} warm={q.section === "Math"} locked onClose={() => setCalcOpen(false)} />
      {/* Out of full screen (Escape, or the page opened again): the test is covered until they are back in. */}
      {lock.needFullscreen && <LockGate onEnter={lock.enterFullscreen} />}
      {confirm === "exit" && (
        <Modal onClose={() => setConfirm(null)} label="Leave the diagnostic">
          <div className="pl-modal-head">
            <h3>Leave and cancel the diagnostic?</h3>
          </div>
          <p className="pl-modal-sub">
            This test is locked: if you leave before you submit, it is cancelled and you get no score. To get your score, go to the review page and submit
            what you have.
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
        <Modal onClose={() => setConfirm(null)} label="Submit the diagnostic">
          <div className="pl-modal-head">
            <h3>Submit your diagnostic?</h3>
          </div>
          <p className="pl-modal-sub">
            {unanswered > 0
              ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} still unanswered and will count as wrong. `
              : "You've answered every question. "}
            You can't change your answers after you submit.
          </p>
          <div className="pl-modal-actions">
            <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={() => setConfirm(null)}>
              Keep working
            </button>
            <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={() => submit(false)} disabled={submitting}>
              Submit and see my results
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
          <p>Scoring your diagnostic…</p>
        </div>
      )}
    </div>
  );
}
