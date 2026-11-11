// Crystal golem: a knuckle-dragging stone colossus, EXACTLY 30000 triangles.
import * as THREE from 'three';
import { Builder, tube as _tube, sphere as _sphere, exactGrid } from './geo.js';

export const GOLEM_TRIS = 30000;
const Q = 1.0, q = (n, min) => Math.max(min, Math.round(n * Q));
const tube = (p, r, rs = 16, ls = 0, o) => _tube(p, r, q(rs, 5), q(ls || (p.length - 1) * 4, 2), o);
const sphere = (r, w = 16, h = 12) => _sphere(r, q(w, 6), q(h, 4));
const C = { rock: 0x857a6c, rockD: 0x3c352e, moss: 0x55683a, crystal: 0x5ff0e0, core: 0xb8fff4, cloth: 0x7a2c1c, clothD: 0x220c08, gold: 0xd8a84a };
const cl = THREE.MathUtils.clamp;

export function buildGolem() {
  const mats = {
    body: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.05, roughness: 0.92, flatShading: true }),
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.8, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
  const b = new Builder(mats), J = {};
  const node = (name, parent, p) => { const n = new THREE.Group(); n.name = name; n.position.set(p[0], p[1], p[2]); if (parent) parent.add(n); J[name] = n; return n; };
  const A = (n, g, c, m = 'body', t = null, o = {}) => b.add(n, g, c, m, t, o);
  const cMoss = new THREE.Color(C.moss), cDark = new THREE.Color(C.rockD);
  const rock = (c, x, y, z, nx, ny) => {
    const n = Math.sin(x * 7.3 + y * 3.1) * Math.sin(y * 9.7 + z * 5.3) * Math.sin(z * 6.1 + x * 4.7);
    c.multiplyScalar(0.78 + 0.4 * n);
    if (ny > 0.45 && n > -0.2) c.lerp(cMoss, cl((ny - 0.45) * 1.6, 0, 0.7));
    if (Math.sin(x * 19 + z * 23) * Math.sin(y * 17) > 0.9) c.lerp(cDark, 0.7);
  };
  const R = { fn: rock };
  const crystal = (n, base, tip, r, o = {}) => A(n, tube([base, [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2, (base[2] + tip[2]) / 2], tip], [r, r * 0.8, 0.01], 6, 6, { flat: true }), C.crystal, 'glow', null,
    { ...o, fn: (c, x, y, z, nx, ny, nz) => c.multiplyScalar(0.5 + 0.5 * Math.abs(nx * 0.6 + ny * 0.5 + nz * 0.62)) });
  const lump = (n, p, r, s, o = {}) => A(n, sphere(r, 12, 8), C.rock, 'body', { p, s, r: [p[0] * 2, p[1] * 3, p[2] * 5] }, { ...o, fn: rock });

  const root = node('root', null, [0, 0, 0]);
  const body = node('body', root, [0, 1.75, 0]);
  // ---- torso
  A(body, tube([[0, -0.38, 0], [0, 0.1, 0], [0, 0.6, 0.05], [0, 1.1, 0.1], [0, 1.52, 0.1]], [[0.62, 0.5], [0.74, 0.58], [1.02, 0.76], [1.2, 0.84], [0.86, 0.62]], 40, 30, { up: [1, 0, 0] }), C.rock, 'body', null, R);
  A(body, sphere(0.27, 18, 12), C.core, 'glow', { p: [0, 0.95, 0.78], s: [1, 1.25, 0.5] });
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + 0.2, z = t => 0.84 - Math.abs(Math.cos(a)) * 0.1 * t;
    A(body, tube([[Math.cos(a) * 0.28, 0.95 + Math.sin(a) * 0.32, z(0)], [Math.cos(a + 0.25) * 0.5, 0.95 + Math.sin(a + 0.25) * 0.52, z(1)], [Math.cos(a - 0.15) * 0.74, 0.95 + Math.sin(a - 0.15) * 0.74, z(2.4)]], [0.045, 0.03, 0.008], 8, 8), C.crystal, 'glow');
  }
  for (let i = 0; i < 18; i++) { // rocky plates on the torso
    const a = i * 2.39996, y = -0.15 + (i % 6) * 0.3, k = 0.62 + 0.45 * Math.sin(Math.min(1, (y + 0.4) / 1.6) * Math.PI);
    if (Math.sin(a) > 0.55 && y > 0.5 && y < 1.4) continue; // keep the core visible
    lump(body, [Math.cos(a) * k * 1.0, y, Math.sin(a) * k * 0.72 + 0.05], 0.26 + (i % 3) * 0.05, [1, 0.8, 0.75]);
  }
  for (const [x, y, z, tx, ty, tz, r] of [[0, 1.3, -0.6, 0, 2.5, -1.3, 0.2], [0.4, 1.1, -0.65, 0.9, 2.1, -1.4, 0.16], [-0.4, 1.1, -0.65, -0.9, 2.1, -1.4, 0.16], [0.2, 0.7, -0.65, 0.4, 1.3, -1.5, 0.14], [-0.2, 0.7, -0.65, -0.4, 1.3, -1.5, 0.14], [0, 0.3, -0.55, 0, 0.6, -1.25, 0.12]])
    crystal(body, [x, y, z], [tx, ty, tz], r);
  // ---- head
  const head = node('head', body, [0, 1.62, 0.22]);
  A(head, sphere(0.46, 28, 18), C.rock, 'body', { p: [0, 0.08, 0], s: [1.05, 0.9, 1] }, R);
  A(head, tube([[-0.42, 0.2, 0.3], [-0.2, 0.24, 0.43], [0, 0.22, 0.47], [0.2, 0.24, 0.43], [0.42, 0.2, 0.3]], [0.09, 0.11, 0.1, 0.11, 0.09], 12, 16), C.rockD, 'body', null, R);
  A(head, sphere(0.2, 18, 10), C.core, 'glow', { p: [0, 0.07, 0.36], s: [1.3, 0.28, 0.5] });
  A(head, sphere(0.36, 20, 12), C.rockD, 'body', { p: [0, -0.26, 0.1], s: [0.95, 0.5, 0.95] }, R);
  for (const [x, tx, h] of [[0, 0, 0.7], [0.22, 0.4, 0.45], [-0.22, -0.4, 0.45]]) crystal(head, [x, 0.4, -0.05], [tx, 0.4 + h, -0.25], 0.1);
  // ---- limbs
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', m = { mirror: s < 0 }, RM = { ...m, fn: rock };
    A(body, sphere(0.64, 26, 16), C.rock, 'body', { p: [1.2, 1.2, 0.05], s: [1, 0.9, 0.95] }, RM);
    for (const [x, z, tx, ty, tz, r] of [[1.2, 0, 1.5, 2.5, -0.1, 0.17], [1.5, 0.2, 2.1, 2.0, 0.3, 0.13], [1.0, -0.3, 1.1, 2.2, -0.7, 0.13], [1.55, -0.25, 2.2, 1.7, -0.5, 0.11]])
      crystal(body, [x, 1.6, z], [tx, ty, tz], r, m);
    const arm = node('arm' + L, body, [s * 1.38, 1.12, 0.05]);
    A(arm, tube([[0, 0.05, 0], [0.08, -0.45, 0], [0.05, -0.9, 0.05]], [0.4, 0.37, 0.3], 26, 14), C.rock, 'body', null, RM);
    lump(arm, [0.3, -0.3, 0.05], 0.24, [0.7, 1.2, 1], m); lump(arm, [0.05, -0.55, 0.28], 0.2, [1, 1.1, 0.6], m);
    const fore = node('fore' + L, arm, [s * 0.05, -0.9, 0.05]);
    A(fore, sphere(0.35, 20, 12), C.rockD, 'body', null, RM);
    A(fore, tube([[0, 0, 0], [0, -0.45, 0.05], [0, -0.95, 0.1]], [0.3, 0.43, 0.53], 28, 14), C.rock, 'body', null, RM);
    A(fore, sphere(0.58, 26, 16), C.rock, 'body', { p: [0, -1.22, 0.12], s: [1, 0.88, 1] }, RM);
    for (let i = 0; i < 4; i++) A(fore, sphere(0.17, 12, 8), C.rockD, 'body', { p: [-0.33 + i * 0.22, -1.5, 0.42], s: [1, 1, 1.1] }, RM);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; crystal(fore, [Math.cos(a) * 0.4, -0.72, 0.08 + Math.sin(a) * 0.4], [Math.cos(a) * 0.72, -0.5, 0.08 + Math.sin(a) * 0.72], 0.09, m); }
    lump(fore, [0.36, -0.5, 0.1], 0.22, [0.7, 1.3, 1], m);

    const leg = node('leg' + L, body, [s * 0.48, -0.25, 0]);
    A(leg, tube([[0, 0.12, 0], [0.03, -0.3, 0.03], [0, -0.65, 0]], [0.44, 0.41, 0.34], 26, 12), C.rock, 'body', null, RM);
    lump(leg, [0.15, -0.3, 0.3], 0.24, [1, 1.2, 0.6], m);
    const shin = node('shin' + L, leg, [0, -0.65, 0]);
    A(shin, sphere(0.37, 20, 12), C.rockD, 'body', null, RM);
    A(shin, tube([[0, 0, 0], [0, -0.35, 0], [0, -0.62, 0.02]], [0.33, 0.41, 0.47], 26, 12), C.rock, 'body', null, RM);
    A(shin, sphere(0.5, 24, 14), C.rock, 'body', { p: [0, -0.66, 0.16], s: [1, 0.42, 1.4] }, RM);
    crystal(shin, [0, 0.05, 0.3], [0, 0.35, 0.75], 0.11, m);
  }
  // ---- belt
  A(body, tube(Array.from({ length: 13 }, (_, i) => { const a = i / 12 * Math.PI * 2; return [Math.cos(a) * 0.72, -0.12, Math.sin(a) * 0.58]; }), Array(13).fill(0.09), 10, 48), C.gold, 'body');
  // ---- tattered waist cloth absorbs the remaining budget so the total is exactly GOLEM_TRIS
  const cloth = node('cloth', body, [0, -0.16, 0]);
  const rest = GOLEM_TRIS - b.tris;
  if (rest < 1500) throw new Error('golem polygon budget exceeded: ' + b.tris);
  const dk = new THREE.Color(C.clothD), gd = new THREE.Color(C.gold);
  A(cloth, exactGrid(rest, 60, (u, v) => {
    const a = u * Math.PI * 2, r = (0.7 + 0.24 * v) * (1 + 0.05 * Math.sin(a * 9) * v), len = 0.85 + 0.3 * Math.sin(a * 5) + 0.14 * Math.sin(a * 13);
    return [Math.cos(a) * r, -v * len, Math.sin(a) * r * 0.82];
  }), C.cloth, 'cloth', null, { fn: (c, x, y) => { c.lerp(dk, cl(-y * 0.8, 0, 0.8)); if (y > -0.1) c.lerp(gd, 0.8); c.multiplyScalar(0.85 + 0.15 * Math.sin(Math.atan2(x, 1) * 40)); } });

  const tris = b.finish();
  return { root, J, tris, mats };
}

