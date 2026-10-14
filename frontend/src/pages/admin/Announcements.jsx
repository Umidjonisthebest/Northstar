import React, { useEffect, useState } from "react";
import { adminAnnouncements, adminClasses, adminCreateAnnouncement, adminDeleteAnnouncement, adminPinAnnouncement } from "../../api.js";
import { useAdminAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useConfirm } from "../../components/Confirm.jsx";
import Icon from "../../components/Icon.jsx";
import { Empty, timeAgo } from "../../components/adminUi.jsx";
import ClassPicker, { classesLabel, classesPhrase } from "./ClassPicker.jsx";

export const TONES = [
  ["info", "Info", "info"],
  ["success", "Good news", "success"],
  ["warning", "Reminder", "warning"],
  ["celebrate", "Celebrate", "party"]
];
const ICON = Object.fromEntries(TONES.map(([k, , i]) => [k, i]));

// `classes` (every class there is) gives the classes an announcement is for their names; without
// it the card says how many classes.
export function AnnouncementCard({ a, actions, classes }) {
  return (
    <div className={`ann ${a.tone}`}>
      <span className="ann-icon">
        <Icon name={ICON[a.tone] || "info"} size={20} />
      </span>
      <div style={{ minWidth: 0 }}>
        <b>
          {a.pinned && <Icon name="pinFilled" size={13} style={{ marginRight: 6, color: "var(--primary)" }} />}
          {a.title || "Your headline"}
        </b>
        {(a.body || !a.id) && <p>{a.body || "Add a short message for your students…"}</p>}
        <small>
          {a.createdAt ? timeAgo(a.createdAt) : "Preview"} · {classesLabel(a.classIds === "all" ? [] : a.classIds, classes)}
        </small>
      </div>
      {actions}
    </div>
  );
}

export default function Announcements() {
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const [list, setList] = useState(null);
  // `classIds`: "all" for every class, or the ids of the classes it is for.
  const [form, setForm] = useState({ title: "", body: "", tone: "info", pinned: false, classIds: "all" });
  const [saving, setSaving] = useState(false);
  // Every class there is (with how many students each has), for the class picker and the cards.
  const [classes, setClasses] = useState(null);

  const load = () => adminAnnouncements(token).then((d) => setList(d.announcements));
  useEffect(() => {
    load();
    adminClasses(token)
      .then((d) => setClasses(d.classes))
      .catch(() => setClasses([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // An announcement goes to classes: with none made yet, or none chosen, there is nobody to post to.
  const noClass = classes?.length === 0 || (form.classIds !== "all" && form.classIds.length === 0);

  async function post(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminCreateAnnouncement(token, form);
      toast.success(`Posted to ${classesPhrase(form.classIds, classes)}`);
      setForm({ title: "", body: "", tone: "info", pinned: false, classIds: form.classIds });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <span className="ad-eyebrow">Both exams</span>
          <h1>Announcements</h1>
          <p>Post reminders, mock dates or shout-outs to every class or to the ones you choose. Students see them under the bell, and a pinned one on their home page. Students who aren't in a class don't get announcements.</p>
        </div>
      </div>

      <div className="ad-ann-grid">
        <form className="ad-card" onSubmit={post}>
          <div className="ad-card-head">
            <h3>
              <Icon name="megaphone" size={18} /> New announcement
            </h3>
          </div>
          <div className="field">
            <label>Who is it for?</label>
            <ClassPicker value={form.classIds} onChange={(classIds) => setForm({ ...form, classIds })} classes={classes} />
          </div>
          <div className="field">
            <label>Style</label>
            <div className="ad-tones">
              {TONES.map(([k, label, icon]) => (
                <button type="button" key={k} className={form.tone === k ? "on" : ""} onClick={() => setForm({ ...form, tone: k })}>
                  <Icon name={icon} size={20} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Headline</label>
            <input maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mock exam #2 is this Saturday at 9:00" required />
          </div>
          <div className="field">
            <label>Message (optional)</label>
            <textarea rows={4} maxLength={1000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Bring a charged laptop and arrive 10 minutes early." />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> Pin to the top
          </label>
          <p className="ad-small ad-muted" style={{ margin: "0 0 8px" }}>
            Preview
          </p>
          <AnnouncementCard a={form} classes={classes} />
          <button className="btn btn-primary" style={{ marginTop: 16, width: "100%", justifyContent: "center" }} disabled={saving || !form.title.trim() || noClass}>
            <Icon name="megaphone" size={16} /> {saving ? "Posting…" : classes?.length === 0 ? "Make a class first" : noClass ? "Choose a class first" : `Post to ${classesPhrase(form.classIds, classes)}`}
          </button>
        </form>

        <div className="ad-card">
          <div className="ad-card-head">
            <h3>
              <Icon name="clock" size={18} /> Posted
            </h3>
            <span>{list?.length ?? 0} total</span>
          </div>
          {list?.length === 0 && <Empty icon="megaphone">Nothing posted yet.</Empty>}
          <div className="ann-list">
            {list?.map((a) => (
              <AnnouncementCard
                key={a.id}
                a={a}
                classes={classes}
                actions={
                  <div className="ann-actions">
                    <button
                      type="button"
                      className={a.pinned ? "on" : ""}
                      title={a.pinned ? "Unpin" : "Pin"}
                      onClick={async () => {
                        await adminPinAnnouncement(token, a.id, !a.pinned);
                        load();
                      }}
                    >
                      <Icon name="pinFilled" size={14} />
                    </button>
                    <button
                      type="button"
                      className="del"
                      title="Delete"
                      onClick={async () => {
                        if (!(await askConfirm({ title: "Delete this announcement?", message: "Students will stop seeing it.", confirmLabel: "Delete" }))) return;
                        await adminDeleteAnnouncement(token, a.id);
                        load();
                      }}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
