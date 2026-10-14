// The one place that ties what happens in the app to the face Nova shows.
// Use novaMood("correct") instead of writing mood names in screens, so the rules stay the same
// everywhere.
//
// Rules the owner set:
//  - A wrong answer is a gentle "oops". Nova is never angry or sad at a student.
//  - No Nova at all on exam screens (/exam/*, /ielts/exam): see showNovaOn().
export const NOVA_EVENTS = {
  correct: "cheer", // a right answer
  correctHard: "proud", // a right answer to a Hard or Challenging question
  correctAfterHint: "wink", // right, after asking for a hint or opening the explanation
  wrong: "oops",
  typing: "thinking", // Nova is writing a reply
  explaining: "explain",
  welcomeBack: "wave",
  greeting: "happy",
  idle: "happy",
  allClear: "excited", // nothing left in a queue
  streak: "excited",
  joke: "laugh",
  empty: "thinking", // nothing to show yet
  locked: "dim", // not available
  resting: "sleepy",
  timedTest: "focused"
};

export const novaMood = (event) => NOVA_EVENTS[event] || "happy";

// What Nova shows for a marked practice answer.
export function answerMood({ correct, difficulty, assisted }) {
  if (!correct) return novaMood("wrong");
  if (assisted) return novaMood("correctAfterHint");
  return novaMood(difficulty === "Hard" || difficulty === "Challenging" ? "correctHard" : "correct");
}

// Exam screens are calm and game-free: no mascot.
export const showNovaOn = (pathname) => !/^\/(exam|ielts\/exam)(\/|$)/.test(pathname || "");
