import React, { useState } from "react";
import { updateSettings } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { Loading } from "./Home.jsx";
import Icon from "../../components/Icon.jsx";
import "../../calc.css";

/*
 * A planning estimate, not College Board's conversion (they don't publish one: the real test
 * scores the pattern of answers with item response theory, not a count).
 *
 * What is public, and what this model does with it:
 *  - Each section is two modules: Reading & Writing 27 + 27 questions (32 min each), Math 22 + 22
 *    (35 min each). Module 1 is mixed; how it goes decides whether module 2 is the easier or the
 *    harder set.
 *  - On the easier route a section tops out well below 800 (about 620-630 by prep-industry
 *    estimates). `cap` is that ceiling; `routeAt` is our assumption for the module 1 score that
 *    unlocks the harder set (about two thirds right). Neither number is official.
 *  - Harder route: 200 + 600 x share correct. Easier route: the same line made shallower, so a
 *    perfect easier module 2 after a module 1 just under `routeAt` lands on the cap.
 */
const SECTIONS = [
  { key: "rw", label: "Reading & Writing", n: 27, minutes: 32, routeAt: 18, cap: 620, tint: "#b05fd6" },
  { key: "math", label: "Math", n: 22, minutes: 35, routeAt: 14, cap: 620, tint: "#4f7df3" }
];
const ROUTES = [
  ["auto", "Auto"],
  ["easier", "Easier"],
  ["harder", "Harder"]
];
const round10 = (x) => Math.round(x / 10) * 10;

const isHarder = (sec, v) => v.route === "harder" || (v.route === "auto" && v.m1 >= sec.routeAt);

function moduleScore(sec, v) {
  const share = (v.m1 + v.m2) / (2 * sec.n);
  if (isHarder(sec, v)) return round10(200 + 600 * share);
  const bestShare = (sec.routeAt - 1 + sec.n) / (2 * sec.n);
  return Math.min(sec.cap, round10(200 + (sec.cap - 200) * (share / bestShare)));
}
const sectionScore = (sec, raw) => round10(200 + 600 * (raw / (2 * sec.n)));

const BENCH = [
  [1050, "Around the national average"],
  [1200, "Competitive for many state universities"],
  [1350, "Strong: roughly the top 10% of test takers"],
  [1450, "Very selective universities"],
  [1520, "Most selective universities"]
];

const FACTS = [
  ["Two sections, four modules", "Reading & Writing is two modules of 27 questions, 32 minutes each. Math is two modules of 22 questions, 35 minutes each."],
  ["Module 1 chooses module 2", "The first module mixes easy, medium and hard questions. How you do on it decides whether your second module is the easier or the harder set."],
  ["The harder set unlocks the top scores", "On the easier set a section tops out at roughly 620 to 630, even with every answer right. College Board doesn't publish the cut-off; this calculator assumes about two thirds of module 1."],
  ["It isn't a count of right answers", "College Board scores the whole pattern: which questions you got right, how hard they were, and whether it looks like guessing. Two questions in each module are unscored trial questions."],
  ["Wrong answers cost nothing", "There's no penalty for a wrong answer, so never leave a question blank."]
];

// One number with a slider and -/+ buttons. `id` ties the label to the slider.
function Dial({ id, label, hint, value, max, onChange }) {
  const set = (n) => onChange(Math.max(0, Math.min(max, n)));
  return (
    <div className="ns-calc-dial">
      <div className="ns-calc-dial-top">
        <label htmlFor={id}>
          {label}
          {hint && <small>{hint}</small>}
        </label>
        <div className="ns-calc-step">
          <button type="button" onClick={() => set(value - 1)} disabled={value <= 0} aria-label={`One fewer correct in ${label}`}>
            <Icon name="minus" size={16} />
          </button>
          <output htmlFor={id}>
            <b>{value}</b> / {max}
          </output>
          <button type="button" onClick={() => set(value + 1)} disabled={value >= max} aria-label={`One more correct in ${label}`}>
            <Icon name="plus" size={16} />
          </button>
        </div>
      </div>
      <input id={id} type="range" min="0" max={max} value={value} onChange={(e) => set(Number(e.target.value))} style={{ "--fill": `${(value / max) * 100}%` }} />
    </div>
  );
}

