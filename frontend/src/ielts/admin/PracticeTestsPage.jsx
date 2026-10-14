import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Plus, SquarePen, Trash2 } from "lucide-react";
import { adminPath } from "../paths.js";
import { createPracticeTest, deletePracticeTest, listPracticeTests, setPracticeTestActive } from "../api.js";
import { Button, EmptyState, Field, Pill, Skeleton } from "../components/ui.jsx";
import { ConfirmDialog, Modal } from "../components/Modal.jsx";
import { Select } from "../components/Select.jsx";
import { useToast } from "../components/Toast.jsx";
import { pluralize } from "../lib/format.js";
import { useStudio } from "../../studio/useStudio.js";
import { SectionHead, SectionTabs, SubSwitch, TEST_TABS, useSectionTabs } from "../../studio/SectionKit.jsx";
import ContentList from "./ContentList.jsx";
import SessionsPage from "./SessionsPage.jsx";
import TestResults from "./TestResults.jsx";

// IELTS > Practice tests, in both staff panels. Every IELTS test is here, in three tabs:
//   Practice tests   whole tests a student takes alone (the admin builds them; a test owns its parts)
//   Results          the sections students have finished
//   Teacher mocks    the sessions a teacher runs, and (for the admin) the material they draw from
// The SAT side has the same section (pages/admin/SatTests.jsx).

export const TEST_KINDS = [
  ["listening", "Listening", "Part", 4],
  ["reading", "Reading", "Passage", 3],
  ["writing", "Writing", "Task", 2]
];
export const LEVELS = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" }
];

function summary(test) {
  const bits = TEST_KINDS.filter(([k]) => test.sections[k]).map(([k, name]) => {
    const s = test.sections[k];
    return k === "writing" ? `${name}: ${pluralize(s.parts, "task")}` : `${name}: ${pluralize(s.parts, "part")}, ${pluralize(s.questionCount, "question")}`;
  });
  return bits.length ? bits.join("  ·  ") : "Nothing in it yet";
}

