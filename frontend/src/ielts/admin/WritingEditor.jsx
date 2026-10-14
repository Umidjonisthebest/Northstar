import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getContent, saveContent } from "../api.js";
import { CreatableCombobox } from "../components/Combobox.jsx";
import { ImageDropzone } from "../components/ImageDropzone.jsx";
import { ResizableSplit } from "../components/ResizableSplit.jsx";
import { RichEditor } from "../components/RichEditor.jsx";
import { Select } from "../components/Select.jsx";
import { Field, PageLoader } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { isHtmlEmpty } from "../lib/richHtml.jsx";
import { WritingTaskView } from "../exam/WritingTaskView.jsx";
import { EditorShell } from "./EditorShell.jsx";
import { TEST_PART_HELP, USE_HELP, USE_OPTIONS, useSources } from "./useEditorData.js";
import { contentHome, useEditorHome } from "./editorHome.js";

const TASKS = [1, 2];
const LEVELS = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" }
];
const emptyTask = (task) => ({ id: null, task, title: "", questionHtml: "", image: null, level: "MEDIUM", modelAnswerHtml: "", active: true });
const isFilled = (t) => Boolean(t.id || t.title.trim() || !isHtmlEmpty(t.questionHtml) || t.image);

export default function WritingEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const sources = useSources();
  const [loading, setLoading] = useState(Boolean(id));
  const [tasks, setTasks] = useState(() => ({ 1: emptyTask(1), 2: emptyTask(2) }));
  // Opened from a practice test's page (?test=), these tasks are that test's own.
  const from = useEditorHome();
  const [testId, setTestId] = useState(from.testId);
  const [current, setCurrent] = useState(TASKS.includes(from.part) ? from.part : 1);
  const [source, setSource] = useState("");
  const [use, setUse] = useState(from.use || "mock");
  const [groupId, setGroupId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const home = contentHome("writing", { testId, use });

  useEffect(() => {
    if (!id) return;
    getContent("writing", id)
      .then(({ record, siblings }) => {
        // Writing tasks are edited one at a time (each is its own record), except a practice
        // test's two tasks, which belong together and open together.
        const loaded = record.testId ? siblings : [record];
        setTasks((all) => ({
          ...all,
          ...Object.fromEntries(
            loaded.map((r) => [
              r.task,
              { id: r.id, task: r.task, title: r.title, questionHtml: r.questionHtml || "", image: r.image || null, level: r.level || "MEDIUM", modelAnswerHtml: r.modelAnswerHtml || "", active: r.active !== false }
            ])
          )
        }));
        setCurrent(TASKS.includes(from.part) ? from.part : record.task);
        setSource(record.source || "");
        setUse(record.use || "mock");
        setTestId(record.testId || from.testId);
        setGroupId(record.groupId || null);
      })
      .catch((err) => {
        toast.error("Could not load writing task", err.message);
        navigate(contentHome("writing", from));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate, toast]);

  const task = tasks[current];
  const patch = (changes) => {
    setTasks((all) => ({ ...all, [current]: { ...all[current], ...changes } }));
    setDirty(true);
  };

  const save = async () => {
    const filled = TASKS.map((t) => tasks[t]).filter(isFilled);
    if (!filled.length) {
      toast.error("Nothing to save", "Write the question text for at least one task.");
      return;
    }
    const missing = filled.find((t) => isHtmlEmpty(t.questionHtml));
    if (missing) {
      setCurrent(missing.task);
      toast.error(`Task ${missing.task}: question text is required`);
      return;
    }
    setSaving(true);
    try {
      await saveContent("writing", {
        groupId,
        source,
        ...(testId ? { testId } : {}),
        parts: filled.map((t) => ({
          id: t.id,
          task: t.task,
          title: t.title || `Writing Task ${t.task}`,
          questionHtml: t.questionHtml,
          image: t.image,
          level: t.level,
          modelAnswerHtml: isHtmlEmpty(t.modelAnswerHtml) ? "" : t.modelAnswerHtml,
          active: t.active,
          use
        }))
      });
      setDirty(false);
      toast.success(testId ? "Saved into the practice test" : "Writing saved successfully!");
      navigate(home);
    } catch (err) {
      toast.error("Save failed", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <EditorShell title={testId ? "Practice test: Writing" : "Admin - Writing Test"} logo={false} backVariant="ghost" backTo={home} dirty={dirty} saving={saving} onSave={save} saveLabel="Save Writing Test">
      <div className="ie-editor-fields ie-editor-fields--row">
        <Field label="Task">
          <Select value={current} onChange={setCurrent} options={TASKS.map((t) => ({ value: t, label: `Task ${t}` }))} />
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
      </div>
      <div className="ie-editor-body">
        <ResizableSplit
          key={current}
          className="ie-editor-split"
          storageKey="ielts_writing_editor_split"
          left={
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Task {current}</h2>
              <div className="ie-row" style={{ gap: 14, alignItems: "flex-start" }}>
                <Field label="Title" style={{ flex: 1 }}>
                  <input className="ie-input" value={task.title} placeholder={`Writing task ${current}`} onChange={(e) => patch({ title: e.target.value })} />
                </Field>
                <Field label="Level">
                  <Select width={140} value={task.level} aria-label="Level" onChange={(level) => patch({ level })} options={LEVELS} />
                </Field>
              </div>
              <Field label="Question Text">
                <RichEditor value={task.questionHtml} minHeight={120} placeholder="Enter the question text here..." onChange={(questionHtml) => patch({ questionHtml })} />
              </Field>
              <Field label={`Task ${current} Image`}>
                <ImageDropzone value={task.image} onChange={(image) => patch({ image })} />
              </Field>
              <Field label="Model answer (optional)" help="Students see it after they submit this task in Section Practice.">
                <RichEditor value={task.modelAnswerHtml} minHeight={160} placeholder="Paste or write a sample answer..." onChange={(modelAnswerHtml) => patch({ modelAnswerHtml })} />
              </Field>
            </div>
          }
          right={
            <WritingTaskView
              task={{
                task: current,
                title: task.title || "Writing",
                questionHtml: task.questionHtml,
                image: task.image,
                minutes: current === 1 ? 20 : 40,
                minWords: current === 1 ? 150 : 250
              }}
              preview
            />
          }
        />
      </div>
    </EditorShell>
  );
}
