import { useEffect, useState } from "react";
import { presencePing } from "../../api.js";

const BEAT_MS = 60000;

// Sends the "studying now" heartbeat about once a minute while the page is
// visible, and returns what the server replies: { few, count }, an anonymous
// count of students active in the last two minutes (or null before the first
// reply, and when the server can't be reached). Never used on exam screens.
export function usePresence(token) {
  const [presence, setPresence] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    let last = 0;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      last = Date.now();
      presencePing(token)
        .then((d) => alive && setPresence(d))
        .catch(() => alive && setPresence(null));
    };
    // Coming back to the tab counts as being here again, without waiting for the next tick.
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > BEAT_MS / 2) beat();
    };
    beat();
    const timer = setInterval(beat, BEAT_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  return presence;
}
