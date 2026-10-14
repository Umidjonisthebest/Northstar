import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { adminCreateTeacher, adminDeleteTeacher, adminResetTeacherPassword, adminTeachers, adminUpdateTeacher } from "../../api.js";
import { useAdminAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useConfirm } from "../../components/Confirm.jsx";
import Icon from "../../components/Icon.jsx";
import { Avatar, Empty, Kpi, timeAgo } from "../../components/adminUi.jsx";
import useBackdropClose from "../../components/useBackdropClose.js";

// Teacher accounts (admin panel only). Nobody signs up as a teacher: the admin makes the account
// here and gives the teacher its temporary password, which is shown once. The teacher signs in on
// the teacher sign-in page, lands in the teacher studio and chooses their own password there.

const BLANK = { id: null, firstName: "", lastName: "", email: "" };
const nameOf = (t) => `${t.firstName} ${t.lastName}`.trim();

export default function Teachers() {
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  // { name, email, password }: the temporary password just made, until the admin puts it away.
  const [handover, setHandover] = useState(null);
  const backdrop = useBackdropClose(() => setForm(null));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const load = () =>
    adminTeachers(token)
      .then((d) => {
        setList(d.teachers);
        setError("");
      })
      .catch((err) => setError(err.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const body = { firstName: form.firstName, lastName: form.lastName, email: form.email };
    try {
      if (form.id) {
        await adminUpdateTeacher(token, form.id, body);
        toast.success("Teacher updated");
      } else {
        const d = await adminCreateTeacher(token, body);
        setHandover({ name: nameOf(d.teacher), email: d.teacher.email, password: d.tempPassword });
        toast.success("Teacher account created");
      }
      setForm(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function reset(t) {
    if (!(await askConfirm({ title: `Give ${nameOf(t)} a new password?`, message: "Their current password stops working and they are signed out everywhere. You'll get a temporary one to give them.", confirmLabel: "New password", danger: false }))) return;
    try {
      const d = await adminResetTeacherPassword(token, t.id);
      setHandover({ name: nameOf(t), email: t.email, password: d.tempPassword });
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove(t) {
    if (!(await askConfirm({ title: `Remove ${nameOf(t)}'s account?`, message: "They are signed out and can't sign in again. The homework and announcements they set stay with the classes.", confirmLabel: "Remove teacher" }))) return;
    try {
      await adminDeleteTeacher(token, t.id);
      if (handover?.email === t.email) setHandover(null);
      toast.success("Teacher account removed");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const copy = (text) =>
    // The clipboard is missing outside secure pages and can be refused: say so rather than do nothing.
    (navigator.clipboard?.writeText(text) ?? Promise.reject(new Error("no clipboard")))
      .then(() => toast.success("Copied"))
      .catch(() => toast.error("Couldn't copy. Select the password and copy it by hand."));

  const all = list || [];
  const never = all.filter((t) => !t.lastSignInAt).length;

  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <span className="ad-eyebrow">People</span>
          <h1>Teachers</h1>
          <p>The accounts that open the teacher studio. Teachers work with the students of the classes; this panel stays with you.</p>
        </div>
        <div className="ad-actions">
          <button className="btn btn-primary" onClick={() => setForm(BLANK)}>
            <Icon name="plus" size={16} /> Add a teacher
          </button>
        </div>
      </div>

      {handover && (
        <div className="ad-temp" role="status" style={{ flexWrap: "wrap", marginTop: 0 }}>
          <Icon name="key" size={18} />
          <span>
            {handover.name} signs in with <code>{handover.email}</code> and the temporary password <code>{handover.password}</code>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => copy(handover.password)}>
            <Icon name="copy" size={14} /> Copy password
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setHandover(null)}>
            Done
          </button>
          <span className="ad-small" style={{ fontWeight: 600, flexBasis: "100%" }}>
            Shown once. They sign in on the teacher sign-in page and choose their own password from the menu at the top right.
          </span>
        </div>
      )}

      <div className="ad-grid-4">
        <Kpi icon="users" tone="violet" label="Teacher accounts" value={all.length} sub="can open the teacher studio" />
        <Kpi icon="key" tone="amber" label="Not signed in yet" value={never} sub={never ? "still on the password you gave them" : "everyone has signed in"} />
      </div>

      {error ? (
        <div className="ad-card">
          <Empty icon="warning">
            Couldn't load the teachers: {error}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={load}>
                Try again
              </button>
            </div>
          </Empty>
        </div>
      ) : list === null ? (
        <div className="ns-loading">
          <div className="ns-spinner" />
        </div>
      ) : all.length === 0 ? (
        <div className="ad-card">
          <Empty icon="users">
            No teacher has an account yet.
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setForm(BLANK)}>
                Add the first teacher
              </button>
            </div>
          </Empty>
        </div>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table ad-teachers">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Added</th>
                <th>Last signed in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {all.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="ad-person">
                      <Avatar name={nameOf(t)} />
                      <div>
                        <b>{nameOf(t)}</b>
                        <span>{t.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="ad-muted">{timeAgo(t.createdAt)}</td>
                  <td>{t.lastSignInAt ? <span className="ad-muted">{timeAgo(t.lastSignInAt)}</span> : <span className="badge badge-warn">Never</span>}</td>
                  <td>
                    <div className="ad-actions" style={{ justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setForm({ id: t.id, firstName: t.firstName, lastName: t.lastName, email: t.email })}>
                        <Icon name="pencil" size={14} /> Edit
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => reset(t)}>
                        <Icon name="key" size={14} /> New password
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(t)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form &&
        createPortal(
          <div className="modal-backdrop" {...backdrop}>
            <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
              <div className="modal-header">
                <h2>{form.id ? "Edit teacher" : "Add a teacher"}</h2>
                <button type="button" className="modal-close" onClick={() => setForm(null)} aria-label="Close">
                  <Icon name="close" size={18} />
                </button>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="ad-teacher-first">First name</label>
                  <input id="ad-teacher-first" value={form.firstName} onChange={set("firstName")} required autoFocus />
                </div>
                <div className="field">
                  <label htmlFor="ad-teacher-last">Last name</label>
                  <input id="ad-teacher-last" value={form.lastName} onChange={set("lastName")} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="ad-teacher-email">Email</label>
                <input id="ad-teacher-email" type="email" value={form.email} onChange={set("email")} required />
                <small className="ad-small ad-muted">{form.id ? "What they type to sign in." : "What they type to sign in. You get a temporary password for them when you save."}</small>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : form.id ? "Save" : "Create account"}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
}
