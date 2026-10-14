import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { adminClass, adminClassReports, adminClasses, adminCreateClass, adminDeleteClass, adminDismissClassReport, adminRemoveClassMessage, adminRenameClass, adminRenewClassCode, adminUpdateStudent } from "../../api.js";
import { useAdminAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useConfirm } from "../../components/Confirm.jsx";
import Icon from "../../components/Icon.jsx";
import { Avatar, Empty, Kpi, accClass, timeAgo } from "../../components/adminUi.jsx";
import { studioPath } from "../../studio/panels.js";
import { useStudio } from "../../studio/useStudio.js";

// The studio's view of the classes. There are no ready-made classes: a teacher makes a class here
// and gives it its name, and students get into it with the class code it comes with. This page
// makes a class, shows every class at a glance and one class in full (its code, students, chat,
// homework; rename and delete), and lists the chat messages students have reported.

const day = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const stamp = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function hours(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const m = minutes % 60;
  return `${Math.floor(minutes / 60)} h${m ? ` ${m} min` : ""}`;
}

// A chat message the way the studio shows it: who, when, what, and whether it has been removed.
function ChatLine({ m, onRemove, onMute, faded = false }) {
  return (
    <li className={`ad-cls-msg ${m.deleted ? "gone" : ""} ${faded ? "faded" : ""}`}>
      <div className="ad-cls-msg-main">
        <p className="ad-cls-msg-who">
          {m.from.id ? <Link to={studioPath(`/students/${m.from.id}`)}>{m.from.name}</Link> : <span>{m.from.name}</span>}
          <small>{stamp(m.createdAt)}</small>
          {m.from.muted && <span className="badge badge-warn">Messages paused</span>}
          {m.deleted && <span className="badge badge-muted">{m.deletedBy === "teacher" ? "Removed by a teacher" : "Deleted by the student"}</span>}
          {m.reports > 0 && <span className="badge badge-warn">Reported</span>}
        </p>
        {m.question && <p className="ad-cls-msg-q">{m.question.gone ? "Shared a question that has since left the bank" : `Shared a question: ${m.question.title} (${m.question.topic}, ${m.question.difficulty})`}</p>}
        {m.body && <p className="ad-cls-msg-body">{m.body}</p>}
      </div>
      {(onRemove || onMute) && (
        <div className="ad-cls-msg-actions">
          {onMute && m.from.id && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMute(m.from)}>
              {m.from.muted ? "Let them write again" : "Pause their messages"}
            </button>
          )}
          {onRemove && !(m.deleted && m.deletedBy === "teacher") && (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => onRemove(m)}>
              <Icon name="trash" size={14} /> Remove
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function Reports({ reports, onRemove, onDismiss, onMute }) {
  return (
    <div className="ad-card ad-cls-reports">
      <div className="ad-card-head">
        <h3>
          <Icon name="flag" size={18} /> Reported messages
        </h3>
        <span>{reports.length} waiting</span>
      </div>
      <ul className="ad-cls-report-list">
        {reports.map((r) => (
          <li key={r.messageId}>
            <p className="ad-cls-report-where">
              <b>{r.room.label}</b>
              {r.room.kind === "dm" && " (private chats aren't open to the studio; you see this one because it was reported)"}
            </p>
            {r.context.length > 0 && (
              <details>
                <summary>
                  Show the {r.context.length} message{r.context.length === 1 ? "" : "s"} before it
                </summary>
                <ul className="ad-cls-chat">
                  {r.context.map((m) => (
                    <ChatLine key={m.id} m={m} faded />
                  ))}
                </ul>
              </details>
            )}
            <ul className="ad-cls-chat">
              <ChatLine m={r.message} />
            </ul>
            <p className="ad-cls-report-by">
              Reported by{" "}
              {r.reports.map((x, i) => (
                <span key={`${x.by.id}-${i}`}>
                  {i > 0 && ", "}
                  <b>{x.by.name}</b> ({x.reason.toLowerCase()})
                </span>
              ))}
              . Latest {timeAgo(r.latest)}.
            </p>
            <div className="ad-actions">
              <button type="button" className="btn btn-danger btn-sm" onClick={() => onRemove(r.message)}>
                <Icon name="trash" size={14} /> Remove the message
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onDismiss(r)}>
                <Icon name="check" size={14} /> It's fine, keep it
              </button>
              {r.message.from.id && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMute(r.message.from)}>
                  {r.message.from.muted ? `Let ${r.message.from.name.split(" ")[0]} write again` : `Pause ${r.message.from.name.split(" ")[0]}'s messages`}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const DETAIL_TABS = [
  ["students", "Students", "users"],
  ["chat", "Class chat", "chat"],
  ["homework", "Homework", "checklist"]
];

// The code students type to join the class, with a way to copy it and to replace it.
function ClassCode({ classroom, code, onRenew, busy }) {
  const { toast } = useToast();
  // The clipboard is missing outside secure pages and can be refused: say so rather than do nothing.
  const copy = () =>
    (navigator.clipboard?.writeText(code) ?? Promise.reject(new Error("no clipboard")))
      .then(() => toast.success("Copied"))
      .catch(() => toast.error("Couldn't copy. Select the code and copy it by hand."));
  return (
    <div className="ad-cls-code">
      <div>
        <span>Class code</span>
        <code>{code}</code>
      </div>
      <p>Students type this once, in My Class, to join {classroom.name}. It is the only way in, and the class discussion opens for each student the moment they join.</p>
      <div className="ad-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
          <Icon name="copy" size={14} /> Copy
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onRenew}>
          {busy ? "Making…" : "Make a new code"}
        </button>
      </div>
    </div>
  );
}

// A class's name, as a teacher types it: for a new class, and for renaming one.
function ClassNameForm({ initial = "", max, busy, submitLabel, onSubmit, onCancel, autoFocus = false }) {
  const [name, setName] = useState(initial);
  const ready = name.trim() && name.trim() !== initial;
  return (
    <form
      className="ad-cls-new"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit(name.trim());
      }}
    >
      <input className="ad-input" value={name} maxLength={max} onChange={(e) => setName(e.target.value)} placeholder="7A, Olympiad team, Evening SAT group…" aria-label="Class name" autoFocus={autoFocus} />
      <button className="btn btn-primary" disabled={busy || !ready}>
        {submitLabel}
      </button>
      {onCancel && (
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}

function ClassDetail({ classId, nameMax, reload, onGone, onRemove, onMute, stampKey }) {
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const [renewing, setRenewing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [saving, setSaving] = useState(false);
  // Homework is the teacher studio's: the admin panel has no homework screen to open from here.
  const hasHomework = useStudio().has("homework");
  const tabs = DETAIL_TABS.filter(([key]) => key !== "homework" || hasHomework);
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("students");

  const load = useCallback(() => {
    adminClass(token, classId)
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [token, classId]);
  // `stampKey` changes when a message was removed or a student paused elsewhere on the page.
  useEffect(() => {
    load();
  }, [load, stampKey]);

  if (error)
    return (
      <div className="ad-card">
        <Empty icon="warning">
          Couldn't load this class: {error}
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={load}>
              Try again
            </button>
          </div>
        </Empty>
      </div>
    );
  if (!data)
    return (
      <div className="ns-loading">
        <div className="ns-spinner" />
      </div>
    );

  const act = (fn) => async (arg) => {
    await fn(arg);
    load();
    reload();
  };

  async function renewCode() {
    if (!(await askConfirm({ title: `Make a new code for ${data.classroom.name}?`, message: `The code ${data.code} stops working straight away. Students already in the class stay; anyone who hasn't joined yet needs the new one.`, confirmLabel: "Make a new code", danger: false }))) return;
    setRenewing(true);
    try {
      const next = await adminRenewClassCode(token, classId);
      setData((d) => ({ ...d, code: next.code }));
      toast.success(`${data.classroom.name} has a new code`);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRenewing(false);
    }
  }

  async function rename(name) {
    setSaving(true);
    try {
      const next = await adminRenameClass(token, classId, name);
      setData((d) => ({ ...d, classroom: { ...d.classroom, name: next.name, mark: next.mark } }));
      setRenaming(false);
      toast.success(`The class is now called ${next.name}`);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeClass() {
    const n = data.students.length;
    const who = n === 0 ? "Nobody has joined it yet." : `Its ${n === 1 ? "student is" : `${n} students are`} taken out of it and can join another class with that class's code.`;
    if (!(await askConfirm({ title: `Delete ${data.classroom.name}?`, message: `${who} The class's chat, its weekly goals, its code and the homework set only for it are deleted with it. This can't be undone.`, confirmLabel: "Delete the class" }))) return;
    try {
      await adminDeleteClass(token, classId);
      toast.success(`${data.classroom.name} is deleted`);
      onGone();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="ad-card">
      <div className="ad-card-head ad-cls-head">
        <h3>
          <Icon name="users" size={18} /> {data.classroom.name}
        </h3>
        <span>
          week of {day(data.week.start)}
          {data.goal ? ` · class goal ${data.goal.xp.toLocaleString()} of ${data.goal.target.toLocaleString()} XP${data.goal.reached ? " (reached)" : ""}` : ""}
          {data.classroom.by ? ` · made by ${data.classroom.by}` : ""}
        </span>
        <div className="ad-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming((r) => !r)}>
            <Icon name="pencil" size={14} /> Rename
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={removeClass}>
            <Icon name="trash" size={14} /> Delete class
          </button>
        </div>
      </div>
      {renaming && <ClassNameForm initial={data.classroom.name} max={nameMax} busy={saving} submitLabel={saving ? "Saving…" : "Save name"} onSubmit={rename} onCancel={() => setRenaming(false)} autoFocus />}
      <ClassCode classroom={data.classroom} code={data.code} onRenew={renewCode} busy={renewing} />
      <div className="ad-seg" role="tablist" style={{ marginBottom: 16 }}>
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>
            {label}
            {key === "students" ? ` (${data.students.length})` : key === "homework" ? ` (${data.homework.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "students" &&
        (data.students.length === 0 ? (
          <Empty icon="users">No student has joined {data.classroom.name} yet. Give them the class code above: they enter it in My Class after they create an account.</Empty>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table ad-league-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Level</th>
                  <th>XP this week</th>
                  <th>Time</th>
                  <th>Questions</th>
                  <th>Accuracy</th>
                  <th>Days</th>
                  <th>Last active</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr key={s.id} onClick={() => nav(studioPath(`/students/${s.id}`))}>
                    <td>
                      <div className="ad-person">
                        <Avatar name={s.name} avatar={s.avatar} />
                        <div>
                          <b>
                            {s.name} {s.muted && <span className="badge badge-warn">Messages paused</span>}
                          </b>
                          <span>{s.email || `ID ${s.candidateId}`}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="ad-chip lvl">Lv {s.level}</span>
                    </td>
                    <td>
                      <b>{s.week.xp.toLocaleString()}</b>
                    </td>
                    <td>{s.week.minutes ? hours(s.week.minutes) : <span className="ad-muted">—</span>}</td>
                    <td>{s.week.questions || <span className="ad-muted">—</span>}</td>
                    <td style={{ minWidth: 120 }}>
                      {s.week.accuracy === null ? (
                        <span className="ad-muted">—</span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="ad-bar" style={{ flex: 1 }}>
                            <i className={accClass(s.week.accuracy)} style={{ width: `${Math.round(s.week.accuracy * 100)}%` }} />
                          </div>
                          <b style={{ fontSize: 13 }}>{Math.round(s.week.accuracy * 100)}%</b>
                        </div>
                      )}
                    </td>
                    <td>{s.week.days}/7</td>
                    <td className="ad-muted">{timeAgo(s.lastActive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "chat" && (
        <>
          <p className="ad-small ad-muted" style={{ margin: "0 0 12px" }}>
            The newest {data.chat.length ? data.chat.length : ""} messages of the class's own room, oldest first. Students are told that teachers can read it. Private chats between two students are not shown here unless one of them reports a message.
          </p>
          {data.chat.length === 0 ? (
            <Empty icon="chat">Nothing has been written in this class's chat yet.</Empty>
          ) : (
            <ul className="ad-cls-chat scroll">
              {data.chat.map((m) => (
                <ChatLine key={m.id} m={m} onRemove={act(onRemove)} onMute={act(onMute)} />
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "homework" &&
        hasHomework &&
        (data.homework.length === 0 ? (
          <Empty icon="checklist">
            No homework has been set for {data.classroom.name}.
            <div style={{ marginTop: 12 }}>
              <Link to={studioPath("/homework")} className="btn btn-secondary btn-sm">
                Set homework
              </Link>
            </div>
          </Empty>
        ) : (
          data.homework.map((h) => (
            <div key={h.id} className="list-row">
              <div style={{ minWidth: 0 }}>
                <div className="list-row-title">{h.title}</div>
                <div className="list-row-meta" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <span className={`badge ${h.past ? "badge-muted" : "badge-good"}`}>{h.past ? `Was due ${day(h.due)}` : `Due ${day(h.due)}`}</span>
                  <span className="badge badge-muted">{h.count} questions</span>
                  <span className="badge badge-muted">
                    {h.finished} of {h.students} finished
                  </span>
                  {h.score != null && <span className="badge badge-muted">{Math.round(h.score * 100)}% right at the first try</span>}
                </div>
              </div>
              <Link className="btn btn-secondary btn-sm" to={studioPath(`/homework?open=${h.id}`)}>
                <Icon name="eye" size={14} /> Results
              </Link>
            </div>
          ))
        ))}
    </div>
  );
}

export default function Classes() {
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const { refreshInbox } = useOutletContext() || {};
  const { has } = useStudio();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [stampKey, setStampKey] = useState(0);
  const [making, setMaking] = useState(false);
  const [formKey, setFormKey] = useState(0); // a new class empties the "new class" field
  const open = params.get("class") || null;

  const load = useCallback(() => {
    adminClasses(token)
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message));
    adminClassReports(token)
      .then((d) => setReports(d.reports))
      .catch(() => {
        /* the list keeps what it had */
      });
    refreshInbox?.();
  }, [token, refreshInbox]);
  useEffect(() => {
    load();
  }, [load]);

  const changed = () => {
    load();
    setStampKey((k) => k + 1);
  };

  async function remove(m) {
    if (!(await askConfirm({ title: "Remove this message?", message: `"${(m.body || "A shared question").slice(0, 120)}" from ${m.from.name}. Students will see that a message was removed.`, confirmLabel: "Remove" }))) return;
    try {
      await adminRemoveClassMessage(token, m.id);
      toast.success("Message removed");
    } catch (e) {
      toast.error(e.message);
    }
  }
  async function mute(from) {
    const pausing = !from.muted;
    if (pausing && !(await askConfirm({ title: `Pause ${from.name}'s messages?`, message: "They will still be able to read their class's chats, but not write, until you let them again.", confirmLabel: "Pause", danger: false }))) return;
    try {
      await adminUpdateStudent(token, from.id, { chatMuted: pausing });
      toast.success(pausing ? `${from.name} can't write in the chats for now` : `${from.name} can write again`);
    } catch (e) {
      toast.error(e.message);
    }
  }
  async function dismiss(r) {
    try {
      await adminDismissClassReport(token, r.messageId);
      toast.success("Kept. The report is closed.");
      changed();
    } catch (e) {
      toast.error(e.message);
    }
  }
  const withReload = (fn) => async (arg) => {
    await fn(arg);
    changed();
  };

  // A teacher makes a class and names it. It comes back with its code, and opens.
  async function makeClass(name) {
    setMaking(true);
    try {
      const made = await adminCreateClass(token, name);
      toast.success(`${made.name} is ready. Its class code is ${made.code}.`);
      setFormKey((k) => k + 1);
      setParams({ class: made.id });
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMaking(false);
    }
  }

  const total = data ? data.classes.reduce((s, c) => s + c.students, 0) : 0;
  const studied = data ? data.classes.reduce((s, c) => s + c.studied, 0) : 0;

  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <span className="ad-eyebrow">People</span>
          <h1>Classes</h1>
          <p>Make a class, give it a name, and hand its class code to your students: the code is the only way in. A student who isn't in a class studies on their own and isn't listed here.</p>
        </div>
        <div className="ad-actions">
          {has("homework") && (
            <Link to={studioPath("/homework")} className="btn btn-primary">
              <Icon name="checklist" size={16} /> Set homework
            </Link>
          )}
          <Link to={studioPath("/announcements")} className={`btn ${has("homework") ? "btn-secondary" : "btn-primary"}`}>
            <Icon name="megaphone" size={16} /> Announce
          </Link>
        </div>
      </div>

      {error ? (
        <div className="ad-card">
          <Empty icon="warning">
            Couldn't load the classes: {error}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={load}>
                Try again
              </button>
            </div>
          </Empty>
        </div>
      ) : !data ? (
        <div className="ns-loading">
          <div className="ns-spinner" />
        </div>
      ) : (
        <>
          <div className="ad-grid-4">
            <Kpi icon="users" tone="violet" label="Students in classes" value={total} sub={data.classes.length === 1 ? "in 1 class" : `across ${data.classes.length} classes`} />
            <Kpi icon="flame" tone="amber" label="Studied this week" value={studied} sub={total ? `${Math.round((studied / total) * 100)}% of them` : "—"} />
            <Kpi icon="flag" tone="rose" label="Reported messages" value={data.reports} sub={data.reports ? "waiting for a teacher" : "nothing to look at"} />
            {/* Students outside the classes have no teacher, so only the admin is told about them. */}
            {data.outside ? (
              <Kpi icon="eye" tone="green" label="Outside the classes" value={data.outside.elsewhere + data.outside.notAsked} sub={`${data.outside.elsewhere} said they have no class · ${data.outside.notAsked} haven't answered`} />
            ) : (
              <Kpi icon="checklist" tone="green" label="Homework open" value={data.classes.reduce((s, c) => s + c.homeworkOpen, 0)} sub="set and not yet due, across the classes" />
            )}
          </div>

          {reports.length > 0 && <Reports reports={reports} onRemove={withReload(remove)} onDismiss={dismiss} onMute={withReload(mute)} />}

          <div className="ad-card ad-cls-make">
            <div className="ad-card-head">
              <h3>
                <Icon name="plus" size={18} /> New class
              </h3>
              <span>You choose the name. The class gets its code as soon as you make it.</span>
            </div>
            <ClassNameForm key={formKey} max={data.limits.name} busy={making} submitLabel={making ? "Making…" : "Make class"} onSubmit={makeClass} />
          </div>

          {data.classes.length === 0 && (
            <div className="ad-card">
              <Empty icon="users">There are no classes yet. Make your first one above, then give its code to your students: they enter it in My Class.</Empty>
            </div>
          )}

          <div className="ad-cls-grid">
            {data.classes.map((c) => (
              <button key={c.id} type="button" className={`ad-cls-card ${open === c.id ? "on" : ""}`} aria-pressed={open === c.id} onClick={() => setParams(open === c.id ? {} : { class: c.id })}>
                <span className="ad-cls-num">{c.mark}</span>
                <span className="ad-cls-card-main">
                  <b>{c.name}</b>
                  <span>
                    {c.students} student{c.students === 1 ? "" : "s"}
                    {c.students > 0 && ` · ${c.studied} studied this week`}
                  </span>
                </span>
                <span className="ad-cls-card-code">
                  Code <b>{c.code}</b>
                </span>
                {c.students > 0 && (
                  <>
                    <span className="ad-cls-goal">
                      <span className="ad-bar">
                        <i className={c.goal?.reached ? "good" : ""} style={{ width: `${Math.min(100, c.goal?.percent || 0)}%` }} />
                      </span>
                      <small>{c.goal ? `${c.xp.toLocaleString()} of ${c.goal.target.toLocaleString()} XP class goal` : `${c.xp.toLocaleString()} XP this week`}</small>
                    </span>
                    <span className="ad-cls-facts">
                      <span className="ad-chip">{hours(c.minutes)} studied</span>
                      <span className="ad-chip">{c.homeworkOpen} homework open</span>
                      <span className="ad-chip">
                        {c.messagesWeek} message{c.messagesWeek === 1 ? "" : "s"}
                      </span>
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>

          {open ? (
            <ClassDetail
              key={open}
              classId={open}
              nameMax={data.limits.name}
              reload={load}
              onGone={() => {
                setParams({});
                load();
              }}
              onRemove={remove}
              onMute={mute}
              stampKey={stampKey}
            />
          ) : (
            data.classes.length > 0 && (
              <p className="ad-muted" style={{ margin: 0, fontSize: 14 }}>
                Choose a class to see its code, its students, its chat and its homework, or to rename or delete it. To move a student to another class, or out of the classes, open their profile and press Edit.
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}
