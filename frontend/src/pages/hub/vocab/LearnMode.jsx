import React, { useEffect, useRef, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { boards, pickRound, sentenceQuestion, shuffle } from "./exercises.js";
import { FlipCard, MatchBoard, ModeFrame, SaveState } from "./VocabBits.jsx";
import { ownsKeys, useVocabSend } from "./useVocabSend.js";

const STEPS = [
  ["meet", "Meet the words"],
  ["match", "Match them"],
  ["use", "Use them"]
];
const BOARD = 5; // pairs on one of the round's match boards

// Learn mode: one round of words through three steps. The flashcards are only for reading;
// the pairs and the sentences are sent to the server, which marks them.
export default function LearnMode({ words, games, onSaved, onExit, onAgain, onMode }) {
  const [round] = useState(() => pickRound(words, games.round));
  const [step, setStep] = useState("meet");
  const [marks, setMarks] = useState({}); // word id -> { match?: bool, use?: bool }, the first answer of each
  const { send, state } = useVocabSend("learn", onSaved);
  const stepIndex = STEPS.findIndex(([key]) => key === step);

  const mark = (id, part, ok) => setMarks((m) => (m[id]?.[part] === undefined ? { ...m, [id]: { ...m[id], [part]: ok } } : m));

  if (step === "done") {
    const clean = round.filter((w) => marks[w.id]?.match && marks[w.id]?.use).length;
    return (
      <ModeFrame title="Learn mode" icon="masterclass" tint="#4f7df3" done={1} total={1} onExit={onExit}>
        <div className="ns-card vc-done">
          <span className="vc-done-mark">
            <Icon name="check" size={30} />
          </span>
          <h2>Round finished</h2>
          <p className="ns-muted">
            {clean} of {round.length} words right in both exercises.
          </p>
          <SaveState state={state} onRetry={() => send()} />
          <ul className="vc-results marks">
            <li className="head">
              <span>Word</span>
              <span>Match</span>
              <span>Sentence</span>
              <span>Mastery</span>
            </li>
            {round.map((w) => {
              const now = words.find((x) => x.id === w.id) || w;
              return (
                <li key={w.id}>
                  <b>{w.word}</b>
                  <Mark ok={marks[w.id]?.match} />
                  <Mark ok={marks[w.id]?.use} />
                  <small>
                    {w.mastery}% <Icon name="arrowRight" size={12} /> {now.mastery}%
                  </small>
                </li>
              );
            })}
          </ul>
          <div className="vc-actions">
            <button type="button" className="ns-btn ns-btn-primary" onClick={onAgain} autoFocus>
              Learn {games.round} more <Icon name="chevronRight" size={16} />
            </button>
            <button type="button" className="ns-btn ns-btn-outline" onClick={() => onMode("cards")}>
              Review as flashcards
            </button>
            <button type="button" className="ns-btn ns-btn-soft" onClick={onExit}>
              Back to vocabulary
            </button>
          </div>
        </div>
      </ModeFrame>
    );
  }

  return (
    <ModeFrame title="Learn mode" icon="masterclass" tint="#4f7df3" onExit={onExit}>
      <ol className="vc-steps">
        {STEPS.map(([key, label], i) => (
          <li key={key} className={i < stepIndex ? "done" : i === stepIndex ? "on" : ""}>
            <span className="vc-step-n">{i < stepIndex ? <Icon name="check" size={14} /> : i + 1}</span>
            <span className="vc-step-label">{label}</span>
          </li>
        ))}
      </ol>
      {step === "meet" && <Meet round={round} onDone={() => setStep("match")} />}
      {step === "match" && (
        <MatchStep
          round={round}
          onAttempt={(a) => mark(a.id, "match", a.ok)}
          onDone={(answers) => {
            send(answers);
            setStep("use");
          }}
        />
      )}
      {step === "use" && (
        <UseStep
          round={round}
          deck={words}
          onAnswer={(id, ok) => mark(id, "use", ok)}
          onDone={(answers) => {
            send(answers);
            setStep("done");
          }}
        />
      )}
    </ModeFrame>
  );
}

function Mark({ ok }) {
  if (ok === undefined) return <span className="vc-mark" />;
  return (
    <span className={`vc-mark ${ok ? "ok" : "no"}`}>
      <Icon name={ok ? "check" : "cross"} size={14} title={ok ? "Right" : "Missed"} />
    </span>
  );
}

// Step 1: read each card. Nothing is marked here.
function Meet({ round, onDone }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const last = i === round.length - 1;
  const go = (to) => {
    if (to < 0) return;
    if (to >= round.length) return onDone();
    setI(to);
    setFlipped(false);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (ownsKeys(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="vc-stage">
      <p className="vc-count">
        Word {i + 1} of {round.length}
      </p>
      <FlipCard key={round[i].id} word={round[i]} flipped={flipped} onFlip={() => setFlipped((f) => !f)} hint="Say what it means, then tap to check" />
      <div className="vc-actions">
        <button type="button" className="ns-btn ns-btn-outline" onClick={() => go(i - 1)} disabled={i === 0}>
          <Icon name="chevronLeft" size={16} /> Back
        </button>
        <button type="button" className="ns-btn ns-btn-primary" onClick={() => go(i + 1)}>
          {last ? "Start matching" : "Next word"} <Icon name="chevronRight" size={16} />
        </button>
      </div>
      <p className="vc-hint keys">Space turns the card, the arrow keys move between words.</p>
    </div>
  );
}

// Step 2: the round's words in small boards, with no clock.
function MatchStep({ round, onAttempt, onDone }) {
  const [sets] = useState(() => boards(round, BOARD));
  const [n, setN] = useState(0);
  const answers = useRef([]);
  const next = useRef(null);
  useEffect(() => () => clearTimeout(next.current), []);

  return (
    <div className="vc-stage wide">
      <p className="vc-count">
        Board {n + 1} of {sets.length}: tap a word, then its meaning
      </p>
      <MatchBoard
        key={n}
        words={sets[n]}
        onAttempt={(a) => {
          answers.current.push({ id: a.id, kind: "match", pick: a.pick });
          onAttempt(a);
        }}
        onDone={() => {
          // A moment to see the last pair turn green.
          next.current = setTimeout(() => (n + 1 < sets.length ? setN(n + 1) : onDone(answers.current)), 550);
        }}
      />
    </div>
  );
}

// Step 3: each word's example sentence with a gap. A missed word comes back once at the end;
// only the first answer is sent.
function UseStep({ round, deck, onAnswer, onDone }) {
  const [queue, setQueue] = useState(() => shuffle(round).map((w) => ({ ...sentenceQuestion(w, deck), first: true })));
  const [picked, setPicked] = useState(null);
  const answers = useRef([]);
  const q = queue[0];
  const total = round.length;
  const firstLeft = queue.filter((x) => x.first).length;
  const word = deck.find((w) => w.id === q.id);

  const choose = (id) => {
    if (picked) return;
    setPicked(id);
    if (q.first) {
      answers.current.push({ id: q.id, kind: q.kind, pick: id });
      onAnswer(q.id, id === q.id);
    }
  };
  const next = () => {
    const rest = queue.slice(1);
    // Missed on the first go: once more, after the others.
    const again = q.first && picked !== q.id ? [{ ...sentenceQuestion(word, deck), first: false }] : [];
    setPicked(null);
    if (!rest.length && !again.length) return onDone(answers.current);
    setQueue([...rest, ...again]);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (ownsKeys(e.target)) return;
      if (!picked && ["1", "2", "3", "4"].includes(e.key) && q.choices[Number(e.key) - 1]) choose(q.choices[Number(e.key) - 1].id);
      else if (picked && e.key === "Enter") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const right = picked === q.id;
  return (
    <div className="vc-stage">
      <p className="vc-count">{q.first ? `Sentence ${total - firstLeft + 1} of ${total}` : "Once more: you missed this one"}</p>
      <div className="ns-card vc-quiz">
        <p className="ns-card-kicker">{q.kind === "sentence" ? "Complete the sentence" : "Which word means this?"}</p>
        {q.kind === "sentence" && (
          <p className="vc-sentence">
            {q.before}
            <span className={`vc-gap ${picked ? "filled" : ""}`}>{picked ? q.gap : ""}</span>
            {q.after}
          </p>
        )}
        <p className={q.kind === "sentence" ? "vc-clue" : "vc-sentence"}>
          {q.kind === "sentence" && <b>Meaning: </b>}
          {q.clue}
        </p>
        <div className="vc-choices">
          {q.choices.map((c, i) => {
            const cls = !picked ? "" : c.id === q.id ? "right" : c.id === picked ? "wrong" : "dim";
            return (
              <button key={c.id} type="button" className={`vc-choice ${cls}`} onClick={() => choose(c.id)} disabled={Boolean(picked)}>
                <span>{i + 1}</span>
                {c.word}
              </button>
            );
          })}
        </div>
        {picked && (
          <div className={`vc-feedback ${right ? "ok" : "no"}`} role="status">
            <Icon name={right ? "check" : "cross"} size={18} />
            <p>
              <b>{right ? "Right." : `It's “${word.word}”.`}</b> {right ? word.definition : `“${deck.find((w) => w.id === picked)?.word}” means: ${lower(deck.find((w) => w.id === picked)?.definition)}`}
            </p>
            <button type="button" className="ns-btn ns-btn-primary ns-btn-sm" onClick={next} autoFocus>
              Next <Icon name="chevronRight" size={16} />
            </button>
          </div>
        )}
      </div>
      <p className="vc-hint keys">Keys 1 to 4 choose a word, Enter moves on.</p>
    </div>
  );
}

const lower = (text) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : "");
