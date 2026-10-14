import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";

export function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const down = (e) => ref.current && !ref.current.contains(e.target) && onOutside();
    const esc = (e) => e.key === "Escape" && onOutside();
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", esc);
    };
  }, [ref, onOutside, active]);
}

// A button with a popover (Directions, the ⋮ menu, notes).
export function Pop({ button, children, align = "left", className = "", up = false, open: controlled, onOpenChange }) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const setOpen = onOpenChange ?? setInner;
  const box = useRef(null);
  useClickOutside(box, () => setOpen(false), open);
  return (
    <div className="pl-pop-anchor" ref={box}>
      {button({ open, toggle: () => setOpen(!open) })}
      {open && (
        <div className={`pl-pop ${align} ${up ? "up" : ""} ${className}`} role="dialog">
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

// Status of a question in this set, for the navigator badges.
export function tileStatus(q, st) {
  if (st?.result === "correct") return st.wrong?.length ? "corrected" : "correct";
  if (st?.wrong?.length) return "incorrect";
  if (q.result === "correct" || q.result === "corrected" || q.result === "incorrect") return q.result;
  return null;
}

const LEGEND = [
  ["correct", "Correct"],
  ["incorrect", "Incorrect"],
  ["review", "For Review"],
  ["corrected", "Correct (incorrect attempts)"]
];

function Badge({ kind }) {
  if (kind === "correct")
    return (
      <span className="pl-badge correct">
        <Icon name="check" size={11} strokeWidth={3.4} />
      </span>
    );
  if (kind === "incorrect")
    return (
      <span className="pl-badge incorrect">
        <Icon name="cross" size={11} strokeWidth={3.4} />
      </span>
    );
  if (kind === "corrected") return <span className="pl-badge corrected" />;
  if (kind === "review")
    return (
      <span className="pl-badge review">
        <Icon name="bookmarkFilled" size={12} />
      </span>
    );
  return null;
}

export function Navigator({ list, store, index, onPick, onClose, title }) {
  const [group, setGroup] = useState(false);
  const box = useRef(null);
  const current = useRef(null);
  useClickOutside(box, onClose);
  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest" });
  }, []);
  const items = list.map((q, i) => ({ q, i, status: tileStatus(q, store[q.id]) }));
  const groups = group
    ? [
        ["Unanswered", items.filter((x) => !x.status)],
        ["Answered", items.filter((x) => x.status)]
      ].filter(([, g]) => g.length)
    : [[null, items]];
  return (
    <div className="pl-nav" ref={box} role="dialog" aria-label="Question navigator">
      <div className="pl-nav-head">
        <b>{title}</b>
        <button className={`pl-nav-group ${group ? "on" : ""}`} aria-pressed={group} onClick={() => setGroup((g) => !g)}>
          <Icon name="steps" size={15} /> Group Answered
        </button>
        <button className="pl-iconbtn" onClick={onClose} aria-label="Close navigator">
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="pl-nav-legend">
        {LEGEND.map(([k, label]) => (
          <span key={k}>
            <Badge kind={k} /> {label}
          </span>
        ))}
        <span className="pl-nav-diff">
          <i className="easy" /> Easy <i className="medium" /> Medium <i className="hard" /> Hard <i className="challenging" /> Challenging
        </span>
      </div>
      <div className="pl-nav-scroll">
        {groups.map(([label, g]) => (
          <div key={label || "all"}>
            {label && <p className="pl-nav-label">{label}</p>}
            <div className="pl-nav-grid">
              {g.map(({ q, i, status }) => (
                <button
                  key={q.id}
                  ref={i === index ? current : null}
                  className={`pl-tile ${q.difficulty.toLowerCase()} ${i === index ? "current" : ""}`}
                  onClick={() => onPick(i)}
                  aria-label={`Question ${i + 1}, ${q.difficulty}${status ? `, ${status}` : ", not answered"}${q.flagged ? ", marked for review" : ""}`}
                  aria-current={i === index ? "true" : undefined}
                >
                  {i + 1}
                  {status && <Badge kind={status} />}
                  {q.flagged && <span className="pl-tile-flag">{<Badge kind="review" />}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// A question's data table (under the passage, or above a Math prompt).
export function DataTable({ table }) {
  return (
    <figure className="pl-table">
      {table.title && <figcaption>{table.title}</figcaption>}
      <table>
        <thead>
          <tr>
            {table.columns.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (c === 0 ? <th key={c}>{cell}</th> : <td key={c}>{cell}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function Modal({ children, onClose, label, className = "" }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return createPortal(
    <div className="pl-modal-back" onMouseDown={onClose}>
      <div className={`pl-modal ${className}`} role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}

const REASONS = [
  ["typo", "Typo or formatting problem"],
  ["wrong_answer", "The answer seems wrong"],
  ["unclear_explanation", "The explanation is unclear"],
  ["confusing", "The question is confusing"],
  ["other", "Something else"]
];

export function ReportModal({ onClose, onSend }) {
  const [reason, setReason] = useState("typo");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} label="Report a problem">
      <div className="pl-modal-head">
        <h3>Report a problem</h3>
        <button className="pl-iconbtn" onClick={onClose} aria-label="Close">
          <Icon name="close" size={18} />
        </button>
      </div>
      <p className="pl-modal-sub">Your teacher sees reports in the practice bank and can fix the question.</p>
      <div className="pl-reasons" role="radiogroup">
        {REASONS.map(([v, label]) => (
          <label key={v} className={`pl-reason ${reason === v ? "on" : ""}`}>
            <input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} />
            {label}
          </label>
        ))}
      </div>
      <textarea className="pl-textarea" rows={3} placeholder="What's wrong? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
      <div className="pl-modal-actions">
        <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={onClose}>
          Cancel
        </button>
        <button
          className="ns-btn ns-btn-primary ns-btn-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSend({ reason, comment });
            } finally {
              setBusy(false);
            }
          }}
        >
          Send report
        </button>
      </div>
    </Modal>
  );
}

// "Ask my class": puts this question in the class chat, with a line about where the student is
// stuck. Only the question's card goes with it (title, skill, level), never its answer.
export function AskClassModal({ className, title, max = 1000, onClose, onSend }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} label={`Ask ${className}`}>
      <div className="pl-modal-head">
        <h3>Ask {className}</h3>
        <button className="pl-iconbtn" onClick={onClose} aria-label="Close">
          <Icon name="close" size={18} />
        </button>
      </div>
      <p className="pl-modal-sub">
        "{title}" goes into your class chat, where classmates can open it and work on it with you. Your teachers can read the class chat too.
      </p>
      <textarea className="pl-textarea" rows={3} autoFocus placeholder="Where are you stuck? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={max} />
      <div className="pl-modal-actions">
        <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={onClose}>
          Cancel
        </button>
        <button
          className="ns-btn ns-btn-primary ns-btn-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSend(note.trim());
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon name="send" size={15} /> Share with my class
        </button>
      </div>
    </Modal>
  );
}

export function NotesBox({ value, onSave }) {
  const [text, setText] = useState(value || "");
  const [state, setState] = useState("saved");
  const timer = useRef(null);
  const latest = useRef(onSave);
  const pending = useRef(null); // typed text still waiting for the 600 ms pause
  useEffect(() => {
    latest.current = onSave;
  });
  // Closing the notes box or moving to the next question within that pause used to throw the
  // last words away. Save what is waiting as the box goes (to the question it belongs to: this
  // box is keyed by question, so `latest` is still that question's save).
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current !== null) {
        const v = pending.current;
        pending.current = null;
        Promise.resolve(latest.current(v)).catch(() => {});
      }
    },
    []
  );
  return (
    <div className="pl-notes">
      <p className="pl-notes-title">
        <Icon name="note" size={16} /> Your notes
        <small>{state === "saving" ? "Saving…" : state === "error" ? "Couldn't save" : "Saved"}</small>
      </p>
      <textarea
        className="pl-textarea"
        rows={5}
        autoFocus
        value={text}
        placeholder="Jot down the trap, a rule, or why you picked your answer…"
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          setState("saving");
          pending.current = v;
          clearTimeout(timer.current);
          timer.current = setTimeout(async () => {
            pending.current = null;
            try {
              await latest.current(v);
              setState("saved");
            } catch {
              setState("error");
            }
          }, 600);
        }}
      />
    </div>
  );
}

export function SessionSummary({ stats, note, from, onBack, onReview, onMore, moreLabel }) {
  const { answered, total, firstTry, correct, seconds, xp } = stats;
  const acc = answered ? Math.round((firstTry / answered) * 100) : 0;
  const mood = !answered ? "thinking" : acc >= 80 ? "cheer" : acc >= 50 ? "happy" : "wink";
  const title = !answered ? "See you soon!" : acc >= 80 ? "Stellar session!" : acc >= 50 ? "Nice work!" : "Good practice. This is how skills grow.";
  return (
    <Modal onClose={onBack} label="Session summary" className="pl-summary">
      <Nova size={96} mood={mood} float />
      <h2>{title}</h2>
      <p className="pl-modal-sub">
        {answered ? `You answered ${answered} of ${total} question${total === 1 ? "" : "s"}.` : "No answers this time. The set is here whenever you're ready."}
      </p>
      <div className="pl-sum-grid">
        <div>
          <b>
            {firstTry}/{answered}
          </b>
          <span>first try</span>
        </div>
        <div>
          <b>{acc}%</b>
          <span>accuracy</span>
        </div>
        <div>
          <b>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </b>
          <span>time</span>
        </div>
        <div>
          <b>+{xp}</b>
          <span>XP</span>
        </div>
      </div>
      {note && (
        <p className="pl-sum-note pl-sum-star">
          <Icon name="northStar" size={16} /> {note}
        </p>
      )}
      {correct < answered && (
        <p className="pl-sum-note">The questions to revisit are saved in your mistakes queue and come back for review tomorrow. Solve them then to clear them for bonus XP.</p>
      )}
      <div className="pl-modal-actions center">
        {correct < answered && onReview && (
          <button className="ns-btn ns-btn-outline" onClick={onReview}>
            Review these questions
          </button>
        )}
        <button className="ns-btn ns-btn-outline" onClick={onBack}>
          {from}
        </button>
        {onMore && (
          <button className="ns-btn ns-btn-primary" onClick={onMore}>
            {moreLabel}
          </button>
        )}
      </div>
    </Modal>
  );
}
