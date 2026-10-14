import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getProgress } from "../api.js";
import { useStudentAuth } from "./AuthContext.jsx";
import Confetti from "../components/Confetti.jsx";
import Icon, { Medal } from "../components/Icon.jsx";

// Holds the student's XP / streak / badge state for the whole app and plays
// the reward animations (XP pop, badge unlock, level-up) after any action.
const ProgressCtx = createContext(null);

// Exam screens are game-free: no XP pops, level-up cards, badge banners or
// confetti. Anything still queued waits until the student leaves the exam.
const isExamPath = (pathname) => /^\/(exam|ielts\/exam)(\/|$)/.test(pathname);

export function ProgressProvider({ children }) {
  const { token, user } = useStudentAuth();
  const examMode = isExamPath(useLocation().pathname);
  const examRef = useRef(examMode);
  useEffect(() => {
    examRef.current = examMode;
  }, [examMode]);
  const [progress, setProgress] = useState(null);
  const [pops, setPops] = useState([]); // floating "+10 XP"
  const [queue, setQueue] = useState([]); // badge / level-up cards
  const [confetti, setConfetti] = useState(0);
  const popId = useRef(0);

  // This provider outlives sign-ins (it sits above the routes). When the student changes, or
  // signs out, nothing of the previous one may carry over: their XP, or reward cards still waiting
  // to be shown to them, would otherwise greet the next person on a shared computer.
  const [owner, setOwner] = useState(token);
  if (owner !== token) {
    setOwner(token);
    setProgress(null);
    setQueue([]);
    setPops([]);
  }
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const waiting = user?.mustChangePassword === true; // a temporary password opens nothing until it is replaced
  const refresh = useCallback(async () => {
    if (!token || waiting) return setProgress(null);
    try {
      const next = await getProgress(token);
      // A slow reply for the previous student must not overwrite the current one's.
      if (tokenRef.current === token) setProgress(next);
    } catch {
      /* keep last good state */
    }
  }, [token, waiting]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const celebrate = useCallback(
    (reward) => {
      if (!reward) return;
      const quiet = examRef.current;
      // XP and comet chunks are two counts, so each gets its own pop.
      const pop = (text, kind) => {
        const id = ++popId.current;
        setPops((p) => [...p, { id, text, kind }]);
        setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), kind === "chunks" ? 2200 : 1400);
      };
      if (reward.xpGained > 0 && !quiet) pop(`+${reward.xpGained} XP`, "xp");
      if (reward.chunksGained > 0 && !quiet) pop(`+${reward.chunksGained} comet chunk${reward.chunksGained === 1 ? "" : "s"}`, "chunks");
      const cards = [];
      if (reward.leveledUp) cards.push({ kind: "level", level: reward.level });
      for (const b of reward.newBadges || []) cards.push({ kind: "badge", ...b });
      if (reward.goalReached) cards.push({ kind: "goal" });
      if (cards.length) {
        setQueue((q) => [...q, ...cards]);
        if (!quiet) setConfetti((c) => c + 1);
      }
      refresh();
    },
    [refresh]
  );

  const current = examMode ? null : queue[0];

  return (
    <ProgressCtx.Provider value={{ progress, refresh, celebrate, burst: () => !examRef.current && setConfetti((c) => c + 1) }}>
      {children}
      {!examMode && (
        <div className="xp-pops" aria-live="polite">
          {pops.map((p) => (
            <div key={p.id} className={`xp-pop ${p.kind === "chunks" ? "chunks" : ""}`}>
              {p.kind === "chunks" && <Icon name="comet" size={16} />}
              {p.text}
            </div>
          ))}
        </div>
      )}
      <Confetti trigger={confetti} hidden={examMode} />
      {current?.kind === "level" && (
        <div className="reward-backdrop" onClick={() => setQueue((q) => q.slice(1))}>
          <div className="reward-card" onClick={(e) => e.stopPropagation()}>
            <div className="reward-emoji rocket">
              <Icon name="rocket" size={46} strokeWidth={1.7} />
            </div>
            <p className="reward-kicker">Level up!</p>
            <h2>You reached level {current.level}</h2>
            <p>Every question moves you closer to your target score.</p>
            <button className="btn btn-primary" onClick={() => setQueue((q) => q.slice(1))}>
              Keep going →
            </button>
          </div>
        </div>
      )}
      {current && current.kind !== "level" && (
        <UnlockBanner key={current.id || current.kind + queue.length} item={current} onDone={() => setQueue((q) => q.slice(1))} />
      )}
    </ProgressCtx.Provider>
  );
}

// Non-blocking banner for badges / daily goal so drills aren't interrupted.
function UnlockBanner({ item, onDone }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), 3200);
    return () => clearTimeout(t);
  }, []);
  const badge = item.kind === "badge";
  return (
    <div className="unlock-banner" role="status" onClick={onDone}>
      <span className="unlock-emoji">
        {badge ? <Medal id={item.id} size={52} /> : <Icon name="target" size={30} />}
      </span>
      <div>
        <small>{badge ? "Badge unlocked" : "Daily goal complete"}</small>
        <b>{badge ? item.name : "Daily goal reached"}</b>
        <span>{badge ? item.desc : "You hit your XP goal for today. Nice work."}</span>
      </div>
    </div>
  );
}

export function useProgress() {
  return useContext(ProgressCtx);
}
