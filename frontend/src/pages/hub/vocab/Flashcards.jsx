import React, { useEffect, useRef, useState } from "react";
import { rateVocab } from "../../../api.js";
import { useStudentAuth } from "../../../context/AuthContext.jsx";
import { useProgress } from "../../../context/ProgressContext.jsx";
import { useToast } from "../../../components/Toast.jsx";
import Icon from "../../../components/Icon.jsx";
import { planFinishedLine } from "../hubUtils.js";
import { pickRound } from "./exercises.js";
import { FlipCard, ModeFrame } from "./VocabBits.jsx";
import { ownsKeys } from "./useVocabSend.js";

const RATINGS = [
  ["again", "Again", "Not yet", "bad"],
  ["hard", "Hard", "Took effort", "warn"],
  ["good", "Good", "Got it", "primary"],
  ["easy", "Easy", "Instantly", "good"]
];
const LABEL = Object.fromEntries(RATINGS.map(([key, label, , tone]) => [key, [label, tone]]));

// A round of flashcards: the weakest words, one at a time. A card rated "Again" comes back at
// the end of the round; "I know this" rates a card Easy without turning it over.
export default function Flashcards({ words, games, onSaved, onExit, onAgain }) {
  const { token } = useStudentAuth();
  const { celebrate } = useProgress();
  const { toast } = useToast();
  const [round] = useState(() => pickRound(words, games.round));
  const [queue, setQueue] = useState(() => round.map((w) => w.id));
  const [flipped, setFlipped] = useState(false);
  const [last, setLast] = useState({}); // word id -> its latest rating this round
  const [xp, setXp] = useState(0);
  const rating = useRef(false); // a rating is on its way: ignore the next key press until it lands

  const w = words.find((x) => x.id === queue[0]);
  const done = round.length - new Set(queue).size;

  async function rate(r) {
    // Two quick key presses used to send two ratings for the same word (and pay twice).
    if (rating.current || !w) return;
    rating.current = true;
    try {
      const res = await rateVocab(token, w.id, r);
      onSaved({ words: [{ id: w.id, mastery: res.mastery }] });
      celebrate(res.reward);
      setXp((n) => n + (res.reward?.xpGained || 0));
      // This word was the last one the study plan's vocab task needed.
      if (res.plan) {
        celebrate(res.plan.reward);
        toast.success(planFinishedLine(res.plan));
      }
      setLast((l) => ({ ...l, [w.id]: r }));
      setFlipped(false);
      setQueue((q) => (r === "again" ? [...q.slice(1), q[0]] : q.slice(1)));
    } catch (e) {
      toast.error(e.message || "Couldn't save that rating");
    } finally {
      rating.current = false;
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (!w || ownsKeys(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) rate(RATINGS[Number(e.key) - 1][0]);
      else if (!flipped && e.key.toLowerCase() === "k") rate("easy");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!w) {
    const tally = RATINGS.map(([key, label, , tone]) => [label, tone, Object.values(last).filter((r) => r === key).length]).filter(([, , n]) => n);
    return (
      <ModeFrame title="Flashcards" icon="layers" tint="#6a63ec" done={round.length} total={round.length} onExit={onExit}>
        <div className="ns-card vc-done">
          <span className="vc-done-mark">
            <Icon name="check" size={30} />
          </span>
          <h2>Round finished</h2>
          <p className="ns-muted">
            {round.length} {round.length === 1 ? "word" : "words"} reviewed{xp > 0 ? ` · +${xp} XP` : ""}
          </p>
          <div className="vc-tally">
            {tally.map(([label, tone, n]) => (
              <span key={label} className={`vc-chip ${tone}`}>
                {n} {label}
              </span>
            ))}
          </div>
          <ul className="vc-results">
            {round.map((x) => {
              const now = words.find((y) => y.id === x.id) || x;
              const [label, tone] = LABEL[last[x.id]] || ["", ""];
              return (
                <li key={x.id}>
                  <b>{x.word}</b>
                  <span className={`vc-chip ${tone}`}>{label}</span>
                  <small>
                    {x.mastery}% <Icon name="arrowRight" size={12} /> {now.mastery}%
                  </small>
                </li>
              );
            })}
          </ul>
          <div className="vc-actions">
            <button type="button" className="ns-btn ns-btn-primary" onClick={onAgain} autoFocus>
              Next {games.round} words <Icon name="chevronRight" size={16} />
            </button>
            <button type="button" className="ns-btn ns-btn-outline" onClick={onExit}>
              Back to vocabulary
            </button>
          </div>
        </div>
      </ModeFrame>
    );
  }

  return (
    <ModeFrame title="Flashcards" icon="layers" tint="#6a63ec" note={`${Math.min(done + 1, round.length)} of ${round.length}`} done={done} total={round.length} onExit={onExit}>
      <div className="vc-stage">
        <FlipCard key={w.id} word={w} flipped={flipped} onFlip={() => setFlipped((f) => !f)} hint="Tap or press Space to see the meaning" />
        {flipped ? (
          <div className="ns-rate show">
            {RATINGS.map(([k, label, sub, tone], i) => (
              <button key={k} type="button" className={`ns-rate-btn ${tone}`} onClick={() => rate(k)}>
                <b>{label}</b>
                <span>
                  {sub} · {i + 1}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="vc-actions">
            <button type="button" className="ns-btn ns-btn-primary" onClick={() => setFlipped(true)}>
              Show the meaning
            </button>
            <button type="button" className="ns-btn ns-btn-outline" onClick={() => rate("easy")} title="Counts as Easy (K)">
              <Icon name="check" size={16} /> I know this word
            </button>
          </div>
        )}
        <p className="vc-hint">{last[w.id] === "again" ? "Back again: you marked this one “Again”." : "Rate how well you remembered it. “Again” brings the card back at the end of the round."}</p>
      </div>
    </ModeFrame>
  );
}
