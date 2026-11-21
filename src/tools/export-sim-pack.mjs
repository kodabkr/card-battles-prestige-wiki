// Exports everything a battle simulator needs into one Markdown file (with the
// simulator brief at the top) plus the same card data as JSON.
//
//   node src/tools/export-sim-pack.mjs
//
// Output: exports/PRESTIGE-SIM-PACK.md and exports/prestige-sim-cards.json
// The brief text lives in src/tools/sim-pack/brief.md; edit it there.
import fs from 'node:fs';
import path from 'node:path';
import { loadContent } from '../lib/content.mjs';
import { parseShort, gameNum, isTodo } from '../lib/util.mjs';

const root = process.cwd();
const site = loadContent(root);
const all = [...site.entities.values()];
const cards = all.filter((e) => e.kind === 'card').sort((a, b) => a.name.localeCompare(b.name));
const battle = cards.filter((c) => c.type !== 'support');
const support = cards.filter((c) => c.type === 'support');
const variants = all.filter((e) => e.kind === 'border' && e.rarityMult != null).sort((a, b) => a.order - b.order);
const traits = all.filter((e) => e.kind === 'trait').sort((a, b) => a.name.localeCompare(b.name));
const origins = (site.extra.origins || []).filter((o) => o.id);

const name = (ref) => (ref && site.entities.get(ref) ? site.entities.get(ref).name : ref || null);
const originName = (c) => (origins.find((o) => o.id === c.origin) || {}).name || null;
const trim = (n) => String(Math.round(n * 100) / 100);
const plain = (t) => String(t || '').replace(/\*\*/g, '').replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2');
const choose4 = (n) => (n * (n - 1) * (n - 2) * (n - 3)) / 24;

// Card images: copied into exports/card-images/<id>.<ext> (zipped afterwards for attaching).
const imgDir = path.join(root, 'exports', 'card-images');
fs.rmSync(imgDir, { recursive: true, force: true });
fs.mkdirSync(imgDir, { recursive: true });
function cardImage(c) {
  const dir = path.join(root, 'images', c.type === 'support' ? 'supports' : 'cards');
  const file = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => path.parse(f).name === c.id) : null;
  if (!file) return null;
  const out = c.id + path.extname(file).toLowerCase();
  fs.copyFileSync(path.join(dir, file), path.join(imgDir, out));
  return `card-images/${out}`;
}

// Every percentage in an ability, with a short piece of the sentence around it.
function percentages(text) {
  const t = plain(text).replace(/\n+/g, ' ').replace(/\s+-\s+/g, ' · ').replace(/\s+/g, ' ');
  const out = [];
  for (const m of t.matchAll(/([+-]?)(\d+(?:\.\d+)?)%/g)) {
    const v = parseFloat(m[2]);
    const sign = m[1] || '';
    const start = Math.max(0, t.lastIndexOf(' ', Math.max(0, m.index - 45)));
    const end = t.indexOf(' ', Math.min(t.length, m.index + m[0].length + 45));
    const context = (start > 0 ? '…' : '') + t.slice(start, end < 0 ? t.length : end).trim() + (end < 0 ? '' : '…');
    out.push({ value: `${sign}${trim(v)}%`, base: v, sign, awakened: [1, 2, 3, 4, 5].map((lv) => `${sign}${trim(v * (1 + lv / 10))}%`), context });
  }
  return out;
}

function stat(v) {
  const n = parseShort(v);
  return n == null ? null : n;
}

// Rarity from stats: base DMG = K x 2^(log10 rarity), the same rule as variants
// (every 10x rarer = 2x stats). K is calibrated on cards whose rarity is known.
const calib = battle
  .filter((c) => typeof c.rarity === 'number' && !c.statsEstimated && stat(c.dmg))
  .map((c) => stat(c.dmg) / 2 ** Math.log10(c.rarity))
  .sort((a, b) => a - b);
const K = calib.length ? calib[Math.floor(calib.length / 2)] : null;
const rarityFromStats = (dmg) => (K && dmg ? Math.max(1, 10 ** Math.log2(dmg / K)) : null);

