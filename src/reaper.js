// Reaper: a floating hooded skeleton with a giant scythe, EXACTLY 30000 triangles.
import * as THREE from 'three';
import { Builder, tube as _tube, sphere as _sphere, exactGrid } from './geo.js';

export const REAPER_TRIS = 30000;
const Q = 1.0, q = (n, min) => Math.max(min, Math.round(n * Q));
const tube = (p, r, rs = 16, ls = 0, o) => _tube(p, r, q(rs, 5), q(ls || (p.length - 1) * 4, 2), o);
const sphere = (r, w = 16, h = 12) => _sphere(r, q(w, 6), q(h, 4));
const C = { bone: 0xe8dfc4, boneD: 0x7a6a4c, cloth: 0x2c1a52, clothD: 0x07040e, edge: 0x8a48ff, glow: 0xa8ff4c, steel: 0xc4d0e4, shaft: 0x2e2018, dark: 0x0a0810 };
const cl = THREE.MathUtils.clamp;

export function buildReaper() {
  const mats = {
    body: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.5 }),
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.8, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
  const b = new Builder(mats), J = {};
  const node = (name, parent, p) => { const n = new THREE.Group(); n.name = name; n.position.set(p[0], p[1], p[2]); if (parent) parent.add(n); J[name] = n; return n; };
  const A = (n, g, c, m = 'body', t = null, o = {}) => b.add(n, g, c, m, t, o);
  const cBD = new THREE.Color(C.boneD), cCD = new THREE.Color(C.clothD), cEdge = new THREE.Color(C.edge);
  const bone = (c, x, y, z, nx, ny) => { c.lerp(cBD, cl(0.35 - ny * 0.45, 0, 0.7)); c.multiplyScalar(0.88 + 0.12 * Math.sin(x * 31 + y * 27) * Math.sin(z * 29)); };
  const B = { fn: bone };
  const robe = (c, x, y, z, nx, ny, nz) => { c.lerp(cCD, cl(0.5 - ny * 0.5, 0, 0.75)); c.multiplyScalar(0.8 + 0.2 * Math.sin(Math.atan2(x, z) * 22)); };

  const root = node('root', null, [0, 0, 0]);
  const body = node('body', root, [0, 2.5, 0]);
  // ---- spine, ribs, pelvis
  A(body, tube([[0, -0.55, -0.05], [0, 0, -0.1], [0, 0.5, -0.13], [0, 1.0, -0.05]], [0.085, 0.09, 0.09, 0.08], 14, 20), C.bone, 'body', null, B);
  for (let i = 0; i < 10; i++) A(body, sphere(0.125, 12, 8), C.bone, 'body', { p: [0, -0.5 + i * 0.16, -0.08 - 0.05 * Math.sin(i / 9 * Math.PI)], s: [1.1, 0.55, 1.1] }, B);
  A(body, tube([[0, 0.12, 0.42], [0, 0.45, 0.46], [0, 0.8, 0.4]], [[0.05, 0.08], [0.05, 0.1], [0.05, 0.07]], 12, 10), C.bone, 'body', null, B);
  A(body, sphere(0.24, 20, 14), C.glow, 'glow', { p: [0, 0.45, 0.14], s: [1, 1.3, 1] }, { fn: (c, x, y) => c.multiplyScalar(0.6 + 0.6 * cl(0.9 - y, 0, 1)) });
  A(body, sphere(0.34, 22, 14), C.bone, 'body', { p: [0, -0.52, 0], s: [1.2, 0.5, 0.75] }, B);
  A(body, tube([[-0.8, 0.84, -0.02], [-0.4, 0.9, 0.08], [0, 0.86, 0.12], [0.4, 0.9, 0.08], [0.8, 0.84, -0.02]], [0.06, 0.065, 0.07, 0.065, 0.06], 12, 20), C.bone, 'body', null, B);
  for (const s of [1, -1]) for (let i = 0; i < 6; i++) {
    const y = 0.16 + i * 0.125, w = 0.36 + 0.1 * Math.sin((i + 1) / 6 * Math.PI);
    A(body, tube([[0.04, y, -0.12], [w, y - 0.03, -0.02], [w * 0.88, y - 0.1, 0.3], [0.06, y - 0.12, 0.43]], [0.05, 0.045, 0.04, 0.03], 10, 14), C.bone, 'body', null, { mirror: s < 0, fn: bone });
  }
  // ---- mantle over the shoulders
  A(body, sphere(0.78, 32, 16), C.cloth, 'cloth', { p: [0, 0.83, -0.06], s: [1.3, 0.42, 0.82] }, { fn: (c, x, y, z, nx, ny, nz) => { robe(c, x, y, z, nx, ny, nz); if (y < 0.66) c.lerp(cEdge, 0.7); } });
  A(body, tube([[0, 0.9, -0.5], [0, 0.3, -0.75], [0, -0.5, -0.95], [0, -1.3, -1.25]], [[0.12, 0.7], [0.1, 0.62], [0.08, 0.5], [0.02, 0.1]], 20, 20), C.cloth, 'cloth', null, { fn: (c, x, y, z, nx, ny, nz) => { robe(c, x, y, z, nx, ny, nz); if (y < -1.0) c.lerp(cEdge, 0.6); } });
  // ---- skull & hood
  const head = node('head', body, [0, 1.15, 0.06]);
  A(head, sphere(0.5, 30, 18), C.cloth, 'cloth', { p: [0, 0.14, -0.2], s: [1, 1.1, 1.05] }, { fn: robe });
  A(head, tube([[0, 0.55, -0.35], [0, 0.72, -0.7], [0, 0.6, -1.05], [0, 0.3, -1.25]], [[0.2, 0.26], [0.15, 0.18], [0.09, 0.1], [0.01, 0.01]], 16, 16), C.cloth, 'cloth', null, { fn: robe });
  A(head, sphere(0.34, 30, 20), C.bone, 'body', { p: [0, 0.12, 0.06], s: [0.92, 1, 1.08] }, B);
  A(head, tube([[0, 0.02, 0.2], [0, -0.08, 0.3], [0, -0.16, 0.33]], [[0.16, 0.25], [0.12, 0.21], [0.07, 0.16]], 18, 10), C.bone, 'body', null, B);
  A(head, sphere(0.045, 8, 6), C.dark, 'body', { p: [0, -0.02, 0.41], s: [0.8, 1.3, 0.6] });
  for (const s of [1, -1]) {
    const m = { mirror: s < 0 };
    A(head, sphere(0.105, 14, 10), C.dark, 'body', { p: [0.135, 0.1, 0.34], s: [1, 1.1, 0.6] }, m);
    A(head, sphere(0.05, 12, 8), C.glow, 'glow', { p: [0.135, 0.1, 0.375] }, m);
    A(head, tube([[0.05, 0.2, 0.38], [0.15, 0.23, 0.37], [0.27, 0.17, 0.27]], [0.035, 0.045, 0.03], 8, 8), C.bone, 'body', null, { ...m, fn: bone });
    A(head, tube([[0.34, 0.42, -0.05], [0.62, 0.7, 0.08], [0.74, 1.1, 0.3], [0.58, 1.45, 0.55]], [0.11, 0.09, 0.055, 0.01], 14, 18), C.bone, 'body', null, { ...m, fn: (c, x, y) => { c.multiplyScalar(0.7 + 0.3 * Math.sin(y * 38)); } });
    for (let i = 0; i < 5; i++) A(head, tube([[0.03 + i * 0.04, -0.18, 0.37 - i * 0.03], [0.03 + i * 0.04, -0.27, 0.38 - i * 0.03]], [0.022, 0.012], 6, 2), C.bone, 'body', null, m);
  }
  const jaw = node('jaw', head, [0, -0.14, 0.08]);
  A(jaw, tube([[0, -0.02, -0.02], [0, -0.16, 0.16], [0, -0.17, 0.34]], [[0.05, 0.21], [0.05, 0.19], [0.04, 0.1]], 16, 10), C.bone, 'body', null, B);
  for (const s of [1, -1]) for (let i = 0; i < 5; i++) A(jaw, tube([[0.03 + i * 0.04, -0.14, 0.33 - i * 0.03], [0.03 + i * 0.04, -0.06, 0.34 - i * 0.03]], [0.022, 0.012], 6, 2), C.bone, 'body', null, { mirror: s < 0 });
  // ---- arms
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', m = { mirror: s < 0 }, BM = { ...m, fn: bone };
    const arm = node('arm' + L, body, [s * 0.82, 0.8, 0]);
    A(arm, sphere(0.14, 14, 10), C.bone, 'body', null, BM);
    A(arm, tube([[0, 0, 0], [0.05, -0.85, 0]], [0.06, 0.055], 12, 8), C.bone, 'body', null, BM);
    A(arm, tube([[0, 0.12, 0], [0.04, -0.3, 0], [0.05, -0.72, 0]], [0.2, 0.25, 0.36], 22, 14), C.cloth, 'cloth', null, { ...m, fn: (c, x, y, z, nx, ny, nz) => { robe(c, x, y, z, nx, ny, nz); if (y < -0.6) c.lerp(cEdge, 0.7); } });
    const fore = node('fore' + L, arm, [s * 0.05, -0.85, 0]);
    A(fore, sphere(0.1, 12, 8), C.bone, 'body', null, BM);
    A(fore, tube([[0.025, 0, 0], [0.02, -0.8, 0.05]], [0.04, 0.035], 10, 8), C.bone, 'body', null, BM);
    A(fore, tube([[-0.025, 0, 0], [-0.02, -0.8, 0.05]], [0.04, 0.035], 10, 8), C.bone, 'body', null, BM);
    A(fore, sphere(0.1, 14, 10), C.bone, 'body', { p: [0, -0.87, 0.05], s: [1, 1.2, 0.7] }, BM);
    for (let i = 0; i < 4; i++) { const x = -0.075 + i * 0.05; A(fore, tube([[x, -0.95, 0.05], [x * 1.4, -1.12, 0.1], [x * 1.5, -1.26, 0.2]], [0.022, 0.018, 0.004], 8, 6), C.bone, 'body', null, BM); }
  }
  // ---- scythe (held on the camera side)
  const scythe = node('scythe', J.foreL, [0, -0.9, 0.08]);
  scythe.rotation.x = Math.PI / 2;
  A(scythe, tube([[0, -1.5, 0], [0, 0, 0.02], [0, 1.2, 0], [0, 2.3, -0.04]], [0.055, 0.05, 0.05, 0.045], 14, 28), C.shaft);
  A(scythe, sphere(0.1, 12, 8), C.steel, 'body', { p: [0, -1.52, 0], s: [1, 1.6, 1] });
  A(scythe, sphere(0.13, 14, 10), C.steel, 'body', { p: [0, 2.25, -0.02] });
  A(scythe, tube([[0, 2.2, -0.05], [0, 2.5, 0.55], [0, 2.38, 1.2], [0, 1.95, 1.75], [0, 1.35, 2.05]], [[0.2, 0.035], [0.26, 0.03], [0.22, 0.024], [0.13, 0.016], [0.01, 0.005]], 16, 36), C.steel);
  A(scythe, tube([[0, 2.08, 0.1], [0, 2.3, 0.58], [0, 2.2, 1.16], [0, 1.84, 1.66], [0, 1.36, 1.98]], [[0.03, 0.04], [0.03, 0.036], [0.028, 0.03], [0.02, 0.02], [0.006, 0.006]], 10, 28), C.glow, 'glow');
  A(scythe, tube([[0, 2.3, -0.1], [0, 2.55, -0.4], [0, 2.4, -0.7]], [[0.1, 0.03], [0.07, 0.02], [0.01, 0.005]], 12, 10), C.steel);
  // ---- ragged lower robe absorbs the remaining budget so the total is exactly REAPER_TRIS
  const skirt = node('robe', body, [0, -0.3, 0]);
  const rest = REAPER_TRIS - b.tris;
  if (rest < 2000) throw new Error('reaper polygon budget exceeded: ' + b.tris);
  A(skirt, exactGrid(rest, 64, (u, v) => {
    const a = u * Math.PI * 2, r = (0.4 + 0.78 * Math.pow(v, 0.8)) * (1 + 0.08 * Math.sin(a * 7) * v), len = 2.0 + 0.4 * Math.sin(a * 6) + 0.22 * Math.sin(a * 15);
    return [Math.cos(a) * r, -v * len, Math.sin(a) * r * 0.85 - 0.55 * v * v];
  }), C.cloth, 'cloth', null, { fn: (c, x, y, z, nx, ny, nz) => { robe(c, x, y, z, nx, ny, nz); c.lerp(cEdge, cl((-y - 1.5) * 1.1, 0, 0.85)); } });

  const tris = b.finish();
  return { root, J, tris, mats };
}

