import React, { useEffect, useState } from "react";
import { adminCreateStory, adminDeleteStory, adminStories, adminUpdateStory } from "../../api.js";
import { useAdminAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useConfirm } from "../../components/Confirm.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import { NOVA_TONES } from "../../components/novaTones.js";
import StoryCard from "../../components/StoryCard.jsx";
import { Empty } from "../../components/adminUi.jsx";

// Success stories for the cover page. Only published ones are public.

const BLANK = { id: null, name: "", detail: "", exam: "SAT", before: "", after: "", quote: "", tone: "sky", published: true };
const LIMITS = { SAT: { min: 400, max: 1600, step: 10 }, IELTS: { min: 0, max: 9, step: 0.5 } };

export default function Stories() {
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));

  const load = () =>
    adminStories(token)
      .then((d) => setList(d.stories))
      .catch((err) => toast.error(err.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const body = { ...form, before: Number(form.before), after: Number(form.after) };
    try {
      if (form.id) await adminUpdateStory(token, form.id, body);
      else await adminCreateStory(token, body);
      toast.success(form.id ? "Story updated" : form.published ? "Published on the cover page" : "Saved as a draft");
      setForm(BLANK);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(s) {
    try {
      await adminUpdateStory(token, s.id, { published: !s.published });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove(s) {
    if (!(await askConfirm({ title: `Delete ${s.name}'s story?`, message: "It disappears from the cover page.", confirmLabel: "Delete story" }))) return;
    try {
      await adminDeleteStory(token, s.id);
      if (form.id === s.id) setForm(BLANK);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const lim = LIMITS[form.exam];

  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <span className="ad-eyebrow">Both exams</span>
          <h1>Success stories</h1>
          <p>Score jumps and quotes from your students, shown on the cover page. Only publish a story with the student&rsquo;s permission.</p>
        </div>
        <a className="btn btn-secondary" href="/#stories" target="_blank" rel="noreferrer">
          <Icon name="eye" size={16} /> View cover page
        </a>
      </div>

      <div className="ad-ann-grid">
        <form className="ad-card" onSubmit={save}>
          <div className="ad-card-head">
            <h3>
              <Icon name={form.id ? "pencil" : "plus"} size={18} /> {form.id ? "Edit story" : "New story"}
            </h3>
            {form.id && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(BLANK)}>
                Cancel
              </button>
            )}
          </div>
          <div className="field">
            <label>Exam</label>
            <div className="ad-tones two">
              {["SAT", "IELTS"].map((x) => (
                <button type="button" key={x} className={form.exam === x ? "on" : ""} onClick={() => setForm((f) => ({ ...f, exam: x, before: "", after: "" }))}>
                  <Icon name={x === "SAT" ? "calc" : "headphones"} size={20} />
                  {x}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Student name, as it should appear</label>
            <input maxLength={60} value={form.name} onChange={set("name")} placeholder="Aziza K." required />
          </div>
          <div className="field">
            <label>Detail (optional)</label>
            <input maxLength={80} value={form.detail} onChange={set("detail")} placeholder="Class of 2027 · Dream school: NYU" />
          </div>
          <div className="ad-story-scores">
            <div className="field">
              <label>Starting {form.exam === "SAT" ? "score" : "band"}</label>
              <input type="number" min={lim.min} max={lim.max} step={lim.step} value={form.before} onChange={set("before")} placeholder={form.exam === "SAT" ? "1190" : "6.0"} required />
            </div>
            <Icon name="arrowRight" size={18} />
            <div className="field">
              <label>New {form.exam === "SAT" ? "score" : "band"}</label>
              <input type="number" min={lim.min} max={lim.max} step={lim.step} value={form.after} onChange={set("after")} placeholder={form.exam === "SAT" ? "1470" : "7.5"} required />
            </div>
          </div>
          <div className="field">
            <label>Quote (optional)</label>
            <textarea rows={3} maxLength={400} value={form.quote} onChange={set("quote")} placeholder="What helped most, in the student's own words." />
          </div>
          <div className="field">
            <label>Avatar colour</label>
            <div className="ad-story-tones">
              {Object.keys(NOVA_TONES).map((t) => (
                <button type="button" key={t} className={form.tone === t ? "on" : ""} onClick={() => setForm((f) => ({ ...f, tone: t }))} aria-label={t} aria-pressed={form.tone === t}>
                  <Nova size={34} tone={t} sparkles={false} />
                </button>
              ))}
            </div>
          </div>
          <label className="ad-check">
            <input type="checkbox" checked={form.published} onChange={set("published")} /> Show on the cover page
          </label>
          <p className="ad-small ad-muted" style={{ margin: "14px 0 8px" }}>
            Preview
          </p>
          <StoryCard story={{ ...form, before: form.before === "" ? "" : Number(form.before), after: form.after === "" ? "" : Number(form.after) }} className="ad-story-preview" />
          <button className="btn btn-primary" style={{ marginTop: 16, width: "100%", justifyContent: "center" }} disabled={saving || !form.name.trim()}>
            <Icon name="check" size={16} /> {saving ? "Saving…" : form.id ? "Save changes" : "Save story"}
          </button>
        </form>

        <div className="ad-card">
          <div className="ad-card-head">
            <h3>
              <Icon name="trophy" size={18} /> Stories
            </h3>
            <span>
              {list ? `${list.filter((s) => s.published).length} published · ${list.length} total` : "Loading…"}
            </span>
          </div>
          {list?.length === 0 && <Empty icon="trophy">No stories yet. The section stays hidden on the cover page until you publish one.</Empty>}
          <div className="ad-story-list">
            {list?.map((s) => (
              <div key={s.id} className={`ad-story ${s.published ? "" : "draft"}`}>
                <StoryCard story={s} />
                <div className="ad-story-actions">
                  <span className={`badge ${s.published ? "badge-good" : "badge-muted"}`}>{s.published ? "Published" : "Hidden"}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => togglePublished(s)}>
                    <Icon name="eye" size={15} /> {s.published ? "Hide" : "Publish"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...BLANK, ...s })}>
                    <Icon name="pencil" size={15} /> Edit
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(s)}>
                    <Icon name="trash" size={15} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