export default function ScoreCalc() {
  const { token } = useStudentAuth();
  const { progress, refresh } = useProgress();
  const { toast } = useToast();
  const [mode, setMode] = useState("module");
  const [byModule, setByModule] = useState({ rw: { m1: 20, m2: 18, route: "auto" }, math: { m1: 16, m2: 13, route: "auto" } });
  const [bySection, setBySection] = useState({ rw: 38, math: 29 });
  // Kept as the text in the box, so it can be cleared and retyped (a number turned "" into 0).
  // Until something is typed, the box shows the saved target.
  const [edited, setTargetText] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!progress) return <Loading />;

  const targetText = edited ?? String(progress.targetScore);
  const typed = Number(targetText);
  const validTarget = targetText.trim() !== "" && Number.isInteger(typed) && typed >= 400 && typed <= 1600;
  const target = validTarget ? typed : progress.targetScore;

  async function saveTarget() {
    if (!validTarget) {
      toast.error("Enter a target between 400 and 1600.");
      return;
    }
    setSaving(true);
    try {
      const r = await updateSettings(token, { targetScore: typed });
      setTargetText(String(r.targetScore));
      refresh();
      toast.success(`Target set to ${r.targetScore}`);
    } catch (e) {
      toast.error(e.message || "Couldn't save your target");
    } finally {
      setSaving(false);
    }
  }

  const patch = (key, change) => setByModule((all) => ({ ...all, [key]: { ...all[key], ...change } }));
  const scores = Object.fromEntries(SECTIONS.map((s) => [s.key, mode === "module" ? moduleScore(s, byModule[s.key]) : sectionScore(s, bySection[s.key])]));
  const total = scores.rw + scores.math;
  const gap = Math.max(0, (target || 1400) - total);
  const at = (score) => `${Math.max(0, Math.min(100, ((score - 400) / 1200) * 100))}%`;

  return (
    <div className="ns-page" style={{ gap: 22, paddingTop: 12 }}>
      <div>
        <h1 className="ns-h1">
          <Icon name="calc" size={32} /> Score Calculator
        </h1>
        <p className="ns-lead">See what a number of right answers adds up to. An estimate for planning, not an official College Board conversion.</p>
      </div>

      <div className="ns-capsule" role="group" aria-label="How to enter your answers">
        {[
          ["module", "By module"],
          ["section", "By section"]
        ].map(([key, label]) => (
          <button key={key} type="button" className={mode === key ? "on" : ""} aria-pressed={mode === key} onClick={() => setMode(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="ns-calc">
        <div className="ns-calc-inputs">
          {SECTIONS.map((sec) => {
            const v = byModule[sec.key];
            const harder = isHarder(sec, v);
            return (
              <section key={sec.key} className="ns-calc-sec" style={{ "--tint": sec.tint }}>
                <header>
                  <h2>{sec.label}</h2>
                  <span className="ns-calc-sec-score">
                    <b>{scores[sec.key]}</b> / 800
                  </span>
                </header>

                {mode === "section" ? (
                  <Dial id={`${sec.key}-all`} label="Correct answers" hint={`${sec.n * 2} questions in two modules`} value={bySection[sec.key]} max={sec.n * 2} onChange={(n) => setBySection((all) => ({ ...all, [sec.key]: n }))} />
                ) : (
                  <>
                    <Dial id={`${sec.key}-m1`} label="Module 1" hint={`${sec.n} questions · ${sec.minutes} min`} value={v.m1} max={sec.n} onChange={(n) => patch(sec.key, { m1: n })} />
                    <div className="ns-calc-route">
                      <span>Module 2 set</span>
                      <div role="group" aria-label={`${sec.label} module 2 set`}>
                        {ROUTES.map(([key, label]) => (
                          <button key={key} type="button" className={v.route === key ? "on" : ""} aria-pressed={v.route === key} onClick={() => patch(sec.key, { route: key })}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className={`ns-calc-note ${harder ? "up" : ""}`}>
                      <Icon name={harder ? "northStar" : "info"} size={15} />
                      {v.route === "auto"
                        ? harder
                          ? `${v.m1} right in module 1 would most likely open the harder set.`
                          : `Under about ${sec.routeAt} right in module 1, expect the easier set, which tops out near ${sec.cap}.`
                        : harder
                          ? "Scored as the harder set, whatever module 1 says."
                          : `Scored as the easier set, which tops out near ${sec.cap}.`}
                    </p>
                    <Dial id={`${sec.key}-m2`} label={`Module 2 · ${harder ? "harder" : "easier"} set`} hint={`${sec.n} questions · ${sec.minutes} min`} value={v.m2} max={sec.n} onChange={(n) => patch(sec.key, { m2: n })} />
                  </>
                )}
              </section>
            );
          })}
        </div>

        <aside className="ns-calc-result">
          <p className="ns-calc-kicker">Estimated total</p>
          <div className="ns-calc-total">{total}</div>
          <p className="ns-calc-range">
            Likely range {Math.max(400, total - 40)} to {Math.min(1600, total + 40)}
          </p>
          <div className="ns-calc-split">
            <span>
              Reading & Writing <b>{scores.rw}</b>
            </span>
            <span>
              Math <b>{scores.math}</b>
            </span>
          </div>

          <div className="ns-calc-track" role="img" aria-label={`Estimated ${total} on a scale from 400 to 1600${target ? `, target ${target}` : ""}`}>
            <div className="ns-calc-fill" style={{ width: at(total) }} />
            {target && <div className="ns-calc-target" style={{ left: at(target) }} />}
          </div>
          <div className="ns-calc-scale">
            <span>400</span>
            <span>1000</span>
            <span>1600</span>
          </div>

          <p className="ns-calc-gap">
            {gap === 0 ? (
              <>
                <Icon name="party" size={16} /> At or above your target of {target}
              </>
            ) : (
              <>
                <b>{gap}</b> points to your target of {target}
              </>
            )}
          </p>

          <div className="ns-calc-goal">
            <label htmlFor="calc-target">Your target</label>
            <input id="calc-target" type="number" min="400" max="1600" step="10" value={targetText} onChange={(e) => setTargetText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveTarget()} />
            <button type="button" onClick={saveTarget} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {progress.estimate.total && (
            <p className="ns-calc-now">
              Your current estimate from {progress.estimate.rw?.source}: <b>{progress.estimate.total}</b>
            </p>
          )}
        </aside>
      </div>

      <details className="ns-calc-more" open>
        <summary>
          <Icon name="info" size={18} /> How digital SAT scoring works
          <Icon name="chevronDown" size={18} className="ns-calc-chev" />
        </summary>
        <ol>
          {FACTS.map(([title, body], i) => (
            <li key={title}>
              <span>{i + 1}</span>
              <div>
                <b>{title}</b>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="ns-calc-fine">
          The real score also comes with a range: College Board treats a total as accurate to about 40 points either way, which is the range shown above.
        </p>
      </details>

      <details className="ns-calc-more">
        <summary>
          <Icon name="target" size={18} /> What totals mean
          <Icon name="chevronDown" size={18} className="ns-calc-chev" />
        </summary>
        <ul className="ns-calc-bench">
          {BENCH.map(([s, l]) => (
            <li key={s} className={total >= s ? "hit" : ""}>
              <b>{s}</b>
              <span>{l}</span>
              {total >= s && <Icon name="check" size={16} strokeWidth={2.6} />}
            </li>
          ))}
        </ul>
        <p className="ns-calc-fine">Rough guides only. Check each university's published score ranges.</p>
      </details>
    </div>
  );
}
