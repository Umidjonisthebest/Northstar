import React, { useId } from "react";
import Nova from "./Nova.jsx";
import { artPicture } from "./artPictures.js";

// Decorative illustrations for the student hub (inline SVG). All are aria-hidden; the text next
// to them carries the meaning. Each has a slot name: a picture saved under that name in
// src/assets/art/ is shown instead of the drawing (see artPictures.js).

const spark = (x, y, r) => `M${x} ${y - r}l${r * 0.28} ${r * 0.72} ${r * 0.72} ${r * 0.28}-${r * 0.72} ${r * 0.28}-${r * 0.28} ${r * 0.72}-${r * 0.28}-${r * 0.72}-${r * 0.72}-${r * 0.28} ${r * 0.72}-${r * 0.28}z`;
const Sparkle = ({ x, y, s = 1, opacity = 1, fill = "#fff" }) => <path d={spark(x, y, 8 * s)} fill={fill} opacity={opacity} />;
const Picture = ({ src, className }) => <img className={`${className} ns-art-pic`} src={src} alt="" decoding="async" draggable="false" />;

// Empty states: one of the owner's spot pictures (src/assets/art/spot-<name>.webp: checklist,
// bullseye, chart, calendar, target, trophy, note, bookmark). Draws nothing when the file is missing.
export function EmptyArt({ name, size = 116 }) {
  const src = artPicture(`spot-${name}`);
  return src ? <img className="ns-empty-art" src={src} alt="" width={size} decoding="async" draggable="false" /> : null;
}

