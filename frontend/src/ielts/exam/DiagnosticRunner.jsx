import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BookOpen, ChevronLeft, FileText, Headphones, Shuffle } from "lucide-react";
import { ieltsBeginDiagnostic, ieltsGetDiagnostic, ieltsLeaveDiagnostic, ieltsSaveDiagnostic, ieltsSubmitDiagnostic } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { Button } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { LockEnded, LockGate, LockNotice } from "../../lock/LockScreens.jsx";
import { enterFullscreen, exitFullscreen, useExamLock, useLeaveReport } from "../../lock/useExamLock.js";
import { Playlist, downloadAudio } from "./audioPlaylist.js";
import { ExamScreen } from "./ExamScreen.jsx";
import { AudioLoadingScreen, BootScreen, MessageScreen, TestSoundScreen } from "./FlowScreens.jsx";
import { TranscriptPanel } from "./PracticeRunner.jsx";

// The IELTS diagnostic test (/ielts-diagnostic/:id): one listening part or
// reading passage, picked at random, under test conditions. The clock runs on
// the server, so a refresh resumes where the student was (listening picks the
// recording up at the right second). After marking, the part is reviewed in
// place with the band estimate on top.
//
// The running test is locked (lock/useExamLock.js): the lock's warning comes
// before it starts, and leaving the page before it is submitted cancels it.

const BACK = "/ielts-prep/diagnostic";
const PREFS_KEY = "ielts_exam_prefs";
const DEFAULT_PREFS = { contrast: "bow", textSize: "regular", volume: 0.8 };
const LABEL = { listening: "Listening", reading: "Reading" };
const ICON = { listening: Headphones, reading: BookOpen };

const band = (b) => (b == null ? "—" : Number(b).toFixed(1));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const noop = async () => {};

function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

