// Reads the plain notation question text is written in and says how to lay it out, so that
// MathText can draw it the way it is written by hand:
//   a/b                      a stacked fraction
//   √(x + 4)  √3  ∛(…)  ∜x   a radical with a bar over what it covers
//   x²  x⁻⁸  2^{t/3}  2^(t/3)  (1.12)^t     an exponent
//   y₂  x_{1}                a subscript
//   **bold**
// backend/content/latexPlain.js is the reference for the notation.
//
// A fraction is a "/" with a term tight against each side:
//   5/3   −11/9   2t/3   1/(2x)   (x − 2)/3   (18x² + 27x − 31)/(kx − 2)   f(5)/(f(2))   √3/2
// Brackets that are only there to hold a numerator or denominator together are marked so they can
// be left out of the drawing, and so are the ones round a fraction used as a coefficient,
// "(3/4)(8x − 12)". A slash with a space beside it is never a fraction ("line one / line two").
//
// The same text also carries prose, so a slash between words is left alone: and/or,
// Precario/Precarious, km/h, $5/lb, a date like 10/08/2026. `mathLayout.test.js` (backend) runs the
// whole question bank through this and pins what is and isn't drawn.
//
// Every node that isn't plain text has `len`, the number of characters of the text it stands for,
// so a caller can tell where in the text each one is (the highlighter does).

