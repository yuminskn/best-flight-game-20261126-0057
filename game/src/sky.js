// sky.js — golden-hour sky: gradient dome, low sun, drifting clouds, sea fog.
// One job: everything above the horizon, plus the lighthouse beam's slow sweep.

// Three.js arrives as a classic script before this module runs.
const THREE = window.THREE;

let beam = null;
let clouds = [];
let sunDisc = null;

export function buildSky(scene) {
  // Gradient dome: warm horizon fading to dusky blue overhead.
  const domeGeo = new THREE.SphereGeometry(2600, 24, 14);
  const top = new THREE.Color(0x3d5a80);
  const mid = new THREE.Color(0xe8905a);
  const bot = new THREE.Color(0xffc98a);
  const colors = new Float32Array(domeGeo.attributes.position.count * 3);
  const pos = domeGeo.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 2600; // -1..1
    if (y > 0.18) c.copy(mid).lerp(top, Math.min(1, (y - 0.18) / 0.6));
    else if (y > -0.05) c.copy(bot).lerp(mid, (y + 0.05) / 0.23);
    else c.copy(bot);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  domeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(
    domeGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  );
  dome.name = 'skyDome';
  scene.add(dome);

  // Low golden sun: a bright disc plus a halo sprite made of canvas.
  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = 128;
  sunCanvas.height = 128;
  const g = sunCanvas.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 246, 220, 1)');
  grad.addColorStop(0.25, 'rgba(255, 214, 140, 0.9)');
  grad.addColorStop(1, 'rgba(255, 180, 90, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const sunTex = new THREE.CanvasTexture(sunCanvas);
  sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTex, transparent: true, fog: false, depthWrite: false,
  }));
  sunDisc.scale.set(420, 420, 1);
  sunDisc.position.set(-1500, 260, -1900);
  scene.add(sunDisc);

  // Directional sun light, low and warm, matching the disc — but high
  // enough that the isles and the aircraft read from every side.
  const sun = new THREE.DirectionalLight(0xffc37a, 2.2);
  sun.position.set(-1500, 520, -1900);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x9db1d6, 0x8a6a4a, 1.7);
  scene.add(hemi);
  // Soft warm fill so the shadow sides never go black.
  const fill = new THREE.AmbientLight(0xffe0b8, 0.5);
  scene.add(fill);

  // Warm haze.
  scene.fog = new THREE.Fog(0xe8a06a, 700, 2600);

  // Puffy clouds: flattened white blobs drifting slowly.
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xffe8d0, transparent: true, opacity: 0.85, emissive: 0x664422,
    emissiveIntensity: 0.25,
  });
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  clouds = [];
  const spots = [
    [-900, 300, -700, 150], [400, 340, -1100, 190], [1100, 280, 300, 130],
    [-300, 360, 900, 170], [900, 320, -300, 120], [-1200, 300, 400, 160],
    [100, 380, -1400, 200], [-700, 310, -1200, 140],
  ];
  for (const [x, y, z, r] of spots) {
    const group = new THREE.Group();
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set((Math.random() - 0.5) * r, (Math.random() - 0.5) * r * 0.25, (Math.random() - 0.5) * r * 0.6);
      const s = r * (0.25 + Math.random() * 0.3);
      puff.scale.set(s, s * 0.42, s * 0.7);
      group.add(puff);
    }
    group.position.set(x, y, z);
    scene.add(group);
    clouds.push({ group, speed: 1.5 + Math.random() * 2 });
  }

  beam = scene.getObjectByName('lighthouseBeam');
}

// Called every frame: sweep the beam, drift the clouds.
export function updateSky(dt, t) {
  if (beam) beam.rotation.y = t * 0.35;
  for (const c of clouds) {
    c.group.position.x += c.speed * dt;
    if (c.group.position.x > 1600) c.group.position.x = -1600;
  }
}
