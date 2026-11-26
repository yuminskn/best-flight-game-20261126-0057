// capture.mjs — serve game/ over local HTTP and screenshot the staged shots.
// Fresh script written for this entry from puppeteer's public API.
// Usage: node capture.mjs [gameDir] [outDir]
// Writes 01-cover.jpg, 02-runway.jpg, 03-cockpit.jpg, 04-storm.jpg (1280x720)
// and prints any console/page errors so a broken render cannot slip through.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const GAME_DIR = path.resolve(process.argv[2] || 'game');
const OUT_DIR = path.resolve(process.argv[3] || 'screenshots');
const CHROME = process.env.CHROME_PATH || '/opt/meta-chromium/chrome';
const SHOTS = ['cover', 'runway', 'cockpit', 'storm'];

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

fs.mkdirSync(OUT_DIR, { recursive: true });

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
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--window-size=1280,720',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

for (let i = 0; i < SHOTS.length; i++) {
  const shot = SHOTS[i];
  await page.goto(`http://127.0.0.1:${port}/index.html?shot=${shot}`, {
    waitUntil: 'networkidle0', timeout: 30000,
  });
  await new Promise((r) => setTimeout(r, 2500));
  const file = path.join(OUT_DIR, `0${i + 1}-${shot}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
  const bytes = fs.statSync(file).size;
  console.log(`shot ${shot}: ${bytes} bytes, errors so far: ${errors.length}`);
}
console.log('CONSOLE ERRORS:', JSON.stringify(errors));
await browser.close();
server.close();
