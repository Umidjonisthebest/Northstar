# Drop-in pictures

A picture saved in this folder under one of the names below replaces the vector drawing for that
slot everywhere it is used. No code change is needed: save the file, and the page shows it
(`components/artPictures.js` finds it). Delete the file and the drawing comes back.

- Format: `.png` or `.webp`, **transparent background**, nothing cropped at the edges.
- Keep each file under about 300 kB (export as WebP at quality 85 if a PNG is larger).
- Check the result on `/dev/art` ("Card and page art", "League crests"), on light and dark ground.

| File name | Where it shows | Canvas | Sits on |
| --- | --- | --- | --- |
| `bank-rw` | Question Bank, Reading & Writing card | 1040 x 800 | pink to violet gradient |
| `bank-math` | Question Bank, Math card | 1040 x 800 | blue to indigo gradient |
| `trail` | Diagnostic pages (SAT and IELTS) | square, 880 or more | the page, light and dark |
| `target` | Home, score card | about square | the page, light and dark |
| `tier-0` ... `tier-4` | League crests: Comet, Nebula, Pulsar, Quasar, Supernova | 512 x 512 | light, dark, and night blue |
| `spot-<name>` | Empty states (`<EmptyArt name />`): checklist, bullseye, chart, calendar, target, trophy, note, bookmark | 180 or more | the page, light and dark |

In use since 2026-10-08 (the owner's pictures): `target`, `trail` and the eight `spot-` files.
`tools/art/generated-cut.mjs` cut them out of their flat grounds.

Notes:

- `trail` is a picture without numbers or a character. The app lays the score labels (or IELTS
  bands) and the 2D Nova over it, at the places in `TRAIL_STOPS` / `TRAIL_STAR` in
  `components/Art.jsx` and `.dg-pic-nova` in `diagnostic.css` (percent of the picture). **A new
  trail picture with the planets, the star or the starting hill somewhere else needs those numbers
  changed**, or the labels will float in the wrong place.
- A new empty-state picture is a file named `spot-<name>` plus `<EmptyArt name="<name>" />` where
  it should show.

## Prompts (Nano Banana)

Attach `_inbox/characters/` art as a reference image where a prompt mentions Nova, so the
character stays the same. Shared style line, added to the end of every prompt:

> Style: soft 3D clay render, rounded chunky shapes, smooth matte plastic with gentle gloss, soft
> studio light from the top left, subtle contact shadows, pastel twilight palette (indigo #4338ca,
> violet #8a5fe6, orchid #b05fd6, sky blue #4f7df3, pink #ff9ecb, warm gold #ffcf5c for stars only).
> No text, no letters, no numbers, no logos, no watermark. Transparent background, the object
> centred with clear space around it, nothing cut off.

**bank-rw** (1040 x 800)

> A small floating still life for a reading and writing study card: an open book with soft
> cream pages, one line on the page marked with a gold highlighter stripe, a chunky pencil with a
> pink eraser leaning on it, a round white speech bubble with a violet quotation mark, and three
> tiny four-point gold stars around. Composition leans to the right half of the canvas, the left
> third is empty.

**bank-math** (1040 x 800)

> A small floating still life for a math study card: a rounded white graph tile showing a blue
> parabola with two gold dots where it crosses the axis, a translucent glass set square, a chunky
> white cube with a blue plus sign, a glass tile with a small curve on it, and three tiny
> four-point gold stars around. Composition leans to the right half of the canvas, the left third
> is empty.

**trail** (1440 x 1040)

> A small rounded mountain with three layered peaks in lilac, violet and sky blue, a soft white
> snow cap, and a dotted path that winds from the bottom left up to the summit past two round
> white milestone markers. A large glowing four-point gold north star floats just above the
> summit. A few tiny stars in the air. No characters. Flat pastel illustration with ink outlines
> and soft grey-lilac washes instead of 3D (this one sits beside a 2D character).

**target** (1200 x 760)

> An archery target on a small rounded hill, rings in indigo and white with a gold centre, one
> arrow with a coral feather in the exact centre, three tiny four-point gold stars around. The
> target stands on the right, the left third is empty.

**tier-0 ... tier-4** (512 x 512 each, one prompt per emblem, same shield every time)

> A league emblem: a rounded shield badge with a thick glossy rim, seen straight on.
> - Comet: sky blue shield, a white comet with three tail streaks in the middle, no trim.
> - Nebula: violet shield, a soft white cloud with three small stars in it, one small gold star on top.
> - Pulsar: orchid pink shield, a white core with two pairs of pulse arcs, a thin tilted orbit ring around the shield, one gold star on top.
> - Quasar: gold shield, a white disc with a tilted ring and two jets, a thin orbit ring, three gold stars on top.
> - Supernova: coral to rose shield, a white eight-point starburst, a crown of gold rays behind the shield, three gold stars on top.
> Each emblem must have the same shield shape, size and camera angle, so the five read as one set.

## Pictures that need a code change after you make them

Send these and they get wired in by hand (they are not slots):

- **Social preview** (1200 x 630, not transparent): "The 3D pink star character with a screen
  face, floating in a deep indigo night sky with small stars and a large blue planet edge at the
  bottom, soft bubbles around her, empty space on the left for a headline." Replaces
  `public/social-preview.png`.
- **App icon** (512 x 512, not transparent): "The 3D pink star character's face only, centred on
  a rounded indigo to violet square." Replaces `public/apple-touch-icon.png`.
- **Profile pictures with transparent backgrounds** (the 30 in `_inbox/avatars/`): "Remove the
  background, keep the character exactly as it is, transparent PNG, 512 x 512." With these, students
  can pick a real background colour instead of only a frame colour.
- **Larger emotion sheet**: the current emotions are about 230 px each and go soft above 120 px on
  sharp screens. "The same character and pose as the reference, 1024 x 1024, transparent
  background", one per emotion. Do not make an angry or sad one.
