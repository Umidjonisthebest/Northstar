import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminPracticeCreate, adminPracticeDelete, adminPracticeDomains, adminPracticeImport, adminPracticeList, adminPracticeReports, adminPracticeStats, adminPracticeUpdate, adminResolvePracticeReport
} from "../api.js";
import { useAdminAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { useConfirm } from "../components/Confirm.jsx";
import Icon from "../components/Icon.jsx";
import { studioPath } from "../studio/panels.js";
import { ExamTag } from "../studio/SectionKit.jsx";

const EMPTY = {
  type: "mcq", section: "Reading & Writing", domain: "", topic: "", difficulty: "Medium", title: "", passage: "", prompt: "",
  options: ["", "", "", ""], rationales: ["", "", "", ""], correctIndex: 0, correctAnswer: "", explanation: "", steps: [], hint: "", keyQuote: ""
};
const REASON_LABEL = {
  typo: "Typo or formatting problem",
  wrong_answer: "The answer seems wrong",
  unclear_explanation: "The explanation is unclear",
  confusing: "The question is confusing",
  other: "Something else"
};

const LIST_PAGE = 200;
// Where a question came from (`source` on the record), as the list shows it and the filter finds it:
// the converted PDF pack, or the owner's own question bank (backend/content/originals).
const SOURCE_LABEL = { "college-board": "Question pack", "northstar-bank": "Northstar original" };

// A question from the owner's pack that exists only as a picture: what the student sees.
function PackPicture({ image, label }) {
  if (!image?.src) return null;
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ padding: 10, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, overflowX: "auto" }}>
        <img src={`/api/bank-media/${image.src}`} width={image.w} height={image.h} alt={label} style={{ display: "block", maxWidth: "none", height: "auto", width: Math.round(image.w * 1.2) }} />
      </div>
    </div>
  );
}

