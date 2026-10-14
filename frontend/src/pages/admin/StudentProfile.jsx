import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminResetPassword, adminStudent, adminUpdateStudent } from "../../api.js";
import { useAdminAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useConfirm } from "../../components/Confirm.jsx";
import Icon, { Medal } from "../../components/Icon.jsx";
import { Avatar, Kpi, Empty, accClass, timeAgo } from "../../components/adminUi.jsx";
import useBackdropClose from "../../components/useBackdropClose.js";
import { studioPath } from "../../studio/panels.js";
import { useStudio } from "../../studio/useStudio.js";

const STATUS = { not_started: ["Not started", "badge-muted"], in_progress: ["In progress", "badge-warn"], completed: ["Completed", "badge-good"] };
const IELTS_SKILLS = [
  ["listening", "Listening"],
  ["reading", "Reading"],
  ["writing", "Writing"],
  ["speaking", "Speaking"]
];
const band = (b) => (b == null ? "—" : Number(b).toFixed(1));
const KIND = { listening: "Listening", reading: "Reading" };
const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");

// One diagnostic test (SAT or IELTS) as badges: the student's starting level.
function DiagnosticRow({ d }) {
  const title = d.exam === "sat" ? "SAT diagnostic" : `IELTS diagnostic · ${KIND[d.kind] || d.kind} Part ${d.number}`;
  let badges;
  if (d.status === "in_progress" || d.status === "created") badges = [["badge-warn", "In progress"]];
  // The test is locked: the student left the page while it was running (lock/useExamLock.js).
  else if (d.status === "cancelled") badges = [["badge-hard", `Cancelled: ${d.cancelled?.reason || "left the test page"}`]];
  else if (d.status === "expired" || (d.exam === "sat" ? d.total == null : !d.result))
    badges = [["badge-muted", `No score: ${d.answered ? "time ran out with fewer than half answered" : "nothing answered"}`]];
  else if (d.exam === "sat")
    badges = [
      ["badge-good", `Total ${d.total}`],
      ["badge-muted", `R&W ${d.rw ?? "—"}`],
      ["badge-muted", `Math ${d.math ?? "—"}`],
      ["badge-muted", `${d.correct}/${d.count} correct`],
      ...(d.level ? [["badge-muted", d.level]] : [])
    ];
  else
    badges = [
      ["badge-good", `Band ${band(d.result.band)}`],
      ["badge-muted", `CEFR ${d.result.cefr}`],
      ["badge-muted", `${d.result.correct}/${d.result.total} correct`]
    ];
  return (
    <div className="list-row">
      <div>
        <div className="list-row-title">{title}</div>
        <div className="list-row-meta" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {badges.map(([cls, text]) => (
            <span key={text} className={`badge ${cls}`}>
              {text}
            </span>
          ))}
          <span className="ad-small">{shortDate(d.submittedAt || d.startedAt)}</span>
        </div>
      </div>
    </div>
  );
}

