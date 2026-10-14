// The digital-SAT skill taxonomy the question bank is organised by, plus the
// short per-skill lessons shown in the practice player ("Masterclass" tab)
// and used by Nova, the built-in tutor.
//
// Section -> domain -> skills follows College Board's reporting categories.
// A question's `domain` is one of the domains below and its `topic` is one of
// that domain's skills (admin-created questions may use other topic names;
// they still show up, grouped under their domain).

export const SKILLS = {
  "Reading & Writing": {
    "Information and Ideas": ["Central Ideas and Details", "Command of Evidence", "Inferences"],
    "Craft and Structure": ["Words in Context", "Text Structure and Purpose", "Cross-Text Connections"],
    "Expression of Ideas": ["Rhetorical Synthesis", "Transitions"],
    "Standard English Conventions": ["Boundaries", "Form, Structure, and Sense"]
  },
  "Math": {
    "Algebra": [
      "Linear equations in one variable",
      "Linear equations in two variables",
      "Linear functions",
      "Systems of linear equations",
      "Linear inequalities"
    ],
    "Advanced Math": ["Equivalent expressions", "Nonlinear equations and systems", "Nonlinear functions"],
    "Problem-Solving and Data Analysis": [
      "Ratios, rates, and units",
      "Percentages",
      "One-variable data",
      "Two-variable data",
      "Probability",
      "Sample statistics and margin of error",
      "Studies and experiments"
    ],
    "Geometry and Trigonometry": ["Area and volume", "Lines, angles, and triangles", "Right triangles and trigonometry", "Circles"]
  }
};

export const SECTIONS = Object.keys(SKILLS);

// Question difficulty levels, easiest first. "Challenging" sits above Hard: the
// question types that are hardest on the real test. The Math generators
// (content/mathGen.js) stop at Hard; see generatorLevel().
export const DIFFICULTIES = ["Easy", "Medium", "Hard", "Challenging"];
export const DIFFICULTY_RANK = Object.fromEntries(DIFFICULTIES.map((level, i) => [level, i]));
export const generatorLevel = (level) => (level === "Challenging" ? "Hard" : level);

// URL-friendly section keys used by the student bank pages.
export const SECTION_KEYS = { rw: "Reading & Writing", math: "Math" };

// Skill names used by older versions of the starter content (and possibly by
// admin-created questions) mapped onto the taxonomy above.
export const TOPIC_ALIASES = {
  "Punctuation": "Boundaries",
  "Subject-verb agreement": "Form, Structure, and Sense",
  "Pronouns": "Form, Structure, and Sense",
  "Inference": "Inferences",
  "Central ideas": "Central Ideas and Details",
  "Command of evidence": "Command of Evidence",
  "Words in context": "Words in Context",
  "Text structure": "Text Structure and Purpose",
  "Rhetorical synthesis": "Rhetorical Synthesis",
  "Linear equations": "Linear equations in two variables",
  "Nonlinear equations": "Nonlinear equations and systems",
  "Systems of equations": "Systems of linear equations",
  "Geometry": "Lines, angles, and triangles",
  "Statistics": "One-variable data",
  "Exponents": "Equivalent expressions",
  "Ratios": "Ratios, rates, and units",
  "Exponential growth": "Nonlinear functions",
  "Inequalities": "Linear inequalities"
};

export function skillDomain(skill) {
  for (const [section, domains] of Object.entries(SKILLS)) {
    for (const [domain, skills] of Object.entries(domains)) {
      if (skills.includes(skill)) return { section, domain };
    }
  }
  return null;
}

export function allSkills(section) {
  const out = [];
  for (const [domain, skills] of Object.entries(SKILLS[section] || {})) for (const skill of skills) out.push({ domain, skill });
  return out;
}

// Short directions for the "Directions" menu in the practice player
// (written for Northstar; not College Board's wording).
export const SECTION_DIRECTIONS = {
  "Reading & Writing": [
    "Each question comes with one or more short passages, which may include a table or a graph.",
    "Read the passage and the question carefully, then choose the single best answer based on what the passage says.",
    "Every question has exactly one best answer. Use cross-out to eliminate choices and Highlight to mark evidence."
  ],
  "Math": [
    "For multiple-choice questions, choose the single best answer.",
    "For student-produced response questions, type your answer in the box. You can enter integers, decimals, or fractions such as 3/4 or 0.75. Leave out units, commas, and dollar signs.",
    "A calculator is allowed on every question. Figures help you picture the problem but aren't necessarily drawn to scale. The Info tab has a reference sheet of formulas."
  ]
};

