// Generates the wiki's small UI sounds as WAV files (synthesized, no samples):
//   page.wav  - soft page turn      tick.wav - tiny hover tick
//   flip.wav  - card flip           chime.wav - sparkle for rare items
// Run: npm run sounds   (output: src/assets/audio/)
import fs from 'node:fs';
import path from 'node:path';

const RATE = 22050;
const out = path.join('src', 'assets', 'audio');
fs.mkdirSync(out, { recursive: true });

let seed = 1234567;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

function wav(name, samples, gain = 0.8) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const norm = peak ? gain / peak : 1;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * norm)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(out, `${name}.wav`), Buffer.concat([h, data]));
  console.log(`${name}.wav  ${((44 + data.length) / 1024).toFixed(1)} KB`);
}

const len = (sec) => Math.round(sec * RATE);

// Page turn: band-limited noise swish with a rising then falling filter.
{
  const n = len(0.32);
  const s = new Float32Array(n);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.sin(Math.PI * Math.min(1, t * 1.25)) ** 1.6 * (1 - t * 0.4);
    const cut = 0.05 + 0.35 * Math.sin(Math.PI * t);
    lp += cut * (rand() - lp);
    lp2 += cut * (lp - lp2);
    s[i] = (lp - lp2 * 0.6) * env;
  }
  wav('page', s, 0.55);
}

// Hover tick: very short, high, soft.
{
  const n = len(0.03);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    s[i] = Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-t * 260) + rand() * 0.15 * Math.exp(-t * 600);
  }
  wav('tick', s, 0.35);
}

// Card flip: quick snap of noise + low body thump.
{
  const n = len(0.2);
  const s = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    lp += 0.3 * (rand() - lp);
    const snap = lp * Math.exp(-t * 45) * (t < 0.004 ? t / 0.004 : 1);
    const body = Math.sin(2 * Math.PI * (180 - t * 300) * t) * Math.exp(-t * 30) * 0.5;
    const swish = rand() * 0.25 * Math.exp(-((t - 0.07) ** 2) / 0.0006);
    s[i] = snap + body + swish;
  }
  wav('flip', s, 0.6);
}

// Rare chime: bell partials with slow decay and a little shimmer.
{
  const n = len(1.3);
  const s = new Float32Array(n);
  const notes = [
    [1318.5, 1.0, 3.2, 0],
    [1975.5, 0.6, 4.0, 0.06],
    [2637.0, 0.45, 5.0, 0.12],
    [3951.1, 0.18, 7.0, 0.12],
  ];
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let v = 0;
    for (const [f, a, d, start] of notes) {
      if (t < start) continue;
      const tt = t - start;
      const att = Math.min(1, tt / 0.004);
      v += a * att * Math.exp(-tt * d) * (Math.sin(2 * Math.PI * f * tt) + 0.2 * Math.sin(2 * Math.PI * f * 2.01 * tt) * Math.exp(-tt * 6));
    }
    s[i] = v * (1 + 0.08 * Math.sin(2 * Math.PI * 6 * t));
  }
  wav('chime', s, 0.45);
}
