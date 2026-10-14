import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import "../messages.css";

// One conversation between a student and the developers, with the box to write in. The student's
// page (pages/hub/Messages.jsx) and the studio's inbox (pages/admin/Messages.jsx) both use it;
// `side` says who is writing here, and their messages sit on the right.
//
//   messages   [{ id, from: "student" | "team", body, topic?, createdAt, read, by? }]
//   otherName  the label over the other side's messages
//   topics     [{ id, label }] for the tags on messages; with `pickTopic` they are also offered above the box
//   blocked    text shown in place of the box when nothing can be sent
//   draftKey   sessionStorage key that keeps an unsent draft across pages
//   onSend     (body, topic) => Promise<boolean>; true clears the box

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const timeOf = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
function dayLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return "Today";
  if (sameDay(d, new Date(now.getTime() - 86400000))) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }) });
}

function readDraft(key) {
  if (!key) return "";
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export default function MessageThread({ messages, side, otherName, topics = [], pickTopic = false, max = 2000, blocked = null, placeholder = "Write a message…", draftKey, onSend, empty }) {
  const [draft, setDraft] = useState(() => readDraft(draftKey));
  const [topic, setTopic] = useState(null);
  const [sending, setSending] = useState(false);
  const log = useRef(null);
  const box = useRef(null);
  const atBottom = useRef(true);
  const lastId = messages.at(-1)?.id;
  // A phone's keyboard has no Shift + Enter, so there Enter makes a new line and the button sends.
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const topicLabel = Object.fromEntries(topics.map((t) => [t.id, t.label]));

  useEffect(() => {
    if (!draftKey) return;
    try {
      if (draft) sessionStorage.setItem(draftKey, draft);
      else sessionStorage.removeItem(draftKey);
    } catch {
      /* private mode */
    }
  }, [draftKey, draft]);

  // Keep the newest message in view, unless the reader has scrolled up to read older ones.
  useLayoutEffect(() => {
    const el = log.current;
    if (!el) return;
    if (atBottom.current || messages.at(-1)?.from === side) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

  async function submit(e) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (await onSend(body, topic)) {
        setDraft("");
        setTopic(null);
      }
    } finally {
      setSending(false);
      box.current?.focus();
    }
  }

  const left = max - draft.length;

  return (
    <div className="dm-thread">
      <div
        className="dm-log"
        ref={log}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {messages.length === 0 && <div className="dm-empty">{empty}</div>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const mine = m.from === side;
          const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
          const last = i === messages.length - 1;
          return (
            <React.Fragment key={m.id}>
              {newDay && <p className="dm-day">{dayLabel(m.createdAt)}</p>}
              <div className={`dm-msg ${mine ? "mine" : ""}`}>
                {!mine && (newDay || prev.from !== m.from) && <span className="dm-who">{otherName}</span>}
                <div className="dm-bubble">{m.body}</div>
                <span className="dm-meta">
                  {m.topic && topicLabel[m.topic] && <i className={`dm-tag ${m.topic}`}>{topicLabel[m.topic]}</i>}
                  {mine && m.by ? `${m.by} · ` : ""}
                  {timeOf(m.createdAt)}
                  {mine && last && m.read && (
                    <>
                      {" · "}
                      <Icon name="check" size={12} /> Seen
                    </>
                  )}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {blocked ? (
        <p className="dm-blocked" role="status">
          <Icon name="info" size={18} /> {blocked}
        </p>
      ) : (
        <form className="dm-compose" onSubmit={submit}>
          {pickTopic && topics.length > 0 && (
            <div className="dm-topics" role="group" aria-label="What is it about? (optional)">
              {topics.map((t) => (
                <button key={t.id} type="button" className={topic === t.id ? "on" : ""} aria-pressed={topic === t.id} onClick={() => setTopic(topic === t.id ? null : t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <div className="dm-box">
            <textarea
              ref={box}
              rows={1}
              maxLength={max}
              value={draft}
              placeholder={placeholder}
              aria-label={placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !touch && !e.nativeEvent.isComposing) submit(e);
              }}
            />
            <button type="submit" className="dm-send" disabled={sending || !draft.trim()} aria-label="Send message">
              <Icon name="send" size={18} />
            </button>
          </div>
          <p className="dm-hint">
            {touch ? "Tap the arrow to send." : "Enter to send, Shift + Enter for a new line."}
            {left <= max * 0.1 && <b> {left.toLocaleString("en-US")} characters left.</b>}
          </p>
        </form>
      )}
    </div>
  );
}
