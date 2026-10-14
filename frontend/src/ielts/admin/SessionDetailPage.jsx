import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminPath } from "../paths.js";
import { ArrowLeft, ChevronDown, CircleCheck, Clock, Download, FileSpreadsheet, FileText, Plus, RefreshCw, Search, TriangleAlert, Users } from "lucide-react";
import { downloadSessionExport, getSession } from "../api.js";
import { Button, IconInput, Pill, Skeleton } from "../components/ui.jsx";
import { DropdownMenu } from "../components/DropdownMenu.jsx";
import { useToast } from "../components/Toast.jsx";
import { fullName } from "../lib/format.js";
import { AddParticipantsModal } from "./AddParticipantsModal.jsx";
import { ParticipantDrawer } from "./ParticipantDrawer.jsx";

const COLUMNS = ["listening", "reading", "writing", "speaking"];
const PILLS = ["reading", "listening", "writing"];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function completionTone(pct) {
  if (pct >= 100) return "green";
  if (pct >= 50) return "blue";
  return "red";
}

export function StatusCell({ done }) {
  return done ? (
    <span className="ie-status ie-status--done">
      <CircleCheck />
      Completed
    </span>
  ) : (
    <span className="ie-status ie-status--todo">
      <Clock />
      Not completed
    </span>
  );
}

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [drawerUserId, setDrawerUserId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getSession(id));
    } catch (err) {
      toast.error("Could not load session", err.message);
      if (err.status === 404) navigate(adminPath("sessions"), { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = data?.participants || [];
    if (!q) return list;
    return list.filter((r) => [fullName(r.user), r.user.email, r.user.candidateId].some((f) => String(f || "").toLowerCase().includes(q)));
  }, [data, filter]);

  const exportAs = async (format) => {
    setExporting(true);
    try {
      const base = (data.session.name || "session").replace(/[^\w.-]+/g, "_");
      await downloadSessionExport(id, format, `${base}-results.${format}`);
      toast.success(`Results exported to ${format === "xlsx" ? "Excel" : "Word"}`);
    } catch (err) {
      toast.error("Export failed", err.message);
    } finally {
      setExporting(false);
    }
  };

  const session = data?.session;

  return (
    <div className="ie-detail-page">
      <div className="ie-detail-card">
        <Button variant="outline" icon={ArrowLeft} onClick={() => navigate(adminPath("sessions"))}>
          Back
        </Button>
        <div className="ie-detail-head" style={{ marginTop: 22 }}>
          <div>
            <span className="ie-eyebrow">
              <span className="ie-eyebrow__icon">
                <Users />
              </span>
              IELTS – Admin session
            </span>
            {session ? (
              <>
                <h1>{session.name}</h1>
                <div className="ie-detail-head__id">
                  Session ID: <strong>{session.id}</strong>
                  {session.status && (
                    <span style={{ marginLeft: 10 }}>
                      <Pill tone={session.status === "started" ? "green" : session.status === "created" ? "blue" : "gray"} round>
                        {cap(session.status)}
                      </Pill>
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <Skeleton width={260} height={32} style={{ marginTop: 8 }} />
                <Skeleton width={120} style={{ marginTop: 8 }} />
              </>
            )}
          </div>
          <div className="ie-row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Button variant="outline" icon={Plus} disabled={!session || session.status === "completed"} onClick={() => setAdding(true)}>
              Add Participants
            </Button>
            <DropdownMenu
              width={210}
              items={[
                { label: "Export to Excel (.xlsx)", icon: FileSpreadsheet, onSelect: () => exportAs("xlsx") },
                { label: "Export to Word (.docx)", icon: FileText, onSelect: () => exportAs("docx") }
              ]}
              trigger={
                <Button variant="outline" icon={Download} iconRight={ChevronDown} loading={exporting} disabled={!session}>
                  Export
                </Button>
              }
            />
            <Button variant="outline" icon={RefreshCw} onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="ie-detail-toolbar">
          <IconInput icon={Search} placeholder="Search by participant name or email..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="ie-completion-pills">
            {PILLS.map((s) => {
              const pct = data?.completion?.[s] ?? 0;
              return (
                <Pill key={s} tone={completionTone(pct)} round icon={CircleCheck}>
                  <strong style={{ fontWeight: 600 }}>
                    {cap(s)} {pct}%
                  </strong>
                </Pill>
              );
            })}
          </div>
        </div>

        <div className="ie-table-wrap">
          <table className="ie-table ie-table--clickable">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Email</th>
                {COLUMNS.map((c) => (
                  <th key={c}>{cap(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data &&
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }, (_, j) => (
                      <td key={j}>
                        <Skeleton width={j === 0 ? 160 : 110} />
                      </td>
                    ))}
                  </tr>
                ))}
              {data && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="ie-empty" style={{ cursor: "default" }}>
                    Nothing found
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.user.id} onClick={() => setDrawerUserId(r.user.id)}>
                  <td>
                    <div className="ie-person">
                      <span className="ie-avatar">{r.user.firstName?.[0]}</span>
                      <div>
                        <div className="ie-person__name">{fullName(r.user)}</div>
                        <div className="ie-person__id">ID: {r.user.candidateId}</div>
                        {/* Left the test page while a section was running: open the row to let them back in. */}
                        {r.cancelled && (
                          <div className="ie-cancelled-mark">
                            <TriangleAlert />
                            Cancelled: {r.cancelled.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{r.user.email || <span className="ie-muted">—</span>}</td>
                  {COLUMNS.map((c) => (
                    <td key={c}>
                      <StatusCell done={r.sections[c].completed} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {adding && <AddParticipantsModal sessionId={id} onClose={() => setAdding(false)} onChanged={load} />}
      {drawerUserId && <ParticipantDrawer sessionId={id} userId={drawerUserId} onClose={() => setDrawerUserId(null)} onChanged={load} />}
    </div>
  );
}
