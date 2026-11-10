// Imports card data transcribed from screenshots into content/data/cards.json
// and content/data/traits.json, and copies each cropped card image into
// images/cards/<id>.webp or images/supports/<id>.webp (high-quality WebP).
//
//   node src/tools/import-cards.mjs <folder with batch-*.json> <cropped images folder>
//
// Safe to re-run: fields added by hand (rarity, source, border, notes) are kept.
// Writes CARD-REVIEW.md listing anything that needs a human check.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { slug, parseShort } from '../lib/util.mjs';

const [batchDir, cropDir] = process.argv.slice(2);
if (!batchDir || !cropDir) {
  console.error('Usage: node src/tools/import-cards.mjs <batch json folder> <cropped images folder>');
  process.exit(1);
}
const root = process.cwd();
const cardsFile = path.join(root, 'content/data/cards.json');
const traitsFile = path.join(root, 'content/data/traits.json');

const rows = fs
  .readdirSync(batchDir)
  .filter((f) => /^batch-\d+\.json$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(batchDir, f), 'utf8')));

const review = { noName: [], duplicates: [], dropped: [], added: [], lowConf: [], notes: [], noImage: [] };

// "% of ATK" check: the percentage must be followed closely by ATK/attack, and
// must not be a buff like "+25% ATK".
function atkPercents(text) {
  const found = new Set();
  const re = /([+-])?\b(\d+(?:\.\d+)?)%\s*(?:of\s+(?:[\w']+\s+){0,3})?(?:ATK|attack)\b/gi;
  let m;
  while ((m = re.exec(text))) if (!m[1]) found.add(parseFloat(m[2]));
  return found;
}

const conf = { high: 3, medium: 2, low: 1 };
const score = (r) =>
  (conf[r.confidence] || 0) * 10 + (r.hp ? 2 : 0) + (r.abilityText ? 2 : 0) - (/cut off|clipped|partly/i.test(r.notes || '') ? 5 : 0);

// Group screenshots by card.
const groups = new Map();
for (const r of rows) {
  if (!r.name) {
    review.noName.push(r);
    continue;
  }
  const id = slug(r.name);
  if (!groups.has(id)) groups.set(id, []);
  groups.get(id).push(r);
}

const existing = fs.existsSync(cardsFile) ? JSON.parse(fs.readFileSync(cardsFile, 'utf8')) : [];
const header = existing.filter((e) => !e.id);
const byId = new Map(existing.filter((e) => e.id).map((e) => [e.id, e]));
const traitMap = new Map();

for (const [id, list] of groups) {
  list.sort((a, b) => score(b) - score(a));
  const best = list[0];
  if (list.length > 1) {
    const stats = [...new Set(list.map((r) => `${r.hp ?? '?'} HP / ${r.dmg ?? '?'} DMG`))];
    review.duplicates.push({ id, name: best.name, files: list.map((r) => r.file), stats, kept: best.file });
  }
  const type = best.folder === 'Supports' ? 'support' : 'battle';
  const text = best.abilityText || '';

  // Ability hits that scale with this card's ATK (battle cards only; a
  // support's percentages scale with the card it is equipped on).
  // Hits written as "X% of ATK" go in atkScaling. Hits written only as
  // "X% damage" / "Nx damage" go in impliedScaling, which the site shows only
  // when site.json has "countImpliedDamage": true.
  let atkScaling = [];
  const impliedScaling = [];
  if (type === 'battle') {
    const valid = atkPercents(text);
    for (const x of best.atkScaling || []) {
      if (valid.has(x.pct)) atkScaling.push({ label: x.label, pct: x.pct });
      else { impliedScaling.push({ label: x.label, pct: x.pct }); review.dropped.push({ id, name: best.name, label: x.label, pct: x.pct }); }
    }
  }

  const traits = [];
  for (const t of best.traits || []) {
    if (!t || !t.name) continue;
    const tid = slug(t.name);
    traits.push(`trait:${tid}`);
    if (!traitMap.has(tid)) traitMap.set(tid, { id: tid, name: t.name, texts: new Map() });
    const tm = traitMap.get(tid);
    tm.texts.set(t.text, (tm.texts.get(t.text) || 0) + 1);
  }

  const prev = byId.get(id) || {};
  const card = {
    id,
    name: prev.name || best.name,
    type,
    rarity: prev.rarity ?? 'TODO',
    ...(prev.source ? { source: prev.source } : {}),
    ...(prev.border ? { border: prev.border } : {}),
    ...(prev.unconfirmed ? { unconfirmed: prev.unconfirmed } : {}),
    ...(type === 'battle' ? { dmg: best.dmg ?? 'TODO', hp: best.hp ?? 'TODO' } : {}),
    ability: { name: best.abilityName || prev.ability?.name || 'TODO', text: text || prev.ability?.text || 'TODO' },
    atkScaling,
    ...(impliedScaling.length ? { impliedScaling } : {}),
    traits,
    ...(prev.notes ? { notes: prev.notes } : {}),
    screenshot: `${best.folder}/${best.file}`,
  };
  if (type === 'battle') {
    const hp = parseShort(card.hp), dmg = parseShort(card.dmg);
    if (hp && dmg && Math.abs(hp / dmg - 2) > 0.06) review.notes.push({ id, name: card.name, note: `HP (${card.hp}) is not 2x DMG (${card.dmg}); check the numbers` });
  }
  if (best.confidence !== 'high') review.lowConf.push({ id, name: card.name, file: best.file, confidence: best.confidence, notes: best.notes });
  else if (best.notes) review.notes.push({ id, name: card.name, note: best.notes });
  byId.set(id, card);

  // Image
  const crop = path.join(cropDir, best.folder, best.file.replace(/\.[^.]+$/, '.png'));
  const dest = path.join(root, 'images', type === 'support' ? 'supports' : 'cards', `${id}.webp`);
  if (fs.existsSync(crop)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await sharp(crop).webp({ quality: 95, effort: 5 }).toFile(dest);
  } else review.noImage.push({ id, name: card.name, file: best.file });
}

const cards = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(cardsFile, JSON.stringify([...header, ...cards], null, 2) + '\n');

const traits = [...traitMap.values()]
  .map((t) => ({ id: t.id, name: t.name, summary: [...t.texts.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
  .sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(traitsFile, JSON.stringify(traits, null, 2) + '\n');

// Review notes for a human.
let md = `# Card import review\n\nGenerated by \`src/tools/import-cards.mjs\`. ${cards.length} cards, ${traits.length} traits.\n\n`;
const sec = (title, list, fmt) => { if (list.length) md += `## ${title} (${list.length})\n\n${list.map(fmt).join('\n')}\n\n`; };
sec('Screenshots with no readable card name (skipped)', review.noName, (r) => `- \`${r.folder}/${r.file}\` (ability: ${r.abilityName || '?'}) ${r.notes || ''}`);
sec('Cards with more than one screenshot', review.duplicates, (d) => `- **${d.name}**: ${d.stats.join(' vs ')}. Kept \`${d.kept}\` of ${d.files.map((f) => `\`${f}\``).join(', ')}`);
sec('Hits written as "X% damage" or "Nx damage", not "% of ATK" (stored as impliedScaling, hidden unless countImpliedDamage is on)', review.dropped, (d) => `- **${d.name}**: ${d.label} (${d.pct}%)`);
sec('Needs a check (medium/low confidence)', review.lowConf, (d) => `- **${d.name}** (\`${d.file}\`, ${d.confidence}): ${d.notes}`);
sec('Notes from transcription', review.notes, (d) => `- **${d.name}**: ${d.note}`);
sec('No cropped image found', review.noImage, (d) => `- **${d.name}** (\`${d.file}\`)`);
fs.writeFileSync(path.join(root, 'CARD-REVIEW.md'), md);

console.log(`${cards.length} cards (${cards.filter((c) => c.type === 'battle').length} battle, ${cards.filter((c) => c.type === 'support').length} support), ${traits.length} traits`);
console.log(`duplicates ${review.duplicates.length}, no name ${review.noName.length}, implied-only hits ${review.dropped.length}, needs check ${review.lowConf.length}, no image ${review.noImage.length}`);
