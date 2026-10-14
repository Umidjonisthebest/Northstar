// The Challenging tier, Math: the 45 Northstar originals from the owner's
// question pack (NS-M-001 … NS-M-045; each `key` is that id in lower case).
// Multiple choice and student-produced response, in digital-SAT format, on the
// question types that are hardest on the real test. The numbers and wording
// are original, and every answer was recomputed before it went in.
//
// The rest of that pack (its Easy, Medium and Hard files) is College Board
// question-bank material and is deliberately not in this repo.
//
// Same shape as mathClassic.js. The pack writes math as LaTeX; here it is the
// plain notation the player renders (see components/MathText.jsx).

const M = "Math";
const ALG = "Algebra";
const ADV = "Advanced Math";
const PSDA = "Problem-Solving and Data Analysis";
const GEO = "Geometry and Trigonometry";

function mcq(domain, topic, key, fields) {
  return { key, section: M, domain, topic, difficulty: "Challenging", type: "mcq", ...fields };
}
function grid(domain, topic, key, fields) {
  return { key, section: M, domain, topic, difficulty: "Challenging", type: "grid_in", ...fields };
}

export const CHALLENGING_MATH = [
  // =====================================================================
  // Algebra
  // =====================================================================
  mcq(ALG, "Linear equations in one variable", "ns-m-001", {
    title: "No solution, find k",
    prompt: "(3/4)(8x − 12) + kx = 5(x + 2) − 4x\nIn the given equation, k is a constant. The equation has no solution. What is the value of k?",
    options: ["−7", "−5", "5", "7"],
    correctIndex: 1,
    explanation:
      "Distributing on both sides gives 6x − 9 + kx = x + 10, so (5 + k)x = 19. A linear equation has no solution when the coefficient of x is 0 and the constants are not equal. That happens when 5 + k = 0, so k = −5.",
    rationales: [
      "With k = −7 the equation is −2x = 19, which has one solution. This comes from combining the x terms incorrectly.",
      "Correct. With k = −5 the equation becomes 0 = 19, which is never true, so there is no solution.",
      "A sign error. With k = 5 the equation is 10x = 19, which has one solution.",
      "With k = 7 the equation is 12x = 19, which has one solution. This comes from combining the x terms incorrectly."
    ],
    steps: [
      { title: "Distribute on the left", body: "(3/4)(8x − 12) = 6x − 9, so the left side is 6x − 9 + kx." },
      { title: "Simplify the right", body: "5(x + 2) − 4x = x + 10" },
      { title: "Collect the x terms", body: "6x + kx − x = 10 + 9  →  (5 + k)x = 19" },
      { title: "Use the no-solution condition", body: "There is no solution when the coefficient of x is 0: 5 + k = 0, so k = −5. Then 0 = 19, which is false." }
    ],
    hint: "Simplify both sides first. A linear equation has no solution when the x terms cancel but the constants don't."
  }),
  grid(ALG, "Linear equations in one variable", "ns-m-002", {
    title: "A repeated expression",
    prompt: "If (5/6)(4x − 7) − 3 = (1/2)(4x − 7) + 9, what is the value of 8x − 14?",
    correctAnswer: "72",
    explanation:
      "Treat 4x − 7 as one quantity, u. Then (5/6)u − 3 = (1/2)u + 9, so (1/3)u = 12 and u = 36. Since 8x − 14 = 2(4x − 7) = 2u, the value is 72. Solving for x first also works but takes longer.",
    steps: [
      { title: "Spot the repeated expression", body: "4x − 7 appears on both sides. Call it u." },
      { title: "Solve for u", body: "(5/6)u − 3 = (1/2)u + 9  →  (5/6 − 1/2)u = 12  →  (1/3)u = 12  →  u = 36" },
      { title: "Connect to what is asked", body: "8x − 14 = 2(4x − 7) = 2u = 72" }
    ],
    hint: "You don't need x. Notice that 8x − 14 is twice 4x − 7."
  }),
  mcq(ALG, "Linear functions", "ns-m-003", {
    title: "A slope given indirectly",
    prompt: "For the linear function f, f(2) = 11, and f(x + 3) − f(x) = −12 for every value of x. What is the value of f(−5)?",
    options: ["−17", "−9", "31", "39"],
    correctIndex: 3,
    explanation:
      "The value of f changes by −12 whenever x increases by 3, so the slope is −12/3 = −4. Going from x = 2 to x = −5 is a change of −7 in x, which changes f by (−4)(−7) = 28. So f(−5) = 11 + 28 = 39.",
    rationales: [
      "This uses a slope of 4 instead of −4: 11 + 4(−7) = −17.",
      "This subtracts 4 × 5 from 11. The change in x from 2 to −5 is −7, not 5, and with a negative slope f gets larger as x decreases.",
      "This uses a change of 5 in x: 11 + 4(5) = 31. From 2 down to −5 is 7 units.",
      "Correct. A slope of −4 and a change of −7 in x give a change of +28, so f(−5) = 11 + 28 = 39."
    ],
    steps: [
      { title: "Read the slope", body: "f(x + 3) − f(x) = −12 means f drops 12 for every 3 units of x. Slope = −12/3 = −4." },
      { title: "Measure the change in x", body: "From x = 2 to x = −5 is −5 − 2 = −7." },
      { title: "Apply it", body: "Change in f = (−4)(−7) = 28, so f(−5) = 11 + 28 = 39." }
    ],
    hint: "f(x + 3) − f(x) is the change in f when x goes up by 3. What does that tell you about the slope?"
  }),
  grid(ALG, "Linear functions", "ns-m-004", {
    title: "When the tank is empty",
    prompt:
      "Water drains from a tank at a constant rate. The tank holds 426 liters of water 6 minutes after draining begins and 318 liters of water 15 minutes after draining begins. How many minutes after draining begins will the tank be empty?",
    correctAnswer: "41.5",
    explanation:
      "The rate is (318 − 426)/(15 − 6) = −12 liters per minute. At the start the tank held 426 + 6(12) = 498 liters. The tank is empty when 498 − 12t = 0, so t = 498/12 = 41.5 minutes.",
    steps: [
      { title: "Find the rate", body: "(318 − 426) ÷ (15 − 6) = −108 ÷ 9 = −12 liters per minute." },
      { title: "Find the starting amount", body: "Six minutes earlier the tank held 426 + 6(12) = 498 liters." },
      { title: "Solve for empty", body: "498 − 12t = 0  →  t = 498 ÷ 12 = 41.5" }
    ],
    hint: "Two readings give you the rate. Then work back to how much water the tank held at time 0."
  }),
  mcq(ALG, "Linear equations in two variables", "ns-m-005", {
    title: "A perpendicular line's y-intercept",
    prompt:
      "In the xy-plane, line ℓ passes through the point (−2, 7) and is perpendicular to the line with equation 3x − 5y = 20. Line ℓ has equation y = mx + b, where m and b are constants. What is the value of b?",
    options: ["11/3", "31/3", "41/5", "29/5"],
    correctIndex: 0,
    explanation:
      "Rewriting 3x − 5y = 20 as y = (3/5)x − 4 shows its slope is 3/5. A perpendicular line has slope −5/3. Substituting (−2, 7) into y = −(5/3)x + b gives 7 = 10/3 + b, so b = 11/3.",
    rationales: [
      "Correct. The perpendicular slope is −5/3, and 7 = (−5/3)(−2) + b gives b = 7 − 10/3 = 11/3.",
      "This uses slope 5/3, the reciprocal without the sign change: 7 = −10/3 + b.",
      "This uses 3/5, the slope of a parallel line, not a perpendicular one.",
      "This uses slope −3/5. It changes the sign but doesn't take the reciprocal."
    ],
    steps: [
      { title: "Find the given line's slope", body: "3x − 5y = 20  →  y = (3/5)x − 4, so the slope is 3/5." },
      { title: "Take the negative reciprocal", body: "A perpendicular line has slope −5/3." },
      { title: "Substitute the point", body: "7 = (−5/3)(−2) + b  →  7 = 10/3 + b  →  b = 21/3 − 10/3 = 11/3" }
    ],
    hint: "Perpendicular slopes are negative reciprocals. Find the slope of 3x − 5y = 20 first."
  }),
  grid(ALG, "Linear equations in two variables", "ns-m-006", {
    title: "Intercepts that add to 33",
    prompt: "In the xy-plane, the graph of 7x + 4y = c, where c is a constant, has x-intercept (a, 0) and y-intercept (0, b). If a + b = 33, what is the value of c?",
    correctAnswer: "84",
    explanation: "Setting y = 0 gives a = c/7, and setting x = 0 gives b = c/4. Then c/7 + c/4 = 11c/28 = 33, so c = 84.",
    steps: [
      { title: "x-intercept", body: "Set y = 0: 7a = c, so a = c/7." },
      { title: "y-intercept", body: "Set x = 0: 4b = c, so b = c/4." },
      { title: "Use a + b = 33", body: "c/7 + c/4 = 4c/28 + 7c/28 = 11c/28 = 33  →  c = 33 × 28 ÷ 11 = 84" }
    ],
    hint: "Write each intercept in terms of c, then add them."
  }),
  mcq(ALG, "Systems of linear equations", "ns-m-007", {
    title: "Infinitely many solutions",
    prompt: "(3/4)x − (1/2)y = 6\n9x + py = q\nIn the given system of equations, p and q are constants. The system has infinitely many solutions. What is the value of p + q?",
    options: ["60", "66", "72", "78"],
    correctIndex: 1,
    explanation:
      "A system has infinitely many solutions when the two equations are equivalent. Multiplying the first equation by 12 gives 9x − 6y = 72, which matches the second equation when p = −6 and q = 72. So p + q = 66.",
    rationales: [
      "A sum of 60 would need p = −12, but 12 × (−1/2) is −6.",
      "Correct. Multiplying the first equation by 12 gives 9x − 6y = 72, so p = −6, q = 72 and p + q = 66.",
      "72 is q alone. The question asks for p + q.",
      "This treats p as 6. The y-coefficient is negative: p = −6."
    ],
    steps: [
      { title: "Know the condition", body: "Infinitely many solutions means the two equations describe the same line." },
      { title: "Scale the first equation", body: "To turn (3/4)x into 9x, multiply by 12: 9x − 6y = 72." },
      { title: "Match and add", body: "p = −6 and q = 72, so p + q = 66." }
    ],
    hint: "The second equation must be a multiple of the first. What do you multiply 3/4 by to get 9?"
  }),
  grid(ALG, "Systems of linear equations", "ns-m-008", {
    title: "Subtract, don't solve",
    prompt: "3x + 7y = 41\n7x + 3y = 59\nThe solution to the given system of equations is (x, y). What is the value of x − y?",
    correctAnswer: "4.5",
    explanation: "Subtracting the first equation from the second gives 4x − 4y = 18, so x − y = 18/4 = 4.5. There is no need to find x and y separately.",
    steps: [
      { title: "Look at what is asked", body: "x − y, not x and y separately." },
      { title: "Subtract the equations", body: "(7x + 3y) − (3x + 7y) = 59 − 41  →  4x − 4y = 18" },
      { title: "Divide by 4", body: "x − y = 18 ÷ 4 = 4.5" }
    ],
    hint: "The coefficients are swapped between the two equations. What happens if you subtract one from the other?"
  }),
  mcq(ALG, "Linear inequalities", "ns-m-009", {
    title: "The least integer k",
    prompt: "y < 3x − 10\ny > −(1/2)x + 1\nThe point (k, −1) is a solution to the given system of inequalities, where k is an integer. What is the least possible value of k?",
    options: ["3", "4", "5", "6"],
    correctIndex: 2,
    explanation:
      "Substituting y = −1 into the first inequality gives −1 < 3k − 10, so k > 3. Substituting into the second gives −1 > −(1/2)k + 1, so k > 4. Both must hold, so k > 4, and the least integer is 5.",
    rationales: [
      "3 is the boundary of the first inequality: −1 < 3(3) − 10 says −1 < −1, which is false.",
      "4 is the boundary of the second inequality: −1 > −(1/2)(4) + 1 says −1 > −1, which is false.",
      "Correct. Both inequalities require k > 4, and 5 is the least integer greater than 4.",
      "6 works, but 5 also works and is smaller."
    ],
    steps: [
      { title: "First inequality", body: "−1 < 3k − 10  →  9 < 3k  →  k > 3" },
      { title: "Second inequality", body: "−1 > −(1/2)k + 1  →  −2 > −(1/2)k  →  k > 4  (multiplying by −2 flips the sign)" },
      { title: "Combine", body: "Both must be true, so k > 4. The least integer is 5." }
    ],
    hint: "Put y = −1 into each inequality and solve for k. Remember that the inequalities are strict."
  }),
  grid(ALG, "Linear inequalities", "ns-m-010", {
    title: "Trays for a caterer",
    prompt:
      "A caterer needs at least 150 sandwiches and can spend at most $480 on trays. A small tray holds 12 sandwiches and costs $30. A large tray holds 20 sandwiches and costs $56. If the caterer buys exactly 4 large trays, what is the greatest number of small trays the caterer can buy?",
    correctAnswer: "8",
    explanation:
      "The 4 large trays cost 4(56) = $224, leaving 480 − 224 = $256. Since 256/30 ≈ 8.53, at most 8 small trays fit the budget. With 8 small trays there are 8(12) + 4(20) = 176 sandwiches, which meets the minimum of 150. So the greatest number is 8.",
    steps: [
      { title: "Spend on the large trays", body: "4 × $56 = $224, which leaves $480 − $224 = $256." },
      { title: "Fit small trays in the budget", body: "256 ÷ 30 ≈ 8.53, so at most 8 small trays." },
      { title: "Check the sandwich minimum", body: "8(12) + 4(20) = 96 + 80 = 176, which is at least 150." }
    ],
    hint: "Take out the cost of the 4 large trays first. Then see how many small trays the rest of the budget covers, and check the sandwich count."
  }),

  // =====================================================================
  // Advanced Math
  // =====================================================================
  mcq(ADV, "Nonlinear functions", "ns-m-011", {
    title: "A yearly growth rate",
    prompt:
      "The function P(t) = 1,800(1.06)^{t/4} models the number of insects in a colony t months after the colony was first observed. According to the model, the number of insects increases by p% every 12 months. What is the value of p, to the nearest tenth?",
    options: ["6.0", "18.0", "19.1", "26.2"],
    correctIndex: 2,
    explanation:
      "In 12 months the exponent t/4 increases by 3, so the number of insects is multiplied by (1.06)³ ≈ 1.191. That is an increase of about 19.1%.",
    rationales: [
      "6% is the increase every 4 months, not every 12.",
      "This adds 6% three times and ignores compounding.",
      "Correct. Twelve months is three 4-month periods: (1.06)³ ≈ 1.191, an increase of 19.1%.",
      "This uses (1.06)⁴ ≈ 1.262. Twelve months is three periods of 4 months, not four."
    ],
    steps: [
      { title: "Read the exponent", body: "t/4 goes up by 1 every 4 months, so the colony grows 6% every 4 months." },
      { title: "Count the periods in 12 months", body: "12 ÷ 4 = 3 periods." },
      { title: "Compound", body: "(1.06)³ ≈ 1.191, so p ≈ 19.1." }
    ],
    hint: "How much does the exponent t/4 change when t increases by 12?"
  }),
  grid(ADV, "Nonlinear functions", "ns-m-012", {
    title: "A parabola with a known minimum",
    prompt:
      "The function f is defined by f(x) = a(x − 3)(x + 9), where a is a constant. In the xy-plane, the graph of y = f(x) has a minimum value of −54. What is the value of f(5)?",
    correctAnswer: "42",
    explanation:
      "The zeros are 3 and −9, so the vertex is at x = (3 + (−9))/2 = −3. Then f(−3) = a(−6)(6) = −36a = −54, so a = 1.5. Therefore f(5) = 1.5(2)(14) = 42.",
    steps: [
      { title: "Locate the vertex", body: "The zeros are 3 and −9. The vertex is halfway between them: x = (3 − 9)/2 = −3." },
      { title: "Use the minimum to find a", body: "f(−3) = a(−6)(6) = −36a = −54  →  a = 1.5" },
      { title: "Evaluate", body: "f(5) = 1.5(5 − 3)(5 + 9) = 1.5(2)(14) = 42" }
    ],
    hint: "The minimum sits halfway between the two zeros. Use it to find a."
  }),
  grid(ADV, "Nonlinear functions", "ns-m-013", {
    title: "Absolute value with a condition",
    prompt: "The function f is defined by f(x) = |7 − 3x|. If f(a) = 11 and a < 0, what is the value of f(a + 6)?",
    correctAnswer: "7",
    explanation:
      "|7 − 3a| = 11 means 7 − 3a = 11 or 7 − 3a = −11, so a = −4/3 or a = 6. Since a < 0, a = −4/3. Then a + 6 = 14/3 and f(14/3) = |7 − 14| = 7.",
    steps: [
      { title: "Split into two cases", body: "7 − 3a = 11 gives a = −4/3. 7 − 3a = −11 gives a = 6." },
      { title: "Apply the condition", body: "a < 0, so a = −4/3." },
      { title: "Evaluate", body: "a + 6 = 14/3, and f(14/3) = |7 − 3(14/3)| = |7 − 14| = 7" }
    ],
    hint: "An absolute value equation gives two possible values of a. Only one of them is negative."
  }),
  mcq(ADV, "Nonlinear functions", "ns-m-014", {
    title: "Scaling a power formula",
    prompt:
      "The power P, in watts, used by a heating element is given by P = V²/R, where V is the voltage, in volts, and R is the resistance, in ohms. If the voltage is increased by 40% and the resistance is decreased by 20%, the power is multiplied by what number?",
    options: ["1.12", "1.57", "1.75", "2.45"],
    correctIndex: 3,
    explanation: "The new power is (1.4V)²/(0.8R) = (1.96/0.8)(V²/R) = 2.45P.",
    rationales: [
      "This multiplies 1.4 by 0.8. The voltage is squared, and the resistance is in the denominator.",
      "This multiplies 1.96 by 0.8 instead of dividing by it.",
      "This forgets to square 1.4: 1.4 ÷ 0.8 = 1.75.",
      "Correct. (1.4)² ÷ 0.8 = 1.96 ÷ 0.8 = 2.45."
    ],
    steps: [
      { title: "Write the new values", body: "Voltage becomes 1.4V. Resistance becomes 0.8R." },
      { title: "Substitute", body: "New power = (1.4V)² ÷ (0.8R) = 1.96V² ÷ (0.8R)" },
      { title: "Compare with the original", body: "1.96 ÷ 0.8 = 2.45, so the power is multiplied by 2.45." }
    ],
    hint: "Replace V with 1.4V and R with 0.8R. Remember that V is squared."
  }),
  grid(ADV, "Nonlinear equations and systems", "ns-m-015", {
    title: "A line touching a parabola",
    prompt:
      "y = 2x² − 7x + c\ny = 5x − 11\nIn the given system of equations, c is a constant. The graphs of the equations in the xy-plane intersect at exactly one point. What is the value of c?",
    correctAnswer: "7",
    explanation:
      "Setting the expressions equal gives 2x² − 12x + (c + 11) = 0. Exactly one intersection means the discriminant is 0: (−12)² − 4(2)(c + 11) = 0, so 144 = 8(c + 11) and c = 7.",
    steps: [
      { title: "Set the expressions equal", body: "2x² − 7x + c = 5x − 11  →  2x² − 12x + (c + 11) = 0" },
      { title: "Use the discriminant", body: "One intersection point means the discriminant is 0: (−12)² − 4(2)(c + 11) = 0" },
      { title: "Solve", body: "144 = 8(c + 11)  →  c + 11 = 18  →  c = 7" }
    ],
    hint: "Set the two right-hand sides equal. A quadratic has exactly one solution when its discriminant is 0."
  }),
  mcq(ADV, "Nonlinear equations and systems", "ns-m-016", {
    title: "A tangent line and vertex form",
    prompt: "y = a(x − 6)² + 2\ny = 2x − 14\nIn the given system of equations, a is a positive constant. The system has exactly one real solution. What is the value of a?",
    options: ["1/16", "1/8", "1/4", "4"],
    correctIndex: 2,
    explanation:
      "Setting the expressions equal and expanding gives ax² − (12a + 2)x + (36a + 16) = 0. For exactly one solution the discriminant is 0: (12a + 2)² − 4a(36a + 16) = 4 − 16a = 0, so a = 1/4.",
    rationales: [
      "With a = 1/16 the discriminant is 4 − 16(1/16) = 3, which gives two solutions.",
      "With a = 1/8 the discriminant is 4 − 16(1/8) = 2, which gives two solutions.",
      "Correct. The discriminant simplifies to 4 − 16a, which is 0 when a = 1/4.",
      "4 is the reciprocal of the correct value. With a = 4 the discriminant is negative, so there is no real solution."
    ],
    steps: [
      { title: "Set the expressions equal", body: "a(x − 6)² + 2 = 2x − 14  →  ax² − 12ax + 36a + 2 = 2x − 14" },
      { title: "Write it in standard form", body: "ax² − (12a + 2)x + (36a + 16) = 0" },
      { title: "Set the discriminant to 0", body: "(12a + 2)² − 4a(36a + 16) = 144a² + 48a + 4 − 144a² − 64a = 4 − 16a = 0  →  a = 1/4" }
    ],
    hint: "Set the two expressions equal and collect terms. Exactly one real solution means the discriminant is 0."
  }),
  grid(ADV, "Nonlinear equations and systems", "ns-m-017", {
    title: "A radical equation",
    prompt: "√(3x + 28) = x − 4\nWhat is the sum of all solutions to the given equation?",
    correctAnswer: "12",
    explanation:
      "Squaring both sides gives 3x + 28 = x² − 8x + 16, so x² − 11x − 12 = 0 and (x − 12)(x + 1) = 0. Checking in the original equation: x = 12 gives √64 = 8, which is true. x = −1 gives √25 = −5, which is false, so −1 is extraneous. The only solution is 12, so the sum is 12. An answer of 11 wrongly includes −1.",
    steps: [
      { title: "Square both sides", body: "3x + 28 = (x − 4)² = x² − 8x + 16" },
      { title: "Solve the quadratic", body: "x² − 11x − 12 = 0  →  (x − 12)(x + 1) = 0  →  x = 12 or x = −1" },
      { title: "Check both in the original equation", body: "x = 12: √64 = 8 and 12 − 4 = 8. True.\nx = −1: √25 = 5 but −1 − 4 = −5. False, so −1 is extraneous." },
      { title: "Add the solutions that remain", body: "Only 12 is a solution, so the sum is 12." }
    ],
    hint: "Squaring can create a solution that doesn't work in the original equation. Check each one."
  }),
  mcq(ADV, "Nonlinear equations and systems", "ns-m-018", {
    title: "A rational equation",
    prompt: "x/(x − 3) + 2/(x + 1) = 12/((x − 3)(x + 1))\nWhat are all solutions to the given equation?",
    options: ["−6 only", "3 only", "−6 and 3", "There are no solutions."],
    correctIndex: 0,
    explanation:
      "Multiplying both sides by (x − 3)(x + 1) gives x(x + 1) + 2(x − 3) = 12, so x² + 3x − 18 = 0 and (x + 6)(x − 3) = 0. The value x = 3 makes a denominator 0, so it is not a solution. The only solution is −6.",
    rationales: [
      "Correct. The quadratic gives −6 and 3, but 3 makes the denominator x − 3 equal to 0, so only −6 remains.",
      "3 makes the denominator x − 3 equal to 0, so it can't be a solution.",
      "Both values solve the quadratic, but 3 is not allowed in the original equation.",
      "−6 works: (−6)/(−9) + 2/(−5) = 2/3 − 2/5 = 4/15, and 12/45 = 4/15."
    ],
    steps: [
      { title: "Clear the denominators", body: "Multiply both sides by (x − 3)(x + 1): x(x + 1) + 2(x − 3) = 12" },
      { title: "Solve the quadratic", body: "x² + 3x − 18 = 0  →  (x + 6)(x − 3) = 0  →  x = −6 or x = 3" },
      { title: "Reject values that make a denominator 0", body: "x = 3 makes x − 3 = 0, so it is excluded. The only solution is −6." }
    ],
    hint: "Multiply through by the common denominator, then check whether any answer makes a denominator 0."
  }),
  mcq(ADV, "Equivalent expressions", "ns-m-019", {
    title: "The constant in a divisor",
    prompt: "(18x² + 27x − 31)/(kx − 2) = −6x − 5 − 41/(kx − 2)\nThe given equation is true for all values of x ≠ 2/k, where k is a constant. What is the value of k?",
    options: ["−6", "−3", "3", "6"],
    correctIndex: 1,
    explanation:
      "Multiplying both sides by kx − 2 gives 18x² + 27x − 31 = (−6x − 5)(kx − 2) − 41. The x² term on the right is −6kx², so −6k = 18 and k = −3. Only the leading coefficients need to be compared.",
    rationales: [
      "With k = −6 the x² term on the right would be 36x², not 18x².",
      "Correct. −6k = 18 gives k = −3, and (−6x − 5)(−3x − 2) − 41 = 18x² + 27x − 31.",
      "A sign error. With k = 3 the x² term on the right would be −18x².",
      "With k = 6 the x² term on the right would be −36x²."
    ],
    steps: [
      { title: "Clear the denominator", body: "Multiply both sides by kx − 2: 18x² + 27x − 31 = (−6x − 5)(kx − 2) − 41" },
      { title: "Compare the x² terms", body: "On the right, (−6x)(kx) = −6kx². So −6k = 18 and k = −3." },
      { title: "Check", body: "(−6x − 5)(−3x − 2) − 41 = 18x² + 12x + 15x + 10 − 41 = 18x² + 27x − 31" }
    ],
    hint: "Multiply both sides by kx − 2. You only need to match the coefficients of x²."
  }),
  grid(ADV, "Equivalent expressions", "ns-m-020", {
    title: "Factoring a cubic",
    prompt: "One of the factors of 4x³ − 44x² + 96x is x − b, where b is a positive constant. What is the greatest possible value of b?",
    correctAnswer: "8",
    explanation:
      "Factoring out 4x gives 4x(x² − 11x + 24) = 4x(x − 3)(x − 8). The factors of the form x − b with b > 0 are x − 3 and x − 8, so the greatest possible value of b is 8.",
    steps: [
      { title: "Factor out the common factor", body: "4x³ − 44x² + 96x = 4x(x² − 11x + 24)" },
      { title: "Factor the quadratic", body: "x² − 11x + 24 = (x − 3)(x − 8)" },
      { title: "Pick the greatest b", body: "The factors x − b with b > 0 are x − 3 and x − 8, so b = 8." }
    ],
    hint: "Take out the common factor 4x first, then factor what is left."
  }),
  mcq(ADV, "Equivalent expressions", "ns-m-021", {
    title: "Matching coefficients",
    prompt:
      "The equation (ax + 3)(bx + 5) = 12x² + cx + 15 is true for all values of x, where a, b, and c are constants. If a + b = 7, what is the greatest possible value of c?",
    options: ["27", "29", "35", "41"],
    correctIndex: 1,
    explanation:
      "Expanding gives abx² + (5a + 3b)x + 15, so ab = 12 and c = 5a + 3b. With a + b = 7 and ab = 12, the pair (a, b) is (3, 4) or (4, 3). These give c = 27 or c = 29, so the greatest possible value is 29.",
    rationales: [
      "27 comes from a = 3 and b = 4. It is a possible value of c, but not the greatest.",
      "Correct. a = 4 and b = 3 give c = 5(4) + 3(3) = 29, the larger of the two possible values.",
      "35 is 5(a + b). The middle coefficient is 5a + 3b, not 5a + 5b.",
      "No pair with a + b = 7 and ab = 12 gives 41."
    ],
    steps: [
      { title: "Expand the left side", body: "(ax + 3)(bx + 5) = abx² + (5a + 3b)x + 15" },
      { title: "Match coefficients", body: "ab = 12 and c = 5a + 3b." },
      { title: "Find a and b", body: "a + b = 7 and ab = 12 give (a, b) = (3, 4) or (4, 3)." },
      { title: "Compare the two values of c", body: "(3, 4): 15 + 12 = 27. (4, 3): 20 + 9 = 29. The greatest is 29." }
    ],
    hint: "Expand the left side and match it to the right. You get ab = 12 along with a + b = 7."
  }),
  mcq(ADV, "Equivalent expressions", "ns-m-022", {
    title: "A common base",
    prompt: "If 2x + 3y = 8, what is the value of 4^{x} · 8^{y}?",
    options: ["64", "256", "4,096", "The value cannot be determined from the information given."],
    correctIndex: 1,
    explanation: "Since 4 = 2² and 8 = 2³, 4^{x} · 8^{y} = 2^{2x} · 2^{3y} = 2^{2x + 3y} = 2⁸ = 256. The values of x and y are not needed.",
    rationales: [
      "64 is 2⁶. The exponent is 2x + 3y = 8, not 6.",
      "Correct. 4^{x} · 8^{y} = 2^{2x + 3y} = 2⁸ = 256.",
      "4,096 is 2¹². The exponents 2x and 3y are added, giving 8.",
      "x and y aren't needed separately. The expression depends only on 2x + 3y, which is given."
    ],
    steps: [
      { title: "Rewrite with base 2", body: "4 = 2² and 8 = 2³, so 4^{x} = 2^{2x} and 8^{y} = 2^{3y}." },
      { title: "Multiply by adding exponents", body: "2^{2x} · 2^{3y} = 2^{2x + 3y}" },
      { title: "Substitute", body: "2x + 3y = 8, so the value is 2⁸ = 256." }
    ],
    hint: "Write 4 and 8 as powers of 2."
  }),
  grid(ADV, "Equivalent expressions", "ns-m-023", {
    title: "Radicals as exponents",
    prompt: "If ∛(x⁵) · √(x³) = x^{k/6} for all positive values of x, what is the value of k?",
    correctAnswer: "19",
    explanation: "∛(x⁵) = x^{5/3} and √(x³) = x^{3/2}. Multiplying adds the exponents: 5/3 + 3/2 = 10/6 + 9/6 = 19/6. So k = 19.",
    steps: [
      { title: "Rewrite each radical", body: "∛(x⁵) = x^{5/3} and √(x³) = x^{3/2}" },
      { title: "Add the exponents", body: "5/3 + 3/2 = 10/6 + 9/6 = 19/6" },
      { title: "Match", body: "x^{19/6} = x^{k/6}, so k = 19." }
    ],
    hint: "A cube root is the power 1/3 and a square root is the power 1/2."
  }),

  // =====================================================================
  // Problem-Solving and Data Analysis
  // =====================================================================
  mcq(PSDA, "Ratios, rates, and units", "ns-m-024", {
    title: "Three linked wheels",
    prompt:
      "In a machine, wheel A drives wheel B, and wheel B drives wheel C. For every 5 turns of wheel A, wheel B makes 8 turns. For every 6 turns of wheel B, wheel C makes 15 turns. If wheel A turns at 90 revolutions per minute, at how many revolutions per minute does wheel C turn?",
    options: ["57.6", "144", "225", "360"],
    correctIndex: 3,
    explanation: "Wheel B turns at 90 × 8/5 = 144 revolutions per minute. Wheel C turns at 144 × 15/6 = 360 revolutions per minute.",
    rationales: [
      "This inverts the second ratio: 144 × 6/15 = 57.6.",
      "144 is the speed of wheel B. One more step gets to wheel C.",
      "This applies the B-to-C ratio straight to wheel A: 90 × 15/6 = 225. Wheel B's speed comes first.",
      "Correct. A to B: 90 × 8/5 = 144. B to C: 144 × 15/6 = 360."
    ],
    steps: [
      { title: "From A to B", body: "B makes 8 turns for every 5 of A: 90 × 8/5 = 144 revolutions per minute." },
      { title: "From B to C", body: "C makes 15 turns for every 6 of B: 144 × 15/6 = 360 revolutions per minute." }
    ],
    hint: "Go one wheel at a time: find wheel B's speed first."
  }),
  grid(PSDA, "Ratios, rates, and units", "ns-m-025", {
    title: "Filling a tank",
    prompt:
      "Water flows into a tank at a rate of 4.5 cubic feet per second. At this rate, how many minutes does it take to fill an empty tank that holds 16,200 gallons? (1 cubic foot = 7.5 gallons)",
    correctAnswer: "8",
    explanation: "The rate is 4.5(7.5) = 33.75 gallons per second. Filling 16,200 gallons takes 16,200/33.75 = 480 seconds, which is 480/60 = 8 minutes.",
    steps: [
      { title: "Convert the rate to gallons", body: "4.5 × 7.5 = 33.75 gallons per second." },
      { title: "Find the time in seconds", body: "16,200 ÷ 33.75 = 480 seconds." },
      { title: "Convert to minutes", body: "480 ÷ 60 = 8 minutes." }
    ],
    hint: "There are two conversions: cubic feet to gallons, and seconds to minutes."
  }),
  mcq(PSDA, "Percentages", "ns-m-026", {
    title: "Two percents of the same number",
    prompt: "The number x is 60% less than the positive number y. The number z is 150% greater than y. The number z is how many times x?",
    options: ["2.50", "3.75", "4.17", "6.25"],
    correctIndex: 3,
    explanation: "x = y − 0.6y = 0.4y and z = y + 1.5y = 2.5y. So z/x = 2.5y/0.4y = 6.25.",
    rationales: [
      "2.50 is how many times y the number z is. The question compares z with x.",
      "This uses z = 1.5y, reading \"150% greater than\" as \"150% of.\"",
      "This uses x = 0.6y. \"60% less than y\" leaves 40% of y.",
      "Correct. x = 0.4y and z = 2.5y, so z ÷ x = 2.5 ÷ 0.4 = 6.25."
    ],
    steps: [
      { title: "Write x in terms of y", body: "60% less than y: x = y − 0.6y = 0.4y" },
      { title: "Write z in terms of y", body: "150% greater than y: z = y + 1.5y = 2.5y" },
      { title: "Divide", body: "z ÷ x = 2.5y ÷ 0.4y = 6.25" }
    ],
    hint: "\"60% less than\" and \"150% greater than\" both start from y. Write x and z as multiples of y."
  }),
  grid(PSDA, "Percentages", "ns-m-027", {
    title: "Up 25%, then down p%",
    prompt: "The price of an item was increased by 25%. The new price was then decreased by p%. The final price is 10% less than the original price. What is the value of p?",
    correctAnswer: "28",
    explanation:
      "Let the original price be 1. After the increase it is 1.25. After the decrease it is 1.25(1 − p/100) = 0.90, so 1 − p/100 = 0.72 and p = 28. An answer of 35 adds and subtracts the percents, which is not valid because they apply to different amounts.",
    steps: [
      { title: "Apply the increase", body: "Start with a price of 1. After a 25% increase it is 1.25." },
      { title: "Set up the decrease", body: "1.25(1 − p/100) = 0.90, because the final price is 10% below the original." },
      { title: "Solve", body: "1 − p/100 = 0.90 ÷ 1.25 = 0.72  →  p = 28" }
    ],
    hint: "Use multipliers: a 25% increase is × 1.25. The second change applies to the new price, not the original."
  }),
  mcq(PSDA, "One-variable data", "ns-m-028", {
    title: "Mean of a combined set",
    prompt:
      "Data set A consists of 12 values with a mean of 45. Data set B consists of 18 values with a mean of m. When the two data sets are combined, the mean of the 30 values is 51. What is the value of m?",
    options: ["53", "55", "57", "60"],
    correctIndex: 1,
    explanation: "The sums are 12(45) = 540 for A and 30(51) = 1,530 for the combined set. So set B has a sum of 1,530 − 540 = 990, and m = 990/18 = 55.",
    rationales: [
      "With m = 53 the combined mean would be (540 + 954) ÷ 30 = 49.8, not 51.",
      "Correct. Set B's sum is 1,530 − 540 = 990, and 990 ÷ 18 = 55.",
      "This assumes 51 is halfway between the two means. The sets have different sizes, so the means aren't weighted equally.",
      "With m = 60 the combined mean would be (540 + 1,080) ÷ 30 = 54, not 51."
    ],
    steps: [
      { title: "Turn means into sums", body: "Set A: 12 × 45 = 540. Combined: 30 × 51 = 1,530." },
      { title: "Find set B's sum", body: "1,530 − 540 = 990" },
      { title: "Divide by its size", body: "m = 990 ÷ 18 = 55" }
    ],
    hint: "A mean times the number of values gives the sum. Work with sums."
  }),
  mcq(PSDA, "One-variable data", "ns-m-029", {
    title: "Raising the greatest value",
    prompt:
      "A data set consists of 15 different integers. The greatest integer in the data set is then increased by 30. Which of the following must be true?\n\nI. The mean of the data set increases by 2.\nII. The median of the data set does not change.\nIII. The standard deviation of the data set does not change.",
    options: ["I only", "I and II only", "II and III only", "I, II, and III"],
    correctIndex: 1,
    explanation:
      "The sum increases by 30, so the mean increases by 30/15 = 2, and statement I is true. The median is the 8th value in order, and the greatest value stays the greatest, so the median does not change, and statement II is true. The greatest value moves farther from the others, so the spread, and therefore the standard deviation, increases, and statement III is false.",
    rationales: [
      "Statement I is true, but so is II: the middle value of the ordered list isn't touched.",
      "Correct. The mean rises by 30 ÷ 15 = 2 and the median stays the same, but the standard deviation increases.",
      "Statement III is false, because the greatest value moves farther from the rest. Statement I is true and is missing here.",
      "Statement III is false. Moving the greatest value farther from the others increases the spread."
    ],
    steps: [
      { title: "Statement I", body: "The sum goes up by 30, spread over 15 values: the mean rises by 30 ÷ 15 = 2. True." },
      { title: "Statement II", body: "The median is the 8th of 15 ordered values. Only the greatest value changed, and it is still the greatest. True." },
      { title: "Statement III", body: "The greatest value is now farther from the rest, so the spread grows and the standard deviation increases. False." }
    ],
    hint: "Check the three statements one at a time. Which measures depend on every value, and which only on the middle one?"
  }),
  mcq(PSDA, "Two-variable data", "ns-m-030", {
    title: "What the 1.5 means",
    prompt:
      "The function N(t) = 320(1.5)^{t/2} models the number of bacteria in a sample t hours after an experiment begins. Which of the following is the best interpretation of the number 1.5 in this context?",
    options: [
      "The number of bacteria increases by 1.5 every 2 hours.",
      "The number of bacteria increases by 50% every hour.",
      "The number of bacteria increases by 50% every 2 hours.",
      "The number of bacteria increases by 150% every 2 hours."
    ],
    correctIndex: 2,
    explanation:
      "When t increases by 2, the exponent t/2 increases by 1, so the number of bacteria is multiplied by 1.5. Multiplying by 1.5 is an increase of 50%. So the number increases by 50% every 2 hours.",
    rationales: [
      "1.5 is a multiplier, not an amount added. The number of bacteria is multiplied by 1.5 every 2 hours.",
      "This ignores the t/2 in the exponent. The exponent goes up by 1 every 2 hours, not every hour.",
      "Correct. Every 2 hours the number is multiplied by 1.5, which is a 50% increase.",
      "Multiplying by 1.5 is a 50% increase. A 150% increase would mean multiplying by 2.5."
    ],
    steps: [
      { title: "Find when the exponent goes up by 1", body: "t/2 increases by 1 when t increases by 2, so the period is 2 hours." },
      { title: "Turn the multiplier into a percent", body: "Multiplying by 1.5 means 150% of the previous amount, an increase of 50%." },
      { title: "Put them together", body: "The number of bacteria increases by 50% every 2 hours." }
    ],
    hint: "How many hours does it take for the exponent t/2 to go up by 1?"
  }),
  grid(PSDA, "Two-variable data", "ns-m-031", {
    title: "Reading a line of best fit backwards",
    prompt:
      "A line of best fit for a scatterplot passes through the points (4, 31) and (10, 52). According to this line, for what value of x is the predicted value of y equal to 94?",
    correctAnswer: "22",
    explanation:
      "The slope is (52 − 31)/(10 − 4) = 3.5. From the point (10, 52), y must increase by 94 − 52 = 42, which takes an increase of 42/3.5 = 12 in x. So x = 10 + 12 = 22.",
    steps: [
      { title: "Find the slope", body: "(52 − 31) ÷ (10 − 4) = 21 ÷ 6 = 3.5" },
      { title: "Find how far y has to rise", body: "From (10, 52), y must go up by 94 − 52 = 42." },
      { title: "Convert that to a change in x", body: "42 ÷ 3.5 = 12, so x = 10 + 12 = 22." }
    ],
    hint: "Find the slope from the two points, then work out how much x must change for y to reach 94."
  }),
  mcq(PSDA, "Probability", "ns-m-032", {
    title: "An incomplete two-way table",
    table: {
      title: "Juniors and seniors, by whether they take physics",
      columns: ["", "Takes physics", "Does not take physics", "Total"],
      rows: [
        ["Juniors", "", "", "130"],
        ["Seniors", "", "", "50"]
      ]
    },
    prompt:
      "The incomplete table summarizes the juniors and seniors at a school by whether they take physics. There are 2 times as many juniors who take physics as seniors who take physics, and there are 3 times as many juniors who do not take physics as seniors who do not take physics. If a student who takes physics is selected at random, what is the probability that the student is a senior?",
    options: ["1/9", "1/3", "2/5", "2/3"],
    correctIndex: 1,
    explanation:
      "Let a be the number of seniors who take physics and b the number who do not. Then a + b = 50 and 2a + 3b = 130. Subtracting twice the first equation from the second gives b = 30, so a = 20. There are 2(20) = 40 juniors who take physics, so 60 students take physics in all. The probability is 20/60 = 1/3.",
    rationales: [
      "This divides the 20 seniors who take physics by all 180 students. The student is chosen only from those who take physics.",
      "Correct. 20 seniors and 40 juniors take physics, so the probability is 20/60 = 1/3.",
      "This is the probability that a senior takes physics (20 of 50), which is a different condition.",
      "This is the probability that the student is a junior: 40/60."
    ],
    steps: [
      { title: "Name the unknowns", body: "Let a = seniors who take physics and b = seniors who don't. Then a + b = 50." },
      { title: "Use the junior row", body: "Juniors: 2a take physics and 3b don't, so 2a + 3b = 130." },
      { title: "Solve", body: "Subtract twice the first equation from the second: b = 30, so a = 20." },
      { title: "Find the probability", body: "Physics students: 20 seniors + 40 juniors = 60. P(senior) = 20/60 = 1/3." }
    ],
    hint: "Fill in the table first. Let the two senior cells be a and b, and write the junior cells in terms of them."
  }),
  grid(PSDA, "Probability", "ns-m-033", {
    title: "Striped marbles",
    prompt:
      "In a bag of marbles, 40% of the marbles are red and the rest are blue. Of the red marbles, 25% are striped. Of the blue marbles, 10% are striped. If a striped marble is selected at random, what is the probability that it is red?",
    correctAnswer: "5/8",
    explanation:
      "Suppose there are 100 marbles. Then 40 are red and 60 are blue. The striped marbles are 0.25(40) = 10 red and 0.10(60) = 6 blue, for 16 in all. The probability that a striped marble is red is 10/16 = 5/8.",
    steps: [
      { title: "Pick a convenient total", body: "Suppose there are 100 marbles: 40 red and 60 blue." },
      { title: "Count the striped ones", body: "Red: 25% of 40 = 10. Blue: 10% of 60 = 6. Striped in all: 16." },
      { title: "Condition on striped", body: "P(red, given striped) = 10/16 = 5/8" }
    ],
    hint: "Imagine 100 marbles and count how many striped marbles of each color there are."
  }),
  mcq(PSDA, "Sample statistics and margin of error", "ns-m-034", {
    title: "From a sample to a town",
    prompt:
      "A town has 12,000 residents. In a random sample of 400 residents, 37% said they support a new park. The margin of error for this estimate is 4%. Which of the following is the most appropriate conclusion?",
    options: [
      "Exactly 4,440 residents of the town support the new park.",
      "Between 132 and 164 residents of the town support the new park.",
      "It is plausible that between 3,960 and 4,920 residents of the town support the new park.",
      "At least 4,920 residents of the town support the new park."
    ],
    correctIndex: 2,
    explanation:
      "The plausible range for the whole town is 37% ± 4%, or 33% to 41%. That is 0.33(12,000) = 3,960 to 0.41(12,000) = 4,920 residents.",
    rationales: [
      "This treats the sample result as exact. A sample gives an estimate with a margin of error.",
      "This applies 33% to 41% to the 400 people in the sample. The conclusion is about all 12,000 residents.",
      "Correct. 37% ± 4% is 33% to 41%, and 33% to 41% of 12,000 is 3,960 to 4,920.",
      "4,920 is the top of the plausible range, not a minimum."
    ],
    steps: [
      { title: "Build the interval", body: "37% ± 4% gives 33% to 41%." },
      { title: "Apply it to the town", body: "0.33 × 12,000 = 3,960 and 0.41 × 12,000 = 4,920." },
      { title: "Choose the wording", body: "A margin of error gives a plausible range, not an exact count, so \"it is plausible that between 3,960 and 4,920\" is right." }
    ],
    hint: "Find the range of percents first, then apply it to the whole town, not to the sample."
  }),
  mcq(PSDA, "Sample statistics and margin of error", "ns-m-035", {
    title: "Is a majority plausible?",
    prompt:
      "In a random sample of 500 voters in a city, 46% said they favor a ballot measure. The margin of error for this estimate is 4.4%. Which of the following statements is best supported by these results?",
    options: [
      "Fewer than half of all voters in the city favor the measure.",
      "Exactly 46% of all voters in the city favor the measure.",
      "Between 41.6% and 50.4% of the voters in the sample favor the measure.",
      "It is plausible that a majority of all voters in the city favor the measure."
    ],
    correctIndex: 3,
    explanation:
      "The plausible range for all voters is 46% ± 4.4%, or 41.6% to 50.4%. Because the range includes values above 50%, a majority is plausible.",
    rationales: [
      "Too strong. The plausible range runs up to 50.4%, so more than half is still possible.",
      "A sample estimate isn't exact for the whole city. That is what the margin of error is for.",
      "In the sample the percent is known to be exactly 46%. The margin of error is about all voters in the city.",
      "Correct. The plausible range is 41.6% to 50.4%, which includes values above 50%."
    ],
    steps: [
      { title: "Build the interval", body: "46% ± 4.4% gives 41.6% to 50.4%." },
      { title: "Compare with 50%", body: "The interval reaches just above 50%, so a majority can't be ruled out." },
      { title: "Check who the interval is about", body: "It describes all voters in the city, not the 500 people sampled." }
    ],
    hint: "Work out the range the margin of error gives. Does it include anything above 50%?"
  }),
  mcq(PSDA, "Studies and experiments", "ns-m-036", {
    title: "Volunteers from one gym",
    prompt:
      "A researcher recruited 200 volunteers who are all members of the same gym. Each volunteer was randomly assigned to take either a supplement or a placebo for 8 weeks. At the end of the study, the supplement group showed significantly greater improvement in grip strength than the placebo group. Which of the following is the most appropriate conclusion?",
    options: [
      "The supplement will improve grip strength for any adult who takes it.",
      "No conclusion about cause and effect can be drawn, because the participants were volunteers.",
      "The supplement group was stronger than the placebo group before the study began.",
      "The supplement likely caused the greater improvement for people similar to the volunteers in the study."
    ],
    correctIndex: 3,
    explanation:
      "Random assignment to the two groups allows a cause-and-effect conclusion. But the participants were volunteers from one gym, not a random sample of all adults, so the result can be generalized only to people like them.",
    rationales: [
      "The volunteers all came from one gym, so the result can't be extended to every adult.",
      "Random assignment, not random sampling, is what supports a cause-and-effect conclusion, and this study had it.",
      "Random assignment makes the two groups alike, on average, before the study begins.",
      "Correct. Random assignment supports cause and effect, but only for people like the volunteers."
    ],
    steps: [
      { title: "Was there random assignment?", body: "Yes. Each volunteer was randomly assigned to the supplement or the placebo, so a cause-and-effect conclusion is supported." },
      { title: "Was there random sampling?", body: "No. The participants were volunteers from one gym, so the result applies only to people like them." },
      { title: "Combine", body: "Cause and effect, limited to people similar to the volunteers." }
    ],
    hint: "Ask two separate questions: were people randomly assigned to groups, and were they randomly selected from a larger population?"
  }),
  mcq(PSDA, "Studies and experiments", "ns-m-037", {
    title: "Pet owners and life satisfaction",
    prompt:
      "A researcher surveyed a random sample of 1,000 adults in a city. Adults in the sample who own a pet reported higher life satisfaction, on average, than adults who do not own a pet. Which of the following conclusions is best supported?",
    options: [
      "Among adults in the city, pet ownership is associated with higher reported life satisfaction.",
      "Owning a pet causes adults in the city to have higher life satisfaction.",
      "Adults in any city who own a pet have higher life satisfaction.",
      "Adults with higher life satisfaction are more likely to adopt a pet."
    ],
    correctIndex: 0,
    explanation:
      "The sample was chosen at random from the city's adults, so the result can be generalized to adults in that city. But people were not randomly assigned to own a pet, so the study shows an association, not a cause.",
    rationales: [
      "Correct. A random sample of the city's adults supports a conclusion about adults in that city, and without random assignment that conclusion is an association.",
      "No one was randomly assigned to own a pet, so the study can't show that pets cause the difference.",
      "The sample came from one city, so the result can't be extended to every city.",
      "This claims a cause in the other direction. The study can't establish a direction of cause at all."
    ],
    steps: [
      { title: "Was there random sampling?", body: "Yes, from adults in the city. The result can be generalized to adults in that city." },
      { title: "Was there random assignment?", body: "No. People chose whether to own a pet, so only an association can be claimed." },
      { title: "Combine", body: "An association, among adults in the city." }
    ],
    hint: "Random sampling decides who the result applies to. Random assignment decides whether you can say \"causes.\""
  }),

  // =====================================================================
  // Geometry and Trigonometry
  // =====================================================================
  grid(GEO, "Area and volume", "ns-m-038", {
    title: "Similar cones",
    prompt:
      "Two right circular cones are similar. The volume of the smaller cone is 54π cubic centimeters, and the volume of the larger cone is 250π cubic centimeters. The lateral surface area of the smaller cone is 72π square centimeters, and the lateral surface area of the larger cone is kπ square centimeters. What is the value of k?",
    correctAnswer: "200",
    explanation:
      "The ratio of the volumes is 250π/54π = 125/27, so the ratio of corresponding lengths is ∛(125/27) = 5/3. Areas scale by the square of that ratio, 25/9. So the larger lateral surface area is 72π × 25/9 = 200π, and k = 200.",
    steps: [
      { title: "Compare the volumes", body: "250π ÷ 54π = 125/27" },
      { title: "Find the length scale factor", body: "Volumes scale by the cube of the scale factor: ∛(125/27) = 5/3." },
      { title: "Scale the area", body: "Areas scale by the square: (5/3)² = 25/9, and 72π × 25/9 = 200π. So k = 200." }
    ],
    hint: "For similar solids, volumes scale by the cube of the scale factor and areas by the square."
  }),
  mcq(GEO, "Area and volume", "ns-m-039", {
    title: "A cube with a hole drilled through",
    prompt:
      "A solid cube has edges of length 6. A cylindrical hole with radius 2 is drilled completely through the cube, perpendicular to two opposite faces. What is the total surface area of the resulting solid, including the inside of the hole?",
    options: ["216 − 8π", "216 + 16π", "216 + 24π", "216 − 24π"],
    correctIndex: 1,
    explanation:
      "The cube has surface area 6(36) = 216. Drilling removes a circle of area 4π from each of two faces, a loss of 8π. It adds the lateral surface of a cylinder with radius 2 and height 6, which is 2π(2)(6) = 24π. The total is 216 − 8π + 24π = 216 + 16π.",
    rationales: [
      "This removes the two circles but leaves out the inside surface of the hole.",
      "Correct. 216 − 8π for the two circles removed, plus 24π for the inside of the hole: 216 + 16π.",
      "This adds the inside of the hole but forgets the two circles removed from the faces.",
      "This subtracts the wall of the hole. That surface is added, not removed."
    ],
    steps: [
      { title: "Start with the cube", body: "6 faces × 6² = 216" },
      { title: "Subtract the two openings", body: "Each is a circle of area π(2)² = 4π, so subtract 8π." },
      { title: "Add the inside of the hole", body: "A cylinder wall with radius 2 and height 6: 2π(2)(6) = 24π." },
      { title: "Total", body: "216 − 8π + 24π = 216 + 16π" }
    ],
    hint: "Drilling changes the surface in two ways: it removes two circles and adds the wall of the hole."
  }),
  grid(GEO, "Lines, angles, and triangles", "ns-m-040", {
    title: "Area of a similar triangle",
    prompt:
      "Triangle ABC is similar to triangle DEF, where A, B, and C correspond to D, E, and F, respectively. AB = 12 and DE = 18. If the area of triangle ABC is 60, what is the area of triangle DEF?",
    correctAnswer: "135",
    explanation:
      "The ratio of corresponding sides is 18/12 = 3/2. Areas of similar figures scale by the square of that ratio, 9/4. So the area of triangle DEF is 60 × 9/4 = 135. An answer of 90 scales the area by 3/2 instead of its square.",
    steps: [
      { title: "Find the scale factor", body: "DE ÷ AB = 18 ÷ 12 = 3/2" },
      { title: "Square it for area", body: "(3/2)² = 9/4" },
      { title: "Scale the area", body: "60 × 9/4 = 135" }
    ],
    hint: "Areas of similar figures scale by the square of the side ratio."
  }),
  mcq(GEO, "Lines, angles, and triangles", "ns-m-041", {
    title: "An exterior angle",
    prompt:
      "In triangle PQR, the measure of angle P is (2x + 15)° and the measure of angle Q is (3x + 11)°. An exterior angle at vertex R has measure (7x − 4)°. What is the measure, in degrees, of angle R in the triangle?",
    options: ["45", "56", "79", "101"],
    correctIndex: 2,
    explanation:
      "An exterior angle of a triangle equals the sum of the two remote interior angles: 7x − 4 = (2x + 15) + (3x + 11), so 2x = 30 and x = 15. The exterior angle is 7(15) − 4 = 101°, so the interior angle at R is 180° − 101° = 79°.",
    rationales: [
      "45° is the measure of angle P.",
      "56° is the measure of angle Q.",
      "Correct. x = 15, the exterior angle is 101°, and the interior angle at R is 180° − 101° = 79°.",
      "101° is the exterior angle at R. The interior angle is its supplement."
    ],
    steps: [
      { title: "Use the exterior angle theorem", body: "An exterior angle equals the sum of the two remote interior angles: 7x − 4 = (2x + 15) + (3x + 11)" },
      { title: "Solve for x", body: "7x − 4 = 5x + 26  →  2x = 30  →  x = 15" },
      { title: "Find the exterior angle", body: "7(15) − 4 = 101°" },
      { title: "Find the interior angle", body: "180° − 101° = 79°" }
    ],
    hint: "An exterior angle of a triangle equals the sum of the two interior angles that aren't next to it."
  }),
  grid(GEO, "Right triangles and trigonometry", "ns-m-042", {
    title: "Altitude to the hypotenuse",
    prompt:
      "In right triangle ABC, angle B is a right angle, AB = 15, and BC = 20. Point D lies on side AC so that segment BD is perpendicular to side AC. What is the length of segment BD?",
    correctAnswer: "12",
    explanation:
      "By the Pythagorean theorem, AC = √(15² + 20²) = 25. The area of the triangle is (1/2)(15)(20) = 150. Using AC as the base and BD as the height, (1/2)(25)(BD) = 150, so BD = 12.",
    steps: [
      { title: "Find the hypotenuse", body: "AC = √(15² + 20²) = √625 = 25" },
      { title: "Find the area", body: "The legs are perpendicular: (1/2)(15)(20) = 150" },
      { title: "Use the other base and height", body: "(1/2)(25)(BD) = 150  →  BD = 12" }
    ],
    hint: "Write the triangle's area two ways: with the legs, and with the hypotenuse as the base."
  }),
  mcq(GEO, "Right triangles and trigonometry", "ns-m-043", {
    title: "Sine equals cosine",
    prompt: "Two acute angles have measures x° and (3x − 14)°. If sin(x°) = cos((3x − 14)°), what is the value of x?",
    options: ["19", "26", "38", "52"],
    correctIndex: 1,
    explanation:
      "For acute angles, the sine of one angle equals the cosine of another only when the two angles are complementary. So x + (3x − 14) = 90, which gives 4x = 104 and x = 26. The second angle is then 64°, and 26 + 64 = 90.",
    rationales: [
      "With x = 19 the angles are 19° and 43°, which add to 62°, not 90°.",
      "Correct. x + (3x − 14) = 90 gives x = 26, and the angles are 26° and 64°.",
      "With x = 38 the second angle would be 100°, which isn't acute.",
      "With x = 52 the second angle would be 142°, which isn't acute."
    ],
    steps: [
      { title: "Use the cofunction rule", body: "For acute angles, sin(A°) = cos(B°) when A + B = 90." },
      { title: "Set up the equation", body: "x + (3x − 14) = 90" },
      { title: "Solve and check", body: "4x = 104  →  x = 26. The angles are 26° and 64°, which add to 90°." }
    ],
    hint: "The sine of an acute angle equals the cosine of its complement."
  }),
  mcq(GEO, "Circles", "ns-m-044", {
    title: "A vertical tangent line",
    prompt:
      "3x² + 3y² − 24x + 18y − 33 = 0\nIn the xy-plane, the graph of the given equation is a circle. The line with equation x = k, where k is a positive constant, is tangent to the circle. What is the value of k?",
    options: ["2", "6", "10", "12"],
    correctIndex: 2,
    explanation:
      "Dividing by 3 gives x² − 8x + y² + 6y = 11. Completing the square gives (x − 4)² + (y + 3)² = 11 + 16 + 9 = 36, so the center is (4, −3) and the radius is 6. A vertical tangent line is 6 units from the center, at x = 4 + 6 = 10 or x = 4 − 6 = −2. Since k is positive, k = 10.",
    rationales: [
      "The other vertical tangent is x = −2, which isn't positive. 2 drops the sign.",
      "6 is the radius, not the position of the tangent line.",
      "Correct. The center is (4, −3) and the radius is 6, so the vertical tangent with positive k is x = 4 + 6 = 10.",
      "12 is the diameter."
    ],
    steps: [
      { title: "Divide by 3", body: "x² + y² − 8x + 6y − 11 = 0" },
      { title: "Complete the square", body: "(x − 4)² + (y + 3)² = 11 + 16 + 9 = 36, so the center is (4, −3) and the radius is 6." },
      { title: "Place the vertical tangents", body: "They are 6 units left and right of the center: x = −2 and x = 10. Since k is positive, k = 10." }
    ],
    hint: "Divide by 3 and complete the square to find the center and radius. A vertical tangent is one radius away from the center."
  }),
  grid(GEO, "Circles", "ns-m-045", {
    title: "From arc length to sector area",
    prompt:
      "In a circle with center O, central angle AOB has a measure of 5π/9 radians. The length of arc AB is 20π. The area of sector AOB is kπ. What is the value of k?",
    correctAnswer: "360",
    explanation: "Arc length is rθ, so r × 5π/9 = 20π and r = 36. The area of a sector is (1/2)r²θ = (1/2)(36²)(5π/9) = 360π. So k = 360.",
    steps: [
      { title: "Find the radius", body: "Arc length = rθ: r × 5π/9 = 20π  →  r = 36" },
      { title: "Find the sector area", body: "Area = (1/2)r²θ = (1/2)(36²)(5π/9) = 648 × 5π/9 = 360π" },
      { title: "Read off k", body: "k = 360" }
    ],
    hint: "Use arc length = rθ to find the radius, then area = (1/2)r²θ."
  })
];
