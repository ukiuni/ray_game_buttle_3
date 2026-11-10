// Visual effects: sword trail ribbon, additive particles, hit flashes, glow sprites.
import * as THREE from 'three';

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const softTex = () => canvasTex(64, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const starTex = () => canvasTex(128, (g, s) => {
  g.translate(s / 2, s / 2);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(-s / 2, -s / 2, s, s);
  g.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 4 * (i % 2 ? 1 : 3)); g.beginPath(); g.moveTo(-s / 2, 0); g.lineTo(0, -s / (i < 2 ? 50 : 22)); g.lineTo(s / 2, 0); g.lineTo(0, s / (i < 2 ? 50 : 22)); g.fill(); }
});
const ringTex = () => canvasTex(128, (g, s) => {
  g.translate(s / 2, s / 2); g.strokeStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8;
  g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 46, 0, 7); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.stroke();
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -62); g.lineTo(0, -40); g.stroke(); }
});

const TRAIL = 56, PN = 700;

export class FX {
  constructor(scene) {
    this.scene = scene;
    const soft = this.soft = softTex();
    // --- trail ribbon
    this.tp = new Float32Array(TRAIL * 6); this.tc = new Float32Array(TRAIL * 6); this.tAge = new Float32Array(TRAIL).fill(9); this.tn = 0;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(this.tp, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(this.tc, 3));
    const idx = []; for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    tg.setIndex(idx);
    this.trail = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.trail.frustumCulled = false; scene.add(this.trail);
    this.trailCol = new THREE.Color(0x66e8ff);
    // --- particles
    this.pp = new Float32Array(PN * 3).fill(999); this.pc = new Float32Array(PN * 3);
    this.pv = new Float32Array(PN * 3); this.pl = new Float32Array(PN); this.pm = new Float32Array(PN); this.pg = new Float32Array(PN); this.pb = new Float32Array(PN * 3); this.pi = 0;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.pp, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(this.pc, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.34, map: soft, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.points.frustumCulled = false; scene.add(this.points);
    // --- flashes
    const star = starTex();
    this.flashes = [];
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false }));
      s.visible = false; s.userData = { t: 1, dur: 1, size: 1 }; scene.add(s); this.flashes.push(s);
    }
    this.fi = 0;
    this.ringMap = ringTex();
    this._c = new THREE.Color();
  }
  glow(color, size, opacity = 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.soft, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, toneMapped: false }));
    s.scale.setScalar(size); return s;
  }
  ring(color, size) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.ringMap, color, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false }));
    s.scale.setScalar(size); return s;
  }
  trailPush(a, b) {
    // shift: newest at index 0
    this.tp.copyWithin(6, 0, (TRAIL - 1) * 6); this.tAge.copyWithin(1, 0, TRAIL - 1);
    this.tp[0] = a.x; this.tp[1] = a.y; this.tp[2] = a.z; this.tp[3] = b.x; this.tp[4] = b.y; this.tp[5] = b.z; this.tAge[0] = 0;
  }
  trailBreak() { this.tAge.fill(9); }
  burst(p, n, color, speed = 4, life = 0.6, grav = -6, spread = 0.1) {
    this._c.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.pi = (this.pi + 1) % PN, j = i * 3;
      const th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), sp = speed * (0.3 + Math.random() * 0.9);
      this.pp[j] = p.x + (Math.random() - 0.5) * spread; this.pp[j + 1] = p.y + (Math.random() - 0.5) * spread; this.pp[j + 2] = p.z + (Math.random() - 0.5) * spread;
      this.pv[j] = Math.sin(ph) * Math.cos(th) * sp; this.pv[j + 1] = Math.cos(ph) * sp; this.pv[j + 2] = Math.sin(ph) * Math.sin(th) * sp;
      this.pl[i] = this.pm[i] = life * (0.5 + Math.random() * 0.7); this.pg[i] = grav;
      const v = 0.6 + Math.random() * 0.6; this.pb[j] = this._c.r * v; this.pb[j + 1] = this._c.g * v; this.pb[j + 2] = this._c.b * v;
    }
  }
  flash(p, color, size = 2, dur = 0.28) {
    const s = this.flashes[this.fi = (this.fi + 1) % this.flashes.length];
    s.position.copy(p); s.material.color.set(color); s.material.rotation = Math.random() * 3.14; s.visible = true;
    s.userData.t = 0; s.userData.dur = dur; s.userData.size = size;
  }
  update(dt) {
    // trail
    let any = false;
    for (let i = 0; i < TRAIL; i++) {
      this.tAge[i] += dt;
      const a = Math.max(0, 1 - this.tAge[i] / 0.38), k = a * a; if (k > 0) any = true;
      const j = i * 6, c = this.trailCol;
      this.tc[j] = c.r * k * 0.5; this.tc[j + 1] = c.g * k * 0.5; this.tc[j + 2] = c.b * k * 0.5;
      this.tc[j + 3] = (c.r * 0.6 + 0.4) * k; this.tc[j + 4] = (c.g * 0.6 + 0.4) * k; this.tc[j + 5] = (c.b * 0.6 + 0.4) * k;
    }
    this.trail.visible = any;
    this.trail.geometry.attributes.position.needsUpdate = true; this.trail.geometry.attributes.color.needsUpdate = true;
    // particles
    for (let i = 0; i < PN; i++) {
      if (this.pl[i] <= 0) continue;
      const j = i * 3; this.pl[i] -= dt;
      if (this.pl[i] <= 0) { this.pp[j + 1] = 999; this.pc[j] = this.pc[j + 1] = this.pc[j + 2] = 0; continue; }
      this.pv[j + 1] += this.pg[i] * dt; const d = Math.exp(-1.5 * dt);
      this.pv[j] *= d; this.pv[j + 2] *= d;
      this.pp[j] += this.pv[j] * dt; this.pp[j + 1] += this.pv[j + 1] * dt; this.pp[j + 2] += this.pv[j + 2] * dt;
      if (this.pp[j + 1] < 0.03) { this.pp[j + 1] = 0.03; this.pv[j + 1] *= -0.4; }
      const k = this.pl[i] / this.pm[i];
      this.pc[j] = this.pb[j] * k; this.pc[j + 1] = this.pb[j + 1] * k; this.pc[j + 2] = this.pb[j + 2] * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
    // flashes
    for (const s of this.flashes) {
      if (!s.visible) continue;
      const u = s.userData; u.t += dt; const k = u.t / u.dur;
      if (k >= 1) { s.visible = false; continue; }
      s.scale.setScalar(u.size * (0.35 + 1.1 * Math.sqrt(k))); s.material.opacity = 1 - k * k;
    }
  }
}
