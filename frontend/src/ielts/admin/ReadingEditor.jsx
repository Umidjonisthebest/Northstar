import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CircleCheck } from "lucide-react";
import { getContent, saveContent } from "../api.js";
import { AutocompleteInput, CreatableCombobox } from "../components/Combobox.jsx";
import { ResizableSplit } from "../components/ResizableSplit.jsx";
import { RichEditor } from "../components/RichEditor.jsx";
import { Select } from "../components/Select.jsx";
import { Field, PageLoader } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { isHtmlEmpty } from "../lib/richHtml.jsx";
import { EditorShell } from "./EditorShell.jsx";
import { QuestionGroupsPanel } from "./questions/QuestionGroupsPanel.jsx";
import { TEST_PART_HELP, USE_HELP, USE_OPTIONS, useReadingTitles, useSources } from "./useEditorData.js";
import { contentHome, useEditorHome } from "./editorHome.js";

const PARTS = [1, 2, 3];
const PART_START = { 1: 1, 2: 14, 3: 27 };
const LEVELS = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" }
];

const emptyPart = (part) => ({ id: null, part, title: "", contentHtml: "", level: "MEDIUM", durationMinutes: 20, groups: [], active: true });
const isFilled = (p) => Boolean(p.id || p.title.trim() || !isHtmlEmpty(p.contentHtml) || p.groups.length);

