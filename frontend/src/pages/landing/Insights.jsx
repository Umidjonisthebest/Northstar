import React from "react";
import Icon from "../../components/Icon.jsx";

// "Know your weak spots" showcase: static examples of the Analytics and
// Study Planner screens, drawn with the same colours as the app.

const WEEKS = ["Jul 6", "Jul 13", "Jul 20", "Jul 27", "Aug 3", "Aug 10", "Aug 17", "Aug 24", "Aug 31", "Sep 7", "Sep 14", "Sep 21"];
const RIGHT = [12, 10, 18, 16, 22, 20, 30, 27, 38, 34, 44, 52];
const WRONG = [14, 10, 14, 12, 14, 12, 14, 12, 14, 12, 12, 10];
const C = { right: ["#146c36", "#2e9a53", "#6cbc83"], wrong: ["#b32b22", "#e3574a", "#f2a39b"] };

// Hard at the bottom, easy on top; correct stacked under wrong.
const split = (n, shares) => {
  const a = Math.round(n * shares[0]);
  const b = Math.round(n * shares[1]);
  return [a, b, n - a - b];
};

function WeeklyBars() {
  const W = 640;
  const H = 330;
  const pad = { l: 34, r: 6, t: 10, b: 28 };
  const top = 80;
  const plotH = H - pad.t - pad.b;
  const band = (W - pad.l - pad.r) / WEEKS.length;
  const bw = Math.min(26, band * 0.55);
  const y = (v) => pad.t + plotH - (v / top) * plotH;
  return (
    <svg className="in-bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Example weekly practice chart: correct answers grow from 12 to 52 a week over twelve weeks while wrong answers stay around 12.">
      {[0, 20, 40, 60, 80].map((v) => (
        <g key={v}>
          <path d={`M${pad.l} ${y(v)}H${W - pad.r}`} stroke={v ? "#eef0f5" : "#d8dbe5"} />
          <text x={pad.l - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">
            {v}
          </text>
        </g>
      ))}
      {WEEKS.map((w, i) => {
        const x = pad.l + i * band + (band - bw) / 2;
        const segs = [...split(RIGHT[i], [0.2, 0.4]).map((n, k) => [n, C.right[k]]), ...split(WRONG[i], [0.4, 0.4]).map((n, k) => [n, C.wrong[k]])].filter(([n]) => n > 0);
        let cur = y(0);
        return (
          <g key={w}>
            <g className="in-col" style={{ "--i": i }}>
              {segs.map(([n, color], k) => {
                const h = (n / top) * plotH;
                const t = cur - h;
                const b = cur - (k ? 2 : 0);
                cur = t;
                const last = k === segs.length - 1;
                return last ? (
                  <path key={k} d={`M${x} ${b}V${t + 4}Q${x} ${t} ${x + 4} ${t}H${x + bw - 4}Q${x + bw} ${t} ${x + bw} ${t + 4}V${b}Z`} fill={color} />
                ) : (
                  <rect key={k} x={x} y={t} width={bw} height={Math.max(0, b - t)} fill={color} />
                );
              })}
            </g>
            {i % 2 === 0 && (
              <text x={x + bw / 2} y={H - 8} textAnchor="middle">
                {w}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const SKILLS = {
  "Reading & Writing": [
    ["Information and Ideas", 48, 72],
    ["Craft and Structure", 41, 58],
    ["Standard English Conventions", 36, 81]
  ],
  Math: [
    ["Algebra", 52, 64],
    ["Advanced Math", 38, 47],
    ["Problem-Solving and Data Analysis", 29, 76]
  ]
};

function SkillRows({ section }) {
  return (
    <div className="in-skills">
      {SKILLS[section].map(([name, attempts, pct]) => (
        <div key={name} className="in-skill">
          <div>
            <b>{name}</b>
            <span>{attempts} attempts</span>
          </div>
          <div className="in-track">
            <i className="r" />
            <i className="o" />
            <i className="g" />
            <em className={pct >= 70 ? "g" : pct >= 50 ? "o" : "r"} style={{ left: `${pct}%` }} />
          </div>
          <strong>
            {pct}
            <small>%</small>
          </strong>
        </div>
      ))}
    </div>
  );
}

function PaceDonut({ avg, rows }) {
  const total = rows.reduce((a, r) => a + r[1], 0);
  const R = 42;
  const L = 2 * Math.PI * R;
  const lens = rows.map((r) => (r[1] / total) * L);
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className="in-pace">
      <svg viewBox="0 0 110 110" aria-hidden="true">
        {rows.map(([, , color], i) => (
          <circle
            key={color}
            cx="55"
            cy="55"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0, lens[i] - 5)} ${L}`}
            strokeDashoffset={-offsets[i]}
            transform="rotate(-90 55 55)"
          />
        ))}
        <text x="55" y="53" textAnchor="middle" className="in-pace-avg">
          {avg}
        </text>
        <text x="55" y="69" textAnchor="middle" className="in-pace-sub">
          per question
        </text>
      </svg>
      <ul>
        {rows.map(([label, , color, text]) => (
          <li key={label}>
            <i style={{ background: color }} />
            {label}
            <b>{text}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

const HEAT = {
  "Aug 2026": { start: 5, days: 31, on: { 1: 2, 2: 1, 5: 1, 6: 2, 7: 3, 8: 2, 9: 2, 12: 1, 13: 2, 14: 2, 15: 1, 16: 3, 19: 2, 20: 2, 21: 1, 22: 2, 23: 3, 24: 1, 26: 2, 27: 2, 28: 2, 29: 1, 30: 2, 31: 1 } },
  "Sep 2026": { start: 1, days: 30, on: { 2: 1, 3: 2, 4: 3, 5: 2, 6: 2, 7: 1, 8: 2, 9: 1, 10: 2, 11: 3, 12: 2, 13: 1, 16: 2, 17: 2, 18: 2, 19: 3, 20: 2, 21: 1, 22: 2, 23: 2, 24: 3, 25: 2, 26: 1 } }
};

function Heatmap() {
  return (
    <div className="in-heat">
      {Object.entries(HEAT).map(([month, m]) => (
        <div key={month}>
          <b>{month}</b>
          <div className="in-heat-grid">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={`h${i}`} className="in-dow">
                {d}
              </span>
            ))}
            {Array.from({ length: m.start }, (_, i) => (
              <span key={`e${i}`} />
            ))}
            {Array.from({ length: m.days }, (_, i) => (
              <i key={i} className={`l${m.on[i + 1] || 0}`} />
            ))}
          </div>
        </div>
      ))}
      <p className="in-heat-key">
        Less <i className="l0" />
        <i className="l1" />
        <i className="l2" />
        <i className="l3" /> More
      </p>
    </div>
  );
}

const PLAN = [
  ["Transitions", "8 questions", "rw", true],
  ["Nonlinear functions", "10 questions", "math", true],
  ["Boundaries", "6 questions", "rw", false],
  ["Timed mock module", "1 module", "mock", false]
];

export default function Insights() {
  return (
    <div className="in-grid">
      <div className="in-main ln-reveal">
        <span className="in-example">Example</span>
        <WeeklyBars />
        <div className="in-legend">
          <span>
            <i className="g" /> Correct
          </span>
          <span>
            <i className="r" /> Wrong
          </span>
          <span className="in-legend-note">Darker = harder questions</span>
        </div>
        <div className="in-panels">
          {["Reading & Writing", "Math"].map((sec) => (
            <div key={sec} className="in-panel">
              <h4>{sec}</h4>
              <SkillRows section={sec} />
              <PaceDonut
                avg={sec === "Math" ? "1m 58s" : "1m 12s"}
                rows={
                  sec === "Math"
                    ? [
                        ["Easy", 55, "#22c55e", "55s"],
                        ["Medium", 95, "#f59e0b", "1m 35s"],
                        ["Hard", 188, "#ef4444", "3m 8s"]
                      ]
                    : [
                        ["Easy", 46, "#22c55e", "46s"],
                        ["Medium", 74, "#f59e0b", "1m 14s"],
                        ["Hard", 112, "#ef4444", "1m 52s"]
                      ]
                }
              />
            </div>
          ))}
        </div>
      </div>
      <div className="in-side">
        <div className="in-card ln-reveal">
          <div className="in-plan">
            {PLAN.map(([skill, count, kind, done]) => (
              <div key={skill} className={`in-task ${done ? "done" : ""}`}>
                <span className="in-tick">{done && <Icon name="check" size={13} strokeWidth={3} />}</span>
                <div>
                  <b>{skill}</b>
                  <span>{count}</span>
                </div>
                <em className={kind}>{kind === "rw" ? "R&W" : kind === "math" ? "Math" : "Mock"}</em>
              </div>
            ))}
          </div>
          <h3>A plan that follows your weak spots</h3>
          <p>Every week your study plan picks the skills where your accuracy is lowest, and each task opens the right practice set.</p>
        </div>
        <div className="in-card ln-reveal">
          <Heatmap />
          <h3>Build a study habit</h3>
          <p>Streaks, daily XP goals and a calendar of your study days keep you coming back.</p>
        </div>
      </div>
    </div>
  );
}
