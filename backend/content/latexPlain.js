// Turns the LaTeX the owner's question files use ($…$ inline, $$…$$ on its own line, \$ for a
// dollar sign) into the plain notation the practice player shows (frontend
// components/MathText.jsx): Unicode operators, a/b for fractions (drawn stacked there, see
// components/mathLayout.js), x² or ^{…} for exponents.
//
//   \frac{5(x-2)}{3}-\frac{x-2}{2}=14   ->  (5(x − 2))/3 − (x − 2)/2 = 14
//   \tfrac{2}{3}(9x-6)                  ->  (2/3)(9x − 6)
//   15\div\tfrac{9}{5}                  ->  15 ÷ (9/5)
//   A(t)=2{,}500(1.015)^{4t}            ->  A(t) = 2,500(1.015)^{4t}
//   \sin(3x-8)^\circ                    ->  sin(3x − 8)°
//
// Only the commands the files use are known. Anything else throws, so a new file with new notation
// is noticed when it is loaded instead of reaching students half converted.

const SUPERSCRIPT = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "−": "⁻" };
const SYMBOLS = {
  pi: "π", theta: "θ", ell: "ℓ", cdot: "·", times: "×", div: "÷", le: "≤", leq: "≤", ge: "≥", geq: "≥",
  neq: "≠", ne: "≠", approx: "≈", pm: "±", ldots: "…", dots: "…", infty: "∞", "%": "%", "$": "$", ",": "", ";": "", "!": ""
};
const FUNCTIONS = new Set(["sin", "cos", "tan", "log", "ln"]);
// Commands that start something a fraction would be multiplied by when it comes straight after it.
const OPERAND_COMMANDS = new Set(["sqrt", "pi", "theta", "ell", "left", "frac", "dfrac", "tfrac", ...FUNCTIONS]);
const ROOTS = { 2: "√", 3: "∛", 4: "∜" };

// Private-use characters that stand in for things the spacing pass must leave alone.
const HARD_SPACE = ""; // a space that is part of the notation ("sin A", "66 2/3")
const THOUSANDS = ""; // the comma in 2,500
const SUP_OPEN = ""; // ^{ … } kept as mark-up for MathText
const SUP_CLOSE = "";
const DOLLAR = "";

const OPERAND = /[0-9a-zA-Zπθℓ)°⁰¹²³⁴-⁹…∞%]/;
const isOperandEnd = (ch) => OPERAND.test(ch) || ch === SUP_CLOSE;

// Puts one space around binary operators and after commas, and none after a sign.
function space(expr) {
  const src = expr.replace(/ /g, "");
  let out = "";
  let barOpen = false;
  let inSup = 0;
  const last = () => out.trimEnd().slice(-1);
  for (const ch of src) {
    if (ch === SUP_OPEN) inSup += 1;
    if (ch === SUP_CLOSE) inSup -= 1;
    if (inSup > 0 && ch !== SUP_OPEN) {
      out += ch; // exponents stay compact
      continue;
    }
    if ("=<>≤≥≠≈·×÷".includes(ch)) out = `${out.trimEnd()} ${ch} `;
    else if (ch === "+" || ch === "−" || ch === "±") {
      const prev = last();
      const binary = prev === HARD_SPACE ? false : isOperandEnd(prev) || (prev === "|" && !barOpen);
      out = binary ? `${out.trimEnd()} ${ch} ` : out + ch;
    } else if (ch === ",") out += ", ";
    else {
      if (ch === "|") barOpen = !barOpen;
      out += ch;
    }
  }
  return out.replace(/ {2,}/g, " ").trim();
}

