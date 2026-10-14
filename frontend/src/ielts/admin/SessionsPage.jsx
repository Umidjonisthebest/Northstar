import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminPath } from "../paths.js";
import { CalendarDays, CircleCheck, CirclePlay, EllipsisVertical, Eye, Pencil, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import { deleteSession, listSessions, setSessionStatus } from "../api.js";
import { Button, Pagination, Pill, Skeleton } from "../components/ui.jsx";
import { ConfirmDialog } from "../components/Modal.jsx";
import { DropdownMenu } from "../components/DropdownMenu.jsx";
import { Select } from "../components/Select.jsx";
import { useToast } from "../components/Toast.jsx";
import { formatSessionDate, fullName } from "../lib/format.js";
import { SessionFormModal } from "./SessionFormModal.jsx";
import { StatBanner } from "./StatBanner.jsx";

export const STATUS_PILL = {
  created: { tone: "blue", label: "Created" },
  started: { tone: "green", label: "Started" },
  completed: { tone: "gray", label: "Completed" }
};

const PER_PAGE = [5, 10, 20, 50].map((n) => ({ value: n, label: String(n) }));

export default function SessionsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState({ q: "", page: 1, perPage: 10 });
  const [form, setForm] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listSessions(query));
    } catch (err) {
      toast.error("Could not load sessions", err.message);
    } finally {
      setLoading(false);
    }
  }, [query, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (session, status) => {
    setBusyId(session.id);
    try {
      await setSessionStatus(session.id, status);
      toast.success(`Session status updated to ${status.toUpperCase()}`);
      await load();
    } catch (err) {
      toast.error("Could not update status", err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    try {
      await deleteSession(removing.id);
      toast.success("Session deleted");
      setRemoving(null);
      load();
    } catch (err) {
      toast.error("Delete failed", err.message);
    }
  };

  const menuFor = (s) => {
    const items = [];
    if (s.status === "started") items.push({ label: "Complete", icon: CircleCheck, onSelect: () => changeStatus(s, "completed") });
    if (s.status === "completed") items.push({ label: "Restart", icon: RotateCcw, onSelect: () => changeStatus(s, "started") });
    items.push({ label: "Edit", icon: Pencil, onSelect: () => setForm({ session: s }) });
    if (s.status !== "started") items.push({ label: "Delete", icon: Trash2, danger: true, onSelect: () => setRemoving(s) });
    return items;
  };

  const items = data?.items;

  return (
    <div>
      <div className="ie-page-head">
        <h2>Session Management</h2>
        <div className="ie-page-head__actions">
          <Button icon={Plus} onClick={() => setForm({ session: null })}>
            New Session
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      <StatBanner icon={Users} title="Total Sessions" subtitle="All scheduled sessions in the system" value={data?.totalAll} unit="sessions" />

      <form
        className="ie-card ie-filter-card"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery((q) => ({ ...q, q: input.trim(), page: 1 }));
        }}
      >
        <div className="ie-filter-row">
          <input
            className="ie-input ie-grow"
            placeholder="Search by session name..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (!e.target.value && query.q) setQuery((q) => ({ ...q, q: "", page: 1 }));
            }}
          />
          <Button type="submit" disabled={!input.trim()}>
            Search
          </Button>
          <span className="ie-filter-label">Per page:</span>
          <Select width={80} value={query.perPage} options={PER_PAGE} onChange={(perPage) => setQuery((q) => ({ ...q, perPage, page: 1 }))} />
        </div>
      </form>

      <div className="ie-card-grid">
        {!items &&
          Array.from({ length: 4 }, (_, i) => (
            <div className="ie-session-card ie-session-card--skeleton" key={i}>
              <Skeleton width="45%" height={22} />
              <Skeleton width="35%" />
              <Skeleton width="50%" />
              <Skeleton width="100%" height={1} />
              <Skeleton width="60%" />
              <Skeleton width="55%" />
            </div>
          ))}
        {items?.length === 0 && (
          <div className="ie-card ie-empty ie-span-2">{query.q ? "No sessions match your search." : "No sessions yet. Create the first one with “New Session”."}</div>
        )}
        {items?.map((s) => {
          const pill = STATUS_PILL[s.status];
          const seats = s.studentLimit - s.participantCount;
          return (
            <div className="ie-session-card" key={s.id}>
              <div className="ie-session-card__head">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="ie-session-card__title">
                    <span>{s.name}</span>
                    <Pill tone={pill.tone} round>
                      {pill.label}
                    </Pill>
                  </div>
                  {s.description && <div className="ie-session-card__desc">{s.description}</div>}
                </div>
                <DropdownMenu
                  items={menuFor(s)}
                  trigger={
                    <button type="button" className="ie-kebab" aria-label="Session actions">
                      <EllipsisVertical />
                    </button>
                  }
                />
              </div>
              <div className="ie-session-meta">
                <CalendarDays />
                {formatSessionDate(s.date, s.time)}
              </div>
              <div className="ie-session-meta" style={{ marginTop: 10 }}>
                <Users />
                {s.participantCount} / {s.studentLimit} students
                <Pill tone="green" round>
                  {seats} seat{seats === 1 ? "" : "s"} left
                </Pill>
              </div>
              <hr className="ie-divider" />
              <div className="ie-session-participants">
                <h4>Participants ({s.participantCount})</h4>
                <ul className="ie-scroll-thin">
                  {s.participants.map((p) => (
                    <li key={p.id}>
                      <span className="ie-avatar ie-avatar--sm">{p.firstName?.[0]}</span>
                      {fullName(p)} - ID: {p.candidateId}
                    </li>
                  ))}
                  {s.participantCount === 0 && <li className="ie-muted">No participants yet</li>}
                </ul>
              </div>
              <div className="ie-session-card__foot">
                {s.status === "created" && (
                  <Button icon={CirclePlay} loading={busyId === s.id} onClick={() => changeStatus(s, "started")}>
                    Start
                  </Button>
                )}
                <Button variant="soft" icon={Eye} onClick={() => navigate(adminPath("sessions", s.id))}>
                  View
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {data && data.total > 0 && <Pagination page={data.page} pages={data.pages} total={data.total} perPage={data.perPage} onPage={(page) => setQuery((q) => ({ ...q, page }))} />}

      {form && (
        <SessionFormModal
          session={form.session}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title="Delete this session?"
        message="All participants' answers and results for this session will be deleted too."
        confirmLabel="Delete"
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
      />
    </div>
  );
}
