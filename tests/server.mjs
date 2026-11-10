// Static server for dist/ used by the tests. GET /__bump makes sw.js report a new version,
// which simulates a new deploy so the update flow can be tested.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
const ROOT = join(import.meta.dirname, '..', 'dist'), PORT = +(process.env.PORT || 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
let bump = 0;
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__bump') { bump++; res.end('bumped ' + bump); return; }
  if (url.pathname === '/__reset') { bump = 0; res.end('reset'); return; }
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (!p || p.endsWith('/')) p += 'index.html';
  try {
    let body = await readFile(join(ROOT, p));
    if (p === 'sw.js' && bump) body = Buffer.from(body.toString().replace(/const VERSION = '([^']+)'/, `const VERSION = '$1-b${bump}'`));
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(PORT, () => console.log('serving dist on http://localhost:' + PORT));
