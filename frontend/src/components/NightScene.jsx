import React, { useEffect, useMemo, useRef, useState } from "react";
import Nova3D from "./nova/Nova3D.jsx";
import "./nightscene.css";

/*
 * The space scene beside the sign-in and sign-up forms. Drawn entirely here in SVG (no picture
 * file): a deep indigo sky, a big blue planet rising from the corner, a pink moon low on the left, a small ringed
 * planet, comets and a fixed scatter of stars, with the 3D Nova floating in front. The layers
 * shift a little with the pointer. Under the scene's edge sits a short line about the product that
 * the visitor can step through with the arrows (it also moves on by itself, and stops when hovered,
 * focused, or when reduced motion is asked for).
 *
 * Only the 3D Nova appears here. Never add the 2D Nova or her 2D friends to this scene.
 */

// What Northstar actually does, one line at a time. Keep these true.
const LINES = [
  ["Hints first.", "Nova gives the answer only if you ask twice."],
  ["Every miss is kept.", "Get it right later and it clears."],
  ["A plan that listens.", "It rebuilds each week around the skills you miss most."]
];

function Stars() {
  const dots = useMemo(() => {
    let seed = 23;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // 230 stars: most are dust (under 1px), a few dozen are bright enough to twinkle.
    return Array.from({ length: 230 }, (_, n) => [rnd() * 600, rnd() * 760, n % 4 === 0 ? 1.2 + rnd() * 1.6 : 0.5 + rnd() * 0.7, 0.25 + rnd() * 0.65]);
  }, []);
  return (
    <g>
      {dots.map(([x, y, r, o], i) => (
        <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(1)} fill="#fff" opacity={o.toFixed(2)} className={i % 6 === 0 ? "nsc-blink" : undefined} style={i % 6 === 0 ? { animationDelay: `${-(i % 5)}s` } : undefined} />
      ))}
    </g>
  );
}

const sparkle = (x, y, r) => `M${x} ${y - r}Q${x + r * 0.16} ${y - r * 0.16} ${x + r} ${y}Q${x + r * 0.16} ${y + r * 0.16} ${x} ${y + r}Q${x - r * 0.16} ${y + r * 0.16} ${x - r} ${y}Q${x - r * 0.16} ${y - r * 0.16} ${x} ${y - r}Z`;

