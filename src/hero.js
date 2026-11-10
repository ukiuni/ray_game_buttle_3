// The hero: an armored knight built procedurally with EXACTLY 20000 triangles.
import * as THREE from 'three';
import { Builder, tube as _tube, lathe as _lathe, sphere as _sphere, torus as _torus, exactGrid } from './geo.js';

// detail factor: tuned so the body uses ~17k triangles and the cape takes the rest
const Q = 0.79, q = n => Math.max(4, Math.round(n * Q));
const tube = (p, r, rs = 16, ls = 0, o) => _tube(p, r, q(rs), q(ls || (p.length - 1) * 4), o);
const lathe = (p, rs = 24, sz = 1) => _lathe(p, q(rs), sz, q((p.length - 1) * 4));
const sphere = (r, w = 16, h = 12) => _sphere(r, q(w), q(h));
const torus = (R, r, rs = 8, ts = 24) => _torus(R, r, q(rs), q(ts));

export const HERO_TRIS = 20000;
const C = { armor: 0x2f5fe0, armorD: 0x18306e, dark: 0x10142a, gold: 0xf5b83a, steel: 0xe6eefc, glow: 0x8ff8ff, cloth: 0xc8182e, clothD: 0x5a0a1a, under: 0x1c1e2a };

export function buildHero() {
  const mats = {
    armor: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.28 }),
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.0, roughness: 0.75, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
  const b = new Builder(mats), J = {};
  const node = (name, parent, p) => { const n = new THREE.Group(); n.name = name; n.position.set(p[0], p[1], p[2]); if (parent) parent.add(n); J[name] = n; return n; };
  const root = node('root', null, [0, 0, 0]);
  const hips = node('hips', root, [0, 0.98, 0]);
  const torso = node('torso', hips, [0, 0.06, 0]);
  const head = node('head', torso, [0, 0.6, 0]);
  const A = (n, g, c, m = 'armor', t = null, o = {}) => b.add(n, g, c, m, t, o);
  const trim = (c, x, y) => { };

  // ---- pelvis
  A(hips, lathe([[0.05, -0.2], [0.15, -0.14], [0.178, -0.04], [0.165, 0.06], [0.13, 0.12]], 24, 0.76), C.under);
  A(hips, torus(0.158, 0.026, 10, 32), C.gold, 'armor', { p: [0, 0.05, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.8, 1] });
  A(hips, sphere(0.04, 14, 10), C.glow, 'glow', { p: [0, 0.05, 0.135], s: [1, 1, 0.6] });
  for (const [x, z, ry] of [[0.13, 0.06, 0.5], [-0.13, 0.06, -0.5], [0.15, -0.05, 2.2], [-0.15, -0.05, -2.2], [0, 0.12, 0]])
    A(hips, sphere(0.1, 16, 10), C.armor, 'armor', { p: [x, -0.1, z], r: [0, ry, 0], s: [0.85, 1.25, 0.32] }, { fn: (c, px, py) => { if (py < -0.19) c.set(C.gold); } });

  // ---- torso
  A(torso, lathe([[0.12, 0.0], [0.125, 0.1], [0.15, 0.2], [0.2, 0.34], [0.215, 0.44], [0.17, 0.53], [0.08, 0.58]], 28, 0.72), C.armor, 'armor', null,
    { fn: (c, x, y) => { if (y < 0.19) c.set(C.under); else if (y < 0.215) c.set(C.gold); } });
  A(torso, sphere(0.2, 24, 16), C.armor, 'armor', { p: [0, 0.4, 0.06], s: [1, 0.78, 0.72] }, { fn: (c, x, y, z) => { if (Math.abs(x) < 0.012 && z > 0.1) c.set(C.gold); if (y < 0.3) c.set(C.armorD); } });
  A(torso, torus(0.045, 0.012, 8, 20), C.gold, 'armor', { p: [0, 0.42, 0.2] });
  A(torso, sphere(0.036, 14, 10), C.glow, 'glow', { p: [0, 0.42, 0.2] });
  for (const s of [1, -1]) for (let i = 0; i < 3; i++)
    A(torso, sphere(0.05, 10, 8), C.armorD, 'armor', { p: [s * 0.05, 0.26 - i * 0.055, 0.1 - i * 0.012], s: [1, 0.5, 0.5] });
  A(torso, torus(0.1, 0.022, 8, 24), C.gold, 'armor', { p: [0, 0.55, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.85, 1] });
  A(torso, lathe([[0.06, 0.52], [0.055, 0.6], [0.06, 0.66]], 14, 1), C.under);

  // ---- head / helmet
  A(head, sphere(0.13, 32, 24), C.armor, 'armor', { p: [0, 0.12, 0], s: [1, 1.1, 1.1] }, { fn: (c, x, y, z) => { if (z > 0.06 && y > 0.07 && y < 0.17) c.set(C.dark); if (y < 0.02) c.set(C.armorD); } });
  A(head, tube([[-0.1, 0.125, 0.1], [-0.05, 0.122, 0.137], [0, 0.12, 0.147], [0.05, 0.122, 0.137], [0.1, 0.125, 0.1]], [[0.012, 0.008], [0.014, 0.008], [0.014, 0.008], [0.014, 0.008], [0.012, 0.008]], 8, 12), C.glow, 'glow');
  A(head, tube([[0, 0.03, 0.13], [0, 0.08, 0.146], [0, 0.12, 0.148]], [[0.006, 0.008], [0.006, 0.008], [0.006, 0.008]], 8, 4), C.glow, 'glow');
  A(head, tube([[0, 0.17, 0.14], [0, 0.26, 0.07], [0, 0.29, -0.04], [0, 0.24, -0.14], [0, 0.14, -0.17]], [[0.025, 0.012], [0.05, 0.014], [0.06, 0.014], [0.05, 0.012], [0.02, 0.01]], 12, 20, { up: [0, 1, 0] }), C.gold);
  A(head, tube([[0, 0.3, -0.05], [0, 0.36, -0.2], [0, 0.3, -0.38], [0, 0.14, -0.5], [0, -0.05, -0.55]], [[0.03, 0.02], [0.07, 0.035], [0.08, 0.04], [0.06, 0.03], [0.01, 0.008]], 14, 24), C.cloth, 'cloth', null,
    { fn: (c, x, y) => c.lerp(new THREE.Color(C.clothD), THREE.MathUtils.clamp((0.3 - y) * 1.6, 0, 0.8)) });
  for (const s of [1, -1]) {
    A(head, tube([[0.115, 0.14, 0.02], [0.17, 0.2, -0.04], [0.2, 0.3, -0.14], [0.19, 0.42, -0.26]], [[0.03, 0.02], [0.028, 0.016], [0.02, 0.012], [0.004, 0.004]], 12, 16), C.gold, 'armor', null, { mirror: s < 0 });
    A(head, sphere(0.035, 12, 8), C.gold, 'armor', { p: [0.125, 0.13, 0.01], s: [0.5, 1, 1] }, { mirror: s < 0 });
    A(head, sphere(0.07, 14, 10), C.armorD, 'armor', { p: [0.085, 0.045, 0.07], s: [0.5, 0.8, 1] }, { mirror: s < 0 });
  }

  // ---- limbs
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', m = { mirror: s < 0 };
    const arm = node('arm' + L, torso, [s * 0.27, 0.45, 0]);
    const fore = node('fore' + L, arm, [0, -0.28, 0]);
    // pauldron
    A(arm, sphere(0.13, 24, 14), C.armor, 'armor', { p: [0.02, 0.03, 0], s: [1.05, 0.8, 1.1] }, { ...m, fn: (c, x, y) => { if (y < -0.035) c.set(C.gold); } });
    A(arm, sphere(0.1, 20, 10), C.armorD, 'armor', { p: [0.06, -0.03, 0], s: [1.05, 0.7, 1.15] }, m);
    A(arm, tube([[0.07, 0.09, 0], [0.14, 0.17, -0.01], [0.2, 0.3, -0.04]], [0.035, 0.022, 0.003], 12, 8), C.gold, 'armor', null, m);
    A(arm, tube([[0, 0, 0], [0.005, -0.14, 0], [0, -0.28, 0]], [0.068, 0.064, 0.052], 20, 12), C.under, 'armor', null, m);
    A(arm, torus(0.062, 0.012, 8, 20), C.gold, 'armor', { p: [0, -0.15, 0], r: [Math.PI / 2, 0, 0] }, m);
    A(fore, sphere(0.058, 16, 12), C.gold, 'armor', null, m);
    A(fore, tube([[0, -0.02, 0], [0, -0.1, 0], [0, -0.2, 0], [0, -0.27, 0]], [0.05, 0.07, 0.062, 0.046], 20, 12), C.armor, 'armor', null, { ...m, fn: (c, x, y) => { if (y > -0.06 || y < -0.245) c.set(C.gold); } });
    A(fore, tube([[0.05, -0.05, -0.01], [0.085, -0.12, -0.03], [0.07, -0.02, -0.1]], [[0.03, 0.012], [0.03, 0.01], [0.003, 0.003]], 10, 8), C.gold, 'armor', null, m);
    A(fore, sphere(0.052, 16, 12), C.dark, 'armor', { p: [0, -0.31, 0], s: [0.9, 1.1, 1] }, m);

    const leg = node('leg' + L, hips, [s * 0.1, -0.08, 0]);
    const shin = node('shin' + L, leg, [0, -0.42, 0]);
    A(leg, tube([[0, 0.02, 0], [0.01, -0.2, 0.01], [0, -0.42, 0]], [0.1, 0.092, 0.07], 20, 12), C.under, 'armor', null, m);
    A(leg, sphere(0.1, 20, 12), C.armor, 'armor', { p: [0.02, -0.17, 0.03], s: [0.9, 1.7, 0.85] }, { ...m, fn: (c, x, y) => { if (y < -0.31) c.set(C.gold); } });
    A(shin, sphere(0.068, 16, 12), C.gold, 'armor', { p: [0, 0, 0.02], s: [1, 1.2, 1] }, m);
    A(shin, tube([[0, 0.05, 0.075], [0, 0.12, 0.085], [0, 0.17, 0.07]], [[0.02, 0.035], [0.015, 0.03], [0.003, 0.003]], 10, 6), C.gold, 'armor', null, m);
    A(shin, tube([[0, -0.03, 0], [0, -0.14, -0.012], [0, -0.3, 0], [0, -0.42, 0]], [0.062, 0.082, 0.062, 0.05], 20, 12), C.armor, 'armor', null, { ...m, fn: (c, x, y) => { if (y < -0.37) c.set(C.gold); } });
    A(shin, tube([[0, -0.44, -0.05], [0, -0.455, 0.06], [0, -0.475, 0.19]], [[0.045, 0.05], [0.045, 0.055], [0.022, 0.03]], 16, 10), C.armorD, 'armor', null, { ...m, fn: (c, x, y, z) => { if (z > 0.13) c.set(C.gold); } });
  }

  // ---- shield (left forearm)
  A(J.foreL, sphere(0.2, 28, 14), C.armor, 'armor', { p: [0.09, -0.16, 0], s: [0.16, 1.3, 0.95] }, { fn: (c, x, y, z) => { const d = Math.hypot((y + 0.16) / 1.3, z / 0.95); if (d > 0.168) c.set(C.gold); } });
  A(J.foreL, sphere(0.05, 14, 10), C.glow, 'glow', { p: [0.118, -0.16, 0], s: [0.5, 1.4, 1] });
  A(J.foreL, torus(0.07, 0.012, 8, 20), C.gold, 'armor', { p: [0.122, -0.16, 0], r: [0, Math.PI / 2, 0], s: [1, 1.4, 1] });

  // ---- sword (right hand). Blade runs along local +Y.
  const sword = node('sword', J.foreR, [0, -0.31, 0]);
  sword.rotation.x = Math.PI / 2;
  A(sword, tube([[0, -0.13, 0], [0, 0, 0], [0, 0.09, 0]], [0.02, 0.018, 0.02], 12, 6), C.dark);
  A(sword, sphere(0.033, 14, 10), C.gold, 'armor', { p: [0, -0.15, 0] });
  A(sword, tube([[-0.17, 0.15, 0], [-0.09, 0.1, 0], [0, 0.095, 0], [0.09, 0.1, 0], [0.17, 0.15, 0]], [[0.008, 0.008], [0.024, 0.02], [0.034, 0.026], [0.024, 0.02], [0.008, 0.008]], 12, 20), C.gold);
  A(sword, sphere(0.026, 12, 8), C.glow, 'glow', { p: [0, 0.1, 0], s: [1, 1, 1.25] });
  A(sword, tube([[0, 0.1, 0], [0, 0.4, 0], [0, 0.8, 0], [0, 1.15, 0], [0, 1.32, 0]], [[0.058, 0.013], [0.052, 0.012], [0.048, 0.011], [0.04, 0.009], [0.003, 0.002]], 16, 28, { up: [1, 0, 0] }), C.steel);
  A(sword, tube([[0, 0.14, 0], [0, 0.6, 0], [0, 1.18, 0]], [[0.014, 0.0155], [0.012, 0.0145], [0.004, 0.011]], 10, 16, { up: [1, 0, 0] }), C.glow, 'glow');

  // ---- cape: absorbs the remaining budget so the total is exactly HERO_TRIS
  const cape = node('cape', torso, [0, 0.52, -0.12]);
  const rest = HERO_TRIS - b.tris;
  if (rest < 500) throw new Error('hero polygon budget exceeded: ' + b.tris);
  const dk = new THREE.Color(C.clothD);
  A(cape, exactGrid(rest, 28, (u, v) => {
    const w = 0.3 + 0.62 * v, x = (u - 0.5) * w;
    return [x, -v * 1.0 + 0.02 * Math.cos(u * Math.PI * 6) * v, -0.03 - 0.3 * v * v - 0.035 * Math.sin(u * Math.PI * 5) * v - 0.25 * (u - 0.5) * (u - 0.5) * v];
  }), C.cloth, 'cloth', null, { fn: (c, x, y) => { c.lerp(dk, THREE.MathUtils.clamp(-y * 0.75, 0, 0.75)); if (y < -0.93) c.set(C.gold); } });

  const tris = b.finish();
  return { root, J, tris, mats };
}

