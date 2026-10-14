import React, { useState } from "react";
import { createPortal } from "react-dom";
import { staffChangePassword } from "../api.js";
import { useAdminAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import Icon from "../components/Icon.jsx";
import useBackdropClose from "../components/useBackdropClose.js";

// "Change password" in either panel's menu. A teacher's first password is a temporary one the
// admin read off a screen; this is where it becomes their own. The server answers with a new
// token (every other session of the account ends), which replaces the one in use.
export default function StaffPassword({ onClose }) {
  const { token, login } = useAdminAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ current: "", next: "", again: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const backdrop = useBackdropClose(onClose);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (form.next !== form.again) return setError("The two new passwords don't match");
    setError("");
    setBusy(true);
    try {
      const d = await staffChangePassword(token, { current: form.current, next: form.next });
      login(d.token, d.user);
      toast.success("Password changed");
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop" {...backdrop}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-header">
          <h2>Change password</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="field">
          <label htmlFor="staff-pw-current">Current password</label>
          <input id="staff-pw-current" type="password" autoComplete="current-password" value={form.current} onChange={set("current")} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="staff-pw-next">New password</label>
          <input id="staff-pw-next" type="password" autoComplete="new-password" minLength={8} value={form.next} onChange={set("next")} required />
          <small className="ad-small ad-muted">At least 8 characters. You stay signed in here; any other device is signed out.</small>
        </div>
        <div className="field">
          <label htmlFor="staff-pw-again">New password again</label>
          <input id="staff-pw-again" type="password" autoComplete="new-password" value={form.again} onChange={set("again")} required />
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
