// Ghost run: pacing against the student's previous attempt at the same mock
// module. `ghost` comes with the module from the server:
//   { seconds, marks: [{ n, t }] }
// where each mark is a question number and the second (from the start) at
// which that question was first opened, sorted by time.

// Where the previous attempt was after `elapsed` seconds: the question it had
// most recently opened, or `finished` once it had been handed in.
export function ghostAt(ghost, elapsed) {
  if (!ghost) return null;
  if (elapsed >= ghost.seconds) return { finished: true, seconds: ghost.seconds, n: null };
  let n = null;
  for (const mark of ghost.marks) {
    if (mark.t > elapsed) break;
    n = mark.n;
  }
  return { finished: false, seconds: ghost.seconds, n };
}

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// The one line the pacing panel shows.
export function ghostLine(ghost, elapsed) {
  const at = ghostAt(ghost, elapsed);
  if (!at) return "";
  if (at.finished) return `Last attempt: you had handed in by this time (after ${clock(at.seconds)}).`;
  if (at.n == null) return "Last attempt: you were just starting at this time.";
  return `Last attempt: you were on Q${at.n} at this time.`;
}
