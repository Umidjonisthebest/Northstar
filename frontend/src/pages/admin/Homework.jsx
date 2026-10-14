import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { adminCreateHomework, adminDeleteHomework, adminDrawHomework, adminHomework, adminHomeworkDetail, adminPracticeDomains } from "../../api.js";
import { useAdminAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useConfirm } from "../../components/Confirm.jsx";
import Icon from "../../components/Icon.jsx";
import { Empty, timeAgo } from "../../components/adminUi.jsx";
import ClassPicker, { classesLabel, classesPhrase } from "./ClassPicker.jsx";
import { studioPath } from "../../studio/panels.js";
import { ExamTag } from "../../studio/SectionKit.jsx";

// Homework in the studio: a set of question-bank questions for one class, several, or all.
// The teacher says what kind of questions and how many, looks at what was drawn (and can draw
// again or drop some), then sets it. Students have nothing to hand in: the server reads each
// one's progress from the answers they give (backend/homework.js).

const LEVELS = ["Easy", "Medium", "Hard", "Challenging"];
const day = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
// How long a student was away from the homework page, in all: "40 s", "12 min", "1 h 5 min".
const away = (seconds) => (seconds < 60 ? `${seconds} s` : seconds < 3600 ? `${Math.round(seconds / 60)} min` : `${Math.floor(seconds / 3600)} h ${Math.round((seconds % 3600) / 60)} min`);
const addDays = (key, n) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function QuestionRow({ q, onRemove }) {
  return (
    <li className="ad-hw-q">
      <div>
        <b>{q.title}</b>
        <span>
          {q.section === "Math" ? "Math" : "R&W"} · {q.topic} · {q.difficulty}
          {q.type === "grid_in" ? " · typed answer" : ""}
          {q.picture ? " · picture" : ""}
        </span>
      </div>
      {onRemove && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemove(q)} aria-label={`Take out "${q.title}"`}>
          <Icon name="close" size={14} />
        </button>
      )}
    </li>
  );
}

