import React, { useEffect, useRef, useState } from "react";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import { reducedMotion, useInView } from "./hooks.js";

// "Meet Nova" demo: a student who picked a wrong answer asks Nova for help;
// Nova highlights the evidence and walks them toward the answer. Loops.

const ASK = "Can you walk me through this?";
const T0 = 900;
const TYPE = 42;
const SENT = T0 + ASK.length * TYPE + 350;

const SCRIPT = [
  { at: 0, typed: 0 },
  ...Array.from({ length: ASK.length }, (_, i) => ({ at: T0 + (i + 1) * TYPE, typed: i + 1 })),
  { at: SENT, sent: true, thinking: true },
  { at: SENT + 1300, sent: true, reply: 1, mark: true },
  { at: SENT + 3300, sent: true, reply: 2, mark: true }
];
const LOOP = SCRIPT[SCRIPT.length - 1].at + 5200;

const OPTIONS = [
  "To describe how honeybees tell one another where food is",
  "To argue that honeybees prefer flowers close to the hive",
  "To compare the waggle dance with other insect signals",
  "To explain why honeybees fly long distances for food"
];

export default function NovaDemo() {
  const ref = useRef(null);
  const inView = useInView(ref);
  const still = reducedMotion();
  const [run, setRun] = useState({ n: 0, step: still ? SCRIPT.length - 1 : 0 });
  const s = SCRIPT[run.step];

  useEffect(() => {
    if (still || !inView) return undefined;
    const round = run.n;
    const timers = SCRIPT.map((st, i) => setTimeout(() => setRun((r) => (r.n === round ? { n: round, step: i } : r)), st.at));
    timers.push(setTimeout(() => setRun({ n: round + 1, step: 0 }), LOOP));
    return () => timers.forEach(clearTimeout);
  }, [run.n, inView, still]);

  const typed = s.sent ? "" : ASK.slice(0, s.typed ?? ASK.length);

  return (
    <div className="nd" ref={ref} aria-hidden="true">
      <div className="nd-player">
        <div className="nd-sections">
          <span className="on">
            <Icon name="book" size={16} /> Reading &amp; Writing
          </span>
          <span>
            <Icon name="calc" size={16} /> Math
          </span>
        </div>
        <div className="nd-frame">
          <div className="nd-toolbar">
            <span className="nd-dir">
              Directions <Icon name="chevronDown" size={14} />
            </span>
            <span className="nd-timer">
              <b>00:50</b>
              <span>
                <Icon name="pause" size={11} /> Hide
              </span>
            </span>
            <span className="nd-tool">
              <Icon name="highlighter" size={17} /> Highlight
            </span>
          </div>
          <div className="nd-split">
            <div className="nd-passage">
              Honeybees tell their hive where to find flowers with a &ldquo;waggle dance.&rdquo;{" "}
              <mark className={s.mark ? "on" : ""}>The angle of the dance shows the direction of the food relative to the sun, and its length shows how far away the food is.</mark>{" "}
              Bees that watched a dance for longer flew more directly to the flowers it described.
            </div>
            <div className="nd-question">
              <div className="nd-qbar">
                <span className="nd-num">1</span>
                <span>
                  <Icon name="bookmark" size={14} /> Mark for Review
                </span>
              </div>
              <p>Which choice best states the main purpose of the text?</p>
              {OPTIONS.map((o, i) => (
                <div key={o} className={`nd-opt ${i === 3 ? "wrong" : ""}`}>
                  <span>{i === 3 ? <Icon name="cross" size={13} strokeWidth={3} /> : "ABCD"[i]}</span>
                  {o}
                </div>
              ))}
            </div>
          </div>
          <div className="nd-foot">
            <span className="nd-count">
              1 of 57 <Icon name="chevronDown" size={14} />
            </span>
            <span className="nd-askbtn">
              <Nova size={20} sparkles={false} /> Ask Nova
            </span>
          </div>
        </div>
      </div>

      <div className="nd-chat">
        <div className="nd-tabs">
          <span className="on">
            <Nova size={22} sparkles={false} /> Ask Nova
          </span>
          <span>
            <Icon name="steps" size={17} /> Explanation
          </span>
        </div>
        <div className="nd-convo">
          {!s.sent && (
            <div className="nd-hello">
              <Nova size={74} mood="happy" float />
              <b>How can I help?</b>
              <span>Ask Nova anything about this question.</span>
            </div>
          )}
          {s.sent && <div className="nd-msg me">{ASK}</div>}
          {s.thinking && (
            <div className="nd-msg nova typing">
              <i />
              <i />
              <i />
            </div>
          )}
          {s.reply >= 1 && (
            <div className="nd-msg nova">
              Sure! The question asks for the <b>main purpose</b>, so look at what the whole text does, not one detail. I highlighted the sentence that carries it.
            </div>
          )}
          {s.reply >= 2 && (
            <div className="nd-msg nova">
              It explains how the dance shows <b>direction and distance</b>. Which choice is about bees sharing where food is? Pick again and I&rsquo;ll check it.
              <div className="nd-chips">
                <span>Give me a hint</span>
                <span>Why is D wrong?</span>
              </div>
            </div>
          )}
        </div>
        <div className="nd-input">
          <span className={typed ? "" : "ph"}>
            {typed || "Ask Nova a question…"}
            {!s.sent && s.typed > 0 && <i className="nd-caret" />}
          </span>
          <span className="nd-send">
            <Icon name="send" size={16} />
          </span>
        </div>
      </div>
    </div>
  );
}
