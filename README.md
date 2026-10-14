# Northstar SAT — mock exams + daily practice

One platform that combines **sat-mock** (real backend, accounts, admin-run timed
mock exams) with the **Northstar** prototype (student command center, question
bank, drills, saved mistakes, vocabulary, score calculator, study plan) and the
**IELTS mock**. Students switch between SAT and IELTS in the top-left corner of
the hub, and **Nova**, the built-in study tutor, helps with both.
Everything Northstar kept in `localStorage` now lives on the server, per student.

## Quick start

Requires Node.js 18+.

```bash
# Terminal 1 — backend (http://localhost:4000)
cd backend
npm install
npm start            # first run auto-loads 186 practice questions + 105 vocab words

# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Your existing `backend/data/db.json` (accounts, tests, sessions, results) is kept
as-is — new collections are added automatically. For a brand-new database run
`npm run seed` in `backend` first.

- Student demo: `student@example.com` / `student123` → `/login` (or **Try the demo** on the cover page)
- Admin: `admin@example.com` / `admin123` → `/admin/login`

## What's in it

**Cover page** (`/`) is a light, illustrated landing page. Its sections:
- **Hero:** an animated demo that answers a Digital SAT question and an IELTS listening form in turn.
- **Meet Nova:** a looping chat that shows the tutor in action.
- **Statement band:** rotating product claims, replaced by students' quotes once a teacher publishes
  success stories.
- **Showcases:** an example analytics view and a "two exams, one account" section.
- **Stats:** content counts, read live from `GET /api/public/overview`.
- **Closing:** an islands call-to-action and a landscape footer with Nova's friends.

**Sign-in pages** (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/admin/login`) put
the form on the left and an illustrated dawn valley on the right. The app uses a light sky-blue
palette throughout; dark mode is still available in the hub and studio.

**Student hub** (sidebar after login; the switch in the top-left corner flips between SAT and IELTS)

| Page | What it does |
|---|---|
| Home | Greeting, countdown to your SAT date, current vs. target score (both editable), today's plan task and what's overdue, weekly practice chart, badges, announcements |
| Ask Nova | Chat with Nova, the study tutor: a strategy lesson for any skill, pacing, what to practise next; its answers link straight into practice |
| Diagnostic Test | A 20-minute placement test for new students: 14 questions they have never seen (7 R&W, 7 Math, every domain, easy to hard), timed like the real test with no hints. Results: an estimated score, section and domain breakdown, focus skills, and each question reopened in the player with Nova. It becomes the dashboard's score estimate and feeds the study plan |
| Question Bank | Two sections, Reading & Writing and Math. Each lists every official domain and skill with progress and accuracy, plus filters (difficulty, status, flagged, saved, question type, order), and opens the practice player |
| Practice player | Full screen: passage and question side by side, cross-out, highlighter, notes, flag, timer, reference sheet, and a question navigator coloured by difficulty. **Check** allows a retry. **Explanation** has a tab per option and a step-by-step walkthrough. **Remix** gives a fresh Math variant. Nova sits in the side panel and gives hints before answers. After a miss the student says what went wrong in one tap, and is told when the question comes back for review. Keyboard shortcuts throughout |
| Graphing calculator | Every Math question has a Desmos calculator (the College Board version used on test day): practice player, diagnostic test, mock-exam Math modules and the Daily Star. It opens in a window that can be moved, resized and enlarged, and keeps what was typed from one question to the next |
| Saved & Mistakes | Wrong answers are saved automatically, including wrong mock-exam answers; answer them correctly again to clear (+5 XP). **Spaced review**: a missed question comes back after 1, 3, 7 and 14 days (+3 XP each time it is still right). **Trap profile**: what trips the student up, from their own reasons for each miss and from their answers (rushed misses, slips on easy questions, the skills behind them and the traps in each) |
| Analytics | Weekly activity by difficulty, accuracy per domain and skill, mock-exam modules, study sessions |
| Full-Length Tests | Sessions your teacher assigned (timed, auto-graded) + score trend |
| Vocab | Three modes on the weakest words: **Learn** (10 words: read the cards, match them, complete a sentence), **Flashcards** (3D flip cards, Again/Hard/Good/Easy, keys 1–4) and **Match** (6 pairs against the clock, best time kept). Learn and Match are marked on the server. Deck mastery and a searchable word list |
| Study Planner | Weekly plan built from your weakest skills and fixed each Monday; each task opens the right practice set and finishes by itself when your graded work reaches its count (15 questions solved for a skill). Nothing is ticked by hand |
| Score Calculator | Raw-score sliders → estimated 200–800 sections, target marker, benchmarks |
| Trophies | 14 badges and the XP rules |

