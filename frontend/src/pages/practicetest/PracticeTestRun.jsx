import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { endPracticeTestRun, practiceTestRun } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import { Modal } from "../practice/PlayerParts.jsx";
import { LockNotice } from "../../lock/LockScreens.jsx";
import { enterFullscreen, exitFullscreen } from "../../lock/useExamLock.js";
import { TESTS_URL, clockLabel, moduleUrl, resultsUrl, sittingLabel } from "./ptUtils.js";
import "../../shell.css";
import "../../player.css";
import "../../practicetest.css";

// A sitting of a practice test between its modules, full screen at /practice-test/:runId: what
// has been handed in, which module is next, and the way out (leave for now, or end the sitting).
// Marks aren't shown here: they come with the results, once the sitting is over.
// This page isn't locked, so a student can stop here between modules. A module is
// (lock/useExamLock.js), and its warning is shown here before every one of them.

const STATUS = { completed: "Handed in", in_progress: "In progress", not_started: "Not started", skipped: "Not sat" };

export default function PracticeTestRun() {
  const { runId } = useParams();
  const { token } = useStudentAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(false);

  // Back from a module that was handed in: the lock is off until the next one.
  useEffect(() => {
    exitFullscreen();
  }, []);

  useEffect(() => {
    let alive = true;
    practiceTestRun(token, runId)
      .then((d) => {
        if (!alive) return;
        if (d.run.status !== "in_progress") nav(resultsUrl(runId), { replace: true });
        else setRun(d.run);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [token, runId, nav]);

  if (error) {
    return (
      <div className="pl-empty">
        <Nova size={90} mood="oops" />
        <h2>Couldn't open this practice test</h2>
        <p>{error}</p>
        <button className="ns-btn ns-btn-primary" onClick={() => nav(TESTS_URL)}>
          Back to Practice Tests
        </button>
      </div>
    );
  }
  if (!run) {
    return (
      <div className="pl-empty">
        <div className="ns-spinner" />
      </div>
    );
  }

  const next = run.modules.find((m) => m.status === "in_progress" || m.status === "not_started");
  const at = run.modules.indexOf(next);
  const handedIn = run.modules.filter((m) => m.status === "completed").length;
  // On test day there is a ten-minute break between the two sections.
  const breakNow = next && next.status === "not_started" && at > 0 && run.modules[at - 1].section !== next.section;
  const running = next?.status === "in_progress";
  const nextName = next ? `${next.title}${next.label ? `: ${next.label.replace(/^.*,\s*/, "")}` : ""}` : "";

  // The click that accepts the warning is what lets the browser go to full screen. The module's
  // screen only opens for someone who has come through here (`warned`).
  const openModule = () => {
    enterFullscreen();
    nav(moduleUrl(runId, next.key), { state: { warned: true } });
  };

  const end = async () => {
    setBusy(true);
    try {
      const r = await endPracticeTestRun(token, runId);
      // Nothing had been handed in: there is nothing to show, so the sitting is simply gone.
      if (!r.run) {
        toast.info("That attempt was removed: nothing had been handed in.");
        nav(TESTS_URL, { replace: true });
      } else nav(resultsUrl(runId), { replace: true });
    } catch (e) {
      toast.error(e.message);
      setBusy(false);
      setEnding(false);
    }
  };

  return (
    <div className="pt-stage">
      <div className="pt-run">
        <div className="pt-run-top">
          <button className="ns-back" onClick={() => nav(TESTS_URL)}>
            <Icon name="chevronLeft" size={18} /> Practice Tests
          </button>
          <ThemeToggle />
        </div>

        <span className="pt-kicker">
          <Icon name={run.timed ? "timer" : "stopwatch"} size={16} /> {sittingLabel(run)}
        </span>
        <h1>{run.title}</h1>
        <p className="pt-run-lead">
          {handedIn === 0 && !running
            ? `${run.modules.length} modules, one at a time. Your answers are marked when the last one is handed in.`
            : `${handedIn} of ${run.modules.length} modules handed in. Your score and every answer come once the last one is in.`}
        </p>

        <ol className="pt-modules">
          {run.modules.map((m, i) => (
            <li key={m.key} className={`pt-module ${m.status}${m === next ? " next" : ""}`}>
              <span className="pt-module-n">{m.status === "completed" ? <Icon name="check" size={16} strokeWidth={2.8} /> : i + 1}</span>
              <span className="pt-module-main">
                <b>{m.title}</b>
                <small>
                  {m.label ? `${m.label} · ` : ""}
                  {m.questions} questions{run.timed ? ` · ${m.minutes} min` : ""}
                </small>
              </span>
              <span className="pt-module-state">
                {m.status === "in_progress" && m.remainingSeconds != null ? `${clockLabel(m.remainingSeconds)} left` : m.status === "completed" && m.auto ? "Time ran out" : STATUS[m.status]}
              </span>
            </li>
          ))}
        </ol>

        {breakNow && (
          <p className="pt-break">
            <Icon name="pause" size={18} />
            <span>
              <b>Take a break.</b> On test day you get ten minutes here, between the two sections. Math starts when you say so.
            </span>
          </p>
        )}

        {next && (
          <button className="ns-btn ns-btn-primary pt-go" onClick={() => setNotice(true)}>
            <Icon name="play2" size={16} /> {running ? "Resume" : "Start"} {nextName}
          </button>
        )}
        <p className="pt-run-note">
          {run.timed
            ? running
              ? "This module's clock is running. When it reaches 0:00 the module is handed in with the answers you have given."
              : "A module's clock starts when you open it. At 0:00 the module is handed in with the answers you have given."
            : "No clock: the stopwatch only shows the time you spend on the questions."}{" "}
          A module is locked from the moment you open it until you hand it in: leave the page and this attempt is cancelled. You can stop here, between
          modules, and come back.
        </p>

        <button className="pt-end" onClick={() => setEnding(true)}>
          End this attempt
        </button>
      </div>

      {notice && next && (
        <LockNotice
          kind="practice"
          title="This module is locked"
          lead={
            running && next.remainingSeconds != null
              ? `${nextName} is still running, with ${clockLabel(next.remainingSeconds)} left. From here until you hand it in, this page has to stay open and in front.`
              : `${nextName} is ${next.questions} questions${run.timed ? ` in ${next.minutes} minutes` : " with no clock"}. From the moment you ${
                  running ? "go back in" : "start"
                } until you hand the module in, this page has to stay open and in front.`
          }
          startLabel={`I understand. ${running ? "Resume" : "Start"}`}
          onCancel={() => setNotice(false)}
          onStart={openModule}
        />
      )}

      {ending && (
        <Modal onClose={() => !busy && setEnding(false)} label="End this attempt">
          <div className="pl-modal-head">
            <h3>End this attempt?</h3>
          </div>
          <p className="pl-modal-sub">
            {handedIn === 0 && !running
              ? "Nothing has been handed in yet, so this attempt is simply removed."
              : `${running ? "The module in progress is handed in as it stands. " : ""}You get your results for the ${running ? handedIn + 1 : handedIn} module${
                  (running ? handedIn + 1 : handedIn) === 1 ? "" : "s"
                } handed in; the rest are left out. A section's scaled score needs both of its modules.`}
          </p>
          <div className="pl-modal-actions">
            <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={end} disabled={busy}>
              {busy ? "Ending…" : "End the attempt"}
            </button>
            <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={() => setEnding(false)} disabled={busy}>
              Keep going
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
