import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { diagnosticOverview, startDiagnostic } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import { TrailArt } from "../../components/Art.jsx";
import { Loading } from "./Home.jsx";
import { fmtClock, fmtDate } from "./hubUtils.js";
import { LockNotice } from "../../lock/LockScreens.jsx";
import { enterFullscreen, exitFullscreen } from "../../lock/useExamLock.js";
import "../../diagnostic.css";

// The SAT diagnostic test's page in the hub (/diagnostic): what the test is,
// a running test to continue, and past results. New students land here from
// the welcome screen with ?welcome=1.

const STEPS = [
  ["Answer 14 questions", "Seven Reading and Writing, seven Math, from every part of the test and from easy to hard. No hints and no answers until the end, just like test day."],
  ["Beat the clock", "20 minutes, the pace of the real digital SAT. Your answers save as you go and are handed in when time runs out. Answer at least half to get a score."],
  ["Get your starting point", "An estimated score for each section, your strongest and weakest skills, and a study plan that starts with what you missed."]
];

export default function Diagnostic() {
  const { user, token } = useStudentAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const welcome = params.get("welcome") === "1";
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    diagnosticOverview(token)
      .then(setData)
      .catch((e) => setData({ error: e.message }));
  }, [token]);

  if (!data) return <Loading />;
  if (data.error) {
    return (
      <div className="ns-page dg-page">
        <div className="ns-empty2">
          <b>Couldn't load the diagnostic</b>
          {data.error}
        </div>
      </div>
    );
  }

  // The test is locked (lock/useExamLock.js): its warning comes first, and the click that accepts
  // it is what lets the browser go to full screen.
  const start = async () => {
    enterFullscreen();
    setBusy(true);
    try {
      const id = data.open?.id || (await startDiagnostic(token)).diagnostic.id;
      nav(`/diagnostic/test/${id}`);
    } catch (e) {
      exitFullscreen();
      toast.error(e.message);
      setBusy(false);
      setNotice(false);
    }
  };

  const { open, history, next } = data;
  const done = history.filter((h) => h.status === "completed");
  const latest = done[0] || null;

  return (
    <div className="ns-page dg-page">
      <section className="dg-hero">
        <div>
          <span className="dg-kicker">
            <Icon name="compass" size={16} /> {welcome ? `Welcome to Northstar, ${user?.firstName || "friend"}` : "Diagnostic test"}
          </span>
          <h1>
            {latest ? (
              <>
                Check how far <span>you've come</span>
              </>
            ) : (
              <>
                Find your <span>starting score</span>
              </>
            )}
          </h1>
          <p className="dg-lead">
            {latest
              ? "Take the diagnostic again with a new set of questions to see your score now, and let your study plan catch up."
              : "A short, timed test that shows where you are today, so every practice session after it counts."}
          </p>
          <div className="dg-facts">
            <div>
              <b>{next.questions}</b>
              <span>new questions</span>
            </div>
            <div>
              <b>{next.minutes}</b>
              <span>minutes</span>
            </div>
            <div>
              <b>
                {next.rw} + {next.math}
              </b>
              <span>R&amp;W + Math</span>
            </div>
          </div>
          <div className="dg-actions">
            {open ? (
              <button className="ns-btn ns-btn-primary" onClick={() => setNotice(true)}>
                <Icon name="play2" size={16} /> Continue: {fmtClock(open.remainingSeconds)} left
              </button>
            ) : data.canStart ? (
              <button className="ns-btn ns-btn-primary" onClick={() => setNotice(true)} disabled={busy}>
                <Icon name="play2" size={16} /> {busy ? "Getting your questions…" : latest ? "Retake with new questions" : "Start the diagnostic"}
              </button>
            ) : null}
            {welcome && !open && (
              <Link to="/dashboard" className="ns-btn ns-btn-outline">
                Skip for now
              </Link>
            )}
            {latest && !welcome && (
              <Link to={`/diagnostic/results/${latest.id}`} className="ns-btn ns-btn-outline">
                See my last results
              </Link>
            )}
          </div>
          {data.canStart ? (
            <p className="dg-fresh">
              <Icon name="check" size={17} strokeWidth={2.4} /> Every question is new to you: nothing you've practised, saved or seen in an earlier diagnostic.
            </p>
          ) : (
            <p className="dg-fresh">
              <Icon name="info" size={17} /> {data.reason}
            </p>
          )}
        </div>
        <div className="dg-hero-art">
          <TrailArt />
        </div>
      </section>

      {open && (
        <div className="dg-running">
          <Icon name="timer" size={26} />
          <div>
            <b>Your diagnostic is running</b>
            <p>
              {open.answered} of {open.count} answered · {fmtClock(open.remainingSeconds)} left. The clock keeps going while you're away, and your answers are
              submitted when it runs out.
            </p>
          </div>
          <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={() => setNotice(true)}>
            Continue
          </button>
        </div>
      )}

      <section>
        <div className="ns-section-head">
          <h2>
            <Icon name="steps" size={22} /> How it works
          </h2>
        </div>
        <div className="dg-steps">
          {STEPS.map(([title, text], i) => (
            <div key={title} className="dg-step">
              <span className="dg-step-n">{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section>
          <div className="ns-section-head">
            <h2>
              <Icon name="history" size={22} /> Your diagnostics
            </h2>
          </div>
          <div className="dg-history">
            {history.map((h) =>
              h.status === "completed" ? (
                <Link key={h.id} to={`/diagnostic/results/${h.id}`} className="dg-hrow">
                  <span className="dg-hrow-score">{h.total ?? "—"}</span>
                  <span className="dg-hrow-main">
                    <b>
                      {h.level ? `${h.level} · ` : ""}R&amp;W {h.rw ?? "—"} · Math {h.math ?? "—"}
                    </b>
                    <small>
                      {fmtDate(h.submittedAt)} · {h.correct} of {h.count} correct{h.auto ? " · submitted when time ran out" : ""}
                    </small>
                  </span>
                  <Icon name="chevronRight" size={18} />
                </Link>
              ) : (
                <div key={h.id} className="dg-hrow">
                  <span className="dg-hrow-score none">{h.status === "cancelled" ? "Cancelled" : "No score"}</span>
                  <span className="dg-hrow-main">
                    <b>
                      {h.status === "cancelled"
                        ? `Cancelled: you ${h.cancelled?.reason || "left the test page"}`
                        : h.answered
                          ? "Time ran out with fewer than half the questions answered"
                          : "Closed before any question was answered"}
                    </b>
                    <small>
                      {fmtDate(h.submittedAt || h.startedAt)} · {h.answered} of {h.count} answered
                    </small>
                  </span>
                </div>
              )
            )}
          </div>
        </section>
      )}

      <p className="dg-note">
        <Icon name="info" size={18} /> The diagnostic score is an estimate from a short test, not an official College Board score. Your dashboard uses it until you
        take a full-length mock test.
      </p>

      {notice && (
        <LockNotice
          kind="diagnostic"
          title="This test is locked"
          lead={
            open
              ? `Your diagnostic is still running, with ${fmtClock(open.remainingSeconds)} left. From here until you submit it, this page has to stay open and in front.`
              : `${next.questions} questions in ${next.minutes} minutes. From the moment you start until you submit, this page has to stay open and in front.`
          }
          startLabel={`I understand. ${open ? "Continue" : "Start"}`}
          busy={busy}
          onCancel={() => setNotice(false)}
          onStart={start}
        />
      )}
    </div>
  );
}
