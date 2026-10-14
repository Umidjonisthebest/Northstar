import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  answerPractice,
  answerRemix,
  buildDrill,
  completeDrill,
  getClassHomework,
  homeworkLeave,
  practiceExplanation,
  practiceMeta,
  practiceQuestions,
  remixExplanation,
  remixPractice,
  reportPracticeQuestion,
  savePracticeNote,
  sendClassMessage,
  setMistakeReason,
  startRepair,
  toggleFlagPractice
} from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";
import { useProgress } from "../../context/ProgressContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Icon from "../../components/Icon.jsx";
import Nova from "../../components/Nova.jsx";
import { answerMood } from "../../components/nova/moods.js";
import MathText from "../../components/MathText.jsx";
import Figure from "../../components/Figure.jsx";
import BankPicture, { isPictureQuestion } from "./BankPicture.jsx";
import GraphingCalculator from "../../components/calculator/GraphingCalculator.jsx";
import ReasonPicker from "../../components/ReasonPicker.jsx";
import { EMPTY_CONVERSATION } from "../../components/NovaChat.jsx";
import HighlightText, { addRange, selectionOffsets } from "./HighlightText.jsx";
import SidePanel from "./SidePanel.jsx";
import { AskClassModal, DataTable, Navigator, NotesBox, Pop, ReportModal, SessionSummary } from "./PlayerParts.jsx";
import { SECTION_NAME, planFinishedLine, playerUrl, reviewLine } from "../hub/hubUtils.js";
import { usePresence } from "../hub/usePresence.js";
import { LockNotice } from "../../lock/LockScreens.jsx";
import { useExamLock } from "../../lock/useExamLock.js";
import "../../shell.css";
import "../../player.css";

const LETTERS = "ABCDEF";
const PACE = { "Reading & Writing": 71, Math: 95 };
const DEFAULT_Q = {
  selected: null,
  grid: "",
  crossed: [],
  wrong: [],
  gridWrong: 0,
  lastWrong: null,
  result: null,
  correctIndex: null,
  feedback: null,
  busy: false,
  explanation: null,
  loadingExplanation: false,
  stepsShown: 1,
  optionTab: null,
  chat: EMPTY_CONVERSATION,
  novaHl: null,
  // What the last answer did to the question's review schedule (the answer route's `review`).
  schedule: null
};
let metaCache = null;

function readLocal(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: preferences just aren't remembered */
  }
}
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function backLabel(from) {
  if (from === "/practice") return "Back to Question Bank";
  if (from.startsWith("/practice/")) return "Back to skills";
  if (from === "/dashboard") return "Back to Home";
  if (from.startsWith("/mistakes")) return "Back to Saved & Mistakes";
  if (from === "/sky") return "Back to your sky";
  if (from === "/plan") return "Back to your plan";
  if (from === "/gap") return "Back to the point-gap map";
  if (from === "/recap") return "Back to your recap";
  if (from === "/leagues") return "Back to Leagues";
  if (from.startsWith("/class")) return "Back to your class";
  if (from.startsWith("/diagnostic")) return "Back to your results";
  return "Back";
}

