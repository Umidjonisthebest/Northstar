import { useCallback, useEffect, useRef, useState } from "react";

// The test lock, as far as a web page can lock anything. A browser never lets a page stop the
// student switching to another tab, window or app, so the page does the next best thing: it
// notices the moment it is no longer the thing in front, and says so.
//
//   mode "strict" (mock tests, diagnostic tests): the first leave ends the test. `onLeave(kind)`
//     is called once; the screen that uses the hook cancels the test on the server and shows
//     <LockEnded>. The test also runs in full screen where the browser has one (`needFullscreen`
//     is true while it has dropped out: the screen covers the test with <LockGate> until the
//     student is back in), and copying out of the test, pasting into it from outside, right-click
//     and the print / save / find / reload keys are switched off.
//   mode "report" (homework): nothing is closed. `onLeave(kind)` is called each time the student
//     leaves and `onReturn(seconds)` when they are back, for the teacher's count.
//
// What counts as leaving (`kind`):
//   "hidden"  the page is no longer shown: another tab, the window minimised, another app on a
//             phone, the screen locked
//   "blur"    the page is shown but another window has the keyboard (a second window beside it,
//             the address bar, the developer tools) for longer than BLUR_GRACE_MS
//   "closed"  the page is being closed or reloaded (strict only: stopping homework for the day is
//             not "leaving")
//   "exit"    the screen went away inside the app (the Back button) while the test was running
// Typing in the calculator's frame is not leaving: the document still has the focus then.
//
// It can't see a second device, and a student who can rewrite the page can switch it off. The
// real lock for a school computer room is a kiosk browser; this is the rule for everywhere else.

const BLUR_GRACE_MS = 1200;
const FOCUS_POLL_MS = 300;

const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
// Phones' browsers mostly have no full screen for a page (iPhone Safari has none at all).
export const fullscreenSupported = () => Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
export const isFullscreen = () => Boolean(fullscreenElement());

// Must be called from a click or a key press. Resolves to whether the page is in full screen.
export function enterFullscreen() {
  if (fullscreenElement()) return Promise.resolve(true);
  const el = document.documentElement;
  const ask = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!ask || !fullscreenSupported()) return Promise.resolve(false);
  try {
    return Promise.resolve(ask.call(el, { navigationUI: "hide" })).then(
      () => {
        // Where the browser can (Chrome, Edge), a tap on Escape no longer drops out of full screen:
        // it has to be held. A stray Escape is the commonest way out by accident.
        navigator.keyboard?.lock?.(["Escape"])?.catch?.(() => {});
        return true;
      },
      () => false
    );
  } catch {
    return Promise.resolve(false);
  }
}

export function exitFullscreen() {
  if (!fullscreenElement()) return;
  try {
    navigator.keyboard?.unlock?.();
    const leave = document.exitFullscreen || document.webkitExitFullscreen;
    Promise.resolve(leave?.call(document)).catch(() => {});
  } catch {
    // already out
  }
}

const BLOCKED_KEYS = new Set(["r", "p", "s", "f", "g", "u"]); // with Ctrl / Cmd: reload, print, save, find, find next, view source
const DEV_KEYS = new Set(["i", "j", "c"]); // with Ctrl / Cmd + Shift: the developer tools

const answerField = (el) => el?.closest?.("input, textarea, [contenteditable='true']") || null;
const sameText = (a, b) => a.replace(/\r\n/g, "\n") === b.replace(/\r\n/g, "\n");
function selectionIn(field) {
  if (typeof field.selectionStart === "number") return field.value.slice(field.selectionStart, field.selectionEnd);
  return window.getSelection()?.toString() || "";
}

