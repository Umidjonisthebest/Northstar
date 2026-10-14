// Dev tool (Windows only): renders seed/transcripts.js to WAV files with the
// built-in "Microsoft Zira" voice. A lower second voice is made by speaking
// faster at a lower pitch and then resampling, which slows it back down and
// drops the pitch further. Output: assets/audio/*.wav + manifest.json, and the
// candidate sound check at assets/sound-test.wav (served at /ielts-assets).
//
//   node ielts/seed/generate-audio.js            (all transcripts)
//   node ielts/seed/generate-audio.js LA1 LB4    (selected keys; PL1–PL4 are the practice parts)

import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { SOUND_TEST, TRANSCRIPTS } from "./transcripts.js";
import { PRACTICE_TRANSCRIPTS } from "./practiceTranscripts.js";
import { TEST2_TRANSCRIPTS } from "./test2Transcripts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "assets", "audio");
const SOUND_TEST_FILE = path.join(__dirname, "assets", "sound-test.wav");
const RATE = 16000;
const LINE_GAP = 0.45;

const VOICES = {
  female: { pitch: "+0%", rate: "-5%", resample: 1 },
  male: { pitch: "-30%", rate: "+25%", resample: 0.8 },
  narrator: { pitch: "-15%", rate: "+8%", resample: 0.9 }
};

function readWav(file) {
  const buf = fs.readFileSync(file);
  let offset = 12;
  let data = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "data") data = buf.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  const samples = new Float32Array(data.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = data.readInt16LE(i * 2) / 32768;
  return samples;
}

function resample(samples, factor) {
  if (factor === 1) return samples;
  const out = new Float32Array(Math.floor(samples.length / factor));
  for (let i = 0; i < out.length; i++) {
    const pos = i * factor;
    const j = Math.floor(pos);
    const frac = pos - j;
    out[i] = (samples[j] || 0) * (1 - frac) + (samples[j + 1] || 0) * frac;
  }
  return out;
}

function trimSilence(samples, threshold = 0.004) {
  let start = 0;
  let end = samples.length - 1;
  while (start < end && Math.abs(samples[start]) < threshold) start++;
  while (end > start && Math.abs(samples[end]) < threshold) end--;
  return samples.subarray(Math.max(0, start - 160), Math.min(samples.length, end + 320));
}

function writeWav(file, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

function synthesize(lines, workDir) {
  const jobs = lines.map((line, i) => ({ file: path.join(workDir, `seg_${String(i).padStart(3, "0")}.wav`), text: line.t, ...VOICES[line.s] }));
  const jobFile = path.join(workDir, "jobs.json");
  fs.writeFileSync(jobFile, JSON.stringify(jobs), "utf-8");
  const script = `
Add-Type -AssemblyName System.Speech
$jobs = Get-Content -Raw -Encoding UTF8 '${jobFile}' | ConvertFrom-Json
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(${RATE}, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($j in $jobs) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoice('Microsoft Zira Desktop')
  $s.SetOutputToWaveFile($j.file, $fmt)
  $text = [System.Security.SecurityElement]::Escape($j.text)
  $ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><prosody pitch='$($j.pitch)' rate='$($j.rate)'>$text</prosody></speak>"
  $s.SpeakSsml($ssml)
  $s.Dispose()
}`;
  const scriptFile = path.join(workDir, "synth.ps1");
  fs.writeFileSync(scriptFile, "﻿" + script, "utf-8");
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptFile], { stdio: "inherit" });
  return jobs;
}

function render(key, segments, outFile) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `tts-${key}-`));
  const speech = segments.filter((seg) => seg.t);
  const jobs = synthesize(speech, workDir);
  const parts = [new Float32Array(Math.round(RATE * 0.6))];
  let j = 0;
  for (const seg of segments) {
    if (seg.pause) {
      parts.push(new Float32Array(Math.round(RATE * seg.pause)));
      continue;
    }
    const job = jobs[j++];
    const voice = VOICES[seg.s];
    parts.push(trimSilence(resample(readWav(job.file), voice.resample)));
    parts.push(new Float32Array(Math.round(RATE * LINE_GAP)));
  }
  parts.push(new Float32Array(Math.round(RATE * 0.8)));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const mixed = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    mixed.set(p, o);
    o += p.length;
  }
  let peak = 0;
  for (const v of mixed) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < mixed.length; i++) mixed[i] = (mixed[i] / peak) * 0.9;
  writeWav(outFile, mixed);
  fs.rmSync(workDir, { recursive: true, force: true });
  return total / RATE;
}

const requested = process.argv.slice(2);
fs.mkdirSync(OUT_DIR, { recursive: true });
const manifestFile = path.join(OUT_DIR, "manifest.json");
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf-8")) : {};

for (const [key, segments] of Object.entries({ ...TRANSCRIPTS, ...PRACTICE_TRANSCRIPTS, ...TEST2_TRANSCRIPTS })) {
  if (requested.length && !requested.includes(key)) continue;
  const seconds = render(key, segments, path.join(OUT_DIR, `${key}.wav`));
  manifest[key] = Math.round(seconds * 10) / 10;
  console.log(`${key}: ${manifest[key]}s`);
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

if (!requested.length || requested.includes("sound-test")) {
  const seconds = render("sound-test", SOUND_TEST, SOUND_TEST_FILE);
  console.log(`sound-test: ${seconds.toFixed(1)}s`);
}
