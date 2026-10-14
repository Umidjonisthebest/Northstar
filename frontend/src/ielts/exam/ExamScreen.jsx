import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResizableSplit } from "../components/ResizableSplit.jsx";
import { RichHtml } from "../lib/richHtml.jsx";
import { countWords } from "../lib/format.js";
import { headingSlotIdsInHtml, isSlotAnswered } from "../lib/questionTypes.js";
import { ExamContext } from "./ExamContext.jsx";
import { ExamHeader, FooterNav, NavArrows, NotesPanel, OptionsModal, SelectionToolbar, SubmitConfirm, VolumeWidget } from "./ExamChrome.jsx";
import { DropZone, Reveal } from "./questions/controls.jsx";
import { QuestionGroupView } from "./questions/QuestionGroupView.jsx";
import { useHighlights } from "./useHighlights.js";
import { WritingTaskView } from "./WritingTaskView.jsx";

const AUTOSAVE_DELAY = 1500;
const AUTOSAVE_INTERVAL = 15000;

function normalizeParts(section, parts) {
  return parts.map((p, i) => ({
    ...p,
    key: p.refId || String(i),
    slots: section === "writing" ? [{ id: p.refId, n: p.partNumber ?? i + 1, mode: "text" }] : p.groups.flatMap((g) => g.slots)
  }));
}

function ListeningPart({ part }) {
  return (
    <div className="ie-exam-scroll">
      <div className="ie-exam-page">
        {part.groups.map((g) => (
          <QuestionGroupView key={g.id} group={g} />
        ))}
      </div>
    </div>
  );
}

function ReadingPart({ part }) {
  // Heading gaps typed into the passage (Ctrl+H) become drop zones for matching-headings items.
  const headingTargets = useMemo(() => {
    const map = new Map();
    for (const g of part.groups) {
      if (g.type !== "matching_headings") continue;
      for (const it of g.items || []) if (it.slotRef) map.set(it.slotRef, { group: g, itemId: it.id });
    }
    return map;
  }, [part.groups]);
  const slotsInPassage = useMemo(() => new Set(headingSlotIdsInHtml(part.contentHtml)), [part.contentHtml]);

  return (
    <ResizableSplit
      className="ie-exam-split"
      storageKey="ielts_exam_split"
      left={
        <div className="ie-passage">
          {part.title && <h2>{part.title}</h2>}
          <RichHtml
            html={part.contentHtml}
            renderHeadingSlot={(id) => {
              const target = headingTargets.get(id);
              return target ? (
                <>
                  <DropZone group={target.group} slotId={target.itemId} block />
                  <Reveal slotId={target.itemId} group={target.group} />
                </>
              ) : null;
            }}
          />
        </div>
      }
      right={
        <div className="ie-reading-questions">
          {part.groups.map((g) => (
            <QuestionGroupView key={g.id} group={g} headingSlots={slotsInPassage} />
          ))}
        </div>
      }
    />
  );
}

function WritingPart({ part, value, onChange, onFocus, preview }) {
  return (
    <ResizableSplit
      className="ie-exam-split"
      storageKey="ielts_writing_split"
      left={<WritingTaskView task={part} />}
      right={
        <div className="ie-writing-answer" data-q={part.partNumber}>
          <textarea
            className="ie-writing-textarea"
            placeholder={`Write part ${part.partNumber} here...`}
            value={value || ""}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            disabled={preview}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            aria-label={`Writing task ${part.task} answer`}
          />
          <div className="ie-writing-count">Words: {countWords(value)}</div>
        </div>
      }
    />
  );
}

