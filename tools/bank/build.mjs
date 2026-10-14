// Turns the converter's raw records into the app's question format and copies the pictures in.
// Usage: node build.mjs <rawDir> <backendDir> [check]      ("check" writes nothing into the app)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [rawDir, backendDir, mode] = process.argv.slice(2);
const read = (f) => JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'));
const rw = read('raw-rw.json');
const math = read('raw.json').filter((q) => q.section === 'Math');
const manifest = JSON.parse(fs.readFileSync(path.join(rawDir, '..', 'pdfs_manifest.json'), 'utf8').replace(/^﻿/, ''));
const pathOf = Object.fromEntries(manifest.map((m) => [m.file, m.path]));
const SOURCE = 'college-board';
const NUL = '\u0000';
const notes = [];

// ---------- Fixes made by hand ----------
// Seven older student-produced-response items print their answer only as drawn math inside the
// explanation; these were read from the explanation pictures.
const HAND_ANSWERS = {
  'math_042.pdf|11': ['10/3', '15/4', '25/6', '3.333', '3.75', '4.166', '4.167'],
  'math_054.pdf|14': ['1/6', '.1666', '.1667', '0.166', '0.167'],
  'math_070.pdf|1': ['3/2', '1.5'],
  'math_070.pdf|12': ['1/2', '.5'],
  'math_083.pdf|16': ['1/5', '.2'],
  'math_089.pdf|1': ['5/7', '.7142', '.7143', '0.714'],
  'math_089.pdf|3': ['1/3', '.3333', '0.333']
};
// One question asks about "the underlined claim" but its PDF page has no underline. The claim is
// placed from the explanation ("the idea that the person who made the notches was counting").
const HAND_UNDERLINES = { 'rw_040.pdf|74': 'this artifact may be a sign that Neanderthals also recorded numerical information' };

// ---------- Ligatures in the explanations ----------
// The explanation font loses "fi" and "fl" (they come out as one empty character). The question
// font doesn't, so the words of the questions themselves are the first dictionary.
const vocab = new Set();
for (const q of rw) for (const w of `${q.passage} ${q.prompt} ${q.options.join(' ')}`.toLowerCase().match(/[a-z]+/g) || []) vocab.add(w);
// When the dictionary can't decide: letter runs that only exist with "fl" (written here the way
// the wrong, "fi" reading would spell them: "fiow" for flow, "refiect" for reflect).
const FL = /fii|fiu|fiy|fio(?!rd)|fiat|fiag|fiam|fiash|fiaw|fiav|fiank|fiap|fiare|fiak|fiair|fiee|fiesh|fiew|fiex|fiect|fiess|^fied$|(^|[^a-z])(ri|sti|tri)fie|(ba|shu|mu|ru|wa|ra|scu|snu|sni)ffie/;
const guessed = new Map();
function repairWord(word) {
  let out = word;
  while (out.includes(NUL)) {
    const at = out.indexOf(NUL);
    const cand = ['fi', 'fl'].map((lig) => out.slice(0, at) + lig + out.slice(at + 1));
    const bare = cand.map((c) => c.replace(new RegExp(NUL, 'g'), 'fi').toLowerCase().replace(/[^a-z]/g, ''));
    const known = bare.map((b) => vocab.has(b) || vocab.has(b.replace(/(s|es|ed|ing|ly|d)$/, '')));
    let pick;
    if (known[0] !== known[1]) pick = known[0] ? 0 : 1;
    else {
      // Only the letters around this ligature decide, so a second one later in the word can't mislead.
      const around = (out.slice(Math.max(0, at - 6), at) + 'fi' + out.slice(at + 1, at + 6)).split(NUL)[0].toLowerCase().replace(/[^a-z]/g, '');
      pick = FL.test(around) ? 1 : 0;
    }
    out = cand[pick];
  }
  const final = out.toLowerCase().replace(/[^a-z]/g, '');
  if (!vocab.has(final)) guessed.set(final, (guessed.get(final) || 0) + 1);
  return out;
}
const repair = (text) => text.replace(/[A-Za-z’'\-]*\u0000[A-Za-z’'\-\u0000]*/g, repairWord).replace(/\u0000/g, 'fi');

