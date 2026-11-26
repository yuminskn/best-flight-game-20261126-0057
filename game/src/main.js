// main.js — GULLWING MAIL: boot, game loop and the flight's state machine.
// One job: wire the modules together and run the game — menu, flying, pause,
// crash, landing, mission complete — plus the chase/cockpit camera.

import { buildTerrain, groundHeight, RUNWAY } from './terrain.js';
import { buildSky, updateSky } from './sky.js';
import { buildAircraft, updateAircraft } from './aircraft.js';
import { newFlightState, stepFlight, landingCheck, MAX_SPEED } from './flight.js';
import { MISSIONS, buildCourse, stepCourse, courseScore } from './course.js';
import { buildHud, updateHud, showMessage, tickMessage } from './hud.js';
import { initAudio, updateAudio, playRing, playGate, playThud, playCrash, playFanfare, toggleMute } from './audio.js';
import { bindInput, readStick, consume } from './input.js';
import { shotName, applyShot } from './shots.js';

const THREE = window.THREE;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 6000);

buildSky(scene);
buildTerrain(scene);
buildHud();
bindInput();

const plane = buildAircraft();
scene.add(plane);

let missionIndex = 0;
let mission = MISSIONS[0];
let course = null;
let state = newFlightState();
let phase = 'menu'; // menu | flying | paused | crashed | complete
let cameraMode = 'chase';
let score = 0;
let ringsPassed = 0;
let gatesPassed = 0;
let timeUsed = 0;
let landedHome = false;
let hasFlown = false; // the plane must actually leave the ground before a
// landing can end the mission — otherwise the parked start would "complete".
let crashReason = '';
let shot = shotName();

const menuEl = document.getElementById('menu');
const endEl = document.getElementById('endcard');
const endTitle = document.getElementById('end-title');
const endBody = document.getElementById('end-body');

function startMission(index) {
  missionIndex = index;
  mission = MISSIONS[index];
  // Fresh course: remove the old rings and gates from the scene.
  if (course) {
    for (const r of course.rings) { scene.remove(r.mesh); scene.remove(r.beacon); }
    for (const g of course.gates) scene.remove(g.mesh);
  }
  course = buildCourse(scene, mission);
  state = newFlightState();
  state.fuel = mission.fuel;
  score = 0;
  ringsPassed = 0;
  gatesPassed = 0;
  timeUsed = 0;
  landedHome = false;
  hasFlown = false;
  crashReason = '';
  phase = 'flying';
  menuEl.classList.add('hidden');
  endEl.classList.add('hidden');
  showMessage(`${mission.name} — ${mission.tag}`, 4);
  initAudio();
}

function endFlight(title, body) {
  phase = title === 'MISSION COMPLETE' ? 'complete' : 'crashed';
  endTitle.textContent = title;
  endBody.innerHTML = body;
  endEl.classList.remove('hidden');
}

function currentScore() {
  return courseScore({
    ringsPassed, gatesPassed, timeUsed,
    timeLimit: mission.timeLimit, landedHome,
    fuelLeft: state.fuel, hull: state.hull,
  });
}

function checkCrashAndLanding(dt) {
  const g = groundHeight(state.x, state.z);
  // Hull destroyed by a hard hit (flight.js already deducts on impact).
  if (state.hull <= 0 && phase === 'flying') {
    crashReason = 'Hull destroyed — the Gullwing came apart.';
    playCrash();
    endFlight('CRASHED', `The mail never arrived.<br>SCORE ${currentScore()}<br><br>Press R to fly again.`);
    return;
  }
  if (state.fuel <= 0 && !state.airborne && state.speed < 2 && phase === 'flying') {
    crashReason = 'Out of fuel on the ground.';
    endFlight('OUT OF FUEL', `The Gullwing ran dry where she stopped.<br>SCORE ${currentScore()}<br><br>Press R to fly again.`);
    return;
  }
  // Landing on the home strip completes the mail run; on other missions it
  // is a safe stop that ends the sortie with a landing bonus.
  if (!state.airborne && state.speed < 3 && hasFlown) {
    const home = landingCheck(state, RUNWAY);
    if (home.landed && phase === 'flying') {
      landedHome = true;
      playThud();
      score = currentScore();
      if (mission.id === 'mail' && gatesPassed < mission.deliveries) {
        showMessage('Landed home — but the mail is not all delivered yet. Take off again!', 4);
        state.speed = 0;
        return;
      }
      playFanfare();
      endFlight('MISSION COMPLETE', `Landed clean on ${RUNWAY.name}.<br>RINGS ${ringsPassed}/${mission.rings} · SCORE ${score}<br><br>Press R to fly again, or 1/2/3 for another mission.`);
    }
  }
  // Ditched in the sea.
  if (state.y < 1.2 && g < 0.5 && state.airborne && phase === 'flying') {
    crashReason = 'Ditched in the sea.';
    playCrash();
    endFlight('DITCHED', `The Gullwing went into the water.<br>SCORE ${currentScore()}<br><br>Press R to fly again.`);
  }
}

