// course.js — rings, missions and scoring for the Gullwing.
// One job: what the pilot has to do, and how it is scored.
// Rings are torus meshes; a pass counts when the plane crosses the ring's
// plane within its radius. Missions only change the course, fuel and wind.

// Three.js arrives as a classic script before this module runs.
const THREE = window.THREE;
import { RUNWAY, STRIPS } from './terrain.js';

export const MISSIONS = [
  {
    id: 'ring',
    name: 'RING RUN',
    tag: 'Thread 10 rings over the isles. Fuel is generous — fly clean.',
    rings: 10, fuel: 100, timeLimit: 0, storm: false, deliveries: 0,
  },
  {
    id: 'mail',
    name: 'MAIL RUN',
    tag: 'Deliver the mail: fly the low gate over Puffin and Beacon strips, then land home on Gull Strip. Fuel is tight.',
    rings: 6, fuel: 70, timeLimit: 0, storm: false, deliveries: 2,
  },
  {
    id: 'storm',
    name: 'STORM RUN',
    tag: '8 rings in gusty wind against the clock. Hold your line.',
    rings: 8, fuel: 100, timeLimit: 150, storm: true, deliveries: 0,
  },
];

// Ring positions: [x, y, z, heading] — heading is the direction the ring faces.
function ringCourse(missionId) {
  if (missionId === 'mail') {
    return [
      [120, 45, 420, 0.4], [-260, 55, 560, 0.9], [-640, 34, 520, 1.57],
      [-300, 60, -120, 2.4], [680, 40, -470, 0], [420, 70, -260, 2.8],
    ];
  }
  if (missionId === 'storm') {
    return [
      [220, 55, 260, 0.9], [520, 80, -140, 2.2], [700, 60, -470, 0],
      [300, 75, -720, 2.9], [-260, 65, -640, 2.6], [-640, 45, 520, 1.57],
      [-420, 70, 700, 0.6], [60, 50, 380, 0.3],
    ];
  }
  // Ring Run: a tour of the whole chain.
  return [
    [240, 50, 300, 0.6], [560, 70, -40, 1.9], [700, 55, -470, 0],
    [420, 80, -700, 2.7], [-120, 70, -720, 2.6], [-520, 60, -240, 2.2],
    [-640, 40, 520, 1.57], [-300, 65, 700, 0.8], [60, 50, 420, 0.3],
    [60, 42, 180, 1.57],
  ];
}

export function buildCourse(scene, mission) {
  const defs = ringCourse(mission.id).slice(0, mission.id === 'mail' ? 6 : mission.rings);
  const geo = new THREE.TorusGeometry(9, 0.9, 10, 28);
  const rings = defs.map(([x, y, z, heading], i) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = heading;
    mesh.name = `ring${i}`;
    scene.add(mesh);
    // A small beacon light above each ring so the course reads from far away.
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
    );
    beacon.position.set(x, y + 12, z);
    scene.add(beacon);
    return { x, y, z, heading, mesh, beacon, passed: false, prevSide: null };
  });
  // Delivery gates for the mail run: wide low rings over the two strips.
  const gates = [];
  if (mission.deliveries > 0) {
    for (const strip of STRIPS) {
      const gateGeo = new THREE.TorusGeometry(15, 1.1, 10, 28);
      const gate = new THREE.Mesh(gateGeo, new THREE.MeshBasicMaterial({
        color: 0x37e0a0, transparent: true, opacity: 0.9,
      }));
      gate.position.set(strip.x, 22, strip.z);
      gate.rotation.y = strip.heading;
      scene.add(gate);
      gates.push({ x: strip.x, y: 22, z: strip.z, heading: strip.heading, mesh: gate, passed: false, prevSide: null, strip });
    }
  }
  return { rings, gates, next: 0 };
}

function crossedRing(ring, px, py, pz) {
  // Signed distance of the plane from the ring's plane.
  const nx = Math.sin(ring.heading);
  const nz = Math.cos(ring.heading);
  const side = (px - ring.x) * nx + (pz - ring.z) * nz;
  if (ring.prevSide === null) { ring.prevSide = side; return false; }
  const crossed = (ring.prevSide < 0 && side >= 0) || (ring.prevSide > 0 && side <= 0);
  ring.prevSide = side;
  if (!crossed) return false;
  const d = Math.hypot(px - ring.x, py - ring.y, pz - ring.z);
  return d < 9.5;
}

// Advance the course by one frame. Returns events: [{type:'ring'|'gate'|'done'}].
export function stepCourse(course, s, mission) {
  const events = [];
  const ring = course.rings[course.next];
  if (ring && !ring.passed && crossedRing(ring, s.x, s.y, s.z)) {
    ring.passed = true;
    ring.mesh.material.color.setHex(0x37e0a0);
    ring.mesh.material.opacity = 0.45;
    ring.beacon.visible = false;
    course.next++;
    events.push({ type: 'ring', index: course.next, total: course.rings.length });
    if (course.next >= course.rings.length) events.push({ type: 'done' });
  }
  for (const gate of course.gates) {
    if (!gate.passed && crossedRing(gate, s.x, s.y, s.z)) {
      gate.passed = true;
      gate.mesh.material.color.setHex(0x37e0a0);
      gate.mesh.material.opacity = 0.4;
      events.push({ type: 'gate', strip: gate.strip.name });
    }
  }
  return events;
}

export function courseScore(state) {
  // state: { ringsPassed, gatesPassed, timeUsed, timeLimit, landedHome, fuelLeft, hull }
  let score = state.ringsPassed * 100 + state.gatesPassed * 300;
  if (state.landedHome) score += 400;
  if (state.timeLimit > 0 && state.timeUsed < state.timeLimit) {
    score += Math.round((state.timeLimit - state.timeUsed) * 2);
  }
  score += Math.round(state.fuelLeft * 2);
  score += Math.round(state.hull);
  return score;
}

export { RUNWAY };