export default function NightScene({ captions = true }) {
  const ref = useRef(null);
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!captions || held || still) return undefined;
    const t = setTimeout(() => setI((n) => (n + 1) % LINES.length), 6500);
    return () => clearTimeout(t);
  }, [i, held, still, captions]);

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };
  const step = (d) => setI((n) => (n + d + LINES.length) % LINES.length);

  return (
    <div className="nsc" ref={ref} onPointerMove={onMove} onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
      <svg className="nsc-art" viewBox="0 0 600 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="nscSky" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#241d6e" />
            <stop offset="0.55" stopColor="#17124a" />
            <stop offset="1" stopColor="#0d0a2c" />
          </linearGradient>
          <radialGradient id="nscPlanet" cx="0.36" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#b6e0ff" />
            <stop offset="0.42" stopColor="#6f9dff" />
            <stop offset="0.8" stopColor="#5a55de" />
            <stop offset="1" stopColor="#3c2f9e" />
          </radialGradient>
          <radialGradient id="nscAir" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.78" stopColor="#7fb4ff" stopOpacity="0" />
            <stop offset="0.9" stopColor="#8fc0ff" stopOpacity="0.34" />
            <stop offset="1" stopColor="#8fc0ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nscMoon" cx="0.35" cy="0.3" r="0.85">
            <stop offset="0" stopColor="#ffd3ea" />
            <stop offset="0.55" stopColor="#f29ad0" />
            <stop offset="1" stopColor="#a76be0" />
          </radialGradient>
          <radialGradient id="nscSmall" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0" stopColor="#fff0c9" />
            <stop offset="1" stopColor="#f0a36b" />
          </radialGradient>
          <linearGradient id="nscTail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.95" />
          </linearGradient>
          <radialGradient id="nscGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ff9ed0" stopOpacity="0.4" />
            <stop offset="1" stopColor="#ff9ed0" stopOpacity="0" />
          </radialGradient>
          <clipPath id="nscClip">
            <circle cx="110" cy="130" r="230" />
          </clipPath>
        </defs>
        <rect width="600" height="760" fill="url(#nscSky)" />
        <ellipse cx="420" cy="620" rx="300" ry="200" fill="url(#nscGlow)" />
        {/* a soft band of far-off stars across the sky */}
        <ellipse className="nsc-band" cx="330" cy="430" rx="420" ry="70" transform="rotate(-32 330 430)" fill="#8f7bff" opacity="0.16" />
        <ellipse className="nsc-band" cx="300" cy="450" rx="300" ry="34" transform="rotate(-32 300 450)" fill="#ffb3dc" opacity="0.12" />
        <g className="nsc-l1">
          <Stars />
          <path d={sparkle(372, 96, 13)} fill="#fff7d6" className="nsc-blink" />
          <path d={sparkle(534, 438, 9)} fill="#fff7d6" className="nsc-blink" style={{ animationDelay: "-2s" }} />
          <path d={sparkle(250, 520, 8)} fill="#d9d2ff" className="nsc-blink" style={{ animationDelay: "-3.4s" }} />
          <path d={sparkle(566, 300, 7)} fill="#fff7d6" className="nsc-blink" style={{ animationDelay: "-1.2s" }} />
          <path d={sparkle(40, 430, 10)} fill="#fff7d6" className="nsc-blink" style={{ animationDelay: "-2.6s" }} />
          <path d={sparkle(196, 640, 6)} fill="#d9d2ff" className="nsc-blink" style={{ animationDelay: "-0.6s" }} />
          <path d={sparkle(440, 40, 7)} fill="#d9d2ff" className="nsc-blink" style={{ animationDelay: "-4s" }} />
          {/* a small constellation, top right */}
          <g className="nsc-const">
            <path d="M392 196 432 226 478 208 520 246 556 222" fill="none" stroke="#cfc8ff" strokeOpacity="0.45" strokeWidth="1.300" strokeDasharray="1 6" strokeLinecap="round" />
            <circle cx="392" cy="196" r="3" fill="#fff" />
            <circle cx="432" cy="226" r="2.400" fill="#fff" />
            <circle cx="478" cy="208" r="3.400" fill="#ffe7a8" />
            <circle cx="520" cy="246" r="2.400" fill="#fff" />
            <circle cx="556" cy="222" r="2.800" fill="#fff" />
          </g>
        </g>

        {/* comets */}
        <g className="nsc-l2" strokeLinecap="round">
          <g transform="rotate(32 350 250)">
            <rect x="250" y="248.500" width="100" height="3" rx="1.500" fill="url(#nscTail)" />
            <circle cx="350" cy="250" r="4" fill="#fff" />
          </g>
          <g transform="rotate(32 500 560)" opacity="0.8">
            <rect x="430" y="559" width="70" height="2.400" rx="1.200" fill="url(#nscTail)" />
            <circle cx="500" cy="560" r="3" fill="#fff" />
          </g>
          <g className="nsc-shoot">
            <rect x="60" y="0" width="120" height="3" rx="1.500" fill="url(#nscTail)" />
            <circle cx="180" cy="1.500" r="3.500" fill="#fff" />
          </g>
        </g>

        {/* the big planet, rising from the top-left corner */}
        <g className="nsc-l3">
          <circle cx="110" cy="130" r="268" fill="url(#nscAir)" />
          <circle cx="110" cy="130" r="230" fill="url(#nscPlanet)" />
          <g clipPath="url(#nscClip)" fill="#3f3bb8" opacity="0.34">
            <path d="M-40 60c40-34 110-30 150 6 30 28 76 20 104 46 30 28-6 64-52 62-54-2-76-36-120-34-46 2-110-46-82-80z" />
            <path d="M150 230c34-20 86-12 104 22 16 30-18 54-56 50-44-4-80-52-48-72z" />
            <path d="M-20 250c30-14 70-4 84 22 12 24-14 40-44 36-34-4-66-44-40-58z" />
            <path d="M210 30c22-12 58-6 68 16 10 20-12 34-36 30-28-4-52-34-32-46z" />
          </g>
          <g clipPath="url(#nscClip)" fill="#fff" opacity="0.2">
            <path d="M-60 -20c60-30 150-20 190 20-50-16-120-10-190 30z" />
            <ellipse cx="60" cy="40" rx="70" ry="26" transform="rotate(-24 60 40)" />
          </g>
          <circle cx="110" cy="130" r="230" fill="none" stroke="#cfe6ff" strokeOpacity="0.35" strokeWidth="2" />
        </g>

        {/* the moon and a little ringed planet */}
        <g className="nsc-l4">
          <g transform="translate(-236 254.700) scale(0.74)">
            <circle cx="446" cy="318" r="62" fill="url(#nscMoon)" />
            <g fill="#8a4fc8" opacity="0.32">
              <circle cx="426" cy="300" r="12" />
              <circle cx="466" cy="338" r="9" />
              <circle cx="458" cy="290" r="5" />
              <circle cx="430" cy="346" r="6" />
            </g>
            <path d="M408 286a62 62 0 0 1 50-30" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
          </g>
          <g transform="rotate(-18 512 132)">
            <ellipse cx="512" cy="132" rx="44" ry="9" fill="none" stroke="#ffd9a8" strokeOpacity="0.7" strokeWidth="3" />
            <circle cx="512" cy="132" r="22" fill="url(#nscSmall)" />
            <path d="M469 135a44 9 0 0 0 86 0" fill="none" stroke="#ffe7c4" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
      </svg>

      <div className="nsc-hero" aria-hidden="true">
        <div className="nsc-halo" />
        <div className="nsc-orbit">
          <i />
        </div>
        <Nova3D size={300} className="nsc-nova" />
        <div className="nsc-shadow" />
      </div>

      {captions && (
        <div className="nsc-caption">
          <p key={i} aria-live="polite">
            <b>{LINES[i][0]}</b> {LINES[i][1]}
          </p>
          <div className="nsc-arrows">
            <button type="button" onClick={() => step(-1)} aria-label="Previous">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.500 6.500 9 12l5.500 5.500" />
              </svg>
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Next">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9.500 6.500 15 12l-5.500 5.500" />
              </svg>
            </button>
            <span className="nsc-count" aria-hidden="true">
              {i + 1} / {LINES.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
