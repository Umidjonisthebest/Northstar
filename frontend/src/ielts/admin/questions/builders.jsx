import { useRef } from "react";
import { ArrowDown, Columns3, Plus, RefreshCw, Rows3, Trash2 } from "lucide-react";
import { RichEditor } from "../../components/RichEditor.jsx";
import { ImageDropzone } from "../../components/ImageDropzone.jsx";
import { Button } from "../../components/ui.jsx";
import { blankIdsInHtml, groupBlankIds, headingSlotIdsInHtml, letters, multiCount, TYPE_DEFS } from "../../lib/questionTypes.js";
import { newId } from "../../lib/ids.js";
import { AnswerCard, OptionAnswerCard } from "./AnswerCard.jsx";
import { OptionsEditor, makeOptions, remapOptionAnswers } from "./OptionsEditor.jsx";

const newItem = (extra = {}) => ({ id: newId("q"), text: "", ...extra });

export function emptyGroup(type) {
  const def = TYPE_DEFS[type];
  const g = { id: newId("g"), type, instructionHtml: def.instruction, answers: {} };
  switch (def.kind) {
    case "text-blanks":
    case "option-blanks":
      if (def.from === "content") g.contentHtml = "";
      if (def.from === "table") {
        g.table = {
          columns: [{ header: "", width: 150 }, { header: "", width: 150 }, { header: "", width: 200 }],
          rows: [
            [{ html: "" }, { html: "" }, { html: "" }],
            [{ html: "" }, { html: "" }, { html: "" }]
          ]
        };
      }
      if (def.from === "steps") g.steps = [{ html: "" }, { html: "" }, { html: "" }];
      if (def.kind === "option-blanks") {
        g.options = makeOptions(6);
        g.optionsTitle = "";
        g.allowReuse = false;
      }
      break;
    case "text-items":
    case "fixed-items":
      g.items = [newItem()];
      break;
    case "choice-items":
      g.items = [newItem({ options: makeOptions(3) })];
      break;
    case "multi-items":
      g.items = [newItem({ options: makeOptions(5), count: 2, correct: [] })];
      break;
    case "option-items":
      if (type === "map_select") {
        g.image = null;
        g.options = makeOptions(8);
        g.items = [newItem()];
      } else if (type === "matching_headings") {
        g.options = makeOptions(6, "roman");
        g.optionsTitle = "List of Headings";
        g.allowReuse = false;
        g.items = [];
      } else {
        g.options = makeOptions(4);
        g.optionsTitle = "";
        g.allowReuse = Boolean(def.reuse);
        g.items = [newItem()];
      }
      break;
    case "text-markers":
    case "option-markers":
      g.image = null;
      g.markers = [];
      if (def.kind === "option-markers") {
        g.options = makeOptions(5);
        g.allowReuse = false;
      }
      break;
    default:
      break;
  }
  return g;
}

// Switching type keeps whatever content still makes sense for the new type.
export function convertGroup(group, type, keepInstruction) {
  const next = emptyGroup(type);
  next.id = group.id;
  if (keepInstruction) next.instructionHtml = group.instructionHtml;
  const from = TYPE_DEFS[group.type];
  const to = TYPE_DEFS[type];
  if (from.from && from.from === to.from) {
    if (to.from === "content") next.contentHtml = group.contentHtml;
    if (to.from === "table") next.table = group.table;
    if (to.from === "steps") next.steps = group.steps;
    if (from.kind === to.kind) next.answers = group.answers;
  }
  if (group.items?.length && next.items && !["matching_headings"].includes(type)) {
    next.items = group.items.map((it) => ({ ...next.items[0], id: it.id, text: it.text }));
  }
  if (group.options?.length && next.options && from.kind === to.kind) next.options = group.options;
  if (group.image && "image" in next) next.image = group.image;
  if (group.markers && next.markers) next.markers = group.markers;
  return next;
}

function setAnswer(group, onChange, slotId, answer) {
  onChange({ ...group, answers: { ...group.answers, [slotId]: answer } });
}

function Section({ label, hint, children, action }) {
  return (
    <div className="ie-qb__section">
      <div className="ie-row" style={{ marginBottom: 8 }}>
        <span className="ie-label">
          {label} {hint && <small>{hint}</small>}
        </span>
        <span className="ie-spacer" />
        {action}
      </div>
      {children}
    </div>
  );
}

