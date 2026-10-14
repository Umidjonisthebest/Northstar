import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { clock, pickBoard } from "./exercises.js";
import { MatchBoard, ModeFrame, SaveState } from "./VocabBits.jsx";
import { useVocabSend } from "./useVocabSend.js";

// Match: one board of words and meanings, against the clock. A wrong pair adds `games.penalty`
// seconds. The server marks the pairs, adds the penalties and keeps the best time.
export default function MatchGame({ words, games, onSaved, onExit, onAgain }) {
  const [board] = useState(() => pickBoard(words, games.pairs));
  const [phase, setPhase] = useState("ready"); // ready | playing | done
  const [elapsed, setElapsed] = useState(0);
  const [misses, setMisses] = useState(0);
  const [missed, setMissed] = useState([]); // the words that were put with a wrong meaning
  const [result, setResult] = useState(null); // the server's { seconds, wrong, best, record }
  const startedAt = useRef(0);
  const attempts = useRef([]);
  const { send, state } = useVocabSend("match", onSaved);

  useEffect(() => {
    if (phase !== "playing") return undefined;
    const timer = setInterval(() => setElapsed((performance.now() - startedAt.current) / 1000), 100);
    return () => clearInterval(timer);
  }, [phase]);

  const start = () => {
    startedAt.current = performance.now();
    setPhase("playing");
  };

  const save = useCallback(
    async (answers, seconds) => {
      const res = await send(answers, { seconds });
      if (res?.match) setResult(res.match);
    },
    [send]
  );

  const finish = () => {
    const seconds = Math.round((performance.now() - startedAt.current) / 100) / 10;
    const wrongIds = new Set(attempts.current.filter((a) => !a.ok).map((a) => a.id));
    setElapsed(seconds);
    setMissed(board.filter((w) => wrongIds.has(w.id)));
    setPhase("done");
    save(attempts.current.map(({ id, pick }) => ({ id, kind: "match", pick })), seconds);
  };

  const shown = result?.seconds ?? elapsed + misses * games.penalty;
  const best = result?.best ?? games.matchBest;
  const timed = board.length >= games.pairs; // a smaller board (a small deck) has no record to beat

  return (
    <ModeFrame
      title="Match"
      icon="grid"
      tint="#8a5fe6"
      onExit={onExit}
      side={
        phase !== "ready" && (
          <span className={`vc-clock ${phase === "done" ? "stopped" : ""}`} aria-live="off">
            <Icon name="stopwatch" size={18} /> {clock(shown)}
          </span>
        )
      }
    >
      {phase === "ready" && (
        <div className="ns-card vc-done">
          <span className="vc-done-mark tint">
            <Icon name="stopwatch" size={30} />
          </span>
          <h2>Match {board.length} words to their meanings</h2>
          <p className="ns-muted">
            Tap a word, then its meaning. The clock starts when you do, and a wrong pair adds {games.penalty} seconds.
            {timed && best != null ? ` Your best time is ${clock(best)}.` : ""}
          </p>
          <div className="vc-actions">
            <button type="button" className="ns-btn ns-btn-primary" onClick={start} autoFocus>
              <Icon name="play" size={16} /> Start the clock
            </button>
          </div>
        </div>
      )}

      {phase === "playing" && (
        <MatchBoard
          words={board}
          onAttempt={(a) => {
            attempts.current.push(a);
            if (!a.ok) setMisses((n) => n + 1);
          }}
          onDone={finish}
        />
      )}

      {phase === "done" && (
        <div className="ns-card vc-done">
          <span className="vc-done-mark">
            <Icon name={result?.record ? "trophy" : "check"} size={30} />
          </span>
          <h2>{result?.record ? "New best time!" : "Board cleared"}</h2>
          <div className="vc-time">{clock(shown)}</div>
          <p className="ns-muted">
            {misses === 0 ? "No wrong pairs." : `${misses} wrong ${misses === 1 ? "pair" : "pairs"} (+${misses * games.penalty} s).`}
            {timed && best != null && !result?.record ? ` Your best is ${clock(best)}.` : ""}
          </p>
          <SaveState state={state} onRetry={() => save([], elapsed)} />
          {missed.length > 0 && (
            <>
              <p className="ns-card-kicker">Worth another look</p>
              <ul className="vc-results wide">
                {missed.map((w) => (
                  <li key={w.id}>
                    <b>{w.word}</b>
                    <span className="ns-muted">{w.definition}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="vc-actions">
            <button type="button" className="ns-btn ns-btn-primary" onClick={onAgain} autoFocus>
              Play again <Icon name="chevronRight" size={16} />
            </button>
            <button type="button" className="ns-btn ns-btn-outline" onClick={onExit}>
              Back to vocabulary
            </button>
          </div>
        </div>
      )}
    </ModeFrame>
  );
}
