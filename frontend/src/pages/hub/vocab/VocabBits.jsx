import React, { useRef, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { boardTiles } from "./exercises.js";

// The frame every mode sits in: the way back, the mode's name, and how far the round has got.
export function ModeFrame({ title, icon, tint, note, done, total, onExit, side, children }) {
  return (
    <div className="vc-run" style={{ "--tint": tint }}>
      <div className="vc-run-top">
        <button type="button" className="ns-btn ns-btn-soft ns-btn-sm" onClick={onExit}>
          <Icon name="chevronLeft" size={16} /> Vocabulary
        </button>
        <div className="vc-run-title">
          <span className="vc-run-icon">
            <Icon name={icon} size={18} />
          </span>
          <b>{title}</b>
          {note && <span className="vc-run-note">{note}</span>}
        </div>
        <div className="vc-run-side">{side}</div>
      </div>
      {total > 0 && (
        <div className="vc-run-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={`${done} of ${total}`}>
          <div style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}
      {children}
    </div>
  );
}

// A flashcard: the word on the front, its meaning and example on the back.
export function FlipCard({ word, flipped, onFlip, hint = "Tap to see the meaning" }) {
  return (
    <div
      className={`ns-flip ${flipped ? "flipped" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={flipped ? `${word.word}: ${word.definition}` : `${word.word}. Show the meaning`}
      onClick={onFlip}
      onKeyDown={(e) => {
        if (e.key === "Enter") onFlip();
      }}
    >
      <div className="ns-flip-inner">
        <div className="ns-flip-face front">
          {word.partOfSpeech && <span className="ns-flip-count">{word.partOfSpeech}</span>}
          <div className="ns-flip-word">{word.word}</div>
          <div className="ns-flip-pron">{word.pronunciation}</div>
          <p className="ns-flip-hint">{hint}</p>
        </div>
        <div className="ns-flip-face back">
          <span className="ns-flip-count">{word.word}</span>
          <div className="ns-flip-def">{word.definition}</div>
          {word.example && <p className="ns-flip-ex">“{word.example}”</p>}
        </div>
      </div>
    </div>
  );
}

// A board of words and meanings to pair up. `onAttempt({ id, pick, ok })` is called for every
// pair tried (`id` is the word, `pick` the word whose meaning was put with it), `onDone` when
// the last pair is found.
export function MatchBoard({ words, onAttempt, onDone }) {
  const [tiles] = useState(() => boardTiles(words));
  const [picked, setPicked] = useState(null);
  const [solved, setSolved] = useState(() => new Set());
  const [wrong, setWrong] = useState([]);
  const shake = useRef(null);

  const tap = (tile) => {
    if (solved.has(tile.id)) return;
    const first = tiles.find((t) => t.key === picked);
    if (!first || first.side === tile.side) return setPicked(first?.key === tile.key ? null : tile.key);
    const [word, meaning] = first.side === "word" ? [first, tile] : [tile, first];
    const ok = word.id === meaning.id;
    setPicked(null);
    onAttempt({ id: word.id, pick: meaning.id, ok });
    if (ok) {
      const next = new Set(solved).add(word.id);
      setSolved(next);
      if (next.size === words.length) onDone();
    } else {
      setWrong([first.key, tile.key]);
      clearTimeout(shake.current);
      shake.current = setTimeout(() => setWrong([]), 420);
    }
  };

  // Columns that leave no tile alone on the last row: 12 tiles in fours, 10 in fives.
  const cols = tiles.length <= 6 ? tiles.length / 2 : tiles.length % 5 === 0 ? 5 : 4;
  return (
    <div className="vc-board" style={{ "--cols": cols, "--cols-md": Math.min(cols, 3) }}>
      {tiles.map((t) => {
        const done = solved.has(t.id);
        const state = done ? "done" : wrong.includes(t.key) ? "wrong" : picked === t.key ? "on" : "";
        return (
          <button key={t.key} type="button" className={`vc-tile ${t.side} ${state}`} disabled={done} aria-pressed={picked === t.key} onClick={() => tap(t)}>
            {t.text}
          </button>
        );
      })}
    </div>
  );
}

// The "couldn't save" line with its retry, shown where a round's results go.
export function SaveState({ state, onRetry }) {
  if (state === "saving") return <p className="vc-save">Saving your answers…</p>;
  if (state !== "failed") return null;
  return (
    <p className="vc-save failed">
      Your answers haven't been saved yet.
      <button type="button" className="ns-btn ns-btn-outline ns-btn-sm" onClick={onRetry}>
        Try again
      </button>
    </p>
  );
}