export default function StudentProfile() {
  const { id } = useParams();
  const { token } = useAdminAuth();
  // A teacher moves a student between classes and pauses their chat. The name and the email (what
  // the student signs in with) are account details: the admin's. The server refuses them from a teacher.
  const { isAdmin } = useStudio();
  const nav = useNavigate();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const [s, setS] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [temp, setTemp] = useState(null);
  const [edit, setEdit] = useState(null);
  const backdrop = useBackdropClose(() => setEdit(null));

  // Without the error state a failed first load left the spinner up forever (only a toast said why).
  const load = () =>
    adminStudent(token, id)
      .then((d) => {
        setS(d);
        setLoadError("");
      })
      .catch((e) => {
        setLoadError(e.message || "Couldn't load this student");
        toast.error(e.message);
      });
  useEffect(() => {
    setS(null);
    setTemp(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  if (!s && loadError) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Couldn't load this student</h2>
        <p style={{ color: "var(--ink-soft)" }}>{loadError}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={load}>
            Try again
          </button>
          <Link to={studioPath("/students")} className="btn btn-secondary">
            All students
          </Link>
        </div>
      </div>
    );
  }
  if (!s)
    return (
      <div className="ns-loading">
        <div className="ns-spinner" />
      </div>
    );

  async function reset() {
    if (!(await askConfirm({ title: `Reset ${s.name}'s password?`, message: "Their current password stops working and they are signed out everywhere. You'll get a temporary one to give them; they choose their own at first sign-in.", confirmLabel: "Reset password" }))) return;
    try {
      const r = await adminResetPassword(token, s.id);
      setTemp(r.tempPassword);
      toast.success("New temporary password created");
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      // "klass" is the form's own field: a class's id, or "none" (in no class). Only a change is
      // sent; staff move a student without the class code.
      const { klass, chatMuted, ...account } = edit;
      const body = isAdmin ? account : {};
      if (klass !== (s.classroom?.id || "none")) body.classId = klass === "none" ? null : klass;
      if (chatMuted !== s.chatMuted) body.chatMuted = chatMuted;
      await adminUpdateStudent(token, s.id, body);
      toast.success("Student updated");
      setEdit(null);
      // A teacher who takes a student out of the classes can no longer open them.
      if (!isAdmin && body.classId === null) return nav(studioPath("/students"));
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const earned = s.badges.filter((b) => b.earned).length;

  return (
    <div className="ad-page">
      <Link to={studioPath("/students")} className="ad-link">
        <Icon name="arrowLeft" size={14} /> All students
      </Link>

      <div className="ad-card">
        <div className="ad-profile-hero">
          <Avatar name={s.name} size={76} radius={24} avatar={s.avatar} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ fontFamily: "var(--display)", fontSize: 28, letterSpacing: "-0.04em", fontWeight: 800, margin: 0 }}>{s.name}</h1>
            <p className="ad-muted" style={{ margin: "4px 0 0" }}>
              {s.email} · Candidate ID {s.candidateId} · joined {new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
            <div className="ad-profile-meta">
              {/* Their class, with a way to it; nothing for a student outside the classes. */}
              {s.classroom && (
                <Link to={studioPath(`/classes?class=${s.classroom.id}`)} className="ad-chip lvl" style={{ textDecoration: "none" }}>
                  <Icon name="users" size={12} /> {s.classroom.name}
                </Link>
              )}
              {s.chatMuted && (
                <span className="ad-chip fire">
                  <Icon name="chat" size={12} /> Chat messages paused
                </span>
              )}
              <span className="ad-chip lvl">
                <Icon name="summit" size={12} /> Level {s.level}
              </span>
              <span className="ad-chip fire">
                <Icon name="northStar" size={12} /> {s.streak}-day streak (best {s.longestStreak})
              </span>
              <span className="ad-chip">
                <Icon name="target" size={12} /> Target {s.targetScore}
              </span>
              <span className="ad-chip">
                <Icon name="clock" size={12} /> Active {timeAgo(s.lastActive)}
              </span>
            </div>
          </div>
          <div className="ad-actions">
            <button className="btn btn-secondary" onClick={() => setEdit({ firstName: s.firstName, lastName: s.lastName || "", email: s.email, klass: s.classroom?.id || "none", chatMuted: s.chatMuted })}>
              <Icon name="pencil" size={15} /> {isAdmin ? "Edit" : "Class and chat"}
            </button>
            <button className="btn btn-secondary" onClick={reset}>
              <Icon name="key" size={15} /> Reset password
            </button>
          </div>
        </div>
        {temp && (
          <div className="ad-temp">
            <Icon name="key" size={18} /> New temporary password: <code>{temp}</code>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                // The clipboard is missing outside secure pages and can be refused: say so rather than do nothing.
                (navigator.clipboard?.writeText(temp) ?? Promise.reject(new Error("no clipboard")))
                  .then(() => toast.success("Copied"))
                  .catch(() => toast.error("Couldn't copy. Select the password and copy it by hand."))
              }
            >
              <Icon name="copy" size={14} /> Copy
            </button>
            <span className="ad-small" style={{ fontWeight: 600 }}>Shown once — share it with the student.</span>
          </div>
        )}
      </div>

      <div className="ad-grid-4">
        <Kpi icon="bolt" tone="amber" label="Total XP" value={s.xp.toLocaleString()} sub={`${s.lvl.xpIntoLevel}/${s.lvl.xpForNext} to level ${s.level + 1}`} />
        <Kpi icon="target" tone="green" label="Practice accuracy" value={s.practiceAccuracy === null ? "—" : `${Math.round(s.practiceAccuracy * 100)}%`} sub={`${s.practiceAnswered} questions · ${s.drills} drills`} />
        <Kpi icon="mock" tone="rose" label="Mock average" value={s.mockAvgScaled ?? "—"} sub={`${s.mockModules} module${s.mockModules === 1 ? "" : "s"} submitted`} />
        <Kpi icon="book" tone="indigo" label="Vocabulary" value={s.vocabMastered} sub={`words mastered · ${s.savedCount} mistakes queued`} />
      </div>

      <div className="ad-card">
        <div className="ad-card-head">
          <h3>
            <Icon name="compass" size={18} /> Diagnostic tests
          </h3>
          <span>Starting level, newest first</span>
        </div>
        {(s.diagnostics || []).length === 0 && <Empty icon="compass">No diagnostic yet. New students are offered one right after they sign up.</Empty>}
        {(s.diagnostics || []).map((d) => (
          <DiagnosticRow key={`${d.exam}-${d.id}`} d={d} />
        ))}
      </div>

      <div className="ad-grid-2e">
        <div className="ad-card">
          <div className="ad-card-head">
            <h3>
              <Icon name="calendar" size={18} /> Last 4 weeks
            </h3>
            <span>XP per day</span>
          </div>
          <div className="ad-heat">
            {s.heatmap.map((d) => (
              <span key={d.date} title={`${d.date}: ${d.xp} XP`} className={`l${d.xp === 0 ? 0 : d.xp < 20 ? 1 : d.xp < 50 ? 2 : d.xp < 100 ? 3 : 4}`} />
            ))}
          </div>
          <div className="ad-card-head" style={{ marginTop: 22 }}>
            <h3>
              <Icon name="pin" size={18} /> Topics (weakest first)
            </h3>
          </div>
          {s.topics.length === 0 && <Empty icon="target">No practice yet.</Empty>}
          {s.topics.slice(0, 8).map((t) => (
            <div key={t.topic} className="ad-topic-row">
              <span>{t.topic}</span>
              <div className="ad-bar">
                <i className={accClass(t.accuracy)} style={{ width: `${Math.round(t.accuracy * 100)}%` }} />
              </div>
              <b>{Math.round(t.accuracy * 100)}%</b>
            </div>
          ))}
        </div>

        <div className="ad-card">
          <div className="ad-card-head">
            <h3>
              <Icon name="trophy" size={18} /> Badges
            </h3>
            <span>
              {earned} / {s.badges.length}
            </span>
          </div>
          <div className="ad-badges">
            {s.badges.map((b) => (
              <div key={b.id} className={b.earned ? "" : "off"} title={b.desc}>
                <Medal id={b.id} earned={b.earned} size={44} />
                {b.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ad-card">
        <div className="ad-card-head">
          <h3>
            <Icon name="mock" size={18} /> Mock sessions
          </h3>
        </div>
        {s.sessions.length === 0 && <Empty icon="mock">Not added to any session yet.</Empty>}
        {s.sessions.map((ss) => (
          <div key={ss.participantId} className="list-row">
            <div>
              <div className="list-row-title">{ss.name}</div>
              <div className="list-row-meta" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {ss.modules.map((m) => (
                  <span key={m.name} className={`badge ${STATUS[m.status][1]}`}>
                    {m.name}: {m.status === "completed" ? `${m.raw}/${m.max}` : STATUS[m.status][0]}
                  </span>
                ))}
              </div>
            </div>
            <Link className="btn btn-secondary btn-sm" to={studioPath(`/sessions/${ss.sessionId}/participants/${ss.participantId}`)}>
              <Icon name="eye" size={14} /> Answers
            </Link>
          </div>
        ))}
      </div>

      <div className="ad-card">
        <div className="ad-card-head">
          <h3>
            <Icon name="headphones" size={18} /> IELTS mock tests
          </h3>
          <Link to={studioPath(`/ielts/users/${s.id}`)} className="ad-link">
            IELTS dashboard <Icon name="arrowRight" size={12} />
          </Link>
        </div>
        {s.ielts.length === 0 && <Empty icon="headphones">Not added to any IELTS session yet.</Empty>}
        {s.ielts.map((x) => (
          <div key={x.sessionId} className="list-row">
            <div>
              <div className="list-row-title">{x.name}</div>
              <div className="list-row-meta" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {IELTS_SKILLS.map(([key, name]) => (
                  <span key={key} className={`badge ${x.bands[key] == null ? "badge-muted" : "badge-good"}`}>
                    {name}: {band(x.bands[key])}
                  </span>
                ))}
                <span className={`badge ${x.overall == null ? "badge-muted" : "badge-good"}`}>
                  <b>Overall: {band(x.overall)}</b>
                </span>
              </div>
            </div>
            <Link className="btn btn-secondary btn-sm" to={studioPath(`/ielts/sessions/${x.sessionId}`)}>
              <Icon name="eye" size={14} /> Session
            </Link>
          </div>
        ))}
      </div>

      {edit && (
        <div className="modal-backdrop" {...backdrop}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <div className="modal-header">
              <h2>{isAdmin ? "Edit student" : "Class and chat"}</h2>
              <button type="button" className="modal-close" onClick={() => setEdit(null)} aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </div>
            {isAdmin && (
              <>
                <div className="field-row">
                  <div className="field">
                    <label>First name</label>
                    <input value={edit.firstName} onChange={(e) => setEdit({ ...edit, firstName: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Last name</label>
                    <input value={edit.lastName} onChange={(e) => setEdit({ ...edit, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} required />
                </div>
              </>
            )}
            {!s.demo && (
              <>
                <div className="field">
                  <label htmlFor="ad-student-class">Class</label>
                  <select id="ad-student-class" value={edit.klass} onChange={(e) => setEdit({ ...edit, klass: e.target.value })}>
                    <option value="none">No class</option>
                    {(s.classes || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <small className="ad-small ad-muted">
                    You can put a student in a class here without its code. Moving a student takes them out of the old class's chat and homework straight away.
                    {!isAdmin && " Taking them out of the classes also takes them off your lists; only an admin can put them back."}
                  </small>
                </div>
                <label className="ad-check" style={{ marginBottom: 16 }}>
                  <input type="checkbox" checked={edit.chatMuted} onChange={(e) => setEdit({ ...edit, chatMuted: e.target.checked })} /> Pause their messages in class chats (they can still read)
                </label>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button className="btn btn-primary">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
