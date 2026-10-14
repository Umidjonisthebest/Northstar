import { useState } from "react";
import { Bookmark, Check, X } from "lucide-react";
import { useExam } from "../ExamContext.jsx";

// In a practice review (`locked`), `marks` says which slots were answered
// correctly: right answers get a tick, wrong ones show the key.
const markClass = (marks, slotId, base) => {
  const mark = marks?.get(slotId);
  return mark === true ? `${base}--right` : mark === false ? `${base}--wrong` : "";
};

export function FlagButton({ slotId, className = "" }) {
  const { flags, toggleFlag, numberOf, preview, locked } = useExam();
  if (preview || locked) return null;
  const on = flags.has(slotId);
  const n = numberOf.get(slotId);
  return (
    <button
      type="button"
      className={`ie-flag ${on ? "ie-flag--on" : ""} ${className}`}
      aria-pressed={on}
      aria-label={on ? `Remove review flag from question ${n}` : `Flag question ${n} for review`}
      title={on ? "Remove flag" : "Flag for review"}
      onClick={() => toggleFlag(slotId)}
    >
      <Bookmark fill={on ? "currentColor" : "none"} />
    </button>
  );
}

// With `group`, an option key is shown with its text ("vii How cities store heat").
export function Reveal({ slotId, group }) {
  const { reveal, keyOf, marks } = useExam();
  if (!reveal) return null;
  const expected = keyOf?.get(slotId);
  const mark = marks?.get(slotId);
  if (mark === true)
    return (
      <span className="ie-reveal ie-reveal--ok" aria-label="Correct">
        <Check />
      </span>
    );
  if (!expected?.length) return null;
  const label = (k) => {
    const text = group?.options?.find((o) => o.key === k)?.text;
    return text && text !== k ? `${k} ${text}` : k;
  };
  if (mark === false)
    return (
      <span className="ie-reveal ie-reveal--bad" aria-label={`Incorrect. Answer: ${label(expected[0])}`}>
        <X /> {label(expected[0])}
      </span>
    );
  return <span className="ie-reveal">{expected.map(label).join(" / ")}</span>;
}

export function GapInput({ slotId, wide = false }) {
  const { answers, setAnswer, flags, numberOf, setCurrent, locked, marks } = useExam();
  const n = numberOf.get(slotId);
  return (
    <span className={`ie-gap ${flags.has(slotId) ? "ie-gap--flagged" : ""} ${markClass(marks, slotId, "ie-gap")}`} data-q={n}>
      <input
        className={`ie-gap__input ${wide ? "ie-gap__input--wide" : ""}`}
        value={answers[slotId] ?? ""}
        placeholder={n ?? ""}
        aria-label={`Question ${n}`}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={80}
        disabled={n === undefined}
        readOnly={locked}
        onChange={(e) => setAnswer(slotId, e.target.value)}
        onFocus={() => setCurrent(slotId)}
      />
      <FlagButton slotId={slotId} />
      <Reveal slotId={slotId} />
    </span>
  );
}

export function QNum({ children, range = false }) {
  return <span className={`ie-qnum ${range ? "ie-qnum--range" : ""}`}>{children}</span>;
}

// Single-choice list (multiple choice, TRUE/FALSE/NOT GIVEN, YES/NO/NOT GIVEN).
export function ChoiceItem({ slotId, text, options }) {
  const { answers, setAnswer, numberOf, setCurrent, locked, reveal, keyOf, marks } = useExam();
  const n = numberOf.get(slotId);
  const value = answers[slotId];
  // In a review, the key is highlighted and a wrong pick is marked.
  const key = reveal && marks ? String(keyOf?.get(slotId)?.[0] ?? "").toUpperCase() : null;
  return (
    <div className="ie-q-item" data-q={n}>
      <div className="ie-q-head">
        <QNum>{n}</QNum>
        <span className="ie-q-text">{text}</span>
        <FlagButton slotId={slotId} className="ie-flag--head" />
      </div>
      <div className="ie-choices" role="radiogroup" aria-label={`Question ${n}`}>
        {options.map((o) => (
          <label
            key={o.key}
            className={`ie-choice ${value === o.key ? "ie-choice--selected" : ""} ${key && key === o.key.toUpperCase() ? "ie-choice--key" : ""} ${key && value === o.key && key !== o.key.toUpperCase() ? "ie-choice--wrong" : ""}`}
          >
            <input type="radio" name={`q-${slotId}`} value={o.key} checked={value === o.key} disabled={locked} onChange={() => setAnswer(slotId, o.key)} onFocus={() => setCurrent(slotId)} />
            <span className="ie-radio" aria-hidden="true" />
            <span>{o.text || o.key}</span>
          </label>
        ))}
      </div>
      <Reveal slotId={slotId} />
    </div>
  );
}

