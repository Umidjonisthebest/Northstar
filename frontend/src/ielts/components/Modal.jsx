import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { usePortalRoot } from "../scope.js";
import { Button } from "./ui.jsx";

let openCount = 0;

function useBodyLock(open) {
  useEffect(() => {
    if (!open) return undefined;
    openCount++;
    document.body.style.overflow = "hidden";
    return () => {
      openCount--;
      if (openCount === 0) document.body.style.overflow = "";
    };
  }, [open]);
}

// Stacked layers (drawer → modal → nested modal): Escape closes only the top one.
const layerStack = [];

function useEscape(open, onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    layerStack.push(token);
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented || layerStack[layerStack.length - 1] !== token) return;
      e.preventDefault();
      ref.current?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = layerStack.indexOf(token);
      if (i !== -1) layerStack.splice(i, 1);
    };
  }, [open]);
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  headerExtra,
  children,
  footer,
  width = 520,
  className = "",
  bodyClassName = "",
  footerBordered = false,
  closeOnOverlay = true,
  closeRing = false
}) {
  const portal = usePortalRoot();
  useBodyLock(open);
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div
      className="ie-overlay"
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={`ie-modal ${className}`} style={{ maxWidth: width }} role="dialog" aria-modal="true">
        {(title || onClose) && (
          <div className="ie-modal__header">
            {icon}
            <div style={{ minWidth: 0, flex: 1 }}>
              {title && <h2 className="ie-modal__title">{title}</h2>}
              {subtitle && <div className="ie-modal__subtitle">{subtitle}</div>}
            </div>
            {headerExtra}
            {onClose && (
              <button type="button" className={`ie-modal__close ${closeRing ? "ie-modal__close--ring" : ""}`} onClick={onClose} aria-label="Close">
                <X />
              </button>
            )}
          </div>
        )}
        <div className={`ie-modal__body ${bodyClassName}`}>{children}</div>
        {footer && <div className={`ie-modal__footer ${footerBordered ? "ie-modal__footer--bordered" : ""}`}>{footer}</div>}
      </div>
    </div>,
    portal
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel, busy = false, danger = true }) {
  const portal = usePortalRoot();
  useBodyLock(open);
  useEscape(open, onCancel);
  if (!open) return null;
  return createPortal(
    <div className="ie-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel?.()}>
      <div className="ie-modal" style={{ maxWidth: 576 }} role="alertdialog" aria-modal="true">
        <button type="button" className="ie-modal__close" style={{ position: "absolute", right: 14, top: 14 }} onClick={onCancel} aria-label="Close">
          <X />
        </button>
        <div className="ie-confirm">
          <h3>{title}</h3>
          {message && <p>{message}</p>}
          <div className="ie-confirm__actions">
            <Button variant="outline" onClick={onCancel} disabled={busy}>
              {cancelLabel}
            </Button>
            <Button variant={danger ? "primary" : "dark"} onClick={onConfirm} loading={busy}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    portal
  );
}

export function Drawer({ open, onClose, children, width = 640, className = "" }) {
  const portal = usePortalRoot();
  useBodyLock(open);
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <>
      <div className="ie-drawer-overlay" onMouseDown={onClose} />
      <aside className={`ie-drawer ${className}`} style={{ width: `min(${width}px, 100vw)` }} role="dialog" aria-modal="true">
        {children}
      </aside>
    </>,
    portal
  );
}
