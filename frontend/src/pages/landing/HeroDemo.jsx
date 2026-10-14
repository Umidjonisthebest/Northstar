import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import { CardsTile, ChartTile, QuestionTile } from "./bits.jsx";
import { reducedMotion, useInView } from "./hooks.js";

// The hero's live demo: a Digital SAT question and an IELTS listening form,
// each "answered" by an animated cursor, alternating. Purely illustrative.

const SAT_OPTIONS = ["4", "6", "8", "18"];
const SAT_RIGHT = 1;
const GAPS = ["double", "3"];

const typing = (from, cursor, word, gap, typed) =>
  Array.from({ length: word.length }, (_, i) => ({ at: from + (i + 1) * 105, cursor, focus: gap, typed: gap === 1 ? [i + 1, typed[1]] : [typed[0], i + 1] }));

const SCRIPT = {
  sat: [
    { at: 0, cursor: "rest" },
    { at: 900, cursor: "opt" },
    { at: 1650, cursor: "opt", click: true, sel: true },
    { at: 2450, cursor: "check", sel: true },
    { at: 3200, cursor: "check", click: true, sel: true, checked: true }
  ],
  ielts: [
    { at: 0, cursor: "rest", typed: [0, 0] },
    { at: 800, cursor: "gap1", typed: [0, 0] },
    { at: 1400, cursor: "gap1", click: true, focus: 1, typed: [0, 0] },
    ...typing(1400, "gap1", GAPS[0], 1, [0, 0]),
    { at: 2350, cursor: "gap2", typed: [6, 0] },
    { at: 2950, cursor: "gap2", click: true, focus: 2, typed: [6, 0] },
    ...typing(2950, "gap2", GAPS[1], 2, [6, 0]),
    { at: 3650, cursor: "check", typed: [6, 1] },
    { at: 4350, cursor: "check", click: true, typed: [6, 1], checked: true }
  ]
};
const HOLD = 3400;

const CHIP = {
  sat: { label: "Score estimate", from: "1360", to: "1480", delta: "+120 points" },
  ielts: { label: "Band estimate", from: "6.5", to: "7.5", delta: "+1.0 band" }
};

function Cursor({ innerRef, click }) {
  return (
    <div className={`hd-cursor ${click ? "click" : ""}`} ref={innerRef}>
      <svg viewBox="0 0 24 24" width="26" height="26">
        <path d="M5 2.5l14.5 9.2-6.4 1.2 3.7 7.2-3 1.5-3.7-7.2-4.9 4.3z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <span className="hd-ripple" />
    </div>
  );
}