function BlankHint() {
  return (
    <>
      (Press <b>Ctrl+K</b> to add blank)
    </>
  );
}

function OptionsBlock({ group, onChange, style = "letter", title = "Options", withTitle = true, withReuse = true, min = 2 }) {
  return (
    <div className="ie-qb__section ie-builder-item">
      {withTitle && (
        <div className="ie-field" style={{ marginBottom: 12 }}>
          <label className="ie-label">
            Box title <small>(optional)</small>
          </label>
          <input className="ie-input" value={group.optionsTitle || ""} placeholder="e.g. List of Researchers" onChange={(e) => onChange({ ...group, optionsTitle: e.target.value })} />
        </div>
      )}
      <OptionsEditor
        title={title}
        style={style}
        min={min}
        options={group.options || []}
        onChange={(options, mapping) => onChange(remapOptionAnswers({ ...group, options }, mapping))}
      />
      {withReuse && (
        <label className="ie-checkbox" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={Boolean(group.allowReuse)} onChange={(e) => onChange({ ...group, allowReuse: e.target.checked })} />
          Options can be used more than once
        </label>
      )}
    </div>
  );
}

function BlankAnswers({ group, onChange, startNumber, mode }) {
  const ids = groupBlankIds(group);
  if (!ids.length) return <div className="ie-qb__hint">Put the cursor where the gap should be and press Ctrl+K. Each gap becomes one numbered question.</div>;
  return ids.map((id, i) =>
    mode === "option" ? (
      <OptionAnswerCard key={id} number={startNumber + i} options={group.options || []} value={group.answers?.[id]} onChange={(a) => setAnswer(group, onChange, id, a)} />
    ) : (
      <AnswerCard key={id} number={startNumber + i} value={group.answers?.[id]} onChange={(a) => setAnswer(group, onChange, id, a)} />
    )
  );
}

// ---------- completion builders ----------

function ContentBuilder({ group, onChange, startNumber, mode }) {
  return (
    <>
      {mode === "option" && <OptionsBlock group={group} onChange={onChange} title="Word list" />}
      <Section label="Question text" hint={<BlankHint />}>
        <RichEditor value={group.contentHtml || ""} onChange={(html) => onChange({ ...group, contentHtml: html })} enableBlanks blankStart={startNumber} placeholder="Enter the question text" minHeight={140} />
      </Section>
      <BlankAnswers group={group} onChange={onChange} startNumber={startNumber} mode={mode} />
    </>
  );
}

function TableBuilder({ group, onChange, startNumber }) {
  const table = group.table || { columns: [], rows: [] };
  const update = (t) => onChange({ ...group, table: t });
  const total = groupBlankIds(group).length;
  let running = startNumber;
  const cellStarts = table.rows.map((row) =>
    row.map((cell) => {
      const start = running;
      running += blankIdsInHtml(cell.html).length;
      return start;
    })
  );

  return (
    <>
      <div className="ie-table-builder ie-qb__section">
        <div className="ie-table-builder__head">
          <strong>
            TABLE_COMPLETION — Jami bo'sh joylar: {total}
          </strong>
          <span className="ie-spacer" />
          <Button
            variant="outline"
            size="sm"
            icon={Columns3}
            onClick={() => update({ columns: [...table.columns, { header: "", width: 150 }], rows: table.rows.map((r) => [...r, { html: "" }]) })}
          >
            Add Column
          </Button>
          <Button variant="outline" size="sm" icon={Rows3} onClick={() => update({ ...table, rows: [...table.rows, table.columns.map(() => ({ html: "" }))] })}>
            Add Row
          </Button>
        </div>
        <div className="ie-table-builder__scroll">
          <table className="ie-table-grid">
            <thead>
              <tr>
                {table.columns.map((col, c) => (
                  <th key={c} style={{ minWidth: Math.max(140, Number(col.width) || 150) }}>
                    <div className="ie-col-head">
                      <input
                        className="ie-input"
                        placeholder="Header"
                        value={col.header}
                        onChange={(e) => update({ ...table, columns: table.columns.map((x, j) => (j === c ? { ...x, header: e.target.value } : x)) })}
                      />
                      <input
                        className="ie-input ie-input--width"
                        type="number"
                        min={60}
                        max={600}
                        title="Column width (px)"
                        value={col.width}
                        onChange={(e) => update({ ...table, columns: table.columns.map((x, j) => (j === c ? { ...x, width: Number(e.target.value) || 150 } : x)) })}
                      />
                      <Button
                        variant="danger-outline"
                        size="sm"
                        icon={Trash2}
                        aria-label="Delete column"
                        disabled={table.columns.length <= 1}
                        onClick={() => update({ columns: table.columns.filter((_, j) => j !== c), rows: table.rows.map((r) => r.filter((_, j) => j !== c)) })}
                      />
                    </div>
                  </th>
                ))}
                <th className="ie-row-num">#</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={`${r}-${c}`}>
                      <RichEditor
                        toolbar="none"
                        variant="cell"
                        enableBlanks
                        minHeight={52}
                        blankStart={cellStarts[r][c]}
                        value={cell.html}
                        placeholder="( Press Ctrl+K to add blank )"
                        onChange={(html) => update({ ...table, rows: table.rows.map((rr, i) => (i === r ? rr.map((cc, j) => (j === c ? { html } : cc)) : rr)) })}
                      />
                    </td>
                  ))}
                  <td className="ie-row-num">
                    <Button variant="danger-outline" size="sm" icon={Trash2} aria-label="Delete row" disabled={table.rows.length <= 1} onClick={() => update({ ...table, rows: table.rows.filter((_, i) => i !== r) })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <BlankAnswers group={group} onChange={onChange} startNumber={startNumber} mode="text" />
    </>
  );
}