function stepGame(dt) {
  if (phase !== 'flying') return;
  timeUsed += dt;
  const stick = readStick();
  const stalled = stepFlight(state, stick, dt, mission.storm);
  if (state.airborne) hasFlown = true;
  if (stalled && state.airborne) showMessage('STALL — nose down, add throttle!', 1.2);

  // Ring and gate events.
  for (const ev of stepCourse(course, state, mission)) {
    if (ev.type === 'ring') {
      ringsPassed = ev.index;
      score = currentScore();
      playRing();
      showMessage(ev.index >= mission.rings ? 'ALL RINGS — land on Gull Strip!' : `RING ${ev.index}/${mission.rings}`);
    } else if (ev.type === 'gate') {
      gatesPassed++;
      score = currentScore();
      playGate();
      showMessage(`DELIVERED — ${ev.strip}! (${gatesPassed}/${mission.deliveries})`);
    }
  }

  // Storm time limit.
  if (mission.timeLimit > 0 && timeUsed > mission.timeLimit && phase === 'flying') {
    endFlight('TIME UP', `The storm window closed.<br>RINGS ${ringsPassed}/${mission.rings} · SCORE ${currentScore()}<br><br>Press R to fly again.`);
    return;
  }

  // Low fuel / hull warnings.
  if (state.fuel < 20 && state.fuel > 0) showMessage('LOW FUEL — mind your throttle', 1.2);
  if (state.hull < 30 && state.hull > 0) showMessage('HULL DAMAGED — fly gentle', 1.2);

  checkCrashAndLanding(dt);
  updateAudio(state.throttle, state.speed);
}

function poseAircraft() {
  plane.position.set(state.x, state.y, state.z);
  // Aircraft forward is +Z in model space (nose at +Z).
  // rotation order YXZ: yaw, then pitch, then roll — the aircraft order.
  // Ry(heading) sends +Z to (sin h, 0, cos h), exactly the flight forward.
  plane.rotation.order = 'YXZ';
  plane.rotation.y = state.heading;
  plane.rotation.x = -state.pitch;
  plane.rotation.z = -state.roll;
}

function updateCamera(dt) {
  // In the cockpit the spinning propeller would fill the frame as two
  // planks — real props blur out, so hide it and keep the cowling.
  const prop = plane.getObjectByName('propeller');
  if (prop) prop.visible = cameraMode !== 'cockpit';
  const back = 17;
  const up = 6.5;
  const hx = Math.sin(state.heading);
  const hz = Math.cos(state.heading);
  const px = -Math.sin(state.pitch);
  if (cameraMode === 'cockpit') {
    // Just above the cabin and slightly ahead of it: the cowling and the
    // propeller read at the bottom of the frame, the world ahead is clear.
    camera.position.set(
      state.x + hx * 1.2,
      state.y + 2.0,
      state.z + hz * 1.2,
    );
    camera.lookAt(
      state.x + hx * 60,
      state.y + px * 60,
      state.z + hz * 60,
    );
    return;
  }
  // Chase: behind and above, smoothed so the camera never fights the pilot.
  const tx = state.x - hx * back + Math.sin(state.roll) * 2;
  const ty = state.y + up - Math.sin(state.pitch) * 4;
  const tz = state.z - hz * back;
  const k = 1 - Math.exp(-dt * 4.5);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (ty - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(
    state.x + hx * 30,
    state.y + px * 18,
    state.z + hz * 30,
  );
}

// Menu orbit: slow cinematic sweep while the player picks a mission.
let menuAngle = 0.6;
function menuCamera(dt) {
  menuAngle += dt * 0.05;
  const cx = Math.sin(menuAngle) * 620;
  const cz = Math.cos(menuAngle) * 620;
  camera.position.set(cx, 190, cz);
  camera.lookAt(0, 30, 0);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // One-shot keys.
  if (consume('KeyP') && (phase === 'flying' || phase === 'paused')) {
    phase = phase === 'flying' ? 'paused' : 'flying';
    showMessage(phase === 'paused' ? 'PAUSED — P to resume' : 'FLYING', 1.2);
  }
  if (consume('KeyC')) cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
  if (consume('KeyM')) toggleMute();
  if (consume('KeyR') && phase !== 'menu') startMission(missionIndex);
  if (phase === 'menu' || phase === 'complete' || phase === 'crashed') {
    if (consume('Digit1')) startMission(0);
    if (consume('Digit2')) startMission(1);
    if (consume('Digit3')) startMission(2);
  }

  if (shot) {
    // Staged frame: hold the plane on rails, keep the world alive.
    updateSky(dt, now / 1000);
    updateAircraft(plane, dt, state.throttle, groundHeight(state.x, state.z));
    poseAircraft();
    updateCamera(0.016);
    updateHud(state, mission, { rings: ringsPassed }, currentScore(), timeUsed);
    tickMessage(dt);
  } else if (phase === 'menu') {
    menuCamera(dt);
    updateSky(dt, now / 1000);
    updateAircraft(plane, dt, 0, groundHeight(state.x, state.z));
    poseAircraft();
  } else if (phase === 'paused') {
    // Frozen: render the same frame, no sim.
  } else {
    stepGame(dt);
    updateSky(dt, now / 1000);
    updateAircraft(plane, dt, state.throttle, groundHeight(state.x, state.z));
    poseAircraft();
    updateCamera(dt);
    updateHud(state, mission, { rings: ringsPassed }, currentScore(), timeUsed);
    tickMessage(dt);
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Menu buttons start missions; the first click also unlocks audio.
document.querySelectorAll('#menu button[data-mission]').forEach((btn) => {
  btn.addEventListener('click', () => startMission(Number(btn.dataset.mission)));
});

// Staged screenshot mode: skip the menu, hold a photogenic frame.
if (shot) {
  const mode = applyShot(shot, state);
  cameraMode = mode;
  mission = MISSIONS[shot === 'storm' ? 2 : shot === 'runway' ? 1 : 0];
  course = buildCourse(scene, mission);
  state.fuel = mission.fuel;
  menuEl.classList.add('hidden');
  phase = 'flying';
  // Pre-place the camera so the first rendered frame is already composed.
  updateCamera(1);
  poseAircraft();
}

// Debug hook for screenshot verification: read-only handles to the live scene.
// Harmless in the shipped game; no network, no input, no state changes.
window.__gw = { scene, camera, plane, state: () => state, phase: () => phase, THREE };

requestAnimationFrame(frame);
