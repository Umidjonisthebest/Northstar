import React from "react";

/*
 * Spot illustrations: Northstar's own drawing style, used on the cover page, in empty states and
 * on cards. Each is an object from the student's journey, drawn the same way:
 *
 *   - one flat accent shape behind it (`accent`, a pale colour from the palette),
 *   - the object in ink outline (round ends, even weight) with a grey-lilac wash for its body,
 *     a darker wash on the shaded side and white where light falls,
 *   - at most one part of the object filled with the deeper accent (`pop`).
 *
 * So a picture is always: ink + two greys + one colour. That is what makes the set look like one
 * hand drew it, and why new ones should follow the same recipe. viewBox is 200 x 160.
 *
 *   <Spot name="telescope" accent="#ffd9ec" pop="#f28ac4" size={160} />
 */

const INK = "#2b2553";
const WASH = "#e9e6f3";
const SHADE = "#cbc6de";
const WHITE = "#ffffff";

const star = (x, y, r) => `M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`;
const Sparkles = ({ at }) => (
  <g fill={INK} stroke="none">
    {at.map(([x, y, r], i) => (
      <path key={i} d={star(x, y, r)} />
    ))}
  </g>
);

const BLOBS = {
  a: "M38 74c-10-36 30-62 72-56s66 32 56 70-46 56-88 46-32-28-40-60z",
  b: "M30 88c-6-40 44-74 92-64s58 50 40 82-62 44-98 32-30-22-34-50z",
  c: "M44 60c14-34 66-48 100-26s34 62 12 88-72 30-100 10-24-44-12-72z"
};

