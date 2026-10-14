import React, { useEffect, useState } from "react";
import { ieltsAnalytics, ieltsBands, updateSettings } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import LoadFailed from "../../components/LoadFailed.jsx";
import { Loading } from "./Home.jsx";
import { band } from "./ieltsShared.jsx";
import "../../calc.css";

/*
 * IELTS band calculator. Listening and Reading: a number of right answers out of 40 becomes a
 * band through the same tables the marking uses (backend ielts/lib/scoring.js, sent by
 * /ielts/student/bands, so the two can't drift apart). Writing and Speaking are given by an
 * examiner, so the student sets those bands. The overall band is the mean of the four, rounded
 * to the nearest half band (a mean ending in .25 goes up to .5, one ending in .75 up to the next
 * whole band).
 */
const MARKED = [
  { key: "listening", label: "Listening", tint: "#1c9ff0" },
  { key: "reading", label: "Reading", tint: "#d9468f" }
];
const JUDGED = [
  { key: "writing", label: "Writing", hint: "Task 2 counts twice as much as Task 1", tint: "#7c4dff" },
  { key: "speaking", label: "Speaking", hint: "An interview of 11 to 14 minutes", tint: "#4f7df3" }
];
const TARGETS = Array.from({ length: 11 }, (_, i) => 4 + i * 0.5); // 4.0 to 9.0

const FACTS = [
  ["Four skills, equal weight", "Listening, Reading, Writing and Speaking each give a band from 0 to 9, and each counts for a quarter of the overall band."],
  ["How the overall band is rounded", "The four bands are averaged and rounded to the nearest half band. An average of 6.25 becomes 6.5, and 6.75 becomes 7.0."],
  ["Listening and Reading are counted", "Each has 40 questions worth one mark. The number you get right is turned into a band, and a wrong answer costs nothing, so never leave a blank."],
  ["Writing and Speaking are judged", "An examiner marks them against four criteria each. In Writing, Task 2 counts twice as much as Task 1."]
];

const bandOf = (table, raw) => (table.find(([min]) => raw >= min) || [0, 0])[1];
const overallOf = (bands) => Math.round((bands.reduce((a, b) => a + b, 0) / bands.length) * 2) / 2;
// The fewest right answers that give a higher band than `raw` does: [answers, band], or null at 9.
function nextStep(table, raw) {
  const higher = table.filter(([min]) => min > raw);
  return higher.length ? higher[higher.length - 1] : null;
}
// "30–31 → 7.0" rows for the reference table.
function ranges(table, outOf) {
  return table.map(([min, b], i) => {
    const top = i === 0 ? outOf : table[i - 1][0] - 1;
    return { band: b, from: min, to: top };
  });
}

// One number with a slider and -/+ buttons. `show` turns the stored value into what is printed.
function Dial({ id, label, hint, value, max, step = 1, show, unit, onChange }) {
  const set = (n) => onChange(Math.max(0, Math.min(max, n)));
  return (
    <div className="ns-calc-dial">
      <div className="ns-calc-dial-top">
        <label htmlFor={id}>
          {label}
          {hint && <small>{hint}</small>}
        </label>
        <div className="ns-calc-step">
          <button type="button" onClick={() => set(value - step)} disabled={value <= 0} aria-label={`Lower ${label}`}>
            <Icon name="minus" size={16} />
          </button>
          <output htmlFor={id}>
            <b>{show ? show(value) : value}</b> {unit}
          </output>
          <button type="button" onClick={() => set(value + step)} disabled={value >= max} aria-label={`Raise ${label}`}>
            <Icon name="plus" size={16} />
          </button>
        </div>
      </div>
      <input id={id} type="range" min="0" max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} style={{ "--fill": `${(value / max) * 100}%` }} />
    </div>
  );
}

