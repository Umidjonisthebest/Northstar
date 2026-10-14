import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { adminConversation, adminConversations, adminDeleteConversation, adminMarkConversationRead, adminReply } from "../../api.js";
import { useAdminAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useConfirm } from "../../components/Confirm.jsx";
import Icon from "../../components/Icon.jsx";
import MessageThread from "../../components/MessageThread.jsx";
import { Avatar, Empty, timeAgo } from "../../components/adminUi.jsx";
import { studioPath } from "../../studio/panels.js";

// The studio's inbox for "Message Developers": every student who wrote, and the conversation with
// the one that is open (kept in the address as ?student=<id>, so Back closes it on a phone).
const POLL_MS = 30000;

export default function Messages() {
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const { refreshInbox } = useOutletContext() || {};
  const [params, setParams] = useSearchParams();
  const openId = params.get("student");
  const [inbox, setInbox] = useState(null);
  const [thread, setThread] = useState(null); // { student, messages } of the open conversation

  const loadInbox = useCallback(
    () =>
      adminConversations(token)
        .then(setInbox)
        .catch(() => {
          /* keep the last list */
        }),
    [token]
  );

  const current = useRef(openId);
  useEffect(() => {
    current.current = openId;
    setThread(null);
  }, [openId]);

  const loadThread = useCallback(async () => {
    if (!openId) return;
    try {
      const t = await adminConversation(token, openId);
      if (current.current !== openId) return; // another conversation was opened meanwhile
      setThread(t);
      // Shown on screen is read: clear it here, in the list and on the menu's badge.
      if (!document.hidden && t.messages.some((m) => m.from === "student" && !m.read)) {
        await adminMarkConversationRead(token, openId);
        loadInbox();
        refreshInbox?.();
      }
    } catch (e) {
      if (e.status === 404) setParams({}, { replace: true });
    }
  }, [token, openId, loadInbox, refreshInbox, setParams]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);
  useEffect(() => {
    loadThread();
  }, [loadThread]);
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      loadInbox();
      loadThread();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [loadInbox, loadThread]);

  async function reply(body) {
    try {
      const { message } = await adminReply(token, openId, body);
      setThread((t) => (t ? { ...t, messages: [...t.messages, message] } : t));
      loadInbox();
      refreshInbox?.();
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  }

  async function remove() {
    if (!(await askConfirm({ title: `Delete the conversation with ${thread.student.name}?`, message: "Every message in it is removed, for the student as well. This can't be undone.", confirmLabel: "Delete" }))) return;
    try {
      await adminDeleteConversation(token, openId);
      setParams({}, { replace: true });
      loadInbox();
      refreshInbox?.();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const list = inbox?.conversations;

  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <span className="ad-eyebrow">Both exams</span>
          <h1>Messages</h1>
          <p>What students write from "Message Developers" in their menu. Each student has one conversation, and your replies appear in it.</p>
        </div>
      </div>

      <div className={`dm-admin ${openId ? "open" : ""}`}>
        <div className="dm-list">
          <div className="dm-list-head">
            <h3>
              <Icon name="chat" size={18} /> Conversations
            </h3>
            <span>{inbox ? (inbox.waiting ? `${inbox.waiting} waiting` : `${list.length} total`) : ""}</span>
          </div>
          <div className="dm-list-rows">
            {!inbox && (
              <div className="ns-loading" style={{ padding: "40px 0" }}>
                <div className="ns-spinner" />
              </div>
            )}
            {list?.length === 0 && <Empty icon="chat">No messages yet. When a student writes, it shows up here.</Empty>}
            {list?.map((c) => (
              <button key={c.student.id} type="button" className={`dm-conv ${c.student.id === openId ? "on" : ""} ${c.unread ? "unread" : ""}`} onClick={() => setParams({ student: c.student.id })}>
                <Avatar name={c.student.name} avatar={c.student.avatar} size={38} />
                <span className="dm-conv-main">
                  <b>{c.student.name}</b>
                  <span>
                    {c.last.from === "team" ? "Replied: " : ""}
                    {c.last.preview}
                  </span>
                </span>
                <span className="dm-conv-side">
                  <small>{timeAgo(c.last.createdAt)}</small>
                  {c.unread > 0 && (
                    <i className="dm-count" aria-label={`${c.unread} new`}>
                      {c.unread}
                    </i>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="dm-pane">
          {!openId && <div className="dm-pane-none">Choose a conversation to read it and reply.</div>}
          {openId && !thread && (
            <div className="ns-loading">
              <div className="ns-spinner" />
            </div>
          )}
          {openId && thread && (
            <>
              <div className="dm-pane-head">
                <button type="button" className="ad-icon-btn dm-back" onClick={() => setParams({})} aria-label="Back to all conversations">
                  <Icon name="arrowLeft" size={18} />
                </button>
                <Avatar name={thread.student.name} avatar={thread.student.avatar} size={42} />
                <div className="dm-pane-who">
                  <Link to={studioPath(`/students/${thread.student.id}`)}>{thread.student.name}</Link>
                  <span>{[thread.student.email, thread.student.candidateId && `ID ${thread.student.candidateId}`].filter(Boolean).join(" · ")}</span>
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={remove}>
                  <Icon name="trash" size={15} /> Delete
                </button>
              </div>
              <MessageThread
                key={thread.student.id}
                messages={thread.messages}
                side="team"
                otherName={thread.student.name}
                topics={inbox?.topics}
                max={inbox?.max}
                placeholder={`Reply to ${thread.student.name.split(" ")[0]}…`}
                onSend={reply}
                empty={<p>No messages in this conversation yet.</p>}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