export default function HeroDemo() {
  const wrapRef = useRef(null);
  const cardRef = useRef(null);
  const cursorRef = useRef(null);
  const checkRef = useRef(null);
  const optRef = useRef(null);
  const gapRefs = [useRef(null), useRef(null)];
  const inView = useInView(wrapRef);
  const still = reducedMotion();
  const [play, setPlay] = useState({ exam: "sat", step: still ? SCRIPT.sat.length - 1 : 0 });
  const { exam } = play;
  const script = SCRIPT[exam];
  const s = script[Math.min(play.step, script.length - 1)];

  // Run the script while the demo is on screen, then switch exams.
  useEffect(() => {
    if (still || !inView) return undefined;
    const timers = script.map((st, i) => setTimeout(() => setPlay((p) => (p.exam === exam ? { exam, step: i } : p)), st.at));
    const last = script[script.length - 1].at;
    timers.push(setTimeout(() => setPlay({ exam: exam === "sat" ? "ielts" : "sat", step: 0 }), last + HOLD));
    return () => timers.forEach(clearTimeout);
  }, [exam, inView, still, script]);

  // Move the cursor to its target (DOM only, no re-render).
  useLayoutEffect(() => {
    const card = cardRef.current;
    const cur = cursorRef.current;
    if (!card || !cur) return;
    const target = { opt: optRef.current, check: checkRef.current, gap1: gapRefs[0].current, gap2: gapRefs[1].current }[s.cursor];
    const c = card.getBoundingClientRect();
    let x = c.width - 70;
    let y = c.height - 30;
    if (target) {
      const r = target.getBoundingClientRect();
      x = r.left - c.left + r.width * (s.cursor === "check" ? 0.62 : 0.78);
      y = r.top - c.top + r.height * 0.58;
    }
    // A freshly mounted card places the cursor without the glide.
    const fresh = cur.dataset.placed !== "1";
    if (fresh) cur.style.transition = "none";
    cur.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    if (fresh) {
      cur.dataset.placed = "1";
      void cur.offsetWidth;
      cur.style.transition = "";
    }
  });

  const choose = (next) => setPlay({ exam: next, step: still ? SCRIPT[next].length - 1 : 0 });
  const chip = CHIP[exam];

  return (
    <div className="hd" ref={wrapRef}>
      <div className="hd-tabs" role="tablist" aria-label="Choose an exam to preview">
        {[
          ["sat", "Digital SAT", "calc"],
          ["ielts", "IELTS", "headphones"]
        ].map(([key, label, icon]) => (
          <button key={key} role="tab" aria-selected={exam === key} className={exam === key ? "on" : ""} onClick={() => choose(key)}>
            <Icon name={icon} size={16} /> {label}
          </button>
        ))}
      </div>
      <p className="ln-sr">Example: a Digital SAT math question and an IELTS listening form, answered and checked.</p>

      <div className={`hd-stage ${exam}`} aria-hidden="true">
        <div className="hd-blob">
          <i />
          <i />
        </div>
        <div className="hd-tile t1">
          <QuestionTile />
        </div>
        <div className="hd-tile t2">
          <Nova size={78} tone={exam === "sat" ? "rose" : "sky"} extra={exam === "sat" ? "cap" : "headphones"} mood={s.checked ? "cheer" : "happy"} sparkles={false} />
        </div>
        <div className="hd-tile t3">{exam === "sat" ? <ChartTile /> : <CardsTile />}</div>

        <div className={`hd-chip ${s.checked ? "up" : ""}`}>
          <span>{chip.label}</span>
          <b>
            {s.checked ? chip.to : chip.from}
            <i>
              <Icon name="arrowRight" size={16} strokeWidth={2.6} />
            </i>
          </b>
          <em>{chip.delta}</em>
        </div>

        <div className="hd-card" ref={cardRef} key={exam}>
          {exam === "sat" ? (
            <>
              <div className="hd-bar">
                <span className="hd-num">8</span>
                <span className="hd-mark">
                  <Icon name="bookmark" size={14} /> Mark for Review
                </span>
                <span className="hd-abc">ABC</span>
              </div>
              <p className="hd-q">
                If 3<i>x</i> + 7 = 25, what is the value of <i>x</i>?
              </p>
              <div className="hd-opts">
                {SAT_OPTIONS.map((o, i) => {
                  const picked = s.sel && i === SAT_RIGHT;
                  return (
                    <div key={o} ref={i === SAT_RIGHT ? optRef : undefined} className={`hd-opt ${picked ? (s.checked ? "right" : "picked") : ""} ${s.checked && !picked ? "dim" : ""}`}>
                      <span className="hd-letter">{picked && s.checked ? <Icon name="check" size={14} strokeWidth={3} /> : "ABCD"[i]}</span>
                      {o}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="hd-bar ielts">
                <span className="hd-part">
                  <Icon name="headphones" size={15} /> Listening · Part 1
                </span>
                <span className="hd-wave">
                  {Array.from({ length: 14 }, (_, i) => (
                    <i key={i} style={{ animationDelay: `${(i % 7) * 0.12}s` }} />
                  ))}
                </span>
                <span className="hd-time">28:41</span>
              </div>
              <p className="hd-instr">
                Complete the form. Write <b>ONE WORD AND/OR A NUMBER</b> for each answer.
              </p>
              <div className="hd-form">
                <div className="hd-row">
                  <span>Guest name</span>
                  <b>Sarah Collins</b>
                </div>
                {GAPS.map((word, g) => {
                  const typed = s.typed?.[g] ?? word.length;
                  return (
                    <div key={word} className="hd-row">
                      <span>{g === 0 ? "Room type" : "Number of nights"}</span>
                      <span ref={gapRefs[g]} className={`hd-gap ${s.focus === g + 1 ? "focus" : ""} ${s.checked ? "right" : ""}`}>
                        <em>{g + 1}</em>
                        {word.slice(0, typed)}
                        {s.focus === g + 1 && !s.checked && <span className="hd-caret" />}
                        {s.checked && <Icon name="check" size={14} strokeWidth={3} />}
                      </span>
                    </div>
                  );
                })}
                <div className="hd-row">
                  <span>Breakfast</span>
                  <b>included</b>
                </div>
              </div>
            </>
          )}
          <div className="hd-foot">
            <span>{exam === "sat" ? "8 of 27" : "Questions 1–10"}</span>
            <span className={`hd-check ${s.checked ? "done" : ""}`} ref={checkRef}>
              <Icon name={s.checked ? "check" : "success"} size={16} strokeWidth={2.6} /> {s.checked ? "Correct!" : exam === "sat" ? "Check Answer" : "Check answers"}
            </span>
          </div>
          {s.checked && <span className="hd-xp">+10 XP</span>}
          {s.checked && (
            <span className="hd-burst">
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} style={{ "--a": `${i * 45}deg` }} />
              ))}
            </span>
          )}
          <Cursor innerRef={cursorRef} click={s.click} />
        </div>
      </div>
    </div>
  );
}
