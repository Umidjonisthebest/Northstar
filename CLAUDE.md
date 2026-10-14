# CLAUDE.md — handoff notes for Claude Code

This repo is **Northstar SAT**: the `sat-mock` platform merged with the
`Northstar` prototype. Built in a Claude Cowork session on 2026-09-22; continue
here with Claude Code (`claude` in this folder).

## Run

- Backend: `cd backend && npm install && npm run dev` → :4000 (`npm run dev` uses `node --watch`; `npm start` doesn't watch)
- Frontend: `cd frontend && npm install && npm run dev` → :5173 (proxies `/api`)
- Build check: `cd frontend && npx vite build`; lint: `npx oxlint src`
- Backend tests: `cd backend && npm test` (Node's built-in test runner — `gamification.test.js` is pure unit tests, `routes.test.js` boots the real Express app against a throwaway `DB_PATH` and exercises auth, grid-in questions and the exam-mistakes queue over HTTP; `practice.test.js` does the same for the question bank, player, remix, Nova and admin editing; `landing.test.js` covers the public cover-page overview and the success-story editor; `content.test.js` validates every starter question and fuzzes the Math generators — run it after touching `content/` or `practiceSkills.js`; `diagnostic.test.js` covers the SAT diagnostic test; `streaks.test.js`, `daily.test.js`, `leagues.test.js`, `planning.test.js`, `ghost.test.js` and `recap.test.js` cover the gamification roadmap; `mockExam.test.js` covers the teacher studio's tests/sessions and the student's exam (validation, grading, figures, late hand-ins, empty modules); `adminContent.test.js` covers the vocabulary and practice-bank admin, student editing, the CSV export, sign-in limits and `db.js`; `review.test.js` covers spaced review, mistake reasons and the trap profile; `weekPlan.test.js` covers the weekly study plan (fixed tasks, what counts, tasks finishing themselves); `messages.test.js` covers messages between students and the developers; `classroom.test.js` covers classes (who is in which, class pages, homework, class chats, the studio's side); `vocabPractice.test.js` covers the vocabulary modes (the exercise builder in the frontend, and the marking of Learn and Match); `practiceTests.test.js` covers the SAT practice tests (every question against its source file, the mark-up reader, marking, and a sitting over HTTP); `satPracticeStudio.test.js` covers the practice tests the admin makes in the studio (drafts, publishing, a sitting, staff results); the `ielts/*.test.js` suites cover the IELTS module, including section practice and the IELTS diagnostic)
- Windows notes for this machine:
  - Windows PowerShell 5.1 reads BOM-less UTF-8 as cp1251, so `Get-Content`/`Set-Content` round trips turn "—" into "вЂ”". Edit files with the editor tools or node, never PowerShell text cmdlets.
  - After many rapid edits, Vite can keep serving a stale module. If the page doesn't match the file, re-save the file or restart `npm run dev`.
  - This PC hands out ports from 1024-15000 (`netsh int ipv4 show dynamicport tcp`; Windows' usual range is 49152 and up). `fetch` refuses a list of "bad" ports (3659, 4045, 5060, 6000, 6665-6669, 10080 ...), so a test that bound port 0 and called itself with `fetch` died now and then with `fetch failed: bad port` (about one `npm test` in twenty; seen 2026-10-13 in `ielts/diagnostic.test.js`). `npm test` now preloads `backend/testPorts.mjs`, which makes `listen(0)` pick a port `fetch` accepts (0 refused ports in 6,000 binds, 4 before). Run a single file as `node --test --import ./testPorts.mjs <file>`; without the preload it can still hit a bad port. The file is not named `test-*` on purpose: `node --test` would run it as a test.
- Logins: student `student@example.com / student123` at `/login` (or "Try the demo"). Staff sign in at `/teacher/login`, one page for both kinds: admin `admin@example.com / admin123` opens the admin panel (`/admin`), teacher `teacher@example.com / teacher123` opens the teacher studio (`/teacher`). `npm run seed` adds the teacher to an older database. See "two staff panels" below.
- IELTS demo data: `cd backend && npm run seed:ielts`. Candidates 141–145 and 101 can then start
  the test at `/ielts`; see "IELTS module" below.
- `backend/server.js` is now a thin `app.listen()` wrapper; the Express app itself is `backend/app.js` (no side effect on import beyond loading starter content), which is what `routes.test.js` imports.
  - "Loading starter content" **writes `db.json`** at import time. Any script or test that imports `app.js` or `db.js` must set `DB_PATH` to a copy first, or it rewrites the real database (the test files all do this).

## Architecture

- Express + JSON file DB (`backend/data/db.json`). Always read/write via
  `readDB()` / `updateDB(fn)` from `db.js`. `readDB` backfills missing collections.
- Collections: users, tests, sessions, participants, attempts (mock exams);
  practiceQuestions, vocab, progress, questionReports (practice hub); stories
  (cover-page success stories, validated by `stories.js`); diagnostics (SAT
  diagnostic tests, `diagnostic.js`). The IELTS diagnostic uses `ieltsDiagnostics`.
  `practiceTestRuns` is a student's sittings of the SAT practice tests (`practiceTests.js`;
  the ten that came as files are in `content/practiceTests/`, and the ones the admin makes in the
  studio are `satPracticeTests`, with `satPracticeHidden` for file tests taken off the list).
  `dailyStars` and `leagues` came with the gamification roadmap (2026-10-03 section).
  `messages` is the students' conversations with the developers (`messages.js`).
  Classes (2026-10-09 section) added `homework`, `classMessages`, `classReads`, `classReports`,
  `classQuests` and `cheers`, and the user fields `school`, `grade`, `classSetAt`, `chatMuted`.
- `gamification.js` is the single place for XP/levels/streaks/badges. Every amount is
  in its `XP` table and every rule in a `score*` function; routes call those, then
  `award(progress, xp, badgeIds)`, and return the reward object to the client; the
  frontend passes it to `useProgress().celebrate()` (never in exam mode; see the
  2026-10-03 section).
- Frontend: React 19 + react-router 7, no UI kit.
  - Design tokens live in `src/index.css` (`:root` + `html.dark`). The brand is light sky blue:
    `--primary` is `#1664e2`, which passes AA both as white-on-blue and as blue text on `--bg`.
  - Student hub styles are in `src/shell.css` (shell, dashboard, question bank, plus the Nova chat
    `nv-` and charts `viz-`) and `src/hub.css`, with the `ns-` prefix. The sidebar is a light pastel
    driven by the `--side-*` tokens, and navy in dark mode.
  - The practice player is in `src/player.css` (`pl-`, math figures `fig-`).
  - Overlays inside pages must use `createPortal` (pages animate).
- Cover page and sign-in screens: `pages/landing/*`.
  - Styles are `src/landing.css` (`ln-`, hero demo `hd-`, Nova demo `nd-`, insights `in-`) and
    `src/auth.css` (`au-`).
  - Both are always light: they set their own copies of the global tokens, so `html.dark` doesn't
    reach them.
  - Illustrations are inline SVG in `components/Scenes.jsx` (`sc-`, motion in `scenes.css`).
  - The logo is `components/Brand.jsx`, i.e. `<Logo to size tag />`. Use it everywhere instead of
    hand-rolled brand marks.
  - Nova's colour variants (`tone`: sun, sky, rose, mint, lilac, peach) are in
    `components/novaTones.js`; `extra` adds a cap, shades or headphones.
  - All CSS ends up global. Prefix every new class, and never reuse generic names: the scroll-reveal
    adds `.in`, and admin.css already defines `.tone-sky` and `.tone-rose`.
- Student hub routes live under the `StudentShell` layout route in `App.jsx`;
  exam screens (`/exam/*`, `/results/*`), the practice player
  (`/practice/solve`) and a practice test being sat (`/practice-test/*`) are full-screen outside it. `StudentShell` holds the
  SAT/IELTS switch and passes `{ exam }` as outlet context; build player links
  with `playerUrl()` from `pages/hub/hubUtils.js`.

- Staff panels (the admin panel and the teacher studio, see "two staff panels" below):
  `routes/adminRoutes.js` (overview, students, analytics, announcements, success stories, CSV
  export, duplicate test) + `pages/admin/*`, inside `pages/StudioLayout.jsx`, styled by
  `src/admin.css` (`ad-` prefix; light pastel sidebar via `--ad-side-*`, night sky in
  dark mode). Legacy admin pages are restyled via `.ad-content .page-header/.list-row/...`
  overrides. Which panel has which screen is `src/studio/panels.js`.
- Public API (no auth): `routes/publicRoutes.js`, i.e. `GET /api/public/overview` (content counts
  and published stories). Keep it free of anything student-private.
- Icons: never use emojis in UI — use `<Icon name=… />` / `<Medal id=… />`
  from `components/Icon.jsx` (add new glyphs there).

## Conventions

- Practice-question shape: `{key?, section, domain, topic, difficulty, type: "mcq"|"grid_in", title, passage?, table?, figure?, prompt, options[], correctIndex | correctAnswer, explanation, rationales[], steps[{title, body, quote?}], hint, keyQuote?, gen?}`.
  - `topic` is the skill; `domain`/`topic` must come from `SKILLS` in `practiceSkills.js`.
  - One rationale per option; only the correct option's starts with "Correct".
  - `keyQuote` must appear verbatim in the passage; Nova and the explanation highlight it.
  - `gen: {skill, level, seed}` marks a generated Math question (see `content/mathGen.js`).
- In `content/readingWriting.js`, refer to answer choices as `{A}`–`{D}`, never as literal letters.
  `balanceAnswers()` moves each correct answer so they're spread evenly over A–D, then re-letters
  the placeholders.
- Starter questions carry a stable `key`. `syncStarterQuestions()` in `app.js` updates them in
  place on startup (same id, so student progress survives). It skips any an admin has edited
  (`updatedAt`) and adds new ones. Rename a starter question by keeping its old title in
  `legacyTitle`.
- Never send `correctIndex`, `rationales`, `steps` or `explanation` to students before they answer
  (see `publicQuestion`). The explanation endpoint marks a question `revealed`, so the next correct
  answer counts as assisted (30% of the question's XP, no combo).
- Skill names can contain commas, so skill lists in URLs are `|`-separated (`skillList()` /
  `playerUrl()`).
- Dates use `APP_TIMEZONE` (default Asia/Tashkent) via `todayKey()`.

## IELTS module (merged 2026-09-26)

The IELTS mock from `../ielts-mock` (a recreation of `../Mock platform explanation.mp4`; its spec is
in `../ielts-mock/docs/video-notes.md`) lives in `backend/ielts/` and `frontend/src/ielts/`. The
standalone copy in `../ielts-mock` is reference only; new work happens here.

**Backend**
- `ielts/index.js` mounts everything:
  - `/api/ielts/exam`: candidate API.
  - `/api/ielts/student`: student hub, using Northstar's `requireStudent`.
  - `/api/ielts/admin/{content,sessions,attempts,users}`: Northstar's staff sign-in. `content` and
    `users` are `requireAdmin`; `sessions`, `attempts` and `users/:id/dashboard` are `requireStaff`.
  - `/uploads`: `backend/uploads/ielts/{audio,images}`, gitignored; `UPLOAD_DIR` overrides the root.
  - `/ielts-assets`: `ielts/seed/assets`, the starter audio/images and `sound-test.wav`.
- IELTS data uses its own collections: `ieltsListening/Reading/Writing`, `ieltsSessions`,
  `ieltsExams`, `ieltsAttempts`. Never use `db.sessions` / `db.attempts` for IELTS; those are SAT.
  Use `contentOf(db, kind)` from `ielts/store.js` for the three content collections.
- Users are shared.
  - A student's `candidateId` is what they type at `/ielts`.
  - IELTS-created students get the next one from `nextCandidateId()` in `users.js`, which is shared
    with the SAT routes.
  - IELTS-created students may have `email: ""` and no password. Always compare with
    `(u.email || "")`.
  - `status: "inactive"` blocks IELTS login only.
  - Deleting a user through `/api/ielts/admin/users` cascades to SAT participants/attempts and
    practice progress (`removeUser`).
  - Editing never drops a student's Northstar password.
- Candidate tokens carry `role: "ielts_candidate"`, so Northstar's routes reject them and vice versa.
- `ensureIeltsContent()` loads the starter tests into empty IELTS collections at startup, like the
  practice bank. `npm run seed:ielts` resets the IELTS demo data. It never touches SAT data, upserts
  demo candidates by email and backs up db.json.
- Tests: `ielts/grading.test.js` (marking and bands), `ielts/routes.test.js` (the full HTTP flow
  against a throwaway DB) and `ielts/practice.test.js` (section practice).
- Content records have a `use` field: `"mock"` (the default when missing), `"practice"`, `"both"`,
  or `"test"` (a part that belongs to one practice test, with `testId`; see the section of
  2026-10-13, evening).
  - `useOf` / `inMocks` / `inPractice` / `inTest` in `ielts/lib/practice.js` read it.
  - The mock engine (`isActive` in `lib/exam.js`) skips practice-only records and test parts.
- Section-practice attempts live in `ieltsPracticeAttempts`, never in `ieltsAttempts`.

**Frontend**
- Routes are in `App.jsx`:
  - `/ielts` and `/ielts/exam`: candidate site.
  - `/admin/ielts/*` and `/teacher/ielts/*`: inside `StudioLayout`, IELTS sidebar group (Practice
    tests in both panels; Section practice and Users are the admin's).
  - Full-screen editors and previews (`…/new`, `…/:id/edit`, `:kind/:id/preview`): outside the layout.
- Pages are lazy (`ielts/pages.js`). Use `adminPath()` / `IELTS_*` from `ielts/paths.js` for links
  (`adminPath()` follows the panel the page is shown in).
- `ielts/IeltsScope.jsx` is the layout route. It loads the IELTS CSS and sets `.ie-root` plus a
  variant:
  - `candidate`: exam look, always light.
  - `workspace`: editors and previews, light.
  - `admin`: follows Northstar's `html.dark`, via the token remap in `ielts/styles/base.css`.
- IELTS CSS must stay scoped: element rules only under `.ie-root`, classes prefixed `ie-`.
- IELTS overlays portal into `usePortalRoot()` (`ielts/scope.js`), never `document.body`, so they
  keep the scope and theme.
- The IELTS admin uses Northstar's `admin_token`. Candidate sessions use
  `ielts_candidate_token/_info`. `returnTo` sends hub students back to `/mock` when they finish.
- IELTS screens use Northstar's colours (since 2026-10-06; they used to be the video's red) with
  lucide-react icons and their own toast/modal kit (`ielts/components`). Northstar's `Icon.jsx` rule
  applies to Northstar screens.
  - `ielts/styles/base.css`: `--ie-accent-*` is the Northstar sky-blue scale (`--ie-accent-500` is
    `#1664e2`, the same as `--primary`), and the admin variant remaps it for `html.dark`. Red is
    only for errors and destructive actions (`--ie-danger-*`); green and amber are success and
    warning. The per-skill hues (`--ie-skill-*`: listening blue, reading pink, writing violet) are
    deliberate, so a skill is recognisable at a glance.
  - The exam room uses its own `--ex-*` tokens (`ielts/styles/exam.css`, accent `#1664e2`, plus a
    high-contrast dark variant).
  - Don't alias `--x: var(--y)` at `:root` for anything that dark mode changes: the alias is
    resolved once and ignores the later override.
- oxlint reports a few dozen warnings under this repo's React-compiler rules (64 in total on
  2026-10-06, IELTS and Northstar together); there are no errors.

## Netlify deployment (2026-10-08)

The owner asked to deploy on Netlify and chose "everything on Netlify" over a separate backend host.
Site: **northstar-prep** (https://northstar-prep.netlify.app, site id
`dc6738d9-a81c-4627-8ca1-fe88f02cfe33`, team `husenovu3`, free plan). No git repository is connected;
deploys are uploads.

**How it runs there.** Nothing in the app changed; local development is as before.
- `netlify.toml`: builds the frontend (`frontend/dist` is the site), then `tools/netlify/static.mjs`
  copies `backend/content/pack/media` to `/api/bank-media` and `backend/ielts/seed/assets` to
  `/ielts-assets` inside it, so the CDN serves those (about 95 MB) and not the function.
- `netlify/functions/api.mjs` (paths `/api/*` and `/uploads/*`, except `/api/bank-media/*`) is the
  whole backend: it loads `backend/netlify.js`, which starts `app.js` on a local port inside the
  function and passes each request to it. Two things there are deliberate, each after a failed
  deploy: no `preferStatic` (the `/*` page rule then took every API call: 404), and the backend is
  loaded by address, not a plain import (Netlify merges plain local imports into the function file,
  away from `backend/node_modules` and the data files: 502). So the whole `backend/` folder is
  shipped through `included_files`, with its `node_modules`.
- To check the function before uploading, bundle it the way Netlify does
  (`@netlify/zip-it-and-ship-it`, `zipFunctions` with `archiveFormat: "none"` and the same
  `included_files`) and run it; the connector gives no build or function logs.
- **Database**: `db.json` lives in Netlify Blobs (store `northstar`, key `db`). Each request fetches it
  into the function's temp folder if it changed, lets the app work on that file, and stores it back
  only if nobody else stored one meanwhile (`onlyIfMatch`); on a conflict the request is run again on
  the newer copy, up to 5 times, then a 503. So no write is lost, but every write uploads the whole
  file. Daily copies are kept as `backups/db-YYYY-MM-DD.json` (14). `db.js`'s own backups are off there.
- **First start**: with nothing stored, the database is `backend/data/netlify-seed.json`, made by
  `node tools/netlify/seed.mjs` from the local `db.json` with a new random admin password (written to
  `netlify-admin-login.txt`, which is not deployed; so `admin123` does not work on the live site, and
  since 2026-10-09 the teacher sign-in page shows its "Demo: … / admin123" hint and fills in the
  address only in development). After that the seed is never read again: later
  deploys keep the live data, and local `db.json` changes do not reach the site.
- `JWT_SECRET` is generated once and kept in the same store (key `jwt-secret`); a `JWT_SECRET`
  environment variable on the site wins. `NODE_ENV` is `production`, `APP_URL` is the site's address.
- **Uploads** (IELTS audio and pictures) go to the store `northstar-uploads` and are served from it at
  `/uploads/...` with byte ranges.

**Deploying again.** `node tools/netlify/stage.mjs <a folder outside the project>`, then run Netlify's
upload from that folder (the Netlify connector's `deploy-site` gives the command; or
`npx netlify-cli deploy --build --prod` after `netlify login`). **Never upload from this folder
itself**: the upload tool sends nested `node_modules` (Windows builds, which fail on Netlify's Linux
machines: the first deploy died that way) and the development database.

**Limits of this setup.**
- A request body can be about 4.5 MB at most, so an IELTS audio upload above that fails, though the
  editor allows 20 MB. Starter audio is unaffected (it is published as files).
- A deleted upload stays in the blob store (the app deletes from a folder that is empty there).
- Rate limits and "studying now" are per function instance, so they are looser and less exact.
- Nova's replies arrive in one piece, not word by word (the function buffers the response), and a
  request may take 60 seconds at most.
- `MAIL_WEBHOOK_URL` and `ANTHROPIC_API_KEY` are not set on the site, so password resets go through
  the teacher and Nova uses the built-in tutor.

**What was and wasn't checked.** The build and deploy succeeded on Netlify. `backend/netlify.js` was
checked locally against a stand-in for Blobs (22 checks: seed, sign-ins, a write, a forced conflict,
backups, upload and ranges). On the first day the live site could not be exercised: new sites on
this account sit behind Netlify's team-login wall (every address answers 401).

**Since the evening of 2026-10-08 the site is open** (Netlify reports no visitor password and no
team login on it), and after the third deploy (`6ac7ca3960a9f172255695b7`: the owner's 500 originals
and the drawn math) these were seen working on https://northstar-prep.netlify.app: the function
answers `/api/*` ahead of the `/*` page redirect (`/api/public/overview`: 2,408 questions), a
question-bank picture comes from `/api/bank-media` as `image/webp` at its full size, the login
page's "Try the demo account" signs in, the question list loads for that student, and the player
draws fractions, roots and exponents. Not exercised there: answering a question (a write to Blobs),
`/ielts-assets`, uploads, a mock exam, the teacher studio. A missing file under `/api/bank-media`
answers 200 with the app's page, not 404 (the `/*` redirect), which is harmless but worth knowing.

**Deploy of 2026-10-13** (`6acd8255c03dccba108c4bbf`; everything built from 2026-10-11 to 2026-10-13:
vocabulary modes, pill buttons, hover feedback, class codes, teacher-made classes, SAT and IELTS
practice tests, IELTS analytics and band calculator). Before the upload the new backend was run
against two older databases, the seed and `db.backup-before-teacher-classes-*.json` (the shape the
live data had), calling the new routes on each: all answered. Seen on the live site afterwards, as
the demo student: `/api/public/overview` says 2,608 questions and IELTS 14/10/10, `/mock` lists the
ten practice tests, `/ielts-prep/practice-tests` lists two, the band calculator opens, `/class`
tells the demo account it can't be in a class. Not exercised there: sitting a test, joining a class
with a code, the studio (no staff sign-in used).

**Second deploy of 2026-10-13** (`6acddac2fe39bceea701ef63`, about 12:25 local): **the practice-test
lock only**. It was NOT made from this folder, which at that hour held another session's
half-finished removal of the College Board pack. It is the staged copy of the deploy above
(`…\c4ba331a-…\scratchpad\northstar-stage`, still on disk then) with eleven files laid over it:
`backend/practiceTests.js`, `backend/routes/practiceTestRoutes.js`, and in `frontend/src`
`api.js`, `lock/LockScreens.jsx`, `ielts/exam/TestRunner.jsx`, `pages/hub/IeltsPracticeTests.jsx`,
`PracticeTests.jsx`, `PracticeTestResult.jsx`, and `pages/practicetest/PracticeTestModule.jsx`,
`PracticeTestRun.jsx`, `ptUtils.js`. So **the live site still has the College Board pack and does
not have the two workbooks** (2,608 questions): those go out with the next deploy made from this
folder, which will carry the lock too. Checked on the copy first (its backend on a copy of the
seed, the 47 practice-test and lock tests, a production build of the same frontend source), then on
the live site as the demo student: both lists carry the lock's sentence, an IELTS Reading section
shows the warning, opens behind the full-screen cover and is cancelled when the page is hidden, and
`POST /api/practice-tests/runs/:id/leave` answers (on a sitting made and removed for the check).

**Third deploy of 2026-10-13** (`6ace2bacdb216bbd0c4a6aae`, 18:02 local, 82 s, first try with a
fresh command): **the whole folder again**, at the owner's "deploy everything to the app". The live
site and this folder are the same from here. It carried the College Board pack's removal, the two
workbooks, the one "Practice tests" section per exam with studio-made tests, and the phone layout
fixes (the four sections below that said "NOT deployed"). Two things about the way it went:
- **A command from `deploy-site` goes stale.** The first one waited through an interruption and
  answered `401 Unauthorized`; a new one worked. Ask for it right before the upload.
- **The folder changed between staging and uploading** (staged 14:24, upload approved 17:54, 72
  files changed by two other sessions meanwhile). The upload command was guarded by a check for
  project files newer than the staged copy, which stopped it; everything was then tested, staged
  and checked again. Keep that guard in the upload command.
- Before the upload: backend 763 passing, frontend build clean, staged copy the same as the folder
  by hash (527 files, 100.8 MB), and the backend run on copies of three older databases (the seed,
  `db.backup-before-teacher-classes-*`, and a preview copy holding the pack with students' answers,
  a save, a review entry, diagnostics and daily stars on pack questions, six practice-test sittings
  and the IELTS tests in their old shape). Every read route as every account, about 4,200 calls: no
  5xx, no pack id in any answer, XP and answer counts unchanged, the earlier sittings still open,
  "9 copied from section practice, 9 moved out of it".
- Seen on the live site afterwards, as the demo student: `/api/public/overview` says 1,150 (479 /
  671); `/mock` is "Practice Tests" with its three tabs and ten tests; the IELTS page has the three
  tabs, two tests and the teacher mock's result; IELTS section practice is 4 / 3 / 4 with the
  student's earlier work; the Question Bank counts. Not exercised there: the staff panels (no staff
  sign-in used), making a test in the studio, sitting a test, a phone.
- The overview's IELTS counts read 18 / 13 / 12 now (they were 14 / 10 / 10): they count every
  record, so Practice Test 1's copies of the section-practice parts are counted twice. If the
  landing page should show distinct material, count without `use: "test"` copies in `publicRoutes.js`.

## Done since the last handoff (2026-10-13, night): phone layout bugs from the owner's screenshots. Deployed 2026-10-13 (third deploy)

The owner sent five phone screenshots and asked to "fix this mobile visual bugs". CSS, plus one
effect in `BankSection.jsx`.

- **Menus that ran off the screen.** A menu hung from its button's right edge (`.ns-pop-right`)
  goes off the left of a phone; one hung from the left edge goes off the right.
  - Announcements (the bell): under 720px the bar's `.ns-pop-anchor` is `static`, so
    `.ns-bell-pop` is placed against the bar and spans it (`shell.css`, the 720px block).
  - SAT date menu on Home: `.ns-date-pop` opens from the date's left edge at every width (it was
    also cut by the panel on a tablet and in a narrow desktop window).
  - Its rows were also drawn wrong at every width: `.ns-countdown-date button` styled the menu's
    own buttons (centred text, the tick on a line of its own). It is `> button` now.
  - Question Bank filter menus (not in the screenshots, same bug): `FilterPill` moves its menu
    left by as much as it would run off the screen (`useLayoutEffect`), and `.ns-fmenu` has a
    `max-width`.
  - **Rule for a new menu:** open it at 375 wide and read its `getBoundingClientRect()`. A menu
    off the left edge makes no sideways scroll, so the "no sideways scroll" check never sees it.
- **Settings profile card** (`settings.css`): the `@container nsset` rules sat above the base
  rules they were meant to override, so they never applied and the card kept three columns at
  every width (the four numbers squeezed and cut off on a phone). They are below the base rules
  now. The numbers go under the name when the column is under 760px (four in a row) and two by
  two under 680px; **so the card also looks different at 1280 wide** (two by two under the name,
  where it had a cramped block at the right). Under 560px the four section tabs are two rows of
  two (they were one row cut off mid-word).
- **IELTS Users tiles** (`ielts/styles/admin.css`): the buttons never shrink, so in a narrow tile
  the name was one letter wide. The tile wraps now: the name keeps at least 160px and the buttons
  drop to their own row. This also happens at 1280 wide (names and emails were split over two
  lines there).
- **Staff overview banner** (`admin.css`, `.ad-hero::after`): the turning star was painted over
  the greeting and the buttons, and took their clicks where it covered them. It is behind the
  content (`isolation` + `z-index: -1`, `pointer-events: none`) and 150px in the corner under 600px.
- **Checked** on the IELTS preview pair (4020 / 5193), demo student and development admin, at 375
  wide: all five screens by measurement and by eye (dark; the banner also light); the bell with a
  student made in a class for it (removed again, with the class and its announcement); the date
  menu and bell also at 760 and 1000; Settings, the banner's buttons and the Users tiles at 1280.
  Build clean, lint clean on the changed file. **Not seen:** a real phone, the bell in light mode,
  the teacher studio's banner (same component), the live site.

## Done since the last handoff (2026-10-13, evening): one "Practice tests" section per exam; SAT and IELTS told apart in the panels; practice tests made in the studio and separate from section practice. Deployed 2026-10-13 (third deploy)

The owner: "Make admin panel and teacher studio neat, because we can see that it is difficult for
teachers and admins to identify whether it is IELTS or SAT. Make creating Practice tests easier for
both SAT and IELTS and make practice tests fully independent from section practice. Make mock tests
and Practice tests 1 section (Practice tests) since mock test is also a practice test, but inside
practice tests section, put Practice tests, results and teacher mocks."

**Where this differs from the sections below (the staff-panel table of 2026-10-10, the two
practice-test sections of 2026-10-13), this one is current.**

### The panels: every screen says which exam it is (`studio/panels.js`)

