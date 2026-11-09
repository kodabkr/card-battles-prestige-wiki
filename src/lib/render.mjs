// Markdown rendering with wiki extensions:
//
//   :::tip Optional title          callouts: tip, warning, resets, eternal, note, soon
//   ...markdown...
//   :::
//
//   {{component key="value"}}      data-driven components (see components.mjs)
//   [[charm:orb-of-transcendence]] link to anything, by kind:id ...
//   [[Orb Fragments]]              ... or by its exact name
//   [[potion:luck-1|Tier 1 Luck]]  ... with your own label
//   TODO   or   TODO(what is missing)
//                                  shows a "Details coming soon" marker
import { marked } from 'marked';
import { esc, isTodo, todoNote, slug, stripTags } from './util.mjs';
import { KINDS } from './kinds.mjs';
import { icon } from './icons.mjs';
import { component } from './components.mjs';

marked.use({ gfm: true, breaks: false });

const CALLOUTS = {
  tip: { label: 'Tip', icon: 'tip' },
  warning: { label: 'Warning', icon: 'warning' },
  resets: { label: 'Resets on prestige', icon: 'reset' },
  eternal: { label: 'Eternal (kept on prestige)', icon: 'eternal' },
  note: { label: 'Note', icon: 'info' },
  soon: { label: 'Details coming soon', icon: 'soon' },
};

export function callout(type, title, innerHtml) {
  const c = CALLOUTS[type] || CALLOUTS.note;
  return `<aside class="callout callout--${CALLOUTS[type] ? type : 'note'} reveal"><p class="callout__title">${icon(c.icon)}<span>${esc(title || c.label)}</span></p><div class="callout__body">${innerHtml}</div></aside>`;
}

export function soon(note) {
  const n = note ? String(note).trim() : '';
  return `<span class="soon"${n ? ` title="Coming soon: ${esc(n)}"` : ''}>${icon('soon')}Details coming soon</span>`;
}

// Tier level (1-8) used by the colour system.
export function tierLevel(tier, ctx) {
  if (tier == null || tier === '') return 0;
  const names = ctx.site.tiers.names || {};
  const key = String(tier).toLowerCase();
  if (names[key] != null) return names[key];
  const n = parseInt(key, 10);
  return Number.isFinite(n) ? Math.max(1, Math.min(8, n)) : 0;
}

export function tierLabel(tier, ctx) {
  const labels = ctx.site.tiers.labels || {};
  const key = String(tier).toLowerCase();
  return labels[key] || `Tier ${tier}`;
}

export function cardTier(card, ctx) {
  if (card.tier) return tierLevel(card.tier, ctx);
  if (typeof card.rarity !== 'number') return 0;
  for (const band of ctx.site.tiers.cardOddsBands || []) if (card.rarity <= band.upTo) return band.level;
  return 8;
}

export function nameHtml(e) {
  return `${esc(e.name)}${e.unconfirmed ? `<abbr class="unconfirmed" title="Spelling not confirmed yet">?</abbr>` : ''}`;
}

// Link chip to an entity. inner = "kind:id", "kind:id|Label", "Name" or "Name|Label".
export function entityLink(inner, ctx, opts = {}) {
  const [target, label] = String(inner).split('|').map((s) => s.trim());
  let e = null;
  if (/^[a-z]+:[a-z0-9-]+$/.test(target)) e = ctx.site.entities.get(target);
  else {
    const key = ctx.site.byName.get(target.toLowerCase());
    if (key) e = ctx.site.entities.get(key);
    // Plain page links by title also work: [[Potions]]
    if (!e) {
      const page = ctx.site.pages.find((p) => p.title.toLowerCase() === target.toLowerCase());
      if (page) return `<a class="ent ent--page" href="${page.url}">${icon('book', 'ent__ico')}<span>${esc(label || page.title)}</span></a>`;
    }
  }
  if (!e) {
    ctx.warn(`${ctx.page ? ctx.page.file : 'data'}: link [[${inner}]] does not match anything`);
    return `<span class="ent ent--missing">${esc(label || target)}</span>`;
  }
  const def = KINDS[e.kind];
  const lvl = e.kind === 'card' ? cardTier(e, ctx) : tierLevel(e.tier, ctx);
  let thumb = icon(def.icon, 'ent__ico');
  if (def.folder && opts.thumb !== false) {
    const p = e.image || `${e.kind === 'card' && e.type === 'support' ? 'supports' : def.folder}/${e.id}`;
    if (ctx.images.has(p)) {
      const v = ctx.images.variants(p, def.shape);
      thumb = `<img class="ent__img" src="${v.sets.webp[0].url}" alt="" width="20" height="20" loading="lazy" decoding="async">`;
    }
  }
  const text = label ? esc(label) : nameHtml(e);
  return `<a class="ent ent--${e.kind}${lvl ? ` tier-${lvl}` : ''}" href="${e.url}" data-kind="${def.label}">${thumb}<span>${text}</span></a>`;
}

