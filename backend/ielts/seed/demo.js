// IELTS demo data: demo candidates, five sessions (three completed with results,
// one started, one upcoming) and a fresh copy of the starter tests.
// Only the IELTS collections are replaced — Northstar's SAT tests, sessions,
// practice data and existing accounts are left alone. db.json is backed up first.
//   npm run seed:ielts
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { DB_PATH, readDB, writeDB } from "../../db.js";
import { nextCandidateId } from "../../users.js";
import { SECTIONS, buildSectionContent, ensureExam, startSection, submitSection } from "../lib/exam.js";
import { groupSlots, multiCount } from "../lib/questions.js";
import { ensureIeltsPractice, ensureIeltsPracticeTests, starterContent } from "./starter.js";

let seed = 20260926;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (list) => list[Math.floor(rand() * list.length)];

// Demo candidates keep candidate IDs 121–145 when those are free.
const FIRST_CANDIDATE_ID = 121;
const STUDENTS = [
  ["Nodira", "Karimova"], ["Jasur", "Tursunov"], ["Dilnoza", "Rashidova"], ["Bekzod", "Aliyev"], ["Malika", "Yusupova"],
  ["Otabek", "Nazarov"], ["Shahzoda", "Ergasheva"], ["Aziz", "Rahimov"], ["Kamola", "Saidova"], ["Timur", "Abdullayev"],
  ["Zarina", "Mirzayeva"], ["Ulugbek", "Hasanov"], ["Laylo", "Qodirova"], ["Sanjar", "Umarov"], ["Madina", "Islomova"],
  ["Doniyor", "Xolmatov"], ["Gulnoza", "Sobirova"], ["Akmal", "Jurayev"], ["Sevara", "Tojiyeva"], ["Farrukh", "Ismoilov"],
  ["Nilufar", "Botirova"], ["Rustam", "Qosimov"], ["Mohira", "Ahmedova"], ["Sherzod", "Norboyev"], ["Anora", "Latipova"]
];
// Northstar's demo student (npm run seed) joins two sessions so the student hub shows IELTS too.
const HUB_DEMO_EMAIL = "student@example.com";

const ESSAYS = [
  "The bar chart compares the proportion of adults in different age groups who gave money to charity in 2004 and 2024. Overall, older people were more likely to donate in both years, although the gap between the age groups narrowed over the period. In 2004, the figure rose steadily with age, from 38% among 18 to 24 year olds to 72% among those aged 65 and over. By 2024, the youngest group had become more generous, with 45% donating, while the percentages for the three middle groups all fell slightly. The oldest group remained the most generous, at 74%.",
  "In today's job market, some people believe that staying with one employer for their entire career is the best choice, while others argue that changing jobs regularly brings more benefits. In my opinion, both approaches have advantages, but moving between organisations is usually more rewarding for young professionals. On the one hand, loyalty to one company can bring security and a clear path to promotion. Employees who stay for many years understand the organisation deeply and are often trusted with important responsibilities. On the other hand, changing employers allows people to learn new skills, meet different colleagues and negotiate higher salaries. In conclusion, I believe that a few well-planned job changes can help people grow faster, although this depends on each person's goals.",
  "The line graph illustrates how many hours per week three age groups spent online from 2010 to 2025. It is clear that internet use increased in all three groups, and that younger people spent the most time online throughout the period. People aged 16 to 24 went from 12 hours a week in 2010 to 29 hours in 2025. The 25 to 44 group followed a similar pattern, rising from 8 to 22 hours. Although the over-45s started from a much lower point of only 3 hours, their usage grew fivefold to reach 15 hours by the end of the period.",
  "More and more people in cities now travel to work by bicycle. This essay will discuss the main advantages of this trend and consider some possible drawbacks. The most obvious benefit is for health, because cycling is regular exercise that reduces the risk of heart disease. It also helps the environment, since bicycles produce no pollution and reduce traffic in city centres. However, there are some disadvantages. Cyclists are vulnerable on busy roads, and accidents can be serious. In addition, bad weather can make cycling uncomfortable. Overall, I believe the advantages are greater, especially if cities build safe cycle lanes."
];

const WRONG_WORDS = ["garden", "library", "ticket", "river", "Monday", "window", "market", "coffee", "25", "blue", "station", "letter"];

function isoAt(date, time, addMinutes = 0) {
  const d = new Date(`${date}T${time}:00`);
  d.setMinutes(d.getMinutes() + addMinutes);
  return d.toISOString();
}

// Local calendar date (session dates/times are wall-clock values, like the admin form).
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const notAfter = (iso, limit) => (iso < limit ? iso : limit);

