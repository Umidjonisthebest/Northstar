import { useState } from "react";
import { CircleAlert, Save } from "lucide-react";
import { Modal } from "../../components/Modal.jsx";
import { RichEditor } from "../../components/RichEditor.jsx";
import { Select } from "../../components/Select.jsx";
import { Button, Pill } from "../../components/ui.jsx";
import { slotCount, TYPE_DEFS, typeOptions } from "../../lib/questionTypes.js";
import { TypeBuilder, convertGroup, emptyGroup } from "./builders.jsx";
import { validateGroup } from "./validate.js";

// "Savol yaratish" (create question) — labels kept in Uzbek as in the original admin.
export function QuestionBuilderModal({ kind, initial, startNumber, passageHtml, onClose, onSave }) {
  const [group, setGroup] = useState(() => (initial ? structuredClone(initial) : emptyGroup(kind === "reading" ? "tfng" : "note_completion")));
  const [instructionTouched, setInstructionTouched] = useState(Boolean(initial));
  const [error, setError] = useState("");
  const def = TYPE_DEFS[group.type];

  const changeType = (type) => {
    if (type === group.type) return;
    setGroup(convertGroup(group, type, instructionTouched));
    setError("");
  };

  const save = () => {
    const message = validateGroup(group, startNumber);
    if (message) {
      setError(message);
      return;
    }
    onSave(group);
  };

  return (
    <Modal
      open
      width={940}
      className="ie-qb"
      title={initial ? "Savolni tahrirlash" : "Savol yaratish"}
      headerExtra={<span className="ie-type-chip">{def.label}</span>}
      onClose={onClose}
      closeOnOverlay={false}
      footerBordered
      footer={
        <>
          {error && (
            <span className="ie-help ie-help--error ie-row" style={{ marginRight: "auto", fontSize: 13 }}>
              <CircleAlert size={16} /> {error}
            </span>
          )}
          <Button variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button icon={Save} onClick={save}>
            {initial ? "Saqlash" : "Yaratish"}
          </Button>
        </>
      }
    >
      <div className="ie-qb__chips">
        <Pill tone="solid-accent" round size="lg">
          Initial question Number - {startNumber}
        </Pill>
        <Pill tone="solid-accent" round size="lg">
          Questions count - {slotCount(group)}
        </Pill>
      </div>

      <div className="ie-qb__section">
        <label className="ie-label" style={{ display: "block", marginBottom: 8 }}>
          Question Type
        </label>
        <Select value={group.type} onChange={changeType} options={typeOptions(kind)} />
        <div className="ie-qb__hint">{def.helper}</div>
      </div>

      <div className="ie-qb__section">
        <label className="ie-label" style={{ display: "block", marginBottom: 8 }}>
          Instruction (optional)
        </label>
        <RichEditor
          value={group.instructionHtml || ""}
          placeholder="Special instructions for this question"
          minHeight={80}
          onChange={(html) => {
            setInstructionTouched(true);
            setGroup((g) => ({ ...g, instructionHtml: html }));
          }}
        />
      </div>

      <TypeBuilder
        group={group}
        onChange={(g) => {
          setGroup(g);
          setError("");
        }}
        startNumber={startNumber}
        passageHtml={passageHtml}
        kind={kind}
      />
    </Modal>
  );
}
