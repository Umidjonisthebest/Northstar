// The original hand-written Math starter questions, upgraded with per-option
// rationales and step-by-step explanations. `legacyTitle` lets databases that
// were seeded before 2026-09-27 upgrade these in place (same id and progress).

const M = "Math";

function q(domain, topic, difficulty, key, fields) {
  return { key, section: M, domain, topic, difficulty, type: "mcq", legacyTitle: fields.title, ...fields };
}

export const MATH_CLASSIC = [
  q("Algebra", "Linear equations in two variables", "Easy", "mc-01", {
    title: "A line through two points",
    prompt: "A line passes through (2, 5) and (6, 13). What is its slope?",
    options: ["1/2", "2", "4", "8"],
    correctIndex: 1,
    explanation: "Slope = (13 − 5)/(6 − 2) = 8/4 = 2.",
    rationales: [
      "This is run ÷ rise (4 ÷ 8). Slope is rise ÷ run.",
      "Correct. (13 − 5) ÷ (6 − 2) = 8 ÷ 4 = 2.",
      "4 is the change in x (the run), not the slope.",
      "8 is the change in y (the rise). Divide it by the run."
    ],
    steps: [
      { title: "Rise", body: "13 − 5 = 8" },
      { title: "Run", body: "6 − 2 = 4" },
      { title: "Slope = rise ÷ run", body: "8 ÷ 4 = 2" }
    ],
    hint: "Slope = (change in y) ÷ (change in x)."
  }),
  q("Advanced Math", "Nonlinear equations and systems", "Hard", "mc-02", {
    title: "The quadratic in disguise",
    prompt: "If x² − 7x + 12 = 0 and x > 3, what is the value of x?",
    options: ["2", "3", "4", "6"],
    correctIndex: 2,
    explanation: "x² − 7x + 12 = (x − 3)(x − 4), so x = 3 or x = 4. Since x > 3, x = 4.",
    rationales: [
      "2 doesn't satisfy the equation: 4 − 14 + 12 = 2, not 0.",
      "3 is a solution, but the question requires x > 3.",
      "Correct. The solutions are 3 and 4, and only 4 is greater than 3.",
      "6 doesn't satisfy the equation: 36 − 42 + 12 = 6, not 0."
    ],
    steps: [
      { title: "Factor", body: "Find two numbers that multiply to 12 and add to −7: −3 and −4.\n(x − 3)(x − 4) = 0" },
      { title: "Solve", body: "x = 3 or x = 4" },
      { title: "Apply the condition", body: "x > 3, so x = 4." }
    ],
    hint: "Factor the quadratic, then use the condition x > 3."
  }),
  q("Problem-Solving and Data Analysis", "Percentages", "Medium", "mc-03", {
    legacyTitle: "A table with a hidden rate",
    title: "Percent increase on a price",
    prompt: "A price increases from $80 to $100. What is the percent increase?",
    options: ["20%", "25%", "80%", "125%"],
    correctIndex: 1,
    explanation: "Increase = $20. Percent increase = 20 ÷ 80 = 0.25 = 25%. Always divide by the original value.",
    rationales: [
      "This divides the $20 increase by the new price, $100. Percent change divides by the original, $80.",
      "Correct. 20 ÷ 80 = 0.25 = 25%.",
      "80% is the old price as a percent of the new price.",
      "125% is the new price as a percent of the old price, not the increase."
    ],
    steps: [
      { title: "Find the change", body: "$100 − $80 = $20" },
      { title: "Divide by the original", body: "20 ÷ 80 = 0.25" },
      { title: "Convert to a percent", body: "0.25 = 25%" }
    ],
    hint: "Percent change = change ÷ original value."
  }),
  q("Algebra", "Systems of linear equations", "Medium", "mc-04", {
    title: "Add the equations",
    prompt: "If x + y = 10 and x − y = 4, what is the value of x?",
    options: ["3", "6", "7", "14"],
    correctIndex: 2,
    explanation: "Add the equations: 2x = 14, so x = 7 (and y = 3).",
    rationales: [
      "3 is the value of y.",
      "6 is 10 − 4, which is 2y, not x.",
      "Correct. Adding gives 2x = 14, so x = 7.",
      "14 is 2x. Divide by 2."
    ],
    steps: [
      { title: "Add the equations", body: "(x + y) + (x − y) = 10 + 4\n2x = 14" },
      { title: "Solve", body: "x = 7" },
      { title: "Check", body: "y = 10 − 7 = 3, and 7 − 3 = 4, which matches." }
    ],
    hint: "Adding the two equations makes y disappear."
  }),
  q("Algebra", "Linear functions", "Easy", "mc-05", {
    title: "Reading a function",
    prompt: "A gym charges a $25 sign-up fee plus $15 per month. Which function gives the total cost C, in dollars, after m months?",
    options: ["C = 25m + 15", "C = 15m + 25", "C = 40m", "C = 15m − 25"],
    correctIndex: 1,
    explanation: "The $15 is charged each month (slope) and the $25 is charged once (intercept): C = 15m + 25.",
    rationales: [
      "This swaps the monthly rate and the one-time fee.",
      "Correct. $15 per month times m, plus the one-time $25.",
      "This charges the $25 fee every month.",
      "The sign-up fee adds to the cost; it isn't subtracted."
    ],
    steps: [
      { title: "Rate", body: "$15 each month → 15m" },
      { title: "One-time amount", body: "$25 once → + 25" },
      { title: "Assemble", body: "C = 15m + 25" }
    ],
    hint: "Which amount repeats every month, and which is paid once?"
  }),
  q("Geometry and Trigonometry", "Right triangles and trigonometry", "Medium", "mc-06", {
    title: "Right triangle shortcut",
    prompt: "A right triangle has legs of length 6 and 8. What is the length of the hypotenuse?",
    figure: { kind: "right", base: "8", height: "6", hyp: "?" },
    options: ["10", "12", "14", "48"],
    correctIndex: 0,
    explanation: "6² + 8² = 36 + 64 = 100, and √100 = 10 (a scaled 3-4-5 triangle).",
    rationales: [
      "Correct. 6² + 8² = 100, and √100 = 10.",
      "12 doesn't satisfy the Pythagorean theorem: 6² + 8² ≠ 12².",
      "14 is 6 + 8. The theorem adds squares, not lengths.",
      "48 is 6 × 8 (twice the area), not a side length."
    ],
    steps: [
      { title: "Pythagorean theorem", body: "a² + b² = c²" },
      { title: "Substitute", body: "6² + 8² = 36 + 64 = 100" },
      { title: "Square root", body: "c = √100 = 10" }
    ],
    hint: "a² + b² = c². Or recognize a multiple of 3-4-5."
  }),
  q("Problem-Solving and Data Analysis", "One-variable data", "Easy", "mc-07", {
    title: "The mean of a data set",
    prompt: "The data set 4, 7, 9, 10, x has a mean of 8. What is x?",
    options: ["8", "9", "10", "12"],
    correctIndex: 2,
    explanation: "The sum must be 5 × 8 = 40. 4 + 7 + 9 + 10 = 30, so x = 10.",
    rationales: [
      "The missing value doesn't have to equal the mean.",
      "With x = 9 the sum would be 39, and 39 ÷ 5 = 7.8.",
      "Correct. The total must be 40, and the known values add to 30.",
      "With x = 12 the sum would be 42, and 42 ÷ 5 = 8.4."
    ],
    steps: [
      { title: "Total from the mean", body: "5 values × 8 = 40" },
      { title: "Known values", body: "4 + 7 + 9 + 10 = 30" },
      { title: "Subtract", body: "x = 40 − 30 = 10" }
    ],
    hint: "Mean × number of values = total."
  }),
  q("Advanced Math", "Equivalent expressions", "Medium", "mc-08", {
    title: "Exponent rules",
    prompt: "Which expression is equivalent to (x³)² · x⁴?",
    options: ["x⁹", "x¹⁰", "x²⁴", "x¹²"],
    correctIndex: 1,
    explanation: "(x³)² = x⁶, and x⁶ · x⁴ = x¹⁰.",
    rationales: [
      "This adds all three exponents (3 + 2 + 4). A power of a power multiplies.",
      "Correct. (x³)² = x⁶, then x⁶ · x⁴ = x¹⁰.",
      "This multiplies all three exponents. Multiplying powers with the same base adds exponents.",
      "This multiplies 3 by (2 + 2); the 4 belongs to a separate factor."
    ],
    steps: [
      { title: "Power of a power", body: "(x³)² = x⁶ (multiply 3 × 2)" },
      { title: "Same base, multiplied", body: "x⁶ · x⁴ = x¹⁰ (add 6 + 4)" },
      { title: "Answer", body: "x¹⁰" }
    ],
    hint: "Power of a power: multiply exponents. Product of powers: add them."
  }),
  q("Geometry and Trigonometry", "Circles", "Hard", "mc-09", {
    title: "Complete the square",
    prompt: "The circle x² + y² − 6x + 4y = 12 has what radius?",
    options: ["√12", "5", "25", "13"],
    correctIndex: 1,
    explanation: "(x − 3)² − 9 + (y + 2)² − 4 = 12 → (x − 3)² + (y + 2)² = 25, so r = 5.",
    rationales: [
      "√12 uses the constant before completing the square.",
      "Correct. After completing the square, r² = 25, so r = 5.",
      "25 is r², not r.",
      "13 is 9 + 4, the constants added while completing the square, without the 12."
    ],
    steps: [
      { title: "Complete the square in x", body: "x² − 6x = (x − 3)² − 9" },
      { title: "Complete the square in y", body: "y² + 4y = (y + 2)² − 4" },
      { title: "Collect", body: "(x − 3)² + (y + 2)² = 12 + 9 + 4 = 25, so r = 5." }
    ],
    hint: "Complete the square for x and y, then compare with (x − h)² + (y − k)² = r²."
  }),
  q("Problem-Solving and Data Analysis", "Ratios, rates, and units", "Easy", "mc-10", {
    title: "Scale up the recipe",
    prompt: "A recipe uses 3 cups of flour for every 2 cups of sugar. How many cups of flour are needed with 8 cups of sugar?",
    options: ["5⅓", "10", "12", "16"],
    correctIndex: 2,
    explanation: "8 cups of sugar is 4 × 2, so flour = 4 × 3 = 12 cups.",
    rationales: [
      "This flips the ratio (8 × 2/3). Keep flour : sugar = 3 : 2.",
      "This adds 6 to the flour because 6 was added to the sugar. Ratios scale by multiplying.",
      "Correct. The sugar is multiplied by 4, so the flour is too: 3 × 4 = 12.",
      "This doubles the sugar amount instead of using the ratio."
    ],
    steps: [
      { title: "Scale factor", body: "8 ÷ 2 = 4" },
      { title: "Scale the flour", body: "3 × 4 = 12" },
      { title: "Check", body: "12 : 8 = 3 : 2, which matches." }
    ],
    hint: "How many times bigger is 8 than 2?"
  }),
  q("Advanced Math", "Nonlinear functions", "Hard", "mc-11", {
    title: "Doubling time",
    prompt: "A bacteria population doubles every 3 hours. Starting from 500, which expression gives the population after t hours?",
    options: ["500 · 2^{3t}", "500 · 2^{t/3}", "500 · 3^{t/2}", "500 + 2t/3"],
    correctIndex: 1,
    explanation: "The number of doublings in t hours is t/3, so P = 500 · 2^(t/3).",
    rationales: [
      "This doubles 3 times every hour instead of once every 3 hours.",
      "Correct. There are t/3 doublings in t hours.",
      "This swaps the factor (2) and the doubling time (3).",
      "This is linear growth. Doubling is exponential."
    ],
    steps: [
      { title: "Count the doublings", body: "One doubling every 3 hours → t/3 doublings in t hours." },
      { title: "Multiply by 2 each time", body: "500 · 2 · 2 · ... (t/3 times)" },
      { title: "Write it", body: "500 · 2^(t/3)" }
    ],
    hint: "How many 3-hour periods are there in t hours?"
  }),
  q("Algebra", "Linear inequalities", "Medium", "mc-12", {
    title: "Flip the sign",
    prompt: "Which value of x satisfies −2x + 5 > 11?",
    options: ["−4", "−3", "0", "3"],
    correctIndex: 0,
    explanation: "−2x > 6 → x < −3 (dividing by a negative flips the sign). Only −4 is less than −3.",
    rationales: [
      "Correct. The inequality simplifies to x < −3, and −4 < −3.",
      "At x = −3 both sides are equal, and the inequality is strict.",
      "0 is not less than −3.",
      "This comes from forgetting to flip the sign (x > −3 would allow 3)."
    ],
    steps: [
      { title: "Subtract 5", body: "−2x > 6" },
      { title: "Divide by −2 and flip", body: "x < −3" },
      { title: "Test the choices", body: "Only −4 is less than −3." }
    ],
    hint: "What happens to the inequality sign when you divide by a negative number?"
  })
];
