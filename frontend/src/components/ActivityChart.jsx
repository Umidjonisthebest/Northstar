import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

// Weekly practice activity: one column per calendar week, correct answers
// (green) stacked under wrong ones (red); within each color harder questions
// are darker and sit lower. Colors are validated ordinal ramps (see the
// --viz-* tokens in shell.css). Hover or focus a week for the breakdown;
// "View as table" has every value.
//
// The ramps have three steps, so the server counts Challenging answers with
// the Hard ones (weeklyTrend in practiceRoutes.js) and the legend says so.

const SEGMENTS = [
  ["correct", "Hard"],
  ["correct", "Medium"],
  ["correct", "Easy"],
  ["wrong", "Hard"],
  ["wrong", "Medium"],
  ["wrong", "Easy"]
];
const FILL = {
  correct: { Easy: "var(--viz-c-easy)", Medium: "var(--viz-c-med)", Hard: "var(--viz-c-hard)" },
  wrong: { Easy: "var(--viz-w-easy)", Medium: "var(--viz-w-med)", Hard: "var(--viz-w-hard)" }
};
const LEVELS = ["Easy", "Medium", "Hard"];
const LEGEND = { Easy: "Easy", Medium: "Medium", Hard: "Hard and up" };

const sum = (o) => o.Easy + o.Medium + o.Hard;

// Axis for answer counts: whole-number steps of 1, 2 or 5 × 10^k.
function niceTicks(max) {
  if (max <= 4) return { top: 4, step: 1 };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag);
  return { top: Math.ceil(max / step) * step, step };
}

