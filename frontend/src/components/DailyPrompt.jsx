import React from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import "../daily.css";

// The home page's pointer to the daily Northstar question. `daily` is
// progress.daily: whether today's one attempt has been used, and how it went.
export default function DailyPrompt({ daily }) {
  if (!daily) return null;
  const stars = `${daily.total} star${daily.total === 1 ? "" : "s"} in your catalog`;
  const copy = !daily.attempted
    ? ["Today's star is waiting to be discovered", "One question, one try, the same for every student. Solve it to add the star to your catalog.", "Answer today's question"]
    : daily.discovered
      ? [`You discovered ${daily.designation} today`, `${stars}. A new star rises tomorrow.`, "See today's star"]
      : [`${daily.designation} stays hidden for now`, `A new star rises tomorrow. ${stars}.`, "Review the question"];
  return (
    <div className={`ns-daily-prompt ${daily.attempted ? "done" : ""}`}>
      <span className="ns-daily-prompt-icon">
        <Icon name="northStar" size={26} />
      </span>
      <div>
        <b>{copy[0]}</b>
        <p>{copy[1]}</p>
      </div>
      <Link to="/daily" className={`ns-btn ns-btn-sm ${daily.attempted ? "ns-btn-outline" : "ns-btn-primary"}`}>
        {copy[2]} <Icon name="chevronRight" size={15} />
      </Link>
    </div>
  );
}