export default function IeltsBandCalc() {
  const { token } = useStudentAuth();
  const { progress, refresh } = useProgress();
  const { toast } = useToast();
  const [tables, setTables] = useState(null);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState({ listening: 26, reading: 25 });
  const [judged, setJudged] = useState({ writing: 6, speaking: 6 });
  const [fromPractice, setFromPractice] = useState(null); // which skills started from the student's own results
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([ieltsBands(token), ieltsAnalytics(token).catch(() => null)])
      .then(([t, mine]) => {
        if (!live) return;
        setTables(t);
        // Start from the student's own practice where there is some: their best answers, out of 40.
        const start = {};
        for (const { key } of MARKED) {
          const e = mine?.skills?.[key]?.estimate;
          if (e?.total) start[key] = Math.round((e.correct * t.outOf) / e.total);
        }
        if (Object.keys(start).length) {
          setRaw((r) => ({ ...r, ...start }));
          setFromPractice(Object.keys(start));
        }
      })
      .catch((e) => live && setError(e.message || "Couldn't load the band tables"));
    return () => {
      live = false;
    };
  }, [token]);

  if (error) return <LoadFailed title="Couldn't load the band calculator" message={error} />;
  if (!tables || !progress) return <Loading />;

  const outOf = tables.outOf;
  const bands = {
    listening: bandOf(tables.listening, raw.listening),
    reading: bandOf(tables.reading, raw.reading),
    writing: judged.writing,
    speaking: judged.speaking
  };
  const all = [bands.listening, bands.reading, bands.writing, bands.speaking];
  const overall = overallOf(all);
  const mean = all.reduce((a, b) => a + b, 0) / 4;
  const target = progress.ieltsTarget ?? 7;
  // An average of target - 0.25 already rounds up to the target, so that is what the four bands must add up to.
  const needed = Math.max(0, 4 * target - 1 - all.reduce((a, b) => a + b, 0));
  const at = (b) => `${Math.max(0, Math.min(100, (b / 9) * 100))}%`;

  async function saveTarget(value) {
    setSaving(true);
    try {
      await updateSettings(token, { ieltsTarget: value });
      await refresh();
      toast.success(`Target set to band ${band(value)}`);
    } catch (e) {
      toast.error(e.message || "Couldn't save your target");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ns-page" style={{ gap: 22, paddingTop: 12 }}>
      <div>
        <h1 className="ns-h1">
          <Icon name="calc" size={32} /> Band Calculator
        </h1>
        <p className="ns-lead">See what a number of right answers is worth, and what the four skills add up to. The Listening and Reading tables are the ones your practice is marked with.</p>
      </div>

      <div className="ns-calc">
        <div className="ns-calc-inputs">
          {MARKED.map((sec) => {
            const step = nextStep(tables[sec.key], raw[sec.key]);
            return (
              <section key={sec.key} className="ns-calc-sec" style={{ "--tint": sec.tint }}>
                <header>
                  <h2>{sec.label}</h2>
                  <span className="ns-calc-sec-score">
                    Band <b>{band(bands[sec.key])}</b>
                  </span>
                </header>
                <Dial
                  id={`ib-${sec.key}`}
                  label="Right answers"
                  hint={fromPractice?.includes(sec.key) ? "Started from your best practice answers" : `Out of ${outOf} questions`}
                  value={raw[sec.key]}
                  max={outOf}
                  unit={`/ ${outOf}`}
                  onChange={(n) => setRaw((r) => ({ ...r, [sec.key]: n }))}
                />
                <p className={`ns-calc-note ${step ? "up" : ""}`}>
                  <Icon name={step ? "trendUp" : "star"} size={16} />
                  {step ? (
                    <span>
                      {step[0] - raw[sec.key]} more right {step[0] - raw[sec.key] === 1 ? "answer takes" : "answers take"} {sec.label} to band {band(step[1])}.
                    </span>
                  ) : (
                    <span>That is the top band for {sec.label}.</span>
                  )}
                </p>
              </section>
            );
          })}
          {JUDGED.map((sec) => (
            <section key={sec.key} className="ns-calc-sec" style={{ "--tint": sec.tint }}>
              <header>
                <h2>{sec.label}</h2>
                <span className="ns-calc-sec-score">
                  Band <b>{band(bands[sec.key])}</b>
                </span>
              </header>
              <Dial
                id={`ib-${sec.key}`}
                label="Band from an examiner or teacher"
                hint={sec.hint}
                value={judged[sec.key] * 2}
                max={18}
                show={(v) => band(v / 2)}
                unit=""
                onChange={(n) => setJudged((j) => ({ ...j, [sec.key]: n / 2 }))}
              />
            </section>
          ))}
        </div>

        <aside className="ns-calc-result">
          <p className="ns-calc-kicker">Overall band</p>
          <div className="ns-calc-total">{band(overall)}</div>
          <p className="ns-calc-range">The four bands average {mean.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}, which rounds to {band(overall)}.</p>
          <div className="ns-calc-split">
            {[...MARKED, ...JUDGED].map((s) => (
              <span key={s.key}>
                {s.label}
                <b>{band(bands[s.key])}</b>
              </span>
            ))}
          </div>
          <div className="ns-calc-track" role="img" aria-label={`Overall band ${band(overall)} on a scale from 0 to 9, target ${band(target)}`}>
            <div className="ns-calc-fill" style={{ width: at(overall) }} />
            <div className="ns-calc-target" style={{ left: at(target) }} />
          </div>
          <div className="ns-calc-scale">
            <span>0</span>
            <span>4.5</span>
            <span>9</span>
          </div>
          <p className="ns-calc-gap">
            {overall >= target ? (
              <>
                <Icon name="check" size={18} /> These bands reach your target of {band(target)}.
              </>
            ) : (
              <>
                <Icon name="target" size={18} />
                <b>{needed % 1 === 0 ? needed : needed.toFixed(1)}</b> more band {needed === 1 ? "point" : "points"} across the four skills for {band(target)}
              </>
            )}
          </p>
          <div className="ns-calc-goal">
            <label htmlFor="ib-target">Your target band</label>
            <select id="ib-target" className="ns-ib-target" value={target} disabled={saving} onChange={(e) => saveTarget(Number(e.target.value))}>
              {TARGETS.map((t) => (
                <option key={t} value={t}>
                  {band(t)}
                </option>
              ))}
            </select>
          </div>
          <p className="ns-calc-now">Half a band in two skills, or a whole band in one, is one band point each way.</p>
        </aside>
      </div>

      <details className="ns-calc-more" open>
        <summary>
          <Icon name="info" size={20} /> How the IELTS band is worked out
          <Icon name="chevronDown" size={18} className="ns-calc-chev" />
        </summary>
        <ol>
          {FACTS.map(([title, text], i) => (
            <li key={title}>
              <span>{i + 1}</span>
              <div>
                <b>{title}</b>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="ns-calc-fine">The conversion changes a little from one test to another. These are the commonly published Academic tables, the same ones Northstar marks with.</p>
      </details>

      <details className="ns-calc-more">
        <summary>
          <Icon name="checklist" size={20} /> Right answers and bands
          <Icon name="chevronDown" size={18} className="ns-calc-chev" />
        </summary>
        <div className="ns-ib-tables">
          {MARKED.map((sec) => (
            <table key={sec.key} className="ns-ib-table">
              <caption>{sec.label}</caption>
              <thead>
                <tr>
                  <th scope="col">Right answers</th>
                  <th scope="col">Band</th>
                </tr>
              </thead>
              <tbody>
                {ranges(tables[sec.key], outOf)
                  .filter((r) => r.band >= 4)
                  .map((r) => (
                    <tr key={r.band} className={bands[sec.key] === r.band ? "hit" : ""}>
                      <td>{r.from === r.to ? r.from : `${r.from} to ${r.to}`}</td>
                      <td>{band(r.band)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ))}
        </div>
        <p className="ns-calc-fine">Below band 4 the steps are two answers each. The row in colour is where your numbers above put you.</p>
      </details>
    </div>
  );
}
