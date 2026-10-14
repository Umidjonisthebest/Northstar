import React, { useId, useRef } from "react";
import Nova from "./Nova.jsx";
import "./scenes.css";

/*
 * Illustrated scenes for the cover page and the sign-in screens: a dawn
 * valley (auth), floating islands (call to action), a landscape for the
 * footer and a cloudy sky band. Low-poly shapes in light pastels, with
 * Nova and her friends. Everything is decorative (aria-hidden).
 * Motion (twinkle, drift, bob, parallax) lives in scenes.css and switches
 * off for prefers-reduced-motion.
 */

// A curved four-point sparkle centred on (x, y).
export function Sparkle({ x, y, s = 1, fill = "#fff", className = "", style }) {
  const r = 10 * s;
  const k = 1.7 * s;
  return (
    <path
      className={className}
      style={style}
      fill={fill}
      d={`M${x} ${y - r}Q${x + k} ${y - k} ${x + r} ${y}Q${x + k} ${y + k} ${x} ${y + r}Q${x - k} ${y + k} ${x - r} ${y}Q${x - k} ${y - k} ${x} ${y - r}Z`}
    />
  );
}

const PUFFS = [
  [42, 58, 24],
  [84, 42, 34],
  [132, 38, 38],
  [174, 56, 26]
];

// A puffy cloud about 200×82 at s = 1, top-left at (x, y). `shade` draws a
// tinted copy underneath for depth. Animate the wrapping <g>, not this one.
export function Cloud({ x, y, s = 1, fill = "#fff", shade, opacity = 1 }) {
  const shape = (color, dy) => (
    <g fill={color} transform={dy ? `translate(0 ${dy})` : undefined}>
      {PUFFS.map(([cx, cy, r]) => (
        <circle key={cx} cx={cx} cy={cy} r={r} />
      ))}
      <rect x="38" y="56" width="140" height="26" rx="13" />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      {shade && shape(shade, 9)}
      {shape(fill, 0)}
    </g>
  );
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const pts = (list) => list.map((p) => p.map((n) => Math.round(n * 10) / 10).join(",")).join(" ");

// A low-poly mountain ridge. `ridge` runs left to right through valleys and
// peaks; every peak gets a light left face, a dark right face and, if it
// rises above `capAbove`, a snow cap.
export function Ridge({ ridge, bottom, base, light, dark, cap, capAbove = -Infinity }) {
  const outline = [[ridge[0][0], bottom], ...ridge, [ridge[ridge.length - 1][0], bottom]];
  const faces = [];
  for (let i = 1; i < ridge.length - 1; i++) {
    const P = ridge[i];
    const L = ridge[i - 1];
    const R = ridge[i + 1];
    if (P[1] >= L[1] || P[1] >= R[1]) continue;
    const low = Math.max(L[1], R[1]);
    const foot = [P[0] + (R[0] - P[0]) * 0.16, low + (bottom - low) * 0.4];
    faces.push(<polygon key={`l${i}`} points={pts([P, L, foot])} fill={light} />);
    faces.push(<polygon key={`r${i}`} points={pts([P, foot, R])} fill={dark} />);
    if (cap && P[1] < capAbove) {
      const a = lerp(P, L, 0.2);
      const b = lerp(P, R, 0.18);
      const f = lerp(P, foot, 0.22);
      faces.push(<polygon key={`c${i}`} points={pts([P, a, [(a[0] + f[0]) / 2, a[1] - 3], f, [(b[0] + f[0]) / 2, b[1] - 2], b])} fill={cap} />);
    }
  }
  return (
    <g>
      <polygon points={pts(outline)} fill={base} />
      {faces}
    </g>
  );
}

// Mouse parallax: layers read --px/--py (−1…1) off the <svg>.
function useParallax() {
  const ref = useRef(null);
  const onPointerMove = (e) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    el.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  };
  const onPointerLeave = () => {
    ref.current?.style.setProperty("--px", "0");
    ref.current?.style.setProperty("--py", "0");
  };
  return { ref, onPointerMove, onPointerLeave };
}

const Layer = ({ depth, children }) => (
  <g className="sc-layer" style={{ "--d": depth }}>
    {children}
  </g>
);

