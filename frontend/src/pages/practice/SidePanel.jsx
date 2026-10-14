import React from "react";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import NovaChat from "../../components/NovaChat.jsx";
import MathText from "../../components/MathText.jsx";
import BankPicture, { isPictureQuestion } from "./BankPicture.jsx";

const LETTERS = "ABCDEF";

export const TABS = [
  { key: "nova", label: "Ask Nova", icon: "nova" },
  { key: "explanation", label: "Explanation", icon: "steps" },
  { key: "lesson", label: "Masterclass", icon: "masterclass" },
  { key: "info", label: "Info", icon: "info" }
];

function TabIcon({ icon }) {
  return icon === "nova" ? <Nova size={20} sparkles={false} /> : <Icon name={icon} size={17} />;
}

function Stepper({ steps, shown, onMore, onAll }) {
  return (
    <ol className="pl-steps">
      {steps.map((s, i) => {
        const open = i < shown;
        return (
          <li key={i} className={`pl-step ${open ? "open" : "locked"} ${i === shown - 1 ? "current" : ""}`}>
            <span className="pl-step-dot" aria-hidden="true" />
            <p className="pl-step-title">
              Step {i + 1}: {s.title}
            </p>
            {open ? (
              <div className="pl-step-body">
                {s.quote && <p className="pl-quote">"{s.quote}"</p>}
                <MathText as="p" text={s.body} />
              </div>
            ) : (
              i === shown && (
                <div className="pl-step-locked">
                  <span className="pl-ghost-lines" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <div className="pl-step-reveal">
                    <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={onMore}>
                      Reveal step {i + 1}
                    </button>
                    <button className="pl-textbtn" onClick={onAll}>
                      Show all
                    </button>
                  </div>
                </div>
              )
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ExplanationView({ q, st, onReveal, onHint, onTab, onStepMore, onStepAll, onAskWhy, onReport }) {
  const answeredRight = st.result === "correct";
  if (!st.explanation && !st.loadingExplanation && !answeredRight && !q.revealed) {
    return (
      <div className="pl-gate">
        <Nova size={78} mood="thinking" float />
        <h3>Try it first?</h3>
        <p>The explanation shows the correct answer. Opening it before you answer means this question won't count as a clean solve.</p>
        <div className="pl-gate-actions">
          <button className="ns-btn ns-btn-soft" onClick={onHint}>
            <Nova size={20} sparkles={false} /> Get a hint from Nova
          </button>
          <button className="ns-btn ns-btn-primary" onClick={onReveal}>
            Show explanation
          </button>
        </div>
      </div>
    );
  }
  if (!st.explanation) {
    return (
      <div className="ns-loading" style={{ padding: "60px 0" }}>
        <div className="ns-spinner" />
      </div>
    );
  }
  const ex = st.explanation;
  const isGrid = q.type === "grid_in";
  const tab = st.optionTab ?? ex.correctIndex ?? 0;
  const correct = !isGrid && tab === ex.correctIndex;
  const why = !isGrid && ex.rationales?.[tab] ? ex.rationales[tab].replace(/^Correct\.\s*/, "") : null;
  const steps = ex.steps || [];

  return (
    <div className="pl-explain">
      <div className="pl-explain-head">
        <h3>Step-by-step explanation</h3>
        {onReport && (
          <button className="pl-textbtn" onClick={onReport}>
            <Icon name="flag" size={15} /> Report
          </button>
        )}
      </div>

      {!isGrid && (
        <div className="pl-optabs" role="tablist" aria-label="Explanation for each option">
          {q.options.map((_, i) => (
            <button key={i} role="tab" aria-selected={tab === i} className={tab === i ? "on" : ""} onClick={() => onTab(i)}>
              Option {LETTERS[i]}
              {i === ex.correctIndex && <i className="pl-optab-dot good" aria-label="correct" />}
              {st.wrong.includes(i) && <i className="pl-optab-dot bad" aria-label="your wrong answer" />}
            </button>
          ))}
        </div>
      )}

      <div className="pl-anscard">
        <p className="pl-anscard-label">{isGrid || correct ? "Correct Answer" : "Incorrect Answer"}</p>
        <div className={`pl-ansbox ${isGrid || correct ? "good" : "bad"}`}>
          <span className="pl-ansletter">{isGrid ? <Icon name="check" size={16} strokeWidth={3} /> : LETTERS[tab]}</span>
          {isGrid ? <MathText text={String(ex.correctAnswer ?? "").replace(/^-/, "−")} /> : isPictureQuestion(q) ? <span>Choice {LETTERS[tab]}</span> : <MathText text={q.options[tab]} />}
        </div>
        {why && (
          <p className="pl-why">
            <b>{correct ? "Why it's right: " : "Why it's wrong: "}</b>
            <MathText text={why} />
          </p>
        )}
        {!correct && !isGrid && (
          <button className="pl-textbtn" onClick={() => onAskWhy(tab)}>
            <Nova size={18} sparkles={false} /> Still not sure? Ask Nova about {LETTERS[tab]}
          </button>
        )}
      </div>

      {/* Questions without written steps: the worked explanation as it came, text or picture. */}
      {(isGrid || correct) && steps.length === 0 && !why && ex.explanation && <MathText as="p" className="pl-explain-text" text={ex.explanation} />}
      {(isGrid || correct) && ex.explanationImage && <BankPicture image={ex.explanationImage} alt="The worked explanation, shown as a picture" className="pl-pic-explain" />}
      {(isGrid || correct) && steps.length > 0 && <Stepper steps={steps} shown={st.stepsShown || 1} onMore={onStepMore} onAll={onStepAll} />}
      {(isGrid || correct) && steps.length > 0 && (st.stepsShown || 1) >= steps.length && ex.explanation && (
        <div className="pl-summary-box">
          <Icon name="sparkles" size={18} />
          <MathText as="p" text={ex.explanation} />
        </div>
      )}
      {!isGrid && !correct && (
        <button className="ns-btn ns-btn-soft ns-btn-sm" style={{ marginTop: 16 }} onClick={() => onTab(ex.correctIndex)}>
          See the correct answer, step by step
        </button>
      )}
    </div>
  );
}

function LessonView({ q, lesson, onApply }) {
  if (!lesson) {
    return (
      <div className="pl-gate">
        <Nova size={70} />
        <h3>{q.topic}</h3>
        <p>There's no lesson for this skill yet, but Nova can still walk you through the question.</p>
        <button className="ns-btn ns-btn-primary" onClick={onApply}>
          Walk me through it
        </button>
      </div>
    );
  }
  return (
    <div className="pl-lesson">
      <p className="pl-lesson-kicker">
        <Icon name="masterclass" size={16} /> Masterclass · {q.domain}
      </p>
      <h3>{q.topic}</h3>
      <MathText as="p" className="pl-lesson-what" text={lesson.what} />
      <h4>How to approach it</h4>
      <ol className="pl-lesson-steps">
        {lesson.steps.map((s, i) => (
          <li key={i}>
            <span>{i + 1}</span>
            <MathText as="p" text={s} />
          </li>
        ))}
      </ol>
      <h4>Common traps</h4>
      <ul className="pl-lesson-traps">
        {lesson.traps.map((t, i) => (
          <li key={i}>
            <Icon name="warning" size={16} /> <MathText text={t} />
          </li>
        ))}
      </ul>
      <div className="pl-lesson-tip">
        <Nova size={44} mood="wink" sparkles={false} />
        <p>
          <b>Remember:</b> <MathText text={lesson.tip} />
        </p>
      </div>
      <button className="ns-btn ns-btn-primary" style={{ width: "100%" }} onClick={onApply}>
        Apply this strategy to the question with Nova
      </button>
    </div>
  );
}

const SHORTCUTS = [
  ["A – D", "Choose an answer"],
  ["Enter", "Check your answer"],
  ["← / →", "Previous / next question"],
  ["X", "Toggle cross-out"],
  ["H", "Toggle highlighter"],
  ["M", "Mark for review"],
  ["N", "Ask Nova"],
  ["E", "Explanation"],
  ["G", "Graphing calculator (Math questions)"],
  ["Esc", "Close panels"]
];

function InfoView({ q, st, meta, seconds }) {
  const rows = [
    ["Section", q.section],
    ["Domain", q.domain],
    ["Skill", q.topic],
    ["Difficulty", <span key="d" className={`ns-tag2 ${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>],
    ["Answer format", q.type === "grid_in" ? "Student-produced response" : "Multiple choice"],
    ["Your attempts", `${q.attempts || 0} graded${q.lastAt ? ` · last ${new Date(q.lastAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}`],
    ["Time on it now", `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`],
    ["Question ID", <code key="id">{q.id}</code>]
  ];
  return (
    <div className="pl-info">
      <dl className="pl-info-grid">
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      {st.result === "correct" && st.wrong.length > 0 && <p className="pl-info-note">You got this one after {st.wrong.length} incorrect {st.wrong.length === 1 ? "try" : "tries"} this session.</p>}
      {q.section === "Math" && meta?.mathReference && (
        <>
          <h4>Reference sheet</h4>
          <table className="pl-ref">
            <tbody>
              {meta.mathReference.map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <MathText as="td" text={v} />
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h4>Keyboard shortcuts</h4>
      <table className="pl-ref">
        <tbody>
          {SHORTCUTS.map(([k, v]) => (
            <tr key={k}>
              <th>
                <kbd>{k}</kbd>
              </th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SidePanel(props) {
  const { tab, setTab, onClose, pinned, setPinned, q, st, meta, token, chatProps, seconds } = props;
  return (
    <aside className={`pl-panel ${pinned ? "pinned" : "floating"}`} aria-label="Help panel">
      <div className="pl-panel-top">
        <button className="pl-textbtn" onClick={() => setPinned(!pinned)} title={pinned ? "Float the panel over the question" : "Dock the panel beside the question"}>
          <Icon name="panel" size={17} /> {pinned ? "Unpin" : "Pin"}
        </button>
        <button className="pl-iconbtn" onClick={onClose} aria-label="Close panel">
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className="pl-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
            <TabIcon icon={t.icon} /> <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className={`pl-panel-body ${tab === "nova" ? "chat" : ""}`}>
        {tab === "nova" && <NovaChat token={token} {...chatProps} />}
        {tab === "explanation" && (
          <ExplanationView
            q={q}
            st={st}
            onReveal={props.onReveal}
            onHint={props.onHint}
            onTab={props.onOptionTab}
            onStepMore={props.onStepMore}
            onStepAll={props.onStepAll}
            onAskWhy={props.onAskWhy}
            onReport={props.onReport}
          />
        )}
        {tab === "lesson" && <LessonView q={q} lesson={meta?.lessons?.[q.topic]} onApply={props.onApplyLesson} />}
        {tab === "info" && <InfoView q={q} st={st} meta={meta} seconds={seconds} />}
      </div>
    </aside>
  );
}
