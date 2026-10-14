// What can be worn (drawn in Accessories.jsx). Must match AVATAR_ACCESSORIES in backend/avatars.js.
export const ACCESSORIES = [
  { id: "cap", label: "Graduation cap" },
  { id: "crown", label: "Crown" },
  { id: "shades", label: "Sunglasses" },
  { id: "headphones", label: "Headphones" },
  { id: "bow", label: "Bow tie" }
];
export const ACCESSORY_IDS = ACCESSORIES.map((a) => a.id);
