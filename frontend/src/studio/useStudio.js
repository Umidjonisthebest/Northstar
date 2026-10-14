import { useAdminAuth } from "../context/AuthContext.jsx";
import { panelHas } from "./panels.js";

// Which kind of staff is looking at a shared page, for the few places where the two panels differ
// (see panels.js). The server enforces every one of these differences; this only keeps a page from
// offering what would be refused.
export function useStudio() {
  const { role } = useAdminAuth();
  return { panel: role, isAdmin: role === "admin", isTeacher: role === "teacher", has: (key) => panelHas(role, key) };
}
