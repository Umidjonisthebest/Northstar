import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Eye, EyeOff, Headphones, PenLine, Play, Plus, SquarePen, Trash2 } from "lucide-react";
import { adminPath } from "../paths.js";
import { copyPartIntoTest, deletePracticeTest, getPracticeTest, removeTestPart, setPracticeTestActive, updatePracticeTest } from "../api.js";
import { Button, PageLoader, Pill } from "../components/ui.jsx";
import { ConfirmDialog } from "../components/Modal.jsx";
import { Select } from "../components/Select.jsx";
import { useToast } from "../components/Toast.jsx";
import { pluralize } from "../lib/format.js";
import { ExamTag } from "../../studio/SectionKit.jsx";
import { testPartEditor } from "./editorHome.js";
import { TEST_KINDS, TestDetailsModal } from "./PracticeTestsPage.jsx";

// One practice test's own page: its Listening, Reading and Writing, a slot for each part a real
// test has. A part is written in its editor, opened from here (it is saved straight into the
// test), or copied in from section practice or the mock material (the copy is the test's own).
// Nothing here is shared with section practice. The admin builds; a teacher can look.

const ICON = { listening: Headphones, reading: BookOpen, writing: PenLine };
const LEVEL = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };
const USE_LABEL = { practice: "section practice", mock: "mock material", both: "practice and mocks" };
const NONE = "";

function partMeta(kind, part) {
  if (kind === "writing") return LEVEL[part.level] || "Medium";
  return `${pluralize(part.questionCount, "question")}${part.minutes ? ` · ${part.minutes} min` : ""} · ${LEVEL[part.level] || "Medium"}`;
}

