import { useCallback, useEffect, useState } from "react";
import { FileText, Save } from "lucide-react";
import { getParticipantResults, saveParticipantScore } from "../api.js";
import { Modal } from "../components/Modal.jsx";
import { Button, Pill, Skeleton } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { formatBand, formatDateTime, fullName } from "../lib/format.js";
import { AttemptDetailsModal } from "./AttemptDetailsModal.jsx";
import { SECTION_META } from "./sectionMeta.js";

const TABS = ["reading", "listening", "writing", "speaking"];

function ScoreCard({ section, info, onSave }) {
  const [band, setBand] = useState(info.score?.band != null ? String(info.score.band) : "");
  const [notes, setNotes] = useState(info.score?.notes || "");
  const [saving, setSaving] = useState(false);
  const label = SECTION_META[section].label;
  const auto = section === "reading" || section === "listening";

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ band: band.trim(), notes });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ie-score-card">
      <h4>Session-level score</h4>
      <p>{label} score and notes for this session</p>
      <div className="ie-score-card__row">
        <input className="ie-input" inputMode="decimal" placeholder="e.g: 7.0" value={band} onChange={(e) => setBand(e.target.value)} aria-label={`${label} band score`} />
        <textarea className="ie-textarea" style={{ minHeight: 40 }} placeholder="Admin notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button icon={Save} loading={saving} onClick={save}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
      {auto && (
        <div className="ie-score-card__auto">
          {info.raw != null ? (
            <>
              Auto-calculated: <strong>{info.raw}/{info.total}</strong> correct → band <strong>{formatBand(info.autoBand)}</strong>.{" "}
              {info.score?.band != null ? "The score above overrides it." : "Enter a score above only if you want to override it."}
            </>
          ) : (
            "Calculated automatically once the candidate submits this section."
          )}
        </div>
      )}
    </div>
  );
}

export function ExamResultsModal({ sessionId, userId, initialTab = "reading", onClose, onSaved }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(initialTab);
  const [attemptId, setAttemptId] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await getParticipantResults(sessionId, userId));
    } catch (err) {
      toast.error("Could not load results", err.message);
    }
  }, [sessionId, userId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const saveScore = async (payload) => {
    try {
      await saveParticipantScore(sessionId, userId, tab, payload);
      toast.success(`${SECTION_META[tab].label} score saved`);
      await load();
      onSaved?.();
    } catch (err) {
      toast.error("Could not save score", err.message);
    }
  };

  const info = data?.sections?.[tab];
  const name = data ? fullName(data.user) : "";

  return (
    <>
      <Modal
        open
        width={1150}
        onClose={onClose}
        closeRing
        icon={<FileText size={20} color="var(--ie-accent-500)" style={{ marginTop: 4 }} />}
        title="User exam results"
        subtitle={data ? `${name} • ${data.session.name}` : "Loading..."}
      >
        {!data ? (
          <div style={{ display: "grid", gap: 12 }}>
            <Skeleton height={48} />
            <Skeleton height={44} />
            <Skeleton height={140} />
            <Skeleton height={120} />
          </div>
        ) : (
          <>
            <div className="ie-results-head">
              <span>
                <strong>{name}</strong> <span className="ie-muted">• {data.user.email || data.user.phone || "no email"}</span>
              </span>
              <span className="ie-row">
                <span className="ie-muted">Overall band:</span>
                <strong style={{ color: "var(--ie-accent-500)", fontSize: 16 }}>{formatBand(data.overall)}</strong>
                <Pill tone="outline" round>
                  {data.session.name}
                </Pill>
              </span>
            </div>
            <div className="ie-tabs">
              {TABS.map((t) => {
                const Icon = SECTION_META[t].icon;
                return (
                  <button key={t} type="button" className={`ie-tabs__tab ${t === tab ? "ie-tabs__tab--active" : ""}`} onClick={() => setTab(t)}>
                    <Icon />
                    {SECTION_META[t].label}
                  </button>
                );
              })}
            </div>
            <ScoreCard key={`${tab}-${info.score?.updatedAt || ""}`} section={tab} info={info} onSave={saveScore} />
            {tab === "speaking" ? (
              <p className="ie-muted">No attempt details for speaking. Use the fields above to record the session-level speaking score.</p>
            ) : (
              <div className="ie-table-wrap">
                <table className="ie-table">
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>Attempt</th>
                      <th>Title</th>
                      <th>Meta</th>
                      <th>Completed</th>
                      <th style={{ width: 110 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.attempts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="ie-empty">
                          The candidate has not submitted this section yet.
                        </td>
                      </tr>
                    )}
                    {info.attempts.map((a, i) => (
                      <tr key={a.id}>
                        <td>{info.attempts.length - i}</td>
                        <td style={{ fontWeight: 500 }}>{a.title}</td>
                        <td className="ie-muted">{a.meta}</td>
                        <td className="ie-muted">{formatDateTime(a.completedAt)}</td>
                        <td>
                          <Button variant="outline" size="sm" onClick={() => setAttemptId(a.id)}>
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Modal>
      {attemptId && <AttemptDetailsModal attemptId={attemptId} onClose={() => setAttemptId(null)} />}
    </>
  );
}
