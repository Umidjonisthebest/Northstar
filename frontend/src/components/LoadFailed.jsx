import React from "react";

// What a student-hub page shows when its data failed to load. A failure used to look like an empty
// list ("No mock exams yet"), which is wrong and gives no way to try again.
export default function LoadFailed({ title = "Couldn't load this page", message, onRetry }) {
  return (
    <div className="ns-empty2" role="alert" style={{ padding: 40 }}>
      <b>{title}</b>
      {message}
      <div style={{ marginTop: 12 }}>
        <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={onRetry || (() => window.location.reload())}>
          Try again
        </button>
      </div>
    </div>
  );
}
