import React from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import { playerUrl } from "../pages/hub/hubUtils.js";
import "../review.css";

// The home page's pointer to today's spaced review. `review` is progress.review; it shows only
// when a missed question's review day has come.
export default function ReviewPrompt({ review }) {
  if (!review?.due) return null;
  const n = review.due;
  return (
    <div className="rv-prompt">
      <span className="rv-prompt-icon">
        <Icon name="history" size={24} />
      </span>
      <div>
        <b>
          {n} question{n === 1 ? " is" : "s are"} due for review today
        </b>
        <p>You missed {n === 1 ? "it" : "them"} before. Getting {n === 1 ? "it" : "them"} right again, days later, is what makes the fix stick.</p>
      </div>
      <Link to={playerUrl({ source: "review", from: "/dashboard" })} className="ns-btn ns-btn-sm ns-btn-outline">
        Start review <Icon name="chevronRight" size={15} />
      </Link>
    </div>
  );
}