const ART = {
  // Finding your level: the diagnostic.
  telescope: ({ pop }) => (
    <>
      <path d="M104 98 78 146M104 98v50M104 98l28 48" />
      <g transform="rotate(-28 100 84)">
        <rect x="52" y="69" width="88" height="30" rx="7" fill={WASH} />
        <path d="M58 93h78" stroke={SHADE} strokeWidth="7" />
        <rect x="52" y="69" width="88" height="30" rx="7" />
        <rect x="134" y="62" width="18" height="44" rx="6" fill={WHITE} />
        <rect x="36" y="77" width="18" height="14" rx="4" fill={pop} />
        <path d="M70 76h34" stroke={WHITE} strokeWidth="4" />
      </g>
      <circle cx="104" cy="98" r="8" fill={WHITE} />
      <Sparkles at={[[166, 30, 9], [34, 36, 6], [176, 70, 4]]} />
    </>
  ),
  // Practising.
  rocket: ({ pop }) => (
    <>
      <path d="M72 88c-14 6-22 18-22 34l24-10z" fill={SHADE} />
      <path d="M128 88c14 6 22 18 22 34l-24-10z" fill={SHADE} />
      <path d="M100 16c23 19 33 47 28 84H72c-5-37 5-65 28-84z" fill={WASH} />
      <path d="M113 30c12 19 16 42 13 70h-11c3-27 1-50-9-66z" fill={SHADE} stroke="none" />
      <path d="M100 16c23 19 33 47 28 84H72c-5-37 5-65 28-84z" />
      <circle cx="100" cy="62" r="13" fill={WHITE} />
      <circle cx="100" cy="62" r="6" fill={SHADE} />
      <rect x="85" y="100" width="30" height="11" rx="4" fill={SHADE} />
      <path d="M90 113c0 14 4 24 10 33 6-9 10-19 10-33z" fill={pop} />
      <path d="M40 60h14M36 78h10M148 50h14M156 68h10" strokeWidth="2.400" />
      <Sparkles at={[[158, 104, 6], [44, 34, 5]]} />
    </>
  ),
  // The sky itself: progress.
  planet: ({ pop }) => (
    <>
      <ellipse cx="100" cy="84" rx="80" ry="19" transform="rotate(-16 100 84)" />
      <circle cx="100" cy="82" r="44" fill={WASH} />
      <path d="M131 51a44 44 0 0 1-60 64 52 52 0 0 0 60-64z" fill={SHADE} stroke="none" />
      <circle cx="100" cy="82" r="44" />
      <path d="M62 66q38 13 80-3M58 92q42 15 86 0" strokeWidth="2.400" />
      <circle cx="84" cy="76" r="5" fill={WHITE} strokeWidth="2.400" />
      <path d="M23 106.100A80 19 -16 0 0 177 61.900" stroke={pop} strokeWidth="7" />
      <path d="M23 106.100A80 19 -16 0 0 177 61.900" strokeWidth="2.400" transform="translate(0 4.500)" />
      <circle cx="160" cy="32" r="10" fill={WHITE} />
      <Sparkles at={[[36, 40, 7], [170, 122, 5]]} />
    </>
  ),
  // Reading & Writing, and the question bank.
  book: ({ pop }) => (
    <>
      <path d="M32 54v70c24-7 50-4 68 9 18-13 44-16 68-9V54" fill={SHADE} />
      <path d="M100 56C84 44 62 42 40 48v68c22-6 44-4 60 8z" fill={WHITE} />
      <path d="M100 56c16-12 38-14 60-8v68c-22-6-44-4-60 8z" fill={WASH} />
      <path d="M100 56v68" />
      <path d="M52 66q16-3 34 3M52 80q16-3 34 3M52 94q12-2 24 2M114 69q18-6 34-3M114 83q18-6 34-3M114 97q12-4 22-2" stroke={SHADE} strokeWidth="3" />
      <path d={star(100, 26, 16)} fill={pop} />
      <Sparkles at={[[146, 22, 5], [56, 28, 4]]} />
    </>
  ),
  // Timed mock tests.
  hourglass: ({ pop }) => (
    <>
      <path d="M70 34h60c0 24-18 34-24 46 6 12 24 22 24 46H70c0-24 18-34 24-46-6-12-24-22-24-46z" fill={WHITE} />
      <path d="M81 48h38c-4 11-13 17-19 25-6-8-15-14-19-25z" fill={pop} />
      <path d="M78 126c2-12 12-19 22-19s20 7 22 19z" fill={pop} />
      <path d="M100 80v24" strokeDasharray="1 6" />
      <rect x="60" y="22" width="80" height="12" rx="5" fill={SHADE} />
      <rect x="60" y="126" width="80" height="12" rx="5" fill={SHADE} />
      <path d="M120 44c-2 9-8 14-12 19" stroke={WHITE} strokeWidth="4" />
      <Sparkles at={[[160, 46, 7], [38, 110, 5]]} />
    </>
  ),
  // Analytics.
  chart: ({ pop }) => (
    <>
      <rect x="34" y="30" width="108" height="92" rx="14" fill={WHITE} />
      <rect x="52" y="84" width="16" height="24" rx="5" fill={WASH} />
      <rect x="76" y="66" width="16" height="42" rx="5" fill={SHADE} />
      <rect x="100" y="48" width="16" height="60" rx="5" fill={pop} />
      <path d="M46 108h82" />
      <circle cx="140" cy="100" r="24" fill={WHITE} fillOpacity=".7" />
      <path d="M128 92q8-10 20-6" stroke={SHADE} strokeWidth="4" />
      <path d="M157 117l16 17" strokeWidth="8" />
      <path d="M157 117l16 17" stroke={WASH} strokeWidth="3" />
      <Sparkles at={[[166, 36, 7], [24, 70, 4]]} />
    </>
  ),
  // The goal: test day.
  summit: ({ pop }) => (
    <>
      <path d="M22 134 84 46l26 36 16-20 52 72z" fill={WASH} />
      <path d="M126 62l52 72h-42z" fill={SHADE} stroke="none" />
      <path d="M84 46l26 36-6 52H84z" fill={SHADE} stroke="none" opacity=".55" />
      <path d="M22 134 84 46l26 36 16-20 52 72z" />
      <path d="M84 46 68 70l12-6 8 10 8-12 7 7" fill={WHITE} />
      <path d="M84 46V18" />
      <path d="M84 18h28l-8 9 8 9H84z" fill={pop} />
      <path d="M40 130q22-18 34-48" strokeDasharray="1 7" />
      <Sparkles at={[[150, 30, 8], [30, 50, 5]]} />
    </>
  ),
  // IELTS listening.
  headphones: ({ pop }) => (
    <>
      <path d="M46 94V78a54 54 0 0 1 108 0v16h-13V78a41 41 0 0 0-82 0v16z" fill={WASH} />
      <path d="M100 24a54 54 0 0 1 54 54v16h-13V78a41 41 0 0 0-41-41z" fill={SHADE} stroke="none" />
      <path d="M46 94V78a54 54 0 0 1 108 0v16h-13V78a41 41 0 0 0-82 0v16z" />
      <rect x="34" y="88" width="28" height="46" rx="11" fill={pop} />
      <rect x="138" y="88" width="28" height="46" rx="11" fill={pop} />
      <rect x="58" y="94" width="11" height="34" rx="5.500" fill={SHADE} />
      <rect x="131" y="94" width="11" height="34" rx="5.500" fill={SHADE} />
      <path d="M176 100q8 11 0 22M184 92q14 19 0 38" strokeWidth="2.400" />
      <Sparkles at={[[24, 60, 6], [176, 50, 5]]} />
    </>
  ),
  // Nova, as a chat: a speech bubble with a spark.
  chat: ({ pop }) => (
    <>
      <path d="M44 34h92a18 18 0 0 1 18 18v40a18 18 0 0 1-18 18H92l-26 22v-22H44a18 18 0 0 1-18-18V52a18 18 0 0 1 18-18z" fill={WHITE} />
      <path d="M136 34a18 18 0 0 1 18 18v40a18 18 0 0 1-18 18h-14V34z" fill={WASH} stroke="none" />
      <path d="M44 34h92a18 18 0 0 1 18 18v40a18 18 0 0 1-18 18H92l-26 22v-22H44a18 18 0 0 1-18-18V52a18 18 0 0 1 18-18z" />
      <path d="M46 62h44M46 80h28" stroke={SHADE} strokeWidth="5" />
      <path d={star(122, 72, 20)} fill={pop} />
      <Sparkles at={[[170, 30, 7], [176, 120, 4]]} />
    </>
  ),
  // The study plan: a calendar page with a marked day.
  calendar: ({ pop }) => (
    <>
      <rect x="40" y="36" width="120" height="100" rx="16" fill={WHITE} />
      <path d="M40 66V52a16 16 0 0 1 16-16h88a16 16 0 0 1 16 16v14z" fill={SHADE} />
      <rect x="40" y="36" width="120" height="100" rx="16" />
      <path d="M40 66h120M70 26v20M130 26v20" />
      <g stroke={SHADE} strokeWidth="6">
        <path d="M62 84h.01M84 84h.01M106 84h.01M128 84h.01M62 104h.01M84 104h.01M128 104h.01M62 122h.01M84 122h.01" strokeWidth="9" />
      </g>
      <rect x="96" y="94" width="22" height="22" rx="7" fill={pop} />
      <path d="M101.500 105l4 4 7-8" strokeWidth="2.600" />
      <Sparkles at={[[176, 44, 7], [24, 100, 5]]} />
    </>
  )
};

export default function Spot({ name, accent = "#e6dcff", pop = "#a48bf5", blob = "a", size = 160, className = "", title }) {
  const Draw = ART[name];
  if (!Draw) return null;
  return (
    <svg className={`spot spot-${name} ${className}`} width={size} height={size * 0.8} viewBox="0 0 200 160" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path className="spot-blob" d={BLOBS[blob] || BLOBS.a} fill={accent} />
      <g fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <Draw pop={pop} />
      </g>
    </svg>
  );
}