With **IELTS** selected, the sidebar shows an IELTS home, IELTS mock tests, Ask Nova (IELTS
strategy), Diagnostic Test, Section Practice, Vocab and Trophies. The IELTS home has a countdown to
the next mock, the latest and best bands, an editable target band, shortcuts into Section Practice
and the student's tests.

**Diagnostic tests for new students.** After signing up, a student picks SAT or IELTS on a welcome
screen and is offered that exam's diagnostic (both home pages keep suggesting it until one is done).
Every diagnostic uses only material the student has never met: nothing answered, explained, saved,
flagged or noted in practice, and nothing from an earlier diagnostic. The IELTS diagnostic is one
Listening part or Reading passage, picked at random, taken under test conditions, and marked into a
band with its CEFR level. While a diagnostic is open, its questions are locked in practice. A test
that runs out of time with fewer than half the questions answered gets no score, so an abandoned
attempt can't drag the estimate down.

The starter bank follows the official digital-SAT taxonomy (section → domain → skill): 60 Reading &
Writing questions over 10 skills and 126 Math questions over 19 skills. Every question has a
per-option rationale, worked steps and a hint. Most Math questions are generated from seeded
templates, so Remix can produce endless variants, and the server regenerates them to grade.

**Engagement layer:** XP for every action, levels, daily XP goal ring, day
streaks, answer combos, badge unlock banners, level-up modal, confetti.
Mock-exam submissions award XP too, so both halves feed the same progress.

**Teacher studio** (`/admin`) — night-themed sidebar, grouped navigation, global student search

| Page | What it does |
|---|---|
| Overview | Greeting, live KPIs with sparklines, 14-day class activity chart, top students, recent submissions, live sessions, latest announcements, quick actions |
| Students | Sortable table of every student (level, XP, streak, practice accuracy, mock average, last active), filters (active / inactive / need attention), CSV export |
| Student profile | Full picture of one student: KPIs, diagnostic tests (starting level), 4-week activity heatmap, weakest topics, badges, mock sessions; edit details and reset password (temp password shown once) |
| Analytics | Class topic mastery, hardest practice questions, per-test score distribution and hardest exam questions |
| Mock tests | Build tests (unchanged editor) + one-click **Duplicate** |
| Practice bank / Vocabulary | CRUD (incl. passage, per-option rationales, worked steps, hint, key evidence quote), JSON bulk import, XP leaderboard, and **Student reports**: problems students flagged from the player, with Edit question / Resolve |
| Sessions | Progress bars per session; session page has **Export CSV** of results |
| Announcements | Post info / good news / reminder / celebrate messages, pin, delete — the latest three show on every student's home page |
| Success stories | Score jumps and quotes to feature on the cover page (SAT or IELTS, with an avatar colour). Only published stories are public; the section stays hidden until there's one. Publish only with the student's permission |

## IELTS mock

The computer-delivered IELTS mock from `../ielts-mock` now runs inside Northstar, on the same
backend, database, student accounts and admin login.

