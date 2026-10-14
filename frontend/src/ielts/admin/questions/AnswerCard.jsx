import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "../../components/ui.jsx";

// Typed answer with accepted variations ("school" + "my school").
export function AnswerCard({ number, value, onChange, label = "Correct Answer" }) {
  const answer = value || { value: "", variations: [] };
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const addVariations = () => {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !answer.variations.includes(s) && s !== answer.value);
    if (parts.length) onChange({ ...answer, variations: [...answer.variations, ...parts] });
    setDraft("");
  };

  return (
    <div className="ie-answer-card">
      <span className="ie-answer-card__num">{number}</span>
      <span className="ie-answer-card__label">{label}</span>
      <div className="ie-answer-row">
        <input
          className="ie-input"
          value={answer.value}
          placeholder={`Enter the correct answer for question ${number}`}
          onChange={(e) => onChange({ ...answer, value: e.target.value })}
        />
        {!adding && (
          <Button variant="outline" icon={Plus} onClick={() => setAdding(true)}>
            Add variation
          </Button>
        )}
      </div>
      {(adding || answer.variations.length > 0) && (
        <div className="ie-variations">
          {adding && (
            <>
              <div className="ie-answer-row" style={{ marginTop: 8 }}>
                <input
                  className="ie-input"
                  autoFocus
                  value={draft}
                  placeholder="Add alternative correct answer"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addVariations();
                    }
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setAdding(false);
                    }
                  }}
                />
                <Button icon={Check} onClick={addVariations} disabled={!draft.trim()} aria-label="Add variation" />
              </div>
              <div className="ie-help" style={{ marginTop: 6 }}>
                Press Enter or click ✓ to add. These answers will also be accepted as correct. Separate several with commas.
              </div>
            </>
          )}
          {answer.variations.length > 0 && (
            <div className="ie-variation-chips">
              {answer.variations.map((v) => (
                <span className="ie-variation-chip" key={v}>
                  {v}
                  <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange({ ...answer, variations: answer.variations.filter((x) => x !== v) })}>
                    <X />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Answer that is one of the option keys (drag-and-drop / matching types).
export function OptionAnswerCard({ number, value, options, onChange, label = "Correct option" }) {
  return (
    <div className="ie-answer-card">
      <span className="ie-answer-card__num">{number}</span>
      <span className="ie-answer-card__label">{label}</span>
      <select className="ie-select-native" value={value?.value || ""} onChange={(e) => onChange({ value: e.target.value, variations: [] })}>
        <option value="">— Select the correct option —</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.key}
            {o.text ? ` — ${o.text}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
