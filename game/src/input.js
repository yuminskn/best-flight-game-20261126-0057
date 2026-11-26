// input.js — keyboard and mouse for the Gullwing.
// One job: read the pilot's hands and turn them into stick + throttle.
// Arrows (or WASD) fly; the mouse is a gentle virtual stick; C/P/R/M are
// camera, pause, restart and mute. No input is read before the first click.

const keys = new Set();
// One-shot taps, drained by consume(). A keydown queues the tap the moment
// it lands — a quick tap must never be lost just because the key was already
// released by the time the next frame runs (at low frame rates a tap can
// otherwise fall entirely between two frames and do nothing).
const pressedQueue = new Set();
let mouseX = 0; // -1..1 across the window
let mouseY = 0; // -1..1 down the window
let mouseActive = false;
let lastMouseMove = 0;

export function bindInput() {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (!e.repeat) pressedQueue.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); pressedQueue.clear(); });
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    mouseActive = true;
    lastMouseMove = performance.now();
  });
  window.addEventListener('mousedown', () => {
    mouseActive = true;
    lastMouseMove = performance.now();
  });
}

export function pressed(code) {
  return keys.has(code);
}

// Consume a one-shot key (pause, restart, mute, camera, mission pick).
// Reads the tap queue, not the held set, so a tap is never lost.
export function consume(code) {
  if (!pressedQueue.has(code)) return false;
  pressedQueue.delete(code);
  return true;
}

// Stick + throttle for this frame. Keyboard wins over the mouse stick;
// the mouse fades out 3 seconds after it stops moving.
// Taught controls: arrows fly (up/down pitch, left/right bank),
// W/S throttle, C camera, P pause, R restart, M mute.
export function readStick() {
  let pitch = 0;
  let roll = 0;
  if (keys.has('ArrowUp')) pitch += 1;
  if (keys.has('ArrowDown')) pitch -= 1;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;

  const mouseFresh = mouseActive && performance.now() - lastMouseMove < 3000;
  if (mouseFresh && pitch === 0 && roll === 0) {
    // Mouse up = nose up, mouse right = bank right. Gentle.
    pitch = -mouseY * 0.6;
    roll = mouseX * 0.7;
  }

  let throttleDelta = 0;
  if (keys.has('KeyW')) throttleDelta += 1;
  if (keys.has('KeyS')) throttleDelta -= 1;
  return {
    pitch: Math.max(-1, Math.min(1, pitch)),
    roll: Math.max(-1, Math.min(1, roll)),
    throttleDelta,
  };
}
