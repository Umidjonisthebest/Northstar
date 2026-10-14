import { Fragment } from "react";
import { ArrowDown } from "lucide-react";
import { RichHtml } from "../../lib/richHtml.jsx";
import { questionRangeLabel, TYPE_DEFS } from "../../lib/questionTypes.js";
import { useExam } from "../ExamContext.jsx";
import { ChoiceItem, DropZone, FlagButton, GapInput, MultiItem, OptionsBank, QNum, Reveal } from "./controls.jsx";

function Blanks({ group, html, mode, className = "" }) {
  return (
    <RichHtml
      html={html}
      className={`ie-q-content ${className}`}
      renderBlank={(id) =>
        mode === "text" ? (
          <GapInput slotId={id} />
        ) : (
          <>
            <DropZone group={group} slotId={id} />
            <Reveal slotId={id} group={group} />
          </>
        )
      }
    />
  );
}

function TableGroup({ group }) {
  const { columns = [], rows = [] } = group.table || {};
  const hasHeader = columns.some((c) => c.header?.trim());
  return (
    <div className="ie-q-table-wrap">
      <table className="ie-q-table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{ width: c.width || undefined }}>
                {hasHeader ? c.header : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c}>
                  <Blanks group={group} html={cell.html} mode="text" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowGroup({ group, mode }) {
  const steps = group.steps || [];
  return (
    <>
      {mode === "option" && <OptionsBank group={group} />}
      <div className="ie-flow">
        {steps.map((step, i) => (
          <Fragment key={i}>
            <div className="ie-flow__box">
              <Blanks group={group} html={step.html} mode={mode} />
            </div>
            {i < steps.length - 1 && (
              <div className="ie-flow__arrow" aria-hidden="true">
                <ArrowDown />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </>
  );
}

function MatchingRows({ group, items }) {
  const { numberOf } = useExam();
  return (
    <div className="ie-match-list">
      {items.map((item) => (
        <div className="ie-match-row" key={item.id}>
          <QNum>{numberOf.get(item.id)}</QNum>
          <span className="ie-match-text">{item.text}</span>
          <DropZone group={group} slotId={item.id} />
          <FlagButton slotId={item.id} />
          <Reveal slotId={item.id} group={group} />
        </div>
      ))}
    </div>
  );
}

function MapSelectGroup({ group }) {
  const { answers, setAnswer, numberOf, setCurrent, locked } = useExam();
  const letters = (group.options || []).map((o) => o.key);
  return (
    <>
      {group.image?.url && <img className="ie-map-img" src={group.image.url} alt="Map" />}
      <div className="ie-q-table-wrap">
        <table className="ie-map-grid">
          <thead>
            <tr>
              <th />
              {letters.map((l) => (
                <th key={l}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.items.map((item) => {
              const n = numberOf.get(item.id);
              return (
                <tr key={item.id} data-q={n}>
                  <td className="ie-map-grid__label">
                    <QNum>{n}</QNum>
                    <span>{item.text}</span>
                    <FlagButton slotId={item.id} />
                    <Reveal slotId={item.id} />
                  </td>
                  {letters.map((l) => (
                    <td key={l}>
                      <label className="ie-map-cell" aria-label={`Question ${n}: ${l}`}>
                        <input type="radio" name={`map-${item.id}`} checked={answers[item.id] === l} disabled={locked} onChange={() => setAnswer(item.id, l)} onFocus={() => setCurrent(item.id)} />
                        <span className="ie-radio" aria-hidden="true" />
                      </label>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DiagramGroup({ group, mode }) {
  return (
    <>
      <div className="ie-diagram">
        {group.image?.url && <img src={group.image.url} alt="Diagram" draggable={false} />}
        {(group.markers || []).map((m) => (
          <div key={m.id} className="ie-diagram__spot" style={{ left: `${m.x}%`, top: `${m.y}%` }}>
            {mode === "text" ? (
              <GapInput slotId={m.id} />
            ) : (
              <>
                <DropZone group={group} slotId={m.id} />
                <Reveal slotId={m.id} group={group} />
              </>
            )}
          </div>
        ))}
      </div>
      {mode === "option" && <OptionsBank group={group} />}
    </>
  );
}

// headingTargets: set of heading-slot ids that exist in the passage (their
// drop zones are rendered inside the passage instead of here).
export function QuestionGroupView({ group, headingSlots }) {
  const { numberOf } = useExam();
  const def = TYPE_DEFS[group.type];
  const numbers = group.slots.map((s) => s.n);
  let body = null;

  switch (def?.kind) {
    case "text-blanks":
      if (def.from === "table") body = <TableGroup group={group} />;
      else if (def.from === "steps") body = <FlowGroup group={group} mode="text" />;
      else body = <Blanks group={group} html={group.contentHtml} mode="text" />;
      break;
    case "option-blanks":
      if (def.from === "steps") body = <FlowGroup group={group} mode="option" />;
      else
        body = (
          <>
            <Blanks group={group} html={group.contentHtml} mode="option" />
            <OptionsBank group={group} />
          </>
        );
      break;
    case "text-items":
      body = group.items.map((item) => {
        const n = numberOf.get(item.id);
        return (
          <div className="ie-q-item" key={item.id}>
            <div className="ie-q-head">
              <QNum>{n}</QNum>
              <span className="ie-q-text">{item.text}</span>
            </div>
            <div className="ie-short-answer">
              <GapInput slotId={item.id} wide />
            </div>
          </div>
        );
      });
      break;
    case "choice-items":
      body = group.items.map((item) => <ChoiceItem key={item.id} slotId={item.id} text={item.text} options={item.options} />);
      break;
    case "fixed-items": {
      const options = def.values.map((v) => ({ key: v, text: v }));
      body = group.items.map((item) => <ChoiceItem key={item.id} slotId={item.id} text={item.text} options={options} />);
      break;
    }
    case "multi-items":
      body = group.items.map((item) => (
        <MultiItem
          key={item.id}
          item={item}
          slots={group.slots.filter((s) => s.itemId === item.id)}
        />
      ));
      break;
    case "option-items":
      if (group.type === "map_select") body = <MapSelectGroup group={group} />;
      else if (group.type === "matching_headings") {
        const loose = group.items.filter((it) => !it.slotRef || !headingSlots?.has(it.slotRef));
        body = (
          <>
            <OptionsBank group={group} />
            {loose.length > 0 && <MatchingRows group={group} items={loose} />}
          </>
        );
      } else
        body = (
          <>
            <OptionsBank group={group} />
            <MatchingRows group={group} items={group.items} />
          </>
        );
      break;
    case "text-markers":
      body = <DiagramGroup group={group} mode="text" />;
      break;
    case "option-markers":
      body = <DiagramGroup group={group} mode="option" />;
      break;
    default:
      body = null;
  }

  return (
    <section className="ie-qgroup">
      <h3 className="ie-qgroup__title">{questionRangeLabel(numbers)}</h3>
      {group.instructionHtml && <RichHtml html={group.instructionHtml} className="ie-qgroup__instruction" />}
      {body}
    </section>
  );
}
