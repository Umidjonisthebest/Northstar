import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminHideBuiltInSatTest, adminPublishSatTest, adminSatTestFromMock, adminSatTestResult, adminSatTestResults, adminSatTests, satPracticeApi } from "../../api.js";
import { useAdminAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useConfirm } from "../../components/Confirm.jsx";
import Icon from "../../components/Icon.jsx";
import { SkeletonAdminList } from "../../components/SkeletonAdmin.jsx";
import useBackdropClose from "../../components/useBackdropClose.js";
import { Avatar, Empty, timeAgo } from "../../components/adminUi.jsx";
import { SAT_TESTS, studioPath } from "../../studio/panels.js";
import { SectionHead, SectionTabs, SubSwitch, TEST_TABS, useSectionTabs } from "../../studio/SectionKit.jsx";
import TestsList, { DifficultyBadge, TestDetailsModal } from "../TestsList.jsx";
import SessionsList from "../SessionsList.jsx";

// SAT > Practice tests, in both staff panels. Every SAT test is here, in three tabs:
//   Practice tests   the tests a student sits alone (the admin builds and publishes them)
//   Results          what students scored on those
//   Teacher mocks    the tests a teacher builds and runs for a group as a session
// (A mock is a practice test too: it is only run differently.) IELTS has the same section.

