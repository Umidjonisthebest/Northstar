import React, { useEffect, useState } from "react";
import { adminVocabCreate, adminVocabDelete, adminVocabList, adminVocabUpdate } from "../api.js";
import { useAdminAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { useConfirm } from "../components/Confirm.jsx";
import Icon from "../components/Icon.jsx";
import useBackdropClose from "../components/useBackdropClose.js";

const EMPTY = { word: "", partOfSpeech: "", pronunciation: "", definition: "", example: "" };

export default function VocabAdmin() {
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const [words, setWords] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const backdrop = useBackdropClose(() => setForm(null));

  // A failed request must not leave "Loading…" up forever or vanish as an unhandled rejection.
  async function load() {
    try {
      setWords((await adminVocabList(token)).words);
      setLoadError("");
    } catch (e) {
      setLoadError(e.message || "Couldn't load the vocabulary deck");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function save() {
    if (saving) return;
    if (!form.word.trim() || !form.definition.trim()) {
      toast.error("A word needs its spelling and a definition.");
      return;
    }
    setSaving(true);
    try {
      if (form.id) await adminVocabUpdate(token, form.id, form);
      else await adminVocabCreate(token, form);
      toast.success("Word saved");
      setForm(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(w) {
    if (!(await askConfirm({ title: `Delete "${w.word}"?`, message: "Students will no longer see this word in their deck.", confirmLabel: "Delete word" }))) return;
    try {
      await adminVocabDelete(token, w.id);
      toast.success("Word deleted");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <span className="ad-eyebrow">Both exams</span>
          <h1>Vocabulary deck</h1>
          <p>Flashcards students review in the Vocabulary Lab.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}><Icon name="plus" size={16} /> New word</button>
      </div>
      <div className="card">
        {!words && !loadError && <p className="hint">Loading…</p>}
        {!words && loadError && (
          <div>
            <p style={{ color: "var(--ink-soft)", marginTop: 0 }}>{loadError}</p>
            <button className="btn btn-primary btn-sm" onClick={load}>Try again</button>
          </div>
        )}
        {words?.map((w) => (
          <div className="list-row" key={w.id}>
            <div style={{ minWidth: 0 }}>
              <div className="list-row-title">
                {w.word} <span className="hint">{w.partOfSpeech}</span>
              </div>
              <div className="list-row-meta">{w.definition}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setForm({ ...EMPTY, ...w })}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(w)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {form && (
        <div className="modal-backdrop" {...backdrop}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{form.id ? "Edit word" : "New word"}</h2>
              <button type="button" className="modal-close" onClick={() => setForm(null)} aria-label="Close"><Icon name="close" size={16} /></button>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Word</label>
                <input value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} />
              </div>
              <div className="field">
                <label>Part of speech</label>
                <input value={form.partOfSpeech} onChange={(e) => setForm({ ...form, partOfSpeech: e.target.value })} placeholder="adj." />
              </div>
            </div>
            <div className="field">
              <label>Pronunciation</label>
              <input value={form.pronunciation} onChange={(e) => setForm({ ...form, pronunciation: e.target.value })} />
            </div>
            <div className="field">
              <label>Definition</label>
              <textarea rows={2} value={form.definition} onChange={(e) => setForm({ ...form, definition: e.target.value })} />
            </div>
            <div className="field">
              <label>Example sentence</label>
              <textarea rows={2} value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
