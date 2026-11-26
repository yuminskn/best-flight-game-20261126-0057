// ringprobe.mjs — project every ring's centre to screen pixels for one shot.
// Resolves which ring is actually visible where, from the live camera.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const GAME_DIR = path.resolve('game');
const CHROME = process.env.CHROME_PATH || '/home/hatch/.cache/puppeteer/chrome/linux-157.0.8103.50/chrome-linux64/chrome';
const SHOT = process.argv[2] || 'cockpit';

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(GAME_DIR, urlPath === '/' ? 'index.html' : urlPath);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(`http://127.0.0.1:${port}/index.html?shot=${SHOT}`, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2000));
const info = await page.evaluate(() => {
  const gw = window.__gw;
  const { THREE, scene, camera } = gw;
  const s = gw.state();
  const v = new THREE.Vector3();
  const out = { camPos: camera.position.toArray().map((n) => +n.toFixed(1)), heading: +s.heading.toFixed(2), rings: [] };
  for (let i = 0; i < 10; i++) {
    const ring = scene.getObjectByName(`ring${i}`);
    if (!ring) continue;
    v.copy(ring.position).project(camera);
    const dist = ring.position.distanceTo(camera.position);
    out.rings.push({
      i,
      pos: ring.position.toArray().map((n) => Math.round(n)),
      px: [Math.round((v.x * 0.5 + 0.5) * 1280), Math.round((-v.y * 0.5 + 0.5) * 720)],
      z: +v.z.toFixed(2),
      dist: Math.round(dist),
    });
  }
  return out;
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
server.close();
