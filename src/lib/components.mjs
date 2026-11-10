// Reusable, data-driven components. Use them from Markdown as {{name key="value"}}.
// Every component reads from content/data, so adding a new card/potion/etc. is
// a JSON edit, not a layout edit.
import { esc, isTodo, todoNote, formatOdds, asArray, compact, parseShort, gameNum } from './util.mjs';
import { KINDS, SHAPES } from './kinds.mjs';
import { icon } from './icons.mjs';
import { rich, entityLink, soon, renderMarkdown, tierLevel, tierLabel, cardTier, nameHtml, callout } from './render.mjs';

export function component(name, args, ctx) {
  const fn = COMPONENTS[name];
  if (!fn) {
    ctx.warn(`${ctx.page ? ctx.page.file : ''}: unknown component {{${name}}}`);
    return soon(`component ${name}`);
  }
  return fn(args, ctx);
}

// ---------- helpers ----------

const isHome = (e, ctx) => ctx.page && ctx.page.url === e.page;
const idAttr = (e, ctx) => (isHome(e, ctx) ? ` id="${e.anchor}"` : '');
const headAttrs = (e, ctx, inToc) => (isHome(e, ctx) ? ` data-anchor="${e.anchor}"` : '') + (inToc ? '' : ' data-notoc');

function imagePath(e) {
  const def = KINDS[e.kind];
  if (e.image) return e.image;
  if (!def.folder || e.noImage) return null;
  const folder = e.kind === 'card' && e.type === 'support' ? 'supports' : def.folder;
  return `${folder}/${e.id}`;
}

export function entImage(e, ctx, opts = {}) {
  const p = imagePath(e);
  if (!p) return '';
  const def = KINDS[e.kind];
  const shape = opts.shape || def.shape;
  const what = e.kind === 'card' ? (e.type === 'support' ? 'support card' : 'battle card') : def.label.toLowerCase();
  return ctx.images.picture(p, {
    shape,
    alt: e.name,
    desc: `${e.name} — ${what} ${SHAPES[shape].noun}`,
    page: ctx.page && ctx.page.url,
    iconName: def.icon,
    ...opts,
  });
}

function tierPill(e, ctx) {
  if (!e.tier) return '';
  const lvl = tierLevel(e.tier, ctx);
  return `<span class="tier-pill tier-${lvl}">${esc(tierLabel(e.tier, ctx))}</span>`;
}

function prestigeBadge(e) {
  if (e.eternal === true) return `<span class="badge badge--eternal" title="Kept when you prestige">${icon('eternal')}Eternal</span>`;
  if (e.eternal === false) return `<span class="badge badge--resets" title="Lost when you prestige">${icon('reset')}Resets on prestige</span>`;
  if (isTodo(e.eternal)) return `<span class="badge badge--unknown" title="Not confirmed yet whether this is kept on prestige">${icon('soon')}Prestige status coming soon</span>`;
  return '';
}

function badges(e, ctx) {
  const out = [tierPill(e, ctx), prestigeBadge(e)];
  if (e.best) out.push(`<span class="badge badge--best">${icon('crown')}${esc(e.best === true ? 'Best in slot' : e.best)}</span>`);
  if (e.placeholder) out.push(`<span class="badge badge--unknown">${icon('soon')}Name coming soon</span>`);
  if (e.unverified) out.push(`<span class="badge badge--unknown" title="These numbers still need confirming">${icon('warning')}Needs confirming</span>`);
  if (e.adminOnly) out.push(`<span class="badge badge--admin">${icon('warning')}Admin only</span>`);
  const b = out.filter(Boolean).join('');
  return b ? `<div class="badges">${b}</div>` : '';
}

function facts(obj, ctx, cls = 'facts') {
  if (!obj) return '';
  if (isTodo(obj)) return `<p>${soon(todoNote(obj))}</p>`;
  const rows = Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `<div class="${cls}__row"><dt>${esc(k)}</dt><dd>${rich(v, ctx)}</dd></div>`)
    .join('');
  return rows ? `<dl class="${cls}">${rows}</dl>` : '';
}

// A list of references: "kind:id", {ref, qty}, or free text (Markdown allowed).
function refChips(list, ctx) {
  if (isTodo(list)) return `<p class="sub__soon">${soon(todoNote(list))}</p>`;
  const items = asArray(list)
    .map((x) => {
      if (x && typeof x === 'object') {
        const qty = x.qty != null ? `<span class="qty">${isTodo(x.qty) ? '?' : esc(typeof x.qty === 'number' ? x.qty.toLocaleString('en-US') : x.qty)}×</span>` : '';
        const what = x.ref ? entityLink(x.ref, ctx) : rich(x.text, ctx);
        const note = x.note ? `<span class="chip-note">${rich(x.note, ctx)}</span>` : '';
        return `<li>${qty}${what}${note}</li>`;
      }
      return `<li>${rich(x, ctx)}</li>`;
    })
    .join('');
  return items ? `<ul class="chips">${items}</ul>` : '';
}

