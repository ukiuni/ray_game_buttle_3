// Procedural geometry helpers: every character is built from code, with exact polygon counts.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();

export function prep(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  return g;
}

export function xf(g, t = {}) {
  const p = t.p || [0, 0, 0], r = t.r || [0, 0, 0];
  const s = t.s == null ? [1, 1, 1] : (typeof t.s === 'number' ? [t.s, t.s, t.s] : t.s);
  _m.compose(new THREE.Vector3(...p), _q.setFromEuler(_e.set(r[0], r[1], r[2])), new THREE.Vector3(...s));
  g.applyMatrix4(_m);
  return g;
}

export function tint(g, color, fn) {
  const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count, arr = new Float32Array(n * 3);
  const base = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    _c.copy(base);
    if (fn) fn(_c, pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i));
    arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export function mirrorX(g) {
  for (const name of ['position', 'normal', 'color']) {
    const a = g.attributes[name]; if (!a) continue;
    const arr = a.array;
    for (let i = 0; i < arr.length; i += 9) {
      if (name !== 'color') { arr[i] = -arr[i]; arr[i + 3] = -arr[i + 3]; arr[i + 6] = -arr[i + 6]; }
      for (let k = 0; k < 3; k++) { const t = arr[i + 3 + k]; arr[i + 3 + k] = arr[i + 6 + k]; arr[i + 6 + k] = t; }
    }
  }
  return g;
}

function crs(a, t) {
  const f = t * (a.length - 1), i = Math.min(Math.floor(f), a.length - 2), u = f - i;
  const p0 = a[Math.max(i - 1, 0)], p1 = a[i], p2 = a[i + 1], p3 = a[Math.min(i + 2, a.length - 1)];
  return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
}

// Tube along a smooth curve with variable (optionally elliptical) radius. tris = 2*rs*ls + 2*rs
export function tube(pts, radii, rs = 16, ls = 0, o = {}) {
  const P = pts.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(P, false, 'centripetal');
  const n = ls || (P.length - 1) * 4;
  const ra = radii.map(r => typeof r === 'number' ? r : r[0]);
  const rb = radii.map(r => typeof r === 'number' ? r : r[1]);
  const pos = [], idx = [];
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  curve.getTangent(0, T);
  if (o.up) N.set(o.up[0], o.up[1], o.up[2]);
  else if (Math.abs(T.y) < 0.9) N.set(0, 1, 0); else N.set(0, 0, 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    curve.getPoint(t, C); curve.getTangent(t, T);
    N.addScaledVector(T, -N.dot(T)).normalize(); B.crossVectors(T, N);
    const a = Math.max(crs(ra, t), 1e-3), b = Math.max(crs(rb, t), 1e-3);
    for (let j = 0; j < rs; j++) {
      const ang = j / rs * Math.PI * 2, c = Math.cos(ang) * a, s = Math.sin(ang) * b;
      pos.push(C.x + N.x * c + B.x * s, C.y + N.y * c + B.y * s, C.z + N.z * c + B.z * s);
    }
  }
  const s0 = pos.length / 3; curve.getPoint(0, C); pos.push(C.x, C.y, C.z);
  const e0 = s0 + 1; curve.getPoint(1, C); pos.push(C.x, C.y, C.z);
  for (let i = 0; i < n; i++) for (let j = 0; j < rs; j++) {
    const a = i * rs + j, b = i * rs + (j + 1) % rs, c = a + rs, d = b + rs;
    idx.push(a, b, c, b, d, c);
  }
  for (let j = 0; j < rs; j++) {
    idx.push(s0, (j + 1) % rs, j);
    idx.push(e0, n * rs + j, n * rs + (j + 1) % rs);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  if (o.flat) { g = g.toNonIndexed(); }
  g.computeVertexNormals();
  return g;
}

// Lathe-like body of revolution along Y. profile: [[radius, y], ...]; sz squashes depth.
export function lathe(profile, rs = 24, sz = 1, ls = 0) {
  return tube(profile.map(p => [0, p[1], 0]), profile.map(p => [p[0], p[0] * sz]), rs, ls, { up: [1, 0, 0] });
}

export function sphere(r, w = 16, h = 12) { return new THREE.SphereGeometry(r, w, h); }
export function torus(R, r, rs = 8, ts = 24) { return new THREE.TorusGeometry(R, r, rs, ts); }

// Parametric sheet with EXACTLY R triangles.
export function exactGrid(R, cols, fn) {
  const rows = Math.ceil(R / (2 * cols));
  const pos = [], idx = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { const p = fn(i / cols, j / rows); pos.push(p[0], p[1], p[2]); }
  let n = 0;
  outer: for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
    idx.push(a, c, b); if (++n === R) break outer;
    idx.push(b, c, d); if (++n === R) break outer;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Builder {
  constructor(mats) { this.mats = mats; this.buckets = new Map(); this.tris = 0; }
  add(node, geo, color, mat = 'body', t = null, o = {}) {
    const g = prep(geo);
    if (t) xf(g, t);
    tint(g, color, o.fn);
    if (o.mirror) mirrorX(g);
    const key = node.id + '|' + mat;
    if (!this.buckets.has(key)) this.buckets.set(key, { node, mat, list: [] });
    this.buckets.get(key).list.push(g);
    this.tris += g.attributes.position.count / 3;
    return g;
  }
  finish() {
    for (const { node, mat, list } of this.buckets.values()) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), this.mats[mat]);
      mesh.frustumCulled = false;
      node.add(mesh);
    }
    return this.tris;
  }
}

// Simple pose rig: joints ease toward target euler angles; `add` holds per-frame idle offsets.
export class Rig {
  constructor(J, skip = ['root']) {
    this.J = J; this.names = Object.keys(J).filter(k => !skip.includes(k));
    this.cur = {}; this.tgt = {}; this.add = {}; this.base = {};
    for (const k of this.names) {
      this.cur[k] = [0, 0, 0]; this.tgt[k] = [0, 0, 0]; this.add[k] = [0, 0, 0];
      const r = J[k].rotation; this.base[k] = [r.x, r.y, r.z];
    }
    this.speed = 10;
  }
  pose(p, speed = 10) {
    this.speed = speed;
    for (const k of this.names) { const v = p[k]; const t = this.tgt[k]; t[0] = v ? v[0] : 0; t[1] = v ? v[1] : 0; t[2] = v ? v[2] : 0; }
  }
  snap() { for (const k of this.names) for (let i = 0; i < 3; i++) this.cur[k][i] = this.tgt[k][i]; }
  update(dt) {
    const f = 1 - Math.exp(-this.speed * dt);
    for (const k of this.names) {
      const c = this.cur[k], t = this.tgt[k], a = this.add[k], b = this.base[k];
      for (let i = 0; i < 3; i++) c[i] += (t[i] - c[i]) * f;
      this.J[k].rotation.set(b[0] + c[0] + a[0], b[1] + c[1] + a[1], b[2] + c[2] + a[2]);
      a[0] = a[1] = a[2] = 0;
    }
  }
}
