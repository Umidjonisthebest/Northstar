// The test lock. A website can't stop a student switching to another tab or window, so the rule
// is the next best thing: a mock test or a diagnostic test must stay open and in front from the
// moment it starts until it is handed in. The test screen reports the moment it isn't
// (frontend/src/lock/useExamLock.js), and the server ends the test there and then as CANCELLED:
// nothing is marked, nothing is scored, no XP.
//
// Where the cancellation is kept:
//   SAT mock test      participant.cancelled   (the student's whole sitting of that session)
//   IELTS mock test    exam.cancelled          (db.ieltsExams)
//   SAT diagnostic     diagnostic.status = "cancelled", diagnostic.cancelled
//   IELTS diagnostic   the same, in db.ieltsDiagnostics
// Homework is different (homework.js): leaving is only counted and shown to the teacher.
//
// A teacher can let a student back into a mock test (a power cut, a wrong click). That is a new
// ROUND: the count goes to the test screen with the test, and comes back with a leave report, so a
// report left over from before the teacher's decision can't cancel the test a second time.

// What the test screen saw: the page was hidden (another tab, minimised, the screen locked), the
// window lost the keyboard to another window, the page was closed or reloaded, or the student
// left through the app itself.
export const LEAVE_KINDS = ["hidden", "blur", "closed", "exit"];

export const LEAVE_TEXT = {
  hidden: "switched to another tab or app",
  blur: "switched to another window",
  closed: "closed or reloaded the test page",
  exit: "left the test"
};

export const CANCELLED_MESSAGE = "This test was cancelled because you left the test page. Ask your teacher if you think this is a mistake.";

export const leaveKind = (v) => (LEAVE_KINDS.includes(v) ? v : "hidden");

export const cancellation = (kind, extra = {}, now = Date.now()) => ({ at: new Date(now).toISOString(), kind: leaveKind(kind), ...extra });

// How many times a teacher has let this student back in (0 for a test never cancelled).
export const lockRound = (holder) => (Array.isArray(holder?.lockLog) ? holder.lockLog.length : 0);

// A report from an earlier round is out of date: the teacher has decided since. A report with no
// round (an old page) counts for the current one.
export function staleReport(holder, body) {
  const sent = body?.round;
  return Number.isInteger(sent) && sent !== lockRound(holder);
}

// What the student and the teacher are shown.
export function cancelledView(c) {
  return c ? { at: c.at, kind: leaveKind(c.kind), reason: LEAVE_TEXT[leaveKind(c.kind)] } : null;
}

// The teacher's "let back in": the cancellation moves to the log, and the caller gives the student
// back the time the test was closed for. Returns that time in ms (0 when nothing was cancelled).
export function reinstate(holder, by = "", now = Date.now()) {
  const c = holder.cancelled;
  if (!c) return 0;
  holder.lockLog = [...(holder.lockLog || []), { ...c, reinstatedAt: new Date(now).toISOString(), by }];
  delete holder.cancelled;
  return Math.max(0, now - Date.parse(c.at));
}
