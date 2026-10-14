import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BookOpen, Check, ChevronLeft, FileText, Headphones, LogOut, Pause, PenLine, Play, RotateCcw, TriangleAlert, X } from "lucide-react";
import { ieltsPracticeItem, ieltsPracticeSubmit } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { Button } from "../components/ui.jsx";
import { ConfirmDialog } from "../components/Modal.jsx";
import { RichHtml } from "../lib/richHtml.jsx";
import { clock } from "../lib/format.js";
import { Playlist, downloadAudio } from "./audioPlaylist.js";
import { ExamScreen } from "./ExamScreen.jsx";
import { AudioLoadingScreen, BootScreen, MessageScreen } from "./FlowScreens.jsx";
import { WritingTaskView } from "./WritingTaskView.jsx";
import { CRITERIA, PREFS_KEY, loadPrefs } from "./practiceBits.js";

// Self-study practice from the student hub (/ielts-practice/:kind/:id): one
// listening part, reading passage or writing task in the exam-room screen.
// Listening and reading are marked on submit and reviewed in place; writing
// gets quick automatic checks and a model answer.

const KINDS = ["listening", "reading", "writing"];
const LABEL = { listening: "Listening", reading: "Reading", writing: "Writing" };
const ICON = { listening: Headphones, reading: BookOpen, writing: PenLine };
const BACK = "/ielts-prep/practice";
const CHECK_SECONDS = 60; // after the recording, in test conditions

const partLabel = (kind, n) => `${LABEL[kind]} ${kind === "writing" ? "Task" : "Part"} ${n}`;
const noop = async () => {};

function Intro({ kind, item, mode, setMode, onStart, onBack }) {
  const Icon = ICON[kind];
  const options =
    kind === "listening"
      ? [
          ["test", "Test conditions", "The recording plays once, as in the real test, with a minute at the end to check your answers."],
          ["free", "Practice mode", "Pause, rewind and replay the recording as often as you like. No time limit."]
        ]
      : [
          ["timed", `Timed: ${item.minutes} minutes`, `Your ${kind === "writing" ? "essay is" : "answers are"} submitted automatically when the time runs out, as in the test.`],
          ["untimed", "Untimed", "Take as long as you need. A clock shows how long you have spent."]
        ];
  const info =
    kind === "listening"
      ? [`${item.questionCount} questions, about ${item.minutes} minutes of audio.`, "Read the questions before each part of the recording starts.", "Write your answers as you listen, then check your spelling."]
      : kind === "reading"
        ? [
            `${item.questionCount} questions on one passage. Allow about ${item.minutes} minutes.`,
            "Select words in the passage to highlight them or add a note.",
            "Follow the word limit in each set of instructions, and check your spelling."
          ]
        : [
            `Write at least ${item.minWords} words. Allow about ${item.minutes} minutes.`,
            "Spend a few minutes planning before you write, and leave time to check.",
            "After you submit, you'll get quick checks on your essay and a model answer to compare with."
          ];
  return (
    <div className="ie-candidate-page">
      <div className="ie-instructions ie-practice-intro">
        <span className="ie-eyebrow">
          <span className="ie-eyebrow__icon">
            <Icon />
          </span>
          IELTS practice · {partLabel(kind, item.number)}
        </span>
        <h1>{item.title}</h1>
        <ul>
          {info.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <h2>How do you want to practise?</h2>
        <div className="ie-practice-modes" role="radiogroup" aria-label="Practice mode">
          {options.map(([value, title, text]) => (
            <label key={value} className={`ie-practice-mode ${mode === value ? "ie-practice-mode--on" : ""}`}>
              <input type="radio" name="practice-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
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
            Back to practice
          </Button>
          <Button size="lg" onClick={onStart}>
            Start
          </Button>
        </div>
      </div>
    </div>
  );
}

// Free-play audio for practice mode and for listening again in the review.
export function PracticeAudio({ src }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = "auto";
    ref.current = audio;
    const onTime = () => setTime(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeAttribute("src");
    };
  }, [src]);

  const toggle = () => {
    const audio = ref.current;
    if (!audio) return;
    if (audio.paused) audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else {
      audio.pause();
      setPlaying(false);
    }
  };
  const back = () => {
    if (ref.current) ref.current.currentTime = Math.max(0, ref.current.currentTime - 10);
  };

  return (
    <div className="ie-practice-audio" role="group" aria-label="Recording">
      <button type="button" className="ie-practice-audio__btn ie-practice-audio__btn--main" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause /> : <Play />}
      </button>
      <button type="button" className="ie-practice-audio__btn" onClick={back} aria-label="Back 10 seconds" title="Back 10 seconds">
        <RotateCcw />
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.round(duration))}
        step={1}
        value={Math.round(time)}
        onChange={(e) => {
          if (ref.current) ref.current.currentTime = Number(e.target.value);
        }}
        aria-label="Position in the recording"
      />
      <span className="ie-practice-audio__time">
        {clock(time)} / {clock(duration)}
      </span>
    </div>
  );
}

