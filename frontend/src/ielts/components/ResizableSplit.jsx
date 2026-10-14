import { useCallback, useRef, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";

// Two panes with a draggable divider (the round "<>" handle from the reference UI).
export function ResizableSplit({ left, right, initial = 50, min = 25, max = 75, className = "", leftClassName = "", rightClassName = "", storageKey }) {
  const [pct, setPct] = useState(() => {
    const saved = storageKey ? Number(sessionStorage.getItem(storageKey)) : NaN;
    return Number.isFinite(saved) && saved >= min && saved <= max ? saved : initial;
  });
  const [dragging, setDragging] = useState(false);
  const boxRef = useRef(null);

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault();
      const box = boxRef.current.getBoundingClientRect();
      setDragging(true);
      const move = (ev) => {
        const next = Math.min(max, Math.max(min, ((ev.clientX - box.left) / box.width) * 100));
        setPct(next);
        if (storageKey) sessionStorage.setItem(storageKey, String(next));
      };
      const up = () => {
        setDragging(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [min, max, storageKey]
  );

  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft") setPct((p) => Math.max(min, p - 2));
    if (e.key === "ArrowRight") setPct((p) => Math.min(max, p + 2));
  };

  return (
    <div ref={boxRef} className={`ie-split ${dragging ? "ie-split--dragging" : ""} ${className}`}>
      <div className={`ie-split__pane ${leftClassName}`} style={{ width: `calc(${pct}% - 12px)` }}>
        {left}
      </div>
      <div className="ie-split__handle" onPointerDown={onPointerDown} onKeyDown={onKeyDown} role="separator" aria-orientation="vertical" tabIndex={0}>
        <span className="ie-split__knob">
          <ChevronsLeftRight />
        </span>
      </div>
      <div className={`ie-split__pane ${rightClassName}`} style={{ width: `calc(${100 - pct}% - 12px)` }}>
        {right}
      </div>
    </div>
  );
}