- The menu is sorted by exam. A screen that belongs to one exam has `exam: "sat" | "ielts"` in
  `FEATURES`; its group is the exam's name as a solid tag in the exam's colour (SAT the brand's
  blue, IELTS violet `#7446d9`), in a tinted block. The same tag is in the bar at the top
  (`Admin > SAT > Practice tests`), the bar gets a line in the exam's colour
  (`.ad-shell[data-exam]`), and the page's heading carries it (`ExamTag`). Styles: the last block of
  `admin.css` ("Which exam a screen belongs to"). The pieces (`SectionHead`, `SectionTabs`,
  `SubSwitch`, `ExamTag`, `useSectionTabs`) are `studio/SectionKit.jsx`.
- Groups now: Insights, People, **SAT**, **IELTS**, Both exams.

| Group | Screen | Admin | Teacher |
|---|---|---|---|
| SAT | Practice tests (`/sat/tests`) | yes | yes |
| SAT | Question bank (`/practice`; was "Practice bank") | yes | no |
| SAT | Homework | no | yes |
| IELTS | Practice tests (`/ielts/tests`) | yes | yes |
| IELTS | Section practice (`/ielts/practice`) | yes | no |
| IELTS | Users | yes | no |
| Both exams | Vocabulary, Messages, Success stories | yes | no |
| Both exams | Announcements | yes | yes |

- **"Mock tests", "Sessions", the IELTS "Listening / Reading / Writing", "Practice tests" and
  "Sessions" are no longer menu items.** They are tabs (below). Their old list addresses redirect
  (`moved()` in `App.jsx`: `/tests`, `/sessions`, `/ielts/sessions`, `/ielts/practice-tests`,
  `/ielts/listening|reading|writing`), so every "back to…" link in the studio still lands
  somewhere right. Editors and detail pages kept their addresses (`/tests/:id`, `/sessions/:id`,
  `/ielts/sessions/:id`); `also` on a feature keeps its menu item lit and the top bar right while
  one of them is open (`activeFeature`, `screenTitle`).

### One "Practice tests" section per exam, three tabs (staff and students)

**Practice tests · Results · Teacher mocks.** A mock is a practice test too; it is only run by a
teacher. The tab is in the address.

- **Staff, SAT** (`pages/admin/SatTests.jsx`, `?tab=results|mocks`, `&view=sessions`):
  - *Practice tests*: the tests students sit alone. "Made in the studio" (drafts and published)
    and "Built in" (the ten file tests). The admin creates, copies a teacher mock, publishes, hides
    a built-in one, deletes; a teacher reads.
  - *Results*: every finished sitting, with the answer sheet (new: staff could not see
    practice-test results before). A teacher gets their class students' (`staffScope.js`).
  - *Teacher mocks*: the old Mock tests list and Sessions list, behind a small switch.
- **Staff, IELTS** (`ielts/admin/PracticeTestsPage.jsx`): the same tabs. *Teacher mocks* is the
  Sessions page and, for the admin, the three lists of mock material (`ContentList` with
  `scope="mock"`). *Results* is `ielts/admin/TestResults.jsx` (answer sheet, or the essays).
- **Students, SAT** (`/mock`, `pages/hub/MockExams.jsx`, `?kind=practice|results|teacher`): the
  page is called **Practice Tests** now (it was "Full-Length Tests"). Results lists every finished
  sitting and teacher mock, and holds the score trend.
- **Students, IELTS** (`/ielts-prep/practice-tests`, `IeltsPracticeTests.jsx`,
  `?tab=tests|results|teacher`): the teacher's mock tests moved in as the third tab. The "Mock
  Tests" menu item and `pages/hub/IeltsTests.jsx` are gone; `/ielts-prep/tests` redirects.
  `IELTS_MOCKS_URL` (`ieltsShared.jsx`) is where an IELTS exam returns to.
- With no tab in the address, a teacher's mock that is waiting opens first; otherwise the practice
  tests. So links that mean the practice tests say so (`TESTS_URL`, `?tab=tests`).

### SAT practice tests can be made in the studio

Before, a practice test could only be added by running a tool on an HTML file. Now the admin makes
one in **two steps: create it and type its questions (the same editor as a teacher mock), then
publish.**

- **Stored** as `db.satPracticeTests`, the shape of `db.tests` plus `published` and a `section`
  (`rw` | `math`) on each module. A new one gets the digital SAT's four modules (32, 32, 35, 35
  minutes); a module left empty is simply not part of the test.
