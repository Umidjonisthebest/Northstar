// Profile pictures. A student's choice is stored on the user as
//   avatar: { id: "01".."30", accessory: null | "cap" | ..., frame: "none" | "sky" | ... }
// The pictures themselves are the owner's 3D character art: frontend/public/avatars/NN.webp for the
// pages, and the same files in backend/assets/avatars/ for the recap share image (recap.js), which
// is drawn on the server. The lists here must match frontend/src/components/avatar/avatars.js.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AVATAR_IDS = Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, "0"));
export const AVATAR_ACCESSORIES = ["cap", "crown", "shades", "headphones", "bow"];
// Some accessories and frames are sold in the Comet Shop (shop.js): the route that saves a picture
// checks that the student owns what it wears.
export const AVATAR_FRAMES = ["none", "sky", "coral", "gold", "mint", "lilac", "rose", "night", "dawn", "aurora", "comet", "nebula", "starlight", "galaxy"];

// Request bodies are untrusted: anything that isn't one of the known values is dropped, never stored.
// Returns the cleaned choice, or null for "no picture" (the initials are shown).
export function cleanAvatar(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (typeof input.id !== "string" || !AVATAR_IDS.includes(input.id)) return null;
  return {
    id: input.id,
    accessory: AVATAR_ACCESSORIES.includes(input.accessory) ? input.accessory : null,
    frame: AVATAR_FRAMES.includes(input.frame) ? input.frame : "none"
  };
}

// What other screens may show of a stored choice (re-checked, in case the lists changed since).
export const publicAvatar = (user) => cleanAvatar(user?.avatar);

// The picture as a data URI, for embedding in a server-drawn SVG. Null when the file isn't there.
const cache = new Map();
export function avatarDataUri(id) {
  if (!AVATAR_IDS.includes(id)) return null;
  if (!cache.has(id)) {
    try {
      cache.set(id, `data:image/webp;base64,${fs.readFileSync(path.join(__dirname, "assets", "avatars", `${id}.webp`)).toString("base64")}`);
    } catch {
      cache.set(id, null);
    }
  }
  return cache.get(id);
}
