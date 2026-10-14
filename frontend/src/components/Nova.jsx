import React, { useId } from "react";
import { spriteFor } from "./nova/sprites.js";
import { Accessory } from "./nova/Accessories.jsx";

/*
 * Nova — Northstar's study buddy: a soft pink star with a little screen for a face and a crystal
 * on top. The pictures are the owner's own character art (components/nova/sprites.js); this
 * component only chooses which one to show and adds what Nova is wearing.
 *
 * Props (unchanged from the old hand-drawn Nova, so every screen keeps working):
 *   size      pixels
 *   mood      happy (default), wave, thinking, explain, cheer, proud, wink, oops, surprised,
 *             focused, sleepy, dim. Several share a picture (see MOOD_SPRITE). Screens should get
 *             the mood from novaMood()/answerMood() in components/nova/moods.js.
 *   tone      "sun" is Nova. sky, mint, lilac, rose, peach and gold show one of her friends
 *             instead (one picture each, so `mood` doesn't change them).
 *   extra     cap, crown, shades, headphones or bow, placed on the face of whichever picture shows.
 *   float     gentle bobbing (off under reduced motion; shell.css)
 *   sparkles  kept for old call sites; the artwork has its own sparkles, so it draws nothing.
 *   x, y      position when used inside another <svg> (the landscape scenes).
 *
 * Under 28px the picture turns to mush, so a simple vector mark is drawn instead (<NovaMark>, also
 * the logo and the favicon).
 */

const STAR = "50,13 63,35.5 88.5,41 71,60.5 73.8,86.5 50,76 26.2,86.5 29,60.5 11.5,41 37,35.5";
const INK = "#2b2553";

// The small mark: star, screen, crystal. A smile is added once there is room for one.
export function NovaMark({ size = 24, className = "", title, x, y, face = size >= 20 }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg className={`nova nova-mark ${className}`} width={size} height={size} x={x} y={y} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`nm${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#ffa3cf" />
          <stop offset=".5" stopColor="#e89fe6" />
          <stop offset="1" stopColor="#a49cf4" />
        </linearGradient>
        <linearGradient id={`ns${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f1ff" />
          <stop offset="1" stopColor="#ddd4fb" />
        </linearGradient>
      </defs>
      <polygon points={STAR} fill={`url(#nm${id})`} stroke={`url(#nm${id})`} strokeWidth="15" strokeLinejoin="round" />
      <ellipse cx="29" cy="40" rx="7" ry="3.4" fill="#fff" opacity=".55" transform="rotate(-24 29 40)" />
      <path d="M50 3 L56.5 16 L50 31 L43.5 16 Z" fill={INK} />
      <path d="M50 3 L56.5 16 L50 20 L43.5 16 Z" fill="#ff7a6b" />
      <rect x="27" y="39" width="46" height="35" rx="10" fill={`url(#ns${id})`} stroke={INK} strokeWidth="5.5" />
      {face && (
        <g fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round">
          <path d="M36.5 54 q4 -5 8 0" />
          <path d="M55.5 54 q4 -5 8 0" />
          <path d="M43.5 62 q6.5 6 13 0" />
        </g>
      )}
    </svg>
  );
}

export default function Nova({ size = 64, mood = "happy", tone = "sun", extra, float = false, sparkles = true, className = "", title, x, y }) {
  void sparkles;
  if (size < 28) return <NovaMark size={size} className={`${float ? "nova-float" : ""} ${className}`} title={title} x={x} y={y} />;
  const sprite = spriteFor(mood, tone);
  return (
    <svg
      className={`nova nova-${mood} ${float ? "nova-float" : ""} ${className}`}
      width={size}
      height={size}
      x={x}
      y={y}
      viewBox="0 0 100 100"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <g className="nova-body">
        <image href={sprite.src} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet" />
        {extra && <Accessory kind={extra} face={sprite.face} tilt={sprite.tilt || 0} />}
      </g>
    </svg>
  );
}
