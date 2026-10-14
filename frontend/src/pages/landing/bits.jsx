import React, { useEffect, useRef, useState } from "react";
import { reducedMotion } from "./hooks.js";

// Small presentational pieces for the cover page (hooks live in hooks.js).

// Counts up from 0 the first time it scrolls into view.
export function CountUp({ to, decimals = 0 }) {
  const ref = useRef(null);
  const [val, setVal] = useState(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return undefined;
    let raf = 0;
    let heard = false;
    const fallback = setTimeout(() => {
      if (!heard) setVal(to);
    }, 1500);
    const io = new IntersectionObserver(([e]) => {
      heard = true;
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      // A frame's timestamp can be a little before `start`, which made the first frame negative
      // ("-3 questions"). And where frames don't run (a hidden tab), land on the number anyway.
      setTimeout(() => setVal(to), 1700);
      const tick = (t) => {
        const p = Math.max(0, Math.min(1, (t - start) / 1300));
        setVal(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      clearTimeout(fallback);
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return <span ref={ref}>{val.toFixed(decimals)}</span>;
}

// ---- Floating "3D" tiles around the hero demo ----

export function QuestionTile() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <rect x="22" y="16" width="46" height="60" rx="9" fill="#fff" stroke="#c9c3ff" strokeWidth="3" />
      <rect x="34" y="10" width="22" height="12" rx="5" fill="#8b7ff8" />
      <path d="M31 36h28M31 46h22M31 56h26" stroke="#d9d5ff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="66" cy="62" r="17" fill="#6f5cf5" />
      <path d="M60.5 56.5a5.8 5.8 0 1 1 8 5.4c-1.7.7-2.5 1.8-2.5 3.6" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="66" cy="71" r="2.3" fill="#fff" />
    </svg>
  );
}

export function CardsTile() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <g transform="rotate(-10 48 44)">
        <rect x="18" y="22" width="56" height="38" rx="8" fill="#ffc278" />
      </g>
      <g transform="rotate(6 48 46)">
        <rect x="20" y="26" width="56" height="38" rx="8" fill="#ff9d42" />
        <path d="M30 38h28M30 47h36M30 56h20" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".9" />
      </g>
      <circle cx="36" cy="80" r="6" fill="#39c07f" />
      <path d="M33.3 80l2 2 3.6-4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="52" cy="80" r="3" fill="#ffd1a3" />
      <circle cx="62" cy="80" r="3" fill="#ffd1a3" />
      <circle cx="74" cy="80" r="6" fill="#f26b5b" />
      <path d="M71.7 77.7l4.6 4.6m0-4.6l-4.6 4.6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ChartTile() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <path d="M20 18v58h58" fill="none" stroke="#d7cbff" strokeWidth="3" strokeLinecap="round" />
      <path d="M34 18v58M50 18v58M66 18v58" stroke="#e7dfff" strokeWidth="2" strokeDasharray="3 5" />
      <path d="M22 66L38 50l14 8 22-30" fill="none" stroke="#8b5cf6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 7" />
      <circle cx="22" cy="66" r="5" fill="#8b5cf6" />
      <circle cx="38" cy="50" r="5" fill="#8b5cf6" />
      <circle cx="52" cy="58" r="5" fill="#8b5cf6" />
      <circle cx="74" cy="28" r="7" fill="#a78bfa" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}

// The IELTS card's art on the "Two exams" section.
export function IeltsArt() {
  return (
    <svg className="ln-exam-art" viewBox="0 0 260 200" aria-hidden="true">
      <circle cx="138" cy="100" r="86" fill="#fff" opacity=".14" />
      <circle cx="138" cy="100" r="56" fill="#fff" opacity=".12" />
      <path d="M78 118C74 56 202 56 198 118" fill="none" stroke="#0b3a70" strokeWidth="11" strokeLinecap="round" />
      <rect x="58" y="104" width="34" height="56" rx="16" fill="#ffd166" stroke="#0b3a70" strokeWidth="5" />
      <rect x="184" y="104" width="34" height="56" rx="16" fill="#ffd166" stroke="#0b3a70" strokeWidth="5" />
      <g fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".9">
        <path d="M40 116q-8 16 0 32" />
        <path d="M28 108q-14 24 0 48" />
        <path d="M236 116q8 16 0 32" />
        <path d="M248 108q14 24 0 48" />
      </g>
      <rect x="112" y="18" width="62" height="38" rx="12" fill="#fff" />
      <path d="M130 56l-6 12 16-12z" fill="#fff" />
      <text x="143" y="44" textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight="800" fontSize="19" fill="#0b6fbf">
        7.5
      </text>
    </svg>
  );
}
