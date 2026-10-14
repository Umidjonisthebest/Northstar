import React from "react";
import { useProgress } from "../../context/ProgressContext.jsx";
import { Loading } from "./Home.jsx";
import { Medal } from "../../components/Icon.jsx";
import { useTrophyCard } from "../../components/TrophyCard.jsx";

export default function Trophies() {
  const { progress } = useProgress();
  const trophy = useTrophyCard(progress?.badges);
  if (!progress) return <Loading />;
  const earned = progress.badges.filter((b) => b.earned).length;

  return (
    <div className="ns-page">
      <div className="ns-page-head">
        <div>
          <span className="ns-pill">TROPHY CASE</span>
          <h1>
            {earned} of {progress.badges.length} badges
          </h1>
          <p className="ns-sub">
            Level {progress.level} · {progress.xp} XP total · longest streak {progress.streak.longest} days · best combo {progress.bestCombo}
            {earned > 0 && (
              <>
                <br />
                Open a trophy you have earned to see its card.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="ns-card">
        <h3>How to earn XP</h3>
        <div className="ns-xp-rules">
          {(progress.xpGuide || []).map((g) => (
            <div key={g.label}>
              <b>{g.xp}</b>
              <span>{g.label}</span>
            </div>
          ))}
        </div>
        <p className="ns-muted ns-small" style={{ margin: "12px 0 0" }}>
          Harder questions are worth more. Each question pays its full XP once, so new questions earn the most.
        </p>
      </div>

      <div className="ns-badge-grid">
        {progress.badges.map((b) => {
          // An earned trophy is a button that opens its card; a locked one only says how to earn it.
          const face = (
            <>
              <span className="ns-badge-icon">
                <Medal id={b.id} earned={b.earned} size={76} />
              </span>
              <b>{b.name}</b>
              <span className="ns-badge-desc">{b.desc}</span>
              {b.earned && <small>Earned {new Date(b.earnedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>}
            </>
          );
          return b.earned ? (
            <button key={b.id} type="button" className="ns-badge earned" aria-haspopup="dialog" onClick={() => trophy.open(b.id)}>
              {face}
            </button>
          ) : (
            <div key={b.id} className="ns-badge">
              {face}
            </div>
          );
        })}
      </div>
      {trophy.card}
    </div>
  );
}