function parseArgs(str) {
  const args = {};
  const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))|"([^"]*)"/g;
  let m;
  let i = 0;
  while ((m = re.exec(str))) {
    if (m[1]) args[m[1]] = m[2] ?? m[3] ?? m[4];
    else args[`_${i++}`] = m[5];
  }
  return args;
}

/**
 * Render Markdown (or one line of inline Markdown) to HTML.
 */
export function renderMarkdown(src, ctx, { inline = false } = {}) {
  if (src == null) return '';
  src = String(src);
  const tokens = [];
  const keepBlock = (html) => `\n\n<div data-tok="${tokens.push(html) - 1}"></div>\n\n`;
  const keepInline = (html) => `<span data-tok="${tokens.push(html) - 1}"></span>`;

  if (!inline) {
    src = src.replace(/^:::([\w-]+)[ \t]*(.*)\n([\s\S]*?)^:::[ \t]*$/gm, (m, type, title, body) =>
      keepBlock(callout(type, title.trim(), renderMarkdown(body, ctx)))
    );
  }
  src = src.replace(/^([ \t]*)\{\{\s*([\w-]+)([^}]*)\}\}[ \t]*$/gm, (m, ws, name, args) =>
    inline ? keepInline(component(name, parseArgs(args), ctx)) : keepBlock(component(name, parseArgs(args), ctx))
  );
  src = src.replace(/\{\{\s*([\w-]+)([^}]*)\}\}/g, (m, name, args) => keepInline(component(name, parseArgs(args), ctx)));
  src = src.replace(/\[\[([^\]]+)\]\]/g, (m, inner) => keepInline(entityLink(inner, ctx)));
  src = src.replace(/\bTODO(?:\(([^)]*)\))?/g, (m, note) => keepInline(soon(note)));

  let html = inline ? marked.parseInline(src) : marked.parse(src);
  if (!inline) {
    html = html.replace(/<table>/g, '<div class="table-wrap reveal"><table class="sortable">').replace(/<\/table>/g, '</table></div>');
  }
  html = html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" rel="noopener noreferrer" class="external"');
  // Tokens can contain other tokens, so substitute until stable.
  for (let i = 0; i < 4 && html.includes('data-tok="'); i++) {
    html = html.replace(/<(div|span) data-tok="(\d+)"><\/\1>/g, (m, t, n) => tokens[+n]);
  }
  return html;
}

// Render a data value: strings get inline Markdown, links and TODO markers;
// arrays become lists; null becomes empty.
export function rich(v, ctx) {
  if (v == null || v === '') return '';
  if (Array.isArray(v)) {
    if (v.length === 1) return rich(v[0], ctx);
    return `<ul class="vlist">${v.map((x) => `<li>${rich(x, ctx)}</li>`).join('')}</ul>`;
  }
  if (typeof v === 'number') return esc(v.toLocaleString('en-US'));
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return esc(JSON.stringify(v));
  if (isTodo(v)) return soon(todoNote(v));
  if (/^[a-z]+:[a-z0-9-]+$/.test(v) && ctx.site.entities.has(v)) return entityLink(v, ctx);
  return renderMarkdown(v, ctx, { inline: true });
}

/**
 * Give every h2-h4 an id and a copy-link button, and collect the
 * "On this page" list (h2 + h3 unless marked data-notoc).
 */
export function finalizeHeadings(html, ctx) {
  const used = new Set();
  const toc = [];
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) {
    if (used.has(m[1])) ctx.warn(`${ctx.page.file}: the id "${m[1]}" appears twice on this page`);
    used.add(m[1]);
  }
  const uniq = (base) => {
    let id = base || 'section';
    let n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return id;
  };
  html = html.replace(/<h([234])([^>]*)>([\s\S]*?)<\/h\1>/g, (m, lvl, attrs, inner) => {
    const text = stripTags(inner.replace(/<abbr class="unconfirmed"[^>]*>.*?<\/abbr>/g, ''));
    let target = (attrs.match(/\sid="([^"]+)"/) || [])[1] || (attrs.match(/\sdata-anchor="([^"]+)"/) || [])[1];
    if (!target) {
      target = uniq(slug(text));
      attrs += ` id="${target}"`;
    }
    if (+lvl <= 3 && !/data-notoc/.test(attrs)) toc.push({ lvl: +lvl, id: target, text });
    return `<h${lvl}${attrs}>${inner}<a class="h-anchor" href="#${target}" aria-label="Copy link to this section: ${esc(text)}" data-copy>${icon('link')}</a></h${lvl}>`;
  });
  return { html, toc };
}
