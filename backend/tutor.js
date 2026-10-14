// Nova — Northstar's study buddy. POST /api/practice/tutor streams a reply as
// server-sent events:
//   event: meta       { source: "ai" | "built-in" }
//   event: delta      { text }             (append to the reply)
//   event: done       { highlight, suggestions, tutor, action }
//   event: error      { message }
//
// With ANTHROPIC_API_KEY set, replies come from Claude with the question, its
// official explanation and the student's state as context. Without it, the
// built-in tutor below answers from the same structured explanation data
// (hints, steps, per-option rationales, key evidence, skill lessons).

import { aiEnabled, streamReply } from "./ai.js";
import { IELTS_TIPS, SKILL_LESSONS, SKILLS, TOPIC_ALIASES } from "./practiceSkills.js";

const LETTERS = "ABCDEF";

// ---------------------------------------------------------------------------
// Question context helpers
// ---------------------------------------------------------------------------
function tableText(table) {
  if (!table) return "";
  const lines = [table.title ? `Table: ${table.title}` : "Table:", table.columns.join(" | "), ...table.rows.map((r) => r.join(" | "))];
  return lines.join("\n");
}

function correctLabel(q) {
  return q.type === "grid_in" ? String(q.correctAnswer) : LETTERS[q.correctIndex];
}

// Lowercased copy with curly quotes straightened and whitespace runs collapsed,
// plus a map from each normalized character back to its index in `s`.
function normalizeWithMap(s) {
  let out = "";
  const map = [];
  for (let i = 0; i < s.length; i++) {
    let ch = s[i];
    if (/\s/.test(ch)) {
      if (out.endsWith(" ")) continue;
      ch = " ";
    } else if (ch === "“" || ch === "”") ch = '"';
    else if (ch === "‘" || ch === "’") ch = "'";
    out += ch.toLowerCase();
    map.push(i);
  }
  return { out, map };
}