const SUP_CHARS = new Map(Object.entries({ "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "−", "⁺": "+", "ᵗ": "t", "ⁿ": "n", "ˣ": "x" }));
const SUB_CHARS = new Map(Object.entries({ "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9", "₊": "+", "₋": "−" }));
const ONE_CHAR_FRACTIONS = new Map(Object.entries({ "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5", "⅙": "1/6", "⅚": "5/6", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8" }));
const ROOT_INDEX = { "√": "", "∛": "3", "∜": "4" };
const SUPS = [...SUP_CHARS.keys()].join("");
const ROOTS = Object.keys(ROOT_INDEX).join("");
const SIGNS = "=+−·×÷<>≤≥≈±";
const TIGHT = new RegExp(`[0-9a-zA-Zπθℓ°${ROOTS}${SUPS}]`);
const OPERAND_END = new RegExp(`[\\p{L}\\p{N})}°${ROOTS}${SUPS}]`, "u");
const WORD_CHAR = /[\p{L}\p{N}]/u;
const FUNCTIONS = new Set(["sin", "cos", "tan", "log", "ln"]);
// Rates, not fractions: "km/h", "$5/lb", "30 m/s". A one-letter unit only counts beside another
// one, because m, s and h are just as often variables ("r/s + s/r").
const UNITS = new Set(["km", "cm", "mm", "kg", "mg", "mL", "ml", "hr", "mi", "ft", "in", "yd", "lb", "oz"]);
const SHORT_UNITS = new Set(["m", "s", "h", "g", "L", "l"]);
// Pairs of letters that are abbreviations wherever they turn up (compared in lower case).
const NOT_MATH = new Set(["w/o", "n/a", "c/o", "y/n", "m/f", "i/o", "am/pm", "us/uk", "uk/us", "ui/ux", "ai/ml"]);

const isDigit = (ch) => ch >= "0" && ch <= "9";
const withoutSups = (text) => [...text].filter((ch) => !SUP_CHARS.has(ch)).join("");

function matchClose(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth += 1;
    else if (s[i] === ")" && --depth === 0) return i;
  }
  return -1;
}

function matchOpen(s, close) {
  let depth = 0;
  for (let i = close; i >= 0; i--) {
    if (s[i] === ")") depth += 1;
    else if (s[i] === "(" && --depth === 0) return i;
  }
  return -1;
}

// Where the exponent or subscript written at i ends: ^{…} _{…} ^(…) ^2 ^t. −1 if none starts there.
function scriptEnd(s, i) {
  if (s[i] !== "^" && s[i] !== "_") return -1;
  if (s[i + 1] === "{") {
    const close = s.indexOf("}", i);
    return close < 0 ? -1 : close + 1;
  }
  if (s[i] === "_") return -1;
  if (s[i + 1] === "(") {
    const close = matchClose(s, i + 1);
    return close < 0 ? -1 : close + 1;
  }
  const bare = /^(\d+(\.\d+)?|[a-zA-Zπθ](?![a-zA-Z]))/.exec(s.slice(i + 1));
  return bare ? i + 1 + bare[0].length : -1;
}

// What the root sign before j covers: a bracketed group, a number or one letter. Null if nothing.
function radicand(s, j) {
  if (s[j] === "(") {
    const close = matchClose(s, j);
    return close < 0 ? null : { inner: s.slice(j + 1, close), brackets: true, end: close + 1 };
  }
  const simple = /^(\d+(,\d{3}(?!\d))*(\.\d+)?|[a-zA-Zπθℓ])/.exec(s.slice(j));
  return simple ? { inner: simple[0], brackets: false, end: j + simple[0].length } : null;
}

// For each character: how many brackets it sits inside, whether it is part of an exponent or
// subscript, and whether it is under a root sign (a slash there belongs to the root's contents).
function survey(s) {
  const depth = new Array(s.length).fill(0);
  const script = new Array(s.length).fill(false);
  const rooted = new Array(s.length).fill(false);
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    const end = scriptEnd(s, i);
    if (end > 0) {
      for (let j = i; j < end; j++) {
        script[j] = true;
        depth[j] = d;
      }
      i = end - 1;
      continue;
    }
    if (ROOTS.includes(s[i]) && s[i + 1] === "(") {
      const close = matchClose(s, i + 1);
      for (let j = i + 2; j < close; j++) rooted[j] = true;
    }
    if (s[i] === ")") d = Math.max(0, d - 1);
    depth[i] = d;
    if (s[i] === "(") d += 1;
  }
  return { depth, script, rooted };
}

// Where the numerator before the slash at k starts: everything written tight against it.
function numeratorStart(s, k, script) {
  let i = k - 1;
  while (i >= 0) {
    const ch = s[i];
    if (script[i]) {
      while (i >= 0 && script[i]) i -= 1;
    } else if (ch === ")") {
      const open = matchOpen(s, i);
      if (open < 0) break;
      i = open - 1;
    } else if (TIGHT.test(ch)) i -= 1;
    else if (ch === "." && isDigit(s[i - 1]) && isDigit(s[i + 1])) i -= 1;
    else if (ch === "," && isDigit(s[i - 1]) && /^\d{3}(?!\d)/.test(s.slice(i + 1, i + 5))) i -= 1; // 16,200
    else break;
  }
  return i + 1;
}

// Where the denominator after the slash at k ends: a bracketed group, a root, or a number and/or
// letters ("3", "x²", "0.4y", "360°"), with any exponent. −1 when there isn't one.
function denominatorEnd(s, k, script) {
  let j = k + 1;
  const exponents = () => {
    for (;;) {
      if (j < s.length && SUP_CHARS.has(s[j])) j += 1;
      else if ((s[j] === "^" || s[j] === "_") && script[j]) while (script[j]) j += 1;
      else return j;
    }
  };
  if (s[j] === "(") {
    const close = matchClose(s, j);
    if (close < 0) return -1;
    j = close + 1;
    return exponents();
  }
  if (j < s.length && ROOTS.includes(s[j])) {
    const under = radicand(s, j + 1);
    if (!under) return -1;
    j = under.end;
    return exponents();
  }
  const number = /^\d+(,\d{3}(?!\d))*(\.\d+)?/.exec(s.slice(j));
  if (number) j += number[0].length;
  const letters = /^[a-zA-Zπθℓ]+/.exec(s.slice(j));
  if (letters) j += letters[0].length;
  if (j === k + 1) return -1;
  exponents();
  if (s[j] === "°") j += 1;
  return j;
}

// A side of a fraction is math, not a word: outside its brackets, letters come one or two at a
// time (x, ab, DE) or spell a function.
function isTerm(text) {
  let depth = 0;
  let run = "";
  const runOk = () => run.length <= 2 || FUNCTIONS.has(run);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const end = scriptEnd(text, i);
    if (end > 0) {
      i = end - 1;
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (depth === 0 && /[a-zA-Z]/.test(ch)) run += ch;
    else {
      if (!runOk()) return false;
      run = "";
    }
  }
  return runOk();
}

function isFraction(s, start, k, end) {
  const num = s.slice(start, k);
  const den = s.slice(k + 1, end);
  if (!isTerm(num) || !isTerm(den)) return false;
  // Part of a longer word or path: "señor/a", "site.com/a/b".
  const before = s[start - 1];
  const after = s[end];
  if (before && (before === "/" || WORD_CHAR.test(before))) return false;
  if (after && WORD_CHAR.test(after) && !den.startsWith("(")) return false;

  const top = withoutSups(num);
  const bottom = withoutSups(den);
  if (UNITS.has(top) || UNITS.has(bottom)) return false;
  if (NOT_MATH.has(`${top}/${bottom}`.toLowerCase())) return false;
  if (/^\d+$/.test(num) && /^\d+$/.test(den) && after === "/" && isDigit(s[end + 1])) return false; // a date
  if (/^[a-zA-Z]+$/.test(top) && /^[a-zA-Z]+$/.test(bottom)) {
    if (SHORT_UNITS.has(top) && SHORT_UNITS.has(bottom)) return false;
    if (top.length === 1 && bottom.length === 1) return true; // x/a
    return top === top.toUpperCase() && bottom === bottom.toUpperCase(); // a ratio of segments, DE/AB
  }
  return true;
}

// The fractions in a piece of text, left to right: { start, end, num, den, wrap }. `wrap` means the
// fraction's own enclosing brackets are part of the span and not needed once it is stacked.
// Fractions under a root sign or in an exponent are not listed: they are found when that is laid out.
export function findFractions(text) {
  const s = String(text ?? "");
  if (!s.includes("/")) return [];
  const { depth, script, rooted } = survey(s);
  const slashes = [];
  for (let i = 0; i < s.length; i++) if (s[i] === "/" && !script[i] && !rooted[i]) slashes.push(i);
  // Outermost first, so that in (1/2)/3 the whole thing is the fraction and 1/2 its numerator.
  slashes.sort((a, b) => depth[a] - depth[b] || a - b);

  const found = [];
  for (const k of slashes) {
    if (found.some((f) => k >= f.start && k < f.end)) continue;
    const end = denominatorEnd(s, k, script);
    if (end < 0) continue;
    // a/b/c reads left to right: (a/b)/c.
    const chained = found.find((f) => f.end === k);
    if (chained) {
      if (!isTerm(s.slice(k + 1, end))) continue;
      Object.assign(chained, { end, num: s.slice(chained.start, k), den: s.slice(k + 1, end) });
      continue;
    }
    const start = numeratorStart(s, k, script);
    if (start === k || !isFraction(s, start, k, end)) continue;
    if (found.some((f) => start < f.end && end > f.start)) continue;
    found.push({ start, end, num: s.slice(start, k), den: s.slice(k + 1, end), wrap: false });
  }

  for (const f of found) {
    const open = f.start - 1;
    const close = f.end;
    if (s[open] !== "(" || s[close] !== ")") continue;
    const prev = s[open - 1];
    const next = s[close + 1];
    if (prev && OPERAND_END.test(prev)) continue; // f(14/3), 16(1/16): the brackets mean something
    if (next && (SUP_CHARS.has(next) || next === "^")) continue; // (5/3)²
    const signBefore = SIGNS.includes(s.slice(0, open).trimEnd().slice(-1) || " ");
    const signAfter = SIGNS.includes(s.slice(close + 1).trimStart()[0] || " ");
    const coefficient = Boolean(next) && /[a-zA-Zπθℓ(√∛∜]/.test(next);
    if (coefficient || signBefore || signAfter) Object.assign(f, { start: open, end: close + 1, wrap: true });
  }
  return found.sort((a, b) => a.start - b.start);
}

// "(x − 2)" -> "x − 2" when the brackets enclose all of it, otherwise null.
function unbracket(text) {
  return text[0] === "(" && matchClose(text, 0) === text.length - 1 ? text.slice(1, -1) : null;
}

// A stretch with no fraction of its own in it: roots, exponents, subscripts and plain text.
function inline(s) {
  const out = [];
  let text = "";
  const push = (node) => {
    if (text) out.push(text);
    text = "";
    out.push(node);
  };
  for (let i = 0; i < s.length; ) {
    const ch = s[i];
    const end = scriptEnd(s, i);
    if (end > 0) {
      const form = s[i + 1] === "{" ? "braces" : s[i + 1] === "(" ? "brackets" : "bare";
      const inner = form === "bare" ? s.slice(i + 1, end) : s.slice(i + 2, end - 1);
      push({ type: ch === "^" ? "sup" : "sub", form, children: layout(inner), len: end - i });
      i = end;
    } else if (ROOTS.includes(ch) && radicand(s, i + 1)) {
      const under = radicand(s, i + 1);
      push({ type: "root", sign: ch, index: ROOT_INDEX[ch], brackets: under.brackets, children: layout(under.inner), len: under.end - i });
      i = under.end;
    } else if (SUP_CHARS.has(ch) || SUB_CHARS.has(ch)) {
      // x², y₁: the same exponent or subscript, written with ordinary digits so it is drawn in the
      // text's own font and size (the special characters come from whatever font happens to have them).
      const chars = SUP_CHARS.has(ch) ? SUP_CHARS : SUB_CHARS;
      let j = i;
      while (j < s.length && chars.has(s[j])) j += 1;
      const raw = s.slice(i, j);
      push({ type: chars === SUP_CHARS ? "sup" : "sub", form: "chars", raw, children: [[...raw].map((c) => chars.get(c)).join("")], len: j - i });
      i = j;
    } else if (ONE_CHAR_FRACTIONS.has(ch)) {
      const [num, den] = ONE_CHAR_FRACTIONS.get(ch).split("/");
      push({ type: "frac", raw: ch, num: [num], den: [den], numBrackets: false, denBrackets: false, wrap: false, mixed: isDigit(s[i - 1] || ""), len: 1 });
      i += 1;
    } else {
      text += ch;
      i += 1;
    }
  }
  if (text) out.push(text);
  return out;
}

function layout(s) {
  const out = [];
  let last = 0;
  for (const f of findFractions(s)) {
    out.push(...inline(s.slice(last, f.start)));
    const top = unbracket(f.num);
    const bottom = unbracket(f.den);
    out.push({
      type: "frac",
      num: layout(top ?? f.num),
      den: layout(bottom ?? f.den),
      numBrackets: top !== null,
      denBrackets: bottom !== null,
      wrap: f.wrap,
      // 66 2/3: the fraction belongs to the whole number before it.
      mixed: !f.wrap && /\d $/.test(s.slice(0, f.start)) && /^\d+$/.test(f.num) && /^\d+$/.test(f.den),
      len: f.end - f.start
    });
    last = f.end;
  }
  out.push(...inline(s.slice(last)));
  return out;
}

// One line of text as a list of strings and nodes, in order and covering all of it:
//   { type: "frac", num, den, numBrackets, denBrackets, wrap, mixed, raw? }
//   { type: "root", sign, index, brackets, children }
//   { type: "sup" | "sub", form: "braces" | "brackets" | "bare" | "chars", children, raw? }
export function mathLine(text) {
  return layout(String(text ?? ""));
}

// The same with **bold** read as well: { type: "b", children }.
export function mathTree(text) {
  const src = String(text ?? "");
  const out = [];
  let last = 0;
  for (const m of src.matchAll(/\*\*[^*]+\*\*/g)) {
    out.push(...layout(src.slice(last, m.index)));
    out.push({ type: "b", children: layout(m[0].slice(2, -2)), len: m[0].length });
    last = m.index + m[0].length;
  }
  out.push(...layout(src.slice(last)));
  return out;
}
