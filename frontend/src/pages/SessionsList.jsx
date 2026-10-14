import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSessions, createSession, listTests } from "../api.js";
import { useAdminAuth } from "../context/AuthContext.jsx";
import Icon from "../components/Icon.jsx";
import { SkeletonAdminList } from "../components/SkeletonAdmin.jsx";
import useBackdropClose from "../components/useBackdropClose.js";
import { studioPath } from "../studio/panels.js";

const STATUS_BADGE = {
  created: <span className="badge badge-muted">Not started</span>,
  started: <span className="badge badge-warn">In progress</span>,
  completed: <span className="badge badge-good">Completed</span>
};

export default function SessionsList() {
  const { token } = useAdminAuth();
  const [sessions, setSessions] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // A failed request must not leave the skeleton up forever or vanish as an unhandled rejection.
  async function load() {
    try {
      setSessions(await listSessions(token));
      setLoadError("");
    } catch (e) {
      setLoadError(e.message || "Couldn't load the sessions");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* Shown inside SAT > Practice tests > Teacher mocks (pages/admin/SatTests.jsx), beside the tests. */}
      <div className="ad-bar-row">
        <p>A session is one sitting of a teacher mock: schedule it, add the candidates, and start the exam clock.</p>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={16} /> New session
        </button>
      </div>

      {sessions === null && loadError && (
        <div className="card" style={{ maxWidth: 480 }}>
          <h2 style={{ marginTop: 0 }}>Couldn't load the sessions</h2>
          <p style={{ color: "var(--ink-soft)" }}>{loadError}</p>
          <button className="btn btn-primary" onClick={load}>
            Try again
          </button>
        </div>
      )}
      {sessions === null && !loadError && <SkeletonAdminList />}
      {sessions?.length === 0 && <div className="empty-state card">No sessions yet.</div>}

      {sessions?.map((s) => (
        <Link to={studioPath(`/sessions/${s.id}`)} key={s.id} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="list-row">
            <div className="ad-row-main">
              <span className={`ad-test-icon ${s.status === "started" ? "tone-rose" : s.status === "completed" ? "tone-green" : "tone-indigo"}`}>
                <Icon name={s.status === "started" ? "play" : s.status === "completed" ? "success" : "calendar"} size={22} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="list-row-title">
                  {s.name} {STATUS_BADGE[s.status]}
                </div>
                <div className="list-row-meta">
                  {s.testTitle} · {s.participantCount}/{s.studentLimit} candidates · {s.completedCount} completed
                  {s.sessionDate ? ` · ${s.sessionDate}${s.sessionTime ? " " + s.sessionTime : ""}` : ""}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ width: 120 }}>
                <div className="ad-bar">
                  <i style={{ width: `${s.participantCount ? (s.completedCount / s.participantCount) * 100 : 0}%` }} />
                </div>
                <span className="ad-small ad-muted">
                  {s.participantCount ? Math.round((s.completedCount / s.participantCount) * 100) : 0}% finished
                </span>
              </div>
              <Icon name="arrowRight" size={18} />
            </div>
          </div>
        </Link>
      ))}

      {showCreate && <CreateSessionModal token={token} onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}

function CreateSessionModal({ token, onClose, onCreated }) {
  const [tests, setTests] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [studentLimit, setStudentLimit] = useState(20);
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("");
  const [testId, setTestId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const backdrop = useBackdropClose(onClose);

  useEffect(() => {
    let alive = true;
    listTests(token)
      .then((data) => {
        if (!alive) return;
        setTests(data);
        if (data[0]) setTestId(data[0].id);
      })
      .catch((e) => alive && setError(e.message || "Couldn't load the tests"));
    return () => {
      alive = false;
    };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !testId) return;
    const limit = Number(studentLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      setError("The candidate limit must be a whole number from 1 to 500.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createSession(token, { name, description, studentLimit: limit, sessionDate, sessionTime, testId });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" {...backdrop}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create session</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Saturday, 10am" />
          </div>

          <div className="field">
            <label>Teacher mock</label>
            <select value={testId} onChange={(e) => setTestId(e.target.value)}>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            {tests.length === 0 && <p className="hint">Create a teacher mock first: a session runs one of those.</p>}
          </div>

          <div className="field-row">
            <div className="field">
              <label>Candidate limit</label>
              <input type="number" min={1} max={500} step={1} value={studentLimit} onChange={(e) => setStudentLimit(e.target.value)} />
            </div>
            <div className="field">
              <label>Date (optional)</label>
              <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Time (optional)</label>
              <input type="time" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Description (optional)</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {error && <p className="error-text">{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !testId}>
              {saving ? "Creating…" : "Create session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