// ---------- Text tidying ----------
const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const tidy = (s) => s.replace(new RegExp(`([${SUPS}]+) (?=[A-Za-z])`, 'g'), '$1').replace(new RegExp(`\\( ([${SUPS}])`, 'g'), '($1').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();

// "Choice B is the best answer… Choice A is incorrect…" -> one piece per option, when every option
// is covered. Pieces that speak for two options ("Choices A and C are incorrect…") go to both.
function splitRationales(text) {
  const marker = /Choices? ([A-D])(?:(?:, ([A-D]))?,? and ([A-D]))? (?:is|are)\b/g;
  const marks = [...text.matchAll(marker)].map((m) => ({ at: m.index, letters: [m[1], m[2], m[3]].filter(Boolean) }));
  if (!marks.length) return null;
  const parts = [[], [], [], []];
  marks.forEach((m, i) => {
    const piece = text.slice(i === 0 ? 0 : m.at, marks[i + 1]?.at ?? text.length).trim();
    for (const l of m.letters) parts['ABCD'.indexOf(l)].push(piece);
  });
  return parts.every((p) => p.length) ? parts.map((p) => p.join('\n\n')) : null;
}

const shortTitle = (text) => {
  const flat = text.replace(/^Text 1\n/, '').replace(/^While researching a topic, a student has taken the following notes:\n• /, '').replace(/\s+/g, ' ').replace(/_{3,}/g, '…').trim();
  if (flat.length <= 58) return flat;
  const cut = flat.slice(0, 58);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:—-]+$/, '')}…`;
};
const keyOf = (q) => `qb-${crypto.createHash('sha1').update(`${pathOf[q.file]}|${q.page}`).digest('hex').slice(0, 12)}`;
const picture = (p) => (p ? { src: p.src, w: p.w, h: p.h } : undefined);

const out = [];
const media = new Set();
const seen = new Map();

// ---------- Reading & Writing ----------
for (const q of rw) {
  const ref = `${q.file}|${q.page}`;
  const passage = tidy(q.passage);
  const explanationFull = tidy(repair(q.explanation || ''));
  const rationales = splitRationales(explanationFull);
  const rec = {
    key: keyOf(q),
    source: SOURCE,
    section: q.section,
    domain: q.domain,
    topic: q.topic,
    difficulty: q.difficulty,
    type: 'mcq',
    title: shortTitle(passage || q.prompt),
    passage,
    prompt: tidy(q.prompt),
    options: q.options.map(tidy),
    correctIndex: q.correctIndex,
    // With a piece for every option, the overall explanation is the piece for the right one.
    explanation: rationales ? rationales[q.correctIndex] : explanationFull
  };
  if (rationales) rec.rationales = rationales;
  else notes.push(`${ref}: explanation not split by option`);
  const under = HAND_UNDERLINES[ref] || q.underline;
  if (under) {
    let at = HAND_UNDERLINES[ref] ? passage.indexOf(under) : q.underlineAt;
    if (passage.slice(at, at + under.length) !== under) {
      // Tidying moved the text a little: take the occurrence nearest to where it was.
      let best = -1;
      for (let i = passage.indexOf(under); i >= 0; i = passage.indexOf(under, i + 1)) if (best < 0 || Math.abs(i - at) < Math.abs(best - at)) best = i;
      at = best;
    }
    if (at >= 0) rec.underline = [at, at + under.length];
    else notes.push(`${ref}: underline lost ("${under.slice(0, 40)}")`);
  }
  if (q.image) {
    rec.image = picture(q.image);
    media.add(q.image.src);
  }
  const problems = [];
  if (new Set(rec.options).size !== 4 || rec.options.some((o) => !o)) problems.push('options');
  if (!rec.passage) problems.push('no passage');
  if (!rec.explanation) problems.push('no explanation');
  if (/\u0000/.test(JSON.stringify(rec))) problems.push('NUL left');
  if (/underlined/.test(rec.prompt) && !rec.underline) problems.push('underline missing');
  if (problems.length) notes.push(`${ref}: ${problems.join(', ')}`);
  const same = `${rec.passage}|${rec.prompt}|${rec.options.join('|')}`;
  if (seen.has(same)) {
    notes.push(`${ref}: same question as ${seen.get(same)}, left out`);
    continue;
  }
  seen.set(same, ref);
  out.push(rec);
}

// ---------- Math ----------
const numeric = (v) => {
  const m = String(v).match(/^(-?\d*\.?\d+)(?:\/(\d+))?$/);
  return m ? Number(m[1]) / (m[2] ? Number(m[2]) : 1) : NaN;
};
for (const q of math) {
  const ref = `${q.file}|${q.page}`;
  const rec = {
    key: keyOf(q),
    source: SOURCE,
    section: 'Math',
    domain: q.domain,
    topic: q.topic,
    difficulty: q.difficulty,
    type: q.type,
    title: `${q.topic}: ${q.difficulty.toLowerCase()} question ${q.n}`,
    prompt: q.type === 'mcq' ? 'Choose the correct answer.' : 'Type your answer.',
    promptImage: picture(q.promptImage),
    explanation: '',
    explanationImage: picture(q.explanationImage)
  };
  media.add(q.promptImage.src);
  if (q.explanationImage) media.add(q.explanationImage.src);
  else notes.push(`${ref}: no explanation picture`);
  if (q.type === 'mcq') {
    rec.options = ['A', 'B', 'C', 'D'];
    rec.correctIndex = q.correctIndex;
    if (!(rec.correctIndex >= 0)) notes.push(`${ref}: no answer`);
  } else {
    const accepted = HAND_ANSWERS[ref] || q.accepted;
    if (!accepted?.length || accepted.some((a) => Number.isNaN(numeric(a)))) {
      notes.push(`${ref}: answer "${q.answerRaw}" isn't a number`);
      continue;
    }
    // Shown as "the" answer, and itself always an accepted one: the first value the pack lists,
    // as a fraction when it gives one (1/6 rather than .1666).
    const sameValue = accepted.filter((a) => Math.abs(numeric(a) - numeric(accepted[0])) < 0.002);
    rec.correctAnswer = sameValue.find((a) => a.includes('/')) || accepted[0];
    if (accepted.length > 1) rec.acceptedAnswers = accepted;
  }
  if (seen.has(rec.promptImage.src)) {
    notes.push(`${ref}: same picture as ${seen.get(rec.promptImage.src)}, left out`);
    continue;
  }
  seen.set(rec.promptImage.src, ref);
  out.push(rec);
}

