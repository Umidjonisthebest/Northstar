import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ieltsDiagnosticOverview, ieltsStartDiagnostic } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import { TrailArt } from "../../components/Art.jsx";
import { Loading } from "./Home.jsx";
import { fmtClock, fmtDate } from "./hubUtils.js";
import { band } from "./ieltsShared.jsx";
import "../../diagnostic.css";

// The IELTS diagnostic test's page in the hub (/ielts-prep/diagnostic): one
// random listening part or reading passage the student hasn't tried, run at
// /ielts-diagnostic/:id. New students land here from the welcome screen.

const KIND = { listening: ["Listening", "headphones"], reading: ["Reading", "book"] };

const STEPS = [
  ["A random part", "Listening or Reading, picked for you from the parts you've never tried, so the result shows where you are today."],
  ["Test conditions", "The recording plays once and reading is timed at 20 minutes, like the real test. Your answers save as you go."],
  ["Your starting band", "A band estimate with its CEFR level, and a review of every answer next to the key."]
];

export default function IeltsDiagnostic() {
  const { user, token } = useStudentAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const welcome = params.get("welcome") === "1";
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ieltsDiagnosticOverview(token)
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

  const start = async () => {
    setBusy(true);
    try {
      const { diagnostic } = await ieltsStartDiagnostic(token);
      nav(`/ielts-diagnostic/${diagnostic.id}`);
    } catch (e) {
      toast.error(e.message);
      setBusy(false);
    }
  };

  const { open, history, available } = data;
  const done = history.filter((h) => h.status === "completed");
  const latestOf = (kind) => done.find((h) => h.kind === kind) || null;
  const fresh = available.listening + available.reading;

  return (
    <div className="ns-page dg-page">
      <section className="dg-hero">
        <div>
          <span className="dg-kicker">
            <Icon name="compass" size={16} /> {welcome ? `Welcome to Northstar, ${user?.firstName || "friend"}` : "Diagnostic test"}
          </span>
          <h1>
            {done.length ? (
              <>
                Check your <span>band again</span>
              </>
            ) : (
              <>
                Find your <span>starting band</span>
              </>
            )}
          </h1>
          <p className="dg-lead">
            One Listening part or Reading passage you haven't tried yet, picked at random and taken under test conditions. You get a band estimate, your CEFR
            level and a review of every answer.
          </p>
          <div className="dg-facts">
            <div>
              <b>1 part</b>
              <span>Listening or Reading</span>
            </div>
            <div>
              <b>10–20</b>
              <span>minutes</span>
            </div>
            <div>
              <b>{fresh}</b>
              <span>new parts left</span>
            </div>
          </div>
          <div className="dg-actions">
            {open ? (
              <button className="ns-btn ns-btn-primary" onClick={() => nav(`/ielts-diagnostic/${open.id}`)}>
                <Icon name="play2" size={16} /> {open.status === "in_progress" ? `Continue: ${fmtClock(open.remainingSeconds)} left` : "Open my diagnostic"}
              </button>
            ) : data.canStart ? (
              <button className="ns-btn ns-btn-primary" onClick={start} disabled={busy}>
                <Icon name="play2" size={16} /> {busy ? "Picking your part…" : done.length ? "Take another diagnostic" : "Start the diagnostic"}
              </button>
            ) : null}
            {welcome && !open && (
              <Link to="/ielts-prep" className="ns-btn ns-btn-outline">
                Skip for now
              </Link>
            )}
          </div>
          <p className="dg-fresh">
            {data.canStart ? (
              <>
                <Icon name="check" size={17} strokeWidth={2.4} /> Only parts you haven't met in practice, mock tests or an earlier diagnostic ({available.listening}{" "}
                listening, {available.reading} reading left).
              </>
            ) : (
              <>
                <Icon name="info" size={17} /> {data.reason}
              </>
            )}
          </p>
        </div>
        <div className="dg-hero-art">
          <TrailArt marks={["5.0", "6.0", "7.5", "9.0"]} extra="headphones" />
        </div>
      </section>

      {open && (
        <div className="dg-running">
          <Icon name={KIND[open.kind][1]} size={26} />
          <div>
            <b>
              {open.status === "in_progress" ? "Your diagnostic is running" : "Your diagnostic is ready"}: {KIND[open.kind][0]} Part {open.number}
            </b>
            <p>
              {open.status === "in_progress"
                ? `${fmtClock(open.remainingSeconds)} left. The clock keeps going while you're away, and your answers are submitted when it runs out.`
                : `"${open.title}". The clock starts when you press Start test.`}
            </p>
          </div>
          <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={() => nav(`/ielts-diagnostic/${open.id}`)}>
            {open.status === "in_progress" ? "Continue" : "Open"}
          </button>
        </div>
      )}

      <section>
        <div className="ns-section-head">
          <h2>
            <Icon name="target" size={22} /> Your starting bands
          </h2>
        </div>
        <div className="dg-bands">
          {Object.entries(KIND).map(([kind, [name, icon]]) => {
            const h = latestOf(kind);
            return (
              <div key={kind} className={`dg-band ${h ? "" : "empty"}`}>
                <span className={`dg-kind ${kind}`}>
                  <Icon name={icon} size={22} />
                </span>
                <div>
                  <small>{name}</small>
                  <b>{h ? band(h.result.band) : "—"}</b>
                  {h && <span className="dg-level">CEFR {h.result.cefr}</span>}
                  <small>{h ? `${fmtDate(h.submittedAt)} · ${h.result.correct} of ${h.result.total} correct` : "Not tested yet"}</small>
                </div>
              </div>
            );
          })}
        </div>
      </section>

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
                <Link key={h.id} to={`/ielts-diagnostic/${h.id}`} className="dg-hrow">
                  <span className="dg-hrow-score">{band(h.result.band)}</span>
                  <span className="dg-hrow-main">
                    <b>{h.title}</b>
                    <small>
                      {KIND[h.kind][0]} Part {h.number} · {fmtDate(h.submittedAt)} · {h.result.correct} of {h.result.total} correct · CEFR {h.result.cefr}
                    </small>
                  </span>
                  <Icon name="chevronRight" size={18} />
                </Link>
              ) : (
                <div key={h.id} className="dg-hrow">
                  <span className="dg-hrow-score none">{h.status === "cancelled" ? "Cancelled" : "No band"}</span>
                  <span className="dg-hrow-main">
                    <b>{h.title}</b>
                    <small>
                      {KIND[h.kind][0]} Part {h.number} ·{" "}
                      {h.status === "cancelled"
                        ? `cancelled: you ${h.cancelled?.reason || "left the test page"}`
                        : h.answered
                          ? "time ran out with fewer than half the questions answered"
                          : "closed with nothing answered"}
                    </small>
                  </span>
                </div>
              )
            )}
          </div>
        </section>
      )}

      <p className="dg-note">
        <Icon name="info" size={18} /> Writing and Speaking need an examiner, so they aren't part of the diagnostic. Your teacher marks them in a full mock test.
      </p>
    </div>
  );
}