// ---- JSON ----
const json = cards.map((c) => {
  const isBattle = c.type !== 'support';
  return {
    id: c.id,
    name: c.name,
    type: isBattle ? 'battle' : 'support',
    rarity: typeof c.rarity === 'number' ? c.rarity : null,
    rarityFromStats: isBattle ? Math.round(rarityFromStats(stat(c.dmg)) || 0) || null : null,
    rarityForFilter: typeof c.rarity === 'number' ? c.rarity : isBattle ? Math.round(rarityFromStats(stat(c.dmg)) || 0) || null : null,
    image: cardImage(c),
    origin: originName(c),
    source: name(Array.isArray(c.source) ? c.source[0] : c.source),
    baseDmg: isBattle ? stat(c.dmg) : null,
    baseHp: isBattle ? stat(c.hp) : null,
    statsEstimated: !!c.statsEstimated,
    traits: (c.traits || []).map(name),
    roles: (c.roles || []).map((r) => name(`role:${r}`)),
    ability: c.ability ? { name: c.ability.name, text: plain(c.ability.text) } : null,
    percentages: c.ability ? percentages(c.ability.text).map(({ base, sign, awakened, context }) => ({ base: sign === '-' ? -base : base, signed: !!sign, awakened, context })) : [],
    atkHits: (c.atkScaling || []).map((x) => ({ label: x.label, pctOfAtk: x.pct })),
    otherDamageHits: (c.impliedScaling || []).map((x) => ({ label: x.label, pct: x.pct, note: 'written as "X% damage", not "% of ATK"' })),
    notes: c.notes || null,
  };
});

// ---- Markdown ----
let brief = fs.readFileSync(path.join(root, 'src/tools/sim-pack/brief.md'), 'utf8');
const variantTable =
  '| Variant | Rarity multiplier | Stat multiplier (DMG and HP) | Made of |\n|---|---|---|---|\n' +
  variants.map((v) => `| ${v.name} | x${v.rarityMult.toLocaleString('en-US')} | x${v.statMult.toLocaleString('en-US')} | ${v.combo ? v.combo.map((id) => name(`border:${id}`)).join(' x ') : v.id === 'rainbow' ? 'standalone' : '—'} |`).join('\n');
const traitTable = '| Trait | Meaning (game text) |\n|---|---|\n' + traits.map((t) => `| ${t.name} | ${t.summary || ''} |`).join('\n');
brief = brief
  .replace('{{generatedAt}}', new Date().toISOString().slice(0, 10))
  .replace('{{cardCount}}', cards.length)
  .replaceAll('{{battleCount}}', battle.length)
  .replace('{{supportCount}}', support.length)
  .replace('{{fourCardTeams}}', `${Math.round(choose4(battle.length) / 1e6)} million`)
  .replace('{{variantTable}}', variantTable)
  .replace('{{traitTable}}', traitTable);

