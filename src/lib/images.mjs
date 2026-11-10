// Image pipeline.
//
// You drop originals (any of PNG/JPG/WebP/AVIF/GIF/TIFF) into images/<folder>/<name>.<ext>.
// The build converts them to AVIF + WebP at a few sizes into dist/img/, with a
// content hash in the file name so browsers can cache them forever. Originals are
// never changed. Anything the site asks for that is not there yet gets a styled
// placeholder, and is listed in IMAGES.md.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { SHAPES, IMAGE_EXTS, VIDEO_EXTS } from './kinds.mjs';
import { esc, hash, walk, posix, readJSON, writeFile } from './util.mjs';
import { icon } from './icons.mjs';

const SHAPE_ICON = { card: 'card', pack: 'pack', icon: 'image', coin: 'coin', wide: 'image', portrait: 'boss', shot: 'image', logo: 'spark' };

export class ImageStore {
  constructor(root, outDir) {
    this.root = root;
    this.srcDir = path.join(root, 'images');
    this.mediaDir = path.join(root, 'media');
    this.outDir = outDir;
    this.cacheDir = path.join(root, '.cache', 'img');
    this.sources = new Map(); // "folder/name" -> { file, width, height, hash, animated }
    this.used = new Map(); // "folder/name" -> { path, desc, shape, pages:Set }
    this.videos = new Map(); // "routes/x" -> { path, desc, pages:Set }
    this.jobs = new Map(); // output path -> job
    this.problems = [];
  }

  async init() {
    fs.mkdirSync(this.cacheDir, { recursive: true });
    const metaFile = path.join(this.cacheDir, 'meta.json');
    const oldMeta = fs.existsSync(metaFile) ? readJSON(metaFile) : {};
    const meta = {};
    const files = walk(this.srcDir, (p) => IMAGE_EXTS.includes(path.extname(p).toLowerCase()));
    for (const file of files) {
      const rel = posix(path.relative(this.srcDir, file));
      const key = rel.replace(/\.[^.]+$/, '').toLowerCase();
      const st = fs.statSync(file);
      const stamp = `${st.size}-${st.mtimeMs}`;
      let info = oldMeta[rel] && oldMeta[rel].stamp === stamp ? oldMeta[rel] : null;
      if (!info) {
        try {
          const md = await sharp(file, { animated: true }).metadata();
          info = {
            stamp,
            width: md.width,
            height: md.pageHeight || md.height,
            animated: (md.pages || 1) > 1,
            hash: hash(fs.readFileSync(file)),
          };
        } catch (err) {
          this.problems.push(`images/${rel}: could not read this image (${err.message}). Send it again as PNG or JPG.`);
          continue;
        }
      }
      meta[rel] = info;
      const prev = this.sources.get(key);
      // If the same name exists in two formats, the newest file wins.
      if (!prev || prev.mtime < st.mtimeMs) this.sources.set(key, { ...info, file, rel, mtime: st.mtimeMs });
    }
    writeFile(metaFile, JSON.stringify(meta, null, 1));
  }

  has(p) {
    return this.sources.has(String(p).toLowerCase());
  }

  register(p, { desc, shape, page }) {
    const key = String(p).toLowerCase();
    let u = this.used.get(key);
    if (!u) {
      u = { path: p, desc: desc || p, shape: shape || 'shot', pages: new Set() };
      this.used.set(key, u);
    }
    if (desc && u.desc === u.path) u.desc = desc;
    if (page) u.pages.add(page);
    return u;
  }

  // Returns { url, width, height } of the largest generated WebP, queueing work.
  variants(p, shape) {
    const src = this.sources.get(String(p).toLowerCase());
    if (!src) return null;
    const spec = SHAPES[shape] || SHAPES.shot;
    let widths = spec.widths.filter((w) => w < src.width);
    if (!widths.length || widths[widths.length - 1] < Math.min(src.width, spec.widths[spec.widths.length - 1])) {
      widths.push(Math.min(src.width, spec.widths[spec.widths.length - 1]));
    }
    widths = [...new Set(widths)];
    const formats = src.animated ? ['webp'] : ['avif', 'webp'];
    const out = { src, widths, sets: {} };
    for (const fmt of formats) {
      out.sets[fmt] = widths.map((w) => {
        const rel = `img/${p}.${src.hash}-${w}.${fmt}`;
        this.jobs.set(rel, { src, w, fmt, rel });
        return { url: '/' + rel, w };
      });
    }
    const webp = out.sets.webp;
    out.largest = webp[webp.length - 1];
    out.height = Math.round((src.height / src.width) * out.largest.w);
    return out;
  }

  /**
   * A responsive <picture>, or a placeholder if the image is not provided yet.
   * opts: shape, alt, desc (checklist text), page (url), sizes, eager, cls, iconName
   */
  picture(p, opts = {}) {
    const shape = opts.shape || 'shot';
    this.register(p, { desc: opts.desc || opts.alt, shape, page: opts.page });
    const alt = opts.alt || '';
    const v = this.variants(p, shape);
    const cls = `pic pic--${shape}${opts.cls ? ' ' + opts.cls : ''}`;
    if (!v) {
      const glyph = opts.iconName || SHAPE_ICON[shape] || 'image';
      return `<span class="ph ph--${shape}${opts.cls ? ' ' + opts.cls : ''}" role="img" aria-label="${esc(alt || 'Image')}: image coming soon">${icon(glyph, 'ph__glyph')}${
        opts.small ? '' : `<span class="ph__label">Image coming soon</span>`
      }</span>`;
    }
    const sizes = opts.sizes || '(max-width: 700px) 90vw, 480px';
    const srcset = (fmt) => v.sets[fmt].map((s) => `${s.url} ${s.w}w`).join(', ');
    const loading = opts.eager ? 'eager' : 'lazy';
    const avif = v.sets.avif ? `<source type="image/avif" srcset="${srcset('avif')}" sizes="${sizes}">` : '';
    return `<picture class="${cls}">${avif}<img src="${v.largest.url}" srcset="${srcset('webp')}" sizes="${sizes}" alt="${esc(alt)}" width="${v.largest.w}" height="${v.height}" loading="${loading}" decoding="async"></picture>`;
  }

