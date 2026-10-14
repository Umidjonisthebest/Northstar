import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../Icon.jsx";
import "./calculator.css";

// The Desmos graphing calculator, in a window that floats over a Math question: it can be dragged
// by its title bar, resized from its corner, made large, and closed. On a phone it is a sheet at
// the bottom of the screen instead.
//
// It is created once and then only hidden, so what the student typed is still there when they open
// it again (on the next question, for example). Leaving the page that renders it throws it away.
// With `warm`, it is created out of sight a moment after the screen says a Math question is up:
// Desmos takes several seconds to load the first time, and this way it is ready when asked for.
//
// Two ways of showing Desmos:
//  - No key (the default): the page Desmos runs for the digital SAT, in a frame. It is the
//    calculator students get in Bluebook on test day, and it needs nothing from us.
//  - VITE_DESMOS_API_KEY set (frontend/.env): Desmos's own embedding API, which is what Desmos
//    asks products to use. Keys come from https://www.desmos.com/my-api.
const SAT_PAGE = "https://www.desmos.com/testing/cb-digital-sat/graphing";
const API_KEY = (import.meta.env.VITE_DESMOS_API_KEY || "").trim();
const API_URL = "https://www.desmos.com/api/v1.11/calculator.js";
// Like the test's calculator: no pictures, folders, notes or links to other graphs.
const API_OPTIONS = { images: false, folders: false, notes: false, links: false, pasteGraphLink: false, border: false, autosize: true };

const BOX_KEY = "ns_calc_box";
const MIN_W = 320;
const MIN_H = 360;
const EDGE = 8;
// Docked: while the window sits against the left edge and there is room beside it, the question
// moves over instead of being covered (the screens read --gcalc-dock; see calculator.css).
const DOCK_WITHIN = 48;
const DOCK_ROOM = 480;

// Where it opens the first time: on the left, under the question screens' top bar and clear of
// their bottom bar, or on the right of an ordinary page (`place="right"`), away from the sidebar.
function defaultBox(place) {
  const w = 440;
  const h = Math.max(MIN_H, Math.min(560, window.innerHeight - 206));
  return { x: place === "right" ? window.innerWidth - w - 24 : 16, y: 108, w, h };
}
function readBox(place) {
  try {
    const b = JSON.parse(localStorage.getItem(`${BOX_KEY}_${place}`));
    if (b && [b.x, b.y, b.w, b.h].every(Number.isFinite)) return b;
  } catch {
    /* fall through to the default */
  }
  return defaultBox(place);
}
function saveBox(place, box) {
  try {
    localStorage.setItem(`${BOX_KEY}_${place}`, JSON.stringify(box));
  } catch {
    /* private mode: the position just isn't remembered */
  }
}

// Keeps the window inside the screen, whatever was stored and however the browser was resized.
function fit(box) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.round(Math.max(Math.min(MIN_W, vw - 2 * EDGE), Math.min(box.w, vw - 2 * EDGE)));
  const h = Math.round(Math.max(Math.min(MIN_H, vh - 2 * EDGE), Math.min(box.h, vh - 2 * EDGE)));
  return { w, h, x: Math.round(Math.max(EDGE, Math.min(box.x, vw - w - EDGE))), y: Math.round(Math.max(EDGE, Math.min(box.y, vh - h - EDGE))) };
}

