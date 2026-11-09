// Page shell: header, sidebar, breadcrumbs, "On this page", prev/next, footer,
// plus the home page layout. No inline scripts or styles anywhere (strict CSP).
import { esc } from './util.mjs';
import { icon } from './icons.mjs';
import { renderMarkdown, rich, soon } from './render.mjs';

const CSP_META = "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'none'";

function head({ title, description, site, assets, url }) {
  const full = url === '/' ? site.config.name : `${title} — ${site.config.name}`;
  return `<!doctype html>
<html lang="en" data-icons="${assets.icons}" data-search="${assets.search}" data-audio="${esc(JSON.stringify(assets.audio))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP_META}">
<meta name="referrer" content="no-referrer">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description || site.config.description)}">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0b0a12">
<link rel="icon" href="${assets.favicon}" type="image/svg+xml">
${assets.preload.map((f) => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`).join('\n')}
<link rel="stylesheet" href="${assets.css}">
<script src="${assets.boot}"></script>
<script src="${assets.js}" defer></script>
${assets.dev ? `<script src="${assets.dev}" defer></script>` : ''}
</head>`;
}

function logo() {
  return `<svg class="brand__mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><defs><linearGradient id="lg-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe3a3"/><stop offset=".55" stop-color="#e2a93b"/><stop offset="1" stop-color="#9b5cff"/></linearGradient></defs><rect x="9" y="4" width="22" height="32" rx="4" fill="none" stroke="url(#lg-a)" stroke-width="2.4" transform="rotate(-8 20 20)"/><rect x="11" y="6" width="22" height="32" rx="4" fill="#15131f" stroke="url(#lg-a)" stroke-width="2.4" transform="rotate(7 22 22)"/><path d="M22 14l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.7 5.4-.6z" fill="url(#lg-a)" transform="rotate(7 22 22)"/></svg>`;
}

function header(site) {
  return `<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
<button class="icon-btn menu-btn" type="button" aria-controls="sidebar" aria-expanded="false" aria-label="Open menu">${icon('menu')}</button>
<a class="brand" href="/" aria-label="${esc(site.config.name)} home">${logo()}<span class="brand__text"><span class="brand__name">Card Battles</span><span class="brand__sub">Prestige Wiki</span></span></a>
<button class="search-trigger" type="button" data-search-open aria-haspopup="dialog">${icon('search')}<span class="search-trigger__text">Search the wiki</span><kbd>Ctrl K</kbd></button>
<span class="topbar__spacer"></span>
<a class="update-chip" href="/update-3/" title="What's new">${icon('spark')}Update ${esc(site.config.currentUpdate)}</a>
<button class="icon-btn sound-toggle" type="button" aria-pressed="false" aria-label="Sound effects" title="Sound effects: off">${icon('sound-off', 'sound-off')}${icon('sound-on', 'sound-on')}</button>
</header>`;
}

function sidebar(site, current) {
  const groups = site.nav
    .map(
      (g) => `<div class="nav-group"><p class="nav-group__label">${icon(g.icon || 'book')}${esc(g.label)}</p><ul>${g.items
        .map((p) => `<li><a href="${p.url}"${p.url === current ? ' aria-current="page"' : ''}>${esc(p.fm.navTitle || p.title)}</a></li>`)
        .join('')}</ul></div>`
    )
    .join('');
  return `<nav id="sidebar" class="sidebar" aria-label="Wiki sections"><div class="sidebar__inner"><a class="nav-home${current === '/' ? ' is-current' : ''}" href="/"${current === '/' ? ' aria-current="page"' : ''}>${icon('home')}Home</a>${groups}<p class="sidebar__foot">Unofficial fan wiki</p></div></nav><div class="scrim" data-close-nav></div>`;
}

