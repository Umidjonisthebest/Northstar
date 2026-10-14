import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { answerDaily, dailyCatalog, getDaily } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import MathText from "../../components/MathText.jsx";
import Figure from "../../components/Figure.jsx";
import { DataTable } from "../practice/PlayerParts.jsx";
import HighlightText from "../practice/HighlightText.jsx";
import BankPicture, { isPictureQuestion } from "../practice/BankPicture.jsx";
import GraphingCalculator from "../../components/calculator/GraphingCalculator.jsx";
import { Loading } from "./Home.jsx";
import { fmtDay } from "./hubUtils.js";
import "../../player.css";
import "../../sky.css";
import "../../daily.css";
import { EmptyArt } from "../../components/Art.jsx";

const LETTERS = "ABCDEF";

// A four-point star, as in the sky.
const SPARKLE = "M24 4Q24 24 44 24Q24 24 24 44Q24 24 4 24Q24 24 24 4Z";

// Copies text with the Clipboard API, or with a selection where that isn't
// available (it needs https or localhost, and a class server may be neither).
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

// Today's star: found, it shines with a halo, rays and two companions; hidden, it is a dashed
// outline with a faint moon going round it.
function StarMark({ found }) {
  return (
    <svg className={`ns-daily-star ${found ? "found" : ""}`} viewBox="0 0 96 96" width="96" height="96" aria-hidden="true">
      {found ? (
        <>
          <circle className="ns-daily-halo" cx="48" cy="48" r="44" />
          <circle className="ns-daily-halo near" cx="48" cy="48" r="28" />
          <g className="ns-daily-rays">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <path key={a} d="M48 10v8" transform={`rotate(${a} 48 48)`} />
            ))}
          </g>
          <g className="ns-daily-core">
            <path d={SPARKLE} transform="translate(24 24) rotate(-10 24 24)" />
          </g>
          <path className="ns-daily-mate a" d={SPARKLE} transform="translate(68 12) scale(0.3)" />
          <path className="ns-daily-mate b" d={SPARKLE} transform="translate(8 62) scale(0.22)" />
        </>
      ) : (
        <>
          <circle className="ns-daily-hidden" cx="48" cy="48" r="22" />
          <g className="ns-daily-orbit">
            <circle cx="48" cy="12" r="3" />
          </g>
        </>
      )}
    </svg>
  );
}

