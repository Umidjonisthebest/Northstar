import { createContext, useContext } from "react";

// Every IELTS screen renders inside <IeltsScope variant>, whose `.ie-root` class
// scopes the IELTS styles so they never leak into Northstar pages. Overlays
// (modals, drawers, popovers, toasts) are portaled into a body-level root that
// carries the same classes, so they get the same styles — and the admin variant
// follows Northstar's dark mode while the candidate exam always stays light.
export const ScopeContext = createContext("admin");

const roots = new Map();

export function portalRoot(variant) {
  let el = roots.get(variant);
  if (!el) {
    el = document.createElement("div");
    el.className = `ie-root ie-root--${variant} ie-portal-root`;
    document.body.appendChild(el);
    roots.set(variant, el);
  }
  return el;
}

export function usePortalRoot() {
  return portalRoot(useContext(ScopeContext));
}
