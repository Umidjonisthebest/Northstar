import React from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import { STAR_LABEL, TILE, constellationsOf, dayLabel, describeConstellation, layout, skyDays } from "./skyModel.js";
import "../sky.css";

/*
 * The Northstar sky replaces the old flame streak. Every day studied is a lit
 * star, every seven lit stars are joined into a constellation, and days off
 * stay as dim stars: nothing is ever removed. Each kind of star has its own
 * shape as well as its own colour, and every tile and the sky as a whole have
 * a text alternative (see also SkyList).
 */

// A four-point star centred on (x, y).
const sparkle = (x, y, r) => `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

// A steady number from a date.
const seedOf = (date) => [...String(date)].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 997, 7);

function Star({ kind, x, y, date }) {
  if (kind === "missed")
    return (
      <circle className="ns-sky-dim" cx={x} cy={y} r="2.4">
        <title>{`${dayLabel(date, true)}: ${STAR_LABEL.missed}`}</title>
      </circle>
    );
  if (kind === "today")
    return (
      <circle className="ns-sky-today" cx={x} cy={y} r="7">
        <title>{`${dayLabel(date, true)}: ${STAR_LABEL.today}`}</title>
      </circle>
    );
  // Each lit star has a soft halo and leans and twinkles in its own way (steady for a given day).
  const n = seedOf(date);
  return (
    <g className={`ns-sky-star ${kind}`}>
      <title>{`${dayLabel(date, true)}: ${STAR_LABEL[kind]}`}</title>
      <circle className="ns-sky-halo" cx={x} cy={y} r="15" />
      <circle className="ns-sky-halo near" cx={x} cy={y} r="8.500" />
      {kind === "repaired" && <circle className="ns-sky-ring" cx={x} cy={y} r="11" />}
      <g transform={`rotate(${(n % 37) - 18} ${x} ${y})`}>
        <path className="ns-sky-twinkle" style={{ animationDelay: `${-(n % 46) / 10}s` }} d={sparkle(x, y, 9)} />
      </g>
      <circle className="ns-sky-glint" cx={x} cy={y} r="1.300" />
    </g>
  );
}

export function ConstellationTile({ c }) {
  const l = layout(c);
  const lit = c.stars.length;
  return (
    <figure className={`ns-sky-tile ${c.complete ? "complete" : "forming"}`}>
      <svg viewBox={`0 0 ${TILE.w} ${TILE.h}`} role="img" aria-label={describeConstellation(c)}>
        {l.lines.map((ln, i) => (
          <line key={i} className="ns-sky-line" {...ln} />
        ))}
        {l.dim.map((d) => (
          <Star key={d.date} {...d} />
        ))}
        {l.slots.map((s, i) => (
          <circle key={i} className="ns-sky-slot" cx={s.x} cy={s.y} r="1.6" />
        ))}
        {l.pending && <Star {...l.pending} />}
        {l.stars.map((s) => (
          <Star key={s.date} {...s} />
        ))}
      </svg>
      <figcaption>
        <b>Constellation {c.index + 1}</b>
        <span>
          {c.complete ? `${dayLabel(c.stars[0].date)} – ${dayLabel(c.stars[lit - 1].date)} · complete` : `${lit} of ${c.per} stars${lit ? ` · since ${dayLabel(c.stars[0].date)}` : ""}`}
        </span>
      </figcaption>
    </figure>
  );
}

// The key: each kind of star by shape, with its name.
export function SkyLegend() {
  const item = (kind, text) => (
    <li>
      <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
        <Star kind={kind} x={14} y={14} date="2000-01-01" />
      </svg>
      {text}
    </li>
  );
  return (
    <ul className="ns-sky-legend" aria-label="What the stars mean">
      {item("lit", "A day you studied")}
      {item("repaired", "A repaired day (ringed)")}
      {item("missed", "A day off (dim)")}
      {item("today", "Today, not lit yet (dashed)")}
    </ul>
  );
}

// The sky itself: the constellation that is forming, then the complete ones, newest first.
export default function SkyField({ sky, limit = Infinity }) {
  if (!sky?.start) return null;
  const all = constellationsOf(sky).reverse();
  return (
    <div className="ns-sky-field">
      {all.slice(0, limit).map((c) => (
        <ConstellationTile key={c.index} c={c} />
      ))}
    </div>
  );
}

// The same sky as text: a table of constellations and the most recent days.
export function SkyList({ sky, days = 28 }) {
  const all = constellationsOf(sky).reverse();
  const recent = skyDays(sky).slice(-days).reverse();
  return (
    <div className="ns-sky-list">
      <div className="ns-table-wrap">
        <table>
          <caption>Constellations</caption>
          <thead>
            <tr>
              <th scope="col">Constellation</th>
              <th scope="col">Dates</th>
              <th scope="col">Stars lit</th>
              <th scope="col">Repaired</th>
              <th scope="col">Days off</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {all.map((c) => (
              <tr key={c.index}>
                <th scope="row">Constellation {c.index + 1}</th>
                <td>{c.stars.length ? `${dayLabel(c.stars[0].date)} – ${dayLabel(c.stars[c.stars.length - 1].date)}` : "—"}</td>
                <td>
                  {c.stars.length} of {c.per}
                </td>
                <td>{c.stars.filter((s) => s.kind === "repaired").length}</td>
                <td>{c.dim.length}</td>
                <td>{c.complete ? "Complete" : "Forming"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ns-table-wrap">
        <table>
          <caption>The last {recent.length} days</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Star</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((d) => (
              <tr key={d.date}>
                <th scope="row">{dayLabel(d.date, true)}</th>
                <td>{STAR_LABEL[d.kind]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// A missed day that can still be relit. `repair` is progress.repair: the
// server decides whether it exists, until when, and how far the drill is.
export function RepairPrompt({ repair, today, onStart, compact = false }) {
  if (!repair) return null;
  const closes = repair.lastDay === today ? "midnight tonight" : `the end of ${new Date(`${repair.lastDay}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}`;
  return (
    <div className={`ns-sky-repair ${compact ? "compact" : ""}`}>
      <span className="ns-sky-repair-icon">
        <svg viewBox="0 0 28 28" width="34" height="34" aria-hidden="true">
          <Star kind="repaired" x={14} y={14} date={repair.day} />
        </svg>
      </span>
      <div>
        <b>{dayLabel(repair.day, true)} can still get its star</b>
        <p>
          Finish a {repair.total}-question repair drill, with any score, and that day lights up
          {repair.streak > 1 ? `, so your ${repair.streak}-day streak carries on.` : ", so your streak carries on."} Open until {closes}.
          {repair.started ? ` ${repair.answered} of ${repair.total} answered so far.` : ""}
        </p>
      </div>
      <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={onStart}>
        {repair.started ? "Continue the drill" : "Start repair drill"}
      </button>
    </div>
  );
}

// The compact sky on the two home pages.
export function SkyCard({ progress, onRepair, onFirstStar }) {
  const { sky, streak, repair } = progress;
  const forming = sky.start ? constellationsOf(sky).at(-1) : null;
  return (
    <section>
      <div className="ns-section-head">
        <h2>
          <Icon name="northStar" size={22} /> Your sky
        </h2>
        <Link to="/sky" className="ns-pill-btn">
          Open your sky
        </Link>
      </div>
      <div className="ns-sky-panel ns-sky-card">
        {forming ? (
          <>
            <div className="ns-sky-nums">
              <div>
                <b>{streak.current}</b>
                <span>day streak</span>
              </div>
              <div>
                <b>{streak.longest}</b>
                <span>best streak</span>
              </div>
              <div>
                <b>{sky.lit}</b>
                <span>stars lit</span>
              </div>
            </div>
            <ConstellationTile c={forming} />
          </>
        ) : (
          <div className="ns-sky-empty">
            <Icon name="northStar" size={34} />
            <b>Your sky is waiting for its first star</b>
            <p>Answer one question and today lights up. Seven stars make a constellation.</p>
            <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={onFirstStar}>
              Light the first star
            </button>
          </div>
        )}
      </div>
      <RepairPrompt repair={repair} today={progress.today.date} onStart={onRepair} compact />
    </section>
  );
}
