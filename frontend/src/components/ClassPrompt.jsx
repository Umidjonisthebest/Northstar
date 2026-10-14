import React, { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import "../classroom.css";

// The home page's line about the student's class: homework that is waiting, or, for a student who
// hasn't joined a class or said they have none, where to enter their class code (it can be
// dismissed, and stays in Settings). `progress` is /api/practice/progress.
const HIDE_KEY = "ns_class_ask_hide";

export default function ClassPrompt({ progress }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (!progress) return null;

  if (progress.classroom) {
    const { homework = 0, overdue = 0 } = progress.class || {};
    if (!homework) return null;
    return (
      <div className="cr-prompt">
        <Icon name="checklist" size={26} />
        <div>
          <b>
            {homework} homework to do for {progress.classroom.name}
          </b>
          <p>{overdue ? `${overdue} of them ${overdue === 1 ? "is" : "are"} past the due date. ` : ""}It finishes itself as you answer its questions.</p>
        </div>
        <Link to="/class?tab=homework" className="ns-btn ns-btn-primary ns-btn-sm">
          Open homework
        </Link>
      </div>
    );
  }

  if (progress.schoolAsked !== false || hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* private mode */
    }
  };
  return (
    <div className="cr-prompt">
      <Icon name="users" size={26} />
      <div>
        <b>Got a class code from your teacher?</b>
        <p>Enter it to join your class: study alongside your classmates, get homework, and chat about hard questions in the class discussion.</p>
      </div>
      <Link to="/class" className="ns-btn ns-btn-primary ns-btn-sm">
        Enter my code
      </Link>
      <button type="button" className="cr-prompt-x" onClick={dismiss} aria-label="Hide this suggestion">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