export const MATH_REFERENCE = [
  ["Circle", "A = πr²,  C = 2πr"],
  ["Rectangle", "A = ℓw"],
  ["Triangle", "A = (1/2)bh"],
  ["Pythagorean theorem", "a² + b² = c²"],
  ["Special right triangles", "30-60-90: x, x√3, 2x   ·   45-45-90: s, s, s√2"],
  ["Rectangular prism", "V = ℓwh"],
  ["Cylinder", "V = πr²h"],
  ["Sphere", "V = (4/3)πr³"],
  ["Cone", "V = (1/3)πr²h"],
  ["Pyramid", "V = (1/3)ℓwh"],
  ["Angles", "A circle has 360° (2π radians); a triangle's angles add up to 180°"]
];

// Per-skill mini lessons: what the skill tests, a repeatable method, the
// traps question writers set, and one line to remember.
export const SKILL_LESSONS = {
  // ---------------- Reading & Writing ----------------
  "Central Ideas and Details": {
    what: "Finding the main point of a text, or a detail that the text states directly.",
    steps: [
      "Read the whole text before looking at the choices.",
      "Say the main idea to yourself in one short sentence: who or what, plus the point being made.",
      "For a detail question, find the exact line that answers it.",
      "Eliminate choices that are too narrow (one detail), too broad, or not actually stated."
    ],
    traps: [
      "A choice that is true but only covers part of the text.",
      "Extreme words (always, never, only, entirely) that the text doesn't support.",
      "A real detail from the text that doesn't answer this question."
    ],
    tip: "If you can't point to the words in the text that support a choice, it's wrong."
  },
  "Command of Evidence": {
    what: "Choosing the quotation, finding, or data point that supports, weakens, or illustrates a claim.",
    steps: [
      "Underline the exact claim you are asked to support or weaken.",
      "Restate that claim in five words or fewer.",
      "Test each choice: if this were true, would the claim be more likely (or less likely, for weaken)?",
      "With a table or graph, check the variable, the units, and the exact group or year the question names."
    ],
    traps: [
      "Accurate information that doesn't touch the claim.",
      "Evidence for a different claim than the one in the question.",
      "Reading the graph correctly, but for the wrong group or time period."
    ],
    tip: "Accurate is not enough. The evidence has to connect to the claim."
  },
  "Inferences": {
    what: "Choosing the most logical completion of a text, based only on what the text says.",
    steps: [
      "Trace the logic: what does each sentence establish?",
      "Before reading the choices, predict what must follow from those sentences.",
      "Pick the choice that follows directly, without adding outside assumptions."
    ],
    traps: [
      "A choice that goes further than the text allows.",
      "A claim that sounds true in real life but isn't supported by the text.",
      "Reversing cause and effect."
    ],
    tip: "The right answer is usually modest: it says only what the text forces you to conclude."
  },
  "Words in Context": {
    what: "Choosing the word that fits the meaning and tone of a sentence most precisely.",
    steps: [
      "Cover the choices and read the sentence.",
      "Find the context clues: contrast words, cause and effect, a definition or example nearby.",
      "Predict a simple word of your own for the blank.",
      "Choose the answer closest to your prediction, and check that its tone matches."
    ],
    traps: [
      "An impressive-sounding word that doesn't fit the logic.",
      "A familiar word used in a secondary meaning.",
      "A word with the right positive or negative charge but the wrong precise meaning."
    ],
    tip: "Predict first. Your own word is the best filter."
  },
  "Text Structure and Purpose": {
    what: "Describing what a text, or one sentence in it, is doing, and why the author wrote it.",
    steps: [
      "Label each part of the text: introduces, contrasts, gives an example, explains, concludes.",
      "For main purpose, ask why the author wrote the whole text, not one part.",
      "For one sentence's function, look at how it connects to the sentences around it.",
      "Match the verbs in the choices (describe, argue, challenge, illustrate) to what the text actually does."
    ],
    traps: [
      "A choice that describes the content correctly but names the wrong function.",
      "Verbs that are too strong (refute, criticize) when the text only describes.",
      "A purpose that fits one sentence but not the text as a whole."
    ],
    tip: "Focus on the verbs: describe is not argue, and argue is not criticize."
  },
  "Cross-Text Connections": {
    what: "Relating two texts on the same topic: where they agree, disagree, or how one author would respond to the other.",
    steps: [
      "Summarize Text 1's main claim in a few words.",
      "Summarize Text 2's main claim in a few words.",
      "Decide the relationship: agree, disagree, qualify (partly agree), or extend.",
      "Answer from the perspective the question asks for, such as how Text 1's author would respond to Text 2."
    ],
    traps: [
      "Choices that swap the two authors' views.",
      "Choices that reflect only one of the texts.",
      "Overstating disagreement when one author only qualifies the other."
    ],
    tip: "Write a five-word summary of each text before you look at the choices."
  },
  "Rhetorical Synthesis": {
    what: "Using a student's notes to write a sentence that accomplishes a specific goal.",
    steps: [
      "Read the question's goal first, for example 'emphasize a difference' or 'introduce the study to a new audience'.",
      "Only then skim the notes.",
      "Eliminate every choice that doesn't accomplish the goal, even if it is accurate.",
      "Pick the choice that meets the whole goal, not just half of it."
    ],
    traps: [
      "Accurate statements from the notes that miss the goal.",
      "Choices that meet part of the goal (a similarity when the goal asks for a difference).",
      "Choices that assume the audience already knows something the goal says they don't."
    ],
    tip: "The goal is everything. The notes are just raw material."
  },
  "Transitions": {
    what: "Choosing the word or phrase that shows the logical relationship between ideas.",
    steps: [
      "Cover the choices.",
      "Read the sentence before the blank and the one it starts.",
      "Name the relationship: contrast, continuation, cause and effect, example, or sequence.",
      "Pick the transition that matches, and be wary of two choices that mean the same thing."
    ],
    traps: [
      "A transition that fits one sentence but not the relationship between the two.",
      "Similar pairs (however / nevertheless): if two choices mean the same, both are usually wrong.",
      "'For example' when the second sentence isn't actually an example of the first."
    ],
    tip: "Decide the relationship before you read the options."
  },
  "Boundaries": {
    what: "Punctuating where clauses and phrases begin and end: periods, semicolons, colons, commas, and dashes.",
    steps: [
      "Find the subject and verb on each side of the blank.",
      "If both sides are independent clauses, use a period, a semicolon, or a comma plus FANBOYS (for, and, nor, but, or, yet, so).",
      "Use a colon after a complete clause to introduce a list or an explanation.",
      "For an extra (nonessential) phrase, use matching punctuation on both sides: two commas or two dashes."
    ],
    traps: [
      "Comma splices: two independent clauses joined by only a comma.",
      "Mismatched punctuation around an extra phrase (a comma on one side, a dash on the other).",
      "A comma between a subject and its verb, or between a verb and its object."
    ],
    tip: "A semicolon works exactly where a period would."
  },
  "Form, Structure, and Sense": {
    what: "Agreement and form: subject-verb agreement, pronouns, verb tense, possessives, and modifiers.",
    steps: [
      "Find the real subject of the verb. Cross out phrases between the subject and the verb.",
      "Check the tense against time clues and the other verbs in the passage.",
      "Match each pronoun to the noun it replaces, singular or plural.",
      "After an introductory modifier, the noun that comes next must be the thing it describes."
    ],
    traps: [
      "A plural noun inside a phrase that sits between a singular subject and its verb.",
      "Its / it's and their / they're / there.",
      "Dangling modifiers: 'Walking to school, the rain started.'"
    ],
    tip: "Cross out the phrase between the subject and the verb, then read the sentence again."
  },

  // ---------------- Math ----------------
  "Linear equations in one variable": {
    what: "Solving equations like 3(x − 2) + 5 = 17 and word problems that lead to them.",
    steps: [
      "Distribute and combine like terms on each side.",
      "Move variable terms to one side and constants to the other.",
      "Divide by the coefficient.",
      "Check the question: it may ask for 2x, x + 3, or another expression, not just x."
    ],
    traps: ["Sign errors when distributing a negative.", "Doing an operation to only one side.", "Answering for x when the question asks for something else."],
    tip: "Read the last line of the question twice: what exactly are you solving for?"
  },
  "Linear equations in two variables": {
    what: "Lines: slope, intercepts, and equations like y = mx + b or Ax + By = C.",
    steps: [
      "Slope = (change in y) ÷ (change in x) between two points.",
      "Rewrite the equation as y = mx + b to read the slope m and y-intercept b.",
      "For the x-intercept set y = 0; for the y-intercept set x = 0.",
      "A point lies on a line when its coordinates make the equation true."
    ],
    traps: ["Computing run ÷ rise instead of rise ÷ run.", "Mixing up the x- and y-intercepts.", "Forgetting to divide every term when solving for y."],
    tip: "In a word problem, 'per' signals the slope and 'fixed' or 'initial' signals the intercept."
  },
  "Linear functions": {
    what: "Functions f(x) = mx + b: evaluating them, building them from context, and interpreting m and b.",
    steps: [
      "The slope m is the rate of change: how much the output changes per 1 unit of input.",
      "The intercept b is the starting value: the output when x = 0.",
      "To evaluate, substitute the input for x everywhere.",
      "From two data points, find the slope first, then solve for b."
    ],
    traps: ["Swapping the rate and the starting value.", "Using f(x) when the question gives the output and asks for x.", "Unit mismatches (per hour vs per minute)."],
    tip: "Ask: what does the function equal when the input is zero? That's b."
  },
  "Systems of linear equations": {
    what: "Two linear equations solved together: the intersection point, or no or infinitely many solutions.",
    steps: [
      "Line up the variables and look for a variable that cancels when you add or subtract (elimination).",
      "Or solve one equation for a variable and substitute it into the other.",
      "No solution: same slope, different intercepts (parallel lines).",
      "Infinitely many solutions: one equation is a multiple of the other (the same line)."
    ],
    traps: ["Stopping after finding one variable when the question asks for the other, or for x + y.", "Sign errors when subtracting equations.", "Confusing 'no solution' with 'infinitely many'."],
    tip: "If the question asks for x + y or 2x − y, try adding or subtracting the equations directly."
  },
  "Linear inequalities": {
    what: "Solving and interpreting inequalities, including word problems with 'at least' and 'at most'.",
    steps: [
      "Solve like an equation.",
      "Flip the inequality sign whenever you multiply or divide by a negative number.",
      "Translate carefully: 'at least' means ≥ and 'at most' means ≤.",
      "Test a value from the answer to check the direction."
    ],
    traps: ["Forgetting to flip the sign.", "Using > when the problem says 'at least'.", "Ignoring that some contexts (people, tickets) need whole numbers."],
    tip: "Plug in an easy number to see whether the inequality holds."
  },
  "Equivalent expressions": {
    what: "Rewriting expressions: exponent rules, factoring, expanding, and combining rational expressions.",
    steps: [
      "Exponents: multiply powers → add exponents; power of a power → multiply exponents.",
      "Expand with the distributive property; watch every sign.",
      "Factor out the greatest common factor first, then look for patterns such as a² − b² = (a − b)(a + b).",
      "When stuck, substitute a number such as x = 2 into the original and into each choice."
    ],
    traps: ["Adding exponents when you should multiply them.", "(a + b)² ≠ a² + b².", "Dropping a negative sign when distributing."],
    tip: "Plugging in a number is a reliable check for 'which expression is equivalent' questions."
  },
  "Nonlinear equations and systems": {
    what: "Quadratic, radical, and rational equations, and systems where a line meets a curve.",
    steps: [
      "Set the equation equal to zero.",
      "Factor if you can; otherwise use the quadratic formula x = (−b ± √(b² − 4ac))/(2a).",
      "The discriminant b² − 4ac tells you the number of real solutions: positive → 2, zero → 1, negative → 0.",
      "For a line and a parabola, substitute the line into the parabola and solve."
    ],
    traps: ["Dividing both sides by x and losing the solution x = 0.", "Forgetting the ± in the quadratic formula.", "Not checking for extraneous solutions with square roots."],
    tip: "Graphing both sides on a calculator and reading the intersections is often fastest."
  },
  "Nonlinear functions": {
    what: "Exponential and quadratic functions: growth and decay, vertex form, and interpreting parameters.",
    steps: [
      "Exponential: f(x) = a · bˣ, where a is the starting amount and b the growth factor per step.",
      "Growth of r% per step → b = 1 + r/100; decay of r% → b = 1 − r/100.",
      "Quadratic vertex form f(x) = a(x − h)² + k has vertex (h, k).",
      "For 'doubles every t hours', the exponent is (time ÷ t)."
    ],
    traps: ["Using 0.05 instead of 1.05 as a growth factor.", "Mixing up the sign of h in (x − h).", "Linear thinking (adding) for an exponential situation (multiplying)."],
    tip: "Exponential = multiply by the same factor each step. Linear = add the same amount each step."
  },
  "Ratios, rates, and units": {
    what: "Proportions, unit rates, and unit conversions.",
    steps: [
      "Write the ratio with labels, e.g. flour : sugar = 3 : 2.",
      "Set up a proportion with matching units in the same positions.",
      "For conversions, multiply by factors like (60 minutes ÷ 1 hour) so the units cancel.",
      "Check that the answer's size makes sense."
    ],
    traps: ["Flipping the ratio.", "Converting in the wrong direction (multiplying when you should divide).", "Ignoring squared units (ft² to in² needs 12²)."],
    tip: "Write the units on every number and let them cancel."
  },
  "Percentages": {
    what: "Percent of a quantity, percent change, and successive percent changes.",
    steps: [
      "Percent of: part = (percent ÷ 100) × whole.",
      "Percent change = (new − old) ÷ old × 100.",
      "An increase of r% multiplies by (1 + r/100); a decrease multiplies by (1 − r/100).",
      "Successive changes multiply: +20% then −20% is 1.2 × 0.8 = 0.96."
    ],
    traps: ["Dividing by the new value instead of the original.", "Adding successive percents instead of multiplying the factors.", "Answering with the amount of change when the question asks for the final value."],
    tip: "Always ask: percent of what? The 'of' number goes in the denominator."
  },
  "One-variable data": {
    what: "Mean, median, mode, range, and spread of a single data set, and how outliers affect them.",
    steps: [
      "Mean = sum ÷ count, so sum = mean × count.",
      "Median: order the data and take the middle value (the average of the middle two for an even count).",
      "Range = max − min; standard deviation measures spread around the mean.",
      "An outlier pulls the mean toward it much more than the median."
    ],
    traps: ["Taking the median without sorting first.", "Forgetting the new count when a value is added.", "Confusing a larger spread with a larger mean."],
    tip: "For a missing value, work with totals: required sum − current sum."
  },
  "Two-variable data": {
    what: "Scatterplots, lines of best fit, and what their slope and intercept mean.",
    steps: [
      "Read the axes and units first.",
      "The slope of the line of best fit is the predicted change in y for each 1-unit increase in x.",
      "To predict, substitute the x-value into the line's equation.",
      "A residual is actual − predicted."
    ],
    traps: ["Interpreting slope as a total instead of a per-unit change.", "Treating a prediction as an exact value.", "Extrapolating far outside the data."],
    tip: "Say the slope as a sentence: 'for each additional ___, the predicted ___ increases by ___.'"
  },
  "Probability": {
    what: "Simple and conditional probability, often from a two-way table.",
    steps: [
      "Probability = favorable outcomes ÷ total possible outcomes.",
      "For 'given that', shrink the total to only the group named after 'given'.",
      "Read the table's row and column totals carefully.",
      "For independent events, multiply the probabilities."
    ],
    traps: ["Using the grand total when the question restricts the group.", "Swapping the condition and the event.", "Double-counting a cell."],
    tip: "Circle the group after 'given' or 'of those'. That group is your denominator."
  },
  "Sample statistics and margin of error": {
    what: "Using a random sample to estimate a population value, and what a margin of error means.",
    steps: [
      "Estimate for the population = sample proportion × population size.",
      "Estimate ± margin of error gives a range of plausible values.",
      "Larger random samples give smaller margins of error.",
      "Results only generalize to the population that was randomly sampled."
    ],
    traps: ["Treating the interval as a guarantee.", "Generalizing a sample of one school to all students.", "Thinking a bigger margin of error means a better study."],
    tip: "Who was sampled? Conclusions can only go that far."
  },
  "Studies and experiments": {
    what: "What a study's design allows you to conclude: cause and effect versus association.",
    steps: [
      "Random assignment to treatments allows cause-and-effect conclusions.",
      "Random selection from a population allows generalizing to that population.",
      "Without random assignment, you can only claim an association.",
      "Check both: how subjects were chosen, and how treatments were assigned."
    ],
    traps: ["Claiming causation from an observational study.", "Generalizing to a population that wasn't sampled.", "Confusing random selection with random assignment."],
    tip: "Assignment → cause. Selection → generalize."
  },
  "Area and volume": {
    what: "Area, surface area, and volume of common shapes, and how scaling changes them.",
    steps: [
      "Write down the formula first (they're on the reference sheet).",
      "Substitute carefully and keep units consistent.",
      "Scaling lengths by k multiplies area by k² and volume by k³.",
      "For composite shapes, add or subtract simpler pieces."
    ],
    traps: ["Using diameter instead of radius.", "Scaling area by k instead of k².", "Mixing units, such as inches with feet."],
    tip: "If a side doubles, the area quadruples and the volume goes up eightfold."
  },
  "Lines, angles, and triangles": {
    what: "Angle relationships, parallel lines, triangle angle sums, and similar triangles.",
    steps: [
      "Angles on a straight line add to 180°; a triangle's angles add to 180°.",
      "Parallel lines cut by a transversal: alternate interior angles are equal and same-side interior angles add to 180°.",
      "Similar triangles have equal angles and proportional sides.",
      "An exterior angle equals the sum of the two remote interior angles."
    ],
    traps: ["Assuming lines are parallel when the question doesn't say so.", "Matching the wrong sides in similar triangles.", "Forgetting vertical angles are equal."],
    tip: "Mark every angle you can find on the figure; the one you need usually appears."
  },
  "Right triangles and trigonometry": {
    what: "The Pythagorean theorem, special right triangles, and sine, cosine, and tangent.",
    steps: [
      "a² + b² = c², where c is the hypotenuse (opposite the right angle).",
      "Spot common triples: 3-4-5, 5-12-13, 8-15-17, and their multiples.",
      "SOH-CAH-TOA: sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent.",
      "Complementary angles: sin(x°) = cos(90° − x°)."
    ],
    traps: ["Treating a leg as the hypotenuse.", "Choosing opposite and adjacent relative to the wrong angle.", "Calculator in radian mode when the question uses degrees."],
    tip: "Label the sides O, A, H from the angle you're given before writing any ratio."
  },
  "Circles": {
    what: "Area, circumference, arcs, sectors, radians, and circle equations.",
    steps: [
      "Area = πr² and circumference = 2πr.",
      "An arc or sector is (central angle ÷ 360°) of the whole circle.",
      "Equation: (x − h)² + (y − k)² = r² has center (h, k) and radius r.",
      "If the equation is expanded, complete the square for x and for y."
    ],
    traps: ["Reading r² as the radius.", "Sign errors in the center: (x + 3)² means h = −3.", "Using the diameter in the area formula."],
    tip: "Completing the square: take half the x-coefficient, square it, and add it to both sides."
  }
};

