import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getMessages, markMessagesRead, sendMessage } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import LoadFailed from "../../components/LoadFailed.jsx";
import MessageThread from "../../components/MessageThread.jsx";
import { Loading } from "./Home.jsx";

// Message Developers: the student's own conversation with the people who build the app. The
// developers answer from the studio (pages/admin/Messages.jsx); replies arrive here.
const POLL_MS = 20000;

export default function Messages() {
  const { token, user } = useStudentAuth();
  const { refresh } = useProgress();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const marking = useRef(false);

  const load = useCallback(async () => {
    try {
      setData(await getMessages(token));
      setFailed(false);
    } catch {
      // A failed refresh keeps what is on screen; only a first load with nothing to show says so.
      setFailed(true);
    }
  }, [token]);

  // Look for replies while the page is open and in front.
  useEffect(() => {
    load();
    const tick = () => !document.hidden && load();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  // Replies on screen have been seen: tell the server, and let the menu's badge go.
  const unread = data?.unread || 0;
  useEffect(() => {
    if (!unread || marking.current || document.hidden) return;
    marking.current = true;
    markMessagesRead(token)
      .then(() => {
        setData((d) => (d ? { ...d, unread: 0 } : d));
        refresh();
      })
      .catch(() => {
        /* still unread; tried again with the next refresh */
      })
      .finally(() => {
        marking.current = false;
      });
  }, [unread, token, refresh]);

  async function send(body, topic) {
    try {
      const { message } = await sendMessage(token, body, topic);
      setData((d) => ({ ...d, messages: [...d.messages, message] }));
      return true;
    } catch (e) {
      toast.error(e.message);
      // "Too many" or "not this account": the next load says why the box is closed.
      if (e.status === 429 || e.status === 403) load();
      return false;
    }
  }

  if (!data) return failed ? <LoadFailed title="Couldn't load your messages" onRetry={load} /> : <Loading />;

  return (
    <div className="dm-page">
      <div className="dm-hero">
        <span className="dm-hero-icon">
          <Icon name="chat" size={26} />
        </span>
        <div>
          <h1>Message the developers</h1>
          <p>Found a bug, have an idea, or can't work something out? Write to the people who build Northstar.</p>
        </div>
      </div>
      <MessageThread
        messages={data.messages}
        side="student"
        otherName="Northstar developers"
        topics={data.topics}
        pickTopic
        max={data.max}
        blocked={data.canSend ? null : data.blocked?.message}
        placeholder="Write to the developers…"
        draftKey={user?.id ? `ns_dm_draft_${user.id}` : undefined}
        onSend={send}
        empty={
          <>
            <span className="dm-empty-icon">
              <Icon name="chat" size={30} />
            </span>
            <h2>Say hello</h2>
            <p>Tell us what's broken, what you wish the app did, or what confused you. Only you and the developers can read this, and replies show up right here.</p>
            <p>
              Stuck on a practice question? <Link to="/nova">Nova answers straight away.</Link>
            </p>
          </>
        }
      />
    </div>
  );
}
