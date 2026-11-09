// The build: content -> dist/ (plain HTML, CSS, JS, images, audio, video).
import fs from 'node:fs';
import path from 'node:path';
import { loadContent } from './content.mjs';
import { renderMarkdown, finalizeHeadings } from './render.mjs';
import { layoutPage, layoutHome } from './layout.mjs';
import { ImageStore } from './images.mjs';
import { setSpriteUrl } from './icons.mjs';
import { KINDS } from './kinds.mjs';
import { hash, writeFile, stripTags, walk, posix } from './util.mjs';

function copyHashed(file, outDir, sub, transform) {
  let buf = fs.readFileSync(file);
  if (transform) buf = Buffer.from(transform(buf.toString('utf8')));
  const ext = path.extname(file);
  const name = `${path.basename(file, ext)}.${hash(buf)}${ext}`;
  writeFile(path.join(outDir, sub, name), buf);
  return `/${sub}/${name}`;
}

// GitHub Pages (and similar hosts) may serve the site under a sub-path such as
// /card-battles-wiki/. Set BASE_PATH=/card-battles-wiki when building for that.
export function basePath() {
  const b = (process.env.BASE_PATH || '').trim().replace(/\/+$/, '');
  return b && !b.startsWith('/') ? `/${b}` : b;
}