function StepsBuilder({ group, onChange, startNumber, mode }) {
  const steps = group.steps || [];
  const update = (next) => onChange({ ...group, steps: next });
  let running = startNumber;
  const starts = steps.map((s) => {
    const start = running;
    running += blankIdsInHtml(s.html).length;
    return start;
  });
  return (
    <>
      {mode === "option" && <OptionsBlock group={group} onChange={onChange} title="Options" />}
      <Section
        label="Flow-chart steps"
        hint={<BlankHint />}
        action={
          <Button variant="outline" size="sm" icon={Plus} onClick={() => update([...steps, { html: "" }])}>
            Add step
          </Button>
        }
      >
        <div className="ie-steps-builder">
          {steps.map((step, i) => (
            <div key={i}>
              {i > 0 && (
                <div className="ie-step-arrow">
                  <ArrowDown />
                </div>
              )}
              <div className="ie-row" style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <RichEditor
                    toolbar="none"
                    variant="cell"
                    enableBlanks
                    minHeight={48}
                    blankStart={starts[i]}
                    value={step.html}
                    placeholder={`Step ${i + 1} ( Press Ctrl+K to add blank )`}
                    onChange={(html) => update(steps.map((s, j) => (j === i ? { html } : s)))}
                  />
                </div>
                <Button variant="danger-outline" size="sm" icon={Trash2} aria-label="Delete step" disabled={steps.length <= 1} onClick={() => update(steps.filter((_, j) => j !== i))} />
              </div>
            </div>
          ))}
        </div>
      </Section>
      <BlankAnswers group={group} onChange={onChange} startNumber={startNumber} mode={mode} />
    </>
  );
}

// ---------- item builders ----------

