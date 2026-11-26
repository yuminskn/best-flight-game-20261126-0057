// noise.js — tiny deterministic value-noise for terrain.
// One job: turn integer lattice points into smooth pseudo-random heights.
// Seeded so the island chain looks the same on every run.

export function makeNoise(seed) {
  // Integer hash -> [0, 1). Deterministic, no Math.random anywhere.
  const hash2 = (ix, iz) => {
    let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967295;
  };

  const smooth = (t) => t * t * (3 - 2 * t);

  // Bilinear value noise at (x, z) with cell size `cell`.
  const value = (x, z, cell) => {
    const fx = x / cell;
    const fz = z / cell;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = smooth(fx - ix);
    const tz = smooth(fz - iz);
    const a = hash2(ix, iz);
    const b = hash2(ix + 1, iz);
    const c = hash2(ix, iz + 1);
    const d = hash2(ix + 1, iz + 1);
    const ab = a + (b - a) * tx;
    const cd = c + (d - c) * tx;
    return ab + (cd - ab) * tz;
  };

  // Fractal sum of three octaves, roughly in [0, 1].
  const fbm = (x, z) => {
    const n1 = value(x, z, 260);
    const n2 = value(x + 31, z - 17, 110);
    const n3 = value(x - 47, z + 53, 46);
    return n1 * 0.55 + n2 * 0.3 + n3 * 0.15;
  };

  return { value, fbm };
}
