import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api.js";
import Icon from "../components/Icon.jsx";
import { AuthLayout, Field, FormError } from "./landing/Auth.jsx";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get("token") || "";
  const email = params.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      await resetPassword({ email, token, password });
      setDone(true);
      setTimeout(() => nav("/login"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const invalidLink = !token || !email;

  return (
    <AuthLayout title="Set a new password" sub={email ? `For ${email}` : "Choose a new password for your account."}>
      {invalidLink ? (
        <div className="au-form">
          <FormError>This reset link is missing information. Request a new one from the login page.</FormError>
          <Link to="/forgot-password" className="au-btn dark">
            Request a new link
          </Link>
        </div>
      ) : done ? (
        <div className="au-form">
          <p className="au-ok" role="status">
            <Icon name="check" size={17} strokeWidth={2.6} /> Password updated. Taking you to log in…
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="au-form">
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={setPassword}
            show={show}
            onToggle={() => setShow((s) => !s)}
            minLength={8}
            required
            autoFocus
          />
          <Field label="Confirm password" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={setConfirm} minLength={8} required />
          <FormError>{error}</FormError>
          <button className="au-btn dark" type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save new password"}
          </button>
        </form>
      )}
      <p className="au-switch">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
