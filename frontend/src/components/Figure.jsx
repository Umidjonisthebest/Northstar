import React from "react";

// Figures for Math questions, drawn from the question's `figure` spec
// (see backend/content/mathGen.js). Strokes use currentColor so figures
// follow the theme; labels use the text tokens.

function Label({ x, y, children, anchor = "middle", size = 14 }) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="fig-label" fontSize={size}>
      {children}
    </text>
  );
}

function RightTriangle({ f }) {
  const [C, A, B] = f.labels || [];
  return (
    <svg viewBox="0 0 260 186" className="fig">
      <path d="M40 150H220L40 40Z" className="fig-shape" />
      <path d="M40 136h14v14" className="fig-line" />
      {f.base != null && <Label x={130} y={168}>{f.base}</Label>}
      {f.height != null && <Label x={24} y={96}>{f.height}</Label>}
      {f.hyp != null && <Label x={140} y={82}>{f.hyp}</Label>}
      {f.angle && (
        <>
          <path d="M196 150a24 24 0 0 0-4.5-14" className="fig-line" />
          <Label x={176} y={140} size={12}>{f.angle}</Label>
        </>
      )}
      {C && <Label x={28} y={164}>{C}</Label>}
      {A && <Label x={232} y={162}>{A}</Label>}
      {B && <Label x={28} y={30}>{B}</Label>}
    </svg>
  );
}

function Triangle({ f }) {
  const [a, b, c] = f.angles || [];
  return (
    <svg viewBox="0 0 260 176" className="fig">
      <path d="M28 150H232L96 26Z" className="fig-shape" />
      <Label x={62} y={138} size={13}>{a}</Label>
      <Label x={196} y={138} size={13}>{b}</Label>
      <Label x={100} y={58} size={13}>{c}</Label>
    </svg>
  );
}

function Parallel({ f }) {
  const theta = ((f.theta || 60) * Math.PI) / 180;
  const top = 55;
  const bottom = 140;
  const d = (bottom - top) / Math.tan(theta);
  const B = [150 - d / 2, bottom];
  const T = [150 + d / 2, top];
  const u = [Math.cos(theta), -Math.sin(theta)];
  const start = [B[0] - u[0] * 42, B[1] - u[1] * 42];
  const end = [T[0] + u[0] * 42, T[1] + u[1] * 42];
  const bisector = { tr: theta / 2, tl: (theta + Math.PI) / 2, bl: Math.PI + theta / 2, br: (3 * Math.PI) / 2 + theta / 2 };
  const place = (P, pos) => [P[0] + 24 * Math.cos(bisector[pos]), P[1] - 24 * Math.sin(bisector[pos])];
  return (
    <svg viewBox="0 0 300 196" className="fig">
      <defs>
        <marker id="fig-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="currentColor" />
        </marker>
      </defs>
      <path d={`M16 ${top}H284`} className="fig-line" markerStart="url(#fig-arrow)" markerEnd="url(#fig-arrow)" />
      <path d={`M16 ${bottom}H284`} className="fig-line" markerStart="url(#fig-arrow)" markerEnd="url(#fig-arrow)" />
      <path d={`M${start[0]} ${start[1]}L${end[0]} ${end[1]}`} className="fig-line" markerStart="url(#fig-arrow)" markerEnd="url(#fig-arrow)" />
      <Label x={292} y={top - 12} size={15}>ℓ</Label>
      <Label x={292} y={bottom - 12} size={15}>m</Label>
      {(f.labels || []).map((l, i) => {
        const [x, y] = place(l.line === "top" ? T : B, l.pos);
        return (
          <Label key={i} x={x} y={y} size={13}>
            {l.text}
          </Label>
        );
      })}
    </svg>
  );
}