export default function Player() {
  const { token } = useStudentAuth();
  const { celebrate, progress } = useProgress();
  const { toast } = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  // A student in a Presidential School class can put a question in the class chat ("Ask my class").
  const classroom = progress?.classroom || null;
  const [askOpen, setAskOpen] = useState(false);
  // Practising counts as "studying now": the heartbeat keeps going here (the count shows in the hub).
  usePresence(token);

  const source = params.get("source") || "bank";
  const sec = params.get("sec") || "";
  const skillsParam = params.get("skills") || "";
  const skills = skillsParam ? skillsParam.split("|") : [];
  const from = params.get("from") || (sec ? `/practice/${sec}` : "/practice");
  const plan = params.get("plan");
  const loadKey = params.toString();

  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(metaCache);
  const [index, setIndex] = useState(0);
  const [store, setStore] = useState({});
  const [remix, setRemix] = useState(null);
  const [remixBusy, setRemixBusy] = useState(false);
  const [panel, setPanel] = useState(null);
  const [pinned, setPinned] = useState(() => readLocal("pl_pinned", true));
  const [crossMode, setCrossMode] = useState(() => readLocal("pl_cross", true));
  const [hlMode, setHlMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);
  const [pace, setPace] = useState(false);
  const [font, setFont] = useState(() => readLocal("pl_font", 1));
  const [split, setSplit] = useState(() => readLocal("pl_split", 50));
  const [navOpen, setNavOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // The Desmos calculator: offered on Math questions, and it stays open from one to the next.
  const [calcOpen, setCalcOpen] = useState(false);
  const [summary, setSummary] = useState(false);
  const [xp, setXp] = useState(0);
  // A repair drill's progress, as the server reports it after each answer.
  const [repair, setRepair] = useState(null);
  const [novaQueue, setNovaQueue] = useState(null);
  const [hl, setHl] = useState({ p: [], q: [] });
  const [, setTick] = useState(0);

  const msRef = useRef({});
  const storeRef = useRef(store);
  storeRef.current = store;
  const finished = useRef(false);
  const bodyRef = useRef(null);
  const passageRef = useRef(null);
  const promptRef = useRef(null);

  // ---- A class homework: the teacher is told when the student leaves the page ----
  // Homework isn't locked like a test (lock/useExamLock.js, mode "report"): nothing closes. The
  // student is told so before they start, every time, and the page reports each leave and how
  // long it lasted. A homework that is already finished is just practice again.
  const hwId = source === "homework" ? params.get("homework") || "" : "";
  const [hw, setHw] = useState(null); // { title, open } once the server has said
  const [hwAccepted, setHwAccepted] = useState(false);
  useEffect(() => {
    setHw(null);
    setHwAccepted(false);
    if (!hwId) return undefined;
    let alive = true;
    getClassHomework(token)
      .then((d) => {
        const mine = d.homework.find((h) => h.id === hwId);
        if (alive) setHw({ title: mine?.title || "", open: Boolean(mine) && mine.state !== "done" });
      })
      // Not in a class (403): there is no homework to warn about. Anything else: warn anyway.
      .catch((e) => alive && setHw({ title: "", open: e.status !== 403 }));
    return () => {
      alive = false;
    };
  }, [token, hwId]);
  useExamLock({
    mode: "report",
    active: Boolean(hwId && hw?.open && hwAccepted && list?.length && !summary),
    onLeave: () => homeworkLeave(token, hwId, { event: "left" }).catch(() => {}),
    onReturn: (seconds) => {
      homeworkLeave(token, hwId, { event: "back", seconds }).catch(() => {});
      toast.warning("You left the homework page. Your teacher can see that.");
    }
  });
  const hwNotice = hwId && hw?.open && !hwAccepted && (
    <LockNotice
      kind="homework"
      title="Before you start your homework"
      lead={hw.title ? `"${hw.title}" is homework from your teacher.` : "This is homework from your teacher."}
      startLabel="I understand. Start"
      onCancel={() => nav(from)}
      onStart={() => setHwAccepted(true)}
    />
  );

  useEffect(() => writeLocal("pl_pinned", pinned), [pinned]);
  useEffect(() => writeLocal("pl_cross", crossMode), [crossMode]);
  useEffect(() => writeLocal("pl_font", font), [font]);

  // ---- Load the question set ----
  useEffect(() => {
    let alive = true;
    setList(null);
    setError("");
    setStore({});
    setRemix(null);
    setSummary(false);
    setIndex(0);
    setXp(0);
    setRepair(null);
    msRef.current = {};
    finished.current = false;
    (async () => {
      try {
        if (!metaCache) metaCache = await practiceMeta(token);
        if (alive) setMeta(metaCache);
        const difficulty = params.get("difficulty") || "";
        // A repair drill is opened (or resumed) by the server, which also decides whether one is available.
        const opened = source === "repair" ? await startRepair(token) : null;
        if (opened && alive) setRepair({ state: "open", total: opened.repair.total, remaining: opened.repair.total - opened.repair.answered });
        const qs = opened
          ? opened.questions
          : source === "drill"
            ? (await buildDrill(token, { section: sec, skills, difficulty: difficulty ? difficulty.split(",") : [], size: Number(params.get("size")) || 10, ...(plan ? { plan: Number(plan) } : {}) })).questions
            : (
                await practiceQuestions(token, {
                  source,
                  limit: params.get("size") || "",
                  sec,
                  skills: skillsParam,
                  difficulty,
                  status: params.get("status") || "",
                  flagged: params.get("flagged") || "",
                  saved: params.get("saved") || "",
                  type: params.get("type") || "",
                  order: params.get("order") || "",
                  seed: params.get("seed") || "",
                  diag: params.get("diag") || "",
                  only: params.get("only") || "",
                  homework: params.get("homework") || "",
                  ids: params.get("ids") || ""
                })
              ).questions;
        if (!alive) return;
        setList(qs);
        const start = params.get("start");
        const i = start ? qs.findIndex((x) => x.id === start) : -1;
        setIndex(i >= 0 ? i : 0);
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loadKey]);

  const base = list?.[index] || null;
  const q = remix?.question || base;
  const st = q ? { ...DEFAULT_Q, ...store[q.id] } : DEFAULT_Q;
  const isLast = !remix && list && index === list.length - 1;

  const patch = useCallback((id, p) => {
    setStore((s) => {
      const cur = { ...DEFAULT_Q, ...s[id] };
      return { ...s, [id]: { ...cur, ...(typeof p === "function" ? p(cur) : p) } };
    });
  }, []);
  // Keep list items (navigator badges, flags, notes) and a remix in sync.
  const updateQ = useCallback((id, p) => {
    setList((l) => l && l.map((x) => (x.id === id ? { ...x, ...p } : x)));
    setRemix((r) => (r && r.question.id === id ? { ...r, question: { ...r.question, ...p } } : r));
  }, []);

  // ---- Per-question timer ----
  const qid = q?.id;
  useEffect(() => {
    if (!qid || paused || summary) return undefined;
    const t = setInterval(() => {
      if (document.hidden) return;
      msRef.current[qid] = (msRef.current[qid] || 0) + 1000;
      setTick((x) => x + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [qid, paused, summary]);
  const seconds = qid ? Math.floor((msRef.current[qid] || 0) / 1000) : 0;

  // ---- Highlights (saved per question in this browser) ----
  useEffect(() => {
    if (qid) setHl(readLocal(`ns_hl_${qid}`, { p: [], q: [] }));
    setNavOpen(false);
  }, [qid]);
  const saveHl = (next) => {
    setHl(next);
    writeLocal(`ns_hl_${qid}`, next);
  };
  const onTextUp = (field, ref) => () => {
    if (!hlMode) return;
    const r = selectionOffsets(ref.current);
    if (!r) return;
    window.getSelection()?.removeAllRanges();
    saveHl({ ...hl, [field]: addRange(hl[field], r) });
  };
  const onTextClick = (field) => (e) => {
    const mark = e.target.closest?.("mark");
    if (!mark) return;
    if (mark.classList.contains("pl-nova")) {
      patch(qid, { novaHl: null });
      return;
    }
    if (hlMode && window.getSelection()?.isCollapsed) {
      const s = Number(mark.dataset.s);
      const en = Number(mark.dataset.e);
      saveHl({ ...hl, [field]: hl[field].filter(([a, b]) => !(a === s && b === en)) });
    }
  };
  const onNovaHighlight = (quote) => {
    if (!q) return;
    const inP = q.passage ? q.passage.indexOf(quote) : -1;
    const inQ = inP < 0 ? q.prompt.indexOf(quote) : -1;
    if (inP >= 0) patch(q.id, { novaHl: { field: "p", range: [inP, inP + quote.length] } });
    else if (inQ >= 0) patch(q.id, { novaHl: { field: "q", range: [inQ, inQ + quote.length] } });
    else return;
    setTimeout(() => document.querySelector('.pl-nova[data-nova="start"]')?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
  };

  // ---- Answering ----
  const choose = (i) => {
    if (!q || q.type === "grid_in" || st.result === "correct" || st.wrong.includes(i) || st.busy) return;
    patch(q.id, (s) => ({ selected: s.selected === i ? null : i, crossed: s.crossed.filter((x) => x !== i), feedback: s.feedback?.kind === "bad" ? null : s.feedback }));
  };
  const toggleCross = (i) => {
    if (!q || st.result === "correct" || st.wrong.includes(i)) return;
    patch(q.id, (s) => (s.crossed.includes(i) ? { crossed: s.crossed.filter((x) => x !== i) } : { crossed: [...s.crossed, i], selected: s.selected === i ? null : s.selected }));
  };
  const check = async () => {
    if (!q || st.result === "correct" || st.busy) return;
    const isGrid = q.type === "grid_in";
    const answer = isGrid ? st.grid.trim() : st.selected;
    if (answer === null || answer === "") return;
    const retry = st.wrong.length > 0 || st.gridWrong > 0;
    patch(q.id, { busy: true });
    try {
      const r = q.remix
        ? await answerRemix(token, q.id, answer, retry)
        : await answerPractice(token, q.id, answer, source === "drill", { timeMs: msRef.current[q.id] || 0, retry });
      celebrate(r.reward);
      setXp((x) => x + (r.reward?.xpGained || 0));
      // This answer was the last one a study-plan task needed: the server has finished and paid it.
      if (r.plan) {
        celebrate(r.plan.reward);
        setXp((x) => x + (r.plan.reward?.xpGained || 0));
        toast.success(planFinishedLine(r.plan));
      }
      // This answer was the last question of a class homework: nothing to hand in, it is done.
      if (r.homework) {
        toast.success(`Homework finished: ${r.homework.finished.map((h) => h.title).join(" and ")}`);
        // Finished: leaving the page is no longer the teacher's business.
        if (r.homework.finished.some((h) => h.id === hwId)) setHw((h) => h && { ...h, open: false });
      }
      if (r.repair) {
        setRepair(r.repair);
        if (r.repair.state === "repaired") toast.success(`Star relit. Your streak is ${r.repair.streak} days.`);
      }
      if (r.correct) {
        patch(q.id, (s) => ({
          busy: false,
          result: "correct",
          correctIndex: r.correctIndex,
          schedule: r.review ?? s.schedule,
          feedback: { kind: "good", first: !s.wrong.length && !s.gridWrong, xp: r.reward?.xpGained || 0, assisted: r.assisted, cleared: r.cleared, review: r.xpKind === "review" }
        }));
      } else {
        patch(q.id, (s) => ({
          busy: false,
          selected: null,
          grid: isGrid ? s.grid : "",
          wrong: isGrid ? s.wrong : [...s.wrong, answer],
          gridWrong: s.gridWrong + (isGrid ? 1 : 0),
          lastWrong: isGrid ? s.lastWrong : answer,
          schedule: r.review ?? s.schedule,
          feedback: { kind: "bad", letter: isGrid ? null : LETTERS[answer], text: r.rationale, autoSaved: r.autoSaved }
        }));
      }
      if (!q.remix) updateQ(q.id, { result: r.result, status: r.correct ? "solved" : "missed", attempts: r.attempts, saved: r.saved, reason: r.reason ?? null, lastAt: new Date().toISOString() });
    } catch (e) {
      patch(q.id, { busy: false });
      toast.error(e.message);
    }
  };

  // ---- Explanation ----
  const loadExplanation = async (target = q) => {
    if (!target) return;
    const cur = storeRef.current[target.id];
    if (cur?.explanation || cur?.loadingExplanation) return;
    patch(target.id, { loadingExplanation: true });
    try {
      const ex = target.remix ? await remixExplanation(token, target.id) : await practiceExplanation(token, target.id);
      patch(target.id, (s) => ({ explanation: ex, loadingExplanation: false, optionTab: s.optionTab ?? ex.correctIndex }));
      if (!target.remix && storeRef.current[target.id]?.result !== "correct") updateQ(target.id, { revealed: true });
    } catch (e) {
      patch(target.id, { loadingExplanation: false });
      toast.error(e.message);
    }
  };
  useEffect(() => {
    if (panel === "explanation" && q && (st.result === "correct" || q.revealed) && !st.explanation) loadExplanation(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, qid, st.result]);

  const openPanel = (tab) => setPanel(tab);
  const togglePanel = (tab) => setPanel((p) => (p === tab ? null : tab));
  const askNova = (text, intent = null) => {
    setPanel("nova");
    setNovaQueue({ text, intent, at: Date.now() });
  };

  // ---- Flag, notes, report, remix ----
  const toggleFlag = async () => {
    if (!q || q.remix) return;
    try {
      const r = await toggleFlagPractice(token, q.id);
      updateQ(q.id, { flagged: r.flagged });
      toast.success(r.flagged ? "Marked for review" : "Removed from review");
    } catch (e) {
      toast.error(e.message);
    }
  };
  // The student's own reason for missing this question (shown at once; put back if the save fails).
  const tagReason = async (reason) => {
    if (!q || q.remix) return;
    const { id, reason: was } = q;
    updateQ(id, { reason });
    try {
      const r = await setMistakeReason(token, id, reason);
      updateQ(id, { reason: r.reason });
    } catch (e) {
      updateQ(id, { reason: was });
      toast.error(e.message);
    }
  };
  const saveNote = async (text) => {
    const r = await savePracticeNote(token, q.id, text);
    updateQ(q.id, { note: r.note });
  };
  const reportTarget = q?.remix ? list?.[remix?.parentIndex]?.id : q?.id;
  const sendReport = async (body) => {
    try {
      await reportPracticeQuestion(token, reportTarget, body);
      toast.success("Thanks! Your teacher will take a look.");
      setReportOpen(false);
    } catch (e) {
      toast.error(e.message);
    }
  };
  // A generated remix isn't in the bank, so there is nothing a classmate could open.
  const askTarget = classroom && q && !q.remix ? q : null;
  const askClass = async (note) => {
    try {
      await sendClassMessage(token, "class", note, { questionId: askTarget.id });
      toast.success(`Shared with ${classroom.name}. Replies arrive in your class chat.`);
      setAskOpen(false);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const doRemix = async () => {
    if (!q || remixBusy) return;
    setRemixBusy(true);
    try {
      const r = await remixPractice(token, q.id);
      setRemix((cur) => ({ question: r.question, kind: r.kind, parentIndex: cur ? cur.parentIndex : index }));
      setPanel((p) => (p === "explanation" ? null : p));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRemixBusy(false);
    }
  };

  // ---- Navigation & finishing ----
  const goTo = (i) => {
    setRemix(null);
    setNavOpen(false);
    setIndex(Math.max(0, Math.min((list?.length || 1) - 1, i)));
  };
  const finish = async () => {
    setSummary(true);
    if (finished.current) return;
    finished.current = true;
    const s = storeRef.current;
    const answered = list.filter((x) => s[x.id]?.result === "correct" || s[x.id]?.wrong?.length || s[x.id]?.gridWrong).length;
    if (!answered) return;
    try {
      if (source === "drill") {
        // The server checks the drill against the answers it graded.
        const r = await completeDrill(token);
        celebrate(r.reward);
        setXp((x) => x + (r.reward?.xpGained || 0));
      }
    } catch {
      /* the session still counts; bonuses are best-effort */
    }
  };
  const next = () => {
    if (remix) return setRemix(null);
    if (isLast) return finish();
    goTo(index + 1);
  };
  const prev = () => {
    if (remix) return setRemix(null);
    if (index > 0) goTo(index - 1);
  };

  // ---- Keyboard ----
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || summary || reportOpen || askOpen) return;
      const t = e.target;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.closest?.(".gcalc")) return;
      if (e.key === "Escape") {
        if (navOpen) setNavOpen(false);
        else if (panel) setPanel(null);
        return;
      }
      if (!q || paused) return;
      const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const opt = q.options ? LETTERS.indexOf(k) : -1;
      if (opt >= 0 && opt < q.options.length) return choose(opt);
      if (/^[1-6]$/.test(k) && q.options && Number(k) <= q.options.length) return choose(Number(k) - 1);
      if (k === "Enter" && t.tagName !== "BUTTON") return check();
      if (k === "ArrowRight") return next();
      if (k === "ArrowLeft") return prev();
      if (k === "X") setCrossMode((m) => !m);
      else if (k === "H") setHlMode((m) => !m);
      else if (k === "M") toggleFlag();
      else if (k === "N") setPanel("nova");
      else if (k === "E") setPanel("explanation");
      // (C is answer choice C, so the graphing calculator is on G.)
      else if (k === "G" && q.section === "Math") setCalcOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- Split pane ----
  const startDrag = (e) => {
    e.preventDefault();
    const rect = bodyRef.current.getBoundingClientRect();
    let last = split;
    const move = (ev) => {
      last = Math.max(28, Math.min(72, ((ev.clientX - rect.left) / rect.width) * 100));
      setSplit(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      writeLocal("pl_split", last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ---- Render ----
  if (error) {
    return (
      <div className="pl-empty">
        <Nova size={90} mood={source === "repair" ? "wink" : "oops"} />
        <h2>{source === "repair" ? "Nothing to repair right now" : "Couldn't load these questions"}</h2>
        <p>{error}</p>
        <button className="ns-btn ns-btn-primary" onClick={() => nav(from)}>
          {backLabel(from)}
        </button>
      </div>
    );
  }
  if (!list) {
    return (
      <div className="pl-empty">
        <div className="ns-spinner" />
        {hwNotice}
      </div>
    );
  }
  if (list.length === 0) {
    const why = {
      saved: "Your mistakes queue is empty. Wrong answers land here automatically.",
      mistakes: "You have no mistakes to review yet. A question you miss lands here, and counts for your plan once you get it right on a later day.",
      flagged: "You haven't marked any questions for review yet. Use \"Mark for Review\" while you practice.",
      errors: "No recent errors. Nice!",
      review: "Nothing is due for review today. A question you miss comes back here the next day, then after 3, 7 and 14 days.",
      diagnostic: "There's nothing to review from this diagnostic here."
    }[source];
    return (
      <div className="pl-empty">
        <Nova size={96} mood={source === "errors" || source === "saved" || source === "review" || source === "mistakes" ? "cheer" : "thinking"} float />
        <h2>{why ? "Nothing to review" : "No questions match"}</h2>
        <p>{why || "Try changing the difficulty or status filters."}</p>
        <button className="ns-btn ns-btn-primary" onClick={() => nav(from)}>
          {backLabel(from)}
        </button>
      </div>
    );
  }

  const setTitle =
    skills.length === 1
      ? skills[0]
      : { saved: "Mistakes queue", mistakes: "Mistakes review", flagged: "Marked for review", errors: "Recent errors", drill: plan ? "Mixed practice" : "Drill", diagnostic: "Diagnostic review", repair: "Repair drill", review: "Spaced review" }[source] || (sec ? SECTION_NAME[sec] : "Question Bank");
  // A graph or table that goes with a passage sits in the passage pane, even when there is no text.
  const hasPassage = Boolean(q.passage || q.image);
  const picture = isPictureQuestion(q);
  const directions = meta?.directions?.[q.section] || [];
  const paceTarget = PACE[q.section] || 90;
  const novaFor = (field) => (st.novaHl?.field === field ? st.novaHl.range : null);
  const isGrid = q.type === "grid_in";
  const isMath = q.section === "Math";

  const questionPane = (
    <div className="pl-qpane">
      {repair && !remix && (
        <div className="pl-repair-bar" role="status">
          <Icon name="northStar" size={17} />
          {repair.state === "repaired" ? (
            <>
              Star relit <small>Your streak is {repair.streak} days. The rest is extra practice.</small>
            </>
          ) : repair.state === "closed" ? (
            <>
              Practice set <small>The repair window has closed, so these questions count as regular practice.</small>
            </>
          ) : (
            <>
              Repair drill · {repair.total - repair.remaining} of {repair.total} answered <small>Any score relights the star.</small>
            </>
          )}
        </div>
      )}
      {remix && (
        <div className="pl-remix-bar">
          <Icon name="remix" size={17} />
          <span>
            {remix.kind === "generated" ? "A fresh variant" : "A similar question"} of question {remix.parentIndex + 1}
          </span>
          <button className="pl-textbtn" onClick={() => setRemix(null)}>
            Back to question {remix.parentIndex + 1}
          </button>
          <button className="pl-textbtn" onClick={doRemix} disabled={remixBusy}>
            Remix again
          </button>
        </div>
      )}
      <div className="pl-qhead">
        <span className="pl-qnum">{remix ? <Icon name="remix" size={18} /> : index + 1}</span>
        <button className={`pl-mark ${q.flagged ? "on" : ""}`} onClick={toggleFlag} disabled={q.remix} aria-pressed={q.flagged}>
          <Icon name={q.flagged ? "bookmarkFilled" : "bookmark"} size={18} /> Mark for Review
        </button>
        <span className="pl-qhead-spacer" />
        {!q.remix && (
          <Pop
            align="right"
            className="pl-notes-pop"
            button={({ open, toggle }) => (
              <button className={`pl-iconbtn ${q.note ? "has-note" : ""}`} aria-label="Notes" aria-expanded={open} title="Notes" onClick={toggle}>
                <Icon name="note" size={19} />
              </button>
            )}
          >
            <NotesBox key={q.id} value={q.note} onSave={saveNote} />
          </Pop>
        )}
        <button className="pl-report" onClick={() => setReportOpen(true)} disabled={!reportTarget}>
          <Icon name="flag" size={16} /> <span className="pl-lbl">Report</span>
        </button>
        <button className={`pl-strike ${crossMode ? "on" : ""}`} aria-pressed={crossMode} aria-label="Cross out answer choices" title="Cross out answer choices (X)" onClick={() => setCrossMode((m) => !m)}>
          <Icon name="strike" size={20} />
        </button>
      </div>
      <p className="pl-qmeta">
        <span className={`pl-diff ${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
        {q.topic}
      </p>

      {!hasPassage && q.figure && <Figure figure={q.figure} />}
      {!hasPassage && q.table && <DataTable table={q.table} />}
      {picture && <BankPicture image={q.promptImage} alt={isGrid ? "The question, shown as a picture" : "The question and its answer choices A to D, shown as a picture"} />}

      <div className={`pl-prompt ${picture ? "pl-prompt-note" : ""}`} ref={promptRef} onMouseUp={onTextUp("q", promptRef)} onClick={onTextClick("q")}>
        <HighlightText className="pl-prompt-math" text={q.prompt} ranges={hl.q} nova={novaFor("q")} inline />
      </div>

      {isGrid ? (
        <div className="pl-grid">
          <label htmlFor="pl-grid-input">Your answer</label>
          <div className="pl-grid-row">
            <input
              id="pl-grid-input"
              value={st.grid}
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. 3/4 or 0.75"
              disabled={st.result === "correct"}
              onChange={(e) => patch(q.id, { grid: e.target.value.slice(0, 12), feedback: st.feedback?.kind === "bad" ? null : st.feedback })}
              onKeyDown={(e) => {
                if (e.key === "Enter") check();
              }}
            />
            <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={check} disabled={!st.grid.trim() || st.busy || st.result === "correct"}>
              {st.busy ? "Checking…" : "Check"}
            </button>
          </div>
          {st.result === "correct" && (
            <p className="pl-grid-ok">
              <Icon name="check" size={16} strokeWidth={3} /> {st.grid}
            </p>
          )}
        </div>
      ) : (
        <div className={`pl-options ${crossMode ? "crossing" : ""} ${picture ? "pl-options-letters" : ""}`} role="radiogroup" aria-label="Answer choices">
          {q.options.map((opt, i) => {
            const crossed = st.crossed.includes(i);
            const wrong = st.wrong.includes(i);
            const right = st.result === "correct" && i === st.correctIndex;
            const selected = st.selected === i && !st.result;
            const locked = st.result === "correct" || wrong;
            return (
              <div key={i} className="pl-optrow">
                <button
                  role="radio"
                  aria-checked={st.selected === i}
                  aria-disabled={locked}
                  className={`pl-opt ${selected ? "sel" : ""} ${right ? "right" : ""} ${wrong ? "wrong" : ""} ${crossed ? "crossed" : ""} ${st.result === "correct" && !right && !wrong ? "dim" : ""}`}
                  onClick={() => choose(i)}
                >
                  <span className="pl-letter">{right ? <Icon name="check" size={16} strokeWidth={3} /> : wrong ? <Icon name="cross" size={16} strokeWidth={3} /> : LETTERS[i]}</span>
                  {picture ? <span className="pl-opt-text">Choice {LETTERS[i]}</span> : <MathText className="pl-opt-text" text={opt} />}
                </button>
                {selected && (
                  <button className="pl-check" onClick={check} disabled={st.busy}>
                    {st.busy ? "…" : "Check"}
                  </button>
                )}
                {crossMode &&
                  (locked ? (
                    <span className="pl-xspace" />
                  ) : crossed ? (
                    <button className="pl-undo" onClick={() => toggleCross(i)}>
                      Undo
                    </button>
                  ) : (
                    <button className="pl-xbtn" aria-label={`Cross out option ${LETTERS[i]}`} onClick={() => toggleCross(i)}>
                      <span>{LETTERS[i]}</span>
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {st.feedback && (
        <div className={`pl-feedback ${st.feedback.kind}`} role="status">
          <Nova size={42} mood={answerMood({ correct: st.feedback.kind === "good", difficulty: q.difficulty, assisted: st.feedback.assisted || !st.feedback.first })} sparkles={false} />
          <div className="pl-feedback-text">
            {st.feedback.kind === "good" ? (
              <>
                <b>{st.feedback.first ? "Correct!" : "Correct. Nice recovery!"}</b>
                <span>
                  {st.feedback.xp > 0 ? `+${st.feedback.xp} XP` : "Good practice"}
                  {st.feedback.review ? " · you'd already solved this one, so it counts as review" : st.feedback.assisted ? " · counted as assisted" : ""}
                  {st.feedback.cleared ? " · cleared from your mistakes" : ""}
                </span>
              </>
            ) : (
              <>
                <b>{st.feedback.letter ? `Not quite. ${st.feedback.letter} isn't it.` : "Not quite. Try again."}</b>
                {st.feedback.text && <MathText as="span" text={st.feedback.text} />}
              </>
            )}
          </div>
          <div className="pl-feedback-actions">
            {st.feedback.kind === "good" ? (
              <>
                <button className="pl-textbtn" onClick={() => openPanel("explanation")}>
                  See explanation
                </button>
                <button className="ns-btn ns-btn-primary ns-btn-sm" onClick={next}>
                  {isLast ? "Finish" : remix ? "Back" : "Next question"} <Icon name="arrowRight" size={15} />
                </button>
              </>
            ) : (
              <>
                <button className="pl-textbtn" onClick={() => askNova(st.feedback.letter ? `Why is ${st.feedback.letter} wrong?` : "Why is my answer wrong?")}>
                  <Nova size={18} sparkles={false} /> Ask Nova why
                </button>
                <button className="pl-textbtn" onClick={() => askNova("Give me a hint", "hint")}>
                  Hint
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* After a miss: why it happened (the student's call), and when the question comes back. */}
      {!q.remix && (st.wrong.length > 0 || st.gridWrong > 0 || q.status === "missed" || q.reason) && (
        <ReasonPicker reasons={meta?.mistakeReasons} value={q.reason} onPick={tagReason} label={st.wrong.length > 0 || st.gridWrong > 0 ? "What went wrong?" : "What went wrong last time?"} />
      )}
      {!q.remix && st.schedule && (
        <p className="rv-line" role="status">
          <Icon name="history" size={16} /> {reviewLine(st.schedule)}
        </p>
      )}
    </div>
  );

  return (
    <div className={`pl-root fs-${font} ${panel ? `with-panel ${pinned ? "pinned" : "floating"}` : ""} ${hlMode ? "hl-mode" : ""}`}>
      <div className="pl-main">
        <header className="pl-top">
          <div className="pl-top-left">
            <button className="pl-back" onClick={() => nav(from)}>
              <Icon name="chevronLeft" size={18} /> Go back
            </button>
            <Pop
              className="pl-dir-pop"
              button={({ open, toggle }) => (
                <button className="pl-dir" aria-expanded={open} onClick={toggle}>
                  Directions <Icon name={open ? "chevronUp" : "chevronDown"} size={16} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <p className="pl-pop-title">{q.section} directions</p>
                  {directions.map((d, i) => (
                    <p key={i} className="pl-dir-text">
                      {d}
                    </p>
                  ))}
                  {q.section === "Math" && (
                    <button
                      className="pl-textbtn"
                      onClick={() => {
                        close();
                        openPanel("info");
                      }}
                    >
                      <Icon name="calc" size={15} /> Open the reference sheet
                    </button>
                  )}
                  {q.section === "Math" && (
                    <button
                      className="pl-textbtn"
                      onClick={() => {
                        close();
                        setCalcOpen(true);
                      }}
                    >
                      <Icon name="calc" size={15} /> Open the calculator
                    </button>
                  )}
                </>
              )}
            </Pop>
          </div>
          <div className="pl-timer">
            <span className="pl-time" aria-live="off">
              {hideTimer ? <Icon name="clock" size={20} /> : mmss(seconds)}
            </span>
            <div className="pl-timer-ctrls">
              <button className="pl-round" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Resume timer" : "Pause timer"}>
                <Icon name={paused ? "play2" : "pause"} size={12} />
              </button>
              <button className="pl-hide" onClick={() => setHideTimer((h) => !h)}>
                {hideTimer ? "Show" : "Hide"}
              </button>
            </div>
            {pace && (
              <div className="pl-pace" title={`Target pace: about ${paceTarget} seconds per question`}>
                <div className={seconds > paceTarget ? "over" : ""} style={{ width: `${Math.min(100, (seconds / paceTarget) * 100)}%` }} />
              </div>
            )}
          </div>
          <div className="pl-top-right">
            {isMath && (
              <button className={`pl-tool wide pl-calc ${calcOpen ? "open" : ""}`} aria-pressed={calcOpen} title="Graphing calculator (G)" onClick={() => setCalcOpen((o) => !o)}>
                <Icon name="calc" size={19} /> <span className="pl-lbl">Calculator</span>
              </button>
            )}
            <button className={`pl-tool ${pace ? "on" : ""}`} aria-pressed={pace} title={`Pace guide (${paceTarget}s per question)`} aria-label="Pace guide" onClick={() => setPace((p) => !p)}>
              <Icon name="stopwatch" size={20} />
            </button>
            <button className={`pl-tool wide ${hlMode ? "on" : ""}`} aria-pressed={hlMode} title="Highlighter (H). Select text to highlight; click a highlight to remove it." onClick={() => setHlMode((m) => !m)}>
              <Icon name="highlighter" size={19} /> <span className="pl-lbl">Highlight</span>
            </button>
            <Pop
              align="right"
              className="pl-more-pop"
              button={({ open, toggle }) => (
                <button className="pl-tool outline" aria-label="More options" aria-expanded={open} onClick={toggle}>
                  <Icon name="more" size={20} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <div className="pl-fontrow">
                    <span>Text size</span>
                    {["A", "A", "A"].map((a, i) => (
                      <button key={i} className={font === i ? "on" : ""} style={{ fontSize: 13 + i * 3 }} aria-label={["Small text", "Medium text", "Large text"][i]} onClick={() => setFont(i)}>
                        {a}
                      </button>
                    ))}
                  </div>
                  <button
                    className="ns-menu-item"
                    onClick={() => {
                      close();
                      openPanel("info");
                    }}
                  >
                    <Icon name="info" size={16} /> Keyboard shortcuts
                  </button>
                  {askTarget && (
                    <button
                      className="ns-menu-item"
                      onClick={() => {
                        close();
                        setAskOpen(true);
                      }}
                    >
                      <Icon name="users" size={16} /> Ask my class
                    </button>
                  )}
                  <button
                    className="ns-menu-item"
                    disabled={!hl.p.length && !hl.q.length}
                    onClick={() => {
                      close();
                      saveHl({ p: [], q: [] });
                    }}
                  >
                    <Icon name="highlighter" size={16} /> Clear my highlights
                  </button>
                  <button className="ns-menu-item" onClick={() => finish()}>
                    <Icon name="checklist" size={16} /> End session
                  </button>
                </>
              )}
            </Pop>
          </div>
        </header>

        <div className="pl-body" ref={bodyRef}>
          {hasPassage ? (
            <>
              <section className="pl-left" style={{ flexBasis: `${split}%` }} aria-label="Passage">
                <BankPicture image={q.image} alt="Graph or table for this question" zoom={1.25} />
                <div className="pl-passage" ref={passageRef} onMouseUp={onTextUp("p", passageRef)} onClick={onTextClick("p")}>
                  <HighlightText text={q.passage} ranges={hl.p} nova={novaFor("p")} underline={q.underline} />
                </div>
                {q.table && <DataTable table={q.table} />}
                {q.figure && <Figure figure={q.figure} />}
              </section>
              <div className="pl-divider" onPointerDown={startDrag} role="separator" aria-orientation="vertical" aria-label="Resize passage and question">
                <span />
              </div>
              <section className="pl-right" aria-label="Question">
                {questionPane}
              </section>
            </>
          ) : (
            <section className="pl-single" aria-label="Question">
              {questionPane}
            </section>
          )}
          {paused && (
            <div className="pl-paused">
              <Nova size={84} mood="wink" float />
              <h2>Paused</h2>
              <p>Your timer is stopped. Take a breath.</p>
              <button className="ns-btn ns-btn-primary" onClick={() => setPaused(false)}>
                <Icon name="play2" size={15} /> Resume
              </button>
            </div>
          )}
        </div>

        <footer className="pl-bottom">
          <div className="pl-pop-anchor">
            <button className="pl-counter" aria-expanded={navOpen} onClick={() => setNavOpen((o) => !o)}>
              {remix ? "Remix" : `${index + 1} of ${list.length}`} <Icon name={navOpen ? "chevronUp" : "chevronDown"} size={16} />
            </button>
            {navOpen && <Navigator list={list} store={store} index={index} onPick={goTo} onClose={() => setNavOpen(false)} title={setTitle} />}
          </div>
          <div className="pl-bottom-right">
            <button className={`pl-bb info ${panel === "info" ? "on" : ""}`} aria-label="Question info" title="Info" onClick={() => togglePanel("info")}>
              <Icon name="info" size={19} />
            </button>
            <button className={`pl-bb nova ${panel === "nova" ? "on" : ""}`} onClick={() => togglePanel("nova")}>
              <Nova size={24} sparkles={false} /> <span>Ask Nova</span>
            </button>
            <button className={`pl-bb master ${panel === "lesson" ? "on" : ""}`} onClick={() => togglePanel("lesson")}>
              <Icon name="masterclass" size={18} /> <span>Masterclass</span>
            </button>
            <button className="pl-bb remixb" onClick={doRemix} disabled={remixBusy || !q.canRemix} title="A new question on the same skill">
              <Icon name="remix" size={18} /> <span>{remixBusy ? "Remixing…" : "Remix"}</span>
            </button>
            <button className={`pl-bb expl ${panel === "explanation" ? "on" : ""}`} onClick={() => togglePanel("explanation")}>
              <Icon name="steps" size={18} /> <span>Explanation</span>
            </button>
            <button className="pl-bb step" onClick={prev} disabled={!remix && index === 0}>
              Previous
            </button>
            <button className="pl-bb step" onClick={next}>
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </footer>
      </div>

      {panel && (
        <SidePanel
          tab={panel}
          setTab={setPanel}
          onClose={() => setPanel(null)}
          pinned={pinned}
          setPinned={setPinned}
          q={q}
          st={st}
          meta={meta}
          token={token}
          seconds={seconds}
          chatProps={{
            questionId: q.id,
            conversation: st.chat,
            onChange: (c) => patch(q.id, { chat: c }),
            onNew: () => patch(q.id, { chat: EMPTY_CONVERSATION }),
            getState: () => {
              const cur = { ...DEFAULT_Q, ...storeRef.current[q.id] };
              return {
                selected: isGrid ? cur.grid || null : cur.selected,
                crossed: cur.crossed,
                attempts: cur.wrong.length + cur.gridWrong + (cur.result ? 1 : 0),
                correct: cur.result === "correct",
                lastCorrect: cur.result === "correct",
                revealed: Boolean(cur.explanation) || Boolean(q.revealed),
                lastWrong: cur.lastWrong
              };
            },
            onHighlight: onNovaHighlight,
            starters: [
              ...(hasPassage ? [{ label: "Highlight the key part of the passage", intent: "highlight" }] : []),
              { label: "What's the best strategy for this?", intent: "strategy" },
              { label: "Explain this step by step", intent: "steps" },
              { label: "Give me a hint", intent: "hint" }
            ],
            intro: "I give hints, point to the evidence and explain step by step. I won't just hand you the answer, unless you ask twice.",
            autoSend: novaQueue,
            onAutoSent: () => setNovaQueue(null)
          }}
          onReveal={() => loadExplanation(q)}
          onHint={() => askNova("Give me a hint", "hint")}
          onOptionTab={(i) => patch(q.id, { optionTab: i })}
          onStepMore={() => patch(q.id, (s) => ({ stepsShown: (s.stepsShown || 1) + 1 }))}
          onStepAll={() => patch(q.id, { stepsShown: 99 })}
          onAskWhy={(i) => askNova(`Why is ${LETTERS[i]} wrong?`)}
          onReport={reportTarget ? () => setReportOpen(true) : null}
          onApplyLesson={() => askNova("Apply the strategy to this question, step by step", "steps")}
        />
      )}

      <GraphingCalculator open={calcOpen && isMath && !summary} warm={isMath} onClose={() => setCalcOpen(false)} />
      {hwNotice}
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} onSend={sendReport} />}
      {askOpen && askTarget && <AskClassModal className={classroom.name} title={askTarget.title} onClose={() => setAskOpen(false)} onSend={askClass} />}
      {summary && (
        <SessionSummary
          stats={(() => {
            const answered = list.filter((x) => store[x.id]?.result === "correct" || store[x.id]?.wrong?.length || store[x.id]?.gridWrong).length;
            return {
              answered,
              total: list.length,
              firstTry: list.filter((x) => store[x.id]?.result === "correct" && !store[x.id]?.wrong?.length && !store[x.id]?.gridWrong).length,
              correct: list.filter((x) => store[x.id]?.result === "correct").length,
              seconds: Math.round(Object.values(msRef.current).reduce((a, b) => a + b, 0) / 1000),
              xp
            };
          })()}
          note={
            !repair
              ? null
              : repair.state === "repaired"
                ? `Star relit. Your streak is ${repair.streak} days.`
                : repair.state === "open"
                  ? `${repair.remaining} more answer${repair.remaining === 1 ? "" : "s"} relight the star. The drill is saved, so you can pick it up again from your sky.`
                  : null
          }
          from={backLabel(from)}
          onBack={() => nav(from)}
          onReview={() => nav(playerUrl({ source: "errors", from }))}
          onMore={
            source === "drill"
              ? () => nav(playerUrl({ source: "drill", sec, skills, size: Number(params.get("size")) || 10, from }) + `&n=${Date.now()}`)
              : () => setSummary(false)
          }
          moreLabel={source === "drill" ? "Another drill" : "Keep going"}
        />
      )}
    </div>
  );
}