const SCOPE = { full: "Full test", rw: "Reading and Writing", math: "Math" };
const LETTERS = "ABCDEF";
const MOCK_VIEWS = [
  ["tests", "Mock tests"],
  ["sessions", "Sessions"]
];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const minutesLabel = (minutes) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`);

function usageLine(t) {
  if (!t.sittings && !t.inProgress) return "Not sat yet";
  const bits = [];
  if (t.sittings) bits.push(`Sat ${plural(t.sittings, "time")} by ${plural(t.students, "student")}`);
  if (t.average != null) bits.push(`average ${t.average}`);
  if (t.inProgress) bits.push(`${t.inProgress} in progress`);
  return bits.join(" · ");
}

function LoadError({ what, message, onRetry }) {
  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>Couldn't load {what}</h2>
      <p style={{ color: "var(--ink-soft)" }}>{message}</p>
      <button className="btn btn-primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

// "Copy a teacher mock": a mock becomes a practice-test draft, the two separate from then on.
function CopyMockModal({ mocks, token, onClose }) {
  const backdrop = useBackdropClose(onClose);
  const nav = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);

  async function copy(mock) {
    setBusy(mock.id);
    try {
      const made = await adminSatTestFromMock(token, mock.id);
      toast.success(`Copied "${mock.title}" as a draft. Publish it when it is ready.`);
      nav(studioPath(`${SAT_TESTS}/${made.id}`));
    } catch (e) {
      toast.error(e.message);
      setBusy(null);
    }
  }

  return (
    <div className="modal-backdrop" {...backdrop}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Copy a teacher mock</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <p style={{ marginTop: 0, color: "var(--ink-soft)" }}>The copy opens as a practice-test draft with the same questions. The mock itself stays as it is.</p>
        {mocks.map((m) => (
          <div className="list-row" key={m.id} style={{ boxShadow: "none" }}>
            <div style={{ minWidth: 0 }}>
              <div className="list-row-title">{m.title}</div>
              <div className="list-row-meta">{plural(m.questionCount, "question")}</div>
            </div>
            <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => copy(m)}>
              <Icon name="copy" size={14} /> {busy === m.id ? "Copying…" : "Copy"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PracticeTab() {
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [copying, setCopying] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await adminSatTests(token));
      setError("");
    } catch (e) {
      setError(e.message || "Couldn't load the practice tests");
    }
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (work, done) => {
    try {
      await work();
      if (done) toast.success(done);
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const publish = (t, published) => run(() => adminPublishSatTest(token, t.id, published), published ? `"${t.title}" is on every student's Practice Tests page now.` : `"${t.title}" is off the students' list. Their results are kept.`);
  const hide = (t, hidden) => run(() => adminHideBuiltInSatTest(token, t.key, hidden), hidden ? `"${t.title}" is hidden from students. Their results are kept.` : `Students can sit "${t.title}" again.`);
  async function remove(t) {
    const sat = t.sittings ? ` ${plural(t.sittings, "sitting")} of it will no longer open for students or in Results.` : "";
    if (!(await askConfirm({ title: "Delete this practice test?", message: `"${t.title}" and its questions are removed for good.${sat}`, confirmLabel: "Delete test" }))) return;
    run(() => satPracticeApi.remove(token, t.id), "Practice test deleted");
  }

  if (!data) return error ? <LoadError what="the practice tests" message={error} onRetry={load} /> : <SkeletonAdminList />;
  const { canEdit, tests, builtIn, mocks } = data;

  return (
    <div>
      <div className="ad-bar-row">
        <p>
          Students sit these on their own, whenever they like: the whole test or one section, timed or untimed.
          {canEdit ? " Make one in two steps: create it and type its questions, then publish it." : " The admin makes them; you can open any of them to read it."}
        </p>
        {canEdit && (
          <div className="ad-sec-actions">
            {mocks.length > 0 && (
              <button className="btn btn-secondary" onClick={() => setCopying(true)}>
                <Icon name="copy" size={16} /> Copy a teacher mock
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} /> Create practice test
            </button>
          </div>
        )}
      </div>

      {(canEdit || tests.length > 0) && (
        <div className="ad-sec-group">
          <h2>Made in the studio</h2>
          <span>{tests.length ? plural(tests.length, "test") : "none yet"}</span>
        </div>
      )}
      {canEdit && tests.length === 0 && (
        <div className="empty-state card">
          No practice tests of your own yet. "Create practice test" gives you the digital SAT's four modules, ready for questions.
        </div>
      )}
      {tests.map((t) => {
        const filled = t.modules.filter((m) => m.questions > 0);
        return (
          <div className="list-row" key={t.id}>
            <div className="ad-row-main">
              <span className={`ad-test-icon ${t.live ? "tone-sky" : "tone-amber"}`}>
                <Icon name={t.live ? "mock" : "pencil"} size={22} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="list-row-title">
                  {t.title} <span className={`badge ${t.published ? "badge-good" : "badge-muted"}`}>{t.published ? "Published" : "Draft"}</span>
                </div>
                <div className="list-row-meta" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="ad-chip">
                    <Icon name="layers" size={12} /> {filled.length} of {plural(t.modules.length, "module")} filled
                  </span>
                  <span className="ad-chip">
                    <Icon name="checklist" size={12} /> {plural(t.questionCount, "question")}
                  </span>
                  <DifficultyBadge value={t.difficulty} />
                  {t.questionCount === 0 && <span className="badge badge-warn">Needs questions</span>}
                  <span>{usageLine(t)}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Link className="btn btn-secondary btn-sm" to={studioPath(`${SAT_TESTS}/${t.id}`)}>
                <Icon name={canEdit ? "pencil" : "eye"} size={14} /> {canEdit ? "Edit" : "Open"}
              </Link>
              {canEdit &&
                (t.published ? (
                  <button className="btn btn-secondary btn-sm" onClick={() => publish(t, false)}>
                    Unpublish
                  </button>
                ) : (
                  <button className="btn btn-primary btn-sm" disabled={t.questionCount === 0} title={t.questionCount === 0 ? "Add at least one question first" : undefined} onClick={() => publish(t, true)}>
                    Publish
                  </button>
                ))}
              {canEdit && (
                <button className="btn btn-danger btn-sm" onClick={() => remove(t)} title="Delete" aria-label={`Delete ${t.title}`}>
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div className="ad-sec-group">
        <h2>Built in</h2>
        <span>{plural(builtIn.length, "test")} that came with Northstar</span>
      </div>
      {builtIn.map((t) => (
        <div className="list-row" key={t.key}>
          <div className="ad-row-main">
            <span className={`ad-test-icon ${t.hidden ? "tone-amber" : "tone-indigo"}`}>
              <Icon name="mock" size={22} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="list-row-title">
                {t.title} {t.hidden && <span className="badge badge-muted">Hidden from students</span>}
              </div>
              <div className="list-row-meta" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span className="ad-chip">
                  <Icon name="layers" size={12} /> {plural(t.moduleCount, "module")}
                </span>
                <span className="ad-chip">
                  <Icon name="checklist" size={12} /> {plural(t.questionCount, "question")}
                </span>
                <span className="ad-chip">
                  <Icon name="clock" size={12} /> {minutesLabel(t.minutes)}
                </span>
                <span>{usageLine(t)}</span>
              </div>
            </div>
          </div>
          {canEdit && (
            <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={() => hide(t, !t.hidden)}>
              <Icon name={t.hidden ? "eye" : "lock"} size={14} /> {t.hidden ? "Show to students" : "Hide"}
            </button>
          )}
        </div>
      ))}

      {creating && (
        <TestDetailsModal token={token} api={satPracticeApi} noun="practice test" onClose={() => setCreating(false)} onSaved={(t) => nav(studioPath(`${SAT_TESTS}/${t.id}`))} />
      )}
      {copying && <CopyMockModal mocks={mocks} token={token} onClose={() => setCopying(false)} />}
    </div>
  );
}

// ---------- Results ----------
const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const clock = (seconds) => `${Math.floor((seconds || 0) / 60)}:${String((seconds || 0) % 60).padStart(2, "0")}`;
function scoreOf(r) {
  if (r.status === "cancelled") return { main: "Cancelled", sub: `the student ${r.cancelled?.reason || "left the test page"}` };
  if (r.total != null) return { main: String(r.total), sub: `R&W ${r.rw} · Math ${r.math}` };
  if (r.rw != null) return { main: String(r.rw), sub: "Reading and Writing" };
  if (r.math != null) return { main: String(r.math), sub: "Math" };
  return { main: r.count ? `${r.correct}/${r.count}` : "—", sub: r.status === "ended" ? "ended early" : "" };
}
const givenText = (q) => (!q.answered ? "no answer" : q.type === "grid_in" ? String(q.given) : LETTERS[q.given] || "?");
const rightText = (q) => (q.type === "grid_in" ? q.shown : LETTERS[q.correctIndex]);

function ResultModal({ runId, token, onClose }) {
  const backdrop = useBackdropClose(onClose);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    adminSatTestResult(token, runId)
      .then(setData)
      .catch((e) => setError(e.message || "Couldn't load this result"));
  }, [token, runId]);
  const s = data && scoreOf(data);

  return (
    <div className="modal-backdrop" {...backdrop}>
      <div className="modal ad-res-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{data ? `${data.student.name} · ${data.title}` : "Result"}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
        {!data && !error && <p className="ad-muted">Loading…</p>}
        {data && (
          <>
            <p className="ad-muted" style={{ marginTop: 0 }}>
              {SCOPE[data.scope] || data.scope}, {data.timed ? "timed" : "untimed"} · finished {fmtWhen(data.finishedAt)}
              {data.status === "ended" ? " · ended early" : ""}
            </p>
            {data.status === "cancelled" ? (
              <div className="ad-sec-note">
                <Icon name="warning" size={18} />
                <span>This sitting was cancelled: the student {data.cancelled?.reason || "left the test page"} while a module was running. It has no score and no answers.</span>
              </div>
            ) : (
              <>
                <div className="ad-res-kpis">
                  <div>
                    <b>{s.main}</b>
                    <span>{data.total != null ? "Estimated total" : s.sub || "Score"}</span>
                  </div>
                  {data.total != null && (
                    <>
                      <div>
                        <b>{data.rw}</b>
                        <span>Reading and Writing</span>
                      </div>
                      <div>
                        <b>{data.math}</b>
                        <span>Math</span>
                      </div>
                    </>
                  )}
                  <div>
                    <b>
                      {data.correct}/{data.count}
                    </b>
                    <span>Correct</span>
                  </div>
                </div>
                {data.modules.map((m) => (
                  <div className="ad-res-mod" key={m.key}>
                    <h3>
                      {m.title}
                      {m.label ? `, ${m.label.replace(/^.*,\s*/, "")}` : ""}
                      <span>
                        {m.status === "completed" ? `${m.raw}/${m.questions} correct · ${clock(m.seconds)}${m.auto ? " · closed by the clock" : ""}` : "Not sat"}
                      </span>
                    </h3>
                    {m.items.length > 0 && (
                      <div className="ad-res-sheet">
                        {m.items.map((q) => (
                          <div key={q.n} className={`ad-res-q ${!q.answered ? "blank" : q.correct ? "right" : "wrong"}`} title={q.text}>
                            <b>Q{q.n}</b>
                            <span>
                              {q.correct ? `${givenText(q)}, right` : `${givenText(q)} · answer ${rightText(q)}`}
                              <small>{q.text}</small>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ResultsTab() {
  const { token } = useAdminAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [test, setTest] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await adminSatTestResults(token));
      setError("");
    } catch (e) {
      setError(e.message || "Couldn't load the results");
    }
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.rows || []).filter((r) => (!test || r.test === test) && (!needle || `${r.student.name} ${r.student.candidateId || ""} ${r.student.classroom?.name || ""}`.toLowerCase().includes(needle)));
  }, [data, test, q]);

  if (!data) return error ? <LoadError what="the results" message={error} onRetry={load} /> : <SkeletonAdminList />;

  return (
    <div>
      <div className="ad-bar-row">
        <p>
          Every finished sitting of a practice test, newest first. Open one to see the answer sheet. (A teacher mock's results are in its session, under Teacher mocks.)
        </p>
        <div className="ad-filters">
          <select className="ad-input" value={test} onChange={(e) => setTest(e.target.value)} aria-label="Which test">
            <option value="">All tests</option>
            {data.tests.map((t) => (
              <option key={t.key} value={t.key}>
                {t.title}
              </option>
            ))}
          </select>
          <input className="ad-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a student…" aria-label="Find a student" />
        </div>
      </div>

      {data.rows.length === 0 ? (
        <div className="ad-card">
          <Empty icon="chart">No student has finished a practice test yet. Results appear here as soon as one does.</Empty>
        </div>
      ) : rows.length === 0 ? (
        <div className="ad-card">
          <Empty icon="search">Nothing matches. Try another test or name.</Empty>
        </div>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table ad-res-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Test</th>
                <th>Score</th>
                <th>Correct</th>
                <th>Finished</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = scoreOf(r);
                return (
                  <tr key={r.id} tabIndex={0} onClick={() => setOpen(r.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(r.id)}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={r.student.name} size={34} />
                        <div>
                          <b>{r.student.name}</b>
                          <span className="ad-res-sub">
                            ID {r.student.candidateId || "—"}
                            {r.student.classroom ? ` · ${r.student.classroom.name}` : ""}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {r.title}
                      <span className="ad-res-sub">
                        {SCOPE[r.scope] || r.scope}, {r.timed ? "timed" : "untimed"}
                      </span>
                    </td>
                    <td>
                      <b>{s.main}</b>
                      {s.sub && <span className="ad-res-sub">{s.sub}</span>}
                    </td>
                    <td>{r.status === "cancelled" || !r.count ? "—" : `${r.correct}/${r.count}`}</td>
                    <td title={fmtWhen(r.finishedAt)}>{timeAgo(r.finishedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data.total > data.rows.length && <p className="ad-muted ad-small">Showing the newest {data.rows.length} of {data.total}.</p>}
      {open && <ResultModal runId={open} token={token} onClose={() => setOpen(null)} />}
    </div>
  );
}

export default function SatTests() {
  const { tab, setTab, view, setView } = useSectionTabs(
    TEST_TABS,
    MOCK_VIEWS.map(([key]) => key)
  );

  return (
    <div className="ad-exam sat">
      <SectionHead exam="sat" title="Practice tests">
        Every SAT test in one place: the practice tests students sit on their own, their results, and the mocks a teacher runs for a group.
      </SectionHead>
      <SectionTabs exam="sat" tabs={TEST_TABS} value={tab} onChange={setTab} label="SAT practice tests" />

      {tab === "tests" && <PracticeTab />}
      {tab === "results" && <ResultsTab />}
      {tab === "mocks" && (
        <>
          <div style={{ marginBottom: 16 }}>
            <SubSwitch exam="sat" options={MOCK_VIEWS} value={view} onChange={setView} label="Teacher mocks" />
          </div>
          {view === "sessions" ? <SessionsList /> : <TestsList />}
        </>
      )}
    </div>
  );
}