// Reading & Writing: two pages of a text, one line marked in gold, an "Aa" badge and a pencil.
// Drawn as frosted glass so it sits on the card's gradient.
export function BookArt({ className = "" }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const src = artPicture("bank-rw");
  if (src) return <Picture src={src} className={`ns-art ${className}`} />;
  return (
    <svg className={`ns-art ${className}`} viewBox="0 0 260 200" aria-hidden="true">
      <defs>
        <linearGradient id={`pg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f6dcf6" />
        </linearGradient>
        <linearGradient id={`pc${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#f5a623" />
        </linearGradient>
      </defs>
      <circle cx="146" cy="104" r="88" fill="#fff" opacity=".1" />
      <circle cx="146" cy="104" r="70" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1.5" strokeDasharray="1 8" strokeLinecap="round" />
      <g transform="rotate(-11 120 106)">
        <rect x="70" y="40" width="100" height="130" rx="15" fill="#fff" fillOpacity=".2" stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" />
        <path d="M86 66h44M86 82h62M86 98h52" stroke="#fff" strokeOpacity=".5" strokeWidth="5" strokeLinecap="round" />
      </g>
      <g transform="rotate(6 160 104)">
        <rect x="106" y="32" width="110" height="140" rx="17" fill="#5b1f7a" opacity=".22" transform="translate(3 6)" />
        <rect x="106" y="32" width="110" height="140" rx="17" fill={`url(#pg${id})`} />
        <rect x="122" y="50" width="50" height="10" rx="5" fill="#b34fd2" />
        <g stroke="#dcb4ea" strokeWidth="6" strokeLinecap="round">
          <path d="M125 78h72M125 94h60M125 142h66M125 158h40" />
        </g>
        <rect x="118" y="106" width="86" height="22" rx="8" fill="#ffe08a" />
        <path d="M126 117h70" stroke="#a8650a" strokeWidth="6" strokeLinecap="round" />
      </g>
      <g>
        <circle cx="88" cy="150" r="27" fill="#5b1f7a" opacity=".2" transform="translate(2 5)" />
        <circle cx="88" cy="150" r="27" fill="#fff" />
        <text x="88" y="160" textAnchor="middle" fill="#b23fc6" fontSize="28" fontWeight="600" fontFamily="var(--display)">
          Aa
        </text>
      </g>
      <g transform="rotate(38 222 110)">
        <rect x="214" y="58" width="16" height="74" rx="4" fill={`url(#pc${id})`} />
        <rect x="214" y="52" width="16" height="12" rx="4" fill="#ff9fc0" />
        <rect x="214" y="62" width="16" height="5" fill="#fff" opacity=".8" />
        <path d="M214 132h16l-8 17z" fill="#ffeccd" />
        <path d="M219 142.500h6l-3 6.500z" fill="#5b1f7a" />
      </g>
      <Sparkle x={62} y={36} fill="#ffe08a" />
      <Sparkle x={238} y={40} s={0.7} opacity={0.9} />
      <Sparkle x={36} y={112} s={0.5} opacity={0.75} />
    </svg>
  );
}

// Math: a graph card with a parabola and its two marked points, a set square, and two tiles.
export function MathArt({ className = "" }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const src = artPicture("bank-math");
  if (src) return <Picture src={src} className={`ns-art ${className}`} />;
  return (
    <svg className={`ns-art ${className}`} viewBox="0 0 260 200" aria-hidden="true">
      <defs>
        <linearGradient id={`gc${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbe6ff" />
        </linearGradient>
        <clipPath id={`gcl${id}`}>
          <rect x="84" y="34" width="128" height="124" rx="17" />
        </clipPath>
      </defs>
      <circle cx="150" cy="100" r="88" fill="#fff" opacity=".1" />
      <circle cx="150" cy="100" r="70" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1.5" strokeDasharray="1 8" strokeLinecap="round" />
      <path d="M34 176V78l98 98z" fill="#fff" fillOpacity=".2" stroke="#fff" strokeOpacity=".65" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M52 158v-36l36 36z" fill="none" stroke="#fff" strokeOpacity=".65" strokeWidth="1.5" strokeLinejoin="round" />
      <g transform="rotate(-5 148 96)">
        <rect x="84" y="34" width="128" height="124" rx="17" fill="#14246e" opacity=".25" transform="translate(3 6)" />
        <rect x="84" y="34" width="128" height="124" rx="17" fill={`url(#gc${id})`} />
        <g clipPath={`url(#gcl${id})`}>
          <path d="M84 60h128M84 86h128M84 138h128M110 34v124M136 34v124M188 34v124" stroke="#c3d2f7" strokeWidth="1.2" />
          <path d="M84 112h128M162 34v124" stroke="#8aa0dc" strokeWidth="2" />
          <path d="M100 44c18 106 86 106 104 0" fill="none" stroke="#3463de" strokeWidth="4.5" strokeLinecap="round" />
        </g>
        <circle cx="117" cy="112" r="6.500" fill="#ffcf5c" stroke="#fff" strokeWidth="2.500" />
        <circle cx="187" cy="112" r="6.500" fill="#ffcf5c" stroke="#fff" strokeWidth="2.500" />
      </g>
      <g transform="translate(-14 4) rotate(9 214 44)">
        <rect x="192" y="22" width="46" height="46" rx="14" fill="#fff" fillOpacity=".24" stroke="#fff" strokeOpacity=".65" strokeWidth="1.5" />
        <text x="215" y="54" textAnchor="middle" fill="#fff" fontSize="25" fontWeight="600" fontFamily="var(--display)">x²</text>
      </g>
      <g transform="translate(-12 -4) rotate(-8 214 152)">
        <rect x="194" y="132" width="42" height="42" rx="13" fill="#fff" />
        <path d="M205 153h20M215 143v20" stroke="#3463de" strokeWidth="5" strokeLinecap="round" />
      </g>
      <Sparkle x={62} y={40} fill="#ffe08a" />
      <Sparkle x={38} y={62} s={0.5} opacity={0.75} />
      <Sparkle x={244} y={104} s={0.6} opacity={0.85} />
    </svg>
  );
}

// Diagnostic pages: Nova at the foot of a mountain, a dotted trail that climbs past two
// milestones (scores or bands) to the north star over the summit. Styled in diagnostic.css.
//
// With a `trail` picture (the owner's: stepping-stone planets up to the north star) the labels and
// Nova are laid over it instead. TRAIL_STOPS are where they go, in percent of the picture: one
// label beside each planet, the last mark over the star, Nova on the hill where the path starts.
const TRAIL_STOPS = [
  [24.5, 57.5],
  [41, 44.5],
  [57.5, 34.5]
];
const TRAIL_STAR = [79.3, 7.6];

export function TrailArt({ marks = ["1000", "1200", "1400", "1600"], extra = "cap", className = "" }) {
  const src = artPicture("trail");
  const top = marks[marks.length - 1];
  if (src) {
    const steps = marks.slice(0, -1).slice(-TRAIL_STOPS.length);
    return (
      <div className={`dg-art dg-pic ${className}`} aria-hidden="true">
        <img src={src} alt="" decoding="async" draggable="false" />
        {steps.map((m, i) => (
          <span key={m} className="dg-pic-chip" style={{ left: `${TRAIL_STOPS[i][0]}%`, top: `${TRAIL_STOPS[i][1]}%` }}>
            {m}
          </span>
        ))}
        <span className="dg-pic-chip top" style={{ left: `${TRAIL_STAR[0]}%`, top: `${TRAIL_STAR[1]}%` }}>
          {top}
        </span>
        <Nova size={64} extra={extra} className="dg-pic-nova" />
      </div>
    );
  }
  return (
    <svg className={`dg-art ${className}`} viewBox="0 0 360 260" aria-hidden="true">
      <ellipse className="dg-art-blob" cx="196" cy="128" rx="156" ry="118" />
      <circle className="dg-art-glow" cx="292" cy="44" r="40" />
      <g className="dg-art-stars">
        <circle cx="66" cy="52" r="1.800" />
        <circle cx="118" cy="30" r="1.300" />
        <circle cx="170" cy="56" r="1.600" />
        <circle cx="214" cy="26" r="1.200" />
        <circle cx="330" cy="104" r="1.500" />
        <circle cx="96" cy="96" r="1.200" />
        <circle cx="244" cy="70" r="1.300" />
      </g>
      <path className="dg-art-peak3" d="M96 236 190 112a10 10 0 0 1 16 0l22 30 24-34a10 10 0 0 1 16 0l92 128z" />
      <path className="dg-art-peak2" d="M150 240 282 62a10 10 0 0 1 16 0l62 86v92z" />
      <path className="dg-art-snow" d="M290 58l-22 30 12-4 8 10 8-12 10 6z" />
      <path className="dg-art-peak1" d="M0 260c50-44 120-60 196-50s120 8 164-10v60z" />
      <path className="dg-art-trail dg-art-trail-anim" d="M84 214c46 0 50-32 88-38s66-14 62-46 26-52 54-64" />
      <g>
        <circle className="dg-art-stop" cx="170" cy="177" r="7" />
        <rect className="dg-art-chip" x="140" y="143" width="60" height="22" rx="11" />
        <text className="dg-art-label" x="170" y="158.500" textAnchor="middle">
          {marks[0]}
        </text>
        <circle className="dg-art-stop" cx="234" cy="128" r="7" />
        <rect className="dg-art-chip" x="170" y="100" width="56" height="22" rx="11" />
        <text className="dg-art-label" x="198" y="115.500" textAnchor="middle">
          {marks[1]}
        </text>
      </g>
      <path className="dg-art-spark dg-art-north" d={spark(292, 44, 20)} />
      <rect className="dg-art-chip top" x="262" y="4" width="60" height="22" rx="11" />
      <text className="dg-art-label top" x="292" y="19.500" textAnchor="middle">
        {top}
      </text>
      <path className="dg-art-spark" d={spark(40, 108, 6)} opacity=".8" />
      <path className="dg-art-spark" d={spark(140, 70, 4.500)} opacity=".7" />
      <Nova size={84} x={14} y={160} extra={extra} sparkles={false} />
    </svg>
  );
}

// Score card: a target on a hill with one arrow in the gold centre.
export function TargetArt({ className = "" }) {
  const src = artPicture("target");
  if (src) return <Picture src={src} className={`ns-art ${className}`} />;
  return (
    <svg className={`ns-art ${className}`} viewBox="0 0 300 190" aria-hidden="true">
      <path d="M0 190C70 126 170 102 300 116V190Z" className="art-hill" />
      <g strokeLinecap="round" stroke="#4a4580" strokeWidth="8">
        <path d="M186 132l-22 54M212 132l22 54" />
      </g>
      <ellipse cx="204" cy="88" rx="54" ry="60" fill="#3d37a8" />
      <ellipse cx="199" cy="84" rx="54" ry="60" fill="#6a63ec" />
      <ellipse cx="199" cy="84" rx="43" ry="48" fill="#fff" />
      <ellipse cx="199" cy="84" rx="32" ry="36" fill="#8a5fe6" />
      <ellipse cx="199" cy="84" rx="21" ry="24" fill="#fff" />
      <ellipse cx="199" cy="84" rx="10.500" ry="12" fill="#ffcf5c" />
      <g transform="translate(199 84) rotate(212)">
        <path d="M2 0H88" stroke="#2b2757" strokeWidth="3.500" strokeLinecap="round" />
        <path d="M70 0 88-10h7L80 0zM70 0l18 10h7L80 0z" fill="#ff8a70" />
      </g>
      <path d={spark(120, 50, 9)} fill="#ffcf5c" />
      <path d={spark(270, 40, 6)} fill="#ffcf5c" opacity=".8" />
      <path d={spark(92, 96, 5)} fill="#ffcf5c" opacity=".6" />
    </svg>
  );
}