- **Exam room (`/ielts`).** A candidate types their Candidate ID, the same `candidateId` every
  Northstar student already has. This only works once the admin has started the session. The test
  then runs Listening → Reading → Writing, timed on the server, with autosave and resume after a
  reload. Each candidate gets their own mix of parts.
- **Student hub.** The Mock exams page lists the student's IELTS sessions. A student can start a
  live one there without the candidate ID, and returns to the hub afterwards. Bands appear once the
  teacher completes the session.
- **Teacher studio.** The sidebar has an **IELTS** group:
  - **Listening / Reading / Writing:** tests, with full-screen editors covering 21 question types.
  - **Sessions:** participants, results, Writing/Speaking band entry, answer review and Excel/Word
    export.
  - **Users:** every account, each with a per-student IELTS dashboard.
- **Student profiles** show IELTS bands, with links both ways.

On first run the starter tests (6 listening sections, 4 reading passages, 4 writing tasks, with
generated audio) load automatically. For demo candidates and sessions:

```bash
cd backend
npm run seed:ielts   # replaces the IELTS data only (db.json is backed up first)
```

This creates 25 demo candidates (IDs 121–145) and five sessions: three completed with results, one
started and one upcoming. Candidates 141–145 and the demo student (ID 101) can start a test straight
away.

### IELTS section practice

Students can also practise on their own, one part at a time, at **Section Practice**
(`/ielts-prep/practice`). Each part opens in the exam-room screen (`/ielts-practice/:kind/:id`).

- **Listening:** under test conditions (the recording plays once, with a minute to check), or in
  practice mode, where the student can pause, rewind and seek.
- **Reading:** timed (20 minutes) or untimed.
- **Listening and Reading marking:** answers are marked on submit and reviewed in place. Ticks
  show right answers, the key is shown next to wrong ones, and the question bar turns green or red.
  The student also gets a band estimate for the part and, for Listening, the transcript.
- **Writing:** timed or untimed. After submitting, the student gets automatic checks (length,
  paragraphs, overview or position, linking words, repetition, sentence length), a self-check
  against the four marking criteria, and the model answer. There is no band score; the teacher
  gives one.
- **Starter practice set:** 4 listening parts, 3 reading passages and 4 writing tasks with model
  answers. It was written for Northstar in the IELTS format, with Windows text-to-speech audio. It
  contains no Cambridge or other published test material.
- **Teacher control:** every listening, reading and writing set has a **Use in** setting, either in
  its editor or from the pill in the content list:
  - **Mock tests only:** the default.
  - **Student practice only:** never used in mock tests.
  - **Mock tests and practice.**

  Teachers can add material they are licensed to use and share it as practice. Writing tasks can
  also have a level and a model answer.

Attempts are stored in `ieltsPracticeAttempts` and earn XP. The page shows sessions, a
Listening/Reading band estimate from each part's best score, and recent practice.

## Nova, the study tutor

Nova is on the Ask Nova page and in the practice player's side panel. It works out of the box: the
built-in tutor gives hints first and then walks through the question's steps, stopping before the
last one so the student finishes it. It shows the answer only if asked twice. It also explains why
any option is right or wrong, highlights the key evidence in the passage, and teaches the strategy
for every skill.

To have Claude write Nova's replies, set these in `backend/.env` (see `backend/.env.example`):

```bash
ANTHROPIC_API_KEY=sk-ant-...        # required to enable
TUTOR_MODEL=claude-opus-5           # optional, any current Claude model id
TUTOR_EFFORT=medium                 # optional: low | medium | high
```

Replies stream to the browser. Claude sees the question, whether the student answered it correctly
and whether they opened the explanation. It is told to give hints and not to reveal the answer
early. If the API call fails before Nova starts replying, the built-in tutor answers instead. If
Claude declines a request, Nova steers the student back to the question.

## Security

- Set `JWT_SECRET` in `backend/.env` for any real deployment (see `backend/.env.example`).
  Without one, a random secret is generated on first run and persisted to
  `backend/data/.jwt-secret` (gitignored) — fine for local dev, but set your own before
  deploying anywhere real.
