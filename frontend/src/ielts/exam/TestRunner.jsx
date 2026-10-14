import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BookOpen, Check, ChevronLeft, FileText, Headphones, LogOut, PenLine, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { ieltsTestAttempt, ieltsTestSection, ieltsTestSubmit } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { Button } from "../components/ui.jsx";
import { ConfirmDialog } from "../components/Modal.jsx";
import { RichHtml } from "../lib/richHtml.jsx";
import { humanDuration } from "../lib/format.js";
import { LockEnded, LockGate, LockNotice } from "../../lock/LockScreens.jsx";
import { enterFullscreen, exitFullscreen, useExamLock } from "../../lock/useExamLock.js";
import { Playlist, downloadAudio } from "./audioPlaylist.js";
import { ExamScreen } from "./ExamScreen.jsx";
import { AudioLoadingScreen, BootScreen, MessageScreen } from "./FlowScreens.jsx";
import { PracticeAudio, TranscriptPanel } from "./PracticeRunner.jsx";
import { CRITERIA, PREFS_KEY, loadPrefs } from "./practiceBits.js";
import { WritingTaskView } from "./WritingTaskView.jsx";

// A whole section of a practice test from the student hub: Listening parts 1-4, Reading passages
// 1-3 or both Writing tasks, in the exam-room screen (/ielts-test/:testId/:kind). Listening and
// Reading are marked on submit and reviewed in place; Writing gets the automatic checks and a
// model answer for each task. /ielts-test/review/:attemptId opens a finished section again.
//
// A section being taken is locked in every mode (lock/useExamLock.js): the lock's warning comes
// before it starts, and leaving the page before it is submitted cancels it. Nothing of a section
// reaches the server until it is submitted, so a cancelled one is simply never sent: there is
// nothing to mark, and no record of it. The review of a finished section is not locked.

const KINDS = ["listening", "reading", "writing"];
const LABEL = { listening: "Listening", reading: "Reading", writing: "Writing" };
const ICON = { listening: Headphones, reading: BookOpen, writing: PenLine };
// The practice tests' own tab: without ?tab= the page opens on a teacher's mock that is waiting.
const BACK = "/ielts-prep/practice-tests?tab=tests";
const noop = async () => {};
const unit = (kind) => (kind === "writing" ? "Task" : "Part");

