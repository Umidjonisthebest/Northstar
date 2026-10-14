import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminPath } from "../paths.js";
import { ChevronDown, Circle, CircleDot, Play, Plus, Search, SquarePen, Trash2 } from "lucide-react";
import { deleteContent, listContent, setContentActive, setContentUse } from "../api.js";
import { Button, EmptyState, Field, IconInput, Pill, Skeleton } from "../components/ui.jsx";
import { ConfirmDialog } from "../components/Modal.jsx";
import { DropdownMenu } from "../components/DropdownMenu.jsx";
import { useToast } from "../components/Toast.jsx";
import { useDebounced } from "../lib/hooks.js";
import { pluralize } from "../lib/format.js";
import { USE_OPTIONS } from "./useEditorData.js";

const USE_TOAST = {
  mock: "Now used in mock tests only",
  practice: "Now in student practice. It won't be picked for mock tests.",
  both: "Now used in mock tests and student practice"
};

const LABELS = {
  listening: { create: "Create Listening", noun: "listening section", empty: "No listening sections yet." },
  reading: { create: "Create Reading", noun: "reading passage", empty: "No reading passages yet." },
  writing: { create: "Create Writing", noun: "writing task", empty: "No writing tasks yet." }
};

function rowTitle(kind, item) {
  if (kind === "reading") return `Passage ${item.part}: ${item.title}`;
  return item.title;
}

function rowSubtitle(kind, item) {
  if (kind === "listening") return `Section ${item.section}  -  ${item.level} Level`;
  if (kind === "reading") return `Part ${item.part}  -  ${item.level} Level`;
  return `Task - ${item.task}`;
}

// `scope` says which material the list holds: "practice" (IELTS > Section practice) or "mock"
// (IELTS > Practice tests > Teacher mocks). A record used in both is in both lists. A practice
// test's own parts are in neither: they are made and changed on the test's page.
const IN_SCOPE = { practice: ["practice", "both"], mock: ["mock", "both"] };
const SCOPE_EMPTY = {
  practice: { listening: "No listening parts in section practice yet.", reading: "No reading passages in section practice yet.", writing: "No writing tasks in section practice yet." },
  mock: { listening: "No listening sections for mock tests yet.", reading: "No reading passages for mock tests yet.", writing: "No writing tasks for mock tests yet." }
};

