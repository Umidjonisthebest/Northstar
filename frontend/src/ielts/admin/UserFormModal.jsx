import { useState } from "react";
import { createUser, updateUser } from "../api.js";
import { Modal } from "../components/Modal.jsx";
import { Select } from "../components/Select.jsx";
import { Button, Field } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "admin", label: "Admin" }
];
const STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" }
];

export function UserFormModal({ user, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    role: user?.role || "student",
    email: user?.email || "",
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phone: user?.phone || "+998",
    status: user?.status || "active",
    password: ""
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { ...form, phone: form.phone.trim() === "+998" ? "" : form.phone.trim() };
      if (!body.password) delete body.password;
      const saved = user ? await updateUser(user.id, body) : await createUser(body);
      toast.success(user ? "User updated successfully!" : saved.candidateId ? `User created — candidate ID ${saved.candidateId}` : "User created");
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={user ? "Edit User" : "Create User"} width={560}>
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <Field label="Role">
          <Select value={form.role} options={ROLES} onChange={set("role")} />
        </Field>
        <Field label="Email (optional)" htmlFor="user-email">
          <input id="user-email" className="ie-input" type="email" placeholder="user@example.com" value={form.email} onChange={set("email")} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="First name" htmlFor="user-first">
            <input id="user-first" className="ie-input" value={form.firstName} onChange={set("firstName")} required autoFocus />
          </Field>
          <Field label="Last name" htmlFor="user-last">
            <input id="user-last" className="ie-input" value={form.lastName} onChange={set("lastName")} required />
          </Field>
        </div>
        <Field label="Phone number" htmlFor="user-phone">
          <input id="user-phone" className="ie-input" placeholder="+998" value={form.phone} onChange={set("phone")} />
        </Field>
        {user && (
          <Field label="Status">
            <Select value={form.status} options={STATUSES} onChange={set("status")} />
          </Field>
        )}
        {form.role === "admin" && (
          <Field label="Password" help={user ? "Leave blank to keep the current password." : "At least 6 characters. Admins sign in on the teacher sign-in page."} htmlFor="user-password">
            <input id="user-password" className="ie-input" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
          </Field>
        )}
        {error && <div className="ie-help ie-help--error">{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {user ? "Save changes" : "Create user"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
