import React from "react";

// A picture a teacher attached to a mock-exam question (a graph, a figure). Used by the exam
// screen and by every review screen, so a question that depends on its figure always shows it.
export default function QuestionFigure({ src, alt }) {
  if (!src) return null;
  return <img className="q-figure" src={src} alt={alt} loading="lazy" decoding="async" />;
}
