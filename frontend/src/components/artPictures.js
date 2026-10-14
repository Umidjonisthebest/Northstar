// Drop-in pictures. A file in src/assets/art/ named after a slot (bank-rw, bank-math, trail,
// target, tier-0 ... tier-4; .webp or .png, transparent background) replaces the vector drawing
// for that slot everywhere it is used. With no file, the drawing in Art.jsx / Tier.jsx is shown.
// See src/assets/art/README.md for sizes and the prompts the pictures were written for.
const PICTURES = import.meta.glob("../assets/art/*.{webp,png}", { eager: true, query: "?url", import: "default" });

export const artPicture = (slot) => PICTURES[`../assets/art/${slot}.webp`] || PICTURES[`../assets/art/${slot}.png`] || null;