// Width of the (overflow-clipped) canvas box. Starts at 0 so the chart never
// renders wider than its container, not even for the first frame.
function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setW(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function topRounded(x, top, w, bottom, r) {
  const rr = Math.min(r, w / 2, bottom - top);
  return `M${x} ${bottom}V${top + rr}Q${x} ${top} ${x + rr} ${top}H${x + w - rr}Q${x + w} ${top} ${x + w} ${top + rr}V${bottom}Z`;
}

export default function ActivityChart({ trend = [] }) {
  const wrap = useRef(null);
  const measured = useWidth(wrap);
  const width = Math.max(240, measured);
  const [hover, setHover] = useState(null);

  const totals = trend.reduce((acc, w) => ({ correct: acc.correct + sum(w.correct), wrong: acc.wrong + sum(w.wrong) }), { correct: 0, wrong: 0 });
  const H = 230;
  const pad = { l: 40, r: 8, t: 12, b: 28 };
  const plotW = width - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const maxTotal = Math.max(0, ...trend.map((w) => sum(w.correct) + sum(w.wrong)));
  const { top, step } = niceTicks(maxTotal);
  const y = (v) => pad.t + plotH - (v / top) * plotH;
  const band = trend.length ? plotW / trend.length : plotW;
  const barW = Math.min(24, band * 0.56);
  const labelEvery = band >= 46 ? 1 : band >= 24 ? 2 : 3;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  const empty = maxTotal === 0;
  const hw = hover != null ? trend[hover] : null;
  const hoverX = hover != null ? pad.l + hover * band + band / 2 : 0;
  const hoverTotal = hw ? sum(hw.correct) + sum(hw.wrong) : 0;

  return (
    <div className="viz">
      <div className="viz-legend">
        <span className="viz-total">
          <span className="viz-badge good">
            <Icon name="check" size={13} strokeWidth={3} />
          </span>
          <b>{totals.correct.toLocaleString("en-US")}</b> Correct
        </span>
        <span className="viz-total">
          <span className="viz-badge bad">
            <Icon name="cross" size={13} strokeWidth={3} />
          </span>
          <b>{totals.wrong.toLocaleString("en-US")}</b> Wrong
        </span>
        <span className="viz-shades" aria-label="Shade shows difficulty: lighter is easier, darker is harder">
          {LEVELS.map((l) => (
            <span key={l} className="viz-shade">
              <i style={{ background: FILL.correct[l] }} />
              <i style={{ background: FILL.wrong[l] }} />
              {LEGEND[l]}
            </span>
          ))}
        </span>
      </div>

      <div className="viz-plot">
        <div className="viz-canvas" ref={wrap} style={{ height: H }}>
          {measured > 0 && (
            <svg width={width} height={H} role="img" aria-label={`Weekly activity for the last ${trend.length} weeks: ${totals.correct} correct and ${totals.wrong} wrong answers`}>
              {ticks.map((v) => (
                <g key={v}>
                  <path d={`M${pad.l} ${y(v)}H${width - pad.r}`} className={v === 0 ? "viz-base" : "viz-grid"} />
                  <text x={pad.l - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" className="viz-tick">
                    {Number.isInteger(v) ? v.toLocaleString("en-US") : v}
                  </text>
                </g>
              ))}
              {trend.map((w, i) => {
                const x = pad.l + i * band + (band - barW) / 2;
                let cursor = y(0);
                const drawn = SEGMENTS.map(([kind, level]) => ({ kind, level, count: w[kind][level] })).filter((s) => s.count > 0);
                const dim = hover != null && hover !== i;
                return (
                  <g key={w.week} className={`viz-bar ${dim ? "dim" : ""}`}>
                    {drawn.map((s, k) => {
                      const h = (s.count / top) * plotH;
                      const segTop = cursor - h;
                      const segBottom = cursor - (k > 0 ? 2 : 0);
                      cursor = segTop;
                      if (segBottom - segTop < 0.8) return null;
                      const isTop = k === drawn.length - 1;
                      return isTop ? (
                        <path key={k} d={topRounded(x, segTop, barW, segBottom, 4)} fill={FILL[s.kind][s.level]} />
                      ) : (
                        <rect key={k} x={x} y={segTop} width={barW} height={segBottom - segTop} fill={FILL[s.kind][s.level]} />
                      );
                    })}
                    {i % labelEvery === (trend.length - 1) % labelEvery && (
                      <text x={x + barW / 2} y={H - 9} textAnchor="middle" className="viz-tick">
                        {w.label}
                      </text>
                    )}
                    <rect
                      x={pad.l + i * band}
                      y={pad.t}
                      width={band}
                      height={plotH}
                      className="viz-hit"
                      tabIndex={0}
                      aria-label={`Week of ${w.label}: ${sum(w.correct)} correct, ${sum(w.wrong)} wrong`}
                      onPointerEnter={() => setHover(i)}
                      onPointerLeave={() => setHover(null)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                    />
                  </g>
                );
              })}
            </svg>
          )}
        </div>
        {empty && <p className="viz-empty">Answer a few questions and your weekly activity will show up here.</p>}
        {hw && (
          <div className="viz-tip" style={{ left: Math.min(Math.max(hoverX, 110), width - 110), top: Math.max(4, y(hoverTotal) - 12) }} role="status">
            <p className="viz-tip-title">Week of {hw.label}</p>
            {[
              ["correct", "Correct"],
              ["wrong", "Wrong"]
            ].map(([kind, name]) => (
              <div key={kind} className="viz-tip-row">
                <span className="viz-key" style={{ background: FILL[kind].Medium }} />
                <b>{sum(hw[kind])}</b>
                <span>{name}</span>
                <small>
                  {LEVELS.map((l) => `${hw[kind][l]} ${l.toLowerCase()}`).join(" · ")}
                </small>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="viz-table">
        <summary>View as table</summary>
        <table>
          <thead>
            <tr>
              <th>Week of</th>
              <th>Correct (easy / medium / hard)</th>
              <th>Wrong (easy / medium / hard)</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((w) => (
              <tr key={w.week}>
                <td>{w.label}</td>
                <td>
                  {sum(w.correct)} ({w.correct.Easy} / {w.correct.Medium} / {w.correct.Hard})
                </td>
                <td>
                  {sum(w.wrong)} ({w.wrong.Easy} / {w.wrong.Medium} / {w.wrong.Hard})
                </td>
                <td>{sum(w.correct) + sum(w.wrong)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
