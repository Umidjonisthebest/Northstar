import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ieltsEnterSession } from "../../api.js";
import { startCandidateSession } from "../../ielts/api.js";
import { useToast } from "../../components/Toast.jsx";

export const IELTS_SKILLS = [
  ["listening", "Listening", "headphones"],
  ["reading", "Reading", "book"],
  ["writing", "Writing", "pencil"],
  ["speaking", "Speaking", "megaphone"]
];
const LABEL = { not_started: "Not started", in_progress: "In progress", completed: "Completed" };
const SECTION_STATE = { pending: "not_started", in_progress: "in_progress", submitted: "completed" };

export const band = (b) => (b == null ? "—" : Number(b).toFixed(1));

// The teacher's mock tests are a tab of the IELTS Practice Tests page (IeltsPracticeTests.jsx).
export const IELTS_MOCKS_URL = "/ielts-prep/practice-tests?tab=teacher";

export function sessionWhen(s) {
  return s.date ? new Date(`${s.date}T${s.time || "00:00"}`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "";
}

// Opens a live IELTS session: the test itself runs full-screen under /ielts
// and returns to `returnTo` when the candidate finishes.
export function useEnterIelts(token, returnTo = IELTS_MOCKS_URL) {
  const nav = useNavigate();
  const { toast } = useToast();
  const [entering, setEntering] = useState(null);
  const enter = async (s) => {
    setEntering(s.id);
    try {
      startCandidateSession(await ieltsEnterSession(token, s.id), returnTo);
      nav("/ielts/exam");
    } catch (err) {
      toast.error(err.message);
      setEntering(null);
    }
  };
  return { enter, entering };
}

export function IeltsSessionCard({ s, entering, onEnter }) {
  const skillState = (key) => (key === "speaking" ? (s.results?.speaking != null ? "completed" : "not_started") : SECTION_STATE[s.sections[key]]);
  const skillText = (key) => {
    if (s.results) return s.results[key] == null ? "No band yet" : `Band ${band(s.results[key])}`;
    if (key === "speaking") return "Face to face with your teacher";
    return LABEL[skillState(key)];
  };
  return (
    <div className="ns-card ns-session">
      <div className="ns-split">
        <div>
          <span className="ns-pill">IELTS</span>
          <h3 style={{ marginTop: 8 }}>{s.name}</h3>
          <p className="ns-muted ns-small">
            {sessionWhen(s)}
            {s.time ? ` · ${s.time}` : ""}
          </p>
        </div>
        {s.results?.overall != null && (
          <div className="ns-ring" style={{ "--p": (s.results.overall / 9) * 100 }} title="Overall band">
            <span>{band(s.results.overall)}</span>
          </div>
        )}
      </div>
      <div className="ns-module-row">
        {IELTS_SKILLS.map(([key, name]) => (
          <div key={key} className={`ns-module ${skillState(key)}`}>
            <b>{name}</b>
            <span>{skillText(key)}</span>
          </div>
        ))}
      </div>
      <div className="ns-session-actions">
        {s.canEnter && (
          <button className="btn btn-primary btn-sm" disabled={entering} onClick={() => onEnter(s)}>
            {entering ? "Opening…" : s.state === "in_progress" ? `Continue ${s.currentSection}` : "Start IELTS test"} {!entering && "→"}
          </button>
        )}
        {/* The test is locked: leaving its page while a section ran cancelled it (lock/useExamLock.js). */}
        {s.cancelled && <span className="badge badge-hard">Cancelled: you {s.cancelled.reason}. Your teacher can let you back in.</span>}
        {s.status === "created" && <span className="badge badge-muted">Waiting for your teacher to start</span>}
        {s.status === "started" && s.state === "finished" && <span className="badge badge-muted">Finished — bands appear when your teacher closes the session</span>}
        {s.status === "completed" && !s.results && <span className="badge badge-muted">Not taken</span>}
      </div>
    </div>
  );
}
