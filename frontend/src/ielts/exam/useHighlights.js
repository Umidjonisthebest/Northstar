import { useCallback, useEffect, useRef, useState } from "react";
import { newId } from "../lib/ids.js";

// Text highlighting and notes via the CSS Custom Highlight API: ranges are
// painted by the browser without touching React's DOM. All exam parts stay
// mounted (just hidden), so the ranges survive switching parts.

const supported = typeof window !== "undefined" && typeof CSS !== "undefined" && "highlights" in CSS && typeof window.Highlight === "function";

function intersects(a, b) {
  try {
    return a.compareBoundaryPoints(Range.END_TO_START, b) < 0 && a.compareBoundaryPoints(Range.START_TO_END, b) > 0;
  } catch {
    return false;
  }
}

export function useHighlights(containerRef, { enabled = true, onNoteAdded } = {}) {
  const [toolbar, setToolbar] = useState(null);
  const [notes, setNotes] = useState([]);
  const registry = useRef(null);
  const noteRanges = useRef(new Map());
  const onNoteAddedRef = useRef(onNoteAdded);
  onNoteAddedRef.current = onNoteAdded;

  useEffect(() => {
    if (!supported || !enabled) return undefined;
    const hl = new window.Highlight();
    const note = new window.Highlight();
    CSS.highlights.set("ie-hl", hl);
    CSS.highlights.set("ie-note", note);
    registry.current = { hl, note };
    return () => {
      CSS.highlights.delete("ie-hl");
      CSS.highlights.delete("ie-note");
      registry.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    const root = containerRef.current;
    if (!supported || !enabled || !root) return undefined;
    const onUp = (e) => {
      if (e.target.closest?.("input, textarea, button, select, .ie-zone, .ie-chip")) return;
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return setToolbar(null);
        const range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer) || !range.toString().trim()) return setToolbar(null);
        const rect = range.getBoundingClientRect();
        const reg = registry.current;
        const canClear = reg ? [...reg.hl, ...reg.note].some((r) => intersects(r, range)) : false;
        setToolbar({ x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom, range: range.cloneRange(), canClear });
      }, 0);
    };
    const onDown = (e) => {
      if (!e.target.closest?.(".ie-sel-toolbar")) setToolbar(null);
    };
    root.addEventListener("mouseup", onUp);
    document.addEventListener("mousedown", onDown);
    return () => {
      root.removeEventListener("mouseup", onUp);
      document.removeEventListener("mousedown", onDown);
    };
  }, [containerRef, enabled]);

  const finish = () => {
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
  };

  const highlight = useCallback(() => {
    if (!toolbar || !registry.current) return;
    registry.current.hl.add(toolbar.range);
    finish();
  }, [toolbar]);

  const addNote = useCallback(() => {
    if (!toolbar || !registry.current) return;
    const id = newId("n");
    registry.current.note.add(toolbar.range);
    noteRanges.current.set(id, toolbar.range);
    setNotes((list) => [...list, { id, text: toolbar.range.toString().replace(/\s+/g, " ").trim(), body: "" }]);
    finish();
    onNoteAddedRef.current?.(id);
  }, [toolbar]);

  const clear = useCallback(() => {
    if (!toolbar || !registry.current) return;
    const { hl, note } = registry.current;
    for (const r of hl) if (intersects(r, toolbar.range)) hl.delete(r);
    const removed = [];
    for (const [id, r] of noteRanges.current) {
      if (intersects(r, toolbar.range)) {
        note.delete(r);
        noteRanges.current.delete(id);
        removed.push(id);
      }
    }
    if (removed.length) setNotes((list) => list.filter((n) => !removed.includes(n.id)));
    finish();
  }, [toolbar]);

  const deleteNote = useCallback((id) => {
    const r = noteRanges.current.get(id);
    if (r) registry.current?.note.delete(r);
    noteRanges.current.delete(id);
    setNotes((list) => list.filter((n) => n.id !== id));
  }, []);

  const updateNote = useCallback((id, body) => setNotes((list) => list.map((n) => (n.id === id ? { ...n, body } : n))), []);

  return { supported, toolbar, highlight, addNote, clear, notes, deleteNote, updateNote };
}
