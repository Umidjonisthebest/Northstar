import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLeague } from "../api.js";
import Icon from "./Icon.jsx";
import TierBadge from "./Tier.jsx";
import "../leagues.css";

const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;

// The student's league at a glance, on the home pages. Opening a home page is
// also what rolls the leagues over on a Monday (the server does it on request).
export default function LeagueCard({ token }) {
  const [state, setState] = useState({ league: null, failed: false });

  useEffect(() => {
    let alive = true;
    getLeague(token)
      .then((league) => alive && setState({ league, failed: false }))
      .catch(() => alive && setState({ league: null, failed: true }));
    return () => {
      alive = false;
    };
  }, [token]);

  const { league, failed } = state;
  const you = league?.group?.rows.find((r) => r.you);
  return (
    <section>
      <div className="ns-section-head">
        <h2>
          <Icon name="podium" size={22} /> League
        </h2>
        <Link to="/leagues" className="ns-pill-btn">
          Open leagues
        </Link>
      </div>
      {failed ? (
        <div className="ns-empty2">
          <b>Couldn't load your league</b>
          Open the Leagues page to try again.
        </div>
      ) : !league ? (
        <div className="ns-league-card" aria-busy="true">
          <div>
            <span>Loading your league…</span>
          </div>
        </div>
      ) : (
        <Link to="/leagues" className="ns-league-card">
          <TierBadge tier={league.tier.index} size={56} />
          <div>
            <b>{league.tier.name} league</b>
            <span>
              {you
                ? `${ordinal(you.rank)} of ${league.group.size} · ${you.xp} XP this week`
                : "Earn your first XP this week to join a group"}
            </span>
          </div>
          <Icon name="chevronRight" size={18} />
        </Link>
      )}
    </section>
  );
}
