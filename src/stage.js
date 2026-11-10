// Arena: floor with runes, broken pillars, crystals, mountains, sky dome, embers and lights.
import * as THREE from 'three';
import { softTex } from './fx.js';

function floorTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2433'; g.fillRect(0, 0, S, S);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.translate(S / 2, S / 2);
  for (let ring = 0; ring < 9; ring++) { // stone tiles
    const r0 = ring * 56, r1 = r0 + 56, n = Math.max(1, ring * 7);
    for (let i = 0; i < n; i++) {
      const a0 = i / n * 6.2832 + ring * 0.3, a1 = a0 + 6.2832 / n, v = 34 + rnd() * 26;
      g.fillStyle = `rgb(${v + 8},${v},${v + 16})`;
      g.beginPath(); g.arc(0, 0, r1 - 2, a0 + 0.004, a1 - 0.004); g.arc(0, 0, r0 + 2, a1 - 0.004, a0 + 0.004, true); g.closePath(); g.fill();
    }
  }
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.18})`; g.fillRect((rnd() - 0.5) * S, (rnd() - 0.5) * S, 2 + rnd() * 5, 2 + rnd() * 5); }
  g.shadowBlur = 18;
  const glowRing = (r, w, col) => { g.strokeStyle = col; g.shadowColor = col; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); };
  glowRing(430, 6, '#ff7a3a'); glowRing(405, 2, '#ffb070'); glowRing(190, 4, '#5fd8ff'); glowRing(60, 3, '#5fd8ff');
  g.strokeStyle = '#ffa25a'; g.shadowColor = '#ff7a3a'; g.lineWidth = 3;
  for (let i = 0; i < 24; i++) { // runes
    g.save(); g.rotate(i / 24 * 6.2832); g.translate(0, -417);
    g.beginPath(); for (let k = 0; k < 4; k++) g.lineTo((rnd() - 0.5) * 16, (rnd() - 0.5) * 16); g.stroke(); g.restore();
  }
  g.strokeStyle = '#5fd8ff'; g.shadowColor = '#5fd8ff'; g.lineWidth = 3;
  g.beginPath(); for (let i = 0; i <= 6; i++) { const a = i * 2 * 6.2832 / 6 * 1 + 0.26; g.lineTo(Math.cos(a) * 190, Math.sin(a) * 190); } g.stroke();
  g.beginPath(); for (let i = 0; i <= 3; i++) { const a = i * 6.2832 / 3; g.lineTo(Math.cos(a) * 190, Math.sin(a) * 190); } g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function buildStage(scene) {
  scene.fog = new THREE.FogExp2(0x2a1838, 0.018);
  // sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 p; uniform float t;
      float h(vec2 v){ return fract(sin(dot(v, vec2(127.1,311.7))) * 43758.5453); }
      void main(){ vec3 d = normalize(p); float y = d.y;
        vec3 c = mix(vec3(0.95,0.36,0.16), vec3(0.32,0.09,0.32), smoothstep(-0.05,0.28,y));
        c = mix(c, vec3(0.04,0.03,0.13), smoothstep(0.2,0.75,y));
        float a = atan(d.z, d.x); c += vec3(0.9,0.35,0.12) * pow(max(0.0, 1.0 - abs(y) * 3.0), 3.0) * (0.45 + 0.25 * sin(a * 3.0 + t * 0.1));
        vec2 g = floor(vec2(a * 170.0, y * 260.0)); float s = h(g);
        c += vec3(1.0,0.95,0.9) * step(0.993, s) * smoothstep(0.15,0.5,y) * (0.5 + 0.5 * sin(t * 2.0 + s * 90.0));
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  // floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(15, 72), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.85, metalness: 0.15 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(15, 13.5, 3, 72, 1, true), new THREE.MeshStandardMaterial({ color: 0x1c1826, roughness: 1 }));
  rim.position.y = -1.5; scene.add(rim);
  // pillars & crystals
  const stone = new THREE.MeshStandardMaterial({ color: 0x4a4458, roughness: 0.9, metalness: 0.05, flatShading: true });
  const crystalA = new THREE.MeshStandardMaterial({ color: 0x33ccff, emissive: 0x1188ff, emissiveIntensity: 2.2, roughness: 0.2, flatShading: true });
  const crystalB = new THREE.MeshStandardMaterial({ color: 0xff7733, emissive: 0xff4411, emissiveIntensity: 2.0, roughness: 0.2, flatShading: true });
  const crystals = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + 0.26, r = 12.2, h = 3 + ((i * 7) % 5) * 1.3;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, h, 8, 3), stone);
    p.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); p.rotation.z = ((i * 13) % 7 - 3) * 0.02; scene.add(p);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.9), stone); base.position.set(p.position.x, 0.25, p.position.z); base.rotation.y = a; scene.add(base);
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), i % 2 ? crystalA : crystalB);
    c.position.set(p.position.x, h + 0.75, p.position.z); c.scale.y = 1.7; scene.add(c); crystals.push(c);
  }
  // mountains
  const mMat = new THREE.MeshBasicMaterial({ color: 0x150c1f, fog: false });
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2, r = 55 + (i * 37 % 11), h = 6 + (i * 53 % 9);
    const m = new THREE.Mesh(new THREE.ConeGeometry(9 + (i * 29 % 7), h, 5), mMat);
    m.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r); m.rotation.y = i; scene.add(m);
  }
  // embers
  const EN = 160, ep = new Float32Array(EN * 3), es = new Float32Array(EN);
  for (let i = 0; i < EN; i++) { ep[i * 3] = (Math.random() - 0.5) * 30; ep[i * 3 + 1] = Math.random() * 12; ep[i * 3 + 2] = (Math.random() - 0.5) * 30; es[i] = 0.3 + Math.random(); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const embers = new THREE.Points(eg, new THREE.PointsMaterial({ size: 0.16, map: softTex(), color: 0xff9a4a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  embers.frustumCulled = false; scene.add(embers);
  // lights
  scene.add(new THREE.HemisphereLight(0x9aa8ff, 0x3a1a22, 1.1));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.6); key.position.set(-5, 9, 8); scene.add(key);
  const rimL = new THREE.DirectionalLight(0xff6a30, 1.6); rimL.position.set(6, 4, -8); scene.add(rimL);
  const heroL = new THREE.PointLight(0x55ccff, 14, 9); heroL.position.set(-3.4, 2.4, 2.5); scene.add(heroL);
  const monL = new THREE.PointLight(0xff7733, 22, 12); monL.position.set(3, 1.2, 3); scene.add(monL);
  // blob shadows
  const shTex = softTex();
  const blob = s => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shTex, color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.scale.setScalar(s); scene.add(m); return m; };
  return {
    heroShadow: blob(2.2), monShadow: blob(6.5),
    update(t, dt) {
      sky.material.uniforms.t.value = t;
      for (let i = 0; i < EN; i++) { ep[i * 3 + 1] += es[i] * dt * 0.8; ep[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.25; if (ep[i * 3 + 1] > 12) ep[i * 3 + 1] = 0; }
      eg.attributes.position.needsUpdate = true;
      crystals.forEach((c, i) => { c.rotation.y = t * 0.6 + i; c.position.y += Math.sin(t * 1.3 + i) * dt * 0.12; });
      monL.intensity = 20 + Math.sin(t * 3.1) * 4;
    },
  };
}
