import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { deleteClassMessage, getClassRoom, getClassRooms, markClassRoomRead, reportClassMessage, sendClassMessage } from "../../../api.js";
import { useStudentAuth } from "../../../context/AuthContext.jsx";
import { useToast } from "../../../components/Toast.jsx";
import { useConfirm } from "../../../components/Confirm.jsx";
import Icon from "../../../components/Icon.jsx";
import Avatar from "../../../components/avatar/Avatar.jsx";
import LoadFailed from "../../../components/LoadFailed.jsx";
import { Loading } from "../Home.jsx";
import { SECTION_KEY, SECTION_SHORT, playerUrl } from "../hubUtils.js";
import { ago, classUrl, plural } from "./classUtils.js";
import "../../../messages.css";

// The Chat tab of My Class: the class's own room, and private rooms with one classmate at a time.
// The open room is in the address (?tab=chat&room=class or room=dm-<id>), so Back closes it on a
// phone. Messages arrive by asking the server again every few seconds while the page is in front.
// The conversation styles are the ones "Message Developers" uses (messages.css, dm-); what a class
// chat adds is in classroom.css (cr-).
const ROOM_POLL_MS = 6000;
const LIST_POLL_MS = 20000;

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const timeOf = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
function dayLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return "Today";
  if (sameDay(d, new Date(now.getTime() - 86400000))) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// A question someone shared: enough to recognise it, and a way into the player.
