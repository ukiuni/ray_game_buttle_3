// The monster: a horned dragon built procedurally with EXACTLY 30000 triangles.
import * as THREE from 'three';
import { Builder, tube as _tube, sphere as _sphere, exactGrid } from './geo.js';

// detail factor: tuned so the body uses ~24k triangles and the wing membranes take the rest
const Q = 0.81, q = (n, min) => Math.max(min, Math.round(n * Q));
const tube = (p, r, rs = 16, ls = 0, o) => _tube(p, r, q(rs, 6), q(ls || (p.length - 1) * 4, 2), o);
const sphere = (r, w = 16, h = 12) => _sphere(r, q(w, 6), q(h, 4));

export const MON_TRIS = 30000;
const C = { hide: 0x8a1a2c, hideD: 0x3c0c1c, belly: 0xe0a860, horn: 0xefe4c8, claw: 0x15151c, glow: 0xff9a2a, eye: 0xfff47a, wing: 0x6a1436, wingD: 0x2a0818, spike: 0x2c0e18 };
const cl = THREE.MathUtils.clamp;

export function buildMonster() {
  const mats = {
    body: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.5 }),
    wing: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.65, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
  const b = new Builder(mats), J = {};
  const node = (name, parent, p) => { const n = new THREE.Group(); n.name = name; n.position.set(p[0], p[1], p[2]); if (parent) parent.add(n); J[name] = n; return n; };
  const A = (n, g, c, m = 'body', t = null, o = {}) => b.add(n, g, c, m, t, o);
  const cBelly = new THREE.Color(C.belly), cDark = new THREE.Color(C.hideD);
  // scaly hide with a lighter, banded underside. (vx,vy,vz) = ventral direction in local space
  const hide = (vx, vy, vz, f = 20) => (c, x, y, z, nx, ny, nz) => {
    const v = nx * vx + ny * vy + nz * vz;
    c.lerp(cDark, cl(-v * 0.75, 0, 0.65));
    c.multiplyScalar(0.82 + 0.18 * Math.sin(x * 23) * Math.sin(y * 21 + z * 17));
    if (v > 0.3) { c.lerp(cBelly, cl((v - 0.3) * 3, 0, 1)); if (Math.sin((y * 0.8 - z * 0.6) * f) > 0.72) c.multiplyScalar(0.55); }
  };
  const spike = (n, base, tip, r, o = {}) => A(n, tube([base, [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2 + 0.02, (base[2] + tip[2]) / 2], tip], [r, r * 0.6, 0.006], 10, 4), o.c || C.spike, 'body', null, o);
  const claw = (n, a, d, len, r, o) => A(n, tube([a, [a[0] + d[0] * len * 0.5, a[1] + d[1] * len * 0.5 + len * 0.1, a[2] + d[2] * len * 0.5], [a[0] + d[0] * len, a[1] + d[1] * len - len * 0.18, a[2] + d[2] * len]], [r, r * 0.7, 0.008], 10, 5), C.claw, 'body', null, o);

  const root = node('root', null, [0, 0, 0]);
  const body = node('body', root, [0, 1.85, 0]);

  // ---- torso
  A(body, tube([[0, -0.3, -0.4], [0, 0.1, -0.1], [0, 0.55, 0.2], [0, 1.0, 0.5], [0, 1.32, 0.74]], [[0.48, 0.52], [0.74, 0.8], [0.82, 0.92], [0.72, 0.8], [0.42, 0.45]], 40, 32), C.hide, 'body', null, { fn: hide(0, -0.6, 0.8) });
  A(body, sphere(0.18, 18, 12), C.glow, 'glow', { p: [0, 0.3, 0.89], s: [1, 1.2, 0.5] });
  for (let i = 0; i < 6; i++) { // glowing cracks around the core
    const a = i / 6 * Math.PI * 2 + 0.3;
    A(body, tube([[Math.cos(a) * 0.2, 0.3 + Math.sin(a) * 0.22, 0.9 - Math.abs(Math.cos(a)) * 0.03], [Math.cos(a + 0.2) * 0.34, 0.3 + Math.sin(a + 0.2) * 0.36, 0.86 - Math.abs(Math.cos(a)) * 0.1], [Math.cos(a - 0.1) * 0.48, 0.3 + Math.sin(a - 0.1) * 0.5, 0.79 - Math.abs(Math.cos(a)) * 0.2]], [0.035, 0.022, 0.006], 8, 6), C.glow, 'glow');
  }
  const back = [[0.0, -0.62], [0.42, -0.5], [0.85, -0.28], [1.25, 0.02], [1.55, 0.3]]; // dorsal ridge (y,z)
  back.forEach(([y, z], i) => spike(body, [0, y, z + 0.08], [0, y + 0.38 + i * 0.03, z - 0.5], 0.13));
  for (const s of [1, -1]) {
    A(body, sphere(0.36, 22, 14), C.hide, 'body', { p: [0.58, 1.0, 0.42], s: [1, 0.9, 1] }, { mirror: s < 0, fn: hide(0, -0.6, 0.8) });
    spike(body, [0.72, 1.22, 0.4], [1.0, 1.6, 0.25], 0.1, { mirror: s < 0 });
    spike(body, [0.82, 1.1, 0.42], [1.2, 1.25, 0.35], 0.08, { mirror: s < 0 });
  }

  // ---- neck & head
  const neck1 = node('neck1', body, [0, 1.28, 0.7]);
  A(neck1, tube([[0, -0.12, -0.06], [0, 0.2, 0.1], [0, 0.5, 0.24]], [[0.42, 0.44], [0.38, 0.4], [0.34, 0.35]], 28, 10), C.hide, 'body', null, { fn: hide(0, -0.45, 0.9, 26) });
  spike(neck1, [0, 0.25, -0.24], [0, 0.55, -0.62], 0.1);
  const neck2 = node('neck2', neck1, [0, 0.5, 0.24]);
  A(neck2, sphere(0.345, 22, 12), C.hide, 'body', null, { fn: hide(0, -0.45, 0.9, 26) });
  A(neck2, tube([[0, -0.05, -0.03], [0, 0.2, 0.13], [0, 0.45, 0.3]], [[0.34, 0.35], [0.31, 0.32], [0.28, 0.29]], 28, 10), C.hide, 'body', null, { fn: hide(0, -0.5, 0.85, 26) });
  spike(neck2, [0, 0.2, -0.16], [0, 0.48, -0.52], 0.09);
  const head = node('head', neck2, [0, 0.45, 0.3]);
  A(head, sphere(0.4, 32, 20), C.hide, 'body', { p: [0, 0.1, 0.12], s: [0.95, 0.78, 1.05] }, { fn: hide(0, -1, 0.1) });
  A(head, tube([[0, 0.1, 0.25], [0, 0.07, 0.55], [0, 0.03, 0.85], [0, -0.02, 1.08]], [[0.25, 0.32], [0.2, 0.27], [0.165, 0.22], [0.11, 0.16]], 24, 14), C.hide, 'body', null, { fn: hide(0, -1, 0) });
  A(head, sphere(0.2, 16, 10), C.glow, 'glow', { p: [0, -0.06, 0.3], s: [1, 0.5, 1.4] }); // furnace glow in the throat
  for (const s of [1, -1]) {
    const m = { mirror: s < 0 };
    A(head, sphere(0.075, 14, 10), C.eye, 'glow', { p: [0.245, 0.2, 0.42], s: [0.6, 0.8, 1.3], r: [0, 0, -0.3] }, m);
    A(head, sphere(0.03, 8, 6), C.claw, 'body', { p: [0.275, 0.2, 0.45], s: [0.5, 1.4, 0.6] }, m);
    A(head, tube([[0.1, 0.3, 0.6], [0.22, 0.33, 0.42], [0.33, 0.3, 0.18], [0.36, 0.22, -0.05]], [0.05, 0.08, 0.075, 0.03], 12, 10), C.hideD, 'body', null, m); // brow
    A(head, tube([[0.2, 0.32, 0.0], [0.34, 0.6, -0.3], [0.42, 0.95, -0.68], [0.36, 1.3, -0.98]], [0.125, 0.105, 0.07, 0.01], 16, 18), C.horn, 'body', null, { ...m, fn: (c, x, y) => { c.multiplyScalar(0.75 + 0.25 * Math.sin(y * 40)); if (y < 0.42) c.lerp(cDark, 0.6); } });
    A(head, tube([[0.3, 0.05, 0.0], [0.5, 0.05, -0.2], [0.62, 0.16, -0.5]], [0.08, 0.06, 0.008], 12, 10), C.horn, 'body', null, m);
    A(head, tube([[0.26, -0.08, 0.1], [0.4, -0.2, -0.02], [0.44, -0.36, -0.2]], [0.06, 0.045, 0.006], 10, 8), C.horn, 'body', null, m);
    A(head, sphere(0.045, 10, 8), C.claw, 'body', { p: [0.075, 0.05, 1.12], s: [1, 0.7, 1.2] }, m); // nostril
    spike(head, [0.07, 0.11, 0.95], [0.08, 0.3, 0.92], 0.04, { ...m, c: C.horn });
    for (let i = 0; i < 9; i++) { // upper teeth
      const z = 0.36 + i * 0.085, x = 0.245 - i * 0.014, len = i === 6 ? 0.2 : 0.1 + 0.03 * (i % 2);
      A(head, tube([[x, -0.1 + i * 0.006, z], [x, -0.1 - len, z + 0.01]], [0.03, 0.004], 8, 2), C.horn, 'body', null, m);
    }
  }
  spike(head, [0, 0.36, 0.05], [0, 0.62, -0.3], 0.08);
  spike(head, [0, 0.38, 0.3], [0, 0.56, 0.12], 0.06);
  const jaw = node('jaw', head, [0, -0.08, 0.12]);
  A(jaw, tube([[0, -0.08, -0.05], [0, -0.13, 0.4], [0, -0.11, 0.92]], [[0.11, 0.28], [0.1, 0.24], [0.06, 0.13]], 22, 12), C.hide, 'body', null, { fn: hide(0, -1, 0) });
  spike(jaw, [0, -0.2, 0.75], [0, -0.42, 0.7], 0.05, { c: C.horn });
  for (const s of [1, -1]) for (let i = 0; i < 8; i++) {
    const z = 0.3 + i * 0.08, x = 0.21 - i * 0.016, len = i === 6 ? 0.17 : 0.09 + 0.02 * (i % 2);
    A(jaw, tube([[x, -0.06, z], [x, -0.06 + len, z + 0.01]], [0.028, 0.004], 8, 2), C.horn, 'body', null, { mirror: s < 0 });
  }

  // ---- tail (chain of segments)
  const R = [0.5, 0.42, 0.35, 0.28, 0.22, 0.16, 0.11, 0.06];
  let prev = body;
  for (let i = 0; i < 7; i++) {
    const t = node('tail' + (i + 1), prev, i === 0 ? [0, -0.18, -0.42] : [0, 0, -0.6]);
    A(t, sphere(R[i], 20, 12), C.hide, 'body', { s: [1.02, 1, 1] }, { fn: hide(0, -1, 0, 26) });
    A(t, tube([[0, 0, 0], [0, 0, -0.3], [0, 0, -0.6]], [[R[i], R[i] * 1.02], [(R[i] + R[i + 1]) / 2, (R[i] + R[i + 1]) / 2], [R[i + 1], R[i + 1]]], 20, 6), C.hide, 'body', null, { fn: hide(0, -1, 0, 26) });
    spike(t, [0, R[i] * 0.8, -0.2], [0, R[i] + 0.3 - i * 0.02, -0.55], 0.04 + R[i] * 0.16);
    prev = t;
  }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]])
    spike(prev, [dx * 0.04, dy * 0.04, -0.5], [dx * 0.42, dy * 0.42, -0.85], 0.07, { c: C.horn });
  spike(prev, [0, 0, -0.55], [0, 0, -1.15], 0.09, { c: C.horn });

  // ---- limbs & wings (built on +X then mirrored)
  const wings = [];
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', m = { mirror: s < 0 };
    const leg = node('leg' + L, body, [s * 0.5, -0.05, -0.05]);
    A(leg, tube([[0, 0.12, -0.05], [0.12, -0.4, 0.25], [0.15, -0.75, 0.4]], [0.44, 0.4, 0.24], 26, 14), C.hide, 'body', null, { ...m, fn: hide(-0.3, -0.3, 0.9) });
    const shin = node('shin' + L, leg, [s * 0.15, -0.75, 0.4]);
    A(shin, sphere(0.25, 18, 12), C.hide, 'body', null, { ...m, fn: hide(0, 0, 1) });
    A(shin, tube([[0, 0, 0], [0, -0.4, -0.25], [0, -0.72, -0.38]], [0.25, 0.2, 0.14], 22, 12), C.hide, 'body', null, { ...m, fn: hide(0, 0.3, 1) });
    spike(shin, [0, 0.05, 0.2], [0, 0.22, 0.5], 0.09, m);
    const foot = node('foot' + L, shin, [0, -0.72, -0.38]);
    A(foot, sphere(0.16, 16, 10), C.hide, 'body', null, m);
    A(foot, tube([[0, 0, -0.05], [0, -0.12, 0.25], [0, -0.2, 0.55]], [[0.15, 0.17], [0.12, 0.22], [0.08, 0.2]], 20, 10), C.hide, 'body', null, { ...m, fn: hide(0, -1, 0) });
    for (const dx of [-0.13, 0, 0.13]) claw(foot, [dx, -0.2, 0.58], [dx * 1.5, 0, 1], 0.36, 0.075, m);
    claw(foot, [0, -0.05, -0.12], [0, 0, -1], 0.25, 0.06, m);

    const arm = node('arm' + L, body, [s * 0.66, 0.95, 0.5]);
    A(arm, tube([[0, 0.05, -0.02], [0.14, -0.3, 0.05], [0.2, -0.55, 0.15]], [0.25, 0.21, 0.15], 22, 12), C.hide, 'body', null, { ...m, fn: hide(-0.4, 0, 0.9) });
    const fore = node('fore' + L, arm, [s * 0.2, -0.55, 0.15]);
    A(fore, sphere(0.16, 16, 10), C.hide, 'body', null, m);
    A(fore, tube([[0, 0, 0], [-0.05, -0.2, 0.25], [-0.08, -0.3, 0.5]], [0.16, 0.15, 0.11], 20, 10), C.hide, 'body', null, { ...m, fn: hide(-0.3, -0.5, 0.5) });
    spike(fore, [0.05, 0.05, -0.1], [0.12, 0.2, -0.4], 0.07, m);
    A(fore, sphere(0.14, 16, 10), C.hideD, 'body', { p: [-0.08, -0.31, 0.56] }, m);
    for (const dx of [-0.11, 0, 0.11]) claw(fore, [-0.08 + dx, -0.33, 0.64], [dx * 2, -0.5, 0.85], 0.38, 0.06, m);

    const wing = node('wing' + L, body, [s * 0.35, 1.2, 0.05]);
    const W = [0.9, 1.0, -0.45], F = [[2.7, 1.95, -0.9], [3.15, 0.6, -1.1], [2.5, -0.75, -1.0], [0.25, -0.55, -0.5]];
    A(wing, sphere(0.2, 16, 10), C.hide, 'body', null, m);
    A(wing, tube([[0, 0, 0], [0.5, 0.6, -0.25], W], [0.15, 0.12, 0.09], 16, 10), C.hide, 'body', null, m);
    spike(wing, [W[0], W[1] + 0.03, W[2]], [W[0] + 0.1, W[1] + 0.5, W[2] + 0.2], 0.08, { ...m, c: C.horn });
    F.slice(0, 3).forEach(f => A(wing, tube([W, [(W[0] + f[0]) / 2, (W[1] + f[1]) / 2 + 0.08, (W[2] + f[2]) / 2 - 0.05], f], [0.075, 0.05, 0.012], 10, 10), C.hideD, 'body', null, m));
    wings.push({ wing, m, W, F });
  }

  // ---- wing membranes absorb the remaining budget so the total is exactly MON_TRIS
  const rest = MON_TRIS - b.tris;
  if (rest < 2000) throw new Error('monster polygon budget exceeded: ' + b.tris);
  const cW = new THREE.Color(C.wingD), cG = new THREE.Color(0xc03a28);
  wings.forEach(({ wing, m, W, F }, k) => {
    const n = k === 0 ? Math.ceil(rest / 2) : Math.floor(rest / 2);
    A(wing, exactGrid(n, 42, (u, v) => {
      const f = u * 3, i = Math.min(Math.floor(f), 2), q = f - i, a = F[i], c = F[i + 1];
      const sc = 1 - 0.2 * Math.sin(Math.PI * q) * v, bil = -0.22 * Math.sin(Math.PI * q) * v;
      const tx = a[0] + (c[0] - a[0]) * q, ty = a[1] + (c[1] - a[1]) * q, tz = a[2] + (c[2] - a[2]) * q;
      return [W[0] + (tx - W[0]) * v * sc, W[1] + (ty - W[1]) * v * sc, W[2] + (tz - W[2]) * v * sc + bil];
    }), C.wing, 'wing', null, { ...m, fn: (c, x, y, z) => { const d = Math.hypot(x - W[0], y - W[1]); c.lerp(cW, cl(d / 2.6, 0, 0.85)); c.lerp(cG, 0.25 * cl(1 - d / 1.2, 0, 1)); c.multiplyScalar(0.85 + 0.15 * Math.sin(d * 18)); } });
  });

  const tris = b.finish();
  return { root, J, tris, mats };
}