export const REAPER = {
  name: '冥府の死神モルス', build: buildReaper, center: 2.7, minY: 1.9, reach: 2.3, shadow: 4.2, glowColor: 0xa8ff4c,
  glows: [{ j: 'body', o: [0, 0.45, 0.25], s: 1.8, c: 0xa8ff4c, a: 0.6 }, { j: 'head', o: [0, 0.1, 0.42], s: 0.9, c: 0xa8ff4c, a: 0.7 }, { j: 'scythe', o: [0, 2.2, 1.1], s: 1.6, c: 0xa8ff4c, a: 0.35 }],
  hits: [
    ['head', [0, 0.12, 0.05], 0.58, 1.6], ['body', [0, 0.45, 0.1], 0.8, 1], ['body', [0, -0.35, 0], 0.6, 1], ['robe', [0, -1.1, -0.2], 0.95, 0.6],
    ['foreL', [0, -0.4, 0], 0.4, 0.7], ['foreR', [0, -0.4, 0], 0.4, 0.7], ['scythe', [0, 2.2, 1.0], 0.75, 0.4],
  ],
  weak: [{ j: 'body', o: [0, 0.45, 0.35] }, { j: 'head', o: [0, 0.1, 0.38] }, { j: 'robe', o: [0, -1.2, 0.3] }, { j: 'scythe', o: [0, 2.3, 0.9] }, { j: 'foreR', o: [0, -0.85, 0.05] }],
  poses: {
    IDLE: { body: [0.1, 0, 0], head: [0.25, 0, 0], jaw: [0.1, 0, 0], armL: [-0.55, 0, 0.3], foreL: [-1.0, 0, 0], armR: [-0.3, 0, -0.35], foreR: [-0.8, 0, 0], robe: [0.1, 0, 0] },
    ROAR: { body: [-0.28, 0, 0], head: [-0.3, 0, 0], jaw: [0.8, 0, 0], armL: [-0.7, 0, 1.15], foreL: [-0.8, 0, 0], armR: [-0.7, 0, -1.15], foreR: [-0.9, 0, 0], robe: [-0.15, 0, 0] },
    WIND: { body: [-0.25, 0.6, 0], head: [0.2, -0.5, 0], jaw: [0.35, 0, 0], armL: [-2.5, 0, 0.5], foreL: [-0.9, 0, 0], armR: [-0.5, 0, -0.7], foreR: [-0.9, 0, 0], robe: [-0.1, 0, 0] },
    DASH: { body: [0.55, -0.5, 0], head: [-0.35, 0.4, 0], jaw: [0.7, 0, 0], armL: [-1.1, 0, -0.5], foreL: [-0.25, 0, 0], armR: [0.5, 0, -0.7], foreR: [-0.5, 0, 0], robe: [0.6, 0, 0] },
    DEAD: { body: [0.9, 0, 0.3], head: [0.6, 0.4, 0], jaw: [0.9, 0, 0], armL: [0.2, 0, 1.2], foreL: [-0.2, 0, 0], armR: [0.2, 0, -1.2], foreR: [-0.3, 0, 0], robe: [-0.3, 0, 0] },
  },
  idle(m, t, f, J) {
    J.body.position.y = 2.5 + Math.sin(t * 1.5) * 0.14;
    m.body[0] += Math.sin(t * 1.2) * 0.04 - f * 0.3; m.body[2] += Math.sin(t * 0.8) * 0.05 + Math.sin(t * 30) * f * 0.06;
    m.head[1] += Math.sin(t * 0.7) * 0.2; m.head[2] += Math.sin(t * 0.5) * 0.08; m.jaw[0] += 0.08 + Math.sin(t * 2.3) * 0.08 + f * 0.5;
    m.armL[0] += Math.sin(t * 1.2 + 1) * 0.06; m.foreL[0] += Math.sin(t * 1.2 + 2) * 0.06; m.armR[0] += Math.sin(t * 1.4) * 0.1; m.foreR[0] += Math.sin(t * 1.7) * 0.12;
    m.robe[0] += Math.sin(t * 1.5 + 1) * 0.08; m.robe[2] += Math.sin(t * 1.1) * 0.06;
  },
};