export const GOLEM = {
  name: '岩晶巨人ガルガン', build: buildGolem, center: 2.1, minY: 2.0, reach: 2.2, shadow: 5.5, glowColor: 0x5ff0e0,
  glows: [{ j: 'body', o: [0, 0.95, 0.95], s: 2.4, c: 0x5ff0e0, a: 0.5 }, { j: 'head', o: [0, 0.07, 0.5], s: 1.0, c: 0x9ffff0, a: 0.8 }],
  hits: [
    ['head', [0, 0, 0.1], 0.6, 1.6], ['body', [0, 0.95, 0.1], 1.15, 1], ['body', [0, 0.1, 0], 0.8, 1],
    ['foreL', [0, -0.95, 0.1], 0.65, 0.7], ['foreR', [0, -0.95, 0.1], 0.65, 0.7], ['armL', [0, -0.4, 0], 0.5, 0.7], ['armR', [0, -0.4, 0], 0.5, 0.7],
    ['shinL', [0, -0.35, 0], 0.5, 0.8], ['shinR', [0, -0.35, 0], 0.5, 0.8],
  ],
  weak: [{ j: 'body', o: [0, 0.95, 0.85] }, { j: 'head', o: [0, 0.07, 0.45] }, { j: 'foreL', o: [0, -1.2, 0.3] }, { j: 'shinL', o: [0, 0, 0.35] }, { j: 'body', o: [0, 1.6, -0.9] }],
  poses: {
    IDLE: { body: [0.14, 0, 0], head: [0.1, 0, 0], armL: [-0.15, 0, 0.18], armR: [-0.15, 0, -0.18], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], legL: [-0.15, 0, 0.08], legR: [-0.15, 0, -0.08], shinL: [0.1, 0, 0], shinR: [0.1, 0, 0] },
    ROAR: { body: [-0.28, 0, 0], head: [-0.4, 0, 0], armL: [-0.4, 0, 1.25], armR: [-0.4, 0, -1.25], foreL: [-1.3, 0, 0], foreR: [-1.3, 0, 0], legL: [0.25, 0, 0.15], legR: [0.25, 0, -0.15] },
    WIND: { body: [-0.3, 0.5, 0], head: [0.2, -0.4, 0], armL: [-2.7, 0, 0.35], foreL: [-0.7, 0, 0], armR: [0.3, 0, -0.35], foreR: [-0.5, 0, 0], legL: [0.3, 0, 0.1], legR: [0.3, 0, -0.1] },
    DASH: { body: [0.6, -0.45, 0], head: [-0.35, 0.3, 0], armL: [-1.55, 0, -0.25], foreL: [-0.15, 0, 0], armR: [0.7, 0, -0.5], foreR: [-0.4, 0, 0], legL: [-1.0, 0, 0.1], shinL: [0.7, 0, 0], legR: [-0.1, 0, -0.1], shinR: [0.5, 0, 0] },
    DEAD: { body: [1.25, 0, 0.1], head: [0.5, 0.3, 0], armL: [-0.9, 0, 0.9], armR: [-0.9, 0, -0.9], foreL: [-0.4, 0, 0], foreR: [-0.4, 0, 0], legL: [-1.15, 0, 0.2], legR: [-1.15, 0, -0.2], shinL: [1.2, 0, 0], shinR: [1.2, 0, 0] },
  },
  idle(m, t, f) {
    m.body[0] += Math.sin(t * 1.1) * 0.035 - f * 0.25; m.body[2] += Math.sin(t * 29) * f * 0.05; m.body[1] += Math.sin(t * 0.55) * 0.06;
    m.head[1] += Math.sin(t * 0.7) * 0.18; m.head[0] += Math.sin(t * 1.1 + 1) * 0.05 - f * 0.3;
    m.armL[0] += Math.sin(t * 1.1 + 2) * 0.07; m.armR[0] += Math.sin(t * 1.1 + 3) * 0.07; m.armL[2] += f * 0.4; m.armR[2] -= f * 0.4;
    m.foreL[0] += Math.sin(t * 1.5) * 0.06; m.foreR[0] += Math.sin(t * 1.5 + 1) * 0.06;
    m.cloth[0] += Math.sin(t * 1.3) * 0.05; m.cloth[2] += Math.sin(t * 0.9) * 0.04;
  },
};
