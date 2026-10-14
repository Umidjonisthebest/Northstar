import React, { Fragment } from "react";
import { mathLine } from "../../components/mathLayout.js";
import { renderMath } from "../../components/MathText.jsx";

// Renders passage or question text with highlights. Highlights are character
// ranges [start, end) into `text`, so they can be saved and restored: every
// rendered block carries data-base (its offset in `text`) and renders exactly
// its own characters, which lets a DOM selection map back to offsets.
//
// Passage conventions: "Text 1" / "Text 2" on their own line are labels,
// "• " lines are bullets, "______" is a blank, blank lines separate paragraphs.
// `underline` is one more range, [start, end): the part the question refers to as underlined.

const BLANK = /(_{4,})/;

function withBlanks(piece) {
  if (!BLANK.test(piece)) return piece;
  return piece.split(BLANK).map((part, i) =>
    BLANK.test(part) ? (
      <span key={i} className="pl-blank">
        {part}
      </span>
    ) : (
      part
    )
  );
}

// The line's math (fractions, roots, exponents: see components/mathLayout.js) with where each
// piece sits in it. MathText draws them without adding or dropping a character of text, so the
// offsets above still hold.
function laidOut(line) {
  let at = 0;
  return mathLine(line).map((node) => {
    const start = at;
    at += typeof node === "string" ? node.length : node.len;
    return { start, end: at, node };
  });
}

// The characters [a, b) of a laid-out line. A drawn piece is never cut (see `whole` below).
function draw(parts, a, b) {
  return parts
    .filter((p) => p.end > a && p.start < b)
    .map((p) => <Fragment key={p.start}>{typeof p.node === "string" ? withBlanks(p.node.slice(Math.max(a, p.start) - p.start, Math.min(b, p.end) - p.start)) : renderMath([p.node])}</Fragment>);
}

function segments(line, base, ranges, nova, underline) {
  const len = line.length;
  const parts = laidOut(line);
  const drawn = parts.filter((p) => typeof p.node !== "string");
  // A mark's place in this line. One that starts or ends inside a fraction, root or exponent takes
  // all of it: half a fraction can't be highlighted.
  const whole = (range) => {
    if (!range || range[1] <= base || range[0] >= base + len) return null;
    let from = Math.max(0, range[0] - base);
    let to = Math.min(len, range[1] - base);
    for (const p of drawn) {
      if (from > p.start && from < p.end) from = p.start;
      if (to > p.start && to < p.end) to = p.end;
    }
    return [from, to];
  };
  const marks = ranges.map((range) => ({ range, at: whole(range) })).filter((m) => m.at);
  const novaAt = whole(nova);
  const underAt = whole(underline);
  const covers = (at, a, b) => at && at[0] <= a && at[1] >= b;

  const cuts = new Set([0, len]);
  for (const at of [...marks.map((m) => m.at), novaAt, underAt]) {
    if (at) cuts.add(at[0]).add(at[1]);
  }
  const pts = [...cuts].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (a === b) continue;
    let node = draw(parts, a, b);
    // The part of the passage the question calls "underlined" (part of the question, not a mark
    // the student made, so it can't be removed).
    if (covers(underAt, a, b)) node = <u className="pl-under">{node}</u>;
    if (covers(novaAt, a, b)) {
      node = (
        <mark className="pl-nova" data-nova={nova[0] >= base && novaAt[0] === a ? "start" : "part"}>
          {node}
        </mark>
      );
    }
    const hl = marks.find((m) => covers(m.at, a, b));
    if (hl) {
      node = (
        <mark className="pl-hl" data-s={hl.range[0]} data-e={hl.range[1]}>
          {node}
        </mark>
      );
    }
    out.push(<Fragment key={a}>{node}</Fragment>);
  }
  return out;
}

export default function HighlightText({ text, ranges = [], nova = null, underline = null, className = "", inline = false }) {
  const lines = [];
  let pos = 0;
  for (const line of String(text || "").split("\n")) {
    lines.push({ line, base: pos });
    pos += line.length + 1;
  }
  if (inline) {
    return (
      <span className={className} data-base={0}>
        {segments(String(text || ""), 0, ranges, nova, underline)}
      </span>
    );
  }
  return (
    <div className={className}>
      {lines.map(({ line, base }) => {
        if (!line.trim()) return <div key={base} className="pl-gap" aria-hidden="true" />;
        const kind = /^Text \d+$/.test(line.trim()) ? "pl-textlabel" : line.startsWith("• ") ? "pl-bullet" : "pl-para";
        return (
          <p key={base} className={kind} data-base={base}>
            {segments(line, base, ranges, nova, underline)}
          </p>
        );
      })}
    </div>
  );
}

// The current selection inside `root`, as [start, end) offsets, or null.
export function selectionOffsets(root) {
  const sel = window.getSelection();
  if (!root || !sel || sel.isCollapsed || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.commonAncestorContainer)) return null;
  const blockOf = (node) => (node.nodeType === 1 ? node : node.parentElement)?.closest("[data-base]");
  const startBlock = blockOf(r.startContainer);
  const endBlock = blockOf(r.endContainer);
  if (!startBlock || !endBlock || !root.contains(startBlock) || !root.contains(endBlock)) return null;
  const offset = (block, node, off) => {
    const range = document.createRange();
    range.setStart(block, 0);
    range.setEnd(node, off);
    return Number(block.dataset.base) + range.toString().length;
  };
  const s = offset(startBlock, r.startContainer, r.startOffset);
  const e = offset(endBlock, r.endContainer, r.endOffset);
  return e > s ? [s, e] : null;
}

// Add a range, merging anything it overlaps.
export function addRange(ranges, [s, e]) {
  let start = s;
  let end = e;
  const keep = [];
  for (const [a, b] of ranges) {
    if (b < start || a > end) keep.push([a, b]);
    else {
      start = Math.min(start, a);
      end = Math.max(end, b);
    }
  }
  return [...keep, [start, end]].sort((x, y) => x[0] - y[0]);
}
