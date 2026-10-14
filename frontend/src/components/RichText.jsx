import React, { createElement } from "react";
import { mathParts } from "./MathText.jsx";
import "./mathtext.css";
import "./richtext.css";

// Draws the text of a practice-test question. The tests are written with a little mark-up
// (italic variables, exponents, stacked fractions, roots, tables, drawn figures), which the server
// reads once into a small tree (backend content/practiceTests.js). This draws that tree with the
// page's own elements, so nothing from the test files is ever put on the page as HTML. Fractions,
// roots and exponents use MathText's classes (mathtext.css), so they look like the rest of the
// app's math.
//
//   <RichText nodes={q.passage} />        blocks: p · src · label · eq · notes · table · fig · img
//   <RichInline nodes={q.options[0]} />   inline: text · i · u · sup · sub · frac · root · br · mx
// (A test made in the studio is typed as plain text: its pieces are "mx", and its pictures "img".)

// Characters that are in the text but not in the drawing (the slash of a stacked fraction, the
// root sign): they stay on the page for copying and for screen readers, as in MathText.
const unseen = (text) => <span className="mx-unseen">{text}</span>;

function inlineNode(node, key) {
  if (typeof node === "string") return node;
  const kids = () => inline(node.c);
  switch (node.t) {
    case "i":
      return <i key={key}>{kids()}</i>;
    case "u":
      return <u key={key}>{kids()}</u>;
    case "sup":
      return (
        <sup key={key} className="mx-sup">
          {kids()}
        </sup>
      );
    case "sub":
      return (
        <sub key={key} className="mx-sub">
          {kids()}
        </sub>
      );
    case "br":
      return <br key={key} />;
    // Plain text typed in the studio's test editor, with math in the app's own notation
    // ("x^2", "(x + 1)/2", "√(x + 4)"): drawn the way MathText draws every plain-text question.
    case "mx":
      return <React.Fragment key={key}>{mathParts(String(node.c ?? ""))}</React.Fragment>;
    case "frac":
      return (
        <span key={key} className="mx-frac">
          <span className="mx-num">{inline(node.n)}</span>
          {unseen("/")}
          <span className="mx-den">{inline(node.d)}</span>
        </span>
      );
    case "root":
      return (
        <span key={key} className="mx-root">
          {unseen("√")}
          <svg className="mx-root-sign" viewBox="0 0 12 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d="M0.7 14.6 L2.7 13.3" />
            <path className="mx-root-down" d="M2.7 13.3 L5.7 23.2" />
            <path d="M5.7 23.2 L10.7 0 H12" />
          </svg>
          <span className="mx-root-body">{kids()}</span>
        </span>
      );
    default:
      return null; // a kind this page doesn't know is left out, never guessed at
  }
}
const inline = (nodes) => (nodes || []).map(inlineNode);

// A figure's shapes. The server has already checked every shape and attribute; the lists are kept
// here as well, so this page never makes an element or sets an attribute just because data says so.
const SHAPES = new Set(["g", "line", "rect", "circle", "path", "polyline", "text", "tspan", "defs", "pattern"]);
const SHAPE_ATTRS = new Set([
  "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "width", "height", "d", "points", "id", "transform", "fill", "stroke",
  "fontSize", "fontStyle", "textAnchor", "strokeWidth", "strokeOpacity", "strokeDasharray", "patternUnits", "patternTransform"
]);
function shape(node, key) {
  if (typeof node === "string") return node;
  if (!SHAPES.has(node.e)) return null;
  const props = { key };
  for (const [name, value] of Object.entries(node.a || {})) {
    if (!SHAPE_ATTRS.has(name) || typeof value !== "string") continue;
    // A colour taken from the page's theme (the surface behind a label) is set as a style.
    if (value.startsWith("var(")) props.style = { ...props.style, [name]: value };
    else props[name] = value;
  }
  return createElement(node.e, props, ...(node.c || []).map(shape));
}

function Table({ node }) {
  const row = (cells, r) => (
    <tr key={r}>
      {cells.map((cell, c) => (cell.h ? <th key={c}>{inline(cell.c)}</th> : <td key={c}>{inline(cell.c)}</td>))}
    </tr>
  );
  return (
    <figure className="pl-table rt-table">
      {node.caption && <figcaption>{inline(node.caption)}</figcaption>}
      <div className="rt-table-scroll">
        <table>
          <thead>{node.head.map(row)}</thead>
          <tbody>{node.rows.map(row)}</tbody>
        </table>
      </div>
    </figure>
  );
}

function block(node, key) {
  switch (node.t) {
    case "p":
      return (
        <p key={key} className="rt-p">
          {inline(node.c)}
        </p>
      );
    case "src":
      return (
        <p key={key} className="rt-src">
          {inline(node.c)}
        </p>
      );
    case "label":
      return (
        <p key={key} className="rt-label">
          {inline(node.c)}
        </p>
      );
    case "eq":
      return (
        <div key={key} className="rt-eq">
          {inline(node.c)}
        </div>
      );
    case "notes":
      return (
        <ul key={key} className="rt-notes">
          {node.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>
      );
    case "table":
      return <Table key={key} node={node} />;
    // A picture a teacher added to a question in the studio. It arrives as a data URL (the server
    // checked it when the question was saved), and nothing else is ever put in an <img> here.
    case "img":
      return typeof node.src === "string" && node.src.startsWith("data:image/") ? (
        <figure key={key} className="rt-img">
          <img src={node.src} alt="" />
        </figure>
      ) : null;
    case "fig":
      return (
        <figure key={key} className="rt-fig" style={{ maxWidth: node.w }}>
          <svg viewBox={node.box} role="img" aria-label={node.label}>
            {(node.svg || []).map(shape)}
          </svg>
          {node.caption && <figcaption>{inline(node.caption)}</figcaption>}
        </figure>
      );
    default:
      return null;
  }
}

export default function RichText({ nodes, className = "" }) {
  return <div className={`rt ${className}`}>{(nodes || []).map(block)}</div>;
}

export function RichInline({ nodes, as: Tag = "span", className }) {
  return <Tag className={className}>{inline(nodes)}</Tag>;
}