export default function PracticeTestBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null); // { part, kind } to remove, or "test" to delete
  const [busy, setBusy] = useState(false);
  const home = adminPath("tests");

  const load = useCallback(async () => {
    try {
      setData(await getPracticeTest(id));
    } catch (err) {
      toast.error("Could not open this practice test", err.message);
      navigate(home, { replace: true });
    }
  }, [id, navigate, toast, home]);
  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <PageLoader />;
  const { test, canEdit, library } = data;
  const setTest = (next) => setData((d) => ({ ...d, test: next }));

  // One step at a time, with the server's own words when it refuses.
  const run = async (work, done) => {
    setBusy(true);
    try {
      const out = await work();
      if (done) toast.success(...[].concat(done));
      return out;
    } catch (err) {
      toast.error("That didn't work", err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const show = async (active) => {
    const next = await run(() => setPracticeTestActive(test.id, active), active ? ["Shown to students", "It is on their Practice Tests page now."] : ["Hidden from students", "Their finished sections are kept."]);
    if (next) setTest(next);
  };
  const copyIn = async (kind, from) => {
    const next = await run(() => copyPartIntoTest(test.id, kind, from), ["Copied into the test", "The copy is this test's own; the original stays where it was."]);
    if (next) setTest(next);
  };
  const confirmed = async () => {
    if (confirm === "test") {
      const ok = await run(() => deletePracticeTest(test.id), "Practice test deleted");
      setConfirm(null);
      if (ok) navigate(home);
      return;
    }
    const next = await run(() => removeTestPart(test.id, confirm.kind, confirm.part.id), "Removed from the test");
    setConfirm(null);
    if (next) setTest(next);
  };

  const hasParts = test.filled > 0;
  return (
    <div className="ad-exam ielts">
      <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate(home)} style={{ marginBottom: 10 }}>
        Practice tests
      </Button>

      <div className="ie-ptb-head">
        <div>
          <div className="ie-ptb-tags">
            <ExamTag exam="ielts" />
            <Pill tone="outline">Practice test</Pill>
            <Pill tone={test.active ? "green" : "gray"}>{test.active ? "Shown to students" : "Hidden from students"}</Pill>
            <Pill tone={test.filled === test.of ? "blue" : "amber"}>
              {test.filled} of {test.of} parts
            </Pill>
            {test.seeded && <Pill tone="outline">Northstar original</Pill>}
          </div>
          <h1>{test.title}</h1>
          <p>
            {LEVEL[test.level]} level{test.description ? ` · ${test.description}` : ""}
            {test.attempts ? ` · ${pluralize(test.attempts, "section")} taken by ${pluralize(test.students, "student")}` : ""}
          </p>
        </div>
        {canEdit && (
          <div className="ie-ptb-actions">
            <Button variant="outline" icon={SquarePen} onClick={() => setEditing(true)}>
              Edit details
            </Button>
            {test.active ? (
              <Button variant="outline" icon={EyeOff} disabled={busy} onClick={() => show(false)}>
                Hide from students
              </Button>
            ) : (
              <Button icon={Eye} disabled={busy || !hasParts} title={hasParts ? undefined : "Add at least one part first"} onClick={() => show(true)}>
                Show to students
              </Button>
            )}
            <Button variant="danger" icon={Trash2} title="Delete this test" aria-label="Delete this test" onClick={() => setConfirm("test")} />
          </div>
        )}
      </div>

      {canEdit && (
        <ol className="ie-ptb-steps" aria-label="How to build this test">
          <li className="done">
            <span>
              <b>Name the test</b>
              Done. "Edit details" changes its title, level and description.
            </span>
          </li>
          <li className={hasParts ? "done" : ""}>
            <span>
              <b>Add its parts</b>
              Write a part in its editor, or copy one in. A section can be left out, or be shorter than the real one.
            </span>
          </li>
          <li className={test.active && hasParts ? "done" : ""}>
            <span>
              <b>Show it to students</b>
              {test.active ? "It is on their Practice Tests page." : "Until then nobody but you sees it."}
            </span>
          </li>
        </ol>
      )}

      {TEST_KINDS.map(([kind, name, unit]) => {
        const Icon = ICON[kind];
        const slots = test.slots[kind];
        const filled = slots.filter((s) => s.part);
        // Opening the editor on a part the section already has loads the whole section into it.
        const anchor = filled[0]?.part.id || null;
        return (
          <section className="ie-ptb-card" key={kind} aria-label={name}>
            <div className="ie-ptb-card__head">
              <h2>
                <Icon /> {name}
                <small>
                  {filled.length} of {slots.length} {unit.toLowerCase()}s
                  {test.sections[kind] && kind !== "writing" ? ` · ${pluralize(test.sections[kind].questionCount, "question")}` : ""}
                </small>
              </h2>
              {canEdit && (
                <Button variant={filled.length ? "outline" : "primary"} size="sm" icon={SquarePen} onClick={() => navigate(testPartEditor(kind, test.id, { partId: anchor }))}>
                  {filled.length ? `Open the ${name} editor` : `Write the ${name} section`}
                </Button>
              )}
            </div>
            {slots.map(({ number, part }) => {
              const choices = (library?.[kind] || []).filter((o) => o.number === number);
              return (
                <div className={`ie-ptb-slot${part ? "" : " ie-ptb-slot--empty"}`} key={number}>
                  <span className="ie-ptb-slot__n">
                    {unit} {number}
                  </span>
                  <div className="ie-ptb-slot__main">
                    {part ? (
                      <>
                        <b>{part.title}</b>
                        <span>
                          {partMeta(kind, part)}
                          {!part.ready && <Pill tone="amber">No recording yet</Pill>}
                          {!part.active && <Pill tone="gray">Switched off</Pill>}
                        </span>
                      </>
                    ) : (
                      <b>Empty</b>
                    )}
                  </div>
                  <div className="ie-ptb-slot__go">
                    {/* The preview shows the key, and is the admin's like the editors. */}
                    {part && canEdit && kind !== "writing" && <Button variant="outline" size="sm" icon={Play} title="Preview" aria-label={`Preview ${part.title}`} onClick={() => navigate(adminPath(kind, part.id, "preview"))} />}
                    {part && canEdit && (
                      <>
                        <Button variant="outline" size="sm" icon={SquarePen} onClick={() => navigate(testPartEditor(kind, test.id, { partId: part.id, number }))}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" icon={Trash2} title="Remove from the test" aria-label={`Remove ${part.title} from the test`} onClick={() => setConfirm({ kind, part })} />
                      </>
                    )}
                    {!part && canEdit && (
                      <>
                        <Button variant="outline" size="sm" icon={Plus} onClick={() => navigate(testPartEditor(kind, test.id, { partId: anchor, number }))}>
                          Write it
                        </Button>
                        {choices.length > 0 && (
                          <Select
                            value={NONE}
                            disabled={busy}
                            aria-label={`Copy a ${unit.toLowerCase()} ${number} into the test`}
                            onChange={(from) => from && copyIn(kind, from)}
                            options={[{ value: NONE, label: "or copy one in…" }, ...choices.map((o) => ({ value: o.id, label: `${o.title} (${USE_LABEL[o.use] || o.use})` }))]}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      {editing && (
        <TestDetailsModal
          test={test}
          onClose={() => setEditing(false)}
          onSave={async (body) => {
            setTest(await updatePracticeTest(test.id, body));
            toast.success("Details saved");
            setEditing(false);
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm === "test" ? "Delete this practice test?" : "Remove this part from the test?"}
        message={
          confirm === "test"
            ? "The test and its parts are removed, and students won't see it any more. Sections students already finished are kept, and nothing in section practice changes."
            : `"${confirm?.part?.title}" belongs to this test only, so it is deleted. Sections students already finished keep their review.`
        }
        confirmLabel={confirm === "test" ? "Delete test" : "Remove"}
        busy={busy}
        onConfirm={confirmed}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
