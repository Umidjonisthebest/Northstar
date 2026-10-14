// The 30 profile pictures (the owner's 3D character art, public/avatars/NN.webp) and where each
// one's face is, so what it wears lines up. `face` is the screen frame in the picture's 0..100
// box; `tilt` leans the accessory with heads drawn at an angle. The ids, accessories and frames
// must match backend/avatars.js.
//
// The pictures are shown on the coloured tile they were drawn on. They could not be cut out
// cleanly (several characters are the same colour as their tile), so a student changes the frame
// around the picture, not the colour behind the character.
export const AVATARS = [
  { id: "01", label: "Moon with a pillow", face: { x: 49.5, y: 34.4, w: 34.4, h: 28.1 }, tilt: 4 },
  { id: "02", label: "Ringed planet", face: { x: 27.6, y: 32.8, w: 45.3, h: 38 }, tilt: -6 },
  { id: "03", label: "Comet", face: { x: 12, y: 43.8, w: 47.4, h: 39.6 }, tilt: 8 },
  { id: "04", label: "Sun", face: { x: 27.1, y: 32.8, w: 45.8, h: 35.9 } },
  { id: "05", label: "Night buddy", face: { x: 27.1, y: 32.8, w: 46.4, h: 37 } },
  { id: "06", label: "Rocket", face: { x: 34.4, y: 29.7, w: 39.1, h: 34.4 }, tilt: 14 },
  { id: "07", label: "Satellite", face: { x: 30.7, y: 37, w: 36.5, h: 33.9 }, tilt: 12 },
  { id: "08", label: "Cloud", face: { x: 25.5, y: 37, w: 50, h: 39.6 } },
  { id: "09", label: "Shy cloud", face: { x: 25, y: 33, w: 50, h: 38 } },
  { id: "10", label: "Asteroid", face: { x: 25, y: 36.5, w: 50, h: 41.7 } },
  { id: "11", label: "Cube", face: { x: 25.5, y: 34.9, w: 51.6, h: 41.1 } },
  { id: "12", label: "Star", face: { x: 26.6, y: 32.8, w: 47.4, h: 37 } },
  { id: "13", label: "Asteroid with a trophy", face: { x: 27.1, y: 32.8, w: 46.9, h: 39.1 } },
  { id: "14", label: "Galaxy", face: { x: 25.5, y: 33.9, w: 46.9, h: 36.5 } },
  { id: "15", label: "Aurora", face: { x: 28.1, y: 32.3, w: 46.4, h: 35.4 } },
  { id: "16", label: "Writer with a pencil", face: { x: 25, y: 32.3, w: 50, h: 42.7 } },
  { id: "17", label: "Astronaut", face: { x: 32, y: 35, w: 37, h: 31 } },
  { id: "18", label: "Curious alien", face: { x: 27.6, y: 32.8, w: 45.8, h: 36.5 } },
  { id: "19", label: "Telescope", face: { x: 27.1, y: 30.7, w: 41.7, h: 38 }, tilt: -14 },
  { id: "20", label: "Flying book", face: { x: 29.7, y: 42.7, w: 40.6, h: 31.8 } },
  { id: "21", label: "Lilac owl", face: { x: 25, y: 31.3, w: 51, h: 40.1 } },
  { id: "22", label: "Mint owl", face: { x: 26, y: 28.1, w: 50, h: 38.5 } },
  { id: "23", label: "Light bulb", face: { x: 28.6, y: 29.7, w: 42.7, h: 33.3 } },
  { id: "24", label: "Blue hourglass", face: { x: 32.3, y: 26, w: 35.9, h: 27.6 } },
  { id: "25", label: "Sand hourglass", face: { x: 31.3, y: 24.5, w: 35.9, h: 27.1 } },
  { id: "26", label: "Determined buddy", face: { x: 25.5, y: 32.8, w: 49.5, h: 38.5 } },
  { id: "27", label: "Sunny buddy", face: { x: 27.6, y: 31.8, w: 44.8, h: 34.9 } },
  { id: "28", label: "Hourglass", face: { x: 32.8, y: 25, w: 35.9, h: 26.6 } },
  { id: "29", label: "Calculator", face: { x: 25, y: 21.4, w: 49.5, h: 27.1 } },
  { id: "30", label: "Paper plane", face: { x: 27.1, y: 31.3, w: 30.2, h: 26.6 }, tilt: 10 }
];
export const AVATAR_BY_ID = Object.fromEntries(AVATARS.map((a) => [a.id, a]));
export const avatarSrc = (id) => `/avatars/${id}.webp`;

// The ring around a picture. `css` is any CSS background. Dawn and the frames after it are sold
// in the Comet Shop, as are the things to wear (backend/shop.js decides; see shopParts.js).
export const AVATAR_FRAMES = [
  { id: "none", label: "No frame", css: "transparent" },
  { id: "sky", label: "Sky blue", css: "#1664e2" },
  { id: "coral", label: "Coral", css: "#ff7a6b" },
  { id: "gold", label: "Gold", css: "#f5b93a" },
  { id: "mint", label: "Mint", css: "#3fc9b0" },
  { id: "lilac", label: "Lilac", css: "#a48bf5" },
  { id: "rose", label: "Rose", css: "#f07fb7" },
  { id: "night", label: "Night", css: "#25224f" },
  { id: "dawn", label: "Dawn", css: "linear-gradient(135deg, #ff7a6b, #f5b93a)" },
  { id: "aurora", label: "Aurora", css: "linear-gradient(135deg, #3fc9b0, #a48bf5)" },
  { id: "comet", label: "Comet", css: "linear-gradient(135deg, #1c9ff0, #e8f6ff 48%, #8a5fe6)" },
  { id: "nebula", label: "Nebula", css: "linear-gradient(135deg, #f07fb7, #8a5fe6 55%, #1664e2)" },
  { id: "starlight", label: "Starlight", css: "linear-gradient(135deg, #f5b93a, #fff3c4 50%, #f5b93a)" },
  { id: "galaxy", label: "Galaxy", css: "conic-gradient(from 210deg, #1664e2, #a48bf5, #f07fb7, #f5b93a, #3fc9b0, #1664e2)" }
];
export const FRAME_BY_ID = Object.fromEntries(AVATAR_FRAMES.map((f) => [f.id, f]));
