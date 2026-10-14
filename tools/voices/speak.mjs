// Reads an IELTS listening script (backend/ielts/seed/*Transcripts.js) aloud with natural voices,
// one voice per speaker, and writes a WAV. The voices are Kokoro's (an open speech model, Apache
// 2.0, run on this computer by the kokoro-js package); none is a copy of a real person's voice.
// Not part of the app or its build. The package lives outside the app:
//
//   mkdir _tools/voices (beside northstar-sat) && cd there && npm init -y && npm install kokoro-js
//   node speak.mjs <that folder>/node_modules T2L1 <out.wav>                      one script
//   node speak.mjs <that folder>/node_modules T2L1 <out.wav> male=am_michael      with another cast
//   node speak.mjs <that folder>/node_modules audition <out.wav>                  every voice, one line each
//
// The model (about 330 MB) is fetched from Hugging Face the first time and kept in
// <that folder>/models. seed/generate-audio.js is still what made the files the app serves.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const [modules, key, outFile, ...options] = process.argv.slice(2);
if (!modules || !key || !outFile) throw new Error("usage: node speak.mjs <node_modules folder> <script key | audition> <out.wav> [narrator=… female=… male=… dtype=…]");
const opt = Object.fromEntries(options.map((o) => o.split("=")));

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
// Who reads what. British voices by default, as in most of the test's own recordings.
const CAST = { narrator: opt.narrator || "bm_george", female: opt.female || "bf_emma", male: opt.male || "bm_fable" };
const SPEED = { narrator: 0.95, female: 1, male: 1 };
const SENTENCE_GAP = 0.22; // seconds of silence between two sentences of one speaker
const LINE_GAP = 0.5; // between two speakers
const AUDITION = ["bf_emma", "bf_isabella", "bf_alice", "bf_lily", "bm_george", "bm_fable", "bm_lewis", "bm_daniel", "af_heart", "af_bella", "af_nicole", "af_sarah", "am_michael", "am_fenrir", "am_puck", "am_adam"];

const seed = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "backend", "ielts", "seed");
const from = (file) => import(pathToFileURL(join(seed, file)).href);
const scripts = { ...(await from("transcripts.js")).TRANSCRIPTS, ...(await from("practiceTranscripts.js")).PRACTICE_TRANSCRIPTS, ...(await from("test2Transcripts.js")).TEST2_TRANSCRIPTS };

const { env } = await import(pathToFileURL(join(modules, "@huggingface", "transformers", "dist", "transformers.node.mjs")).href);
env.cacheDir = join(modules, "..", "models");
const { KokoroTTS } = await import(pathToFileURL(join(modules, "kokoro-js", "dist", "kokoro.js")).href);

const began = Date.now();
const tts = await KokoroTTS.from_pretrained(MODEL, { dtype: opt.dtype || "fp32", device: "cpu" });
const known = Object.keys(tts.voices);
console.log(`model ready in ${((Date.now() - began) / 1000).toFixed(1)}s; ${known.length} voices`);

let rate = 24000;
const silence = (seconds) => new Float32Array(Math.round(rate * seconds));

function trim(samples, threshold = 0.004) {
  let start = 0;
  let end = samples.length - 1;
  while (start < end && Math.abs(samples[start]) < threshold) start++;
  while (end > start && Math.abs(samples[end]) < threshold) end--;
  return samples.subarray(Math.max(0, start - 240), Math.min(samples.length, end + 480));
}

// One speaker's line -> sound. Spoken a sentence at a time: the model takes short texts best,
// and the gap between sentences is then ours to set.
async function say(text, voice, speed) {
  if (!known.includes(voice)) throw new Error(`no voice "${voice}"; there are: ${known.join(", ")}`);
  const parts = [];
  for (const sentence of text.split(/(?<=[.?!])\s+/).filter((s) => s.trim())) {
    const audio = await tts.generate(sentence, { voice, speed });
    rate = audio.sampling_rate;
    parts.push(trim(audio.audio), silence(SENTENCE_GAP));
  }
  parts.pop();
  return parts;
}

const parts = [silence(0.6)];
if (key === "audition") {
  for (const [i, voice] of AUDITION.filter((v) => known.includes(v)).entries()) {
    parts.push(...(await say(`Voice ${i + 1}. Good morning. I'd like to book two tickets for the museum tour on Saturday, please.`, voice, 1)), silence(0.9));
    console.log(`voice ${i + 1}: ${voice}`);
  }
} else {
  const segments = scripts[key];
  if (!segments) throw new Error(`no script "${key}"; there are: ${Object.keys(scripts).join(", ")}`);
  console.log(`cast: ${Object.entries(CAST).map(([who, v]) => `${who} = ${v}`).join(", ")}`);
  for (const [i, seg] of segments.entries()) {
    if (seg.pause) parts.push(silence(seg.pause));
    else parts.push(...(await say(seg.t, CAST[seg.s], SPEED[seg.s])), silence(LINE_GAP));
    if (i % 12 === 11) console.log(`  ${i + 1} of ${segments.length} lines`);
  }
}
parts.push(silence(0.8));

const total = parts.reduce((n, p) => n + p.length, 0);
const mixed = new Float32Array(total);
let at = 0;
for (const p of parts) {
  mixed.set(p, at);
  at += p.length;
}
let peak = 0;
for (const v of mixed) peak = Math.max(peak, Math.abs(v));
const data = Buffer.alloc(total * 2);
for (let i = 0; i < total; i++) {
  const s = peak ? (mixed[i] / peak) * 0.9 : 0;
  data.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), i * 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, Buffer.concat([header, data]));
console.log(`${outFile}: ${(total / rate).toFixed(1)}s of sound at ${rate} Hz, ${(data.length / 1e6).toFixed(1)} MB, made in ${((Date.now() - began) / 1000).toFixed(0)}s; loudest sample before levelling ${peak.toFixed(2)}`);
