# Workbook converter

Turns a "Digital SAT 100-Question Practice Workbook" PDF (the owner's, written with ChatGPT: 50 Math,
50 Reading and Writing, a key and a reason for every choice) into a bank file,
`backend/content/originals/batchN.json`, in the form `content/originals.js` already reads for
`batch3.json`. Not part of the app or its build; run it by hand when a new workbook arrives.

```
npm init -y && npm install pdfjs-dist@4.10.38     # in a scratch folder, not in the app
node build.mjs <pdfjs-dist folder> <workbook.pdf> <series> <out.json>          # writes the file
node build.mjs <pdfjs-dist folder> <workbook.pdf> <series> <out.json> check    # report only
node read.mjs  <pdfjs-dist folder> <workbook.pdf>                              # what was read, raw
```

`<series>` is a digit that goes into the ids: `1` gave `batch4.json` (WBM-101…150, WBRW-101…150),
`2` gave `batch5.json` (WBM-201…, WBRW-201…). A third workbook is series `3`, written to
`batch6.json`; then add the file's name to `FILES` in `content/originals.js`. Ids must not change
once students have answered the questions: progress is kept by key (`nb-wbm-101`).

## How the PDF is read (`read.mjs`)

The PDFs are text. Parts I and II are the questions, Part III a compact key, Part IV every question
again with "A. Incorrect — …" / "B. Correct — B is correct: …" under it.

- `√`, `≥` and the like sit in another font on top of a space, so the stored spaces are wrong
  around them. Spaces are worked out from where each run of text starts and ends.
- Paragraphs are told apart by the gap above a line (about 14 to 15 points inside one, 17 or more
  above a new one); a choice is an indented line starting `A.` to `D.`.
- A long heading in Part IV runs onto a second line; the two are read as one.

## What `build.mjs` checks

For every question: the key, the heading in Part IV and the one choice marked "Correct" name the
same letter; the heading's domain, skill and level are the same in both places; Part IV's copy of
the question reads the same (for Reading and Writing it repeats only the first paragraph). Anything
else stops the run with the question's number.

## What it changes, and why

Nothing is reworded except where listed here. `backend/originals.test.js` then holds the bank to
the file word for word.

- **Skill.** The workbook names a narrow skill ("Slope from two points"); the bank has 29. The
  `SKILLS` table at the top of `build.mjs` places each by hand, inside the domain the workbook
  gives. The workbook's own name is kept in the file as `subskill` (the app doesn't use it). A name
  the table doesn't know stops the run.
- **Math notation**, into the player's (`frontend/src/components/mathLayout.js`): `x^2` → `x²`,
  `x^-1` → `x⁻¹`, `3^(x + 1)` → `3^{x + 1}`, a typed `-` → `−` where it is a minus (a hyphen in
  "x-coordinate" or "45°-45°-90°" stays), `1/2x` → `(1/2)x`, `-12/[2(-2)]` → `−12/(2(−2))`, and the
  PDF's stored `=[` → `≠`.
- **Reading and Writing layout.** The question is the last paragraph, or the first when it is
  printed above a sentence with a blank; a paragraph holding both is cut before the question (the
  run prints each cut). `- ` notes become the player's `• ` list. A table printed as
  `Heading | Heading` lines becomes a real table: it has its headings, so nothing is invented.
  `**word**` loses its asterisks.
- **A question where none is printed.** 16 items are only a sentence with a blank. They get the
  wording `batch3.json` uses: "Which choice completes the text with the most logical transition?"
  or "… so that it conforms to the conventions of Standard English?"
- **"Passage 1 / Passage 2"** (three questions of the second workbook) are named "Text 1 / Text 2",
  in the texts, the question and the reasons, as the bank and the test itself name them; the player
  draws those as labels.
- **Reasons.** "Incorrect — " and "Correct — D is correct: " are dropped (the bank adds "Correct."
  to the right one itself) and what follows starts with a capital when it starts with a word.

## Left out, and put right by hand

- `HELD` (left out, listed in the file under `held` with the reason): workbook 1, Reading and
  Writing 26. The sentence already has a comma after the blank, so the keyed answer ("however,")
  gives two commas and another choice ("however") gives the correct sentence. Taking that comma out
  of the sentence would make the key right; that is the owner's call, and then the entry comes out
  of `HELD`.
- `HAND`: workbook 2, Reading and Writing 44. The goal ("The student wants to emphasize …") is
  printed as a fourth note; it is asked with the question instead.

## Checked by hand when the two workbooks were converted (2026-10-13)

All 100 Math answers were worked again and agree with the key. The Reading and Writing items were
read through; one is arguable rather than wrong and is in the bank: workbook 1, question 38 (`WBRW-138`,
"than the old telescope can" is keyed, and "than the old telescope" is marked wrong as an illogical
comparison, though many readers would accept it).