function ResultBanner({ result, onRetry, onBack, onTranscript }) {
  const pct = result.total ? Math.round((result.correct / result.total) * 100) : 0;
  return (
    <div className="ie-practice-result" role="status">
      <div className="ie-practice-result__score" style={{ "--p": pct }} aria-label={`${result.correct} of ${result.total} correct`}>
        <b>{result.correct}</b>
        <span>/ {result.total}</span>
      </div>
      <div className="ie-practice-result__text">
        <h2>{pct >= 80 ? "Excellent work!" : pct >= 60 ? "Good effort!" : "Keep practising!"}</h2>
        <p>
          Band estimate for this part: <strong>{Number(result.band).toFixed(1)}</strong>. It's based on one part only, so treat it as a rough guide.
        </p>
        <p className="ie-practice-result__hint">Ticks mark your correct answers. Wrong answers show the answer from the key.</p>
      </div>
      <div className="ie-practice-result__actions">
        {onTranscript && (
          <Button variant="outline" icon={FileText} onClick={onTranscript}>
            Transcript
          </Button>
        )}
        <Button variant="soft" icon={RotateCcw} onClick={onRetry}>
          Try again
        </Button>
        <Button onClick={onBack}>Back to practice</Button>
      </div>
    </div>
  );
}

export function TranscriptPanel({ html, onClose }) {
  return (
    <aside className="ie-practice-transcript" role="dialog" aria-label="Transcript">
      <div className="ie-practice-transcript__head">
        <b>Transcript</b>
        <button type="button" className="ie-exam-icon" onClick={onClose} aria-label="Close transcript">
          <X />
        </button>
      </div>
      <RichHtml html={html} className="ie-practice-transcript__body" />
    </aside>
  );
}

