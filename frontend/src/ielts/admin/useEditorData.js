import { useEffect, useState } from "react";
import { listReadingTitles, listSources } from "../api.js";

// Where content appears: mock tests, the students' Section Practice, or both.
export const USE_OPTIONS = [
  { value: "mock", label: "Mock tests only", short: "Mock tests" },
  { value: "practice", label: "Student practice only", short: "Practice" },
  { value: "both", label: "Mock tests and practice", short: "Mock + practice" }
];
export const USE_HELP = "Practice sets appear in students' Section Practice, one part at a time. Practice-only sets are never used in mock tests.";
// Shown in place of "Use in" when the editor was opened from a practice test's page.
export const TEST_PART_HELP = "It belongs to the practice test you opened it from. It is never listed in Section Practice or picked for a mock test.";

export function useSources() {
  const [sources, setSources] = useState([]);
  useEffect(() => {
    listSources()
      .then((list) => setSources(list.map((s) => s.name)))
      .catch(() => setSources([]));
  }, []);
  return sources;
}

export function useReadingTitles() {
  const [titles, setTitles] = useState([]);
  useEffect(() => {
    listReadingTitles()
      .then(setTitles)
      .catch(() => setTitles([]));
  }, []);
  return titles;
}

export function parseMinutes(value) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

// Reads an audio file's duration locally (before/while it uploads).
export function audioDurationSeconds(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });
}