// "Choose TWO letters" — one item worth `slots.length` marks.
export function MultiItem({ item, slots }) {
  const { answers, setAnswer, setCurrent, reveal, keyOf, locked, marks } = useExam();
  const max = slots.length;
  const selected = Array.isArray(answers[item.id]) ? answers[item.id] : [];
  const numbers = slots.map((s) => s.n);
  const toggle = (key) => {
    if (selected.includes(key)) setAnswer(item.id, selected.filter((k) => k !== key));
    else if (selected.length < max) setAnswer(item.id, [...selected, key]);
  };
  const expected = reveal ? slots.flatMap((s) => keyOf?.get(s.id) || []) : [];
  const right = marks ? slots.filter((s) => marks.get(s.id)).length : null;
  return (
    <div className="ie-q-item" data-q={numbers.join(" ")}>
      <div className="ie-q-head">
        <QNum range>{numbers.length > 1 ? `${numbers[0]}-${numbers[numbers.length - 1]}` : numbers[0]}</QNum>
        <span className="ie-q-text">{item.text}</span>
        <FlagButton slotId={slots[0].id} className="ie-flag--head" />
      </div>
      <div className="ie-choices">
        {item.options.map((o) => {
          const on = selected.includes(o.key);
          const blocked = !on && selected.length >= max;
          const isKey = marks && expected.includes(o.key);
          return (
            <label
              key={o.key}
              className={`ie-choice ${on ? "ie-choice--selected" : ""} ${blocked && !locked ? "ie-choice--blocked" : ""} ${isKey ? "ie-choice--key" : ""} ${marks && on && !isKey ? "ie-choice--wrong" : ""}`}
            >
              <input type="checkbox" checked={on} disabled={blocked || locked} onChange={() => toggle(o.key)} onFocus={() => setCurrent(slots[0].id)} />
              <span className="ie-check" aria-hidden="true" />
              <span>
                <strong className="ie-choice__key">{o.key}</strong> {o.text}
              </span>
            </label>
          );
        })}
      </div>
      {expected.length > 0 &&
        (right === null ? (
          <span className="ie-reveal">{expected.join(", ")}</span>
        ) : right === slots.length ? (
          <span className="ie-reveal ie-reveal--ok">
            <Check /> {right} of {slots.length} correct
          </span>
        ) : (
          <span className="ie-reveal ie-reveal--bad">
            <X /> {right} of {slots.length} correct · answer: {expected.join(", ")}
          </span>
        ))}
    </div>
  );
}

// Drag-and-drop option bank + drop zones. Options can also be placed by
// clicking an option and then a gap (keyboard/touch friendly).
const DND_TYPE = "application/x-ielts-option";

export function OptionsBank({ group }) {
  const { answers, selected, setSelected, preview, locked } = useExam();
  const used = new Set(group.slots.map((s) => answers[s.id]).filter(Boolean));
  return (
    <div className="ie-bank">
      {group.optionsTitle && <div className="ie-bank__title">{group.optionsTitle}</div>}
      <div className="ie-bank__list">
        {(group.options || []).map((o) => {
          const isUsed = !group.allowReuse && used.has(o.key);
          const isSelected = selected?.groupId === group.id && selected.key === o.key;
          const pick = () => !isUsed && !locked && setSelected(isSelected ? null : { groupId: group.id, key: o.key });
          return (
            <div
              key={o.key}
              role="button"
              tabIndex={isUsed ? -1 : 0}
              aria-pressed={isSelected}
              aria-disabled={isUsed}
              className={`ie-chip ${isUsed ? "ie-chip--used" : ""} ${isSelected ? "ie-chip--selected" : ""}`}
              draggable={!isUsed && !preview && !locked}
              onDragStart={(e) => {
                e.dataTransfer.setData(DND_TYPE, JSON.stringify({ groupId: group.id, key: o.key }));
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={pick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pick();
                }
              }}
            >
              <span className="ie-chip__key">{o.key}</span>
              {o.text && <span className="ie-chip__text">{o.text}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DropZone({ group, slotId, block = false }) {
  const { answers, updateAnswers, numberOf, selected, setSelected, setCurrent, flags, locked, marks } = useExam();
  const [over, setOver] = useState(false);
  const n = numberOf.get(slotId);
  const value = answers[slotId];
  const option = (group.options || []).find((o) => o.key === value);

  const place = (key, fromSlot) =>
    updateAnswers((prev) => {
      const next = { ...prev };
      if (fromSlot && fromSlot !== slotId) delete next[fromSlot];
      if (!group.allowReuse) {
        for (const s of group.slots) if (s.id !== slotId && next[s.id] === key) delete next[s.id];
      }
      next[slotId] = key;
      return next;
    });

  const clear = () =>
    updateAnswers((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });

  const activate = () => {
    if (locked) return;
    setCurrent(slotId);
    if (selected?.groupId === group.id) {
      place(selected.key);
      setSelected(null);
    } else if (value) {
      clear();
    }
  };

  return (
    <span
      role="button"
      tabIndex={0}
      data-q={n}
      aria-label={`Question ${n}${option ? `: ${option.text || option.key}` : ""}`}
      className={`ie-zone ${block ? "ie-zone--block" : ""} ${value ? "ie-zone--filled" : ""} ${over ? "ie-zone--over" : ""} ${flags.has(slotId) ? "ie-zone--flagged" : ""} ${markClass(marks, slotId, "ie-zone")}`}
      draggable={Boolean(value) && !locked}
      title={locked ? undefined : value ? "Click to remove, or drag to another gap" : "Drag an option here"}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_TYPE, JSON.stringify({ groupId: group.id, key: value, fromSlot: slotId }));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (!locked && e.dataTransfer.types.includes(DND_TYPE)) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        try {
          const data = JSON.parse(e.dataTransfer.getData(DND_TYPE));
          if (data.groupId === group.id && data.key) {
            setCurrent(slotId);
            place(data.key, data.fromSlot);
          }
        } catch {
          /* not one of our drags */
        }
      }}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
    >
      {value ? <span className="ie-zone__value">{option?.text || value}</span> : <span className="ie-zone__num">{n}</span>}
    </span>
  );
}
