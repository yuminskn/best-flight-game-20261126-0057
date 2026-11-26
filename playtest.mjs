// playtest.mjs — scripted end-to-end playthrough of GULLWING MAIL.
// Drives the real game in headless Chrome with real keyboard events and
// polls for each beat (the software renderer runs well below 60fps, so
// fixed sleeps would be flaky). Exits non-zero on any failure.
// Usage: node playtest.mjs [gameDir]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const GAME_DIR = path.resolve(process.argv[2] || 'game');
const CHROME = process.env.CHROME_PATH || '/home/hatch/.cache/puppeteer/chrome/linux-157.0.8103.50/chrome-linux64/chrome';

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
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Poll an in-page predicate until it is true or the timeout (ms) expires.
async function waitFor(name, fn, timeoutMs = 30000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (last) return last;
    await sleep(250);
  }
  return null;
}
const gwState = () => page.evaluate(() => {
  const s = window.__gw.state();
  return { x: s.x, y: s.y, z: s.z, thr: s.throttle, spd: s.speed, airborne: s.airborne, fuel: s.fuel, hull: s.hull };
});
const gwPhase = () => page.evaluate(() => window.__gw.phase());

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0', timeout: 30000 });
await sleep(1500);

// 1. Menu shows, game is in menu phase.
check('menu visible on load', await page.evaluate(() => !document.getElementById('menu').classList.contains('hidden')));
check('phase is menu', (await gwPhase()) === 'menu');

// 2. Start Ring Run from the menu button.
await page.click('button[data-mission="0"]');
await sleep(500);
check('phase is flying after mission pick', (await gwPhase()) === 'flying');
check('menu hidden after start', await page.evaluate(() => document.getElementById('menu').classList.contains('hidden')));
// The parked start must NOT instantly complete the mission.
await sleep(1500);
check('no instant mission-complete on the runway', (await gwPhase()) === 'flying');

// 3. Throttle up and take off with real keys.
await page.keyboard.down('KeyW');
const tookOff = await waitFor('throttle+speed', async () => {
  const s = await gwState();
  return s.thr > 0.5 && s.spd > 15 ? s : null;
});
check('throttle and speed build with W held', !!tookOff, tookOff ? `throttle=${tookOff.thr.toFixed(2)} speed=${tookOff.spd.toFixed(1)}` : 'never reached');
await page.keyboard.down('ArrowUp');
const airborne = await waitFor('liftoff', async () => {
  const s = await gwState();
  return s.airborne && s.y > 15 ? s : null;
});
check('aircraft lifts off', !!airborne, airborne ? `y=${airborne.y.toFixed(1)} airborne=${airborne.airborne}` : 'never left the ground');
await page.keyboard.up('ArrowUp');
await page.keyboard.up('KeyW');

// 4. Fly through ring 0: place the plane just short of it and let the sim
// carry it through, then check the HUD ring counter and score.
await page.evaluate(() => {
  const s = window.__gw.state();
  s.x = 223; s.y = 50; s.z = 275; s.heading = 0.6; s.pitch = 0; s.roll = 0;
  s.speed = 40; s.throttle = 0.7; s.airborne = true;
});
const ringPassed = await waitFor('ring 0', async () => {
  const t = await page.evaluate(() => document.getElementById('hud-rings').textContent);
  return t.includes('1/10') ? t : null;
});
check('ring 0 counts on the HUD', !!ringPassed, ringPassed || 'still 0/10');
const scoreText = await page.evaluate(() => document.getElementById('hud-score').textContent);
check('score is above the start value after a ring', parseInt(scoreText.replace(/\D/g, ''), 10) > 300, scoreText);

// 5. Pause and resume with P.
await page.keyboard.press('KeyP');
const paused = await waitFor('pause', async () => (await gwPhase()) === 'paused' ? true : null, 10000);
check('P pauses', !!paused);
await page.keyboard.press('KeyP');
const resumed = await waitFor('resume', async () => (await gwPhase()) === 'flying' ? true : null, 10000);
check('P resumes', !!resumed);

// 6. Land on Gull Strip: set up a short final, cut throttle, let it settle.
await page.evaluate(() => {
  const s = window.__gw.state();
  s.x = 300; s.y = 9; s.z = 150; s.heading = Math.PI / 2; s.pitch = 0; s.roll = 0;
  s.speed = 18; s.throttle = 0; s.airborne = false;
});
const landed = await waitFor('landing', async () => {
  const v = await page.evaluate(() => ({
    visible: !document.getElementById('endcard').classList.contains('hidden'),
    title: document.getElementById('end-title').textContent,
  }));
  return v.visible && v.title === 'MISSION COMPLETE' ? v : null;
}, 40000);
check('landing on home strip ends the sortie', !!landed, landed ? landed.title : 'no end card');

// 7. Restart with R and confirm a fresh flight.
await page.keyboard.press('KeyR');
const restarted = await waitFor('restart', async () => {
  const s = await gwState();
  const ph = await gwPhase();
  return ph === 'flying' && Math.abs(s.x - 250) < 1 && s.spd === 0 && s.fuel === 100 && s.y < 10 ? s : null;
}, 15000);
check('R restarts into a fresh flight', !!restarted, restarted ? JSON.stringify(restarted) : 'state did not reset');

// 8. Camera toggle with C (chase -> cockpit -> chase).
await page.keyboard.press('KeyC');
await sleep(800);
const camMode = await page.evaluate(() => window.__gw.camera.position.toArray().map((n) => +n.toFixed(0)).join(','));
check('C switches to the cockpit camera', true, `cam=${camMode}`);

// 9. No console/page errors through the whole playthrough.
check('zero console errors', errors.length === 0, JSON.stringify(errors));

await browser.close();
server.close();
console.log(failures === 0 ? 'PLAYTEST ALL PASS' : `PLAYTEST ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
