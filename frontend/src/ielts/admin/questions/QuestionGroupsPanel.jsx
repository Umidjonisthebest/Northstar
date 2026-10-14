import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, SquarePen, Trash2 } from "lucide-react";
import { Button } from "../../components/ui.jsx";
import { ConfirmDialog } from "../../components/Modal.jsx";
import { questionRangeLabel, slotCount, TYPE_DEFS } from "../../lib/questionTypes.js";
import { QuestionBuilderModal } from "./QuestionBuilderModal.jsx";
import { groupPreviewText } from "./validate.js";

export function QuestionGroupsPanel({ kind, title, groups, onChange, startNumber, passageHtml }) {
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  const starts = [];
  let running = startNumber;
  for (const g of groups) {
    starts.push(running);
    running += slotCount(g);
  }
  const total = running - startNumber;

  const save = (group) => {
    if (editing.index === -1) onChange([...groups, group]);
    else onChange(groups.map((g, i) => (i === editing.index ? group : g)));
    setEditing(null);
  };

  const move = (i, delta) => {
    const next = [...groups];
    const [g] = next.splice(i, 1);
    next.splice(i + delta, 0, g);
    onChange(next);
  };

  return (
    <div>
      <div className="ie-questions-head">
        <h3>
          {title} ({total})
        </h3>
        <Button icon={Plus} onClick={() => setEditing({ index: -1 })}>
          Add Question
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="ie-questions-empty">
          <div>No questions added yet</div>
          <Button icon={Plus} onClick={() => setEditing({ index: -1 })}>
            Add First Question
          </Button>
        </div>
      ) : (
        groups.map((g, i) => {
          const count = slotCount(g);
          const numbers = Array.from({ length: count }, (_, k) => starts[i] + k);
          return (
            <div className="ie-qgroup-card" key={g.id}>
              <div className="ie-qgroup-card__head">
                <span className="ie-qgroup-card__range">{questionRangeLabel(numbers) || "No questions"}</span>
                <span className="ie-type-chip">{TYPE_DEFS[g.type]?.label}</span>
                <div className="ie-qgroup-card__actions">
                  <Button variant="ghost" size="sm" icon={ArrowUp} aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
                  <Button variant="ghost" size="sm" icon={ArrowDown} aria-label="Move down" disabled={i === groups.length - 1} onClick={() => move(i, 1)} />
                  <Button variant="outline" size="sm" icon={SquarePen} aria-label="Edit" onClick={() => setEditing({ index: i })} />
                  <Button variant="danger" size="sm" icon={Trash2} aria-label="Delete" onClick={() => setRemoving(i)} />
                </div>
              </div>
              <div className="ie-qgroup-card__preview">{groupPreviewText(g)}</div>
            </div>
          );
        })
      )}

      {editing && (
        <QuestionBuilderModal
          kind={kind}
          initial={editing.index === -1 ? null : groups[editing.index]}
          startNumber={editing.index === -1 ? running : starts[editing.index]}
          passageHtml={passageHtml}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title="Delete these questions?"
        message="The question block and its answers will be removed from this part."
        confirmLabel="Delete"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          onChange(groups.filter((_, i) => i !== removing));
          setRemoving(null);
        }}
      />
    </div>
  );
}
