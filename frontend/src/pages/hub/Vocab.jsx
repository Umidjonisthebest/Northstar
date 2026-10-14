import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { getVocab } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import Icon from "../../components/Icon.jsx";
import { Loading } from "./Home.jsx";
import { MASTERED, band, clock } from "./vocab/exercises.js";
import LearnMode from "./vocab/LearnMode.jsx";
import Flashcards from "./vocab/Flashcards.jsx";
import MatchGame from "./vocab/MatchGame.jsx";
import "../../vocab.css";

// The three ways to practise. The open one is in the address (/vocab?mode=learn), so the
// browser's Back button leaves a round and a study-plan link can open one.
const MODES = { learn: LearnMode, cards: Flashcards, match: MatchGame };
const MIN_WORDS = 4; // Learn and Match need a few words to choose between

const BANDS = [
  ["all", "All"],
  ["new", "New"],
  ["learning", "Learning"],
  ["mastered", "Mastered"]
];

export default function Vocab() {
  const { token } = useStudentAuth();
  const [params, setParams] = useSearchParams();
  const [deck, setDeck] = useState(null); // { words, games }
  const [loadError, setLoadError] = useState("");
  const [run, setRun] = useState(0); // a new round of the open mode
  const mode = MODES[params.get("mode")] ? params.get("mode") : null;

  const load = useCallback(async () => {
    try {
      setDeck(await getVocab(token));
      setLoadError("");
    } catch (e) {
      setLoadError(e.message || "Couldn't load your vocabulary");
    }
  }, [token]);

  // On opening, and again on coming back from a mode: what was practised there shows in the numbers.
  const loaded = useRef(false);
  useEffect(() => {
    if (mode && loaded.current) return;
    loaded.current = true;
    load();
  }, [load, mode]);

  // A reply that moved some words' mastery: { words: [{ id, mastery }], games? }.
  const onSaved = useCallback((res) => {
    const moved = new Map((res.words || []).map((w) => [w.id, w.mastery]));
    setDeck((d) => d && { words: d.words.map((w) => (moved.has(w.id) ? { ...w, mastery: moved.get(w.id) } : w)), games: res.games || d.games });
  }, []);

  const open = (next) => {
    setRun((n) => n + 1);
    setParams(next ? { mode: next } : {});
  };

  if (!deck && loadError) {
    return (
      <div className="ns-page">
        <div className="ns-card ns-empty">
          <h3>Couldn't load your vocabulary</h3>
          <p className="ns-muted">{loadError}</p>
          <button className="ns-btn ns-btn-primary" onClick={load}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!deck) return <Loading />;
  if (!deck.words.length) return <div className="ns-page"><div className="ns-card ns-empty"><h3>No vocabulary yet</h3><p className="ns-muted">Your teacher can add words from the admin studio.</p></div></div>;

  const Mode = mode && (mode === "cards" || deck.words.length >= MIN_WORDS) ? MODES[mode] : null;
  if (Mode) {
    return (
      <div className="ns-page">
        <Mode key={`${mode}-${run}`} words={deck.words} games={deck.games} onSaved={onSaved} onExit={() => open(null)} onAgain={() => setRun((n) => n + 1)} onMode={open} />
      </div>
    );
  }
  return <VocabHome words={deck.words} games={deck.games} onOpen={open} />;
}

function VocabHome({ words, games, onOpen }) {
  // The weekly study plan is the SAT side's; the page is shared with IELTS.
  const { exam = "sat" } = useOutletContext() || {};
  const counts = useMemo(() => {
    const c = { all: words.length, new: 0, learning: 0, mastered: 0 };
    for (const w of words) c[band(w.mastery)] += 1;
    return c;
  }, [words]);
  const few = words.length < MIN_WORDS;
  const round = Math.min(games.round, words.length);
  const pairs = Math.min(games.pairs, words.length);

  const modes = [
    {
      key: "learn",
      icon: "masterclass",
      tint: "#4f7df3",
      title: "Learn mode",
      text: `Take ${round} words through three steps: meet them, match them, then use each one in a sentence.`,
      meta: ["3 steps", "about 6 minutes"],
      off: few
    },
    {
      key: "cards",
      icon: "layers",
      tint: "#6a63ec",
      title: "Flashcards",
      text: `Review ${round} words at a time. Skip the ones you know; the ones you miss come back.`,
      meta: [`${round} cards`, "weakest words first"]
    },
    {
      key: "match",
      icon: "grid",
      tint: "#8a5fe6",
      title: "Match",
      text: `Pair ${pairs} words with their meanings against the clock. A wrong pair costs ${games.penalty} seconds.`,
      meta: [`${pairs} pairs`, games.matchBest != null ? `best ${clock(games.matchBest)}` : "no time yet"],
      off: few
    }
  ];

  return (
    <div className="ns-page">
      <div className="ns-page-head">
        <div>
          <span className="ns-pill warm">VOCABULARY LAB</span>
          <h1>Words that do more work.</h1>
          <p className="ns-sub">Three ways to make the deck yours, weakest words first.{exam === "sat" ? " Every word you practise counts toward this week's study plan." : ""}</p>
        </div>
      </div>

      <div className="vc-modes">
        {modes.map((m) => (
          <section key={m.key} className={`vc-mode ${m.key}`} style={{ "--tint": m.tint }}>
            <span className="vc-mode-art" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="vc-mode-icon">
              <Icon name={m.icon} size={24} />
            </span>
            <h2>{m.title}</h2>
            <p>{m.text}</p>
            <div className="vc-mode-meta">
              {m.meta.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
            <button type="button" className="ns-btn ns-btn-primary" aria-label={`Start ${m.title}`} onClick={() => onOpen(m.key)} disabled={m.off} title={m.off ? `Needs at least ${MIN_WORDS} words in the deck` : undefined}>
              Start <Icon name="chevronRight" size={16} />
            </button>
          </section>
        ))}
      </div>

      <div className="vc-deck">
        <div className="ns-card vc-mastery">
          <p className="ns-card-kicker">Deck mastery</p>
          <div className="ns-bigscore dark">
            {counts.mastered}
            <span>/{words.length}</span>
          </div>
          <p className="ns-muted ns-small">words mastered ({MASTERED}% or more)</p>
          <div className="vc-bands" aria-hidden="true">
            {["mastered", "learning", "new"].map((b) => counts[b] > 0 && <i key={b} className={b} style={{ flexGrow: counts[b] }} />)}
          </div>
          <ul className="vc-legend">
            {["mastered", "learning", "new"].map((b) => (
              <li key={b}>
                <i className={b} />
                {BANDS.find(([key]) => key === b)[1]}
                <b>{counts[b]}</b>
              </li>
            ))}
          </ul>
          <div className="vc-today">
            <Icon name="bolt" size={18} />
            <span>
              <b>{games.today}</b> {games.today === 1 ? "word" : "words"} practised today
            </span>
          </div>
        </div>
        <WordList words={words} counts={counts} />
      </div>
    </div>
  );
}

// The whole deck, to look a word up: search, filter by how well it is known, open a row to read it.
function WordList({ words, counts }) {
  const [query, setQuery] = useState("");
  const [show, setShow] = useState("all");
  const [openId, setOpenId] = useState(null);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words
      .filter((w) => (show === "all" || band(w.mastery) === show) && (!q || w.word.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q)))
      .sort((a, b) => a.word.localeCompare(b.word));
  }, [words, query, show]);

  return (
    <div className="ns-card vc-words">
      <div className="vc-words-head">
        <p className="ns-card-kicker">Your words</p>
        <label className="ns-search">
          <Icon name="search" size={16} />
          <input className="ns-input" type="search" placeholder="Find a word or a meaning" aria-label="Find a word or a meaning" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      <div className="vc-filter" role="group" aria-label="Show">
        {BANDS.map(([key, label]) => (
          <button key={key} type="button" className={show === key ? "on" : ""} aria-pressed={show === key} onClick={() => setShow(key)}>
            {label} <span>{counts[key]}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="ns-empty2">
          <b>No words here</b>
          {query ? "Nothing in the deck matches that search." : "Practise a round and words will move into this group."}
        </p>
      ) : (
        <ul className="vc-list">
          {list.map((w) => {
            const open = openId === w.id;
            return (
              <li key={w.id} className={open ? "open" : ""}>
                <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : w.id)}>
                  <span className="vc-list-word">
                    {w.word} {w.partOfSpeech && <small>{w.partOfSpeech}</small>}
                  </span>
                  <span className="vc-meter">
                    <i className={band(w.mastery)} style={{ width: `${w.mastery}%` }} />
                  </span>
                  <small>{w.mastery}%</small>
                  <Icon name={open ? "chevronUp" : "chevronDown"} size={16} />
                </button>
                {open && (
                  <div className="vc-list-body">
                    <p>{w.definition}</p>
                    {w.example && <p className="vc-list-ex">“{w.example}”</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