// Prefix every site-absolute URL ("/...") in finished HTML with the base path.
function withBase(html, base) {
  if (!base) return html;
  return html
    .replace(/(\s(?:href|src|poster|data-search|data-icons))="\/(?!\/)/g, `$1="${base}/`)
    .replace(/(\ssrcset)="([^"]*)"/g, (m, a, v) => `${a}="${v.replace(/(^|,\s*)\/(?!\/)/g, `$1${base}/`)}"`)
    .replace(/&quot;\/assets\//g, `&quot;${base}/assets/`);
}

function prepareAssets(root, outDir, dev, base = '') {
  const A = path.join(root, 'src', 'assets');
  const a = { audio: {}, preload: [], dev: null };
  const fonts = {};
  for (const f of fs.readdirSync(path.join(A, 'fonts'))) {
    if (f.endsWith('.woff2')) fonts[f] = copyHashed(path.join(A, 'fonts', f), outDir, 'assets/fonts');
    if (f.endsWith('.txt')) writeFile(path.join(outDir, 'assets/fonts', f), fs.readFileSync(path.join(A, 'fonts', f)));
  }
  a.preload = [fonts['inter-latin-wght-normal.woff2'], fonts['cinzel-latin-700-normal.woff2']].filter(Boolean);
  for (const f of fs.existsSync(path.join(A, 'audio')) ? fs.readdirSync(path.join(A, 'audio')) : []) {
    if (/\.(wav|ogg|mp3|webm)$/.test(f)) a.audio[path.basename(f, path.extname(f))] = copyHashed(path.join(A, 'audio', f), outDir, 'assets/audio');
  }
  a.icons = copyHashed(path.join(A, 'icons.svg'), outDir, 'assets');
  setSpriteUrl(a.icons);
  a.css = copyHashed(path.join(A, 'css', 'site.css'), outDir, 'assets/css', (css) =>
    css.replace(/url\(["']?\.\.\/fonts\/([^"')]+)["']?\)/g, (m, f) => {
      if (!fonts[f]) throw new Error(`site.css references missing font ${f}`);
      return `url("${base}${fonts[f]}")`;
    })
  );
  a.boot = copyHashed(path.join(A, 'js', 'boot.js'), outDir, 'assets/js');
  a.js = copyHashed(path.join(A, 'js', 'site.js'), outDir, 'assets/js');
  if (dev) a.dev = copyHashed(path.join(A, 'js', 'dev-reload.js'), outDir, 'assets/js');
  fs.copyFileSync(path.join(A, 'favicon.svg'), path.join(outDir, 'favicon.svg'));
  a.favicon = '/favicon.svg';
  return a;
}

export async function buildSite({ root = process.cwd(), dev = false, log = console.log } = {}) {
  const t0 = Date.now();
  const outDir = path.join(root, 'dist');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const site = loadContent(root);
  const warnings = [...site.problems];
  const warn = (m) => {
    if (!warnings.includes(m)) warnings.push(m);
  };
  const base = basePath();
  const assets = prepareAssets(root, outDir, dev, base);
  const images = new ImageStore(root, outDir);
  await images.init();
  warnings.push(...images.problems);
  assets.images = images;

  // 1. Render page content.
  const rendered = [];
  for (const page of site.pages) {
    const ctx = { site, images, page, warn };
    if (page.fm.layout === 'home') {
      rendered.push({ page, ctx, home: true, html: '', toc: [] });
      continue;
    }
    const raw = renderMarkdown(page.body, ctx);
    const { html, toc } = finalizeHeadings(raw, ctx);
    rendered.push({ page, ctx, html, toc });
  }

  // 2. Search index (pages, sections, every entity).
  const items = [];
  for (const r of rendered) {
    if (r.page.url === '/404.html') continue;
    items.push({ t: r.page.title, k: 'Page', u: r.page.url, s: r.page.fm.description || '', x: stripTags(r.html).slice(0, 3000) });
    for (const t of r.toc.filter((t) => t.lvl === 2)) items.push({ t: t.text, k: 'Section', u: `${r.page.url}#${t.id}`, s: r.page.title });
  }
  const anchorsByPage = new Map(rendered.map((r) => [r.page.url, new Set([...r.html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));
  for (const e of site.entities.values()) {
    const ids = anchorsByPage.get(e.page);
    if (!ids) warn(`${e.key}: its page ${e.page} does not exist`);
    else if (!ids.has(e.anchor)) warn(`${e.key}: not shown on its page ${e.page} (add a component that lists it)`);
    const facts = Object.entries({ ...(e.facts || {}), ...(e.stats || {}) })
      .map(([k, v]) => `${k} ${v}`)
      .join(' ');
    items.push({
      t: e.name,
      k: KINDS[e.kind].label,
      u: e.url,
      s: stripTags(renderMarkdown(e.summary || e.effect || '', { site, images, page: null, warn: () => {} }, { inline: true })).replace(/Details coming soon/g, '').slice(0, 160),
      x: [...(e.aliases || []), e.typeLabel || '', facts].join(' ').replace(/TODO[^ ]*/g, ''),
    });
  }
  const indexJson = JSON.stringify({ v: 1, items: items.map((it) => ({ ...it, u: base + it.u })) });
  const searchName = `search-index.${hash(indexJson)}.json`;
  writeFile(path.join(outDir, searchName), indexJson);
  assets.search = `/${searchName}`;

  // 3. Lay out and write pages.
  const order = site.order;
  for (const r of rendered) {
    let html;
    if (r.home) html = layoutHome({ page: r.page, site, assets, ctx: r.ctx });
    else {
      const i = order.indexOf(r.page);
      html = layoutPage({ page: r.page, site, assets, html: r.html, toc: r.toc, prev: i > 0 ? order[i - 1] : null, next: i >= 0 && i < order.length - 1 ? order[i + 1] : null, ctx: r.ctx });
    }
    r.final = html;
  }

  // 4. Check every internal link and anchor.
  const allIds = new Map(rendered.map((r) => [r.page.url, new Set([...r.final.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));
  for (const r of rendered) {
    for (const m of r.final.matchAll(/href="(\/[^"]*)"/g)) {
      const [p, h] = m[1].split('#');
      if (/^\/(assets|img|media)\//.test(p) || p === '/favicon.svg') continue;
      const ids = allIds.get(p);
      if (!ids) warn(`${r.page.file}: broken link ${m[1]}`);
      else if (h && !ids.has(h)) warn(`${r.page.file}: link ${m[1]} points to a missing section`);
    }
  }

  for (const r of rendered) {
    const file = r.page.url === '/404.html' ? '404.html' : path.join(r.page.url, 'index.html');
    writeFile(path.join(outDir, file), withBase(r.final, base));
  }

  // 5. Images, video, static extras.
  await images.process(log);
  writeFile(path.join(root, 'IMAGES.md'), images.manifestMarkdown());
  writeFile(path.join(outDir, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  const headers = path.join(root, 'deploy', '_headers');
  if (fs.existsSync(headers)) fs.copyFileSync(headers, path.join(outDir, '_headers'));

  const files = walk(outDir);
  const bytes = files.reduce((s, f) => s + fs.statSync(f).size, 0);
  if (base) log(`base path: ${base}`);
  log(`built ${rendered.length} pages, ${site.entities.size} entries, ${files.length} files (${(bytes / 1024 / 1024).toFixed(2)} MB) in ${Date.now() - t0} ms`);
  const imgUsed = images.used.size;
  const imgHave = [...images.used.keys()].filter((k) => images.has(k)).length;
  log(`images: ${imgHave}/${imgUsed} provided (see IMAGES.md)`);
  if (warnings.length) {
    log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) log(`  - ${w}`);
  }
  return { warnings, outDir };
}