- **One editor API for both kinds**: `routes/testRoutes.js` is now `makeTestRouter({ key, write,
  blank })`. `/api/tests` is the teacher mocks as before; `routes/adminSatTestRoutes.js`
  (`/api/admin/sat-tests`) mounts it on `satPracticeTests` with `write: requireAdmin`, and adds the
  list, `POST /from-mock/:testId` (copy a teacher mock into a draft), `PUT /:id/publish`,
  `PUT /built-in/:key { hidden }` (`db.satPracticeHidden`), `GET /results` and `/results/:runId`.
  Questions gained an optional `explanation` (shown with a practice test's results).
- **One engine for both sources** (`practiceTests.js`): `testOf(db, key)` (it takes the database
  now), `listedTests(db)` (what a student can start: published studio tests first, then the file
  tests that aren't hidden). `satPracticeStudio.js` turns a studio test into the engine's shape:
  key `s-<id>`, plain text as `{ t: "mx", c }` pieces and pictures as `{ t: "img", src }` blocks,
  which `RichText.jsx` draws (`mx` through `MathText`, so `x^2` and `(x + 1)/2` are drawn). A typed
  answer is marked like a teacher mock's (`gradeGrid`). No domains, so no domain breakdown; the
  score is the file tests' table applied to the share right (`DEFAULT_CURVE`), an estimate.
- **A test changed under a sitting**: a sitting whose modules are no longer all in the test
  (`runFits`) is treated like a sitting of a deleted test (404 for the student, left out of lists
  and results). A hidden or unpublished test can't be started, but a sitting under way and results
  already earned stay open.
- Frontend: `TestEditor.jsx` takes `practice` (route `/sat/tests/:testId`), `api.js` has
  `mockTestApi` / `satPracticeApi` for it. A teacher opens a practice test read-only.

### IELTS practice tests own their parts; section practice is separate

Before, a test was a list of section-practice parts: to make one you first made nine parts in three
editors with "Use in" set to practice, then picked them, and they all showed in section practice
too. **Now a test owns its parts, and is built inside the test.**

- **`use: "test"`** is a fourth use of a content record (`lib/practice.js`: `TEST_USE`, `inTest`),
  with `testId`. Such a record is in that test and nowhere else: not in section practice
  (`inPractice`), not in a mock (`inMocks`, `lib/exam.js` `isActive`), never a diagnostic. A teacher
  can't choose it in a list or an editor; a part gets it by being made inside a test.
- **Building** (`ielts/admin/PracticeTestBuilder.jsx`, `/ielts/tests/:id`): "Create practice test"
  asks for a title and opens the test's page, which has a slot for every part (Listening 1-4,
  Reading 1-3, Writing 1-2). A slot is filled by **"Write it"** (the Listening / Reading / Writing
  editor opened with `?test=<id>&part=<n>`, which saves straight into the test:
  `contentRoutes.js` `save` with `testId`) or by **"copy one in"** (`POST /tests/:id/parts
  { kind, from }`: a copy of a section-practice or mock part, the test's own from then on:
  `cloneForTest`). A new test is hidden until "Show to students".
  Routes: `ielts/routes/testAdminRoutes.js` (rewritten; both panels read, the admin writes).
  `ielts/admin/editorHome.js` tells an editor what it was opened for and where to go back to.
- **Section practice** in the studio is `ielts/admin/SectionPracticePage.jsx` (`/ielts/practice`,
  `ContentList` with `scope="practice"`); `GET /api/ielts/admin/content/:kind?scope=practice|mock`.
- **Students**: a test section still stores one `ieltsPracticeAttempts` row per part (with
  `testAttemptId`), but those rows point at the test's own parts, so section practice never sees
  them: its list, "tried" marks, stats and recent work are its own (`practiceRoutes.js`), and XP
  budgets are separate. Analytics still counts both (`lib/analytics.js`).
- **Older databases** (`seed/starter.js` `separateIeltsPracticeTests`, run at startup between
  `ensureIeltsPractice` and `ensureIeltsPracticeTests`; `lib/practiceTests.js` `ownTestParts`):
  - Practice Test 1 was built from the section-practice set: its nine parts are **copied** (seedKey
    `PT1:PL1` …), section practice keeps the originals, and rows of sections students already
    finished are pointed at the copies.
  - Practice Test 2's material was written for it: its nine records are **moved** to the test
    whole (same ids, seedKey `PT2:T2L1` …) and leave section practice.
  - So section practice is back to the first set (4 listening, 3 reading, 4 writing), as it was
    before 2026-10-13, and the diagnostic's pool is 7 parts again. It does nothing the second time.
  - Seen on the preview's database copy (the shape the live site has): "9 copied from section
    practice, 9 moved out of it"; the demo student's old Reading result of Test 2 still opens.

### My calls, not the owner's

- **Teachers read practice tests, the admin makes them** (the 2026-10-10 rule that content is the
  admin's). A teacher's own test is a teacher mock. If the owner wants teachers to make practice
  tests, it is `write: requireAdmin` in `adminSatTestRoutes.js` and the `requireAdmin`s in
  `testAdminRoutes.js` / `contentRoutes.js`, plus `canEdit` in the pages.
- **Practice Test 1 and section practice hold the same material** (two sets of records now). Making
  them different needs new material in one of them; the owner has said not to write originals.
- Practice Test 2's parts left section practice (above). Section practice has 9 fewer parts than
  on the morning of 2026-10-13.
- "Results" is the practice tests' results; a teacher mock's results stay in its session.
- The names: "Question bank" (was "Practice bank"), "Teacher mocks", "Both exams"; IELTS violet.
- A draft can be published with any number of questions in any of its modules.
- The student pages were given the same three tabs (the owner's sentence could be read as the
  panels only).

### Tests and checks

- Backend **763, all passing**. New: `satPracticeStudio.test.js` (6: drafts, the editor, a sitting,
  results and who sees them, hiding, copying a mock, a test changed under a sitting).
  `ielts/tests.test.js` was largely rewritten (parts are the test's own, the builder, results, the
  startup step on an old database); counts in `ielts/practice.test.js`, `diagnostic.test.js` and
  `routes.test.js` went back to the first set.
- Frontend build clean; oxlint warnings only, of kinds the repo already has.
- **Seen in the browser** (the IELTS preview pair, 4020 / 5193, on a database copy from before the
  change; the development admin, teacher and demo student): the old database separating its tests
  at start; both menus; the SAT section's three tabs; a practice test created in the dialog, a
  question added in the form, published, first on the student's list, sat (through the API: a
  module is locked and the pane has no full screen), its answer review with drawn fractions, a
  root and an exponent, and its row and answer sheet in Results; the old list addresses
  redirecting; the IELTS section, a new test, a part copied in, the Listening editor opened from
  the test on its empty part 2 and saving back to the test; Section practice and the mock material
  lists; the student's two Practice Tests pages and the IELTS redirect; the teacher studio
  (read-only tests, no drafts, its own results, sessions only). 375 wide in light mode on eight
  pages: no sideways scroll. No console errors.
- **Not seen**: a new listening part saved with a recording (it needs a file upload; the save with
  `testId` is tested for reading); a writing task made in a test; a studio question with a picture
  on the student's screen (`img` blocks are covered by no test); the module screen itself with a
  studio question (the lock); the results modal for a cancelled sitting; anything on the live site.
- **Before deploying**: the live database is in the old shape; the startup step will run there
  (it was run on a copy of that shape here). Tell the owner that Practice Test 2's parts leave
  section practice. The deploy would also carry the pack removal and the workbooks (sections below).

## Done since the last handoff (2026-10-13, morning): SAT and IELTS practice tests are locked. Deployed 2026-10-13 (the lock only, see above)

The owner sat a timed SAT Practice Test A on the live site, switched to another tab and back, sent
the recording and asked "why it is not blocking me for cheating?". It wasn't a bug: practice tests
had been left out of the test lock (my call of the day before, see "My calls" under the practice
tests below). The owner's rule of 2026-10-10 ("there must be no way to switch or the test must be
finished and cancelled due to cheating") and their own name for these ("mock tests") cover them, so
they are under the lock now.

- **What happens**: the warning (`LockNotice`, kind `"practice"`) comes before every module, on the
  sitting's page (`PracticeTestRun.jsx`). A module being sat (`PracticeTestModule.jsx`) is strict:
  full screen, and another tab, another window (after the 1.2 s grace), closing or reloading, the
  Back button or the Exit button ("Leave and cancel it") cancel **the whole sitting**. Nobody can
  let the student back in; they start the test again. The sitting's page between two modules is
  not locked, so that is where a student stops for the day.
- **Server** (`practiceTests.js` `cancelRun`, `POST /api/practice-tests/runs/:id/leave`
  `{ module, kind }`): `run.status = "cancelled"`, `run.cancelled = { at, kind, module }`, the module
  that was running becomes `"cancelled"`, the ones never opened `"skipped"`. No score, no results
  (the results route answers with `cancelled` and no items, so no answers or explanations leak), no
  XP for the module, and nothing of the sitting in the score estimate or the weekly plan
  (`timedModules` skips it). A report about a module that isn't running changes nothing. A cancelled
  run answers `CANCELLED` (409) to opening, saving or handing in.
- **Page**: a module only opens for someone who came through the warning (`location.state.warned`);
  an address typed in or a link goes back to the sitting's page, so a clock never starts unwarned.
  The list (`PracticeTests.jsx`) shows a cancelled attempt as "Cancelled · you switched to another
  tab or app"; it doesn't count as "sat", and "Review answers" skips it. The practice-test screens
  now go back to `/mock?kind=practice` (`TESTS_URL`), not to whichever tab `/mock` opens on.
- **My calls, not the owner's** (they showed a timed sitting and asked one question):
  - **Untimed sittings are locked too.** They pay the same XP as timed ones, and the leagues run on
    XP. Cost: an untimed module can no longer be left half-done and picked up later; only between
    modules. If the owner wants untimed left open, `useExamLock`'s `active` in
    `PracticeTestModule.jsx` takes `data.run.timed`, and the old "Leave for now" has to come back.
  - The whole sitting is cancelled, not only the module. XP already paid for a module handed in
    earlier in the same sitting stays paid (it was sat under the lock to its end).
  - A sitting that was in progress before this change (module open, clock running) shows the
    warning on "Resume" and is locked from there.
- **Checked** (DB copy, demo student, the pane's page signals overridden as on 2026-10-10): direct
  address bounced; warning; tab switch cancels and the report lands; the list and the results page
  say why; untimed locked; hand-in goes back to the sitting's page without cancelling; leaving the
  sitting's page cancels nothing; Exit cancels as "left the test"; a real reload cancels as "closed
  or reloaded". Backend: 761 tests pass, one new (`practiceTests.test.js`, "leaving a running
  module cancels the sitting"). **Still not seen: a real tab switch in Chrome**, as for the rest of
  the lock.
- **IELTS practice tests are locked too** (the owner, the same day: "deploy it and lock ielts
  practice tests too"). `ielts/exam/TestRunner.jsx`: the warning on "Start", then the section is
  strict in every mode (test conditions, practice mode, timed, untimed); Exit asks "Leave and
  cancel it"; the review of a finished section is not locked. **It is the page alone that cancels
  here**: a section never reaches the server until it is submitted (`onAutosave` is a no-op), so
  a cancelled one is simply never sent. No route, no record, nothing in the hub's lists, unlike
  SAT. `handingIn` switches the lock off while the submit is on its way. Checked on the deploy
  copy: warning, the full-screen cover (the hook is mounted before the click here, so in the pane
  a `fullscreenchange` event has to be fired after overriding `fullscreenElement`), a 0.7 s loss
  of focus forgiven, hidden cancels, "Keep going" keeps it, a normal submit goes through and the
  review doesn't cancel; the server counted 0 sections after the cancel and 1 after the submit.
- **What the lock doesn't stop** (told to the owner): a cancelled practice test, SAT or IELTS, can
  be started again at once with the same questions.

## Started (2026-10-13, afternoon): natural voices for the IELTS listening audio. A sample only; the app's audio is unchanged

The owner said the listening recordings sound "like a robot". They do: `ielts/seed/generate-audio.js`
uses the one English voice on this PC (Microsoft Zira) for all 14 recordings and fakes the male
and narrator voices by shifting its pitch. The owner then asked for the voices of the Cambridge
recordings to be copied; that was declined (cloning real voice actors without their consent, from
recordings that aren't the owner's). They agreed to one sample made with a free speech model, on
the condition that it sounds "100% like human".

- **Tool**: `tools/voices/speak.mjs` reads a script from `ielts/seed/*Transcripts.js` with Kokoro
  (open model, Apache 2.0, run locally by the `kokoro-js` package), one voice per speaker, a
  sentence at a time, and writes a 24 kHz WAV. `audition` in place of a script key gives every
  voice one line. The package and the model (0.7 GB together) are **outside the app**, in
  `Mock App Project/_tools/voices`; the header of `speak.mjs` has the commands.
- **Made and sent to the owner** (in `Mock App Project/_samples`, not in the app):
  `T2L1-sample.wav` (Practice Test 2 Part 1, 279 s; narrator `bm_george`, Hannah `bf_emma`,
  Graham `bm_fable`) and `voice-line-up.wav` (16 voices, numbered).
- **Waiting for the owner**: whether it sounds real enough, and which voices. Nobody has listened
  to the files but the owner; they were only checked for length and level.
- **If they say yes**: render all 14 keys (LA1-4, LB1, LB4, PL1-4, T2L1-4) and the sound check,
  write them to `ielts/seed/assets/audio/`, update `manifest.json` with the new lengths (the
  exam screen's timing reads it), and listen to nothing being cut off in the browser. One part
  took between 1 and 10 minutes of computing. The files grow by about half (24 kHz against 16).

## Done since the last handoff (2026-10-13, midday): the College Board question pack is out (bank 1,150). Deployed 2026-10-13 (third deploy)

After the Cambridge books were declined a third time (section below), the owner offered to "delete
official college board questions from sat section and in return, add cambridge tests". They were
told the trade changes nothing about the Cambridge books and were asked whether they still wanted
the pack out, hidden or deleted. Answer: "ok, delete". **This reverses the decision of 2026-10-08**
(the section "the whole question pack, 1,657 more questions" far below, which is history now).

- **What went**: all 1,657 pack questions (938 Reading & Writing, 719 Math as pictures) and their
  1,505 pictures. The bank is 1,150, all original: 186 starter, 65 Challenging, 899 in
  `content/originals` (479 Reading & Writing, 671 Math). Every skill still has questions.
- **The folder was moved, not erased**: `backend/content/pack/` is now
  `Mock App Project/_removed/college-board-pack-2026-10-13/` (outside the app, so it is not staged
  or deployed). The project has no version control, so an erase could not be undone; **the owner
  was told to delete that folder themselves** when they are sure. Moving it back restores the
  questions (the sync adds them again under new ids). The owner's source zips beside the repo and
  `SAT QB CB` on their Desktop are theirs and were not touched.
- **Old databases** (`db.js`, `fillQuestions`): a row whose key starts `qb-` and has no content is
  dropped on read, so the next save writes the file without it; one log line says how many. Rows of
  the owner's own bank (`nb-`) whose file is missing are still kept aside, as before. Students'
  progress records are not touched: an answer on a pack question stays in their history and XP.
- **Not removed**: the loader (`loadPack()` in `practiceContent.js`, now returning nothing), the
  picture-question support (`BankPicture.jsx`, `questionMedia`, `/api/bank-media`, the studio's
  "Question pack" and "Picture" badges) and the converter `tools/bank`. Nothing in the bank uses
  them now and **picture questions are no longer covered by a test** (there is no content to test
  with). `tools/netlify/static.mjs` skips the missing pictures folder with a warning.
- **Tests**: backend 756, all passing. `questionPack.test.js` was rewritten (15 tests to 11): the
  pack is gone and stays gone, an old database loses the rows at its next save and nothing else,
  and the checks on slim storage, a teacher's edits and deletions, underlines and Nova now run
  against the owner's own bank. No other test counted the pack.
- **Seen in the browser** on the IELTS preview pair, whose database copy still had the 1,657 rows
  and one unfinished drill holding nine of them: the server logged the 1,657 and the file on disk
  came out with 1,150 questions and no mention of a pack id; the public overview says 1,150 (479 /
  671); the Question Bank page, the Math section (19 skills, 671) and a Circles question in the
  player; the demo student's analytics unchanged; no console errors. **Not seen**: the studio's
  bank list (the test covers it), a student with answers on pack questions (none in the local
  data), anything on the live site.
- **Before deploying**: the live database has the 1,657 rows and real students. Run the new code
  against a copy of the live shape first (see "Netlify deployment"), and tell the owner that
  saved or missed pack questions will vanish from students' lists. The deploy would also carry the
  workbook questions below and the other session's practice-test lock above.

## Done since the last handoff (2026-10-13, later): two SAT workbooks in the bank (2,807 then, 1,150 since the pack went); Cambridge 7 to 10 not copied

The owner sent four archives (`Cambridge 7.zip` … `Cambridge 10.zip` on the Desktop) and two PDFs
(`Digital_SAT_100_Question_Practice_Workbook.pdf` and `…_Pack_2.pdf`) and asked: "Add these mock
tests to IELTS section and add these questions to SAT question bank. Why not all practice tests
are not visible in IELTS section". **Deployed 2026-10-13** with the third deploy (the live bank is 1,150).

### The workbooks: 199 more originals

- **What came**: two PDFs the owner made with ChatGPT (the PDFs' author field says OpenAI; each
  says its questions are newly written and not copied from official tests). 50 Math and 50 Reading
  and Writing each, all four-choice, with a key and a reason for every choice.
- **Where they live**: `backend/content/originals/batch4.json` and `batch5.json`, in `batch3.json`'s
  form, written by `tools/workbook/build.mjs` (its README lists everything the tool changes).
  Ids `WBM-101…150`, `WBRW-101…150` (workbook 1) and `…-201…250` (workbook 2); keys `nb-wbm-101`.
  **A third workbook is a drop-in**: run the tool with series 3, add the file to `FILES`.
- `content/originals.js`: the two files in `FILES`, and `convertChoiceList()` now takes a `table`
  (columns and rows of plain text). Nothing else in the app changed.
- **Changed on the way** (the README has the detail): each workbook skill placed under one of the
  bank's 29 by hand; math typed as `x^2`, `-`, `1/2x` put into the player's notation; three
  tables printed as `a | b` lines made real tables; a question added to the 16 items that are
  only a sentence with a blank (batch3's wording); "Passage 1 / 2" named "Text 1 / 2" in three
  questions; the "Correct — D is correct:" labels dropped from the reasons.
- **Left out: workbook 1, Reading and Writing 26** (`WBRW-126`, listed under `held` in
  `batch4.json`). Its sentence has a comma after the blank, so the keyed "however," gives two
  commas and "however" gives the right sentence. **The owner hasn't been asked yet whether to
  delete that comma**; if yes, take the entry out of `HELD` in `build.mjs` and fix the sentence.
- **Checked**: all 100 Math answers worked again by hand (all agree with the key); the three places
  an answer is printed agree for all 200; none of the 199 repeats a question in the bank, the ten
  practice tests or the other workbook. `WBRW-138` is arguable, not wrong, and is in.
- **Tests**: backend 760, all passing (6 new in `originals.test.js`: the files' own counts, every
  question word for word against its file, tables, notes, two texts, the added questions, the
  notation, a table that doesn't line up, and a table question over HTTP). `mathLayout.test.js`
  allows three more slashes that are not fractions (`adjacent/hypotenuse`, `distance/time`,
  `km/cm`) and one real fraction in a Reading and Writing explanation (`nb-wbrw-108`, "50/420").
- **Seen in the browser** on the IELTS preview pair (4020 / 5193, dark, 800 wide; "Practice bank:
  199 new" in the server log): a table question, a "Text 1 / Text 2" question and an exponent
  question in the player (`/practice/solve?source=shared&ids=…` opens questions by id), and a wrong
  answer's own reason. **Not seen**: light mode, a phone width, the explanation panel's tabs for
  these, any of it on the live site.

### Cambridge IELTS 7 to 10: not copied in, the second time of asking

Same as the section below about books 1 to 6: each archive is the published book (one PDF, 16
recordings), the site is public, and the rule of 2026-09-28 stands. The archives were listed,
never unpacked. **Why "not all practice tests are visible"**: nothing is hidden. The page lists
every test that exists, which is two (Practice Test 1 and 2, both original); the tests from the
books were never loaded. Checked on the live site as the demo student: "Tests available 2", three
sections each. The owner was told both things in the session's last message.

## Done since the last handoff (2026-10-13): 200 more bank questions, and ten SAT practice tests a student sits alone

The owner sent `sat_questions.json` (their Desktop) and `SAT-Practice-Tests-1-10.zip` (Downloads)
and asked: "add these questions to question bank and add these mock tests to practice section.
Make solving individual section available and timed untimed options." **Deployed 2026-10-13.** Three
sessions were working in this folder at once (see the two sections below), so nothing was uploaded.

### The question bank: 200 more originals (2,608 now)

- `sat_questions.json` is `backend/content/originals/batch3.json`, unchanged: 100 Math (MATH-001…100)
  and 100 Reading & Writing (EBRW-001…100), Easy 53, Medium 85, Hard 62. The file says its passages
  are original and its named researchers and works fictional.
- It is written differently from batch 1 and 2: plain text (the math is already in the player's
  notation, no LaTeX), two lists (`math`, `ebrw`), and each choice carries its own explanation.
  `convertChoiceList()` in `content/originals.js` reads that form. Keys `nb-math-001`,
  `nb-ebrw-001`; `source: "northstar-bank"`; stored slim like the rest.
- Each choice's explanation is its `rationales` entry (the right one gets the "Correct. " the
  player looks for) and the right choice's is also `explanation`. "Text 1: … Text 2: …" becomes the
  player's two labelled texts. Skill names are matched without regard to case, with five more
  mappings (`SKILL_ANY_CASE`), e.g. "Command of Evidence (Textual)" → "Command of Evidence".
- **Left as it came**: the five "quantitative evidence" passages write their table as lines of
  text ("2015: 6.5 hours"). They have no column headings, so they were not turned into real
  tables: the headings would have been invented.
- `mathLayout.test.js` allows two more slashes that are not fractions (`g/cm³`,
  `hypotenuse/adjacent`); `questionPack.test.js` asked for two whole skills in one list of 200,
  which no longer holds them, and now asks by skill and level.

### The practice tests (`/mock`, "Practice tests")

- **What came**: ten self-contained pages, "SAT Practice Test A" … "J" (the zip is named 1-10).
  Each is the digital SAT's shape, rw1 27 / rw2 27 / m1 22 / m2 22 questions, 32 and 35 minutes a
  module, 980 questions in all (861 multiple choice, 119 typed), every one with an explanation, a
  domain and a skill. Each page says its questions were written for it.
- **Where they live**: `backend/content/practiceTests/test-a.json` … `test-j.json`, written by
  `node tools/practice-tests/extract.mjs <folder with the .html files>`: the page's `DATA` and its
  score table, read as text and never run, one question per line. **A new test is a drop-in: run
  the tool on its page**; every `test-*.json` in the folder is loaded.
  They are **not in the question bank** (a student should first meet them in the test) and not in
  `db.json`.
- **Mark-up**: the questions use `<i>`, `<sup>`, stacked fractions, roots, source lines, Text 1/2
  labels, notes, tables and 17 drawn figures (SVG). `content/practiceTests.js` reads it once into a
  small tree (`p · src · label · eq · notes · table · fig`, and `i · u · sup · sub · frac · root ·
  br` inside them) and the page draws the tree with its own elements
  (`frontend/src/components/RichText.jsx`, `rt-`, using MathText's `mx-` classes): **nothing from
  the files reaches the browser as HTML.** Only the tags, classes and attributes the tests use are
  known (every SVG attribute is checked against a pattern); anything else throws, and a test with
  one question that can't be converted is left out whole and logged
  (`PRACTICE_TEST_PROBLEMS`, empty today). Figures use `currentColor`, so they follow the theme.
- **A sitting** (`backend/practiceTests.js`, `db.practiceTestRuns`, `/api/practice-tests`,
  `routes/practiceTestRoutes.js`): one student, one test, and two choices at the start:
  `scope` (`full`, or one section: `rw` / `math`, its two modules) and `timed`.
  - Modules are sat in order. Timed: the clock is the server's, starts when a module is first
    opened, keeps running if the student leaves, and at zero plus a minute's grace the module is
    handed in with what was autosaved (`settleRun`, also done by the list). Untimed: no deadline;
    the stopwatch is the time spent on questions.
  - Nothing is marked or shown until the sitting is over (the last module, or "End this attempt",
    which hands in the module in progress and leaves the rest out; a sitting with nothing handed
    in is removed). One sitting of a test at a time; every finished one is kept.
  - A typed answer is marked by the pages' own rule (`isRight`): a whole number exactly, anything
    else to within 0.001. The scaled score is the pages' own table (`scaledScore`, the same in all
    ten), and a section is only scaled when both of its modules were sat.
  - Reads don't write the database (`look()` in the routes): on Netlify every write uploads it.
- **Screens**: `pages/hub/PracticeTests.jsx` (cards and the start dialog, inside
  `MockExams.jsx`, which now has a capsule "Practice tests / Teacher's tests", `?kind=`),
  `pages/practicetest/PracticeTestRun.jsx` (`/practice-test/:runId`, between modules, with the
  ten-minute-break note), `PracticeTestModule.jsx` (`/practice-test/:runId/:module`, the
  diagnostic's test screen: mark for review, cross-out, navigator, calculator and reference in
  Math), `pages/hub/PracticeTestResult.jsx` (`/mock/practice/:runId`: score, domains, every
  question with both answers and the explanation). Styles `practicetest.css` (`pt-`).
- **Elsewhere**: XP is `scorePracticeTestModule` (a mock module's worth, paid for the best score
  on that module so far, `progress.testXp`); rewards wait for the results page. A *timed* module
  with something answered counts for the Test Taker / Full Send trophies, the weekly plan's mock
  task (`weekWork`) and the score trend and estimate (`examStats`, scaled on the test's table).

**My calls, not the owner's** (they asked only for the three things quoted above):
- ~~A practice test is not locked.~~ **Changed 2026-10-13: every module is locked**, after the
  owner asked why switching tabs wasn't blocked. See "SAT practice tests are locked" above.
- "Individual section" means Reading and Writing or Math (two modules), not a single module.
- A timed clock can't be paused; untimed sittings stay out of the score trend and the trophies.
- XP at mock-exam rates, best score only, and nothing for a module with no right answer.
- Misses are **not** copied into Saved & Mistakes; the results page is where they are reviewed.
- The five text tables in the bank file were left as text (above).

**Not done** (staff can see practice-test results since the evening of 2026-10-13, and the admin
can make tests in the studio: the section near the top): ~~teachers and the admin can't see
practice-test results~~; Math skills in the tests
have their own names (about 200), so results are by domain and don't feed the skill map or the
trap profile; no highlighter on the test screen; the weekly plan still only offers a mock task
when a teacher's session is waiting; the cover page doesn't mention the tests.

**Tests**: backend 754, all passing (21 new in `practiceTests.test.js`: every question compared
with its source word for word, the mark-up reader and what it refuses, marking and the score
table, and sittings over HTTP: whole test, one section, untimed, closed by the clock, ended early,
another student's, reads that don't write; 5 new in `originals.test.js`). Build clean; oxlint 0
errors. **Seen in the browser** on the DB copy (dark at 1280, light at 375): the list and start
dialog, a timed full test (module 1 by hand: source line, underline, two texts, table, notes, mark
for review, review page, hand-in; the rest handed in through the API), Math (equations, a stacked
fraction, a drawn figure, a typed answer, calculator, reference), the results and answer review, an
untimed Math section (stopwatch, leave and resume, end early), no sideways scroll at 375.
**Not seen**: a clock actually reaching zero in the browser (covered by the HTTP tests), all 17
figures (one was looked at, in dark mode), any of it on the live site.

## Done since the last handoff (2026-10-13): IELTS practice tests, analytics, band calculator, chunks in IELTS

The owner sent three archives (Cambridge IELTS books 1 to 6: a PDF and 16 recordings each) and
asked to "add these practice tests as practice tests on IELTS section", to "make token system
available in IELTS section also" and to "make IELTS section also ready like SAT section".
**Deployed 2026-10-13.**

- **The Cambridge books were not copied in**, and must not be: they are commercially published
  (Cambridge University Press & Assessment) and the site is public. The archives were only listed,
  never unpacked. What was built is the practice-tests feature, a second original test, and a studio
  screen that turns any practice parts into a test, so material the owner holds a licence for can be
  loaded through the editors. The 2026-09-28 rule stands: no Cambridge passages, questions, keys or
  recordings in this repo. **The owner has not answered this yet**; they asked for the books.

### Practice tests (a whole test, taken alone, a section at a time)

**Superseded in part the same evening** (the section "one Practice tests section per exam" near the
top): a test owns its parts now and is built on its own page, not from section-practice parts, and
a section's rows no longer mark section-practice parts as tried. How a section is taken, marked,
paid and reviewed is as described here.

- **What a test is**: a named list of practice-enabled records, `db.ieltsPracticeTests`
  `{ id, seedKey?, title, description, level, parts: { listening, reading, writing }, active }`.
  Nothing is copied: the parts stay in section practice too, and a part that is deleted or taken
  out of practice simply drops out of the test (`sectionRecords` in `ielts/lib/practiceTests.js`).
- **Taking one**: a section is Listening parts 1-4, Reading passages 1-3 or both Writing tasks,
  numbered 1-40 across the parts (`sectionContent`). Routes in `ielts/routes/testRoutes.js`, at
  `/api/ielts/student/tests` (`requireStudent`): `GET /` (tests with the student's progress),
  `GET /:id/:kind` (never the key), `POST /:id/:kind/submit`, `GET /attempts/:attemptId` (a
  finished section again, with marks and key).
- **What a submit stores**: one `ieltsTestAttempts` row for the section, and one ordinary
  `ieltsPracticeAttempts` row per part with `testAttemptId`. So section practice shows the parts
  as tried, the diagnostic's "untried" rule sees them, and XP is paid part by part under the old
  rules (`scoreIeltsPart` / `scoreIeltsEssay`: a retake only earns for what got better).
- **The band on a test card** is the mean of the best Listening and Reading bands, rounded the
  IELTS way, and is labelled as an estimate from those two: Writing and Speaking need a teacher.
- A section holding a part that is waiting in the student's diagnostic answers 409, like practice.
- **Student pages**: `/ielts-prep/practice-tests` (`pages/hub/IeltsPracticeTests.jsx`, `ns-pt-`),
  the runner `/ielts-test/:testId/:kind` and the review `/ielts-test/review/:attemptId`
  (`ielts/exam/TestRunner.jsx`, `ie-test-`). The runner reuses `ExamScreen`: Listening in test
  conditions (the four recordings back to back, then two minutes) or practice mode (a recording
  per part, pause and replay); Reading and Writing timed (60 minutes) or untimed. It is not locked
  like a mock (leaving doesn't cancel): it is self-study. It shares `PracticeAudio` and
  `TranscriptPanel` (exported from `PracticeRunner.jsx`) and the exam-room preferences and
  self-check questions in `ielts/exam/practiceBits.js`.
- **Content**: Practice Test 1 is the first practice set (`seed/practice.js`); **Practice Test 2
  is new and original** (`seed/test2.js`, scripts in `seed/test2Transcripts.js`, chart
  `seed/assets/images/attraction-visits-graph.svg`, audio `T2L1`-`T2L4.wav` from
  `generate-audio.js`, about 34 MB). `seed/tests.js` names each test's parts by seedKey and
  `ensureIeltsPracticeTests()` (called in `app.js` after `ensureIeltsPractice`) adds or refreshes
  them; a test the admin saved (`customized`) or deleted is left alone. Section practice now lists
  8 listening parts, 6 passages and 6 writing tasks.
- **Studio**: "Practice tests" in the admin's IELTS group (`ielts/admin/PracticeTestsPage.jsx`,
  `panels.js` key `ielts-practice-tests`, admin only like the content). Routes in
  `ielts/routes/testAdminRoutes.js` at `/api/ielts/admin/tests`: list (with the parts a test can
  be built from), create, `PUT`, `PATCH { active }`, soft delete. One part per number; only
  practice-enabled parts (`cleanParts`). **To turn new material into a test: create each part in
  its editor with "Use in" set to practice or both, then choose the parts here.**

### Comet chunks in IELTS

Chunks were already earned by IELTS work through `award()` (first study of the day, daily goal,
levels, trophies) and spent the same way (Ask Nova, the shop). New, in `shop.js` `CHUNKS`:
`ieltsSection` (3) the first time a section of a practice test is finished properly, and
`ieltsTest` (10) once all the sections of one test have been. "Properly" is a quarter of the
answers right, or every essay at its minimum length (`sectionCounts`), so an empty sheet pays
nothing. Paid once each: `progress.ieltsTests[testId]` lists what has paid. `award()` now takes a
list of `[amount, why]` pairs as well as one. The shop's "how you earn them" list, the practice
tests page, the result banner and a new wallet card on the IELTS home all read the amounts from
the server. **My numbers, not the owner's**, like the other earning amounts.

### The rest of "like the SAT side"

- **IELTS analytics** (`/ielts-prep/analytics`, `pages/hub/IeltsAnalytics.jsx`, `ns-ia-`;
  `GET /api/ielts/student/analytics`, `ielts/lib/analytics.js`): totals, a card per skill with a
  band estimate and a trend line, accuracy by question type (from the latest try at each part,
  marked again from the stored answers; weakest first; a link asks Nova about the weakest),
  accuracy by part number, and recent work linking to reviews. All of it is read from
  `ieltsPracticeAttempts`; nothing is stored or self-reported.
- **Band calculator** (`/ielts-prep/score`, `IeltsBandCalc.jsx`, reuses `calc.css`): right answers
  out of 40 to a band for Listening and Reading, bands set by hand for Writing and Speaking, the
  overall band with the IELTS rounding, and what the target still needs. The tables come from
  `GET /api/ielts/student/bands` (`LISTENING_BANDS` / `READING_BANDS` in `lib/scoring.js`), so the
  page can't drift from the marking. It starts from the student's own practice when there is some.
- **Menu**: the IELTS side gained Practice Tests, Your Sky, Analytics and Band Calculator. On the
  IELTS side the sky page's "practise" button opens IELTS practice (`Sky.jsx` reads `exam`).
- **IELTS home**: a practice-tests strip and the comet-chunk card (`ns-ih-`).
- **Not built for IELTS** (the SAT side has them): a daily star, the weekly study planner, a
  saved-and-mistakes queue with spaced review, the point-gap map, Nova inside a question. A
  finished practice-test section can be reviewed again; a single practice part can't yet (it
  reopens the part).

### Tests and checks

- Backend 754, all passing. `ielts/tests.test.js` is new (11 tests: listing, numbering, marking,
  XP and chunks once, the empty-sheet rule, writing, reviews, the diagnostic lock, analytics, the
  band tables, the studio's routes and who may use them). `ielts/practice.test.js`,
  `diagnostic.test.js` and `routes.test.js` had their part counts raised for the second set.
- Frontend build clean; the new files add two lint warnings of kinds the repo already has.
- Seen in the browser on a database copy (demo student and the development admin, dark, 1280
  wide): the practice tests page, a Reading section run (four answers, the confirm dialog's count,
  marking, the review with keys, "Review last" and "Retake" afterwards), the IELTS home, the
  analytics page on the demo student's real history, the band calculator, and the studio page
  with its create form. **Not seen**: a Listening section (the audio playing through four parts),
  the Writing feedback screen, light mode, a phone width, creating a test through the form (the
  routes are tested), and the new recordings were not listened to.
- The previews used their own pair of servers (`northstar-backend-ielts` on 4020 with
  `%TEMP%\northstar-db-ielts.json`, `northstar-frontend-ielts` on 5193, in `.claude/launch.json`)
  because two other sessions were editing this project at the same time.

## Done since the last handoff (2026-10-13): teachers make the classes; the grade classes are gone

The owner: "delete any classes, like 5-11, just teacher will create a class and he will assign the
class and name of that class, we don't need to put that. Discussion will begin if student joins a
classroom". There are no ready-made classes any more. **This section is the rule for classes now;**
where the two older class sections below (2026-10-12 class codes, 2026-10-09 classes) say "grade",
`GRADES`, `g7`, `db.classCodes`, `school` or `{ presidential, grade }`, read this instead. What a
class does (stats, goal, cheers, homework rules, chat safety, effort-not-accuracy) is unchanged.

**The model** (`backend/classrooms.js`).
- `db.classes`: `{ id, name, code, createdAt, by?, codeAt? }`. A teacher makes a class and names it;
  it gets its six-character code on the spot. Names are 1 to 40 characters and unique without
  regard to case (`cleanClassName`). `classInfo(cls)` is `{ id, name, mark }`; `mark` is the short
  badge every screen shows where the grade number used to be (`classMark`: "7A Math" is "7A",
  "Grade 7" is "G7", "Olympiad team" is "OT"; up to three characters).
- On the user: `classId` (the class they are in), `noClass` (they said "I don't have a class", or a
  teacher took them out: the hub stops asking), plus `classSetAt`, `codeTries`, `chatMuted` as
  before. `school` and `grade` no longer exist.
- **`classOf(db, user)` takes the database now** (it looks the class up for its name). `inClass(user)`
  answers "in any class?" without it (staffScope, filters). `classFields(db, user)`,
  `schoolAsked(db, user)`, `classMembers(db, classId)`, `sameClass(a, b)`, `allClasses(db)` (by name,
  numbers in order), `classRoom(classId)` (`class:<id>`).
- `createClass`, `renewClassCode(db, id)`, `deleteClass(db, id)`, `cleanClassIds(db, v)` (`"all"` or a
  list of ids), `cleanClassChoice` + `placeStudent` (staff move a student, no code, no wait),
  `chooseClass(user, classId | null)`, `joinWithCode(db, user, typed)`.
- **Deleting a class** takes its students out (no `noClass`, so they are offered the code question
  again, and `classSetAt` is cleared so they can join another at once) and removes its chat room,
  reads, reports, weekly goals, and the homework and announcements that were for it alone (ones for
  several classes stay for the others). Private chats stay.
- **`retireGradeClasses(db)`** runs at startup (`app.js`) and clears the old grade classes out of an
  older database: students leave them (`school: "other"` becomes `noClass`), and the grade chat
  rooms, goals, codes (`db.classCodes`), grade homework and grade-only announcements are deleted. It
  does nothing the second time. **It ran on the live site with the 2026-10-13 deploy** (the owner
  said yes to clearing the grade classes there first).
  `backend/data/db.backup-before-teacher-classes-*.json` is the local database from just before.

**Everything keyed by class id.** Homework rows have `classIds` ("all" at the time it is set is every
class there was then; a class made later doesn't inherit old homework). Announcements have
`classIds`, or none for every class (those do reach classes made later). Weekly goals
(`db.classQuests.classId`) and chat rooms use the class id. `classSnapshot(db, classId)` has
`classId` where it had `grade`.

**API.**
- Student: `PUT /api/class/membership` takes `{ code }` or `{ leave: true }` (was
  `{ presidential: false }`). `classroom` everywhere is `{ id, name, mark }`.
- Studio (`routes/adminClassRoutes.js`, both panels): `POST /api/admin/classes { name }`,
  `PUT /:id { name }`, `DELETE /:id`, `POST /:id/code`, `GET /:id` (was `/:grade`); `GET /` lists the
  classes that exist with `code`, `by` (who made it) and `limits.name`.
  `PUT /api/admin/students/:id { classId }` (an id, or null for no class) replaces
  `{ presidential, grade }`. `GET /api/admin/students` and `/students/:id` carry `classes` for the
  filter and the move. Homework and announcements take `classIds`.

**Frontend.** Studio `Classes.jsx`: a "New class" card (`ClassNameForm`, also used to rename), the
open class has Rename and "Delete class", the address is `?class=<id>`. `ClassPicker.jsx` takes
`classes` (every class) instead of grades; `classesLabel(ids, classes)` needs **every** class, not
one homework's own, or it says "All classes". Students list and profile use class ids. Student side
shows `classroom.mark` in the badges (`cr-head-badge` is 26px now, for three characters). The join
screen and Settings say the teacher makes the class; "Presidential School" is gone from the copy.

**"Discussion will begin if student joins a classroom"**: read as "the class chat is there from the
moment a student joins", which is how it already worked; nothing has to be opened by a teacher. A
test pins it (a class of one writes straight away). If the owner meant something else (a welcome
message, a teacher opening it), that is still to do.

**My calls, not the owner's.** Any member of staff can make, rename and delete any class, and
teachers still see every class (the class records who made it, so "a teacher's own classes" is a
small change later). A deleted class's chat is deleted, not archived. No limit on how many classes
a teacher makes (300 in all).

**Tests:** backend 754, all passing (`classroom.test.js`, `staff.test.js`, `examLock.test.js` now
make their classes first). On Netlify the startup step runs on the live data (`netlify.js` pulls the
database before it imports `app.js`). Frontend build clean; oxlint warnings only. Checked in the browser on the
database copy: the old grade classes cleared at startup (4 students out), the empty Classes page,
making "7A Math", a student joining with its code, the class discussion (a message sent and read in
the studio), rename, the picker in Announcements, the students filter, delete and the student back
on the join screen. **Not checked in the browser:** the Homework page (teacher panel only; the copy
has no teacher login I know) and the student profile's class select. Screenshots time out in the
pane, so the look was checked by text and measurements only. **Deployed 2026-10-13.**

## Done since the last handoff (2026-10-12, later): everything you can point at answers the cursor

The owner: "When hovering over smth with a cursor certain things/sections should lit up or should
just show that you are pointing it", and left the choice of where to me. The app already had about
270 hover rules, so this filled the gaps. CSS only, plus one class name in `StudentsList.jsx`.
**Deployed 2026-10-13.**

- **How the gaps were found**: a script in the page listed every link, button, field and
  `cursor: pointer` element that no `:hover` rule could match, over the student hub, the player,
  the cover page, the sign-in screens and the admin panel. Not covered: popovers, dialogs and
  menus that were closed, the teacher studio as a teacher, a class page (the demo account has no
  class), and the exam rooms, which keep their plain look on purpose.
- **Controls that had no hover and now do**: every tab strip and segmented switch (`.ns-tabs2`,
  `.ns-sky-tabs`, `.ns-gap-seg`, `.ns-seg`, `.pl-optabs`, `.ns-calc-route`, `.ad-seg`; the
  unselected ones take a soft fill), the sidebar's picture and name (they light up together), the
  XP chip, the phone tab bar, the skill checkboxes, the planner's day rows and week headings, the
  score calculator (steppers, slider handle, fold-outs, goal field), the player's cross-out button
  and question counter, the picture picker's chips and swatches, `.modal-close`, the admin's
  sortable headings, theme switch and "Open student site", IELTS status pills, the cover page's
  FAQ rows and teacher link.
- **Fields** (`.ns-input`, `.ad-input`, `.ad-search`, `.field`, `.ie-input`, the Nova and message
  boxes): the border takes a tint of the focus colour under the cursor.
- **Things that open nothing still answer, but never lift or take the pointer**: stat tiles
  (`.ns-stat2`), locked trophies (they come to full strength so the text can be read), the XP
  rules, rows of the league table and the chart's data table. These sit inside
  `@media (hover: hover)` so a tap on a phone doesn't leave them lit.
- **A pointer that promised a click and gave none** is gone: `.ad-table th` no longer has
  `cursor: pointer` (only `th.ad-th-sort` does), and the rows of the Teachers and Homework tables
  keep their highlight without the pointer.
- **The rule for new work**: a new clickable thing gets a `:hover` beside its base rule, in the
  vocabulary already there (a `--chip` or `--primary-softer` wash for small controls, a stronger
  border for outlined ones, a lift only for a card that is a link). Something that isn't
  clickable may light up but must not lift or change the cursor.
- **Checked** with a real cursor in the browser on the database copy, dark and some in light:
  tabs, a stat tile, the sidebar name, the XP chip, the calculator's stepper, switch, slider and
  fold-out, a planner day and week, a locked trophy, an XP rule, the player's two buttons, the
  admin's switch, sortable heading, theme switch and search, an FAQ row. The rest were checked by
  the script only (a matching rule exists), not by eye. Build clean, no new lint warnings.

## Done since the last handoff (2026-10-12): a class is joined with its class code only

**Partly superseded on 2026-10-13** (see that section, above): classes are no longer the grades, the
code lives on the class (`db.classes[].code`, no `db.classCodes`), and leaving is `{ leave: true }`.
The rule itself stands: sign-up doesn't ask, and the code is the only way in.

The owner: "Make classrooms joinable only with the class code not while registration". Sign-up no
longer asks about school or grade, and a student can't put themselves in a class by naming a grade
any more. This closes the open risk in the classes section below ("anyone can sign up and say they
are in a grade"); where that section says a student chooses a grade, this section is the rule now.

- **One code per class** (`db.classCodes`: `{ classId: "g7", code, createdAt, by? }`), six characters
  from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no I, L, O, 0, 1). All in `backend/classrooms.js`:
  `ensureClassCodes(db)` (made the first time anything needs them; nothing to seed or migrate),
  `classCode(db, grade)`, `renewClassCode(db, grade, by)`, `cleanCode(typed)` (case, spaces and
  dashes don't matter), `joinWithCode(db, user, typed)`.
- **Student:** `PUT /api/class/membership` takes `{ code }` (join, or move to another class) or
  `{ presidential: false }` (leave, or "I don't have a class"). `{ presidential: true, grade }` is a
  400. The 30-day rule on moving and leaving is unchanged (`chooseClass`). Wrong codes are counted
  on the user (`codeTries`, 8 in 30 minutes, then 429): on the record, not in memory, so it holds
  on Netlify. `GET /api/class` sends `codeLength`, no longer `grades`.
- **Sign-up:** `POST /api/student/register` ignores `presidential` and `grade` (an old cached form
  still creates the account). A new account has `school` undefined, so `schoolAsked` is false: "My
  Class" shows in the menu with "New" and the home page offers "Got a class code from your
  teacher?" until they join or press "I don't have a class".
- **Studio (both panels):** `GET /api/admin/classes` and `/:grade` carry `code`;
  `POST /api/admin/classes/:grade/code` makes a new one (the old stops at once, members stay).
  Staff still move a student directly with `PUT /api/admin/students/:id { presidential, grade }`.
- **Frontend:** `components/ClassCodeField.jsx` (`cr-code`, in `classroom.css`) replaced
  `SchoolPicker.jsx` and `school.css`, which are gone. It is on the join screen (`Classroom.jsx`)
  and in Settings > Account > "Your class" (`SchoolSettings.jsx`: "Enter class code" / "Change
  class" / "Leave class"). The field goes read-only while a code is checked, not disabled, so the
  cursor stays for a retype. Studio: the code on each class card and a panel with Copy and "Make a
  new code" in the open class (`Classes.jsx`, `ad-cls-code`).
- Students who chose a grade at sign-up before this stay in their classes.
- **Tests:** backend 708, all passing (`classroom.test.js` 59; the three class test files now join
  with a code instead of registering into a grade). Checked in the browser on the database copy:
  sign-up without the question, a wrong code, a replaced code refused, the new code joining Grade 7
  (typed in small letters with a dash), the Settings card, the studio's codes and a new code.
  Screenshots timed out in the pane, so the look was checked by measurements, not by eye.
- Deployed 2026-10-13, in its later form (a code per class a teacher makes; see the section above).

## Done since the last handoff (2026-10-11): three vocabulary modes, and pill buttons everywhere

The owner sent a screenshot of three mode cards (Learn Mode, Flashcards, Match, each with a pill
"Start" button) and asked for the vocabulary section to be "like this or add some interactive
features", and for buttons to be "more rounder" (with a screenshot of our practice player). **Not
deployed**: the live site still has the old single flashcard page and the old buttons.

### Vocabulary (`/vocab`)

The page opens on three mode cards, the deck's mastery and a searchable word list. The open mode is
in the address (`/vocab?mode=learn|cards|match`), so the browser's Back button leaves a round.
Only the structure of the reference was taken (three modes, a Start on each); the cards are our own
look (tinted panels in the sidebar's blue-to-violet family, our icons, a small drawn picture each).

- **Learn mode** (`vocab/LearnMode.jsx`): the 10 weakest words through three steps. (1) Read each
  flashcard (nothing is marked). (2) Match them, in two boards of five, no clock. (3) Complete each
  word's example sentence: the sentence with a gap, **the meaning shown as a clue**, four words to
  choose from. A word missed there comes back once at the end. A word whose example doesn't
  contain it is asked by its meaning alone.
- **Flashcards** (`vocab/Flashcards.jsx`): 10 cards a round, the old flip card and four ratings.
  "Again" brings the card back at the end of the round; "I know this word" rates it Easy without
  turning it over.
- **Match** (`vocab/MatchGame.jsx`): 6 words and 6 meanings mixed on one board, against the clock.
  A wrong pair adds 2 seconds. The best time is kept.
- Shared pieces: `vocab/VocabBits.jsx` (`ModeFrame`, `FlipCard`, `MatchBoard`, `SaveState`),
  `vocab/useVocabSend.js` (sends answers; ones a failed request couldn't deliver go with the next),
  `vocab/exercises.js` (plain JS: which words a round takes, the gap in a sentence, the choices,
  the tiles). Styles: `src/vocab.css` (`vc-`); the flip card is still hub.css's `.ns-flip`.

**The server marks Learn and Match** (the owner's rule: nothing self-reported). `backend/vocabPractice.js`
has every number (`VOCAB_PRACTICE`) and the rules.
- `POST /api/practice/vocab/answers` `{ mode: "learn" | "match", answers: [{ id, kind, pick }],
  seconds? }`. `id` is the word asked about, `pick` the word the student chose for it; `kind` is
  `match`, `sentence` or `word`. Right when the two are the same word.
- Only the **first** answer to a word in each kind of exercise counts in a request, so trying the
  choices in turn earns nothing. Mastery: match +6 / -4, sentence and word +12 / -10, kept in 0..100.
- A word answered right is paid like a flashcard (`scoreVocabReview`: 2 XP, once a day per word,
  under the same 40-a-day cap), so the new modes are not a new source of XP, and it counts toward
  the weekly plan's vocab task (`settlePlan` takes `words`). A wrong answer pays and counts nothing.
- Match time: the page's clock plus 2 s per wrong pair, kept as `progress.vocabGames.matchBest`
  when all 6 pairs were found and the time is one a person could play. Nothing is paid for a time,
  so the clock is the page's own.
- `GET /api/practice/vocab` now also sends `games` (`round`, `pairs`, `penalty`, `matchBest`,
  `today`) and, on each word, `near`: the words that must never be offered as a wrong choice for it.
- **Near-synonyms** (`nearWords`): the starter deck has many (viable/feasible, ephemeral/transient),
  and "feasible" offered against "viable" would be a second right answer. They come from
  `VOCAB_NEAR` in `practiceContent.js` (hand-made groups for the starter words: **add a new starter
  word's near-synonyms there**), from a definition that uses the other word, and from definitions
  that share a telling word. Wrong choices also prefer the same part of speech, and a Match board
  or a Learn board avoids holding two near words.
- Flashcards still use `POST /vocab/:id/rate`: a flashcard is the student's own rating by nature.

**Tests:** `backend/vocabPractice.test.js` (14: the exercise builder, near-synonyms, the route,
the time, the plan). Backend 702, all passing; build clean; no new lint warnings.

**Checked in the browser on the DB copy** (demo student, dark; the home page also light and at 375
wide with no sideways scroll): a flashcard round (Again returned at the end, "I know this word",
the summary, +20 XP), a Match board (a wrong pair shook and cost 2 s, "New best time", the best
shown before the next board), a whole Learn round (two boards, ten sentences with one missed and
asked again, the summary's marks and mastery matching the server's rules). Driven by script clicks
on the real buttons, not by hand; keyboard shortcuts (Space, 1-4, K, arrows, Enter) were not pressed.

**My calls, not the owner's:** the three steps of Learn and their order; the clue under the sentence
(without it most adjectives fit most gaps); the mastery numbers; 6 pairs and the 2-second penalty;
"I know this word" counting as Easy; Learn and Match needing 4 words in the deck; the plan's vocab
task counting words answered right in the new modes.

**Not done, or worth knowing.**
- No typing exercise (spelling the word), no audio, no way to pick which words a round takes
  (always the weakest), no teacher view of vocabulary beyond the mastered count.
- Mastery is still a simple score, not spaced repetition ("Good next tasks" no. 1 stands).
- The near-synonym rule from definitions is crude: it also keeps apart words that merely share a
  word in their definitions, which only makes the choices a little fewer.
- On a phone the Match board is two columns and six rows: it fits 375 x 812, a shorter screen scrolls.

### Buttons are pills

`--btn-radius: 999px` in `index.css` is every button's radius: `.btn`, `.ns-btn`, `.pl-bb` and the
player's other controls, `.cv-btn`, `.au-btn`, `.lk-btn`, `.ie-btn`, the studio's buttons. Icon-only
buttons are circles, segmented switches and tab strips are pills (`.ns-exam-switch`, `.ns-tabs2`,
`.ns-seg`, `.ad-seg`, `.ns-sky-tabs`, `.pl-optabs`, `.ns-gap-seg`). A control that can hold more than
one line takes `--radius-tile` (20px) instead: answer choices (`.pl-opt`, `.option-row`), the
flashcard rating tiles. The player's question bar is a pill with a round number. **A new button
should use `var(--btn-radius)`, never its own pixel radius.**
- Seen in the browser: the player, the vocabulary page, the dashboard, Saved & Mistakes, the staff
  sign-in, the admin's mock tests and IELTS sessions; the cover page's buttons by computed style.
- Not looked at after the change: the mock-exam screen, the IELTS exam room, the diagnostic test,
  the lock screens, the teacher studio as a teacher. They use the same classes.
- Left as they were: inputs, cards, menu rows, the settings side menu, the navigator's tiles.

## The test lock (built 2026-10-10, deployed the same day, browser checks the same night)

The owner's rule: "there must be no way to switch or the test must be finished and cancelled due to
cheating. If it is a homework, the teacher must be warned. The warning must be shown before each of
them (mock test, diagnostic test and homework)." For homework they chose "record leaves only". A
web page can't stop a student switching away, so the page notices the moment it isn't in front and
the server cancels the test there and then.

- **Server**: `backend/examLock.js` (the kinds of leave, their words, rounds, `reinstate`). A
  cancellation is on `participant.cancelled` (SAT mock), `exam.cancelled` (IELTS mock, with the
  section) or `status: "cancelled"` on a diagnostic. Nothing is marked or scored, no XP.
  Leave reports: `POST /api/exam/session/:sessionId/leave`, `/api/diagnostic/:id/leave`,
  `/api/ielts/exam/leave`, `/api/ielts/student/diagnostic/:id/leave`, and for homework
  `/api/class/homework/:id/leave` (`{ event: "left" | "back", seconds }`, only counted). Let back
  in: `POST /api/sessions/:sessionId/participants/:participantId/reinstate` and
  `/api/ielts/admin/sessions/:id/participants/:userId/reinstate` (both `requireStaff`). Each one is a
  new round, so a report left over from before the teacher's decision can't cancel again.
  Tests: `examLock.test.js`.
- **Page**: `frontend/src/lock/` — `useExamLock.js` (`mode: "strict"` or `"report"`; what counts as
  leaving: `hidden`, `blur` after 1.2 s, `closed`, `exit`; `useLeaveReport` keeps an unsent report
  in `localStorage` as `ns_lock_<key>` and sends it the next time the test opens), `LockScreens.jsx`
  (`LockNotice` before, `LockGate` over a test out of full screen, `LockEnded` after), `lock.css`
  (`lk-`, index.css tokens only). Used by `pages/hub/Diagnostic.jsx` + `pages/diagnostic/
  DiagnosticTest.jsx`, `pages/ExamRunner.jsx` + `ExamModule.jsx`, `ielts/exam/ExamFlow.jsx`,
  `ielts/exam/DiagnosticRunner.jsx`, `pages/practice/Player.jsx` (homework, report mode), and
  since 2026-10-13 `pages/practicetest/PracticeTestRun.jsx` + `PracticeTestModule.jsx`.
- **Teachers** see it on the SAT session page (`pages/SessionDetail.jsx`, "Let back in"), in the
  IELTS session's table and participant drawer (`ielts/admin/ParticipantDrawer.jsx`), on a
  student's profile for diagnostics, and for homework as a "Left the page" column and a badge on
  the homework list (`pages/admin/Homework.jsx`).
- **My calls, not the owner's**: dropping out of full screen only covers the test (it doesn't
  cancel); the 1.2 s grace for a window losing focus; a student's own text can be cut and pasted
  inside an answer; closing or reloading counts as leaving; a teacher can let a student back into a
  mock test with the time given back, a diagnostic can't be reinstated; between two IELTS sections
  (on the instructions page) the lock is off.

**Checked in the browser on the DB copy, 2026-10-10** (dark and light, about 700 wide, 375 x 812 and
360 x 600; a new grade 7 student and a teacher made for it):
- SAT diagnostic: warning, start, the full-screen cover, copy / paste / right-click / print /
  reload / dev-tools keys refused, leaving cancels it, "Cancelled: you switched to another tab or
  app" in the history, the results page, a new one can be started, no XP. A real reload cancels it
  as "closed or reloaded". The Exit button asks, "Keep going" keeps the test, "Leave and cancel it"
  cancels.
- IELTS diagnostic (a Listening part): warning after "Start test", cover, a 0.7 s loss of focus is
  forgiven and a 2.2 s one cancels ("switched to another window"); copying your own answer and
  pasting it back works, pasting other text and copying the question don't.
- IELTS mock: the warning before Listening and again before Reading; leaving cancels; the
  student's list says "Your teacher can let you back in"; the teacher's table and drawer show it
  with the section; "Let back in" works and the time is given back; the second cancellation says
  "already been let back in once"; leaving on the instructions page between sections cancels
  nothing.
- Homework: the notice every time it is opened, nothing closes, a toast on coming back, the
  teacher sees "2 times · 4 s away" and "1 left the page" on the list.
- Phone: all three screens fit at 375 with full-width 44 px buttons; at 360 x 600 the warning
  scrolls and both buttons can be reached; with no full screen (as on an iPhone) the full-screen
  line is left out and the test runs with no cover.
- Text contrast on the three screens is 5.3:1 or better in both themes.

**How it was checked, and what that leaves open.** The built-in browser pane can't be made to lose
focus or go to full screen on demand (a background tab there stays "visible", and
`requestFullscreen()` never answers). So "the page is in front / hidden / without focus" and "in
full screen" were set by overriding `document.visibilityState`, `document.hasFocus` and
`document.fullscreenElement` and firing the browser's own events; the reload, the Exit button and
the clicks were real. **Not seen: a real tab switch, and real full screen**, in Chrome, Edge, Safari
or a phone. Do that by hand once on the live site before a class sits a test.
- **Open risk: a browser that says it has full screen and then doesn't give it.** That is what the
  pane did: the test started, the cover said "Go back to full screen", "Return to the test" did
  nothing, and the clock ran on. If a student's browser behaves like that (an in-app browser is the
  likely kind), they are shut out of a running test with no message. Not fixed: letting the test
  run without full screen when the browser refuses is a change to the rule, so it is the owner's
  call.
- A student who is let back in resumes without the warning being shown again.

## Done since the last handoff (2026-10-10, evening): two staff panels, the admin's and the teacher's

The owner: "admin panel and teacher panel is different things at all". They asked for the two to be
separated by sorting every feature (admin only, teacher only, or both), and for the admin to get in
through the teacher sign-in page: one certain email and password opens the admin panel, any other
account opens the teacher studio. Until now there was one "Teacher studio" and one kind of staff
account (`role: "admin"`) that could do everything.

**Roles.** `role: "teacher"` is new, beside `"admin"` and `"student"`. The admin runs the platform:
the content every student gets, the accounts, the public site. A teacher runs the Presidential
School classes. Nobody signs up as a teacher: the admin makes the account.

**One sign-in** (`/teacher/login`, `pages/StaffLogin.jsx`; `/admin/login` redirects to it).
`POST /api/auth/staff/login` (`/auth/admin/login` is kept as the same handler) looks the account up
among staff and answers `{ token, user: { …, role } }`; the role, not anything the page sends,
picks the panel. So "the certain email and password" is simply the admin account's (in development
`admin@example.com`; on the live site the one in `netlify-admin-login.txt`). **No login is written
into the frontend**: anything there can be read by every visitor. The page says "Teacher sign in"
and nothing on it mentions an admin panel (the two demo logins are a development-only hint).

**Guards** (`backend/auth.js`). `requireAdmin` is the admin alone; `requireStaff` is both. Both now
also check the account on every request (`userAuthState`, which carries `role`): a removed
teacher, a changed role or a new password ends the open session with a 401. Before, an admin token
kept working until it expired whatever happened to the account.

**The sort.** `frontend/src/studio/panels.js` is the one table (`FEATURES`, each with `for`): the
menu, the routes (`studioRoutes(panel)` in `App.jsx`) and the page titles are read from it. To move
a screen, change its `for` there **and** the guard on its API routes.
(**2026-10-13, evening:** the menu is grouped by exam now and several rows below became tabs of a
"Practice tests" section: mock tests, both kinds of session, the IELTS tests. Who may do what is
unchanged; see that section near the top for the menu as it is.)

| Feature | Admin panel | Teacher studio | API guard |
|---|---|---|---|
| Overview | yes, every student | yes, class students | `requireStaff`, scoped |
| Analytics | yes, every student | yes, class students | `requireStaff`, scoped |
| Leagues (global) | yes | no | `requireAdmin` |
| Students: list, profile, reset password, class, pause chat | yes, everyone | yes, class students | `requireStaff`, scoped |
| Students: name and email | yes | no | 403 `ADMIN_ONLY` for a teacher |
| Classes: class pages, chat, reported messages | yes | yes | `requireStaff` |
| Teachers (accounts) | yes | no | `requireAdmin` |
| Mock tests (build, duplicate) | yes | yes | `requireStaff` |
| Practice bank, import, reported questions | yes | no | `requireAdmin` |
| Vocabulary | yes | no | `requireAdmin` |
| Sessions (SAT): run, results, let back in, CSV | yes | yes | `requireStaff` |
| Sessions: create a new student account while adding | yes | no | 403 for a teacher |
| Homework | no | yes | `requireStaff` (see below) |
| Announcements | yes | yes | `requireStaff` |
| Messages (the "Message Developers" inbox) | yes | no | `requireAdmin` |
| Success stories (cover page) | yes | no | `requireAdmin` |
| IELTS Listening / Reading / Writing tests | yes | no | `requireAdmin` |
| IELTS sessions: run, mark, let back in, export | yes | yes | `requireStaff` |
| IELTS users (every account: create, edit, delete) | yes | no | `requireAdmin` |
| One student's IELTS dashboard | yes | yes, class students | `requireStaff`, scoped |

- **A teacher works with class students only** (`backend/staffScope.js`: `isTeacher`,
  `canSeeStudent`, `visibleStudents`). The owner's rule is that a student outside the schools has
  no teacher, so a teacher can't list them, open them, reset their password or add them to a
  session; the overview and analytics are worked out from class students. The demo account is never
  in a class, so teachers don't meet it. A teacher who takes a student out of the classes loses
  sight of them (the dialog says so).
- **Homework is the one teacher-only screen.** Its API still lets an admin token in (nothing there is
  beyond an admin); the admin panel just has no screen for it, and the admin's Classes page drops
  the homework tab and the "Set homework" button.
- The skill list (`GET /api/admin/practice/domains`) is `requireStaff`, because the homework screen
  draws by skill; the rest of that router is the admin's.
- `GET /api/admin/classes` gives `outside: null` to a teacher (the count of students outside the
  classes is the admin's).
- **Sessions are shared by all staff**: a teacher sees every session, including one an admin filled
  with students from outside the classes (names and scores in that session). Sessions have no owner.

**Teacher accounts** (`routes/adminTeacherRoutes.js`, `/api/admin/teachers`, admin only; page
`pages/admin/Teachers.jsx`, "Teachers" under People). `POST /` `{ firstName, lastName, email }`
answers `{ teacher, tempPassword }`; the password is shown once and only its hash is stored. Also
`PUT /:id`, `POST /:id/reset-password` (a new temporary password, signs the teacher out),
`DELETE /:id` (what they set stays). An email belongs to one account of any kind. `lastSignInAt` is
stamped on a teacher's sign-in, so the page shows who has never signed in.
- **Changing a password**: "Change password" in either panel's menu (`studio/StaffPassword.jsx`,
  `POST /api/auth/staff/password` `{ current, next }` → a new token). A temporary password is not
  forced to be changed at the first sign-in; the teacher is told to.
- The IELTS users page leaves teacher accounts out and answers 404 for them: its form knows two
  roles, and saving a teacher through it would have made them a student.
- `npm run seed` adds a development teacher (never in production: there the admin makes them).

**Frontend.**
- `/admin/*` is the admin panel, `/teacher/*` the teacher studio; both are `StudioLayout` with
  `panel`. `RequireStaff` sends a signed-in teacher who opens an admin address to the studio and
  the other way round; an address a panel doesn't have goes to its overview. The full-screen IELTS
  editors (`/admin/ielts/…/edit`) are the admin's.
- The staff session is still `admin_token` / `admin_user` in localStorage (the IELTS module reads
  them), now with `role` on the user; `useAdminAuth()` gives `role`. A session stored before this
  has no role and is an admin's.
- **Links in a shared page**: `studioPath("/students/…")` from `studio/panels.js` (it reads the
  panel from the address), never a hard-coded `/admin/…`. `useStudio()` (`studio/useStudio.js`)
  gives `isAdmin`, `isTeacher` and `has(key)` for the few places a shared page differs.
- The menu's groups changed: Insights, People, Content, Delivery, IELTS.

**Tests:** backend 688, all passing (21 new in `staff.test.js`: the sign-in, every admin-only route
refused to a teacher with nothing written, the shared ones, the scoping, teacher accounts, the
password change, the seed). Frontend build clean; oxlint warnings only. Seen in the browser on a
copy of the database (1280 wide, dark): `/admin/login` redirecting, the admin signing in to the
admin panel, a teacher made on the Teachers page signing in to the studio with the temporary
password and changing it, both menus, each side's refused addresses, the teacher's students list
(two class students of 28), an outside student refused, the "Class and chat" dialog, the IELTS
dashboard and its Back, the session dialog without "Create new user", the admin's Classes page
without homework, a wrong password; the Teachers page also at 375 wide.

**My calls, not the owner's** (they asked for the sort and left the sorting to me):
- Which side each feature is on (the table above). The least certain: mock tests and both kinds of
  session in both panels, announcements in both, Classes in both, homework teacher-only.
- Teachers see class students only, and can't change a student's name or email.
- Teachers can't create student accounts (from a session's "Add participants").
- An admin can't open the teacher studio with the admin account (they make a teacher account).
- The Teachers page, temporary passwords and "Change password" (needed for any teacher to exist).

**Not done, or worth knowing.**
- **Every teacher sees every class.** There is no "this teacher teaches grade 7": classes are grades
  across all the schools, and nothing says which teacher has which. Homework, announcements and
  sessions set by one teacher can be removed by another.
- Not seen in the browser: light mode, the IELTS "Add participants" dialog as a teacher (the API
  side is tested), a teacher's analytics with real answers in it.
- The page title in the browser tab is the cover page's on every studio screen, as before.
- **Deployed 2026-10-10** (deploy `6aca62addd77bec713fc6118`, with the classes, comet chunks, trophy
  cards and the test lock: everything built since `6ac8aabfce5d8efe1ae20a6f`). The live site has
  one admin and no teacher yet: the admin signs in at `/teacher/login` and makes the teachers there.
  - Before the upload the new code was run against a copy of `backend/data/netlify-seed.json` (the
    shape the live data started from) in production mode: 60 requests as the demo student, a new
    grade 7 student, the admin and a teacher made by the admin, all as expected, nothing lost.
  - Seen on the live site: `/api/public/overview` (2,408 questions, the owner's stories still
    there), `/admin/login` going to "Teacher sign in" with no development hint, the demo account's
    wallet (105 chunks) and `/shop`, a trophy card on `/trophies`, `/class` turning the demo
    account away, and the "This test is locked" warning before the SAT diagnostic.
  - Not exercised there: either staff panel (they need the sign-in typed by the owner), a real
    class (chat, homework), a locked test actually running or being cancelled.
  - The upload worked at the first try this time (39 s build).

## Done since the last handoff (2026-10-10, later): comet chunks, a currency apart from XP

The owner saw the top bar's crystal count as "tokens" that were really XP, and asked for two
systems: XP, and a spendable token named the **comet chunk**. Their rules: a message to Nova on the
Ask Nova page costs 1 chunk; Nova while solving a question is free; explanations are free; there is
a section for spending chunks on cosmetics.

- **Two counts, never mixed.** XP only goes up and sets the level and the league place. Comet chunks
  are earned at milestones and spent. Nothing converts one into the other. In the top bar XP is now a
  bolt with "XP" beside it (the gem read as a currency; the other XP gems became bolts too) and
  chunks are the new `comet` icon in Nova's colour (`--nova`), linking to the shop.
- **`backend/shop.js` owns it all**: `CHUNKS` (every amount), `SHOP` (the catalogue), the wallet
  helpers (`giveChunks`, `spendChunks`, `buyItem`, `lockedPart`, `walletView`, `chunkGuide`). The
  wallet is on the progress record: `p.wallet = { chunks, owned: [item id], log: [{ at, n, why }] }`.
  `shop.js` must not import `gamification.js` (it is the other way round).
- **Earning** happens in `award()` and nowhere else: the first work of the day (+2), the daily goal
  (+5), each new level (+10), each new trophy (+5), plus what a caller passes as
  `chunks: [n, why]` (the daily star, +3). The reward object carries `chunksGained`, and
  `celebrate()` shows it as its own pop. Every account starts with 15.
- **Accounts from before** get their wallet the first time `getProgress` sees them: the 15, plus
  what their levels and trophies would have paid, and whatever their picture is wearing is theirs.
- **Spending.** `POST /practice/tutor` charges 1 chunk when the server finds no question for the
  message (so a made-up `questionId` doesn't make a page chat free), refuses with 402 `no_chunks`
  at zero, and gives the chunk back if Nova fails. `tutor.js` gets `ctx.charge` / `ctx.refund`.
  The Ask Nova page shows the cost and a locked box at zero (`NovaChat` props `note`, `blocked`,
  `onSent`); the player passes none of them.
- **The Comet Shop** (`/shop`, `pages/hub/Shop.jsx`, styles `ns-shop-` in `hub.css`; in the sidebar
  for both exams): the balance, how chunks are earned and spent, the catalogue shown on the
  student's own picture, and the recent ins and outs. `GET /practice/shop`, `POST /practice/shop/buy`;
  the catalogue and balance also come with `GET /progress` as `chunks`.
- **What is sold**: the five things to wear and six frames (Dawn, Aurora and four new ones: Comet,
  Nebula, Starlight, Galaxy). All 30 characters and the eight plain frames stay free. A part of a
  picture is on sale only if `SHOP` lists it, so one new line there prices anything, a character
  included. `PUT /student/avatar` refuses a part that hasn't been bought (403), and the picker
  (`AvatarPicker`, `shopParts.js`) shows locked parts with their price.
- **Tests**: `shop.test.js` (13). `avatars.test.js` now uses free parts or grants the part first.
  667 backend tests pass. Seen in the browser on the DB copy: buying, wearing, the charge on Ask
  Nova, the zero state, the picker's locks, and `/shop` at 375 wide in light mode.
- **My calls, not the owner's** (they named the currency, the Nova cost and what is free; these
  were left open): the earning amounts and the starting 15, the grant to existing accounts, which
  parts are sold and their prices, the bolt for XP, and no teacher control over chunks.
- **Not done**: the studio shows nothing about chunks. (Deployed 2026-10-10 with the staff panels,
  see above.)

## Done since the last handoff (2026-10-10): earned trophies open a card

The owner passed on a classmate's idea: an earned trophy should be clickable and show something
about itself, so that earning one feels good.

- **The card** is `components/TrophyCard.jsx` (styles `ns-tc-` in `hub.css`, after the medals). It
  shows the medal up close (it flips in with a ring of sparks, and a click spins it again), the
  trophy's family from its medal shape, a line of praise, what it is for, the date it was earned,
  which trophy of the student's it was, and the next trophy on the same ladder with a progress bar.
  It is a portal with a focus trap; Escape, the backdrop, the cross and "Nice" all close it, and the
  focus goes back to the trophy that opened it.
- **Where it opens.** `useTrophyCard(progress.badges)` gives `open(id)` and `card`. Earned trophies
  are now `<button>`s on `/trophies`, in the Home trophy row and in the medal strip on the Settings
  profile card. Locked trophies are still plain tiles. The "Badge unlocked" banner is unchanged: it
  must not interrupt a drill.
- **The words and counts are the server's.** Every entry in `BADGES` has a `cheer`. `BADGE_LADDERS`
  (`gamification.js`) lists the badges that climb the same ladder, and `badgeLadder(p, id)` returns
  `{ step, size, next: { id, have, need, tally } | null }`; GET `/progress` puts it on each earned
  badge as `ladder`. The ladder's `need` numbers repeat the rules in `award()` and
  `scorePracticeAnswer()`: change both together. A new badge needs a `cheer` (a test checks).

## Done since the last handoff (2026-10-09, night): classes for the Presidential Schools

**Superseded in part on 2026-10-13** (see that section, near the top): a class is no longer a grade.
Teachers make and name the classes, and everything below that says grade, `g7` or `school` is the
old model. What a class does (its stats, goal, cheers, homework rules, chats) still holds.

The owner: the app launches in the Presidential Schools first. Sign-up asks whether the student
studies at one and their grade (5 to 11); **a class is a grade** ("all grade 5s are 1 class").
Classmates see each other and each other's study sessions, teachers set homework and announce to
one class, several or all, there are class chats, and leagues stay global. Students outside the
schools use the app exactly as before, with no class, teacher or homework. The owner said more is
coming ("I'll explain other stuff later"), so this is the base.

**Who is in which class** (`backend/classrooms.js`).
- On the user: `school` (`"presidential"` | `"other"` | undefined = never asked, an account from
  before this), `grade` (5..11), `classSetAt`, `chatMuted`. `classOf(user)` is `{ id: "g7", grade,
  name }` or null; use it, never the raw fields. **The demo account is never in a class** (one login
  shared by every visitor would read and write in a chat of real students), whatever its record says.
- `POST /api/student/register` no longer takes `{ presidential, grade }` (2026-10-12: ignored; a
  class is joined with its code). `publicUser` and `/practice/progress` carry
  `classroom` and `schoolAsked`; `/progress` also `class: { homework, overdue, unread }` for badges.
- A student changes their own class with `PUT /api/class/membership`. Joining is always open and the
  first move is free (a wrong tap at sign-up); after that one move in 30 days (`CLASS_CHANGE_DAYS`),
  so nobody wanders through the chats. A teacher moves anyone, any time
  (`PUT /api/admin/students/:id` with `{ presidential, grade }`; also `{ chatMuted }`).
- Classmates see each other as first name and last initial (`classmateName`), like the leagues.
  Full names and emails stay in the studio.

**What a class sees of itself** (`backend/classStats.js`, all worked out from XP and answer logs).
- **Effort is shared, accuracy is not.** Classmates see when someone studied, for how long, how many
  questions, XP, streak, level. Right-answer counts stay the student's own; the class gets accuracy
  only as an average, and only with three or more students in it. `publicSitting` strips `correct`.
- Study sessions are the existing sittings, moved to `backend/studySessions.js` (`sittings`,
  `describeSitting`, `studySessions`); `practiceRoutes.js` imports them.
- **Weekly class goal** (`db.classQuests`, `QUEST`): 150 XP per student who studied in the two
  weeks before, at least 300, fixed the first time anyone looks in a week. Reaching it adds a star
  to the class's shelf. A week nobody looked at is closed with its result when the next opens.
- **Classes this week** (`cupView`): each class's progress toward its own goal, so sizes don't matter.
- **Cheers** (`db.cheers`): one classmate cheers another once a day. **Studying now**: which
  classmates are active (`presence.activeAmong`; to the rest of the app presence is still a count).
- **Nothing class-only pays XP** (goal, cheers, homework): leagues are global, and a reward only
  class students can earn would tilt them. Keep it that way unless the owner says otherwise.

**Homework** (`backend/homework.js`, `db.homework`: `{ id, title, note, grades, questionIds, due,
createdAt, by }`). Bank questions for one class, several or all.
- Nothing is handed in or ticked (the owner's rule: no self-reported progress). A question is
  **done** once the student answers it, anywhere in the app, after the homework was set; it is
  **right** when that first answer was right and unaided (`ok && !a` in the answer log). Finished =
  all done; late = finished after the due day (app timezone).
- The answer route returns `homework: { finished: [{ id, title }] }` on the answer that finishes
  one; the player shows a toast. Player set: `GET /practice/questions?source=homework&homework=<id>`
  (only for the classes it was given to; `start=<next>` opens at the first question still to do).
- Studio: `POST /api/admin/homework/draw` draws questions at random, spread over the skills asked
  for (saves nothing); `POST /api/admin/homework` sets it with exactly those ids; `GET /:id` has
  every student's result; `DELETE /:id` takes it back.

**Class chats** (`backend/classChat.js`). Rows in `db.classMessages`: `{ id, room, from, body, q?,
re?, createdAt, deletedAt?, deletedBy? }`; `room` is `class:g7` or `dm:<id>:<id>` (ids in order).
- One room per class, and private rooms between two classmates. A room belongs to the class as it is
  now: a student who moves grade loses the old rooms (messages stay).
- `q` shares a bank question (a card: title, skill, level; never the answer). "Ask my class" in the
  player's More menu posts one; the card opens `?source=shared&ids=<id>`. `re` is a reply.
- Safety: text only, 1,000 characters, 12 a minute and 300 a day (counted from stored rows); a
  student deletes their own message; anyone can report one (`db.classReports`); teachers read every
  class room, remove any message and pause a student (`chatMuted`: read, not write). Private rooms
  aren't open to the studio unless a message in one is reported; the report shows the six before it.
  A room keeps its newest 1,000 messages. `removeUser` clears a deleted student's chat data.
- Messages arrive by polling (room every 6 s, list every 20 s, while the page is in front).

**Announcements** go to classes: `grades` on the row (none = all classes). `GET
/practice/announcements` filters by the student's class; **a student outside a class gets none**
and has no bell (the owner: teachers reach everyone "except non-presidential school users").

**API.** Student: `routes/classRoutes.js` at `/api/class` (`GET /`, `PUT /membership`,
`/classmates`, `/classmates/:id`, `/classmates/:id/cheer`, `/homework`, `/chat`, `/chat/:room`
(`class` or `dm-<id>`), `/chat/:room/read`, `/chat/messages/:id`, `/chat/messages/:id/report`);
everything but the first two answers 403 `NOT_IN_CLASS` outside a class. Studio:
`routes/adminClassRoutes.js` at `/api/admin/classes` (`/`, `/:grade`, `/waiting`, `/reports`,
`/reports/:messageId/dismiss`, `DELETE /messages/:id`) and `routes/adminHomeworkRoutes.js`.

**Frontend.**
- Sign-up (`pages/landing/Auth.jsx`) asks the question with `components/SchoolPicker.jsx` (`sp-`,
  `school.css`), also used by the join screen and Settings > Account > "Your school"
  (`pages/hub/classroom/SchoolSettings.jsx`).
- `/class` (`pages/hub/Classroom.jsx`, tabs in the address: `?tab=classmates|homework|chat`,
  `&with=<id>` for "you next to a classmate", `&room=` for a chat). Parts in `pages/hub/classroom/`.
  Styles: `src/classroom.css` (`cr-`); the conversation reuses `messages.css` (`dm-`).
- "My Class" is in the menu for class students (badge: homework to do plus unread messages) and for
  never-asked accounts ("New"); hidden for the rest. `components/ClassPrompt.jsx` is the home page's
  line (homework waiting, or the question once).
- The chat's message menu is portalled to `<body>` and placed with fixed coordinates: hub pages keep
  an identity `transform` from their entrance animation, which captures `position: fixed`.
- Studio: `/admin/classes` (`pages/admin/Classes.jsx`: every class, one class's students, chat and
  homework, reported messages; badge on the menu), `/admin/homework` (`pages/admin/Homework.jsx`),
  `pages/admin/ClassPicker.jsx` ("all classes" or grades) in Homework and Announcements, class and
  "pause messages" in the student's Edit dialog, a class filter on the students list. Styles in
  `admin.css` (`ad-cls-`, `ad-hw-`).

**Tests:** backend 628, all passing (53 new in `classroom.test.js`). Frontend build clean; oxlint
warnings only. Checked in the browser on a copy of the database: sign-up with the question (refused
without an answer), the class page, classmates and the compare view, a cheer, class chat (send,
reply, shared question, the message menu), a private chat, a report and its removal in the studio,
homework drawn and set in the studio, done in the player and finishing itself, "Ask my class", an
announcement to one class, the join screen, the demo account kept out, Settings, light and dark,
1280 and 375 wide.

**Not done, or worth knowing.**
- ~~Anyone can sign up and say they are in a grade.~~ Fixed 2026-10-12: a class is joined with its
  class code only (see that section, above).
- `registerLimiter` allows 60 sign-ups an hour from one address: a whole school signing up from one
  network in the same hour will hit it. Raise it (or set `TRUST_PROXY`) before a launch day.
- One class per grade across every Presidential School, as asked: a class can be several hundred
  students in one chat. Per-school classes would be a change to `classOf` / `classId`.
- Chat is polling on a JSON file: every message rewrites the database (and on Netlify uploads it).
  Fine for a pilot; a real database is the next step if the chats get busy.
- No new school year step yet (moving every grade up one). No teacher posting in a class chat.
  Homework is SAT bank questions only (no IELTS, no mock sessions for a whole class).
- Deployed 2026-10-10 (deploy `6aca62addd77bec713fc6118`, see the staff panels section).

## Done since the last handoff (2026-10-09): students can message the developers

The owner asked for a way for students to "dm" the developers. Each student has one private
conversation with the studio; whoever signs in to the teacher studio reads and answers it.

- **Rules** (`backend/messages.js`). Rows in `db.messages`:
  `{ id, userId, from: "student" | "team", body, topic?, by?, createdAt, readAt? }`. `userId` is
  always the student the conversation belongs to; `by` is the admin who replied (shown in the studio
  only). A message is plain text, 2,000 characters at most (longer is refused, not cut). `topic` is
  optional: bug, idea or question (`TOPICS`).
  - **Limits**: 20 messages an hour and 60 a day per student, counted from the stored rows
    (`sendBlock`), so they hold on Netlify too.
  - **The demo account can read but not send** (403). It is one login shared by every visitor, so
    anything written there would be shown to the next stranger.
  - Deleting a student removes their conversation (`removeUser`).
- **Student API** (`routes/messageRoutes.js`, `/api/messages`): `GET /` (conversation, `unread`,
  `canSend`, `blocked`, `max`, `topics`), `POST /` `{ body, topic? }`, `POST /read`.
  `/api/practice/progress` carries `messages: { unread }` for the menu's badge.
- **Studio API** (`routes/adminMessageRoutes.js`, `/api/admin/messages`): `GET /` (one row per
  student, newest first, plus `waiting`), `GET /waiting`, `GET /:userId`, `POST /:userId` (a reply;
  it also marks the conversation read), `POST /:userId/read`, `DELETE /:userId` (removes the
  conversation for both sides).
- **Frontend.** `components/MessageThread.jsx` is the conversation and the box to write in, used by
  both sides (`side` says who is writing). Styles: `src/messages.css` (`dm-`), index.css tokens only,
  because the studio doesn't load the hub's stylesheets.
  - Student: `/messages` (`pages/hub/Messages.jsx`), "Message Developers" in the menu ("Tools & help"
    for SAT, "Help" for IELTS). It looks for replies every 20 seconds while open, and an unsent draft
    is kept per student in `sessionStorage`.
  - Studio: `/admin/messages` (`pages/admin/Messages.jsx`) under Delivery, with the number of
    waiting conversations on the menu link (`AdminLayout` asks every minute and passes
    `refreshInbox` down as outlet context). The open conversation is in the address
    (`?student=<id>`); on a phone the list and the conversation show one at a time.
  - New icon: `chat` (solid set).
- **Tests:** backend 575, all passing (18 new in `messages.test.js`). Frontend build clean; oxlint
  warnings only. Checked in the browser on a copy of the database: a student sending two messages
  with a topic, the studio's list, badge and reply, the reply reaching the student (badge on the
  menu, cleared on opening, "Seen" in the studio), deleting a conversation, the demo account's
  closed box, light and dark, 375 wide on both sides.
- **Not done, or worth knowing.**
  - Nothing tells the developers about a new message except the badge in the studio (no email:
    `MAIL_WEBHOOK_URL` isn't set on the site).
  - Replies arrive by asking the server again, not instantly.
  - Text only: no pictures or files, and links aren't clickable.
  - The studio can't start a conversation from a student's profile (the API allows it).
  - Deployed to Netlify the same day (deploy `6ac8aabfce5d8efe1ae20a6f`). Seen on the live site: both
    new APIs answer "Missing token" (they were 404 before), and the demo account gets the page with
    its box closed. Not exercised there: a real student sending, and the studio's inbox (both need
    a sign-in typed by the owner).
  - That upload failed three times before it worked: Netlify's upload tool printed only "Failed to
    deploy site: 500". The relay it posts the zip to (77 MB) answered an empty 500 after 32 seconds
    or more, and 200 on the try that took 25 seconds; Netlify's status page showed no incident. A
    failed upload changes nothing on the live site. Ask the connector for a new command and try again.

## Done since the last handoff (2026-10-08, after the question bank): math drawn the way it is written

The owner asked for division to "look like real math instead of 5/3", then for the same for square
roots, powers and "every mathematical symbol". Wherever question text is shown, fractions are now
stacked (numerator, bar, denominator), roots are a radical with a bar over what they cover (`∛` and
`∜` with their number in the crook), and exponents and subscripts are real ones in the text's own
font. **No question text changed**: the bank still stores the plain notation (`(x − 2)/3`,
`√(x + 4)`, `x²`), and the drawing is worked out when it is shown.

- **`frontend/src/components/mathLayout.js`** (plain JS, no React) reads the notation:
  `findFractions(text)`, `mathLine(text)` (strings plus `frac` / `root` / `sup` / `sub` nodes, in
  order and covering all of the text; each node has `len`, the characters it stands for) and
  `mathTree(text)` (the same plus `**bold**`). Its header comment has the rules.
  - **Roots**: the sign covers a bracketed group, a number or one letter, as `latexPlain.js` writes
    them (`√(3x + 28)`, `√49`, `4√k`; `√2x` is √2 times x). A power before a root is not its index
    (`2x³√y`). A fraction under a root belongs to the root (`∛(125/27)`).
  - **Exponents and subscripts**: `x²`, `x⁻⁸`, `y₁`, `CO₂` (the special characters are redrawn with
    ordinary digits: the Source Serif the page loads has only ¹ ² ³, so ⁰ ⁴–⁹ ⁻ and the
    subscripts came from a fallback font at another size, measured in the browser), `^{…}`, `_{…}`, and the looser `2^(t/3)` and `(1.12)^t` found in a few explanations.
  - `½`, `⅓` and the like are drawn as fractions.
  - **Fractions**: a `/` with a term tight against each side; a slash with a space beside it never
    is. In short:
  - Brackets that only hold a numerator or denominator together are not drawn (`(x − 2)/3`), nor are
    the ones round a fraction used as a coefficient or beside an operator (`(3/4)(8x − 12)`,
    `15 ÷ (9/5)`). They stay where they mean something: `f(14/3)`, `16(1/16)`, `(5/3)²`.
  - `a/b/c` and `(1/2)/3` nest. Fractions inside `^{…}` are stacked too, smaller.
  - Prose is left alone: a side with a word of three letters or more (and/or, Precario/Precarious,
    81P/Wild, bottles/min), units (`km/h`, `m/s`, `$5/lb`), all-number dates (`10/08/2026`), a short
    list of abbreviations (`NOT_MATH`: w/o, n/a, am/pm, ui/ux …). Two capitals a side is taken as a
    ratio of segments (`DE/AB`), so `US/UK` had to go on that list.
- **`MathText.jsx`** draws the nodes (`renderMath(nodes)`, `mathParts(text)`); `mathtext.css` (`mx-`)
  is imported by it, so it works on screens that don't load the hub's stylesheets. The root sign is
  a small SVG stretched to the height of what it covers; the bars are borders.
  - **The page's text stays the question's text, character for character.** What isn't drawn (the
    slash, a root sign, dropped brackets, the `^{ }` of an exponent) is still there, hidden
    (`.mx-unseen`); what is drawn but isn't text (a cube root's 3, the digits of `½`) comes from CSS
    (`data-n`). So copying gives back `(x − 2)/3`, and the highlighter's offsets hold. Keep it that
    way when adding a node type; only `x²` differs, and only in which character (a plain 2).
- **The highlighter draws math too** (`pages/practice/HighlightText.jsx`): each line goes through
  `mathLine`, and a highlight, Nova's mark or an underline that starts or ends inside a fraction,
  root or exponent is drawn over the whole of it (the saved range is left as selected). So **every
  prompt is shown by `HighlightText` now** and can be highlighted, including the ones with an
  exponent or an equation on its own line, which could not be before.
- **Where it shows:** everything that used `MathText` / `mathParts` (choices, feedback, explanation
  panel, Daily Star, Nova's chat), prompts and passages through `HighlightText`, and now also the
  Masterclass lesson, the Math reference sheet (player and diagnostic), the mock-exam screen, both
  result views and the exam-mistakes tab, which used to print plain text (so `^{…}` and `**bold**`
  work there too). A grid-in's correct answer is shown with a real minus (`−6`, stored as `-6`).
- Texts rewritten to the notation: `mc-01`'s explanation (spaced slashes), the perpendicular-slope
  generator (`−1/5x` for `−(1/5)x`), the quadratic formula in the lessons (now one fraction), and
  the reference sheet's `½bh` and `4/3 πr³` (now `(1/2)bh`, `(4/3)πr³`).
- **Tests:** backend 557, all passing (103 in the new `mathLayout.test.js`: fractions, brackets,
  roots, exponents, prose left alone, the converter's output drawn, the lessons and reference
  sheet, and the whole bank: every layout spells its source text exactly and its pieces add up to
  the line, Reading & Writing has no fractions or roots, and in Math every tight slash is stacked
  except rates and words, every root sign is drawn and every caret is an exponent). Frontend build
  clean; oxlint warnings only. Seen in the browser on a copy of the database: prompts, choices,
  roots with and without an index, a fraction as an exponent, the explanation panel, the lesson and
  reference sheet, a highlight started inside a root (drawn over all of it, removed again), Reading &
  Writing passages (text, underline, bullets, a highlight with the right offsets), light and dark,
  1280 and 375 wide (no sideways scroll).
- **Not done, or worth knowing.**
  - **Letters are upright, not italic.** Printed math sets variables in italics; the text has no
    marks for where math starts and ends, so "a" the variable and "a" the word can't be told apart.
    The owner's files have that (`$…$`); the other 700 Math texts don't.
  - The mock-exam screen was not seen with math on it (the demo test has none and its modules are
    already handed in); it uses the same component.
  - Left as written: `km/h`, `m/s`, `opposite/hypotenuse`, the unit-conversion line with spaced
    slashes (`(1,000 m / 1 km)`), absolute-value bars, and what a student types (`3/4`, `-6`).
  - A highlight behind a tall fraction is the height of the line of text, with the fraction's own
    box filled in; fine by eye, not pixel-even.
  - The College Board Math questions are pictures, so nothing changes in them. Figures' labels
    (drawn in SVG) and data tables are plain text; no table in the bank has notation today.
  - Deployed to Netlify the same evening (deploy `6ac7ca3960a9f172255695b7`) and seen there in the
    player; see "What was and wasn't checked" in the Netlify section.

## Done since the last handoff (2026-10-08, after the deploy): the owner's own question bank, 500 originals

The owner sent `northstar_question_bank.json` and `northstar_question_bank_batch2.json` (from
`D:\Telegram Desktop`) and said they are original. Each file's `meta` says the same: written for
Northstar, no official question or passage reproduced, every math answer recomputed. 300 Math
(M-001…M-300) and 200 Reading & Writing (RW-001…RW-200); Medium 103, Hard 203, Challenging 194; every
skill covered, Advanced Math included. **The bank now has 2,408 questions.**

- **Where they live:** the two files, exactly as supplied, are `backend/content/originals/batch1.json`
  and `batch2.json`. `backend/content/originals.js` turns them into bank records when the server
  starts (`BANK_ORIGINALS`; keys `nb-m-001`, `nb-rw-101`; `source: "northstar-bank"`). **To add another
  batch, drop the file in that folder and add its name to `FILES`.** A question that can't be
  converted is left out and logged (`BANK_ORIGINALS_PROBLEMS`), never half shown; today that list is empty.
- **Math is converted from LaTeX to the player's plain notation** by `backend/content/latexPlain.js`
  (`(5(x − 2))/3 − (x − 2)/2 = 14`, `15 ÷ (9/5)`, `2,500(1.015)^{4t}`, `sin² A`, `∜(16x¹²y²)`). It
  knows only the commands these files use and throws on anything else (subscripts, an exponent
  inside an exponent, an unknown command), so new notation is noticed at load. The app has no
  typesetter (fractions are drawn stacked from the plain notation, see the section above); the
  LaTeX is kept in the files so one could be added later without losing anything.
- **Shape:** `stem` → `prompt` (a `$$…$$` equation on its own line), choices in the file's order (the
  `explanation` names letters, and the files are already balanced over A–D), `choice_rationales` →
  `rationales`, `accepted_answers` → `acceptedAnswers`, `passage2` → "Text 1 / Text 2", `notes` → "• "
  lines, `<u>` → `underline`, `table` as the bank's `table`. No hints, steps or key evidence, so they
  are not in `PRACTICE_QUESTIONS`. `levers`, `origin` and `modeled_on` are not carried over.
- **Storage:** slim, like the pack (`SLIM_QUESTIONS` in `practiceContent.js`; `db.js` treats `qb-` and
  `nb-` keys alike). `QUESTION_PACK=off` does not hide these.
- **Studio:** the practice-bank list shows "Northstar original" on them and "original" finds them.
- **Tests:** backend 454, all passing (10 new in `originals.test.js`: 34 notation cases, every
  question checked against its source for place, level, answer and that no number was lost or moved,
  the passage shapes, bad input, and the student's view over HTTP). Checked in the running app: a
  fraction equation, a root with powers, a table, an underlined word.
- Deployed to Netlify on the evening of 2026-10-08 (deploy `6ac7ca3960a9f172255695b7`); the live
  site's public overview counts 2,408 questions.

## Done since the last handoff (2026-10-08, late night): the weekly plan finishes itself

The owner's complaint: the weekly plan was easy to manipulate (each task had a tick box, and
`POST /plan/:i/complete` finished one from outside). They asked for the questions a student solves
on the plan's question types to be counted, and for the plan to finish by itself at the count
("maybe 15").

**Rules** (`backend/weekPlan.js`; the numbers are in its `PLAN` table).
- **Nothing is ticked.** The tick and "complete" routes are gone (404). A task is done when the
  server has counted enough of the student's graded work; it is then recorded in
  `progress.plan[week]`, paid once (`scorePlanTask`, 15 XP) and stays done. Five in a week is still
  the Plan Keeper badge.
- **The week's tasks are fixed** the first time the plan is asked for in a week:
  `progress.weekPlan = { week, tasks, words }`. Before, the tasks were rebuilt from the student's
  stats on every request, so a skill could change while they worked on it. New tasks every Monday.
- **What counts.**
  - Skill task (Mon, Tue, Thu, Fri; the two weakest skills of each section): 15 questions of that
    skill solved, or 60% of the skill's questions when it has fewer than 25 (three Math skills have
    11 or 12).
  - "Solved" = the first answer to the question on some day this week was right and unaided. A
    second try the same day, or an answer after opening the explanation, doesn't count, so clicking
    through the choices finishes nothing. This is worked out from `answerLog` on the server
    (`weekWork`); the client's `retry` flag isn't trusted for it. Each question counts once a week.
    Answers from the player, a diagnostic and the Daily Star all count; remixes don't (not logged).
  - Vocab (Wed): 20 different flashcards rated this week (`weekPlan.words`).
  - Saturday: a mock module handed in this week, **if** one is waiting for the student in a started
    session when the plan is fixed. Otherwise "Mixed practice": 15 questions solved on skills the
    four skill tasks don't cover (`task.except`; `POST /drill` with `plan: <index>` draws from
    those). Most students have no teacher session, and a task nobody can do would block the plan.
  - Mistakes review (Sun): questions missed on an earlier day and solved now. It asks for as many
    as are on the student's mistakes list when the plan is fixed, between 1 and 10. Its Start opens
    `GET /questions?source=mistakes` (review schedule plus saved queue, due first).
- **Where it is settled.** `settlePlan()` runs after every practice answer and flashcard rating; the
  reply carries `plan: { finished: [{ index, title }], reward }` when that answer finished a task
  (the player and the vocab page show a toast). `GET /progress` settles too, without lighting a
  star, for work that came through other routes (a mock module, the Daily Star, a diagnostic); it
  only writes when the week is new or a finished task is unrecorded (`planIsSettled`).
- `progress.plan.tasks[i]` now has `have` and `need` (`count` is the same as `need`).
- **Hand-ticks from the week this shipped are dropped** when that week's plan is first fixed: the
  mark goes, the week's real answers still count, and the XP the tick paid stays paid (no second
  payment when the task is finished for real).

**Frontend.** `pages/hub/StudyPlan.jsx` and the home page's `TaskCard`: the tick box is a status
mark (not a button), each open task shows "7/15" and a bar, and the open row says what counts
(`PLAN_COUNTS` in `hubUtils.js`). `planTaskUrl()` no longer carries the task index except for mixed
practice. `api.js` lost `togglePlanTask` and `completePlanTask`.

**Tests:** backend 444, all passing (23 new in `weekPlan.test.js`). Frontend build clean; oxlint
warnings only. Checked in the browser on a copy of the database: the demo student's seven
hand-ticks became real counts (0/15, 3/15, 6/15…), a task at 14/15 finished on the next right
answer in the player with the toast, and the planner and home page showed it done.

**Not done, or worth knowing.**
- Counting only right answers is a judgement (the owner said "solved"). A student at 50% accuracy
  needs about 30 questions per skill task. To count every answered question instead, change the
  `first && e.ok && !e.a` test in `weekWork`.
- Flashcards are self-rated, so the vocab task only proves 20 cards were opened and rated.
- A right answer after a wrong one still returns `correctIndex`, so a student who reads the network
  reply can get the question right the next day. It costs a day per question.
- A teacher who starts a session after Monday doesn't change that week's Saturday task.
- Deployed to Netlify the same night (deploy `6ac786d7bfe95a712dd157e0`). Checked there without
  signing in: the API answers, and the live hub bundle has the new planner and no tick call. A task
  finishing on the live site was not exercised (no sign-in from here).

## Done since the last handoff (2026-10-08, night): Desmos calculator, and round 2 Part 6 (mistake reasons, spaced review, trap profile)

The owner asked for Part 3 and Part 6 and for a Desmos calculator on every Math question. Part 3 was
already finished (the two sections below); nothing more was done to it.

### The graphing calculator (`frontend/src/components/calculator/`, `gcalc-`)

`<GraphingCalculator open onClose place? />` is a window over the page, portalled to `<body>`: drag
it by its title bar, resize it from the corner, enlarge it, close it. Under 720px it is a sheet at
the bottom. It is built once and then only hidden (`visibility`, keeping its size), so the graph
survives closing it and moving to the next question; it goes when the screen that renders it goes.
With `warm` it is built out of sight 1.5 s after a Math question appears, because Desmos takes
10 seconds or more to load the first time; not on a data-saving connection.

- **Where it is.** Each screen keeps its own `calcOpen` and decides when the button shows:
  - practice player: Math questions (button in the top bar, key **G**; C is answer choice C);
  - diagnostic test: Math questions;
  - mock exams: modules that have one, `mod.calculator` from `GET /api/exam/…/modules/:id`;
  - Daily Star: when today's question is Math and not yet answered (`place="right"`).
- **Which modules have one**: `moduleHasCalculator(mod)` in `grading.js`. A module whose name says
  Math has it; a teacher can switch it per module in the test editor (`PUT …/modules/:id` with
  `calculator: true | false`, or `null` for the default).
- **How Desmos is shown.** Desmos's embedding API needs a key (403 without one; keys come from
  https://www.desmos.com/my-api) and we have none. So by default it is the page Desmos runs for the
  digital SAT, https://www.desmos.com/testing/cb-digital-sat/graphing, in a sandboxed `<iframe>`
  (that page sends no frame-blocking headers). Set `VITE_DESMOS_API_KEY` in `frontend/.env` (see
  `.env.example`) and it uses the API instead. **The API path has never been run**: there was no
  key to run it with.
- **Docking.** While the window sits against the left edge and there is room, it sets
  `--gcalc-dock` on `<html>` and `.pl-body` / `.exam-body` leave that much room, so the question is
  moved over, not covered. Dragged away, it floats.
- The production CSP (`vite.config.js`) allows `frame-src https://www.desmos.com`, and with a key
  also Desmos's script, workers, fonts and requests. `northstar-frontend-build` in
  `.claude/launch.json` serves the built site on :4173 to check it.
- Its CSS uses only `index.css` tokens: the mock-exam screen doesn't load the hub's stylesheets.
- Screens with key handlers skip keys that come from inside `.gcalc`.

### Part 6: why a student misses questions

**Spaced review** (rules in `gamification.js`, "Spaced review"). `progress.review` is
`{ questionId: { box, due, lapses } }`; `REVIEW_GAPS` is `[1, 3, 7, 14]` days.
- A wrong answer, anywhere (player, diagnostic, Daily Star: it hangs off `recordAnswer`), puts the
  question in box 0, due tomorrow.
- Right on or after the due day: up a box, or out after the last ("graduated",
  `progress.reviewGraduated`). Pays `XP.spacedReview` (3) on top of the question's own XP.
- Right with help (a retry, or after the explanation): same box, back tomorrow.
- Right before the due day: nothing changes, so it can't be crammed.
- A student who already had a mistakes queue starts with it on the schedule (backfill in
  `getProgress`), each question due the day after it was last missed.
- `GET /api/practice/review` is the status; the due questions are `GET /questions?source=review`
  (player: `playerUrl({ source: "review" })`). `/progress` carries `review: { due, … }` for the
  home page's prompt (`components/ReviewPrompt.jsx`).
- Mock-exam mistakes are not on the schedule: they aren't bank questions and can't be re-answered.

**Mistake reasons** (`backend/review.js`). Six reasons in `MISTAKE_REASONS` (misread, careless,
concept, trap, time, guess), each with the advice shown for it. `progress.reasons` is
`{ questionId | "exam:<key>": { r, at } }`, one per question, kept after the mistake is cleared.
- `POST /questions/:id/reason` (only for a question the student has missed) and
  `POST /mistakes/exam/:key/reason`; a blank reason takes it back.
- The list reaches the frontend in `/practice/meta` as `mistakeReasons`. `components/ReasonPicker.jsx`
  is the chip row (player, under a missed question; mock-exam mistakes).

**Trap profile** (`trapProfile()` in `review.js`, `GET /api/practice/traps`). From the last 90 days:
the reasons given; what the answers show (misses in under 40% of the test's pace are "rushed",
misses on Easy questions, questions missed twice, miss rate by level); the five skills with the
most misses, each with its lesson's traps; and one headline (a reason the student gave outranks
timing, which outranks a skill). Nova gets the headline as a line of her student context.

**Screens.** `pages/hub/Mistakes.jsx` has five tabs and keeps the open one in the address
(`/mistakes?tab=review|saved|flagged|exam|traps`); with none it opens on the review when something
is due. `pages/hub/TrapProfile.jsx` is the last tab. Styles: `src/review.css` (`rv-`).

### Also fixed
- Mock-exam screen, dark mode: the question number was white on white.

**Tests:** backend 421, all passing (27 new: `review.test.js`, and the calculator setting in
`mockExam.test.js`). Frontend build clean; oxlint has warnings only. Checked in the browser, mostly
on a copy of the database: the calculator in all four places (a line graphed with Desmos's keypad,
kept across questions, drag, resize, enlarge, phone sheet, the built site under its CSP), the teacher's
switch, a miss tagged and scheduled, a review answered right ("Next review in 3 days"), the review
tab, the trap profile, light and dark, 1280 and 375 wide.

**Not done, or worth knowing.**
- Typing into Desmos with a physical keyboard could not be checked: the test browser's key presses
  don't reach another site's frame. Its on-screen keypad worked, which goes through the same frame.
- Desmos decides whether its page may be framed. If it ever blocks that, the window shows a blank
  page; the "open in a new tab" button in its title bar still works, and the fix is an API key.
- The calculator is always light, and on a phone its sheet covers the answer choices while open.
- No teacher view of a student's trap profile or review schedule yet.
- ~~The study plan's "Mistakes review" task still opens the mistakes queue, not the due reviews.~~
  Since the weekly-plan change above it opens the whole mistakes list, due ones first.
- The "rushed" and "slow" cut-offs (40% and 180% of the pace) are a judgement, not measured.

## Done since the last handoff (2026-10-08, evening): the whole question pack, 1,657 more questions

After the Challenging tier went in (next section), the owner said: "Add all questions given including
easy, medium and hard questions." Those are College Board question-bank items. The owner had been told
so plainly, twice (their old rule was no College Board material, and the pack's own README says not to
republish them), and decided to add them anyway. **Reversed by the owner on 2026-10-13: the pack was
taken out (see the section of that date near the top). What follows is history.** ~~That decision is
the owner's and it stands: don't remove them or reopen it unasked.~~ Every one carries `source: "college-board"` so they can be found,
or taken out, as a group (`QUESTION_PACK=off` hides them all without deleting anything).

**What is in the bank now:** 1,908 questions. 186 starter + 65 Challenging originals (text, with hints
and steps) + 1,657 from the pack: 938 Reading & Writing (324 Easy / 325 Medium / 289 Hard) and 719 Math
(291 / 219 / 208, plus one the pack rated Challenging). The pack has no Advanced Math.

**Content** (`backend/content/pack/questions.json`, 2.8 MB, and `backend/content/pack/media/`, 1,505
WebP pictures, 37 MB). Made by `tools/bank` (see its README for how the PDFs are read and re-run).
- **Reading & Writing is real text**: passage, question, options, answer, and the explanation split
  into one piece per option (`rationales`; `explanation` is the piece for the right one). 67 have a
  graph or table as a picture (`image`), 66 have an underlined part (`underline: [start, end)` in the
  passage). No hints, steps or key evidence.
- **Math is pictures**, because the equations in the PDFs are drawings with no text behind them:
  `promptImage` (the question with its choices) and `explanationImage`. `options` is `["A","B","C","D"]`
  and `prompt` is only "Choose the correct answer." / "Type your answer.". 186 are student-produced
  response; 42 of those list several accepted forms (`acceptedAnswers`).
- Titles: the passage's first words (R&W); "Linear functions: easy question 12" (Math).
- Keys are `qb-` + a hash of the PDF's path and page, so converting again keeps students' progress.
- Checked: every answer against the pack's own index (`index.csv` in the earlier zips), 1,657 of 1,657.
  Done by hand: seven Math answers that exist only as drawn fractions, and one underline the PDF page
  didn't have (R&W, "weaken the underlined claim": placed on the archaeologist's claim, from the
  explanation). Both lists are at the top of `tools/bank/build.mjs`.

**How it is stored (`db.js`).** Pack questions are synced by key like the starter set
(`SYNCED_QUESTIONS` in `app.js`), but stored **slim**: id, key and dates, plus only the fields a teacher
changed (a removed field is stored as `null`). `readDB()` fills the rest in from the pack file, so all
other code sees complete records. Without this the database went from 0.8 MB to 4 MB and every answer
took four times as long to save. Consequences:
- Pack records handed out by `readDB()` share their arrays with the (frozen) pack. Replace a field;
  never change one in place.
- A pack key in the database with no match in the pack file (pack missing, or `QUESTION_PACK=off`) is
  kept aside on read and written back untouched, with one line in the log.
- They are not in `PRACTICE_QUESTIONS`, so `content.test.js`'s starter rules (hints, steps, balanced
  answers) don't apply to them; `questionPack.test.js` has their own.

**App changes.**
- `questionMedia(q)` in `grading.js` adds `image`, `promptImage` and `underline` to every shape a
  student gets before answering (player, diagnostic, Daily Star); `explanationImage` comes with the
  explanation. Pictures are served from `/api/bank-media/<hash>.webp` (public and immutable: an
  `<img>` can't send a token, and it sits under `/api` so existing proxies already forward it).
- `isCorrectAnswer` accepts any of `acceptedAnswers`; `correctAnswer` is the form shown and is always
  one of them. Changing a grid-in answer in the studio drops the old accepted forms; editing a passage
  moves its underline with the words, or drops it.
- Frontend: `pages/practice/BankPicture.jsx` (white card in both themes, shown at up to 1.5 times
  printed size, scrolls sideways when there isn't room, opens full size on click) and an `underline`
  prop on `HighlightText`. Picture questions show "Choice A…D" on the answer buttons
  (`isPictureQuestion`). The explanation panel shows a plain explanation when there are no steps.
- Nova: says she can't read a picture question (the AI prompt says the same), and no longer hands over
  the written explanation for "explain step by step" before the student has answered (questions
  without steps used to get the whole explanation, answer included).
- Studio practice bank: rows carry "Question pack" and "Picture" badges; the filter matches every word
  typed ("circles hard picture"); the list shows 200 rows at a time; the editor shows a picture
  question's pictures.

**Tests:** backend 394, all passing (15 new in `questionPack.test.js`: the content, slim storage,
edits and deletions, pictures over HTTP, accepted answer forms, Nova, the diagnostic and Daily Star
shapes). Frontend build clean; oxlint has warnings only. Checked in the browser on a copy of the
database: an underlined sentence, a graph, a Math multiple-choice and a student-produced picture
question (answer, XP, explanation picture, full-size view), the phone width, and the studio list and
editor. The real `db.json` was not started against; it picks the questions up at its next start.

**Still open / worth knowing.**
- Math from the pack can't be highlighted, searched or read by Nova, and on a phone the picture
  scrolls sideways. Typing those 719 questions out as text is the fix; it wasn't done.
- A graph in one R&W picture is cut at its right edge in the source PDF itself (Provo River).
- Two R&W explanations couldn't be split per option and show as one piece.
- The repo gained 40 MB. Deployment has to ship `backend/content/pack/`.

## Done since the last handoff (2026-10-08, later): the Challenging tier (round 2, Part 3)

**(The decision below not to import the College Board files was reversed by the owner later the same
day: see the section above. The rest of this section still holds.)**

The owner sent `SAT_English_sorted_no_ids.zip` and `SAT_Math_sorted_no_ids.zip` (in the folder above
this repo) and asked for the questions to be added as the question bank.

**What the zips are.** 107 PDFs sorted as domain > skill > `1 Easy`, `2 Medium`, `3 Hard`,
`4 Challenging`. They are the earlier packs (`D:\Telegram Desktop\SAT_*_sorted.zip`) with the question-ID
line and the README/index/JSON removed.
- The 78 Easy/Medium/Hard PDFs are **College Board question-bank exports, word for word** (the
  "Assessment / Test / Domain / Skill / Difficulty" header, real published passages). The pack's own
  README says "The College Board items are for your own study. Do not republish them." The owner's
  rule is also no College Board material. **They were not imported**, and removing the ID line doesn't
  change that. In the Math ones the equations and many answer choices are pictures, so their text is
  not usable anyway. If the owner asks again, say this plainly; the alternative is original questions
  written to the same skill and level grid.
- The 29 `4 Challenging` PDFs are **Northstar originals** (20 Reading & Writing, 45 Math; one extra
  item in Area and volume is a College Board question the pack moved up a tier, and it was left out).
  These were imported. The clean data for them is `challenging_originals.json` in the earlier zips
  (math as LaTeX).

**Content** (`backend/content/challengingRW.js`, `challengingMath.js`, added to `PRACTICE_QUESTIONS`).
- Keys are the pack's ids in lower case (`ns-e-001` … `ns-e-020`, `ns-m-001` … `ns-m-045`), so the
  owner can match a question to their PDFs. Two per skill, more in Advanced Math; 19 of the Math ones
  are student-produced response.
- They are starter content, so `syncStarterQuestions` adds them to an existing `db.json` at the next
  start ("Practice bank: 65 new"). A teacher's edits and deletions are respected as for any starter.
- Each one got a title, one rationale per option, steps, a hint and (R&W) key evidence, which the pack
  didn't have. Math was rewritten from LaTeX into the player's plain notation (`(3/4)(8x − 12)`,
  `4^{x}`, `√(3x + 28)`; equations on their own line).
- Reading & Writing goes through `balanceAnswers` (now exported from `readingWriting.js`), so the
  correct letter can differ from the pack's key; Math keeps the pack's letters.
- NS-E-010 ("the underlined sentence") carries an `underline` range, like the pack's questions.
- Every answer was checked twice: against the pack's JSON, and all 45 Math answers recomputed in
  code. `content.test.js` pins the pack's answer key.

**"Challenging" is a fourth difficulty**, above Hard. `DIFFICULTIES`, `DIFFICULTY_RANK` and
`generatorLevel()` in `practiceSkills.js` are the one definition; use them instead of writing the
level names again.
- XP: `XP.question.Challenging` is 24 (Easy 8, Medium 12, Hard 18). Challenging solves count toward
  Hard Hitter, and Nova is proud of them like Hard ones.
- The Math generators stop at Hard. Remixing a Challenging Math question gives a Hard variant, and
  `generatedXp("Challenging")` pays like Hard.
- The weekly activity chart keeps three shades (its colour ramps are validated for three), so
  `weeklyTrend` counts Challenging answers with Hard and the legend reads "Hard and up". The
  Analytics "By difficulty" card has its own Challenging row.
- The diagnostic's blueprint still asks for Easy/Medium/Hard only; a Challenging question can only
  land in one as the last resort and then weighs 4. The study plan's levels are unchanged, so plan
  drills don't include Challenging; students reach it through the bank's Difficulty filter.
- Admin: the practice-bank editor's Difficulty list has Challenging (`adminPracticeRoutes.js` uses
  `DIFFICULTIES`).
- Frontend: `--challenging` / `--challenging-soft` tokens (violet) in `shell.css`, with
  `.challenging` variants of `.ns-tag2`, `.ns-qnum`, `.pl-diff`, `.pl-tile` and the navigator legend.
  Mock-exam test difficulty (`test.difficulty`) is a separate scale and still Easy/Medium/Hard.

**Tests:** backend 379, all passing (8 new: the tier's content and answer key, XP, the bank filter
and order, the weekly chart and analytics row, remix, the admin editor). Frontend build clean; oxlint
has warnings only. Checked in the browser on a copy of the database (`northstar-backend-copy` /
`northstar-frontend-copy` in `.claude/launch.json`): the filter, the player with an equation, a table,
exponents, the explanation panel, a Reading & Writing passage with a table, the Analytics row. The real
`db.json` was not started against; it picks the questions up at its next start.

**Still open.**
- (Closed the same evening: NS-E-010 is back to the pack's "underlined sentence" wording, with an
  `underline` range, once passages could show one.)
- No PDF reader on this machine (`pdftoppm` is missing and the owner declined system installs). The
  PDFs were read with `pdfjs-dist` installed in the session's scratch folder, not in the repo.

## Done since the last handoff (2026-10-08): the owner's generated art, score calculator, skill map panels, planner, settings, type scale

The owner generated pictures with Nano Banana from prompts written earlier, and sent a long list.
**Where this differs from the sections below, this one is current.**

- **Generated art in use** (`src/assets/art/`, cut out with `tools/art/generated-cut.mjs`, exported
  with `generated-export.mjs`; both expect a scratch folder with `sharp` and `wawoff2`):
  - `target.webp`: the score card's target (drop-in slot, no code).
  - `trail.webp`: the diagnostic pages' journey (planets as stepping stones up to the north star).
    `TrailArt` lays the score labels and Nova over it (`TRAIL_STOPS` in `Art.jsx`, `.dg-pic` in
    `diagnostic.css`); marks are now four (`1000 1200 1400 1600`, IELTS `5.0 6.0 7.5 9.0`).
  - `spot-*.webp` (checklist, bullseye, chart, calendar, target, trophy, note, bookmark):
    `<EmptyArt name />` in `Art.jsx`, placed in ten empty states. The source sheet is about 180px a
    picture, so they are shown at 116px.
  - `public/social-preview.png` (1200x630: the owner's hill scene, the 3D Nova, the logo and a line of
    text in Fredoka/Nunito) and `public/apple-touch-icon.png` (the mark on lilac). No longer placeholders.
  - **Not used, on the owner's instruction:** the hero landscape, the telescope and the
    rocket/hourglass/speech-bubble sheet. **Not received:** a footer-hills picture (the footer is unchanged).
- **Question bank card**: the speech-mark badge on the Reading & Writing card is now an "Aa" badge.
- **Score calculator** (`pages/hub/ScoreCalc.jsx`, `calc.css`, `ns-calc-`): "By module" (module 1,
  module 2 set Auto/Easier/Harder, module 2) or "By section". The model and its sources are in the
  file's header comment: 27+27 and 22+22 questions, harder set at about two thirds of module 1
  (`routeAt`, our assumption), easier set capped near 620 (`cap`, a prep-industry estimate), a
  +/-40 range. Neither number is official; the page says so, with a fold-out "How digital SAT scoring works".
- **Skill map** (`components/skillsky/`): one rounded panel per constellation, grouped under
  "Reading & Writing" and "Math"; four panels a row, two or one when the stage is narrow (container
  query, not the window). `layout.js` now has one layout: `PANEL` (box per section) and star
  positions in that box. The drawing is as wide as its panel in real pixels (`ResizeObserver`), so
  names and stars keep their size and only the spacing grows. Stars lean and sway; names are on up
  to two lines (`SHORT`, max 12 characters a line). Zoom and pan are gone. The chosen skill's card
  is sticky at the bottom of the window; on phones nothing is selected until a tap.
  `.ns-content:has(.sks-stage)` widens the page to 1560px. `skillsky.test.js` checks the new layout.
- **Your Sky / Daily Star** (`Sky.jsx`, `sky.css`, `Daily.jsx`, `daily.css`): the night panel is the
  twilight gradient with star dust; lit day-stars have a halo, their own lean and a twinkle; complete
  constellations get gold lines; the daily star is a 96px star with halo, turning rays and two
  companions (a dashed outline with a moon in orbit when not found). All off under reduced motion.
- **Study Planner** (`pages/hub/StudyPlan.jsx`, new `planner.css`, `ns-pl-`): a summary strip (days
  to go, tasks done), then "This week" as rows that fold open (today's starts open), then the weeks
  to test day as `<details>` (this week open). Same data and endpoints.
- **Top bar hints** (`StudentShell.jsx`, `.ns-hint` in `shell.css`): hovering, focusing or tapping
  the streak or the crystals shows what it is. The crystal counter is now a button.
- **Settings** (`pages/hub/Profile.jsx`, still at `/profile`; `settings.css`, `ns-set-`): a side menu
  (`?tab=account|appearance|goals|security`). Account = a profile card (drawn banner, newest four
  medals, picture, name, email, candidate ID, joined date, four numbers) and the picture picker in a
  roomier style; Appearance = light/dark; Study goals = SAT date and targets; Sign-in = password and
  sign out. The sidebar's picture, name and gear all link here; **the gear's pop-up menu (dark mode,
  sign out) is gone**. `GET /api/student/me` and the login responses now include `createdAt`.
  TaroPrep's settings page could not be opened (it needs a sign-in), so the layout follows the
  owner's screenshot only.
- **Type scale** (`index.css` `--fs-micro` 12 to `--fs-display` 40, `--lh-body`, `--measure`): 369
  one-off pixel sizes in the hub stylesheets (`shell`, `hub`, `planning`, `daily`, `sky`, `leagues`,
  `recap`, `diagnostic`, `avatar`) were snapped to it, so nothing in the hub is under 12px and body
  text is 16px. New hub CSS should use the tokens. Not touched: `player.css`, `index.css` (exam and
  legacy studio), `admin.css`, the cover and sign-in pages, IELTS.
- **Shared**: `.ns-capsule` (the centred filter pill) moved from `mock.css` to `shell.css`. New
  icons: `minus`, `mail`.
- **Tests**: 372 backend tests; build clean; oxlint 0 errors, 70 warnings. Seen in the browser: all
  26 hub routes at 1280 and 21 at 375 with no sideways scroll or error screen; the diagnostic art,
  question bank, skill map (1440 and 375), Your Sky, Daily Star, planner, hints, score calculator
  and settings by eye.

## Done since the last handoff (2026-10-07, late night): Full-Length Tests page, test difficulty

The owner sent a TaroPrep "Full-Length Tests" screenshot: make ours look like it without copying it,
no "Pro" label (the app is free), and show whether a test is easy or hard, set from the studio.

- **Test difficulty.** `test.difficulty` is `"Easy" | "Medium" | "Hard"` or `null` (not rated, no label).
  `routes/testRoutes.js` (`cleanDifficulty`) takes it on `POST /api/tests` and `PUT /api/tests/:id`
  (`""`/`null` clears it, anything else is a 400); the list summary and `GET /api/student/history`
  (`difficulty`, plus `testDescription`) return it. Tests made before this are unrated.
- **Studio.** `TestsList.jsx` exports `TestDetailsModal` (create, or edit when given `test`) and
  `DifficultyBadge`. The test editor's header has **Edit details** (title, description, difficulty):
  the title and description could not be edited at all before. `api.js` gained `updateTest`.
- **Student page** (`pages/hub/MockExams.jsx`, `src/mock.css`, prefix `ns-fl-`): a centred filter
  capsule (To do / Finished / All tests, with counts; opens on To do when anything is waiting), a
  "Before you start" note with Nova, then two columns of cards. Each card's picture is the test
  itself: its modules as numbered stops on a route (done = filled, next = ringed), with the state and
  total minutes above, on a sheet rising out of a tinted panel (tints cycle through the sidebar's
  blue-to-orchid family). Below: name, the difficulty label, the teacher's description, Start /
  Resume / Continue, Review answers. The score trend moved to the bottom. There is no "..." menu and
  no "Pro" or "Predicted" wording: nothing here predicts official questions.
- **Second pair of dev servers.** `vite.config.js` reads `BACKEND_URL` and `VITE_PORT`;
  `../.claude/launch.json` has `northstar-backend-copy` (:4010, on `%TEMP%\northstar-db-copy.json`,
  copied from db.json when missing) and `northstar-frontend-copy` (:5183). Use them to try things
  without touching real data, or when another session holds :4000/:5173.
- **Tests**: 372 backend tests (one new, in `mockExam.test.js`); build clean; oxlint 0 errors. Seen in
  the browser on the DB copy: `/mock` in light and dark at 1280 and at 375 (no sideways scroll) with
  tests in all four states, the studio's test list, and Edit details saving a difficulty.

## Done since the last handoff (2026-10-07, night): solid icons, new fonts, trophies, crests, drop-in art

The owner asked to "finish the visual work now": animate the 3D Nova's bubbles one by one, redraw
the question-bank cards, the trail art and the league card and crests, make every icon like a solid
filled reference, add stars, improve sign-in and the skill map, change the font, add trophies, and
say plainly where drawings fall short (with Nano Banana prompts). **Where this differs from the
sections below, this one is current.**

- **Fonts.** Headings are **Fredoka**, text is **Nunito** (`@fontsource-variable/fredoka|nunito`,
  imported in `main.jsx`; Lexend was removed). `--display` / `--sans` in `index.css`. A zero-specificity
  rule gives `h1-h3` in `.ns-content, .cv, .au, .ad-content` the display face. Inter stays for the IELTS
  exam room, Source Serif for passages. Fredoka stops at weight 700 and is wide: keep heading
  letter-spacing near 0 (the old negative tracking was loosened in every non-IELTS stylesheet).
- **Icons are solid now** (`components/Icon.jsx`). The `SOLID` map (about 80 icons) is drawn through an
  SVG mask: `<D>` = filled shape, `<K>` = a line cut out, `<KF>` = a filled area cut out, plain strokes
  stay solid. `SolidIcon` renders it; colours in `hub.css` (`.ic-solid`). Only line glyphs by nature
  (arrows, chevrons, close, menu, check, cross, plus, undo, shuffle, swap, strike) are still strokes,
  and `Icon` draws those at a minimum stroke of 2.2 so they sit with the set. New icons: meteor, crown,
  telescope, fullMoon, shieldCheck. `ICONS` is exported (the dev gallery lists every icon).
- **3D Nova in pieces** (`components/nova/Nova3D.jsx`, `nova3d.css`): the star and seven bubbles are
  separate WebPs (`assets/nova/nova-3d.webp`, `nova-3d-bubble-1..7.webp`, cut with
  `tools/art/bubbles.mjs`); each bubble drifts on its own path and timing. The component is now a
  `<span class="n3d">`, not an `<img>`.
- **Trophies: 27** (were 15). New: combo_20, streak_14, streak_30, level_10, level_20, century (100
  solved), galaxy_brain (500), hard_hitter (10 hard first tries, counter `p.hardSolved`), clean_slate
  (10 mistakes cleared), drill_10, lexicon (50 words), stargazer (daily star). Rules are in
  `gamification.js` (`award`, `scorePracticeAnswer`, `scoreDrill`), `practiceRoutes.js` (vocab) and
  `dailyRoutes.js`. Medals have four shapes (`BADGE_ART[id].shape`): disc = practice, hex = days kept,
  shield = tests, burst = levels. Trophies page is two columns on phones.
- **League crests** (`components/Tier.jsx`): one shield for all five tiers, own colours and glyph, one
  more piece of trim per tier (star, orbit ring, side stars, rays). `/leagues`: the "your league" card
  is a strip of night sky (always dark), the ladder is crests on a dotted line.
- **Card and page art** (`components/Art.jsx`): `BookArt` and `MathArt` redrawn as frosted-glass objects
  for the gradient cards, `TrailArt` is a three-peak mountain with the north star over the summit,
  `TargetArt` is in the Twilight palette (no red or brown).
- **Drop-in pictures** (`components/artPictures.js`, `src/assets/art/`): a file named `bank-rw`,
  `bank-math`, `trail`, `target` or `tier-0..4` (.png/.webp, transparent) replaces that drawing with no
  code change. `src/assets/art/README.md` has sizes and the Nano Banana prompts. A `trail` picture
  also replaces the labels and the 2D Nova drawn in that SVG.
- **More stars**: cover hero (260 dots, 16 four-point stars kept off the headline, a soft band),
  sign-in scene (230 dots, a constellation, a band, a dotted orbit with a small moon round Nova; the
  pink moon moved low-left so it no longer sits behind her), skill map (440 dots, 18 four-point
  stars, a Milky Way band, three-lobed nebula per constellation, glow under finished lines, two
  shooting stars). All off under reduced motion.
- **Sign-in form**: larger heading, the form rises in piece by piece, four-point stars on the page
  behind the card.
- **Skill map text** is Fredoka throughout; Nova on the focus star is 100 units (was 118) so she
  clears the neighbouring star's name.
- **/dev/art** now also shows the crests, all 27 medals, the card and page art, and every icon.
- **Tests**: 371 backend tests (one new: the long-haul badges); `landing.test.js` expects 27 badges.
  Build clean; oxlint 0 errors, 70 warnings. Seen in the browser: cover hero and sign-in at 1280 and
  390, `/practice`, `/leagues`, `/trophies`, `/sky?tab=skills` at 1280 and 360 (no sideways scroll),
  `/diagnostic`, the home score card, `/dev/art`.
- **Honest limits of the drawings** (told to the owner): the vector art is flat and geometric. It
  can't match the 3D Nova's rendered look, so the bank cards, crests, trail and target are the
  candidates for generated pictures (prompts in the README above). Also still placeholders:
  `social-preview.png`, `apple-touch-icon.png`; the 30 profile pictures still sit on their tiles; the
  emotion pictures are about 230px.
- **Not done**: empty states still don't use `Spot`; the teacher studio keeps its own sidebar and
  colours (it does get the new fonts and icons); `Scenes.jsx` is dead code; Part 3 (questions) and
  Part 6 (features) are not started.

## Done since the last handoff (2026-10-07, evening): the visual work finished — cover page, sign-in, own illustrations

The owner asked to finish the visual work first, and set new rules. **These supersede the section
below where they differ.**

- **The owner's night-sky painting must not be used anywhere.** It was removed from the skill map and
  the sign-in scene, and `frontend/src/assets/sky/` was deleted. The originals stay in `../_inbox/`
  only. Every background is now drawn in CSS and SVG.
- **Nothing should resemble OnePrep.** The cover page was rebuilt from scratch (below). The old
  OnePrep-style sections and landscape scenes are gone from it; `Scenes.jsx` (`DawnScene`,
  `IslandScene`, `FooterScene`, `CloudBand`) is no longer imported by any page and can be deleted
  once `bits.jsx`/`Art.jsx` are checked for leftovers.
- **Icon colours: one analogous family.** The six unrelated tile tints (mint, gold, coral, pink...) are
  gone. Sidebar tiles use blue `#4f7df3` (Today), indigo `#6a63ec` (Practise), violet `#8a5fe6`
  (Progress), orchid `#b05fd6` (Tools): neighbouring hues at the same strength. Coral stays for "your
  next step" and gold for stars; neither is used as a tile tint. The skill map's constellations follow
  the same idea: Reading & Writing in pinks and orchids, Math in blues and indigos.
- **Icons** (`Icon.jsx`): the rounded set now covers 45 icons (two `Object.assign(ICONS, ...)` blocks at
  the end of the file: navigation, then in-page icons such as gem, bell, gear, flame, lock, clock,
  search, users, status icons). Anything not listed there is still the older drawing.
- **Spot illustrations** (`components/Spot.jsx`): the house drawing style, from the owner's reference:
  **ink outline + two grey-lilac washes + one accent colour**, on one flat accent blob. Ten so far:
  telescope, rocket, planet, book, hourglass, chart, summit, headphones, chat, calendar.
  `<Spot name accent pop blob size />`. New pictures must follow the same recipe (see the file header).
- **Cover page** (`pages/landing/Landing.jsx`, `cover.css`, prefix `cv-`): floating capsule nav; a
  night-sky hero drawn in CSS (stars in fixed places, a planet's edge as the horizon) with the 3D Nova,
  floating icon tiles and the one coral button; real counts on the horizon; "how it works" (4 steps
  with spot illustrations); a live question (`HeroDemo`); Nova (`NovaDemo`); an example week of the plan
  (labelled Example, "a study plan, not a score prediction"); the analytics example (`Insights`); SAT and
  IELTS cards; success stories (only when published); six questions and answers; footer with Nova and
  four friends on hills. The three demos keep their `landing.css` styles, so `landing.css` is still
  imported; most of its `ln-` page rules are now unused. No university logos, no invented numbers.
- **Sign-in screens** (`auth.css`, `Auth.jsx` `AuthLayout`, `components/NightScene.jsx`): one large
  rounded card on a soft twilight page. Left: a vector space scene drawn in `NightScene.jsx` (big blue
  planet, pink moon, ringed planet, comets, fixed stars, pointer parallax) with the 3D Nova and three
  true product lines the visitor can step through with arrows. Right: the form, with an indigo-to-violet
  main button. On phones the scene is a banner above the form.
- **Skill map**: its own sky (indigo gradient, fixed star dots, a soft disc and dotted orbit ring per
  constellation), section headings "Reading & Writing" and "Math", **a short name under every star on
  wide screens** (`SHORT` in `layout.js`), the detail card below the map as one row, Nova on the outer
  side of the focus star with the "Next step" tag above her. On phones names show on tap, as before.
- **Fixed in passing**: `CountUp` could show a negative number on its first frame ("-3 questions").
- **Tests**: 370 backend tests; build clean; oxlint 0 errors, 69 warnings. Seen in the browser: the
  cover page at 1280 and 360 (no sideways scroll), sign-in at 1280 and 390, the skill map at 1280,
  `/dev/art` (spot illustrations, the 45 icons, moods).
- **Still to do visually**: the question-bank cards and the diagnostic/score pages still use the older
  art (`Art.jsx`: `BookArt`, `MathArt`, `TrailArt`, `TargetArt`); empty states don't use `Spot` yet; the
  teacher studio keeps its own sidebar and colours; `social-preview.png` and `apple-touch-icon.png` are
  still the Part 1 placeholder.

## Done since the last handoff (2026-10-07, later): new emotions, Twilight theme, skill map, sign-in scene

The owner sent a second emotion sheet (`../_inbox/characters/nova-emotions-2.png`) and asked for a
custom colour scheme, rounder icons, a reworked sidebar, the constellation skill map (Part 5), and
better scenes and question-bank art. Parts 4 and 5 are therefore partly and fully done here.

- **Emotions.** Seven more pictures (wink, wave, excited, puzzled, laugh, determined, serene), so every
  mood now has its own: wave = wave, wink = wink, oops = puzzled (question marks), focused = determined,
  sleepy = serene (zZ), dim = the grey one; new moods `excited`, `laugh`, `calm`. **Two poses are never
  used: "angry" (sheet 1) and "Focused" (sheet 2, a frown).** This supersedes the mood table in the
  Part 2 section below. Slicing: `tools/art/emotions2.mjs` (drops the labels and ground shadows).
- **Twilight palette** (`index.css`, `shell.css` tokens). Lilac-tinted paper and ink in light mode;
  dark mode is night indigo (`--bg #0f0d28`, `--surface #1a1738`), not grey. Sky blue `--primary` is
  unchanged (actions, AA). New tokens: `--pink`, `--lilac`, `--gold` / `--gold-ink` (stars and rewards;
  never gold text on white), `--coral` / `--coral-ink` (**"your next step", once per screen**),
  `--night`, `--ease`, `--spring`. The landing page and auth forms still carry their own light tokens.
- **Icons** (`components/Icon.jsx`): a "rounded set" at the bottom of the file overrides the sidebar
  and tab-bar icons (home, calendar, chart, target, bookmark, northStar, compass, bank, mock, book,
  calc, podium, calendarStar, trophy, layers) with softer, fuller drawings, and adds `constellation`
  and `moreH`. Default stroke is 1.9. Other icons are the older drawings.
- **Sidebar** (`StudentShell.jsx`, `shell.css`): four groups (Today, Practise, Progress, Tools), a new
  "Your Sky" link, and each icon on a rounded tile in its own `tint` (`--tint` per link; the active
  tile fills with it). **Phones (<= 900px) get a 5-tab bottom bar** (`.ns-tabbar`: Home, Practise, Nova,
  Sky, More; More opens the drawer). The top bar no longer clips the XP chip at 360-480px.
- **Motion** (`shell.css`, end of file): page content rises in, cards lift on hover, buttons press,
  icon tiles spring; all off under `prefers-reduced-motion`.
- **Skill constellation map** (`/sky?tab=skills`; the old view is the "Days" tab).
  - Backend: `skillSky()` / `skillState()` in `planning.js`, `GET /api/practice/skill-sky`. States:
    new, started (< 3 answers), learning (< 70%), strong, mastered (>= 90% over >= 10 answers). `focus`
    = the gap map's top skill, else the first untried skill, else the weakest. Nothing is stored.
  - Frontend: `components/skillsky/` (`layout.js` = hand-placed positions, a wide 1600x900 layout and
    a tall 800x1560 one for phones; `SkillSky.jsx`; `skillsky.css`, prefix `sks-`). Night-sky painting
    pinned to the bottom (its own mountains and dawn), a dark shade, blurred nebula clouds per
    constellation, lines (dotted while a star is still new), stars that grow with state (mastered ones
    get a ring and a tiny smile), the coral ring + waving Nova + "Next step" tag on the focus skill,
    a detail card (accuracy, answers, tip, "Practise 10" -> a 10-question drill on that skill), zoom
    buttons / pinch / Ctrl+wheel, drag to pan when zoomed, arrow keys and Tab between stars, a list
    view, reduced-motion support. `skillsky.test.js` checks states, focus, the route, and that every
    skill has a place in both layouts without overlapping (it caught one overlap).
- **Sign-in and sign-up** (`components/NightScene.jsx`, `nightscene.css`, `nsc-`): the right-hand panel
  is now the night sky with drifting clouds, twinkling and shooting stars and the floating 3D Nova,
  with pointer parallax. `DawnScene` is no longer used by the auth pages (still in `Scenes.jsx`).
- **Question bank cards**: Twilight gradients (darkened for white text), a drifting glow and a star field.
- **Sources**: night-sky paintings exported to `frontend/src/assets/sky/` (tall and wide WebP).
- **Tests**: 370 backend tests; build clean; oxlint 0 errors, 66 warnings. Seen in the browser: the
  skill map at 1280 (dark) and 390 (tall layout), the dashboard in dark and light, the phone tab bar,
  sign-up, the question bank cards, `/dev/art` with all moods.
- **Still not done**: the cover page (`/`) is the old design with the old landscape scenes
  (`IslandScene`, `FooterScene`, `HeroDemo`); it needs the full rebuild (night-to-dawn hero, study
  flow strip, plan and analytics previews, FAQ, footer with friends). The admin studio keeps its own
  sidebar. The skill map's star labels show on hover/focus/selection only. Part 3 (questions) and
  Part 6 (trap profile, mistake reasons, spaced review) are not started.

## Done since the last handoff (2026-10-07, round 2, Part 2): the owner's character art

The owner sent the art in chat (it is now in `../_inbox/`: `characters/`, `avatars/`,
`backgrounds/`, `references/`). **Nova is no longer the yellow hand-drawn star.** She is the owner's
pink star with a screen face and a crystal on top.

- **`components/Nova.jsx`**: same props as before (`size, mood, tone, extra, float, sparkles,
  className, title, x, y`), still an `<svg>` (the landscape scenes nest it with `x`/`y`), but it now
  shows a WebP picture from `components/nova/sprites.js` plus a vector accessory.
  `sparkles` is accepted and draws nothing (the art has its own).
  Under 28px it draws `NovaMark` (a simple vector star/screen/crystal). `Brand.jsx` (the logo) and
  `public/favicon.svg` use the mark at every size.
- **Moods** (`MOOD_SPRITE` in sprites.js): the sheet has 7 usable faces, so moods share:
  happy+wave -> happy; thinking+oops -> thinking; explain+surprised -> surprised (arm up, pointing);
  cheer -> cheer; proud -> proud (the one in the blob/badge); wink+focused -> calm (half-lidded smile);
  sleepy+sleep+dim -> dim (the greyed-out one). **The angry face on the sheet is not exported and must
  never be used.** A wrong answer is "oops" = the gentle thinking face.
- **Events** (`components/nova/moods.js`): `novaMood(event)`, `answerMood({correct, difficulty,
  assisted})`, `showNovaOn(pathname)`. correct = cheer, Hard correct = proud, correct after a hint or
  retry = wink, wrong = oops, typing = thinking, welcomeBack = wave. Wired into the practice player's
  feedback, NovaChat and the welcome-back card; other screens still pass literal moods (they are valid
  names). No `<Nova>` is rendered under `/exam/*` or `/ielts/exam` (checked by grep, nothing enforces it).
- **Friends** = tones: sky -> moon, mint -> comet, lilac -> ringed planet, rose -> cloud, peach -> orange
  comet, and a new `gold` -> sun. `sun` is Nova. A friend has one picture, so `mood` doesn't change it.
  `novaTones.js` is still used for colours by the story cards.
- **3D Nova**: `components/nova/Nova3D.jsx` (`<img>`), for the hero and sign-up only. `/welcome` uses it
  (with the 3D profile pictures). Never render it in a view that also has the 2D `<Nova>`.
- **Accessories** (`components/nova/Accessories.jsx`, list in `accessoryList.js`): cap, crown, shades,
  headphones, bow. Each is drawn in the face's own coordinates (screen frame = 100 units wide) and
  placed from the measured `face` box of whichever picture is showing (+ `tilt`), so they line up on
  every pose, friend and profile picture. Add a picture = add its `face` box.
- **Profile pictures**: 30 of the owner's 3D characters, `frontend/public/avatars/NN.webp` (and copies in
  `backend/assets/avatars/` for the recap image). `user.avatar = { id, accessory, frame }`, validated by
  `backend/avatars.js` (`cleanAvatar`, `publicAvatar`); `PUT /api/student/avatar` (`{avatar: null}` =
  initials). `components/avatar/Avatar.jsx` (+ `avatars.js` data, `AvatarPicker.jsx`, `avatar.css`,
  `av-`/`avp-`). Shown in the sidebar, `/leagues`, `/profile` (picker), `/welcome` (first step, can be
  skipped), the teacher's students list, student profile, overview and leagues (`adminUi.jsx` `Avatar`
  takes `avatar`), and the recap share image (picture only, no accessory or frame).
  **The pictures stay on their original coloured tiles.** They could not be cut out cleanly (several
  characters are the same colour as their tile), so the student changes a **frame** colour, not the
  background. Clean transparent PNGs from the owner would allow real background colours.
- **`/dev/art`** (development builds only, `pages/dev/ArtGallery.jsx`): every mood, event, friend, size,
  accessory and profile picture on light and dark. Use it after any art or accessory change.
- **Pipeline**: `tools/art/` (README there). Cut-outs were made with sharp in a scratch folder; nothing
  was added to the app's dependencies.
- **Known art issues to tell the owner**: the sources are ~230px JPGs per emotion (soft above ~120px
  on a retina screen); the crystal is red on two emotions and teal on the rest; there is no wave,
  wink, sad-free "oops" or focused picture; the favicon/logo mark is my vector, not the owner's file;
  `social-preview.png` and `apple-touch-icon.png` are still the Part 1 placeholder star.
- **Tests**: 364 backend tests (new `avatars.test.js`, 6). Build clean, oxlint 0 errors / 65 warnings.
  Checked in the browser: `/dev/art` (all accessories on all pictures), `/profile` picker in dark at
  1280 and light at 360 (no sideways scroll), the logo on `/login`.
- **Not done yet (Part 4)**: the landing page and sign-in redesign from the references (TaroPrep
  split sign-up with a full illustration, ChronoTask floating tiles, the minimal icon sidebar from the
  dashboard reference), the night-sky hero. The old landscape scenes (`Scenes.jsx`) now contain the new
  Nova but were drawn around the old one. At 360px the top bar's XP chip is clipped (seen on /profile).

## Done since the last handoff (2026-10-06, round 2, Part 1): bugs, security, honest password reset

First part of the owner's six-part change list (Part 1 bugs; 2 character art; 3 Gemini questions;
4 landing page and UI; 5 skill constellation map; 6 new features). Each part ends with a stop for the
owner's review. **Things this part changed that earlier sections below no longer describe correctly are
marked "(superseded)" there.**

**Not in this repo yet:** `_inbox/` (characters, avatars, backgrounds, questions) does not exist, so
Parts 2 and 5 cannot start until the owner adds it. The two question zips in `D:\Telegram Desktop`
(`SAT_English_sorted.zip`, `SAT_Math_sorted.zip`) are ~98% College Board question-bank material
(English: 938 of 958); only the `NS-` originals (`challenging_originals.json`) may be imported (Part 3).

**Already fixed before this part (confirmed in code, tests added where missing):** every exam screen
marks with `isExamAnswerCorrect` (grading.js); a deleted test no longer crashes the exam routes; the
CSV export neutralises `= + - @` cells (test in adminContent.test.js); `tempPassword()` uses crypto.

**Database (`db.js`).**
- Daily rotating backups: the first write of each day copies the file as it stood into
  `data/backups/db-YYYY-MM-DD.json` (only from a file that still parses); the newest `DB_BACKUP_KEEP` (7)
  are kept. `DB_BACKUP_DIR` moves them, `DB_BACKUPS=off` disables. Under `node --test`
  (`NODE_TEST_CONTEXT`) they are off unless `DB_BACKUPS=on`, so throwaway DBs don't collect backups.
- A corrupt `db.json` is copied to `db.json.unreadable-<time>` (always), then the newest valid backup is
  restored and a loud message logged; with no valid backup `readDB` throws `DB_UNREADABLE` as before.
  Anything written since that backup exists only in the `.unreadable-*` copy.
- New collection `aiUsage` (see Nova caps). `userAuthState(id)` replaces the id-only `userExists` cache.

**Nova (`tutor.js`, `ai.js`, `aiLimits.js`, `/api/practice/tutor`).** (supersedes the Nova notes in the
2026-09-27 section)
- Whether Nova may say the answer (`attempts`, `correct`, `revealed`) comes from the student's saved
  progress only. The browser's `state` is used just for what is on screen (selection, crossed-out).
  `canReveal(st)` in tutor.js is the one rule.
- In AI mode the answer key, official explanation, rationales, steps and key quote are **not in the
  prompt** until the student has answered correctly or opened the explanation (`questionContext`).
  "Tell me the answer" is always handled by the built-in tutor (it asks twice), never the model.
  A model that solves the question itself can still say its own answer; that isn't the key leaking and
  isn't detected.
- When the built-in tutor gives the answer away (second ask, last step, a one-step hint) the reply has
  `reveals: true` and the route calls `markRevealed`, so the next correct answer is assisted. The
  explanation endpoint uses the same helper.
- Caps (`aiLimits.js`, env in `.env.example`): `TUTOR_DAILY_PER_STUDENT` (30), `TUTOR_DAILY_TOTAL`
  (400), `TUTOR_MAX_TOKENS` (1500, was 16000). One AI reply is taken from the allowance **before** the
  model call (a failed call still counts). Past a cap Nova answers from the built-in tutor and the SSE
  `meta` event carries `limit: "student" | "daily"`. The frontend doesn't show that yet.

**Accounts and passwords.**
- `validate.js`: `text`, `secret`, `isEmail`, `passwordProblem` (min 8, max 72 bytes: bcrypt cuts longer).
  Used by register, reset, change, admin login, IELTS admin-user create.
- Register can't claim an existing account, even one with no password (409). A teacher-added student
  with no password claims it through "Forgot password" (proves the mailbox) or a teacher reset.
- Forgot password is honest: no email transport is built in. `mailer.js`: `MAIL_WEBHOOK_URL` (POST
  `{to, subject, text}`) and `APP_URL`; without them the response is `{emailed: false}` and the screen
  tells the student to ask the teacher. The link is built from `APP_URL`, never from request headers.
  Outside production it is also printed in the server console. The answer is the same for known and
  unknown addresses. (supersedes "Forgot/reset password" in the 2026-09-22 section)
- A reset or password change sets `user.passwordChangedAt`; `requireStudent` rejects tokens whose `iat`
  is earlier (to the second). Temporary passwords (teacher reset, or a student the teacher adds) are
  `sat-` + 10 characters, set `mustChangePassword`, and `requireStudent` then allows only
  `GET /api/student/me` and `POST /api/student/change-password` (403 `PASSWORD_CHANGE_REQUIRED`). New
  endpoint `POST /api/student/change-password` (wrong current password is a 400, because the app treats
  a 401 as "signed out"). Frontend: `/change-password`, redirect in `RequireStudent`, `api.js`.
  (supersedes "always `sat-` + 8 characters" below)
- Seed: `seed.js` exports `seedDatabase(db, env)`. Production needs `SEED_ADMIN_EMAIL` (not
  admin@example.com) and `SEED_ADMIN_PASSWORD`, or it stops; no demo student unless `SEED_DEMO=1`.
  `seed:ielts` refuses to run in production. Development still seeds `admin123` / `student123`.
- The demo account (`isDemoUser` in users.js: `demo: true` or student@example.com) is out of leagues,
  the admin overview, analytics, recap class averages and the practice-admin count; it stays in the
  admin students list, flagged `demo`.

**Mock exams.** (supersedes "The clock itself is still enforced by the exam screen" below)
- The clock is the server's: `attempt.startedAt` + the module limit + `DEADLINE_GRACE_SECONDS` (30).
  New `PUT /api/exam/session/:sid/modules/:mid/answers` autosaves (409 `TIME_UP` after the deadline,
  `CLOSED` once submitted, `NOT_STARTED` before the module was opened). A hand-in after the deadline is
  graded on the **autosaved** answers only, not the request's, flagged `overtimeSeconds`, and the reply
  has `late: true`. The module GET returns `savedAnswers` so a reload or new device resumes. The exam
  screen saves 4 s after a change and when the tab is hidden; the footer says "Saved to your account"
  once one got through. Every autosave rewrites db.json like any write.

**Web security.** `app.js`: CORS allow-list from `CORS_ORIGINS` + `APP_URL` (+ the Vite dev origins
outside production; no `Origin` passes), strict CSP for what the API serves, `Cross-Origin-Resource-Policy:
cross-origin` (the frontend loads uploads from here). `vite.config.js` injects a CSP `<meta>` into the
production HTML (`frame-ancestors` can't go in a meta tag: set it as a header on the frontend host) and
absolute OG image URLs when `APP_URL` is set.

**Frontend.** `App.jsx` lazy-loads by route group (`pages/groups/{admin,hub,player,exam}.js`; the cover
page and sign-in screens stay eager): main bundle 769 kB to 345 kB (gzip 103 kB). Fonts are
self-hosted (`@fontsource-variable/inter|lexend|source-serif-4`, imported in `main.jsx`; no Google
request). `index.html` has a real title, description, theme colour, `favicon.svg`, `apple-touch-icon.png`
and `social-preview.png` (plain star mark, generated with System.Drawing: **placeholder art, Part 2
replaces it**). The 8 `window.confirm()` calls in Northstar screens use `components/Confirm.jsx`
(`useConfirm()`, mounted in `App.jsx`); the IELTS practice runner uses its own `ConfirmDialog`. (Nine
call sites in all: eight in Northstar screens, one in IELTS.)

**Tests:** 358 backend tests, all passing (was 329): new `hardening.test.js` (22: sign-up, reset, temp
passwords, Nova key and caps against a local fake of the model API, seed, demo account, CORS/CSP) and
`dbBackup.test.js` (5); `mockExam.test.js` has the server-clock and autosave cases. Frontend build clean,
oxlint 0 errors and 65 warnings (64 before). Checked in the browser on a copy of the DB: cover page with
self-hosted fonts and no outside requests, the honest forgot-password message, the temporary-password
sign-in landing on `/change-password` and then `/welcome`, the confirm modal, exam autosave and restore
after the browser copy was wiped.

**Known gaps after this part.** No email is sent until `MAIL_WEBHOOK_URL` is set. Nova's `limit` notice
isn't shown in the chat UI. A token issued in the same second as a password change survives it. Autosave
makes db.json writes much more frequent during an exam (fine for a class; the file DB is still the
first thing to replace at scale). The "Try the demo" button needs the demo account, which production
doesn't create unless `SEED_DEMO=1`. The login screen still prints the demo credentials.

## Done since the last handoff (2026-10-06): bug audit, and IELTS in Northstar's colours

The owner asked to find every bug, debug the app, and make the IELTS colours match the rest. Nothing
can promise "every" bug; this is what a full pass over the backend routes, the exam screens, the
admin studio and the hub found and fixed. Verified with 329 backend tests (all passing), a 22k-request
type-confusion fuzz of every route (0 server errors), cross-account checks (`idor`), a sweep of
every route at 1280 and 375 px (no console errors, rejections, failed calls or sideways scroll), and
live runs of the changed screens in the browser.

**IELTS theme.** Red became Northstar sky blue everywhere (tokens in "IELTS module → Frontend"), with
phone layouts for the admin editors, the user dashboard and the exam room.

**Mock exams (SAT).** The student's exam, the two review screens, the teacher's review and the
analytics now mark an answer with **one function**, `isExamAnswerCorrect` in `grading.js`.
- Before, the submit compared text (so `0.75` was wrong against `3/4`) while another screen used a
  different rule, and they could disagree. Multiple choice must be the stored index; a grid-in uses
  the practice rules; a blank is never right.
- `routes/examRoutes.js` keeps only this module's answers in the shapes the exam screen sends
  (`cleanAnswers`), refuses a submit before the session starts, and records a hand-in that came more
  than 60 s after the clock as `overtimeSeconds` (still counted; the teacher's review says so). The
  clock itself is still enforced by the exam screen; the server only reports. (superseded: the server
  now enforces it, see the 2026-10-06 round 2 section)
- `liveModules(test)` (`grading.js`): a module with no questions is neither listed nor sat, and a
  test with no questions at all can't be started. Modules can't be deleted, so an empty one used to
  stay "Not started" for ever and keep the "Full Send" badge out of reach.
- A deleted test leaves its sessions (the studio says so): they can't be started, and students get
  "no longer available" instead of a 500.
- Teacher pictures (`passageImage` / `promptImage`) were stored but never sent to students. They now
  reach the exam, the results, the admin review and the Mistakes queue (looked up from the test by
  `moduleId:questionId`, never copied into progress). `components/QuestionFigure.jsx` draws them on
  white so a transparent chart stays readable in dark mode. `/api/tests` takes bodies up to 6 MB
  (two 2 MB pictures as data URLs); the old 2 MB cap rejected them.
- The exam screen: the reading **passage was hidden on phones** (`display: none` under 768 px), so
  passage questions couldn't be answered; it now stacks above the question. The header no longer
  pushes the timer off-screen. The countdown follows a fixed deadline (browsers throttle chained
  timers in background tabs). A failed hand-in keeps the exam on screen, retries, then shows "Try
  again" instead of replacing the exam with "Couldn't load this module". "Saved" now reads "Saved on
  this device" (answers are only on the server once submitted). Blank grid-in answers aren't answers;
  grid-ins accept `/` and `.` on phone keypads; the stored text size can't make the scale NaN.

**Teacher studio.**
- `routes/testRoutes.js` validates everything: titles, 2–6 non-empty options, `correctIndex` inside
  them, a grid-in answer up to 40 characters, pictures (PNG/JPEG/GIF/WebP data URLs under about
  2 MB), module name and a time limit of 1–300 whole minutes. An update can't change `id`, `order`
  or `type`, and a rejected update changes nothing (`updateDB` saves whatever the callback leaves
  behind, so nothing may be modified before the checks pass; the same rule applies to every route).
- Sessions: a limit of 1–500, real dates and times. Adding a participant to a full session no longer
  leaves behind the account it was about to create.
- The editor (`TestEditor.jsx`) shows load/save errors, validates the time limit (0 minutes used to
  be saved and ended every exam instantly), and can pick the same picture twice.
  Every admin list/detail page shows a "couldn't load" state with a retry instead of a spinner for
  ever. Modals close only when a press both starts and ends on the backdrop (`useBackdropClose`),
  so selecting text and letting go outside no longer throws away a half-written question.
- **Deleted starter content stayed deleted only until the next restart** (`node --watch` restarts on
  every backend edit): `syncStarterQuestions` / `syncStarterVocab` (`app.js`) put it back. Deletions are
  now remembered in `db.removedStarters` (`{kind: "question" | "vocab", key}`).
- Vocabulary admin: text-only fields, a word and its definition can't be emptied. Bulk import reports
  junk entries instead of failing. Switching a question's type drops the other type's key.
- Students: editing checks the email (shape, duplicates ignoring case and spaces); the CSV export
  neutralises `=`/`+`/`-`/`@` cells (a student chooses their own name); "days" on the overview use
  the app's timezone, not UTC. Temporary passwords come from `tempPassword()` (`users.js`,
  `crypto.randomInt`, always `sat-` + 8 characters); the old `Math.random()` ones could be 1 character.
  (superseded: now `sat-` + 10, and the student must change it at first sign-in)

**Platform.**
- `db.js`: an unreadable `db.json` is copied to `db.json.unreadable-<time>` and raises
  `DB_UNREADABLE` instead of being replaced by an empty database on the next write; an empty file is
  a fresh database; the rename retries on Windows when a scanner holds the file.
- `userExists()` (`db.js`, cached on the file's mtime and size) is checked by `requireStudent`: a deleted
  student's token used to keep working for days and recreate an empty progress record per request.
- Rate limits (`rateLimit.js`): sign-in counts **failed** attempts only (20 per 15 min), so a class
  signing in from one school IP isn't locked out; sign-up has its own hourly limit; reset keeps the
  old one. `TRUST_PROXY` (see `.env.example`) makes the limiters see the real client behind a proxy.
- Type confusion: register, login, reset, admin login, IELTS user create, practice-question editor and
  more used to 500 on a number or object where text was expected. Request bodies are untrusted:
  read fields through a `text()` helper (strings only, trimmed, length-capped).
- Frontend: `safeStorage.js` swaps a refused `localStorage`/`sessionStorage` for an in-memory one
  (reading it threw in some browsers); a network failure says "Can't reach the server" instead of
  "Failed to fetch"; the Vocab page can't send two ratings for one word; the study-plan tick, the
  target-score box and the notes box (its last words were dropped on close) were fixed; a list that
  fails to load is no longer shown as empty (`LoadFailed.jsx`); the question-bank section page is keyed
  by section, so one section's filters and table don't carry over to the other.

**Known limits, left as they are**
- The frontend assumes Tashkent time in a few places (`pages/hub/hubUtils.js` `TZ`, the admin
  overview, `adminUi.jsx`) while the server reads `APP_TIMEZONE`. Change them together.
- A SAT session can't be ended or deleted from the studio (IELTS sessions can). Starting is one way.
- The IELTS exam-room login is the candidate ID alone, as in the platform it recreates.
- Every request reads and parses the whole `db.json`; fine for a class, the first thing to replace at scale.

## Done since the last handoff (2026-10-03): gamification roadmap (7 phases)

The owner's 13-feature spec: fair XP, a calm exam mode, the Northstar sky, a daily question,
presence, leagues, test-date planning, ghost pacing and a monthly recap.

**Rules that now apply everywhere**
- **XP lives only in `gamification.js`**: the `XP` table plus the `score*` functions
  (`scorePracticeAnswer`, `scoreRemixAnswer`, `scoreDrill`, `scoreVocabReview`, `scorePlanTask`,
  `examModuleXp`, `scoreIeltsPart`, `scoreIeltsEssay`). Routes never hard-code an amount.
  `xpGuide()` feeds the "How XP works" lists, so UI copy can't drift from the rules.
- **Anti-farming:** a question pays by difficulty (Easy 8, Medium 12, Hard 18, and Challenging 24 since 2026-10-08) once. Each question
  has an XP budget in `answered[id].xp`; assisted answers pay 30%, a first miss 1, a repeat 1 up to
  `reviewDailyCap`. Remix, vocab and review have daily caps in `p.daily`. A plan task pays once
  (`planPaid`), when the student's counted work finishes it (`weekPlan.js`), and the drill bonus is verified on the server from `answerLog` (`startDrill` /
  `POST /practice/drill/complete`); the client can't claim it.
- **Exam mode is game-free.** On `/exam/*` and `/ielts/exam` there are no XP pops, badges, confetti,
  streak or presence UI (`isExamPath` in `ProgressContext.jsx`). Mock-exam rewards are queued with
  `queueExamReward` and shown once on the results page (`rewards` in the student result,
  `POST /api/student/sessions/:sessionId/rewards/seen`). Module submit no longer returns `reward`.
- **No guilt-trip copy.** Missed days are "not lit", overdue tasks are "Carried over"; never write
  "you lost", "don't break" or similar.
- **Day history:** `p.days = { 'YYYY-MM-DD': "active" | "repaired" }` is the source for streaks
  (`streakOf`), the sky (`skyOf`) and recaps. `award(p, xp, badges, { activity: false })` gives XP
  without lighting a star (gifts such as the welcome-back bonus).
- New time helpers: `dayDiff(a, b)`, `dayStartMs(key)` (Tashkent midnight). Functions that depend on
  the clock take an injectable `now` for tests.
- Lazy rollover, no scheduler: league weeks and monthly recaps are settled on the first request
  after the boundary. Routes read first and only call `updateDB` when `ensure*` reports a change
  (`dbWithLeague`, `dbWithRecaps`).

**New collections** (backfilled in `db.js`): `dailyStars` (one record per date: question id,
designation, answers by user) and `leagues` (the current week, groups, members, settled history).
`attempts` rows gained `seconds` and `timestamps` (question id → seconds into the module).
Presence is in memory only (`presence.js`), never stored.

**New progress fields** (backfilled in `getProgress`): `daily`, `remixPaid`, `planPaid`, `ieltsXp`,
`drill`, `examRewards`, `days`, `repair`, `returned`, `welcome`, `league {tier, history}`, `recaps`,
`recapThrough`, `recapSeen`, `targetAccuracy` (0.7 to 1, default 0.9), `lastXpAt`. `examDate` may now
be a custom `YYYY-MM-DD` (not past, at most 730 days ahead) as well as one of `SAT_DATES`.

**Features, endpoints and files**
- **Northstar sky** (replaces the flame). `skyOf` returns marks per day ("1" lit, "r" repaired,
  "0" not lit, "t" today); 7 lit stars make a constellation. UI: `components/Sky.jsx`,
  `skyModel.js`, page `/sky`, `sky.css` (`ns-sky-`). The streak chip uses the `northStar` icon.
- **Repair drill.** One missed day can be repaired within 48 hours by 10 random questions
  (sections alternate, skills without replacement: `pickRepairIds`). `POST /api/practice/repair/start`
  fixes the set on the server; `settleRepair` validates every answer came from that set (30-minute
  grace). The player runs it with `source=repair`. Uses the SAT bank for every student.
- **Welcome back.** After 3 or more days away: `POST /api/practice/welcome-back` gives
  `XP.welcomeBack` and the **Returning Star** badge, at most once per 14 days;
  `POST /welcome-back/seen` dismisses it. Overlay in `StudentShell.jsx` (portal). 15 badges now.
- **Daily Northstar question** (`dailyStar.js`, `routes/dailyRoutes.js` at `/api/daily`): `GET /`,
  `POST /answer` (one attempt per day), `GET /catalog`. The designation is 2 letters + 4 digits
  from `designationFor(date)`. `% correct` and the share text are spoiler-free. Today's question is
  locked in practice until attempted (`lockedFor` in practiceRoutes, 409). UI: `/daily`,
  `DailyPrompt.jsx`, `daily.css` (`ns-daily-`).
- **Studying now** (`presence.js`, `POST /api/presence/ping`): heartbeat about every 60 s while the
  tab is visible (`hub/usePresence.js`), counts the last 2 minutes, anonymous. Under 3 the payload
  is `{ few: true, count: null }` and the UI says "A few students are studying". Never in exam mode.
- **Weekly leagues** (`leagues.js`, `GET /api/leagues/me`, `GET /api/admin/leagues`): tiers Comet,
  Nebula, Pulsar, Quasar, Supernova ("Nova" is the tutor, so it isn't a tier). Groups of about 20
  by level, one group under 20 users; late joiners go to a group within one tier or open a new
  one. Ranked by XP earned since Monday 00:00 Tashkent (`weekKey`); `zoneSize = min(5, size / 3)`
  promote and relegate. UI: `/leagues`, `LeagueCard.jsx`, `Tier.jsx`, `/admin/leagues`
  (`leagues.css` `ns-league-`, `ad-league-`). The old all-time leaderboard was removed.
- **Countdown plan and point-gap map** (`planning.js`, `GET /api/practice/roadmap`,
  `GET /api/practice/gap-map`, `PUT /settings` takes `examDate` and `targetAccuracy`). The plan
  counts back from the test day in weeks (build, sharpen, final) weighted to weak skills, and is
  labelled a study plan, not a prediction. The gap map uses **raw question counts only**
  (`DOMAIN_QUESTIONS`: 54 R&W, 44 Math, an estimate from College Board domain weights); never show
  scaled scores there. Top 3 skills = "Worth the most points for you" (`worthMost` in progress).
  UI: `/plan` roadmap, `/gap`, `/profile` (SAT date), `planning.css` (`ns-road-`, `ns-gap-`,
  `ns-profile-`).
- **Ghost run** (`examRoutes.js`: `cleanTimestamps`, `ghostFor`; `pages/examGhost.js`). The exam
  screen records when each question was last answered and sends `timestamps` with the submit; the
  server clamps them. The module GET returns `ghost` (the same module in an earlier session) or
  null. Off by default: a small "Pace" tab on the edge opens "Last attempt: you were on Q14 at this
  time". No animation, sound or auto-popup; keep it that way. `ExamModule.jsx` now also restores
  answers, flags and position after a reload.
- **Monthly recap** (`recap.js`, `routes/recapRoutes.js` at `/api/recaps`): `GET /`, `POST /seen`,
  `GET /:month/image.svg`. Built once from the 1st for the previous month and stored in `p.recaps`;
  months with no lit day get none. The share image is a server-rendered 1080×1080 SVG (text
  escaped), turned into a PNG in the browser; no external service. UI: `/recap`, `RecapPrompt.jsx`,
  `recap.css` (`ns-recap-`).
- `GET /api/practice/progress` now also carries `xpRules`, `xpGuide`, `streak`, `sky`, `repair`,
  `welcomeBack`, `daily`, `recap`, `targetAccuracy` and `worthMost`.
- `removeUser` also clears a student's daily answers and league membership.

**Tests:** backend has 287 tests, all passing; new suites are `streaks.test.js`, `daily.test.js`,
`leagues.test.js`, `planning.test.js`, `ghost.test.js` and `recap.test.js`. The frontend build is
clean; oxlint shows 0 errors and 78 warnings (29 IELTS + 49 Northstar).

**Checking in the browser without touching real data:** copy `db.json`, start the backend with
`DB_PATH` pointing at the copy, and test there.

**Open questions for the owner:** the diagnostic screens still celebrate at hand-in (they aren't
under `/exam/*`); the heartbeat also runs in the practice player; the admin Overview "Top students"
still ranks by all-time XP.

## Done since the last handoff (2026-09-30): diagnostic tests

The owner asked for a section that tests new users' abilities: 10–15 SAT questions, and a random
Reading or Listening part for IELTS. **The questions must be ones the student hasn't tried.**

- **"Untried" means never met anywhere.**
  - SAT: not in `progress.answered`, `revealed`, `saved`, `flagged` or `notes`, and not served in
    any earlier diagnostic, finished or not (`seenQuestionIds` in `diagnostic.js`).
  - IELTS: no practice attempt, earlier diagnostic or mock attempt on that record (`triedRefIds`
    in `ielts/lib/diagnostic.js`). Only practice-enabled records (`use` practice/both) are used,
    so a diagnostic never spoils a mock.
- **SAT diagnostic** (`backend/diagnostic.js`, `routes/diagnosticRoutes.js` at `/api/diagnostic`)
  - `BLUEPRINT`: 7 R&W + 7 Math, one slot per question, `[domain, difficulty]`, with every domain
    covered and 2 easy, 3 medium and 2 hard per section. Test order follows the digital SAT: R&W
    grouped by domain (Craft and Structure first), Math from easy to hard.
  - Slots prefer a skill not used yet in the section. When a slot's unseen questions run out,
    Math generates a fresh question (a `rmx.` id, graded from the id) and R&W falls back to a
    nearby difficulty, then to any unseen R&W question. With fewer than `MIN_QUESTIONS` (10) the
    test isn't offered, and the page says why.
  - Timed at the official pace (71 s per R&W question, 95 s per Math question, so 20 minutes).
    The deadline is on the server, with a 1-minute grace for slow saves. Answers, flags and time
    per question autosave (`PUT /:id/answers`); a reload resumes.
  - No answer, skill or difficulty is sent while it runs (`testQuestion`). While a diagnostic is
    open, its questions are locked in practice: answer, explanation, remix and Nova return 409
    (`lockedQuestionIds`).
  - Scoring: `scoreRows` weights questions easy 1, medium 2, hard 3, then maps the weighted
    accuracy through `scaled()`. Placement labels run from Foundation to Expert (`placementFor`).
  - Completion (`completeDiagnostic`) records answered bank questions like practice:
    `answered`, the `answerLog` with `d: 1` (so the session is titled "… Diagnostic Test"), and
    misses go to the mistakes queue. It awards XP (10 per correct, 2 per wrong, 20 bonus) and the
    new **Pathfinder** badge.
  - **No score ("expired")** when nothing is answered, or when the clock closed it with fewer than
    half answered: the student probably walked away, and a 400 would wreck the estimate. A test
    the student hands in themselves is always scored.
  - `estimate()` in practiceRoutes uses the newer of the latest mock module and the latest
    diagnostic (source `"diagnostic test"`), then practice. `GET /practice/progress` includes
    `diagnostic` and `ieltsDiagnostic` status for the dashboards and the sidebar badge.
  - Review: `GET /practice/questions?source=diagnostic&diag=<id>[&only=missed]` returns a finished
    diagnostic's bank questions in test order, so the results page reopens them in the player.
    The results page itself never shows the answer key: Nova teaches in the player.
- **IELTS diagnostic** (`ielts/lib/diagnostic.js`, `ielts/routes/diagnosticRoutes.js` at
  `/api/ielts/student/diagnostic`)
  - `start` picks Listening or Reading at random (whichever still has untried parts), then a
    random part. The part stays assigned (`created`) until it's finished, so reloading can't
    reroll it, and the part is locked in section practice meanwhile (`inDiagnostic`, 409).
  - `begin` starts the server clock: audio length + 60 s for listening, 20 minutes for reading.
  - `submit` marks it with `gradePractice` → band + CEFR (`cefrFor`). It also stores an
    `ieltsPracticeAttempts` row with `diagnosticId`, so practice shows the part as tried. Same
    "expired" rule as SAT.
- **Frontend**
  - Sign-up now goes to `/welcome` (`pages/hub/Welcome.jsx`), where the student picks SAT or
    IELTS and lands on that diagnostic page with `?welcome=1`.
  - SAT: `/diagnostic` (`hub/Diagnostic.jsx`), full-screen `/diagnostic/test/:id`
    (`pages/diagnostic/DiagnosticTest.jsx`: the player's `pl-` look in test mode, with a navigator,
    a "Check your work" page and the Math reference sheet), and `/diagnostic/results/:id`
    (`hub/DiagnosticResult.jsx`: score scale against the target, domains, focus skills, next
    steps, per-question "Retry with Nova").
  - IELTS: `/ielts-prep/diagnostic` (`hub/IeltsDiagnostic.jsx`) and `/ielts-diagnostic/:id`
    (`ielts/exam/DiagnosticRunner.jsx`: intro → audio + sound check → `ExamScreen` → in-place
    review with the band). Resuming listening restarts the audio at the elapsed second.
  - Both navs have "Diagnostic Test" (icon `compass`, badge "New" until the first one).
    `DiagnosticPrompt` (in `hub/Home.jsx`) sits on both home pages. The SAT "Current Score" note
    names its source, and the teacher's student profile has a "Diagnostic tests" card.
  - Styles: `src/diagnostic.css` (`dg-`); the IELTS runner's extras are in `ielts/styles/exam.css`
    (`ie-diag-`). `TrailArt` in `components/Art.jsx` is the landing illustration.
- **Also:** answer checking moved to `backend/grading.js` (shared by practice and the diagnostic);
  `DataTable` moved to `PlayerParts.jsx`; `api.js` errors now carry `status` and `code`, and
  `request()` takes `keepalive`; `removeUser` also deletes diagnostics and IELTS practice attempts.
- **Tests:** backend now has 114 tests, all passing. `diagnostic.test.js` and
  `ielts/diagnostic.test.js` are new, and `landing.test.js` now expects 14 badges. The frontend build
  is clean; oxlint shows 0 errors and the same 82 warnings.

## Done since the last handoff (2026-09-28): IELTS section practice

The owner asked for IELTS practice material, meaning individual Listening, Reading and Writing
sections "from Cambridge official books".
- **Copyright:** the Cambridge IELTS books are copyrighted (Cambridge University Press &
  Assessment), so none of their passages, recordings or questions are in this repo. Don't add them.
- **What was built instead:**
  - An original practice set in the same format.
  - A **Use in** switch, so teachers can add material they are licensed to use.

- **Student side**
  - `/ielts-prep/practice` (`pages/hub/IeltsPractice.jsx`):
    - skill tabs, remembered in sessionStorage `ns_ielts_practice_tab`;
    - part cards with level, best score and attempts;
    - stats and recent practice.
  - The IELTS home has "Section practice" tiles, and the IELTS nav has "Section Practice" (icon
    `layers`).
  - `/ielts-practice/:kind/:id` (`ielts/exam/PracticeRunner.jsx`, candidate look) runs one part in
    the real exam screen:
    - an intro that picks the mode;
    - Listening in test mode (Playlist, timer = audio + 60 s) or practice mode (play/pause, back
      10 s, seek);
    - Reading/Writing timed or untimed (a stopwatch when untimed).
  - Review happens in place. `ExamScreen` gained `label`, `timed`, `topBanner`, `locked` (read-only),
    `marks` (slotId → bool) and `submitCopy` props, plus `keyOf`/`reveal`.
    - `Reveal` (controls.jsx) shows a tick or "✗ key". Given `group`, it adds option text ("vii How
      cities…"), and it's rendered next to every drop zone.
    - `FooterNav` takes `markOf`, which colours the question buttons `ie-qbtn--right/--wrong`.
    - Listening reviews offer the transcript.
  - Writing feedback shows the automatic checks (`writingFeedback` in `lib/practice.js`), a
    self-check against the four criteria and the model answer.
- **Backend**
  - `ielts/lib/practice.js` covers listing, parts with real question numbers, marking and the
    writing checks.
  - `ielts/routes/practiceRoutes.js` (`requireStudent`) serves `GET /api/ielts/student/practice`,
    `GET /:kind/:id` (never sends the key) and `POST /:kind/:id/submit`.
    - Every submit is stored and earns XP through `award()`.
    - Listening/Reading return rows, keys, a band estimate and the transcript.
    - Writing returns the feedback and the model answer.
- **Content**
  - `ielts/seed/practice.js` has 4 listening parts (40 questions), 3 reading passages (40 questions,
    easy to hard) and 4 writing tasks with model answers. Its transcripts are in
    `practiceTranscripts.js`; the SVG charts are in `seed/assets/images`.
  - `ensureIeltsPractice()` (seed/starter.js) syncs the set by `seedKey` + `seedHash` at startup.
    It skips records a teacher saved (`customized: true`) or deleted.
  - Audio comes from `node seed/generate-audio.js` (Windows System.Speech, no installs). It covers
    PL1–PL4 as well as the mock transcripts.
  - Keep answer keys unpatterned: heading lists and word banks are deliberately shuffled.
- **Teacher studio**
  - The Listening/Reading/Writing editors have a **Use in** select (`USE_OPTIONS` in
    `admin/useEditorData.js`), sent on every part.
  - The content list has a pill with a quick-change menu (`PATCH { use }`).
  - The Writing editor also gained **Level** and **Model answer**.
  - Saving without a `level` now keeps the stored one; new records default to MEDIUM.
- **Tests:** backend now has 92 tests, all passing. The frontend build is clean; oxlint shows 0
  errors and the same 82 warnings.
- **Dev servers:** `.claude/launch.json` lives in the project root, one level up. It defines
  `northstar-frontend`/`northstar-backend` (and the standalone `ielts-*`).
  - The old `northstar-sat-prep` entry pointed at a folder with no package.json and was removed.
  - Vite served a stale `App.jsx` once more after many edits. Restarting the frontend fixed it.

## Done since the last handoff (2026-09-28): cover page and light brand

The owner found the old dark "night sky" cover page weak. They shared oneprep.com's marketing
pages and sign-up screen and asked for a more engaging cover page with better effects and colour,
slightly lighter colours, and the same look across the platform.

- **Cover page** (`/`, `pages/landing/Landing.jsx`): a sticky nav, then these sections in order.
  - **Hero:** the headline with a hand-drawn underline, and `HeroDemo.jsx`. An animated cursor
    answers a Digital SAT question, then an IELTS listening form, over a colour blob with floating
    tiles and a score chip.
  - **Skill marquee.**
  - **Meet Nova:** `NovaDemo.jsx`, a looping chat that highlights passage evidence.
  - **Statement band:** rotating product claims over `CloudBand`. It shows real story quotes
    instead once any exist.
  - **Insights:** `Insights.jsx`, an example analytics view, labelled "Example".
  - **Features, then "Two exams, one account".**
  - **Success stories:** hidden while there are none.
  - **Live stats:** counts from `GET /api/public/overview`.
  - **Islands CTA and landscape footer:** `IslandScene`, `FooterScene`.

  How it's wired:
  - `/#section` links land on their section after data loads.
  - Scroll reveals and count-ups use IntersectionObserver, with a 1.5 s fallback for views where
    observers never report.
  - Demos only run while on screen.
  - Everything respects `prefers-reduced-motion`.
- **Sign-in screens** (`pages/landing/Auth.jsx`):
  - `AuthLayout` puts the form on the left and `DawnScene` (pastel dawn valley, parallax, Nova with
    a cap, "SAT 1600 / IELTS 9.0" signpost) on the right.
  - Routes: `/login`, `/signup`, `/forgot-password`. `ResetPassword` and `AdminLogin` reuse the
    layout; the teacher variant has a winking Nova and different signs.
  - `RequireStudent` now redirects to `/login` with `state.from`, and an expired student token goes
    to `/login`.
  - The old `pages/Landing.jsx` was removed. There's a copy in this session's scratchpad only.
- **Success stories** (`backend/stories.js`, admin CRUD at `/api/admin/stories`,
  `pages/admin/Stories.jsx`):
  - Fields: name, detail, exam, before → after (SAT 400–1600 in 10s, IELTS 0–9 in halves, and it
    must go up), quote, avatar tone, published.
  - The cover page shows only published stories and never invents testimonials. Tell teachers to
    publish only with the student's permission.
- **Platform restyle:**
  - `--primary` moved from indigo `#5b4ff5` to sky blue `#1664e2`, with matching `--hero*` tokens in
    hub.css.
  - The hub and studio sidebars are now light pastel in light mode and keep their navy/night look
    in dark mode.
  - The Nova logo replaces the old star marks in the hub, studio and auth pages.
  - The studio overview banner is pastel, and confetti uses the new palette.
- **Performance:** the cover page's nav has no `backdrop-filter`. Re-blurring the animated hero
  under it every frame was expensive. The blob morph animates transforms, not `border-radius`, and
  the sound-wave bars use `scaleY`, not `height`.
- **Tests:** backend now has 85 tests, all passing. `landing.test.js` is new. The frontend build is
  clean; oxlint shows 0 errors and the same 82 warnings as before.

## Done since the last handoff (2026-09-27)

A OnePrep-style redesign of the student side, modelled on eight oneprep.com screenshots the owner
shared. Before the first start, `db.json` was backed up to
`backend/data/db.backup-before-question-bank-1790509883563.json`.

- **Hub shell** (`pages/hub/StudentShell.jsx`, `shell.css`): a new sidebar with an **SAT / IELTS**
  switch in the top-left corner. Each exam has its own nav:
  - SAT: Home, Ask Nova, Study Planner, Analytics, Saved & Mistakes, Question Bank,
    Full-Length Tests, Vocab, Score Calculator, Trophies.
  - IELTS: `/ielts-prep` home, Ask Nova, `/ielts-prep/tests`, Vocab, Trophies.

  The mode follows the URL: `/ielts-prep*` is IELTS and the `SAT_ONLY` paths are SAT. Shared pages
  (`/nova`, `/vocab`, `/trophies`) keep the last choice, stored in `ns_exam`. Switching navigates to
  that exam's home. There's also a bell for announcements and a user menu with dark mode and sign
  out.
  - The Home dashboard was rebuilt: countdown, editable current/target score, today's plan and
    overdue tasks, and a weekly activity chart (`components/ActivityChart.jsx`: stacked correct/wrong
    by difficulty, with a tooltip and a "View as table" option).
  - Routes: `/practice` (bank landing), `/practice/:sec` (`rw` | `math`), `/mistakes`,
    `/analytics`, `/nova` (`/coach` redirects there). `pages/hub/Practice.jsx` was removed.
- **Content** (`backend/practiceSkills.js`, `backend/content/*`): the official digital-SAT taxonomy.
  - 4 R&W domains with 10 skills, and 4 Math domains with 19 skills. `DOMAINS` in
    `practiceContent.js` is now derived from `SKILLS`.
  - 186 starter questions: 60 hand-written R&W, 12 classic Math and 114 generated Math (6 per
    skill, seeded; `buildMathStarter()`). Each has rationales, steps and a hint.
  - `SKILL_LESSONS` holds a strategy lesson per skill (used by the Masterclass tab and Nova).
  - Math **remix** ids look like `rmx.<skill-slug>.<levelIdx>.<seed>`. The server regenerates the
    question from the id to grade it, so nothing is stored.
- **Question bank**:
  - `QuestionBank.jsx` is the landing page with two section cards (art in `components/Art.jsx`).
  - `BankSection.jsx` has a Topic / Progress / Accuracy table per domain and skill. Its filters
    (difficulty, status, flagged, saved, type, order) persist in sessionStorage.
  - Both are backed by `GET /api/practice/bank` and `/bank/:sec/skills`. `GET /questions` gained
    `source`, `skills`, `status`, `order`, `seed` and `type`; `selectQuestions()` is the one
    filter implementation.
- **Practice player** (`pages/practice/*`, `player.css`, route `/practice/solve?…`):
  - A split passage/question layout with a draggable divider.
  - Answer cross-out, a highlighter (character ranges in localStorage `ns_hl_<id>`), notes, flag,
    a timer, and **Check** with one retry.
  - A navigator popup colored by difficulty (green/yellow/red) with status marks.
  - "Report a problem" (goes into `questionReports`), a session summary with XP, and keyboard
    shortcuts (listed in the Info tab).
  - The side panel has four tabs: Nova, Explanation, Masterclass and Info.
    - Explanation opens with a "Try it first?" gate, then shows one tab per option and a stepper
      that reveals one step at a time.
    - Masterclass is the skill lesson; Info has the reference sheet and shortcuts.
  - Answers post `timeMs` and `retry`. Assisted answers (a retry, or an answer after opening the
    explanation) earn 3 XP and don't count toward the combo or clear a mistake.
  - Every answer is added to `progress.answerLog` (capped at 5000). That log feeds the weekly
    trend, `GET /analytics` and `GET /sessions` (study sessions; a gap of more than 20 minutes
    starts a new one).
- **Nova** (`backend/tutor.js`, `backend/ai.js`, `components/Nova.jsx`, `NovaChat.jsx`):
  - `POST /api/practice/tutor` streams SSE events: `meta`, then `delta`s, then `done` (with
    `highlight`, `suggestions`, `tutor` state and `action`), or `error`.
  - The built-in tutor works without a key. It recognizes intents (highlight, strategy, steps,
    hint, answer, a specific option, vocab), stops before the last step, and gives the answer only
    on the second ask.
  - With `ANTHROPIC_API_KEY` set, `ai.js` streams from `TUTOR_MODEL` (default `claude-opus-5`) at
    `TUTOR_EFFORT` (default `medium`), using server-side fallbacks and prompt caching.
  - The model can mark evidence with `[[highlight: …]]`. The server strips the marker and maps it to
    passage offsets with `locateQuote()`.
  - The `/coach` endpoint and `askCoach` were removed.
- **Progress fields** (backfilled by `getProgress`): `revealed[]`, `notes{}`, `currentScore`,
  `examDate` (one of `SAT_DATES`), `ieltsTarget` and `answerLog[]`. Set them through
  `PUT /api/practice/settings`. Plan tasks now carry `date`, `overdue`, `isToday`, `count` and
  `unit`. (`POST /plan/:i/complete` and `/toggle` were removed on 2026-10-08: tasks finish from
  counted work only, see "the weekly plan finishes itself".)
- **Admin** (`pages/PracticeBank.jsx`, `routes/adminPracticeRoutes.js`):
  - The editor has passage, per-option rationales, steps (up to 8), hint and key evidence fields.
    The key evidence must appear in the passage, or the save returns 400.
  - Edits that omit these fields keep the stored values.
  - A **Student reports** card lists `GET/DELETE /api/admin/practice/reports`, with Edit question
    and Resolve buttons.
- **Tests**: backend now has 81 tests, all passing. `practice.test.js` and `content.test.js` are
  new. The frontend build is clean; oxlint shows 0 errors and 82 warnings (29 IELTS + 53 Northstar).

## Done since the last handoff (2026-09-23)

- **OnePrep-style question bank**: practice questions now carry a `domain` field —
  College Board's real reporting-category taxonomy (`DOMAINS` in `practiceContent.js`:
  4 domains per section, `topic` is the finer-grained skill within a domain). The
  student Practice page (`pages/hub/Practice.jsx`) was rewritten around a filter
  sidebar (section tabs, domain checkboxes, difficulty checkboxes, status checkboxes
  for unanswered/correct/incorrect/flagged, skill dropdown, search) plus a bank-style
  question list with colored domain/difficulty/status tags — much closer to a real
  SAT bank (OnePrep) than the old single-row-of-dropdowns filter bar. The question
  modal now supports Prev/Next navigation across the filtered list ("Question 3 of
  24") without closing, and a new "Flag for review" toggle (separate from the
  mistakes-queue "Save") — `progress.flagged`, `POST /api/practice/questions/:id/flag`.
  Admin's `PracticeBank.jsx` editor gained a Domain dropdown (scoped to the selected
  section, via `GET /api/admin/practice/domains`). (Practice.jsx was replaced on 2026-09-27 by
  the question bank + practice player; see above.)
  `readDB()`/`db.json` older than this change get backfilled automatically on server
  start (see `app.js`) — no re-seed needed.
- **Vocabulary deck expanded 20 → 105 words** (`VOCAB_WORDS` in `practiceContent.js`).
  Existing `db.json` decks get the new words merged in on server start (dedup by
  word text), same backfill mechanism as above.

## Done since the last handoff (2026-09-22)

- **Auth hardening**: `JWT_SECRET` is no longer a hardcoded fallback — if unset, a random
  secret is generated once and persisted to `backend/data/.jwt-secret` (gitignored); set
  `JWT_SECRET` yourself for a real deployment (`.env.example` documents this).
  `express-rate-limit` guards `/api/student/login`, `/api/student/register` and
  `/api/auth/admin/login`. `helmet` is mounted globally.
- **Forgot/reset password**: `POST /api/student/forgot-password` +
  `POST /api/student/reset-password` (hashed, 1h-expiring token; no email transport
  configured, so the reset link is logged to the server console). Frontend: a "Forgot
  password?" link on the login form plus `/reset-password`. (superseded: see "Accounts and
  passwords" in the 2026-10-06 round 2 section)
- **Grid-in questions in the practice bank**: `practiceQuestions` now supports
  `type: "mcq" | "grid_in"` end to end — admin CRUD (`PracticeBank.jsx`), grading
  (`practiceRoutes.js` answer endpoint), and the student `QuestionCard` (numeric input
  instead of options).
- **Mock-exam wrong answers now feed the Mistakes queue**: on module submit,
  `examRoutes.js` mirrors each wrong answer into `progress.examMistakes` (see
  `gamification.js`'s `getProgress`). `GET /api/practice/mistakes/exam` and
  `POST /api/practice/mistakes/exam/:key/clear` (awards XP, same `mistake_crusher`
  badge). Shown as a "From your mock exams" section above the regular saved-questions
  list (now in `pages/hub/Mistakes.jsx`).
- **Tests**: `backend/gamification.test.js` (pure unit tests) and
  `backend/routes.test.js` (boots the real app against a throwaway DB and hits it over
  HTTP) — see Run section above. `backend/app.js` was split out of `server.js` to make
  this possible.
- Fixed a real bug: a block of `frontend/src/index.css` (question preview modal, image
  upload, answer-option rows) was written with camelCase JS-style property names
  (`borderRadius` instead of `border-radius`, etc.) — invalid CSS the browser silently
  dropped. The admin "Preview" button in `TestEditor.jsx` was rendering essentially
  unstyled. Also removed an unused `.xp-*` CSS block from the same file (dead code, no
  `.jsx` referenced it).
- Fixed: `Landing.jsx` / `AdminLogin.jsx` never redirected an already-authenticated user
  away from the login screen; `api.js` now also clears a dead token and bounces to the
  right login on any 401 instead of leaving the app stuck on a blank/loading screen.
- Fixed: `TestEditor.jsx`'s `removeOption()` could silently point `correctIndex` at the
  wrong option after removing one before it in the list.
- Swapped stray raw emoji / hardcoded "✕" for the project's own `<Icon/>` (see
  `ExamModule.jsx`, `ExamComplete.jsx`, `TestEditor.jsx`, `TestsList.jsx`,
  `SessionsList.jsx`, `SessionDetail.jsx`, `PracticeBank.jsx`, `VocabAdmin.jsx`,
  `StudentResultView.jsx`, `ParticipantResult.jsx`) and de-duplicated `ExamModule.jsx`'s
  hand-rolled theme toggle into the shared `<ThemeToggle/>`.

## Good next tasks

1. Spaced-repetition scheduling for vocab (due dates instead of mastery sort).
2. Swap JSON DB for SQLite (only `db.js` should change).
3. Email/SMS delivery for announcements, temp passwords and the password-reset link
   (currently console-logged — see `routes/studentRoutes.js`).
4. Replace the native `confirm()` dialogs on destructive admin actions (delete test,
   remove participant, delete vocab/practice question, delete announcement, reset
   password — 7 call sites) with the app's own modal pattern; flagged but not done in
   this pass.
5. Broaden try/catch + toast error handling across admin pages that call the API with
   no failure feedback (several call sites in `TestEditor.jsx`, `SessionDetail.jsx`,
   `VocabAdmin.jsx`, `admin/StudentProfile.jsx`, `admin/Announcements.jsx`,
   `hub/ScoreCalc.jsx`, `hub/StudyPlan.jsx`, `hub/Vocab.jsx`); `TestsList.jsx`'s
   delete/duplicate handlers were fixed as an example of the pattern to follow.
6. More Reading & Writing content. There are 6 questions per R&W skill and no generators, so an R&W
   remix just picks another question on the same skill and soon runs out. Math remixes are
   unlimited. Add questions in `content/readingWriting.js` and run `content.test.js`.
7. (Done 2026-10-08: the Desmos calculator. What is left is a Desmos API key, then running the
   API path once; see that section.)
8. IELTS section practice:
   - Speaking practice: cue cards and a browser recorder, then self-assessment.
   - More original listening/reading sets. Follow the format in `backend/ielts/seed/practice.js`,
     then regenerate audio with `node seed/generate-audio.js`. Each new part is also one more
     untried part for the IELTS diagnostic (a student can take at most 7 today).
9. Diagnostic tests:
   - Let teachers change the SAT blueprint or length (it's a constant in `backend/diagnostic.js`).
   - Add a starting-level column to the admin students list (the profile already has it).
   - Consider an adaptive second stage, like the digital SAT's modules.
10. Gamification roadmap follow-ups (see the 2026-10-03 section):
   - The owner's answers to that section's open questions.
   - A repair drill made of IELTS material for IELTS students; today everyone gets SAT questions.
   - Presence lives in one process's memory. Move it to a shared store before running more than
     one backend process.