function NewHomework({ meta, onSaved }) {
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const [skills, setSkills] = useState(null); // { "Math": { domain: [skill] }, ... }
  // `classIds`: the ids of the classes it is for, or "all" for every class there is now.
  const [form, setForm] = useState({ title: "", note: "", classIds: [], due: addDays(meta.limits.due.min, 7) });
  const [spec, setSpec] = useState({ section: "", skills: [], difficulty: [], count: 10 });
  const [picked, setPicked] = useState([]);
  const [available, setAvailable] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const max = meta.limits.questions;

  useEffect(() => {
    adminPracticeDomains(token)
      .then((d) => setSkills(d.skills))
      .catch(() => setSkills({}));
  }, [token]);

  const sections = skills ? Object.keys(skills) : [];
  const offered = skills ? sections.filter((s) => !spec.section || s === spec.section) : [];
  const toggle = (key, v) => setSpec((s) => ({ ...s, [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v] }));

  // `keep` adds to what is already chosen; without it the draw starts again.
  async function draw(keep) {
    const want = keep ? Math.min(Number(spec.count) || 0, max - picked.length) : Number(spec.count) || 0;
    if (want < 1) return toast.error(keep ? `A homework can have ${max} questions at most` : "Say how many questions you want");
    setDrawing(true);
    try {
      const r = await adminDrawHomework(token, { section: spec.section || undefined, skills: spec.skills, difficulty: spec.difficulty, count: want, exclude: picked.map((q) => q.id) });
      setAvailable(r.available);
      if (r.questions.length === 0) toast.error(keep ? "There are no more questions like that in the bank" : "No question in the bank matches. Try other skills or levels.");
      else if (r.questions.length < want) toast.info(`The bank has only ${r.questions.length} more like that`);
      setPicked(keep ? [...picked, ...r.questions] : r.questions);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDrawing(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminCreateHomework(token, { ...form, questionIds: picked.map((q) => q.id) });
      toast.success(`Set for ${classesPhrase(form.classIds, meta.classes)}. Students see it in My Class.`);
      setForm((f) => ({ ...f, title: "", note: "" }));
      setPicked([]);
      setAvailable(null);
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Homework is set for a class: with none made yet, or none chosen, it can't be set.
  const ready = form.title.trim() && meta.classes.length > 0 && (form.classIds === "all" || form.classIds.length > 0) && form.due && picked.length > 0;

  return (
    <form className="ad-card" onSubmit={save}>
      <div className="ad-card-head">
        <h3>
          <Icon name="checklist" size={18} /> New homework
        </h3>
      </div>
      <div className="field">
        <label htmlFor="hw-title">Title</label>
        <input id="hw-title" maxLength={meta.limits.title} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Linear equations, set 2" required />
      </div>
      <div className="field">
        <label htmlFor="hw-note">Note for the students (optional)</label>
        <textarea id="hw-note" rows={2} maxLength={meta.limits.note} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Show your working in your notebook. We go over it on Friday." />
      </div>
      <div className="field">
        <label>Classes</label>
        <ClassPicker value={form.classIds} onChange={(classIds) => setForm({ ...form, classIds })} classes={meta.classes} />
      </div>
      <div className="field">
        <label htmlFor="hw-due">Due</label>
        <input id="hw-due" type="date" min={meta.limits.due.min} max={meta.limits.due.max} value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} required />
      </div>

      <div className="ad-hw-draw">
        <p className="ad-hw-step">Questions</p>
        <div className="field">
          <label>Section</label>
          <div className="ad-seg">
            {[["", "Any"], ...sections.map((s) => [s, s])].map(([v, label]) => (
              <button key={label} type="button" className={spec.section === v ? "on" : ""} onClick={() => setSpec((s) => ({ ...s, section: v, skills: [] }))}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Skills (none chosen means any)</label>
          {!skills ? (
            <p className="ad-small ad-muted">Loading the skills…</p>
          ) : (
            <div className="ad-hw-skills">
              {offered.map((section) =>
                Object.entries(skills[section]).map(([domain, list]) => (
                  <div key={`${section}-${domain}`}>
                    <small>{domain}</small>
                    <div>
                      {list.map((skill) => (
                        <button key={skill} type="button" aria-pressed={spec.skills.includes(skill)} className={spec.skills.includes(skill) ? "on" : ""} onClick={() => toggle("skills", skill)}>
                          {skill}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="field-row">
          <div className="field">
            <label>Level (none chosen means any)</label>
            <div className="ad-hw-levels">
              {LEVELS.map((l) => (
                <button key={l} type="button" aria-pressed={spec.difficulty.includes(l)} className={spec.difficulty.includes(l) ? "on" : ""} onClick={() => toggle("difficulty", l)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ maxWidth: 150 }}>
            <label htmlFor="hw-count">How many</label>
            <input id="hw-count" type="number" min={1} max={max} value={spec.count} onChange={(e) => setSpec({ ...spec, count: e.target.value })} />
          </div>
        </div>
        <div className="ad-actions">
          <button type="button" className="btn btn-secondary" disabled={drawing} onClick={() => draw(false)}>
            <Icon name="shuffle" size={15} /> {picked.length ? "Draw again" : "Draw questions"}
          </button>
          {picked.length > 0 && picked.length < max && (
            <button type="button" className="btn btn-ghost" disabled={drawing} onClick={() => draw(true)}>
              <Icon name="plus" size={15} /> Add more like these
            </button>
          )}
        </div>
        {picked.length > 0 && (
          <>
            <p className="ad-small ad-muted" style={{ margin: "14px 0 8px" }}>
              {picked.length} question{picked.length === 1 ? "" : "s"} chosen{available !== null ? `, from ${available.toLocaleString()} that match` : ""}. Students get them in this order.
            </p>
            <ul className="ad-hw-qs">
              {picked.map((q) => (
                <QuestionRow key={q.id} q={q} onRemove={(x) => setPicked((p) => p.filter((y) => y.id !== x.id))} />
              ))}
            </ul>
          </>
        )}
      </div>

      <button className="btn btn-primary" style={{ marginTop: 18, width: "100%", justifyContent: "center" }} disabled={saving || !ready}>
        <Icon name="checklist" size={16} /> {saving ? "Setting…" : picked.length ? `Set ${picked.length} question${picked.length === 1 ? "" : "s"} as homework` : "Set homework"}
      </button>
      {!ready && <p className="ad-small ad-muted" style={{ margin: "8px 0 0", textAlign: "center" }}>It needs a title, at least one class, a due date and its questions.</p>}
    </form>
  );
}

// `classes` is every class there is, so the line under the title can say "All classes".
function Results({ id, classes, onClose, onDeleted }) {
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    setError("");
    adminHomeworkDetail(token, id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token, id]);

  async function remove() {
    if (!(await askConfirm({ title: `Take back "${data.title}"?`, message: "It disappears from every student's homework list. The answers they gave stay theirs.", confirmLabel: "Take it back" }))) return;
    try {
      await adminDeleteHomework(token, id);
      toast.success("Homework taken back");
      onDeleted();
    } catch (e) {
      toast.error(e.message);
    }
  }

  if (error)
    return (
      <div className="ad-card">
        <Empty icon="warning">Couldn't load this homework: {error}</Empty>
      </div>
    );
  if (!data)
    return (
      <div className="ns-loading">
        <div className="ns-spinner" />
      </div>
    );

  // `data.classes`: the classes it was set for that still exist, each with its name.
  const severalClasses = data.classes.length > 1;

  return (
    <div className="ad-card">
      <div className="ad-card-head">
        <h3>
          <Icon name="checklist" size={18} /> {data.title}
        </h3>
        <div className="ad-actions">
          <button type="button" className="btn btn-danger btn-sm" onClick={remove}>
            <Icon name="trash" size={14} /> Take back
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close the results">
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>
      <p className="ad-muted" style={{ margin: "0 0 14px", fontSize: 14 }}>
        {classesLabel(data.classIds, classes)} · {data.past ? "was due" : "due"} {day(data.due)} · {data.count} questions{data.by ? ` · set by ${data.by}` : ""}
      </p>
      {data.note && <p className="ad-hw-note">{data.note}</p>}

      {data.students.length === 0 ? (
        <Empty icon="users">No student is in {data.classes.length === 1 ? "this class" : "these classes"} yet.</Empty>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table ad-league-table ad-hw-table">
            <thead>
              <tr>
                <th>Student</th>
                {severalClasses && <th>Class</th>}
                <th>Done</th>
                <th>First try</th>
                <th>Finished</th>
                <th>Left the page</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.id} style={{ cursor: "default" }}>
                  <td>
                    <Link to={studioPath(`/students/${s.id}`)} className="ad-link">
                      {s.name}
                    </Link>
                  </td>
                  {severalClasses && <td>{s.className}</td>}
                  <td style={{ minWidth: 120 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="ad-bar" style={{ flex: 1 }}>
                        <i className={s.finishedAt ? "good" : ""} style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%` }} />
                      </div>
                      <b style={{ fontSize: 13 }}>
                        {s.done}/{s.total}
                      </b>
                    </div>
                  </td>
                  <td>{s.done ? `${s.correct} of ${s.done} right` : <span className="ad-muted">—</span>}</td>
                  <td>
                    {s.finishedAt ? (
                      <span className={`badge ${s.late ? "badge-warn" : "badge-good"}`}>{s.late ? "Late" : "On time"} · {timeAgo(s.finishedAt)}</span>
                    ) : s.done ? (
                      <span className="badge badge-muted">Working on it</span>
                    ) : (
                      <span className="ad-muted">Not started</span>
                    )}
                  </td>
                  <td>
                    {s.leaves ? (
                      <span className="badge badge-warn" title={s.leaves.last ? `Last time: ${new Date(s.leaves.last).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : undefined}>
                        <Icon name="warning" size={13} />
                        &nbsp;{s.leaves.n} {s.leaves.n === 1 ? "time" : "times"}
                        {s.leaves.seconds > 0 && ` · ${away(s.leaves.seconds)} away`}
                      </span>
                    ) : (
                      <span className="ad-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="ad-hw-details">
        <summary>The {data.questions.length} questions</summary>
        <ul className="ad-hw-qs">
          {data.questions.map((q) => (
            <QuestionRow key={q.id} q={q} />
          ))}
        </ul>
      </details>
      <p className="ad-small ad-muted" style={{ margin: "12px 0 0" }}>
        A question is done once the student answers it after the homework was set. It is right when that first answer was right, without a second try or opening the explanation first.
        "Left the page" counts each time a student switched to another tab, window or app while the homework was open, until they finished it. They are told
        this before they start; nothing is closed for it.
      </p>
    </div>
  );
}

export default function Homework() {
  const { token } = useAdminAuth();
  const [params, setParams] = useSearchParams();
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const open = params.get("open");

  const load = useCallback(() => {
    adminHomework(token)
      .then((d) => {
        setMeta(d);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <ExamTag exam="sat" />
          <h1>Homework</h1>
          <p>Give a class a set of questions from the SAT question bank. It finishes itself as each student answers them, and you see who has done it and how.</p>
        </div>
      </div>

      {error ? (
        <div className="ad-card">
          <Empty icon="warning">
            Couldn't load the homework: {error}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={load}>
                Try again
              </button>
            </div>
          </Empty>
        </div>
      ) : !meta ? (
        <div className="ns-loading">
          <div className="ns-spinner" />
        </div>
      ) : (
        <div className="ad-ann-grid">
          <NewHomework meta={meta} onSaved={load} />

          <div className="ad-hw-side">
            {open && (
              <Results
                key={open}
                id={open}
                classes={meta.classes}
                onClose={() => setParams({})}
                onDeleted={() => {
                  setParams({});
                  load();
                }}
              />
            )}
            <div className="ad-card">
              <div className="ad-card-head">
                <h3>
                  <Icon name="clock" size={18} /> Set so far
                </h3>
                <span>{meta.homework.length} total</span>
              </div>
              {meta.homework.length === 0 && <Empty icon="checklist">Nothing has been set yet.</Empty>}
              {meta.homework.map((h) => {
                const students = h.classes.reduce((s, c) => s + c.students, 0);
                const finished = h.classes.reduce((s, c) => s + c.finished, 0);
                // Students who left the homework page while doing it (they are told before they start).
                const left = h.classes.reduce((s, c) => s + (c.left || 0), 0);
                return (
                  <div key={h.id} className={`list-row ${open === h.id ? "ad-hw-on" : ""}`}>
                    <div style={{ minWidth: 0 }}>
                      <div className="list-row-title">{h.title}</div>
                      <div className="list-row-meta" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        <span className="badge badge-muted">{classesLabel(h.classIds, meta.classes)}</span>
                        <span className={`badge ${h.past ? "badge-muted" : "badge-good"}`}>
                          {h.past ? "Was due" : "Due"} {day(h.due)}
                        </span>
                        <span className="badge badge-muted">{h.count} questions</span>
                        <span className="badge badge-muted">
                          {finished} of {students} finished
                        </span>
                        {left > 0 && (
                          <span className="badge badge-warn">
                            <Icon name="warning" size={13} />
                            &nbsp;{left} left the page
                          </span>
                        )}
                      </div>
                    </div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setParams({ open: h.id })}>
                      <Icon name="eye" size={14} /> Results
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
