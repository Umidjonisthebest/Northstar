import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CircleCheck } from "lucide-react";
import { getContent, saveContent, uploadFile } from "../api.js";
import { CreatableCombobox } from "../components/Combobox.jsx";
import { Select } from "../components/Select.jsx";
import { Field, PageLoader } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { EditorShell } from "./EditorShell.jsx";
import { QuestionGroupsPanel } from "./questions/QuestionGroupsPanel.jsx";
import { TEST_PART_HELP, USE_HELP, USE_OPTIONS, audioDurationSeconds, parseMinutes, useSources } from "./useEditorData.js";
import { contentHome, useEditorHome } from "./editorHome.js";

const SECTIONS = [1, 2, 3, 4];
const LEVELS = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" }
];
const AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/wave"];
const MAX_MB = 20;

const emptyPart = (section) => ({ id: null, section, title: "", durationMinutes: "20", audio: null, level: "MEDIUM", groups: [], active: true });
const isFilled = (p) => Boolean(p.id || p.title.trim() || p.audio || p.groups.length);

export default function ListeningEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const sources = useSources();
  const [loading, setLoading] = useState(Boolean(id));
  const [parts, setParts] = useState(() => Object.fromEntries(SECTIONS.map((s) => [s, emptyPart(s)])));
  // Opened from a practice test's page (?test=), these sections are that test's own.
  const from = useEditorHome();
  const [testId, setTestId] = useState(from.testId);
  const [current, setCurrent] = useState(SECTIONS.includes(from.part) ? from.part : 1);
  const [source, setSource] = useState("");
  const [use, setUse] = useState(from.use || "mock");
  const [groupId, setGroupId] = useState(null);
  const home = contentHome("listening", { testId, use });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upload, setUpload] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    getContent("listening", id)
      .then(({ record, siblings }) => {
        const next = Object.fromEntries(SECTIONS.map((s) => [s, emptyPart(s)]));
        for (const r of siblings) {
          next[r.section] = { id: r.id, section: r.section, title: r.title, durationMinutes: String(r.durationMinutes), audio: r.audio, level: r.level || "MEDIUM", groups: r.groups || [], active: r.active !== false };
        }
        setParts(next);
        setCurrent(SECTIONS.includes(from.part) ? from.part : record.section);
        setSource(record.source || "");
        setUse(record.use || "mock");
        setTestId(record.testId || from.testId);
        setGroupId(record.groupId || null);
      })
      .catch((err) => {
        toast.error("Could not load listening", err.message);
        navigate(contentHome("listening", from));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate, toast]);

  const part = parts[current];
  const patch = (changes) => {
    setParts((all) => ({ ...all, [current]: { ...all[current], ...changes } }));
    setDirty(true);
  };

  const minutes = parseMinutes(part.durationMinutes);

  const onAudio = async (file) => {
    if (!file) return;
    if (!AUDIO_TYPES.includes(file.type) && !/\.(mp3|m4a|wav|aac)$/i.test(file.name)) {
      toast.error("Unsupported file", "Please choose an MP3, M4A or WAV file.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error("File too large", `Audio files must be ${MAX_MB} MB or smaller.`);
      return;
    }
    const section = current;
    setUpload({ section, progress: 0, name: file.name });
    const seconds = await audioDurationSeconds(file);
    try {
      const res = await uploadFile("audio", file, (progress) => setUpload({ section, progress, name: file.name }));
      setParts((all) => ({
        ...all,
        [section]: {
          ...all[section],
          audio: { url: res.url, name: res.name, size: res.size, mime: res.mime },
          ...(seconds ? { durationMinutes: String(Math.ceil((seconds / 60) * 10) / 10) } : {})
        }
      }));
      setDirty(true);
      toast.success("Audio uploaded successfully!");
    } catch (err) {
      toast.error("Upload failed", err.message);
    } finally {
      setUpload(null);
    }
  };

  const save = async () => {
    const filled = SECTIONS.map((s) => parts[s]).filter(isFilled);
    if (!filled.length) {
      toast.error("Nothing to save", "Fill in at least one section.");
      return;
    }
    for (const p of filled) {
      const label = `Section ${p.section}`;
      const problem = !p.title.trim()
        ? "title is required"
        : !p.audio
          ? "an audio file is required"
          : !(parseMinutes(p.durationMinutes) > 0)
            ? "audio duration must be greater than 0"
            : !p.groups.length
              ? "add at least one question"
              : null;
      if (problem) {
        setCurrent(p.section);
        toast.error(`${label}: ${problem}`);
        return;
      }
    }
    setSaving(true);
    try {
      await saveContent("listening", {
        groupId,
        source,
        ...(testId ? { testId } : {}),
        parts: filled.map((p) => ({ id: p.id, section: p.section, title: p.title, durationMinutes: parseMinutes(p.durationMinutes), audio: p.audio, level: p.level, groups: p.groups, active: p.active, use }))
      });
      setDirty(false);
      toast.success(testId ? "Saved into the practice test" : "Listening saved successfully!");
      navigate(home);
    } catch (err) {
      toast.error("Save failed", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <EditorShell title={testId ? "Practice test: Listening" : "Admin Listening Editor"} backTo={home} dirty={dirty} saving={saving} onSave={save} saveLabel="Save Complete Listening">
      <div className="ie-editor-fields">
        <Field label="Audio duration (minutes)" success={minutes > 0 ? `Duration: ${Math.round(minutes * 100) / 100} minutes (${Math.round(minutes * 60)} seconds)` : undefined} error={part.durationMinutes && !(minutes > 0) ? "Enter a number of minutes, e.g. 7.5" : undefined}>
          <input className="ie-input" inputMode="decimal" value={part.durationMinutes} placeholder="e.g. 7.5" onChange={(e) => patch({ durationMinutes: e.target.value })} />
        </Field>
        <Field label="Listening audio file" help={`MP3 / M4A / WAV · max ${MAX_MB} MB`}>
          <div className="ie-file-input">
            <label>
              Choose File
              <input
                ref={fileRef}
                type="file"
                accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,.mp3,.m4a,.wav"
                hidden
                onChange={(e) => {
                  onAudio(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <span>{upload?.section === current ? `Uploading ${upload.name}… ${upload.progress}%` : part.audio ? part.audio.name : "No file chosen"}</span>
          </div>
          {upload?.section === current && (
            <div className="ie-progress">
              <span style={{ width: `${upload.progress}%` }} />
            </div>
          )}
          {part.audio && upload?.section !== current && <audio className="ie-audio-preview" controls preload="none" src={part.audio.url} />}
        </Field>
        <Field label="Title">
          <input className="ie-input" value={part.title} placeholder={`Enter Section ${current} title.`} onChange={(e) => patch({ title: e.target.value })} />
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

      <div className="ie-editor-body">
        <div className="ie-editor-card">
          <div className="ie-row" style={{ gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
            <span className="ie-label">Select Section:</span>
            <Select width={220} value={current} onChange={setCurrent} options={SECTIONS.map((s) => ({ value: s, label: `Section ${s}` }))} />
            <span className="ie-label" style={{ marginLeft: 8 }}>
              Level:
            </span>
            <Select width={150} value={part.level} onChange={(level) => patch({ level })} options={LEVELS} />
            <div className="ie-part-tabs" style={{ marginLeft: "auto" }}>
              {SECTIONS.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={`ie-part-tab ${isFilled(parts[s]) ? "ie-part-tab--filled" : ""} ${s === current ? "ie-part-tab--current" : ""}`}
                  onClick={() => setCurrent(s)}
                >
                  {isFilled(parts[s]) && <CircleCheck />}
                  Section {s}
                </button>
              ))}
            </div>
          </div>
          <QuestionGroupsPanel
            key={current}
            kind="listening"
            title={`Section ${current} Questions`}
            groups={part.groups}
            startNumber={(current - 1) * 10 + 1}
            onChange={(groups) => patch({ groups })}
          />
        </div>
      </div>
    </EditorShell>
  );
}
