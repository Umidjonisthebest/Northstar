import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { clearExamMistake, getExamMistakes, getReview, practiceMeta, practiceQuestions, setExamMistakeReason } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import QuestionFigure from "../../components/QuestionFigure.jsx";
import ReasonPicker from "../../components/ReasonPicker.jsx";
import MathText, { mathParts } from "../../components/MathText.jsx";
import { Loading } from "./Home.jsx";
import TrapProfile from "./TrapProfile.jsx";
import { SECTION_SHORT, fmtDay, inDays, playerUrl } from "./hubUtils.js";
import "../../review.css";

const LETTERS = "ABCDEF";
const TABS = ["review", "saved", "flagged", "exam", "traps"];
// How each list opens in the practice player.
const PLAYER = { review: { source: "review" }, saved: { source: "saved", order: "recent" }, flagged: { source: "flagged" } };
const dayDiff = (a, b) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);

// When a question next comes up for review, for its row.
function ReviewWhen({ review, today }) {
  if (!review) return null;
  const days = dayDiff(review.due, today);
  if (days > 0) return <span className="rv-when">Review {inDays(days)}</span>;
  return <span className="rv-when due">{days === 0 ? "Due today" : `Due ${-days} day${days === -1 ? "" : "s"} ago`}</span>;
}