const STARS = [
  [40, 60, 1.6], [95, 140, 1.2], [150, 40, 1.8], [210, 110, 1.1], [262, 58, 1.4], [330, 150, 1.2], [384, 48, 1.7], [520, 70, 1.3],
  [566, 160, 1.1], [70, 232, 1.2], [300, 252, 1], [560, 262, 1.2], [180, 200, 1.4], [420, 196, 1], [120, 322, 1], [472, 326, 1.1]
];

function Tuft({ x, y, s = 1, fill = "#4fbf7e" }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 0l3-14 3 12 4-18 3 18 4-11 2 13z" fill={fill} />;
}

function Flower({ x, y, petal = "#fff", heart = "#ffc93c" }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0v10" stroke="#3faa6b" strokeWidth="1.6" />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy="-3.4" rx="2.3" ry="3.4" fill={petal} transform={`rotate(${a})`} />
      ))}
      <circle r="2" fill={heart} />
    </g>
  );
}

// Sign-in panel: a pastel dawn over the mountains, Nova on the hill and a
// signpost to the top scores. `variant` changes the signs for teachers.
export function DawnScene({ variant = "student" }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { ref, onPointerMove, onPointerLeave } = useParallax();
  const signs = variant === "teacher" ? ["Your class", "Top scores"] : ["SAT 1600", "IELTS 9.0"];
  return (
    <svg ref={ref} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className="sc sc-dawn" viewBox="0 0 600 760" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#93b6ff" />
          <stop offset=".34" stopColor="#bcb5ff" />
          <stop offset=".6" stopColor="#f5c5e6" />
          <stop offset=".8" stopColor="#ffdcc8" />
          <stop offset="1" stopColor="#fff0d2" />
        </linearGradient>
        <radialGradient id={`glow${id}`}>
          <stop offset="0" stopColor="#fff9e0" stopOpacity=".95" />
          <stop offset=".45" stopColor="#ffe8cf" stopOpacity=".5" />
          <stop offset="1" stopColor="#ffe8cf" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`star${id}`}>
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`mist${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`trail${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="-90" y2="-40">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="600" height="760" fill={`url(#sky${id})`} />
      <circle cx="430" cy="470" r="240" fill={`url(#glow${id})`} />

      <Layer depth={3}>
        {STARS.map(([x, y, r], i) => (
          <circle key={i} className="sc-twinkle" style={{ animationDelay: `${(i * 0.37) % 4}s` }} cx={x} cy={y} r={r} fill="#fff" />
        ))}
        <circle cx="470" cy="110" r="40" fill={`url(#star${id})`} />
        <g className="sc-pulse">
          <Sparkle x={470} y={110} s={2.3} />
          <Sparkle x={470} y={110} s={0.9} fill="#fff6c2" />
        </g>
        <g className="sc-shoot">
          <path d="M0 0L-90-40" stroke={`url(#trail${id})`} strokeWidth="2.4" strokeLinecap="round" />
          <circle r="2.4" fill="#fff" />
        </g>
      </Layer>

      <Layer depth={5}>
        <g className="sc-drift">
          <Cloud x={24} y={246} s={0.8} shade="#e6dcff" opacity={0.9} />
        </g>
        <g className="sc-drift slow rev">
          <Cloud x={366} y={206} s={0.58} shade="#f6dcef" opacity={0.8} />
        </g>
        <g className="sc-drift slower">
          <Cloud x={196} y={350} s={0.46} opacity={0.65} />
        </g>
      </Layer>

      <Layer depth={7}>
        <Ridge
          ridge={[[-40, 480], [60, 400], [112, 432], [185, 316], [252, 408], [300, 368], [362, 430], [440, 296], [520, 396], [600, 336], [660, 420]]}
          bottom={640}
          base="#b5a6f3"
          light="#cbbefb"
          dark="#a292ea"
          cap="#f6f2ff"
          capAbove={330}
        />
      </Layer>
      <Layer depth={10}>
        <Ridge
          ridge={[[-30, 560], [70, 470], [140, 520], [232, 428], [330, 540], [410, 466], [500, 540], [560, 490], [650, 540]]}
          bottom={700}
          base="#93aaf4"
          light="#aec1fb"
          dark="#7f96ea"
        />
        <rect y="470" width="600" height="150" fill={`url(#mist${id})`} />
      </Layer>

      <Layer depth={14}>
        <path d="M240 760C320 626 460 588 640 598V760Z" fill="#a3e3b7" />
        <path d="M268 704C340 632 460 600 620 600" fill="none" stroke="#d2f7df" strokeWidth="3" strokeLinecap="round" opacity=".85" />
        <path d="M318 760C340 712 392 690 440 668C480 650 510 628 530 606L540 610C522 636 494 660 456 684C414 708 380 730 372 760Z" fill="#fff3da" opacity=".95" />
        <ellipse cx="545" cy="605" rx="17" ry="4" fill="#5aa877" opacity=".45" />
        <rect x="541" y="538" width="8" height="68" rx="3" fill="#8a5a3c" />
        <g transform="rotate(-6 545 556)">
          <path d="M492 544H584L596 556L584 568H492Z" fill="#b0684a" />
          <path d="M492 544H584L590 550H492Z" fill="#c9845f" />
          <text x="500" y="561" className="sc-sign">
            {signs[0]}
          </text>
        </g>
        <g transform="rotate(5 545 584)">
          <path d="M598 572H508L496 584L508 596H598Z" fill="#8f5238" />
          <text x="512" y="589" className="sc-sign">
            {signs[1]}
          </text>
        </g>
        <Tuft x={588} y={630} />
        <Tuft x={300} y={690} s={0.8} fill="#62c98e" />
        <Flower x={520} y={640} petal="#ffd1e6" />
        <Flower x={586} y={660} />

        <path d="M-20 596C110 556 250 588 340 640C392 670 414 716 420 760H-20Z" fill="#79d69d" />
        <path d="M-10 598C110 560 240 590 330 638" fill="none" stroke="#baf2d0" strokeWidth="4" strokeLinecap="round" />
        <Tuft x={250} y={628} fill="#4db677" />
        <Tuft x={28} y={690} s={1.2} fill="#4db677" />
        <Flower x={300} y={662} petal="#fff4b5" heart="#ff9f5a" />
        <Flower x={60} y={604} petal="#ffd1e6" />
        <Flower x={372} y={712} />
      </Layer>

      <Layer depth={20}>
        <g className="sc-bob">
          <Nova x={34} y={548} size={200} tone="sun" extra={variant === "teacher" ? undefined : "cap"} mood={variant === "teacher" ? "wink" : "happy"} sparkles={false} />
        </g>
        <g className="sc-bob late">
          <Nova x={452} y={598} size={70} tone="mint" mood="cheer" sparkles={false} />
        </g>
        <Nova x={498} y={676} size={122} tone="rose" mood="wink" sparkles={false} />
        <Sparkle x={92} y={466} s={0.9} className="sc-twinkle" />
        <Sparkle x={330} y={300} s={0.7} className="sc-twinkle" style={{ animationDelay: "1.2s" }} />
        <Sparkle x={560} y={420} s={0.8} className="sc-twinkle" style={{ animationDelay: "2.1s" }} />
      </Layer>
    </svg>
  );
}

