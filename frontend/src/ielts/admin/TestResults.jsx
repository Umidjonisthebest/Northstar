import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getTestResult, listTestResults } from "../api.js";
import { EmptyState, IconInput, PageLoader, Pill, Skeleton } from "../components/ui.jsx";
import { Modal } from "../components/Modal.jsx";
import { Select } from "../components/Select.jsx";
import { useToast } from "../components/Toast.jsx";

// IELTS > Practice tests > Results: every section of a practice test a student has finished,
// newest first (a teacher gets their class students'). A row opens the answer sheet, or the essays.
// A teacher mock's results are in its session, under Teacher mocks.

const NAME = { listening: "Listening", reading: "Reading", writing: "Writing" };
const TONE = { listening: "blue", reading: "outline", writing: "amber" };
const ALL = "";
const when = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const band = (b) => (b == null ? "—" : Number(b).toFixed(1));
const minutes = (s) => (s ? `${Math.max(1, Math.round(s / 60))} min` : "—");
const shown = (v) => (Array.isArray(v) ? v.join(", ") : v == null || v === "" ? "no answer" : String(v));

function ResultModal({ attemptId, onClose }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  useEffect(() => {
    getTestResult(attemptId)
      .then(setData)
      .catch((err) => {
        toast.error("Could not open this result", err.message);
        onClose();
      });
  }, [attemptId, onClose, toast]);

  return (
    <Modal open onClose={onClose} title={data ? `${data.student.name} · ${data.title} · ${NAME[data.kind]}` : "Result"} width={860}>
      {!data ? (
        <PageLoader />
      ) : data.kind === "writing" ? (
        <>
          <div className="ie-res-kpis">
            <div>
              <b>{data.words ?? 0}</b>
              <span>Words in all</span>
            </div>
            <div>
              <b>{minutes(data.seconds)}</b>
              <span>Time taken</span>
            </div>
          </div>
          {data.essays.map((e) => (
            <div key={e.task}>
              <h3 className="ie-res-h">
                Task {e.task}: {e.title}
                <small>
                  {e.words} words (at least {e.minWords})
                </small>
              </h3>
              {e.essay ? <div className="ie-res-essay">{e.essay}</div> : <p className="ie-help">Nothing was written for this task.</p>}
              <div className="ie-ptb-tags" style={{ marginTop: 8 }}>
                {e.checks.map((c) => (
                  <Pill key={c.title} tone={c.ok ? "green" : "amber"}>
                    {c.title}
                  </Pill>
                ))}
              </div>
            </div>
          ))}
          <p className="ie-help" style={{ marginTop: 16 }}>
            Writing has no automatic band: these are the quick checks the student saw. The band is yours to give.
          </p>
        </>
      ) : (
        <>
          <div className="ie-res-kpis">
            <div>
              <b>
                {data.correct}/{data.total}
              </b>
              <span>Correct</span>
            </div>
            <div>
              <b>{band(data.band)}</b>
              <span>Band</span>
            </div>
            <div>
              <b>{minutes(data.seconds)}</b>
              <span>Time taken</span>
            </div>
          </div>
          <div className="ie-ptb-tags">
            {data.parts.map((p) => (
              <Pill key={p.number} tone="outline">
                Part {p.number}: {p.correct}/{p.total}
              </Pill>
            ))}
          </div>
          <h3 className="ie-res-h">Answer sheet</h3>
          <div className="ie-res-sheet">
            {data.rows.map((r) => (
              <div key={r.n} className={`ie-res-q ie-res-q--${r.correct ? "right" : "wrong"}`}>
                <b>{r.n}</b>
                <span>
                  {shown(r.given)}
                  {!r.correct && <small>answer: {shown(r.expected)}</small>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

export default function TestResults() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [test, setTest] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    listTestResults()
      .then(setData)
      .catch((err) => {
        toast.error("Could not load the results", err.message);
        setData({ rows: [], tests: [], total: 0 });
      });
  }, [toast]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.rows || []).filter((r) => (!test || r.testId === test) && (!kind || r.kind === kind) && (!needle || `${r.student.name} ${r.student.candidateId || ""} ${r.student.classroom?.name || ""}`.toLowerCase().includes(needle)));
  }, [data, test, kind, q]);

  return (
    <div>
      <div className="ie-search-row">
        <p className="ie-pt-lead">Every section of a practice test a student has finished, newest first. Open one to see the answer sheet, or the essays. (A teacher mock's results are in its session, under Teacher mocks.)</p>
        <div className="ie-res-filters">
          <Select width={200} value={test} onChange={setTest} aria-label="Which test" options={[{ value: ALL, label: "All tests" }, ...(data?.tests || []).map((t) => ({ value: t.id, label: t.title }))]} />
          <Select width={160} value={kind} onChange={setKind} aria-label="Which section" options={[{ value: ALL, label: "All sections" }, ...Object.entries(NAME).map(([value, label]) => ({ value, label }))]} />
          <IconInput icon={Search} placeholder="Find a student…" aria-label="Find a student" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {!data ? (
        <div className="ie-card" style={{ padding: 20 }}>
          <Skeleton width="40%" height={18} />
          <Skeleton width="70%" height={14} style={{ marginTop: 12 }} />
          <Skeleton width="60%" height={14} style={{ marginTop: 12 }} />
        </div>
      ) : data.rows.length === 0 ? (
        <div className="ie-card">
          <EmptyState>No student has finished a section of a practice test yet. Results appear here as soon as one does.</EmptyState>
        </div>
      ) : rows.length === 0 ? (
        <div className="ie-card">
          <EmptyState>Nothing matches. Try another test, section or name.</EmptyState>
        </div>
      ) : (
        <div className="ie-res-table-wrap">
          <table className="ie-res-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Test</th>
                <th>Section</th>
                <th>Result</th>
                <th>Time</th>
                <th>Finished</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} tabIndex={0} onClick={() => setOpen(r.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(r.id)}>
                  <td>
                    <b>{r.student.name}</b>
                    <small>
                      ID {r.student.candidateId || "—"}
                      {r.student.classroom ? ` · ${r.student.classroom.name}` : ""}
                    </small>
                  </td>
                  <td>{r.title}</td>
                  <td>
                    <Pill tone={TONE[r.kind]}>{NAME[r.kind]}</Pill>
                  </td>
                  <td>
                    {r.kind === "writing" ? (
                      <b>{r.words ?? 0} words</b>
                    ) : (
                      <>
                        <b>
                          {r.correct}/{r.total}
                        </b>
                        <small>Band {band(r.band)}</small>
                      </>
                    )}
                  </td>
                  <td>{minutes(r.seconds)}</td>
                  <td>{when(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > data.rows.length && (
        <p className="ie-help" style={{ marginTop: 10 }}>
          Showing the newest {data.rows.length} of {data.total}.
        </p>
      )}
      {open && <ResultModal attemptId={open} onClose={close} />}
    </div>
  );
}
