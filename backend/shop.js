// Comet chunks: the currency a student spends. It is separate from XP on purpose. XP measures
// what has been learned (it sets the level and the league place) and is never spent; comet chunks
// are earned at milestones and spent on messages to Nova on the Ask Nova page and on things for the
// profile picture in the Comet Shop.
//
// The wallet lives on the student's progress record:
//   p.wallet = { chunks, owned: [shop item id], log: [{ at, n, why }] }   (log newest first)
// gamification.js opens it (getProgress) and pays into it (award). Nothing here imports
// gamification.js, so that file can import this one.

// Every amount, in one place.
export const CHUNKS = {
  novaMessage: 1, // each message to Nova on the Ask Nova page (Nova beside a question is free)
  starter: 15, // what every account starts with
  firstStudy: 2, // the first graded work of the day (the one that lights today's star)
  dailyGoal: 5, // reaching the daily XP goal
  dailyStar: 3, // discovering the daily star
  levelUp: 10, // each new level
  trophy: 5, // each new trophy
  ieltsSection: 3, // a section of an IELTS practice test (Listening, Reading or Writing), the first time it is finished properly
  ieltsTest: 10 // all three sections of one IELTS practice test, once per test
};

// What the shop sells. `kind` and `value` name a part of the profile picture (avatars.js): a part
// that is listed here has to be bought before it can be worn, and every other part is free. So a
// new line here is all it takes to put something on sale, a character (`kind: "avatar"`) included.
// The names of the things to wear match the picker's (frontend components/nova/accessoryList.js).
export const SHOP = [
  { id: "acc:cap", kind: "accessory", value: "cap", name: "Graduation cap", price: 15 },
  { id: "acc:bow", kind: "accessory", value: "bow", name: "Bow tie", price: 15 },
  { id: "acc:headphones", kind: "accessory", value: "headphones", name: "Headphones", price: 25 },
  { id: "acc:shades", kind: "accessory", value: "shades", name: "Sunglasses", price: 25 },
  { id: "acc:crown", kind: "accessory", value: "crown", name: "Crown", price: 40 },
  { id: "frame:dawn", kind: "frame", value: "dawn", name: "Dawn frame", price: 20 },
  { id: "frame:aurora", kind: "frame", value: "aurora", name: "Aurora frame", price: 20 },
  { id: "frame:comet", kind: "frame", value: "comet", name: "Comet frame", price: 30 },
  { id: "frame:nebula", kind: "frame", value: "nebula", name: "Nebula frame", price: 30 },
  { id: "frame:starlight", kind: "frame", value: "starlight", name: "Starlight frame", price: 35 },
  { id: "frame:galaxy", kind: "frame", value: "galaxy", name: "Galaxy frame", price: 45 }
];
const ITEM_BY_ID = Object.fromEntries(SHOP.map((i) => [i.id, i]));

const LOG_KEEP = 30;

// The shop items that make up a profile picture ({ id, accessory, frame } or null).
function itemsIn(avatar) {
  if (!avatar) return [];
  const parts = { avatar: avatar.id, accessory: avatar.accessory, frame: avatar.frame };
  return SHOP.filter((i) => parts[i.kind] === i.value);
}

// A new wallet. `earned` is what the account has already earned by the rules above (levels and
// trophies from before chunks existed); what the student is wearing today stays theirs.
export function openWallet({ earned = 0, avatar = null } = {}, now = new Date()) {
  const chunks = CHUNKS.starter + earned;
  return { chunks, owned: itemsIn(avatar).map((i) => i.id), log: [{ at: now.toISOString(), n: chunks, why: "Your first comet chunks" }] };
}

function note(wallet, n, why, now) {
  const at = now.toISOString();
  const last = wallet.log[0];
  // The same thing again on the same day is one line ("Messages to Nova −6"), not six.
  if (last && last.why === why && last.at.slice(0, 10) === at.slice(0, 10)) {
    last.n += n;
    last.at = at;
    if (last.n === 0) wallet.log.shift(); // a refund cancels the line it refunds
  } else {
    wallet.log.unshift({ at, n, why });
    wallet.log.length = Math.min(wallet.log.length, LOG_KEEP);
  }
}

// Pays `n` chunks in. Returns what was paid.
export function giveChunks(p, n, why, now = new Date()) {
  if (!(n > 0)) return 0;
  p.wallet.chunks += n;
  note(p.wallet, n, why, now);
  return n;
}

// Takes `n` chunks out, or returns false (and takes nothing) when there aren't enough.
export function spendChunks(p, n, why, now = new Date()) {
  if (p.wallet.chunks < n) return false;
  p.wallet.chunks -= n;
  note(p.wallet, -n, why, now);
  return true;
}

// Buys a shop item. Returns { item } or { error, code }.
export function buyItem(p, id, now = new Date()) {
  const item = ITEM_BY_ID[id];
  if (!item) return { error: "That isn't in the shop", code: 404 };
  if (p.wallet.owned.includes(item.id)) return { error: "You already have this", code: 409 };
  if (!spendChunks(p, item.price, `Bought: ${item.name}`, now)) {
    const short = item.price - p.wallet.chunks;
    return { error: `You need ${short} more comet chunk${short === 1 ? "" : "s"} for this`, code: 402 };
  }
  p.wallet.owned.push(item.id);
  return { item };
}

// The first part of a profile picture that is on sale and not bought yet, or null when the
// student may wear all of it.
export function lockedPart(p, avatar) {
  return itemsIn(avatar).find((i) => !p.wallet.owned.includes(i.id)) || null;
}

// What every page needs: the balance, what is owned, the catalogue and the cost of a message.
export function walletView(p) {
  return { balance: p.wallet.chunks, owned: [...p.wallet.owned], novaCost: CHUNKS.novaMessage, items: SHOP };
}

// How chunks are earned and spent, for the shop page, so the copy follows the rules.
export function chunkGuide() {
  return {
    earn: [
      [CHUNKS.firstStudy, "the first thing you study each day"],
      [CHUNKS.dailyGoal, "reaching your daily XP goal"],
      [CHUNKS.dailyStar, "discovering the daily star"],
      [CHUNKS.levelUp, "each new level"],
      [CHUNKS.trophy, "each new trophy"],
      [CHUNKS.ieltsSection, "each section of an IELTS practice test, the first time you finish it"],
      [CHUNKS.ieltsTest, "finishing all three sections of an IELTS practice test"]
    ].map(([chunks, label]) => ({ chunks, label })),
    spend: [
      { chunks: CHUNKS.novaMessage, label: "each message on the Ask Nova page" },
      { chunks: Math.min(...SHOP.map((i) => i.price)), label: "and up: things to wear and frames in this shop", from: true }
    ]
  };
}