// What the attempt led to: the star's name, how everyone did, and a result to share.
function Result({ data, xp }) {
  const { toast } = useToast();
  const r = data.result;
  const others = r.answered === 1 ? "You're the first to answer today." : `${r.percentCorrect}% of students got it right (${r.answered} answered so far).`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    if (await copyText(r.share)) toast.success("Result copied. It doesn't give the question away.");
    else toast.error("Couldn't copy it for you. You can select the text and copy it yourself.");
  };
  const share = async () => {
    try {
      await navigator.share({ text: r.share });
    } catch {
      /* the share sheet was closed */
    }
  };

  return (
    <section className="ns-sky-panel ns-daily-result" aria-live="polite">
      <StarMark found={r.correct} />
      <div className="ns-daily-result-main">
        <p className="ns-daily-kicker">{r.correct ? "Star discovered" : "Today's star"}</p>
        <h2>{r.correct ? `You discovered ${data.designation}` : `${data.designation} stays hidden for now`}</h2>
        <p>
          {r.correct
            ? `It's in your catalog now${xp ? `, with +${xp} XP` : ""}. ${others}`
            : `Not this time, and that's fine: the question is saved in your mistakes queue, and a new star rises tomorrow. ${others}`}
        </p>
        <div className="ns-daily-share">
          <pre aria-label="Your result, ready to share">{r.share}</pre>
          <div>
            <button className="ns-btn ns-btn-soft ns-btn-sm" onClick={copy}>
              <Icon name="note" size={15} /> Copy result
            </button>
            {canShare && (
              <button className="ns-btn ns-btn-soft ns-btn-sm" onClick={share}>
                <Icon name="arrowRight" size={15} /> Share
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Catalog({ catalog }) {
  if (!catalog) return <Loading />;
  if (catalog.error)
    return (
      <div className="ns-empty2">
        <b>Couldn't load your catalog</b>
        {catalog.error}
      </div>
    );
  if (!catalog.stars.length)
    return (
      <div className="ns-empty2">
        <EmptyArt name="bookmark" />
        <b>No stars discovered yet</b>
        Solve a daily question and its star appears here, with its name and the day you found it.
      </div>
    );
  return (
    <ul className="ns-daily-catalog">
      {catalog.stars.map((s) => (
        <li key={s.date}>
          <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true">
            <path d={SPARKLE} />
          </svg>
          <div>
            <b>{s.designation}</b>
            <span>
              {fmtDay(s.date)} · {s.topic}
            </span>
            <small>{s.answered > 1 ? `${s.percentCorrect}% of students solved it` : "You were the only one to try it"}</small>
          </div>
        </li>
      ))}
    </ul>
  );
}

// The daily Northstar question: the same question for everyone, one attempt,
// and a star to discover. The server keeps the answer, the star's name and
// the class results until the attempt is in.
export default function Daily() {
  const { token } = useStudentAuth();
  const { celebrate } = useProgress();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState(null);
  const [selected, setSelected] = useState(null);
  const [grid, setGrid] = useState("");
  const [busy, setBusy] = useState(false);
  const [xp, setXp] = useState(0);
  // The Desmos calculator, when today's question is a Math one.
  const [calcOpen, setCalcOpen] = useState(false);
  const openedAt = useRef(0);

  const loadCatalog = useCallback(() => {
    dailyCatalog(token)
      .then(setCatalog)
      .catch((e) => setCatalog({ error: e.message }));
  }, [token]);

  const load = useCallback(() => {
    getDaily(token)
      .then((d) => {
        openedAt.current = Date.now();
        setError("");
        setData(d);
      })
      .catch((e) => setError(e.message));
    loadCatalog();
  }, [token, loadCatalog]);

  useEffect(() => {
    load();
  }, [load]);

  const q = data?.question;
  const result = data?.result;
  const isGrid = q?.type === "grid_in";
  const picture = isPictureQuestion(q);
  const ready = isGrid ? grid.trim() !== "" : selected !== null;

  const submit = async () => {
    if (!ready || busy || result) return;
    setBusy(true);
    try {
      const r = await answerDaily(token, isGrid ? grid.trim() : selected, Date.now() - openedAt.current);
      setXp(r.reward?.xpGained || 0);
      celebrate(r.reward);
      setData(r);
      loadCatalog();
    } catch (e) {
      toast.error(e.message);
      // Someone else's tab may have used the attempt: show where things stand.
      if (e.code === "ALREADY_ANSWERED") load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ns-page" style={{ gap: 26, paddingTop: 12 }}>
      <GraphingCalculator place="right" open={calcOpen && q?.section === "Math" && !result} warm={q?.section === "Math" && !result} onClose={() => setCalcOpen(false)} />
      <div>
        <h1 className="ns-h1">
          <Icon name="northStar" size={32} /> Daily Star
        </h1>
        <p className="ns-lead">One question a day, the same for every student. You get one try. Solve it to discover today's star and add it to your catalog.</p>
      </div>

      {error ? (
        <div className="ns-empty2">
          <b>Couldn't load today's question</b>
          {error}
          <div style={{ marginTop: 12 }}>
            <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={load}>
              Try again
            </button>
          </div>
        </div>
      ) : !data ? (
        <Loading />
      ) : !data.available ? (
        <div className="ns-empty2">
          <b>No star today</b>
          {data.reason}
        </div>
      ) : (
        <>
          {result && <Result data={data} xp={xp} />}

          {q && (
            <section className="ns-card2 ns-daily-q" aria-label="Today's question">
              <p className="ns-daily-meta">
                <span>{fmtDay(data.date)}</span>
                <span className={`pl-diff ${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
                <span>
                  {q.section} · {q.topic}
                </span>
                {q.section === "Math" && !result && (
                  <button className="ns-pill-btn sm ns-daily-calc" aria-pressed={calcOpen} onClick={() => setCalcOpen((o) => !o)}>
                    <Icon name="calc" size={16} /> Calculator
                  </button>
                )}
              </p>
              <BankPicture image={q.image} alt="Graph or table for this question" zoom={1.25} />
              {q.passage && (q.underline ? <HighlightText className="ns-daily-passage" text={q.passage} underline={q.underline} /> : <MathText as="div" className="ns-daily-passage" text={q.passage} />)}
              {q.figure && <Figure figure={q.figure} />}
              {q.table && <DataTable table={q.table} />}
              {picture && <BankPicture image={q.promptImage} alt={isGrid ? "The question, shown as a picture" : "The question and its answer choices A to D, shown as a picture"} />}
              <MathText as="div" className={`ns-daily-prompt-text ${picture ? "pl-prompt-note" : ""}`} text={q.prompt} />

              {isGrid ? (
                <div className="ns-daily-grid">
                  <label htmlFor="ns-daily-grid-input">Your answer</label>
                  <input
                    id="ns-daily-grid-input"
                    value={result ? String(result.given ?? "") : grid}
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="e.g. 3/4 or 0.75"
                    disabled={Boolean(result) || busy}
                    onChange={(e) => setGrid(e.target.value.slice(0, 12))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                  />
                  {result && (
                    <p className={`ns-daily-verdict ${result.correct ? "right" : "wrong"}`}>
                      <Icon name={result.correct ? "check" : "cross"} size={16} strokeWidth={3} />
                      {result.correct ? "Correct" : <MathText text={`Not this time. The answer is ${String(result.correctAnswer ?? "").replace(/^-/, "−")}.`} />}
                    </p>
                  )}
                </div>
              ) : (
                <div className="ns-daily-options" role="radiogroup" aria-label="Answer choices">
                  {q.options.map((opt, i) => {
                    const right = result && i === result.correctIndex;
                    const mine = result ? i === result.given : i === selected;
                    const wrong = result && mine && !right;
                    return (
                      <button
                        key={i}
                        role="radio"
                        aria-checked={mine}
                        disabled={Boolean(result) || busy}
                        className={`ns-daily-opt ${!result && mine ? "sel" : ""} ${right ? "right" : ""} ${wrong ? "wrong" : ""}`}
                        onClick={() => setSelected(i)}
                      >
                        <span className="ns-daily-letter">{right ? <Icon name="check" size={15} strokeWidth={3} /> : wrong ? <Icon name="cross" size={15} strokeWidth={3} /> : LETTERS[i]}</span>
                        {picture ? <span className="ns-daily-opt-text">Choice {LETTERS[i]}</span> : <MathText className="ns-daily-opt-text" text={opt} />}
                        {right && <small>Correct answer</small>}
                        {wrong && <small>Your answer</small>}
                      </button>
                    );
                  })}
                </div>
              )}

              {!result && (
                <div className="ns-daily-foot">
                  <span>
                    <Icon name="info" size={16} /> One try today. Check when you're sure.
                  </span>
                  <button className="ns-btn ns-btn-primary" onClick={submit} disabled={!ready || busy}>
                    {busy ? "Checking…" : "Check my answer"}
                  </button>
                </div>
              )}

              {result && (result.explanation || result.rationales || result.explanationImage) && (
                <div className="ns-daily-explain">
                  <b>Why</b>
                  {result.explanation && <MathText as="p" text={result.explanation} />}
                  <BankPicture image={result.explanationImage} alt="The worked explanation, shown as a picture" className="pl-pic-explain" />
                  {!result.correct && !isGrid && result.rationales?.[result.given] && (
                    <p>
                      <i>About your choice, {LETTERS[result.given]}:</i> <MathText text={result.rationales[result.given]} />
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      )}

      <section>
        <div className="ns-section-head">
          <h2>
            <Icon name="star" size={22} /> Discovered stars
          </h2>
          {catalog && !catalog.error && (
            <span className="ns-muted2" style={{ fontSize: 14.5 }}>
              {catalog.discovered} discovered · {catalog.attempted} day{catalog.attempted === 1 ? "" : "s"} tried
            </span>
          )}
        </div>
        <Catalog catalog={catalog} />
        <p className="ns-muted2" style={{ fontSize: 14, margin: "14px 2px 0" }}>
          Your daily streak has its own sky. <Link to="/sky">Open your sky</Link>
        </p>
      </section>
    </div>
  );
}
