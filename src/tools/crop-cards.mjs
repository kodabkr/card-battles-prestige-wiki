// Crops card screenshots down to just the card (inside its grey frame).
//
//   node src/tools/crop-cards.mjs <input folder> <output folder>
//
// Each screenshot shows the card on the left with a 5 px frame of exactly
// rgb(108,108,108). This finds that frame (the longest vertical and horizontal
// runs of that grey), then saves the inside of it, trimmed a few pixels more so
// no frame or rounded corner is left. The text labels on the card are kept.
// Originals are never changed. A report (crop-report.json) lists every crop and
// any screenshot it could not handle.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [inDir, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!inDir || !outDir) {
  console.error('Usage: node src/tools/crop-cards.mjs <input folder> <output folder>');
  process.exit(1);
}

const FRAME = 108; // the frame grey
const TOL = 3;
const RATIO = 1.428; // card interior height / width
const MIN_RUN = 120; // shortest frame side worth considering (px)

function isFrame(d, i) {
  return Math.abs(d[i] - FRAME) <= TOL && Math.abs(d[i + 1] - FRAME) <= TOL && Math.abs(d[i + 2] - FRAME) <= TOL;
}

// Longest run of frame pixels per column (or row), with where that run starts.
function runsAlong(d, w, h, vertical, from = 0, to = vertical ? h : w) {
  const n = vertical ? w : h;
  const out = [];
  for (let a = 0; a < n; a++) {
    let cur = 0, best = 0, bestEnd = -1;
    for (let b = from; b < to; b++) {
      const i = vertical ? (b * w + a) * 4 : (a * w + b) * 4;
      if (isFrame(d, i)) {
        cur++;
        if (cur > best) { best = cur; bestEnd = b; }
      } else cur = 0;
    }
    out.push({ len: best, start: bestEnd - best + 1, end: bestEnd });
  }
  return out;
}

// Group neighbouring lines whose run passes the threshold into bands.
function bands(runs, min) {
  const out = [];
  let cur = null;
  runs.forEach((r, i) => {
    if (r.len >= min) {
      if (cur && cur.to === i - 1) { cur.to = i; cur.len = Math.max(cur.len, r.len); cur.start = Math.min(cur.start, r.start); cur.end = Math.max(cur.end, r.end); }
      else out.push((cur = { from: i, to: i, len: r.len, start: r.start, end: r.end }));
    }
  });
  return out;
}

// Only one side of the frame is on screen (the card runs off the left or right
// edge). Use the top and bottom edges to work out where the other side is.
function oneSided(data, w, h, vb) {
  const side = [...vb].sort((a, b) => b.len - a.len)[0];
  if (!side || side.len < 250) return { ok: false, reason: 'could not find the card frame' };
  const thick = side.to - side.from + 1;
  for (const dir of ['left', 'right']) {
    const x0 = dir === 'left' ? 0 : side.from;
    const x1 = dir === 'left' ? side.to + 1 : w;
    const hb = bands(runsAlong(data, w, h, false, x0, x1), 150);
    const top = hb.find((b) => Math.abs(b.from - side.start) <= thick + 3);
    const bot = [...hb].reverse().find((b) => Math.abs(b.to - side.end) <= thick + 3 && b !== top);
    if (!top || !bot) continue;
    const inH = bot.from - top.to - 1;
    const inW = Math.round(inH / RATIO);
    const inset = Math.max(1, Math.round(inW * 0.007));
    let left = dir === 'left' ? side.from - inW : side.to + 1;
    const notes = [`${dir === 'left' ? 'left' : 'right'} edge of card is off-screen`];
    if (left < 0) left = 0;
    const right = Math.min(w, dir === 'left' ? side.from : side.to + 1 + inW);
    const box = { left: left + (dir === 'right' ? inset : 0), top: top.to + 1 + inset, width: right - left - inset, height: inH - inset * 2 };
    const missing = inW - (right - left);
    if (missing > 20) notes.push(`about ${missing}px of the card's width is missing from the screenshot`);
    return { ok: true, box, notes, scale: +(inW / 446).toFixed(2) };
  }
  return { ok: false, reason: 'only one side of the frame is visible and its top/bottom could not be found' };
}