function Leaf({ x, y, r = 0, s = 1, fill = "#8fca7a", vein = "#6fae62" }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 0C-14-26-10-58 4-82C16-56 18-26 0 0Z" fill={fill} />
      <path d="M0-2C2-28 3-52 4-78" fill="none" stroke={vein} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

// A floating island: faceted grass on top, a pastel rock hanging below.
function Island({ top, rock, grass = ["#cfe9a4", "#e2f3bf", "#b6dc8b"], stone = ["#e3b4d3", "#f1cfe4", "#cf99c1"] }) {
  const cx = top.reduce((a, p) => a + p[0], 0) / top.length;
  const cy = top.reduce((a, p) => a + p[1], 0) / top.length;
  const rockFaces = [];
  for (let i = 0; i < rock.length - 1; i++) {
    rockFaces.push(<polygon key={i} points={pts([[cx, cy + 20], rock[i], rock[i + 1]])} fill={i % 3 === 0 ? stone[1] : i % 3 === 1 ? stone[0] : stone[2]} />);
  }
  const grassFaces = [];
  for (let i = 0; i < top.length; i++) {
    const a = top[i];
    const b = top[(i + 1) % top.length];
    grassFaces.push(<polygon key={i} points={pts([[cx, cy], a, b])} fill={grass[i % 3]} />);
  }
  return (
    <g>
      {rockFaces}
      {grassFaces}
    </g>
  );
}

// Call-to-action banner: a bright sky with light rays, clouds and two
// floating islands carrying Nova's friends.
export function IslandScene() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg className="sc sc-islands" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`isky${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b9f1ff" />
          <stop offset=".4" stopColor="#d9efff" />
          <stop offset=".7" stopColor="#e8e0ff" />
          <stop offset="1" stopColor="#ffe1ef" />
        </linearGradient>
      </defs>
      <rect width="1600" height="600" fill={`url(#isky${id})`} />
      <g fill="#fff" opacity=".28">
        <polygon points="800,-40 560,640 700,640" />
        <polygon points="800,-40 860,640 1010,640" />
        <polygon points="800,-40 1180,640 1330,640" />
        <polygon points="800,-40 250,640 360,640" />
      </g>

      <g className="sc-drift slower">
        <Cloud x={-60} y={440} s={1.9} shade="#e0d8ff" />
        <Cloud x={1180} y={460} s={2.1} shade="#f3d8ec" />
        <Cloud x={560} y={520} s={1.4} shade="#dcecff" opacity={0.9} />
      </g>
      <g className="sc-drift slow rev">
        <Cloud x={1320} y={40} s={0.9} shade="#e6e0ff" opacity={0.85} />
        <Cloud x={220} y={34} s={0.7} opacity={0.8} />
      </g>

      {/* The islands sit inside the part of the scene that stays visible
          when a wide banner crops the sides. */}
      <g className="sc-bob slow">
        <g transform="translate(88 0)">
          <Island
            top={[[60, 196], [140, 150], [236, 138], [326, 158], [404, 200], [330, 232], [200, 240], [100, 226]]}
            rock={[[70, 210], [120, 300], [160, 380], [206, 560], [242, 430], [286, 340], [332, 392], [364, 300], [404, 206]]}
          />
          <Leaf x={150} y={176} r={-18} s={0.9} />
          <Leaf x={170} y={180} r={14} s={0.7} fill="#a4d98c" />
          <Leaf x={330} y={184} r={22} s={0.75} />
          <Nova x={30} y={94} size={112} tone="mint" mood="wink" sparkles={false} />
        </g>
      </g>

      <g className="sc-bob late">
        <g transform="translate(-100 0)">
          <polygon points="1330,150 1348,52 1382,22 1404,64 1398,150" fill="#bdb6d6" />
          <polygon points="1348,52 1382,22 1372,150 1330,150" fill="#d0cae6" />
          <Island
            top={[[1196, 176], [1300, 126], [1420, 118], [1522, 150], [1566, 192], [1450, 220], [1300, 220]]}
            rock={[[1206, 196], [1250, 320], [1300, 470], [1342, 600], [1384, 470], [1432, 352], [1480, 420], [1520, 290], [1560, 198]]}
            stone={["#dcb0e0", "#ecd0f0", "#c49ad0"]}
          />
          <Leaf x={1250} y={170} r={-24} s={0.8} />
          <Leaf x={1500} y={170} r={26} s={0.9} fill="#a4d98c" />
          <Nova x={1420} y={40} size={96} tone="sky" extra="headphones" mood="happy" sparkles={false} />
        </g>
      </g>

      <g className="sc-bob">
        <polygon points="470,120 500,108 512,134 484,146" fill="#f0c6de" />
        <polygon points="1120,420 1146,410 1156,434 1130,442" fill="#d8c8f4" />
        <polygon points="1080,110 1098,102 1106,120 1088,126" fill="#c6e8b0" />
      </g>
      {[[520, 70], [1060, 60], [980, 470], [620, 460], [140, 420], [1460, 330]].map(([x, y], i) => (
        <Sparkle key={i} x={x} y={y} s={0.8 + (i % 3) * 0.3} className="sc-twinkle" style={{ animationDelay: `${i * 0.6}s` }} />
      ))}
    </svg>
  );
}

