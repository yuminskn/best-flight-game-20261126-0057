// hud.js — the lit instruments: altitude, speed, heading, fuel, hull.
// One job: everything the pilot reads — DOM readouts plus a canvas
// artificial horizon and compass tape, all glowing like flown instruments.

let altEl, spdEl, hdgEl, thrEl, fuelEl, hullEl, ringEl, scoreEl, timeEl;
let msgEl, missionEl, horizonCtx, horizonCanvas;

export function buildHud() {
  altEl = document.getElementById('hud-alt');
  spdEl = document.getElementById('hud-spd');
  hdgEl = document.getElementById('hud-hdg');
  thrEl = document.getElementById('hud-thr');
  fuelEl = document.getElementById('hud-fuel');
  hullEl = document.getElementById('hud-hull');
  ringEl = document.getElementById('hud-rings');
  scoreEl = document.getElementById('hud-score');
  timeEl = document.getElementById('hud-time');
  msgEl = document.getElementById('hud-msg');
  missionEl = document.getElementById('hud-mission');
  horizonCanvas = document.getElementById('hud-horizon');
  horizonCtx = horizonCanvas.getContext('2d');
}

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function headingName(rad) {
  const deg = ((rad * 180) / Math.PI % 360 + 360) % 360;
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return `${String(Math.round(deg)).padStart(3, '0')}° ${names[Math.round(deg / 45) % 8]}`;
}

export function updateHud(s, mission, progress, score, timeUsed) {
  const altFt = Math.max(0, Math.round((s.y - 1) * 3.2));
  const spdKt = Math.round(s.speed * 1.9);
  altEl.textContent = `${altFt} ft`;
  spdEl.textContent = `${spdKt} kt`;
  hdgEl.textContent = headingName(s.heading);
  thrEl.style.width = `${Math.round(s.throttle * 100)}%`;
  fuelEl.style.width = `${Math.max(0, s.fuel)}%`;
  fuelEl.classList.toggle('low', s.fuel < 25);
  hullEl.style.width = `${Math.max(0, s.hull)}%`;
  hullEl.classList.toggle('low', s.hull < 30);
  ringEl.textContent = `RINGS ${progress.rings}/${mission.rings}`;
  scoreEl.textContent = `SCORE ${score}`;
  timeEl.textContent = mission.timeLimit > 0
    ? `TIME ${fmtTime(Math.max(0, mission.timeLimit - timeUsed))}`
    : `TIME ${fmtTime(timeUsed)}`;
  missionEl.textContent = mission.name;
  drawHorizon(s);
}

let msgTimer = 0;
export function showMessage(text, seconds = 2.5) {
  msgEl.textContent = text;
  msgEl.classList.add('show');
  msgTimer = seconds;
}

export function tickMessage(dt) {
  if (msgTimer > 0) {
    msgTimer -= dt;
    if (msgTimer <= 0) msgEl.classList.remove('show');
  }
}

function drawHorizon(s) {
  const ctx = horizonCtx;
  const W = horizonCanvas.width;
  const H = horizonCanvas.height;
  const cx = W / 2;
  const cy = H / 2;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  // Glass face.
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0, Math.PI * 2);
  ctx.clip();
  // Sky / ground split, rolled and pitched.
  ctx.translate(cx, cy);
  ctx.rotate(-s.roll);
  ctx.translate(0, s.pitch * 90);
  ctx.fillStyle = '#e8905a';
  ctx.fillRect(-90, -90, 180, 90);
  ctx.fillStyle = '#3d5a3d';
  ctx.fillRect(-90, 0, 180, 90);
  // Horizon line.
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-90, 0);
  ctx.lineTo(90, 0);
  ctx.stroke();
  ctx.restore();
  // Fixed wings + centre dot (the aircraft reference, not the world).
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 34, cy);
  ctx.lineTo(cx - 12, cy);
  ctx.moveTo(cx + 12, cy);
  ctx.lineTo(cx + 34, cy);
  ctx.stroke();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  // Rim.
  ctx.strokeStyle = 'rgba(255,233,168,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0, Math.PI * 2);
  ctx.stroke();
  // Compass tape along the bottom: ticks every 30 deg, labels every 90.
  const deg = ((s.heading * 180) / Math.PI % 360 + 360) % 360;
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  for (let off = -60; off <= 60; off += 15) {
    const d = (Math.round(deg) + off + 360) % 360;
    const x = cx + off * 1.1;
    const major = d % 90 === 0;
    ctx.fillRect(x - 0.5, H - 16, 1, major ? 10 : 5);
    if (major) {
      const label = ['N', 'E', 'S', 'W'][(d / 90) % 4];
      ctx.fillText(label, x, H - 20);
    }
  }
}