function QuestionCard({ q, room }) {
  if (q.gone) return <div className="cr-qcard gone">This question is no longer in the question bank.</div>;
  return (
    <Link to={playerUrl({ source: "shared", ids: [q.id], from: classUrl("chat", { room }) })} className="cr-qcard">
      <span className="cr-qcard-tags">
        <span className={`ns-tag2 ${SECTION_KEY[q.section]}`}>{SECTION_SHORT[q.section]}</span>
        <span className={`ns-tag2 ${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
      </span>
      <b>{q.title}</b>
      <span className="cr-qcard-skill">{q.topic}</span>
      <span className="cr-qcard-go">
        Open the question <Icon name="chevronRight" size={15} />
      </span>
    </Link>
  );
}

// The "..." on a message: reply, and delete (your own) or report (someone else's).
function MessageMenu({ m, reasons, onReply, onDelete, onReport }) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [place, setPlace] = useState(null);
  const box = useRef(null);
  const pop = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !box.current?.contains(e.target) && !pop.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    const scrolled = () => setOpen(false); // the menu is placed on the screen, so it can't follow a scroll
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", scrolled, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", scrolled, true);
    };
  }, [open]);
  // The conversation scrolls and clips, and hub pages animate (which would capture a fixed box), so
  // the menu is drawn in <body> and placed on the screen itself: over the bubble's side of the
  // button, below it, or above when there is no room below (a phone's tab bar covers the bottom).
  useLayoutEffect(() => {
    if (!open || !pop.current || !box.current) return setPlace(null);
    const b = box.current.getBoundingClientRect();
    const { offsetWidth: w, offsetHeight: h } = pop.current;
    const floor = window.innerHeight - (window.innerWidth <= 900 ? 96 : 8);
    const below = b.bottom + 4;
    setPlace({ left: Math.max(8, Math.min(window.innerWidth - w - 8, m.mine ? b.left : b.right - w)), top: below + h > floor ? Math.max(8, b.top - h - 4) : below });
  }, [open, reporting, m.mine]);
  const close = () => {
    setOpen(false);
    setReporting(false);
  };
  const pick = (run) => () => {
    close();
    run();
  };
  const menu = (
    <span className="cr-msg-pop" role="menu" ref={pop} style={place ? { left: place.left, top: place.top } : { visibility: "hidden" }}>
      {!reporting ? (
        <>
          <button type="button" role="menuitem" onClick={pick(() => onReply(m))}>
            <Icon name="undo" size={15} /> Reply
          </button>
          {m.mine ? (
            <button type="button" role="menuitem" className="danger" onClick={pick(() => onDelete(m))}>
              <Icon name="trash" size={15} /> Delete
            </button>
          ) : (
            <button type="button" role="menuitem" onClick={() => setReporting(true)}>
              <Icon name="flag" size={15} /> Report to teachers
            </button>
          )}
        </>
      ) : (
        <>
          <span className="cr-msg-pop-title">What's wrong with it?</span>
          {reasons.map((r) => (
            <button key={r.id} type="button" role="menuitem" onClick={pick(() => onReport(m, r.id))}>
              {r.label}
            </button>
          ))}
        </>
      )}
    </span>
  );
  return (
    <span className="cr-msg-menu" ref={box}>
      <button
        type="button"
        className="cr-msg-more"
        aria-label="Message options"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setReporting(false);
        }}
      >
        <Icon name="more" size={16} />
      </button>
      {open && createPortal(menu, document.body)}
    </span>
  );
}

function Thread({ room, thread, meta, onSend, onDelete, onReport, onEarlier, loadingEarlier }) {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const log = useRef(null);
  const box = useRef(null);
  const atBottom = useRef(true);
  const messages = thread.messages;
  const lastId = messages.at(-1)?.id;
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const isClass = thread.kind === "class";

  // Keep the newest message in view, unless the reader has scrolled up to read older ones.
  useLayoutEffect(() => {
    const el = log.current;
    if (el && (atBottom.current || messages.at(-1)?.mine)) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

  async function submit(e) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (await onSend(body, replyTo?.id)) {
        setDraft("");
        setReplyTo(null);
      }
    } finally {
      setSending(false);
      box.current?.focus();
    }
  }

  const left = meta.max - draft.length;

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
        {thread.more && (
          <button type="button" className="cr-earlier" disabled={loadingEarlier} onClick={onEarlier}>
            {loadingEarlier ? "Loading…" : "Show earlier messages"}
          </button>
        )}
        {messages.length === 0 && (
          <div className="dm-empty">
            <span className="dm-empty-icon">
              <Icon name="chat" size={30} />
            </span>
            <h2>{isClass ? "Start the conversation" : `Say hello to ${thread.with?.name.split(" ")[0] || "your classmate"}`}</h2>
            <p>{isClass ? "Ask about a hard question, plan a study session or cheer someone on. Everyone in your class can read this room, and so can your teachers." : "Only the two of you can read this."}</p>
          </div>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
          const lead = newDay || prev.from.id !== m.from.id || prev.mine !== m.mine;
          return (
            <React.Fragment key={m.id}>
              {newDay && <p className="dm-day">{dayLabel(m.createdAt)}</p>}
              <div className={`dm-msg cr-msg ${m.mine ? "mine" : ""} ${lead ? "lead" : ""}`}>
                {!m.mine && lead && (
                  <span className="dm-who cr-who">
                    {isClass && <Avatar avatar={m.from.avatar} name={m.from.name} size={22} />} {m.from.name}
                  </span>
                )}
                {m.deleted ? (
                  <div className="dm-bubble cr-removed">Message removed</div>
                ) : (
                  <div className="cr-msg-row">
                    <div className="dm-bubble">
                      {m.replyTo && (
                        <span className="cr-quote">
                          <b>{m.replyTo.name}</b>
                          {m.replyTo.preview}
                        </span>
                      )}
                      {m.question && <QuestionCard q={m.question} room={room} />}
                      {m.body}
                    </div>
                    <MessageMenu m={m} reasons={meta.reportReasons} onReply={setReplyTo} onDelete={onDelete} onReport={onReport} />
                  </div>
                )}
                <span className="dm-meta">{timeOf(m.createdAt)}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {!meta.canSend ? (
        <p className="dm-blocked" role="status">
          <Icon name="info" size={18} /> {meta.blocked?.message}
        </p>
      ) : (
        <form className="dm-compose" onSubmit={submit}>
          {replyTo && (
            <div className="cr-replying">
              <span>
                Replying to <b>{replyTo.mine ? "yourself" : replyTo.from.name}</b>: {(replyTo.body || replyTo.question?.title || "").slice(0, 80)}
              </span>
              <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel the reply">
                <Icon name="close" size={15} />
              </button>
            </div>
          )}
          <div className="dm-box">
            <textarea
              ref={box}
              rows={1}
              maxLength={meta.max}
              value={draft}
              placeholder={isClass ? "Write to your class…" : `Write to ${thread.with?.name.split(" ")[0] || "your classmate"}…`}
              aria-label="Write a message"
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
            {isClass ? "Your teachers can read this room. " : "Private between you two, unless one of you reports a message. "}
            {touch ? "" : "Enter sends, Shift + Enter makes a new line."}
            {left <= meta.max * 0.1 && <b> {left.toLocaleString("en-US")} characters left.</b>}
          </p>
        </form>
      )}
    </div>
  );
}

export default function ClassChat({ classroom, onRead }) {
  const { token } = useStudentAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const openKey = params.get("room");
  // A wide screen always shows a room: the class's own, until another is chosen.
  const shownKey = openKey || "class";
  const [meta, setMeta] = useState(null);
  const [failed, setFailed] = useState(false);
  const [thread, setThread] = useState(null);
  const [picking, setPicking] = useState(false);
  const [find, setFind] = useState("");
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const current = useRef(shownKey);
  const seen = useRef(""); // "<room>:<id>" of the newest message from someone else that was marked read
  const openRoom = (key) => setParams({ tab: "chat", room: key });

  const loadRooms = useCallback(async () => {
    try {
      setMeta(await getClassRooms(token));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [token]);

  const loadThread = useCallback(async () => {
    const key = shownKey;
    try {
      const t = await getClassRoom(token, key);
      if (current.current !== key) return; // another room was opened meanwhile
      // The server sends the newest page. Older messages already on screen stay (earlier pages the
      // student asked for, and ones the newest page has since moved past), and so does a message
      // sent a moment ago that this reply was too early to include.
      setThread((prev) => {
        const fresh = new Set(t.messages.map((m) => m.id));
        const from = t.messages[0]?.createdAt ?? "";
        const to = t.messages.at(-1)?.createdAt ?? "";
        const mine = prev?.messages || [];
        const older = from ? mine.filter((m) => !fresh.has(m.id) && m.createdAt < from) : [];
        const justSent = mine.filter((m) => !fresh.has(m.id) && m.mine && m.createdAt > to);
        return { ...t, messages: [...older, ...t.messages, ...justSent], more: older.length ? prev.more : t.more };
      });
      // On screen is read. A phone shows the list first, so there only an opened room counts.
      // The server is told once per new message from someone else, not on every look.
      const showing = !document.hidden && (openKey || window.matchMedia?.("(min-width: 901px)").matches);
      const newest = t.messages.findLast((m) => !m.mine)?.id;
      if (showing && newest && seen.current !== `${key}:${newest}`) {
        seen.current = `${key}:${newest}`;
        await markClassRoomRead(token, key);
        loadRooms();
        onRead?.();
      }
    } catch (e) {
      if (e.status === 404 && current.current === key) {
        toast.error("That chat isn't open to you any more");
        setParams({ tab: "chat" }, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, shownKey, openKey, loadRooms]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);
  useEffect(() => {
    current.current = shownKey;
    setThread(null);
    setPicking(false);
  }, [shownKey]);
  useEffect(() => {
    loadThread();
  }, [loadThread]);
  useEffect(() => {
    const room = setInterval(() => !document.hidden && loadThread(), ROOM_POLL_MS);
    const list = setInterval(() => !document.hidden && loadRooms(), LIST_POLL_MS);
    const seen = () => !document.hidden && loadThread();
    document.addEventListener("visibilitychange", seen);
    return () => {
      clearInterval(room);
      clearInterval(list);
      document.removeEventListener("visibilitychange", seen);
    };
  }, [loadThread, loadRooms]);

  async function send(body, replyTo) {
    try {
      const { message } = await sendClassMessage(token, shownKey, body, replyTo ? { replyTo } : {});
      setThread((t) => (t ? { ...t, messages: [...t.messages, message] } : t));
      loadRooms();
      return true;
    } catch (e) {
      toast.error(e.message);
      if (e.status === 429 || e.status === 403) loadRooms(); // the next list says why the box is closed
      return false;
    }
  }

  async function remove(m) {
    if (!(await askConfirm({ title: "Delete this message?", message: "Everyone in the chat will see that a message was removed.", confirmLabel: "Delete" }))) return;
    try {
      await deleteClassMessage(token, m.id);
      setThread((t) => (t ? { ...t, messages: t.messages.map((x) => (x.id === m.id ? { ...x, deleted: true, body: "", question: null, replyTo: null } : x)) } : t));
      loadRooms();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function report(m, reason) {
    try {
      await reportClassMessage(token, m.id, reason);
      toast.success("Reported. Your teachers will take a look.");
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function showEarlier() {
    if (!thread?.messages.length) return;
    setLoadingEarlier(true);
    try {
      const page = await getClassRoom(token, shownKey, thread.messages[0].createdAt);
      if (current.current !== shownKey) return;
      setThread((t) => (t ? { ...t, messages: [...page.messages, ...t.messages], more: page.more } : t));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingEarlier(false);
    }
  }

  if (!meta) return failed ? <LoadFailed title="Couldn't load your chats" onRetry={loadRooms} /> : <Loading />;

  const rooms = meta.rooms;
  const withRoom = new Set(rooms.filter((r) => r.kind === "dm").map((r) => r.key));
  const people = meta.classmates.filter((c) => c.name.toLowerCase().includes(find.trim().toLowerCase()));
  const title = thread?.kind === "dm" ? thread.with?.name : `${classroom.name} chat`;

  return (
    <div className={`cr-chat ${openKey ? "open" : ""}`}>
      <div className="dm-list">
        <div className="dm-list-head">
          <h3>
            <Icon name="chat" size={18} /> Chats
          </h3>
          <button type="button" className="ns-btn ns-btn-soft ns-btn-sm" onClick={() => setPicking((p) => !p)} aria-expanded={picking} disabled={meta.classmates.length === 0}>
            <Icon name={picking ? "close" : "plus"} size={15} /> {picking ? "Close" : "New message"}
          </button>
        </div>
        {picking ? (
          <div className="dm-list-rows">
            <input className="cr-find" type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a classmate…" aria-label="Find a classmate" autoFocus />
            {people.length === 0 && <p className="cr-quiet">Nobody by that name in your class.</p>}
            {people.map((c) => (
              <button key={c.id} type="button" className="dm-conv" onClick={() => openRoom(`dm-${c.id}`)}>
                <Avatar avatar={c.avatar} name={c.name} size={38} />
                <span className="dm-conv-main">
                  <b>{c.name}</b>
                  <span>{withRoom.has(`dm-${c.id}`) ? "Open your chat" : "Start a private chat"}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="dm-list-rows">
            {rooms.map((r) => (
              <button key={r.key} type="button" className={`dm-conv ${r.key === shownKey ? "on" : ""} ${r.unread ? "unread" : ""}`} onClick={() => openRoom(r.key)}>
                {r.kind === "class" ? (
                  <span className="cr-room-badge" aria-hidden="true">
                    {classroom.mark}
                  </span>
                ) : (
                  <Avatar avatar={r.avatar} name={r.name} size={38} />
                )}
                <span className="dm-conv-main">
                  <b>{r.name}</b>
                  <span>{r.last ? `${r.last.mine ? "You" : r.last.name}: ${r.last.preview}` : r.kind === "class" ? `${plural(r.students, "student")} · nothing written yet` : ""}</span>
                </span>
                <span className="dm-conv-side">
                  {r.last && <small>{ago(r.last.at)}</small>}
                  {r.unread > 0 && (
                    <i className="dm-count" aria-label={`${r.unread} new`}>
                      {r.unread > 99 ? "99+" : r.unread}
                    </i>
                  )}
                </span>
              </button>
            ))}
            {rooms.length === 1 && meta.classmates.length > 0 && <p className="cr-quiet">Press "New message" to write to one classmate privately.</p>}
          </div>
        )}
      </div>

      <div className="dm-pane">
        <div className="dm-pane-head">
          <button type="button" className="ns-btn ns-btn-soft ns-btn-sm dm-back" onClick={() => setParams({ tab: "chat" })} aria-label="Back to all chats">
            <Icon name="chevronLeft" size={18} />
          </button>
          {thread?.kind === "dm" ? (
            <Avatar avatar={thread.with?.avatar} name={thread.with?.name || "Classmate"} size={42} />
          ) : (
            <span className="cr-room-badge big" aria-hidden="true">
              {classroom.mark}
            </span>
          )}
          <div className="dm-pane-who cr-pane-who">
            <b>{title || " "}</b>
            <span>{thread?.kind === "dm" ? "Private chat" : "Everyone in your class, and your teachers, can read this room"}</span>
          </div>
          {thread?.kind === "dm" && thread.with && (
            <Link to={classUrl("classmates", { with: thread.with.id })} className="ns-btn ns-btn-outline ns-btn-sm cr-pane-link">
              Compare
            </Link>
          )}
        </div>
        {!thread ? <Loading /> : <Thread key={shownKey} room={shownKey} thread={thread} meta={meta} onSend={send} onDelete={remove} onReport={report} onEarlier={showEarlier} loadingEarlier={loadingEarlier} />}
      </div>
    </div>
  );
}
