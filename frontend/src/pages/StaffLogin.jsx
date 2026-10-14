import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { staffLogin } from "../api.js";
import { useAdminAuth } from "../context/AuthContext.jsx";
import { PANELS } from "../studio/panels.js";
import { AuthLayout, Field, FormError } from "./landing/Auth.jsx";

// The development sign-ins (backend/seed.js). A deployed site has its own accounts, so the hint
// and the filled-in address are only shown while developing: on the live site they were simply wrong.
const DEV_LOGINS = import.meta.env.DEV
  ? [
      { who: "Teacher", email: "teacher@example.com", password: "teacher123" },
      { who: "Admin", email: "admin@example.com", password: "admin123" }
    ]
  : [];

// The teacher sign-in. It is also the way into the admin panel: there is no separate admin page.
// The server looks the account up and answers with its role, and the role picks the panel, so the
// admin's email and password open the admin panel and every other account the teacher studio.
export default function StaffLogin() {
  const [email, setEmail] = useState(DEV_LOGINS[0]?.email || "");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { token, role, login } = useAdminAuth();
  const nav = useNavigate();

  // Already signed in (or just now): on to the panel the account belongs to.
  useEffect(() => {
    if (token) nav(`${PANELS[role].base}/overview`, { replace: true });
  }, [token, role, nav]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await staffLogin(email, password);
      login(data.token, data.user);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      variant="teacher"
      title="Teacher sign in"
      sub="Run your classes: set homework, hold mock tests and see where every student needs help."
      foot={
        <>
          <span>
            Student? <Link to="/login">Log in here</Link>
          </span>
          <span>
            <Link to="/">Back to Northstar</Link>
          </span>
        </>
      }
    >
      <form className="au-form" onSubmit={handleSubmit}>
        <Field label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} required />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={setPassword}
          show={show}
          onToggle={() => setShow((s) => !s)}
          required
          autoFocus
        />
        <FormError>{error}</FormError>
        <button className="au-btn dark" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {DEV_LOGINS.map((d) => (
        <p className="au-hint" key={d.who}>
          {d.who} demo: <code>{d.email}</code> / <code>{d.password}</code>
        </p>
      ))}
      {!DEV_LOGINS.length && <p className="au-hint">No account yet? Teacher accounts are made by the Northstar team.</p>}
    </AuthLayout>
  );
}