function sub(title, inner) {
  return inner ? `<div class="sub"><p class="sub__title">${esc(title)}</p>${inner}</div>` : '';
}

function relationSections(e, ctx) {
  const r = e.rel;
  const links = (list) => (list.length ? refChips(list.map((x) => x.key), ctx) : '');
  let out = '';
  out += sub('Recipe', e.recipe != null ? refChips(e.recipe, ctx) : '');
  out += sub('Cost', e.cost != null ? refChips(e.cost, ctx) : '');
  out += sub('Drops from', e.dropsFrom != null ? refChips(e.dropsFrom, ctx) : '');
  out += sub('Where to get it', e.sources != null ? refChips(e.sources, ctx) : '');
  out += sub('Earned from', e.earnedFrom != null ? refChips(e.earnedFrom, ctx) : '');
  out += sub('Sold at', e.soldAt != null ? refChips(e.soldAt, ctx) : '');
  out += sub('Spent at', e.spentAt != null ? refChips(e.spentAt, ctx) : '');
  out += sub('Found in', e.foundIn != null ? refChips(e.foundIn, ctx) : '');
  out += sub('Accepted currencies', links(r.currencies));
  out += sub('Sells', links(r.sells));
  out += sub('Drops', links(r.drops));
  out += sub('Rewards', links(r.gives));
  out += sub(e.kind === 'card' ? 'Related' : 'Exclusive cards', links(r.cards));
  out += sub('Found here', links(r.contains));
  out += sub(`Cards with this ${e.kind === 'role' ? 'role' : 'trait'} (${r.holders.length})`, r.holders.length ? links(r.holders) : '');
  if (e.kind === 'material' || e.kind === 'currency') {
    out += sub('Used to craft or buy', r.usedIn.length ? links(r.usedIn) : `<p class="sub__soon">${soon('what this is used for')}</p>`);
  } else {
    out += sub('Used for', links(r.usedIn));
  }
  return out;
}

function select(kind, args, ctx) {
  let list = [...ctx.site.entities.values()].filter((e) => e.kind === kind);
  if (args.ids) {
    const ids = args.ids.split(',').map((s) => s.trim());
    list = ids.map((id) => ctx.site.entities.get(`${kind}:${id}`)).filter((e, i) => e || ctx.warn(`${ctx.page.file}: no ${kind} "${ids[i]}"`));
  }
  if (args.type) list = list.filter((e) => e.type === args.type);
  if (args.source) list = list.filter((e) => asArray(e.source).includes(args.source));
  if (args.tier) list = list.filter((e) => String(e.tier) === args.tier);
  if (args.where) {
    const [k, v] = args.where.split('=');
    list = list.filter((e) => String(e[k]) === v);
  }
  return list;
}

const mainFacts = (e) => {
  const f = {};
  if (e.effect != null) f.Effect = e.effect;
  if (e.duration != null) f.Duration = e.duration;
  if (isTodo(e.stats)) f.Stats = e.stats;
  else Object.assign(f, e.stats || {});
  return f;
};

// ---------- item stat card ----------

export function itemCard(e, ctx, opts = {}) {
  const lvl = tierLevel(e.tier, ctx);
  const kindLine = [KINDS[e.kind].label, e.typeLabel].filter(Boolean).map(esc).join(' · ');
  const summary = e.summary ? `<p class="item__summary">${rich(e.summary, ctx)}</p>` : '';
  const body = e.body ? `<div class="item__more">${renderMarkdown(e.body, ctx)}</div>` : '';
  return `<article class="item${lvl ? ` tier-${lvl}` : ''}${opts.compact ? ' item--compact' : ''} reveal" data-rare="${lvl >= 6 ? 1 : 0}"${idAttr(e, ctx)}>
<div class="item__media">${entImage(e, ctx, { sizes: '96px', small: true }) || `<span class="ph ph--icon" aria-hidden="true">${icon(KINDS[e.kind].icon, 'ph__glyph')}</span>`}</div>
<div class="item__body">
<p class="item__kind">${kindLine}</p>
<h3 class="item__name"${headAttrs(e, ctx, opts.toc)}>${nameHtml(e)}</h3>
${badges(e, ctx)}${summary}${facts(mainFacts(e), ctx, 'stats')}${relationSections(e, ctx)}${body}
</div>
</article>`;
}

function items(args, ctx) {
  const list = select(args.kind, args, ctx);
  if (!list.length) return callout('soon', '', `<p>${esc(args.empty || 'Details coming soon.')}</p>`);
  return `<div class="item-grid${args.layout === 'compact' ? ' item-grid--compact' : ''}">${list.map((e) => itemCard(e, ctx, { compact: args.layout === 'compact', toc: args.toc === 'yes' })).join('\n')}</div>`;
}