// A few evergreen IELTS strategies Nova can fall back on without an AI key.
export const IELTS_TIPS = [
  { k: /listen/i, t: "Listening: read the questions before each part starts and predict the type of answer (a number, a name, a place). Answers come in order, and the speakers often correct themselves, so write the final version you hear. Check the word limit: 'NO MORE THAN TWO WORDS' means a three-word answer scores zero." },
  { k: /read/i, t: "Reading: skim each passage for structure first (about 2 minutes), then scan for keywords from each question. For True / False / Not Given, 'Not Given' means the passage doesn't say, not that it seems unlikely. Don't spend more than 20 minutes on a passage." },
  { k: /task ?1|graph|chart|map|process|diagram/i, t: "Writing Task 1: write an overview sentence with the main trends or biggest differences and no numbers. Then give two body paragraphs grouping the key features with precise data. Don't give opinions or causes. Aim for 170–190 words in about 20 minutes." },
  { k: /task ?2|essay|opinion|agree|discuss/i, t: "Writing Task 2: answer every part of the question and state your position in the introduction. Use two body paragraphs, each with one main idea, an explanation, and a specific example. Keep a clear position to the end. Aim for 260–290 words in about 40 minutes." },
  { k: /speak/i, t: "Speaking: extend every answer with a reason and an example. In Part 2, use your minute of notes for four keywords (who, what, when, why it matters) and keep talking until you're stopped. Fluency and coherence count as much as vocabulary, so don't pause to search for a perfect word." },
  { k: /band|score|improve|target/i, t: "Band scores: the overall band is the average of the four skills, rounded to the nearest half band. The fastest gains usually come from Writing Task Achievement (answer every part of the task) and from Listening spelling and word limits." }
];
