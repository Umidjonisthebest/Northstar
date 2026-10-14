import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, Headphones, PartyPopper, PenLine, Play, Pause, RotateCcw, Volume1, Volume2 } from "lucide-react";
import { Button, Spinner } from "../components/ui.jsx";
import { humanDuration } from "../lib/format.js";

const SECTION_LABEL = { listening: "Listening", reading: "Reading", writing: "Writing" };
const SECTION_ICON = { listening: Headphones, reading: BookOpen, writing: PenLine };

function infoLines(section, sec) {
  const minutes = Math.round((sec?.durationSeconds || 0) / 60);
  const q = sec?.questionCount || 40;
  if (section === "listening") {
    return [
      `This mock test contains ${q} questions.`,
      "Each correct answer is worth one mark.",
      `The listening material is divided into ${sec?.partCount === 4 || !sec?.partCount ? "four" : sec.partCount} sections.`,
      "In the real exam you will only hear the audio once.",
      "Short pauses are provided so you can read the questions and check your answers."
    ];
  }
  if (section === "reading") {
    return [
      `This part of the test contains ${q} questions based on ${sec?.partCount === 3 || !sec?.partCount ? "three" : sec.partCount} passages.`,
      "Each correct answer is worth one mark.",
      `You have ${minutes} minutes for the whole Reading test.`,
      "You can move between the passages and change your answers at any time before you submit.",
      "Your answers are submitted automatically when the time runs out."
    ];
  }
  return [
    `There ${sec?.partCount === 1 ? "is one task" : "are two tasks"} in this part of the test.`,
    "Task 2 contributes twice as much as Task 1 to the Writing score.",
    "Write at least 150 words for Task 1 and at least 250 words for Task 2.",
    `You have ${minutes} minutes for the whole Writing test.`,
    "Your answers are saved automatically and submitted when the time runs out."
  ];
}

export function Stepper({ steps, current }) {
  const index = steps.indexOf(current);
  const pct = steps.length > 1 ? (Math.max(0, index) / (steps.length - 1)) * 100 : 0;
  return (
    <div className="ie-stepper">
      <div className="ie-stepper__track">
        <span className="ie-stepper__fill" style={{ width: `${pct}%` }} />
      </div>
      {steps.map((s, i) => {
        const state = i < index ? "done" : i === index ? "active" : "todo";
        return (
          <div key={s} className={`ie-step ie-step--${state}`}>
            <span className="ie-step__dot">{state === "done" ? <Check /> : i + 1}</span>
            <span className="ie-step__label">{SECTION_LABEL[s]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function InstructionsScreen({ state, onStart, busy }) {
  const section = state.step;
  const sec = state.sections[section];
  const Icon = SECTION_ICON[section];
  return (
    <div className="ie-candidate-page">
      <div className="ie-instructions">
        <span className="ie-eyebrow">
          <span className="ie-eyebrow__icon">
            <Icon />
          </span>
          IELTS – Full mock test
        </span>
        <h1>Instructions and information</h1>
        <p className="ie-instructions__duration">
          {section === "listening" ? (
            <>
              Approximate duration: <span>{humanDuration(state.totalSeconds)}</span>
            </>
          ) : (
            <>
              {SECTION_LABEL[section]} — time allowed: <span>{humanDuration(sec.durationSeconds)}</span>
            </>
          )}
        </p>
        <h2>Instructions to candidates</h2>
        <ul>
          <li>Answer all questions in the order they appear.</li>
          <li>You may review and change your answers while the test is open.</li>
        </ul>
        <h2>Information for candidates</h2>
        <ul>
          {infoLines(section, sec).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="ie-instructions__start">
          <Button size="lg" onClick={onStart} loading={busy}>
            Start test
          </Button>
        </div>
        <Stepper steps={state.steps} current={section} />
      </div>
    </div>
  );
}

export function AudioLoadingScreen({ progress }) {
  return (
    <div className="ie-loading-exam">
      <header className="ie-exam-header">
        <span className="ie-logo">IELTS</span>
        <span className="ie-exam-taker">Loading Test...</span>
      </header>
      <div className="ie-loading-exam__body" aria-hidden="true">
        <div className="ie-skeleton" style={{ height: 70 }} />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="ie-skeleton" style={{ height: 22, width: `${80 - i * 9}%` }} />
        ))}
        <div className="ie-skeleton" style={{ height: 180 }} />
      </div>
      <div className="ie-overlay ie-overlay--light">
        <div className="ie-audio-modal" role="status">
          Audio is loading: {progress}%
          <div className="ie-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TestSoundScreen({ volume, onVolume, onContinue, busy, resuming }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio("/ielts-assets/sound-test.wav");
    audio.preload = "auto";
    audio.onended = () => setPlaying(false);
    audioRef.current = audio;
    return () => audio.pause();
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const toggle = () => {
    const audio = audioRef.current;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const replay = () => {
    const audio = audioRef.current;
    audio.currentTime = 0;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <div className="ie-candidate-page">
      <div className="ie-sound-card">
        <h2>Test sound</h2>
        <p>Put on your headphones and click on the Play sound button to play a sound</p>
        {resuming && <p className="ie-sound-card__note">Your listening test will continue from where it stopped.</p>}
        <div className="ie-sound-controls">
          <button type="button" className="ie-sound-replay" onClick={replay} aria-label="Replay sound">
            <RotateCcw />
          </button>
          <button type="button" className="ie-play-pill" onClick={toggle}>
            {playing ? <Pause /> : <Play />}
            {playing ? "Pause" : "Play"}
          </button>
          <Volume1 className="ie-sound-vol" />
          <input className="ie-sound-range" type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={(e) => onVolume(Number(e.target.value) / 100)} aria-label="Volume" />
          <Volume2 className="ie-sound-vol" />
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button onClick={() => {
            audioRef.current?.pause();
            onContinue();
          }} loading={busy}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CompleteScreen({ onDone, seconds = 10 }) {
  const [left, setLeft] = useState(seconds);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    const id = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (left <= 0) doneRef.current();
  }, [left]);

  return (
    <div className="ie-complete-page">
      <div className="ie-complete-card">
        <span className="ie-complete-pill">
          <PartyPopper />
          WELL DONE!
        </span>
        <h2>You have completed the mock test</h2>
        <p>
          Redirecting in <strong>{Math.max(0, left)}s</strong>
        </p>
      </div>
    </div>
  );
}

export function MessageScreen({ title, message, actionLabel, onAction }) {
  return (
    <div className="ie-candidate-page">
      <div className="ie-sound-card" style={{ textAlign: "center" }}>
        <h2 style={{ marginBottom: 12 }}>{title}</h2>
        <p>{message}</p>
        {onAction && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Button onClick={onAction}>{actionLabel}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function BootScreen() {
  return (
    <div className="ie-candidate-page">
      <div className="ie-row ie-muted">
        <Spinner /> Preparing your test...
      </div>
    </div>
  );
}
