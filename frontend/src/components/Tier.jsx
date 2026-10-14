import React from "react";
import { artPicture } from "./artPictures.js";

/*
 * League tiers, lowest to highest: Comet, Nebula, Pulsar, Quasar, Supernova.
 * Each is a crest: the same shield, with its own colours and drawing, and one more piece of
 * trim per tier (a ring, side sparks, then a burst of rays) so a higher league looks earned.
 * The crest is decoration: wherever it appears, the tier's name is written next to it.
 */
const SHIELD = "M24 5.500c4.600 2.700 9.400 3.800 14.500 3.800v14.200c0 9-5.500 14.900-14.500 18.800C15 38.400 9.500 32.500 9.500 23.500V9.300c5.100 0 9.900-1.100 14.500-3.800z";
const spark = (x, y, r) => `M${x} ${y - r}l${r * 0.28} ${r * 0.72} ${r * 0.72} ${r * 0.28}-${r * 0.72} ${r * 0.28}-${r * 0.28} ${r * 0.72}-${r * 0.28}-${r * 0.72}-${r * 0.72}-${r * 0.28} ${r * 0.72}-${r * 0.28}z`;
const RAYS = Array.from({ length: 24 }, (_, i) => {
  const a = (Math.PI * i) / 12 - Math.PI / 2;
  const r = i % 2 ? 17.5 : 23.5;
  return `${i ? "L" : "M"}${(24 + r * Math.cos(a)).toFixed(2)} ${(24 + r * Math.sin(a)).toFixed(2)}`;
}).join("") + "z";

const ART = [
  {
    c: ["#a9d1ff", "#3b6fd4", "#24509f"],
    glyph: (
      <>
        <circle cx="27" cy="13" r="5" fill="#fff" stroke="none" />
        <path d="M22.500 17.500 10 30M26 21l-9 9M19 14l-9 9" />
      </>
    )
  },
  {
    c: ["#cfc3ff", "#7c4ee6", "#5630b4"],
    glyph: (
      <>
        <path d="M11 25a6 6 0 0 1 3.500-10.500 8.500 8.500 0 0 1 15.500 3 5.500 5.500 0 0 1-1.500 10.500H15a5 5 0 0 1-4-3z" fill="#fff" fillOpacity=".3" />
        <circle cx="16" cy="20" r="1.400" fill="#fff" stroke="none" />
        <circle cx="23" cy="17" r="1.800" fill="#fff" stroke="none" />
        <circle cx="26" cy="23" r="1.200" fill="#fff" stroke="none" />
      </>
    )
  },
  {
    c: ["#f6b8ee", "#c04fd0", "#8f2ea3"],
    glyph: (
      <>
        <circle cx="20" cy="20" r="4" fill="#fff" stroke="none" />
        <path d="M13.500 14.500a8.500 8.500 0 0 0 0 11M26.500 14.500a8.500 8.500 0 0 1 0 11" />
        <path d="M9.500 11a14 14 0 0 0 0 18M30.500 11a14 14 0 0 1 0 18" opacity=".7" />
      </>
    )
  },
  {
    c: ["#ffe08a", "#e39a12", "#a8650a"],
    glyph: (
      <>
        <ellipse cx="20" cy="21" rx="12" ry="4" transform="rotate(-18 20 21)" />
        <path d="M20 21l3-12M20 21l-3 12" />
        <circle cx="20" cy="21" r="3.200" fill="#fff" stroke="none" />
      </>
    )
  },
  {
    c: ["#ffc2b0", "#f0567a", "#b42a55"],
    glyph: <path d="M20 6l2.600 7.700L30 9.500l-4.200 7.900L33 20l-7.200 2.600L30 30.500l-7.400-4.200L20 34l-2.600-7.700L10 30.500l4.200-7.900L7 20l7.200-2.600L10 9.500l7.400 4.200z" fill="#fff" stroke="none" />
  }
];

export default function TierBadge({ tier = 0, size = 44 }) {
  const t = Math.max(0, Math.min(ART.length - 1, tier));
  const art = ART[t];
  const id = `tier-${t}`;
  const src = artPicture(id);
  if (src) return <img className="ns-tier" src={src} width={size} height={size} alt="" draggable="false" />;
  return (
    <svg className="ns-tier" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={art.c[0]} />
          <stop offset=".62" stopColor={art.c[1]} />
          <stop offset="1" stopColor={art.c[2]} />
        </linearGradient>
        <clipPath id={`${id}-c`}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      {t >= 4 && <path d={RAYS} fill="#ffcf5c" opacity=".9" />}
      {t >= 2 && t < 4 && <ellipse cx="24" cy="25" rx="22" ry="7" transform="rotate(-20 24 25)" fill="none" stroke={art.c[1]} strokeOpacity=".5" strokeWidth="1.600" />}
      <path d={SHIELD} transform="translate(0 2)" fill={art.c[2]} />
      <path d={SHIELD} fill={`url(#${id})`} />
      <g clipPath={`url(#${id}-c)`}>
        <ellipse cx="16" cy="6" rx="22" ry="13" fill="#fff" opacity=".2" />
      </g>
      <path d={SHIELD} transform="translate(24 24) scale(.84) translate(-24 -24)" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1.100" />
      <g transform="translate(9.200 7.700) scale(.74)" fill="none" stroke="#fff" strokeWidth="2.300" strokeLinecap="round" strokeLinejoin="round">
        {art.glyph}
      </g>
      {t >= 1 && <path d={spark(24, 4.500, 3.600)} fill="#ffd66b" stroke="#fff" strokeWidth=".600" />}
      {t >= 3 && (
        <>
          <path d={spark(6, 13, 3)} fill="#ffd66b" />
          <path d={spark(42, 13, 3)} fill="#ffd66b" />
        </>
      )}
    </svg>
  );
}