function cardMd(c, j) {
  const isBattle = j.type === 'battle';
  const lines = [`### ${c.name}`, ''];
  const meta = [
    isBattle ? 'Battle card' : 'Support card',
    `Rarity: ${j.rarity ? `1 in ${gameNum(j.rarity)}` : 'unknown'}`,
    `Origin: ${j.origin ? j.origin + (j.source ? ` (${j.source})` : '') : 'unknown'}`,
  ];
  lines.push(meta.join(' · '));
  if (isBattle) {
    const est = j.statsEstimated ? ' **(estimated)**' : '';
    const d = j.baseDmg != null ? `${gameNum(j.baseDmg)} (${Math.round(j.baseDmg).toLocaleString('en-US')})` : 'unknown';
    const h = j.baseHp != null ? `${gameNum(j.baseHp)} (${Math.round(j.baseHp).toLocaleString('en-US')})` : 'unknown';
    lines.push('', `**Base DMG:** ${d} · **Base HP:** ${h}${est}`);
  }
  if (j.traits.length) lines.push('', `**Traits:** ${j.traits.join(', ')}`);
  if (j.roles.length) lines.push('', `**Roles (wiki labels):** ${j.roles.join(', ')}`);
  if (c.ability) {
    lines.push('', `**Ability: ${c.ability.name}**`, '');
    // Keep **sub-headings** bold; only unwrap wiki links.
    const shown = String(c.ability.text).replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2');
    lines.push(shown.split('\n').map((l) => (l.trim() ? `> ${l}` : '>')).join('\n'));
  } else lines.push('', '**Ability:** none');
  if (j.percentages.length) {
    lines.push('', '**Ability numbers** (base, then Awakening Lv 1–5)', '', '| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |', '|---|---|---|---|---|---|---|---|');
    percentages(c.ability.text).forEach((p, i) => lines.push(`| ${i + 1} | ${p.value} | ${p.awakened.join(' | ')} | ${p.context.replace(/\|/g, '/')} |`));
  }
  if (j.atkHits.length) lines.push('', `**Hits that scale with this card's ATK:** ${j.atkHits.map((x) => `${x.label} ${x.pctOfAtk}%`).join(', ')}`);
  if (j.otherDamageHits.length) lines.push('', `**Hits written as "X% damage" (probably of a normal attack):** ${j.otherDamageHits.map((x) => `${x.label} ${x.pct}%`).join(', ')}`);
  if (j.notes) lines.push('', `*Note: ${plain(j.notes)}*`);
  lines.push('', '---', '');
  return lines.join('\n');
}

const byId = new Map(json.map((j) => [j.id, j]));
let md = brief.trimEnd() + '\n\n';
md += `### Index\n\n- [Battle cards (${battle.length})](#battle-cards)\n- [Support cards (${support.length})](#support-cards)\n\n`;
md += `## Battle cards\n\n` + battle.map((c) => cardMd(c, byId.get(c.id))).join('\n');
md += `\n## Support cards\n\n` + support.map((c) => cardMd(c, byId.get(c.id))).join('\n');
const appPart = fs.readFileSync(path.join(root, 'src/tools/sim-pack/results-app.md'), 'utf8');
md += '\n' + appPart;
const appPrompt =
  "Add the results app below to the simulator. I've attached `card-images.zip` (card images named by card id) and an updated `prestige-sim-cards.json` with an `image` field on every card. Use the new JSON from now on.\n\n" +
  appPart.replace(/^## Part 8 — /, '## ').replace(/\(Part 2\)/g, '(Part 2 of the pack)');

const outDir = path.join(root, 'exports');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'PRESTIGE-SIM-PACK.md'), md);
fs.writeFileSync(path.join(outDir, 'RESULTS-APP-PROMPT.md'), appPrompt);
fs.writeFileSync(path.join(outDir, 'prestige-sim-cards.json'), JSON.stringify({ generated: new Date().toISOString(), variants: variants.map((v) => ({ name: v.name, rarityMult: v.rarityMult, statMult: v.statMult, combo: v.combo || null })), traits: traits.map((t) => ({ name: t.name, meaning: t.summary })), cards: json }, null, 1));

const pctCount = json.reduce((s, j) => s + j.percentages.length, 0);
const unknownStats = battle.filter((c) => byId.get(c.id).baseDmg == null).map((c) => c.name);
console.log(`wrote exports/PRESTIGE-SIM-PACK.md (${(md.length / 1024).toFixed(0)} KB) and exports/prestige-sim-cards.json`);
const noImage = cards.filter((c) => !byId.get(c.id).image).map((c) => c.name);
const rarityKnown = cards.filter((c) => byId.get(c.id).rarity != null).length;
console.log(`images: ${cards.length - noImage.length}/${cards.length}${noImage.length ? ` (missing: ${noImage.join(', ')})` : ''}; rarity known: ${rarityKnown}/${cards.length}`);
console.log(`${cards.length} cards, ${pctCount} ability percentages, ${battle.filter((c) => c.statsEstimated).length} with estimated stats`);
if (unknownStats.length) console.log(`battle cards without base stats: ${unknownStats.join(', ')}`);
