import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { forgotPassword, studentLogin, studentRegister } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import Logo from "../../components/Brand.jsx";
import Icon from "../../components/Icon.jsx";
import NightScene from "../../components/NightScene.jsx";
import { useDemoLogin } from "./hooks.js";
import "../../auth.css";

// Sign-in screens ("au-" prefix, always light): the form on the left, the
// illustrated dawn valley on the right. Shared by the student log in / sign
// up / forgot password pages, the password reset page and the teacher login.

export function AuthLayout({ title, sub, children, foot, variant = "student" }) {
  useEffect(() => {
    const before = document.title;
    document.title = `${title} · Northstar`;
    return () => {
      document.title = before; // the page title from index.html, not a hard-coded one
    };
  }, [title]);
  return (
    <div className="au">
      <div className="au-card" data-variant={variant}>
        {/* The space scene with the 3D Nova and a line about the product. `variant` no longer
            changes the picture; the teacher screen is told apart by its title and footer. */}
        <aside className="au-art" aria-label="About Northstar">
          <NightScene />
        </aside>
        <main className="au-main">
          <div className="au-box">
            <Logo to="/" size={44} className="au-logo" />
            <h1>{title}</h1>
            {sub && <p className="au-sub">{sub}</p>}
            {children}
          </div>
          {foot && <div className="au-foot">{foot}</div>}
        </main>
      </div>
    </div>
  );
}

export function Field({ label, type = "text", value, onChange, show, onToggle, ...rest }) {
  const isPassword = type === "password";
  return (
    <label className="au-field">
      <span>{label}</span>
      <span className="au-input">
        <input type={isPassword && show ? "text" : type} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
        {isPassword && onToggle && (
          <button type="button" className="au-eye" onClick={onToggle} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
            <Icon name={show ? "eye" : "lock"} size={18} />
          </button>
        )}
      </span>
    </label>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return (
    <p className="au-error" role="alert">
      <Icon name="error" size={17} /> {children}
    </p>
  );
}

const FOOT = (
  <>
    <span>
      Teacher? <Link to="/teacher/login">Sign in to the studio</Link>
    </span>
    <span>
      Taking an IELTS test? <Link to="/ielts">Open the exam room</Link>
    </span>
  </>
);

function LoginForm({ onAuthed }) {
  const demo = useDemoLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const d = await studentLogin(email, password);
      onAuthed(d.token, d.user); // a temporary password goes on to /change-password (see onAuthed)
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <form className="au-form" onSubmit={submit}>
        <Field label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={setEmail} required autoFocus />
        <Field label="Password" type="password" autoComplete="current-password" placeholder="Your password" value={password} onChange={setPassword} show={show} onToggle={() => setShow((s) => !s)} required />
        <Link to="/forgot-password" className="au-forgot">
          Forgot password?
        </Link>
        <FormError>{error || demo.error}</FormError>
        <button className="au-btn dark" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Log in"}
        </button>
      </form>
      <div className="au-or">or</div>
      <button type="button" className="au-btn line" onClick={demo.run} disabled={demo.busy}>
        <Icon name="bolt" size={18} /> {demo.busy ? "Opening the demo…" : "Try the demo account"}
      </button>
      <p className="au-hint">
        Demo: <code>student@example.com</code> / <code>student123</code>
      </p>
      <p className="au-switch">
        New to Northstar? <Link to="/signup">Create an account</Link>
      </p>
    </>
  );
}

function SignupForm({ onAuthed }) {
  // The form doesn't ask about school or grade: a class is joined afterwards, in the hub, with the
  // class code a teacher gives (pages/hub/Classroom.jsx).
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const d = await studentRegister(form);
      onAuthed(d.token, d.user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <form className="au-form" onSubmit={submit}>
        <div className="au-row">
          <Field label="First name" autoComplete="given-name" placeholder="Aziza" value={form.firstName} onChange={set("firstName")} required autoFocus />
          <Field label="Last name" autoComplete="family-name" placeholder="Karimova" value={form.lastName} onChange={set("lastName")} />
        </div>
        <Field label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set("email")} required />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          minLength={8}
          value={form.password}
          onChange={set("password")}
          show={show}
          onToggle={() => setShow((s) => !s)}
          required
        />
        <FormError>{error}</FormError>
        <button className="au-btn dark" type="submit" disabled={busy}>
          {busy ? "Creating your account…" : "Create free account"}
        </button>
      </form>
      <p className="au-hint">Got a class code from your teacher? You'll enter it after you sign up, to join your class.</p>
      <p className="au-hint">Your teacher added you already? Log in with the temporary password they gave you.</p>
      <p className="au-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </>
  );
}

function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(null); // the server's answer: did it really send an email?
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      setSent(await forgotPassword(email));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    // Only claim an email went out when the server says it can send one. Otherwise say so plainly.
    return (
      <div className="au-form">
        {sent.emailed ? (
          <p className="au-ok" role="status">
            <Icon name="check" size={17} strokeWidth={2.6} /> If <b>{email}</b> has an account, a reset link is on its way. It works for one hour.
          </p>
        ) : (
          <p className="au-error" role="status">
            <Icon name="error" size={17} /> This site can't send email yet, so no link was sent. Ask your teacher to reset your password; they'll give you a temporary one to sign in with.
          </p>
        )}
        <Link to="/login" className="au-btn dark">
          Back to log in
        </Link>
      </div>
    );
  }
  return (
    <>
      <form className="au-form" onSubmit={submit}>
        <Field label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={setEmail} required autoFocus />
        <FormError>{error}</FormError>
        <button className="au-btn dark" type="submit" disabled={busy}>
          {busy ? "Checking…" : "Reset my password"}
        </button>
      </form>
      <p className="au-switch">
        Remembered it? <Link to="/login">Back to log in</Link>
      </p>
    </>
  );
}

const COPY = {
  login: ["Welcome back", "Pick up right where you left off."],
  signup: ["Create your free account", "Practice, mocks and Nova, your AI tutor. Ready in 30 seconds."],
  forgot: ["Reset your password", "Enter the email you signed up with."]
};

export default function Auth({ mode = "login" }) {
  const { token, login } = useStudentAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const back = loc.state?.from && loc.state.from !== "/" ? loc.state.from : "/dashboard";
  const justAuthed = useRef(false);

  useEffect(() => {
    if (token && !justAuthed.current) nav(back, { replace: true });
  }, [token, nav, back]);

  // A brand-new account goes to the welcome screen, which leads into the diagnostic test.
  const onAuthed = (t, user) => {
    justAuthed.current = true;
    login(t, user);
    if (user?.mustChangePassword) return nav("/change-password", { replace: true });
    nav(mode === "signup" && !loc.state?.from ? "/welcome" : back, { replace: true });
  };

  const [title, sub] = COPY[mode];
  return (
    <AuthLayout title={title} sub={sub} foot={FOOT}>
      {mode === "signup" ? <SignupForm onAuthed={onAuthed} /> : mode === "forgot" ? <ForgotForm /> : <LoginForm onAuthed={onAuthed} />}
    </AuthLayout>
  );
}
