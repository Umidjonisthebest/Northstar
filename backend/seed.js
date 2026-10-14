import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { pathToFileURL } from "url";
import { readDB, writeDB } from "./db.js";
import { DEMO_EMAIL } from "./users.js";
import { passwordProblem } from "./validate.js";

function id() {
  return nanoid(10);
}

// Development logins, printed by the seed script. They are never created in production: there the
// admin comes from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (both required) and the demo account is
// only created when SEED_DEMO=1.
const DEV_ADMIN_PASSWORD = "admin123";
const DEV_TEACHER_EMAIL = "teacher@example.com";
const DEV_TEACHER_PASSWORD = "teacher123";
const DEV_STUDENT_PASSWORD = "student123";

// Adds what a fresh database needs and returns notes for the console. `env` is a parameter so the
// tests can run it as production without touching process.env. Throws when production has no admin
// login configured.
export function seedDatabase(db, env = process.env) {
  const production = env.NODE_ENV === "production";
  const notes = [];

  // --- Admin user -----------------------------------------------------------
  if (!db.users.find((u) => u.role === "admin")) {
    const email = (env.SEED_ADMIN_EMAIL || "admin@example.com").trim();
    const password = env.SEED_ADMIN_PASSWORD || (production ? "" : DEV_ADMIN_PASSWORD);
    if (production && (!env.SEED_ADMIN_PASSWORD || email.toLowerCase() === "admin@example.com")) {
      throw new Error("Production seed: set SEED_ADMIN_EMAIL (anything but admin@example.com) and SEED_ADMIN_PASSWORD (at least 8 characters). There is no default admin login in production.");
    }
    const weak = passwordProblem(password);
    if (weak) throw new Error(`SEED_ADMIN_PASSWORD: ${weak}`);
    db.users.push({
      id: id(),
      role: "admin",
      firstName: "Admin",
      lastName: "User",
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      createdAt: new Date().toISOString()
    });
    notes.push(
      env.SEED_ADMIN_PASSWORD
        ? `Seeded admin login for ${email} (password from SEED_ADMIN_PASSWORD)`
        : `Seeded DEV admin login -> email: ${email}  password: ${DEV_ADMIN_PASSWORD}  (development only)`
    );
  }

  // --- A teacher to try the teacher studio with -------------------------------
  // Development only. On a real site the admin makes teacher accounts in the admin panel
  // (Teachers), each with its own temporary password; there is no default teacher login.
  if (!production && !db.users.find((u) => u.role === "teacher")) {
    db.users.push({
      id: id(),
      role: "teacher",
      firstName: "Demo",
      lastName: "Teacher",
      email: DEV_TEACHER_EMAIL,
      passwordHash: bcrypt.hashSync(DEV_TEACHER_PASSWORD, 10),
      createdAt: new Date().toISOString()
    });
    notes.push(`Seeded DEV teacher login -> email: ${DEV_TEACHER_EMAIL}  password: ${DEV_TEACHER_PASSWORD}  (development only)`);
  }

  // --- Sample SAT test --------------------------------------------------------
  if (db.tests.length === 0) {
    const rwModuleId = id();
    const mathModuleId = id();

    const rwQuestions = [
      {
        id: id(),
        type: "mcq",
        order: 1,
        passage:
          "Marine biologists have long assumed that the deep sea, far from sunlight, supports little plant life. Recent expeditions, however, have documented algae mats thriving near hydrothermal vents, where chemical energy substitutes for the light that surface plants require.",
        prompt: "Which choice best states the main purpose of the text?",
        options: [
          "To argue that hydrothermal vents are dangerous to marine life",
          "To describe an unexpected finding that challenges a prior assumption",
          "To compare deep-sea algae with surface algae in detail",
          "To explain how sunlight reaches the deep sea"
        ],
        correctIndex: 1
      },
      {
        id: id(),
        type: "mcq",
        order: 2,
        passage:
          "The novelist revised her manuscript seven times, insisting that each draft revealed flaws invisible in the last. Critics later praised the finished novel for its ______ prose, unaware of the labor behind its apparent ease.",
        prompt: "Which choice completes the text with the most logical and precise word?",
        options: ["effortless", "chaotic", "unfinished", "predictable"],
        correctIndex: 0
      },
      {
        id: id(),
        type: "mcq",
        order: 3,
        passage:
          "Data from a 2023 transit study: Bus ridership rose 12% after fare-free days were introduced, while subway ridership rose only 3% over the same period, despite both systems serving similar neighborhoods.",
        prompt: "Which statement is most strongly supported by the data?",
        options: [
          "Fare-free days had a larger effect on bus ridership than on subway ridership.",
          "Subway ridership fell after fare-free days were introduced.",
          "Bus and subway ridership rose by identical amounts.",
          "Fare-free days had no measurable effect on ridership."
        ],
        correctIndex: 0
      },
      {
        id: id(),
        type: "mcq",
        order: 4,
        passage:
          "Although the committee approved the budget unanimously, several members privately expressed reservations about its long-term sustainability.",
        prompt:
          "Which choice best describes the function of the underlined portion in the text as a whole? (\"privately expressed reservations\")",
        options: [
          "It shows that the committee's public vote concealed private disagreement.",
          "It proves the budget was rejected.",
          "It shows that all members were fully confident in the budget.",
          "It is irrelevant to the committee's decision."
        ],
        correctIndex: 0
      }
    ];

    const mathQuestions = [
      {
        id: id(),
        type: "mcq",
        order: 1,
        prompt: "If 3x + 7 = 22, what is the value of x?",
        options: ["3", "5", "7", "15"],
        correctIndex: 1
      },
      {
        id: id(),
        type: "mcq",
        order: 2,
        prompt:
          "A line passes through the points (0, 4) and (2, 10). What is the slope of the line?",
        options: ["2", "3", "4", "6"],
        correctIndex: 1
      },
      {
        id: id(),
        type: "grid_in",
        order: 3,
        prompt:
          "The perimeter of a square is 36. What is the area of the square? (Enter a numeric value.)",
        correctAnswer: "81"
      },
      {
        id: id(),
        type: "grid_in",
        order: 4,
        prompt:
          "If f(x) = 2x^2 - 3, what is f(3)? (Enter a numeric value.)",
        correctAnswer: "15"
      }
    ];

    db.tests.push({
      id: id(),
      title: "SAT Practice Test 1",
      description: "Full-length digital SAT style practice test (sample core content).",
      createdAt: new Date().toISOString(),
      modules: [
        {
          id: rwModuleId,
          name: "Reading and Writing",
          order: 1,
          timeLimitMinutes: 32,
          questions: rwQuestions
        },
        {
          id: mathModuleId,
          name: "Math",
          order: 2,
          timeLimitMinutes: 35,
          questions: mathQuestions
        }
      ]
    });

    notes.push("Seeded sample test: SAT Practice Test 1");
  }

  // --- Demo student account + a ready-to-take session -------------------------
  // The "Try the demo" login. Not created in production unless SEED_DEMO=1. It is flagged `demo`, so
  // it is left out of leagues, rankings and the teacher's statistics (users.js isDemoUser).
  const wantDemo = env.SEED_DEMO === "1" || (!production && env.SEED_DEMO !== "0");
  if (wantDemo && !db.users.find((u) => u.role === "student" && (u.email || "").toLowerCase() === DEMO_EMAIL)) {
    const student = {
      id: id(),
      role: "student",
      firstName: "Demo",
      lastName: "Student",
      email: DEMO_EMAIL,
      candidateId: "101",
      passwordHash: bcrypt.hashSync(DEV_STUDENT_PASSWORD, 10),
      demo: true,
      createdAt: new Date().toISOString()
    };
    db.users.push(student);

    const test = db.tests[0];
    if (test) {
      const session = {
        id: id(),
        name: "Demo session",
        description: "Seeded session, ready to take.",
        studentLimit: 30,
        sessionDate: null,
        sessionTime: null,
        testId: test.id,
        status: "started",
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString()
      };
      db.sessions.push(session);
      db.participants.push({ id: id(), sessionId: session.id, userId: student.id, createdAt: new Date().toISOString() });
      notes.push(`Seeded demo student login -> email: ${DEMO_EMAIL}  password: ${DEV_STUDENT_PASSWORD} (already in a started session; kept out of leagues and statistics)`);
    }
  }
  return notes;
}

// Runs only as `npm run seed`, not when a test imports seedDatabase.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const db = readDB();
    for (const note of seedDatabase(db)) console.log(note);
    writeDB(db);
    console.log("Seed complete.");
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
