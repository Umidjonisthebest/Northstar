// Success stories for the cover page. A teacher adds them in the studio
// (with the student's permission); only published ones are public.

export const STORY_TONES = ["sun", "sky", "rose", "mint", "lilac", "peach"];
export const STORY_EXAMS = ["SAT", "IELTS"];

const text = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

function scoreError(exam, value, label) {
  if (!Number.isFinite(value)) return `${label} score is required`;
  if (exam === "SAT") {
    if (!Number.isInteger(value) || value < 400 || value > 1600 || value % 10 !== 0) return `${label} SAT score must be 400–1600, in steps of 10`;
  } else if (value < 0 || value > 9 || value * 2 !== Math.round(value * 2)) {
    return `${label} IELTS band must be 0–9, in steps of 0.5`;
  }
  return null;
}

// Validates a whole story (merge the stored one with the edit before calling).
export function cleanStory(input = {}) {
  const exam = STORY_EXAMS.includes(input.exam) ? input.exam : "SAT";
  const story = {
    name: text(input.name, 60),
    detail: text(input.detail, 80),
    exam,
    before: Number(input.before),
    after: Number(input.after),
    quote: text(input.quote, 400),
    tone: STORY_TONES.includes(input.tone) ? input.tone : STORY_TONES[text(input.name, 60).length % STORY_TONES.length],
    published: input.published === undefined ? true : Boolean(input.published)
  };
  if (!story.name) return { error: "Add the student's name as it should appear" };
  const bad = scoreError(exam, story.before, "Starting") || scoreError(exam, story.after, "New");
  if (bad) return { error: bad };
  if (story.after <= story.before) return { error: "The new score has to be higher than the starting one" };
  return { story };
}

export const publicStory = ({ id, name, detail, exam, before, after, quote, tone }) => ({ id, name, detail, exam, before, after, quote, tone });