// Find `quote` in `passage` and return the passage's own text for it: exact
// first, then ignoring case, quote style, spacing and trailing punctuation.
export function locateQuote(passage, quote) {
  if (!passage || !quote) return null;
  const clean = quote.trim().replace(/^["“'‘]+|["”'’]+$/g, "").trim();
  if (clean.length < 3) return null;
  if (passage.includes(clean)) return clean;
  const P = normalizeWithMap(passage);
  for (const q of [normalizeWithMap(clean).out, normalizeWithMap(clean).out.replace(/[.,;:!?]+$/, "")]) {
    const i = q.length >= 3 ? P.out.indexOf(q) : -1;
    if (i >= 0) return passage.slice(P.map[i], P.map[i + q.length - 1] + 1);
  }
  return null;
}

function studentStateLine(st) {
  const parts = [];
  if (st.selectedLabel) parts.push(`currently selected: ${st.selectedLabel}`);
  if (st.crossed?.length) parts.push(`crossed out: ${st.crossed.join(", ")}`);
  parts.push(`graded attempts on this question: ${st.attempts}`);
  if (st.attempts) parts.push(`last attempt: ${st.lastCorrect ? "correct" : `incorrect${st.lastWrongLabel ? ` (chose ${st.lastWrongLabel})` : ""}`}`);
  parts.push(`answered correctly: ${st.correct ? "yes" : "no"}`);
  parts.push(`opened the official explanation: ${st.revealed ? "yes" : "no"}`);
  return parts.join("; ");
}

const PERSONA = `You are Nova, the study buddy inside Northstar, a digital SAT and IELTS prep app. You're a small, friendly star who tutors students one-on-one.

How you teach:
- Be a tutor, not an answer key. If the student hasn't answered the current question correctly and hasn't opened the explanation, don't reveal the correct choice. Guide them one step forward with a hint, or a question that makes them look at the right evidence. If they ask for the answer outright, give a hint first; if they ask again, tell them.
- Once they've answered or opened the explanation, explain why the right answer is right and why their choice (if different) is wrong. Point to exact words in the passage or the exact math step.
- Keep replies short: usually 2 to 5 sentences and under 120 words. For step-by-step requests, use a numbered list of at most 4 short steps. No headings, no preamble, and don't restate the question.
- Use plain language a 16-year-old would use. Use **bold** for at most two key phrases.
- Write math in plain text with Unicode (x², √, π, ≤, −). No LaTeX.
- Quote the passage exactly when you cite it, and never invent passage content.
- No emojis.
- Stay on studying: the SAT, IELTS, study habits and motivation. Gently steer anything else back to studying.

Highlighting: when showing the student specific evidence in the passage would help, end your reply with one line in exactly this form:
[[highlight: exact words copied from the passage, at most 25 words]]
The app highlights that text in the passage for them. Only quote text that appears word for word in the passage, and use at most one highlight per reply.`;

// The student may see the answer once they have solved the question or opened the explanation.
// `st` is built on the server from the student's saved progress (routes/practiceRoutes.js), never
// from what the browser says about itself.
export const canReveal = (st) => Boolean(st.correct || st.revealed);

function questionContext(q, st) {
  const lesson = SKILL_LESSONS[q.topic];
  const lines = [
    "<question_context>",
    `Section: ${q.section} · Domain: ${q.domain} · Skill: ${q.topic} · Difficulty: ${q.difficulty}`
  ];
  if (q.passage) lines.push("Passage:", q.passage);
  if (q.table) lines.push(tableText(q.table));
  if (q.figure) lines.push(`(The question shows a figure: ${JSON.stringify(q.figure)})`);
  if (q.image) lines.push("(The passage comes with a graph or table that is a picture. You cannot see it. If the student asks what it shows, say you can't see pictures and ask them to read the values to you.)");
  if (q.promptImage) {
    lines.push("(This question, including its answer choices, is shown to the student as a picture. You cannot see it. Say so plainly if asked about its content, offer the skill strategy below, and point to the Explanation tab for the worked solution. Never invent what the question says.)");
  } else {
    lines.push("Question:", q.prompt);
    if (q.type !== "grid_in") lines.push("Choices:", ...q.options.map((o, i) => `${LETTERS[i]}) ${o}`));
  }
  if (q.type === "grid_in") lines.push("Answer format: the student types a number (student-produced response).");
  if (canReveal(st)) {
    lines.push(`Correct answer: ${correctLabel(q)}`);
    if (q.explanation) lines.push(`Official explanation: ${q.explanation}`);
    if (q.rationales?.length) lines.push("Why each choice is right or wrong:", ...q.rationales.map((r, i) => `${LETTERS[i]}) ${r}`));
    if (q.steps?.length) lines.push("Step-by-step solution:", ...q.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.body}`));
    if (q.keyQuote) lines.push(`Key evidence in the passage: "${q.keyQuote}"`);
  } else {
    // The answer key stays out of the prompt until the student has answered correctly or opened the
    // explanation. A model can't leak what it was never given. Only the author's hint is shared.
    lines.push("The answer key and the official explanation are withheld until the student answers correctly or opens the explanation. You do not have them. Work from the passage and the question, and guide; never state or hint which choice is correct.");
    if (q.hint) lines.push(`Author's hint (safe to paraphrase): ${q.hint}`);
  }
  if (lesson) lines.push(`Skill strategy: ${lesson.steps.join(" ")} Common traps: ${lesson.traps.join(" ")}`);
  lines.push("</question_context>", "<student_state>", studentStateLine(st), "</student_state>");
  return lines.join("\n");
}

function studentContext(student) {
  if (!student) return "";
  const lines = ["<student>"];
  lines.push(`Name: ${student.firstName || "the student"}. Currently studying for: ${student.exam === "ielts" ? "IELTS" : "the digital SAT"}.`);
  if (student.exam === "ielts") {
    lines.push(`Target IELTS band: ${student.ieltsTarget}. Latest mock bands: ${student.ieltsBands || "none yet"}.`);
  } else {
    lines.push(`Target SAT score: ${student.targetScore}. Current score: ${student.currentScore ?? "unknown"}. Days until their SAT: ${student.daysToExam ?? "unknown"}.`);
    lines.push(`Practice: ${student.attempts} answers, accuracy ${student.accuracy == null ? "n/a" : `${Math.round(student.accuracy * 100)}%`}, ${student.mistakes} questions in the mistakes queue.`);
    if (student.weakest?.length) lines.push(`Weakest skills: ${student.weakest.map((w) => `${w.topic} (${Math.round(w.accuracy * 100)}%)`).join(", ")}.`);
    if (student.traps) lines.push(`How they tend to lose points (from their own mistake tags and answer timing): ${student.traps}`);
  }
  lines.push("</student>");
  return lines.join("\n");
}

export function buildSystemPrompt({ q, st, student }) {
  const parts = [PERSONA];
  if (q) parts.push("The student is working on this question in the practice player:", questionContext(q, st));
  else parts.push("The student opened the Ask Nova page (no specific question). Help with strategy, planning, concepts and motivation, using their data below.");
  const sc = studentContext(student);
  if (sc) parts.push(sc);
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Built-in tutor (no AI key)
// ---------------------------------------------------------------------------
const INTENTS = [
  ["answer", /\b(the answer|right answer|correct answer|which (one|choice|option) is (right|correct)|just tell|tell me the answer|give me the answer|what'?s the answer|what is the answer)\b/i],
  ["highlight", /highlight|key (part|sentence|line|words|evidence)|evidence|where in the (passage|text)|which (part|line|sentence)|show me where/i],
  ["strategy", /strateg|approach|how (do|should|can) i (solve|do|approach|tackle|handle)|\btips?\b|method|best way|technique|trick/i],
  ["steps", /step|walk me|walk through|walkthrough|break (it|this) down|explain (this|it|the question)|how (do|to) (you )?solve|solution|apply it/i],
  ["hint", /hint|stuck|clue|nudge|don'?t (know|get|understand)|confus|\bidk\b|lost|help me|no idea|where do i start/i],
  ["greeting", /^\s*(hi|hello|hey|yo|salom|good (morning|afternoon|evening)|thanks|thank you|thx|ty)\b/i]
];
const NEXT = /^\s*(next( step)?|continue|go on|keep going|more|yes|yeah|yep|ok(ay)?|sure|and then\??|then\??|got it|finish( it)?|show (me )?(the )?(last|final|next) step)\b/i;
const MY_ANSWER = /\bmy (answer|choice|pick)\b|\bi (chose|picked|put|selected)\b/i;
const VOCAB = /(?:what does|meaning of|define|definition of|what is the meaning of|what's the meaning of)\s+["“'‘]?([a-z-]{3,})["”'’]?/i;

function detectIntent(message, tutor) {
  if (tutor.stepCursor != null && NEXT.test(message)) return "next";
  for (const [name, re] of INTENTS) if (re.test(message)) return name;
  return null;
}

// "why is B wrong?", "what about C", "is D right", or just "B?"
function detectOption(message, count) {
  const m = message.match(/(?:^|[\s("'])([A-F])(?=$|[\s)?.!,:'"])/);
  if (!m) return null;
  const idx = LETTERS.indexOf(m[1]);
  if (idx < 0 || idx >= count) return null;
  const cue = /why|what about|\bis\b|isn'?t|\bnot\b|wrong|right|correct|option|choice|about|\?|pick|chose|choose/i.test(message);
  return cue || message.trim().length <= 3 ? idx : null;
}

function formatStep(q, i) {
  const s = q.steps[i];
  return `**Step ${i + 1}: ${s.title}**\n${s.body}${s.quote ? `\n"${s.quote}"` : ""}`;
}

function lessonText(skill) {
  const lesson = SKILL_LESSONS[skill];
  if (!lesson) return null;
  return `**How to handle ${skill}**\n${lesson.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nWatch out for: ${lesson.traps[0].charAt(0).toLowerCase()}${lesson.traps[0].slice(1)}\n\n${lesson.tip}`;
}

function keyEvidenceWhy(q) {
  const s = q.steps?.find((x) => x.quote && q.keyQuote && (q.keyQuote.includes(x.quote) || x.quote.includes(q.keyQuote)));
  return s ? s.body : q.hint || "";
}

function questionReply(q, st, message, intent, tutor, vocab) {
  const t = { ...tutor };
  const opts = q.type === "grid_in" ? [] : q.options;
  const revealed = canReveal(st);
  const hasSteps = q.steps?.length > 0;
  let kind = intent || detectIntent(message, t);
  let optionIdx = kind ? null : detectOption(message, opts.length);
  if (!kind && optionIdx == null && MY_ANSWER.test(message) && Number.isInteger(st.lastWrongIndex ?? st.selectedIndex)) optionIdx = st.lastWrongIndex ?? st.selectedIndex;
  if (optionIdx != null) kind = "option";
  const vocabMatch = !kind && message.match(VOCAB);
  if (vocabMatch) kind = "vocab";

  const out = { text: "", highlight: null, suggestions: [], tutor: t };
  const stepSuggestions = () => {
    if (!revealed) return ["Give me a hint", "What's the best strategy for this?"];
    const wrong = Number.isInteger(st.lastWrongIndex) ? st.lastWrongIndex : opts.length ? (q.correctIndex + 1) % opts.length : null;
    return [...(wrong != null ? [`Why is ${LETTERS[wrong]} wrong?`] : []), "What's the best strategy for this?"];
  };

  const showStep = (i) => {
    const last = q.steps.length - 1;
    if (i >= last && !revealed && !t.gatePassed) {
      t.stepCursor = last;
      t.gatePassed = true;
      out.text = `That's everything you need to decide. Try choosing an answer and pressing **Check** before I finish it.\n\nSay **next** if you'd like me to show the last step anyway.`;
      out.suggestions = ["Next step", "Give me a hint"];
      return;
    }
    t.stepCursor = i >= last ? null : i + 1;
    // The last step states the answer: giving it before the student has solved the question counts
    // as having seen it (the next correct answer is assisted), same as opening the explanation.
    if (i >= last && !revealed) out.reveals = true;
    out.text = formatStep(q, i);
    if (q.steps[i].quote) out.highlight = q.steps[i].quote;
    out.suggestions = t.stepCursor == null ? stepSuggestions() : ["Next step", "Give me a hint"];
  };

  // A question that exists only as a picture can't be read here. Nova says so instead of guessing,
  // and still gives the skill's strategy, a vocabulary word or (when asked twice) the answer.
  if (q.promptImage && !["strategy", "greeting", "vocab", "answer"].includes(kind)) {
    out.text = `This question is shown as a picture, so I can't read it the way I read text. I can share the strategy for **${q.topic}**, and the **Explanation** tab has the worked solution.`;
    out.suggestions = ["What's the best strategy for this?"];
    return out;
  }

  switch (kind) {
    case "next":
    case "steps": {
      if (!hasSteps) {
        // No written steps. The explanation names the answer, so it is only given once the student
        // has solved the question or opened the explanation themselves.
        if (revealed) out.text = q.explanation || "This one doesn't have a worked solution yet.";
        else out.text = `I don't have this one broken into steps.${lessonText(q.topic) ? ` Here's the approach for this skill.\n\n${lessonText(q.topic)}` : ""}\n\nWhen you've had a try, the **Explanation** tab has the full solution.`;
        out.suggestions = ["Give me a hint", "What's the best strategy for this?"];
        break;
      }
      const i = kind === "next" && t.stepCursor != null ? t.stepCursor : 0;
      if (kind === "steps") t.gatePassed = false;
      showStep(i);
      break;
    }
    case "hint": {
      const level = t.hintLevel || 0;
      t.hintLevel = level + 1;
      if (!q.hint && !hasSteps) {
        // Nothing written for this question: the skill's own method is the honest hint.
        out.text = lessonText(q.topic) ? `I don't have a hint written for this one, but here's how to approach it.\n\n${lessonText(q.topic)}` : "Read the question's last line carefully, then eliminate choices that don't answer it.";
        if (q.keyQuote) out.highlight = q.keyQuote;
        out.suggestions = ["What's the best strategy for this?"];
        break;
      }
      if (level === 0 && q.hint) {
        out.text = `Here's a nudge: ${q.hint}`;
      } else if (hasSteps && level <= 1) {
        if (q.steps.length === 1 && !revealed) out.reveals = true; // a one-step solution is the answer
        out.text = `A bigger nudge. **${q.steps[0].title}:** ${q.steps[0].body}`;
        if (q.steps[0].quote) out.highlight = q.steps[0].quote;
        t.stepCursor = q.steps.length > 1 ? 1 : null;
      } else {
        out.text = "You're close. Let's walk through it together, one step at a time. Say **next** to go through the steps.";
        t.stepCursor = 0;
      }
      if (q.keyQuote && !out.highlight && level > 0) out.highlight = q.keyQuote;
      out.suggestions = ["Another hint", "Explain this step by step"];
      break;
    }
    case "highlight": {
      if (q.keyQuote && q.passage) {
        out.highlight = q.keyQuote;
        const why = keyEvidenceWhy(q);
        out.text = `I've highlighted the part of the passage that matters most. ${why}`;
        out.suggestions = ["Give me a hint", "Explain this step by step"];
      } else if (q.passage) {
        // A passage with no key evidence marked for it (questions from the question pack).
        out.text = "I don't have the key lines marked for this passage. Here's how to find them: read the question's last line, decide what kind of sentence would answer it, then scan the passage for that sentence and highlight it yourself.";
        out.suggestions = ["Give me a hint", "What's the best strategy for this?"];
      } else {
        out.text = `There's no passage here, so the key information is in the question itself. ${hasSteps ? `Start with this: **${q.steps[0].title}.** ${q.steps[0].body}` : q.hint || ""}`;
        t.stepCursor = hasSteps && q.steps.length > 1 ? 1 : null;
        out.suggestions = ["Next step", "What's the best strategy for this?"];
      }
      break;
    }
    case "strategy": {
      out.text = lessonText(q.topic) || `Read the question's last line first, predict what the answer should look like, and eliminate choices that don't do exactly that.`;
      out.suggestions = ["Apply it to this question", "Give me a hint"];
      break;
    }
    case "answer": {
      if (revealed || t.askedAnswer) {
        if (!revealed) out.reveals = true;
        const label = correctLabel(q);
        const written = q.type === "grid_in" ? q.explanation : (q.rationales?.[q.correctIndex] || q.explanation || "").replace(/^Correct\.\s*/, "");
        const why = written || (q.explanationImage ? "The **Explanation** tab shows the working." : "");
        out.text = `The answer is **${label}**. ${why}`.trim();
        if (q.keyQuote && q.passage) out.highlight = q.keyQuote;
        out.suggestions = hasSteps ? ["Explain this step by step", "What's the best strategy for this?"] : [];
        t.askedAnswer = false;
      } else {
        t.askedAnswer = true;
        out.text = `Let's see if you can get it yourself first. ${q.hint ? `Here's a nudge: ${q.hint}` : ""}\n\nIf you still want the answer, ask me again and I'll tell you.`;
        out.suggestions = ["Tell me the answer", "Explain this step by step"];
      }
      break;
    }
    case "option": {
      const L = LETTERS[optionIdx];
      const isRight = q.type !== "grid_in" && optionIdx === q.correctIndex;
      if (isRight && !revealed) {
        out.text = `**${L}** is worth a close look.${q.keyQuote ? ` Test it against this evidence: "${q.keyQuote}"` : ""} Does it say exactly what the text supports, no more and no less? If it holds up, select it and press **Check**.`;
        if (q.keyQuote && q.passage) out.highlight = q.keyQuote;
      } else {
        const r = q.rationales?.[optionIdx];
        out.text = r ? (isRight ? `**${L}** is correct. ${r.replace(/^Correct\.\s*/, "")}` : `**${L}**: ${r}`) : `I don't have notes on ${L}, but check it against the question: does it do exactly what's asked?`;
      }
      out.suggestions = ["Give me a hint", "Explain this step by step"];
      break;
    }
    case "vocab": {
      const word = vocabMatch[1].toLowerCase();
      const w = vocab.find((x) => x.word.toLowerCase() === word);
      out.text = w
        ? `**${w.word}** (${w.partOfSpeech}): ${w.definition}\n\nExample: ${w.example}`
        : `"${vocabMatch[1]}" isn't in my word deck yet. Try the context: cover the word, read the sentence, and ask what word would make sense in its place. Clues like "although" or "because" tell you whether it's positive or negative.`;
      out.suggestions = ["Give me a hint"];
      break;
    }
    case "greeting": {
      out.text = /thank|thx|\bty\b/i.test(message)
        ? "Anytime! Keep going; every question you work through makes the next one easier."
        : `Hi! I'm Nova. I can give you a hint, highlight the key evidence, share the strategy for **${q.topic}**, or walk through this question step by step.`;
      out.suggestions = ["Give me a hint", "Highlight the key part of the passage", "Explain this step by step"];
      break;
    }
    default: {
      if (hasSteps) {
        out.text = `Here's how I'd start. **${q.steps[0].title}:** ${q.steps[0].body}\n\nWant a hint, the strategy for ${q.topic}, or the full step-by-step?`;
        t.stepCursor = q.steps.length > 1 ? 1 : null;
      } else {
        out.text = q.hint || "Read the question's last line carefully, then eliminate choices that don't answer it.";
      }
      out.suggestions = ["Give me a hint", "What's the best strategy for this?", "Explain this step by step"];
    }
  }
  if (out.highlight && q.passage) out.highlight = locateQuote(q.passage, out.highlight);
  else if (out.highlight) out.highlight = null;
  return out;
}

const SAT_TIPS = [
  { k: /comma|splice|semicolon|run-on|boundar|punctuat|colon/i, skill: "Boundaries" },
  { k: /transition|however|therefore|moreover/i, skill: "Transitions" },
  { k: /evidence|support|claim|graph|table|data/i, skill: "Command of Evidence" },
  { k: /infer|logical(ly)? complet/i, skill: "Inferences" },
  { k: /word|vocab|context|meaning/i, skill: "Words in Context" },
  { k: /main idea|central|detail/i, skill: "Central Ideas and Details" },
  { k: /text 1|text 2|cross.?text|two texts|paired/i, skill: "Cross-Text Connections" },
  { k: /notes|synthesis|rhetorical/i, skill: "Rhetorical Synthesis" },
  { k: /purpose|structure|function/i, skill: "Text Structure and Purpose" },
  { k: /agreement|pronoun|tense|modifier|grammar/i, skill: "Form, Structure, and Sense" },
  { k: /slope|linear|line|intercept/i, skill: "Linear equations in two variables" },
  { k: /system/i, skill: "Systems of linear equations" },
  { k: /inequalit/i, skill: "Linear inequalities" },
  { k: /quadratic|factor|parabola|vertex|x²|x\^2|discriminant/i, skill: "Nonlinear equations and systems" },
  { k: /exponential|growth|decay|doubl/i, skill: "Nonlinear functions" },
  { k: /exponent|expression|equivalent|simplif/i, skill: "Equivalent expressions" },
  { k: /percent|%/i, skill: "Percentages" },
  { k: /ratio|proportion|rate|unit|convert/i, skill: "Ratios, rates, and units" },
  { k: /mean|median|average|outlier|standard deviation/i, skill: "One-variable data" },
  { k: /scatter|best fit|residual/i, skill: "Two-variable data" },
  { k: /probab|chance/i, skill: "Probability" },
  { k: /margin of error|sample/i, skill: "Sample statistics and margin of error" },
  { k: /experiment|observational|random assign|causation|study design/i, skill: "Studies and experiments" },
  { k: /area|volume|surface/i, skill: "Area and volume" },
  { k: /angle|parallel|similar|triangle/i, skill: "Lines, angles, and triangles" },
  { k: /pythag|sin|cos|tan|trig|hypotenuse|right triangle/i, skill: "Right triangles and trigonometry" },
  { k: /circle|radius|arc|sector|radian/i, skill: "Circles" }
];
const PACING = "Pacing: aim for about 70 seconds per Reading & Writing question and 95 per Math question. Accuracy in module 1 matters most because the test is adaptive. If a question takes more than 2 minutes, mark it for review and come back with fresh eyes.";

function pageReply(message, student) {
  const out = { text: "", suggestions: [], action: null, highlight: null };
  const m = message.toLowerCase();
  if (student?.exam === "ielts") {
    const hits = IELTS_TIPS.filter((t) => t.k.test(message)).map((t) => t.t);
    out.text = hits.length
      ? hits.slice(0, 2).join("\n\n")
      : "Tell me which part you're working on (Listening, Reading, Writing Task 1 or 2, or Speaking) and I'll give you a focused strategy. Your overall band is the average of the four skills, so shoring up your weakest one pays off fastest.";
    out.suggestions = ["How do I improve Writing Task 2?", "Reading: True / False / Not Given", "Listening tips"];
    return out;
  }
  if (INTENTS[5][1].test(message) && message.trim().split(/\s+/).length <= 3) {
    out.text = `Hi${student?.firstName ? ` ${student.firstName}` : ""}! I'm Nova. Ask me about any SAT skill, a question type that trips you up, pacing, or what to study next.`;
    out.suggestions = ["What should I study next?", "How do I pace each module?", "How do I spot a comma splice?"];
    return out;
  }
  if (/pac(e|ing)|time|slow|rush|finish|minute/i.test(m)) {
    out.text = PACING;
    out.suggestions = ["What should I study next?"];
    return out;
  }
  const named = Object.values(SKILLS)
    .flatMap((d) => Object.values(d).flat())
    .find((s) => m.includes(s.toLowerCase()));
  const alias = Object.entries(TOPIC_ALIASES).find(([k]) => m.includes(k.toLowerCase()))?.[1];
  const tip = SAT_TIPS.find((t) => t.k.test(message));
  const skill = named || alias || tip?.skill;
  if (skill && !/study next|what should i|focus|improve my score|weak/i.test(m)) {
    out.text = lessonText(skill);
    out.action = { type: "practice", skill };
    out.suggestions = ["What should I study next?", "How do I pace each module?"];
    return out;
  }
  const weak = student?.weakest?.[0];
  if (weak) {
    out.text = `Your data says **${weak.topic}** is the skill to work on next: you're at ${Math.round(weak.accuracy * 100)}% there. ${SKILL_LESSONS[weak.topic]?.tip || ""}\n\nA focused set of 10 questions on it is the fastest way to move your score${student.daysToExam != null ? `, and you have ${student.daysToExam} days until your SAT` : ""}.`;
    out.action = { type: "practice", skill: weak.topic };
  } else {
    out.text = "Start with a short mixed set in the Question Bank. After about 20 answers I'll be able to see which skills need the most work and point you to them. In the meantime, ask me about any skill, like comma splices, transitions, percentages, or circles.";
  }
  out.suggestions = ["How do I pace each module?", "Give me a strategy for Words in Context", "Tips for percent problems"];
  return out;
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------
function cleanMessages(list) {
  const msgs = (Array.isArray(list) ? list : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ctx: { q (full question incl. answers, or null), st (student state, built on the server),
//        student, vocab, onReveal(questionId), takeAiReply(),
//        charge() / refund(): set when this message costs comet chunks (the Ask Nova page) }
export async function handleTutor(req, res, ctx) {
  const messages = cleanMessages(req.body?.messages);
  const last = messages.at(-1);
  if (!last || last.role !== "user") return res.status(400).json({ error: "Send at least one user message" });
  const intent = ["highlight", "strategy", "steps", "hint", "answer"].includes(req.body?.intent) ? req.body.intent : null;
  const tutorState = req.body?.tutor && typeof req.body.tutor === "object" ? req.body.tutor : {};
  // Paid for before anything is sent, so a message that can't be afforded gets a plain answer
  // saying so instead of a reply. It is given back if Nova fails to answer.
  if (ctx.charge && !ctx.charge()) {
    return res.status(402).json({ error: "You're out of comet chunks. Study to earn more: Nova's hints inside a question are always free.", code: "no_chunks" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders?.();
  const asked = last.content.trim().toLowerCase();
  const send = (event, data) => {
    // Never suggest the question the student just asked.
    if (event === "done" && data.suggestions) data = { ...data, suggestions: data.suggestions.filter((s) => s.trim().toLowerCase() !== asked) };
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  const builtIn = async (why = null) => {
    const reply = ctx.q ? questionReply(ctx.q, ctx.st, last.content, intent, tutorState, ctx.vocab) : pageReply(last.content, ctx.student);
    // If this reply gave the answer away, the question is now "revealed": the student's next correct
    // answer counts as assisted, exactly as if they had opened the explanation.
    if (reply.reveals && ctx.q?.id) ctx.onReveal?.(ctx.q.id);
    send("meta", { source: "built-in", ...(why ? { limit: why } : {}) });
    // Stream it a few words at a time so it reads like a chat.
    const chunks = reply.text.match(/\S+\s*/g) || [reply.text];
    for (let i = 0; i < chunks.length; i += 3) {
      if (abort.signal.aborted) return;
      send("delta", { text: chunks.slice(i, i + 3).join("") });
      await wait(28);
    }
    send("done", { highlight: reply.highlight || null, suggestions: reply.suggestions || [], tutor: reply.tutor || {}, action: reply.action || null });
  };

  try {
    if (!aiEnabled()) {
      await builtIn();
      return res.end();
    }
    // "Just tell me the answer" is decided by the built-in tutor even in AI mode: it asks once more
    // before giving it, and it records that the answer was given. The model never holds the key for
    // an unsolved question, so it can't do this itself.
    if (ctx.q && !canReveal(ctx.st) && (intent || detectIntent(last.content, tutorState)) === "answer") {
      await builtIn();
      return res.end();
    }
    // Spending caps (aiLimits.js): when a student's daily allowance or the school's total is used up,
    // Nova carries on with the built-in tutor instead of failing.
    const taken = ctx.takeAiReply ? ctx.takeAiReply() : { ok: true };
    if (!taken.ok) {
      await builtIn(taken.reason);
      return res.end();
    }
    send("meta", { source: "ai" });
    const system = buildSystemPrompt({ q: ctx.q, st: ctx.st, student: ctx.student });
    // Hold back a trailing "[[highlight: ...]]" marker instead of showing it.
    let full = "";
    let sent = 0;
    const onText = (delta) => {
      full += delta;
      const marker = full.indexOf("[[");
      let safe = marker >= 0 ? marker : full.length;
      if (marker < 0 && full.endsWith("[")) safe = full.length - 1;
      if (safe > sent) {
        send("delta", { text: full.slice(sent, safe) });
        sent = safe;
      }
    };
    let result;
    try {
      result = await streamReply({ system, messages, onText, signal: abort.signal });
    } catch (err) {
      if (abort.signal.aborted) return res.end();
      console.warn("[tutor] AI request failed, using the built-in tutor:", err?.message || err);
      if (sent === 0) {
        await builtIn();
        return res.end();
      }
      ctx.refund?.();
      send("error", { message: "Nova lost the connection mid-answer. Try asking again." });
      return res.end();
    }
    if (result.refused) {
      send("delta", { text: `${sent ? "\n\n" : ""}I can't help with that one. Let's get back to the question: ask me for a hint or a step-by-step walkthrough.` });
    }
    const match = full.match(/\[\[\s*highlight\s*:\s*([\s\S]+?)\]\]/i);
    const highlight = match && ctx.q?.passage ? locateQuote(ctx.q.passage, match[1]) : null;
    const suggestions = ctx.q ? (canReveal(ctx.st) ? ["Explain this step by step", "What's the best strategy for this?"] : ["Give me a hint", "Explain this step by step"]) : [];
    send("done", { highlight, suggestions, tutor: tutorState, action: null });
    res.end();
  } catch (err) {
    console.error("[tutor]", err);
    ctx.refund?.();
    send("error", { message: "Nova couldn't answer right now. Try again in a moment." });
    res.end();
  }
}