  largestUrl(p, shape) {
    const v = this.variants(p, shape);
    return v ? v.largest.url : null;
  }

  registerVideo(p, desc, page) {
    let v = this.videos.get(p);
    if (!v) this.videos.set(p, (v = { path: p, desc, pages: new Set() }));
    if (page) v.pages.add(page);
  }

  hasVideo(p) {
    return VIDEO_EXTS.some((ext) => fs.existsSync(path.join(this.mediaDir, 'videos', `${p}${ext}`)));
  }

  // Videos are copied as-is (MP4/WebM). Returns [{url, type}] or [].
  video(p) {
    const out = [];
    for (const ext of VIDEO_EXTS) {
      const file = path.join(this.mediaDir, 'videos', `${p}${ext}`);
      if (fs.existsSync(file)) {
        const h = hash(fs.readFileSync(file));
        const rel = `media/videos/${p}.${h}${ext}`;
        this.jobs.set(rel, { copy: file, rel });
        out.push({ url: '/' + rel, type: ext === '.mp4' ? 'video/mp4' : 'video/webm' });
      }
    }
    // Prefer WebM first (smaller), MP4 as fallback.
    return out.sort((a) => (a.type === 'video/webm' ? -1 : 1));
  }

  async process(log = () => {}) {
    let made = 0;
    let reused = 0;
    const jobs = [...this.jobs.values()];
    const run = async (job) => {
      const dest = path.join(this.outDir, job.rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (job.copy) {
        fs.copyFileSync(job.copy, dest);
        return;
      }
      const cached = path.join(this.cacheDir, `${job.src.hash}-${job.w}.${job.fmt}`);
      if (!fs.existsSync(cached)) {
        let img = sharp(job.src.file, { animated: job.src.animated }).resize({ width: job.w, withoutEnlargement: true });
        img = job.fmt === 'avif' ? img.avif({ quality: 55, effort: 4 }) : img.webp({ quality: 82, effort: 5 });
        // Write then rename, so a build running at the same time never sees a half-written file.
        const tmp = `${cached}.${process.pid}.tmp`;
        await img.toFile(tmp);
        try { fs.renameSync(tmp, cached); } catch { fs.rmSync(tmp, { force: true }); }
        made++;
      } else reused++;
      fs.copyFileSync(cached, dest);
    };
    // Small concurrency pool.
    const pool = 4;
    for (let i = 0; i < jobs.length; i += pool) await Promise.all(jobs.slice(i, i + pool).map(run));
    if (jobs.length) log(`images: ${made} converted, ${reused} from cache`);
  }

  // Images sitting in images/ that nothing on the site uses (likely a misnamed file).
  unused() {
    return [...this.sources.entries()].filter(([k]) => !this.used.has(k)).map(([, s]) => s.rel);
  }

  manifestMarkdown() {
    const rows = [...this.used.values()].sort((a, b) => a.path.localeCompare(b.path));
    const have = rows.filter((r) => this.has(r.path)).length;
    const groups = new Map();
    for (const r of rows) {
      const folder = r.path.split('/')[0];
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder).push(r);
    }
    let md = `# Image checklist\n\nThis file is generated by the build. Do not edit it by hand.\n\n`;
    md += `**${have} of ${rows.length} images provided.**\n\n`;
    md += `Drop each image into \`images/<folder>/<name>.<any image extension>\` (PNG, JPG, WebP, AVIF, GIF, TIFF). `;
    md += `The build converts it to AVIF and WebP automatically and the original is kept as-is.\n\n`;
    for (const [folder, list] of groups) {
      const done = list.filter((r) => this.has(r.path)).length;
      md += `## ${folder} (${done}/${list.length})\n\n| | File | What it is | Shape and size | Used on |\n|---|---|---|---|---|\n`;
      for (const r of list) {
        const ok = this.has(r.path);
        md += `| ${ok ? '✅' : '⬜'} | \`images/${r.path}.png\` | ${r.desc} | ${(SHAPES[r.shape] || SHAPES.shot).advice} | ${[...r.pages].join(', ')} |\n`;
      }
      md += '\n';
    }
    if (this.videos.size) {
      const vids = [...this.videos.values()].sort((a, b) => a.path.localeCompare(b.path));
      md += `## Videos (${vids.filter((v) => this.hasVideo(v.path)).length}/${vids.length})\n\n`;
      md += `Videos go in \`media/videos/\`. MP4 (H.264) or WebM. Send me any format and I will convert it.\n\n| | File | What it is | Used on |\n|---|---|---|---|\n`;
      for (const v of vids) md += `| ${this.hasVideo(v.path) ? '✅' : '⬜'} | \`media/videos/${v.path}.mp4\` | ${v.desc} | ${[...v.pages].join(', ')} |\n`;
      md += '\n';
    }
    const unused = this.unused();
    if (unused.length) {
      md += `## Not used anywhere\n\nThese files are in images/ but no page asks for them. Check the file name.\n\n`;
      for (const u of unused) md += `- \`images/${u}\`\n`;
    }
    return md;
  }
}
