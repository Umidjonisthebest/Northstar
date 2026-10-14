import React, { useId } from "react";

/*
 * Things Nova, her friends and the profile pictures can wear. Each is drawn in the face's own
 * coordinates: the screen frame is 100 units wide and H units tall with its top-left corner at
 * (0, 0), so an accessory sits in the same place on every picture whatever its size or position.
 * <Accessory> maps that onto the picture from the measured `face` box (0..100 of the picture) and
 * leans it by `tilt` degrees for heads drawn at an angle.
 *
 * Layering inside each: contact shadow first, then the shape with a body gradient, a darker
 * underside, and a highlight last, so they read as soft solid objects next to the artwork.
 */

// The list of what exists (ids and labels) is in accessoryList.js.

const NAVY = "#25224f";

function Cap({ u }) {
  return (
    <g transform="rotate(-11 30 -4)">
      <ellipse cx="30" cy="4" rx="27" ry="5" fill="#16133a" opacity=".22" />
      {/* the band that sits on the head */}
      <path d="M8 -17 L8 -1 Q30 9 52 -1 L52 -17 Z" fill={`url(#${u}capBand)`} />
      <path d="M8 -4 Q30 6 52 -4 L52 -1 Q30 9 8 -1 Z" fill="#14122f" opacity=".45" />
      {/* the board */}
      <path d="M30 -37 L70 -21 L30 -5 L-10 -21 Z" fill={`url(#${u}capTop)`} stroke="#191737" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M30 -37 L70 -21 L30 -5 Z" fill="#0d0b26" opacity=".2" />
      <path d="M-6 -21 L30 -35" stroke="#8f8be0" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
      {/* button, cord and tassel */}
      {/* hangs off the outer corner, beside the screen, so it never covers the face */}
      <path d="M30 -21 Q10 -22 -5 -20 Q-9 -13 -8 -5" fill="none" stroke={`url(#${u}gold)`} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M-11.5 -6 h7 l1.5 12 h-10 z" fill={`url(#${u}gold)`} stroke="#c57f12" strokeWidth=".8" strokeLinejoin="round" />
      <path d="M-9.6 -4 v9 M-8 -4 v9 M-6.4 -4 v9" stroke="#c57f12" strokeWidth=".7" opacity=".7" />
      <ellipse cx="30" cy="-21" rx="4.6" ry="2.4" fill={`url(#${u}gold)`} stroke="#c57f12" strokeWidth=".7" />
    </g>
  );
}

function Crown({ u }) {
  return (
    <g transform="rotate(-9 30 -4)">
      <ellipse cx="30" cy="3.5" rx="25" ry="4.5" fill="#16133a" opacity=".22" />
      <path d="M6 0 L3 -27 L17 -15 L30 -34 L43 -15 L57 -27 L54 0 Z" fill={`url(#${u}gold)`} stroke="#c57f12" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M30 -34 L43 -15 L57 -27 L54 0 L30 0 Z" fill="#b8690a" opacity=".2" />
      <path d="M6.6 -6 H53.4 L54 0 H6 Z" fill="#e2951b" />
      <path d="M8 -21 L16.5 -13.5 L26 -27" fill="none" stroke="#fff6d2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".8" />
      <circle cx="3" cy="-27" r="3" fill={`url(#${u}gold)`} stroke="#c57f12" strokeWidth=".9" />
      <circle cx="30" cy="-34" r="3.4" fill={`url(#${u}gold)`} stroke="#c57f12" strokeWidth=".9" />
      <circle cx="57" cy="-27" r="3" fill={`url(#${u}gold)`} stroke="#c57f12" strokeWidth=".9" />
      {/* gems in the crystal's own colours */}
      <path d="M30 -12.5 l4 4.3 -4 4.3 -4 -4.3 z" fill="#ff7a6b" stroke="#c9483d" strokeWidth=".7" />
      <circle cx="15.5" cy="-6.5" r="2.5" fill="#3fc9b0" stroke="#22917d" strokeWidth=".6" />
      <circle cx="44.5" cy="-6.5" r="2.5" fill="#3fc9b0" stroke="#22917d" strokeWidth=".6" />
      <path d="M28.6 -9.6 l1.4 -1.5" stroke="#fff" strokeWidth=".9" strokeLinecap="round" opacity=".9" />
    </g>
  );
}

