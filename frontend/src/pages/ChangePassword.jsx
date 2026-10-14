import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { changePassword } from "../api.js";
import { useStudentAuth } from "../context/AuthContext.jsx";
import { AuthLayout, Field, FormError } from "./landing/Auth.jsx";

// Where a student lands after signing in with a temporary password (a teacher gave it to them), and
// where anyone can change their password. Until it's done the server refuses every other request
// (requireStudent), so there's nothing else to click.
export default function ChangePassword() {
  const { token, user, login, logout } = useStudentAuth();
  const nav = useNavigate();
  const forced = user?.mustChangePassword === true;

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (next !== again) return setError("The new passwords don't match.");
    setBusy(true);
    try {
      const d = await changePassword(token, { currentPassword: current, newPassword: next });
      login(d.token, d.user); // a fresh token: the old one stopped working with the old password
      nav(forced ? "/welcome" : "/profile", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={forced ? "Choose your own password" : "Change your password"}
      sub={forced ? "You signed in with a temporary password. Pick one only you know; it takes a few seconds." : "Other devices are signed out when you do this."}
    >
      <form className="au-form" onSubmit={submit}>
        <Field
          label={forced ? "Temporary password" : "Current password"}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
          show={show}
          onToggle={() => setShow((s) => !s)}
          required
          autoFocus
        />
        <Field label="New password" type="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} value={next} onChange={setNext} show={show} required />
        <Field label="New password again" type="password" autoComplete="new-password" minLength={8} value={again} onChange={setAgain} show={show} required />
        <FormError>{error}</FormError>
        <button className="au-btn dark" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save new password"}
        </button>
      </form>
      <p className="au-switch">
        {forced ? (
          <Link
            to="/login"
            onClick={() => {
              logout();
            }}
          >
            Sign out
          </Link>
        ) : (
          <Link to="/profile">Back to my profile</Link>
        )}
      </p>
    </AuthLayout>
  );
}
