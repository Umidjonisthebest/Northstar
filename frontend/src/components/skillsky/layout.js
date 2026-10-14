// The skill constellation map's layout. Every skill is a star and every domain a constellation in
// its own panel. Positions are placed by hand and never move, so a student learns where things
// are, the way one learns the real sky. Coordinates are in the panel's own box (PANEL, by section):
// the same drawing is used at every screen size, only the number of panels per row changes.
// `lines` joins stars by their index in the constellation. `hue` tints the panel, its lines and
// its name. The skill names must match SKILLS in backend/practiceSkills.js (skillsky.test in the
// backend checks this file; a name that isn't found here simply isn't drawn, and the list view
// still shows it).

export const PANEL = {
  "Reading & Writing": { w: 300, h: 280 },
  Math: { w: 300, h: 430 }
};

const C = (section, domain, hue, stars, lines) => ({ section, domain, hue, stars, lines });
const RW = "Reading & Writing";

export const CONSTELLATIONS = [
  C(RW, "Information and Ideas", "#f7a8d8", { "Central Ideas and Details": [70, 180], "Command of Evidence": [150, 92], Inferences: [232, 170] }, [[0, 1], [1, 2], [2, 0]]),
  C(RW, "Craft and Structure", "#e0a6f2", { "Words in Context": [64, 100], "Text Structure and Purpose": [150, 182], "Cross-Text Connections": [236, 94] }, [[0, 1], [1, 2]]),
  C(RW, "Expression of Ideas", "#c9a8ff", { "Rhetorical Synthesis": [88, 180], Transitions: [212, 100] }, [[0, 1]]),
  C(RW, "Standard English Conventions", "#f3b3cd", { Boundaries: [86, 102], "Form, Structure, and Sense": [214, 178] }, [[0, 1]]),
  C(
    "Math",
    "Algebra",
    "#9fc2ff",
    {
      "Linear equations in one variable": [50, 150],
      "Linear equations in two variables": [100, 272],
      "Linear functions": [150, 160],
      "Systems of linear equations": [200, 282],
      "Linear inequalities": [250, 150]
    },
    [[0, 1], [1, 2], [2, 3], [3, 4]]
  ),
  C("Math", "Advanced Math", "#aab4ff", { "Equivalent expressions": [66, 140], "Nonlinear equations and systems": [150, 290], "Nonlinear functions": [234, 150] }, [[0, 1], [1, 2]]),
  C(
    "Math",
    "Problem-Solving and Data Analysis",
    "#93d2ff",
    {
      "Ratios, rates, and units": [76, 136],
      Percentages: [150, 90],
      "One-variable data": [224, 136],
      "Two-variable data": [243, 243],
      Probability: [192, 327],
      "Sample statistics and margin of error": [108, 327],
      "Studies and experiments": [57, 243]
    },
    [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]]
  ),
  C("Math", "Geometry and Trigonometry", "#b9aaff", { "Area and volume": [150, 100], "Lines, angles, and triangles": [236, 210], "Right triangles and trigonometry": [150, 330], Circles: [64, 210] }, [[0, 1], [1, 2], [2, 3], [3, 0]])
];

// Short names drawn under each star, on up to two lines (the full name is in the detail card and
// the list). Keep a line to about eleven characters: neighbouring stars are 80 units apart.
export const SHORT = {
  "Central Ideas and Details": "Central\nideas",
  "Command of Evidence": "Evidence",
  Inferences: "Inferences",
  "Words in Context": "Words in\ncontext",
  "Text Structure and Purpose": "Structure",
  "Cross-Text Connections": "Cross-text",
  "Rhetorical Synthesis": "Synthesis",
  Transitions: "Transitions",
  Boundaries: "Boundaries",
  "Form, Structure, and Sense": "Form &\nsense",
  "Linear equations in one variable": "Linear:\n1 variable",
  "Linear equations in two variables": "Linear:\n2 variables",
  "Linear functions": "Linear\nfunctions",
  "Systems of linear equations": "Systems",
  "Linear inequalities": "Inequalities",
  "Equivalent expressions": "Expressions",
  "Nonlinear equations and systems": "Nonlinear\nequations",
  "Nonlinear functions": "Nonlinear\nfunctions",
  "Ratios, rates, and units": "Ratios &\nrates",
  Percentages: "Percentages",
  "One-variable data": "1-variable\ndata",
  "Two-variable data": "2-variable\ndata",
  Probability: "Probability",
  "Sample statistics and margin of error": "Sampling",
  "Studies and experiments": "Studies",
  "Area and volume": "Area &\nvolume",
  "Lines, angles, and triangles": "Angles &\ntriangles",
  "Right triangles and trigonometry": "Trigonometry",
  Circles: "Circles"
};

// What each state is called, and how the star is drawn (radius in panel units).
export const STATE_INFO = {
  new: { label: "New", note: "Not tried yet", r: 10 },
  started: { label: "Started", note: "A few answers so far", r: 12 },
  learning: { label: "Learning", note: "Under 70% so far", r: 14 },
  strong: { label: "Strong", note: "70% or more", r: 16 },
  mastered: { label: "Mastered", note: "90% or more over 10+ answers", r: 18 }
};
export const STATE_ORDER = ["new", "started", "learning", "strong", "mastered"];