async function cropOne(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  // Sides: the pair of vertical frame bands with the longest matching runs.
  const vb = bands(runsAlong(data, w, h, true), MIN_RUN);
  let pair = null, score = 0;
  for (let a = 0; a < vb.length; a++)
    for (let b = a + 1; b < vb.length; b++) {
      const L = vb[a], R = vb[b];
      const inner = R.from - L.to - 1;
      if (inner < 150) continue;
      const same = Math.min(L.len, R.len) / Math.max(L.len, R.len);
      const sc = Math.min(L.len, R.len);
      if (same > 0.8 && Math.min(L.len, R.len) <= inner * RATIO * 1.15 + 20 && sc > score) { pair = [L, R]; score = sc; }
    }
  if (!pair) return oneSided(data, w, h, vb);
  const [L, R] = pair;
  const thick = L.to - L.from + 1;
  const inW = R.from - L.to - 1;
  const expH = Math.round(inW * RATIO);

  // Top and bottom: horizontal bands between the sides.
  const hb = bands(runsAlong(data, w, h, false, L.from, R.to + 1), inW * 0.6);
  const yA = Math.min(L.start, R.start), yB = Math.max(L.end, R.end);
  const topBand = hb.find((b) => Math.abs(b.from - yA) <= thick + 3);
  const botBand = [...hb].reverse().find((b) => Math.abs(b.to - yB) <= thick + 3 && b !== topBand);

  let top, bottom; // interior, inclusive top / exclusive bottom
  const notes = [];
  if (topBand) top = topBand.to + 1;
  else { top = Math.max(0, yA); notes.push('top of card cut off by the screenshot'); }
  if (botBand) bottom = botBand.from;
  else { bottom = Math.min(h, yB + 1); notes.push('bottom of card cut off by the screenshot'); }
  // Too tall: another card's frame above or below merged into the sides.
  if (bottom - top > expH * 1.03) {
    if (botBand) top = bottom - expH;
    else if (topBand) bottom = top + expH;
    notes.push('trimmed overlap with a neighbouring card');
  }
  const missing = expH - (bottom - top);
  if (missing > 30) notes.push(`about ${missing}px of the card is missing from the screenshot`);
  else if (notes.length && missing <= 30) {
    // A few pixels short is fine: the name, HP and DMG are all still there.
    for (let i = notes.length - 1; i >= 0; i--) if (/cut off/.test(notes[i])) notes.splice(i, 1);
  }

  const inset = Math.max(1, Math.round(inW * 0.007));
  const box = {
    left: L.to + 1 + inset,
    top: top + (topBand || top > 0 ? inset : 0),
    width: inW - inset * 2,
    height: bottom - top - (topBand ? inset : 0) - (botBand ? inset : 0),
  };
  const full = box.height / box.width;
  if (!notes.length && full - RATIO > 0.08) notes.push(`unusual shape (${box.width}x${box.height}), check it`);
  return { ok: true, box, notes, scale: +(inW / 446).toFixed(2) };
}

fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(inDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
const report = { cropped: [], failed: [] };
for (const f of files) {
  const src = path.join(inDir, f);
  try {
    const r = await cropOne(src);
    if (!r.ok) {
      report.failed.push({ file: f, reason: r.reason });
      continue;
    }
    const dest = path.join(outDir, f.replace(/\.[^.]+$/, '.png'));
    await sharp(src).extract(r.box).png().toFile(dest);
    report.cropped.push({ file: f, ...r.box, scale: r.scale, notes: r.notes });
  } catch (err) {
    report.failed.push({ file: f, reason: err.message });
  }
}
fs.writeFileSync(path.join(outDir, 'crop-report.json'), JSON.stringify(report, null, 1));

const sizes = report.cropped.map((c) => `${c.width}x${c.height}`);
const common = Object.entries(sizes.reduce((m, s) => ((m[s] = (m[s] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
console.log(`${report.cropped.length} cropped, ${report.failed.length} failed (of ${files.length})`);
console.log('crop sizes:', common.slice(0, 6).map(([s, n]) => `${s} ×${n}`).join(', '));
for (const f of report.failed) console.log(`  FAILED ${f.file}: ${f.reason}`);
const flagged = report.cropped.filter((c) => c.notes.length);
console.log(`${flagged.length} cropped with notes:`);
for (const c of flagged) console.log(`  ${c.file}: ${c.notes.join('; ')}`);
