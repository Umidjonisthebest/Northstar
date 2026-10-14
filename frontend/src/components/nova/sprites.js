// Nova's artwork (the owner's character sheet, cut out and exported as WebP) and where the
// face sits in each picture. `face` is the dark screen frame as {x, y, w, h} in the 0..100 box the
// picture is drawn in; accessories (Accessories.jsx) are placed from it, so they line up on every
// pose. `tilt` is the head's lean in degrees for the pictures drawn at an angle.
//
// The sheet also has an angry face. It is deliberately not used anywhere: Nova never looks cross.
import happy from "../../assets/nova/nova-happy.webp";
import thinking from "../../assets/nova/nova-thinking.webp";
import cheer from "../../assets/nova/nova-cheer.webp";
import surprised from "../../assets/nova/nova-surprised.webp";
import calm from "../../assets/nova/nova-calm.webp";
import dim from "../../assets/nova/nova-dim.webp";
import proud from "../../assets/nova/nova-proud.webp";
// Second sheet (nova-emotions-2.png). Its "Focused" pose frowns, so it is not used either;
// "Determined" (a confident smirk) stands for focus instead.
import wink from "../../assets/nova/nova-wink.webp";
import wave from "../../assets/nova/nova-wave.webp";
import excited from "../../assets/nova/nova-excited.webp";
import puzzled from "../../assets/nova/nova-puzzled.webp";
import laugh from "../../assets/nova/nova-laugh.webp";
import determined from "../../assets/nova/nova-determined.webp";
import serene from "../../assets/nova/nova-serene.webp";
import moon from "../../assets/nova/friend-moon.webp";
import comet from "../../assets/nova/friend-comet.webp";
import planet from "../../assets/nova/friend-planet.webp";
import cloud from "../../assets/nova/friend-cloud.webp";
import ember from "../../assets/nova/friend-ember.webp";
import sunny from "../../assets/nova/friend-sunny.webp";
import nova3d from "../../assets/nova/nova-3d.webp";

export const NOVA_SPRITES = {
  happy: { src: happy, face: { x: 28.1, y: 38.3, w: 46.4, h: 34.9 } },
  thinking: { src: thinking, face: { x: 27.4, y: 37.2, w: 47, h: 35.9 } },
  cheer: { src: cheer, face: { x: 29.6, y: 40.1, w: 39.8, h: 29.6 } },
  surprised: { src: surprised, face: { x: 25.8, y: 39.3, w: 47.2, h: 34.9 } },
  calm: { src: calm, face: { x: 27.9, y: 36.7, w: 45.4, h: 33.3 } },
  dim: { src: dim, face: { x: 27.6, y: 36, w: 45.2, h: 33.5 } },
  proud: { src: proud, face: { x: 33.2, y: 31.1, w: 41.8, h: 30.3 }, tilt: 6 },
  wink: { src: wink, face: { x: 28.5, y: 36.6, w: 45.7, h: 34.9 } },
  wave: { src: wave, face: { x: 35.4, y: 38.9, w: 42.4, h: 31.8 } },
  excited: { src: excited, face: { x: 30.3, y: 38.4, w: 41.9, h: 31.8 } },
  puzzled: { src: puzzled, face: { x: 26.1, y: 37.8, w: 46.7, h: 35.6 } },
  laugh: { src: laugh, face: { x: 27.4, y: 33.7, w: 45.3, h: 38.4 }, tilt: 9 },
  determined: { src: determined, face: { x: 28.1, y: 37.8, w: 44.3, h: 33.5 } },
  serene: { src: serene, face: { x: 26.7, y: 38.6, w: 46.6, h: 34.7 } }
};

// Every mood the app may ask for, and the picture that shows it. With both sheets every mood now
// has its own picture. A wrong answer gets the puzzled "hmm?", never a sad or angry face.
// "sleep" is the old name for "sleepy" and still works.
export const MOOD_SPRITE = {
  happy: "happy",
  wave: "wave",
  thinking: "thinking",
  explain: "surprised", // one arm up, pointing at a star
  cheer: "cheer",
  excited: "excited",
  laugh: "laugh",
  proud: "proud",
  wink: "wink",
  oops: "puzzled",
  surprised: "surprised",
  focused: "determined",
  calm: "calm",
  sleepy: "serene",
  sleep: "serene",
  dim: "dim"
};

// Nova's friends: separate characters, supporting cast only. Each `tone` other than "sun" (Nova
// herself) shows one of them. A friend has one picture, so `mood` doesn't change it.
export const FRIEND_SPRITES = {
  sky: { src: moon, face: { x: 38.9, y: 43.7, w: 40.1, h: 30.6 }, name: "Luna" },
  mint: { src: comet, face: { x: 49.6, y: 35.3, w: 40.1, h: 32 }, tilt: -8, name: "Comet" },
  lilac: { src: planet, face: { x: 29.8, y: 36.1, w: 41.1, h: 32.1 }, tilt: 8, name: "Orbit" },
  rose: { src: cloud, face: { x: 29.4, y: 36.3, w: 41.6, h: 33.2 }, name: "Nimbus" },
  peach: { src: ember, face: { x: 47.1, y: 36.1, w: 40.1, h: 31.8 }, tilt: 4, name: "Ember" },
  gold: { src: sunny, face: { x: 29.5, y: 35.2, w: 41, h: 33 }, name: "Sunny" }
};

// The 3D Nova: big moments only (the cover page hero, sign-up). Never next to the 2D pictures.
export const NOVA_3D = { src: nova3d, face: { x: 19.1, y: 31.8, w: 52.5, h: 47.4 } };

export function spriteFor(mood, tone) {
  if (tone && tone !== "sun" && FRIEND_SPRITES[tone]) return FRIEND_SPRITES[tone];
  return NOVA_SPRITES[MOOD_SPRITE[mood] || "happy"];
}