function Circle({ f }) {
  const cx = 110;
  const cy = 92;
  const r = 70;
  const a = ((f.angle || 0) * Math.PI) / 180;
  const p = [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  return (
    <svg viewBox="0 0 220 186" className="fig">
      <circle cx={cx} cy={cy} r={r} className="fig-shape" />
      {f.angle ? (
        <>
          <path d={`M${cx + r} ${cy}A${r} ${r} 0 ${f.angle > 180 ? 1 : 0} 0 ${p[0]} ${p[1]}`} className="fig-accent" />
          <path d={`M${cx} ${cy}H${cx + r}M${cx} ${cy}L${p[0]} ${p[1]}`} className="fig-line" />
          <path d={`M${cx + 16} ${cy}A16 16 0 ${f.angle > 180 ? 1 : 0} 0 ${cx + 16 * Math.cos(a)} ${cy - 16 * Math.sin(a)}`} className="fig-line" />
          <Label x={cx + 30 * Math.cos(a / 2)} y={cy - 30 * Math.sin(a / 2)} size={12}>{`${f.angle}°`}</Label>
          {f.radius && <Label x={cx + r / 2} y={cy + 13} size={13}>{f.radius}</Label>}
        </>
      ) : f.diameter ? (
        <>
          <path d={`M${cx - r} ${cy}H${cx + r}`} className="fig-line" />
          <Label x={cx} y={cy - 12}>{f.diameter}</Label>
        </>
      ) : (
        f.radius && (
          <>
            <path d={`M${cx} ${cy}H${cx + r}`} className="fig-line" />
            <Label x={cx + r / 2} y={cy - 12}>{f.radius}</Label>
          </>
        )
      )}
      <circle cx={cx} cy={cy} r="2.8" fill="currentColor" />
    </svg>
  );
}

function Box({ f }) {
  return (
    <svg viewBox="0 0 260 186" className="fig">
      <path d="M40 62H170V152H40ZM40 62 80 32H210L170 62M170 152 210 122V32" className="fig-shape" />
      <path d="M40 152 80 122H210M80 122V32" className="fig-hidden" />
      <Label x={105} y={170}>{f.l}</Label>
      <Label x={22} y={108} anchor="middle">{f.h}</Label>
      <Label x={214} y={146} anchor="start">{f.w}</Label>
    </svg>
  );
}

function Cylinder({ f }) {
  return (
    <svg viewBox="0 0 220 200" className="fig">
      <ellipse cx="110" cy="44" rx="70" ry="18" className="fig-shape" />
      <path d="M40 44V160M180 44V160M40 160A70 18 0 0 0 180 160" className="fig-line" />
      <path d="M40 160A70 18 0 0 1 180 160" className="fig-hidden" />
      <path d="M110 44H180" className="fig-line" />
      <circle cx="110" cy="44" r="2.6" fill="currentColor" />
      <Label x={145} y={32} size={13}>{f.r}</Label>
      <Label x={198} y={102} size={13} anchor="start">{f.h}</Label>
    </svg>
  );
}

function niceStep(span, ticks = 5) {
  const raw = span / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}

function Scatter({ f }) {
  const W = 340;
  const H = 230;
  const L = 46;
  const R = 12;
  const T = 14;
  const B = 44;
  const xs = f.points.map((p) => p[0]);
  const ys = f.points.map((p) => p[1]);
  const xStep = niceStep(Math.max(...xs), 5);
  const xMax = Math.ceil((Math.max(...xs) * 1.05) / xStep) * xStep;
  const yLo = Math.min(0, Math.floor(Math.min(...ys) / 10) * 10);
  const yStep = niceStep(Math.max(...ys) * 1.1 - yLo, 5);
  const yMax = Math.ceil((Math.max(...ys) * 1.08) / yStep) * yStep;
  const sx = (x) => L + (x / xMax) * (W - L - R);
  const sy = (y) => H - B - ((y - yLo) / (yMax - yLo)) * (H - B - T);
  const xTicks = [];
  for (let v = 0; v <= xMax + 1e-9; v += xStep) xTicks.push(v);
  const yTicks = [];
  for (let v = yLo; v <= yMax + 1e-9; v += yStep) yTicks.push(v);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const clampY = (y) => Math.max(yLo, Math.min(yMax, y));
  const lineAt = (x) => clampY(f.line.m * x + f.line.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fig fig-scatter">
      {yTicks.map((v) => (
        <g key={`y${v}`}>
          <path d={`M${L} ${sy(v)}H${W - R}`} className="fig-grid" />
          <text x={L - 8} y={sy(v)} textAnchor="end" dominantBaseline="middle" className="fig-tick">
            {Math.round(v * 100) / 100}
          </text>
        </g>
      ))}
      {xTicks.map((v) => (
        <text key={`x${v}`} x={sx(v)} y={H - B + 14} textAnchor="middle" className="fig-tick">
          {Math.round(v * 100) / 100}
        </text>
      ))}
      <path d={`M${L} ${T}V${H - B}H${W - R}`} className="fig-axis" />
      {f.line && <path d={`M${sx(0)} ${sy(lineAt(0))}L${sx(xMax)} ${sy(lineAt(xMax))}`} className="fig-fit" />}
      {f.points.map(([x, y], i) => (
        <circle key={i} cx={sx(x)} cy={sy(y)} r="4.5" className="fig-dot" />
      ))}
      <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" className="fig-axis-title">
        {cap(f.xLabel || "x")}
      </text>
      <text x={12} y={(T + H - B) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(T + H - B) / 2})`} className="fig-axis-title">
        {cap(f.yLabel || "y")}
      </text>
    </svg>
  );
}

const KINDS = { right: RightTriangle, triangle: Triangle, parallel: Parallel, circle: Circle, box: Box, cylinder: Cylinder, scatter: Scatter };

export default function Figure({ figure }) {
  const Kind = figure && KINDS[figure.kind];
  if (!Kind) return null;
  return (
    <figure className="pl-figure">
      <Kind f={figure} />
    </figure>
  );
}
