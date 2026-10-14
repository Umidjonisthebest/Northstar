import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { usePortalRoot } from "../scope.js";

const ToastContext = createContext(null);

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };

export function ToastProvider({ children }) {
  const portal = usePortalRoot();
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (kind, title, description, duration = 3800) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, kind, title, description }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (title, description) => push("success", title, description),
      error: (title, description) => push("error", title, description, 5500),
      info: (title, description) => push("info", title, description)
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="ie-toasts" role="status" aria-live="polite">
          {toasts.map((t) => {
            const Icon = ICONS[t.kind];
            return (
              <div key={t.id} className={`ie-toast ie-toast--${t.kind}`} onClick={() => dismiss(t.id)}>
                <Icon />
                <div>
                  <div className={t.description ? "ie-toast__title" : undefined}>{t.title}</div>
                  {t.description && <div className="ie-toast__desc">{t.description}</div>}
                </div>
              </div>
            );
          })}
        </div>,
        portal
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
