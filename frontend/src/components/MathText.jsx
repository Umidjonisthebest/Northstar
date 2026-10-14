import React from "react";
import { mathTree } from "./mathLayout.js";
import "./mathtext.css";

// Renders question text with light markup and no innerHTML, drawing the math in it the way it is
// written by hand: a/b as a stacked fraction, √(…) as a radical with a bar over its contents,
// x² / ^{…} as an exponent, _{…} as a subscript, plus **bold**. mathLayout.js decides what is
// what. Newlines are kept by CSS (white-space: pre-line) where it matters.

// Characters that are in the text but not in the drawing: the slash of a stacked fraction, a root
// sign that is drawn instead, brackets that are no longer needed, the ^{ } of an exponent. They
// stay in the page, so the page's text is the question's text character for character (the
// highlighter counts on that), copying gives back "(x − 2)/3", and a screen reader still has
// something to say.
const unseen = (text) => text && <span className="mx-unseen">{text}</span>;

function Fraction({ node }) {
  // ½ is one character of text, so its two numbers are drawn by CSS (data-n) and add no text.
  const part = (cls, children, brackets, digit) => (
    <span className={cls} data-n={node.raw ? digit : undefined}>
      {brackets && unseen("(")}
      {node.raw ? null : renderMath(children)}
      {brackets && unseen(")")}
    </span>
  );
  return (
    <span className={`mx-frac${node.mixed ? " mx-mixed" : ""}`}>
      {node.wrap && unseen("(")}
      {part("mx-num", node.num, node.numBrackets, node.num[0])}
      {unseen(node.raw || "/")}
      {part("mx-den", node.den, node.denBrackets, node.den[0])}
      {node.wrap && unseen(")")}
    </span>
  );
}

function Root({ node }) {
  return (
    <span className={`mx-root${node.index ? " mx-root-n" : ""}`} data-n={node.index || undefined}>
      {unseen(node.sign)}
      <svg className="mx-root-sign" viewBox="0 0 12 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M0.7 14.6 L2.7 13.3" />
        <path className="mx-root-down" d="M2.7 13.3 L5.7 23.2" />
        <path d="M5.7 23.2 L10.7 0 H12" />
      </svg>
      <span className="mx-root-body">
        {node.brackets && unseen("(")}
        {renderMath(node.children)}
        {node.brackets && unseen(")")}
      </span>
    </span>
  );
}

function Script({ node }) {
  const Tag = node.type;
  const mark = node.type === "sup" ? "^" : "_";
  const [open, close] = { braces: [`${mark}{`, "}"], brackets: [`${mark}(`, ")"], bare: [mark, ""], chars: ["", ""] }[node.form];
  return (
    <Tag className={`mx-${node.type}`}>
      {unseen(open)}
      {renderMath(node.children)}
      {unseen(close)}
    </Tag>
  );
}

// Draws a list of nodes from mathLayout.js (mathTree or mathLine).
export function renderMath(nodes) {
  return nodes.map((node, i) => {
    if (typeof node === "string") return node;
    if (node.type === "b") return <b key={i}>{renderMath(node.children)}</b>;
    if (node.type === "frac") return <Fraction key={i} node={node} />;
    if (node.type === "root") return <Root key={i} node={node} />;
    return <Script key={i} node={node} />;
  });
}

export function mathParts(text) {
  return renderMath(mathTree(text));
}

export default function MathText({ text, as: Tag = "span", className }) {
  return <Tag className={className}>{mathParts(text)}</Tag>;
}