// ---------- Report ----------
const count = (list, f) => list.reduce((m, q) => ((m[f(q)] = (m[f(q)] || 0) + 1), m), {});
console.log('questions', out.length, count(out, (q) => q.section));
console.log('by level', count(out, (q) => `${q.section === 'Math' ? 'Math' : 'R&W'} ${q.difficulty}`));
console.log('R&W with per-option explanations', out.filter((q) => q.rationales).length, '· with a picture', out.filter((q) => q.image).length, '· with an underline', out.filter((q) => q.underline).length);
console.log('Math multiple choice', out.filter((q) => q.section === 'Math' && q.type === 'mcq').length, '· student-produced', out.filter((q) => q.type === 'grid_in').length, '· several accepted forms', out.filter((q) => q.acceptedAnswers).length);
console.log('keys unique', new Set(out.map((q) => q.key)).size === out.length);
const mediaBytes = [...media].reduce((s, f) => s + fs.statSync(path.join(rawDir, 'media', f)).size, 0);
console.log('pictures', media.size, `${(mediaBytes / 1048576).toFixed(1)} MB`, '· questions.json', `${(Buffer.byteLength(JSON.stringify(out)) / 1048576).toFixed(2)} MB`);
console.log(`ligatures guessed without a dictionary hit (${guessed.size} words):`, [...guessed.keys()].sort().join(' '));
console.log(notes.length ? `NOTES (${notes.length}):\n${notes.join('\n')}` : 'no notes');

if (mode !== 'check') {
  const packDir = path.join(backendDir, 'content', 'pack');
  const mediaDir = path.join(packDir, 'media');
  fs.rmSync(mediaDir, { recursive: true, force: true });
  fs.mkdirSync(mediaDir, { recursive: true });
  for (const f of media) fs.copyFileSync(path.join(rawDir, 'media', f), path.join(mediaDir, f));
  fs.writeFileSync(path.join(packDir, 'questions.json'), JSON.stringify(out));
  console.log('written to', packDir);
}