// Footer landscape: layered low-poly mountains, green hills, plants and a
// sleeping Nova with her friends.
export function FooterScene() {
  return (
    <svg className="sc sc-footer" viewBox="0 0 1600 480" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <Ridge
        ridge={[[-40, 330], [120, 190], [262, 262], [384, 124], [520, 236], [646, 160], [770, 244], [906, 110], [1046, 226], [1184, 150], [1322, 244], [1462, 128], [1600, 206], [1680, 300]]}
        bottom={480}
        base="#bccaf1"
        light="#d0dbf8"
        dark="#a8b8e8"
        cap="#f1f4ff"
        capAbove={140}
      />
      <Ridge
        ridge={[[-30, 360], [150, 262], [300, 330], [446, 238], [606, 318], [760, 264], [940, 334], [1100, 246], [1262, 324], [1420, 256], [1640, 330]]}
        bottom={480}
        base="#8ecdc3"
        light="#a8dbd2"
        dark="#76bcb1"
      />
      <path d="M0 382C300 342 520 362 800 352C1080 342 1300 364 1600 342V480H0Z" fill="#aadb93" />
      <path d="M0 410C340 380 620 404 840 398C1100 392 1340 406 1600 388V480H0Z" fill="#93cf7e" />
      <path d="M0 446C360 430 640 444 860 440C1120 436 1360 448 1600 434V480H0Z" fill="#84c56f" />
      <ellipse cx="800" cy="398" rx="170" ry="24" fill="#86c173" opacity=".6" />

      <g transform="translate(1290 330)">
        <circle r="52" fill="#5f82c8" />
        <path d="M0 0m-6 0a6 6 0 1 1 12 0a14 14 0 1 1-26 0a22 22 0 1 1 42 0a32 32 0 1 1-60 4" fill="none" stroke="#9cb9f0" strokeWidth="5" strokeLinecap="round" />
      </g>

      <Leaf x={70} y={420} r={-30} s={1.6} fill="#77b884" vein="#5c9c6c" />
      <Leaf x={110} y={430} r={-6} s={1.9} fill="#8cc893" vein="#6aa877" />
      <Leaf x={170} y={430} r={20} s={1.3} fill="#77b884" vein="#5c9c6c" />
      <Leaf x={1480} y={432} r={16} s={1.8} fill="#8cc893" vein="#6aa877" />
      <Leaf x={1540} y={430} r={34} s={1.4} fill="#77b884" vein="#5c9c6c" />
      <Leaf x={560} y={400} r={-20} s={0.9} fill="#8cc893" vein="#6aa877" />
      <Leaf x={1030} y={402} r={18} s={0.8} fill="#8cc893" vein="#6aa877" />

      <g className="sc-bob slow">
        <Nova x={704} y={226} size={190} tone="sun" mood="sleep" sparkles={false} />
      </g>
      <g className="sc-zz">
        <text x="878" y="250">z</text>
        <text x="900" y="222">z</text>
        <text x="926" y="190">Z</text>
      </g>
      <Nova x={188} y={292} size={170} tone="rose" mood="happy" sparkles={false} />
      <g className="sc-bob late">
        <Nova x={1146} y={250} size={92} tone="sky" extra="headphones" sparkles={false} />
      </g>
      <Nova x={1356} y={306} size={150} tone="peach" mood="wink" extra="shades" sparkles={false} />
    </svg>
  );
}

