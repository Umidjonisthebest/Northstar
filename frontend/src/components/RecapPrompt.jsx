import React from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import "../recap.css";

// The home pages' pointer to last month's recap, shown until it has been
// opened. `recap` is progress.recap.
export default function RecapPrompt({ recap }) {
  if (!recap?.ready || !recap.unseen) return null;
  return (
    <div className="ns-recap-prompt">
      <span className="ns-recap-prompt-icon">
        <Icon name="calendarStar" size={24} />
      </span>
      <div>
        <b>Your {recap.label} recap is ready</b>
        <p>Questions solved, accuracy, your best streak, stars discovered and more, with a picture to share.</p>
      </div>
      <Link to="/recap" className="ns-btn ns-btn-primary ns-btn-sm">
        See my recap <Icon name="chevronRight" size={15} />
      </Link>
    </div>
  );
}