function Intro({ data, busy, onStart, onBack }) {
  const { diagnostic: d, item } = data;
  const Icon = ICON[d.kind];
  const minutes = Math.round((d.durationSeconds || 0) / 60);
  const info =
    d.kind === "listening"
      ? [
          `${item.questionCount} questions. The recording is about ${item.minutes} minutes long and plays once, as in the real test.`,
          "Read the questions before each section of the recording starts, and write your answers as you listen.",
          "You get one more minute at the end to check your answers. Everything is submitted when the time runs out."
        ]
      : [
          `${item.questionCount} questions on one passage. You have ${minutes} minutes.`,
          "Select words in the passage to highlight them or add a note.",
          "Follow the word limit in each set of instructions. Your answers are submitted when the time runs out."
        ];
  return (
    <div className="ie-candidate-page">
      <div className="ie-instructions ie-practice-intro">
        <span className="ie-eyebrow">
          <span className="ie-eyebrow__icon">
            <Icon />
          </span>
          IELTS diagnostic test · {LABEL[d.kind]} Part {d.number}
        </span>
        <h1>{item.title}</h1>
        <p className="ie-diag-pick">
          <Shuffle />
          {LABEL[d.kind]} was picked at random from the parts you haven't tried yet, so you meet it for the first time, just like on test day.
        </p>
        <h2>Before you start</h2>
        <ul>
          {info.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="ie-practice-actions">
          <Button variant="soft" icon={ChevronLeft} onClick={onBack}>
            Not now
          </Button>
          <Button size="lg" onClick={onStart} loading={busy}>
            Start test
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResultBanner({ d, onTranscript, onPractice, onDone }) {
  const r = d.result;
  const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
  return (
    <div className="ie-practice-result" role="status">
      <div className="ie-practice-result__score" style={{ "--p": pct }} aria-label={`Band ${band(r.band)}`}>
        <b>{band(r.band)}</b>
        <span>band</span>
      </div>
      <div className="ie-practice-result__text">
        <h2>
          Your starting {LABEL[d.kind]} band: {band(r.band)} <span className="ie-diag-cefr">CEFR {r.cefr}</span>
        </h2>
        <p>
          {r.correct} of {r.total} correct{d.auto ? ", submitted when the time ran out" : ""}. It's an estimate from one part, so a full test may put you half a band
          either side.
        </p>
        <p className="ie-practice-result__hint">Ticks mark your correct answers. Wrong answers show the answer from the key.</p>
      </div>
      <div className="ie-practice-result__actions">
        {onTranscript && (
          <Button variant="outline" icon={FileText} onClick={onTranscript}>
            Transcript
          </Button>
        )}
        <Button variant="soft" onClick={onPractice}>
          Section practice
        </Button>
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

export default function DiagnosticRunner() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { token } = useStudentAuth();
  const { celebrate } = useProgress();
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [resuming, setResuming] = useState(false);
  const [playlist, setPlaylist] = useState(null);
  const [prefs, setPrefsState] = useState(loadPrefs);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const playlistRef = useRef(null);
  // The lock's warning, shown when the student presses Start test.
  const [notice, setNotice] = useState(false);
  // While the hand-in is on its way, the test is no longer "running".
  const [handingIn, setHandingIn] = useState(false);

  const { ended, end: endTest, resume: resumeLeave, forget: forgetLeave } = useLeaveReport(`ielts-diag:${id}`, (kind) => ieltsLeaveDiagnostic(token, id, kind));
  const lock = useExamLock({
    active: phase === "exam" && !handingIn && !ended,
    onLeave: (kind) => {
      playlistRef.current?.destroy(); // the recording stops with the test
      playlistRef.current = null;
      endTest(kind);
    }
  });

  const dropPlaylist = useCallback(() => {
    playlistRef.current?.destroy();
    playlistRef.current = null;
    setPlaylist(null);
  }, []);

  const fail = useCallback((err) => {
    setError(err?.message || "Something went wrong.");
    setPhase("error");
  }, []);

  // Listening: the whole recording is downloaded before the clock starts, then a sound check.
  const loadAudio = useCallback(
    async (payload) => {
      setPhase("audio");
      setLoaded(0);
      try {
        const blobs = await downloadAudio([payload.part.audioUrl], setLoaded);
        const pl = await new Playlist(blobs, [payload.part.durationSeconds]).ready();
        playlistRef.current?.destroy();
        playlistRef.current = pl;
        setPlaylist(pl);
        setPhase("sound");
      } catch (err) {
        fail(err);
      }
    },
    [fail]
  );

  const route = useCallback(
    (payload) => {
      setData(payload);
      const { status, kind } = payload.diagnostic;
      if (status !== "in_progress") forgetLeave();
      if (status === "completed") return setPhase("review");
      if (status === "cancelled") return setPhase("cancelled");
      if (status === "expired") return setPhase("expired");
      if (!payload.part) return fail(new Error("This part is no longer available. Go back and start a new diagnostic."));
      if (status === "created") return setPhase("intro");
      // A leave this browser saw but never got to the server: the test is over all the same.
      if (resumeLeave()) return undefined;
      // Running already (a refresh): reading carries on; listening reloads the audio first.
      if (kind === "listening") {
        setResuming(true);
        return loadAudio(payload);
      }
      return setPhase("exam");
    },
    [fail, loadAudio, resumeLeave, forgetLeave]
  );

  useEffect(() => {
    let live = true;
    ieltsGetDiagnostic(token, id)
      .then((payload) => live && route(payload))
      .catch((err) => live && fail(err));
    return () => {
      live = false;
      playlistRef.current?.destroy();
    };
  }, [token, id, route, fail]);

  const setPrefs = (next) => {
    setPrefsState(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  };

  // Starts the clock (or, after a refresh, gets the time that is left).
  const begin = async () => {
    enterFullscreen(); // from the sound check after a reload, this click is the first one
    setBusy(true);
    try {
      const payload = await ieltsBeginDiagnostic(token, id);
      setData(payload);
      setResuming(false);
      setPhase("exam");
    } catch (err) {
      if (err.code === "CLOSED") {
        dropPlaylist();
        // The clock already ended: show where it stands. A failure here is shown too, not dropped.
        try {
          route(await ieltsGetDiagnostic(token, id));
        } catch (again) {
          fail(again);
        }
      } else fail(err);
    } finally {
      setBusy(false);
    }
  };

  // Runs from the click that accepts the lock's warning, which is what lets the browser go to
  // full screen.
  const onStart = () => {
    setNotice(false);
    enterFullscreen();
    return data.diagnostic.kind === "listening" ? loadAudio(data) : begin();
  };

  const onAutosave = useCallback(
    async (answers, flags, keepalive) => {
      await ieltsSaveDiagnostic(token, id, { answers, flags }, keepalive);
    },
    [token, id]
  );

  const onSubmit = useCallback(
    async (answers, flags, { auto }) => {
      let result;
      setHandingIn(true);
      try {
        for (let attempt = 0; ; attempt++) {
          try {
            result = await ieltsSubmitDiagnostic(token, id, { answers, flags, auto });
            break;
          } catch (err) {
            if (!auto || attempt >= 5) {
              toast.error("Could not submit your answers", err.message);
              throw err;
            }
            await sleep(1500 * (attempt + 1));
          }
        }
        dropPlaylist();
        exitFullscreen(); // submitted: the lock is off
        if (auto) toast.info("Time is up", "Your answers have been submitted automatically.");
        celebrate(result.reward);
        setData(result);
        const { status } = result.diagnostic;
        setPhase(status === "completed" ? "review" : status === "cancelled" ? "cancelled" : "expired");
      } finally {
        setHandingIn(false);
      }
    },
    [token, id, toast, celebrate, dropPlaylist]
  );

  const review = data?.review;
  const keyOf = useMemo(() => new Map(Object.entries(review?.keys || {})), [review]);
  const marks = useMemo(() => new Map((review?.rows || []).map((r) => [r.slotId, r.correct])), [review]);
  const parts = useMemo(() => (data?.part ? [data.part] : []), [data]);

  // The student left the running test: nothing of it stays on the screen.
  if (ended) return <LockEnded ended={ended} kind="diagnostic" backLabel="Back to the diagnostic" onBack={() => nav(BACK, { replace: true })} />;
  if (phase === "loading") return <BootScreen />;
  if (phase === "error") return <MessageScreen title="Something went wrong" message={error || "Please try again."} actionLabel="Back to the diagnostic" onAction={() => nav(BACK)} />;
  if (phase === "cancelled")
    return (
      <MessageScreen
        title="This diagnostic was cancelled"
        message={`The test is locked, and you ${data?.diagnostic?.cancelled?.reason || "left the test page"} while it was running, so it ended with no band. You can start a new one with a different part.`}
        actionLabel="Back to the diagnostic"
        onAction={() => nav(BACK)}
      />
    );
  if (phase === "expired")
    return (
      <MessageScreen
        title="No band this time"
        message={
          data?.diagnostic?.answered
            ? "Time ran out with fewer than half of the questions answered, so this diagnostic has no band. You can start a new one with a different part."
            : "No answers were given, so this diagnostic has no band. You can start a new one with a different part."
        }
        actionLabel="Back to the diagnostic"
        onAction={() => nav(BACK)}
      />
    );
  if (phase === "intro")
    return (
      <>
        <Intro data={data} busy={busy} onStart={() => setNotice(true)} onBack={() => nav(BACK)} />
        {notice && (
          <LockNotice
            kind="diagnostic"
            title="This test is locked"
            lead="From the moment the test starts until you submit it, this page has to stay open and in front."
            startLabel="I understand. Start"
            onCancel={() => setNotice(false)}
            onStart={onStart}
          />
        )}
      </>
    );
  if (phase === "audio") return <AudioLoadingScreen progress={loaded} />;
  if (phase === "sound") return <TestSoundScreen volume={prefs.volume} onVolume={(volume) => setPrefs({ ...prefs, volume })} onContinue={begin} busy={busy} resuming={resuming} />;

  const d = data.diagnostic;
  const done = phase === "review";
  return (
    <>
      <ExamScreen
        key={phase}
        section={d.kind}
        candidateId=""
        label={`${done ? "Review" : "Diagnostic test"} · ${LABEL[d.kind]} Part ${d.number}`}
        parts={parts}
        timed
        remainingSeconds={d.remainingSeconds ?? 0}
        elapsedSeconds={d.elapsedSeconds || 0}
        initialAnswers={d.answers || {}}
        initialFlags={done ? [] : d.flags || []}
        prefs={prefs}
        onPrefs={setPrefs}
        playlist={!done && d.kind === "listening" ? playlist : null}
        onAutosave={done ? noop : onAutosave}
        onSubmit={onSubmit}
        submitCopy={{ title: "Finish the diagnostic?", message: "You still have time. Submit now to see your band estimate and the answers.", button: "Submit answers" }}
        reveal={done}
        keyOf={done ? keyOf : undefined}
        marks={done ? marks : undefined}
        locked={done}
        topBanner={
          done ? (
            <ResultBanner
              d={d}
              onTranscript={review?.transcriptHtml ? () => setTranscriptOpen(true) : null}
              onPractice={() => nav("/ielts-prep/practice")}
              onDone={() => nav(BACK)}
            />
          ) : null
        }
      />
      {done && transcriptOpen && <TranscriptPanel html={review.transcriptHtml} onClose={() => setTranscriptOpen(false)} />}
      {/* Out of full screen (Escape, or the page opened again): the test is covered until they are back in. */}
      {lock.needFullscreen && <LockGate onEnter={lock.enterFullscreen} />}
    </>
  );
}
