import React from "react";
import "../review.css";

// "What went wrong?": the student's own reason for a miss, one tap. `reasons` is
// practiceMeta().mistakeReasons; tapping the chosen reason again takes it back.
// Used under a missed question in the practice player and on mock-exam mistakes.
export default function ReasonPicker({ reasons, value, onPick, label = "What went wrong?", busy = false }) {
  if (!reasons?.length) return null;
  return (
    <div className="rv-why" role="group" aria-label={label}>
      <span className="rv-why-label">{label}</span>
      <div className="rv-why-chips">
        {reasons.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`rv-chip ${value === r.id ? "on" : ""}`}
            aria-pressed={value === r.id}
            title={r.label}
            disabled={busy}
            onClick={(e) => {
              // After a tap the chip lets go of the keyboard: otherwise the Enter that checks the
              // next answer in the practice player would press this chip again and undo the tag.
              // (A click made from the keyboard keeps its focus.)
              if (e.detail > 0) e.currentTarget.blur();
              onPick(value === r.id ? null : r.id);
            }}
          >
            {r.short}
          </button>
        ))}
      </div>
    </div>
  );
}
