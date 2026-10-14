import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useBackdropClose from "./useBackdropClose.js";

// The app's own "Are you sure?" dialog, in place of the browser's confirm() popup (which can't be
// styled, is blocked in some embedded browsers, and looks like a phishing page on a phone).
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "Delete this test?", message: "…", confirmLabel: "Delete" }))) return;
//
// Resolves true on the confirm button and false on Cancel, Escape or a click on the backdrop.
// `danger` (the default) paints the confirm button as a destructive action.

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [ask, setAsk] = useState(null); // { title, message, confirmLabel, cancelLabel, danger, resolve }

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setAsk({ danger: true, confirmLabel: "Delete", cancelLabel: "Cancel", ...(typeof opts === "string" ? { title: opts } : opts), resolve });
      }),
    []
  );

  const settle = useCallback((answer) => {
    setAsk((current) => {
      current?.resolve(answer);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {ask && <ConfirmDialog ask={ask} onAnswer={settle} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm needs <ConfirmProvider> above it");
  return confirm;
}

function ConfirmDialog({ ask, onAnswer }) {
  const backdrop = useBackdropClose(() => onAnswer(false));
  const cancelRef = useRef(null);

  // Focus starts on Cancel, so pressing Enter by reflex never deletes anything.
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onAnswer(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAnswer]);

  return createPortal(
    <div className="modal-backdrop" {...backdrop} style={{ zIndex: 200 }}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={ask.message ? "confirm-message" : undefined} style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="confirm-title">{ask.title}</h2>
        </div>
        {ask.message && (
          <p id="confirm-message" style={{ margin: "0 0 22px", color: "var(--ink-soft)", lineHeight: 1.55 }}>
            {ask.message}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <button type="button" ref={cancelRef} className="btn btn-secondary" onClick={() => onAnswer(false)}>
            {ask.cancelLabel}
          </button>
          <button type="button" className={`btn ${ask.danger ? "btn-danger" : "btn-primary"}`} onClick={() => onAnswer(true)}>
            {ask.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
