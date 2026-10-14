import { useEffect, useRef, useState } from "react";

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Warns before closing the tab while `when` is true.
export function useBeforeUnload(when) {
  useEffect(() => {
    if (!when) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [when]);
}

export function useLatest(value) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
