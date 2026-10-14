import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { studentLogin } from "../../api.js";
import { useStudentAuth } from "../../context/AuthContext.jsx";

// Hooks shared by the cover page and the sign-in screens.

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// "Try the demo": signs in with the seeded demo student.
export function useDemoLogin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { login } = useStudentAuth();
  const nav = useNavigate();
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const d = await studentLogin("student@example.com", "student123");
      login(d.token, d.user);
      nav("/dashboard");
    } catch {
      setBusy(false);
      setError("The demo account isn't available right now. Create a free account instead.");
    }
  };
  return { run, busy, error };
}

// Reveals the .ln-reveal elements that are already on screen.
export function revealInView() {
  const h = window.innerHeight;
  document.querySelectorAll(".ln-reveal:not(.in)").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < h && r.bottom > 0) el.classList.add("in");
  });
}

// Adds .in to every .ln-reveal element as it scrolls into view.
export function useReveal(deps = []) {
  useEffect(() => {
    if (!("IntersectionObserver" in window) || reducedMotion()) {
      document.querySelectorAll(".ln-reveal").forEach((el) => el.classList.add("in"));
      return undefined;
    }
    revealInView();
    const els = document.querySelectorAll(".ln-reveal:not(.in)");
    let heard = false;
    const io = new IntersectionObserver(
      (entries) => {
        heard = true;
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          io.unobserve(e.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => io.observe(el));
    // Where observers never report (some embedded views), show everything.
    const fallback = setTimeout(() => {
      if (!heard) els.forEach((el) => el.classList.add("in"));
    }, 1500);
    return () => {
      clearTimeout(fallback);
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// True while the element is on screen (demos only animate when visible).
// Starts true so a demo still plays where observers never report.
export function useInView(ref, margin = "0px") {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return inView;
}
