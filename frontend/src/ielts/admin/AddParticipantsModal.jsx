import { useCallback, useEffect, useState } from "react";
import { Mail, Plus, X } from "lucide-react";
import { addParticipant, availableUsers, createParticipant } from "../api.js";
import { Modal } from "../components/Modal.jsx";
import { Select } from "../components/Select.jsx";
import { Button, IconInput, Pagination, Skeleton } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { useDebounced } from "../lib/hooks.js";
import { fullName } from "../lib/format.js";
import { useStudio } from "../../studio/useStudio.js";

const PER_PAGE = [5, 10, 20].map((n) => ({ value: n, label: String(n) }));

function prefillFrom(q) {
  const text = q.trim();
  if (text.includes("@")) return { email: text, firstName: "", lastName: "" };
  const [first = "", ...rest] = text.split(/\s+/);
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
  return { email: "", firstName: cap(first), lastName: cap(rest.join(" ")) };
}

export function AddParticipantsModal({ sessionId, onClose, onChanged }) {
  const toast = useToast();
  // A teacher adds students of the classes; making a new candidate account is the admin's.
  const { isAdmin } = useStudio();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 250);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(null);
  const [creating, setCreating] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await availableUsers(sessionId, { q: debouncedQ, page, perPage }));
    } catch (err) {
      toast.error("Could not load users", err.message);
    }
  }, [sessionId, debouncedQ, page, perPage, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [debouncedQ, perPage]);

  const add = async (user) => {
    setAdding(user.id);
    try {
      await addParticipant(sessionId, user.id);
      toast.success("Participant added successfully!");
      onChanged();
      await load();
    } catch (err) {
      toast.error("Could not add participant", err.message);
    } finally {
      setAdding(null);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createParticipant(sessionId, creating);
      toast.success("Participant added successfully!");
      setCreating(null);
      setQ("");
      onChanged();
      await load();
    } catch (err) {
      toast.error("Could not create user", err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setCreating((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open onClose={onClose} title="Add Participants" subtitle={isAdmin ? "Select students to add to this session" : "Select students of your classes to add to this session"} width={768}>
      <div className="ie-row" style={{ gap: 12, marginBottom: 14 }}>
        <IconInput icon={Mail} className="ie-grow" autoFocus placeholder="Search by email..." value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="ie-filter-label">Per page:</span>
        <Select width={80} value={perPage} options={PER_PAGE} onChange={setPerPage} />
      </div>

      <div className="ie-add-list ie-scroll-thin">
        {!data &&
          Array.from({ length: 4 }, (_, i) => (
            <div className="ie-add-row" key={i}>
              <Skeleton width={28} height={28} radius={999} />
              <div style={{ flex: 1 }}>
                <Skeleton width="45%" />
                <Skeleton width="30%" height={10} style={{ marginTop: 6 }} />
              </div>
            </div>
          ))}
        {data?.items.map((u) => (
          <div className="ie-add-row" key={u.id}>
            <span className="ie-avatar ie-avatar--sm" style={{ width: 28, height: 28, fontSize: 13 }}>
              {u.firstName?.[0]}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ie-add-row__name">
                {fullName(u)} (ID: {u.candidateId})
              </div>
              <div className="ie-add-row__email">{u.email || u.phone || "—"}</div>
            </div>
            <Button size="sm" icon={Plus} loading={adding === u.id} onClick={() => add(u)}>
              Add
            </Button>
          </div>
        ))}
        {data && data.items.length === 0 && (
          <div className="ie-add-empty">
            {isAdmin ? (
              <>
                User not found.{" "}
                <button type="button" className="ie-link" onClick={() => setCreating({ phone: "+998", ...prefillFrom(q) })}>
                  Create user
                </button>
              </>
            ) : (
              "No student in the classes matches."
            )}
          </div>
        )}
      </div>

      {data && (
        <div style={{ borderTop: "1px solid var(--ie-border)", paddingTop: 14, marginTop: 6 }}>
          <Pagination compact page={data.page} pages={data.pages} total={data.total} perPage={data.perPage} onPage={setPage} noun="users" />
        </div>
      )}

      {isAdmin && data && data.items.length > 0 && !creating && (
        <div className="ie-help" style={{ marginTop: 12 }}>
          Can't find the student?{" "}
          <button type="button" className="ie-link" onClick={() => setCreating({ phone: "+998", ...prefillFrom(q) })}>
            Create user
          </button>
        </div>
      )}

      {creating && (
        <form className="ie-card ie-inline-create" onSubmit={create}>
          <div className="ie-row" style={{ marginBottom: 14 }}>
            <strong style={{ fontWeight: 500 }}>Create new user</strong>
            <span className="ie-spacer" />
            <button type="button" className="ie-modal__close" style={{ width: 28, height: 28 }} onClick={() => setCreating(null)} aria-label="Close">
              <X />
            </button>
          </div>
          <div className="ie-inline-create__grid">
            <label className="ie-field">
              <span className="ie-label">Email</span>
              <input className="ie-input" type="email" placeholder="user@example.com" value={creating.email} onChange={set("email")} />
            </label>
            <label className="ie-field">
              <span className="ie-label">Phone number</span>
              <input className="ie-input" placeholder="+998" value={creating.phone} onChange={set("phone")} />
            </label>
            <label className="ie-field">
              <span className="ie-label">First name</span>
              <input className="ie-input" placeholder="John" value={creating.firstName} onChange={set("firstName")} required autoFocus />
            </label>
            <label className="ie-field">
              <span className="ie-label">Last name</span>
              <input className="ie-input" placeholder="Doe" value={creating.lastName} onChange={set("lastName")} required />
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <Button type="submit" loading={saving}>
              Add
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
