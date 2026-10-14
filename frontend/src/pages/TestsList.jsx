import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listTests, deleteTest, adminDuplicateTest, mockTestApi } from "../api.js";
import Icon from "../components/Icon.jsx";
import { useToast } from "../components/Toast.jsx";
import { useConfirm } from "../components/Confirm.jsx";
import { useAdminAuth } from "../context/AuthContext.jsx";
import { SkeletonAdminList } from "../components/SkeletonAdmin.jsx";
import useBackdropClose from "../components/useBackdropClose.js";
import { studioPath } from "../studio/panels.js";

// The teacher mocks: tests a teacher builds and then runs for a group as a session. Shown inside
// SAT > Practice tests > Teacher mocks (pages/admin/SatTests.jsx), beside their sessions.
export default function TestsList() {
  const { token } = useAdminAuth();
  const [tests, setTests] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const nav = useNavigate();

  // A failed request must not leave the skeleton up forever or vanish as an unhandled rejection.
  async function load() {
    try {
      setTests(await listTests(token));
      setLoadError("");
    } catch (e) {
      setLoadError(e.message || "Couldn't load the tests");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id) {
    if (!(await askConfirm({ title: "Delete this test?", message: "Sessions using it will keep their history but can no longer be started.", confirmLabel: "Delete test" }))) return;
    try {
      await deleteTest(token, id);
      toast.success("Test deleted");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function handleDuplicate(t) {
    try {
      await adminDuplicateTest(token, t.id);
      toast.success(`Duplicated "${t.title}"`);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const totalQ = (tests || []).reduce((s, t) => s + t.questionCount, 0);

  return (
    <div>
      <div className="ad-bar-row">
        <p>
          A teacher mock is a test you build and then run for a group as a session: you choose who sits it and when it starts
          {tests ? `. ${tests.length} ${tests.length === 1 ? "test" : "tests"}, ${totalQ} questions in total.` : "."}
        </p>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={16} /> Create teacher mock
        </button>
      </div>

      {tests === null && loadError && (
        <div className="card" style={{ maxWidth: 480 }}>
          <h2 style={{ marginTop: 0 }}>Couldn't load the tests</h2>
          <p style={{ color: "var(--ink-soft)" }}>{loadError}</p>
          <button className="btn btn-primary" onClick={load}>
            Try again
          </button>
        </div>
      )}
      {tests === null && !loadError && <SkeletonAdminList />}

      {tests?.length === 0 && (
        <div className="empty-state card">
          No teacher mocks yet. Create one to get started: it comes with a Reading and Writing module and a Math module ready for questions.
        </div>
      )}

      {tests?.map((t) => (
        <div className="list-row" key={t.id}>
          <div className="ad-row-main">
            <span className={`ad-test-icon tone-${["violet", "sky", "rose", "green", "amber", "indigo"][t.title.length % 6]}`}>
              <Icon name="layers" size={22} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="list-row-title">{t.title}</div>
              <div className="list-row-meta" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span className="ad-chip">
                  <Icon name="mock" size={12} /> {t.moduleCount} modules
                </span>
                <span className="ad-chip">
                  <Icon name="checklist" size={12} /> {t.questionCount} questions
                </span>
                <DifficultyBadge value={t.difficulty} />
                {t.questionCount === 0 && <span className="badge badge-warn">Needs questions</span>}
                {t.description && <span>{t.description}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Link className="btn btn-secondary btn-sm" to={studioPath(`/tests/${t.id}`)}>
              <Icon name="pencil" size={14} /> Edit
            </Link>
            <button className="btn btn-secondary btn-sm" onClick={() => handleDuplicate(t)} title="Duplicate">
              <Icon name="copy" size={14} /> Duplicate
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)} title="Delete" aria-label={`Delete ${t.title}`}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        </div>
      ))}

      {/* A new test opens in its editor straight away: the next thing to do is add its questions. */}
      {showCreate && <TestDetailsModal onClose={() => setShowCreate(false)} onSaved={(t) => nav(studioPath(`/tests/${t.id}`))} token={token} />}
    </div>
  );
}

// The teacher's rating of a whole test. Students see it as a label on the test's card.
const TEST_DIFFICULTIES = ["Easy", "Medium", "Hard"];
const DIFFICULTY_BADGE = { Easy: "badge-good", Medium: "badge-warn", Hard: "badge-hard" };

export function DifficultyBadge({ value }) {
  if (!DIFFICULTY_BADGE[value]) return null;
  return <span className={`badge ${DIFFICULTY_BADGE[value]}`}>{value}</span>;
}

// Creates a test, or edits the details of `test` when one is given (the test editor's header).
// `api` says which kind (api.js: mockTestApi or satPracticeApi) and `noun` what to call it.
// `onSaved` gets the saved test.
export function TestDetailsModal({ onClose, onSaved, token, test = null, api = mockTestApi, noun = "teacher mock" }) {
  const [title, setTitle] = useState(test?.title || "");
  const [description, setDescription] = useState(test?.description || "");
  const [difficulty, setDifficulty] = useState(test ? test.difficulty || "" : "Medium");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const backdrop = useBackdropClose(onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const saved = test ? await api.update(token, test.id, { title, description, difficulty }) : await api.create(token, { title, description, difficulty });
      onSaved(saved);
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
          <h2>{test ? "Test details" : `Create ${noun}`}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="test-title">Title</label>
            <input id="test-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="SAT Practice Test 2" />
          </div>
          <div className="field">
            <label htmlFor="test-description">Description (optional)</label>
            <textarea id="test-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="test-difficulty">Difficulty</label>
            <select id="test-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">Not rated (no label)</option>
              {TEST_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className="hint">Students see this as a label on the test's card.</div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {test ? (saving ? "Saving…" : "Save details") : saving ? "Creating…" : "Create and add questions"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
