import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminPath } from "../paths.js";
import { ChartColumn, Mail, Phone, Plus, Trash2, Users } from "lucide-react";
import { deleteUser, listUsers } from "../api.js";
import { Button, IconInput, Pagination, Pill, Skeleton } from "../components/ui.jsx";
import { ConfirmDialog } from "../components/Modal.jsx";
import { Select } from "../components/Select.jsx";
import { useToast } from "../components/Toast.jsx";
import { fullName, initials } from "../lib/format.js";
import { StatBanner } from "./StatBanner.jsx";
import { UserFormModal } from "./UserFormModal.jsx";

const PER_PAGE = [6, 10, 20, 50].map((n) => ({ value: n, label: String(n) }));
const ROLES = [
  { value: "", label: "All roles" },
  { value: "student", label: "Student" },
  { value: "admin", label: "Admin" }
];
const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" }
];

export default function UsersPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState({ q: "", role: "", status: "", page: 1, perPage: 10 });
  const [form, setForm] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listUsers(query));
    } catch (err) {
      toast.error("Could not load users", err.message);
    } finally {
      setLoading(false);
    }
  }, [query, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    try {
      await deleteUser(removing.id);
      toast.success("User deleted");
      setRemoving(null);
      load();
    } catch (err) {
      toast.error("Delete failed", err.message);
    }
  };

  return (
    <div>
      <div className="ie-page-head">
        <h2>User Management</h2>
        <div className="ie-page-head__actions">
          <Button icon={Plus} onClick={() => setForm({ user: null })}>
            New User
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      <StatBanner icon={Users} title="Total Users" subtitle="All registered users in the system" value={data?.totalAll} unit="users" />

      <form
        className="ie-card ie-filter-card"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery((q) => ({ ...q, q: input.trim(), page: 1 }));
        }}
      >
        <div className="ie-filter-row">
          <IconInput
            icon={Mail}
            className="ie-grow"
            placeholder="Search by name, email, ID, phone..."
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
        <div className="ie-filter-row">
          <span className="ie-filter-label">Role:</span>
          <Select width={160} value={query.role} options={ROLES} onChange={(role) => setQuery((q) => ({ ...q, role, page: 1 }))} />
          <span className="ie-filter-label">Status:</span>
          <Select width={190} value={query.status} options={STATUSES} onChange={(status) => setQuery((q) => ({ ...q, status, page: 1 }))} />
        </div>
      </form>

      <div className="ie-card-grid">
        {!data &&
          Array.from({ length: 4 }, (_, i) => (
            <div className="ie-user-tile" key={i}>
              <Skeleton width={44} height={44} radius={999} />
              <div style={{ flex: 1 }}>
                <Skeleton width="50%" height={16} />
                <Skeleton width="70%" style={{ marginTop: 10 }} />
                <Skeleton width="20%" style={{ marginTop: 10 }} />
              </div>
            </div>
          ))}
        {data?.items.length === 0 && <div className="ie-card ie-empty ie-span-2">No users match these filters.</div>}
        {data?.items.map((u) => (
          <div className="ie-user-tile" key={u.id}>
            <span className="ie-avatar ie-avatar--blue">{initials(u)}</span>
            <div className="ie-user-tile__info">
              <div className="ie-user-tile__name">
                {fullName(u)}{" "}
                {u.role === "admin" && (
                  <Pill tone="accent" round>
                    Admin
                  </Pill>
                )}{" "}
                {u.status === "inactive" && (
                  <Pill tone="gray" round>
                    Inactive
                  </Pill>
                )}
              </div>
              <div className="ie-user-tile__line">
                {u.email ? <Mail /> : <Phone />}
                {u.email || u.phone || "—"}
              </div>
              <div style={{ marginTop: 8, fontSize: 14 }}>
                <strong>ID:</strong> {u.candidateId ?? "—"}
              </div>
            </div>
            <div className="ie-user-tile__actions">
              {u.role === "student" && (
                <Button variant="outline" size="sm" icon={ChartColumn} className="ie-btn--hover-accent" onClick={() => navigate(adminPath("users", u.id))}>
                  Dashboard
                </Button>
              )}
              <Button variant="outline" size="sm" className="ie-btn--hover-accent" onClick={() => setForm({ user: u })}>
                Edit
              </Button>
              <Button variant="danger-outline" size="sm" icon={Trash2} aria-label="Delete user" onClick={() => setRemoving(u)} />
            </div>
          </div>
        ))}
      </div>

      {data && data.total > 0 && <Pagination page={data.page} pages={data.pages} total={data.total} perPage={data.perPage} onPage={(page) => setQuery((q) => ({ ...q, page }))} noun="users" />}

      {form && (
        <UserFormModal
          user={form.user}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title={removing ? `Delete ${fullName(removing)}?` : ""}
        message="The user, their session places and all of their exam results will be deleted."
        confirmLabel="Delete"
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
      />
    </div>
  );
}
