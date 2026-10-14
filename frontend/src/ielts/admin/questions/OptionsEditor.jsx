import { Plus, Trash2 } from "lucide-react";
import { Button } from "../../components/ui.jsx";
import { ROMAN } from "../../lib/questionTypes.js";

export function optionKey(index, style = "letter") {
  return style === "roman" ? ROMAN[index] || String(index + 1) : String.fromCharCode(65 + index);
}

export function makeOptions(count, style = "letter") {
  return Array.from({ length: count }, (_, i) => ({ key: optionKey(i, style), text: "" }));
}

// Editable option bank. Keys are always sequential (A, B, C… or i, ii, iii…);
// removing an option reports the old->new key mapping so answers can follow.
export function OptionsEditor({ options, onChange, style = "letter", title = "Options", placeholder = "Option text", min = 2, max = 12, allowEmptyText = false }) {
  const setText = (i, text) => onChange(options.map((o, j) => (j === i ? { ...o, text } : o)));
  const add = () => onChange([...options, { key: optionKey(options.length, style), text: "" }]);
  const remove = (i) => {
    const kept = options.filter((_, j) => j !== i);
    const mapping = {};
    const next = kept.map((o, j) => {
      mapping[o.key] = optionKey(j, style);
      return { ...o, key: optionKey(j, style) };
    });
    onChange(next, mapping);
  };
  return (
    <div>
      {title && <span className="ie-label">{title}</span>}
      {options.map((o, i) => (
        <div className="ie-option-row" key={i}>
          <span className="ie-option-key">{o.key}</span>
          <input className="ie-input" value={o.text} placeholder={allowEmptyText ? `${placeholder} (optional)` : placeholder} onChange={(e) => setText(i, e.target.value)} />
          <Button variant="danger-outline" size="sm" icon={Trash2} disabled={options.length <= min} onClick={() => remove(i)} aria-label={`Remove option ${o.key}`} />
        </div>
      ))}
      <Button variant="outline" size="sm" icon={Plus} style={{ marginTop: 10 }} disabled={options.length >= max} onClick={add}>
        Add option
      </Button>
    </div>
  );
}

// Applies an old->new key mapping to option answers and multi-answer items.
export function remapOptionAnswers(group, mapping) {
  if (!mapping) return group;
  const answers = {};
  for (const [slot, ans] of Object.entries(group.answers || {})) {
    if (!ans?.value) continue;
    if (mapping[ans.value] !== undefined) answers[slot] = { ...ans, value: mapping[ans.value] };
  }
  return { ...group, answers };
}
