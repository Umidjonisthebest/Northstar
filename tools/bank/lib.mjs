// Shared helpers for reading the question-pack PDFs: per-page text items and drawn shapes in
// top-down page coordinates (points, origin at the top-left), grouping into lines, rendering.
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

export const PAGE_H = 792;
export const PAGE_W = 612;

export async function openPdf(file) {
  return getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
}

const mul = (m, t) => [m[0] * t[0] + m[2] * t[1], m[1] * t[0] + m[3] * t[1], m[0] * t[2] + m[2] * t[3], m[1] * t[2] + m[3] * t[3], m[0] * t[4] + m[2] * t[5] + m[4], m[1] * t[4] + m[3] * t[5] + m[5]];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// Text items: { s, x, y (baseline, from the top), w, h, font }. Empty strings are dropped.
// Shapes: every painted path's bounding box { x1, y1, x2, y2 } (top-down), plus image boxes.
export async function readPage(doc, pageNo) {
  const page = await doc.getPage(pageNo);
  const tc = await page.getTextContent();
  const items = [];
  for (const it of tc.items) {
    if (!it.str) continue;
    items.push({ s: it.str, x: it.transform[4], y: PAGE_H - it.transform[5], w: it.width, h: it.height, font: it.fontName });
  }
  const ops = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const shapes = [];
  let pending = null; // bbox of the path being built, waiting for its paint operator
  const box = (minMax, m) => {
    const pts = [apply(m, minMax[0], minMax[1]), apply(m, minMax[2], minMax[1]), apply(m, minMax[0], minMax[3]), apply(m, minMax[2], minMax[3])];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => PAGE_H - p[1]);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  };
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const a = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, a);
    else if (fn === OPS.constructPath) {
      const mm = a[2];
      if (mm && mm.length === 4 && mm.every(Number.isFinite)) pending = { ...box(mm, ctm), kind: 'path' };
    } else if (fn === OPS.fill || fn === OPS.eoFill || fn === OPS.stroke || fn === OPS.fillStroke || fn === OPS.eoFillStroke || fn === OPS.closeStroke || fn === OPS.closeFillStroke) {
      if (pending) shapes.push({ ...pending, paint: fn === OPS.stroke || fn === OPS.closeStroke ? 'stroke' : 'fill' });
      pending = null;
    } else if (fn === OPS.endPath || fn === OPS.clip || fn === OPS.eoClip) {
      if (fn === OPS.endPath) pending = null;
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
      shapes.push({ ...box([0, 0, 1, 1], ctm), kind: 'image', paint: 'image' });
    }
  }
  return { page, items, shapes };
}

// Groups items into lines (same baseline), left to right, and joins their text.
export function toLines(items, tol = 2.5) {
  const rows = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    let row = rows.find((r) => Math.abs(r.y - it.y) <= tol);
    if (!row) rows.push((row = { y: it.y, items: [] }));
    row.items.push(it);
  }
  rows.sort((a, b) => a.y - b.y);
  for (const r of rows) {
    r.items.sort((a, b) => a.x - b.x);
    r.x = r.items[0].x;
    r.x2 = Math.max(...r.items.map((it) => it.x + it.w));
    r.h = Math.max(...r.items.map((it) => it.h));
    r.text = joinItems(r.items);
  }
  return rows;
}

// Joins one line's items. A space goes in where there is a visible gap; ligature pieces ("fi")
// sit flush against their word and get none.
export function joinItems(items) {
  let out = '';
  let end = null;
  for (const it of items) {
    if (end !== null && it.x - end > 1.2 && !out.endsWith(' ') && !it.s.startsWith(' ')) out += ' ';
    out += it.s;
    end = it.x + it.w;
  }
  return out.replace(/\s+/g, ' ').trim();
}

export async function renderPage(page, scale) {
  const v = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(v.width), Math.ceil(v.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: v }).promise;
  return canvas;
}

// Bounding box of everything that isn't (near) white inside a canvas region, or null.
export function inkBox(canvas, x0, y0, x1, y1) {
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(canvas.width, Math.ceil(x1)); y1 = Math.min(canvas.height, Math.ceil(y1));
  if (x1 <= x0 || y1 <= y0) return null;
  const data = canvas.getContext('2d').getImageData(x0, y0, x1 - x0, y1 - y0).data;
  const w = x1 - x0;
  let minX = Infinity; let minY = Infinity; let maxX = -1; let maxY = -1;
  for (let y = 0; y < y1 - y0; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i] < 244 || data[i + 1] < 244 || data[i + 2] < 244) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x0: x0 + minX, y0: y0 + minY, x1: x0 + maxX + 1, y1: y0 + maxY + 1 };
}
