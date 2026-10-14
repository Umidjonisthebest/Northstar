# Character art pipeline

Turns the owner's character sheets (`../../_inbox/characters`, `../../_inbox/avatars`) into the
WebP files the app ships. Not part of the app or its build; run it by hand when the art changes.

```
npm init -y && npm install sharp      # in a scratch folder, not in the app
node emotions.mjs                     # nova-emotions.jpg -> 8 cut-outs + out/sheet-emotions.png
node rest.mjs all                     # friends, the 3D master, the 30 avatar tiles + contact sheets
node export.mjs                       # WebP into frontend/src/assets/nova, frontend/public/avatars,
                                      # backend/assets/avatars; prints each picture's face box
```

- The scripts were written against a temp folder: change `IMG` at the top of each to the `_inbox`
  files (`12.jpg` = nova-emotions, `13.jpg` = nova-friends, `11.jpg` = nova-master-3d,
  `9.jpg`/`10.jpg` = the two avatar sheets).
- Look at the contact sheets in `out/` on light, dark and coloured grounds before exporting. A
  halo or a bitten edge means the source needs to be better, not that the tolerance needs tuning.
- `export.mjs` prints the face boxes. Paste changed ones into
  `frontend/src/components/nova/sprites.js` and `frontend/src/components/avatar/avatars.js`, then
  check `/dev/art` in a development build: every accessory on every picture.
- Flat 2D art on a plain ground cuts out cleanly with `cutout()` (flood fill from the border, then
  a 2px edge whose colour is taken from the nearest interior pixel). The 3D avatars do not: several
  are the same colour as their tile. A matting model (BiRefNet) did better but still lost parts, so
  they ship on their tiles. Transparent PNGs from the artist would fix that.
