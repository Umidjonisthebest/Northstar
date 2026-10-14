import { SCORE_SECTIONS, effectiveBand, examOverall, findExam } from "./exam.js";

// One student's IELTS sessions with their bands — shown on Northstar's admin student profile.
export function ieltsSummaryFor(db, userId) {
  return db.ieltsSessions
    .filter((s) => (s.participantIds || []).includes(userId))
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
    .map((s) => {
      const exam = findExam(db, s.id, userId);
      return {
        sessionId: s.id,
        name: s.name,
        date: s.date,
        time: s.time,
        status: s.status,
        finished: exam?.step === "done",
        bands: Object.fromEntries(SCORE_SECTIONS.map((k) => [k, effectiveBand(exam, k)])),
        overall: examOverall(exam)
      };
    });
}