function Intro({ kind, test, section, mode, setMode, onStart, onBack }) {
  const Icon = ICON[kind];
  const count = section.parts.length;
  const options =
    kind === "listening"
      ? [
          ["test", "Test conditions", `All ${count} recordings play once, one after another, with two minutes at the end to check your answers.`],
          ["free", "Practice mode", "Play, pause and replay each recording as often as you like. No time limit."]
        ]
      : [
          ["timed", `Timed: ${humanDuration(section.seconds)}`, `Your ${kind === "writing" ? "essays are" : "answers are"} submitted automatically when the time runs out, as in the test.`],
          ["untimed", "Untimed", "Take as long as you need. A clock shows how long you have spent."]
        ];
  const info =
    kind === "listening"
      ? [
          `${section.totalQuestions} questions in ${count} parts, about ${humanDuration(section.seconds)} in all.`,
          "Each part gives you time to read its questions before the recording goes on.",
          "Write your answers as you listen. Spelling counts, so use the last two minutes to check it."
        ]
      : kind === "reading"
        ? [
            `${section.totalQuestions} questions on ${count} passages. The real test allows 60 minutes for three.`,
            "The passages get harder, so don't spend more than about 20 minutes on each.",
            "Follow the word limit in each set of instructions. You can move between passages at any time."
          ]
        : [
            `${count === 1 ? "One task" : "Two tasks"}: at least 150 words for Task 1 and 250 for Task 2.`,
            "Task 2 counts twice as much as Task 1, so give it about 40 of the 60 minutes.",
            "After you submit, each essay gets quick checks and a model answer to compare with."
          ];
  return (
    <div className="ie-candidate-page">
      <div className="ie-instructions ie-practice-intro">
        <span className="ie-eyebrow">
          <span className="ie-eyebrow__icon">
            <Icon />
          </span>
          {test.title} · {LABEL[kind]}
        </span>
        <h1>{LABEL[kind]} section</h1>
        <ul>
          {info.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <h2>How do you want to take it?</h2>
        <div className="ie-practice-modes" role="radiogroup" aria-label="Mode">
          {options.map(([value, title, text]) => (
            <label key={value} className={`ie-practice-mode ${mode === value ? "ie-practice-mode--on" : ""}`}>
              <input type="radio" name="test-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
              <span className="ie-radio" aria-hidden="true" />
              <span>
                <b>{title}</b>
                <small>{text}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="ie-practice-actions">
          <Button variant="soft" icon={ChevronLeft} onClick={onBack}>
            Back to practice tests
          </Button>
          <Button size="lg" onClick={onStart}>
            Start
          </Button>
        </div>
      </div>
    </div>
  );
}

// Practice mode and the review: one recording at a time, chosen by part.
function SectionAudio({ parts }) {
  const withAudio = parts.filter((p) => p.audioUrl);
  const [index, setIndex] = useState(0);
  if (!withAudio.length) return null;
  const current = withAudio[Math.min(index, withAudio.length - 1)];
  return (
    <div className="ie-test-audio">
      {withAudio.length > 1 && (
        <div className="ie-test-audio__parts" role="group" aria-label="Recording for part">
          {withAudio.map((p, i) => (
            <button key={p.refId} type="button" className={i === index ? "on" : ""} aria-pressed={i === index} onClick={() => setIndex(i)} title={`Recording for part ${p.partNumber}`}>
              {p.partNumber}
            </button>
          ))}
        </div>
      )}
      <PracticeAudio key={current.refId} src={current.audioUrl} />
    </div>
  );
}

function ResultBanner({ kind, result, bonus, onRetry, onBack, onTranscript }) {
  const pct = result.total ? Math.round((result.correct / result.total) * 100) : 0;
  const chunks = (bonus?.section || 0) + (bonus?.whole || 0);
  return (
    <div className="ie-practice-result" role="status">
      <div className="ie-practice-result__score" style={{ "--p": pct }} aria-label={`${result.correct} of ${result.total} correct`}>
        <b>{result.correct}</b>
        <span>/ {result.total}</span>
      </div>
      <div className="ie-practice-result__text">
        <h2>
          {LABEL[kind]} band estimate: {Number(result.band).toFixed(1)}
        </h2>
        <p className="ie-test-parts">
          {(result.parts || []).map((p) => (
            <span key={p.refId}>
              {unit(kind)} {p.number}: <strong>{p.correct}</strong>/{p.total}
            </span>
          ))}
        </p>
        <p className="ie-practice-result__hint">
          {chunks > 0 ? (
            <span className="ie-test-bonus">
              <Sparkles /> +{chunks} comet chunks{bonus.whole ? " for finishing the whole test" : " for finishing this section"}.{" "}
            </span>
          ) : null}
          Ticks mark your correct answers. Wrong answers show the answer from the key.
        </p>
      </div>
      <div className="ie-practice-result__actions">
        {onTranscript && (
          <Button variant="outline" icon={FileText} onClick={onTranscript}>
            Transcript
          </Button>
        )}
        <Button variant="soft" icon={RotateCcw} onClick={onRetry}>
          Take it again
        </Button>
        <Button onClick={onBack}>Back to practice tests</Button>
      </div>
    </div>
  );
}

function WritingFeedback({ test, parts, essays, bonus, onRetry, onBack }) {
  const [index, setIndex] = useState(0);
  const essay = essays[Math.min(index, essays.length - 1)];
  const part = parts.find((p) => p.refId === essay.refId) || parts[0];
  const chunks = (bonus?.section || 0) + (bonus?.whole || 0);
  return (
    <div className="ie-practice-feedback">
      <header className="ie-exam-header">
        <span className="ie-logo">IELTS</span>
        <span className="ie-exam-taker">Feedback · {test.title} · Writing</span>
        <div className="ie-exam-header__right">
          <Button size="sm" variant="soft" icon={RotateCcw} onClick={onRetry}>
            Take it again
          </Button>
          <Button size="sm" onClick={onBack}>
            Back to practice tests
          </Button>
        </div>
      </header>
      {essays.length > 1 && (
        <div className="ie-test-tasktabs" role="tablist" aria-label="Task">
          {essays.map((e, i) => (
            <button key={e.refId} type="button" role="tab" aria-selected={i === index} className={i === index ? "on" : ""} onClick={() => setIndex(i)}>
              Task {e.task} <span>{e.feedback.words} words</span>
            </button>
          ))}
          {chunks > 0 && (
            <span className="ie-test-bonus">
              <Sparkles /> +{chunks} comet chunks{bonus.whole ? " for finishing the whole test" : " for finishing this section"}
            </span>
          )}
        </div>
      )}
      <div className="ie-practice-feedback__body">
        <section className="ie-pf-col">
          <WritingTaskView task={part} preview />
          <h3 className="ie-pf-title">
            Your answer <span>{essay.feedback.words} words</span>
          </h3>
          <div className="ie-pf-essay">
            {essay.essay.trim() ? essay.essay.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>) : <p className="ie-pf-empty">You didn't write anything for this task.</p>}
          </div>
        </section>
        <section className="ie-pf-col">
          <div className="ie-pf-card">
            <h3>Quick checks</h3>
            <p className="ie-pf-note">Automatic checks for the things examiners look for. They are not a band score.</p>
            <ul className="ie-pf-checks">
              {essay.feedback.checks.map((c) => (
                <li key={c.title} className={c.ok ? "ie-pf-ok" : "ie-pf-warn"}>
                  {c.ok ? <Check /> : <TriangleAlert />}
                  <div>
                    <b>{c.title}</b>
                    <span>{c.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="ie-pf-card">
            <h3>Check yourself against the four criteria</h3>
            <ul className="ie-pf-criteria">
              {CRITERIA[essay.task === 2 ? 2 : 1].map(([name, questions]) => (
                <li key={name}>
                  <b>{name}</b>
                  <ul>
                    {questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
          {essay.modelAnswerHtml && (
            <details className="ie-pf-card ie-pf-model">
              <summary>Model answer</summary>
              <p className="ie-pf-note">A strong sample answer. Compare its structure, overview and linking language with yours.</p>
              <RichHtml html={essay.modelAnswerHtml} />
            </details>
          )}
          <p className="ie-pf-note">For a band score, ask your teacher to review these essays.</p>
        </section>
      </div>
    </div>
  );
}

export default function TestRunner() {
  const { testId, kind: kindParam, attemptId } = useParams();
  const nav = useNavigate();
  const { token } = useStudentAuth();
  const { celebrate } = useProgress();
  const [data, setData] = useState(null); // { test, section }
  const [kind, setKind] = useState(kindParam || null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("loading");
  const [mode, setMode] = useState(kindParam === "listening" ? "test" : "timed");
  const [playlist, setPlaylist] = useState(null);
  const [loaded, setLoaded] = useState(0);
  const [prefs, setPrefsState] = useState(loadPrefs);
  const [result, setResult] = useState(null);
  const [submitted, setSubmitted] = useState({});
  const [run, setRun] = useState(0);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const [handingIn, setHandingIn] = useState(false);
  const [ended, setEnded] = useState(null); // { kind } once the student has left the running section
  const startedAt = useRef(0);
  const playlistRef = useRef(null);
  const valid = attemptId ? true : KINDS.includes(kindParam);

  // The student left: the recording stops and the answers are dropped with the screen.
  const cancel = (leaveKind) => {
    playlistRef.current?.destroy();
    playlistRef.current = null;
    setLeaveOpen(false);
    setEnded({ kind: leaveKind, sent: true });
  };
  const lock = useExamLock({ active: phase === "exam" && !handingIn && !ended, onLeave: cancel });

  useEffect(() => {
    if (!valid) return undefined;
    let live = true;
    const fail = (err) => {
      if (!live) return;
      setError(err.message);
      setPhase("error");
    };
    if (attemptId) {
      // A finished section, opened again from the hub.
      ieltsTestAttempt(token, attemptId)
        .then((d) => {
          if (!live) return;
          setKind(d.attempt.kind);
          setData({ test: d.test, section: d.section });
          setSubmitted(d.answers || {});
          setResult(d);
          setPhase(d.attempt.kind === "writing" ? "feedback" : "review");
        })
        .catch(fail);
    } else {
      ieltsTestSection(token, testId, kindParam)
        .then((d) => {
          if (!live) return;
          setKind(kindParam);
          setData(d);
          setPhase("intro");
        })
        .catch(fail);
    }
    return () => {
      live = false;
      playlistRef.current?.destroy();
    };
  }, [valid, token, testId, kindParam, attemptId]);

  const setPrefs = (next) => {
    setPrefsState(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  };

  const dropPlaylist = useCallback(() => {
    playlistRef.current?.destroy();
    playlistRef.current = null;
    setPlaylist(null);
  }, []);

  const start = async () => {
    setResult(null);
    setSubmitted({});
    setTranscriptOpen(false);
    if (kind === "listening" && mode === "test") {
      setPhase("audio");
      setLoaded(0);
      try {
        const parts = data.section.parts.filter((p) => p.audioUrl);
        const blobs = await downloadAudio(
          parts.map((p) => p.audioUrl),
          setLoaded
        );
        const pl = await new Playlist(
          blobs,
          parts.map((p) => p.durationSeconds)
        ).ready();
        playlistRef.current?.destroy();
        playlistRef.current = pl;
        setPlaylist(pl);
      } catch (err) {
        exitFullscreen();
        setError(err.message);
        setPhase("error");
        return;
      }
    }
    startedAt.current = Date.now();
    setRun((r) => r + 1);
    setPhase("exam");
  };
  // The click that accepts the lock's warning is also what lets the browser go to full screen.
  const onStart = () => {
    setNotice(false);
    enterFullscreen();
    start();
  };

  const targetId = data?.test.id;
  const onSubmit = useCallback(
    async (answers) => {
      const seconds = Math.round((Date.now() - startedAt.current) / 1000);
      setHandingIn(true); // being sent: no longer something that can be left
      try {
        const r = await ieltsTestSubmit(token, targetId, kind, { answers, seconds });
        dropPlaylist();
        exitFullscreen(); // submitted: the lock is off
        setSubmitted(answers);
        setResult(r);
        celebrate(r.reward);
        setPhase(kind === "writing" ? "feedback" : "review");
      } finally {
        setHandingIn(false);
      }
    },
    [token, targetId, kind, celebrate, dropPlaylist]
  );

  const back = () => {
    dropPlaylist();
    nav(BACK);
  };
  // "Take it again" from a review opened by its own address goes to the section's own page.
  const retry = () => (attemptId ? nav(`/ielts-test/${data.test.id}/${kind}`) : setPhase("intro"));
  const exit = () => (phase === "exam" ? setLeaveOpen(true) : back());

  const keyOf = useMemo(() => new Map(Object.entries(result?.keys || {})), [result]);
  const marks = useMemo(() => new Map((result?.rows || []).map((r) => [r.slotId, r.correct])), [result]);
  const transcriptHtml = useMemo(() => {
    const transcripts = result?.transcripts || {};
    return (data?.section.parts || [])
      .filter((p) => transcripts[p.refId])
      .map((p) => `<h3>Part ${p.partNumber}: ${p.title.replace(/[<&>]/g, "")}</h3>${transcripts[p.refId]}`)
      .join("");
  }, [result, data]);

  if (!valid) return <MessageScreen title="Not found" message="This practice test section doesn't exist." actionLabel="Back to practice tests" onAction={() => nav(BACK)} />;
  // The student left the running section: nothing of it stays on the screen.
  if (ended) return <LockEnded ended={ended} kind="practice" backLabel="Back to practice tests" onBack={() => nav(BACK, { replace: true })} />;
  if (phase === "loading") return <BootScreen />;
  if (phase === "error") return <MessageScreen title="Something went wrong" message={error || "Please try again."} actionLabel="Back to practice tests" onAction={() => nav(BACK)} />;

  const { test, section } = data;
  if (phase === "intro")
    return (
      <>
        <Intro kind={kind} test={test} section={section} mode={mode} setMode={setMode} onStart={() => setNotice(true)} onBack={() => nav(BACK)} />
        {notice && (
          <LockNotice
            kind="practice"
            title="This section is locked"
            lead={`From the moment the ${LABEL[kind]} section starts until you submit it, this page has to stay open and in front${
              (kind === "listening" ? mode === "test" : mode === "timed") ? "." : ", with or without a time limit."
            }`}
            startLabel="I understand. Start"
            onCancel={() => setNotice(false)}
            onStart={onStart}
          />
        )}
      </>
    );
  if (phase === "audio") return <AudioLoadingScreen progress={loaded} />;
  if (phase === "feedback") return <WritingFeedback test={test} parts={section.parts} essays={result.essays} bonus={result.bonus} onRetry={retry} onBack={back} />;

  const review = phase === "review";
  const timed = kind === "listening" ? mode === "test" : mode === "timed";
  // In test conditions the clock follows the recordings as they were actually loaded.
  const seconds = kind === "listening" && playlist ? Math.round(playlist.totalDuration) + 120 : section.seconds;
  const showAudio = kind === "listening" && (review || mode === "free");

  return (
    <>
      <ExamScreen
        key={`${run}-${phase}`}
        section={kind}
        candidateId=""
        label={`${review ? "Review" : test.title} · ${LABEL[kind]}`}
        parts={section.parts}
        timed={timed}
        remainingSeconds={seconds}
        initialAnswers={review ? submitted : {}}
        prefs={prefs}
        onPrefs={setPrefs}
        playlist={!review && kind === "listening" && mode === "test" ? playlist : null}
        previewExtra={
          <div className="ie-practice-tools">
            {showAudio && <SectionAudio parts={section.parts} />}
            {!review && (
              <button type="button" className="ie-btn ie-btn--soft ie-btn--sm" onClick={exit}>
                <LogOut /> Exit
              </button>
            )}
          </div>
        }
        onAutosave={noop}
        onSubmit={onSubmit}
        submitCopy={
          kind === "writing"
            ? { title: "Finish the Writing section?", message: "Submit to see quick checks on each essay and a model answer.", button: "Submit essays" }
            : { title: `Finish the ${LABEL[kind]} section?`, message: "Submit now to see your score, your band estimate and the correct answers.", button: "Check answers" }
        }
        reveal={review}
        keyOf={review ? keyOf : undefined}
        marks={review ? marks : undefined}
        locked={review}
        topBanner={review ? <ResultBanner kind={kind} result={result} bonus={result.bonus} onRetry={retry} onBack={back} onTranscript={transcriptHtml ? () => setTranscriptOpen(true) : null} /> : null}
      />
      {review && transcriptOpen && <TranscriptPanel html={transcriptHtml} onClose={() => setTranscriptOpen(false)} />}
      {/* Out of full screen (Escape): the section is covered until they are back in. */}
      {lock.needFullscreen && <LockGate onEnter={lock.enterFullscreen} />}
      <ConfirmDialog
        open={leaveOpen}
        title="Leave and cancel this section?"
        message="This section is locked: if you leave before you submit, it is cancelled and nothing is saved or marked. To get your result, submit what you have."
        confirmLabel="Leave and cancel it"
        cancelLabel="Keep going"
        onConfirm={() => cancel("exit")}
        onCancel={() => setLeaveOpen(false)}
      />
    </>
  );
}