function convert(src) {
  let i = 0;
  let out = "";
  const peek = () => {
    let j = i;
    while (src[j] === " ") j += 1;
    return j;
  };
  const commandAt = (j) => (src[j] === "\\" ? (src.slice(j + 1).match(/^[a-zA-Z]+|^./) || [""])[0] : null);
  // The argument of ^, _ or a command: a {group}, a \command, or a single character.
  const argument = () => {
    i = peek();
    if (src[i] === "{") {
      let depth = 0;
      const start = i + 1;
      for (; i < src.length; i++) {
        if (src[i] === "{") depth += 1;
        else if (src[i] === "}" && --depth === 0) return src.slice(start, i++);
      }
      throw new Error(`unclosed { in "${src}"`);
    }
    if (src[i] === "\\") {
      const name = commandAt(i);
      i += 1 + name.length;
      return `\\${name}`;
    }
    return src[i++] ?? "";
  };
  const lastChar = () => out.trimEnd().slice(-1);
  const lastOperator = () => {
    const m = out.match(/([·×÷])\s*$/);
    return m ? m[1] : null;
  };
  // What comes next is something this would be multiplied by, or an operator that binds tightly.
  const tightAfter = () => {
    const j = peek();
    const ch = src[j];
    if (ch === undefined) return false;
    if (/[a-zA-Z(^]/.test(ch)) return true;
    const name = commandAt(j);
    return name ? OPERAND_COMMANDS.has(name) || ["cdot", "times", "div"].includes(name) : false;
  };

  while (i < src.length) {
    const ch = src[i];
    if (ch === " ") {
      i += 1;
    } else if (ch === "\\") {
      const name = commandAt(i);
      i += 1 + name.length;
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const num = space(convert(argument()));
        const den = space(convert(argument()));
        const top = /[ ]/.test(num) ? `(${num})` : num;
        const bottom = /^([\d.,]+|[a-zA-Zπθℓ][⁰¹²³⁴-⁹⁻]*|[√∛∜][\da-zA-Z])$/.test(den) ? den : `(${den})`;
        const prev = lastChar();
        if (/\d/.test(prev)) out += `${HARD_SPACE}${top}/${bottom}`; // a mixed number: 66 2/3
        else if (isOperandEnd(prev) || lastOperator() || tightAfter()) out += `(${top}/${bottom})`;
        else out += `${top}/${bottom}`;
      } else if (name === "sqrt") {
        let index = "2";
        if (src[peek()] === "[") {
          i = peek();
          const end = src.indexOf("]", i);
          index = src.slice(i + 1, end).trim();
          i = end + 1;
        }
        const inner = space(convert(argument()));
        const sign = ROOTS[index] || `${[...index].map((c) => SUPERSCRIPT[c] ?? c).join("")}√`;
        out += /^(\d+(\.\d+)?|[a-zA-Zπθℓ])$/.test(inner) ? `${sign}${inner}` : `${sign}(${inner})`;
      } else if (name === "left" || name === "right") {
        // \left( … \right): the bracket itself follows and is handled as an ordinary character.
      } else if (FUNCTIONS.has(name)) {
        if (isOperandEnd(lastChar())) out += HARD_SPACE; // 40 sin 60°, not 40sin 60°
        out += name;
        const next = src[peek()];
        if (next !== "(" && next !== "^") out += HARD_SPACE;
        else if (next === "^") out += ""; // remember to space after the exponent (sin² A)
      } else if (name in SYMBOLS) {
        out += SYMBOLS[name];
      } else {
        throw new Error(`unknown LaTeX command \\${name} in "${src}"`);
      }
    } else if (ch === "^") {
      i += 1;
      const raw = argument();
      const afterFunction = out.endsWith("");
      if (afterFunction) out = out.slice(0, -1);
      if (raw.trim() === "\\circ") out += "°";
      else {
        const inner = convert(raw).replace(/ /g, "");
        if (/[]/.test(inner)) throw new Error(`an exponent inside an exponent in "${src}"`);
        out += /^[−]?\d+$/.test(inner) ? [...inner].map((c) => SUPERSCRIPT[c]).join("") : `${SUP_OPEN}${inner.replace(//g, " ")}${SUP_CLOSE}`;
      }
      if (afterFunction && src[peek()] !== "(") out += HARD_SPACE;
    } else if (ch === "_") {
      throw new Error(`subscripts aren't handled yet ("${src}")`);
    } else if (ch === "{") {
      if (src.startsWith("{,}", i)) {
        out += THOUSANDS;
        i += 3;
      } else {
        out += convert(argument());
      }
    } else if (ch === "}") {
      throw new Error(`stray } in "${src}"`);
    } else {
      out += ch === "-" ? "−" : ch;
      i += 1;
    }
  }
  return out;
}

// One piece of math, without its dollar signs.
export function mathToPlain(latex) {
  return space(convert(latex)).replace(//g, ",").replace(//g, " ").replace(//g, "^{").replace(//g, "}").replace(//g, "");
}

// A whole text with math in it. `display: "line"` puts each $$…$$ on a line of its own (question
// stems); the default keeps it in the sentence (explanations).
export function latexToPlain(text, { display = "inline" } = {}) {
  let s = String(text ?? "").replace(/\\\$/g, DOLLAR);
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => (display === "line" ? `\n${mathToPlain(m)}\n` : ` ${mathToPlain(m)} `));
  s = s.replace(/\$([^$]+?)\$/g, (_, m) => mathToPlain(m));
  if (s.includes("$")) throw new Error(`unpaired $ in "${String(text).slice(0, 80)}"`);
  s = s.replace(//g, "$").replace(/\\%/g, "%");
  if (s.includes("\\")) throw new Error(`a backslash is left over in "${s.slice(0, 80)}"`);
  return s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/ ([,.;:?!)])/g, "$1").trim())
    .filter(Boolean)
    .join("\n");
}