export function ExamScreen({
  section,
  candidateId,
  parts: rawParts,
  remainingSeconds = 0,
  elapsedSeconds = 0,
  initialAnswers = {},
  initialFlags = [],
  prefs,
  onPrefs,
  playlist,
  nextLabel,
  onAutosave,
  onSubmit,
  preview = false,
  previewExtra,
  reveal = false,
  keyOf,
  // Practice mode (see PracticeRunner.jsx):
  label, // header text instead of the test-taker ID
  timed = true, // false: no countdown or auto-submit; the header shows time spent
  topBanner, // e.g. the practice score, above the part banner
  locked = false, // answer review: inputs are read-only
  marks, // Map slotId -> boolean, colours the revealed answers
  submitCopy // { title, message, button } for the submit dialog
}) {
  const parts = useMemo(() => normalizeParts(section, rawParts), [section, rawParts]);
  const [answers, setAnswers] = useState(initialAnswers);
  const [flags, setFlags] = useState(() => new Set(initialFlags));
  const [currentPart, setCurrentPart] = useState(0);
  const [currentSlot, setCurrentSlot] = useState(parts[0]?.slots[0]?.id || null);
  const [selected, setSelected] = useState(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [focusNote, setFocusNote] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(remainingSeconds);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const mainRef = useRef(null);
  const partRefs = useRef([]);
  const answersRef = useRef(answers);
  const flagsRef = useRef(flags);
  answersRef.current = answers;
  flagsRef.current = flags;

  const numberOf = useMemo(() => {
    const map = new Map();
    for (const p of parts) for (const s of p.slots) map.set(s.id, s.n);
    return map;
  }, [parts]);
  const allSlots = useMemo(() => parts.flatMap((p, pi) => p.slots.map((s) => ({ ...s, part: pi }))), [parts]);

  const setAnswer = useCallback(
    (id, value) =>
      setAnswers((prev) => {
        const next = { ...prev };
        if (value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0)) delete next[id];
        else next[id] = value;
        return next;
      }),
    []
  );
  const toggleFlag = useCallback(
    (id) =>
      setFlags((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    []
  );
  const answeredOf = useCallback((slot) => isSlotAnswered(slot, answers), [answers]);

  // ---- highlights & notes (not for writing) ----
  const hl = useHighlights(mainRef, {
    enabled: section !== "writing",
    onNoteAdded: (id) => {
      setNotesOpen(true);
      setFocusNote(id);
    }
  });

  // ---- server-synced countdown & auto-submit ----
  const submittedRef = useRef(false);
  const submit = useCallback(
    async (auto) => {
      if (submittedRef.current || preview) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        await onSubmit(answersRef.current, [...flagsRef.current], { auto });
      } catch {
        submittedRef.current = false;
        setSubmitting(false);
      }
    },
    [onSubmit, preview]
  );

  useEffect(() => {
    if (preview || locked || timed) return undefined;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [preview, locked, timed]);

  useEffect(() => {
    if (preview || locked || !timed) return undefined;
    const deadline = Date.now() + remainingSeconds * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        setConfirmOpen(false);
        submit(true);
      }
    }, 250);
    return () => clearInterval(id);
  }, [preview, locked, timed, remainingSeconds, submit]);

  // ---- autosave ----
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const firstRun = useRef(true);
  const flush = useCallback(
    async (keepalive = false) => {
      if (preview || !dirtyRef.current || savingRef.current || submittedRef.current) return;
      savingRef.current = true;
      dirtyRef.current = false;
      try {
        await onAutosave(answersRef.current, [...flagsRef.current], keepalive);
      } catch (err) {
        dirtyRef.current = true;
        if (err?.code === "TIME_UP") submit(true);
      } finally {
        savingRef.current = false;
      }
    },
    [onAutosave, preview, submit]
  );

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return undefined;
    }
    dirtyRef.current = true;
    const t = setTimeout(() => flush(), AUTOSAVE_DELAY);
    return () => clearTimeout(t);
  }, [answers, flags, flush]);

  useEffect(() => {
    if (preview) return undefined;
    const id = setInterval(() => flush(), AUTOSAVE_INTERVAL);
    const onHide = () => document.visibilityState === "hidden" && flush(true);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush, preview]);

  // ---- listening audio ----
  useEffect(() => {
    if (!playlist) return undefined;
    const offPart = playlist.onPart((i) => {
      if (i >= 0) setCurrentPart(i);
    });
    const offBlocked = playlist.onBlocked(() => setAudioBlocked(true));
    playlist.start(elapsedSeconds);
    return () => {
      offPart();
      offBlocked();
    };
    // Start once per mounted exam screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist]);

  useEffect(() => {
    playlist?.setVolume(prefs.volume);
  }, [playlist, prefs.volume]);

  // ---- navigation ----
  const goToSlot = useCallback((slot) => {
    setCurrentPart(slot.part);
    setCurrentSlot(slot.id);
    requestAnimationFrame(() => {
      const root = partRefs.current[slot.part];
      const el = root?.querySelector(`[data-q~="${slot.n}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const focusable = el.matches("input, textarea, [tabindex='0']") ? el : el.querySelector("input:not([disabled]), textarea, [tabindex='0']");
      focusable?.focus({ preventScroll: true });
    });
  }, []);

  const currentIndex = allSlots.findIndex((s) => s.id === currentSlot);
  const step = (delta) => {
    const i = currentIndex === -1 ? allSlots.findIndex((s) => s.part === currentPart) : currentIndex;
    const target = allSlots[Math.min(allSlots.length - 1, Math.max(0, i + delta))];
    if (target) goToSlot(target);
  };

  const ctx = useMemo(
    () => ({
      answers,
      setAnswer,
      updateAnswers: setAnswers,
      flags,
      toggleFlag,
      numberOf,
      selected,
      setSelected,
      setCurrent: setCurrentSlot,
      preview,
      reveal,
      keyOf,
      locked,
      marks
    }),
    [answers, setAnswer, flags, toggleFlag, numberOf, selected, preview, reveal, keyOf, locked, marks]
  );

  const part = parts[currentPart];
  const range = part?.range;
  const banner =
    section === "writing"
      ? null
      : range
        ? `${section === "listening" ? "Listen" : "Read the text"} and answer questions ${range[0]}-${range[1]}.`
        : "";
  const unanswered = allSlots.filter((s) => !isSlotAnswered(s, answers)).length;
  const confirmTitle = submitCopy?.title || (nextLabel ? `Move to ${nextLabel}` : "Finish test");
  const confirmText =
    submitCopy?.message ||
    (nextLabel
      ? `You still have time to finish the test. Are you sure want to move to ${nextLabel}?`
      : "You still have time to finish the test. Are you sure you want to finish the test?");

  const rootClass = ["ie-exam", `ie-contrast-${prefs.contrast}`, `ie-size-${prefs.textSize}`, notesOpen ? "ie-exam--notes" : ""].join(" ");

  return (
    <ExamContext.Provider value={ctx}>
      <div className={rootClass}>
        <ExamHeader
          candidateId={candidateId}
          remaining={timed ? remaining : elapsed}
          warn={timed && !preview && !locked && remaining <= 300}
          preview={preview}
          previewExtra={previewExtra}
          label={label}
          timerLabel={timed ? "Time remaining" : "Time spent"}
          showTimer={!preview && !locked}
          showNotes={section !== "writing" && hl.supported}
          onMenu={() => setOptionsOpen(true)}
          onNotes={() => setNotesOpen((o) => !o)}
        />
        <div className="ie-exam-main">
          <div className="ie-exam-content" ref={mainRef}>
            {topBanner}
            <div className="ie-part-banner">
              <strong>Part {part?.partNumber}</strong>
              {banner && <span>{banner}</span>}
            </div>
            <div className="ie-exam-body">
              {parts.map((p, i) => (
                <div key={p.key} className="ie-exam-part" hidden={i !== currentPart} ref={(el) => (partRefs.current[i] = el)}>
                  {section === "listening" && <ListeningPart part={p} />}
                  {section === "reading" && <ReadingPart part={p} />}
                  {section === "writing" && (
                    <WritingPart part={p} value={answers[p.refId]} onChange={(v) => setAnswer(p.refId, v)} onFocus={() => setCurrentSlot(p.refId)} preview={preview || locked} />
                  )}
                </div>
              ))}
            </div>
          </div>
          {notesOpen && (
            <NotesPanel notes={hl.notes} focusId={focusNote} onChange={hl.updateNote} onDelete={hl.deleteNote} onClose={() => setNotesOpen(false)} />
          )}
        </div>

        <div className="ie-exam-floating">
          {section === "listening" && !preview && playlist && <VolumeWidget volume={prefs.volume} onChange={(volume) => onPrefs({ ...prefs, volume })} />}
          <NavArrows
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            prevDisabled={currentIndex <= 0 && currentPart === 0}
            nextDisabled={currentIndex === allSlots.length - 1}
          />
        </div>

        <FooterNav
          parts={parts}
          currentPart={currentPart}
          currentSlot={currentSlot}
          answeredOf={answeredOf}
          markOf={marks ? (s) => marks.get(s.id) : undefined}
          flags={flags}
          label={section === "writing" ? "Task" : "Part"}
          hideSubmit={preview || locked}
          onPart={(i) => {
            setCurrentPart(i);
            if (parts[i].slots[0]) setCurrentSlot(parts[i].slots[0].id);
          }}
          onSlot={(s) => goToSlot({ ...s, part: allSlots.find((x) => x.id === s.id)?.part ?? currentPart })}
          onSubmit={() => setConfirmOpen(true)}
        />

        <SelectionToolbar toolbar={hl.toolbar} onNote={hl.addNote} onHighlight={hl.highlight} onClear={hl.clear} />
        {optionsOpen && <OptionsModal prefs={prefs} onChange={onPrefs} onClose={() => setOptionsOpen(false)} />}
        {confirmOpen && (
          <SubmitConfirm
            title={confirmTitle}
            message={confirmText}
            unanswered={section === "writing" ? 0 : unanswered}
            confirmLabel={submitCopy?.button}
            busy={submitting}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => submit(false)}
          />
        )}
        {submitting && !confirmOpen && (
          <div className="ie-overlay">
            <div className="ie-audio-modal">Submitting your answers…</div>
          </div>
        )}
        {audioBlocked && (
          <div className="ie-overlay">
            <div className="ie-audio-modal">
              <p style={{ marginBottom: 14 }}>Click the button to continue the listening audio.</p>
              <button
                type="button"
                className="ie-btn ie-btn--primary"
                onClick={() => {
                  setAudioBlocked(false);
                  playlist?.resume();
                }}
              >
                Continue audio
              </button>
            </div>
          </div>
        )}
      </div>
    </ExamContext.Provider>
  );
}