function Shades({ u, H }) {
  const y = H * 0.24;
  const h = H * 0.37;
  return (
    <g>
      <path d={`M43 ${y + h * 0.3} Q50 ${y + h * 0.12} 57 ${y + h * 0.3}`} fill="none" stroke="#0d0c20" strokeWidth="3.4" strokeLinecap="round" />
      <path d={`M9 ${y + h * 0.22} L-3 ${y + h * 0.1} M91 ${y + h * 0.22} L103 ${y + h * 0.1}`} stroke="#0d0c20" strokeWidth="3" strokeLinecap="round" />
      {[9, 55].map((x) => (
        <g key={x}>
          <rect x={x} y={y} width="36" height={h} rx={h * 0.42} fill={`url(#${u}lens)`} stroke="#0d0c20" strokeWidth="2" />
          <path d={`M${x + 7} ${y + h * 0.62} L${x + 17} ${y + h * 0.2} M${x + 15} ${y + h * 0.7} L${x + 22} ${y + h * 0.4}`} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".5" />
        </g>
      ))}
    </g>
  );
}

function Headphones({ u, H }) {
  const m = H * 0.5;
  return (
    <g>
      <path d={`M-9 ${m - 8} C-9 -58 109 -58 109 ${m - 8}`} fill="none" stroke={NAVY} strokeWidth="8" strokeLinecap="round" />
      <path d={`M-6 ${m - 22} C-2 -48 102 -48 106 ${m - 22}`} fill="none" stroke="#7d79d6" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      {[-22, 100].map((x, i) => (
        <g key={x}>
          <rect x={x} y={m - 20} width="22" height="40" rx="10" fill={`url(#${u}cup)`} stroke={NAVY} strokeWidth="2.2" />
          <rect x={i ? x : x + 15} y={m - 14} width="7" height="28" rx="3.5" fill="#1b1840" opacity=".85" />
          <path d={`M${x + (i ? 13 : 6)} ${m - 13} v12`} stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".55" />
        </g>
      ))}
    </g>
  );
}

function Bow({ u, H }) {
  const y = H + 11;
  return (
    <g>
      <ellipse cx="50" cy={y + 9} rx="22" ry="3.2" fill="#16133a" opacity=".16" />
      <path d={`M50 ${y} C36 ${y - 15} 22 ${y - 13} 21 ${y} C22 ${y + 13} 36 ${y + 15} 50 ${y} Z`} fill={`url(#${u}bow)`} stroke="#c9483d" strokeWidth="1.3" strokeLinejoin="round" />
      <path d={`M50 ${y} C64 ${y - 15} 78 ${y - 13} 79 ${y} C78 ${y + 13} 64 ${y + 15} 50 ${y} Z`} fill={`url(#${u}bow)`} stroke="#c9483d" strokeWidth="1.3" strokeLinejoin="round" />
      <path d={`M27 ${y - 5} Q33 ${y - 9} 40 ${y - 6} M60 ${y - 6} Q67 ${y - 9} 73 ${y - 5}`} fill="none" stroke="#ffd0c6" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
      <path d={`M38 ${y + 2} Q44 ${y + 1} 47 ${y + 4} M62 ${y + 2} Q56 ${y + 1} 53 ${y + 4}`} fill="none" stroke="#b63d33" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
      <rect x="44.5" y={y - 6.5} width="11" height="13" rx="4.5" fill="#f0584c" stroke="#c9483d" strokeWidth="1.2" />
      <path d={`M47 ${y - 3.5} h4`} stroke="#ffd0c6" strokeWidth="1.4" strokeLinecap="round" opacity=".9" />
    </g>
  );
}

const PARTS = { cap: Cap, crown: Crown, shades: Shades, headphones: Headphones, bow: Bow };

// `face`: {x, y, w, h} in the picture's 0..100 box. Draw inside an <svg viewBox="0 0 100 100">.
export function Accessory({ kind, face, tilt = 0 }) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  const Part = PARTS[kind];
  if (!Part || !face) return null;
  const s = face.w / 100;
  const H = (face.h / face.w) * 100;
  return (
    <g className="nova-extra" transform={`translate(${face.x} ${face.y}) scale(${s}) rotate(${tilt} 50 ${H / 2})`}>
      <defs>
        <linearGradient id={`${u}capTop`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a4790" />
          <stop offset="1" stopColor="#272457" />
        </linearGradient>
        <linearGradient id={`${u}capBand`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34316c" />
          <stop offset="1" stopColor="#201d4b" />
        </linearGradient>
        <linearGradient id={`${u}gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe89a" />
          <stop offset=".55" stopColor="#ffc94a" />
          <stop offset="1" stopColor="#f2a01f" />
        </linearGradient>
        <linearGradient id={`${u}lens`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4b4a86" />
          <stop offset=".5" stopColor="#1d1c40" />
          <stop offset="1" stopColor="#0c0b1e" />
        </linearGradient>
        <linearGradient id={`${u}cup`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9aa2ff" />
          <stop offset="1" stopColor="#5a5fd0" />
        </linearGradient>
        <linearGradient id={`${u}bow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9c8a" />
          <stop offset="1" stopColor="#ee5b50" />
        </linearGradient>
      </defs>
      <Part u={u} H={H} />
    </g>
  );
}
