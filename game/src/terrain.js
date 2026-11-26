// terrain.js — the Lighthouse Isles: islands, sea, runways and the lighthouse.
// One job: define the height of the world and build everything that sits on it.
// The same terrainHeight() drives the mesh, the trees, the runways and the
// crash/landing checks, so what you see is exactly what you can hit.

// Three.js arrives as a classic script before this module runs.
const THREE = window.THREE;
import { makeNoise } from './noise.js';

const noise = makeNoise(20261126);

// Island bumps: [centerX, centerZ, radius, height]. The sea is height 0.
export const ISLANDS = [
  { x: 0, z: 0, r: 430, h: 96, name: 'Gull Isle' },
  { x: -640, z: 520, r: 250, h: 58, name: 'Puffin Rock' },
  { x: 680, z: -470, r: 300, h: 74, name: 'Beacon Holm' },
  { x: -180, z: -720, r: 170, h: 34, name: 'Seal Skerry' },
  { x: 820, z: 560, r: 150, h: 26, name: 'Tern Skerry' },
];

// Smooth bump: 1 at the centre, 0 at the rim, eased.
function bump(dx, dz, r) {
  const d2 = (dx * dx + dz * dz) / (r * r);
  if (d2 >= 1) return 0;
  const t = 1 - d2;
  return t * t * (3 - 2 * t);
}

// The one true height function. Sea level is y = 0.
export function terrainHeight(x, z) {
  let h = 0;
  for (const isle of ISLANDS) {
    h += isle.h * bump(x - isle.x, z - isle.z, isle.r);
  }
  // Rolling detail on land only, fading out at the shore.
  const land = Math.min(1, Math.max(0, h / 14));
  h += land * (noise.fbm(x, z) - 0.5) * 16;
  return h;
}

// The main runway: a flat shelf on the east flank of Gull Isle, heading east
// (90 deg), so the approach from the sea has a clear view of the strip.
export const RUNWAY = {
  x: 320, z: 150, heading: Math.PI / 2, length: 170, width: 26, name: 'Gull Strip 09',
};

// Two dirt delivery strips on the smaller isles.
export const STRIPS = [
  { x: -640, z: 520, heading: Math.PI / 2, length: 130, width: 18, name: 'Puffin Strip' },
  { x: 680, z: -470, heading: 0, length: 140, width: 18, name: 'Beacon Strip' },
];

// Flatten the ground under every strip so landings are fair.
// The strip footprint itself is dead flat at height 6; beyond it the
// ground blends back to the natural terrain over 90 units, so the strip
// sits on a visible plateau instead of half-buried in a hillside.
// Forward is (sin h, cos h); right is (cos h, -sin h).
function flattenStrips(h, x, z) {
  const all = [RUNWAY, ...STRIPS];
  for (const s of all) {
    const dx = x - s.x;
    const dz = z - s.z;
    const along = Math.abs(dx * Math.sin(s.heading) + dz * Math.cos(s.heading));
    const across = Math.abs(dx * Math.cos(s.heading) - dz * Math.sin(s.heading));
    // Distance outside the flat zone (strip footprint + 6 units margin).
    const outL = Math.max(0, along - (s.length / 2 + 6));
    const outW = Math.max(0, across - (s.width / 2 + 6));
    const d = Math.hypot(outL, outW);
    const blend = 90;
    if (d < blend) {
      const w = 1 - d / blend;
      const target = 6;
      h = h * (1 - w) + target * w;
    }
  }
  return h;
}

export function groundHeight(x, z) {
  return flattenStrips(terrainHeight(x, z), x, z);
}

function colorForHeight(h, slope) {
  const c = new THREE.Color();
  if (h < 2.5) c.setHex(0xd9b380); // sand
  else if (h < 34) c.setHex(0x5d8a4a); // grass
  else if (h < 62) c.setHex(0x6f7d5a); // high grass / scrub
  else if (h < 84) c.setHex(0x7a6a58); // rock
  else c.setHex(0xe8e2d4); // pale peaks
  // Steep slopes read as rock.
  if (slope > 0.55 && h > 10) c.setHex(0x6b5d4f);
  // Warm golden-hour tint on everything.
  c.multiplyScalar(1.0);
  return c;
}

function buildIslandMesh() {
  const SIZE = 2400;
  const SEG = 150;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    // Slope from neighbours for the colour rule.
    const hx = groundHeight(x + 6, z) - groundHeight(x - 6, z);
    const hz = groundHeight(x, z + 6) - groundHeight(x, z - 6);
    const slope = Math.hypot(hx, hz) / 12;
    // Color is r/g/b (not x/y/z): read the components directly.
    const col = colorForHeight(h, slope);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'islands';
  return mesh;
}

function buildSea() {
  const geo = new THREE.PlaneGeometry(5200, 5200);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x3d84a8, transparent: true, opacity: 0.94,
    shininess: 110, specular: 0xffd9a0,
  });
  const sea = new THREE.Mesh(geo, mat);
  sea.position.y = 0.4;
  sea.name = 'sea';
  return sea;
}