export default function ContentList({ kind, scope }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 250);
  const [items, setItems] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const labels = LABELS[kind];
  // A new record starts with the use of the list it was made from.
  const createUrl = `${adminPath(kind, "new")}${scope ? `?use=${scope}` : ""}`;

  const load = useCallback(async () => {
    try {
      setItems(await listContent(kind, debouncedQ, scope));
    } catch (err) {
      toast.error("Could not load list", err.message);
      setItems([]);
    }
  }, [kind, debouncedQ, scope, toast]);

  useEffect(() => {
    setItems(null);
  }, [kind, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (item) => {
    try {
      const updated = await setContentActive(kind, item.id, !item.active);
      setItems((list) => list.map((x) => (x.id === item.id ? updated : x)));
      toast.success(updated.active ? "Activated — it can now appear in tests" : "Deactivated — it will not appear in new tests");
    } catch (err) {
      toast.error("Update failed", err.message);
    }
  };

  const changeUse = async (item, use) => {
    if (use === item.use) return;
    try {
      const updated = await setContentUse(kind, item.id, use);
      // Given a use this list doesn't hold, it leaves the list (it is in the other one now).
      const stays = !scope || IN_SCOPE[scope].includes(updated.use);
      setItems((list) => (stays ? list.map((x) => (x.id === item.id ? updated : x)) : list.filter((x) => x.id !== item.id)));
      toast.success(USE_TOAST[use], stays ? undefined : scope === "practice" ? "It is under Practice tests > Teacher mocks now." : "It is under Section practice now.");
    } catch (err) {
      toast.error("Update failed", err.message);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteContent(kind, toDelete.id);
      setItems((list) => list.filter((x) => x.id !== toDelete.id));
      toast.success("Deleted successfully!");
      setToDelete(null);
    } catch (err) {
      toast.error("Delete failed", err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="ie-search-row">
        <Field label={<strong>Search</strong>}>
          <IconInput icon={Search} placeholder="Search terms..." value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <Button icon={Plus} onClick={() => navigate(createUrl)}>
          {labels.create}
        </Button>
      </div>

      <div className="ie-content-list">
        {items === null &&
          Array.from({ length: 4 }, (_, i) => (
            <div className="ie-content-row" key={i}>
              <div style={{ flex: 1 }}>
                <Skeleton width="40%" height={18} />
                <Skeleton width="25%" height={14} style={{ marginTop: 10 }} />
                <Skeleton width="15%" height={12} style={{ marginTop: 10 }} />
              </div>
              <Skeleton width={136} height={40} />
            </div>
          ))}
        {items?.length === 0 && (
          <div className="ie-card">
            <EmptyState
              action={
                <Button icon={Plus} onClick={() => navigate(createUrl)}>
                  {labels.create}
                </Button>
              }
            >
              {debouncedQ ? "Nothing matches your search." : SCOPE_EMPTY[scope]?.[kind] || labels.empty}
            </EmptyState>
          </div>
        )}
        {items?.map((item) => (
          <div className="ie-content-row" key={item.id}>
            <div style={{ minWidth: 0 }}>
              <div className="ie-content-row__title">
                <span>{rowTitle(kind, item)}</span>
                <button type="button" className="ie-pill-button" title={item.active ? "Click to deactivate" : "Click to activate"} onClick={() => toggleActive(item)}>
                  <Pill tone={item.active ? "green" : "gray"} className="ie-pill--clickable">
                    {item.active ? "Active" : "Inactive"}
                  </Pill>
                </button>
                <DropdownMenu
                  align="start"
                  width={230}
                  trigger={
                    <button type="button" className="ie-pill-button" title="Change where this is used" aria-label={`Used in: ${USE_OPTIONS.find((o) => o.value === item.use)?.label}. Change`}>
                      <Pill tone={item.use === "mock" ? "outline" : "blue"} className="ie-pill--clickable ie-pill--use">
                        {USE_OPTIONS.find((o) => o.value === item.use)?.short} <ChevronDown />
                      </Pill>
                    </button>
                  }
                  items={USE_OPTIONS.map((o) => ({ label: o.label, icon: o.value === item.use ? CircleDot : Circle, onSelect: () => changeUse(item, o.value) }))}
                />
              </div>
              <div className="ie-content-row__sub">
                <span style={{ whiteSpace: "pre" }}>{rowSubtitle(kind, item)}</span>
                {kind === "reading" && item.globalTitle && <span>· {item.globalTitle}</span>}
                {item.source && <Pill tone="outline">{item.source}</Pill>}
              </div>
              {kind !== "writing" && <div className="ie-content-row__meta">{pluralize(item.questionCount, "question")}</div>}
            </div>
            <div className="ie-content-row__side">
              <div className="ie-content-row__buttons">
                {kind !== "writing" && <Button variant="success" icon={Play} title="Preview" aria-label="Preview" onClick={() => navigate(adminPath(kind, item.id, "preview"))} />}
                <Button variant="outline" icon={SquarePen} title="Edit" aria-label="Edit" onClick={() => navigate(adminPath(kind, item.id, "edit"))} />
                <Button variant="danger" icon={Trash2} title="Delete" aria-label="Delete" onClick={() => setToDelete(item)} />
              </div>
              {kind !== "writing" && <span className="ie-content-row__meta" style={{ marginTop: 0 }}>{Math.round(item.durationMinutes)} minutes</span>}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Delete this ${labels.noun}?`}
        message="It will no longer appear in new tests. Results of candidates who already took it are kept."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
