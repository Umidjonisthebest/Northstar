import { Fragment, createElement, useMemo } from "react";

// Renders stored editor HTML as React elements through a tag whitelist (no
// dangerouslySetInnerHTML), replacing blank placeholders and heading slots
// with interactive components supplied by the caller.

const ALLOWED = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "strike", "ol", "ul", "li", "h1", "h2", "h3", "h4",
  "blockquote", "pre", "code", "span", "div", "sub", "sup", "table", "thead", "tbody", "tr", "td", "th", "hr", "img"
]);
const RENAME = { b: "strong", i: "em", strike: "s" };
const VOID = new Set(["br", "hr", "img"]);
const NO_TEXT_CHILDREN = new Set(["ul", "ol", "table", "thead", "tbody", "tr"]);

function cleanText(text) {
  return text.replace(/ /g, " ").replace(/﻿/g, "");
}

function classesOf(el) {
  const keep = [...el.classList].filter((c) => c.startsWith("ql-") && c !== "ql-blank" && c !== "ql-heading-slot");
  return keep.length ? keep.join(" ") : undefined;
}

function convert(node, ctx, key) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parentTag = node.parentNode?.nodeName?.toLowerCase();
    if (!node.textContent.trim() && (NO_TEXT_CHILDREN.has(parentTag) || node.textContent.includes("\n"))) return null;
    return cleanText(node.textContent);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node;
  const tag = el.nodeName.toLowerCase();

  if (el.classList.contains("ql-blank")) {
    const id = el.getAttribute("data-id");
    return <Fragment key={key}>{ctx.renderBlank ? ctx.renderBlank(id) : <span className="ie-rich-blank">______</span>}</Fragment>;
  }
  if (el.classList.contains("ql-heading-slot")) {
    const id = el.getAttribute("data-id");
    return <Fragment key={key}>{ctx.renderHeadingSlot ? ctx.renderHeadingSlot(id) : null}</Fragment>;
  }
  if (tag === "a") return <span key={key}>{convertChildren(el, ctx)}</span>;
  if (!ALLOWED.has(tag)) return <Fragment key={key}>{convertChildren(el, ctx)}</Fragment>;

  const props = { key, className: classesOf(el) };
  if (tag === "li" && el.getAttribute("data-list")) props["data-list"] = el.getAttribute("data-list");
  if (tag === "img") {
    const src = el.getAttribute("src") || "";
    if (!/^(\/|https?:)/.test(src)) return null;
    return <img key={key} src={src} alt={el.getAttribute("alt") || ""} className="ie-rich-img" />;
  }
  if ((tag === "td" || tag === "th") && el.getAttribute("colspan")) props.colSpan = Number(el.getAttribute("colspan")) || undefined;
  const name = RENAME[tag] || tag;
  if (VOID.has(tag)) return createElement(name, props);
  return createElement(name, props, convertChildren(el, ctx));
}

function convertChildren(el, ctx) {
  const out = [];
  el.childNodes.forEach((child, i) => {
    const r = convert(child, ctx, i);
    if (r !== null && r !== "") out.push(r);
  });
  return out.length ? out : null;
}

export function parseHtml(html) {
  return new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html").body;
}

export function RichHtml({ html, renderBlank, renderHeadingSlot, className = "", as = "div", style }) {
  const body = useMemo(() => parseHtml(html), [html]);
  const children = convertChildren(body, { renderBlank, renderHeadingSlot });
  return createElement(as, { className: `ie-rich ${className}`, style }, children);
}

export function htmlToText(html) {
  return cleanText(parseHtml(html).textContent || "").replace(/\s+/g, " ").trim();
}

export function isHtmlEmpty(html) {
  if (!html) return true;
  if (/ql-blank|ql-heading-slot|<img/i.test(html)) return false;
  return htmlToText(html) === "";
}
