import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import Icon from "../../components/Icon.jsx";
import { chunkWord } from "../../components/avatar/shopParts.js";
import Nova from "../../components/Nova.jsx";
import NovaChat, { EMPTY_CONVERSATION } from "../../components/NovaChat.jsx";
import { playerUrl } from "./hubUtils.js";

// Ask Nova: open-ended chat with the study buddy (strategy, planning,
// concepts). The practice player has the same chat, tied to a question.

const STARTERS = {
  sat: [
    { label: "What should I study next?" },
    { label: "How do I pace each module?" },
    { label: "How do I spot a comma splice?" },
    { label: "Give me a strategy for percent problems" }
  ],
  ielts: [
    { label: "How do I improve Writing Task 2?" },
    { label: "Reading: True / False / Not Given tips" },
    { label: "How should I prepare for Speaking Part 2?" },
    { label: "Listening: how do I pick up more marks?" }
  ]
};

const storageKey = (exam) => `ns_nova_chat_${exam}`;

function load(exam) {
  try {
    const raw = sessionStorage.getItem(storageKey(exam));
    return raw ? JSON.parse(raw) : EMPTY_CONVERSATION;
  } catch {
    return EMPTY_CONVERSATION;
  }
}

export default function Coach() {
  const { exam = "sat" } = useOutletContext() || {};
  // Each exam keeps its own conversation; remounting on a switch loads it.
  return <NovaPage key={exam} exam={exam} />;
}

function NovaPage({ exam }) {
  const { token, user } = useStudentAuth();
  // A message here costs comet chunks (the server takes them; this only shows it).
  const { progress, refresh } = useProgress();
  const chunks = progress?.chunks;
  const cost = chunks?.novaCost ?? 1;
  const out = chunks ? chunks.balance < cost : false;
  const nav = useNavigate();
  const loc = useLocation();
  const [conv, setConv] = useState(() => load(exam));
  const [source, setSource] = useState(null);
  // A question handed over from another page (e.g. the IELTS home's starters).
  const [autoSend, setAutoSend] = useState(() => (loc.state?.ask ? { text: loc.state.ask } : null));

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(exam), JSON.stringify(conv));
    } catch {
      /* private mode */
    }
  }, [exam, conv]);

  return (
    <div className="ns-page ns-nova-page">
      <div className="ns-nova-hero">
        <Nova size={54} float />
        <div>
          <h1>Ask Nova</h1>
          <p>{exam === "ielts" ? "Your IELTS study buddy: strategies for every part of the test." : "Your SAT study buddy: strategies, concepts, and what to work on next."}</p>
        </div>
        {source && <span className="ns-ai-chip">{source === "ai" ? "AI tutor" : "Built-in tutor"}</span>}
      </div>
      <NovaChat
        token={token}
        variant="page"
        exam={exam}
        conversation={conv}
        onChange={setConv}
        onSource={setSource}
        autoSend={autoSend}
        onAutoSent={() => {
          setAutoSend(null);
          nav(loc.pathname, { replace: true, state: null });
        }}
        starters={STARTERS[exam]}
        intro={`Hi ${user?.firstName || "there"}! Ask me about any skill, a question type that trips you up, pacing, or your study plan.`}
        onAction={(a) => nav(playerUrl({ source: "drill", skills: [a.skill], size: 10, from: "/nova" }))}
        blocked={out}
        onSent={refresh}
        note={
          chunks && (
            <p className={`nv-cost ${out ? "out" : ""}`}>
              <Icon name="comet" size={16} />
              {out ? (
                <span>
                  <b>You're out of comet chunks.</b> You earn more by studying: the first thing you do each day, your daily goal, the daily star, new levels and trophies. Nova's hints inside a question
                  are always free.
                </span>
              ) : (
                <span>
                  Each message here costs {cost} {chunkWord(cost)}. You have <b>{chunks.balance}</b>. Hints inside a question are free.
                </span>
              )}
              <Link to="/shop">{out ? "How to earn them" : "Comet Shop"}</Link>
            </p>
          )
        }
      />
    </div>
  );
}
