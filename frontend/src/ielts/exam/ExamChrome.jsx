import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Contrast, Eraser, Highlighter, Menu, Quote, Search, SquarePen, Volume1, VolumeX, X } from "lucide-react";
import { Button } from "../components/ui.jsx";
import { clock } from "../lib/format.js";
import { usePortalRoot } from "../scope.js";

// `label` replaces the test-taker line (practice mode); `timerLabel` names what
// the clock shows (time remaining, or time spent in untimed practice).
export function ExamHeader({ candidateId, remaining, preview, previewExtra, showNotes, onMenu, onNotes, warn, label, timerLabel = "Time remaining", showTimer = !preview }) {
  return (
    <header className="ie-exam-header">
      <span className="ie-logo">IELTS</span>
      <span className="ie-exam-taker">{label ?? (preview ? "Admin preview" : `Test taker ID: ${candidateId}`)}</span>
      <div className="ie-exam-header__right">
        {previewExtra}
        {showTimer && (
          <div className={`ie-exam-timer ${warn ? "ie-exam-timer--warn" : ""}`} role="timer" aria-label={timerLabel} title={timerLabel}>
            {clock(remaining)}
          </div>
        )}
        <button type="button" className="ie-exam-icon" onClick={onMenu} aria-label="Options">
          <Menu />
        </button>
        {showNotes && (
          <button type="button" className="ie-exam-icon" onClick={onNotes} aria-label="Notes">
            <SquarePen />
          </button>
        )}
      </div>
    </header>
  );
}