function item(args, ctx) {
  const e = ctx.site.entities.get(args.ref);
  if (!e) return ctx.warn(`${ctx.page.file}: no entity ${args.ref}`) || soon();
  return itemCard(e, ctx, { toc: args.toc === 'yes' });
}

// ---------- tables ----------

const sortKey = (v) => {
  if (v == null || isTodo(v)) return '';
  if (typeof v === 'number') return String(v);
  const m = String(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? m[0] : String(v).toLowerCase();
};

function table(head, rows, opts = {}) {
  const th = head.map((h) => `<th scope="col"${h.num ? ' data-type="num"' : ''}>${esc(h.label)}</th>`).join('');
  const tr = rows
    .map((r) => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${r.cells.map((c, i) => `<${i === 0 ? 'th scope="row"' : 'td'}${c.sort != null ? ` data-sort="${esc(c.sort)}"` : ''}>${c.html}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`)
    .join('\n');
  return `<div class="table-wrap reveal"><table class="sortable${opts.cls ? ' ' + opts.cls : ''}">${opts.caption ? `<caption>${esc(opts.caption)}</caption>` : ''}<thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

function eternalCell(e) {
  if (e.eternal === true) return { html: `<span class="badge badge--eternal">${icon('eternal')}Eternal</span>`, sort: '1' };
  if (e.eternal === false) return { html: `<span class="badge badge--resets">${icon('reset')}Resets</span>`, sort: '0' };
  return { html: soon('prestige status'), sort: '' };
}

function potionTable(args, ctx) {
  const list = select('potion', args, ctx).sort((a, b) => (a.tierNum || 0) - (b.tierNum || 0));
  const rows = list.map((e) => {
    const lvl = tierLevel(e.tier, ctx);
    return {
      cells: [
        { html: lvl ? `<span class="tier-pill tier-${lvl}">${esc(tierLabel(e.tier, ctx))}</span>` : '', sort: e.tierNum ?? '' },
        { html: entityLink(e.key, ctx) },
        { html: rich(Array.isArray(e.effect) ? e.effect.join(', ') : e.effect ?? 'TODO', ctx) + (e.unverified ? '<abbr class="unconfirmed" title="Needs confirming">?</abbr>' : ''), sort: sortKey(Array.isArray(e.effect) ? e.effect[0] : e.effect) },
        { html: rich(e.duration ?? 'TODO', ctx), sort: sortKey(e.duration) },
        eternalCell(e),
      ],
    };
  });
  return table(
    [{ label: 'Tier', num: true }, { label: 'Potion' }, { label: 'Effect', num: true }, { label: 'Duration', num: true }, { label: 'On prestige' }],
    rows
  );
}

// Side-by-side comparison of any kind's stats.
function compare(args, ctx) {
  const list = select(args.kind, args, ctx);
  const cols = args.cols ? args.cols.split(',').map((s) => s.trim()) : [...new Set(list.flatMap((e) => Object.keys(mainFacts(e))))];
  const rows = list.map((e) => {
    const f = mainFacts(e);
    return {
      cls: tierLevel(e.tier, ctx) ? `tier-${tierLevel(e.tier, ctx)}` : '',
      cells: [{ html: entityLink(e.key, ctx), sort: e.name }, ...cols.map((c) => ({ html: f[c] == null ? '<span class="dim">—</span>' : rich(f[c], ctx), sort: sortKey(f[c]) })), ...(args.eternal === 'no' ? [] : [eternalCell(e)])],
    };
  });
  return table([{ label: KINDS[args.kind].label }, ...cols.map((c) => ({ label: c, num: true })), ...(args.eternal === 'no' ? [] : [{ label: 'On prestige' }])], rows, { caption: args.caption });
}

// ---------- game cards ----------

function statVal(v) {
  if (v == null || isTodo(v)) return `<span class="q" title="Coming soon">?</span>`;
  return esc(typeof v === 'number' ? gameNum(v) : v);
}

export function gameCard(e, ctx, opts = {}) {
  const lvl = cardTier(e, ctx);
  const odds = typeof e.rarity === 'number' ? formatOdds(e.rarity) : null;
  const src = e.source ? asArray(e.source)[0] : null;
  const srcEnt = src ? ctx.site.entities.get(src) : null;
  const ability = e.ability
    ? `<span class="gcard__ability-name">${rich(e.ability.name ?? 'TODO', ctx)}</span><span class="gcard__ability">${rich(e.ability.text ?? 'TODO', ctx)}</span>`
    : `<span class="gcard__ability-name">Ability</span><span class="gcard__ability">${soon('ability')}</span>`;
  const typeLabel = e.type === 'support' ? 'Support card' : e.type === 'battle' ? 'Battle card' : 'Card';
  // A real card image already shows the name, HP and DMG, so skip our overlay.
  const hasArt = ctx.images.has(imagePath(e));
  return `<div class="gcard-wrap reveal"${idAttr(e, ctx)}${opts.data || ''}>
<button class="gcard${lvl ? ` tier-${lvl}` : ''}${hasArt ? ' gcard--art' : ''}" type="button" aria-pressed="false" data-rare="${lvl >= 6 ? 1 : 0}" aria-label="${esc(e.name)}. Press to flip and read its ability.">
<span class="gcard__inner">
<span class="gcard__face gcard__front">
<span class="gcard__art">${entImage(e, ctx, { sizes: '(max-width: 600px) 46vw, 240px', small: true })}</span>
<span class="gcard__top">${e.border ? `<span class="gcard__border">${esc(e.border)}</span>` : ''}<span class="gcard__rarity">${odds ? esc(odds) : 'Rarity ?'}</span></span>
<span class="gcard__plate"><span class="gcard__name">${nameHtml(e)}</span>
<span class="gcard__stats"><span class="gcard__stat gcard__stat--hp" title="HP">${icon('heart')}${statVal(e.hp)}</span><span class="gcard__stat gcard__stat--dmg" title="DMG">${icon('sword')}${statVal(e.dmg)}</span></span></span>
<span class="gcard__shine" aria-hidden="true"></span>
</span>
<span class="gcard__face gcard__back" aria-hidden="true">
<span class="gcard__back-kind">${typeLabel}</span>${ability}
<span class="gcard__back-src">${srcEnt ? esc(`From ${srcEnt.name}`) : 'General pool'}</span>
</span>
</span>
</button>
<p class="gcard-meta">${isHome(e, ctx) ? `<span>${typeLabel}</span>` : `<a class="gcard-meta__link" href="${e.url}">${nameHtml(e)}</a>`}<span class="gcard-meta__src">${srcEnt ? entityLink(srcEnt.key, ctx) : src ? rich(src, ctx) : ''}</span></p>
</div>`;
}

function cards(args, ctx) {
  const list = select('card', args, ctx);
  if (!list.length) return callout('soon', '', `<p>${esc(args.empty || 'No cards listed here yet.')}</p>`);
  return `<div class="card-grid">${list.map((e) => gameCard(e, ctx)).join('\n')}</div>`;
}

function card(args, ctx) {
  const e = ctx.site.entities.get(args.ref);
  return e ? gameCard(e, ctx) : soon();
}

function cardTable(args, ctx) {
  const list = select('card', args, ctx);
  const rows = list.map((e) => {
    const src = e.source ? asArray(e.source)[0] : null;
    return {
      cells: [
        { html: entityLink(e.key, ctx), sort: e.name },
        { html: e.type === 'support' ? 'Support' : e.type === 'battle' ? 'Battle' : soon('card type'), sort: e.type || '' },
        { html: typeof e.rarity === 'number' ? esc(formatOdds(e.rarity)) : soon('rarity'), sort: typeof e.rarity === 'number' ? e.rarity : '' },
        { html: e.hp == null || isTodo(e.hp) ? (e.type === 'support' ? '<span class="dim">—</span>' : soon('HP')) : esc(statText(e.hp)), sort: parseShort(e.hp) ?? '' },
        { html: e.dmg == null || isTodo(e.dmg) ? (e.type === 'support' ? '<span class="dim">—</span>' : soon('DMG')) : esc(statText(e.dmg)), sort: parseShort(e.dmg) ?? '' },
        { html: src ? rich(src, ctx) : soon('source'), sort: src || '' },
      ],
    };
  });
  return table([{ label: 'Card' }, { label: 'Type' }, { label: 'Rarity', num: true }, { label: 'HP', num: true }, { label: 'DMG', num: true }, { label: 'Source' }], rows);
}

// ---------- panels (weathers, packs, bosses, worlds, places, stats, ...) ----------

export function panelHtml(e, ctx, opts = {}) {
  const lvl = e.kind === 'card' ? cardTier(e, ctx) : tierLevel(e.tier, ctx);
  const def = KINDS[e.kind];
  const h = opts.heading || 3;
  const media = def.folder && opts.media !== false ? `<div class="panel__media">${entImage(e, ctx, { sizes: '(max-width: 800px) 92vw, 360px' })}</div>` : '';
  let extra = '';
  if (e.kind === 'boss' && e.secret) extra += routeGuide(e, ctx);
  if (e.levels) extra += sub('Levels', ladderHtml(e.levels, ctx));
  if (e.stock != null) extra += stockTable(e, ctx);
  return `<section class="panel panel--${def.shape || 'plain'}${lvl ? ` tier-${lvl}` : ''} reveal"${idAttr(e, ctx)}>
${media}<div class="panel__body">
<p class="panel__kind">${icon(def.icon)}${esc(e.typeLabel || def.label)}</p>
<h${h} class="panel__name"${headAttrs(e, ctx, opts.toc)}>${nameHtml(e)}</h${h}>
${badges(e, ctx)}${e.summary ? `<p class="panel__summary">${rich(e.summary, ctx)}</p>` : ''}${facts(e.facts || (e.stats ? mainFacts(e) : null), ctx)}${e.body ? `<div class="panel__more">${renderMarkdown(e.body, ctx)}</div>` : ''}${relationSections(e, ctx)}
</div>${extra ? `<div class="panel__extra">${extra}</div>` : ''}
</section>`;
}

function panels(args, ctx) {
  const list = select(args.kind, args, ctx);
  if (!list.length) return callout('soon', '', `<p>${esc(args.empty || 'Details coming soon.')}</p>`);
  return `<div class="panel-list${args.layout ? ` panel-list--${args.layout}` : ''}">${list.map((e) => panelHtml(e, ctx, { heading: +args.heading || 3, toc: args.toc === 'yes' })).join('\n')}</div>`;
}

function panel(args, ctx) {
  const e = ctx.site.entities.get(args.ref);
  if (!e) return ctx.warn(`${ctx.page.file}: no entity ${args.ref}`) || soon();
  return panelHtml(e, ctx, { heading: +args.heading || 3, toc: args.toc === 'yes', media: args.media !== 'no' });
}

function stockTable(e, ctx) {
  if (isTodo(e.stock) || !asArray(e.stock).length) {
    return sub('Stock', `<p class="sub__soon">${soon(isTodo(e.stock) ? todoNote(e.stock) : 'full stock list')}</p>`);
  }
  const rows = e.stock.map((s) => ({
    cells: [
      { html: s.item ? rich(s.item, ctx) : soon('item'), sort: s.item },
      { html: s.cost != null ? (Array.isArray(s.cost) ? refChips(s.cost, ctx) : rich(s.cost, ctx)) : soon('cost'), sort: sortKey(Array.isArray(s.cost) ? s.cost[0] && s.cost[0].qty : s.cost) },
      { html: s.limit != null ? rich(s.limit, ctx) : '<span class="dim">—</span>' },
      { html: s.notes ? rich(s.notes, ctx) : '<span class="dim">—</span>' },
    ],
  }));
  return sub('Stock', table([{ label: 'Item' }, { label: 'Cost', num: true }, { label: 'Limit' }, { label: 'Notes' }], rows));
}

function routeGuide(e, ctx) {
  const n = e.routeImages || 3;
  const imgs = Array.from({ length: n }, (_, i) => ({ path: `routes/${e.id}-${i + 1}`, caption: (e.routeCaptions || [])[i] || `Route step ${i + 1}` }));
  const steps = e.route
    ? `<ol class="route-steps">${asArray(e.route).map((s) => `<li>${rich(s, ctx)}</li>`).join('')}</ol>`
    : `<p>${soon('route directions')}</p>`;
  return `<div class="route"><p class="sub__title">${icon('place')}Route guide</p>${steps}${galleryHtml(imgs, ctx, `${e.name} route`)}${videoHtml({ src: `routes/${e.id}`, poster: `routes/${e.id}-poster`, title: `${e.name} route video` }, ctx)}</div>`;
}

// ---------- ladders and progress ----------

function ladderHtml(steps, ctx) {
  if (isTodo(steps)) return `<p class="sub__soon">${soon(todoNote(steps))}</p>`;
  steps = asArray(steps);
  if (!steps.length) return `<p class="sub__soon">${soon()}</p>`;
  const n = steps.length;
  const li = steps
    .map((s, i) => {
      const lvl = s.tier ? tierLevel(s.tier, ctx) : Math.min(8, 1 + Math.round((i / Math.max(1, n - 1)) * 6));
      const detail = s.detail != null ? (Array.isArray(s.detail) ? refChips(s.detail, ctx) : `<div class="ladder__detail">${rich(s.detail, ctx)}</div>`) : '';
      return `<li class="ladder__step tier-${lvl}"><span class="ladder__node" aria-hidden="true"></span><div class="ladder__body"><p class="ladder__label">${rich(s.label, ctx)}</p>${s.title != null ? `<p class="ladder__title">${rich(s.title, ctx)}</p>` : ''}${detail}</div></li>`;
    })
    .join('');
  return `<ol class="ladder reveal">${li}</ol>`;
}

function getPath(obj, p) {
  return p.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function ladder(args, ctx) {
  const [file, ...rest] = args.src.split('.');
  const data = ctx.site.extra[file];
  if (!data) return ctx.warn(`${ctx.page.file}: ladder src ${args.src} not found`) || soon();
  const steps = rest.length ? getPath(data, rest.join('.')) : data;
  return ladderHtml(steps, ctx);
}

function progress(args, ctx) {
  const value = Number(args.value);
  const max = Number(args.max);
  const known = Number.isFinite(value) && Number.isFinite(max) && max > 0;
  const lvl = args.tier ? tierLevel(args.tier, ctx) : 5;
  return `<div class="progress tier-${lvl} reveal"${known ? ` data-value="${value}" data-max="${max}"` : ''}>
<div class="progress__head"><span class="progress__label">${rich(args.label || '', ctx)}</span><span class="progress__num">${known ? `${esc(args.value)} / ${esc(args.max)}${args.suffix ? ' ' + esc(args.suffix) : ''}` : soon()}</span></div>
<div class="progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="${known ? max : 0}" aria-valuenow="${known ? value : 0}" aria-label="${esc(args.label || 'Progress')}"><span class="progress__fill"></span></div>
${args.note ? `<p class="progress__note">${rich(args.note, ctx)}</p>` : ''}</div>`;
}

// ---------- media ----------

function galleryHtml(imgs, ctx, label) {
  const figs = imgs
    .map((im) => {
      const shape = im.shape || 'wide';
      const pic = ctx.images.picture(im.path, { shape, alt: im.caption || label, desc: im.desc || `${label}: ${im.caption}`, page: ctx.page.url, sizes: '(max-width: 700px) 90vw, 320px' });
      const big = ctx.images.largestUrl(im.path, shape);
      const inner = big ? `<a class="gallery__link" href="${big}" data-lightbox data-caption="${esc(im.caption || '')}">${pic}</a>` : pic;
      return `<figure class="gallery__item">${inner}${im.caption ? `<figcaption>${rich(im.caption, ctx)}</figcaption>` : ''}</figure>`;
    })
    .join('');
  return `<div class="gallery reveal">${figs}</div>`;
}

function gallery(args, ctx) {
  const imgs = (args.images || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [path, caption] = s.split('|').map((x) => x.trim());
      return { path, caption, shape: args.shape };
    });
  return galleryHtml(imgs, ctx, args.label || 'Gallery');
}

function videoHtml({ src, poster, title, caption }, ctx) {
  const sources = ctx.images.video(src);
  ctx.images.registerVideo(src, title, ctx.page.url);
  const posterUrl = poster ? ctx.images.largestUrl(poster, 'wide') : null;
  if (poster) ctx.images.register(poster, { desc: `${title} — poster frame (a still from the video)`, shape: 'wide', page: ctx.page.url });
  const cap = caption ? `<figcaption>${rich(caption, ctx)}</figcaption>` : '';
  if (!sources.length) {
    return `<figure class="video reveal"><div class="video__ph" role="img" aria-label="${esc(title)}: video coming soon">${icon('play', 'video__play')}<span>${esc(title)}</span><span class="soon">${icon('soon')}Video coming soon</span></div>${cap}</figure>`;
  }
  return `<figure class="video reveal"><video controls preload="none" playsinline${posterUrl ? ` poster="${posterUrl}"` : ''} aria-label="${esc(title)}">${sources.map((s) => `<source src="${s.url}" type="${s.type}">`).join('')}Your browser cannot play this video.</video>${cap}</figure>`;
}

function video(args, ctx) {
  return videoHtml({ src: args.src, poster: args.poster, title: args.title || 'Video', caption: args.caption }, ctx);
}

function image(args, ctx) {
  const shape = args.shape || 'shot';
  const pic = ctx.images.picture(args.src, { shape, alt: args.alt || '', desc: args.desc || args.alt, page: ctx.page.url, sizes: args.sizes || '(max-width: 900px) 92vw, 760px' });
  const big = ctx.images.largestUrl(args.src, shape);
  const inner = big ? `<a class="gallery__link" href="${big}" data-lightbox data-caption="${esc(args.caption || args.alt || '')}">${pic}</a>` : pic;
  return `<figure class="figure figure--${shape} reveal">${inner}${args.caption ? `<figcaption>${rich(args.caption, ctx)}</figcaption>` : ''}</figure>`;
}

function soonBlock(args, ctx) {
  const note = args._0 || args.note || '';
  return callout('soon', args.title || '', `<p>${note ? rich(note, ctx) : 'We are still collecting this information.'}</p>`);
}

function count(args, ctx) {
  return String(select(args.kind, args, ctx).length);
}

// A compact "linked index" of every entity of a kind, for overview pages.
function index(args, ctx) {
  const list = select(args.kind, args, ctx);
  return `<ul class="chips chips--index reveal">${list.map((e) => `<li>${entityLink(e.key, ctx)}</li>`).join('')}</ul>`;
}

function tierLabelComp(args, ctx) {
  const lvl = tierLevel(args.t, ctx);
  return `<span class="tier-pill tier-${lvl}">${esc(tierLabel(args.t, ctx))}</span>`;
}

const statText = (v) => (typeof v === 'number' ? gameNum(v) : String(v));

function variants(ctx) {
  return [...ctx.site.entities.values()].filter((e) => e.kind === 'border' && e.rarityMult != null).sort((a, b) => a.order - b.order);
}

// Every variant for one card: rarity, DMG, HP and each ability hit that
// scales with ATK, all multiplied by the variant.
function variantTable(e, ctx) {
  const rows = variants(ctx);
  const baseRarity = typeof e.rarity === 'number' ? e.rarity : null;
  const dmg = parseShort(e.dmg);
  const hp = parseShort(e.hp);
  const isBattle = e.type !== 'support';
  const implied = ctx.site.config.countImpliedDamage ? asArray(e.impliedScaling) : [];
  const scale = isBattle ? [...asArray(e.atkScaling), ...implied].filter((x) => x && typeof x.pct === 'number') : [];
  const head = [{ label: 'Variant' }, { label: 'Rarity', num: true }];
  if (isBattle) head.push({ label: 'DMG', num: true }, { label: 'HP', num: true });
  for (const x of scale) head.push({ label: `${x.label} (${x.pct}%)`, num: true });
  const body = rows.map((v) => {
    const cells = [{ html: `<span class="tier-pill tier-${tierLevel(v.tier, ctx)}">${esc(v.name)}</span>`, sort: v.order }];
    if (baseRarity) cells.push({ html: esc(`1 in ${gameNum(baseRarity * v.rarityMult)}`), sort: baseRarity * v.rarityMult });
    else cells.push({ html: `<span class="mono">x${esc(gameNum(v.rarityMult))}</span>`, sort: v.rarityMult });
    if (isBattle) {
      cells.push(dmg != null ? { html: esc(gameNum(dmg * v.statMult)), sort: dmg * v.statMult } : { html: soon('DMG'), sort: '' });
      cells.push(hp != null ? { html: esc(gameNum(hp * v.statMult)), sort: hp * v.statMult } : { html: soon('HP'), sort: '' });
      for (const x of scale) {
        const val = dmg != null ? (dmg * v.statMult * x.pct) / 100 : null;
        cells.push(val != null ? { html: esc(gameNum(val)), sort: val } : { html: soon(), sort: '' });
      }
    }
    return { cells };
  });
  return table(head, body, { cls: 'variant-table' });
}

function variantRules(args, ctx) {
  const rows = variants(ctx).map((v) => ({
    cells: [
      { html: `<span class="tier-pill tier-${tierLevel(v.tier, ctx)}">${esc(v.name)}</span>`, sort: v.order },
      { html: `<span class="mono">x${esc(v.rarityMult.toLocaleString('en-US'))}</span>`, sort: v.rarityMult },
      { html: `<span class="mono">x${esc(v.statMult.toLocaleString('en-US'))}</span>`, sort: v.statMult },
      { html: v.combo ? v.combo.map((id) => entityLink(`border:${id}`, ctx)).join(' × ') : v.id === 'rainbow' ? 'Standalone' : '<span class="dim">—</span>' },
    ],
  }));
  return table([{ label: 'Variant' }, { label: 'Rarity multiplier', num: true }, { label: 'Stat multiplier (DMG and HP)', num: true }, { label: 'Made of' }], rows);
}

function cardProfile(args, ctx) {
  const e = ctx.site.entities.get(args.ref);
  if (!e) return soon();
  const src = e.source ? asArray(e.source)[0] : null;
  const isBattle = e.type !== 'support';
  const facts = {
    Type: isBattle ? 'Battle card' : 'Support card',
    Rarity: typeof e.rarity === 'number' ? formatOdds(e.rarity) : 'TODO(rarity)',
    Origin: originName(e, ctx) || 'TODO(where this card comes from)',
  };
  if (src) facts.Source = src;
  if (isBattle) {
    facts['Base DMG'] = e.dmg != null ? statText(e.dmg) : 'TODO';
    facts['Base HP'] = e.hp != null ? statText(e.hp) : 'TODO';
  }
  const factHtml = `<dl class="facts">${Object.entries(facts).map(([k, v]) => `<div class="facts__row"><dt>${esc(k)}</dt><dd>${rich(v, ctx)}</dd></div>`).join('')}</dl>`;
  const traitChips = asArray(e.traits).length ? refChips(e.traits, ctx) : '';
  const roleChips = asArray(e.roles).length ? refChips(asArray(e.roles).map((r) => `role:${r}`), ctx) : '';
  const ability = e.ability
    ? `<h2>Ability: ${esc(e.ability.name || '')}</h2><div class="ability">${renderMarkdown(e.ability.text || 'TODO(ability text)', ctx)}</div>`
    : `<h2>Ability</h2><p>${soon('ability')}</p>`;
  const scaleNote = isBattle && asArray(e.atkScaling).length
    ? `<p class="table-note">Ability columns show the damage of each hit for that variant: the variant's DMG times the ability's percentage of ATK. In-game numbers can differ slightly because of rounding.</p>`
    : `<p class="table-note">In-game numbers can differ slightly because of rounding.</p>`;
  const notes = e.notes ? callout('note', 'Notes', `<p>${rich(e.notes, ctx)}</p>`) : '';
  return `<div class="profile">
<div class="profile__card">${gameCard(e, ctx)}</div>
<div class="profile__info">
${badges(e, ctx)}${factHtml}
${roleChips ? `<div class="sub"><p class="sub__title">Roles <a class="sub__help" href="/cards/roles/">what are these?</a></p>${roleChips}</div>` : ''}
${traitChips ? `<div class="sub"><p class="sub__title">Traits</p>${traitChips}</div>` : ''}
</div>
</div>
${ability}
<h2>Variants</h2>
<p class="table-lede">Each variant multiplies the base rarity and stats. ${entityLink('border:base', ctx, { thumb: false }).replace(/>Base</, '>How variants work<')}</p>
${variantTable(e, ctx)}${scaleNote}${notes}`;
}

function origins(ctx) {
  return asArray(ctx.site.extra.origins).filter((o) => o && o.id);
}
function originName(e, ctx) {
  const o = origins(ctx).find((x) => x.id === e.origin);
  return o ? o.name : null;
}

// The Card Database browser: search, filters and sorting, all in the browser.
// Every card is in the page; site.js shows or hides them. Without JS, all show.
function cardBrowser(args, ctx) {
  const list = select('card', args, ctx).sort((a, b) => a.name.localeCompare(b.name));
  const roles = [...ctx.site.entities.values()].filter((x) => x.kind === 'role').sort((a, b) => (a.order || 0) - (b.order || 0));
  const traits = [...ctx.site.entities.values()].filter((x) => x.kind === 'trait').sort((a, b) => a.name.localeCompare(b.name));
  const plain = (t) => String(t || '').replace(/\*\*|__|`|#|\[\[|\]\]|[-•]\s/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const cards = list
    .map((e) => {
      const dmg = parseShort(e.dmg);
      const hp = parseShort(e.hp);
      const data = [
        ['name', e.name.toLowerCase()],
        ['text', plain(`${e.ability ? e.ability.name : ''} ${e.ability ? e.ability.text : ''}`)],
        ['type', e.type || ''],
        ['origin', e.origin || 'unknown'],
        ['roles', asArray(e.roles).join(' ')],
        ['main', asArray(e.roles)[0] || ''],
        ['traits', asArray(e.traits).map((t) => t.replace('trait:', '')).join(' ')],
        ['dmg', dmg ?? ''],
        ['hp', hp ?? ''],
        ['rarity', typeof e.rarity === 'number' ? e.rarity : ''],
      ]
        .map(([k, v]) => ` data-${k}="${esc(v)}"`)
        .join('');
      return gameCard(e, ctx, { data });
    })
    .join('\n');
  const opt = (v, label) => `<option value="${esc(v)}">${esc(label)}</option>`;
  return `<div class="browser" data-browser>
<div class="browser__bar">
<label class="browser__search">${icon('search')}<input type="search" data-f="q" placeholder="Search name or ability…" autocomplete="off" spellcheck="false" aria-label="Search cards by name or ability"></label>
<label class="browser__select"><span>Type</span><select data-f="type">${opt('', 'All')}${opt('battle', 'Battle')}${opt('support', 'Support')}</select></label>
<label class="browser__select"><span>Origin</span><select data-f="origin">${opt('', 'All')}${origins(ctx).map((o) => opt(o.id, o.name)).join('')}${opt('unknown', 'Not known yet')}</select></label>
<label class="browser__select"><span>Trait</span><select data-f="trait">${opt('', 'Any')}${traits.map((t) => opt(t.id, t.name)).join('')}</select></label>
<label class="browser__select"><span>Sort</span><select data-f="sort">${opt('name', 'Name A–Z')}${opt('dmg-desc', 'DMG: high to low')}${opt('dmg-asc', 'DMG: low to high')}${opt('hp-desc', 'HP: high to low')}${opt('rarity-desc', 'Rarest first')}</select></label>
</div>
<div class="browser__roles" role="group" aria-label="Filter by role">
<span class="browser__label">Roles</span>
${roles.map((r) => `<button type="button" class="role-chip" data-role="${esc(r.id)}" aria-pressed="false" title="${esc(r.summary || '')}">${esc(r.name)}</button>`).join('')}
<label class="browser__main"><input type="checkbox" data-f="mainonly"> Main role only</label>
<button type="button" class="browser__reset" data-reset hidden>Clear filters</button>
</div>
<p class="browser__count" aria-live="polite" data-count>${list.length} cards</p>
<div class="card-grid" data-grid>
${cards}
</div>
<p class="browser__empty" data-empty hidden>No cards match these filters.</p>
</div>`;
}

export const COMPONENTS = {
  'tier-label': tierLabelComp,
  'card-profile': cardProfile,
  'card-browser': cardBrowser,
  'variant-rules': variantRules,
  items,
  item,
  'potion-table': potionTable,
  compare,
  cards,
  card,
  'card-table': cardTable,
  panels,
  panel,
  ladder,
  progress,
  gallery,
  video,
  image,
  soon: soonBlock,
  count,
  index,
};
