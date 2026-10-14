# Question-pack converter

Turns the owner's sorted question PDFs (`SAT_English_sorted_no_ids.zip`, `SAT_Math_sorted_no_ids.zip`,
in the folder above this repo) into `backend/content/pack/questions.json` and the pictures in
`backend/content/pack/media/`. Not part of the app or its build; run it by hand when the pack changes.

```
npm init -y && npm install pdfjs-dist@4.10.38     # in a scratch folder, not in the app
                                                  # (brings @napi-rs/canvas, which draws the pages)
# 1. Unzip every PDF into one folder under a short name, with a manifest.json beside it:
#      [{ "file": "rw_001.pdf", "section": "rw" | "math", "path": "<its path inside the zip>" }, …]
#    (Windows can't unzip the Math pack as it is: some of its folder names are too long.)
# 2. Read the PDFs. `index=` is a folder holding rw_index.csv and math_index.csv from the earlier
#    version of the pack (SAT_*_sorted.zip): every answer is checked against it.
node extract.mjs <pdfDir> <manifest.json> <outDir> index=<indexDir>
node extract.mjs <pdfDir> <manifest.json> <outDir> index=<indexDir> section=rw
# 3. Build the app's files ("check" as a last argument prints the report and writes nothing).
node build.mjs <outDir> <path to backend>
```

`layout.mjs <pdf> <page>` prints one page's text lines and drawn shapes: start there when a page
reads wrongly.

## How the PDFs are read

Every question starts on a new page with a header table, then a bar ("Question"), the question, a
bar ("Answer"), `Correct Answer:`, `Rationale`, the explanation and `Question Difficulty:`.

- **Reading & Writing is read as text.** Paragraphs are found from the line spacing, options from
  the `A.`–`D.` labels, the question is the paragraph just above them and the passage is the rest.
  - Bullet dots are zero-size shapes beside the line they belong to (the notes questions).
  - An underline is a thin filled bar just under a line. It is mapped to characters by measuring the
    text, then stored as a range in the passage.
  - A graph or table is whatever is drawn at the top of the question. It is cropped as a picture,
    and its own lettering is left out of the passage.
  - The explanation font loses "fi" and "fl". They are put back from a dictionary made of the
    questions' own words, with a short list of rules for words that aren't in it (`build.mjs`).
- **Math is kept as pictures**: one of the question (with its choices) and one of the explanation.
  The equations in these PDFs are drawings, not text, so there is nothing to read. Only the answer
  key is text. Older student-produced-response items have no answer line; their key comes from the
  index, or from the first sentence of the explanation.
- The pack's own `4 Challenging` files are the owner's Northstar originals, which are in the app
  already (`backend/content/challenging*.js`); they are skipped.

## Things done by hand (all in `build.mjs`)

- Seven Math answers that exist only as drawn fractions inside the explanation (`HAND_ANSWERS`).
- One Reading & Writing question asks about "the underlined claim" but its page has no underline;
  the claim was placed from what the explanation says about it (`HAND_UNDERLINES`).

## If the pack is converted again

Keys are made from each question's file and page (`qb-…`), so a re-run keeps every student's
progress as long as the PDFs keep their names and order. Pictures are named by their content;
`build.mjs` clears `media/` and copies in only the ones still in use.