function ItemsShell({ group, onChange, children, addLabel = "Add question", makeItem = () => newItem() }) {
  return (
    <div className="ie-builder-list ie-qb__section">
      {children}
      <div>
        <Button variant="outline" size="sm" icon={Plus} onClick={() => onChange({ ...group, items: [...(group.items || []), makeItem()] })}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

function ItemHead({ number, onRemove, disableRemove }) {
  return (
    <div className="ie-builder-item__head">
      <span className="ie-answer-card__num">{number}</span>
      <span className="ie-spacer" />
      <Button variant="danger-outline" size="sm" icon={Trash2} aria-label="Remove question" disabled={disableRemove} onClick={onRemove} />
    </div>
  );
}

function updateItem(group, onChange, id, patch) {
  onChange({ ...group, items: group.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
}

function removeItem(group, onChange, id) {
  const answers = { ...group.answers };
  delete answers[id];
  onChange({ ...group, items: group.items.filter((it) => it.id !== id), answers });
}

function ShortAnswerBuilder({ group, onChange, startNumber }) {
  return (
    <ItemsShell group={group} onChange={onChange}>
      {group.items.map((item, i) => (
        <div className="ie-builder-item" key={item.id}>
          <ItemHead number={startNumber + i} disableRemove={group.items.length <= 1} onRemove={() => removeItem(group, onChange, item.id)} />
          <input className="ie-input" value={item.text} placeholder="Question text" onChange={(e) => updateItem(group, onChange, item.id, { text: e.target.value })} />
          <div style={{ marginTop: 10 }}>
            <AnswerCard number={startNumber + i} value={group.answers?.[item.id]} onChange={(a) => setAnswer(group, onChange, item.id, a)} />
          </div>
        </div>
      ))}
    </ItemsShell>
  );
}

function MultipleChoiceBuilder({ group, onChange, startNumber }) {
  return (
    <ItemsShell group={group} onChange={onChange} makeItem={() => newItem({ options: makeOptions(3) })}>
      {group.items.map((item, i) => {
        const correct = group.answers?.[item.id]?.value || "";
        return (
          <div className="ie-builder-item" key={item.id}>
            <ItemHead number={startNumber + i} disableRemove={group.items.length <= 1} onRemove={() => removeItem(group, onChange, item.id)} />
            <input className="ie-input" value={item.text} placeholder="Question text" onChange={(e) => updateItem(group, onChange, item.id, { text: e.target.value })} />
            {item.options.map((o, oi) => (
              <div className="ie-option-row" key={oi}>
                <span className="ie-option-key">{o.key}</span>
                <input
                  className="ie-input"
                  value={o.text}
                  placeholder={`Option ${o.key}`}
                  onChange={(e) => updateItem(group, onChange, item.id, { options: item.options.map((x, j) => (j === oi ? { ...x, text: e.target.value } : x)) })}
                />
                <label className="ie-correct-toggle">
                  <input type="radio" name={`correct-${item.id}`} checked={correct === o.key} onChange={() => setAnswer(group, onChange, item.id, { value: o.key, variations: [] })} />
                  Correct
                </label>
                <Button
                  variant="danger-outline"
                  size="sm"
                  icon={Trash2}
                  aria-label="Remove option"
                  disabled={item.options.length <= 2}
                  onClick={() => {
                    const kept = item.options.filter((_, j) => j !== oi).map((x, j) => ({ ...x, key: String.fromCharCode(65 + j) }));
                    const oldKeys = item.options.filter((_, j) => j !== oi).map((x) => x.key);
                    const newCorrect = correct && oldKeys.includes(correct) ? String.fromCharCode(65 + oldKeys.indexOf(correct)) : "";
                    onChange({
                      ...group,
                      items: group.items.map((it) => (it.id === item.id ? { ...it, options: kept } : it)),
                      answers: { ...group.answers, [item.id]: { value: newCorrect, variations: [] } }
                    });
                  }}
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              icon={Plus}
              style={{ marginTop: 10 }}
              disabled={item.options.length >= 8}
              onClick={() => updateItem(group, onChange, item.id, { options: [...item.options, { key: String.fromCharCode(65 + item.options.length), text: "" }] })}
            >
              Add option
            </Button>
          </div>
        );
      })}
    </ItemsShell>
  );
}

function MultiAnswerBuilder({ group, onChange, startNumber }) {
  let running = startNumber;
  return (
    <ItemsShell group={group} onChange={onChange} makeItem={() => newItem({ options: makeOptions(5), count: 2, correct: [] })}>
      {group.items.map((item) => {
        const n = multiCount(item);
        const first = running;
        running += n;
        const correct = item.correct || [];
        const toggle = (key) => {
          const next = correct.includes(key) ? correct.filter((k) => k !== key) : correct.length < n ? [...correct, key] : correct;
          updateItem(group, onChange, item.id, { correct: next });
        };
        return (
          <div className="ie-builder-item" key={item.id}>
            <div className="ie-builder-item__head">
              <span className="ie-answer-card__num">{n > 1 ? `${first}-${first + n - 1}` : first}</span>
              <span className="ie-label" style={{ marginLeft: 6 }}>
                Number of answers
              </span>
              <select
                className="ie-select-native"
                style={{ width: 90, height: 34 }}
                value={n}
                onChange={(e) => updateItem(group, onChange, item.id, { count: Number(e.target.value), correct: correct.slice(0, Number(e.target.value)) })}
              >
                {[2, 3, 4].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="ie-spacer" />
              <Button variant="danger-outline" size="sm" icon={Trash2} aria-label="Remove question" disabled={group.items.length <= 1} onClick={() => removeItem(group, onChange, item.id)} />
            </div>
            <input className="ie-input" value={item.text} placeholder="Question text, e.g. Which TWO problems did the students have?" onChange={(e) => updateItem(group, onChange, item.id, { text: e.target.value })} />
            {item.options.map((o, oi) => (
              <div className="ie-option-row" key={oi}>
                <span className="ie-option-key">{o.key}</span>
                <input
                  className="ie-input"
                  value={o.text}
                  placeholder={`Option ${o.key}`}
                  onChange={(e) => updateItem(group, onChange, item.id, { options: item.options.map((x, j) => (j === oi ? { ...x, text: e.target.value } : x)) })}
                />
                <label className="ie-correct-toggle">
                  <input type="checkbox" checked={correct.includes(o.key)} onChange={() => toggle(o.key)} />
                  Correct
                </label>
                <Button
                  variant="danger-outline"
                  size="sm"
                  icon={Trash2}
                  aria-label="Remove option"
                  disabled={item.options.length <= n + 1}
                  onClick={() => {
                    const remaining = item.options.filter((_, j) => j !== oi);
                    const map = Object.fromEntries(remaining.map((x, j) => [x.key, String.fromCharCode(65 + j)]));
                    updateItem(group, onChange, item.id, {
                      options: remaining.map((x, j) => ({ ...x, key: String.fromCharCode(65 + j) })),
                      correct: correct.filter((k) => map[k]).map((k) => map[k])
                    });
                  }}
                />
              </div>
            ))}
            <div className="ie-row" style={{ marginTop: 10 }}>
              <Button
                variant="outline"
                size="sm"
                icon={Plus}
                disabled={item.options.length >= 9}
                onClick={() => updateItem(group, onChange, item.id, { options: [...item.options, { key: String.fromCharCode(65 + item.options.length), text: "" }] })}
              >
                Add option
              </Button>
              <span className="ie-help">
                {correct.length}/{n} correct options selected
              </span>
            </div>
          </div>
        );
      })}
    </ItemsShell>
  );
}

function FixedItemsBuilder({ group, onChange, startNumber }) {
  const values = TYPE_DEFS[group.type].values;
  return (
    <ItemsShell group={group} onChange={onChange} addLabel="Add statement">
      {group.items.map((item, i) => (
        <div className="ie-builder-item" key={item.id}>
          <ItemHead number={startNumber + i} disableRemove={group.items.length <= 1} onRemove={() => removeItem(group, onChange, item.id)} />
          <textarea className="ie-textarea" style={{ minHeight: 60 }} value={item.text} placeholder="Statement" onChange={(e) => updateItem(group, onChange, item.id, { text: e.target.value })} />
          <div className="ie-row" style={{ marginTop: 10, flexWrap: "wrap" }}>
            <span className="ie-label">Answer:</span>
            {values.map((v) => (
              <label key={v} className="ie-checkbox">
                <input type="radio" name={`fixed-${item.id}`} checked={group.answers?.[item.id]?.value === v} onChange={() => setAnswer(group, onChange, item.id, { value: v, variations: [] })} />
                {v}
              </label>
            ))}
          </div>
        </div>
      ))}
    </ItemsShell>
  );
}

function MatchingBuilder({ group, onChange, startNumber }) {
  return (
    <>
      <OptionsBlock group={group} onChange={onChange} title="Options (drag-and-drop box)" />
      <ItemsShell group={group} onChange={onChange}>
        {group.items.map((item, i) => (
          <div className="ie-builder-item" key={item.id}>
            <ItemHead number={startNumber + i} disableRemove={group.items.length <= 1} onRemove={() => removeItem(group, onChange, item.id)} />
            <input className="ie-input" value={item.text} placeholder="Question / statement" onChange={(e) => updateItem(group, onChange, item.id, { text: e.target.value })} />
            <div style={{ marginTop: 10 }}>
              <OptionAnswerCard number={startNumber + i} options={group.options || []} value={group.answers?.[item.id]} onChange={(a) => setAnswer(group, onChange, item.id, a)} />
            </div>
          </div>
        ))}
      </ItemsShell>
    </>
  );
}

function HeadingsBuilder({ group, onChange, startNumber, passageHtml }) {
  const slots = headingSlotIdsInHtml(passageHtml);
  const sync = () => {
    const byRef = new Map((group.items || []).map((it) => [it.slotRef, it]));
    const items = slots.map((ref, i) => byRef.get(ref) || newItem({ text: `Paragraph ${String.fromCharCode(65 + i)}`, slotRef: ref }));
    const keep = new Set(items.map((it) => it.id));
    const answers = Object.fromEntries(Object.entries(group.answers || {}).filter(([k]) => keep.has(k)));
    onChange({ ...group, items, answers });
  };
  return (
    <>
      <OptionsBlock group={group} onChange={onChange} style="roman" title="Headings" withReuse={false} />
      <Section
        label="Paragraphs"
        hint={`(${slots.length} heading gap${slots.length === 1 ? "" : "s"} found in the passage)`}
        action={
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={sync}>
            Sync with passage
          </Button>
        }
      >
        {!slots.length && (
          <div className="ie-qb__hint">In the Reading Content editor, put the cursor at the start of each paragraph and press Ctrl+H to add a heading gap. Then click “Sync with passage”.</div>
        )}
        <div className="ie-builder-list">
          {(group.items || []).map((item, i) => (
            <div className="ie-builder-item" key={item.id}>
              <ItemHead number={startNumber + i} onRemove={() => removeItem(group, onChange, item.id)} />
              <div className="ie-builder-grid-2">
                <input className="ie-input" value={item.text} placeholder="Label, e.g. Paragraph B" onChange={(e) => updateItem(group, onChange, item.id, { text: e.target.value })} />
                <select className="ie-select-native" value={item.slotRef || ""} onChange={(e) => updateItem(group, onChange, item.id, { slotRef: e.target.value || undefined })}>
                  <option value="">Not linked to a passage gap</option>
                  {slots.map((ref, si) => (
                    <option key={ref} value={ref}>
                      Heading gap {si + 1}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginTop: 10 }}>
                <OptionAnswerCard number={startNumber + i} options={group.options || []} value={group.answers?.[item.id]} onChange={(a) => setAnswer(group, onChange, item.id, a)} label="Correct heading" />
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function MapSelectBuilder({ group, onChange, startNumber }) {
  const count = group.options?.length || 8;
  return (
    <>
      <Section label="Map / diagram image" hint="(put the letters A, B, C… on the image itself)">
        <ImageDropzone value={group.image} onChange={(image) => onChange({ ...group, image })} />
      </Section>
      <Section label="Letters on the map">
        <select
          className="ie-select-native"
          style={{ width: 160 }}
          value={count}
          onChange={(e) => {
            const n = Number(e.target.value);
            const keys = letters(n);
            const answers = Object.fromEntries(Object.entries(group.answers || {}).filter(([, a]) => keys.includes(a?.value)));
            onChange({ ...group, options: keys.map((key) => ({ key, text: "" })), answers });
          }}
        >
          {Array.from({ length: 10 }, (_, i) => i + 3).map((n) => (
            <option key={n} value={n}>
              A–{String.fromCharCode(64 + n)} ({n})
            </option>
          ))}
        </select>
      </Section>
      <ItemsShell group={group} onChange={onChange} addLabel="Add place">
        {group.items.map((item, i) => (
          <div className="ie-builder-item" key={item.id}>
            <ItemHead number={startNumber + i} disableRemove={group.items.length <= 1} onRemove={() => removeItem(group, onChange, item.id)} />
            <div className="ie-builder-grid-2">
              <input className="ie-input" value={item.text} placeholder="Place name, e.g. Café" onChange={(e) => updateItem(group, onChange, item.id, { text: e.target.value })} />
              <select className="ie-select-native" value={group.answers?.[item.id]?.value || ""} onChange={(e) => setAnswer(group, onChange, item.id, { value: e.target.value, variations: [] })}>
                <option value="">— Correct letter —</option>
                {(group.options || []).map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.key}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </ItemsShell>
    </>
  );
}

// ---------- image + markers ----------

function MarkerCanvas({ image, markers, startNumber, onChange }) {
  const boxRef = useRef(null);
  const drag = useRef(null);

  const pos = (e) => {
    const r = boxRef.current.getBoundingClientRect();
    return { x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)) };
  };

  return (
    <div
      ref={boxRef}
      className="ie-marker-editor"
      onClick={(e) => {
        if (drag.current?.moved) return;
        const p = pos(e);
        onChange([...markers, { id: newId("m"), x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }]);
      }}
    >
      <img src={image.url} alt="" draggable={false} />
      {markers.map((m, i) => (
        <span
          key={m.id}
          className="ie-marker"
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { id: m.id, moved: false };
          }}
          onPointerMove={(e) => {
            if (!drag.current || drag.current.id !== m.id) return;
            drag.current.moved = true;
            const p = pos(e);
            onChange(markers.map((x) => (x.id === m.id ? { ...x, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 } : x)));
          }}
          onPointerUp={() => {
            setTimeout(() => (drag.current = null), 0);
          }}
        >
          {startNumber + i}
        </span>
      ))}
    </div>
  );
}

function MarkersBuilder({ group, onChange, startNumber, mode }) {
  const markers = group.markers || [];
  const setMarkers = (next) => {
    const keep = new Set(next.map((m) => m.id));
    const answers = Object.fromEntries(Object.entries(group.answers || {}).filter(([k]) => keep.has(k)));
    onChange({ ...group, markers: next, answers });
  };
  return (
    <>
      {mode === "option" && <OptionsBlock group={group} onChange={onChange} title="Options (drag-and-drop box)" />}
      <Section label="Image" hint="(click on the image to place a numbered gap; drag gaps to move them)">
        {!group.image ? (
          <ImageDropzone value={group.image} onChange={(image) => onChange({ ...group, image })} />
        ) : (
          <div>
            <MarkerCanvas image={group.image} markers={markers} startNumber={startNumber} onChange={setMarkers} />
            <div className="ie-row" style={{ marginTop: 8 }}>
              <Button variant="danger-outline" size="sm" icon={Trash2} onClick={() => onChange({ ...group, image: null, markers: [], answers: {} })}>
                Remove image
              </Button>
              <span className="ie-help">{markers.length} gap(s) placed</span>
            </div>
          </div>
        )}
      </Section>
      {markers.map((m, i) => (
        <div key={m.id} style={{ position: "relative" }}>
          {mode === "option" ? (
            <OptionAnswerCard number={startNumber + i} options={group.options || []} value={group.answers?.[m.id]} onChange={(a) => setAnswer(group, onChange, m.id, a)} />
          ) : (
            <AnswerCard number={startNumber + i} value={group.answers?.[m.id]} onChange={(a) => setAnswer(group, onChange, m.id, a)} />
          )}
          <Button
            variant="danger-outline"
            size="sm"
            icon={Trash2}
            aria-label="Remove gap"
            style={{ position: "absolute", top: 12, right: 12 }}
            onClick={() => setMarkers(markers.filter((x) => x.id !== m.id))}
          />
        </div>
      ))}
    </>
  );
}

export function TypeBuilder(props) {
  const def = TYPE_DEFS[props.group.type];
  switch (def.kind) {
    case "text-blanks":
      if (def.from === "table") return <TableBuilder {...props} />;
      if (def.from === "steps") return <StepsBuilder {...props} mode="text" />;
      return <ContentBuilder {...props} mode="text" />;
    case "option-blanks":
      if (def.from === "steps") return <StepsBuilder {...props} mode="option" />;
      return <ContentBuilder {...props} mode="option" />;
    case "text-items":
      return <ShortAnswerBuilder {...props} />;
    case "choice-items":
      return <MultipleChoiceBuilder {...props} />;
    case "multi-items":
      return <MultiAnswerBuilder {...props} />;
    case "fixed-items":
      return <FixedItemsBuilder {...props} />;
    case "option-items":
      if (props.group.type === "matching_headings") return <HeadingsBuilder {...props} />;
      if (props.group.type === "map_select") return <MapSelectBuilder {...props} />;
      return <MatchingBuilder {...props} />;
    case "text-markers":
      return <MarkersBuilder {...props} mode="text" />;
    case "option-markers":
      return <MarkersBuilder {...props} mode="option" />;
    default:
      return null;
  }
}
