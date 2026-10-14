// Seeded generators for digital-SAT Math practice questions, one per skill.
//
// Every generator is deterministic for a given (skill, level, seed), which is
// what lets the server re-create a "Remix" variant from its id for grading
// instead of storing it. Each wrong option is built from a specific mistake,
// and its rationale names that mistake.
//
// Text conventions (rendered by the frontend's MathText):
//   "^{...}"  superscript (e.g. "2^{t/3}"), "−" is a real minus sign,
//   newlines in a prompt start a new line (used for systems of equations).

import { SKILLS } from "../practiceSkills.js";

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const nz = (r, lo, hi) => {
  let v = 0;
  while (v === 0) v = int(r, lo, hi);
  return v;
};
const pick = (r, list) => list[Math.floor(r() * list.length)];
function shuffle(r, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};

const MINUS = "−";
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻" };
const sup = (k) => String(k).split("").map((ch) => SUP[ch] ?? ch).join("");

// Number for display: integers as-is, decimals trimmed, real minus sign.
export function n(v) {
  const rounded = Math.round(v * 10000) / 10000;
  const abs = Math.abs(rounded);
  const s = Number.isInteger(abs) ? String(abs) : String(abs).replace(/0+$/, "").replace(/\.$/, "");
  return (rounded < 0 ? MINUS : "") + s;
}
// Money: $1,234 or $12.50
const money = (v) => `$${Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2)}`;
// Reduced fraction for display ("7/2", "−3/4", or an integer).
function frac(p, q) {
  if (q < 0) {
    p = -p;
    q = -q;
  }
  const g = gcd(p, q);
  p /= g;
  q /= g;
  if (q === 1) return n(p);
  return `${p < 0 ? MINUS : ""}${Math.abs(p)}/${q}`;
}
// ASCII answer for grid-in grading ("-3", "7/2", "2.5").
function ascii(v) {
  return n(v).replace(MINUS, "-");
}
// Polynomial from [coefficient, variable] pairs: [[3,"x²"],[-5,"x"],[2,""]] -> "3x² − 5x + 2".
function poly(terms) {
  let out = "";
  for (const [c, v] of terms) {
    if (c === 0) continue;
    const abs = Math.abs(c);
    const body = v ? (abs === 1 ? v : `${n(abs)}${v}`) : n(abs);
    if (!out) out = (c < 0 ? MINUS : "") + body;
    else out += (c < 0 ? ` ${MINUS} ` : " + ") + body;
  }
  return out || "0";
}
const lin = (a, b, v = "x") => poly([[a, v], [b, ""]]);
const signed = (b) => (b < 0 ? `${MINUS} ${n(-b)}` : `+ ${n(b)}`); // "+ 4" / "− 4"

// Numeric value of an option string, or null if it isn't a plain number.
function numericValue(text) {
  const t = String(text).replace(MINUS, "-").replace(/[$,%°]/g, "").trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = t.match(/^(-?\d+)\/(\d+)$/);
  return m ? Number(m[1]) / Number(m[2]) : null;
}

