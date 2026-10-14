// Reads the question-pack PDFs and writes raw question records plus cropped pictures.
//   Reading & Writing: real text (passage, question, options, explanation), a picture only for a
//     graph or table, and the underlined part of the passage as a character range.
//   Math: a picture of the question and a picture of its explanation (the equations in these PDFs
//     are drawings, not text), with the answer key read from the text.
// Usage: node extract.mjs <pdfDir> <manifest.json> <outDir> [only=<file.pdf>]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { PAGE_H, PAGE_W, inkBox, joinItems, openPdf, readPage, renderPage, toLines } from './lib.mjs';

const [pdfDir, manifestPath, outDir, ...rest] = process.argv.slice(2);
const only = rest.find((a) => a.startsWith('only='))?.slice(5);
const indexDir = rest.find((a) => a.startsWith('index='))?.slice(6);

// The earlier version of the pack came with an index (one row per question: type, correct answer,
// file, page). It is used to check every answer read here, and to supply the answer for the older
// student-produced-response items, whose pages have no "Correct Answer" line.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, ''), r[i]])));
}
const index = new Map();
if (indexDir) {
  for (const f of ['rw_index.csv', 'math_index.csv']) {
    for (const r of parseCsv(fs.readFileSync(path.join(indexDir, f), 'utf8'))) index.set(`${r.File}|${r['Page in file']}`, { type: r.Type, answer: r['Correct answer'], source: r.Source });
  }
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^﻿/, ''));
const mediaDir = path.join(outDir, 'media');
fs.mkdirSync(mediaDir, { recursive: true });

// Pictures are shown at up to 1.5 times their size on the page (so their print matches the app's
// text), which makes this about 1.3 device pixels per CSS pixel: sharp on an ordinary screen and
// still clean on a phone, at about 40 MB for the whole pack.
const SCALE = 2;
const NUL = '\u0000';
const LEVELS = { '1 Easy': 'Easy', '2 Medium': 'Medium', '3 Hard': 'Hard', '4 Challenging': 'Challenging' };
const SKILL_MAP = {
  'Systems of two linear equations in two variables': 'Systems of linear equations',
  'Linear inequalities in one or two variables': 'Linear inequalities',
  'Nonlinear equations in one variable and systems of equations in two variables': 'Nonlinear equations and systems',
  'Ratios, rates, proportional relationships, and units': 'Ratios, rates, and units',
  'One-variable data - Distributions and measures of center and spread': 'One-variable data',
  'Two-variable data - Models and scatterplots': 'Two-variable data',
  'Probability and conditional probability': 'Probability',
  'Inference from sample statistics and margin of error': 'Sample statistics and margin of error',
  'Evaluating statistical claims - Observational studies and experiments': 'Studies and experiments'
};
const stripNo = (s) => s.replace(/^\d+(\.\d+)?\s+/, '');

const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex');
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---------- Pictures ----------
// Cuts the vertical range [gy1, gy2) out of a question (which may run over several pages), trims
// the white around it and stacks the page slices. Returns { src, w, h } or null when it is empty.
async function cropRegion(q, gy1, gy2, canvases) {
  const slices = [];
  for (let k = 0; k < q.pages.length; k++) {
    const top = Math.max(gy1, k * PAGE_H);
    const bottom = Math.min(gy2, (k + 1) * PAGE_H);
    if (bottom - top < 1) continue;
    if (!canvases[k]) canvases[k] = await renderPage(q.pages[k].page, SCALE);
    const box = inkBox(canvases[k], 0, (top - k * PAGE_H) * SCALE, PAGE_W * SCALE, (bottom - k * PAGE_H) * SCALE);
    if (box) slices.push({ canvas: canvases[k], ...box });
  }
  if (!slices.length) return null;
  const pad = 10;
  const gap = 16;
  const x0 = Math.min(...slices.map((s) => s.x0));
  const x1 = Math.max(...slices.map((s) => s.x1));
  const w = x1 - x0 + pad * 2;
  const h = slices.reduce((s, c) => s + (c.y1 - c.y0), 0) + gap * (slices.length - 1) + pad * 2;
  const out = createCanvas(w, h);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  let y = pad;
  for (const s of slices) {
    ctx.drawImage(s.canvas, x0, s.y0, x1 - x0, s.y1 - s.y0, pad, y, x1 - x0, s.y1 - s.y0);
    y += s.y1 - s.y0 + gap;
  }
  const buf = out.toBuffer('image/webp', 58);
  const name = `${sha(buf).slice(0, 16)}.webp`;
  fs.writeFileSync(path.join(mediaDir, name), buf);
  // Shown at half size, so it stays sharp on high-density screens.
  return { src: name, w: Math.round(w / SCALE), h: Math.round(h / SCALE), bytes: buf.length };
}

