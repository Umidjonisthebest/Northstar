import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  candidateInfo,
  candidateToken,
  clearCandidateSession,
  examState,
  leaveExam,
  preloadListening,
  resumeSection,
  saveAnswers,
  startSection,
  submitSection
} from "../api.js";
import { useToast } from "../components/Toast.jsx";
import { IELTS_HOME } from "../paths.js";
import { LockEnded, LockGate, LockNotice } from "../../lock/LockScreens.jsx";
import { enterFullscreen, useExamLock, useLeaveReport } from "../../lock/useExamLock.js";
import { Playlist, downloadAudio } from "./audioPlaylist.js";
import { ExamScreen } from "./ExamScreen.jsx";
import { AudioLoadingScreen, BootScreen, CompleteScreen, InstructionsScreen, MessageScreen, TestSoundScreen } from "./FlowScreens.jsx";

const PREFS_KEY = "ielts_exam_prefs";
const DEFAULT_PREFS = { contrast: "bow", textSize: "regular", volume: 0.8 };
const LABELS = { listening: "Listening", reading: "Reading", writing: "Writing" };

function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Candidate state machine:
//   instructions → (listening: audio download → sound check) → exam → next section … → complete
// A refresh resumes the running section with the server's remaining time
// (listening re-downloads the audio and continues from the elapsed offset).
//
// A running section is locked (lock/useExamLock.js): the lock's warning comes before each
// section starts, and leaving the page while a section runs cancels the exam.
export default function ExamFlow() {
  const navigate = useNavigate();
  const toast = useToast();
  const [phase, setPhase] = useState("boot");
  const [state, setState] = useState(null);
  const [payload, setPayload] = useState(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefsState] = useState(loadPrefs);
  const [playlist, setPlaylist] = useState(null);
  const [resuming, setResuming] = useState(false);
  const playlistRef = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = state;
  // The lock's warning, shown when the candidate presses Start test.
  const [notice, setNotice] = useState(false);
  // While a section's hand-in is on its way, the test is no longer "running".
  const [handingIn, setHandingIn] = useState(false);

  const candidate = candidateInfo();
  const { ended, end: endTest, show: showCancelled, resume: resumeLeave } = useLeaveReport(`ielts:${candidate?.session?.id || ""}:${candidate?.id || ""}`, leaveExam);
  const lock = useExamLock({
    active: phase === "exam" && !handingIn && !ended,
    onLeave: (kind) => {
      playlistRef.current?.destroy(); // the recording stops with the test
      playlistRef.current = null;
      endTest(kind, stateRef.current?.lockRound || 0);
    }
  });
  // Students who opened the test from the Northstar hub go back there; exam-room candidates to the ID login.
  const exitTo = candidate?.returnTo || IELTS_HOME;

  const setPrefs = (next) => {
    setPrefsState(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  };

  const fail = useCallback((err) => {
    if (err?.code === "CANCELLED") {
      // The server already has it: the exam was left, here or on another device.
      showCancelled();
    } else if (err?.code === "SESSION_CLOSED") {
      setMessage(err.message);
      setPhase("closed");
    } else {
      setMessage(err?.message || "Something went wrong.");
      setPhase("error");
    }
  }, [showCancelled]);

  const dropPlaylist = () => {
    playlistRef.current?.destroy();
    playlistRef.current = null;
    setPlaylist(null);
  };

  const loadAudio = useCallback(async () => {
    setPhase("audio");
    setProgress(0);
    try {
      const { parts } = await preloadListening();
      const blobs = await downloadAudio(
        parts.map((p) => p.audioUrl).filter(Boolean),
        setProgress
      );
      const pl = await new Playlist(blobs, parts.map((p) => p.durationSeconds)).ready();
      playlistRef.current?.destroy();
      playlistRef.current = pl;
      setPlaylist(pl);
      setPhase("sound");
    } catch (err) {
      fail(err);
    }
  }, [fail]);

  const route = useCallback(
    async (st) => {
      if (st.step === "done") return setPhase("complete");
      const sec = st.sections[st.step];
      if (sec.status === "in_progress") {
        if (st.step === "listening") {
          setResuming(true);
          return loadAudio();
        }
        const p = await resumeSection(st.step);
        setPayload(p);
        return setPhase("exam");
      }
      setPhase("instructions");
    },
    [loadAudio]
  );

  const refresh = useCallback(async () => {
    try {
      const st = await examState();
      setState(st);
      // A leave this browser saw but never got to the server (it was offline, or the page was
      // closed first): the exam is over, and the report goes out now.
      if (resumeLeave(st.lockRound || 0)) return;
      await route(st);
    } catch (err) {
      fail(err);
    }
  }, [route, fail, resumeLeave]);

  useEffect(() => {
    if (!candidateToken()) {
      navigate(exitTo, { replace: true });
      return undefined;
    }
    refresh();
    return () => playlistRef.current?.destroy();
    // Boot once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Runs from the click that accepts the lock's warning, which is what lets the browser go to
  // full screen.
  const onStart = async () => {
    setNotice(false);
    enterFullscreen();
    if (state.step === "listening") return loadAudio();
    setBusy(true);
    try {
      setPayload(await startSection(state.step));
      setPhase("exam");
    } catch (err) {
      if (err.code === "WRONG_STEP") await refresh();
      else fail(err);
    } finally {
      setBusy(false);
    }
  };

  const onSoundContinue = async () => {
    enterFullscreen();
    setBusy(true);
    try {
      const p = resuming ? await resumeSection("listening") : await startSection("listening");
      setResuming(false);
      setPayload(p);
      setPhase("exam");
    } catch (err) {
      if (err.code === "WRONG_STEP") {
        dropPlaylist();
        await refresh();
      } else fail(err);
    } finally {
      setBusy(false);
    }
  };

  const onAutosave = useCallback(
    async (answers, flags, keepalive) => {
      const section = stateRef.current?.step;
      try {
        await saveAnswers(section, answers, flags, keepalive);
      } catch (err) {
        if (err.code === "SESSION_CLOSED" || err.code === "CANCELLED") fail(err);
        throw err;
      }
    },
    [fail]
  );

  const onSubmit = useCallback(
    async (answers, flags, { auto }) => {
      const section = stateRef.current.step;
      let next;
      setHandingIn(true);
      try {
        for (let attempt = 0; ; attempt++) {
          try {
            next = await submitSection(section, answers, flags, auto);
            break;
          } catch (err) {
            if (err.code === "SESSION_CLOSED" || err.code === "CANCELLED") {
              fail(err);
              throw err;
            }
            if (err.code === "WRONG_STEP") {
              next = await examState();
              break;
            }
            if (!auto || attempt >= 6) {
              toast.error("Could not submit your answers", err.message);
              throw err;
            }
            await sleep(1500 * (attempt + 1));
          }
        }
        if (section === "listening") dropPlaylist();
        if (auto) toast.info("Time is up", "Your answers have been submitted automatically.");
        setPayload(null);
        setState(next);
        if (next.step === "done") setPhase("complete");
        else await route(next);
      } finally {
        setHandingIn(false);
      }
    },
    [fail, route, toast]
  );

  const finish = () => {
    clearCandidateSession();
    navigate(exitTo, { replace: true });
  };

  // The candidate left a running section: nothing of the exam stays on the screen.
  if (ended) return <LockEnded ended={ended} kind="mock" backLabel={candidate?.returnTo ? "Back to Northstar" : "Back to login"} onBack={finish} />;
  if (phase === "boot") return <BootScreen />;
  if (phase === "closed")
    return <MessageScreen title="Session closed" message={message} actionLabel={candidate?.returnTo ? "Back to Northstar" : "Back to login"} onAction={finish} />;
  if (phase === "error")
    return (
      <MessageScreen
        title="Something went wrong"
        message={message}
        actionLabel="Try again"
        onAction={() => {
          setPhase("boot");
          refresh();
        }}
      />
    );
  if (phase === "complete") return <CompleteScreen onDone={finish} />;
  if (phase === "instructions")
    return (
      <>
        <InstructionsScreen state={state} onStart={() => setNotice(true)} busy={busy} />
        {notice && (
          <LockNotice
            kind="mock"
            title="This test is locked"
            lead={`${LABELS[state.step]} is about to start. From the moment it does until you submit it, this page has to stay open and in front.`}
            startLabel="I understand. Start"
            onCancel={() => setNotice(false)}
            onStart={onStart}
          />
        )}
      </>
    );
  if (phase === "audio") return <AudioLoadingScreen progress={progress} />;
  if (phase === "sound") return <TestSoundScreen volume={prefs.volume} onVolume={(volume) => setPrefs({ ...prefs, volume })} onContinue={onSoundContinue} busy={busy} resuming={resuming} />;

  const steps = state.steps;
  const nextStep = steps[steps.indexOf(state.step) + 1];
  return (
    <>
      <ExamScreen
        key={state.step}
        section={state.step}
        candidateId={candidate?.candidateId ?? state.candidate.candidateId}
        parts={payload.parts}
        remainingSeconds={payload.remainingSeconds}
        elapsedSeconds={payload.elapsedSeconds}
        initialAnswers={payload.answers}
        initialFlags={payload.flags}
        prefs={prefs}
        onPrefs={setPrefs}
        playlist={state.step === "listening" ? playlist : null}
        nextLabel={nextStep ? LABELS[nextStep] : null}
        onAutosave={onAutosave}
        onSubmit={onSubmit}
      />
      {/* Out of full screen (Escape, or the page opened again): the test is covered until they are back in. */}
      {lock.needFullscreen && <LockGate onEnter={lock.enterFullscreen} />}
    </>
  );
}
