import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecaps, markRecapSeen, recapImage } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import { Loading } from "./Home.jsx";
import { SECTION_KEY, fmtDay, pct, playerUrl } from "./hubUtils.js";
import "../../sky.css";
import "../../recap.css";
import { EmptyArt } from "../../components/Art.jsx";

const SIZE = 1080;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const monthName = (month) => new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
const before = (month) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 15)).toISOString().slice(0, 7);
};

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Draws the SVG on a canvas in the browser and returns it as a PNG. Nothing leaves the page.
async function svgToPng(svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.getContext("2d").drawImage(img, 0, 0, SIZE, SIZE);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The image couldn't be made");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The share image for one month: a preview, and buttons to save it.
function ShareImage({ token, recap }) {
  const { toast } = useToast();
  const [state, setState] = useState({ month: null, svg: "", error: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    recapImage(token, recap.month)
      .then((svg) => alive && setState({ month: recap.month, svg, error: "" }))
      .catch((e) => alive && setState({ month: recap.month, svg: "", error: e.message }));
    return () => {
      alive = false;
    };
  }, [token, recap.month]);

  const ready = state.month === recap.month && state.svg;
  const failed = state.month === recap.month && state.error;
  const name = `northstar-recap-${recap.month}`;
  const png = async () => {
    setBusy(true);
    try {
      saveBlob(await svgToPng(state.svg), `${name}.png`);
    } catch {
      // Some browsers can't turn an SVG into a PNG: the SVG itself is still a picture.
      saveBlob(new Blob([state.svg], { type: "image/svg+xml" }), `${name}.svg`);
      toast.success("Saved as an SVG image instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ns-recap-share" aria-labelledby="ns-recap-share-title">
      <div>
        <h2 id="ns-recap-share-title">Share image</h2>
        <p>A picture of your month to keep or send. It's made on this page from your numbers, with your first name on it.</p>
        <div className="ns-recap-share-actions">
          <button className="ns-btn ns-btn-primary ns-btn-sm" disabled={!ready || busy} onClick={png}>
            <Icon name="download" size={15} /> {busy ? "Making the image…" : "Download image"}
          </button>
          <button className="ns-btn ns-btn-outline ns-btn-sm" disabled={!ready} onClick={() => saveBlob(new Blob([state.svg], { type: "image/svg+xml" }), `${name}.svg`)}>
            Download as SVG
          </button>
        </div>
      </div>
      <div className="ns-recap-preview">
        {failed ? (
          <p>{state.error}</p>
        ) : ready ? (
          <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(state.svg)}`} alt={`Share image for ${recap.label}: ${plural(recap.solved, "question")} solved, ${recap.accuracy == null ? "no" : pct(recap.accuracy)} accuracy, best streak ${plural(recap.bestStreak, "day")}, ${plural(recap.stars, "star")} discovered.`} />
        ) : (
          <div className="ns-spinner" />
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, note, children }) {
  return (
    <div className="ns-recap-stat">
      <span>{label}</span>
      <b>{value}</b>
      {note && <small>{note}</small>}
      {children}
    </div>
  );
}

// Monthly recap: one for every month the student studied, available from the
// 1st of the following month and kept after that.
export default function Recap() {
  const { token } = useStudentAuth();
  const { refresh } = useProgress();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(null);

  const load = useCallback(() => {
    getRecaps(token)
      .then((d) => {
        setError("");
        setData(d);
        // Opening the page is what "seen" means for the newest recap.
        if (d.recaps[0] && d.seen !== d.recaps[0].month) markRecapSeen(token).then(refresh).catch(() => {});
      })
      .catch((e) => setError(e.message));
  }, [token, refresh]);
  useEffect(() => {
    load();
  }, [load]);

  const recap = data?.recaps.find((r) => r.month === picked) || data?.recaps[0] || null;
  const change = !recap
    ? ""
    : recap.accuracy == null
      ? "No answers this month"
      : recap.accuracyChange == null
        ? "The first month with answers on record"
        : recap.accuracyChange === 0
          ? `The same as ${monthName(before(recap.month))}`
          : `${plural(Math.abs(recap.accuracyChange), "point")} ${recap.accuracyChange > 0 ? "above" : "below"} ${monthName(before(recap.month))}`;

  return (
    <div className="ns-page" style={{ gap: 26, paddingTop: 12 }}>
      <div>
        <h1 className="ns-h1">
          <Icon name="calendarStar" size={32} /> Monthly Recap
        </h1>
        <p className="ns-lead">A look back at each month you studied. A month's recap arrives on the 1st of the next one and stays here.</p>
      </div>

      {error ? (
        <div className="ns-empty2">
          <b>Couldn't load your recaps</b>
          {error}
          <div style={{ marginTop: 12 }}>
            <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={load}>
              Try again
            </button>
          </div>
        </div>
      ) : !data ? (
        <Loading />
      ) : !recap ? (
        <div className="ns-empty2" style={{ padding: 36 }}>
          <EmptyArt name="calendar" />
          <b>Your first recap arrives on {fmtDay(data.next.availableOn, { month: "long", day: "numeric" })}</b>
          It will cover {data.next.label}: the questions you solved, your accuracy, your best streak, the stars you discovered, your most improved skill and the hardest question you solved.
        </div>
      ) : (
        <>
          {data.recaps.length > 1 && (
            <div className="ns-recap-months" role="tablist" aria-label="Your recaps">
              {data.recaps.map((r) => (
                <button key={r.month} role="tab" aria-selected={r.month === recap.month} className={r.month === recap.month ? "on" : ""} onClick={() => setPicked(r.month)}>
                  {r.label}
                </button>
              ))}
            </div>
          )}

          <section className="ns-sky-panel ns-recap-card" aria-label={`Recap for ${recap.label}`}>
            <p className="ns-recap-kicker">Your month</p>
            <h2>{recap.label}</h2>
            <div className="ns-recap-grid">
              <Stat label="Questions solved" value={recap.solved} note={`${plural(recap.answers, "answer")} given, ${recap.correct} correct`} />
              <Stat label="Accuracy" value={recap.accuracy == null ? "—" : pct(recap.accuracy)} note={change} />
              <Stat label="Best streak" value={plural(recap.bestStreak, "day")} note={`${plural(recap.activeDays, "day")} studied`} />
              <Stat label="Stars discovered" value={recap.stars} note="daily Northstar questions solved" />
              <Stat label="Most improved skill" value={recap.improved ? recap.improved.skill : "—"} note={recap.improved ? `From ${pct(recap.improved.from)} to ${pct(recap.improved.to)}` : "Shows once a skill has answers in two months in a row"}>
                {recap.improved && <Link to={playerUrl({ source: "drill", sec: SECTION_KEY[recap.improved.section], skills: [recap.improved.skill], size: 10, from: "/recap" })}>Keep it going</Link>}
              </Stat>
              <Stat label="Hardest question solved" value={recap.hardest ? recap.hardest.difficulty : "—"} note={recap.hardest ? `${recap.hardest.skill}${recap.hardest.title ? `: ${recap.hardest.title}` : ""}` : "None solved this month"}>
                {recap.hardest && <Link to={playerUrl({ source: "bank", sec: SECTION_KEY[recap.hardest.section], skills: [recap.hardest.skill], start: recap.hardest.id, from: "/recap" })}>Open it again</Link>}
              </Stat>
            </div>
          </section>

          <ShareImage token={token} recap={recap} />

          <p className="ns-muted2" style={{ fontSize: 14, margin: 0 }}>
            Next: your recap for {data.next.label} arrives on {fmtDay(data.next.availableOn, { month: "long", day: "numeric" })}.
          </p>
        </>
      )}
    </div>
  );
}
