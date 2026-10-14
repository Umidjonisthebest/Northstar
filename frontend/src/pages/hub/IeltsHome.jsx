import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ieltsStudentSessions, ieltsTests, updateSettings } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import { EmptyArt, TargetArt } from "../../components/Art.jsx";
import { SkyCard } from "../../components/Sky.jsx";
import LeagueCard from "../../components/LeagueCard.jsx";
import RecapPrompt from "../../components/RecapPrompt.jsx";
import { DiagnosticPrompt, EditableScore, Loading, useCountdown } from "./Home.jsx";
import ClassPrompt from "../../components/ClassPrompt.jsx";
import { chunkWord } from "../../components/avatar/shopParts.js";
import { greeting, playerUrl } from "./hubUtils.js";
import { IELTS_MOCKS_URL, IELTS_SKILLS, band, sessionWhen, useEnterIelts } from "./ieltsShared.jsx";

const NOVA_STARTERS = ["How do I improve Writing Task 2?", "Reading: True / False / Not Given tips", "How should I prepare for Speaking Part 2?"];

const PRACTICE_TILES = [
  ["listening", "Listening", "headphones", "Single parts with audio"],
  ["reading", "Reading", "book", "One passage at a time"],
  ["writing", "Writing", "pencil", "Tasks with model answers"]
];

// Opens the practice page on the chosen skill's tab (IeltsPractice.jsx reads it).
function openPracticeTab(kind) {
  try {
    sessionStorage.setItem("ns_ielts_practice_tab", kind);
  } catch {
    /* private mode */
  }
}

