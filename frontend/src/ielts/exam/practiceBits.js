// Shared by the self-study screens (PracticeRunner.jsx for one part, TestRunner.jsx for a whole
// section): the exam-room preferences and the self-check questions shown with writing feedback.

export const PREFS_KEY = "ielts_exam_prefs";
const DEFAULT_PREFS = { contrast: "bow", textSize: "regular", volume: 0.8 };

export function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

export const CRITERIA = {
  1: [
    ["Task Achievement", ["Does an overview sum up the main trends or stages?", "Are the key figures or steps reported accurately?", "Do you compare the data rather than list every number?"]],
    ["Coherence and Cohesion", ["Does each paragraph group related information?", "Do linking words connect ideas naturally?"]],
    ["Lexical Resource", ["Have you varied the words for change and comparison?", "Are spelling and word choice accurate?"]],
    ["Grammatical Range and Accuracy", ["Is there a mix of simple and complex sentences?", "Do the tenses match the time period shown?"]]
  ],
  2: [
    ["Task Response", ["Have you answered every part of the question?", "Is your position clear from start to finish?", "Is each main idea explained and supported with an example?"]],
    ["Coherence and Cohesion", ["Does each body paragraph have one clear central idea?", "Do your introduction and conclusion agree?"]],
    ["Lexical Resource", ["Have you used topic vocabulary accurately?", "Have you avoided repeating the same words?"]],
    ["Grammatical Range and Accuracy", ["Have you used a range of structures (relative clauses, conditionals, passives)?", "Have you checked articles, agreement and punctuation?"]]
  ]
};