export const MON_POSES = {
  IDLE: {
    neck1: [0.3, 0, 0], neck2: [0.3, 0, 0], head: [0.5, 0, 0], jaw: [0.12, 0, 0],
    tail1: [-0.5, 0, 0], tail2: [-0.12, 0, 0], tail3: [0.15, 0, 0], tail4: [0.2, 0, 0], tail5: [0.2, 0, 0], tail6: [0.15, 0, 0], tail7: [0.1, 0, 0],
    armL: [-0.2, 0, 0.25], armR: [-0.2, 0, -0.25], foreL: [-0.4, 0, 0], foreR: [-0.4, 0, 0],
    wingL: [0, 0.25, -0.15], wingR: [0, -0.25, 0.15],
  },
  ROAR: {
    body: [-0.25, 0, 0], neck1: [-0.35, 0, 0], neck2: [-0.2, 0, 0], head: [-0.25, 0, 0], jaw: [0.75, 0, 0],
    tail1: [-0.35, 0, 0], tail3: [0.2, 0, 0], tail4: [0.25, 0, 0], tail5: [0.25, 0, 0],
    armL: [-0.5, 0, 0.9], armR: [-0.5, 0, -0.9], foreL: [-0.8, 0, 0], foreR: [-0.8, 0, 0],
    wingL: [0, -0.1, 0.45], wingR: [0, 0.1, -0.45],
  },
  CLAW_UP: {
    body: [-0.3, 0.45, 0], neck1: [0.2, -0.3, 0], neck2: [0.2, 0, 0], head: [0.3, 0, 0], jaw: [0.5, 0, 0],
    tail1: [-0.4, 0.3, 0], tail3: [0.2, 0.2, 0], tail4: [0.2, 0.2, 0],
    armR: [-2.7, 0, -0.5], foreR: [-0.3, 0, 0], armL: [-0.3, 0, 0.4], foreL: [-0.6, 0, 0],
    wingL: [0, 0, 0.35], wingR: [0, 0, -0.35],
  },
  CLAW_HIT: {
    body: [0.6, -0.5, 0], neck1: [0.3, 0.3, 0], neck2: [0.2, 0, 0], head: [0.2, 0, 0], jaw: [0.6, 0, 0],
    tail1: [-0.2, -0.3, 0], tail3: [0.2, -0.2, 0], tail4: [0.2, -0.2, 0],
    armR: [-0.9, 0, 0.5], foreR: [-0.2, 0, 0], armL: [0.3, 0, 0.5], foreL: [-0.6, 0, 0],
    wingL: [0, 0.4, -0.2], wingR: [0, -0.4, 0.2],
  },
  DEAD: {
    body: [1.1, 0, 0.15], neck1: [0.5, 0.3, 0], neck2: [0.4, 0.2, 0], head: [0.2, 0.3, 0.3], jaw: [0.5, 0, 0],
    tail1: [-0.9, 0.2, 0], tail2: [0.3, 0.2, 0], tail3: [0.3, 0.2, 0], tail4: [0.2, 0, 0],
    armL: [-1.2, 0, 0.6], armR: [-1.2, 0, -0.6], legL: [-0.9, 0, 0.3], legR: [-0.9, 0, -0.3], shinL: [0.6, 0, 0], shinR: [0.6, 0, 0],
    wingL: [0, 0.9, -0.7], wingR: [0, -0.9, 0.7],
  },
};
