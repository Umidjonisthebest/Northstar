import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminPublishSatTest, mockTestApi, satPracticeApi } from "../api.js";
import { useAdminAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { useConfirm } from "../components/Confirm.jsx";
import { SkeletonTestEditor } from "../components/SkeletonAdmin.jsx";
import Icon from "../components/Icon.jsx";
import useBackdropClose from "../components/useBackdropClose.js";
import { DifficultyBadge, TestDetailsModal } from "./TestsList.jsx";
import { SAT_MOCKS, SAT_TESTS, studioPath } from "../studio/panels.js";
import { useStudio } from "../studio/useStudio.js";
import { ExamTag } from "../studio/SectionKit.jsx";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const MIN_MINUTES = 1;
const MAX_MINUTES = 300;

// The editor of both kinds of SAT test the studio builds: a teacher mock (run as a session), and,
// with `practice`, a practice test (students sit it alone, once the admin has published it). They
// are the same thing to write: modules of questions. A practice test is the admin's to change; a
// teacher opens it to read.
export default function TestEditor({ practice = false }) {
  const { testId } = useParams();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const { isAdmin } = useStudio();
  const api = practice ? satPracticeApi : mockTestApi;
  const canEdit = !practice || isAdmin;
  const home = studioPath(practice ? SAT_TESTS : SAT_MOCKS);
  const homeName = practice ? "practice tests" : "teacher mocks";
  const [publishing, setPublishing] = useState(false);
  const [test, setTest] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null); // question object or null
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // A failed request must not leave the skeleton up forever or vanish as an unhandled rejection.
  async function load() {
    try {
      const data = await api.get(token, testId);
      setTest(data);
      setLoadError("");
      // Stay on the module being edited when it is still there; otherwise open the first one.
      setActiveModuleId((prev) => (data.modules.some((m) => m.id === prev) ? prev : data.modules[0]?.id));
    } catch (e) {
      setLoadError(e.message || "Couldn't load this test");
    }
  }

  useEffect(() => {
    setTest(null);
    setLoadError("");
    setActiveModuleId(null);
    setShowQuestionModal(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  if (!test) {
    return loadError ? (
      <div className="card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Couldn't load this test</h2>
        <p style={{ color: "var(--ink-soft)" }}>{loadError}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={load}>
            Try again
          </button>
          <Link to={home} className="btn btn-secondary">
            Back to {homeName}
          </Link>
        </div>
      </div>
    ) : (
      <SkeletonTestEditor />
    );
  }

  const activeModule = test.modules.find((m) => m.id === activeModuleId);

  // Saved when the field loses focus. An empty or out-of-range value used to be sent as it was
  // (0 minutes ends every candidate's exam the moment it opens), and an unchanged one was re-sent.
  async function handleTimeLimitChange(input) {
    const raw = input.value.trim();
    const minutes = Number(raw);
    if (raw === "" || !Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
      toast.error(`Enter a whole number of minutes from ${MIN_MINUTES} to ${MAX_MINUTES}.`);
      input.value = activeModule.timeLimitMinutes;
      return;
    }
    if (minutes === activeModule.timeLimitMinutes) return;
    try {
      await api.updateModule(token, test.id, activeModule.id, { timeLimitMinutes: minutes });
      toast.success("Time limit saved");
      await load();
    } catch (e) {
      toast.error(e.message);
      input.value = activeModule.timeLimitMinutes;
    }
  }

  // Math modules have the graphing calculator unless the teacher says otherwise (the server uses
  // the same rule: grading.js, moduleHasCalculator).
  const calculatorOn = (m) => (typeof m.calculator === "boolean" ? m.calculator : /math/i.test(m.name || ""));
  async function handleCalculatorChange(on) {
    try {
      await api.updateModule(token, test.id, activeModule.id, { calculator: on });
      toast.success(on ? "Calculator switched on for this module" : "Calculator switched off for this module");
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function handleDeleteQuestion(q) {
    if (!(await askConfirm({ title: "Delete this question?", message: "It is removed from this module for good.", confirmLabel: "Delete question" }))) return;
    try {
      await api.deleteQuestion(token, test.id, activeModule.id, q.id);
      toast.success("Question deleted");
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  // A practice test is a draft until it is published: only then is it on the students' list.
  const questionCount = test.modules.reduce((n, m) => n + m.questions.length, 0);
  async function handlePublish(published) {
    setPublishing(true);
    try {
      await adminPublishSatTest(token, test.id, published);
      toast.success(published ? "Published. It is on every student's Practice Tests page now." : "Taken off the students' list. Results students already have are kept.");
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div>
      <Link to={home} className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }}>
        ← Back to {homeName}
      </Link>

      <div className="page-header">
        <div>
          <p style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "0 0 8px" }}>
            <ExamTag exam="sat" />
            <span className="badge badge-accent">{practice ? "Practice test" : "Teacher mock"}</span>
            {practice && <span className={`badge ${test.published ? "badge-good" : "badge-muted"}`}>{test.published ? "Published" : "Draft"}</span>}
          </p>
          <h1>{test.title}</h1>
          <p style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {test.difficulty ? <DifficultyBadge value={test.difficulty} /> : <span className="badge badge-muted">Difficulty not rated</span>}
            <span>{test.description || "No description"}</span>
          </p>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={() => setShowDetails(true)}>
              <Icon name="pencil" size={16} /> Edit details
            </button>
            {practice &&
              (test.published ? (
                <button className="btn btn-secondary" disabled={publishing} onClick={() => handlePublish(false)}>
                  <Icon name="lock" size={16} /> Unpublish
                </button>
              ) : (
                <button className="btn btn-primary" disabled={publishing || questionCount === 0} title={questionCount === 0 ? "Add at least one question first" : undefined} onClick={() => handlePublish(true)}>
                  <Icon name="check" size={16} /> Publish to students
                </button>
              ))}
          </div>
        )}
      </div>
      {showDetails && <TestDetailsModal test={test} token={token} api={api} onClose={() => setShowDetails(false)} onSaved={load} />}

      {practice && (
        <div className="ad-sec-note ad-exam sat">
          <Icon name="info" size={18} />
          <span>
            {!canEdit
              ? "Practice tests are made by the admin. You can read this one here; to run a test of your own for a class, build a teacher mock."
              : test.published
                ? "Students can sit this test on their own now. A change you save here reaches them at once, so avoid removing questions while it is published."
                : "This is a draft: students can't see it. Add questions to the modules you want (a module left empty is simply not part of the test), then publish."}{" "}
            Math is typed plainly: x^2, (x + 1)/2, √(x + 4). Students see it drawn.
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {test.modules.map((m) => (
          <button
            key={m.id}
            className={"btn btn-sm " + (m.id === activeModuleId ? "btn-primary" : "btn-secondary")}
            onClick={() => setActiveModuleId(m.id)}
          >
            {m.name} ({m.questions.length})
          </button>
        ))}
      </div>

      {activeModule && (
        <>
          <div className="card" style={{ marginBottom: 20, display: "flex", gap: "14px 20px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0, maxWidth: 200 }}>
              <label>Time limit (minutes)</label>
              <input
                type="number"
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                step={1}
                defaultValue={activeModule.timeLimitMinutes}
                key={activeModule.id}
                disabled={!canEdit}
                onBlur={(e) => handleTimeLimitChange(e.target)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            </div>
            <p className="hint" style={{ margin: 0 }}>
              {practice
                ? `A timed sitting gives students this many minutes for "${activeModule.name}"; an untimed one has no clock.`
                : `Students get this many minutes once they open "${activeModule.name}".`}
            </p>
            {/* A practice test's Math modules always have the calculator, as on the real test. */}
            {!practice && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, flexBasis: "100%", margin: 0, cursor: "pointer" }}>
                <input type="checkbox" checked={calculatorOn(activeModule)} onChange={(e) => handleCalculatorChange(e.target.checked)} style={{ width: 18, height: 18 }} />
                <span>
                  Graphing calculator (Desmos) <span className="hint">· on by default for Math modules</span>
                </span>
              </label>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: "0 0 10px" }}>Questions</h3>
            {canEdit && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditingQuestion(null);
                  setShowQuestionModal(true);
                }}
              >
                + Add question
              </button>
            )}
          </div>

          {activeModule.questions.length === 0 && (
            <div className="empty-state card">No questions in this module yet.</div>
          )}

          {activeModule.questions
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((q) => (
              <div className="list-row" key={q.id} style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="list-row-title">
                    Q{q.order} · <span className="badge badge-accent">{q.type === "mcq" ? "Multiple choice" : "Grid-in"}</span>
                  </div>
                  <div className="list-row-meta" style={{ maxWidth: 560 }}>
                    {q.prompt}
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditingQuestion(q);
                        setShowQuestionModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteQuestion(q)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
        </>
      )}

      {showQuestionModal && (
        <QuestionModal
          token={token}
          api={api}
          practice={practice}
          test={test}
          module={activeModule}
          question={editingQuestion}
          onClose={() => setShowQuestionModal(false)}
          onSaved={() => {
            setShowQuestionModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function QuestionModal({ token, api, practice, test, module, question, onClose, onSaved }) {
  const isEdit = Boolean(question);
  // Shown to students with their results, once a practice test is over.
  const [explanation, setExplanation] = useState(question?.explanation || "");
  const [type, setType] = useState(question?.type || "mcq");
  const [passage, setPassage] = useState(question?.passage || "");
  const [passageImage, setPassageImage] = useState(question?.passageImage || null);
  const [prompt, setPrompt] = useState(question?.prompt || "");
  const [promptImage, setPromptImage] = useState(question?.promptImage || null);
  const [options, setOptions] = useState(question?.options?.length ? question.options : ["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(question?.correctIndex ?? 0);
  const [correctAnswer, setCorrectAnswer] = useState(question?.correctAnswer || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const backdrop = useBackdropClose(onClose);
  const previewBackdrop = useBackdropClose(() => setShowPreview(false));

  function updateOption(i, value) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }
  function addOption() {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, ""]);
  }
  function removeOption(i) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
    // Keep correctIndex pointing at the same option after the array shifts:
    // removing the correct option itself falls back to A (visibly, so it's
    // obvious a new correct choice needs picking), removing one before it
    // shifts the index down, and removing one after it leaves it untouched.
    setCorrectIndex((prev) => {
      if (i === prev) return 0;
      if (i < prev) return prev - 1;
      return prev;
    });
  }

  // The server stores only PNG, JPEG, GIF and WebP, so say so here rather than after the upload.
  const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

  function handleImageUpload(field, input) {
    const file = input.files?.[0];
    // Forget the choice, so picking the same file again after removing it still counts as a change.
    input.value = "";
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Use a PNG, JPEG, GIF or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be less than 2MB.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      if (field === "passage") setPassageImage(e.target.result);
      else setPromptImage(e.target.result);
    };
    reader.onerror = () => setError("Couldn't read that image. Try another file.");
    reader.readAsDataURL(file);
  }

  function removeImage(field) {
    if (field === "passage") setPassageImage(null);
    else setPromptImage(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!prompt.trim()) {
      setError("Question text is required.");
      return;
    }
    if (type === "mcq" && options.some((o) => !o.trim())) {
      setError("Fill in all answer choices, or remove empty ones.");
      return;
    }
    if (type === "grid_in" && !correctAnswer.trim()) {
      setError("Enter the correct numeric answer.");
      return;
    }

    const body =
      type === "mcq"
        ? { type, prompt, passage, passageImage, promptImage, options, correctIndex: Number(correctIndex) }
        : { type, prompt, passage, passageImage, promptImage, correctAnswer };
    if (practice) body.explanation = explanation;

    setSaving(true);
    try {
      if (isEdit) {
        await api.updateQuestion(token, test.id, module.id, question.id, body);
      } else {
        await api.addQuestion(token, test.id, module.id, body);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function renderPreview() {
    const q = { type, prompt, passage, passageImage, promptImage, options, correctIndex, correctAnswer };
    return (
      <div className="preview-modal-content">
        <div className="preview-header">
          <h3>Question Preview</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPreview(false)}>Close</button>
        </div>
        <div className="preview-question">
          {q.passageImage && (
            <div className="preview-image">
              <img src={q.passageImage} alt="Passage image" />
            </div>
          )}
          {q.passage && <div className="preview-passage">{q.passage}</div>}
          {q.promptImage && (
            <div className="preview-image">
              <img src={q.promptImage} alt="Question image" />
            </div>
          )}
          <div className="preview-prompt">
            <strong>Q.</strong> {q.prompt}
          </div>
          {q.type === "mcq" && (
            <div className="preview-options">
              {q.options.map((opt, i) => (
                <div key={i} className={i === q.correctIndex ? "correct" : ""}>
                  <span className="option-letter">{LETTERS[i]}</span>
                  {opt}
                  {i === q.correctIndex && <span className="correct-badge"><Icon name="check" size={12} strokeWidth={3} /> Correct</span>}
                </div>
              ))}
            </div>
          )}
          {q.type === "grid_in" && (
            <div className="preview-gridin">
              <strong>Answer:</strong> {q.correctAnswer || "(not set)"}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" {...backdrop}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? "Edit question" : "Add question"}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Question type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} disabled={isEdit}>
              <option value="mcq">Multiple choice</option>
              <option value="grid_in">Grid-in (numeric answer)</option>
            </select>
            {isEdit && <p className="hint">Question type can't be changed after creation — delete and re-add instead.</p>}
          </div>

          <div className="field">
            <label>Passage / stimulus (optional)</label>
            <textarea rows={4} value={passage} onChange={(e) => setPassage(e.target.value)} placeholder="Shown above the question, e.g. a reading passage or a data description." />
            <div className="image-upload">
              <label className="image-upload-label">
                <input type="file" accept={IMAGE_TYPES.join(",")} onChange={(e) => handleImageUpload("passage", e.target)} style={{ display: "none" }} />
                <span className="btn btn-secondary btn-sm">Add Passage Image</span>
              </label>
              {passageImage && (
                <div className="image-preview">
                  <img src={passageImage} alt="Passage preview" />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeImage("passage")}>Remove</button>
                </div>
              )}
            </div>
          </div>

          <div className="field">
            <label>Question text</label>
            <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
            <div className="image-upload">
              <label className="image-upload-label">
                <input type="file" accept={IMAGE_TYPES.join(",")} onChange={(e) => handleImageUpload("prompt", e.target)} style={{ display: "none" }} />
                <span className="btn btn-secondary btn-sm">Add Question Image</span>
              </label>
              {promptImage && (
                <div className="image-preview">
                  <img src={promptImage} alt="Question preview" />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeImage("prompt")}>Remove</button>
                </div>
              )}
            </div>
          </div>

          {type === "mcq" ? (
            <div className="field">
              <label>Answer choices — select the correct one</label>
              {options.map((opt, i) => (
                <div key={i} className="option-input-row">
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                  />
                  <span className="option-letter-label">{LETTERS[i]}</span>
                  <input value={opt} onChange={(e) => updateOption(i, e.target.value)} className="option-input" />
                  {options.length > 2 && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeOption(i)}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={addOption}>
                  + Add choice
                </button>
              )}
            </div>
          ) : (
            <div className="field">
              <label>Correct answer</label>
              <input value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} placeholder="e.g. 81" maxLength={40} />
              <p className="hint">Numbers match however the student writes them: 3/4, 0.75 and .75 are the same answer.</p>
            </div>
          )}

          {practice && (
            <div className="field">
              <label htmlFor="question-explanation">Explanation (optional)</label>
              <textarea id="question-explanation" rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Why the answer is right. Students read it with their results, after the test." />
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setShowPreview(true)} disabled={saving}>
              Preview
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add question"}
            </button>
          </div>
        </form>

        {showPreview && (
          <div className="modal-backdrop" {...previewBackdrop}>
            <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
              {renderPreview()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