function footer(site) {
  return `<footer class="footer"><div class="footer__inner">
<p><strong>${esc(site.config.name)}</strong> is an unofficial, fan-made reference. It is not affiliated with Roblox Corporation or the developers of Card Battles: Prestige. Game names and images belong to their owners.</p>
<p class="footer__small">No accounts, no cookies, no tracking. Everything on this site is served from this site.</p>
</div></footer>
<dialog class="search" id="search-dialog" aria-label="Search the wiki">
<div class="search__bar">${icon('search')}<input id="search-input" type="search" placeholder="Search cards, items, materials, pages…" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="search-results" aria-autocomplete="list"><button class="search__close" type="button" data-search-close aria-label="Close search"><kbd>Esc</kbd></button></div>
<ul id="search-results" class="search__results" role="listbox" aria-label="Results"></ul>
<p class="search__hint"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></p>
</dialog>
<dialog class="lightbox" id="lightbox" aria-label="Image viewer"><button class="icon-btn lightbox__close" type="button" data-lightbox-close aria-label="Close image">${icon('close')}</button><img alt="" hidden><p class="lightbox__cap"></p></dialog>
<div class="toast" role="status" aria-live="polite"></div>`;
}

function tocList(toc) {
  return `<ol>${toc.map((t) => `<li class="toc__l${t.lvl}"><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol>`;
}

export function layoutPage({ page, site, assets, html, toc, prev, next, ctx }) {
  const fm = page.fm;
  const group = site.nav.find((g) => g.label === page.group);
  const updated = fm.updatedFor ?? site.config.currentUpdate;
  const tocBlock = toc.length
    ? `<aside class="toc" aria-label="On this page"><p class="toc__title">On this page</p>${tocList(toc)}</aside>`
    : '<aside class="toc toc--empty" aria-hidden="true"></aside>';
  const tocInline = toc.length ? `<details class="toc-inline"><summary>${icon('list')}On this page</summary>${tocList(toc)}</details>` : '';
  const pager = `<nav class="pager" aria-label="Previous and next page">${
    prev ? `<a class="pager__link pager__prev" href="${prev.url}"><span class="pager__dir">${icon('chev-left')}Previous</span><span class="pager__title">${esc(prev.title)}</span></a>` : '<span></span>'
  }${next ? `<a class="pager__link pager__next" href="${next.url}"><span class="pager__dir">Next${icon('chev-right')}</span><span class="pager__title">${esc(next.title)}</span></a>` : '<span></span>'}</nav>`;
  return `${head({ title: page.title, description: fm.description, site, assets, url: page.url })}
<body class="kind-page">
${header(site)}
<div class="shell">
${sidebar(site, page.url)}
<main id="main" class="main" tabindex="-1">
<div class="page">
<article class="article">
<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li>${group ? `<li><span>${esc(group.label)}</span></li>` : ''}<li><span aria-current="page">${esc(page.title)}</span></li></ol></nav>
<header class="page-head">
<p class="page-head__group">${icon(fm.icon || (group && group.icon) || 'book')}${esc(group ? group.label : '')}</p>
<h1>${esc(page.title)}</h1>
${fm.description ? `<p class="page-head__lede">${rich(fm.description, ctx)}</p>` : ''}
<p class="updated"><span class="updated__dot" aria-hidden="true"></span>Last updated for Update ${esc(updated)}</p>
</header>
${tocInline}
<div class="prose">
${html}
</div>
${pager}
</article>
${tocBlock}
</div>
</main>
</div>
${footer(site)}
</body>
</html>
`;
}

export function layoutHome({ page, site, assets, ctx }) {
  const h = site.home;
  const count = (kind) => [...site.entities.values()].filter((e) => e.kind === kind && !e.placeholder).length;
  const stats = h.stats
    .map((s) => `<li><span class="hero__stat-num">${esc(s.value ?? count(s.count))}</span><span class="hero__stat-label">${esc(s.label)}</span></li>`)
    .join('');
  const quick = h.quickLinks
    .map(
      (q, i) => `<a class="quick tilt tier-${q.tier} reveal" href="${q.href}" data-sound="tick"><span class="quick__icon">${icon(q.icon)}</span><span class="quick__title">${esc(q.title)}</span><span class="quick__blurb">${esc(q.blurb)}</span><span class="quick__go">${icon('arrow-right')}</span><span class="quick__shine" aria-hidden="true"></span></a>`
    )
    .join('');
  const steps = h.startHere
    .map(
      (s, i) => `<li class="path__step reveal"><span class="path__num">${i + 1}</span><div><a class="path__title" href="${s.href}">${esc(s.title)}</a><p>${rich(s.text, ctx)}</p></div></li>`
    )
    .join('');
  const news = h.newInUpdate.items.length
    ? `<ul class="news">${h.newInUpdate.items.map((n) => `<li>${rich(n, ctx)}</li>`).join('')}</ul>`
    : `<p class="news-panel__soon">${soon('Update 3 changes')}</p><p class="news-panel__text">The list of Update ${esc(site.config.currentUpdate)} changes is on its way. Every page already covers Update ${esc(site.config.currentUpdate)}.</p>`;
  const browse = site.nav
    .map(
      (g) => `<div class="browse__group reveal"><p class="browse__label">${icon(g.icon)}${esc(g.label)}</p><ul>${g.items.map((p) => `<li><a href="${p.url}">${esc(p.fm.navTitle || p.title)}</a></li>`).join('')}</ul></div>`
    )
    .join('');
  const heroCard = (cls, ic, label) =>
    `<span class="hero-card ${cls}"><span class="hero-card__inner"><span class="hero-card__emblem">${icon(ic)}</span><span class="hero-card__label">${label}</span><span class="hero-card__shine"></span></span></span>`;
  const onPage = [
    ['quick-links', 'Most-used pages'],
    ['start-here', 'Start here'],
    ['new-in-update-3', `New in Update ${site.config.currentUpdate}`],
    ['browse', 'Browse everything'],
  ];
  return `${head({ title: page.title, description: page.fm.description, site, assets, url: '/' })}
<body class="kind-home">
${header(site)}
<div class="shell">
${sidebar(site, '/')}
<main id="main" class="main main--home" tabindex="-1">
<section class="hero">
<div class="hero__text">
<p class="eyebrow">${icon('spark')}Fan wiki · Update ${esc(site.config.currentUpdate)}</p>
<h1 class="hero__title">Card Battles<span>Prestige</span></h1>
<p class="hero__lede">${esc(h.tagline)}</p>
<button class="hero-search" type="button" data-search-open aria-haspopup="dialog">${icon('search')}<span>Search cards, items, materials, bosses…</span><kbd>Ctrl K</kbd></button>
<ul class="hero__stats">${stats}</ul>
</div>
<div class="hero__cards" aria-hidden="true">${heroCard('hero-card--a tier-4', 'potion', 'Potions')}${heroCard('hero-card--b tier-7', 'tower', 'Prestige')}${heroCard('hero-card--c tier-6', 'boss', 'Bosses')}</div>
</section>
<nav class="onpage" aria-label="On this page"><span class="onpage__label">On this page</span>${onPage.map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join('')}</nav>
<section class="home-section" aria-labelledby="quick-links"><h2 id="quick-links">Most-used pages<a class="h-anchor" href="#quick-links" aria-label="Copy link to this section" data-copy>${icon('link')}</a></h2><div class="quick-grid">${quick}</div></section>
<div class="home-split">
<section class="home-section start" aria-labelledby="start-here"><h2 id="start-here">Start here<a class="h-anchor" href="#start-here" aria-label="Copy link to this section" data-copy>${icon('link')}</a></h2><p class="home-section__lede">${esc(h.startHereIntro)}</p><ol class="path">${steps}</ol></section>
<section class="home-section news-panel reveal" aria-labelledby="new-in-update-3"><h2 id="new-in-update-3">${icon('spark')}New in Update ${esc(site.config.currentUpdate)}<a class="h-anchor" href="#new-in-update-3" aria-label="Copy link to this section" data-copy>${icon('link')}</a></h2>${news}<a class="news-panel__more" href="/update-3/">Read the Update ${esc(site.config.currentUpdate)} page${icon('arrow-right')}</a></section>
</div>
<section class="home-section" aria-labelledby="browse"><h2 id="browse">Browse everything<a class="h-anchor" href="#browse" aria-label="Copy link to this section" data-copy>${icon('link')}</a></h2><div class="browse">${browse}</div></section>
</main>
</div>
${footer(site)}
</body>
</html>
`;
}