// Fallback wrong options that look like the correct one (same $, %, commas,
// decimals, fraction, or π form) for when the mistake-based ones collide.
const PAD_WHY = "This doesn't follow from the given information. Work through the steps to see where the correct value comes from.";
function autoPad(text) {
  const t = String(text);
  const num = t.match(/^(\$)?(−)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(%)?$/);
  if (num) {
    const [, pre = "", neg, whole, dec = "", suf = ""] = num;
    const val = Number(`${whole.replace(/,/g, "")}.${dec || 0}`) * (neg ? -1 : 1);
    const step = dec ? Math.max(Number(`0.${"0".repeat(Math.max(0, dec.length - 1))}1`) * 10, Math.abs(val) * 0.1) : Math.abs(val) >= 20 ? 5 : 1;
    return (k) => {
      const v = Math.round((val + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step) * 100) / 100;
      if (v < 0 && val >= 0) return null;
      const abs = Math.abs(v);
      const body = dec ? abs.toFixed(dec.length) : whole.includes(",") ? Math.round(abs).toLocaleString("en-US") : String(Math.round(abs));
      return { text: `${v < 0 ? MINUS : ""}${pre}${body}${suf}`.replace(`${MINUS}$`, `${MINUS}$`), why: PAD_WHY };
    };
  }
  const f = t.match(/^(−)?(\d+)\/(\d+)$/);
  if (f) {
    const p = Number(f[2]) * (f[1] ? -1 : 1);
    const q = Number(f[3]);
    return (k) => {
      const np = p + (k % 2 ? 1 : -1) * Math.ceil(k / 2);
      return np === 0 || (p > 0 && np < 0) ? null : { text: frac(np, q), why: PAD_WHY };
    };
  }
  const power = t.match(/^x([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
  if (power) {
    const e = Number([...power[1]].map((ch) => Object.keys(SUP).find((d) => SUP[d] === ch)).join(""));
    return (k) => {
      const ne = e + (k % 2 ? 1 : -1) * Math.ceil(k / 2);
      return ne < 2 ? null : { text: `x${sup(ne)}`, why: PAD_WHY };
    };
  }
  const pi = t.match(/^(\d*)π(?:\/(\d+))?$/);
  if (pi) {
    const c = Number(pi[1] || 1);
    const q = pi[2] ? `/${pi[2]}` : "";
    return (k) => {
      const nc = c + (k % 2 ? 1 : -1) * Math.ceil(k / 2);
      return nc <= 0 ? null : { text: `${nc === 1 ? "" : nc}π${q}`, why: PAD_WHY };
    };
  }
  return null;
}

// Build a multiple-choice question: correct + wrong options (each with the
// reason it's wrong). Duplicates are dropped; `pad(k)` supplies extras.
// Numeric options are listed in ascending order, like the real test.
function mc(r, correct, wrongs, pad) {
  const used = new Set([correct.text]);
  const picked = [];
  for (const w of wrongs) {
    if (!w || w.text == null || w.text === "" || used.has(w.text) || /NaN|Infinity/.test(w.text)) continue;
    used.add(w.text);
    picked.push(w);
    if (picked.length === 3) break;
  }
  for (const source of [pad, autoPad(correct.text)]) {
    for (let k = 1; picked.length < 3 && source && k < 40; k++) {
      const w = source(k);
      if (w && !used.has(w.text)) {
        used.add(w.text);
        picked.push(w);
      }
    }
  }
  let all = [{ ...correct, ok: true }, ...picked];
  const values = all.map((o) => numericValue(o.text));
  all = values.every((v) => v !== null) ? all.map((o, i) => ({ o, v: values[i] })).sort((a, b) => a.v - b.v).map((x) => x.o) : shuffle(r, all);
  return {
    type: "mcq",
    options: all.map((o) => o.text),
    correctIndex: all.findIndex((o) => o.ok),
    rationales: all.map((o) => (o.ok ? `Correct. ${o.why}` : o.why))
  };
}
const numPad = (value, why = "This value doesn't satisfy the conditions in the question. Substitute it back in to check.") => (k) => ({
  text: n(value + (k % 2 ? Math.ceil(k / 2) : -Math.ceil(k / 2)) * (Math.abs(value) >= 20 ? 5 : 1)),
  why
});
const grid = (answer) => ({ type: "grid_in", correctAnswer: ascii(answer) });
const step = (title, body) => ({ title, body });

// ---------------------------------------------------------------------------
// Algebra
// ---------------------------------------------------------------------------
function linearOneVariable(r, level) {
  if (level === "Easy") {
    const a = int(r, 2, 9);
    const x = int(r, -5, 12);
    const b = nz(r, -15, 15);
    const c = a * x + b;
    const eq = `${lin(a, b)} = ${n(c)}`;
    return {
      title: `Solve ${eq}`,
      prompt: `If ${eq}, what is the value of x?`,
      ...mc(r, { text: n(x), why: `Undo the ${signed(b)} to get ${a}x = ${n(c - b)}, then divide by ${a}.` }, [
        { text: frac(c + b, a), why: `This moves the ${n(Math.abs(b))} the wrong way. To undo ${signed(b)}, ${b > 0 ? "subtract" : "add"} ${n(Math.abs(b))} on both sides.` },
        { text: n(c - b), why: `This is the value of ${a}x. You still need to divide by ${a}.` },
        { text: frac(c - a * b, a), why: `This divides only the ${n(c)} by ${a} before dealing with the constant. Every term would need dividing.` }
      ], numPad(x)),
      explanation: `${a}x = ${n(c - b)}, so x = ${n(x)}.`,
      steps: [
        step("Undo the constant", `${b > 0 ? "Subtract" : "Add"} ${n(Math.abs(b))} on both sides:\n${a}x = ${n(c)} ${b > 0 ? MINUS : "+"} ${n(Math.abs(b))} = ${n(c - b)}`),
        step("Divide by the coefficient", `x = ${n(c - b)} ÷ ${a} = ${n(x)}`),
        step("Check", `${a}(${n(x)}) ${signed(b)} = ${n(c)}, which matches.`)
      ],
      hint: `Get the x-term alone first: what do you do to both sides to cancel the ${signed(b)}?`
    };
  }
  if (level === "Medium") {
    const a = int(r, 2, 6);
    const x = int(r, -4, 10);
    const b = nz(r, -7, 7);
    const c = nz(r, -9, 9);
    const d = a * (x + b) + c;
    const eq = `${a}(${lin(1, b)}) ${signed(c)} = ${n(d)}`;
    return {
      title: `Solve ${eq}`,
      prompt: `If ${eq}, what is the value of x?`,
      ...mc(r, { text: n(x), why: `${a}(x ${signed(b)}) = ${n(d - c)}, so x ${signed(b)} = ${n((d - c) / a)} and x = ${n(x)}.` }, [
        { text: frac(d - b - c, a), why: `This distributes the ${a} to x only. ${a}(x ${signed(b)}) = ${a}x ${signed(a * b)}, not ${a}x ${signed(b)}.` },
        { text: n(x + 2 * b), why: `After dividing, x ${signed(b)} = ${n(x + b)}. This ${b > 0 ? "adds" : "subtracts"} ${n(Math.abs(b))} again instead of undoing it.` },
        { text: n(x + b), why: `This is the value of x ${signed(b)}, not x.` },
        { text: frac(d - a * b, a), why: `This skips undoing the ${signed(c)} before dividing by ${a}.` }
      ], numPad(x)),
      explanation: `Undo ${signed(c)}, divide by ${a}, then undo ${signed(b)}: x = ${n(x)}.`,
      steps: [
        step("Undo the outside constant", `${a}(x ${signed(b)}) = ${n(d)} ${c > 0 ? MINUS : "+"} ${n(Math.abs(c))} = ${n(d - c)}`),
        step("Divide by the factor outside the parentheses", `x ${signed(b)} = ${n(d - c)} ÷ ${a} = ${n(x + b)}`),
        step("Undo the inside constant", `x = ${n(x + b)} ${b > 0 ? MINUS : "+"} ${n(Math.abs(b))} = ${n(x)}`)
      ],
      hint: "Work from the outside in: deal with the constant outside the parentheses first."
    };
  }
  // Hard: either an expression to evaluate, or an equation with fractions (grid-in).
  if (r() < 0.5) {
    const a = int(r, 4, 9);
    const c = int(r, 1, a - 1);
    const x = nz(r, -4, 9);
    const b = int(r, -12, 12);
    const d = (a - c) * x + b;
    const k = int(r, 2, 5);
    const m = nz(r, -9, 9);
    const target = lin(k, m);
    return {
      title: `Find ${target}`,
      prompt: `If ${lin(a, b)} = ${lin(c, d)}, what is the value of ${target}?`,
      ...mc(r, { text: n(k * x + m), why: `x = ${n(x)}, so ${target} = ${k}(${n(x)}) ${signed(m)} = ${n(k * x + m)}.` }, [
        { text: n(x), why: "This is the value of x, but the question asks for a different expression." },
        { text: n(k * x), why: `This is ${k}x. Don't forget the ${signed(m)}.` },
        { text: n(k * (x + m)), why: `This computes ${k}(x ${signed(m)}) instead of ${target}.` }
      ], numPad(k * x + m)),
      explanation: `${a - c}x = ${n(d - b)}, so x = ${n(x)} and ${target} = ${n(k * x + m)}.`,
      steps: [
        step("Collect the x-terms", `${a}x ${MINUS} ${c === 1 ? "" : c}x = ${n(d)} ${b >= 0 ? MINUS : "+"} ${n(Math.abs(b))}\n${a - c === 1 ? "" : a - c}x = ${n(d - b)}`),
        step("Solve for x", `x = ${n(d - b)} ÷ ${a - c} = ${n(x)}`),
        step("Answer the actual question", `${target} = ${k}(${n(x)}) ${signed(m)} = ${n(k * x + m)}`)
      ],
      hint: "Solve for x first, then read the last line of the question again: it doesn't ask for x."
    };
  }
  let b;
  let d;
  let x;
  let a;
  let c;
  let k;
  do {
    b = int(r, 2, 5);
    d = int(r, 2, 6);
    k = int(r, -4, 6);
    x = int(r, -8, 14);
    a = b * k - x;
    c = x - d * k;
  } while (b === d || a === 0 || c === 0);
  const eq = `(${lin(1, a)})/${b} = (${lin(1, -c)})/${d}`;
  return {
    title: "An equation with fractions",
    prompt: `What value of x satisfies the equation ${eq}?`,
    ...grid(x),
    explanation: `Cross-multiplying gives ${d}(${lin(1, a)}) = ${b}(${lin(1, -c)}), so x = ${n(x)}.`,
    steps: [
      step("Cross-multiply", `${d}(${lin(1, a)}) = ${b}(${lin(1, -c)})`),
      step("Distribute", `${lin(d, d * a)} = ${lin(b, -b * c)}`),
      step("Collect and solve", `${lin(d - b, 0)} = ${n(-b * c - d * a)}\nx = ${n(x)}`)
    ],
    hint: "Multiply both sides by both denominators (cross-multiply) to clear the fractions."
  };
}

function linearTwoVariables(r, level) {
  if (level === "Easy") {
    const x1 = int(r, -5, 4);
    const dx = int(r, 1, 6);
    const m = nz(r, -4, 4);
    const y1 = int(r, -8, 8);
    const x2 = x1 + dx;
    const y2 = y1 + m * dx;
    return {
      title: "Slope from two points",
      prompt: `A line in the xy-plane passes through the points (${n(x1)}, ${n(y1)}) and (${n(x2)}, ${n(y2)}). What is the slope of the line?`,
      ...mc(r, { text: n(m), why: `(${n(y2)} ${MINUS} ${n(y1)}) ÷ (${n(x2)} ${MINUS} ${n(x1)}) = ${n(m * dx)} ÷ ${dx} = ${n(m)}.` }, [
        { text: frac(dx, m * dx), why: "This is run ÷ rise. Slope is rise ÷ run: change in y over change in x." },
        { text: n(-m), why: "The sign is flipped. Subtract the coordinates in the same order on top and bottom." },
        { text: n(m * dx), why: "This is the change in y only. Divide it by the change in x." },
        { text: frac(y2 + y1, x2 + x1 || 1), why: "This adds the coordinates. Slope uses differences, not sums." }
      ], numPad(m)),
      explanation: `Slope = change in y ÷ change in x = ${n(m * dx)} ÷ ${dx} = ${n(m)}.`,
      steps: [
        step("Change in y (rise)", `${n(y2)} ${MINUS} ${n(y1)} = ${n(m * dx)}`),
        step("Change in x (run)", `${n(x2)} ${MINUS} ${n(x1)} = ${dx}`),
        step("Divide", `slope = ${n(m * dx)} ÷ ${dx} = ${n(m)}`)
      ],
      hint: "Slope = (y₂ − y₁) ÷ (x₂ − x₁). Keep the same order on top and bottom."
    };
  }
  if (level === "Medium") {
    let xi;
    let yi;
    do {
      xi = int(r, 2, 9);
      yi = int(r, 2, 9);
    } while (xi === yi);
    const t = int(r, 1, 3);
    const g = gcd(yi * t, xi * t);
    const A = (yi * t) / g;
    const B = (xi * t) / g;
    const C = (xi * yi * t) / g;
    const askY = r() < 0.5;
    const eq = `${A}x + ${B}y = ${C}`;
    const correct = askY ? yi : xi;
    return {
      title: askY ? "Find the y-intercept" : "Find the x-intercept",
      prompt: askY
        ? `The graph of ${eq} in the xy-plane crosses the y-axis at the point (0, b). What is the value of b?`
        : `The graph of ${eq} in the xy-plane crosses the x-axis at the point (a, 0). What is the value of a?`,
      ...mc(r, { text: n(correct), why: askY ? `Set x = 0: ${B}y = ${C}, so y = ${n(yi)}.` : `Set y = 0: ${A}x = ${C}, so x = ${n(xi)}.` }, [
        { text: n(askY ? xi : yi), why: askY ? "That's the x-intercept. For the y-intercept, set x = 0." : "That's the y-intercept. For the x-intercept, set y = 0." },
        { text: n(C), why: `This forgets to divide by the coefficient of ${askY ? "y" : "x"}.` },
        { text: frac(askY ? -A : -B, askY ? B : A), why: askY ? "This is the slope of the line, not its y-intercept." : "This is a ratio of the coefficients, not the x-intercept." }
      ], numPad(correct)),
      explanation: askY ? `At the y-axis x = 0, so ${B}y = ${C} and y = ${n(yi)}.` : `At the x-axis y = 0, so ${A}x = ${C} and x = ${n(xi)}.`,
      steps: [
        step("Know which coordinate is zero", askY ? "Every point on the y-axis has x = 0." : "Every point on the x-axis has y = 0."),
        step("Substitute", askY ? `${A}(0) + ${B}y = ${C}  →  ${B}y = ${C}` : `${A}x + ${B}(0) = ${C}  →  ${A}x = ${C}`),
        step("Solve", askY ? `y = ${C} ÷ ${B} = ${n(yi)}` : `x = ${C} ÷ ${A} = ${n(xi)}`)
      ],
      hint: askY ? "What is x at every point on the y-axis?" : "What is y at every point on the x-axis?"
    };
  }
  let a;
  let b;
  do {
    a = nz(r, -6, 6);
    b = nz(r, -6, 6);
  } while (Math.abs(a) === Math.abs(b));
  const c = int(r, -12, 12);
  const eq = `${poly([[a, "x"], [b, "y"]])} = ${n(c)}`;
  return {
    title: "Perpendicular slope",
    prompt: `Line k is perpendicular to the line with equation ${eq} in the xy-plane. What is the slope of line k?`,
    ...mc(r, { text: frac(b, a), why: `The given line has slope ${frac(-a, b)}. A perpendicular slope is the negative reciprocal: ${frac(b, a)}.` }, [
      { text: frac(-a, b), why: "This is the slope of the given line. Perpendicular lines have negative reciprocal slopes." },
      { text: frac(-b, a), why: "This takes the reciprocal but keeps the original sign. Perpendicular slopes have opposite signs." },
      { text: frac(a, b), why: "This only changes the sign of the original slope; it also needs to be flipped (reciprocal)." }
    ]),
    explanation: `Rewrite as y = ${frac(-a, b).replace(/^(−?)(\d+\/\d+)$/, "$1($2)")}x + ... ; the perpendicular slope is ${frac(b, a)}.`,
    steps: [
      step("Solve for y", `${b === 1 ? "" : n(b)}y = ${poly([[-a, "x"], [c, ""]])}\nslope of the given line = ${frac(-a, b)}`),
      step("Take the negative reciprocal", `Flip the fraction and change the sign: ${frac(b, a)}`),
      step("Check", `(${frac(-a, b)}) × (${frac(b, a)}) = ${MINUS}1, which is true for perpendicular lines.`)
    ],
    hint: "Find the given line's slope first (solve for y). Perpendicular slopes multiply to −1."
  };
}

const RATE_CONTEXTS = [
  { set: (F, R) => `A phone plan charges ${money(F)} per month plus ${money(R)} for each gigabyte of data used.`, ask: "Which function gives the total monthly cost C, in dollars, of using g gigabytes of data?", fn: "C(g)", v: "g", F: [15, 20, 25, 30, 35], R: [3, 4, 5, 6, 8] },
  { set: (F, R) => `A taxi charges a ${money(F)} pickup fee plus ${money(R)} per mile.`, ask: "Which function gives the total fare T, in dollars, for a ride of m miles?", fn: "T(m)", v: "m", F: [3, 4, 5, 6], R: [2, 3, 4] },
  { set: (F, R) => `A gym charges a one-time sign-up fee of ${money(F)} and ${money(R)} per month.`, ask: "Which function gives the total cost C, in dollars, of a membership lasting m months?", fn: "C(m)", v: "m", F: [25, 40, 50, 60, 75], R: [15, 20, 25, 30, 35] },
  { set: (F, R) => `A candle is ${F} centimeters tall when it is lit and burns down ${R} centimeters per hour.`, ask: "Which function gives the candle's height h, in centimeters, t hours after it is lit?", fn: "h(t)", v: "t", F: [18, 20, 24, 30], R: [2, 3, 4], down: true }
];

const INTERPRET_CONTEXTS = [
  { fn: "V", v: "t", setup: (P, R) => `The function V(t) = ${P} ${MINUS} ${R}t gives the value, in dollars, of a machine t years after it was purchased.`, P: [1800, 2400, 3600, 5000], R: [150, 200, 300, 400], rate: (R) => `The machine's value decreases by $${R} each year.`, start: (P) => `The machine's value when it was purchased was $${P}.`, down: true },
  { fn: "W", v: "m", setup: (P, R) => `The function W(m) = ${P} ${MINUS} ${R}m gives the number of liters of water left in a tank m minutes after it starts draining.`, P: [600, 900, 1200, 1500], R: [15, 20, 25, 30], rate: (R) => `The tank loses ${R} liters of water each minute.`, start: (P) => `The tank held ${P} liters when it started draining.`, down: true },
  { fn: "S", v: "w", setup: (P, R) => `The function S(w) = ${P} + ${R}w gives the amount of money, in dollars, in Maya's savings account w weeks after she starts making weekly deposits.`, P: [120, 200, 350, 500], R: [15, 25, 30, 40], rate: (R) => `Maya deposits $${R} each week.`, start: (P) => `Maya had $${P} in the account before her first weekly deposit.` }
];

function linearFunctions(r, level) {
  if (level === "Easy") {
    const ctx = pick(r, RATE_CONTEXTS);
    const F = pick(r, ctx.F);
    const R = pick(r, ctx.R.filter((x) => x !== F));
    const s = ctx.down ? -1 : 1;
    const right = `${ctx.fn} = ${poly([[s * R, ctx.v], [F, ""]])}`;
    return {
      title: "Build a linear function",
      prompt: `${ctx.set(F, R)} ${ctx.ask}`,
      ...mc(r, { text: right, why: `The amount that changes per unit (${R}) multiplies ${ctx.v}; the one-time or starting amount (${F}) is the constant.` }, [
        { text: `${ctx.fn} = ${poly([[s * F, ctx.v], [R, ""]])}`, why: "This swaps the rate and the fixed amount." },
        { text: `${ctx.fn} = ${poly([[F + s * R, ctx.v]])}`, why: "This applies the fixed amount every time instead of once." },
        { text: `${ctx.fn} = ${poly([[-s * R, ctx.v], [F, ""]])}`, why: ctx.down ? "The height goes down over time, so the rate term must be subtracted." : "Costs go up with each unit, so the rate term should be added." }
      ]),
      explanation: `Rate × ${ctx.v} + starting amount: ${right}.`,
      steps: [
        step("Find the rate", `The amount that changes with each unit of ${ctx.v}: ${R}${ctx.down ? " (decreasing)" : ""}.`),
        step("Find the starting amount", `The amount when ${ctx.v} = 0: ${F}.`),
        step("Assemble", right)
      ],
      hint: "Which number is paid or changed every unit, and which happens only once?"
    };
  }
  if (level === "Medium") {
    const m = nz(r, -5, 6);
    const b = int(r, -10, 15);
    const x1 = int(r, 1, 4);
    const x2 = x1 + int(r, 1, 5);
    const f = (x) => m * x + b;
    return {
      title: "Recover a linear function",
      prompt: `For the linear function f, f(${x1}) = ${n(f(x1))} and f(${x2}) = ${n(f(x2))}. What is the value of f(0)?`,
      ...mc(r, { text: n(b), why: `The slope is ${n(m)}, and f(0) = f(${x1}) ${MINUS} ${n(m)}(${x1}) = ${n(b)}.` }, [
        { text: n(m), why: "This is the slope of f, not its value at 0." },
        { text: n(f(x1) - m), why: `This steps back only one unit from x = ${x1}. You need to step back ${x1} units.` },
        { text: n(f(x2) - f(x1)), why: "This is the change in f between the two inputs, not f(0)." },
        { text: n(f(x1) - x1), why: "This subtracts the input from the output, which isn't how linear functions work." }
      ], numPad(b)),
      explanation: `Slope = (${n(f(x2))} ${MINUS} ${n(f(x1))}) ÷ (${x2} ${MINUS} ${x1}) = ${n(m)}, and b = ${n(b)}.`,
      steps: [
        step("Find the slope", `m = (${n(f(x2))} ${MINUS} ${n(f(x1))}) ÷ (${x2} ${MINUS} ${x1}) = ${n(m)}`),
        step("Use one point to find b", `${n(f(x1))} = ${n(m)}(${x1}) + b  →  b = ${n(b)}`),
        step("f(0) is b", `f(0) = ${n(b)}`)
      ],
      hint: "Find the slope first, then use it to walk back from one of the points to x = 0."
    };
  }
  const ctx = pick(r, INTERPRET_CONTEXTS);
  const P = pick(r, ctx.P);
  const R = pick(r, ctx.R);
  const askRate = r() < 0.6;
  const rate = { text: ctx.rate(R), why: `${R} multiplies ${ctx.v}, so it is the change per 1 unit of ${ctx.v}.` };
  const start = { text: ctx.start(P), why: `${P} is the value when ${ctx.v} = 0: the starting amount.` };
  const misc = [
    { text: ctx.down ? `It takes ${R} ${ctx.v === "t" ? "years" : "minutes"} for the amount to reach zero.` : `Maya will have $${R} after one week.`, why: "This misreads what the coefficient measures." },
    { text: ctx.down ? `The amount after one ${ctx.v === "t" ? "year" : "minute"} is ${R}.` : `The account grows by ${R}% each week.`, why: "The coefficient is a fixed amount per unit, not a value or a percent." }
  ];
  return {
    title: "Interpret a linear model",
    prompt: `${ctx.setup(P, R)} What is the best interpretation of ${askRate ? R : P} in this context?`,
    ...mc(r, askRate ? rate : start, askRate ? [{ text: start.text.replace(String(P), String(R)), why: "The starting amount is the constant term, not the coefficient of the variable." }, ...misc] : [{ text: rate.text.replace(String(R), String(P)), why: "The rate is the coefficient of the variable, not the constant term." }, ...misc]),
    explanation: askRate ? `${R} is the rate: it multiplies ${ctx.v}.` : `${P} is the value when ${ctx.v} = 0.`,
    steps: [
      step("Recall the form", `A linear model looks like (starting value) ± (rate) × ${ctx.v}.`),
      step("Classify the number", askRate ? `${R} multiplies ${ctx.v}, so it's the rate of change.` : `${P} is the constant, so it's the value when ${ctx.v} = 0.`),
      step("Translate into the context", askRate ? rate.text : start.text)
    ],
    hint: `Is the number multiplied by ${ctx.v}, or is it the constant term?`
  };
}

function systemsLinear(r, level) {
  if (level === "Easy") {
    const x = int(r, -3, 14);
    const y = int(r, -3, 12);
    const askX = r() < 0.6;
    return {
      title: "Add the equations",
      prompt: `x + y = ${n(x + y)}\nx ${MINUS} y = ${n(x - y)}\nIn the system of equations above, what is the value of ${askX ? "x" : "y"}?`,
      ...mc(r, { text: n(askX ? x : y), why: askX ? `Adding the equations gives 2x = ${n(2 * x)}, so x = ${n(x)}.` : `Subtracting gives 2y = ${n(2 * y)}, so y = ${n(y)}.` }, [
        { text: n(askX ? y : x), why: `That's the value of ${askX ? "y" : "x"}.` },
        { text: n(askX ? 2 * x : 2 * y), why: `This is 2${askX ? "x" : "y"}. Divide by 2.` },
        { text: n(x + y), why: "This is x + y, straight from the first equation." }
      ], numPad(askX ? x : y)),
      explanation: `2x = ${n(2 * x)} → x = ${n(x)}, and y = ${n(y)}.`,
      steps: [
        step(askX ? "Add the equations" : "Subtract the equations", askX ? `(x + y) + (x ${MINUS} y) = ${n(x + y)} + ${n(x - y)}\n2x = ${n(2 * x)}` : `(x + y) ${MINUS} (x ${MINUS} y) = ${n(x + y)} ${MINUS} ${n(x - y)}\n2y = ${n(2 * y)}`),
        step("Divide by 2", askX ? `x = ${n(x)}` : `y = ${n(y)}`),
        step("Check", `${n(x)} + ${n(y)} = ${n(x + y)} and ${n(x)} ${MINUS} ${n(y)} = ${n(x - y)}.`)
      ],
      hint: "What happens to y if you add the two equations together?"
    };
  }
  if (level === "Medium") {
    let a1;
    let b1;
    let a2;
    let b2;
    do {
      a1 = int(r, 1, 5);
      b1 = nz(r, -4, 5);
      a2 = int(r, 1, 5);
      b2 = nz(r, -4, 5);
    } while (a1 * b2 - a2 * b1 === 0 || (a1 === a2 && b1 === b2));
    const x = int(r, -4, 8);
    const y = int(r, -4, 8);
    const c1 = a1 * x + b1 * y;
    const c2 = a2 * x + b2 * y;
    return {
      title: "Solve a system",
      prompt: `${poly([[a1, "x"], [b1, "y"]])} = ${n(c1)}\n${poly([[a2, "x"], [b2, "y"]])} = ${n(c2)}\nThe solution to the system of equations above is (x, y). What is the value of x + y?`,
      ...mc(r, { text: n(x + y), why: `The solution is (${n(x)}, ${n(y)}), so x + y = ${n(x + y)}.` }, [
        { text: n(x), why: "This is x alone. The question asks for x + y." },
        { text: n(y), why: "This is y alone. The question asks for x + y." },
        { text: n(x - y), why: "This is x − y, not x + y." }
      ], numPad(x + y)),
      explanation: `Solving gives x = ${n(x)} and y = ${n(y)}.`,
      steps: [
        step("Eliminate a variable", `Multiply the equations so one variable has matching coefficients, then subtract. (Or solve one equation for x and substitute.)`),
        step("Solve", `x = ${n(x)}, y = ${n(y)}`),
        step("Answer the question asked", `x + y = ${n(x)} + ${n(y)} = ${n(x + y)}`)
      ],
      hint: "Solve the system first, then check what the question asks for."
    };
  }
  const a = int(r, 2, 5);
  const b = int(r, 2, 7);
  const m = int(r, 2, 4);
  const c1 = int(r, 3, 15);
  let c2 = int(r, 3, 30);
  if (c2 === m * c1) c2 += 1;
  return {
    title: "A system with no solution",
    prompt: `${a}x + ky = ${c1}\n${m * a}x + ${m * b}y = ${c2}\nIn the system of equations above, k is a constant. For what value of k does the system have no solution?`,
    ...mc(r, { text: n(b), why: `With k = ${b}, the second equation's left side is ${m} times the first's, but ${c2} ≠ ${m}(${c1}), so the lines are parallel.` }, [
      { text: n(m * b), why: `This matches the y-coefficient without scaling. The x-coefficients differ by a factor of ${m}.` },
      { text: n(-b), why: "No solution means the same slope, so the coefficients must be proportional with the same sign." },
      { text: frac(b, m), why: `This divides by ${m} twice. The y-coefficients need the same ${m}-to-1 ratio as the x-coefficients.` }
    ], numPad(b)),
    explanation: `Parallel lines: coefficients proportional (${a}:${m * a} = k:${m * b}) but constants not.`,
    steps: [
      step("Know the condition", "No solution means parallel lines: the x and y coefficients are proportional, but the constants aren't."),
      step("Find the scale factor", `${m * a} ÷ ${a} = ${m}, so the second equation's coefficients are ${m} times the first's.`),
      step("Solve for k", `${m}k = ${m * b}  →  k = ${b}. Check the constants: ${m}(${c1}) = ${m * c1} ≠ ${c2}, so the lines don't coincide.`)
    ],
    hint: "Two lines with no intersection are parallel. What must be true of their coefficients?"
  };
}

const CAPACITY_CONTEXTS = [
  { make: (C, W, w) => `An elevator can carry at most ${C.toLocaleString("en-US")} kilograms. The operator weighs ${W} kilograms, and each box being moved weighs ${w} kilograms.`, ask: "What is the maximum number of boxes the operator can take in one trip?", C: [900, 1000, 1200, 1500], W: [70, 75, 80, 85], w: [22, 24, 25, 32, 35] },
  { make: (C, W, w) => `Ana has at most ${money(C)} to spend at a fair. Admission is ${money(W)}, and each ride ticket costs ${money(w)}.`, ask: "What is the maximum number of ride tickets Ana can buy?", C: [40, 45, 50, 60], W: [8, 10, 12], w: [3, 4, 6, 7] },
  { make: (C, W, w) => `A delivery van can hold at most ${C.toLocaleString("en-US")} pounds. The driver's equipment weighs ${W} pounds, and each package weighs ${w} pounds.`, ask: "What is the greatest number of packages the van can hold?", C: [2000, 2400, 3000], W: [120, 150, 180], w: [35, 45, 55, 65] }
];

function linearInequalities(r, level) {
  if (level === "Easy") {
    const a = int(r, 2, 5);
    const t = int(r, -5, 5);
    const b = int(r, -6, 10);
    const c = b - a * t;
    const good = t - int(r, 1, 3);
    return {
      title: "Flip the sign",
      prompt: `Which of the following values of x satisfies the inequality ${lin(-a, b)} > ${n(c)}?`,
      ...mc(r, { text: n(good), why: `The inequality simplifies to x < ${n(t)}, and ${n(good)} < ${n(t)}.` }, [
        { text: n(t), why: `At x = ${n(t)} both sides are equal, but the inequality is strict (>).` },
        { text: n(t + 1), why: `Dividing by ${MINUS}${a} flips the sign, so the solutions are x < ${n(t)}. This value is greater.` },
        { text: n(t + 3), why: `This comes from forgetting to flip the sign (x > ${n(t)}).` }
      ]),
      explanation: `${MINUS}${a}x > ${n(c - b)}, and dividing by ${MINUS}${a} flips the sign: x < ${n(t)}.`,
      steps: [
        step("Isolate the x-term", `${MINUS}${a}x > ${n(c)} ${b >= 0 ? MINUS : "+"} ${n(Math.abs(b))} = ${n(c - b)}`),
        step("Divide by a negative: flip the sign", `x < ${n(c - b)} ÷ (${MINUS}${a}) = ${n(t)}`),
        step("Test the choices", `Only ${n(good)} is less than ${n(t)}.`)
      ],
      hint: "What happens to an inequality sign when you divide both sides by a negative number?"
    };
  }
  if (level === "Medium") {
    const ctx = pick(r, CAPACITY_CONTEXTS);
    let C;
    let W;
    let w;
    let max;
    do {
      C = pick(r, ctx.C);
      W = pick(r, ctx.W);
      w = pick(r, ctx.w);
      max = Math.floor((C - W) / w);
    } while ((C - W) % w === 0);
    return {
      title: "Round down for capacity",
      prompt: `${ctx.make(C, W, w)} ${ctx.ask}`,
      ...mc(r, { text: n(max), why: `${W} + ${w}n ≤ ${C} gives n ≤ ${n((C - W) / w)}, and n must be a whole number, so n = ${max}.` }, [
        { text: n(max + 1), why: `This rounds ${n((C - W) / w)} up, which would go over the limit.` },
        { text: n(Math.floor(C / w)), why: "This ignores the fixed amount that's always included." },
        { text: n(Math.floor((C + W) / w)), why: "This adds the fixed amount to the limit instead of subtracting it." }
      ], numPad(max)),
      explanation: `n ≤ (${C} ${MINUS} ${W}) ÷ ${w} = ${n((C - W) / w)}, so the maximum is ${max}.`,
      steps: [
        step("Write the inequality", `${W} + ${w}n ≤ ${C}`),
        step("Solve", `${w}n ≤ ${C - W}  →  n ≤ ${n((C - W) / w)}`),
        step("Use whole numbers", `n has to be a whole number, so round down: ${max}.`)
      ],
      hint: "Write fixed amount + (per-item amount) × n ≤ limit, then think about rounding."
    };
  }
  // Hard: which point satisfies a system of inequalities.
  const m1 = nz(r, -3, 3);
  const b1 = int(r, -4, 4);
  const m2 = nz(r, -3, 3);
  const b2 = int(r, 2, 9);
  const ok = (x, y) => y > m1 * x + b1 && y < m2 * x + b2;
  const pts = [];
  for (let x = -4; x <= 4; x++) for (let y = -8; y <= 12; y++) pts.push([x, y]);
  const goods = shuffle(r, pts.filter(([x, y]) => ok(x, y)));
  const bads = shuffle(r, pts.filter(([x, y]) => !ok(x, y) && Math.abs(y - (m1 * x + b1)) <= 4));
  if (!goods.length || bads.length < 3) return linearInequalities(r, "Medium");
  const g = goods[0];
  const fmt = ([x, y]) => `(${n(x)}, ${n(y)})`;
  const why = ([x, y]) =>
    y <= m1 * x + b1
      ? `It fails the first inequality: ${n(y)} is not greater than ${n(m1)}(${n(x)}) ${signed(b1)} = ${n(m1 * x + b1)}.`
      : `It fails the second inequality: ${n(y)} is not less than ${n(m2)}(${n(x)}) ${signed(b2)} = ${n(m2 * x + b2)}.`;
  return {
    title: "A point in the solution region",
    prompt: `y > ${lin(m1, b1)}\ny < ${lin(m2, b2)}\nWhich point (x, y) is a solution to the system of inequalities above?`,
    ...mc(r, { text: fmt(g), why: `${n(g[1])} > ${n(m1 * g[0] + b1)} and ${n(g[1])} < ${n(m2 * g[0] + b2)}: both inequalities hold.` }, bads.slice(0, 6).map((p) => ({ text: fmt(p), why: why(p) }))),
    explanation: "Substitute each point into both inequalities; only one satisfies both.",
    steps: [
      step("Plan", "A solution must make both inequalities true at the same time."),
      step("Test each point", "Substitute x and y into each inequality; a point that fails either one is out."),
      step("Result", `${fmt(g)}: ${n(g[1])} > ${n(m1 * g[0] + b1)} and ${n(g[1])} < ${n(m2 * g[0] + b2)}.`)
    ],
    hint: "Plug each point into both inequalities. It has to pass both tests."
  };
}

// ---------------------------------------------------------------------------
// Advanced Math
// ---------------------------------------------------------------------------
function equivalentExpressions(r, level) {
  if (level === "Easy") {
    const a = int(r, 2, 4);
    const b = int(r, 2, 4);
    const c = int(r, 1, 6);
    const e = a * b + c;
    return {
      title: "Exponent rules",
      prompt: `Which expression is equivalent to (x${sup(a)})${sup(b)} · x${sup(c)}, where x > 0?`,
      ...mc(r, { text: `x${sup(e)}`, why: `(x${sup(a)})${sup(b)} = x${sup(a * b)}, and x${sup(a * b)} · x${sup(c)} = x${sup(e)}.` }, [
        { text: `x${sup(a + b + c)}`, why: "This adds all the exponents. A power of a power multiplies the exponents." },
        { text: `x${sup(a * b * c)}`, why: "This multiplies all the exponents. When multiplying powers with the same base, add the exponents." },
        { text: `x${sup(a + b * c)}`, why: `This applies the outer exponent ${b} to the wrong factor.` },
        { text: `x${sup(a * (b + c))}`, why: `This multiplies ${a} by (${b} + ${c}); the ${c} belongs to a separate factor.` },
        { text: `x${sup(a * b)}`, why: `This simplifies (x${sup(a)})${sup(b)} but drops the x${sup(c)} factor.` },
        { text: `x${sup((a + c) * b)}`, why: `This applies the outer exponent to x${sup(c)} too, but it only covers (x${sup(a)}).` },
        { text: `x${sup(a + c)}`, why: `This ignores the outer exponent ${b}.` }
      ]),
      explanation: `Power of a power multiplies (${a}·${b} = ${a * b}); same-base product adds (${a * b} + ${c} = ${e}).`,
      steps: [
        step("Power of a power", `(x${sup(a)})${sup(b)} = x${sup(`${a * b}`)}  (multiply: ${a} × ${b})`),
        step("Multiply powers with the same base", `x${sup(a * b)} · x${sup(c)} = x${sup(e)}  (add: ${a * b} + ${c})`),
        step("Answer", `x${sup(e)}`)
      ],
      hint: "Power of a power: multiply the exponents. Same base multiplied: add them."
    };
  }
  if (level === "Medium") {
    let a;
    let b;
    let c;
    let d;
    do {
      a = int(r, 1, 4);
      c = int(r, 1, 4);
      b = nz(r, -7, 7);
      d = nz(r, -7, 7);
    } while (a * d + b * c === 0);
    const P = poly([[a * c, "x²"], [a * d + b * c, "x"], [b * d, ""]]);
    return {
      title: "Expand a product",
      prompt: `Which expression is equivalent to (${lin(a, b)})(${lin(c, d)})?`,
      ...mc(r, { text: P, why: `First ${a * c}x², outer + inner ${n(a * d)}x ${signed(b * c)}x = ${n(a * d + b * c)}x, last ${n(b * d)}.` }, [
        { text: poly([[a * c, "x²"], [b * d, ""]]), why: "This multiplies only the first terms and the last terms and drops the middle (x) term." },
        { text: poly([[a * c, "x²"], [a * d + b * c, "x"], [-b * d, ""]]), why: "The sign of the constant term is wrong: multiply the two constants, keeping their signs." },
        { text: poly([[a * c, "x²"], [a * d, "x"], [b * d, ""]]), why: "This includes only one of the two middle products." },
        { text: poly([[a + c, "x"], [b + d, ""]]), why: "This adds the factors instead of multiplying them." }
      ]),
      explanation: `Distribute each term (FOIL): ${P}.`,
      steps: [
        step("First and last", `${a === 1 ? "" : a}x · ${c === 1 ? "" : c}x = ${a * c === 1 ? "" : a * c}x²,  (${n(b)})(${n(d)}) = ${n(b * d)}`),
        step("Outer and inner", `${n(a * d)}x + ${n(b * c)}x = ${n(a * d + b * c)}x`),
        step("Combine", P)
      ],
      hint: "Multiply every term in the first factor by every term in the second (FOIL)."
    };
  }
  if (r() < 0.5) {
    const p = int(r, 2, 6);
    const q = int(r, 1, 9);
    return {
      title: "Difference of squares",
      prompt: `Which expression is equivalent to ${p * p}x² ${MINUS} ${q * q}?`,
      ...mc(r, { text: `(${lin(p, -q)})(${lin(p, q)})`, why: `${p * p}x² ${MINUS} ${q * q} = (${p}x)² ${MINUS} ${q}², a difference of squares.` }, [
        { text: `(${lin(p, -q)})²`, why: `(${lin(p, -q)})² expands to ${p * p}x² ${MINUS} ${2 * p * q}x + ${q * q}, which has a middle term and a positive constant.` },
        { text: `(${lin(p * p, -q)})(${lin(1, q)})`, why: `Expanding gives a middle term of ${n(p * p * q - q)}x, which the original expression doesn't have.` },
        { text: `(${lin(p, q)})²`, why: `(${lin(p, q)})² expands to ${p * p}x² + ${2 * p * q}x + ${q * q}: a middle term and the wrong sign on the constant.` },
        { text: `(${lin(p * p, -(q * q))})(${lin(1, 1)})`, why: "This product has a middle term; the original has none." },
        { text: `(${lin(p, -q * q)})(${lin(p, 1)})`, why: "This product has a middle term; the original has none." }
      ]),
      explanation: `a² − b² = (a − b)(a + b) with a = ${p}x and b = ${q}.`,
      steps: [
        step("Spot the pattern", `${p * p}x² = (${p}x)² and ${q * q} = ${q}², so this is a² ${MINUS} b².`),
        step("Apply the identity", `a² ${MINUS} b² = (a ${MINUS} b)(a + b)`),
        step("Substitute", `(${lin(p, -q)})(${lin(p, q)})`)
      ],
      hint: "Both terms are perfect squares and they're subtracted. Which identity fits?"
    };
  }
  const k = int(r, 2, 9);
  return {
    title: "Simplify a rational expression",
    prompt: `Which expression is equivalent to (x² ${MINUS} ${k * k})/(x + ${k}), for x ≠ ${MINUS}${k}?`,
    ...mc(r, { text: lin(1, -k), why: `x² ${MINUS} ${k * k} = (x ${MINUS} ${k})(x + ${k}); cancel the (x + ${k}).` }, [
      { text: lin(1, k), why: `This cancels the wrong factor. (x ${MINUS} ${k})(x + ${k}) ÷ (x + ${k}) leaves x ${MINUS} ${k}.` },
      { text: lin(1, -(k * k)), why: "You can't cancel term by term across a subtraction; factor first." },
      { text: poly([[1, "x²"], [-k, ""]]), why: "Cancel whole factors, not individual pieces of terms." },
      { text: `(x ${MINUS} ${k})²`, why: `That would expand to x² ${MINUS} ${2 * k}x + ${k * k}. Factor the numerator and cancel instead.` }
    ]),
    explanation: `Factor the numerator as (x − ${k})(x + ${k}) and cancel.`,
    steps: [
      step("Factor the numerator", `x² ${MINUS} ${k * k} = (x ${MINUS} ${k})(x + ${k})`),
      step("Cancel the common factor", `(x ${MINUS} ${k})(x + ${k}) ÷ (x + ${k}) = x ${MINUS} ${k}`),
      step("Note the restriction", `x ≠ ${MINUS}${k}, which the question already states.`)
    ],
    hint: "Factor the top first. What factor matches the bottom?"
  };
}

function nonlinearEquations(r, level) {
  if (level === "Easy" || (level === "Medium" && r() < 0.5)) {
    const b = int(r, 2, 9);
    const a = nz(r, -8, 12);
    const x = b * b - a;
    return {
      title: "A square-root equation",
      prompt: `If √(${lin(1, a)}) = ${b}, what is the value of x?`,
      ...mc(r, { text: n(x), why: `Square both sides: x ${signed(a)} = ${b * b}, so x = ${n(x)}.` }, [
        { text: n(b - a), why: "This skips squaring. Square both sides to undo the square root." },
        { text: n(b * b + a), why: `After squaring, you need to undo ${signed(a)}; this does the opposite.` },
        { text: n(b * b), why: `This is x ${signed(a)}. You still need to solve for x.` }
      ], numPad(x)),
      explanation: `x ${signed(a)} = ${b}² = ${b * b}, so x = ${n(x)}.`,
      steps: [
        step("Square both sides", `x ${signed(a)} = ${b}² = ${b * b}`),
        step("Solve", `x = ${b * b} ${a > 0 ? MINUS : "+"} ${n(Math.abs(a))} = ${n(x)}`),
        step("Check", `√(${n(x)} ${signed(a)}) = √${b * b} = ${b}, which matches.`)
      ],
      hint: "What undoes a square root?"
    };
  }
  if (level === "Medium") {
    const r1 = -int(r, 1, 6);
    const r2 = int(r, 1, 9);
    const B = -(r1 + r2);
    const C = r1 * r2;
    return {
      title: "Factor to solve",
      prompt: `If ${poly([[1, "x²"], [B, "x"], [C, ""]])} = 0 and x > 0, what is the value of x?`,
      ...mc(r, { text: n(r2), why: `The equation factors as (x ${signed(-r2)})(x ${signed(-r1)}) = 0, so x = ${n(r2)} or x = ${n(r1)}; only ${n(r2)} is positive.` }, [
        { text: n(r1), why: "This is a solution of the equation, but it isn't positive." },
        { text: n(-r2), why: "This mixes up the signs: (x − a) = 0 gives x = a, not −a." },
        { text: n(r1 + r2), why: "This is the sum of the solutions, not a solution." }
      ], numPad(r2)),
      explanation: `Factor: (x ${signed(-r2)})(x ${signed(-r1)}) = 0; the positive root is ${n(r2)}.`,
      steps: [
        step("Find two numbers", `They multiply to ${n(C)} and add to ${n(B)}: ${n(-r1)} and ${n(-r2)}.`),
        step("Factor", `(x ${signed(-r2)})(x ${signed(-r1)}) = 0  →  x = ${n(r2)} or x = ${n(r1)}`),
        step("Apply the condition", `x > 0, so x = ${n(r2)}.`)
      ],
      hint: "Factor the quadratic, then use the condition x > 0."
    };
  }
  if (r() < 0.5) {
    const kind = pick(r, [0, 1, 2]);
    let a;
    let b;
    let c;
    let D;
    do {
      a = nz(r, -4, 5);
      b = int(r, -9, 9);
      c = int(r, -9, 9);
      D = b * b - 4 * a * c;
    } while ((kind === 0 && D >= 0) || (kind === 1 && D !== 0) || (kind === 2 && D <= 0));
    const label = ["Zero", "Exactly one", "Exactly two"][kind];
    const all = ["Zero", "Exactly one", "Exactly two", "Infinitely many"];
    return {
      title: "Count the solutions",
      prompt: `How many distinct real solutions does the equation ${poly([[a, "x²"], [b, "x"], [c, ""]])} = 0 have?`,
      ...mc(r, { text: label, why: `The discriminant is ${n(b)}² ${MINUS} 4(${n(a)})(${n(c)}) = ${n(D)}, which is ${D > 0 ? "positive" : D === 0 ? "zero" : "negative"}.` },
        all.filter((x) => x !== label).map((x) => ({ text: x, why: x === "Infinitely many" ? "A nonzero quadratic has at most two solutions." : `That would need a discriminant that is ${x === "Zero" ? "negative" : x === "Exactly one" ? "zero" : "positive"}, but it's ${n(D)}.` }))),
      explanation: `b² − 4ac = ${n(D)}, so the equation has ${label.toLowerCase()} real solution${kind === 1 ? "" : "s"}.`,
      steps: [
        step("Identify a, b, c", `a = ${n(a)}, b = ${n(b)}, c = ${n(c)}`),
        step("Compute the discriminant", `b² ${MINUS} 4ac = ${n(b * b)} ${MINUS} ${n(4 * a * c)} = ${n(D)}`),
        step("Interpret", "Positive → 2 solutions, zero → 1, negative → 0.")
      ],
      hint: "Compute b² − 4ac. Its sign tells you how many real solutions there are."
    };
  }
  let r1;
  let r2;
  do {
    r1 = int(r, -6, 6);
    r2 = int(r, -6, 6);
  } while (r1 === r2);
  const m = nz(r, -4, 4);
  const nn = int(r, -6, 6);
  const b = m - (r1 + r2);
  const c = nn + r1 * r2;
  const hi = Math.max(r1, r2);
  return {
    title: "Where a line meets a parabola",
    prompt: `y = ${poly([[1, "x²"], [b, "x"], [c, ""]])}\ny = ${lin(m, nn)}\nThe graphs of the equations above intersect at two points. What is the greater of the two x-coordinates of the intersection points?`,
    ...grid(hi),
    explanation: `Set the expressions equal: x² ${signed(b - m)}x ${signed(c - nn)} = 0, which gives x = ${n(r1)} or x = ${n(r2)}.`,
    steps: [
      step("Set the two expressions equal", `${poly([[1, "x²"], [b, "x"], [c, ""]])} = ${lin(m, nn)}`),
      step("Move everything to one side", `${poly([[1, "x²"], [b - m, "x"], [c - nn, ""]])} = 0`),
      step("Factor and pick the greater root", `(x ${signed(-r1)})(x ${signed(-r2)}) = 0  →  x = ${n(r1)} or ${n(r2)}; the greater is ${n(hi)}.`)
    ],
    hint: "At an intersection both y-values are equal. Set the right-hand sides equal to each other."
  };
}

function nonlinearFunctions(r, level) {
  if (level === "Easy") {
    const a = int(r, 1, 4);
    const h = nz(r, -5, 5);
    const k = int(r, -9, 9);
    const p = int(r, -3, 6);
    const val = a * (p - h) ** 2 + k;
    return {
      title: "Evaluate a quadratic",
      prompt: `The function f is defined by f(x) = ${a === 1 ? "" : a}(x ${signed(-h)})² ${signed(k)}. What is the value of f(${n(p)})?`,
      ...grid(val),
      explanation: `f(${n(p)}) = ${a === 1 ? "" : a}(${n(p - h)})² ${signed(k)} = ${n(val)}.`,
      steps: [
        step("Substitute", `f(${n(p)}) = ${a === 1 ? "" : a}(${n(p)} ${signed(-h)})² ${signed(k)}`),
        step("Inside the parentheses first", `${n(p)} ${signed(-h)} = ${n(p - h)}, and (${n(p - h)})² = ${n((p - h) ** 2)}`),
        step("Finish", `${a === 1 ? "" : `${a} × `}${n((p - h) ** 2)} ${signed(k)} = ${n(val)}`)
      ],
      hint: "Substitute, then follow the order of operations: parentheses, exponent, multiply, add."
    };
  }
  if (level === "Medium") {
    if (r() < 0.5) {
      const a = int(r, 1, 5);
      const h = nz(r, -6, 6);
      const k = int(r, -9, 9);
      return {
        title: "Minimum of a parabola",
        prompt: `The function f is defined by f(x) = ${a === 1 ? "" : a}(x ${signed(-h)})² ${signed(k)}. What is the minimum value of f(x)?`,
        ...mc(r, { text: n(k), why: `The squared term is never negative and equals 0 at x = ${n(h)}, so the minimum is ${n(k)}.` }, [
          { text: n(h), why: `${n(h)} is the x-value where the minimum happens, not the minimum value.` },
          { text: n(-h), why: "This reads the sign inside the parentheses directly; it's the x-coordinate (with the wrong sign), not the minimum value." },
          { text: n(a * h * h + k), why: "This is f(0), not the minimum." }
        ], numPad(k)),
        explanation: `Vertex form a(x − h)² + k has vertex (h, k); with a > 0 the minimum value is k = ${n(k)}.`,
        steps: [
          step("Read the vertex form", `f(x) = a(x ${MINUS} h)² + k has vertex (h, k) = (${n(h)}, ${n(k)}).`),
          step("Opening direction", `a = ${a} > 0, so the parabola opens upward and the vertex is the lowest point.`),
          step("Minimum value", `The minimum value is the y-coordinate of the vertex: ${n(k)}.`)
        ],
        hint: "In vertex form, which number is the y-coordinate of the vertex?"
      };
    }
    const P = pick(r, [200, 500, 800, 1200, 2500, 4000]);
    const rate = pick(r, [3, 4, 5, 6, 8, 12, 15]);
    const down = r() < 0.35;
    const g = down ? 1 - rate / 100 : 1 + rate / 100;
    const what = pick(r, [["population of a town", "The population"], ["number of visitors to a museum", "The number of visitors"], ["value of a collectible card, in dollars,", "The value"]]);
    return {
      title: down ? "Model exponential decay" : "Model exponential growth",
      prompt: `The ${what[0]} is ${P.toLocaleString("en-US")} this year. ${what[1]} is expected to ${down ? "decrease" : "increase"} by ${rate}% each year. Which function gives the expected amount t years from now?`,
      ...mc(r, { text: `f(t) = ${P}(${n(g)})^{t}`, why: `${down ? "Decreasing" : "Increasing"} by ${rate}% means multiplying by 1 ${down ? MINUS : "+"} ${n(rate / 100)} = ${n(g)} each year.` }, [
        { text: `f(t) = ${P}(${n(rate / 100)})^{t}`, why: `Multiplying by ${n(rate / 100)} each year would wipe out most of the amount. The yearly factor is ${n(g)}.` },
        { text: `f(t) = ${P}(${n(down ? 1 - rate / 10 : 1 + rate / 10)})^{t}`, why: `This treats ${rate}% as ${n(rate / 10)}. As a decimal, ${rate}% is ${n(rate / 100)}.` },
        { text: `f(t) = ${P} ${down ? MINUS : "+"} ${n(rate / 100)}t`, why: "This is linear: it adds a fixed amount each year. Percent change multiplies by the same factor each year." }
      ]),
      explanation: `Exponential model: starting amount × (growth factor)^t = ${P}(${n(g)})^t.`,
      steps: [
        step("Starting amount", `${P}`),
        step("Growth factor", `1 ${down ? MINUS : "+"} ${rate}/100 = ${n(g)}`),
        step("Assemble", `f(t) = ${P}(${n(g)})ᵗ`)
      ],
      hint: `A ${rate}% ${down ? "decrease" : "increase"} means multiplying by what number each year?`
    };
  }
  const factor = pick(r, [2, 3]);
  const h = pick(r, [2, 3, 4, 5, 6].filter((x) => x !== factor));
  const N = pick(r, [100, 250, 400, 500, 1000]);
  const word = factor === 2 ? "doubles" : "triples";
  return {
    title: `A quantity that ${word}`,
    prompt: `A colony of bacteria ${word} every ${h} hours. There are ${N} bacteria at the start of an experiment. Which expression gives the number of bacteria t hours after the start?`,
    ...mc(r, { text: `${N} · ${factor}^{t/${h}}`, why: `In t hours there are t/${h} ${factor === 2 ? "doublings" : "triplings"}, so multiply by ${factor} that many times.` }, [
      { text: `${N} · ${factor}^{${h}t}`, why: `This multiplies by ${factor} ${h} times every hour instead of once every ${h} hours.` },
      { text: `${N} · ${h}^{t/${factor}}`, why: `This swaps the growth factor (${factor}) and the time period (${h}).` },
      { text: `${N} + ${factor}(t/${h})`, why: "This adds instead of multiplying. Doubling or tripling is exponential." },
      { text: `${N} · ${factor}^{t}`, why: `This multiplies by ${factor} every hour, but it only happens every ${h} hours.` }
    ]),
    explanation: `Number of ${factor === 2 ? "doublings" : "triplings"} = t/${h}, so N(t) = ${N} · ${factor}^(t/${h}).`,
    steps: [
      step("Count the growth periods", `One period is ${h} hours, so in t hours there are t/${h} periods.`),
      step("Multiply once per period", `Each period multiplies the count by ${factor}.`),
      step("Assemble", `${N} · ${factor}^(t/${h})`)
    ],
    hint: `How many ${h}-hour periods fit into t hours?`
  };
}

// ---------------------------------------------------------------------------
// Problem-Solving and Data Analysis
// ---------------------------------------------------------------------------
function ratiosRates(r, level) {
  if (level === "Easy") {
    const pairs = [["flour", "sugar", "cups"], ["water", "concentrate", "cups"], ["sand", "cement", "buckets"], ["blue paint", "white paint", "liters"]];
    const [A, B, unit] = pick(r, pairs);
    let a;
    let b;
    do {
      a = int(r, 2, 7);
      b = int(r, 2, 6);
    } while (a === b || gcd(a, b) !== 1);
    const t = int(r, 2, 6);
    return {
      title: "Scale a ratio",
      prompt: `A mixture uses ${A} and ${B} in a ratio of ${a} to ${b}. How many ${unit} of ${A} are needed for ${b * t} ${unit} of ${B}?`,
      ...mc(r, { text: n(a * t), why: `${b * t} is ${t} times ${b}, so multiply ${a} by ${t}: ${a * t}.` }, [
        { text: frac(b * t * b, a), why: "This flips the ratio. Keep the ratio in the order it's given." },
        { text: n(a + (b * t - b)), why: "This adds the same amount to both parts. Ratios scale by multiplying." },
        { text: n(a * b * t), why: `This multiplies by ${b * t} instead of by the scale factor ${t}.` }
      ], numPad(a * t)),
      explanation: `Scale factor ${b * t} ÷ ${b} = ${t}; ${A} = ${a} × ${t} = ${a * t}.`,
      steps: [
        step("Set up the proportion", `${A} : ${B} = ${a} : ${b} = ? : ${b * t}`),
        step("Find the scale factor", `${b * t} ÷ ${b} = ${t}`),
        step("Scale the other part", `${a} × ${t} = ${a * t} ${unit}`)
      ],
      hint: `How many times bigger is ${b * t} than ${b}?`
    };
  }
  if (level === "Medium") {
    const k = int(r, 2, 6);
    const kmh = 18 * k;
    return {
      title: "Convert a speed",
      prompt: `A cyclist travels at a constant speed of ${kmh} kilometers per hour. What is this speed in meters per second? (1 kilometer = 1,000 meters)`,
      ...mc(r, { text: n(5 * k), why: `${kmh} × 1,000 ÷ 3,600 = ${5 * k} meters per second.` }, [
        { text: n(kmh * 3.6), why: "This multiplies by 3.6. Converting km/h to m/s divides by 3.6." },
        { text: n((kmh * 1000) / 60), why: "This converts hours to minutes only, giving meters per minute." },
        { text: n(kmh / 60), why: "This gives kilometers per minute, not meters per second." }
      ], numPad(5 * k)),
      explanation: `${kmh} km/h × (1,000 m / 1 km) × (1 h / 3,600 s) = ${5 * k} m/s.`,
      steps: [
        step("Kilometers to meters", `${kmh} km/h = ${(kmh * 1000).toLocaleString("en-US")} m/h`),
        step("Hours to seconds", "1 hour = 3,600 seconds"),
        step("Divide", `${(kmh * 1000).toLocaleString("en-US")} ÷ 3,600 = ${5 * k} m/s`)
      ],
      hint: "Write the conversion factors so the units you don't want cancel."
    };
  }
  let a;
  let b;
  do {
    a = int(r, 20, 90);
    b = int(r, 20, 90);
  } while (a === b || (a + b) % 10 !== 0);
  const minutes = pick(r, [4, 5, 6, 8, 10, 12]);
  const N = (a + b) * minutes;
  return {
    title: "Two machines, one job",
    prompt: `Machine A fills ${a} bottles per minute, and Machine B fills ${b} bottles per minute. Working at the same time, how many minutes will it take the two machines to fill ${N.toLocaleString("en-US")} bottles?`,
    ...mc(r, { text: n(minutes), why: `Together they fill ${a + b} bottles per minute, and ${N} ÷ ${a + b} = ${minutes}.` }, [
      { text: n(Math.round((N / a + N / b) * 10) / 10), why: "This adds the time each machine would take alone. Working together is faster, not slower." },
      { text: n(Math.round((N / a) * 10) / 10), why: "This uses only Machine A." },
      { text: n(Math.round(((2 * N) / (a + b)) * 10) / 10), why: "This divides by the average rate instead of the combined rate." }
    ], numPad(minutes)),
    explanation: `Combined rate = ${a + b} bottles/min; time = ${N} ÷ ${a + b} = ${minutes} minutes.`,
    steps: [
      step("Add the rates", `${a} + ${b} = ${a + b} bottles per minute`),
      step("Time = amount ÷ rate", `${N} ÷ ${a + b}`),
      step("Result", `${minutes} minutes`)
    ],
    hint: "When machines work together, add their rates."
  };
}

function percentages(r, level) {
  if (level === "Easy") {
    const p = pick(r, [5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 75]);
    const whole = 20 * int(r, 2, 20);
    const part = (p * whole) / 100;
    return {
      title: `${p}% of a number`,
      prompt: `What is ${p}% of ${whole}?`,
      ...mc(r, { text: n(part), why: `${p}% = ${n(p / 100)}, and ${n(p / 100)} × ${whole} = ${n(part)}.` }, [
        { text: n(whole - part), why: `This is what's left after removing ${p}%, not ${p}% itself.` },
        { text: n((p * whole) / 10), why: `This uses ${n(p / 10)} for ${p}%. As a decimal, ${p}% is ${n(p / 100)}.` },
        { text: n(whole / p), why: `This divides by ${p} instead of multiplying by ${p}/100.` }
      ], numPad(part)),
      explanation: `${p}/100 × ${whole} = ${n(part)}.`,
      steps: [
        step("Convert the percent", `${p}% = ${p}/100 = ${n(p / 100)}`),
        step("Multiply", `${n(p / 100)} × ${whole} = ${n(part)}`),
        step("Sanity check", `${p}% is ${p < 50 ? "less" : "more"} than half, and ${n(part)} is ${p < 50 ? "less" : "more"} than half of ${whole}.`)
      ],
      hint: "\"Percent of\" means multiply by the percent over 100."
    };
  }
  if (level === "Medium") {
    const a = pick(r, [40, 50, 60, 80, 120, 150, 200, 250]);
    const pct = pick(r, [10, 15, 20, 25, 30, 40, 50, 60]);
    const up = r() < 0.6;
    const b = up ? a * (1 + pct / 100) : a * (1 - pct / 100);
    const item = pick(r, ["the price of a concert ticket", "the monthly rent for a studio", "the cost of a bicycle", "a store's weekly sales, in hundreds of dollars,"]);
    return {
      title: `Percent ${up ? "increase" : "decrease"}`,
      prompt: `Over one year, ${item} changed from ${n(a)} to ${n(b)}. By what percent did it ${up ? "increase" : "decrease"}?`,
      ...mc(r, { text: `${pct}%`, why: `The change is ${n(Math.abs(b - a))}, and ${n(Math.abs(b - a))} ÷ ${a} = ${n(pct / 100)} = ${pct}%.` }, [
        { text: `${n(Math.round((Math.abs(b - a) / b) * 1000) / 10)}%`, why: `This divides by the new value (${n(b)}). Percent change divides by the original value.` },
        { text: `${n(Math.abs(b - a))}%`, why: "This is the amount of change, not the percent change." },
        { text: `${n(Math.round((b / a) * 1000) / 10)}%`, why: "This is the new value as a percent of the original, not the percent change." },
        { text: `${n(pct / 100)}%`, why: `${n(pct / 100)} is the change as a decimal. Multiply by 100 to write it as a percent.` },
        { text: `${n(Math.round((a / b) * 1000) / 10)}%`, why: "This is the original value as a percent of the new value." }
      ]),
      explanation: `Percent change = |new − old| ÷ old = ${n(Math.abs(b - a))} ÷ ${a} = ${pct}%.`,
      steps: [
        step("Find the change", `|${n(b)} ${MINUS} ${n(a)}| = ${n(Math.abs(b - a))}`),
        step("Divide by the original", `${n(Math.abs(b - a))} ÷ ${a} = ${n(pct / 100)}`),
        step("Convert to a percent", `${n(pct / 100)} × 100 = ${pct}%`)
      ],
      hint: "Percent change = (change) ÷ (original value)."
    };
  }
  if (r() < 0.5) {
    const pairs = [[20, 25], [25, 20], [10, 10], [50, 20], [20, 50], [40, 25], [30, 20], [25, 40]];
    const [p1, p2] = pick(r, pairs);
    const final = Math.round((1 + p1 / 100) * (1 - p2 / 100) * 10000) / 100;
    return {
      title: "Back-to-back percent changes",
      prompt: `The price of a jacket was increased by ${p1}%. Later, the new price was decreased by ${p2}%. The final price is what percent of the original price?`,
      ...mc(r, { text: `${n(final)}%`, why: `Multiply the factors: ${n(1 + p1 / 100)} × ${n(1 - p2 / 100)} = ${n(final / 100)}.` }, [
        { text: `${n(100 + p1 - p2)}%`, why: `This adds and subtracts the percents. The ${p2}% decrease applies to the higher price, so the factors multiply.` },
        { text: `${n(100 - p2)}%`, why: `This ignores the ${p1}% increase.` },
        { text: `${n(100 + p1)}%`, why: `This ignores the ${p2}% decrease.` }
      ]),
      explanation: `(1 + ${p1}/100)(1 − ${p2}/100) = ${n(final / 100)}, which is ${n(final)}% of the original.`,
      steps: [
        step("Increase factor", `+${p1}% → × ${n(1 + p1 / 100)}`),
        step("Decrease factor", `${MINUS}${p2}% → × ${n(1 - p2 / 100)}`),
        step("Multiply", `${n(1 + p1 / 100)} × ${n(1 - p2 / 100)} = ${n(final / 100)} → ${n(final)}%`)
      ],
      hint: "Turn each percent change into a multiplier, then multiply the multipliers."
    };
  }
  const d = pick(r, [10, 15, 20, 25, 30, 40]);
  const O = 20 * int(r, 2, 10);
  const P = O * (1 - d / 100);
  return {
    title: "Find the original price",
    prompt: `After a ${d}% discount, a pair of headphones costs ${money(P)}. What was the price before the discount?`,
    ...mc(r, { text: money(O), why: `The sale price is ${n(1 - d / 100)} of the original, so the original is ${n(P)} ÷ ${n(1 - d / 100)} = ${n(O)}.` }, [
      { text: money(Math.round(P * (1 + d / 100) * 100) / 100), why: `This adds ${d}% of the sale price. The discount was ${d}% of the original, which is larger.` },
      { text: money(P + d), why: `This adds ${d} dollars instead of undoing a ${d}% discount.` },
      { text: money(Math.round((P / (d / 100)) * 100) / 100), why: `This divides by the discount rate (${n(d / 100)}); divide by the fraction that remains (${n(1 - d / 100)}).` },
      { text: money(Math.round(P * (1 - d / 100) * 100) / 100), why: `This takes another ${d}% off the sale price instead of undoing the discount.` }
    ]),
    explanation: `original × ${n(1 - d / 100)} = ${n(P)}, so original = ${n(O)}.`,
    steps: [
      step("What's left after the discount", `100% ${MINUS} ${d}% = ${100 - d}% = ${n(1 - d / 100)}`),
      step("Write the equation", `original × ${n(1 - d / 100)} = ${n(P)}`),
      step("Solve", `original = ${n(P)} ÷ ${n(1 - d / 100)} = ${n(O)}`)
    ],
    hint: "The sale price is what fraction of the original price?"
  };
}

function oneVariableData(r, level) {
  if (level === "Easy") {
    const count = int(r, 4, 6);
    const mean = int(r, 6, 20);
    let vals;
    let x;
    do {
      vals = Array.from({ length: count - 1 }, () => int(r, Math.max(1, mean - 8), mean + 8));
      x = mean * count - vals.reduce((s, v) => s + v, 0);
    } while (x < 1 || x > 60);
    const listed = [...vals, "x"].join(", ");
    const known = vals.reduce((s, v) => s + v, 0);
    return {
      title: "Find a missing value",
      prompt: `The mean of the ${count} numbers ${listed} is ${mean}. What is the value of x?`,
      ...mc(r, { text: n(x), why: `The total must be ${count} × ${mean} = ${count * mean}; the known values add to ${known}, so x = ${n(x)}.` }, [
        { text: n(mean), why: "The missing value doesn't have to equal the mean." },
        { text: n(mean * (count - 1) - known), why: `This uses ${count - 1} values for the total instead of ${count}.` },
        { text: n(Math.round((known / (count - 1)) * 10) / 10), why: "This is the mean of the known values, not the missing one." }
      ], numPad(x)),
      explanation: `Sum = mean × count = ${count * mean}; x = ${count * mean} ${MINUS} ${known} = ${n(x)}.`,
      steps: [
        step("Total from the mean", `${count} × ${mean} = ${count * mean}`),
        step("Add the known values", `${vals.join(" + ")} = ${known}`),
        step("Subtract", `x = ${count * mean} ${MINUS} ${known} = ${n(x)}`)
      ],
      hint: "Mean × number of values = total."
    };
  }
  if (level === "Medium") {
    if (r() < 0.5) {
      const vals = [];
      while (vals.length < 8) {
        const v = int(r, 3, 40);
        if (!vals.includes(v)) vals.push(v);
      }
      const sorted = [...vals].sort((a, b) => a - b);
      const med = (sorted[3] + sorted[4]) / 2;
      const mean = vals.reduce((s, v) => s + v, 0) / 8;
      return {
        title: "Median of a data set",
        prompt: `What is the median of the data set ${vals.join(", ")}?`,
        ...mc(r, { text: n(med), why: `Sorted: ${sorted.join(", ")}. The middle two values are ${sorted[3]} and ${sorted[4]}; their average is ${n(med)}.` }, [
          { text: n((vals[3] + vals[4]) / 2), why: "This averages the middle two values without sorting the data first." },
          { text: n(Math.round(mean * 100) / 100), why: "This is the mean, not the median." },
          { text: n(sorted[4]), why: "With an even number of values, the median is the average of the two middle values." }
        ], numPad(med)),
        explanation: `Sort the 8 values; the median is the average of the 4th and 5th: ${n(med)}.`,
        steps: [
          step("Sort", sorted.join(", ")),
          step("Find the middle", `8 values → the median is the average of the 4th and 5th: ${sorted[3]} and ${sorted[4]}.`),
          step("Average them", `(${sorted[3]} + ${sorted[4]}) ÷ 2 = ${n(med)}`)
        ],
        hint: "Always sort the data before finding a median."
      };
    }
    const freqs = Array.from({ length: 5 }, () => int(r, 1, 9));
    const total = freqs.reduce((s, v) => s + v, 0);
    const valueAt = (pos) => {
      let acc = 0;
      for (let v = 0; v < 5; v++) {
        acc += freqs[v];
        if (pos <= acc) return v;
      }
      return 4;
    };
    const med = total % 2 ? valueAt((total + 1) / 2) : (valueAt(total / 2) + valueAt(total / 2 + 1)) / 2;
    const modeV = freqs.indexOf(Math.max(...freqs));
    const mean = freqs.reduce((s, f, v) => s + f * v, 0) / total;
    return {
      title: "Median from a frequency table",
      prompt: `The table shows how many books each student in a class read over the summer. What is the median number of books read?`,
      table: { title: "Books read over the summer", columns: ["Number of books", "Number of students"], rows: freqs.map((f, v) => [String(v), String(f)]) },
      ...mc(r, { text: n(med), why: `There are ${total} students. Counting up the table, the middle ${total % 2 ? `(${(total + 1) / 2}th)` : `(${total / 2}th and ${total / 2 + 1}th)`} value is ${n(med)}.` }, [
        { text: n(modeV), why: "This is the mode (the most common value), not the median." },
        { text: n(Math.round(mean * 100) / 100), why: "This is the mean number of books, not the median." },
        { text: n(freqs[2]), why: "This is the frequency in the middle row, not the middle data value." },
        { text: "2", why: "The middle row of the table isn't necessarily the median; count through the frequencies." }
      ], numPad(med)),
      explanation: `Count through the frequencies to find the middle position among ${total} students.`,
      steps: [
        step("Count the data values", `${freqs.join(" + ")} = ${total} students`),
        step("Locate the middle", total % 2 ? `The median is the ${(total + 1) / 2}th value.` : `The median is the average of the ${total / 2}th and ${total / 2 + 1}th values.`),
        step("Count through the table", `Running totals: ${freqs.map((_, v) => freqs.slice(0, v + 1).reduce((s, x) => s + x, 0)).join(", ")} → median = ${n(med)}`)
      ],
      hint: "Each row stands for several data values. Find the middle position first."
    };
  }
  let base;
  do {
    base = Array.from({ length: 5 }, () => int(r, 10, 30)).sort((a, b) => a - b);
  } while (base[3] === base[2]);
  const out = int(r, 80, 140);
  const all = [...base, out];
  const meanBefore = all.reduce((s, v) => s + v, 0) / 6;
  const meanAfter = base.reduce((s, v) => s + v, 0) / 5;
  return {
    title: "Remove an outlier",
    prompt: `A data set consists of the values ${all.join(", ")}. If the value ${out} is removed, which statement about the mean and median of the data set is true?`,
    ...mc(r, { text: "Both the mean and the median decrease, and the mean decreases by more.", why: `The mean drops from about ${n(Math.round(meanBefore * 10) / 10)} to ${n(meanAfter)}; the median drops from ${n((base[2] + base[3]) / 2)} to ${base[2]}.` }, [
      { text: "The mean decreases, and the median stays the same.", why: `With ${out} removed there are 5 values, so the median becomes the 3rd value (${base[2]}), not the average of two middle values.` },
      { text: "The median decreases, and the mean stays the same.", why: "Removing a very large value always lowers the mean." },
      { text: "Both decrease by the same amount.", why: "An outlier affects the mean far more than the median." }
    ]),
    explanation: "An outlier pulls the mean strongly; removing it changes the mean far more than the median.",
    steps: [
      step("Median before and after", `Before (6 values): (${base[2]} + ${base[3]}) ÷ 2 = ${n((base[2] + base[3]) / 2)}. After (5 values): ${base[2]}.`),
      step("Mean before and after", `Before: ${all.reduce((s, v) => s + v, 0)} ÷ 6 ≈ ${n(Math.round(meanBefore * 10) / 10)}. After: ${base.reduce((s, v) => s + v, 0)} ÷ 5 = ${n(meanAfter)}.`),
      step("Compare", "Both drop, but the mean drops much more.")
    ],
    hint: "Outliers pull the mean much more than they pull the median."
  };
}

const FIT_CONTEXTS = [
  { x: "weeks since planting", y: "plant height, in centimeters", m: [1.5, 1.8, 2.2, 2.5], b: [4, 6, 8, 12], per: (m) => `For each additional week, the plant's predicted height increases by ${n(m)} centimeters.`, start: (b) => `The plant's predicted height at planting was ${n(b)} centimeters.`, xs: [2, 12] },
  { x: "hours of practice", y: "score on a typing test, in words per minute", m: [2.5, 3.2, 4.5], b: [28, 35, 40], per: (m) => `For each additional hour of practice, the predicted typing score increases by ${n(m)} words per minute.`, start: (b) => `The predicted typing score with no practice is ${n(b)} words per minute.`, xs: [1, 10] },
  { x: "days since a phone was charged", y: "battery level, as a percent", m: [-6.5, -8, -9.5], b: [96, 98, 100], per: (m) => `For each additional day, the phone's predicted battery level decreases by ${n(-m)} percentage points.`, start: (b) => `The phone's predicted battery level right after charging is ${n(b)}%.`, xs: [1, 9] }
];

function scatterFigure(r, ctx, m, b) {
  const [lo, hi] = ctx.xs;
  const pts = [];
  for (let i = 0; i < 9; i++) {
    const x = Math.round((lo + ((hi - lo) * i) / 8) * 10) / 10;
    const jitter = (r() - 0.5) * Math.max(3, Math.abs(m) * 2.2);
    pts.push([x, Math.round((m * x + b + jitter) * 10) / 10]);
  }
  return { kind: "scatter", points: pts, line: { m, b }, xLabel: ctx.x, yLabel: ctx.y };
}

function twoVariableData(r, level) {
  const ctx = pick(r, FIT_CONTEXTS);
  const m = pick(r, ctx.m);
  const b = pick(r, ctx.b);
  const eq = `y = ${n(m)}x ${signed(b)}`;
  if (level === "Easy" || (level === "Medium" && r() < 0.5)) {
    return {
      title: "Interpret a line of best fit",
      prompt: `The scatterplot shows data for ${ctx.x} (x) and ${ctx.y} (y), along with the line of best fit, ${eq}. What is the best interpretation of the slope of the line in this context?`,
      figure: scatterFigure(r, ctx, m, b),
      ...mc(r, { text: ctx.per(m), why: `The slope ${n(m)} is the predicted change in y for each 1-unit increase in x.` }, [
        { text: ctx.start(Math.abs(m)), why: "This treats the slope as the starting value. The starting value is the y-intercept." },
        { text: ctx.per(Math.sign(m) * b), why: `${n(b)} is the y-intercept, not the slope.` },
        { text: `For each additional unit of y, x is predicted to change by ${n(m)}.`, why: "This reverses the roles of x and y." }
      ]),
      explanation: `Slope = predicted change in y per 1-unit increase in x: ${n(m)}.`,
      steps: [
        step("Find the slope", `In ${eq}, the slope is ${n(m)}.`),
        step("Say it as a rate", "Slope = change in y for each 1-unit increase in x."),
        step("Translate", ctx.per(m))
      ],
      hint: "Slope tells you how much y changes when x goes up by 1."
    };
  }
  const x0 = int(r, ctx.xs[0] + 1, ctx.xs[1] - 1);
  const pred = Math.round((m * x0 + b) * 100) / 100;
  if (level === "Medium") {
    return {
      title: "Predict with a model",
      prompt: `A line of best fit for data on ${ctx.x} (x) and ${ctx.y} (y) has the equation ${eq}. Based on the line of best fit, what is the predicted value of y when x = ${x0}?`,
      figure: scatterFigure(r, ctx, m, b),
      ...mc(r, { text: n(pred), why: `${n(m)} × ${x0} ${signed(b)} = ${n(pred)}.` }, [
        { text: n(Math.round(m * x0 * 100) / 100), why: "This forgets to add the y-intercept." },
        { text: n(Math.round((b * x0 + m) * 100) / 100), why: "This swaps the slope and the y-intercept." },
        { text: n(Math.round((m + b) * x0 * 100) / 100), why: "This multiplies both the slope and the intercept by x." }
      ], numPad(pred)),
      explanation: `Substitute x = ${x0} into the line: y = ${n(pred)}.`,
      steps: [
        step("Substitute", `y = ${n(m)}(${x0}) ${signed(b)}`),
        step("Multiply", `${n(m)} × ${x0} = ${n(Math.round(m * x0 * 100) / 100)}`),
        step("Add the intercept", `${n(Math.round(m * x0 * 100) / 100)} ${signed(b)} = ${n(pred)}`)
      ],
      hint: "Plug the x-value into the equation of the line."
    };
  }
  const actual = Math.round((pred + pick(r, [-4, -3, -2.5, 2, 3, 3.5, 4.5])) * 10) / 10;
  const residual = Math.round((actual - pred) * 100) / 100;
  return {
    title: "Find a residual",
    prompt: `A line of best fit for data on ${ctx.x} (x) and ${ctx.y} (y) has the equation ${eq}. One data point is (${x0}, ${n(actual)}). What is the residual for this data point (actual value minus predicted value)?`,
    ...grid(residual),
    explanation: `Predicted = ${n(pred)}; residual = ${n(actual)} − ${n(pred)} = ${n(residual)}.`,
    steps: [
      step("Predicted value", `y = ${n(m)}(${x0}) ${signed(b)} = ${n(pred)}`),
      step("Actual value", `${n(actual)}`),
      step("Residual = actual − predicted", `${n(actual)} ${MINUS} ${n(pred)} = ${n(residual)}`)
    ],
    hint: "Residual = actual − predicted. Find the predicted value from the line first."
  };
}

const TABLE_CONTEXTS = [
  { title: "Club membership by grade", rows: ["Juniors", "Seniors"], cols: ["Robotics club", "Not in robotics club"], ask: (row, col) => `If a student is selected at random from the ${row.toLowerCase()}, what is the probability that the student is in the robotics club?`, item: "student" },
  { title: "Preferred device by age group", rows: ["Under 30", "30 and older"], cols: ["Prefers phone", "Prefers laptop"], ask: (row) => `If a survey respondent is selected at random from the respondents ${row === "Under 30" ? "under 30" : "30 and older"}, what is the probability that the respondent prefers a phone?`, item: "respondent" },
  { title: "Seeds planted by soil type", rows: ["Sandy soil", "Clay soil"], cols: ["Sprouted", "Did not sprout"], ask: (row) => `If a seed is selected at random from those planted in ${row.toLowerCase()}, what is the probability that it sprouted?`, item: "seed" }
];

function probability(r, level) {
  if (level === "Easy") {
    const red = int(r, 2, 12);
    const blue = int(r, 2, 12);
    const green = int(r, 2, 12);
    const total = red + blue + green;
    const [name, count] = pick(r, [["red", red], ["blue", blue], ["green", green]]);
    return {
      title: "Simple probability",
      prompt: `A bag contains ${red} red marbles, ${blue} blue marbles, and ${green} green marbles. If one marble is chosen at random, what is the probability that it is ${name}?`,
      ...mc(r, { text: frac(count, total), why: `${count} ${name} marbles out of ${total} total.` }, [
        { text: frac(count, total - count), why: `This divides by the number of marbles that aren't ${name}. The denominator is the total, ${total}.` },
        { text: "1/3", why: "The three colors aren't equally likely because there are different numbers of each." },
        { text: frac(total - count, total), why: `This is the probability that the marble is NOT ${name}.` }
      ]),
      explanation: `P(${name}) = ${count}/${total} = ${frac(count, total)}.`,
      steps: [
        step("Count the favorable outcomes", `${count} ${name} marbles`),
        step("Count all outcomes", `${red} + ${blue} + ${green} = ${total}`),
        step("Divide and simplify", `${count}/${total} = ${frac(count, total)}`)
      ],
      hint: "Probability = favorable outcomes ÷ all possible outcomes."
    };
  }
  const ctx = pick(r, TABLE_CONTEXTS);
  const cells = [[int(r, 8, 40), int(r, 8, 40)], [int(r, 8, 40), int(r, 8, 40)]];
  const rowTot = cells.map((row) => row[0] + row[1]);
  const colTot = [cells[0][0] + cells[1][0], cells[0][1] + cells[1][1]];
  const grand = rowTot[0] + rowTot[1];
  const ri = int(r, 0, 1);
  const cell = cells[ri][0];
  return {
    title: "Probability from a two-way table",
    prompt: `The table shows data for ${grand} ${ctx.item}s. ${ctx.ask(ctx.rows[ri], ctx.cols[0])}`,
    table: {
      title: ctx.title,
      columns: ["", ...ctx.cols, "Total"],
      rows: [
        [ctx.rows[0], String(cells[0][0]), String(cells[0][1]), String(rowTot[0])],
        [ctx.rows[1], String(cells[1][0]), String(cells[1][1]), String(rowTot[1])],
        ["Total", String(colTot[0]), String(colTot[1]), String(grand)]
      ]
    },
    ...mc(r, { text: frac(cell, rowTot[ri]), why: `Only the ${ctx.rows[ri].toLowerCase()} row counts: ${cell} out of ${rowTot[ri]}.` }, [
      { text: frac(cell, grand), why: `This divides by all ${grand} ${ctx.item}s. The question restricts the choice to one row.` },
      { text: frac(cell, colTot[0]), why: "This divides by the column total. The condition names a row, so use the row total." },
      { text: frac(rowTot[ri], grand), why: `This is the probability of picking from the ${ctx.rows[ri].toLowerCase()} row at all.` }
    ]),
    explanation: `Given the ${ctx.rows[ri].toLowerCase()} group, the denominator is ${rowTot[ri]}: ${cell}/${rowTot[ri]} = ${frac(cell, rowTot[ri])}.`,
    steps: [
      step("Find the condition", `The ${ctx.item} is chosen only from: ${ctx.rows[ri]}. That row total (${rowTot[ri]}) is the denominator.`),
      step("Find the favorable count", `In that row, ${ctx.cols[0].toLowerCase()}: ${cell}`),
      step("Divide and simplify", `${cell}/${rowTot[ri]} = ${frac(cell, rowTot[ri])}`)
    ],
    hint: "The phrase \"selected from ...\" tells you which total goes in the denominator."
  };
}

const SURVEY_CONTEXTS = [
  { pop: "residents of a town", who: "residents", q: "said they bike to work" },
  { pop: "students at a university", who: "students", q: "said they use the campus gym weekly" },
  { pop: "customers of a grocery chain", who: "customers", q: "said they would use a delivery service" }
];

function sampleStatistics(r, level) {
  const ctx = pick(r, SURVEY_CONTEXTS);
  if (level !== "Hard") {
    const n0 = pick(r, [200, 250, 400, 500]);
    const t = pick(r, [20, 30, 40, 50, 60]);
    const N = n0 * t;
    const k = int(r, Math.round(n0 * 0.1), Math.round(n0 * 0.6));
    const est = k * t;
    return {
      title: "Estimate from a sample",
      prompt: `In a random sample of ${n0} of the ${N.toLocaleString("en-US")} ${ctx.pop}, ${k} ${ctx.q}. Based on the sample, about how many of the ${N.toLocaleString("en-US")} ${ctx.who} would be expected to say the same?`,
      ...mc(r, { text: est.toLocaleString("en-US"), why: `${k}/${n0} of the sample, scaled to the population: ${k}/${n0} × ${N.toLocaleString("en-US")} = ${est.toLocaleString("en-US")}.` }, [
        { text: String(k), why: "This is the count in the sample, not an estimate for the whole population." },
        { text: (N - est).toLocaleString("en-US"), why: "This estimates the people who did NOT give that answer." },
        { text: Math.round((k / n0) * 100).toLocaleString("en-US"), why: "This is the sample percentage, not a count for the population." }
      ]),
      explanation: `Sample proportion ${k}/${n0} applied to ${N.toLocaleString("en-US")}: about ${est.toLocaleString("en-US")}.`,
      steps: [
        step("Sample proportion", `${k} ÷ ${n0} = ${n(k / n0)}`),
        step("Apply it to the population", `${n(k / n0)} × ${N.toLocaleString("en-US")} = ${est.toLocaleString("en-US")}`),
        step("Why it's valid", "The sample was random, so it should represent the whole population.")
      ],
      hint: "What fraction of the sample said yes? Apply that fraction to the whole population."
    };
  }
  const p = int(r, 38, 68);
  const moe = pick(r, [2, 3, 4, 5]);
  if (r() < 0.5) {
    return {
      title: "Interpret a margin of error",
      prompt: `A random sample of ${ctx.pop} found that ${p}% ${ctx.q}, with an associated margin of error of ${moe} percentage points. Which is the most appropriate conclusion?`,
      ...mc(r, { text: `It is plausible that between ${p - moe}% and ${p + moe}% of all ${ctx.pop} would give that answer.`, why: `Estimate ± margin of error gives a range of plausible values for the whole population: ${p} ± ${moe}.` }, [
        { text: `Exactly ${p}% of all ${ctx.pop} would give that answer.`, why: "A sample gives an estimate, not an exact value for the population." },
        { text: `Between ${p - moe}% and ${p + moe}% of the ${ctx.who} in the sample gave that answer.`, why: `In the sample, exactly ${p}% gave that answer; the interval describes the population.` },
        { text: `The true percentage is definitely ${p + moe}% or higher.`, why: "The interval runs in both directions around the estimate, and it isn't a guarantee." }
      ]),
      explanation: `${p}% ± ${moe} → a plausible range of ${p - moe}% to ${p + moe}% for the population.`,
      steps: [
        step("Build the interval", `${p} ${MINUS} ${moe} = ${p - moe},  ${p} + ${moe} = ${p + moe}`),
        step("Know what it describes", "The interval estimates the whole population, not the sample."),
        step("Use careful language", "\"Plausible,\" not \"exactly\" or \"definitely.\"")
      ],
      hint: "A margin of error turns one estimate into a range for the whole population."
    };
  }
  return {
    title: "Shrink the margin of error",
    prompt: `Researchers surveyed a random sample of ${ctx.pop} and reported an estimate with a margin of error of ${moe} percentage points. Which change to the survey would most likely produce a smaller margin of error?`,
    ...mc(r, { text: `Surveying a larger random sample of ${ctx.pop}`, why: "Larger random samples produce less sampling variability, so the margin of error shrinks." }, [
      { text: `Surveying a smaller random sample of ${ctx.pop}`, why: "Smaller samples vary more, so the margin of error grows." },
      { text: `Surveying only ${ctx.who} who volunteer to respond online`, why: "A voluntary sample introduces bias and doesn't reduce sampling error." },
      { text: "Reporting the results as fractions instead of percents", why: "How results are written doesn't change their precision." }
    ]),
    explanation: "Margin of error shrinks as the size of a random sample grows.",
    steps: [
      step("Recall the idea", "Margin of error measures how much a random sample's result could differ from the population value."),
      step("What reduces it", "More data from a random sample means less chance variation."),
      step("Eliminate", "Smaller or biased samples don't help, and formatting doesn't matter.")
    ],
    hint: "More randomly chosen data → more precise estimate."
  };
}

const STUDY_CONTEXTS = [
  { treat: "listening to classical music while studying", outcome: "test scores", pop: "students at a large high school" },
  { treat: "a new fertilizer", outcome: "tomato yield", pop: "farms in a region", unit: "farms" },
  { treat: "a daily 20-minute walk", outcome: "self-reported mood", pop: "adults in a city" },
  { treat: "sleeping at least 8 hours", outcome: "reaction time", pop: "college students in a state" }
];

function studiesExperiments(r, level) {
  const ctx = pick(r, STUDY_CONTEXTS);
  const unit = ctx.unit || "people";
  if (level === "Hard" || (level === "Medium" && r() < 0.5)) {
    return {
      title: "What an experiment shows",
      prompt: `Researchers recruited ${int(r, 80, 300)} volunteers. They randomly assigned half of the volunteers to ${ctx.treat} and the other half to a control group, then compared ${ctx.outcome}. The group assigned to ${ctx.treat} showed significantly better ${ctx.outcome}. Which conclusion is best supported?`,
      ...mc(r, { text: `${ctx.treat[0].toUpperCase()}${ctx.treat.slice(1)} likely caused the improvement for volunteers like those in the study, but the result can't be generalized to all ${ctx.pop}.`, why: "Random assignment supports cause and effect; volunteers weren't randomly selected from a population, so the result doesn't generalize." }, [
        { text: `${ctx.treat[0].toUpperCase()}${ctx.treat.slice(1)} improves ${ctx.outcome} for all ${ctx.pop}.`, why: "The volunteers weren't randomly selected from that population, so the result can't be generalized to it." },
        { text: `There is an association between ${ctx.treat} and ${ctx.outcome}, but no cause-and-effect conclusion is possible.`, why: "Random assignment to groups does allow a cause-and-effect conclusion." },
        { text: "No conclusion can be drawn because the participants were volunteers.", why: "Volunteers limit generalization, but random assignment still supports a causal conclusion about them." }
      ]),
      explanation: "Random assignment → causation for the participants; no random selection → no generalization.",
      steps: [
        step("Was there random assignment?", "Yes: volunteers were randomly split into groups, so cause and effect is supported."),
        step("Was there random selection?", "No: they were volunteers, not a random sample of a population."),
        step("Combine", "Causal conclusion, but only for people like the volunteers.")
      ],
      hint: "Assignment tells you about cause. Selection tells you who the result applies to."
    };
  }
  return {
    title: "What an observational study shows",
    prompt: `A researcher selected a random sample of ${int(r, 200, 900)} ${ctx.pop} and recorded whether each engaged in ${ctx.treat}, along with their ${ctx.outcome}. Those who engaged in ${ctx.treat} had better ${ctx.outcome} on average. Which conclusion is best supported?`,
    ...mc(r, { text: `Among ${ctx.pop}, ${ctx.treat} is associated with better ${ctx.outcome}, but it can't be concluded that it causes the improvement.`, why: "A random sample supports generalizing to the population, but without random assignment only an association can be claimed." }, [
      { text: `${ctx.treat[0].toUpperCase()}${ctx.treat.slice(1)} causes better ${ctx.outcome} among ${ctx.pop}.`, why: `The ${unit} chose for themselves, so other differences could explain the result. Causation needs random assignment.` },
      { text: `${ctx.treat[0].toUpperCase()}${ctx.treat.slice(1)} causes better ${ctx.outcome}, but only for the ${unit} in the sample.`, why: "Without random assignment, a causal claim isn't supported even for the sample." },
      { text: "No association can be concluded because the sample was selected at random.", why: "Random selection is what lets the association generalize to the population." }
    ]),
    explanation: "Random selection → generalize the association; no random assignment → no causation.",
    steps: [
      step("Random selection?", "Yes, so results generalize to the population sampled."),
      step("Random assignment?", `No; the ${unit} weren't assigned to ${ctx.treat}.`),
      step("Conclusion", "An association in the population, not cause and effect.")
    ],
    hint: "Did the researcher assign the treatment, or just observe it?"
  };
}

// ---------------------------------------------------------------------------
// Geometry and Trigonometry
// ---------------------------------------------------------------------------
function areaVolume(r, level) {
  if (level === "Easy") {
    const l = int(r, 3, 12);
    const w = int(r, 2, 9);
    const h = int(r, 2, 10);
    return {
      title: "Volume of a box",
      prompt: `A rectangular box has a length of ${l} inches, a width of ${w} inches, and a height of ${h} inches, as shown. What is the volume of the box, in cubic inches?`,
      figure: { kind: "box", l: `${l} in`, w: `${w} in`, h: `${h} in` },
      ...mc(r, { text: n(l * w * h), why: `V = ℓwh = ${l} × ${w} × ${h} = ${l * w * h}.` }, [
        { text: n(2 * (l * w + l * h + w * h)), why: "This is the surface area, which measures the outside, not the space inside." },
        { text: n(l * w), why: "This is only the area of the base. Multiply by the height too." },
        { text: n(l + w + h), why: "This adds the dimensions. Volume multiplies them." }
      ], numPad(l * w * h)),
      explanation: `V = ${l} × ${w} × ${h} = ${l * w * h} cubic inches.`,
      steps: [
        step("Formula", "V = ℓ × w × h"),
        step("Substitute", `V = ${l} × ${w} × ${h}`),
        step("Multiply", `${l * w} × ${h} = ${l * w * h}`)
      ],
      hint: "Volume of a rectangular box = length × width × height."
    };
  }
  if (level === "Medium") {
    const k = int(r, 2, 5);
    const shape = pick(r, ["rectangular box", "cube", "cylinder"]);
    return {
      title: "Scale a solid",
      prompt: `Each dimension of a ${shape} is multiplied by ${k}. The volume of the new ${shape} is how many times the volume of the original ${shape}?`,
      ...mc(r, { text: n(k ** 3), why: `Volume has three dimensions, so it scales by ${k}³ = ${k ** 3}.` }, [
        { text: n(k), why: "Scaling each length by k scales the volume by k³, not k." },
        { text: n(k ** 2), why: "k² is how area scales. Volume scales by k³." },
        { text: n(3 * k), why: `This multiplies by 3 instead of cubing: ${k}³ = ${k} × ${k} × ${k}.` }
      ]),
      explanation: `Volume scales with the cube of the length factor: ${k}³ = ${k ** 3}.`,
      steps: [
        step("Count the dimensions", "Volume multiplies three lengths."),
        step("Each length grows by the factor", `(${k})(${k})(${k})`),
        step("Result", `${k}³ = ${k ** 3}`)
      ],
      hint: "If one length doubles, the volume doubles. What if all three do?"
    };
  }
  const radius = int(r, 2, 6);
  const height = int(r, 3, 12);
  const V = radius * radius * height;
  return {
    title: "Height of a cylinder",
    prompt: `A right circular cylinder has a volume of ${V}π cubic centimeters and a base radius of ${radius} centimeters. What is the height of the cylinder, in centimeters?`,
    figure: { kind: "cylinder", r: `${radius} cm`, h: "h" },
    ...mc(r, { text: n(height), why: `V = πr²h: ${V}π = π(${radius})²h = ${radius * radius}πh, so h = ${height}.` }, [
      { text: frac(V, radius), why: "This divides by r instead of r². The formula squares the radius." },
      { text: frac(V, 2 * radius), why: "2r is the diameter; the formula uses r²." },
      { text: frac(V, radius * radius * 2), why: "This divides by an extra factor of 2." }
    ], numPad(height)),
    explanation: `h = V ÷ (πr²) = ${V}π ÷ ${radius * radius}π = ${height}.`,
    steps: [
      step("Formula", "V = πr²h"),
      step("Substitute", `${V}π = π(${radius})²h = ${radius * radius}πh`),
      step("Solve for h", `h = ${V} ÷ ${radius * radius} = ${height}`)
    ],
    hint: "The volume of a cylinder is πr²h. Which quantity is unknown?"
  };
}

function linesAngles(r, level) {
  if (level === "Easy") {
    let a;
    let b;
    do {
      a = int(r, 25, 95);
      b = int(r, 25, 95);
    } while (a + b >= 165);
    const x = 180 - a - b;
    return {
      title: "Angles in a triangle",
      prompt: `In the triangle shown, the measures of two angles are ${a}° and ${b}°. What is the value of x?`,
      figure: { kind: "triangle", angles: [`${a}°`, `${b}°`, "x°"] },
      ...mc(r, { text: n(x), why: `Angles in a triangle add to 180°: 180 ${MINUS} ${a} ${MINUS} ${b} = ${x}.` }, [
        { text: n(360 - a - b), why: "A triangle's angles add to 180°, not 360°." },
        { text: n(a + b), why: "This adds the two given angles instead of subtracting their sum from 180°." },
        { text: n(Math.abs(90 - a - b) || 45), why: "This uses 90° as the total. The three angles of any triangle add to 180°." }
      ], numPad(x)),
      explanation: `x = 180 − ${a} − ${b} = ${x}.`,
      steps: [
        step("Angle sum", "The three angles of a triangle add to 180°."),
        step("Add the known angles", `${a} + ${b} = ${a + b}`),
        step("Subtract from 180", `x = 180 ${MINUS} ${a + b} = ${x}`)
      ],
      hint: "What do the angles of every triangle add up to?"
    };
  }
  if (level === "Medium") {
    const theta = int(r, 35, 80);
    const obtuse = 180 - theta;
    const positions = ["tl", "tr", "bl", "br"];
    const top = pick(r, positions);
    const bottom = pick(r, positions);
    const valueAt = (pos) => (pos === "tr" || pos === "bl" ? theta : obtuse);
    const given = valueAt(top);
    const x = valueAt(bottom);
    const sameType = given === x;
    return {
      title: "Parallel lines and a transversal",
      prompt: `In the figure, line ℓ is parallel to line m, and both are intersected by a transversal. What is the value of x?`,
      figure: { kind: "parallel", theta, labels: [{ line: "top", pos: top, text: `${given}°` }, { line: "bottom", pos: bottom, text: "x°" }] },
      ...mc(r, { text: n(x), why: sameType ? `The two marked angles are both ${given === theta ? "acute" : "obtuse"} angles formed by the parallel lines, so they're equal.` : "One marked angle is acute and the other obtuse; angles like these add to 180°." }, [
        { text: n(180 - x), why: sameType ? "These angles are equal, not supplementary." : "These angles are supplementary, not equal." },
        { text: n(Math.abs(90 - x)), why: "Nothing in the figure forms a right angle, so complementary angles don't apply." },
        { text: n(360 - x - given), why: "This subtracts both angles from 360°; the relationship is between just these two angles." }
      ], numPad(x)),
      explanation: sameType ? `Equal angles: x = ${x}.` : `Supplementary angles: x = 180 − ${given} = ${x}.`,
      steps: [
        step("Classify each marked angle", `Parallel lines cut by a transversal create only two angle measures: an acute one (${theta}°) and an obtuse one (${obtuse}°).`),
        step("Compare the two marked angles", sameType ? "Both are the same type, so they're equal." : "One is acute and one is obtuse, so they add to 180°."),
        step("Solve", sameType ? `x = ${x}` : `x = 180 ${MINUS} ${given} = ${x}`)
      ],
      hint: "With parallel lines, every acute angle is equal and every obtuse angle is equal. Is x acute or obtuse?"
    };
  }
  const ks = [[3, 2], [2, 1], [5, 2], [4, 3], [5, 3]];
  let s1;
  let s2;
  let kk;
  do {
    kk = pick(r, ks);
    s1 = int(r, 3, 12);
    s2 = int(r, 4, 15);
  } while ((s1 * kk[0]) % kk[1] !== 0 || (s2 * kk[0]) % kk[1] !== 0 || s1 === s2);
  const DE = (s1 * kk[0]) / kk[1];
  const EF = (s2 * kk[0]) / kk[1];
  return {
    title: "Similar triangles",
    prompt: `Triangle ABC is similar to triangle DEF, where A corresponds to D, B corresponds to E, and C corresponds to F. If AB = ${s1}, BC = ${s2}, and DE = ${n(DE)}, what is the length of EF?`,
    ...mc(r, { text: n(EF), why: `The scale factor is DE/AB = ${n(DE)}/${s1} = ${frac(kk[0], kk[1])}, so EF = ${s2} × ${frac(kk[0], kk[1])} = ${n(EF)}.` }, [
      { text: n(s2 + (DE - s1)), why: "This adds the difference in lengths. Similar figures scale by multiplying." },
      { text: frac(s2 * kk[1], kk[0]), why: "This uses the scale factor upside down." },
      { text: n(s2 * DE), why: "This multiplies by DE instead of by the scale factor DE/AB." }
    ], numPad(EF)),
    explanation: `EF/BC = DE/AB, so EF = ${s2} × ${n(DE)}/${s1} = ${n(EF)}.`,
    steps: [
      step("Match corresponding sides", "AB ↔ DE and BC ↔ EF."),
      step("Find the scale factor", `DE ÷ AB = ${n(DE)} ÷ ${s1} = ${frac(kk[0], kk[1])}`),
      step("Apply it", `EF = ${s2} × ${frac(kk[0], kk[1])} = ${n(EF)}`)
    ],
    hint: "Corresponding sides of similar triangles are proportional."
  };
}

const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [20, 21, 29]];

function rightTriangles(r, level) {
  if (level === "Easy") {
    const [a, b, c] = pick(r, TRIPLES);
    const askHyp = r() < 0.6;
    return {
      title: askHyp ? "Find the hypotenuse" : "Find a missing leg",
      prompt: askHyp
        ? `A right triangle has legs of lengths ${a} and ${b}, as shown. What is the length of the hypotenuse?`
        : `A right triangle has a hypotenuse of length ${c} and one leg of length ${a}. What is the length of the other leg?`,
      figure: { kind: "right", base: String(askHyp ? b : "?"), height: String(a), hyp: askHyp ? "?" : String(c) },
      ...mc(r, { text: n(askHyp ? c : b), why: askHyp ? `${a}² + ${b}² = ${a * a + b * b} = ${c}².` : `${c}² ${MINUS} ${a}² = ${c * c - a * a} = ${b}².` }, askHyp ? [
        { text: n(a + b), why: "This adds the legs. The Pythagorean theorem adds their squares." },
        { text: n(a * a + b * b), why: `This is c², not c. Take the square root: √${a * a + b * b} = ${c}.` },
        { text: n((a * b) / 2), why: "This is the triangle's area, not the hypotenuse." }
      ] : [
        { text: n(c - a), why: "This subtracts the lengths. Subtract their squares, then take the square root." },
        { text: n(c * c - a * a), why: `This is b², not b. Take the square root: √${c * c - a * a} = ${b}.` },
        { text: n(Math.round(Math.sqrt(c * c + a * a) * 100) / 100), why: "This adds the squares; to find a leg, subtract the leg's square from the hypotenuse's." }
      ], numPad(askHyp ? c : b)),
      explanation: `Pythagorean theorem: ${a}² + ${b}² = ${c}².`,
      steps: [
        step("Pythagorean theorem", "a² + b² = c², where c is the hypotenuse."),
        step("Substitute", askHyp ? `${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c}` : `${c}² ${MINUS} ${a}² = ${c * c} ${MINUS} ${a * a} = ${b * b}`),
        step("Square root", askHyp ? `c = √${c * c} = ${c}` : `b = √${b * b} = ${b}`)
      ],
      hint: "a² + b² = c². Which side is missing?"
    };
  }
  if (level === "Medium") {
    const [a, b, c] = pick(r, TRIPLES);
    const fn = pick(r, ["sin", "cos", "tan"]);
    const val = { sin: [a, c], cos: [b, c], tan: [a, b] }[fn];
    const others = { sin: [[b, c], [a, b]], cos: [[a, c], [a, b]], tan: [[b, c], [a, c]] }[fn];
    return {
      title: `Find ${fn} A`,
      prompt: `In right triangle ABC, angle C is the right angle, BC = ${a}, AC = ${b}, and AB = ${c}. What is the value of ${fn} A?`,
      figure: { kind: "right", labels: ["C", "A", "B"], base: String(b), height: String(a), hyp: String(c) },
      ...mc(r, { text: frac(val[0], val[1]), why: `${fn} = ${{ sin: "opposite/hypotenuse", cos: "adjacent/hypotenuse", tan: "opposite/adjacent" }[fn]}; from A, the opposite side is BC = ${a}, the adjacent side is AC = ${b}, and the hypotenuse is ${c}.` }, [
        { text: frac(others[0][0], others[0][1]), why: "This is a different trig ratio. Use SOH-CAH-TOA from angle A." },
        { text: frac(others[1][0], others[1][1]), why: "This is a different trig ratio. Use SOH-CAH-TOA from angle A." },
        { text: frac(val[1], val[0]), why: "This is the reciprocal of the correct ratio." }
      ]),
      explanation: `From angle A: opposite = ${a}, adjacent = ${b}, hypotenuse = ${c}; ${fn} A = ${frac(val[0], val[1])}.`,
      steps: [
        step("Label the sides from angle A", `Opposite A: BC = ${a}. Adjacent to A: AC = ${b}. Hypotenuse: AB = ${c}.`),
        step("Pick the ratio", { sin: "SOH: sin = opposite/hypotenuse", cos: "CAH: cos = adjacent/hypotenuse", tan: "TOA: tan = opposite/adjacent" }[fn]),
        step("Compute", `${fn} A = ${val[0]}/${val[1]}${gcd(val[0], val[1]) > 1 ? ` = ${frac(val[0], val[1])}` : ""}`)
      ],
      hint: "Label the sides as opposite, adjacent, and hypotenuse from angle A, then use SOH-CAH-TOA."
    };
  }
  if (r() < 0.5) {
    const [a, , c] = pick(r, TRIPLES);
    const b = Math.sqrt(c * c - a * a);
    return {
      title: "Complementary angles",
      prompt: `In a right triangle, one acute angle measures x°, and sin(x°) = ${frac(a, c)}. What is the value of cos((90 ${MINUS} x)°)?`,
      ...mc(r, { text: frac(a, c), why: `The two acute angles are complementary, and sin(x°) = cos((90 ${MINUS} x)°).` }, [
        { text: frac(b, c), why: `This is cos(x°), not cos((90 ${MINUS} x)°).` },
        { text: frac(c, a), why: "This is the reciprocal of sin(x°)." },
        { text: frac(a, b), why: "This is tan(x°)." }
      ]),
      explanation: "sin(x°) = cos((90 − x)°) for any acute angle x.",
      steps: [
        step("Use the identity", `sin(x°) = cos((90 ${MINUS} x)°)`),
        step("Why it's true", `The side opposite angle x is adjacent to the other acute angle, which measures (90 ${MINUS} x)°.`),
        step("Answer", `cos((90 ${MINUS} x)°) = ${frac(a, c)}`)
      ],
      hint: "How are the two acute angles in a right triangle related?"
    };
  }
  const h = 2 * int(r, 2, 9);
  return {
    title: "A 30-60-90 triangle",
    prompt: `In a right triangle, one angle measures 30° and the hypotenuse has length ${h}. What is the length of the side opposite the 60° angle?`,
    figure: { kind: "right", angle: "30°", hyp: String(h), base: "?", height: String(h / 2) },
    ...mc(r, { text: `${h / 2}√3`, why: `In a 30-60-90 triangle the sides are x, x√3, 2x. With 2x = ${h}, x = ${h / 2}, so the side opposite 60° is ${h / 2}√3.` }, [
      { text: String(h / 2), why: "This is the side opposite the 30° angle (the shortest side)." },
      { text: `${h}√3`, why: "This multiplies the hypotenuse by √3. Use the short leg (half the hypotenuse)." },
      { text: `${h / 2}√2`, why: "√2 appears in 45-45-90 triangles, not 30-60-90." }
    ]),
    explanation: `Short leg = ${h}/2 = ${h / 2}; long leg = ${h / 2}√3.`,
    steps: [
      step("Recall the ratios", "30-60-90: short leg x, long leg x√3, hypotenuse 2x."),
      step("Find x", `2x = ${h}  →  x = ${h / 2}`),
      step("Side opposite 60°", `x√3 = ${h / 2}√3`)
    ],
    hint: "30-60-90 sides are in the ratio 1 : √3 : 2."
  };
}

function circles(r, level) {
  if (level === "Easy") {
    const d = 2 * int(r, 2, 9);
    const rad = d / 2;
    return {
      title: "Area from a diameter",
      prompt: `A circle has a diameter of ${d} meters. What is the area of the circle, in square meters?`,
      figure: { kind: "circle", diameter: `${d} m` },
      ...mc(r, { text: `${rad * rad}π`, why: `The radius is ${rad}, and A = πr² = ${rad * rad}π.` }, [
        { text: `${d * d}π`, why: "This uses the diameter in place of the radius." },
        { text: `${d}π`, why: "This is the circumference (πd), not the area." },
        { text: `${rad}π`, why: "This forgets to square the radius." },
        { text: `${2 * rad * rad}π`, why: "This doubles πr². The area is just πr²." }
      ]),
      explanation: `r = ${d}/2 = ${rad}; A = π(${rad})² = ${rad * rad}π.`,
      steps: [
        step("Radius from diameter", `r = ${d} ÷ 2 = ${rad}`),
        step("Area formula", "A = πr²"),
        step("Substitute", `A = π(${rad})² = ${rad * rad}π`)
      ],
      hint: "The area formula uses the radius, which is half the diameter."
    };
  }
  if (level === "Medium") {
    const opts = [[30, 6], [45, 8], [60, 6], [60, 9], [72, 5], [90, 4], [90, 10], [120, 3], [120, 6], [135, 8], [150, 6]];
    const [deg, rad] = pick(r, opts);
    const arc = [deg * 2 * rad, 360];
    const sector = [deg * rad * rad, 360];
    const pi = (p, q) => {
      const g = gcd(p, q);
      const P = p / g;
      const Q = q / g;
      return Q === 1 ? `${P === 1 ? "" : P}π` : `${P === 1 ? "" : P}π/${Q}`;
    };
    return {
      title: "Arc length",
      prompt: `A circle has a radius of ${rad} centimeters. What is the length, in centimeters, of an arc of the circle that has a central angle of ${deg}°?`,
      figure: { kind: "circle", radius: `${rad} cm`, angle: deg },
      ...mc(r, { text: pi(arc[0], arc[1]), why: `Arc length = (${deg}/360) × 2π(${rad}) = ${pi(arc[0], arc[1])}.` }, [
        { text: pi(sector[0], sector[1]), why: "This is the area of the sector (it uses πr²), not the arc length." },
        { text: pi(2 * rad, 1), why: "This is the whole circumference. The arc is only a fraction of it." },
        { text: pi(deg * rad, 360), why: "This uses πr instead of 2πr for the full circumference." },
        { text: pi(rad * rad, 1), why: "This is the area of the whole circle." }
      ]),
      explanation: `Arc = (${deg}°/360°) × circumference = ${pi(arc[0], arc[1])}.`,
      steps: [
        step("Fraction of the circle", `${deg}/360 = ${frac(deg, 360)}`),
        step("Circumference", `2π(${rad}) = ${2 * rad}π`),
        step("Multiply", `${frac(deg, 360)} × ${2 * rad}π = ${pi(arc[0], arc[1])}`)
      ],
      hint: "An arc is a fraction of the circumference: central angle ÷ 360°."
    };
  }
  const h = nz(r, -6, 6);
  const k = nz(r, -6, 6);
  const rad = int(r, 2, 9);
  const D = -2 * h;
  const E = -2 * k;
  const F = rad * rad - h * h - k * k;
  const lhs = poly([[1, "x²"], [1, "y²"], [D, "x"], [E, "y"]]);
  return {
    title: "Complete the square",
    prompt: `The equation ${lhs} = ${n(F)} defines a circle in the xy-plane. What is the radius of the circle?`,
    ...mc(r, { text: n(rad), why: `Completing the square gives (x ${signed(-h)})² + (y ${signed(-k)})² = ${rad * rad}, so r = ${rad}.` }, [
      { text: n(rad * rad), why: "This is r². Take the square root." },
      { text: F > 0 && Math.sqrt(F) !== rad ? `√${F}` : n(rad + 2), why: "This uses the constant from the original equation before completing the square." },
      { text: n(Math.abs(h) + Math.abs(k)), why: "This combines the center's coordinates; it isn't the radius." }
    ], numPad(rad)),
    explanation: `(x ${signed(-h)})² + (y ${signed(-k)})² = ${n(F)} + ${h * h} + ${k * k} = ${rad * rad}.`,
    steps: [
      step("Group and complete the square in x", `x² ${signed(D)}x → (x ${signed(-h)})² ${MINUS} ${h * h}`),
      step("Complete the square in y", `y² ${signed(E)}y → (y ${signed(-k)})² ${MINUS} ${k * k}`),
      step("Collect constants", `(x ${signed(-h)})² + (y ${signed(-k)})² = ${n(F)} + ${h * h} + ${k * k} = ${rad * rad}, so r = √${rad * rad} = ${rad}.`)
    ],
    hint: "Complete the square for x and for y, then read r² from the right side."
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
const GENERATORS = {
  "Linear equations in one variable": linearOneVariable,
  "Linear equations in two variables": linearTwoVariables,
  "Linear functions": linearFunctions,
  "Systems of linear equations": systemsLinear,
  "Linear inequalities": linearInequalities,
  "Equivalent expressions": equivalentExpressions,
  "Nonlinear equations and systems": nonlinearEquations,
  "Nonlinear functions": nonlinearFunctions,
  "Ratios, rates, and units": ratiosRates,
  "Percentages": percentages,
  "One-variable data": oneVariableData,
  "Two-variable data": twoVariableData,
  "Probability": probability,
  "Sample statistics and margin of error": sampleStatistics,
  "Studies and experiments": studiesExperiments,
  "Area and volume": areaVolume,
  "Lines, angles, and triangles": linesAngles,
  "Right triangles and trigonometry": rightTriangles,
  "Circles": circles
};

const MATH_DOMAIN = {};
for (const [domain, skills] of Object.entries(SKILLS.Math)) for (const s of skills) MATH_DOMAIN[s] = domain;

export const LEVELS = ["Easy", "Medium", "Hard"];
export const hasGenerator = (skill) => Boolean(GENERATORS[skill]);
export const skillSlug = (skill) => skill.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const SLUG_TO_SKILL = Object.fromEntries(Object.keys(GENERATORS).map((s) => [skillSlug(s), s]));

// One generated question (without an id). Deterministic for (skill, level, seed).
export function generateMath(skill, level, seed) {
  const gen = GENERATORS[skill];
  if (!gen) return null;
  const q = gen(mulberry32(seed), LEVELS.includes(level) ? level : "Medium");
  return { section: "Math", domain: MATH_DOMAIN[skill], topic: skill, difficulty: level, ...q, gen: { skill, level, seed } };
}

// Remix ids encode everything needed to rebuild the question for grading.
export function remixId(skill, level, seed) {
  return `rmx.${skillSlug(skill)}.${LEVELS.indexOf(level)}.${seed}`;
}
export function parseRemixId(id) {
  const m = /^rmx\.([a-z0-9-]+)\.([0-2])\.(\d{1,10})$/.exec(String(id || ""));
  if (!m || !SLUG_TO_SKILL[m[1]]) return null;
  return { skill: SLUG_TO_SKILL[m[1]], level: LEVELS[Number(m[2])], seed: Number(m[3]) };
}

// The generated part of the starter bank: 6 questions per skill (2 per level),
// with fixed seeds so every server builds the same questions.
export function buildMathStarter(perSkill = 6) {
  const out = [];
  Object.keys(GENERATORS).forEach((skill, si) => {
    for (let i = 0; i < perSkill; i++) {
      const level = LEVELS[Math.floor((i * LEVELS.length) / perSkill)];
      const seed = 1000 + si * 97 + i * 13;
      const q = generateMath(skill, level, seed);
      out.push({ key: `m-${skillSlug(skill)}-${i + 1}`, ...q });
    }
  });
  return out;
}
