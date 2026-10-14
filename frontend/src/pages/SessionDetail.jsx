import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSession, startSession, addParticipant, removeParticipant, reinstateParticipant, searchUsers, adminDownloadSessionCsv } from "../api.js";
import Icon from "../components/Icon.jsx";
import { useAdminAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { useConfirm } from "../components/Confirm.jsx";
import { SkeletonAdminDetail } from "../components/SkeletonAdmin.jsx";
import useBackdropClose from "../components/useBackdropClose.js";
import { studioPath } from "../studio/panels.js";
import { useStudio } from "../studio/useStudio.js";

const MODULE_STATUS = {
  not_started: <span className="badge badge-muted">Not started</span>,
  in_progress: <span className="badge badge-warn">In progress</span>,
  completed: <span className="badge badge-good">Completed</span>
};

export default function SessionDetail() {
  const { sessionId } = useParams();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const [session, setSession] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [starting, setStarting] = useState(false);

  // A failed request must not leave the skeleton up forever or vanish as an unhandled rejection.
  async function load() {
    try {
      setSession(await getSession(token, sessionId));
      setLoadError("");
    } catch (e) {
      setLoadError(e.message || "Couldn't load this session");
      toast.error(e.message || "Couldn't load this session");
    }
  }

  useEffect(() => {
    setSession(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleStart() {
    setStarting(true);
    try {
      await startSession(token, sessionId);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setStarting(false);
    }
  }

  async function handleRemove(participantId) {
    if (!(await askConfirm({ title: "Remove this participant?", message: "Their answers in this session are deleted too.", confirmLabel: "Remove" }))) return;
    try {
      await removeParticipant(token, sessionId, participantId);
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  // A sitting cancelled because the student left the test page (lock/useExamLock.js) stays closed
  // until a teacher decides otherwise.
  async function handleReinstate(p) {
    const name = `${p.user.firstName} ${p.user.lastName}`.trim();
    const ok = await askConfirm({
      title: `Let ${name} back in?`,
      message: `Their test was cancelled because they ${p.cancelled.reason}${p.cancelled.moduleName ? ` during ${p.cancelled.moduleName}` : ""}. They carry on in that module with the time they had left.`,
      confirmLabel: "Let back in"
    });
    if (!ok) return;
    try {
      await reinstateParticipant(token, sessionId, p.id);
      toast.success(`${name} can open the test again.`);
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  if (!session) {
    return loadError ? (
      <div className="card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Couldn't load this session</h2>
        <p style={{ color: "var(--ink-soft)" }}>{loadError}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={load}>
            Try again
          </button>
          <Link to={studioPath("/sessions")} className="btn btn-secondary">
            Back to sessions
          </Link>
        </div>
      </div>
    ) : (
      <SkeletonAdminDetail />
    );
  }

  return (
    <div>
      <Link to={studioPath("/sessions")} className="ad-link" style={{ marginBottom: 14, display: "inline-flex" }}>
        <Icon name="arrowLeft" size={14} /> Back to sessions
      </Link>

      <div className="page-header">
        <div>
          <h1>{session.name}</h1>
          <p>
            {session.testTitle} · {session.participants.length}/{session.studentLimit} candidates
            {session.status === "created" && " · not started"}
            {session.status === "started" && " · in progress"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            onClick={() => adminDownloadSessionCsv(token, sessionId, `${session.name.replace(/[^a-z0-9-_]+/gi, "_")}_results.csv`).catch((e) => toast.error(e.message))}
            disabled={session.participants.length === 0}
          >
            <Icon name="download" size={16} /> Export CSV
          </button>
          {session.status === "created" && (
            <button className="btn btn-primary" onClick={handleStart} disabled={starting || session.participants.length === 0}>
              <Icon name="play" size={15} /> {starting ? "Starting…" : "Start session"}
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowAdd(true)} disabled={session.participants.length >= session.studentLimit}>
            <Icon name="plus" size={15} /> Add participants
          </button>
        </div>
      </div>

      {session.status === "created" && session.participants.length === 0 && (
        <div className="empty-state card" style={{ marginBottom: 16 }}>
          Add at least one candidate, then start the session so their Candidate ID can log in.
        </div>
      )}

      {session.participants.length > 0 && (
        <div className="ad-scroll-x">
        <table className="result-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Candidate ID</th>
              {session.modules.map((m) => (
                <th key={m.id}>{m.name}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {session.participants.map((p) => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    {p.user.firstName} {p.user.lastName}
                  </div>
                  <div style={{ color: "var(--ink-soft)", fontSize: 12 }}>{p.user.email}</div>
                  {p.cancelled && (
                    <div className="exam-cancelled" role="status">
                      <Icon name="warning" size={16} />
                      <div>
                        <strong>Cancelled: {p.cancelled.reason}</strong>
                        {p.cancelled.moduleName ? `During ${p.cancelled.moduleName}, ` : ""}
                        {new Date(p.cancelled.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.
                        {p.letBackIn > 0 && ` Already let back in ${p.letBackIn === 1 ? "once" : `${p.letBackIn} times`}.`}
                        <br />
                        <button className="btn btn-secondary btn-sm" onClick={() => handleReinstate(p)}>
                          Let back in
                        </button>
                      </div>
                    </div>
                  )}
                  {!p.cancelled && p.letBackIn > 0 && (
                    <div style={{ color: "var(--warn)", fontSize: 12, marginTop: 3 }}>Left the test and was let back in {p.letBackIn === 1 ? "once" : `${p.letBackIn} times`}</div>
                  )}
                </td>
                <td>{p.user.candidateId}</td>
                {p.modules.map((m) => (
                  <td key={m.moduleId}>
                    {p.cancelled && m.status !== "completed" ? <span className="badge badge-hard">Cancelled</span> : MODULE_STATUS[m.status]}
                    {m.status === "completed" && (
                      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 3 }}>
                        {m.raw}/{m.max}
                      </div>
                    )}
                  </td>
                ))}
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link className="btn btn-secondary btn-sm" to={studioPath(`/sessions/${sessionId}/participants/${p.id}`)}>
                    View
                  </Link>{" "}
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemove(p.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {showAdd && (
        <AddParticipantsModal
          token={token}
          sessionId={sessionId}
          onClose={() => setShowAdd(false)}
          onAdded={load}
        />
      )}
    </div>
  );
}

function AddParticipantsModal({ token, sessionId, onClose, onAdded }) {
  const [query, setQuery] = useState("");
  // The search results remember which query they answer, so a slow reply for an older query can
  // never overwrite a newer one, and "No matching user" only shows once the search has finished.
  const [found, setFound] = useState({ q: "", list: [] });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const submitting = useRef(false);
  // A teacher picks from the students of the classes; making a new account is the admin's.
  const { isAdmin } = useStudio();
  const [addedIds, setAddedIds] = useState([]);
  const [createdCred, setCreatedCred] = useState(null);
  const backdrop = useBackdropClose(onClose);

  const term = query.trim();
  const results = term ? found.list : [];
  const searched = term !== "" && found.q === term;

  useEffect(() => {
    if (!term) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const list = await searchUsers(token, term);
        if (!cancelled) setFound({ q: term, list });
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, token]);

  async function handleAddExisting(userId) {
    setBusyId(userId);
    setError("");
    try {
      await addParticipant(token, sessionId, { userId });
      setAddedIds((prev) => [...prev, userId]);
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateAndAdd(e) {
    e.preventDefault();
    if (submitting.current) return; // a second submit before the first answers would only add an error
    if (!newUser.firstName.trim() || !newUser.email.trim()) {
      setError("First name and email are required.");
      return;
    }
    submitting.current = true;
    setError("");
    setCreating(true);
    try {
      const result = await addParticipant(token, sessionId, newUser);
      // An email that already belongs to a student just links them: no new account, no password.
      if (result.tempPassword) {
        setCreatedCred({ email: newUser.email, password: result.tempPassword, candidateId: result.user.candidateId });
      }
      setNewUser({ firstName: "", lastName: "", email: "", phone: "" });
      setShowCreateForm(false);
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      submitting.current = false;
      setCreating(false);
    }
  }

  return (
    <div className="modal-backdrop" {...backdrop}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add participants</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>

        {createdCred && (
          <div className="card" style={{ background: "var(--good-soft)", borderColor: "#bfe8d4", marginBottom: 16 }}>
            <strong style={{ color: "var(--good)" }}>Account created — share these with the student:</strong>
            <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.7 }}>
              Email: <code>{createdCred.email}</code>
              <br />
              Temp password: <code>{createdCred.password}</code>
              <br />
              Candidate ID: <code>{createdCred.candidateId}</code>
            </div>
          </div>
        )}

        <div className="field">
          <label>{isAdmin ? "Search by name or email" : "Search the students of your classes"}</label>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing…" />
        </div>

        {results.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {results.map((u) => {
              const added = addedIds.includes(u.id);
              return (
                <div key={u.id} className="list-row" style={{ padding: "10px 14px", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {u.firstName} {u.lastName}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{u.email}</div>
                  </div>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={added || busyId === u.id}
                    onClick={() => handleAddExisting(u.id)}
                  >
                    {added ? "Added" : busyId === u.id ? "Adding…" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {searched && results.length === 0 && (
          <p className="hint" style={{ marginBottom: 12 }}>
            {isAdmin ? (
              <>
                No matching user.{" "}
                <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0 }} onClick={() => setShowCreateForm(true)}>
                  Create new user →
                </button>
              </>
            ) : (
              "No student in the classes matches. A student appears here once they have an account and have picked their grade."
            )}
          </p>
        )}

        {showCreateForm && (
          <form onSubmit={handleCreateAndAdd} className="card" style={{ marginTop: 6 }}>
            <div className="field-row">
              <div className="field">
                <label>First name</label>
                <input value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} />
              </div>
              <div className="field">
                <label>Last name</label>
                <input value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Email</label>
                <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div className="field">
                <label>Phone (optional)</label>
                <input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-primary btn-sm" type="submit" disabled={creating}>
              {creating ? "Adding…" : "Create and add"}
            </button>
          </form>
        )}

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