function Editor({ initial, domainMap, skillMap, onClose, onSaved }) {
  const { token } = useAdminAuth();
  const [f, setF] = useState(() => {
    const options = [...(initial?.options || EMPTY.options)];
    return {
      ...EMPTY,
      ...initial,
      options,
      rationales: options.map((_, i) => initial?.rationales?.[i] || ""),
      steps: (initial?.steps || []).map((s) => ({ title: s.title || "", body: s.body || "" }))
    };
  });
  const [err, setErr] = useState("");
  const isEdit = Boolean(initial?.id);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const domainOptions = domainMap[f.section] || [];
  const skillOptions = skillMap?.[f.section]?.[f.domain] || [];

  useEffect(() => {
    if (!f.domain && domainOptions.length) set("domain", domainOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainOptions.length]);

  const setSection = (section) => {
    const options = domainMap[section] || [];
    setF((x) => ({ ...x, section, domain: options.includes(x.domain) ? x.domain : options[0] || "", topic: "" }));
  };

  async function save() {
    setErr("");
    try {
      // Blank options are dropped, so the marked-correct index must be re-pointed at the filtered
      // list: with "A, (blank), C, D" and C marked correct it used to save D as the answer.
      const keep = f.options.map((o, i) => ({ text: o.trim(), why: f.rationales[i] || "", at: i })).filter((o) => o.text);
      const correctIndex = keep.findIndex((o) => o.at === f.correctIndex);
      if (f.type === "mcq" && correctIndex < 0) {
        setErr("The option marked correct is empty. Type its text, or mark a different option.");
        return;
      }
      const body = {
        ...f,
        topic: f.topic || skillOptions[0] || "",
        options: keep.map((o) => o.text),
        rationales: keep.map((o) => o.why),
        correctIndex: Math.max(0, correctIndex),
        steps: f.steps.filter((s) => s.title.trim() || s.body.trim())
      };
      if (initial?.id) await adminPracticeUpdate(token, initial.id, body);
      else await adminPracticeCreate(token, body);
      onSaved();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{initial?.id ? "Edit practice question" : "New practice question"}</h2>
          <button className="modal-close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Question type</label>
            <select value={f.type} onChange={(e) => set("type", e.target.value)} disabled={isEdit}>
              <option value="mcq">Multiple choice</option>
              <option value="grid_in">Grid-in (numeric answer)</option>
            </select>
            {isEdit && <p className="hint">Question type can't be changed after creation — delete and re-add instead.</p>}
          </div>
          <div className="field">
            <label>Section</label>
            <select value={f.section} onChange={(e) => setSection(e.target.value)}>
              <option>Reading & Writing</option>
              <option>Math</option>
            </select>
          </div>
          <div className="field">
            <label>Domain</label>
            <select value={f.domain} onChange={(e) => setF((x) => ({ ...x, domain: e.target.value, topic: "" }))}>
              {domainOptions.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <p className="hint">College Board's reporting category — this is what students filter and browse by.</p>
          </div>
          <div className="field">
            <label>Skill</label>
            <select value={f.topic || skillOptions[0] || ""} onChange={(e) => set("topic", e.target.value)}>
              {[...new Set([...skillOptions, ...(f.topic && !skillOptions.includes(f.topic) ? [f.topic] : [])])].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Difficulty</label>
            <select value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
              <option>Challenging</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Short title (shown in the library)</label>
          <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="The comma splice that looks right" />
        </div>
        <PackPicture image={initial?.promptImage} label="The question as students see it (a picture; the answer buttons show the letters only)" />
        <PackPicture image={initial?.image} label="Graph or table shown with the passage" />
        <div className="field">
          <label>Passage (optional)</label>
          <textarea rows={5} value={f.passage} onChange={(e) => set("passage", e.target.value)} placeholder="Shown on the left side of the practice player." />
          <p className="hint">
            A line that says "Text 1" or "Text 2" becomes a label, lines starting with "• " become bullets, and ______ shows as a blank.
            {initial?.underline ? ` This passage has an underlined part: “${String(initial.passage || "").slice(initial.underline[0], initial.underline[1])}”. It stays underlined as long as those words stay in the passage.` : ""}
          </p>
        </div>
        <div className="field">
          <label>Question</label>
          <textarea rows={3} value={f.prompt} onChange={(e) => set("prompt", e.target.value)} />
        </div>
        {f.type === "mcq" ? (
          <div className="field">
            <label>Answer options — click the letter to mark the correct one; the line below each option explains why it's right or wrong</label>
            {f.options.map((o, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <button type="button" className={`btn btn-sm ${f.correctIndex === i ? "btn-primary" : "btn-secondary"}`} onClick={() => set("correctIndex", i)} style={{ width: 40, justifyContent: "center" }}>
                    {String.fromCharCode(65 + i)}
                  </button>
                  <input style={{ flex: 1 }} value={o} onChange={(e) => set("options", f.options.map((x, j) => (j === i ? e.target.value : x)))} />
                  {f.options.length > 2 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setF((x) => ({
                          ...x,
                          options: x.options.filter((_, j) => j !== i),
                          rationales: x.rationales.filter((_, j) => j !== i),
                          correctIndex: x.correctIndex >= i && x.correctIndex > 0 ? x.correctIndex - 1 : x.correctIndex
                        }))
                      }
                    >
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
                <input
                  style={{ width: "100%", fontSize: 13 }}
                  value={f.rationales[i] || ""}
                  onChange={(e) => set("rationales", f.options.map((_, j) => (j === i ? e.target.value : f.rationales[j] || "")))}
                  placeholder={f.correctIndex === i ? "Why this answer is correct" : "Why this answer is wrong"}
                />
              </div>
            ))}
            {f.options.length < 6 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF((x) => ({ ...x, options: [...x.options, ""], rationales: [...x.rationales, ""] }))}>
                + Add option
              </button>
            )}
          </div>
        ) : (
          <div className="field">
            <label>Correct numeric answer</label>
            <input value={f.correctAnswer} onChange={(e) => set("correctAnswer", e.target.value)} placeholder="e.g. 81" style={{ maxWidth: 220 }} />
            <p className="hint">Students type this exact value. Keep it simple — a whole number or a short fraction like 3/4.</p>
          </div>
        )}
        <PackPicture image={initial?.explanationImage} label="The worked explanation students see (a picture)" />
        <div className="field">
          <label>Explanation summary</label>
          <textarea rows={2} value={f.explanation} onChange={(e) => set("explanation", e.target.value)} />
        </div>
        <div className="field">
          <label>Step-by-step explanation (revealed one step at a time)</label>
          {f.steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
              <span className="badge badge-muted" style={{ marginTop: 8 }}>{i + 1}</span>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <input value={s.title} placeholder="Step title, e.g. Identify the target" onChange={(e) => set("steps", f.steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <textarea rows={2} value={s.body} placeholder="What to do in this step" onChange={(e) => set("steps", f.steps.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("steps", f.steps.filter((_, j) => j !== i))} aria-label="Remove step">
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          {f.steps.length < 8 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("steps", [...f.steps, { title: "", body: "" }])}>
              + Add step
            </button>
          )}
        </div>
        <div className="field-row">
          <div className="field">
            <label>Hint for Nova (optional)</label>
            <input value={f.hint} onChange={(e) => set("hint", e.target.value)} placeholder="A nudge that doesn't give the answer away" />
          </div>
          <div className="field">
            <label>Key evidence (optional)</label>
            <input value={f.keyQuote} onChange={(e) => set("keyQuote", e.target.value)} placeholder="Copied exactly from the passage" />
            <p className="hint">Nova highlights this in the passage when a student asks for the key part.</p>
          </div>
        </div>
        {err && <p className="error-text">{err}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save question</button>
        </div>
      </div>
    </div>
  );
}

export default function PracticeBank() {
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const [list, setList] = useState(null);
  const [stats, setStats] = useState(null);
  const [domainMap, setDomainMap] = useState({});
  const [skillMap, setSkillMap] = useState({});
  const [reports, setReports] = useState([]);
  const [edit, setEdit] = useState(null);
  const [filter, setFilter] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const load = () => {
    adminPracticeList(token).then((d) => setList(d.questions));
    adminPracticeStats(token).then(setStats);
    adminPracticeReports(token)
      .then((d) => setReports(d.reports))
      .catch(() => {});
  };
  useEffect(load, [token]);
  useEffect(() => {
    adminPracticeDomains(token).then((d) => {
      setDomainMap(d.domains || {});
      setSkillMap(d.skills || {});
    });
  }, [token]);

  // "pack" finds the questions that came from the owner's question pack, "original" the ones from
  // their own question bank, "picture" the ones that
  // are pictures (see backend/content/pack).
  // Every word typed has to be there, in any order ("circles hard picture").
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const matching = (list || []).filter((q) => {
    const hay = `${q.title} ${q.topic} ${q.section} ${q.domain || ""} ${q.difficulty} ${SOURCE_LABEL[q.source] || ""} ${q.promptImage ? "picture" : ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  // The bank can hold a couple of thousand questions; a page of rows at a time keeps it quick.
  const shown = matching.slice(0, LIST_PAGE);
  const reported = new Set(reports.map((r) => r.questionId));

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <ExamTag exam="sat" />
          <h1 style={{ marginTop: 8 }}>Question bank</h1>
          <p>The SAT questions students practise one at a time: the Question Bank, drills, homework and the mistakes queue. (A practice test has its own questions.)</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setImportOpen(true)}><Icon name="download" size={16} style={{ transform: "rotate(180deg)" }} /> Import JSON</button>
          <button className="btn btn-primary" onClick={() => setEdit({})}><Icon name="plus" size={16} /> New question</button>
        </div>
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
          {[["Practice questions", stats.questions], ["Vocabulary words", stats.vocab], ["Students", stats.students]].map(([l, v]) => (
            <div className="card" key={l} style={{ padding: 18 }}>
              <div className="hint">{l}</div>
              <div style={{ fontFamily: "var(--display)", fontSize: 28, fontWeight: 700 }}>{v}</div>
            </div>
          ))}
          {/* The all-time XP leaderboard that used to be here was replaced by weekly leagues. */}
          <Link className="card" to={studioPath("/leagues")} style={{ padding: 18, textDecoration: "none", color: "inherit" }}>
            <div className="hint">Weekly leagues</div>
            <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Icon name="podium" size={16} /> See this week's tables</div>
          </Link>
        </div>
      )}

      {reports.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="flag" size={18} /> Student reports ({reports.length})
          </h3>
          {reports.map((r) => {
            const q = (list || []).find((x) => x.id === r.questionId);
            return (
              <div className="list-row" key={r.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="list-row-title">{r.questionTitle}</div>
                  <div className="list-row-meta">
                    {REASON_LABEL[r.reason] || r.reason} · {r.student} · {new Date(r.createdAt).toLocaleDateString()}
                    {r.comment ? ` · “${r.comment}”` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {q && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setEdit(q)}>
                      Edit question
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      try {
                        await adminResolvePracticeReport(token, r.id);
                        setReports((list) => list.filter((x) => x.id !== r.id));
                        toast.success("Report resolved");
                      } catch (e) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    <Icon name="check" size={14} /> Resolve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="field" style={{ marginBottom: 8 }}>
          <input placeholder="Filter by title, skill, section or level (try “original”, “pack” or “picture”)…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {!list && <p className="hint">Loading…</p>}
        {list && (
          <p className="hint" style={{ marginTop: 0 }}>
            {matching.length > shown.length ? `Showing the first ${shown.length} of ${matching.length.toLocaleString("en-US")} questions. Type in the box to narrow the list.` : `${matching.length.toLocaleString("en-US")} question${matching.length === 1 ? "" : "s"}`}
          </p>
        )}
        {shown.map((q) => (
          <div className="list-row" key={q.id}>
            <div style={{ minWidth: 0 }}>
              <div className="list-row-title">
                {q.title}
                {SOURCE_LABEL[q.source] && <span className="badge badge-muted" style={{ marginLeft: 8 }}>{SOURCE_LABEL[q.source]}</span>}
                {q.promptImage && <span className="badge badge-muted" style={{ marginLeft: 6 }}>Picture</span>}
                {reported.has(q.id) && <span className="badge badge-warn" style={{ marginLeft: 8 }}>Reported</span>}
              </div>
              <div className="list-row-meta">
                {q.section} · {q.domain ? `${q.domain} · ` : ""}{q.topic} · {q.difficulty} · {q.type === "grid_in" ? "grid-in" : `${q.options.length} options`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setEdit(q)}>Edit</button>
              <button
                className="btn btn-danger btn-sm"
                onClick={async () => {
                  if (!(await askConfirm({ title: `Delete "${q.title}"?`, message: "It leaves the question bank for every student.", confirmLabel: "Delete question" }))) return;
                  await adminPracticeDelete(token, q.id);
                  toast.success("Question deleted");
                  load();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {edit && <Editor initial={edit} domainMap={domainMap} skillMap={skillMap} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast.success("Saved"); load(); }} />}

      {importOpen && (
        <div className="modal-backdrop" onClick={() => setImportOpen(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bulk import</h2>
              <button className="modal-close" onClick={() => setImportOpen(false)}><Icon name="close" size={16} /></button>
            </div>
            <p className="hint">
              Paste a JSON array. Multiple choice: <code>{`{"type":"mcq","section":"Math","domain":"Problem-Solving and Data Analysis","topic":"Ratios","difficulty":"Easy","title":"…","prompt":"…","options":["A","B","C","D"],"correctIndex":1,"explanation":"…"}`}</code>
              <br />Grid-in: <code>{`{"type":"grid_in","section":"Math","domain":"Algebra","topic":"Ratios","difficulty":"Easy","title":"…","prompt":"…","correctAnswer":"81","explanation":"…"}`}</code> (type defaults to "mcq"; domain defaults to the section's first domain if omitted or invalid)
            </p>
            <div className="field">
              <textarea rows={10} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="[ { ... }, { ... } ]" />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    const r = await adminPracticeImport(token, JSON.parse(importText));
                    toast.success(`Imported ${r.imported} questions${r.errors.length ? ` · ${r.errors.length} skipped` : ""}`);
                    if (r.errors.length) toast.warning(r.errors.slice(0, 3).join("; "));
                    setImportOpen(false);
                    setImportText("");
                    load();
                  } catch (e) {
                    toast.error(e instanceof SyntaxError ? "That isn't valid JSON" : e.message);
                  }
                }}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