function QuestionList({ questions, tab, reasons, today }) {
  const short = (id) => reasons.find((r) => r.id === id)?.short;
  return (
    <div className="ns-qlist2">
      {questions.map((q, i) => (
        <Link key={q.id} to={playerUrl({ ...PLAYER[tab], start: q.id, from: `/mistakes?tab=${tab}` })} className="ns-qrow2">
          <span className={`ns-qnum ${q.difficulty.toLowerCase()}`}>{i + 1}</span>
          <span className="ns-qrow2-main">
            <b>{q.title}</b>
            <span>
              {SECTION_SHORT[q.section]} · {q.topic}
            </span>
            {short(q.reason) && (
              <span className="rv-rowtags">
                <span className="rv-reason">{short(q.reason)}</span>
              </span>
            )}
          </span>
          {tab !== "flagged" && q.review ? (
            <ReviewWhen review={q.review} today={today} />
          ) : (
            <span className="ns-qrow2-when">{q.lastAt ? `Last tried ${new Date(q.lastAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "Not tried yet"}</span>
          )}
          <Icon name="chevronRight" size={18} />
        </Link>
      ))}
    </div>
  );
}

// What is due this week, and how far along the questions on the schedule are.
function Schedule({ review }) {
  const steps = ["1 day", "3 days", "7 days", "14 days"];
  return (
    <div className="rv-sched">
      <div>
        <h3>Coming back this week</h3>
        <p>A question you miss comes back the next day. Each time you still get it right, the next review is further away.</p>
        <div className="rv-week">
          {review.week.map((d, i) => (
            <div key={d.date} className={`rv-day ${i === 0 ? "today" : ""} ${d.count ? "" : "none"}`}>
              <span>{i === 0 ? "Today" : fmtDay(d.date, { weekday: "short" })}</span>
              <b>{d.count}</b>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3>Four reviews to learn it</h3>
        <p>How many of your questions are waiting at each gap.</p>
        <div className="rv-steps">
          {review.boxes.map((b) => (
            <div key={b.box} className="rv-step">
              <small>after {steps[b.box] || `${b.gap} days`}</small>
              <b>{b.count}</b>
            </div>
          ))}
        </div>
        <p className="rv-learned">
          <b>{review.graduated}</b> learned so far (right on all four reviews).
        </p>
      </div>
    </div>
  );
}

function ExamMistake({ m, onCleared, onTagged, token, reasons }) {
  const { celebrate } = useProgress();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const tag = async (reason) => {
    const was = m.reason;
    onTagged(m.key, reason);
    try {
      const r = await setExamMistakeReason(token, m.key, reason);
      onTagged(m.key, r.reason);
    } catch (e) {
      onTagged(m.key, was);
      toast.error(e.message);
    }
  };
  return (
    <div className="ns-exam-mistake">
      <span className="ns-tag2 math">
        {m.testTitle} · {m.moduleName}
      </span>
      {m.passage && <p className="ns-muted2">{m.passage}</p>}
      <QuestionFigure src={m.passageImage} alt="Figure for the passage" />
      <p>
        <b>{mathParts(m.prompt)}</b>
      </p>
      <QuestionFigure src={m.promptImage} alt="Figure for the question" />
      {m.type === "mcq" ? (
        <div className="ns-exam-opts">
          {(m.options || []).map((opt, i) => (
            <div key={i} className={`ns-exam-opt ${i === m.correctIndex ? "right" : i === m.givenAnswer ? "wrong" : ""}`}>
              <span>{LETTERS[i]}</span>
              <MathText text={opt} />
              {i === m.givenAnswer && i !== m.correctIndex && <small style={{ marginLeft: "auto" }}>your answer</small>}
            </div>
          ))}
        </div>
      ) : (
        <p>
          Your answer: <b>{m.givenAnswer ?? "(blank)"}</b> · Correct answer: <b>{m.correctAnswer}</b>
        </p>
      )}
      <ReasonPicker reasons={reasons} value={m.reason} onPick={tag} />
      <button
        className="ns-btn ns-btn-soft ns-btn-sm"
        style={{ marginTop: 14 }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await clearExamMistake(token, m.key);
            celebrate(r.reward);
            onCleared(m.key);
          } catch (e) {
            toast.error(e.message);
            setBusy(false);
          }
        }}
      >
        <Icon name="check" size={15} /> {busy ? "Clearing…" : "Mark reviewed"}
      </button>
    </div>
  );
}

const EMPTY = {
  review: ["Nothing is due for review today", "A question you miss comes back here the next day, then after 3, 7 and 14 days."],
  saved: ["Your mistakes queue is clear", "Missed questions will show up here."],
  flagged: ["Nothing marked for review", "Use “Mark for Review” in the practice player to save questions for later."],
  exam: ["No mock exam mistakes", "Wrong answers from submitted mock exam modules appear here."]
};

export default function Mistakes() {
  const { token } = useStudentAuth();
  const { progress } = useProgress();
  const [params, setParams] = useSearchParams();
  const [due, setDue] = useState(null);
  const [review, setReview] = useState(null);
  const [saved, setSaved] = useState(null);
  const [flagged, setFlagged] = useState(null);
  const [exam, setExam] = useState(null);
  const [reasons, setReasons] = useState([]);
  // A list that failed to load shows as empty, so the page says so instead of claiming "all clear".
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const failed = (set, empty = []) => (e) => {
      set(empty);
      setLoadError(e.message || "Couldn't load some of your lists");
    };
    practiceQuestions(token, { source: "review" })
      .then((d) => setDue(d.questions))
      .catch(failed(setDue));
    getReview(token)
      .then(setReview)
      .catch(failed(setReview, { due: 0, scheduled: 0, graduated: 0, next: null, week: [], boxes: [] }));
    practiceQuestions(token, { source: "saved", order: "recent" })
      .then((d) => setSaved(d.questions))
      .catch(failed(setSaved));
    practiceQuestions(token, { source: "flagged" })
      .then((d) => setFlagged(d.questions))
      .catch(failed(setFlagged));
    getExamMistakes(token)
      .then((d) => setExam(d.mistakes))
      .catch(failed(setExam));
    // The reason labels. Without them the page still works; the chips just aren't shown.
    practiceMeta(token)
      .then((m) => setReasons(m.mistakeReasons || []))
      .catch(() => {});
  }, [token]);

  if (!due || !review || !saved || !flagged || !exam) return <Loading />;

  // The tab is in the address (?tab=traps), so the page can be linked to and the back button works.
  // Without one it opens on the review when something is due, otherwise on the queue.
  const asked = params.get("tab");
  const tab = TABS.includes(asked) ? asked : due.length ? "review" : "saved";
  const setTab = (key) => setParams({ tab: key }, { replace: true });
  const today = review.week[0]?.date || new Date().toISOString().slice(0, 10);
  const lists = { review: due, saved, flagged, exam };
  const tabs = [
    ["review", "Spaced review", due.length],
    ["saved", "Mistakes queue", saved.length],
    ["flagged", "Marked for review", flagged.length],
    ["exam", "From mock exams", exam.length],
    ["traps", "Trap profile", null]
  ];
  const current = lists[tab] || [];
  const xp = progress?.xpRules || {};

  return (
    <div className="ns-page" style={{ gap: 26, paddingTop: 12 }}>
      <div className="ns-section-head" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <h1 className="ns-h1">
            <Icon name="bookmark" size={32} /> Saved & Mistakes
          </h1>
          <p className="ns-lead">
            {tab === "review"
              ? `Questions you missed come back on a schedule, so the fix lasts. Getting one right on its review day earns +${xp.spacedReview ?? 3} XP.`
              : tab === "traps"
                ? "What trips you up, from the reasons you give for your misses and from your answers."
                : `Questions to revisit land in your mistakes queue automatically. Answer one correctly later to clear it (+${xp.mistakeCleared ?? 5} XP the first time you clear it).`}
          </p>
        </div>
        {PLAYER[tab] && current.length > 0 && (
          <Link to={playerUrl({ ...PLAYER[tab], from: `/mistakes?tab=${tab}` })} className="ns-btn ns-btn-primary">
            <Icon name="play2" size={15} /> {tab === "review" ? `Start review (${current.length})` : `Review all ${current.length}`}
          </Link>
        )}
      </div>

      {loadError && (
        <p className="ns-empty2" role="alert" style={{ padding: 12 }}>
          Some of your lists didn't load ({loadError}), so they may look empty.{" "}
          <button className="ns-btn ns-btn-outline ns-btn-sm" onClick={() => window.location.reload()}>
            Try again
          </button>
        </p>
      )}

      <div className="ns-tabs2" role="tablist">
        {tabs.map(([key, label, n]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "on" : ""}
            onClick={() => setTab(key)}
            // On a phone the strip scrolls sideways: bring the open tab into view (a link can open any of them).
            ref={tab === key ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined}
          >
            {label} {n !== null && <span>{n}</span>}
          </button>
        ))}
      </div>

      {tab === "traps" ? (
        <TrapProfile />
      ) : (
        <>
          {tab === "review" && review.scheduled > 0 && <Schedule review={review} />}
          {current.length === 0 ? (
            <div className="ns-empty2" style={{ padding: 40 }}>
              <Nova size={80} mood="cheer" float />
              <b style={{ marginTop: 12 }}>{EMPTY[tab][0]}</b>
              {tab === "review" && review.next
                ? `The next ${review.next.count === 1 ? "question comes" : `${review.next.count} questions come`} back ${inDays(review.next.days)}.`
                : EMPTY[tab][1]}
            </div>
          ) : tab === "exam" ? (
            <div className="ns-card2">
              {exam.map((m) => (
                <ExamMistake
                  key={m.key}
                  m={m}
                  token={token}
                  reasons={reasons}
                  onCleared={(key) => setExam((list) => list.filter((x) => x.key !== key))}
                  onTagged={(key, reason) => setExam((list) => list.map((x) => (x.key === key ? { ...x, reason } : x)))}
                />
              ))}
            </div>
          ) : (
            <QuestionList questions={current} tab={tab} reasons={reasons} today={today} />
          )}
        </>
      )}
    </div>
  );
}