function WritingFeedback({ item, part, essay, result, onRetry, onBack }) {
  const { feedback, modelAnswerHtml } = result;
  return (
    <div className="ie-practice-feedback">
      <header className="ie-exam-header">
        <span className="ie-logo">IELTS</span>
        <span className="ie-exam-taker">Feedback · {partLabel("writing", item.number)}</span>
        <div className="ie-exam-header__right">
          <Button size="sm" variant="soft" icon={RotateCcw} onClick={onRetry}>
            Try again
          </Button>
          <Button size="sm" onClick={onBack}>
            Back to practice
          </Button>
        </div>
      </header>
      <div className="ie-practice-feedback__body">
        <section className="ie-pf-col">
          <WritingTaskView task={part} preview />
          <h3 className="ie-pf-title">
            Your answer <span>{feedback.words} words</span>
          </h3>
          <div className="ie-pf-essay">
            {essay.trim() ? essay.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>) : <p className="ie-pf-empty">You didn't write anything this time.</p>}
          </div>
        </section>
        <section className="ie-pf-col">
          <div className="ie-pf-card">
            <h3>Quick checks</h3>
            <p className="ie-pf-note">Automatic checks for the things examiners look for. They are not a band score.</p>
            <ul className="ie-pf-checks">
              {feedback.checks.map((c) => (
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
              {CRITERIA[part.task === 2 ? 2 : 1].map(([name, questions]) => (
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
          {modelAnswerHtml && (
            <details className="ie-pf-card ie-pf-model">
              <summary>Model answer</summary>
              <p className="ie-pf-note">A strong sample answer. Compare its structure, overview and linking language with yours.</p>
              <RichHtml html={modelAnswerHtml} />
            </details>
          )}
          <p className="ie-pf-note">For a band score, ask your teacher to review this essay.</p>
        </section>
      </div>
    </div>
  );
}

export default function PracticeRunner() {
  const { kind, id } = useParams();
  const nav = useNavigate();
  const { token } = useStudentAuth();
  const { celebrate } = useProgress();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("loading");
  const [mode, setMode] = useState(kind === "listening" ? "test" : "timed");
  const [playlist, setPlaylist] = useState(null);
  const [loaded, setLoaded] = useState(0);
  const [prefs, setPrefsState] = useState(loadPrefs);
  const [result, setResult] = useState(null);
  const [submitted, setSubmitted] = useState({});
  const [run, setRun] = useState(0);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const startedAt = useRef(0);
  const playlistRef = useRef(null);
  const valid = KINDS.includes(kind);

  useEffect(() => {
    if (!valid) return undefined;
    let live = true;
    ieltsPracticeItem(token, kind, id)
      .then((d) => {
        if (!live) return;
        setData(d);
        setPhase("intro");
      })
      .catch((err) => {
        if (!live) return;
        setError(err.message);
        setPhase("error");
      });
    return () => {
      live = false;
      playlistRef.current?.destroy();
    };
  }, [valid, token, kind, id]);

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
        const blobs = await downloadAudio([data.part.audioUrl], setLoaded);
        const pl = await new Playlist(blobs, [data.part.durationSeconds]).ready();
        playlistRef.current?.destroy();
        playlistRef.current = pl;
        setPlaylist(pl);
      } catch (err) {
        setError(err.message);
        setPhase("error");
        return;
      }
    }
    startedAt.current = Date.now();
    setRun((r) => r + 1);
    setPhase("exam");
  };

  const onSubmit = useCallback(
    async (answers) => {
      const seconds = Math.round((Date.now() - startedAt.current) / 1000);
      const r = await ieltsPracticeSubmit(token, kind, id, { answers, seconds });
      dropPlaylist();
      setSubmitted(answers);
      setResult(r);
      celebrate(r.reward);
      setPhase(kind === "writing" ? "feedback" : "review");
    },
    [token, kind, id, celebrate, dropPlaylist]
  );

  const [leaveOpen, setLeaveOpen] = useState(false);
  const leave = () => {
    dropPlaylist();
    nav(BACK);
  };
  const exit = () => (phase === "exam" ? setLeaveOpen(true) : leave());

  const keyOf = useMemo(() => new Map(Object.entries(result?.keys || {})), [result]);
  const marks = useMemo(() => new Map((result?.rows || []).map((r) => [r.slotId, r.correct])), [result]);
  const parts = useMemo(() => (data ? [data.part] : []), [data]);

  if (!valid) return <MessageScreen title="Not found" message="This practice item doesn't exist." actionLabel="Back to practice" onAction={() => nav(BACK)} />;
  if (phase === "loading") return <BootScreen />;
  if (phase === "error")
    return <MessageScreen title="Something went wrong" message={error || "Please try again."} actionLabel="Back to practice" onAction={() => nav(BACK)} />;

  const { item, part } = data;
  if (phase === "intro") return <Intro kind={kind} item={item} mode={mode} setMode={setMode} onStart={start} onBack={() => nav(BACK)} />;
  if (phase === "audio") return <AudioLoadingScreen progress={loaded} />;
  if (phase === "feedback")
    return <WritingFeedback item={item} part={part} essay={String(submitted[part.refId] || "")} result={result} onRetry={() => setPhase("intro")} onBack={() => nav(BACK)} />;

  const review = phase === "review";
  const timed = kind === "listening" ? mode === "test" : mode === "timed";
  const seconds =
    kind === "listening" ? Math.round(playlist?.totalDuration || part.durationSeconds || 0) + CHECK_SECONDS : kind === "writing" ? (part.minutes || 20) * 60 : (item.minutes || 20) * 60;
  const showAudio = kind === "listening" && (review || mode === "free");

  return (
    <>
      <ExamScreen
        key={`${run}-${phase}`}
        section={kind}
        candidateId=""
        label={`${review ? "Review" : "Practice"} · ${partLabel(kind, item.number)}`}
        parts={parts}
        timed={timed}
        remainingSeconds={seconds}
        initialAnswers={review ? submitted : {}}
        prefs={prefs}
        onPrefs={setPrefs}
        playlist={!review && kind === "listening" && mode === "test" ? playlist : null}
        previewExtra={
          <div className="ie-practice-tools">
            {showAudio && <PracticeAudio src={part.audioUrl} />}
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
            ? { title: "Finish your essay?", message: "Submit to see quick checks on your writing and a model answer.", button: "Submit essay" }
            : { title: "Check your answers?", message: "Submit now to see your score and the correct answers.", button: "Check answers" }
        }
        reveal={review}
        keyOf={review ? keyOf : undefined}
        marks={review ? marks : undefined}
        locked={review}
        topBanner={
          review ? (
            <ResultBanner result={result} onRetry={() => setPhase("intro")} onBack={() => nav(BACK)} onTranscript={result.transcriptHtml ? () => setTranscriptOpen(true) : null} />
          ) : null
        }
      />
      {review && transcriptOpen && <TranscriptPanel html={result.transcriptHtml} onClose={() => setTranscriptOpen(false)} />}
      <ConfirmDialog
        open={leaveOpen}
        title="Leave this practice?"
        message="Your answers won't be saved."
        confirmLabel="Leave"
        cancelLabel="Keep going"
        onConfirm={leave}
        onCancel={() => setLeaveOpen(false)}
      />
    </>
  );
}