export default function IeltsHome() {
  const { user, token } = useStudentAuth();
  const { progress, refresh } = useProgress();
  const { toast } = useToast();
  const nav = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [tests, setTests] = useState(null); // the practice tests; the page doesn't wait for them
  const { enter, entering } = useEnterIelts(token, "/ielts-prep");

  useEffect(() => {
    ieltsStudentSessions(token)
      .then((d) => setSessions(d.sessions))
      .catch(() => setSessions([]));
    ieltsTests(token)
      .then(setTests)
      .catch(() => setTests(null));
  }, [token]);

  const upcoming = (sessions || [])
    .filter((s) => s.status !== "completed" && s.date && new Date(`${s.date}T${s.time || "00:00"}`).getTime() > Date.now())
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];
  const cd = useCountdown(upcoming ? new Date(`${upcoming.date}T${upcoming.time || "00:00"}`).toISOString() : null);

  if (!sessions || !progress) return <Loading />;

  const live = sessions.find((s) => s.canEnter);
  const diagBands = progress.ieltsDiagnostic?.bands || {};
  const diagNote = ["listening", "reading"]
    .filter((k) => diagBands[k])
    .map((k) => `${k === "listening" ? "Listening" : "Reading"} ${band(diagBands[k].band)} (${diagBands[k].cefr})`)
    .join(" · ");
  const withResults = sessions.filter((s) => s.results?.overall != null);
  const latest = withResults[0] || null;
  const best = withResults.reduce((m, s) => (m == null || s.results.overall > m ? s.results.overall : m), null);
  const upcomingCount = sessions.filter((s) => s.status !== "completed" && s.state !== "finished").length;

  const saveTarget = async (v) => {
    try {
      await updateSettings(token, { ieltsTarget: v ?? 7 });
      await refresh();
      toast.success("Target band saved");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="ns-home ns-page">
      <div className="ns-hero-row">
        <div className="ns-hello">
          <h1>
            {greeting()}, <span>{user?.firstName}</span>
          </h1>
          <div className="ns-hello-actions">
            {live ? (
              <button className="ns-btn ns-btn-primary" disabled={entering === live.id} onClick={() => enter(live)}>
                <Icon name="play2" size={16} /> {entering === live.id ? "Opening…" : live.state === "in_progress" ? `Continue ${live.currentSection}` : "Start IELTS test"}
              </button>
            ) : (
              <Link to={IELTS_MOCKS_URL} className="ns-btn ns-btn-primary">
                <Icon name="mock" size={17} /> My teacher's mocks
              </Link>
            )}
            <Link to="/nova" className="ns-btn ns-btn-outline">
              Ask Nova about IELTS <Icon name="chevronRight" size={16} />
            </Link>
          </div>
        </div>
        <div className="ns-countdown">
          <div className="ns-countdown-label">
            Next IELTS mock
            <br />
            <span className="ns-countdown-date">{upcoming ? `${sessionWhen(upcoming)}${upcoming.time ? ` · ${upcoming.time}` : ""}` : "Nothing scheduled"}</span>
          </div>
          {cd && (
            <div className="ns-countdown-nums">
              {[
                [cd.days, "days"],
                [String(cd.hours).padStart(2, "0"), "hrs"],
                [String(cd.minutes).padStart(2, "0"), "min"]
              ].map(([v, l]) => (
                <div key={l}>
                  <b>{v}</b>
                  <span>{l}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <RecapPrompt recap={progress.recap} />

      <ClassPrompt progress={progress} />

      <DiagnosticPrompt status={progress.ieltsDiagnostic} exam="ielts" dismissKey="ns_diag_hide_ielts" />

      <section>
        <div className="ns-section-head">
          <h2>
            <Icon name="chart" size={22} /> Overview
          </h2>
          <Link to={IELTS_MOCKS_URL} className="ns-pill-btn">
            Teacher mocks
          </Link>
        </div>
        <div className="ns-stats">
          {[
            ["Tests with results", withResults.length],
            ["Latest overall band", band(latest?.results.overall)],
            ["Best overall band", band(best)],
            ["Open or upcoming", upcomingCount]
          ].map(([label, value]) => (
            <div key={label} className="ns-stat2">
              <span className="ns-stat2-label">{label}</span>
              <div className="ns-stat2-row">
                <span className="ns-stat2-value">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="ns-section-head">
          <h2>
            <Icon name="layers" size={22} /> Section practice
          </h2>
          <Link to="/ielts-prep/practice" className="ns-pill-btn">
            Open practice
          </Link>
        </div>
        <div className="ns-ip-quick">
          {PRACTICE_TILES.map(([kind, name, icon, text]) => (
            <Link key={kind} to="/ielts-prep/practice" className={`ns-ip-quick-tile ${kind}`} onClick={() => openPracticeTab(kind)}>
              <span className={`ns-ip-kind ${kind}`}>
                <Icon name={icon} size={20} />
              </span>
              <span>
                <b>{name}</b>
                <small>{text}</small>
              </span>
              <Icon name="arrowRight" size={16} />
            </Link>
          ))}
        </div>
      </section>

      {tests?.tests.length > 0 && (
        <section>
          <div className="ns-section-head">
            <h2>
              <Icon name="checklist" size={22} /> Practice tests
            </h2>
            <Link to="/ielts-prep/practice-tests?tab=tests" className="ns-pill-btn">
              All practice tests
            </Link>
          </div>
          <div className="ns-ih-tests">
            {tests.tests.slice(0, 3).map((t) => (
              <Link key={t.id} to="/ielts-prep/practice-tests?tab=tests" className="ns-ih-test">
                <span className="ns-ih-test-band">{t.estimate == null ? <Icon name="checklist" size={20} /> : band(t.estimate)}</span>
                <span className="ns-ih-test-main">
                  <b>{t.title}</b>
                  <small>{t.done === t.of ? "Finished: all sections taken" : t.done ? `${t.done} of ${t.of} sections done` : "Listening, Reading and Writing, a section at a time"}</small>
                </span>
                <span className="ns-ih-test-dots" aria-hidden="true">
                  {["listening", "reading", "writing"]
                    .filter((k) => t.sections[k])
                    .map((k) => (
                      <i key={k} className={t.sections[k].attempts ? "on" : ""} />
                    ))}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="ns-two-col">
        <div className="ns-col">
          <section>
            <div className="ns-section-head">
              <h2>
                <Icon name="target" size={22} /> Latest band scores
              </h2>
            </div>
            {latest ? (
              <>
                <div className="ns-bands">
                  {IELTS_SKILLS.map(([key, name, icon]) => (
                    <div key={key} className="ns-band">
                      <div className="ns-band-top">
                        {name} <Icon name={icon} size={18} />
                      </div>
                      <b>{band(latest.results[key])}</b>
                      <div className="ns-band-meter" role="meter" aria-valuemin={0} aria-valuemax={9} aria-valuenow={latest.results[key] ?? 0} aria-label={`${name} band`}>
                        <div style={{ width: `${((latest.results[key] ?? 0) / 9) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="ns-muted2" style={{ fontSize: 14, margin: "10px 2px 0" }}>
                  From {latest.name}. The overall band is the average of the four skills, rounded to the nearest half band.
                </p>
              </>
            ) : (
              <div className="ns-empty2">
                <EmptyArt name="chart" />
                <b>No bands yet</b>
                Your bands appear here after your teacher closes a mock test session.
              </div>
            )}
          </section>

          <section>
            <div className="ns-section-head">
              <h2>
                <Icon name="mock" size={22} /> My tests
              </h2>
              <Link to={IELTS_MOCKS_URL} className="ns-pill-btn">
                View all
              </Link>
            </div>
            {sessions.length === 0 ? (
              <div className="ns-empty2">
                <EmptyArt name="checklist" />
                <b>No IELTS tests yet</b>
                Ask your teacher to add you to a session with your Candidate ID {user?.candidateId}.
              </div>
            ) : (
              <div className="ns-ielts-list">
                {sessions.slice(0, 4).map((s) => (
                  <div key={s.id} className="ns-ielts-row">
                    <span className="ns-ielts-overall">{s.results?.overall != null ? band(s.results.overall) : <Icon name="mock" size={20} />}</span>
                    <div className="ns-ielts-row-main">
                      <b>{s.name}</b>
                      <p>
                        {sessionWhen(s)}
                        {s.time ? ` · ${s.time}` : ""} ·{" "}
                        {s.results ? "Results released" : s.status === "created" ? "Waiting for your teacher" : s.state === "finished" ? "Finished, waiting for bands" : s.state === "in_progress" ? `In progress: ${s.currentSection}` : s.status === "started" ? "Open now" : "Closed"}
                      </p>
                    </div>
                    {s.canEnter && (
                      <button className="ns-btn ns-btn-primary ns-btn-sm" disabled={entering === s.id} onClick={() => enter(s)}>
                        {s.state === "in_progress" ? "Continue" : "Start"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="ns-col">
          <div className="ns-score">
            <div className="ns-score-item">
              <div className="ns-score-num">{latest ? band(latest.results.overall) : "—"}</div>
              <div className="ns-score-label">Current Band</div>
              <div className="ns-score-note">
                {latest ? `From ${latest.name}` : diagNote ? `Diagnostic: ${diagNote}` : "Take the diagnostic or a mock test to get your band"}
              </div>
            </div>
            <EditableScore value={band(progress.ieltsTarget)} label="Target Band" onSave={saveTarget} min={4} max={9} step={0.5} />
            <TargetArt />
          </div>

          <SkyCard progress={progress} onRepair={() => nav(playerUrl({ source: "repair", from: "/ielts-prep" }))} onFirstStar={() => nav("/ielts-prep/practice")} />

          <LeagueCard token={token} />

          {/* Comet chunks: the same wallet as on the SAT side, with what IELTS work pays into it. */}
          {progress.chunks && (
            <section className="ns-card2 ns-ih-wallet">
              <div className="ns-ih-wallet-top">
                <span className="ns-ih-wallet-coin">
                  <Icon name="comet" size={26} />
                </span>
                <div>
                  <b>{progress.chunks.balance}</b>
                  <span>{chunkWord(progress.chunks.balance)} to spend</span>
                </div>
                <Link to="/shop" className="ns-pill-btn">
                  Comet Shop
                </Link>
              </div>
              <ul>
                {tests?.chunks && (
                  <>
                    <li>
                      <b>+{tests.chunks.section}</b> each section of a practice test you finish
                    </li>
                    <li>
                      <b>+{tests.chunks.whole}</b> all three sections of one test
                    </li>
                  </>
                )}
                <li>
                  <b>{progress.chunks.novaCost}</b> a message on the Ask Nova page. Reviews, keys and model answers are free.
                </li>
              </ul>
            </section>
          )}

          <section className="ns-card2" style={{ padding: 22 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
              <Nova size={52} float />
              <div>
                <b style={{ fontSize: 17 }}>Stuck on a part of the test?</b>
                <p className="ns-muted2" style={{ margin: "2px 0 0", fontSize: 14.5 }}>
                  Nova has strategies for every IELTS section.
                </p>
              </div>
            </div>
            <div className="nv-starters" style={{ alignItems: "stretch" }}>
              {NOVA_STARTERS.map((s) => (
                <button key={s} className="nv-starter" style={{ justifyContent: "space-between" }} onClick={() => nav("/nova", { state: { ask: s } })}>
                  {s} <Icon name="chevronRight" size={14} />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