// Euler targets per joint. Left = +X side of the model, model faces +Z.
export const HERO_POSES = {
  IDLE: {
    hips: [0, -0.45, 0], torso: [0.1, -0.2, 0], head: [0, 0.6, 0],
    armR: [-0.75, 0, -0.3], foreR: [-1.15, 0, 0], sword: [-0.35, 0, 0.25],
    armL: [-0.55, 0, 0.35], foreL: [-1.2, 0, 0],
    legL: [-0.5, 0, 0.14], shinL: [0.55, 0, 0], legR: [0.38, 0, -0.14], shinR: [0.45, 0, 0], cape: [0.12, 0, 0],
  },
  CROUCH: {
    hips: [0.35, -0.3, 0], torso: [0.35, 0.3, 0], head: [-0.4, 0.2, 0],
    armR: [0.5, 0, -0.7], foreR: [-0.9, 0, 0], sword: [0.6, 0, 0], armL: [-0.9, 0, 0.3], foreL: [-1.3, 0, 0],
    legL: [-1.2, 0, 0.15], shinL: [1.5, 0, 0], legR: [-0.2, 0, -0.15], shinR: [1.3, 0, 0], cape: [0.3, 0, 0],
  },
  FLY: {
    hips: [0.75, 0, 0], torso: [0.25, 0.25, 0], head: [-0.75, 0, 0],
    armR: [-0.4, 0, -1.45], foreR: [-0.15, 0, 0], sword: [1.15, 0, 0],
    armL: [0.5, 0, 0.7], foreL: [-0.8, 0, 0],
    legL: [0.35, 0, 0.12], shinL: [1.0, 0, 0], legR: [-0.3, 0, -0.1], shinR: [0.5, 0, 0], cape: [1.0, 0, 0],
  },
  GUARD: {
    hips: [0.1, -0.3, 0], torso: [0.15, 0.3, 0], head: [0.1, 0.1, 0],
    armR: [-1.5, 0, 0.55], foreR: [-1.0, 0, 0], sword: [0.2, 0, 1.2],
    armL: [-1.45, 0, -0.5], foreL: [-1.1, 0, 0],
    legL: [-0.6, 0, 0.15], shinL: [0.8, 0, 0], legR: [0.45, 0, -0.15], shinR: [0.6, 0, 0], cape: [0.2, 0, 0],
  },
  HIT: {
    hips: [-0.35, -0.2, 0], torso: [-0.45, 0, 0], head: [-0.5, 0, 0],
    armR: [0.4, 0, -0.9], foreR: [-0.5, 0, 0], armL: [0.3, 0, 0.9], foreL: [-0.6, 0, 0],
    legL: [-0.6, 0, 0.15], shinL: [0.5, 0, 0], legR: [0.3, 0, -0.15], shinR: [0.6, 0, 0], cape: [-0.3, 0, 0],
  },
  WIN: {
    hips: [0, -0.2, 0], torso: [-0.15, 0, 0], head: [-0.3, 0.3, 0],
    armR: [-2.9, 0, -0.25], foreR: [-0.1, 0, 0], sword: [1.4, 0, 0],
    armL: [-0.3, 0, 0.5], foreL: [-1.4, 0, 0],
    legL: [-0.2, 0, 0.16], shinL: [0.2, 0, 0], legR: [0.15, 0, -0.16], shinR: [0.15, 0, 0], cape: [0.25, 0, 0],
  },
  DOWN: {
    hips: [-1.45, 0, 0], torso: [-0.1, 0, 0], head: [-0.3, 0.4, 0],
    armR: [-0.3, 0, -1.3], foreR: [-0.3, 0, 0], armL: [-0.2, 0, 1.2], foreL: [-0.5, 0, 0],
    legL: [0.2, 0, 0.3], shinL: [0.3, 0, 0], legR: [-0.3, 0, -0.25], shinR: [0.7, 0, 0], cape: [-0.2, 0, 0],
  },
};
