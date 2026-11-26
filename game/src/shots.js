// shots.js — staged frames for the entry's screenshots.
// One job: put the plane, the camera and the light somewhere photogenic
// and hold still, so screenshots are real renders of the game's own code.
// Only active when the page loads with ?shot=<name>; normal play is untouched.

export function shotName() {
  const m = /[?&]shot=([a-z]+)/.exec(window.location.search);
  return m ? m[1] : null;
}

// Each staged shot: where the plane sits, where it points, how fast, and
// whether the camera rides chase or cockpit. Altitudes are above sea level.
export const SHOTS = {
  cover: {
    // South of the first ring, looking north-west at it with the lighthouse
    // and the low sun beyond — ring 0 dead ahead, isles behind it.
    x: 300, y: 70, z: 500, heading: 3.51, pitch: -0.02, roll: 0.15,
    speed: 46, throttle: 0.75, camera: 'chase', ring: 0,
  },
  runway: {
    // East of Gull Strip over the sea, flying west toward the strip with
    // the lighthouse and the low sun beyond. Offset south of the strip
    // centreline so the runway reads beside the plane, not behind it.
    x: 520, y: 70, z: 235, heading: 4.7124, pitch: -0.06, roll: 0,
    speed: 34, throttle: 0.5, camera: 'chase', ring: null,
  },
  cockpit: {
    // Due north toward ring 3: the ring dead ahead, Beacon Holm to the
    // right, the low sun ahead-left — a cockpit view with a target in it.
    x: 420, y: 75, z: -450, heading: 3.1416, pitch: -0.03, roll: 0,
    speed: 50, throttle: 0.8, camera: 'cockpit', ring: 3,
  },
  storm: {
    x: 300, y: 85, z: -500, heading: 2.9, pitch: 0.0, roll: 0.28,
    speed: 54, throttle: 0.9, camera: 'chase', ring: 3,
  },
};

// Apply a staged shot to the flight state and return the camera mode.
// The sim keeps running (propeller spins, beam sweeps) but the plane is
// held on rails: main.js freezes physics while a shot is staged.
export function applyShot(name, s) {
  const shot = SHOTS[name];
  if (!shot) return 'chase';
  s.x = shot.x;
  s.y = shot.y;
  s.z = shot.z;
  s.heading = shot.heading;
  s.pitch = shot.pitch;
  s.roll = shot.roll;
  s.speed = shot.speed;
  s.throttle = shot.throttle;
  s.fuel = 78;
  s.hull = 100;
  s.airborne = true;
  return shot.camera;
}