// ---------- Text ----------
const isOptionStart = (line) => line.x > 18.5 && line.x < 21 && /^[A-D]\.(\s|$)/.test(line.text);

// Splits lines into paragraphs where the vertical gap is wider than normal leading.
function paragraphs(lines, gap = 21.5) {
  const out = [];
  for (const l of lines) {
    const prev = out.at(-1)?.at(-1);
    if (!prev || l.y - prev.y > gap) out.push([l]);
    else out.at(-1).push(l);
  }
  return out;
}

// Joins a paragraph's lines into text. Lines that stop well short of the right margin while more
// follow are verse or a list, and keep their line breaks. `track` collects each item's offset.
function paragraphText(lines, track, base, hard = false) {
  let out = '';
  lines.forEach((l, i) => {
    if (i > 0) out += hard || lines[i - 1].x2 < 400 ? '\n' : ' ';
    let end = null;
    for (const it of l.items) {
      if (end !== null && it.x - end > 1.2 && !out.endsWith(' ') && !it.s.startsWith(' ')) out += ' ';
      if (track) track.push({ it, line: l, start: base + out.length, len: it.s.length });
      out += it.s;
      end = it.x + it.w;
    }
  });
  return out;
}

// Which character of a text item sits `dx` points from its left edge. The item's real glyph widths
// aren't available, so they are estimated with a similar sans-serif font and scaled to its width.
const measure = createCanvas(10, 10).getContext('2d');
measure.font = '20px Arial';
function charAt(it, dx) {
  const total = measure.measureText(it.s).width || 1;
  let best = 0;
  let bestGap = Infinity;
  for (let i = 0; i <= it.s.length; i++) {
    const gap = Math.abs((measure.measureText(it.s.slice(0, i)).width / total) * it.w - dx);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  return best;
}

function parseAnswer(lines, from, to) {
  const line = lines.find((l) => l.y > from && l.y < to && /^Correct Answer/.test(l.text));
  return line ? line.text.replace(/^Correct Answer:?\s*/, '').trim() : null;
}

// ---------- One question ----------
async function extractQuestion(q, meta) {
  const canvases = [];
  const items = q.pages.flatMap((p, k) => p.items.map((it) => ({ ...it, y: it.y + k * PAGE_H })));
  const shapes = q.pages.flatMap((p, k) => p.shapes.map((s) => ({ ...s, y1: s.y1 + k * PAGE_H, y2: s.y2 + k * PAGE_H })));
  const heading = (word) => items.find((it) => it.s === word && near(it.h, 12, 0.6) && near(it.x, 52.5, 3));
  const qHead = heading('Question');
  const aHead = heading('Answer');
  if (!qHead || !aHead) return { error: 'no Question/Answer heading' };
  const bars = shapes.filter((s) => near(s.y2 - s.y1, 27, 1) && near(s.x1, 15, 1));
  const barAt = (y) => bars.find((b) => b.y1 - 1 <= y && b.y2 + 1 >= y) || { y1: y - 17.3, y2: y + 9.7 };
  const contentTop = barAt(qHead.y).y2;
  const contentBottom = barAt(aHead.y).y1;
  const answerTop = barAt(aHead.y).y2;

  const allLines = toLines(items);
  const rationaleLabel = allLines.find((l) => l.y > answerTop && near(l.x, 15, 1) && l.text === 'Rationale');
  const endLine = allLines.find((l) => l.y > answerTop && /^Question Dif/.test(l.text));
  if (!rationaleLabel || !endLine) return { error: 'no Rationale / end line' };
  let answer = parseAnswer(allLines, answerTop - 2, answerTop + 60);
  const known = meta.indexRow?.answer && !/^See explanation/.test(meta.indexRow.answer) ? meta.indexRow : null;
  if (!answer && known) answer = known.answer; // older items: the key is only in the index
  let needsAnswer = false;
  if (!answer) {
    // Older items with no answer line at all: the key is the first sentence of the explanation.
    const said = toLines(items.filter((it) => it.y > rationaleLabel.y + 5 && it.y < endLine.y - 6)).map((l) => l.text).join(' ');
    const choice = said.match(/Choice ([A-D]) is (?:the )?(?:correct|best)/);
    const value = said.match(/The correct answer is (?:either )?(.+?)\.(?:\s|$)/);
    const parts = value ? value[1].split(/\s*(?:,|\bor\b|\band\b)\s*/).filter(Boolean) : [];
    if (choice) answer = choice[1];
    else if (parts.length && parts.every((p) => /^-?\d*\.?\d+(\/\d+)?$/.test(p))) answer = parts.join(', ');
    else {
      answer = '?';
      needsAnswer = true;
    }
  }
  if (known && known.answer !== answer) return { error: `answer "${answer}" but the pack's index says "${known.answer}"` };
  const rationaleTop = rationaleLabel.y + 5;
  const rationaleBottom = endLine.y - 11;

  const content = items.filter((it) => it.y > contentTop && it.y < contentBottom);
  if (meta.section !== 'Math') {
    // A raised number (the 13 in carbon-13's symbol) comes out as its own little line above the
    // text. Put it back on the line it belongs to, as superscript characters.
    const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    for (const it of content) {
      if (!(it.h > 13 && /^\d{1,3}$/.test(it.s.trim()))) continue;
      const host = content.find((o) => o !== it && near(o.h, 10.5, 0.4) && o.y - it.y > 4 && o.y - it.y < 10 && o.x + o.w <= it.x + 2 && it.x - (o.x + o.w) < 4);
      if (!host) continue;
      it.s = [...it.s.trim()].map((c) => SUP[c]).join('');
      it.y = host.y;
      it.h = host.h;
      it.w *= 0.62;
    }
  }
  const lines = toLines(content);
  const optionStarts = lines.filter(isOptionStart);
  const letters = optionStarts.map((l) => l.text[0]).join('');
  const base = { ...meta };

  if (meta.section === 'Math') {
    const isMcq = letters === 'ABCD';
    const labels = optionStarts;
    const listed = meta.indexRow?.type;
    if (listed && (listed === 'Multiple choice') !== isMcq) return { error: `type: found ${isMcq ? 'A–D options' : `"${letters}"`} but the pack's index says ${listed}` };
    const promptImage = await cropRegion(q, contentTop + 1, contentBottom - 1, canvases);
    const explanationImage = await cropRegion(q, rationaleTop, rationaleBottom, canvases);
    if (!promptImage) return { error: 'empty question picture' };
    const rec = { ...base, type: isMcq ? 'mcq' : 'grid_in', promptImage, explanationImage, answerRaw: answer };
    if (needsAnswer) rec.needsAnswer = true;
    else if (isMcq) {
      if (!/^[A-D]$/.test(answer)) return { error: `mcq answer "${answer}"` };
      rec.correctIndex = 'ABCD'.indexOf(answer);
    } else {
      if (/^[A-D]$/.test(answer)) return { error: `letter answer ${answer} but no A–D labels (${labels.length})` };
      rec.accepted = answer.split(/\s*,\s*/).filter(Boolean);
    }
    return { rec };
  }

  // ----- Reading & Writing -----
  if (letters !== 'ABCD') return { error: `options found: "${letters}"` };
  if (!/^[A-D]$/.test(answer)) return { error: `answer "${answer}"` };
  const firstOptionY = optionStarts[0].y;
  const region = shapes.filter((s) => s.y1 >= contentTop - 1 && s.y2 <= contentBottom + 1 && !(s.x2 - s.x1 > 480 && s.y2 - s.y1 > 200));
  const bullets = region.filter((s) => s.x2 - s.x1 < 1.5 && s.y2 - s.y1 < 1.5);
  const thin = region.filter((s) => s.y2 - s.y1 <= 1.3 && s.x2 - s.x1 > 2.5 && s.paint === 'fill');
  const solid = region.filter((s) => !bullets.includes(s) && !thin.includes(s));
  const bigText = lines.filter((l) => l.h > 11.4 && l.y < firstOptionY);
  let figBottom = null;
  if (solid.length || bigText.length) {
    figBottom = Math.max(...solid.map((s) => s.y2), ...bigText.map((l) => l.y + 3));
    if (figBottom > firstOptionY - 20) return { error: 'figure reaches the options' };
  }
  const textLines = lines.filter((l) => (figBottom === null || l.y - l.h * 0.7 > figBottom) && l.y < firstOptionY - 4);
  const paras = paragraphs(textLines);
  if (paras.length < 1) return { error: 'no question text' };
  const stemLines = paras.pop();
  const prompt = paragraphText(stemLines).replace(/\s+/g, ' ').trim();

  // Passage, keeping where every item lands so underlines can be mapped to characters.
  const track = [];
  let passage = '';
  for (const para of paras) {
    const isBullet = (l) => l.x > 40 && bullets.some((b) => near(b.y1, l.y - 3, 2.2) && b.x1 < l.x);
    const listLike = para.some((l) => l.x > 40) && bullets.length > 0;
    if (listLike) {
      // A list: each bullet dot starts an entry; lines without one continue the entry above.
      let entry = [];
      const flush = () => {
        if (!entry.length) return;
        if (passage) passage += '\n';
        passage += '• ';
        passage += paragraphText(entry, track, passage.length);
        entry = [];
      };
      for (const l of para) {
        if (isBullet(l)) flush();
        else if (!entry.length && l.x < 40) {
          // An ordinary line sitting in the same block as the list (its lead-in).
          if (passage) passage += '\n\n';
          passage += paragraphText([l], track, passage.length);
          continue;
        }
        entry.push(l);
      }
      flush();
      continue;
    }
    const label = para.length === 1 && /^Text [12]$/.test(para[0].text);
    if (passage) passage += /(^|\n)Text [12]$/.test(passage) ? '\n' : /\n• [^\n]*$/.test(passage) || label || true ? '\n\n' : '\n\n';
    passage += paragraphText(para, track, passage.length);
  }
  // Notes lists: the lead-in line and the entries read as one block.
  passage = passage.replace(/notes:\n\n• /g, 'notes:\n• ');

  // Underlines: thin filled bars just under a passage line.
  let underline = null;
  let underlineAt = -1;
  const marks =thin.filter((s) => (figBottom === null || s.y1 > figBottom + 1) && s.y1 < firstOptionY);
  if (marks.length && track.length) {
    let lo = Infinity;
    let hi = -1;
    for (const m of marks) {
      for (const t of track) {
        if (!(m.y1 >= t.line.y - 0.5 && m.y1 <= t.line.y + 3.2)) continue;
        const a = Math.max(m.x1, t.it.x);
        const b = Math.min(m.x2, t.it.x + t.it.w);
        if (b - a < 1) continue;
        const from = a <= t.it.x + 0.6 ? 0 : charAt(t.it, a - t.it.x);
        const to = b >= t.it.x + t.it.w - 0.6 ? t.len : charAt(t.it, b - t.it.x);
        lo = Math.min(lo, t.start + from);
        hi = Math.max(hi, t.start + to);
      }
    }
    if (hi > lo) {
      // The measured position can be a character off, so settle on the nearest edge of a word.
      const edge = (i) => i <= 0 || i >= passage.length || /[\s—]/.test(passage[i - 1]) !== /[\s—]/.test(passage[i]);
      const snap = (i) => {
        for (let d = 0; d <= 2; d++) {
          if (edge(i - d)) return i - d;
          if (edge(i + d)) return i + d;
        }
        return i;
      };
      let from = snap(lo);
      let to = snap(hi);
      while (from < to && /\s/.test(passage[from])) from += 1;
      while (to > from && /\s/.test(passage[to - 1])) to -= 1;
      underline = passage.slice(from, to);
      underlineAt = from;
    }
  }

  const options = optionStarts.map((start, i) => {
    const next = optionStarts[i + 1]?.y ?? contentBottom;
    const own = lines.filter((l) => l.y >= start.y - 0.5 && l.y < next - 4);
    return paragraphText(own).replace(/^[A-D]\.\s*/, '').replace(/\s+/g, ' ').trim();
  });

  const ratLines = toLines(items.filter((it) => it.y > rationaleTop && it.y < endLine.y - 6));
  const explanation = paragraphs(ratLines).map((p) => paragraphText(p).replace(/[ \t]+/g, ' ').trim()).join('\n\n');

  const lead = passage.length - passage.trimStart().length;
  const rec = { ...base, type: 'mcq', passage: passage.trim(), prompt, options, correctIndex: 'ABCD'.indexOf(answer), explanation };
  if (underline) {
    rec.underline = underline;
    rec.underlineAt = underlineAt - lead;
  }
  if (figBottom !== null) {
    // Stop short of the first line of text under the figure.
    const nextTop = Math.min(...textLines.concat(stemLines).map((l) => l.y - l.h * 0.85));
    rec.image = await cropRegion(q, contentTop + 1, Math.min(figBottom + 2.5, nextTop - 0.5), canvases);
    if (!rec.image) return { error: 'empty figure picture' };
  }
  const flags = [];
  if (!rec.passage) flags.push('no passage');
  if (options.some((o) => !o)) flags.push('empty option');
  if (new Set(options).size !== 4) flags.push('duplicate options');
  if (/underlined/.test(prompt) !== Boolean(underline)) flags.push(underline ? 'underline without mention' : 'underline not found');
  if (/\b(graph|table|figure|chart)\b/i.test(prompt) !== (figBottom !== null)) flags.push(figBottom !== null ? 'figure without mention' : 'figure not found');
  if (!explanation) flags.push('no explanation');
  if (flags.length) rec.flags = flags;
  return { rec };
}

// A whole question as one picture, for the few that can't be read as text.
async function pictureFallback(q, meta) {
  const items = q.pages.flatMap((p, k) => p.items.map((it) => ({ ...it, y: it.y + k * PAGE_H })));
  const shapes = q.pages.flatMap((p, k) => p.shapes.map((s) => ({ ...s, y1: s.y1 + k * PAGE_H, y2: s.y2 + k * PAGE_H })));
  const heading = (word) => items.find((it) => it.s === word && near(it.h, 12, 0.6) && near(it.x, 52.5, 3));
  const qHead = heading('Question');
  const aHead = heading('Answer');
  if (!qHead || !aHead) return null;
  const bars = shapes.filter((s) => near(s.y2 - s.y1, 27, 1) && near(s.x1, 15, 1));
  const barAt = (y) => bars.find((b) => b.y1 - 1 <= y && b.y2 + 1 >= y) || { y1: y - 17.3, y2: y + 9.7 };
  const lines = toLines(items);
  const answer = parseAnswer(lines, barAt(aHead.y).y2 - 2, barAt(aHead.y).y2 + 60);
  const rationaleLabel = lines.find((l) => l.y > aHead.y && l.text === 'Rationale');
  const endLine = lines.find((l) => l.y > aHead.y && /^Question Dif/.test(l.text));
  if (!answer || !/^[A-D]$/.test(answer) || !rationaleLabel || !endLine) return null;
  const canvases = [];
  const promptImage = await cropRegion(q, barAt(qHead.y).y2 + 1, barAt(aHead.y).y1 - 1, canvases);
  const explanationImage = await cropRegion(q, rationaleLabel.y + 5, endLine.y - 11, canvases);
  if (!promptImage) return null;
  return { ...meta, type: 'mcq', promptImage, explanationImage, correctIndex: 'ABCD'.indexOf(answer), answerRaw: answer, fallback: true };
}

// ---------- All files ----------
const out = [];
const problems = [];
const stats = {};
const sectionOnly = rest.find((a) => a.startsWith('section='))?.slice(8);
for (const m of manifest) {
  if (only && m.file !== only) continue;
  if (sectionOnly && m.section !== sectionOnly) continue;
  const parts = m.path.split('/');
  const level = LEVELS[parts.at(-1).replace(/\.pdf$/, '')];
  const skillName = stripNo(parts.at(-2));
  const meta = { section: m.section === 'rw' ? 'Reading & Writing' : 'Math', domain: stripNo(parts.at(-3)), topic: SKILL_MAP[skillName] || skillName, difficulty: level, file: m.file };
  const doc = await openPdf(path.join(pdfDir, m.file));
  const questions = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await readPage(doc, n);
    const isStart = pg.items.some((it) => it.s === 'Assessment' && it.y < 90);
    if (isStart) questions.push({ pages: [], firstPage: n });
    if (!questions.length) continue;
    questions.at(-1).pages.push(pg);
  }
  let kept = 0;
  for (const [i, q] of questions.entries()) {
    const head = toLines(q.pages[0].items.filter((it) => it.y < 150)).map((l) => l.text).join(' ');
    if (/Northstar original|SAT practice/.test(head)) continue; // the owner's own questions are already in the bank
    const ref = `${m.file} p${q.firstPage}`;
    const indexRow = index.get(`${m.path.split('/').slice(1).join('/')}|${q.firstPage}`) || null;
    if (index.size && !indexRow) problems.push(`${ref}: not in the pack's index`);
    let res;
    try {
      res = await extractQuestion(q, { ...meta, n: i + 1, page: q.firstPage, indexRow });
    } catch (e) {
      res = { error: `threw ${e.message}` };
    }
    if (res.error && meta.section !== 'Math') {
      const fb = await pictureFallback(q, { ...meta, n: i + 1, page: q.firstPage, indexRow });
      if (fb) {
        problems.push(`${ref}: ${res.error} -> stored as a picture`);
        res = { rec: fb };
      }
    }
    if (res.error) {
      problems.push(`${ref}: ${res.error} -> SKIPPED`);
      continue;
    }
    if (res.rec.flags) problems.push(`${ref}: flags ${res.rec.flags.join(', ')}`);
    out.push(res.rec);
    kept++;
  }
  stats[m.file] = { path: m.path, questions: questions.length, kept };
  console.log(`${m.file}  ${String(kept).padStart(3)}/${String(questions.length).padEnd(3)} ${meta.topic} / ${level}`);
  await doc.destroy();
}
const tag = only ? `-${only}` : sectionOnly ? `-${sectionOnly}` : '';
fs.writeFileSync(path.join(outDir, `raw${tag}.json`), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(outDir, `problems${tag}.txt`), problems.join('\n'));
console.log(`\n${out.length} questions written. ${problems.length} notes (see problems.txt).`);
