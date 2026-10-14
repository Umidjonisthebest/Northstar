import { useCallback, useEffect, useState } from "react";
import { FileText, TriangleAlert, UserMinus, Users, X } from "lucide-react";
import { getParticipant, reinstateParticipant, removeParticipant } from "../api.js";
import { ConfirmDialog, Drawer } from "../components/Modal.jsx";
import { Button, Skeleton } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { formatBand, formatDateTime, fullName } from "../lib/format.js";
import { useLatest } from "../lib/hooks.js";
import { ExamResultsModal } from "./ExamResultsModal.jsx";
import { SECTION_META } from "./sectionMeta.js";

const ORDER = ["reading", "listening", "writing", "speaking"];

export function ParticipantDrawer({ sessionId, userId, onClose, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [resultsTab, setResultsTab] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmBack, setConfirmBack] = useState(false);
  const [lettingBack, setLettingBack] = useState(false);
  const onCloseRef = useLatest(onClose);

  const load = useCallback(async () => {
    try {
      setData(await getParticipant(sessionId, userId));
    } catch (err) {
      toast.error("Could not load participant", err.message);
      onCloseRef.current();
    }
  }, [sessionId, userId, toast, onCloseRef]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    setRemoving(true);
    try {
      await removeParticipant(sessionId, userId);
      toast.success("Participant removed from the session");
      onChanged();
      onClose();
    } catch (err) {
      toast.error("Could not remove participant", err.message);
      setConfirmRemove(false);
    } finally {
      setRemoving(false);
    }
  };

  // An exam cancelled because the candidate left the test page stays closed until a teacher decides otherwise.
  const letBackIn = async () => {
    setLettingBack(true);
    try {
      await reinstateParticipant(sessionId, userId);
      toast.success("The candidate can open the test again");
      await load();
      onChanged();
    } catch (err) {
      toast.error("Could not let the candidate back in", err.message);
    } finally {
      setLettingBack(false);
      setConfirmBack(false);
    }
  };

  // The server refuses once the candidate has started; this just hides the button for finished sections.
  const canRemove = data && !["listening", "reading", "writing"].some((s) => data.sections[s].completed);

  return (
    <Drawer open onClose={onClose} width={620}>
      <div className="ie-drawer__head">
        <div style={{ flex: 1 }}>
          <h2>
            <Users />
            Participant overview
          </h2>
          <p>The user's section status within the session</p>
        </div>
        <button type="button" className="ie-modal__close ie-modal__close--ring" onClick={onClose} aria-label="Close">
          <X />
        </button>
      </div>
      <div className="ie-drawer__body">
        {!data ? (
          <>
            <Skeleton height={76} />
            {ORDER.map((s) => (
              <Skeleton key={s} height={86} />
            ))}
          </>
        ) : (
          <>
            <div className="ie-user-card">
              <span className="ie-avatar ie-avatar--lg">{data.user.firstName?.[0]}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3>{fullName(data.user)}</h3>
                <p>{data.user.email || data.user.phone || "No email"}</p>
                <p style={{ fontSize: 12 }}>Candidate ID: {data.user.candidateId}</p>
              </div>
              <div className="ie-section-card__score">
                <small>Overall</small>
                <strong>{formatBand(data.overall)}</strong>
              </div>
            </div>
            {data.cancelled && (
              <div className="ie-cancelled-note" role="status">
                <TriangleAlert />
                <div>
                  <strong>This exam was cancelled</strong>
                  The candidate {data.cancelled.reason}
                  {data.cancelled.section ? ` during ${SECTION_META[data.cancelled.section]?.label || data.cancelled.section}` : ""}, {formatDateTime(data.cancelled.at)}. That section is not
                  marked, and they can't open the test.
                  {data.letBackIn > 0 && ` They have already been let back in ${data.letBackIn === 1 ? "once" : `${data.letBackIn} times`}.`}
                  <div>
                    <Button variant="outline" size="sm" onClick={() => setConfirmBack(true)}>
                      Let back in
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {ORDER.map((s) => {
              const meta = SECTION_META[s];
              const Icon = meta.icon;
              const st = data.sections[s];
              return (
                <div className="ie-section-card" key={s}>
                  <div style={{ minWidth: 0 }}>
                    <div className="ie-section-card__title">
                      <Icon />
                      {meta.label}
                    </div>
                    <div className="ie-section-card__status">
                      <span className={`ie-pill ie-pill--round ${st.completed ? "ie-pill--gray" : "ie-pill--outline"}`}>{st.completed ? "Completed" : "Not completed"}</span>
                      {st.completedAt && <span>{formatDateTime(st.completedAt)}</span>}
                    </div>
                  </div>
                  <div className="ie-section-card__score">
                    <small>Score</small>
                    <strong>{formatBand(st.band)}</strong>
                  </div>
                  <Button variant="outline" size="sm" icon={FileText} className="ie-btn--hover-accent" onClick={() => setResultsTab(s)}>
                    View
                  </Button>
                </div>
              );
            })}
            {canRemove && (
              <div style={{ marginTop: 8 }}>
                <Button variant="danger-outline" size="sm" icon={UserMinus} onClick={() => setConfirmRemove(true)}>
                  Remove from session
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      {resultsTab && (
        <ExamResultsModal
          sessionId={sessionId}
          userId={userId}
          initialTab={resultsTab}
          onClose={() => setResultsTab(null)}
          onSaved={() => {
            load();
            onChanged();
          }}
        />
      )}
      <ConfirmDialog
        open={confirmRemove}
        title="Remove this participant?"
        message="They will no longer be able to log in to this session."
        confirmLabel="Remove"
        busy={removing}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={remove}
      />
      <ConfirmDialog
        open={confirmBack}
        title="Let this candidate back in?"
        message="They carry on in the section they left, with the time they had left."
        confirmLabel="Let back in"
        busy={lettingBack}
        onCancel={() => setConfirmBack(false)}
        onConfirm={letBackIn}
      />
    </Drawer>
  );
}