// Fills a section with plausible answers: each question is right with probability `skill`.
function simulateAnswers(db, exam, section, skill) {
  const answers = {};
  if (section === "writing") {
    for (const id of exam.assignment.writing) {
      const prompt = db.ieltsWriting.find((w) => w.id === id).questionHtml;
      answers[id] = /charity/.test(prompt) ? ESSAYS[0] : /online/.test(prompt) ? ESSAYS[2] : /organisation/.test(prompt) ? ESSAYS[1] : ESSAYS[3];
    }
    return answers;
  }
  for (const part of buildSectionContent(db, exam, section, { withAnswers: true }).parts) {
    for (const g of part.groups) {
      const slots = groupSlots(g);
      if (slots[0]?.mode === "multi") {
        for (const item of g.items) {
          const n = multiCount(item);
          const chosen = item.correct.filter(() => rand() < skill);
          const wrong = item.options.map((o) => o.key).filter((k) => !item.correct.includes(k));
          while (chosen.length < n) chosen.push(wrong[chosen.length % wrong.length]);
          answers[item.id] = chosen.slice(0, n);
        }
        continue;
      }
      for (const s of slots) {
        const right = g.answers[s.id]?.value;
        if (rand() < skill) {
          answers[s.id] = right;
        } else if (rand() < 0.15) {
          continue;
        } else if (s.mode === "text") {
          answers[s.id] = pick(WRONG_WORDS);
        } else {
          const pool =
            g.type === "tfng" ? ["TRUE", "FALSE", "NOT GIVEN"] : g.type === "ynng" ? ["YES", "NO", "NOT GIVEN"] : (g.items?.find((i) => i.id === s.id)?.options || g.options || []).map((o) => o.key);
          answers[s.id] = pick(pool.filter((k) => k !== right)) ?? right;
        }
      }
    }
  }
  return answers;
}

function runExam(db, session, userId, { skill, sections = SECTIONS, day, time }) {
  const exam = ensureExam(db, session, userId);
  let minute = 0;
  for (const section of sections) {
    if (!exam.assignment[section]?.length) continue;
    startSection(db, exam, section);
    exam.sections[section].answers = simulateAnswers(db, exam, section, skill);
    const attemptsBefore = db.ieltsAttempts.length;
    submitSection(db, exam, section);
    const length = section === "listening" ? 22 + Math.round(rand() * 6) : 45 + Math.round(rand() * 14);
    const startedAt = isoAt(day, time, minute + 3);
    const submittedAt = isoAt(day, time, minute + 3 + length);
    Object.assign(exam.sections[section], { startedAt, submittedAt, deadline: submittedAt });
    for (const a of db.ieltsAttempts.slice(attemptsBefore)) Object.assign(a, { startedAt, completedAt: submittedAt });
    minute += length + 5;
  }
  if (exam.step === "done") exam.completedAt = isoAt(day, time, minute);
  return exam;
}

function scoreManually(exam, skill, day, time) {
  const base = 4 + skill * 4;
  const band = (offset) => Math.max(3, Math.min(9, Math.round((base + offset) * 2) / 2));
  const updatedAt = isoAt(day, time, 240);
  exam.scores.writing = { band: band(-0.5 + rand()), notes: pick(["Clear overview; watch article use.", "Good range of vocabulary, some run-on sentences.", "Task response needs a clearer position."]), updatedAt };
  exam.scores.speaking = { band: band(rand() - 0.25), notes: pick(["Fluent, occasional hesitation.", "Good pronunciation; extend Part 3 answers.", "Limited range in Part 2."]), updatedAt };
}

// Finds a demo candidate by email or creates one, preferring candidate ID `preferred`.
function upsertStudent(db, firstName, lastName, preferred, now) {
  const email = `${firstName}.${lastName}`.toLowerCase() + "@example.com";
  const phone = `+998 9${Math.floor(rand() * 10)} ${String(100 + Math.floor(rand() * 900))} ${String(10 + Math.floor(rand() * 90))} ${String(10 + Math.floor(rand() * 90))}`;
  let user = db.users.find((u) => u.role === "student" && (u.email || "").toLowerCase() === email);
  if (!user) {
    const taken = db.users.some((u) => String(u.candidateId) === String(preferred));
    user = { id: nanoid(10), role: "student", firstName, lastName, email, phone, status: "active", candidateId: taken ? nextCandidateId(db) : String(preferred), createdAt: now };
    db.users.push(user);
  }
  return user;
}