// A test's title, level and description: for a new test, or to change one (`test`).
export function TestDetailsModal({ test = null, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ title: test?.title || "", description: test?.description || "", level: test?.level || "MEDIUM" }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError("Give the test a title.");
    setSaving(true);
    setError("");
    try {
      await onSave({ ...form, title: form.title.trim() });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={test ? "Test details" : "Create practice test"} width={560}>
      <form onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
          <Field label="Title" htmlFor="pt-title">
            <input id="pt-title" className="ie-input" autoFocus placeholder="Practice Test 3" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="Level">
            <Select value={form.level} onChange={(level) => setForm((f) => ({ ...f, level }))} options={LEVELS} aria-label="Level" />
          </Field>
          <Field label="Description" hint="shown under the title" htmlFor="pt-desc" className="ie-span-2">
            <input id="pt-desc" className="ie-input" placeholder="What the test is about, in a line" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
        </div>
        {!test && (
          <p className="ie-help" style={{ marginTop: 14, fontSize: 13.5 }}>
            Next you add its Listening, Reading and Writing on the test's own page. Students don't see the test until you show it.
          </p>
        )}
        {error && (
          <div className="ie-help ie-help--error" style={{ marginTop: 14, fontSize: 13 }}>
            {error}
          </div>
        )}
        <div className="ie-modal__footer" style={{ padding: "22px 0 4px" }}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {test ? "Save details" : "Create and add its parts"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TestsTab() {
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await listPracticeTests());
    } catch (err) {
      toast.error("Could not load the practice tests", err.message);
      setData({ canEdit: false, tests: [] });
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const create = async (body) => {
    const made = await createPracticeTest(body);
    toast.success("Practice test created", "Now add its Listening, Reading and Writing.");
    navigate(adminPath("tests", made.id));
  };

  const toggleActive = async (test) => {
    try {
      const updated = await setPracticeTestActive(test.id, !test.active);
      setData((d) => ({ ...d, tests: d.tests.map((t) => (t.id === test.id ? updated : t)) }));
      toast.success(updated.active ? "Students can take this test now" : "Hidden from students. Their finished sections are kept.");
    } catch (err) {
      toast.error("Could not change it", err.message);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deletePracticeTest(toDelete.id);
      setData((d) => ({ ...d, tests: d.tests.filter((t) => t.id !== toDelete.id) }));
      toast.success("Practice test deleted");
      setToDelete(null);
    } catch (err) {
      toast.error("Delete failed", err.message);
    } finally {
      setDeleting(false);
    }
  };

  const tests = data?.tests;
  const canEdit = Boolean(data?.canEdit);
  return (
    <div>
      <div className="ie-search-row">
        <p className="ie-pt-lead">
          A practice test is a whole test a student takes alone, a section at a time. Each test has its own Listening, Reading and Writing: nothing in it is shared with section practice.
          {data && !canEdit ? " The admin makes them; you can open any of them to see what is in it." : ""}
        </p>
        {canEdit && (
          <Button icon={Plus} onClick={() => setCreating(true)}>
            Create practice test
          </Button>
        )}
      </div>

      <div className="ie-content-list">
        {!tests &&
          Array.from({ length: 2 }, (_, i) => (
            <div className="ie-content-row" key={i}>
              <div style={{ flex: 1 }}>
                <Skeleton width="30%" height={18} />
                <Skeleton width="55%" height={14} style={{ marginTop: 10 }} />
              </div>
              <Skeleton width={92} height={40} />
            </div>
          ))}
        {tests?.length === 0 && (
          <div className="ie-card">
            <EmptyState
              action={
                canEdit && (
                  <Button icon={Plus} onClick={() => setCreating(true)}>
                    Create practice test
                  </Button>
                )
              }
            >
              No practice tests yet.
            </EmptyState>
          </div>
        )}
        {tests?.map((test) => (
          <div className="ie-content-row" key={test.id}>
            <div style={{ minWidth: 0 }}>
              <div className="ie-content-row__title">
                <span>{test.title}</span>
                {canEdit ? (
                  <button type="button" className="ie-pill-button" title={test.active ? "Click to hide from students" : "Click to show to students"} onClick={() => toggleActive(test)}>
                    <Pill tone={test.active ? "green" : "gray"} className="ie-pill--clickable">
                      {test.active ? "Shown to students" : "Hidden"}
                    </Pill>
                  </button>
                ) : (
                  <Pill tone="green">Shown to students</Pill>
                )}
                <Pill tone={test.filled === test.of ? "blue" : "amber"}>
                  {test.filled} of {test.of} parts
                </Pill>
                {test.seeded && <Pill tone="outline">Northstar original</Pill>}
              </div>
              <div className="ie-content-row__sub">
                <span style={{ whiteSpace: "pre-wrap" }}>{summary(test)}</span>
              </div>
              <div className="ie-content-row__meta">
                {test.attempts ? `${pluralize(test.attempts, "section")} taken by ${pluralize(test.students, "student")}` : "Not taken yet"}
                {test.description ? `  ·  ${test.description}` : ""}
              </div>
            </div>
            <div className="ie-content-row__side">
              <div className="ie-content-row__buttons">
                <Button variant="outline" icon={canEdit ? SquarePen : Eye} aria-label={`Open ${test.title}`} onClick={() => navigate(adminPath("tests", test.id))}>
                  {canEdit ? "Open and edit" : "Open"}
                </Button>
                {canEdit && <Button variant="danger" icon={Trash2} title="Delete" aria-label={`Delete ${test.title}`} onClick={() => setToDelete(test)} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {creating && <TestDetailsModal onClose={() => setCreating(false)} onSave={create} />}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this practice test?"
        message="The test and its parts are removed, and students won't see it any more. Sections students already finished are kept, and nothing in section practice changes."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

const MOCK_VIEWS = [
  ["sessions", "Sessions"],
  ["listening", "Listening"],
  ["reading", "Reading"],
  ["writing", "Writing"]
];

export default function PracticeTestsPage() {
  const { isAdmin } = useStudio();
  // The material a mock draws from is content, which is the admin's; a teacher has the sessions.
  const views = isAdmin ? MOCK_VIEWS : MOCK_VIEWS.slice(0, 1);
  const { tab, setTab, view, setView } = useSectionTabs(
    TEST_TABS,
    views.map(([key]) => key)
  );

  return (
    <div className="ad-exam ielts">
      <SectionHead exam="ielts" title="Practice tests">
        Every IELTS test in one place: the practice tests students take on their own, their results, and the mocks a teacher runs for a group.
      </SectionHead>
      <SectionTabs exam="ielts" tabs={TEST_TABS} value={tab} onChange={setTab} label="IELTS practice tests" />

      {tab === "tests" && <TestsTab />}
      {tab === "results" && <TestResults />}
      {tab === "mocks" && (
        <>
          <div className="ad-bar-row">
            <p>
              A teacher mock is run as a session: you add the candidates and start it, and each candidate is given a Listening, a Reading and a Writing from the mock material.
              {isAdmin ? " The three lists beside Sessions are that material." : ""}
            </p>
            {views.length > 1 && <SubSwitch exam="ielts" options={views} value={view} onChange={setView} label="Teacher mocks" />}
          </div>
          {view === "sessions" ? <SessionsPage /> : <ContentList key={view} kind={view} scope="mock" />}
        </>
      )}
    </div>
  );
}
