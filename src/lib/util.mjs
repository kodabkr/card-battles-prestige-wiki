// Small shared helpers used across the build.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const slug = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// A value is "TODO" when it is the string TODO, or starts with "TODO:" / "TODO(".
export const isTodo = (v) => typeof v === 'string' && /^\s*TODO\b/.test(v);
export const todoNote = (v) =>
  String(v).trim().replace(/^TODO\s*[:(]?\s*/, '').replace(/\)\s*$/, '').trim();

export const stripTags = (html) =>
  String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?)])/g, '$1')
    .trim();

export function hash(buf, len = 10) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, len);
}

export function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read ${file}: ${err.message}`);
  }
}

export function walk(dir, filter = () => true) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out;
}

export function writeFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

// "1 in 100M" style odds.
export function formatOdds(n) {
  if (typeof n !== 'number' || !isFinite(n)) return null;
  return `1 in ${compact(n)}`;
}

export function compact(n) {
  const units = [
    [1e15, 'Qa'],
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [v, u] of units) {
    if (Math.abs(n) >= v) {
      const x = n / v;
      return `${Number.isInteger(x) ? x : x.toFixed(x < 10 ? 2 : 1).replace(/\.?0+$/, '')}${u}`;
    }
  }
  return String(n);
}

export const posix = (p) => p.split(path.sep).join('/');

export const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// "983K" -> 983000, "1.03K" -> 1030, "24" -> 24. Returns null if not a number.
const SUFFIX = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, qa: 1e15, qi: 1e18, sx: 1e21, sp: 1e24, oc: 1e27, no: 1e30, dc: 1e33 };
export function parseShort(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const m = v.trim().replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*([a-z]{0,2})$/i);
  if (!m) return null;
  const mult = m[2] ? SUFFIX[m[2].toLowerCase()] : 1;
  return mult ? parseFloat(m[1]) * mult : null;
}

// Game-style short numbers: 3 significant digits with K/M/B/T/Qa/Qi/Sx/Sp/Oc/No/Dc.
export function gameNum(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  if (Math.abs(n) < 1000) return String(Math.round(n));
  const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  let i = 0;
  while (Math.abs(n) >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  const s = n >= 100 ? Math.round(n).toString() : n >= 10 ? n.toFixed(1) : n.toFixed(2);
  return s.replace(/\.0+$|(\.\d*[1-9])0+$/, '$1') + units[i];
}