export default function ReadingEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const sources = useSources();
  const titles = useReadingTitles();
  const [loading, setLoading] = useState(Boolean(id));
  const [parts, setParts] = useState(() => Object.fromEntries(PARTS.map((p) => [p, emptyPart(p)])));
  // Opened from a practice test's page (?test=), these passages are that test's own.
  const from = useEditorHome();
  const [testId, setTestId] = useState(from.testId);
  const [current, setCurrent] = useState(PARTS.includes(from.part) ? from.part : 1);
  const [globalTitle, setGlobalTitle] = useState("");
  const [source, setSource] = useState("");
  const [use, setUse] = useState(from.use || "mock");
  const [groupId, setGroupId] = useState(null);
  const home = contentHome("reading", { testId, use });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getContent("reading", id)
      .then(({ record, siblings }) => {
        const next = Object.fromEntries(PARTS.map((p) => [p, emptyPart(p)]));
        for (const r of siblings) {
          next[r.part] = { id: r.id, part: r.part, title: r.title, contentHtml: r.contentHtml || "", level: r.level || "MEDIUM", durationMinutes: r.durationMinutes || 20, groups: r.groups || [], active: r.active !== false };
        }
        setParts(next);
        setCurrent(PARTS.includes(from.part) ? from.part : record.part);
        setGlobalTitle(record.globalTitle || "");
        setSource(record.source || "");
        setUse(record.use || "mock");
        setTestId(record.testId || from.testId);
        setGroupId(record.groupId || null);
      })
      .catch((err) => {
        toast.error("Could not load reading", err.message);
        navigate(contentHome("reading", from));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate, toast]);

  const part = parts[current];
  const patch = (changes) => {
    setParts((all) => ({ ...all, [current]: { ...all[current], ...changes } }));
    setDirty(true);
  };

  const save = async () => {
    if (!globalTitle.trim()) {
      toast.error("Global reading title is required");
      return;
    }
    const filled = PARTS.map((p) => parts[p]).filter(isFilled);
    if (!filled.length) {
      toast.error("Nothing to save", "Fill in at least one part.");
      return;
    }
    for (const p of filled) {
      const problem = !p.title.trim() ? "title is required" : isHtmlEmpty(p.contentHtml) ? "reading content is required" : !p.groups.length ? "add at least one question" : null;
      if (problem) {
        setCurrent(p.part);
        toast.error(`Part ${p.part}: ${problem}`);
        return;
      }
    }
    setSaving(true);
    try {
      await saveContent("reading", {
        groupId,
        globalTitle,
        source,
        ...(testId ? { testId } : {}),
        parts: filled.map((p) => ({ id: p.id, part: p.part, title: p.title, contentHtml: p.contentHtml, level: p.level, durationMinutes: p.durationMinutes, groups: p.groups, active: p.active, use }))
      });
      setDirty(false);
      toast.success(testId ? "Saved into the practice test" : "Reading saved successfully!");
      navigate(home);
    } catch (err) {
      toast.error("Save failed", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <EditorShell title={testId ? "Practice test: Reading" : "Admin Reading Editor"} backTo={home} dirty={dirty} saving={saving} onSave={save} saveLabel="Save Complete Reading">
      <div className="ie-editor-fields">
        <Field label="Global Reading Title:" htmlFor="global-title">
          <AutocompleteInput
            id="global-title"
            value={globalTitle}
            suggestions={titles}
            placeholder="Enter global reading title (e.g., 'Reading Test 1')"
            onChange={(v) => {
              setGlobalTitle(v);
              setDirty(true);
            }}
          />
        </Field>
        <Field label="Source (optional)">
          <CreatableCombobox
            value={source}
            options={sources}
            onChange={(v) => {
              setSource(v);
              setDirty(true);
            }}
          />
        </Field>
        {testId ? (
          <Field label="Used in" help={TEST_PART_HELP}>
            <div className="ie-input ie-input--static">This practice test only</div>
          </Field>
        ) : (
          <Field label="Use in" help={USE_HELP}>
            <Select
              value={use}
              aria-label="Use in"
              options={USE_OPTIONS}
              onChange={(v) => {
                setUse(v);
                setDirty(true);
              }}
            />
          </Field>
        )}
      </div>
      <div className="ie-editor-selectbar">
        <span className="ie-label">Select Part:</span>
        <Select width={200} value={current} onChange={setCurrent} options={PARTS.map((p) => ({ value: p, label: `Part ${p}` }))} />
        <span className="ie-label">Level:</span>
        <Select width={140} value={part.level} onChange={(level) => patch({ level })} options={LEVELS} />
        <span className="ie-label">Time (min):</span>
        <input
          className="ie-input"
          style={{ width: 80 }}
          type="number"
          min={1}
          max={120}
          value={part.durationMinutes}
          onChange={(e) => patch({ durationMinutes: Number(e.target.value) || 20 })}
        />
        <div className="ie-part-tabs" style={{ marginLeft: "auto" }}>
          {PARTS.map((p) => (
            <button
              type="button"
              key={p}
              className={`ie-part-tab ${isFilled(parts[p]) ? "ie-part-tab--filled" : ""} ${p === current ? "ie-part-tab--current" : ""}`}
              onClick={() => setCurrent(p)}
            >
              {isFilled(parts[p]) && <CircleCheck />}
              Part {p}
            </button>
          ))}
        </div>
      </div>
      <div className="ie-editor-body">
        <ResizableSplit
          key={current}
          className="ie-editor-split"
          storageKey="ielts_reading_editor_split"
          left={
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label={`Part ${current} Title`}>
                <input className="ie-input" value={part.title} placeholder={`Enter Part ${current} title`} onChange={(e) => patch({ title: e.target.value })} />
              </Field>
              <div className="ie-editor-card">
                <label className="ie-label" style={{ display: "block", marginBottom: 8 }}>
                  Reading Content <small style={{ fontStyle: "italic", color: "var(--ie-gray-400)" }}>(Press <b>Ctrl+H</b> to add HEADING)</small>
                </label>
                <RichEditor
                  toolbar="compact"
                  enableHeadingSlots
                  minHeight={420}
                  value={part.contentHtml}
                  placeholder={`Enter Part ${current} content.`}
                  onChange={(contentHtml) => patch({ contentHtml })}
                />
              </div>
            </div>
          }
          right={
            <QuestionGroupsPanel
              kind="reading"
              title={`Part ${current} Questions`}
              groups={part.groups}
              startNumber={PART_START[current]}
              passageHtml={part.contentHtml}
              onChange={(groups) => patch({ groups })}
            />
          }
        />
      </div>
    </EditorShell>
  );
}
