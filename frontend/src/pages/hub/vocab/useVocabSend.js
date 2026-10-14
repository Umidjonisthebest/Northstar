import { useCallback, useRef, useState } from "react";
import { sendVocabAnswers } from "../../../api.js";
import { useStudentAuth } from "../../../context/AuthContext.jsx";
import { useProgress } from "../../../context/ProgressContext.jsx";
import { useToast } from "../../../components/Toast.jsx";
import { planFinishedLine } from "../hubUtils.js";

// Keys typed into a field, or Space/Enter aimed at a button or link, belong to that control.
export const ownsKeys = (el) => Boolean(el?.closest?.("input, textarea, select, button, a, [contenteditable='true']"));

// Sends answers for the server to mark. Answers a failed request couldn't deliver are kept and
// go with the next one, so a dropped connection loses nothing as long as the page stays open.
export function useVocabSend(mode, onSaved) {
  const { token } = useStudentAuth();
  const { celebrate } = useProgress();
  const { toast } = useToast();
  const waiting = useRef([]);
  const [state, setState] = useState("idle"); // idle | saving | failed

  const send = useCallback(
    async (answers = [], extra = {}) => {
      const batch = [...waiting.current, ...answers];
      waiting.current = batch;
      if (!batch.length) return null;
      setState("saving");
      try {
        const res = await sendVocabAnswers(token, { mode, answers: batch, ...extra });
        waiting.current = waiting.current.slice(batch.length);
        setState("idle");
        onSaved(res);
        celebrate(res.reward);
        // These words were the last ones the study plan's vocab task needed.
        if (res.plan) {
          celebrate(res.plan.reward);
          toast.success(planFinishedLine(res.plan));
        }
        return res;
      } catch (e) {
        setState("failed");
        toast.error(e.message || "Couldn't save your answers");
        return null;
      }
    },
    [token, mode, onSaved, celebrate, toast]
  );

  return { send, state };
}
