// npm run dev  ->  build, serve at http://localhost:4321, rebuild + reload the
// browser whenever content/, images/, media/ or src/ change.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { startServer } from './server.mjs';

const port = +(process.env.PORT || 4321);
const clients = new Set();
let building = false;
let again = false;

async function rebuild(reason) {
  if (building) {
    again = true;
    return;
  }
  building = true;
  // A fresh process per build, so edits to the build code itself apply too.
  const r = spawnSync(process.execPath, ['src/build.mjs', '--dev'], { stdio: 'inherit' });
  if (r.status === 0) for (const res of clients) res.write(`data: reload\n\n`);
  else console.error(`\nBuild failed${reason ? ` (${reason})` : ''}. Fix the error above and save again.`);
  building = false;
  if (again) {
    again = false;
    rebuild('queued change');
  }
}

await rebuild();
startServer({
  dir: 'dist',
  port,
  onRequest(req, res) {
    if (req.url !== '/__reload') return false;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return true;
  },
});
console.log(`\nWiki running at http://localhost:${port}  (Ctrl+C to stop). Watching for changes…`);

let timer;
for (const dir of ['content', 'images', 'media', 'src', 'deploy']) {
  if (!fs.existsSync(dir)) continue;
  fs.watch(dir, { recursive: true }, (ev, file) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`\nChanged: ${dir}/${file}`);
      rebuild(`${dir}/${file}`);
    }, 150);
  });
}
