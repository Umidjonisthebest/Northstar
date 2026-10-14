import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { tutorStream } from "../api.js";
import Icon from "./Icon.jsx";
import Nova from "./Nova.jsx";
import { novaMood } from "./nova/moods.js";
import { mathParts } from "./MathText.jsx";

// Chat with Nova. Used in the practice player's side panel (with a question)
// and on the Ask Nova page (without one). The conversation lives in the
// parent (`conversation` / `onChange`) so it survives tab switches.
//
// conversation: { messages: [{ role: "user"|"assistant", content, error? }], tutor: {}, suggestions: [] }
//
// On the Ask Nova page a message costs a comet chunk (the server charges it). The page passes
// `note` (a line above the box saying so), `blocked` when the student has none left, and `onSent`
// to refresh the count. The player passes none of them: Nova beside a question is free.

export const EMPTY_CONVERSATION = { messages: [], tutor: {}, suggestions: [] };

// Paragraphs, numbered and bulleted lists, **bold** and ^{sup}; no innerHTML.
export function RichText({ text }) {
  const blocks = [];
  const lines = String(text || "").split("\n");
  let list = null;
  const flush = () => {
    if (list) blocks.push(list);
    list = null;
  };
  lines.forEach((line, i) => {
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const ul = line.match(/^\s*[-•]\s+(.*)$/);
    if (ol || ul) {
      const type = ol ? "ol" : "ul";
      if (!list || list.type !== type) {
        flush();
        list = { type, items: [] };
      }
      list.items.push((ol || ul)[1]);
      return;
    }
    flush();
    if (line.trim()) blocks.push({ type: "p", text: line, key: i });
  });
  flush();
  return blocks.map((b, i) =>
    b.type === "p" ? (
      <p key={i}>{mathParts(b.text)}</p>
    ) : b.type === "ol" ? (
      <ol key={i}>{b.items.map((t, j) => <li key={j}>{mathParts(t)}</li>)}</ol>
    ) : (
      <ul key={i}>{b.items.map((t, j) => <li key={j}>{mathParts(t)}</li>)}</ul>
    )
  );
}

const NovaChat = forwardRef(function NovaChat(
  { token, questionId = null, getState, exam = "sat", conversation, onChange, onHighlight, onAction, starters = [], variant = "panel", intro, onNew, headerExtra, autoSend, onAutoSent, onSource, note = null, blocked = false, onSent },
  ref
) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState(null);
  const abortRef = useRef(null);
  const logRef = useRef(null);
  const convRef = useRef(conversation);
  convRef.current = conversation;

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation.messages.length, streamingText]);

  async function send(text, intent = null) {
    const content = String(text || "").trim();
    if (!content || busy || blocked) return;
    const base = convRef.current;
    const messages = [...base.messages.filter((m) => !m.error), { role: "user", content }];
    onChange({ ...base, messages, suggestions: [] });
    setInput("");
    setBusy(true);
    setStreamingText("");
    const controller = new AbortController();
    abortRef.current = controller;
    let reply = "";
    let finished = false;
    try {
      await tutorStream(
        token,
        {
          questionId,
          exam,
          intent,
          tutor: base.tutor,
          state: getState?.() || {},
          messages: messages.map(({ role, content: c }) => ({ role, content: c }))
        },
        {
          signal: controller.signal,
          onMeta: (d) => onSource?.(d.source),
          onDelta: (d) => {
            reply += d.text;
            setStreamingText(reply);
          },
          onDone: (d) => {
            finished = true;
            onChange({ messages: [...messages, { role: "assistant", content: reply.trim(), action: d.action || null }], tutor: d.tutor || {}, suggestions: d.suggestions || [] });
            if (d.highlight) onHighlight?.(d.highlight);
          },
          onError: (d) => {
            finished = true;
            onChange({ ...base, messages: [...messages, ...(reply ? [{ role: "assistant", content: reply.trim() }] : []), { role: "assistant", content: d.message, error: true }], suggestions: [] });
          }
        }
      );
      if (!finished && reply) onChange({ ...base, messages: [...messages, { role: "assistant", content: reply.trim() }], suggestions: [] });
    } catch (err) {
      if (controller.signal.aborted) return;
      onChange({ ...base, messages: [...messages, { role: "assistant", content: err.message || "Nova couldn't answer right now.", error: true }], suggestions: [] });
    } finally {
      setBusy(false);
      setStreamingText(null);
      onSent?.();
    }
  }

  useImperativeHandle(ref, () => ({ send }));

  // A message queued by the parent (e.g. "Why is B wrong?" from the player).
  useEffect(() => {
    if (!autoSend || busy) return;
    onAutoSent?.();
    send(autoSend.text, autoSend.intent || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend]);

  const { messages, suggestions } = conversation;
  const empty = messages.length === 0 && streamingText == null;

  return (
    <div className={`nv-chat nv-${variant}`}>
      <div className="nv-head">
        <span className="nv-head-title">
          <Icon name="history" size={16} /> {messages.length ? `${messages.filter((m) => m.role === "user").length} message${messages.filter((m) => m.role === "user").length === 1 ? "" : "s"}` : "New chat"}
        </span>
        {headerExtra}
        <button
          type="button"
          className="nv-new"
          onClick={() => {
            abortRef.current?.abort();
            if (onNew) onNew();
            else onChange(EMPTY_CONVERSATION);
          }}
          disabled={empty && !busy}
        >
          <Icon name="plus" size={14} /> New
        </button>
      </div>

      <div className="nv-log" ref={logRef} aria-live="polite">
        {empty ? (
          <div className="nv-empty">
            <Nova size={variant === "page" ? 104 : 84} float />
            <h3>How can I help?</h3>
            {intro && <p className="nv-intro">{intro}</p>}
            <div className="nv-starters">
              {starters.map((s) => (
                <button key={s.label} type="button" className="nv-starter" disabled={blocked} onClick={() => send(s.label, s.intent)}>
                  {s.label} <Icon name="chevronRight" size={14} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={`nv-msg ${m.role === "user" ? "me" : "nova"} ${m.error ? "err" : ""}`}>
                {m.role !== "user" && (
                  <span className="nv-avatar">
                    <Nova size={30} sparkles={false} mood={novaMood(m.error ? "wrong" : "idle")} />
                  </span>
                )}
                <div className="nv-bubble">
                  {m.role === "user" ? <p>{m.content}</p> : <RichText text={m.content} />}
                  {m.action?.type === "practice" && onAction && (
                    <button type="button" className="nv-action" onClick={() => onAction(m.action)}>
                      <Icon name="target" size={15} /> Practice {m.action.skill}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {streamingText != null && (
              <div className="nv-msg nova">
                <span className="nv-avatar">
                  <Nova size={30} sparkles={false} mood={novaMood("typing")} />
                </span>
                <div className="nv-bubble">
                  {streamingText ? (
                    <RichText text={streamingText} />
                  ) : (
                    <span className="nv-typing" aria-label="Nova is thinking">
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                </div>
              </div>
            )}
            {!busy && suggestions?.length > 0 && (
              <div className="nv-quick">
                {suggestions.map((s) => (
                  <button key={s} type="button" disabled={blocked} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {note}
      <form
        className="nv-compose"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          rows={1}
          value={input}
          placeholder={blocked ? "You're out of comet chunks" : questionId ? "Ask about this question…" : "Ask a question…"}
          disabled={blocked}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          aria-label="Message Nova"
        />
        <button type="submit" className="nv-send" disabled={busy || blocked || !input.trim()} aria-label="Send">
          <Icon name="send" size={18} />
        </button>
      </form>
    </div>
  );
});

export default NovaChat;
