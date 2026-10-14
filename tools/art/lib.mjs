import sharp from "sharp";

export async function load(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

export function crop(img, x, y, w, h) {
  x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
  w = Math.min(img.w - x, Math.round(w)); h = Math.min(img.h - y, Math.round(h));
  const out = Buffer.alloc(w * h * 4);
  for (let r = 0; r < h; r++) img.data.copy(out, r * w * 4, ((y + r) * img.w + x) * 4, ((y + r) * img.w + x + w) * 4);
  return { data: out, w, h };
}

const px = (img, i) => [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const median = (arr) => arr.slice().sort((a, b) => a - b)[arr.length >> 1];

// Median colour of the crop's outer ring.
export function borderColor(img, inset = 0) {
  const rs = [], gs = [], bs = [];
  const add = (x, y) => { const p = px(img, y * img.w + x); rs.push(p[0]); gs.push(p[1]); bs.push(p[2]); };
  for (let x = inset; x < img.w - inset; x++) { add(x, inset); add(x, img.h - 1 - inset); }
  for (let y = inset; y < img.h - inset; y++) { add(inset, y); add(img.w - 1 - inset, y); }
  return [median(rs), median(gs), median(bs)];
}

// Runs of rows/cols that contain "ink" (isInk(pixel)), separated by gaps of at least `gap`.
export function runs(img, axis, isInk, gap = 6, minLen = 30, x0 = 0, x1 = null, y0 = 0, y1 = null) {
  x1 ??= img.w; y1 ??= img.h;
  const n = axis === "y" ? y1 - y0 : x1 - x0;
  const has = new Uint8Array(n);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (isInk(px(img, y * img.w + x))) has[axis === "y" ? y - y0 : x - x0] = 1;
  const out = [];
  let start = -1, empty = 0;
  for (let i = 0; i <= n; i++) {
    if (i < n && has[i]) { if (start < 0) start = i; empty = 0; }
    else if (start >= 0) { empty++; if (empty >= gap || i === n) { const end = i - empty + 1; if (end - start >= minLen) out.push([start + (axis === "y" ? y0 : x0), end + (axis === "y" ? y0 : x0)]); start = -1; empty = 0; } }
  }
  return out;
}

// Cut the subject out of a flat background. Returns RGBA with a soft, decontaminated edge.
export function cutout(img, { bg = null, tol = 30, band = 2, extraBg = [] } = {}) {
  const { w, h } = img, n = w * h;
  bg ??= borderColor(img);
  const bgs = [bg, ...extraBg];
  const isBg = (i) => { const p = px(img, i); return bgs.some((b) => dist(p, b) < tol); };
  const mask = new Uint8Array(n); // 1 = background (connected to the border)
  const stack = [];
  const push = (i) => { if (!mask[i] && isBg(i)) { mask[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  // Distance (in steps) of each foreground pixel from the background, up to band+1.
  const d = new Int16Array(n).fill(-1);
  let frontier = [];
  for (let i = 0; i < n; i++) if (mask[i]) d[i] = 0;
  for (let i = 0; i < n; i++) {
    if (mask[i]) continue;
    const x = i % w, y = (i / w) | 0;
    if ((x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w]) || x === 0 || y === 0 || x === w - 1 || y === h - 1) { d[i] = 1; frontier.push(i); }
  }
  for (let step = 2; step <= band + 1; step++) {
    const next = [];
    for (const i of frontier) {
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && d[j] < 0) { d[j] = step; next.push(j); }
    }
    frontier = next;
  }
  // Core = foreground deeper than the band. Spread core colours outward over the band and 2px of background.
  const src = new Int32Array(n).fill(-1);
  let q = [];
  for (let i = 0; i < n; i++) if (!mask[i] && (d[i] < 0 || d[i] > band)) { src[i] = i; }
  for (let i = 0; i < n; i++) {
    if (src[i] !== i) continue;
    const x = i % w, y = (i / w) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && src[j] < 0) { src[j] = i; q.push(j); }
  }
  for (let step = 0; step < band + 3 && q.length; step++) {
    const next = [];
    for (const i of q) {
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && src[j] < 0) { src[j] = src[i]; next.push(j); }
    }
    q = next;
  }
  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const c = px(img, i);
    let a = 255, col = c;
    const inBand = !mask[i] && d[i] > 0 && d[i] <= band;
    const nearBg = mask[i] && src[i] >= 0;
    if (mask[i] && !nearBg) a = 0;
    else if (inBand || nearBg) {
      const s = src[i];
      if (s < 0) a = mask[i] ? 0 : 255; // thin detail with no core: keep as is
      else {
        const F = px(img, s);
        // nearest background reference colour
        let B = bgs[0], bd = Infinity;
        for (const b of bgs) { const dd = dist(c, b); if (dd < bd) { bd = dd; B = b; } }
        const fb = [F[0] - B[0], F[1] - B[1], F[2] - B[2]];
        const len2 = fb[0] * fb[0] + fb[1] * fb[1] + fb[2] * fb[2];
        if (len2 < 40 * 40) a = mask[i] ? 0 : 255;
        else {
          const t = ((c[0] - B[0]) * fb[0] + (c[1] - B[1]) * fb[1] + (c[2] - B[2]) * fb[2]) / len2;
          a = Math.round(255 * Math.max(0, Math.min(1, t)));
          if (mask[i]) a = Math.min(a, 140); // pixels judged background keep only a faint edge
          if (a < 250) col = F;
        }
      }
    }
    out[i * 4] = col[0]; out[i * 4 + 1] = col[1]; out[i * 4 + 2] = col[2]; out[i * 4 + 3] = a;
  }
  return { data: out, w, h };
}

