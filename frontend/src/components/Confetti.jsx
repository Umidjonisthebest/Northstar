import React, { useEffect, useState } from "react";

const COLORS = ["#1664e2", "#1cb0f6", "#ffc93c", "#36d08c", "#ff6aa4", "#9a6cff"];

// Lightweight CSS confetti. Re-fires whenever `trigger` changes. `hidden`
// keeps it off screen (exam mode) without re-firing when it comes back.
export default function Confetti({ trigger, hidden = false }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!trigger) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const batch = Array.from({ length: 70 }, (_, i) => ({
      id: `${trigger}-${i}`,
      left: Math.random() * 100,
      delay: Math.random() * 0.25,
      dur: 1.6 + Math.random() * 1.2,
      size: 6 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
      drift: (Math.random() - 0.5) * 160,
      spin: Math.random() * 720
    }));
    setPieces(batch);
    const t = setTimeout(() => setPieces([]), 3200);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!pieces.length || hidden) return null;
  return (
    <div className="ns-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            "--drift": `${p.drift}px`,
            "--spin": `${p.spin}deg`
          }}
        />
      ))}
    </div>
  );
}
