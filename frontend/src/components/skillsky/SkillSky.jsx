import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSkillSky } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import Icon from "../Icon.jsx";
import Nova from "../Nova.jsx";
import { novaMood } from "../nova/moods.js";
import { playerUrl, pct, SECTION_KEY } from "../../pages/hub/hubUtils.js";
import { CONSTELLATIONS, PANEL, SHORT, STATE_INFO, STATE_ORDER } from "./layout.js";
import "./skillsky.css";

/*
 * The skill constellation map (the "Skills" tab of /sky). Every skill is a star and every domain a
 * constellation in its own rounded panel of night sky, grouped under "Reading & Writing" and "Math".
 * Everything is drawn here in SVG and CSS (no picture file). A star's look says how far along the
 * student is; nothing is locked and nothing goes dark. The coral ring, Nova and the "Next step" tag
 * sit on the skill worth the most points.
 *
 * - Every star is a button: Tab or the arrow keys move between them, Enter opens it, Escape closes.
 * - The chosen skill's card stays at the bottom of the window, so it is in view wherever the star is.
 * - "View as list" shows the same thing as a table.
 * - Reduced motion: no twinkle, sway or pulse (skillsky.css).
 */

const SPARKLE = (r) => `M0 ${-r}Q${r * 0.2} ${-r * 0.2} ${r} 0Q${r * 0.2} ${r * 0.2} 0 ${r}Q${-r * 0.2} ${r * 0.2} ${-r} 0Q${-r * 0.2} ${-r * 0.2} 0 ${-r}Z`;
const CHUBBY = (r) =>
  Array.from({ length: 10 }, (_, i) => {
    const rad = i % 2 ? r * 0.54 : r;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(rad * Math.cos(a)).toFixed(2)},${(rad * Math.sin(a)).toFixed(2)}`;
  }).join(" ");

function StarShape({ state }) {
  const r = STATE_INFO[state].r;
  if (state === "strong" || state === "mastered") {
    return (
      <>
        {state === "mastered" && <circle className="sks-ring" r={r + 15} />}
        <polygon className="sks-shape" points={CHUBBY(r * 0.86)} strokeWidth={r * 0.42} strokeLinejoin="round" />
        <ellipse className="sks-shine" cx={-r * 0.3} cy={-r * 0.28} rx={r * 0.22} ry={r * 0.12} transform={`rotate(-30 ${-r * 0.3} ${-r * 0.28})`} />
        {state === "mastered" && (
          <g className="sks-face">
            <path d={`M${-r * 0.3} ${r * 0.02}q${r * 0.1} ${-r * 0.14} ${r * 0.2} 0M${r * 0.1} ${r * 0.02}q${r * 0.1} ${-r * 0.14} ${r * 0.2} 0`} />
            <path d={`M${-r * 0.16} ${r * 0.22}q${r * 0.16} ${r * 0.16} ${r * 0.32} 0`} />
          </g>
        )}
      </>
    );
  }
  return <path className="sks-shape" d={SPARKLE(r)} />;
}

const stateText = (k) => (k.attempts ? `${STATE_INFO[k.state].label}, ${pct(k.accuracy)} over ${k.attempts} answer${k.attempts === 1 ? "" : "s"}` : "New, not tried yet");

function Detail({ skill, focus, onClose, onPractise }) {
  if (!skill) {
    return (
      <aside className="sks-detail empty" aria-live="polite">
        <Icon name="northStar" size={22} />
        <p>Choose a star to see the skill, how you're doing on it and a tip.</p>
      </aside>
    );
  }
  const info = STATE_INFO[skill.state];
  const isFocus = focus?.skill === skill.skill;
  return (
    <aside className="sks-detail" aria-live="polite" aria-label={`Skill: ${skill.skill}`}>
      <div className="sks-detail-head">
        <span className={`sks-chip s-${skill.state}`}>{info.label}</span>
        <button type="button" className="sks-x" onClick={onClose} aria-label="Close">
          <Icon name="close" size={16} />
        </button>
      </div>
      <h3>{skill.skill}</h3>
      <p className="sks-where">
        {skill.section} · {skill.domain}
      </p>
      <dl className="sks-facts">
        <div>
          <dt>Accuracy</dt>
          <dd>{skill.attempts ? pct(skill.accuracy) : "—"}</dd>
        </div>
        <div>
          <dt>Answers</dt>
          <dd>{skill.attempts}</dd>
        </div>
      </dl>
      {isFocus && (
        <p className="sks-next">
          <Icon name="target" size={16} />{" "}
          {focus.reason === "points"
            ? `Worth the most for you right now: about ${focus.gain} more question${focus.gain === 1 ? "" : "s"} right on test day at your target accuracy.`
            : focus.reason === "untried"
              ? "A good next step: you haven't tried this one yet."
              : "Your next step: this is the skill with the most room to grow."}
        </p>
      )}
      {skill.tip && (
        <p className="sks-tip">
          <b>Tip</b> {skill.tip}
        </p>
      )}
      <button type="button" className={`ns-btn ${isFocus ? "sks-go-next" : "ns-btn-primary"}`} onClick={() => onPractise(skill)}>
        Practise 10
      </button>
    </aside>
  );
}

function ListView({ data, focus, onPractise }) {
  return (
    <div className="sks-list">
      {data.constellations.map((c) => (
        <section key={c.domain} aria-label={c.domain}>
          <h3>
            {c.domain} <small>{c.section}</small>
          </h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Skill</th>
                <th scope="col">Star</th>
                <th scope="col">Accuracy</th>
                <th scope="col">Answers</th>
                <th scope="col">
                  <span className="sks-sr">Practise</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {c.skills.map((k) => (
                <tr key={k.skill} className={focus?.skill === k.skill ? "next" : ""}>
                  <th scope="row">
                    {k.skill}
                    {focus?.skill === k.skill && <span className="sks-tag">Next step</span>}
                  </th>
                  <td>
                    <span className={`sks-chip s-${k.state}`}>{STATE_INFO[k.state].label}</span>
                  </td>
                  <td>{k.attempts ? pct(k.accuracy) : "—"}</td>
                  <td>{k.attempts}</td>
                  <td>
                    <button type="button" className="ns-btn ns-btn-outline ns-btn-sm" onClick={() => onPractise({ ...k, section: c.section })}>
                      Practise 10
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Each star leans a little, its own way, so a constellation doesn't look stamped out.
const TILT = [-14, 9, -6, 13, -10, 7, 16];

// A panel's own sky: fine dust and a few four-point stars in fixed places (a seeded sequence, so it
// is the same every visit).
function Dust({ box, seed }) {
  const { dots, sparks } = useMemo(() => {
    let n = seed * 7919 + 13;
    const rnd = () => (n = (n * 16807) % 2147483647) / 2147483647;
    return {
      dots: Array.from({ length: Math.round((box.w * box.h) / 2600) }, () => [rnd() * box.w, rnd() * box.h, 0.5 + rnd() * 1.1, 0.25 + rnd() * 0.5]),
      sparks: Array.from({ length: 4 }, () => [14 + rnd() * (box.w - 28), 14 + rnd() * (box.h - 28), 3 + rnd() * 3.5])
    };
  }, [box, seed]);
  return (
    <g aria-hidden="true">
      {dots.map(([x, y, r, o], i) => (
        <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(1)} fill="#fff" opacity={o.toFixed(2)} className={i % 6 === 0 ? "sks-blink" : undefined} style={i % 6 === 0 ? { animationDelay: `${-(i % 5)}s` } : undefined} />
      ))}
      {sparks.map(([x, y, r], i) => (
        <path key={i} d={SPARKLE(r)} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${TILT[(i + seed) % TILT.length]})`} className="sks-spark sks-blink" style={{ animationDelay: `${-i * 1.3}s` }} />
      ))}
    </g>
  );
}