- Login and registration are rate-limited; basic HTTP security headers are set via `helmet`.
- Forgot password: `POST /api/student/forgot-password` always returns a generic response
  (no account enumeration) and — since no email service is configured — logs the reset
  link to the server console. Wire up real email delivery before using this in production.

## Tests

```bash
cd backend
npm test
```

Runs:

- `gamification.test.js`: pure unit tests for XP, levels, streaks and badges.
- `routes.test.js`: boots the real Express app against a throwaway database and exercises auth,
  the practice bank and the mock-exam mistakes queue over HTTP.
- `practice.test.js`: the question bank over HTTP. Covers filters, the per-section skill table,
  answering with a retry or after opening the explanation, grid-in forms, remixes, notes and
  reports, study sessions and analytics, Nova's built-in tutor, the admin editor, and upgrading an
  older starter question in place.
- `landing.test.js`: the public cover-page overview (real content counts, published stories
  only) and the studio's success-story editor, including score validation per exam.
- `content.test.js`: checks every starter question (valid skill, four distinct options, one
  rationale per option, steps, evidence quote inside the passage), that answers are spread evenly
  over A–D, and that all 19 Math generators produce valid, repeatable questions.
- `diagnostic.test.js`: the SAT diagnostic. It checks that:
  - the form covers every domain and difficulty with unseen questions only;
  - Math is generated fresh when the bank runs low;
  - nothing leaks while it runs, and practice is locked meanwhile;
  - it's scored, recorded and reviewable, and timeouts follow the "at least half" rule.
- `review.test.js`: the spaced-review schedule (its rules, then over HTTP: what is due, the review
  set, the review XP), the reasons students give for a miss, and the trap profile.
- `ielts/diagnostic.test.js`: the IELTS diagnostic. It checks the random pick of untried parts,
  the server clock, autosave, band and CEFR marking, and the practice lock.
- `ielts/grading.test.js`: IELTS marking and band scores.
- `ielts/routes.test.js`: the whole IELTS flow over HTTP, including candidate login by candidate
  ID, the student hub, admin results and exports, and deleting users.
- `ielts/practice.test.js`: IELTS section practice over HTTP. It checks that:
  - parts use real question numbers and never send the key;
  - answers are marked and "choose TWO" items scored;
  - essays get their checks and model answer;
  - the seed refreshes on startup and skips teacher edits;
  - practice-only content never reaches a mock session;
  - editor saves keep a task's level.

Known advisories: `exceljs` depends on an old `uuid` with a missing buffer bounds check, but
exceljs only calls `v4()` without a buffer, so it isn't affected. `quill` 2.0.3 has an XSS advisory
for its HTML export; stored IELTS HTML is only ever rendered through an allow-list renderer
(`src/ielts/lib/richHtml.jsx`).

## Project structure (new files marked ★)