// Drop opaque islands smaller than `min` pixels (JPEG specks), keep everything else.
export function despeckle(img, min = 12) {
  const { w, h } = img, n = w * h, seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (seen[i] || img.data[i * 4 + 3] < 40) continue;
    const comp = [i]; seen[i] = 1;
    for (let k = 0; k < comp.length; k++) {
      const c = comp[k], x = c % w, y = (c / w) | 0;
      for (const j of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1]) if (j >= 0 && !seen[j] && img.data[j * 4 + 3] >= 40) { seen[j] = 1; comp.push(j); }
    }
    if (comp.length < min) for (const c of comp) img.data[c * 4 + 3] = 0;
  }
  return img;
}

export function bbox(img, test) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (test(img, (y * img.w + x))) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// The face: the dark navy screen frame. Largest connected blob of dark, bluish, opaque pixels.
export function faceBox(img) {
  const { w, h } = img, n = w * h, seen = new Uint8Array(n);
  const dark = (i) => { const r = img.data[i * 4], g = img.data[i * 4 + 1], b = img.data[i * 4 + 2], a = img.data[i * 4 + 3]; return a > 200 && r < 85 && g < 80 && b < 125 && b >= r - 8; };
  let best = null;
  for (let i = 0; i < n; i++) {
    if (seen[i] || !dark(i)) continue;
    const comp = [i]; seen[i] = 1; let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let k = 0; k < comp.length; k++) {
      const c = comp[k], x = c % w, y = (c / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1]) if (j >= 0 && !seen[j] && dark(j)) { seen[j] = 1; comp.push(j); }
    }
    const area = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (!best || area > best.area) best = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, area, count: comp.length };
  }
  return best;
}

// Place the trimmed subject on a transparent square with a margin; returns sharp + the transform.
export function squareOf(img, { margin = 0.06, box = null } = {}) {
  const b = box || bbox(img, (im, i) => im.data[i * 4 + 3] > 16);
  const side = Math.round(Math.max(b.w, b.h) * (1 + margin * 2));
  const ox = Math.round((side - b.w) / 2) - b.x, oy = Math.round((side - b.h) / 2) - b.y;
  const out = Buffer.alloc(side * side * 4);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const tx = x + ox, ty = y + oy;
    if (tx < 0 || ty < 0 || tx >= side || ty >= side) continue;
    img.data.copy(out, (ty * side + tx) * 4, (y * img.w + x) * 4, (y * img.w + x) * 4 + 4);
  }
  return { data: out, side, ox, oy };
}

export const toSharp = (data, w, h) => sharp(data, { raw: { width: w, height: h, channels: 4 } });