// One constellation in its panel.
function Panel({ shape, info, index, first, selected, focus, onPick, onStarKey }) {
  // The drawing is as wide as the panel, in real pixels: stars spread out with the room there is,
  // while names and stars stay the same size on every screen.
  const frame = useRef(null);
  const [width, setWidth] = useState(PANEL[shape.section].w);
  useEffect(() => {
    const el = frame.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(220, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const stretch = width / PANEL[shape.section].w;
  const box = useMemo(() => ({ w: width, h: PANEL[shape.section].h }), [width, shape.section]);
  const names = Object.keys(shape.stars);
  const byName = new Map(info.skills.map((k) => [k.skill, k]));
  const stars = names.filter((n) => byName.has(n)).map((n) => ({ ...byName.get(n), x: Math.round(shape.stars[n][0] * stretch), y: shape.stars[n][1] }));
  const at = new Map(stars.map((s) => [s.skill, s]));
  const next = focus && at.get(focus.skill);

  return (
    <section className={`sks-panel ${next ? "has-next" : ""}`} style={{ "--hue": shape.hue }} aria-label={shape.domain}>
      <header>
        <h4>{shape.domain}</h4>
        <span className="sks-pct">{info.accuracy == null ? "New" : pct(info.accuracy)}</span>
      </header>
      <div className="sks-frame" ref={frame} style={{ height: box.h }}>
      <svg viewBox={`0 0 ${box.w} ${box.h}`} width={box.w} height={box.h} role="group" aria-label={`${shape.domain}: ${stars.length} skills. Use Tab or the arrow keys to move between stars.`}>
        <Dust box={box} seed={index + 1} />
        <g aria-hidden="true">
          {shape.lines.map(([a, b]) => {
            const A = at.get(names[a]);
            const B = at.get(names[b]);
            if (!A || !B) return null;
            const open = A.state === "new" || B.state === "new";
            return (
              <g key={`${a}-${b}`}>
                {!open && <line className="sks-line-glow" x1={A.x} y1={A.y} x2={B.x} y2={B.y} />}
                <line className={`sks-line ${open ? "open" : ""}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} />
              </g>
            );
          })}
        </g>

        {next && (
          <g className="sks-focus" transform={`translate(${next.x} ${next.y})`} aria-hidden="true">
            <circle className="sks-focus-pulse" r={STATE_INFO[next.state].r + 14} />
            <circle className="sks-focus-ring" r={STATE_INFO[next.state].r + 10} />
          </g>
        )}

        {stars.map((s, i) => {
          const r = STATE_INFO[s.state].r;
          const label = (SHORT[s.skill] || s.skill).split("\n");
          return (
            <g
              key={s.skill}
              data-star={first + i}
              className={`sks-star s-${s.state} ${selected === s.skill ? "on" : ""}`}
              transform={`translate(${s.x} ${s.y})`}
              role="button"
              tabIndex={0}
              aria-pressed={selected === s.skill}
              aria-label={`${s.skill}. ${stateText(s)}.${focus?.skill === s.skill ? " Your next step." : ""}`}
              onClick={() => onPick(s.skill)}
              onKeyDown={(e) => onStarKey(e, first + i, s.skill)}
            >
              <circle className="sks-hit" r="30" />
              <circle className="sks-glow" r={r * 2.6} fill="url(#sksGlow)" />
              <g transform={`rotate(${TILT[(i + index) % TILT.length]})`}>
                <g className="sks-twinkle" style={{ animationDelay: `${-((first + i) * 0.73) % 5}s` }}>
                  <StarShape state={s.state} />
                </g>
              </g>
              <text className="sks-sname" y={r + 19}>
                {label.map((line, n) => (
                  <tspan key={line} x="0" dy={n ? 15 : 0}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}

        {next && (
          <g className="sks-guide" aria-hidden="true">
            {/* Nova leans on the star from the side with more room; the tag sits above them both. */}
            <Nova x={clamp(next.x + (next.x < box.w / 2 ? 10 : -62), 2, box.w - 54)} y={next.y - 64} size={52} mood={novaMood("welcomeBack")} />
            <g transform={`translate(${clamp(next.x - 41, 4, box.w - 86)} ${next.y - 84})`}>
              <rect className="sks-next-tag" width="82" height="22" rx="11" />
              <text className="sks-next-text" x="41" y="15.500">
                Next step
              </text>
            </g>
          </g>
        )}
      </svg>
      </div>
    </section>
  );
}

export function SkillSkyMap({ data }) {
  const nav = useNavigate();
  const [view, setView] = useState("sky");
  // On a wide screen the next step starts open. On a phone its card would cover the map, so
  // nothing is open until a star is tapped.
  const [selected, setSelected] = useState(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches ? null : data.focus?.skill || null));
  const root = useRef(null);

  const all = useMemo(() => data.constellations.flatMap((c) => c.skills.map((k) => ({ ...k, section: c.section, domain: c.domain }))), [data]);
  const chosen = all.find((k) => k.skill === selected) || null;

  // The panels in drawing order, each with the index of its first star (for the arrow keys).
  const sections = useMemo(() => {
    let first = 0;
    let index = 0;
    const out = [];
    for (const shape of CONSTELLATIONS) {
      const info = data.constellations.find((c) => c.domain === shape.domain);
      if (!info) continue;
      let group = out.find((g) => g.name === shape.section);
      if (!group) out.push((group = { name: shape.section, panels: [], skills: 0 }));
      group.panels.push({ shape, info, first, index: index++ });
      group.skills += info.skills.length;
      first += Object.keys(shape.stars).length;
    }
    return out;
  }, [data]);
  const total = sections.reduce((n, g) => n + g.panels.reduce((m, p) => m + Object.keys(p.shape.stars).length, 0), 0);

  const practise = useCallback((k) => nav(playerUrl({ source: "drill", sec: SECTION_KEY[k.section], skills: [k.skill], size: 10, from: "/sky?tab=skills" })), [nav]);

  const onStarKey = (e, i, name) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelected(name);
    } else if (e.key === "Escape") setSelected(null);
    else if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      const next = (i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + total) % total;
      root.current?.querySelector(`[data-star="${next}"]`)?.focus();
    }
  };

  return (
    <div className="sks">
      <div className="sks-tools">
        <ul className="sks-legend" aria-label="What the stars mean">
          {STATE_ORDER.map((s) => (
            <li key={s} title={STATE_INFO[s].note}>
              <svg viewBox="-24 -24 48 48" className={`sks-star s-${s}`} aria-hidden="true">
                <StarShape state={s} />
              </svg>
              {STATE_INFO[s].label} <b>{data.counts[s]}</b>
            </li>
          ))}
        </ul>
        <button type="button" className="ns-pill-btn" aria-pressed={view === "list"} onClick={() => setView((v) => (v === "list" ? "sky" : "list"))}>
          <Icon name={view === "list" ? "northStar" : "checklist"} size={16} /> {view === "list" ? "View as sky" : "View as list"}
        </button>
      </div>

      {view === "list" ? (
        <ListView data={data} focus={data.focus} onPractise={practise} />
      ) : (
        <div className="sks-body">
          <div className="sks-stage" ref={root}>
            {/* One glow, shared by every panel's stars. */}
            <svg className="sks-defs" width="0" height="0" aria-hidden="true">
              <defs>
                <radialGradient id="sksGlow">
                  <stop offset="0" stopColor="#fff" stopOpacity=".9" />
                  <stop offset=".35" stopColor="#fff" stopOpacity=".28" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>
            {sections.map((g) => (
              <div key={g.name} className="sks-group">
                <div className="sks-group-head">
                  <h3>{g.name}</h3>
                  <span>
                    {g.panels.length} constellations · {g.skills} skills
                  </span>
                </div>
                <div className="sks-grid">
                  {g.panels.map((p) => (
                    <Panel key={p.shape.domain} {...p} selected={selected} focus={data.focus} onPick={setSelected} onStarKey={onStarKey} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Detail skill={chosen} focus={data.focus} onClose={() => setSelected(null)} onPractise={practise} />
        </div>
      )}
    </div>
  );
}

// Loads the map for the signed-in student.
export default function SkillSky() {
  const { token } = useStudentAuth();
  const [state, setState] = useState({ data: null, error: "" });
  const load = useCallback(() => {
    setState({ data: null, error: "" });
    getSkillSky(token)
      .then((data) => setState({ data, error: "" }))
      .catch((e) => setState({ data: null, error: e.message || "Couldn't load your skill map" }));
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  if (state.error) {
    return (
      <div className="sks-fail" role="alert">
        <p>{state.error}</p>
        <button type="button" className="ns-btn ns-btn-outline" onClick={load}>
          Try again
        </button>
      </div>
    );
  }
  if (!state.data) {
    return (
      <div className="ns-loading">
        <div className="ns-spinner" />
      </div>
    );
  }
  return <SkillSkyMap data={state.data} />;
}
