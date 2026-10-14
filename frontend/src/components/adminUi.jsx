import React from "react";
import Icon from "./Icon.jsx";
import StudentAvatar from "./avatar/Avatar.jsx";

const PALETTE = [
  ["#6d5dfc", "#8b5cf6"],
  ["#f97316", "#fb7185"],
  ["#0ea5e9", "#22d3ee"],
  ["#10b981", "#34d399"],
  ["#e11d48", "#f472b6"],
  ["#f59e0b", "#facc15"],
  ["#4f46e5", "#0ea5e9"]
];

export function Avatar({ name = "?", size = 36, radius, avatar }) {
  // A student who chose a profile picture is shown with it; everyone else keeps their initials.
  if (avatar?.id) return <StudentAvatar avatar={avatar} name={name} size={size} />;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = PALETTE[h % PALETTE.length];
  return (
    <span className="ad-ava" style={{ width: size, height: size, borderRadius: radius ?? size * 0.32, fontSize: size * 0.34, background: `linear-gradient(145deg, ${a}, ${b})` }}>
      {initials}
    </span>
  );
}

export function Sparkline({ data = [], color = "currentColor", className = "ad-kpi-spark" }) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * 100, 30 - (v / max) * 26]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg className={className} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L100 32 L0 32 Z`} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Kpi({ icon, tone, label, value, sub, spark, sparkColor }) {
  return (
    <div className="ad-kpi">
      <div className="ad-kpi-top">
        <span>{label}</span>
        <span className={`ad-kpi-icon tone-${tone}`}>
          <Icon name={icon} size={19} />
        </span>
      </div>
      <b>{value}</b>
      <small>{sub}</small>
      {spark && <Sparkline data={spark} color={sparkColor} />}
    </div>
  );
}

export const scoreClass = (scaled) => (scaled >= 600 ? "hi" : scaled >= 450 ? "mid" : "lo");
export const accClass = (acc) => (acc >= 0.8 ? "good" : acc >= 0.5 ? "mid" : "bad");

export function timeAgo(iso) {
  if (!iso) return "—";
  if (iso.length === 10) {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
    const days = Math.round((new Date(today + "T12:00:00Z") - new Date(iso + "T12:00:00Z")) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  const d = new Date(iso);
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Empty({ icon = "sparkles", children }) {
  return (
    <div className="ad-empty">
      <Icon name={icon} size={28} />
      {children}
    </div>
  );
}
