// flight.js — arcade flight physics for the Gullwing.
// One job: turn throttle + stick into motion, with stall, wind and gravity.
// No rendering here; main.js reads the state and poses the aircraft.

import { groundHeight } from './terrain.js';

export const MAX_SPEED = 62; // units per second at full throttle
export const STALL_SPEED = 17; // below this the wing gives up
export const MAX_FUEL = 100;

export function newFlightState() {
  return {
    // Parked on the west end of Gull Strip, facing east, sitting on the
    // ground (ground height + gear height) so the flight starts grounded.
    x: 250, y: groundHeight(250, 150) + 1.1, z: 150,
    heading: Math.PI / 2, // radians, 0 = +Z, PI/2 = east (+X)
    pitch: 0, // radians, positive = nose up
    roll: 0, // radians, positive = bank right
    speed: 0,
    throttle: 0,
    fuel: MAX_FUEL,
    hull: 100,
    verticalSpeed: 0,
    airborne: false,
    windX: 0,
    windZ: 0,
  };
}

// Wind for the storm mission: gusts that push the plane sideways.
export function stormWind(t) {
  return {
    x: Math.sin(t * 0.5) * 6 + Math.sin(t * 1.7) * 3,
    z: Math.cos(t * 0.4) * 6 + Math.sin(t * 1.3) * 3,
  };
}

// input: { pitch: -1..1, roll: -1..1, throttleDelta: -1..1 } per frame.
// dt in seconds. Returns nothing; mutates `s` in place.
export function stepFlight(s, input, dt, storm) {
  // Throttle: W/S nudge it, clamped 0..1. Fuel burns with throttle.
  s.throttle = Math.max(0, Math.min(1, s.throttle + input.throttleDelta * dt * 0.55));
  if (s.fuel > 0) s.fuel = Math.max(0, s.fuel - s.throttle * dt * 1.15);
  else s.throttle = Math.max(0, s.throttle - dt * 0.4); // out of fuel: throttle dies

  // Target speed follows throttle; accelerate toward it.
  const targetSpeed = s.throttle * MAX_SPEED;
  const accel = targetSpeed > s.speed ? 9 : 5;
  s.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - s.speed));

  // Stick: pitch and roll ease toward the commanded values.
  const pitchTarget = input.pitch * 0.42;
  const rollTarget = input.roll * 0.85;
  const ease = 1 - Math.exp(-dt * 3.2);
  s.pitch += (pitchTarget - s.pitch) * ease;
  s.roll += (rollTarget - s.roll) * ease;

  // Stall: below stall speed the nose drops and the controls go mushy.
  const stalled = s.speed < STALL_SPEED && s.y > groundHeight(s.x, s.z) + 3;
  if (stalled) s.pitch += (-0.3 - s.pitch) * dt * 1.5;

  // Banked turn: heading follows the bank, faster at speed.
  s.heading -= Math.sin(s.roll) * (s.speed / MAX_SPEED) * 0.85 * dt;

  // Wind pushes the airframe.
  const w = storm ? stormWind(performance.now() / 1000) : { x: 0, z: 0 };
  s.windX = w.x;
  s.windZ = w.z;

  // Velocity: forward along heading/pitch, plus wind.
  const fwdX = Math.sin(s.heading) * Math.cos(s.pitch);
  const fwdZ = Math.cos(s.heading) * Math.cos(s.pitch);
  const climb = Math.sin(s.pitch) * s.speed;
  const lift = s.speed >= STALL_SPEED ? 0 : -6; // sinking when stalled
  const vy = climb + lift - (s.airborne ? 1.2 : 0);
  s.verticalSpeed = vy;
  s.x += (fwdX * s.speed + s.windX) * dt;
  s.z += (fwdZ * s.speed + s.windZ) * dt;
  s.y += vy * dt;

  // Ground: never sink below the terrain. Anything above the snap height
  // is flying — there is no dead zone where the airborne flag goes stale.
  const g = groundHeight(s.x, s.z);
  if (s.y <= g + 1.1) {
    s.y = g + 1.1;
    s.airborne = false;
    if (Math.abs(vy) > 9) s.hull -= (Math.abs(vy) - 9) * 4; // hard hit damages hull
  } else {
    s.airborne = true;
  }

  // World bounds: steer back with a gentle push past the edge.
  const R = 1150;
  const r = Math.hypot(s.x, s.z);
  if (r > R) {
    s.x *= R / r;
    s.z *= R / r;
  }
  return stalled;
}

// Landing quality at the current spot: over a strip, slow, level, gentle sink.
export function landingCheck(s, strip) {
  const dx = s.x - strip.x;
  const dz = s.z - strip.z;
  // Forward is (sin h, cos h); right is (cos h, -sin h).
  const along = dx * Math.sin(strip.heading) + dz * Math.cos(strip.heading);
  const across = dx * Math.cos(strip.heading) - dz * Math.sin(strip.heading);
  const over = Math.abs(along) < strip.length / 2 && Math.abs(across) < strip.width / 2 + 6;
  const slow = s.speed < 34;
  const gentle = s.verticalSpeed > -7;
  const level = Math.abs(s.roll) < 0.35 && Math.abs(s.pitch) < 0.3;
  const onGround = !s.airborne;
  return { over, slow, gentle, level, onGround, landed: over && slow && gentle && level && onGround };
}
