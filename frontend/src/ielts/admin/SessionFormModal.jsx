import { useState } from "react";
import { Clock } from "lucide-react";
import { createSession, updateSession } from "../api.js";
import { Modal } from "../components/Modal.jsx";
import { DatePicker } from "../components/DatePicker.jsx";
import { Button, Field } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { toISODate } from "../lib/format.js";

const MIN_STUDENTS = 5;

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function SessionFormModal({ session, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: session?.name || "",
    studentLimit: String(session?.studentLimit ?? MIN_STUDENTS),
    description: session?.description || "",
    date: session?.date || toISODate(new Date()),
    time: session?.time || nowTime()
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    const limit = Number(form.studentLimit);
    if (!form.name.trim()) return setError("Session name is required");
    if (!Number.isInteger(limit) || limit < MIN_STUDENTS) return setError(`Student limit must be at least ${MIN_STUDENTS}`);
    setSaving(true);
    setError("");
    try {
      const body = { ...form, name: form.name.trim(), studentLimit: limit };
      const saved = session ? await updateSession(session.id, body) : await createSession(body);
      toast.success(session ? "Session updated successfully!" : "Session created successfully!");
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={session ? "Edit Session" : "Create Session"} width={768}>
      <form onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <Field label="Name" htmlFor="session-name">
            <input id="session-name" className="ie-input" name="session-name" autoFocus placeholder="Session name" value={form.name} onChange={set("name")} />
          </Field>
          <Field label="Student limit" htmlFor="session-limit">
            <input id="session-limit" className="ie-input ie-input--center" type="number" min={MIN_STUDENTS} max={1000} value={form.studentLimit} onChange={set("studentLimit")} />
          </Field>
          <Field label="Description" htmlFor="session-desc" className="ie-span-2">
            <textarea id="session-desc" className="ie-textarea" placeholder="Short description about this session" value={form.description} onChange={set("description")} />
          </Field>
          <Field label="Session date">
            <DatePicker value={form.date} onChange={set("date")} />
          </Field>
          <Field label="Session time" htmlFor="session-time">
            <div className="ie-input-wrap ie-time-wrap">
              <input id="session-time" className="ie-input" type="time" value={form.time} onChange={set("time")} required />
              <Clock className="ie-time-icon" />
            </div>
          </Field>
        </div>
        {error && (
          <div className="ie-help ie-help--error" style={{ marginTop: 14, fontSize: 13 }}>
            {error}
          </div>
        )}
        <div className="ie-modal__footer" style={{ padding: "22px 0 4px" }}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {session ? "Save changes" : "Create session"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
