// aircraft.js — the Gullwing mail plane, built from primitives.
// One job: the aircraft's look — fuselage, wings, tail, propeller, lights.
// The flight model lives in flight.js; this file only draws the machine.

// Three.js arrives as a classic script before this module runs.
const THREE = window.THREE;

let propeller = null;
let navLeft = null;
let navRight = null;

export function buildAircraft() {
  const plane = new THREE.Group();
  plane.name = 'gullwing';

  const cream = new THREE.MeshLambertMaterial({ color: 0xf3e6c8 });
  const teal = new THREE.MeshLambertMaterial({ color: 0x2e7f86 });
  const amber = new THREE.MeshLambertMaterial({ color: 0xe8a13c });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x6a8a9a, transparent: true, opacity: 0.75,
    shininess: 80, specular: 0xffe0a0,
  });

  // Fuselage: a tapered cylinder along Z (nose at -Z... nose forward is +Z in
  // our flight frame, so the cylinder points +Z).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.4, 12), cream);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.2;
  plane.add(fuselage);

  // Nose cone and spinner.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.4, 12), amber);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 3.6;
  plane.add(nose);

  // Cabin glass: a flattened box on top of the fuselage.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 2.0), glass);
  cabin.position.set(0, 0.75, 0.6);
  plane.add(cabin);

  // Main wing: wide, slightly swept, teal with amber tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.22, 1.7), teal);
  wing.position.set(0, 0.15, 0.9);
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 1.7), amber);
    tip.position.set(side * 4.6, 0.15, 0.9);
    plane.add(tip);
  }

  // Tail: horizontal stabiliser + vertical fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 1.0), teal);
  stab.position.set(0, 0.25, -2.4);
  plane.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 1.3), amber);
  fin.position.set(0, 0.9, -2.4);
  plane.add(fin);

  // Belly stripe so the plane reads from below too.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 4.6), amber);
  stripe.position.set(0, -0.82, 0.2);
  plane.add(stripe);

  // Landing gear: two wheels and a tail wheel.
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), dark);
    leg.position.set(side * 0.7, -0.9, 1.2);
    plane.add(leg);
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.7, -1.3, 1.2);
    plane.add(wheel);
  }

  // Propeller: two blades on a hub at the nose, spun by updateAircraft.
  propeller = new THREE.Group();
  propeller.name = 'propeller';
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10), dark);
  hub.rotation.x = Math.PI / 2;
  propeller.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.28, 2.6, 0.08);
  // A spinning propeller reads as a translucent blur, not solid planks —
  // especially in the cockpit view, where the blades sweep past the camera.
  const bladeMat = new THREE.MeshLambertMaterial({
    color: 0x333333, transparent: true, opacity: 0.35,
  });
  const b1 = new THREE.Mesh(bladeGeo, bladeMat);
  const b2 = new THREE.Mesh(bladeGeo, bladeMat);
  b2.rotation.z = Math.PI / 2;
  propeller.add(b1);
  propeller.add(b2);
  // Faint spin disc so the propeller reads as a blur at any angle.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 24),
    new THREE.MeshBasicMaterial({
      color: 0x222222, transparent: true, opacity: 0.07,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  propeller.add(disc);
  propeller.position.z = 4.35;
  plane.add(propeller);

  // Navigation lights: red left, green right, white tail — small and emissive.
  const lightGeo = new THREE.SphereGeometry(0.14, 8, 6);
  navLeft = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff2a22 }));
  navLeft.position.set(-4.7, 0.15, 0.9);
  plane.add(navLeft);
  navRight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  navRight.position.set(4.7, 0.15, 0.9);
  plane.add(navRight);
  const tailLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  tailLight.position.set(0, 0.3, -2.9);
  plane.add(tailLight);

  // Soft shadow blob under the plane so it reads against the ground.
  const blobCanvas = document.createElement('canvas');
  blobCanvas.width = 64;
  blobCanvas.height = 64;
  const g = blobCanvas.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCanvas), transparent: true, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.name = 'shadowBlob';
  plane.add(blob);

  return plane;
}

// Spin the propeller with throttle; blink the nav lights; keep the shadow
// blob glued to the ground under the plane.
export function updateAircraft(plane, dt, throttle, groundY) {
  if (propeller) propeller.rotation.z += dt * (4 + throttle * 55);
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (navLeft) navLeft.visible = blink;
  if (navRight) navRight.visible = blink;
  const blob = plane.getObjectByName('shadowBlob');
  if (blob) {
    const h = plane.position.y - groundY;
    blob.position.y = -plane.position.y + groundY + 0.25;
    const s = Math.max(0.25, Math.min(1, 1 - h / 220));
    blob.scale.set(s, s, s);
    blob.material.opacity = Math.max(0.12, Math.min(0.9, 1 - h / 260));
  }
}
