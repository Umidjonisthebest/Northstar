// The Northstar sky: turns the server's day marks (progress.sky) into stars
// and constellations and places them in a tile. Pure functions, no React.

const KIND = { 1: "lit", r: "repaired", 0: "missed", t: "today" };

export const TILE = { w: 200, h: 140 };
const MAX_DIM = 36; // dim stars drawn in one tile; the text always gives the full count

// What each kind of star is called, wherever the sky is described in words.
export const STAR_LABEL = { lit: "Studied", repaired: "Repaired", missed: "Day off", today: "Today, not lit yet" };

function addDays(key, n) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "2026-09-25" -> "Sep 25" (or "Fri, Sep 25")
export function dayLabel(key, weekday = false) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { ...(weekday ? { weekday: "short" } : {}), month: "short", day: "numeric", timeZone: "UTC" });
}

// One entry per day from the first star to today: { date, kind }.
export function skyDays(sky) {
  if (!sky?.start) return [];
  return [...sky.marks].map((m, i) => ({ date: addDays(sky.start, i), kind: KIND[m] || "missed" }));
}

// Every `per` lit stars make one constellation. Days off sit in the
// constellation that was forming at the time, as dim stars. The last entry is
// the one still forming (it may have no stars yet).
export function constellationsOf(sky) {
  const per = sky?.perConstellation || 7;
  const list = [];
  let cur = null;
  const open = () => {
    cur = { index: list.length, per, stars: [], dim: [], pending: null, complete: false };
  };
  open();
  for (const day of skyDays(sky)) {
    if (day.kind === "lit" || day.kind === "repaired") {
      cur.stars.push(day);
      if (cur.stars.length === per) {
        cur.complete = true;
        list.push(cur);
        open();
      }
    } else if (day.kind === "today") cur.pending = day;
    else cur.dim.push(day);
  }
  list.push(cur);
  return list;
}

// Seven points on a 0–1 grid and the lines between them. These are abstract
// shapes, not real constellations, so they are numbered rather than named.
const CHAIN = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]];
const SHAPES = [
  { pts: [[0.08, 0.34], [0.24, 0.24], [0.4, 0.3], [0.54, 0.44], [0.58, 0.74], [0.84, 0.78], [0.88, 0.48]], edges: [...CHAIN, [6, 3]] },
  { pts: [[0.08, 0.68], [0.22, 0.3], [0.38, 0.62], [0.52, 0.24], [0.66, 0.6], [0.8, 0.28], [0.92, 0.66]], edges: CHAIN },
  { pts: [[0.3, 0.24], [0.52, 0.14], [0.62, 0.36], [0.4, 0.46], [0.52, 0.66], [0.68, 0.78], [0.88, 0.84]], edges: [...CHAIN, [3, 0]] },
  { pts: [[0.08, 0.38], [0.2, 0.6], [0.36, 0.76], [0.54, 0.8], [0.72, 0.72], [0.86, 0.56], [0.94, 0.34]], edges: CHAIN },
  { pts: [[0.1, 0.54], [0.3, 0.5], [0.5, 0.48], [0.7, 0.46], [0.9, 0.42], [0.46, 0.18], [0.54, 0.82]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [2, 6]] },
  { pts: [[0.2, 0.72], [0.2, 0.4], [0.42, 0.18], [0.66, 0.32], [0.86, 0.22], [0.82, 0.64], [0.52, 0.82]], edges: [...CHAIN, [6, 0]] }
];

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function random(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Where everything in one constellation goes, in tile coordinates. The same
// days always land in the same places.
export function layout(c) {
  const shape = SHAPES[c.index % SHAPES.length];
  const at = ([x, y]) => ({ x: Math.round(x * TILE.w), y: Math.round(y * TILE.h) });
  const pts = shape.pts.slice(0, c.per).map(at);
  const lit = c.stars.length;
  const dimShown = c.dim.slice(-MAX_DIM);
  return {
    stars: c.stars.map((s, i) => ({ ...s, ...pts[i] })),
    // Places still to fill, the first of which is today's when today isn't lit yet.
    slots: pts.slice(lit + (c.pending ? 1 : 0)),
    pending: c.pending && pts[lit] ? { ...c.pending, ...pts[lit] } : null,
    lines: shape.edges.filter(([a, b]) => a < lit && b < lit).map(([a, b]) => ({ x1: pts[a].x, y1: pts[a].y, x2: pts[b].x, y2: pts[b].y })),
    dim: dimShown.map((d) => {
      // A spot away from the constellation's own stars.
      const next = random(hash(d.date));
      let spot = null;
      for (let tries = 0; tries < 8; tries++) {
        spot = { x: Math.round((0.05 + next() * 0.9) * TILE.w), y: Math.round((0.07 + next() * 0.86) * TILE.h) };
        if (pts.every((p) => Math.hypot(p.x - spot.x, p.y - spot.y) > 17)) break;
      }
      return { ...d, ...spot };
    })
  };
}

// One sentence for a constellation, used as its text alternative.
export function describeConstellation(c) {
  const lit = c.stars.length;
  const repaired = c.stars.filter((s) => s.kind === "repaired").length;
  const parts = [];
  if (c.complete) parts.push(`complete, ${lit} stars lit from ${dayLabel(c.stars[0].date)} to ${dayLabel(c.stars[lit - 1].date)}`);
  else if (lit) parts.push(`${lit} of ${c.per} stars lit since ${dayLabel(c.stars[0].date)}`);
  else parts.push(`no stars yet, ${c.per} to go`);
  if (repaired) parts.push(`${repaired} repaired`);
  if (c.dim.length) parts.push(`${c.dim.length} dim star${c.dim.length === 1 ? "" : "s"} for days off`);
  if (c.pending) parts.push("today's star isn't lit yet");
  return `Constellation ${c.index + 1}: ${parts.join(", ")}.`;
}

// The whole sky in one sentence.
export function describeSky(sky, streak) {
  if (!sky?.start) return "Your sky has no stars yet. The first day you study lights the first one.";
  const left = sky.perConstellation - sky.toward;
  return [
    `${sky.lit} star${sky.lit === 1 ? "" : "s"} lit`,
    `${sky.constellations} constellation${sky.constellations === 1 ? "" : "s"} complete`,
    `${left} more star${left === 1 ? "" : "s"} to complete the next one`,
    ...(sky.repaired ? [`${sky.repaired} repaired`] : []),
    ...(sky.missed ? [`${sky.missed} dim star${sky.missed === 1 ? "" : "s"} for days off`] : []),
    ...(streak ? [`current streak ${streak.current} day${streak.current === 1 ? "" : "s"}, best ${streak.longest}`] : [])
  ].join(", ") + ".";
}
