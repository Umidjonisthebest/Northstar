import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getClass, setClassMembership, studentMe } from "../../../api.js";
import { useStudentAuth } from "../../../context/AuthContext.jsx";
import { useProgress } from "../../../context/ProgressContext.jsx";
import { useToast } from "../../../components/Toast.jsx";
import { useConfirm } from "../../../components/Confirm.jsx";
import Icon from "../../../components/Icon.jsx";
import ClassCodeField, { codeProblem } from "../../../components/ClassCodeField.jsx";
import "../../../classroom.css";

// Settings > Account > "Your class": the class the student is in, and the way into one, which is
// the class code their teacher gives them. Moving to another class (with its code) or leaving is
// limited by the server (once in 30 days after the first move); a teacher can always move a student.
export default function SchoolSettings() {
  const { token, login } = useStudentAuth();
  const { refresh } = useProgress();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const [info, setInfo] = useState(null);
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      getClass(token)
        .then(setInfo)
        .catch(() => setInfo(false)),
    [token]
  );
  useEffect(() => {
    load();
  }, [load]);

  if (info === null) return null;
  if (info === false)
    return (
      <section className="ns-set-card" aria-labelledby="cr-set-h">
        <h2 id="cr-set-h">Your class</h2>
        <p className="ns-set-note">
          Couldn't load this.{" "}
          <button type="button" className="ns-btn ns-btn-outline ns-btn-sm" onClick={load}>
            Try again
          </button>
        </p>
      </section>
    );
  if (info.demo) return null; // the shared demo account is never in a class

  const cls = info.classroom;
  const locked = Boolean(cls && info.canChangeAt);
  const opens = info.canChangeAt ? new Date(info.canChangeAt).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "";
  const start = () => {
    setCode("");
    setError("");
    setEditing(true);
  };

  // Sends the change, then lets the menu and the rest of the hub follow the account.
  async function change(body, done) {
    setBusy(true);
    setError("");
    try {
      const next = await setClassMembership(token, body);
      setInfo((i) => ({ ...i, ...next }));
      setEditing(false);
      toast.success(done(next));
      try {
        login(token, await studentMe(token)); // the menu follows the account
      } catch {
        /* it catches up with the next page */
      }
      refresh();
    } catch (err) {
      // Leaving has no form to show the reason in.
      if (body.leave) toast.error(err.message);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function save(e) {
    e.preventDefault();
    const missing = codeProblem(code, info.codeLength);
    if (missing) return setError(missing);
    change({ code }, (next) => `You're in ${next.classroom.name}`);
  }

  async function leave() {
    if (
      !(await askConfirm({
        title: `Leave ${cls.name}?`,
        message: `You'll leave ${cls.name}'s chat, homework and class goal. To come back you need the class code, and after this you can't change your class again for ${info.changeDays} days.`,
        confirmLabel: "Leave the class",
        danger: false
      }))
    )
      return;
    change({ leave: true }, () => `You left ${cls.name}`);
  }

  return (
    <section className="ns-set-card" aria-labelledby="cr-set-h">
      <h2 id="cr-set-h">Your class</h2>
      <p className="ns-set-note">A teacher makes a class and gives its students the class code: that is how you join. Everyone else studies on their own, with everything else the same.</p>
      <div className="cr-set-now">
        {cls ? (
          <span className="cr-room-badge" aria-hidden="true">
            {cls.mark}
          </span>
        ) : (
          <span className="cr-room-badge" aria-hidden="true" style={{ background: "var(--chip, var(--bg))", color: "var(--ink-soft)" }}>
            <Icon name="users" size={22} />
          </span>
        )}
        <div>
          <b>{cls ? cls.name : "Not in a class"}</b>
          <span>
            {cls
              ? locked
                ? `You can change your class again on ${opens}. A teacher can move you sooner.`
                : "Your class: its chat, homework and weekly goal."
              : "No class, teacher or homework. Got a class code from your teacher? Enter it to join."}
          </span>
        </div>
        {cls && (
          <Link to="/class" className="ns-btn ns-btn-outline ns-btn-sm">
            Open my class
          </Link>
        )}
        {!editing && !locked && (
          <button type="button" className="ns-btn ns-btn-soft ns-btn-sm" disabled={busy} onClick={start}>
            <Icon name="pencil" size={15} /> {cls ? "Change class" : "Enter class code"}
          </button>
        )}
        {cls && !editing && !locked && (
          <button type="button" className="ns-btn ns-btn-outline ns-btn-sm" disabled={busy} onClick={leave}>
            Leave class
          </button>
        )}
      </div>
      {editing && (
        <form className="cr-set-form" onSubmit={save}>
          <ClassCodeField
            value={code}
            length={info.codeLength}
            busy={busy}
            autoFocus
            note={cls ? `The code of the class you're moving to. You'll leave ${cls.name}'s chat, homework and class goal, and can't change your class again for ${info.changeDays} days.` : undefined}
            onChange={(v) => {
              setCode(v);
              setError("");
            }}
          />
          {error && (
            <p className="cr-error" role="alert">
              <Icon name="error" size={17} /> {error}
            </p>
          )}
          <div>
            <button className="ns-btn ns-btn-primary ns-btn-sm" disabled={busy}>
              {busy ? "Checking…" : cls ? "Move me" : "Join my class"}
            </button>
            <button type="button" className="ns-btn ns-btn-outline ns-btn-sm" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
