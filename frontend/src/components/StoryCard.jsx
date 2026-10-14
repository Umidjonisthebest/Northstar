import React from "react";
import Nova from "./Nova.jsx";
import Icon from "./Icon.jsx";
import { jumpText, scoreText } from "./storyText.js";
import "./story.css";

// A student's score jump, as it appears on the cover page (and as a preview
// in the studio). `story` is { name, detail, exam, before, after, quote, tone }.
export default function StoryCard({ story, className = "" }) {
  const { name, detail, exam = "SAT", before, after, quote, tone = "sky" } = story;
  return (
    <article className={`st-card st-tone-${tone} ${className}`}>
      <div className="st-top">
        <span className="st-jump">
          {scoreText(exam, before)} <Icon name="arrowRight" size={17} strokeWidth={2.4} /> {scoreText(exam, after)}
        </span>
        <b className="st-delta">{jumpText(exam, before, after)}</b>
      </div>
      <div className="st-who">
        <span className="st-avatar">
          <Nova size={58} tone={tone} extra={exam === "IELTS" ? "headphones" : "cap"} mood="happy" sparkles={false} />
        </span>
        <div>
          <b>{name || "Student name"}</b>
          <span>
            {exam}
            {detail ? ` · ${detail}` : ""}
          </span>
        </div>
      </div>
      {quote && <p className="st-quote">{quote}</p>}
    </article>
  );
}