let apiLoading = null;
function loadDesmos() {
  if (window.Desmos) return Promise.resolve(window.Desmos);
  apiLoading ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${API_URL}?apiKey=${encodeURIComponent(API_KEY)}`;
    script.async = true;
    script.onload = () => (window.Desmos ? resolve(window.Desmos) : reject(new Error("Desmos didn't start")));
    script.onerror = () => {
      // Let "Try again" make a fresh request.
      apiLoading = null;
      script.remove();
      reject(new Error("Couldn't reach Desmos"));
    };
    document.head.appendChild(script);
  });
  return apiLoading;
}

// Desmos through its API: built once, resized with its window, destroyed with it.
function ApiCalculator({ onState }) {
  const host = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    let calc = null;
    setFailed(false);
    onState("loading");
    loadDesmos()
      .then((Desmos) => {
        if (!alive || !host.current) return;
        calc = Desmos.GraphingCalculator(host.current, API_OPTIONS);
        onState("ready");
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        onState("failed");
      });
    return () => {
      alive = false;
      calc?.destroy();
    };
  }, [attempt, onState]);
  if (failed) {
    return (
      <div className="gcalc-msg" role="alert">
        <b>The calculator didn't load</b>
        <span>Check your connection and try again.</span>
        <button type="button" className="gcalc-retry" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </div>
    );
  }
  return <div className="gcalc-api" ref={host} />;
}

// `locked`: inside a locked test (lock/useExamLock.js) there is no "open in a new tab", which
// would be leaving the test.
export default function GraphingCalculator({ open, onClose, place = "left", warm = false, locked = false }) {
  const [used, setUsed] = useState(false);
  const [box, setBox] = useState(() => readBox(place));
  const [large, setLarge] = useState(false);
  const [moving, setMoving] = useState(false);
  const [state, setState] = useState("loading");
  const win = useRef(null);
  const boxRef = useRef(box);
  useEffect(() => {
    boxRef.current = box;
  });

  // Built on first opening, or ahead of it when `warm` (not on a data-saving connection), then kept.
  if (open && !used) setUsed(true);
  useEffect(() => {
    if (!warm || used || navigator.connection?.saveData) return undefined;
    const timer = setTimeout(() => setUsed(true), 1500);
    return () => clearTimeout(timer);
  }, [warm, used]);
  // However it was left, and however the browser is resized, it stays on the screen.
  useEffect(() => {
    if (!open) return undefined;
    const keepInView = () => setBox((b) => fit(b));
    keepInView();
    window.addEventListener("resize", keepInView);
    return () => window.removeEventListener("resize", keepInView);
  }, [open]);

  // Tell the page how much of its left side the window takes while it is docked there.
  const docked = open && !large && box.x <= DOCK_WITHIN;
  useEffect(() => {
    const root = document.documentElement;
    const set = () => {
      const room = window.innerWidth - (box.x + box.w);
      if (docked && window.innerWidth > 720 && room >= DOCK_ROOM) root.style.setProperty("--gcalc-dock", `${box.x + box.w}px`);
      else root.style.removeProperty("--gcalc-dock");
    };
    set();
    window.addEventListener("resize", set);
    return () => {
      window.removeEventListener("resize", set);
      root.style.removeProperty("--gcalc-dock");
    };
  }, [docked, box.x, box.w]);

  // Escape closes it while the keyboard is on its title bar. (Inside the calculator itself the
  // keys belong to Desmos.)
  const onKeyDown = (e) => {
    if (e.key === "Escape" && e.target.closest(".gcalc-bar")) {
      e.stopPropagation();
      onClose();
    }
  };

  // Dragging and resizing follow the pointer from where it went down. The pointer is captured, and
  // the frame ignores it meanwhile, so the calculator underneath can't swallow the movement.
  const track = useCallback((e, apply) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    const target = e.currentTarget;
    const start = { px: e.clientX, py: e.clientY, ...boxRef.current };
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* no capture: the frame is switched off while moving, so the pointer still reaches us */
    }
    setMoving(true);
    let last = boxRef.current;
    const move = (ev) => {
      last = fit(apply(start, ev.clientX - start.px, ev.clientY - start.py));
      setBox(last);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setMoving(false);
      saveBox(place, last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }, [place]);
  const startDrag = (e) => {
    if (large || e.target.closest("button, a")) return;
    track(e, (s, dx, dy) => ({ ...s, x: s.x + dx, y: s.y + dy }));
  };
  const startResize = (e) => track(e, (s, dx, dy) => ({ ...s, w: Math.max(MIN_W, s.w + dx), h: Math.max(MIN_H, s.h + dy) }));
  // Arrow keys move the window too, for anyone not using a pointer.
  const nudge = (e) => {
    const step = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[e.key];
    if (!step || large) return;
    e.preventDefault();
    e.stopPropagation();
    const next = fit({ ...boxRef.current, x: boxRef.current.x + step[0], y: boxRef.current.y + step[1] });
    setBox(next);
    saveBox(place, next);
  };

  if (!used) return null;
  return createPortal(
    <section
      ref={win}
      className={`gcalc ${large ? "large" : ""} ${moving ? "moving" : ""} ${open ? "" : "closed"}`}
      style={large ? undefined : { left: box.x, top: box.y, width: box.w, height: box.h }}
      // Closed, it keeps its size out of sight (not display: none), so Desmos lays itself out once
      // and is simply there when the window opens.
      aria-hidden={!open}
      inert={!open}
      role="dialog"
      aria-label="Graphing calculator"
      onKeyDown={onKeyDown}
    >
      <header className="gcalc-bar" onPointerDown={startDrag}>
        <button type="button" className="gcalc-grip" aria-label="Move the calculator (arrow keys)" title="Drag to move" onKeyDown={nudge}>
          <Icon name="calc" size={18} />
        </button>
        <b>Calculator</b>
        <small>Desmos</small>
        <span className="gcalc-space" />
        {!API_KEY && !locked && (
          <a className="gcalc-btn" href={SAT_PAGE} target="_blank" rel="noreferrer" aria-label="Open the calculator in a new tab" title="Open in a new tab">
            <Icon name="external" size={17} />
          </a>
        )}
        <button type="button" className="gcalc-btn" onClick={() => setLarge((v) => !v)} aria-pressed={large} aria-label={large ? "Make the calculator smaller" : "Make the calculator larger"} title={large ? "Smaller" : "Larger"}>
          <Icon name={large ? "shrink" : "expand"} size={17} />
        </button>
        <button type="button" className="gcalc-btn" onClick={onClose} aria-label="Close the calculator" title="Close">
          <Icon name="close" size={18} />
        </button>
      </header>
      <div className="gcalc-body">
        {API_KEY ? (
          <ApiCalculator onState={setState} />
        ) : (
          <>
            {/* Desmos's page is see-through until it has drawn itself, which can take a few seconds
                the first time: this note sits underneath and shows through until then. It is taken
                away a while after the page arrives, so it can't flash through again when the
                window is resized. */}
            {state !== "settled" && (
              <div className="gcalc-msg gcalc-loading" role="status" aria-hidden={state !== "loading"}>
                <span className="gcalc-spin" />
                <span>Opening the calculator…</span>
              </div>
            )}
            <iframe
              className="gcalc-frame"
              src={SAT_PAGE}
              title="Desmos graphing calculator"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              onLoad={() => {
                setState("ready");
                setTimeout(() => setState("settled"), 15000);
              }}
            />
          </>
        )}
        {API_KEY && state === "loading" && (
          <div className="gcalc-msg gcalc-loading" role="status">
            <span className="gcalc-spin" />
            <span>Opening the calculator…</span>
          </div>
        )}
      </div>
      {!large && <span className="gcalc-resize" onPointerDown={startResize} aria-hidden="true" />}
    </section>,
    document.body
  );
}