// `markOf(slot)` (review mode) returns true / false once answers are marked.
export function FooterNav({ parts, currentPart, currentSlot, answeredOf, markOf, flags, onPart, onSlot, onSubmit, label = "Part", hideSubmit }) {
  return (
    <footer className="ie-exam-footer">
      <nav className="ie-foot-parts" aria-label="Questions">
        {parts.map((p, i) => {
          const active = i === currentPart;
          const answered = p.slots.filter(answeredOf).length;
          const right = markOf ? p.slots.filter((s) => markOf(s) === true).length : 0;
          return (
            <div key={p.key} className={`ie-foot-part ${active ? "ie-foot-part--active" : ""}`} onClick={() => onPart(i)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onPart(i)}>
              <span className="ie-foot-part__label">
                {label} {p.partNumber}
              </span>
              {active ? (
                <div className="ie-foot-qs">
                  {p.slots.map((s) => {
                    const mark = markOf?.(s);
                    const state = mark === true ? "ie-qbtn--right" : mark === false ? "ie-qbtn--wrong" : answeredOf(s) ? "ie-qbtn--answered" : "";
                    const said = mark === true ? ", correct" : mark === false ? ", wrong" : answeredOf(s) ? ", answered" : "";
                    return (
                      <button
                        type="button"
                        key={s.id}
                        className={`ie-qbtn ${state} ${flags.has(s.id) ? "ie-qbtn--flagged" : ""} ${currentSlot === s.id ? "ie-qbtn--current" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSlot(s);
                        }}
                        aria-label={`Question ${s.n}${said}${flags.has(s.id) ? ", flagged" : ""}`}
                      >
                        {s.n}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="ie-foot-part__count">{markOf ? `${right} of ${p.slots.length} correct` : `${answered} of ${p.slots.length}`}</span>
              )}
            </div>
          );
        })}
      </nav>
      {!hideSubmit && (
        <button type="button" className="ie-foot-submit" onClick={onSubmit} aria-label="Submit this section" title="Submit this section">
          <Check />
        </button>
      )}
    </footer>
  );
}

export function VolumeWidget({ volume, onChange }) {
  const [before, setBefore] = useState(0.8);
  const pct = Math.round(volume * 100);
  return (
    <div className="ie-volume">
      <button
        type="button"
        className="ie-volume__icon"
        aria-label={volume > 0 ? "Mute" : "Unmute"}
        onClick={() => {
          if (volume > 0) {
            setBefore(volume);
            onChange(0);
          } else onChange(before || 0.8);
        }}
      >
        {volume > 0 ? <Volume1 /> : <VolumeX />}
      </button>
      <input type="range" min={0} max={100} value={pct} onChange={(e) => onChange(Number(e.target.value) / 100)} aria-label="Volume" />
      <span className="ie-volume__pct">{pct}%</span>
    </div>
  );
}

export function NavArrows({ onPrev, onNext, prevDisabled, nextDisabled }) {
  return (
    <>
      <button type="button" className="ie-nav-arrow ie-nav-arrow--prev" onClick={onPrev} disabled={prevDisabled} aria-label="Previous question">
        <ArrowLeft />
      </button>
      <button type="button" className="ie-nav-arrow" onClick={onNext} disabled={nextDisabled} aria-label="Next question">
        <ArrowRight />
      </button>
    </>
  );
}

const CONTRASTS = [
  { value: "bow", label: "Black on white" },
  { value: "wob", label: "White on black" },
  { value: "yob", label: "Yellow on black" }
];
const SIZES = [
  { value: "regular", label: "Regular" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" }
];

export function OptionsModal({ prefs, onChange, onClose }) {
  const portal = usePortalRoot();
  const [view, setView] = useState("menu");
  const list = view === "contrast" ? CONTRASTS : SIZES;
  const key = view === "contrast" ? "contrast" : "textSize";
  return createPortal(
    <div className="ie-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ie-options" role="dialog" aria-modal="true" aria-label="Options">
        {view !== "menu" && (
          <button type="button" className="ie-options__back" onClick={() => setView("menu")}>
            <ArrowLeft size={16} /> Options
          </button>
        )}
        <div className="ie-options__head">
          <h2>{view === "menu" ? "Options" : view === "contrast" ? "Contrast" : "Text size"}</h2>
          <button type="button" className="ie-options__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="ie-options__list">
          {view === "menu" ? (
            <>
              <button type="button" className="ie-options__row" onClick={() => setView("contrast")}>
                <Contrast />
                Contrast
                <ArrowRight className="ie-options__arrow" />
              </button>
              <button type="button" className="ie-options__row" onClick={() => setView("size")}>
                <Search />
                Text size
                <ArrowRight className="ie-options__arrow" />
              </button>
            </>
          ) : (
            list.map((o) => (
              <button type="button" key={o.value} className="ie-options__row" onClick={() => onChange({ ...prefs, [key]: o.value })}>
                {o.label}
                {prefs[key] === o.value && <Check className="ie-options__arrow" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    portal
  );
}

export function NotesPanel({ notes, onChange, onDelete, onClose, focusId }) {
  return (
    <aside className="ie-notes" aria-label="Notes">
      <div className="ie-notes__head">
        Notes
        <button type="button" className="ie-exam-icon" style={{ width: 32, height: 32 }} onClick={onClose} aria-label="Close notes">
          <X size={18} />
        </button>
      </div>
      <div className="ie-notes__list">
        {notes.length === 0 && <p className="ie-notes__empty">Select some text in the questions or passage and choose “Note” to add a note here.</p>}
        {notes.map((n) => (
          <div className="ie-note" key={n.id}>
            <blockquote>“{n.text.length > 120 ? `${n.text.slice(0, 120)}…` : n.text}”</blockquote>
            <textarea autoFocus={n.id === focusId} placeholder="Start typing your note..." value={n.body} onChange={(e) => onChange(n.id, e.target.value)} />
            <button type="button" className="ie-note__delete" onClick={() => onDelete(n.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function SelectionToolbar({ toolbar, onNote, onHighlight, onClear }) {
  const portal = usePortalRoot();
  if (!toolbar) return null;
  const above = toolbar.top > 90;
  const style = { left: Math.max(8, Math.min(window.innerWidth - 260, toolbar.x - 110)), top: above ? toolbar.top - 48 : toolbar.bottom + 8 };
  return createPortal(
    <div className="ie-sel-toolbar" style={style} onMouseDown={(e) => e.preventDefault()}>
      <button type="button" onClick={onNote}>
        <Quote /> Note
      </button>
      <button type="button" onClick={onHighlight}>
        <Highlighter /> Highlight
      </button>
      {toolbar.canClear && (
        <button type="button" onClick={onClear}>
          <Eraser /> Clear
        </button>
      )}
    </div>,
    portal
  );
}

export function SubmitConfirm({ title, message, unanswered, busy, onCancel, onConfirm, confirmLabel = "Submit answers" }) {
  const portal = usePortalRoot();
  return createPortal(
    <div className="ie-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="ie-modal ie-submit-modal" role="alertdialog" aria-modal="true">
        <button type="button" className="ie-modal__close" style={{ position: "absolute", right: 14, top: 14 }} onClick={onCancel} disabled={busy} aria-label="Close">
          <X />
        </button>
        <div className="ie-submit-modal__body">
          <h3>{title}</h3>
          <p>{message}</p>
          {unanswered > 0 && (
            <p className="ie-submit-modal__warn">
              {unanswered} question{unanswered === 1 ? " has" : "s have"} not been answered.
            </p>
          )}
          <div className="ie-submit-modal__actions">
            <Button variant="soft" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={onConfirm} loading={busy}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    portal
  );
}