export function useExamLock({ active, mode = "strict", onLeave, onReturn }) {
  const strict = mode === "strict";
  const [full, setFull] = useState(isFullscreen);
  const handlers = useRef({ onLeave, onReturn });
  const activeRef = useRef(false);
  const firedRef = useRef(false);
  useEffect(() => {
    handlers.current = { onLeave, onReturn };
  });

  useEffect(() => {
    const sync = () => setFull(isFullscreen());
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  // ---- Noticing a leave ----
  useEffect(() => {
    activeRef.current = active && strict;
    if (!active) return undefined;
    firedRef.current = false;
    let awaySince = 0; // report mode: when the student left
    let blurredAt = 0;
    let unloading = false;
    let wake = null;

    const leave = (kind) => {
      if (strict) {
        if (firedRef.current) return;
        firedRef.current = true;
        handlers.current.onLeave?.(kind);
      } else if (!awaySince && !unloading) {
        awaySince = Date.now();
        handlers.current.onLeave?.(kind);
      }
    };
    const back = () => {
      blurredAt = 0;
      if (!awaySince) return;
      const seconds = Math.round((Date.now() - awaySince) / 1000);
      awaySince = 0;
      handlers.current.onReturn?.(seconds);
    };
    const check = () => {
      if (document.visibilityState === "hidden") return leave(unloading ? "closed" : "hidden");
      if (document.hasFocus()) return back();
      if (!blurredAt) blurredAt = Date.now();
      else if (Date.now() - blurredAt >= BLUR_GRACE_MS) leave("blur");
    };
    // The screen stays on while the test runs, so reading a long passage without touching anything
    // doesn't lock a phone (which would hide the page, and count as leaving).
    const keepAwake = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        ?.request?.("screen")
        .then((w) => (wake = w))
        .catch(() => {});
    };
    const onVisibility = () => {
      check();
      keepAwake();
    };
    const onPageHide = () => {
      unloading = true;
      if (strict) leave("closed");
    };
    // "Leave site?" — the student can still stay. If they do, the page is not closing after all.
    const onBeforeUnload = (e) => {
      unloading = true;
      setTimeout(() => (unloading = false), 0);
      if (!strict) return;
      e.preventDefault();
      e.returnValue = "";
    };

    keepAwake();
    check();
    const poll = setInterval(check, FOCUS_POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", check);
    window.addEventListener("focus", check);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      wake?.release?.().catch(() => {});
    };
  }, [active, strict]);

  // The screen itself going away (the browser's Back button) while the test is running.
  useEffect(
    () => () => {
      if (!activeRef.current || firedRef.current) return;
      firedRef.current = true;
      handlers.current.onLeave?.("exit");
    },
    []
  );

  // ---- What a locked test switches off ----
  useEffect(() => {
    if (!active || !strict) return undefined;
    // The student's own words can be moved around inside an answer; nothing comes in from outside
    // the test, and nothing of the test goes out.
    let own = null;
    const onCopy = (e) => {
      const field = answerField(e.target);
      if (!field) return e.preventDefault();
      own = selectionIn(field);
    };
    const onPaste = (e) => {
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!answerField(e.target) || own === null || !sameText(text, own)) e.preventDefault();
    };
    const onMenu = (e) => e.preventDefault();
    const onKey = (e) => {
      const key = (e.key || "").toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const blocked = key === "f5" || key === "f3" || key === "f12" || (mod && !e.shiftKey && BLOCKED_KEYS.has(key)) || (mod && e.shiftKey && (DEV_KEYS.has(key) || key === "r"));
      if (!blocked) return;
      e.preventDefault();
      e.stopPropagation();
    };
    // An English test translated by the browser is not the test (and rewriting the page's text
    // under React breaks it).
    const html = document.documentElement;
    const translate = html.getAttribute("translate");
    html.setAttribute("translate", "no");

    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCopy, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("contextmenu", onMenu, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCopy, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("contextmenu", onMenu, true);
      window.removeEventListener("keydown", onKey, true);
      if (translate === null) html.removeAttribute("translate");
      else html.setAttribute("translate", translate);
    };
  }, [active, strict]);

  return { needFullscreen: active && strict && fullscreenSupported() && !full, enterFullscreen };
}

// ---- Telling the server ----
// A leave this browser saw is kept until the server has it, so going offline first (or closing the
// page before the report gets out) doesn't save the test: the next time the test is opened here,
// the report is sent again. `round` is the server's count of how many times a teacher has let the
// student back in; a kept report from an earlier round is thrown away.
const PENDING = "ns_lock_";
function readPending(key) {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING + key) || "null");
    return p && typeof p.kind === "string" ? p : null;
  } catch {
    return null;
  }
}
function writePending(key, value) {
  try {
    localStorage.setItem(PENDING + key, JSON.stringify(value));
  } catch {
    // no storage: the report below is still sent
  }
}
function clearPending(key) {
  try {
    localStorage.removeItem(PENDING + key);
  } catch {
    // nothing kept
  }
}

// `send(kind, round)` posts the report (with keepalive, so it survives the page closing).
// Returns:
//   ended           null, or { kind, sent } once the test is over on this device
//   end(kind, round)   the student has just left: remember it, show it, report it until it lands
//   show(kind)         the server already has it (it answered CANCELLED): only show it
//   resume(round)      call when the test opens: reports a kept leave. True when there was one.
export function useLeaveReport(key, send) {
  const [ended, setEnded] = useState(null);
  const sendRef = useRef(send);
  const mounted = useRef(true);
  const retry = useRef(null);
  useEffect(() => {
    sendRef.current = send;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(retry.current);
    };
  }, []);

  // Sends the report, and keeps trying (a little longer apart each time) while this screen is up.
  const push = useCallback(
    async (kind, round) => {
      for (let tries = 1; ; tries++) {
        let settled;
        try {
          await sendRef.current(kind, round);
          settled = true;
        } catch (err) {
          // Refused outright (the test is gone, the sign-in ended): asking again won't change it.
          settled = err?.status >= 400 && err.status < 500;
        }
        if (settled) {
          clearPending(key);
          if (mounted.current) setEnded((e) => e && { ...e, sent: true });
          return;
        }
        if (!mounted.current) return;
        await new Promise((resolve) => (retry.current = setTimeout(resolve, Math.min(15000, 2000 * tries))));
        if (!mounted.current) return;
      }
    },
    [key]
  );

  const end = useCallback(
    (kind, round = 0) => {
      writePending(key, { kind, round });
      setEnded({ kind, sent: false });
      push(kind, round);
    },
    [key, push]
  );

  const show = useCallback(
    (kind = null) => {
      clearPending(key);
      setEnded({ kind, sent: true });
    },
    [key]
  );

  const resume = useCallback(
    (round = 0) => {
      const kept = readPending(key);
      if (!kept) return false;
      if ((kept.round || 0) !== round) {
        clearPending(key);
        return false;
      }
      end(kept.kind, round);
      return true;
    },
    [key, end]
  );

  const forget = useCallback(() => clearPending(key), [key]);

  return { ended, end, show, resume, forget };
}
