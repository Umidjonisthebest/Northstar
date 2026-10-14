import { createContext, useContext } from "react";

// Shared by every question renderer during an exam (and the admin preview).
//   answers / setAnswer / updateAnswers   candidate responses (slotId -> string, itemId -> string[])
//   flags / toggleFlag                     "review later" bookmarks (slot ids)
//   numberOf                               slotId -> question number
//   selected / setSelected                 click-to-place option for drag-and-drop types
//   setCurrent                             the question the candidate is on (footer highlight)
//   reveal / keyOf                         admin preview: show correct answers
export const ExamContext = createContext(null);

export function useExam() {
  const ctx = useContext(ExamContext);
  if (!ctx) throw new Error("useExam must be used inside an exam screen");
  return ctx;
}