function main() {
  // This script fills the database with demo candidates and resets all IELTS data. It has no place
  // on a live site, and it would create the well-known admin login below.
  if (process.env.NODE_ENV === "production") {
    console.error("seed:ielts is demo data and resets the IELTS collections; it refuses to run with NODE_ENV=production.");
    process.exit(1);
  }
  if (fs.existsSync(DB_PATH)) {
    const backup = DB_PATH.replace(/\.json$/, `.backup-${Date.now()}.json`);
    fs.copyFileSync(DB_PATH, backup);
    console.log(`Backed up the database to ${path.basename(backup)}`);
  }
  const db = readDB();
  const now = new Date().toISOString();

  if (!db.users.some((u) => u.role === "admin")) {
    db.users.push({ id: nanoid(10), role: "admin", firstName: "Admin", lastName: "User", email: "admin@example.com", passwordHash: bcrypt.hashSync("admin123", 10), createdAt: now });
    console.log("Created admin login -> admin@example.com / admin123");
  }

  Object.assign(db, starterContent(), { ieltsSessions: [], ieltsExams: [], ieltsAttempts: [], ieltsPracticeAttempts: [], ieltsDiagnostics: [] });
  ensureIeltsPractice(db);
  // The content lists were just replaced, and the practice tests' own parts went with them.
  ensureIeltsPracticeTests(db);

  // Demo candidates, addressed below by their preferred candidate ID (121–145).
  const byNumber = new Map(STUDENTS.map(([first, last], i) => [FIRST_CANDIDATE_ID + i, upsertStudent(db, first, last, FIRST_CANDIDATE_ID + i, now)]));
  const hubStudent = db.users.find((u) => u.role === "student" && (u.email || "").toLowerCase() === HUB_DEMO_EMAIL) || null;
  // The hub student goes first: the last candidate of a completed session is left without Writing.
  const people = (numbers, withHubStudent = false) => [...(withHubStudent && hubStudent ? [hubStudent.id] : []), ...numbers.map((n) => byNumber.get(n).id)];

  const sessionDefs = [
    { name: "Morning mock – Group A", description: "Monthly full mock for the morning group", days: -40, time: "09:00", limit: 10, status: "completed", people: people([121, 122, 123, 124, 125, 126, 127, 128, 129]) },
    { name: "Evening mock – Group B", description: "", days: -26, time: "18:00", limit: 10, status: "completed", people: people([130, 131, 132, 133, 134, 121, 122]) },
    { name: "Intensive course final mock", description: "Final test before the real exam", days: -12, time: "14:30", limit: 8, status: "completed", people: people([135, 136, 137, 138, 123, 125], true) },
    { name: "Weekend mock – today", description: "Candidates can log in now (session is started)", days: 0, time: "10:00", limit: 20, status: "started", people: people([141, 142, 143, 144, 145], true) },
    { name: "Saturday, 10am", description: "", days: 7, time: "10:00", limit: 20, status: "created", people: people([139, 140, 126, 127, 128, 129]) }
  ];

  const skillOf = new Map();
  const skill = (uid) => {
    if (!skillOf.has(uid)) skillOf.set(uid, 0.35 + rand() * 0.55);
    return skillOf.get(uid);
  };

  for (const def of sessionDefs) {
    const date = dateOffset(def.days);
    const session = {
      id: nanoid(10),
      name: def.name,
      description: def.description,
      date,
      time: def.time,
      studentLimit: def.limit,
      status: def.status === "completed" ? "started" : def.status,
      participantIds: def.people,
      createdAt: notAfter(isoAt(date, def.time, -60 * 24 * 3), now),
      startedAt: def.status === "created" ? null : notAfter(isoAt(date, def.time), now),
      completedAt: null
    };
    db.ieltsSessions.push(session);
    if (def.status === "completed") {
      def.people.forEach((uid, idx) => {
        const s = Math.min(0.95, skill(uid) + (def.days > -20 ? 0.05 : 0));
        // The last candidate of each completed session skipped Writing (results stay partial).
        const exam = runExam(db, session, uid, { skill: s, day: date, time: def.time, sections: idx === def.people.length - 1 ? ["listening", "reading"] : SECTIONS });
        if (exam.step === "done" && idx % 4 !== 3) scoreManually(exam, s, date, def.time);
      });
      session.status = "completed";
      session.completedAt = isoAt(date, def.time, 200);
    }
  }

  writeDB(db);
  const live = sessionDefs[3].people.map((id) => db.users.find((u) => u.id === id)?.candidateId).filter(Boolean);
  console.log(
    `IELTS demo: ${db.ieltsListening.length} listening sections, ${db.ieltsReading.length} reading passages, ${db.ieltsWriting.length} writing tasks, ` +
      `${db.ieltsSessions.length} sessions, ${db.ieltsExams.length} exams, ${db.ieltsAttempts.length} attempts, ${byNumber.size} demo candidates.`
  );
  console.log(`Candidate IDs that can start the IELTS test now at /ielts: ${live.join(", ")}`);
  if (hubStudent) console.log(`${HUB_DEMO_EMAIL} is in the live session too — Mock exams page of the student hub.`);
}

main();
