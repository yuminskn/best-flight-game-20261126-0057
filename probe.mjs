// probe.mjs — project the aircraft into screen space for each staged shot.
// Loads the game in headless Chrome, reads window.__gw, and reports where
// the plane's bounding box lands in NDC/pixels, plus plane/camera poses.
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
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));

for (const shot of ['cover', 'runway', 'cockpit', 'storm']) {
  await page.goto(`http://127.0.0.1:${port}/index.html?shot=${shot}`, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2000));
  const info = await page.evaluate(() => {
    const gw = window.__gw;
    if (!gw) return { error: 'no __gw' };
    const { THREE, scene, camera, plane } = gw;
    const s = gw.state();
    const box = new THREE.Box3().setFromObject(plane);
    const v = new THREE.Vector3();
    const corners = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      v.set(x, y, z).project(camera);
      corners.push([Math.round((v.x * 0.5 + 0.5) * 1280), Math.round((-v.y * 0.5 + 0.5) * 720), v.z.toFixed(2)]);
    }
    v.copy(plane.position).project(camera);
    const centerPx = [Math.round((v.x * 0.5 + 0.5) * 1280), Math.round((-v.y * 0.5 + 0.5) * 720), v.z.toFixed(2)];
    let visible = 0;
    plane.traverse((o) => { if (o.isMesh) visible++; });
    return {
      shot: new URLSearchParams(location.search).get('shot'),
      planePos: plane.position.toArray().map((n) => +n.toFixed(1)),
      planeRot: [plane.rotation.x, plane.rotation.y, plane.rotation.z].map((n) => +n.toFixed(2)),
      planeVisible: plane.visible,
      meshCount: visible,
      boxMin: box.min.toArray().map((n) => +n.toFixed(1)),
      boxMax: box.max.toArray().map((n) => +n.toFixed(1)),
      camPos: camera.position.toArray().map((n) => +n.toFixed(1)),
      centerPx,
      corners,
      state: { x: +s.x.toFixed(1), y: +s.y.toFixed(1), z: +s.z.toFixed(1), heading: +s.heading.toFixed(2) },
    };
  });
  console.log(JSON.stringify(info));
}
await browser.close();
server.close();
