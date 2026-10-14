// Answer checking for practice-bank questions, shared by the practice player
// (routes/practiceRoutes.js) and the diagnostic test (diagnostic.js).

export function parseNumeric(v) {
  const s = String(v ?? "").trim().replace(/−/g, "-").replace(/\s+/g, "").replace(/,/g, "");
  if (/^-?\d*\.?\d+$/.test(s)) return Number(s);
  const m = s.match(/^(-?\d+)\/(-?\d+)$/);
  return m && Number(m[2]) !== 0 ? Number(m[1]) / Number(m[2]) : null;
}

// Student-produced responses: 3/4, 0.75 and .75 are the same answer; a
// decimal typed to 3+ places counts for a repeating value (like 1/3).
export function gradeGrid(answer, correct) {
  const a = parseNumeric(answer);
  const c = parseNumeric(correct);
  if (a === null || c === null) return String(answer ?? "").trim() === String(correct).trim();
  const decimals = (String(answer).split(".")[1] || "").length;
  return Math.abs(a - c) <= (decimals >= 3 ? 0.0006 : 1e-9);
}

// A student-produced response can have several accepted forms that aren't the same number
// (a truncated and a rounded decimal, or two solutions that are both right): `acceptedAnswers`
// lists them, and `correctAnswer` is the one shown as the answer.
export function isCorrectAnswer(q, answer) {
  if (q.type !== "grid_in") return Number(answer) === q.correctIndex;
  const accepted = Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length ? q.acceptedAnswers : [q.correctAnswer];
  return accepted.some((value) => gradeGrid(answer, value));
}

// The parts of a bank question that are pictures, or mark-up on its passage, for the screens that
// show a question before it is answered: `image` (a graph or table that goes with the passage),
// `promptImage` (the question itself, for questions that exist only as a picture) and `underline`
// ([start, end) in the passage). Each picture is { src, w, h }; `src` is a file under /api/bank-media.
export const questionMedia = (q) => ({
  image: q.image || null,
  promptImage: q.promptImage || null,
  underline: Array.isArray(q.underline) ? q.underline : null
});

// Mock-exam questions (tests built in the teacher studio). Multiple choice must be exactly the
// stored option index; a grid-in uses the same numeric rules as practice, so 0.75, .75 and 3/4
// agree here too. Every screen that marks a mock-exam answer calls this one function, so the
// submit, the student's review, the teacher's review and the analytics can never disagree.
export function isExamAnswerCorrect(q, given) {
  if (given === undefined || given === null) return false;
  if (q.type === "mcq") return typeof given === "number" && given === q.correctIndex;
  return String(given).trim() !== "" && gradeGrid(given, q.correctAnswer);
}

// The modules of a test that can actually be taken. A new test starts with both modules empty and a
// teacher may only ever fill one, but modules can't be deleted: an empty one must not show up as a
// module a student can open (the exam screen has nothing to show) or keep a candidate from ever
// counting as "finished the test".
export const liveModules = (test) => (test?.modules || []).filter((m) => m.questions?.length > 0);

// Whether a mock-exam module offers the graphing calculator. A teacher can switch it on or off per
// module (`calculator: true | false`); until they do, a module whose name says Math has it, as on
// the real test, and any other module doesn't.
export const moduleHasCalculator = (mod) => (typeof mod?.calculator === "boolean" ? mod.calculator : /math/i.test(mod?.name || ""));
