import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "../components/Icon.jsx";
import { exitFullscreen, fullscreenSupported } from "./useExamLock.js";
import "./lock.css";

// The three screens of the test lock (see useExamLock.js), shared by the SAT mock test, both
// diagnostic tests, the IELTS mock test and homework:
//   <LockNotice>  the warning, shown before every one of them starts
//   <LockGate>    covers a running test that has dropped out of full screen
//   <LockEnded>   the test was cancelled because the student left it
// They sit over whatever screen uses them (portalled to <body>, above everything) and are styled
// with index.css tokens only, so they look the same on the exam screens, the hub and IELTS.

// The same words the server uses (backend/examLock.js, LEAVE_TEXT).
const LEAVE_TEXT = {
  hidden: "switched to another tab or app",
  blur: "switched to another window",
  closed: "closed or reloaded the test page",
  exit: "left the test"
};

// What the student is told before they start. `kind`: "mock" (a teacher can let them back in),
// "diagnostic" or "practice" (nobody can; they start a new one) or "homework" (nothing is closed).
function rulesFor(kind) {
  if (kind === "homework") {
    return [
      ["eye", "Your teacher is told each time you leave this page while you do your homework: another tab, another window or another app."],
      ["clock", "They see how many times you left and for how long, next to your result."],
      ["check", "Nothing is closed. You can carry on, and stop and come back another day."]
    ];
  }
  return [
    ...(fullscreenSupported() ? [["expand", "The test opens in full screen. Stay in it until you hand the test in."]] : []),
    ["lock", "Don't switch to another tab, window or app, and don't minimise, close or reload this page."],
    [
      "warning",
      kind === "mock"
        ? "If you do, the test ends at once and is cancelled for cheating. There is no warning first, and your teacher sees what happened."
        : "If you do, the test ends at once and is cancelled, with no score. There is no warning first."
    ],
    ["close", "Copying, pasting from outside the test, right-click and printing are switched off."],
    ["info", "Before you start: close your chats and other apps so nothing opens over the test, and plug in your charger."]
  ];
}

export function LockRules({ kind }) {
  return (
    <ul className="lk-rules">
      {rulesFor(kind).map(([icon, text]) => (
        <li key={text} className={icon === "warning" ? "lk-rule-strong" : ""}>
          <span className="lk-rule-icon">
            <Icon name={icon} size={17} />
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

function Screen({ label, tone, children, onEscape }) {
  const card = useRef(null);
  useEffect(() => {
    card.current?.focus({ preventScroll: true });
  }, []);
  return createPortal(
    <div className={`lk-screen lk-${tone}`}>
      <div
        className="lk-card"
        role="alertdialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={card}
        onKeyDown={(e) => {
          if (e.key === "Escape" && onEscape) onEscape();
          // The screen underneath has its own keys (answer choices, next question): not from here.
          e.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

// Shown before a test (or a homework) starts. Starting is a click, which is also what lets the
// browser go to full screen: the caller does that in `onStart`.
export function LockNotice({ kind = "mock", title, lead, startLabel = "I understand. Start", cancelLabel = "Not now", busy = false, onStart, onCancel }) {
  const homework = kind === "homework";
  return (
    <Screen label={title} tone="notice" onEscape={busy ? undefined : onCancel}>
      <span className={`lk-badge ${homework ? "lk-badge-soft" : ""}`}>
        <Icon name={homework ? "eye" : "lock"} size={26} />
      </span>
      <h2 className="lk-title">{title}</h2>
      {lead && <p className="lk-lead">{lead}</p>}
      <LockRules kind={kind} />
      <div className="lk-actions">
        {onCancel && (
          <button type="button" className="lk-btn lk-btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
        )}
        <button type="button" className="lk-btn lk-btn-primary" onClick={onStart} disabled={busy}>
          {busy ? "Starting…" : startLabel}
        </button>
      </div>
    </Screen>
  );
}

// Over a running test that isn't in full screen (Escape was pressed, or the page was opened
// again after a crash). The clock keeps running; nothing of the test shows until they are back.
export function LockGate({ onEnter }) {
  return (
    <Screen label="Go back to full screen" tone="gate">
      <span className="lk-badge">
        <Icon name="expand" size={26} />
      </span>
      <h2 className="lk-title">Go back to full screen</h2>
      <p className="lk-lead">This test runs in full screen, and its clock is still running. Don't switch to another tab, window or app: the test would be cancelled.</p>
      <div className="lk-actions">
        <button type="button" className="lk-btn lk-btn-primary" onClick={onEnter}>
          <Icon name="expand" size={17} /> Return to the test
        </button>
      </div>
    </Screen>
  );
}

// The test is over: the student left it. `ended` is { kind, sent } from useLeaveReport;
// `kind` here says what happens next ("mock": ask the teacher; "diagnostic": start a new one;
// "practice": start the practice test again).
const AFTER = {
  mock: "Your teacher can see what happened. If it was a mistake, like a power cut or a wrong click, ask them: they can let you back in with the time you had left.",
  diagnostic: "You can start a new diagnostic with new questions whenever you're ready to stay on the test from start to finish.",
  practice: "You can start it again whenever you're ready to stay on the test page from start to finish."
};

export function LockEnded({ ended, kind = "mock", backLabel = "Back", onBack }) {
  useEffect(() => {
    exitFullscreen();
  }, []);
  // No kind: the server said so (the leave was seen on another device, or before a reload).
  const reason = LEAVE_TEXT[ended?.kind] || "left the test page";
  return (
    <Screen label="Test cancelled" tone="ended">
      <span className="lk-badge lk-badge-danger">
        <Icon name="warning" size={26} />
      </span>
      <h2 className="lk-title">This test was cancelled</h2>
      <p className="lk-lead">
        You {reason} while the test was running, so it ended and was cancelled. Nothing was scored.
      </p>
      <p className="lk-note">{AFTER[kind] || AFTER.diagnostic}</p>
      <div className="lk-actions">
        <span className="lk-sent" role="status">
          {ended?.sent ? "" : "Saving this…"}
        </span>
        <button type="button" className="lk-btn lk-btn-primary" onClick={onBack}>
          {backLabel}
        </button>
      </div>
    </Screen>
  );
}