function buildRunwayStrip(s, dark) {
  const group = new THREE.Group();
  // The pad geometry is baked flat (rotateX in geometry), then yawed so its
  // length lies along the strip heading: forward is (sin h, cos h).
  const mat = new THREE.MeshLambertMaterial({ color: dark ? 0x3a3a40 : 0x8a7a5c });
  const padGeo = new THREE.PlaneGeometry(s.length, s.width);
  padGeo.rotateX(-Math.PI / 2);
  const pad = new THREE.Mesh(padGeo, mat);
  pad.rotation.y = s.heading - Math.PI / 2;
  pad.position.set(s.x, 6.4, s.z);
  group.add(pad);
  // Centre line dashes.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5e9c8 });
  const dashGeo = new THREE.PlaneGeometry(12, 1.6);
  dashGeo.rotateX(-Math.PI / 2);
  for (let d = -s.length / 2 + 18; d < s.length / 2 - 10; d += 26) {
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.rotation.y = s.heading - Math.PI / 2;
    const cx = s.x + Math.sin(s.heading) * d;
    const cz = s.z + Math.cos(s.heading) * d;
    dash.position.set(cx, 6.5, cz);
    group.add(dash);
  }
  // Threshold bars at both ends.
  const barGeo = new THREE.PlaneGeometry(3, s.width * 0.8);
  barGeo.rotateX(-Math.PI / 2);
  for (const end of [-1, 1]) {
    const bar = new THREE.Mesh(barGeo, dashMat);
    bar.rotation.y = s.heading - Math.PI / 2;
    const cx = s.x + Math.sin(s.heading) * end * (s.length / 2 - 6);
    const cz = s.z + Math.cos(s.heading) * end * (s.length / 2 - 6);
    bar.position.set(cx, 6.5, cz);
    group.add(bar);
  }
  return group;
}

function buildTrees(scene) {
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4128 });
  const crownGeo = new THREE.ConeGeometry(3.4, 11, 6);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2e5d33 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 260);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, 260);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  let placed = 0;
  let tries = 0;
  while (placed < 260 && tries < 4000) {
    tries++;
    const x = (noise.value(tries * 1.7, tries * 2.3, 7) - 0.5) * 2200;
    const z = (noise.value(tries * 3.1, tries * 1.3, 7) - 0.5) * 2200;
    const h = groundHeight(x, z);
    if (h < 6 || h > 58) continue;
    // Keep trees off the strips and their flat plateaus.
    let clear = true;
    for (const s of [RUNWAY, ...STRIPS]) {
      const dx = x - s.x;
      const dz = z - s.z;
      const along = Math.abs(dx * Math.sin(s.heading) + dz * Math.cos(s.heading));
      const across = Math.abs(dx * Math.cos(s.heading) - dz * Math.sin(s.heading));
      if (along < s.length / 2 + 20 && across < s.width / 2 + 20) { clear = false; break; }
    }
    if (!clear) continue;
    const s = 0.8 + noise.value(x, z, 13) * 0.9;
    m.compose(new THREE.Vector3(x, h + 2.2 * s, z), q, new THREE.Vector3(s, s, s));
    trunks.setMatrixAt(placed, m);
    m.compose(new THREE.Vector3(x, h + (5 + 5.5) * s, z), q, new THREE.Vector3(s, s, s));
    crowns.setMatrixAt(placed, m);
    placed++;
  }
  trunks.count = placed;
  crowns.count = placed;
  scene.add(trunks);
  scene.add(crowns);
}

function buildLighthouse(scene) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 7, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
  );
  base.position.y = 13;
  group.add(base);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 5.4, 4, 10),
    new THREE.MeshLambertMaterial({ color: 0xc0392b }),
  );
  band.position.y = 18;
  group.add(band);
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 5, 10),
    new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0xffdf8a, emissiveIntensity: 0.9 }),
  );
  lamp.position.y = 28;
  group.add(lamp);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(4.2, 4, 10),
    new THREE.MeshLambertMaterial({ color: 0x2c3e50 }),
  );
  roof.position.y = 32.5;
  group.add(roof);
  // Rotating beam: a long translucent cone, spun by sky.js's update.
  const beamGeo = new THREE.ConeGeometry(6, 90, 12, 1, true);
  beamGeo.translate(0, -45, 0);
  beamGeo.rotateX(Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0.08,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 28;
  beam.name = 'lighthouseBeam';
  group.add(beam);
  const lx = 60;
  const lz = -120;
  group.position.set(lx, groundHeight(lx, lz), lz);
  scene.add(group);
  return group;
}

export function buildTerrain(scene) {
  scene.add(buildIslandMesh());
  scene.add(buildSea());
  scene.add(buildRunwayStrip(RUNWAY, true));
  for (const s of STRIPS) scene.add(buildRunwayStrip(s, false));
  buildTrees(scene);
  buildLighthouse(scene);
}