// Soft sky for the statement / quote band.
export function CloudBand() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg className="sc sc-band" viewBox="0 0 1600 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`band${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#cdf6ff" />
          <stop offset=".5" stopColor="#e3f3ff" />
          <stop offset="1" stopColor="#efe6ff" />
        </linearGradient>
      </defs>
      <rect width="1600" height="560" fill={`url(#band${id})`} />
      <g fill="#fff" opacity=".4">
        <polygon points="420,-20 180,580 320,580" />
        <polygon points="1100,-20 1180,580 1330,580" />
      </g>
      <polygon points="-20,380 120,300 260,440 150,580 -20,580" fill="#f7cadb" />
      <polygon points="120,300 260,440 150,580" fill="#f1b7cd" />
      <polygon points="1400,580 1520,330 1640,420 1640,580" fill="#ddd2ff" />
      <polygon points="1520,330 1480,580 1400,580" fill="#cfc0fb" />
      <g className="sc-drift slow">
        <Cloud x={-80} y={-10} s={1.6} shade="#e7e0ff" />
        <Cloud x={1250} y={16} s={1.3} shade="#e3f0ff" />
      </g>
      <g className="sc-drift slower rev">
        <Cloud x={1180} y={430} s={1.5} shade="#ece2ff" />
        <Cloud x={120} y={450} s={1.2} shade="#e0f4ff" opacity={0.9} />
      </g>
    </svg>
  );
}