```
backend/
  server.js               # app.listen() entry point
  ★ app.js                # the Express app itself (no listen — importable by tests)
  ★ rateLimit.js           # login/register rate limiter
  ★ *.test.js              # node:test suites
  db.js                   # JSON datastore (+ backfills new collections)
  ★ gamification.js       # XP, levels, streaks, badges, score estimate, answer log
  ★ practiceContent.js    # assembles the starter bank; vocab, 2026–27 SAT dates
  ★ practiceSkills.js     # SAT taxonomy (section → domain → skill), skill lessons, reference sheet, IELTS tips
  ★ content/              # readingWriting.js (60 R&W questions), mathClassic.js, mathGen.js (seeded Math generators)
  ★ tutor.js, ai.js       # Nova: built-in tutor + optional Claude streaming
  ★ stories.js            # success-story validation (cover page)
  ★ diagnostic.js         # SAT diagnostic: blueprint, unseen-question picker, timing, scoring
  ★ grading.js            # answer checking shared by practice and the diagnostic
  routes/
    ★ publicRoutes.js         # /api/public/overview — content counts + published stories, no auth
    ★ practiceRoutes.js       # /api/practice/* (student) — bank, player, explanations, remix, Nova, plan, analytics
    ★ diagnosticRoutes.js     # /api/diagnostic/* (student) — start/resume, autosave, submit, results
    ★ adminPracticeRoutes.js  # /api/admin/practice/* (admin) — question/vocab CRUD, student reports
    ★ adminRoutes.js          # /api/admin/* overview, students, analytics, announcements, CSV, duplicate
    examRoutes.js             # awards XP on module submit; mirrors wrong answers into the mistakes queue
    studentRoutes.js          # history incl. submittedAt/timeSpent; forgot/reset password
frontend/src/
  ★ landing.css, auth.css    # cover page + sign-in screens (always light)
  ★ pages/landing/*          # Landing, HeroDemo, NovaDemo, Insights, Auth (login/signup/forgot), hooks, bits
  ★ components/Brand.jsx     # the logo (Nova + wordmark), used everywhere
  ★ components/Scenes.jsx    # illustrated scenes: DawnScene, IslandScene, FooterScene, CloudBand
  ★ components/StoryCard.jsx # success-story card (cover page + studio preview)
  ★ shell.css, hub.css       # student hub styles, use tokens from index.css
  ★ player.css               # practice player + Nova side panel
  ★ context/ProgressContext.jsx  # XP state + reward animations
  ★ components/Confetti.jsx
  ★ components/Nova.jsx, NovaChat.jsx  # Nova mascot + streaming chat
  ★ components/ActivityChart.jsx, Figure.jsx, Art.jsx, MathText.jsx
  ★ pages/hub/*              # StudentShell (SAT/IELTS switch), Home, QuestionBank, BankSection, Mistakes,
                             # Analytics, MockExams, Vocab, StudyPlan, ScoreCalc, Coach (Ask Nova), Trophies,
                             # IeltsHome, IeltsTests, IeltsPractice, Welcome, Diagnostic, DiagnosticResult,
                             # IeltsDiagnostic
  ★ pages/practice/*         # Player, SidePanel, PlayerParts, HighlightText (/practice/solve)
  ★ pages/diagnostic/*       # DiagnosticTest (/diagnostic/test/:id, the timed SAT diagnostic)
  ★ diagnostic.css           # diagnostic pages, welcome screen, SAT test-screen extras (dg-)
  ★ pages/PracticeBank.jsx, VocabAdmin.jsx
  ★ pages/admin/*            # AdminOverview, StudentsList, StudentProfile, Analytics, Announcements, Stories
  ★ admin.css, landing.css   # teacher studio + cover page styles
  ★ components/Icon.jsx      # custom SVG icon set + badge medals
  ★ components/adminUi.jsx   # Avatar, Kpi, Sparkline helpers

backend/ielts/               # IELTS module — index.js mounts /api/ielts/*, /uploads, /ielts-assets
  lib/                       # question model + marking, exam engine (timers, shuffle), band scores,
                             # practice.js (section practice: parts, marking, writing checks),
                             # diagnostic.js (random untried part, server clock, band + CEFR)
  routes/                    # exam (candidate), student (hub), practice + diagnostic (student), content, sessions, users
  seed/                      # starter tests, practice set (practice.js, practiceTranscripts.js),
                             # generated audio (assets/), demo seed
frontend/src/ielts/          # IELTS screens, lazy-loaded; styles scoped to .ie-root
                             # (exam/PracticeRunner.jsx runs section practice,
                             # exam/DiagnosticRunner.jsx the IELTS diagnostic)
```

## Notes

- Score estimates are practice estimates, not official College Board conversions.
- SAT dates in `practiceContent.js` are for 2026–27; verify on the College Board site.
- The JSON datastore is fine for a class; swap `db.js` for SQLite/Postgres at scale.
