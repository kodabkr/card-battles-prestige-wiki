// Loads everything under content/: site config, pages (Markdown) and data (JSON),
// then builds the entity registry and the cross-links between entities.
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { KINDS } from './kinds.mjs';
import { readJSON, walk, posix, asArray } from './util.mjs';

const REF_RE = /^([a-z]+):([a-z0-9][a-z0-9-]*)$/;

export function loadContent(root) {
  const dir = path.join(root, 'content');
  const config = readJSON(path.join(dir, 'site.json'));
  const home = readJSON(path.join(dir, 'home.json'));
  const tiers = readJSON(path.join(dir, 'data', 'tiers.json'));
  const extra = {};
  for (const name of ['prestige', 'victory-road', 'scaling']) {
    const f = path.join(dir, 'data', `${name}.json`);
    if (fs.existsSync(f)) extra[name] = readJSON(f);
  }

  // ---- Entities ----
  const entities = new Map();
  const byName = new Map();
  const problems = [];
  for (const [kind, def] of Object.entries(KINDS)) {
    const file = path.join(dir, 'data', `${def.file}.json`);
    if (!fs.existsSync(file)) continue;
    const json = readJSON(file);
    const list = Array.isArray(json) ? json : json.items || [];
    for (const e of list) {
      // Entries with only "_" keys are notes for editors (for example {"_todo": "..."}).
      if (Object.keys(e).every((k) => k.startsWith('_'))) continue;
      if (!e.id || !e.name) {
        problems.push(`${def.file}.json: every entry needs an "id" and a "name" (${JSON.stringify(e).slice(0, 80)})`);
        continue;
      }
      e.kind = kind;
      e.key = `${kind}:${e.id}`;
      e.anchor = `${kind}-${e.id}`;
      // Every card gets its own profile page.
      e.page = e.page || (kind === 'card' ? `/cards/${e.id}/` : def.page);
      e.url = `${e.page}#${e.anchor}`;
      e.rel = { usedIn: [], cards: [], drops: [], sells: [], currencies: [], contains: [], gives: [], holders: [] };
      if (entities.has(e.key)) problems.push(`Duplicate id "${e.key}"`);
      entities.set(e.key, e);
      const n = e.name.toLowerCase();
      if (!byName.has(n)) byName.set(n, e.key);
      for (const alias of asArray(e.aliases)) byName.set(alias.toLowerCase(), e.key);
    }
  }

  const resolve = (ref) => {
    if (typeof ref !== 'string') return null;
    const m = ref.match(REF_RE);
    if (m) return entities.get(ref) || null;
    return null;
  };

  // ---- Cross-links (computed backlinks) ----
  const link = (from, field, list, relName) => {
    for (const item of asArray(list)) {
      const ref = typeof item === 'string' ? item : item && item.ref;
      if (!ref || !REF_RE.test(ref)) continue;
      const target = entities.get(ref);
      if (!target) {
        problems.push(`${from.key} → ${field}: unknown reference "${ref}"`);
        continue;
      }
      if (!target.rel[relName].includes(from)) target.rel[relName].push(from);
    }
  };
  for (const e of entities.values()) {
    link(e, 'recipe', e.recipe, 'usedIn');
    link(e, 'cost', e.cost, 'usedIn');
    link(e, 'source', e.kind === 'card' ? e.source : null, 'cards');
    link(e, 'dropsFrom', e.dropsFrom, 'drops');
    link(e, 'soldAt', e.soldAt, 'sells');
    link(e, 'spentAt', e.spentAt, 'currencies');
    link(e, 'foundIn', e.foundIn, 'contains');
    link(e, 'sources', e.sources, 'gives');
    link(e, 'earnedFrom', e.earnedFrom, 'gives');
    link(e, 'traits', e.kind === 'card' ? e.traits : null, 'holders');
  }

  // ---- Variant rules: stat multiplier = 2^(log10 rarity multiplier); combos multiply ----
  for (const v of entities.values()) {
    if (v.kind !== 'border' || v.rarityMult == null) continue;
    const want = Math.pow(2, Math.log10(v.rarityMult));
    if (Math.abs(want - v.statMult) > 1e-9) problems.push(`Variant ${v.name}: stat multiplier ${v.statMult} should be ${want} for rarity x${v.rarityMult}`);
    if (v.combo) {
      const parts = v.combo.map((id) => entities.get(`border:${id}`));
      if (parts.some((x) => !x)) problems.push(`Variant ${v.name}: unknown combo part`);
      else {
        const r = parts.reduce((a, x) => a * x.rarityMult, 1);
        const st = parts.reduce((a, x) => a * x.statMult, 1);
        if (r !== v.rarityMult || st !== v.statMult) problems.push(`Variant ${v.name}: combo of ${v.combo.join(' x ')} gives x${r} rarity / x${st} stats`);
      }
    }
  }

  // ---- Pages ----
  const pagesDir = path.join(dir, 'pages');
  const pages = [];
  for (const file of walk(pagesDir, (p) => p.endsWith('.md'))) {
    const rel = posix(path.relative(pagesDir, file)).replace(/\.md$/, '');
    const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    const fm = m ? yaml.load(m[1]) || {} : {};
    const body = m ? m[2] : raw;
    let url;
    if (rel === 'index') url = '/';
    else if (rel === '404') url = '/404.html';
    else url = '/' + rel.replace(/\/index$/, '') + '/';
    pages.push({ file: posix(path.relative(root, file)), rel, url, fm, body, title: fm.title || rel });
  }
  // Generated profile pages, one per card.
  const cardList = [...entities.values()].filter((e) => e.kind === 'card').sort((a, b) => a.name.localeCompare(b.name));
  cardList.forEach((e, i) => {
    pages.push({
      file: `content/data/cards.json (${e.id})`,
      rel: `cards/${e.id}`,
      url: e.page,
      generated: true,
      fm: {
        title: e.name,
        description: `${e.type === 'support' ? 'Support' : 'Battle'} card${e.ability && e.ability.name ? `. Ability: ${e.ability.name}` : ''}.`,
        parent: { title: 'Card Database', url: '/cards/database/' },
        icon: 'card',
      },
      body: `{{card-profile ref="${e.key}"}}`,
      title: e.name,
      group: 'Cards',
      prevPage: cardList[i - 1] ? { url: cardList[i - 1].page, title: cardList[i - 1].name } : null,
      nextPage: cardList[i + 1] ? { url: cardList[i + 1].page, title: cardList[i + 1].name } : null,
    });
  });
  const pageByUrl = new Map(pages.map((p) => [p.url, p]));

  // ---- Navigation ----
  const nav = [];
  const order = [];
  for (const group of config.nav) {
    const g = { label: group.label, icon: group.icon, items: [] };
    for (const url of group.pages) {
      const p = pageByUrl.get(url);
      if (!p) {
        problems.push(`site.json nav: no page for ${url}`);
        continue;
      }
      p.group = g.label;
      g.items.push(p);
      order.push(p);
    }
    nav.push(g);
  }
  for (const p of pages) {
    if (!p.group && !p.generated && p.url !== '/' && p.url !== '/404.html') problems.push(`Page ${p.file} is not in the site.json nav`);
  }

  return { root, config, home, tiers, extra, entities, byName, resolve, pages, pageByUrl, nav, order, problems };
}

export function isRef(s) {
  return typeof s === 'string' && REF_RE.test(s);
}
