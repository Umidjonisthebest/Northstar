import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { getAttempt } from "../api.js";
import { Modal } from "../components/Modal.jsx";
import { Skeleton } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { formatDateTime } from "../lib/format.js";
import { useLatest } from "../lib/hooks.js";
import { RichHtml } from "../lib/richHtml.jsx";
import { TYPE_DEFS } from "../lib/questionTypes.js";
import { WritingTaskView } from "../exam/WritingTaskView.jsx";

// slotId -> option list, so option keys can be shown with their text.
function optionLookup(part) {
  const map = new Map();
  for (const g of part?.groups || []) {
    const fixed = TYPE_DEFS[g.type]?.values?.map((v) => ({ key: v, text: "" }));
    for (const s of g.slots || []) {
      if (s.mode === "multi") map.set(s.id, g.items?.find((i) => i.id === s.itemId)?.options || []);
      else if (s.mode === "option") map.set(s.id, g.items?.find((i) => i.id === s.id)?.options || fixed || g.options || []);
    }
  }
  return map;
}

function describe(options, value) {
  if (!value) return "";
  if (!options) return value;
  const opt = options.find((o) => String(o.key).toUpperCase() === String(value).toUpperCase());
  return opt?.text ? `${opt.key} — ${opt.text}` : value;
}

function ReviewTable({ part, review }) {
  const lookup = useMemo(() => optionLookup(part), [part]);
  const correct = review.filter((r) => r.correct).length;
  return (
    <div>
      <div className="ie-row" style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 16 }}>Answers</strong>
        <span className="ie-spacer" />
        <span className="ie-pill ie-pill--round ie-pill--gray ie-pill--lg">
          Correct: {correct}/{review.length}
        </span>
      </div>
      <table className="ie-table ie-review-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Candidate answer</th>
            <th>Correct answer</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {review.map((r) => {
            const opts = lookup.get(r.slotId);
            return (
              <tr key={r.slotId}>
                <td style={{ fontWeight: 600 }}>{r.n}</td>
                <td>{r.given ? describe(opts, r.given) : <span className="ie-muted">No answer</span>}</td>
                <td>{r.expected.map((e) => describe(opts, e)).join(" / ")}</td>
                <td>{r.correct ? <Check className="ie-review-ok" size={18} /> : <X className="ie-review-bad" size={18} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AttemptDetailsModal({ attemptId, onClose }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const onCloseRef = useLatest(onClose);

  useEffect(() => {
    getAttempt(attemptId)
      .then(setData)
      .catch((err) => {
        toast.error("Could not load attempt", err.message);
        onCloseRef.current();
      });
  }, [attemptId, toast, onCloseRef]);

  const a = data?.attempt;
  const part = data?.part;

  return (
    <Modal open width={1150} onClose={onClose} closeRing title="Attempt details" subtitle={a ? `${a.title}${data.user ? ` • ${data.user.name}` : ""}` : "Loading..."}>
      {!data ? (
        <div className="ie-attempt-split">
          <Skeleton height={360} />
          <Skeleton height={360} />
        </div>
      ) : !part ? (
        <p className="ie-muted">The content of this attempt is no longer available.</p>
      ) : (
        <div className="ie-attempt-split">
          <div>
            {a.section === "writing" && <WritingTaskView task={part} />}
            {a.section === "reading" && (
              <div className="ie-attempt-passage">
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{part.title}</h3>
                <RichHtml html={part.contentHtml} renderHeadingSlot={() => <div className="ie-heading-gap-static">Heading gap</div>} />
              </div>
            )}
            {a.section === "listening" && (
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>{part.title}</h3>
                {part.audioUrl ? <audio controls preload="none" src={part.audioUrl} style={{ width: "100%" }} /> : <p className="ie-muted">No audio file.</p>}
                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  {part.groups.map((g) => (
                    <div key={g.id} className="ie-qgroup-card">
                      <div className="ie-qgroup-card__head">
                        <span className="ie-qgroup-card__range">
                          Questions {g.slots[0]?.n}
                          {g.slots.length > 1 ? `-${g.slots[g.slots.length - 1].n}` : ""}
                        </span>
                        <span className="ie-type-chip">{TYPE_DEFS[g.type]?.label}</span>
                      </div>
                      <RichHtml html={g.instructionHtml} className="ie-muted" style={{ marginTop: 6, fontSize: 13 }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            {a.section === "writing" ? (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 600 }}>Task {a.partNumber}</h3>
                <p className="ie-muted" style={{ margin: "6px 0 12px", fontSize: 13 }}>
                  Completed • Started: {formatDateTime(a.startedAt)} • Completed: {formatDateTime(a.completedAt)}
                </p>
                <textarea className="ie-textarea ie-essay" readOnly value={a.essay || ""} />
                <div style={{ textAlign: "right", marginTop: 8, fontWeight: 500 }}>Words: {a.words ?? 0}</div>
              </>
            ) : (
              <>
                <p className="ie-muted" style={{ marginBottom: 12, fontSize: 13 }}>
                  Completed • Started: {formatDateTime(a.startedAt)} • Completed: {formatDateTime(a.completedAt)}
                </p>
                <ReviewTable part={part} review={data.review} />
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
