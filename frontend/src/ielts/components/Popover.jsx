import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePortalRoot } from "../scope.js";

// Fixed-position popover anchored to an element, portaled to the body-level
// IELTS root so it is never clipped by modals or scroll containers.
export function Popover({ anchorRef, open, onClose, children, width = "anchor", minWidth, align = "start", className = "", maxHeight = 320 }) {
  const portal = usePortalRoot();
  const popRef = useRef(null);
  const [style, setStyle] = useState(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const w = width === "anchor" ? Math.max(r.width, minWidth || 0) : width;
      let left = align === "end" ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      const below = window.innerHeight - r.bottom;
      const above = r.top;
      const popHeight = popRef.current?.offsetHeight || Math.min(maxHeight, 240);
      const flip = below < popHeight + 12 && above > below;
      setStyle(flip ? { left, bottom: window.innerHeight - r.top + 6, width: w } : { left, top: r.bottom + 6, width: w });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, width, minWidth, align, maxHeight]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      closeRef.current?.();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current?.();
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div ref={popRef} className={`ie-popover ${className}`} style={{ ...(style || { visibility: "hidden", top: 0, left: 0 }) }}>
      {children}
    </div>,
    portal
  );
}
