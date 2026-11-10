import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Rig } from './geo.js';
import { buildHero, HERO_POSES as HP } from './hero.js';
import { buildMonster, MON_POSES as MP } from './monster.js';
import { buildStage } from './stage.js';
import { FX } from './fx.js';
import { Sfx } from './audio.js';
import { initUpdater } from './updater.js';

const $ = id => document.getElementById(id);
const V3 = THREE.Vector3, lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
const ease = k => k * k * (3 - 2 * k), rand = (a, b) => a + Math.random() * (b - a);
const params = new URLSearchParams(location.search);
let speedMul = parseFloat(params.get('fast') || '1') || 1;

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 250);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const stage = buildStage(scene);
const fx = new FX(scene);
const sfx = new Sfx();

const HOME = new V3(-2.6, 1, 0), MHOME = new V3(2.6, 0, 0), MCENTER = new V3(2.6, 2.1, 0);
const UP = new V3(0, 1, 0), ZERO = new V3(), ZAXIS = new V3(0, 0, 1);
const HERO_Q = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2);

// hero
const hero = buildHero();
const pivot = new THREE.Group(); pivot.position.copy(HOME); pivot.quaternion.copy(HERO_Q);
hero.root.position.y = -1; pivot.add(hero.root); scene.add(pivot);
const heroRig = new Rig(hero.J); heroRig.pose(HP.IDLE); heroRig.snap();
const swordGlow = fx.glow(0x66e8ff, 0.9, 0.55); swordGlow.position.y = 0.75; hero.J.sword.add(swordGlow);
const coreGlow = fx.glow(0x66e8ff, 0.5, 0.6); coreGlow.position.set(0, 0.42, 0.22); hero.J.torso.add(coreGlow);

// monster
const mon = buildMonster();
mon.root.position.copy(MHOME); mon.root.rotation.y = -Math.PI / 2; scene.add(mon.root);
const monRig = new Rig(mon.J); monRig.pose(MP.IDLE); monRig.snap();
const hueU = { value: new THREE.Matrix3() };
for (const m of Object.values(mon.mats)) m.onBeforeCompile = sh => {
  sh.uniforms.hueMat = hueU;
  sh.fragmentShader = 'uniform mat3 hueMat;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = max(hueMat * diffuseColor.rgb, vec3(0.0));');
};
const setHue = a => hueU.value.setFromMatrix4(new THREE.Matrix4().makeRotationAxis(new V3(1, 1, 1).normalize(), a));
const monGlows = [fx.glow(0xff8a2a, 2.4, 0.55), fx.glow(0xffe060, 0.7, 0.8), fx.glow(0xffe060, 0.7, 0.8)];
monGlows[0].position.set(0, 0.3, 1.0); mon.J.body.add(monGlows[0]);
monGlows[1].position.set(0.27, 0.2, 0.45); monGlows[2].position.set(-0.27, 0.2, 0.45); mon.J.head.add(monGlows[1], monGlows[2]);
const weakRing = fx.ring(0xffee55, 1.3); weakRing.visible = false; scene.add(weakRing);
const orb = fx.glow(0xff7a22, 2.2, 1); orb.visible = false; scene.add(orb);

const VARIANTS = [
  { name: '紅蓮竜ヴォルガ', hue: 0, glow: 0xff8a2a }, { name: '蒼氷竜グラキエス', hue: 3.7, glow: 0x44aaff },
  { name: '翠毒竜ヴェノム', hue: 2.1, glow: 0x66ff66 }, { name: '紫電竜ライゴウ', hue: 4.7, glow: 0xcc66ff },
  { name: '黄金竜アウルム', hue: 0.75, glow: 0xffdd44 },
];
const WEAK = [
  { j: 'head', o: [0, 0.25, 0.55] }, { j: 'body', o: [0, 0.3, 0.95] }, { j: 'body', o: [0, 1.05, 0.85] },
  { j: 'wingL', o: [1.7, 0.8, -0.6] }, { j: 'tail3', o: [0, 0.1, -0.3] }, { j: 'neck2', o: [0, 0.2, 0.3] }, { j: 'legL', o: [0.2, -0.4, 0.4] },
];
const BODY_HIT = [ // joint, local offset, radius, damage multiplier
  ['head', [0, 0.1, 0.45], 0.62, 1.6], ['neck2', [0, 0.2, 0.1], 0.45, 1.2], ['neck1', [0, 0.2, 0.1], 0.5, 1.1],
  ['body', [0, 0.85, 0.35], 0.95, 1], ['body', [0, 0.1, -0.05], 0.95, 1],
  ['shinL', [0, -0.2, 0], 0.5, 0.8], ['shinR', [0, -0.2, 0], 0.5, 0.8],
  ['tail2', [0, 0, -0.3], 0.5, 0.6], ['tail4', [0, 0, -0.3], 0.4, 0.6], ['tail6', [0, 0, -0.3], 0.35, 0.6],
  ['wingL', [1.6, 0.6, -0.6], 1.05, 0.5], ['wingR', [-1.6, 0.6, -0.6], 1.05, 0.5],
];

// ---------------------------------------------------------------- game state
const G = {
  state: 'title', stage: 1, wins: 0, best: 0,
  heroHp: 1000, heroMax: 1000, monHp: 1, monMax: 1, monAtk: 150,
  weak: WEAK[0], flinch: 0, shake: 0, guardTime: null, warnTime: Infinity, guardDrop: 0, lastDamage: 0,
};
try { G.best = parseInt(localStorage.getItem('lineslash.best') || '0', 10) || 0; } catch (e) { }
const inGame = () => G.state !== 'title' && G.state !== 'gameover';
const INK_MAX = 20, ATK_PER_UNIT = 75, STEP = 0.15;

let time = 0, timeScale = 1, hitStop = 0, realT = 0;
const waiters = [], tweens = [];
const sleep = s => new Promise(r => waiters.push({ t: time + s, r }));
const tween = (dur, fn) => new Promise(r => tweens.push({ t0: time, dur, fn, r }));
const resetSched = () => { waiters.length = 0; tweens.length = 0; };

// ---------------------------------------------------------------- UI helpers
let W = 1, H = 1, dpr = 1;
const ink = $('ink'), ictx = ink.getContext('2d');
const camBase = new V3(), camTgt = new V3();
function layout() {
  W = window.innerWidth; H = window.innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
  ink.width = Math.round(W * dpr); ink.height = Math.round(H * dpr);
  const a = W / H, t = clamp((a - 0.7) / 0.9, 0, 1), k = ease(t);
  camBase.set(lerp(-8.8, -0.2, k), lerp(4.7, 2.7, k), lerp(8.6, 9.8, k));
  camTgt.set(lerp(0.05, 0.3, k), lerp(1.6, 2.25, k), 0);
  camera.fov = lerp(67, 42, k); camera.aspect = a; camera.updateProjectionMatrix();
}
window.addEventListener('resize', layout); window.addEventListener('orientationchange', () => setTimeout(layout, 200));
layout();

function banner(text, cls = '', sub = '') {
  const b = $('banner'); b.className = ''; void b.offsetWidth;
  b.innerHTML = `<div class="big">${text}</div>` + (sub ? `<div class="sub">${sub}</div>` : ''); b.className = 'show ' + cls;
}
function hint(text) { const h = $('hint'); h.textContent = text || ''; h.classList.toggle('show', !!text); }
function toast(text, ms = 2200) { const t = $('toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), ms); }
const _pv = new V3();
function toScreen(p) { _pv.copy(p).project(camera); return { x: (_pv.x * 0.5 + 0.5) * W, y: (-_pv.y * 0.5 + 0.5) * H }; }
function pop(text, world, cls = '') {
  const s = toScreen(world), d = document.createElement('div');
  d.className = 'dmg ' + cls; d.textContent = text;
  d.style.left = clamp(s.x + rand(-14, 14), 40, W - 40) + 'px'; d.style.top = clamp(s.y + rand(-10, 10), 70, H - 60) + 'px';
  $('dmgLayer').appendChild(d); setTimeout(() => d.remove(), 1100);
}
function hud() {
  $('hpHero').style.width = clamp(G.heroHp / G.heroMax, 0, 1) * 100 + '%';
  $('hpMon').style.width = clamp(G.monHp / G.monMax, 0, 1) * 100 + '%';
  $('hpHeroNum').textContent = Math.max(0, Math.ceil(G.heroHp)) + ' / ' + G.heroMax;
  $('hpMonNum').textContent = Math.max(0, Math.ceil(G.monHp)) + ' / ' + G.monMax;
  $('hpHero').classList.toggle('low', G.heroHp / G.heroMax < 0.3);
}
function vignette() { const v = $('vignette'); v.classList.remove('show'); void v.offsetWidth; v.classList.add('show'); }
function show(id, on) { $(id).classList.toggle('hidden', !on); }

// ---------------------------------------------------------------- flow
const variant = () => VARIANTS[(G.stage - 1) % VARIANTS.length];
function resetActors() {
  pivot.position.copy(HOME); pivot.quaternion.copy(HERO_Q); pivot.scale.setScalar(1);
  mon.root.position.copy(MHOME); mon.root.rotation.set(0, -Math.PI / 2, 0); mon.root.scale.setScalar(1);
  heroRig.pose(HP.IDLE); monRig.pose(MP.IDLE);
  fx.trailBreak(); orb.visible = false; weakRing.visible = false; stroke.s.length = 0; stroke.active = false; G.flinch = 0;
  timeScale = 1;
}
function applyVariant() {
  const v = variant(); setHue(v.hue); monGlows[0].material.color.set(v.glow);
  $('monName').textContent = (G.stage > VARIANTS.length ? '真・' : '') + v.name + ' Lv.' + G.stage;
}
function goTitle() {
  resetSched(); G.state = 'title'; G.stage = 1; resetActors(); applyVariant();
  show('title', true); show('over', false); show('hud', false); hint('');
  $('bestTitle').textContent = G.best > 0 ? `ベスト記録: ${G.best} 連勝` : '';
  updater.check();
}
function startGame() {
  sfx.unlock(); sfx.ui(); resetSched();
  G.stage = 1; G.wins = 0;
  show('title', false); show('over', false); show('hud', true);
  beginStage();
}
async function beginStage() {
  G.state = 'intro'; resetActors(); applyVariant();
  G.heroMax = 1000; G.heroHp = G.heroMax;
  G.monMax = Math.round(2400 * Math.pow(1.25, G.stage - 1)); G.monHp = G.monMax;
  G.monAtk = 150 * Math.pow(1.17, G.stage - 1);
  $('stageLabel').textContent = `STAGE ${G.stage}` + (G.wins ? `　${G.wins}連勝中` : '');
  hud();
  banner(`STAGE ${G.stage}`, 'stage', $('monName').textContent);
  mon.root.scale.setScalar(0.01);
  tween(0.7, k => mon.root.scale.setScalar(Math.max(0.01, ease(k))));
  fx.burst(MCENTER, 60, variant().glow, 7, 0.9, 1, 1.5);
  await sleep(0.6);
  monRig.pose(MP.ROAR, 7); sfx.roar(); G.shake = 0.25;
  await sleep(1.0);
  monRig.pose(MP.IDLE, 5);
  await sleep(0.3);
  playerTurn();
}
function playerTurn() {
  G.state = 'playerTurn';
  G.weak = WEAK[Math.floor(Math.random() * WEAK.length)];
  weakRing.visible = true;
  camera.position.copy(camBase); camera.lookAt(camTgt); camera.updateMatrixWorld();
  camera.getWorldDirection(_n).negate(); plane.setFromNormalAndCoplanarPoint(_n, MCENTER);
  stroke.s.length = 0; stroke.w.length = 0; stroke.len = 0; stroke.active = false; stroke.progress = 0; stroke.fade = 1;
  banner('YOUR TURN', 'you');
  hint('画面に線を引いて攻撃！ 光る弱点を狙え');
  $('inkGauge').classList.add('show'); $('inkFill').style.width = '100%';
}

// ---------------------------------------------------------------- drawing input
const stroke = { active: false, id: -1, s: [], w: [], len: 0, progress: 0, fade: 1 };
const plane = new THREE.Plane(), _n = new V3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function screenToPlane(x, y) {
  ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, camera);
  const p = ray.ray.intersectPlane(plane, new V3());
  if (!p) return null;
  p.y = Math.max(p.y, 0.5); return p;
}
function projToPlane(world, out) {
  ray.ray.origin.copy(camera.position); ray.ray.direction.copy(world).sub(camera.position).normalize();
  return ray.ray.intersectPlane(plane, out) || out.copy(world);
}
function strokeAdd(x, y) {
  const n = stroke.s.length;
  if (n && Math.hypot(x - stroke.s[n - 1].x, y - stroke.s[n - 1].y) < 5) return;
  const p = screenToPlane(x, y); if (!p) return;
  if (n) {
    const d = p.distanceTo(stroke.w[n - 1]);
    if (stroke.len + d > INK_MAX) { strokeEnd(); return; }
    stroke.len += d;
  }
  stroke.s.push({ x, y }); stroke.w.push(p);
  $('inkFill').style.width = (1 - stroke.len / INK_MAX) * 100 + '%';
}
function strokeEnd() {
  if (!stroke.active) return;
  stroke.active = false;
  if (stroke.len < 1.2 || stroke.w.length < 2) {
    stroke.s.length = 0; stroke.w.length = 0; stroke.len = 0; $('inkFill').style.width = '100%';
    toast('もっと長く線を引こう！', 1400); return;
  }
  playerAttack(stroke.w.slice());
}
window.addEventListener('pointerdown', e => {
  sfx.unlock();
  if (e.target.closest && e.target.closest('button')) return;
  if (G.state === 'playerTurn' && !stroke.active) {
    stroke.active = true; stroke.id = e.pointerId; stroke.s.length = 0; stroke.w.length = 0; stroke.len = 0;
    strokeAdd(e.clientX, e.clientY);
  } else if (G.state === 'monsterTurn') guardTap();
});
window.addEventListener('pointermove', e => {
  if (!stroke.active || e.pointerId !== stroke.id || G.state !== 'playerTurn') return;
  const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
  if (list && list.length) { for (const c of list) { if (!stroke.active) break; strokeAdd(c.clientX, c.clientY); } }
  else strokeAdd(e.clientX, e.clientY);
});
const pend = e => { if (e.pointerId === stroke.id) strokeEnd(); };
window.addEventListener('pointerup', pend); window.addEventListener('pointercancel', pend);

function drawInk() {
  ictx.setTransform(dpr, 0, 0, dpr, 0, 0); ictx.clearRect(0, 0, W, H);
  const n = stroke.s.length; if (n < 2 || stroke.fade <= 0) return;
  const i0 = Math.min(n - 2, Math.floor(stroke.progress * (n - 1)));
  ictx.lineCap = 'round'; ictx.lineJoin = 'round';
  for (const [w, col, blur] of [[16, 'rgba(60,200,255,0.25)', 0], [8, 'rgba(110,235,255,0.85)', 14], [3, '#ffffff', 0]]) {
    ictx.globalAlpha = stroke.fade; ictx.strokeStyle = col; ictx.lineWidth = w; ictx.shadowColor = '#4cf'; ictx.shadowBlur = blur;
    ictx.beginPath(); ictx.moveTo(stroke.s[i0].x, stroke.s[i0].y);
    for (let i = i0 + 1; i < n; i++) ictx.lineTo(stroke.s[i].x, stroke.s[i].y);
    ictx.stroke();
  }
  ictx.globalAlpha = 1; ictx.shadowBlur = 0;
}

// ---------------------------------------------------------------- player attack
const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
function jointPos(name, off, out) { return mon.J[name].localToWorld(out.set(off[0], off[1], off[2])); }
function orient(dir, roll, k) {
  _m4.lookAt(dir, ZERO, UP); _q.setFromRotationMatrix(_m4); _q2.setFromAxisAngle(ZAXIS, roll); _q.multiply(_q2);
  pivot.quaternion.slerp(_q, k);
}
function damageMonster(d) { G.monHp = Math.max(0, G.monHp - d); hud(); }

async function playerAttack(raw) {
  G.state = 'playerAttack'; hint(''); $('inkGauge').classList.remove('show'); $('banner').className = '';
  // smooth path through the drawn points
  const dec = [raw[0]];
  for (const p of raw) if (p.distanceTo(dec[dec.length - 1]) > 0.55) dec.push(p);
  if (dec.length < 2 || raw[raw.length - 1].distanceTo(dec[dec.length - 1]) > 0.1) dec.push(raw[raw.length - 1]);
  const curve = new THREE.CatmullRomCurve3(dec, false, 'centripetal');
  const L = curve.getLength(), N = Math.max(8, Math.ceil(L / STEP)), pts = curve.getSpacedPoints(N);
  for (const p of pts) p.y = Math.max(p.y, 0.5);
  const step = L / N;

  // wind-up, then leap to the start of the line
  heroRig.pose(HP.CROUCH, 22); await sleep(0.2);
  sfx.dash(); heroRig.pose(HP.FLY, 16);
  fx.burst(_a.set(HOME.x, 0.1, 0), 24, 0xbfe8ff, 3, 0.5, 2, 0.6);
  const dir0 = _d.copy(pts[1]).sub(pts[0]).normalize().clone();
  let roll = 0;
  await tween(0.26, k => {
    const e = ease(k);
    pivot.position.lerpVectors(HOME, pts[0], e); pivot.position.y += Math.sin(k * Math.PI) * 0.8;
    orient(dir0, 0, 0.25);
  });

  // ride the line
  let last = 0, entries = 0, total = 0, group = 0, inside = false, critDone = false, lastSlash = -1;
  const dur = clamp(L / 15, 0.5, 1.7), dir = dir0.clone();
  const hitTest = (p) => {
    let m = 0;
    for (const [j, o, r, mult] of BODY_HIT) { projToPlane(jointPos(j, o, _a), _b); if (_b.distanceTo(p) < r && mult > m) m = mult; }
    projToPlane(jointPos(G.weak.j, G.weak.o, _a), _b);
    const weak = _b.distanceTo(p) < 0.6;
    if (weak) m = 3;
    if (m > 0) {
      if (!inside) {
        entries++; inside = true; sfx.slash(); G.shake = Math.max(G.shake, 0.22); G.flinch = 1; hitStop = 0.035;
        fx.flash(p, 0xaef4ff, 3.2); fx.burst(p, 26, 0xffd27a, 7, 0.5, -9, 0.2);
        if (time - lastSlash > 0.08) { sfx.hit(); lastSlash = time; }
      }
      const combo = 1 + 0.12 * Math.min(entries - 1, 8);
      let d = ATK_PER_UNIT * step * m * combo;
      if (weak && !critDone) {
        critDone = true; d += 160 * combo; sfx.crit(); hitStop = 0.09; G.shake = 0.5;
        fx.flash(p, 0xfff27a, 6, 0.4); fx.burst(p, 60, 0xfff27a, 10, 0.7, -6, 0.3);
        pop('CRITICAL!', p, 'crit');
      }
      fx.burst(p, 3, weak ? 0xfff27a : 0xff8844, 4, 0.4, -8, 0.15);
      group += d; total += d; damageMonster(d);
    } else if (inside) {
      inside = false; pop(Math.round(group), p, group > 250 ? 'big' : ''); group = 0;
    }
  };
  await tween(dur, k => {
    const f = k * N, i = Math.min(N - 1, Math.floor(f)), u = f - i;
    pivot.position.lerpVectors(pts[i], pts[i + 1], u);
    _d.copy(pts[Math.min(N, i + 2)]).sub(pts[Math.max(0, i - 1)]); if (_d.lengthSq() > 1e-6) dir.copy(_d.normalize());
    roll = k * dur * Math.PI * 2 * 1.5;
    orient(dir, roll, 0.6);
    for (let q = last + 1; q <= i + (k >= 1 ? 1 : 0); q++) hitTest(pts[q]);
    last = Math.max(last, i + (k >= 1 ? 1 : 0));
    stroke.progress = k;
    hero.J.sword.localToWorld(_a.set(0, 0.12, 0)); hero.J.sword.localToWorld(_b.set(0, 1.34, 0)); fx.trailPush(_a, _b);
    if (Math.random() < 0.6) fx.burst(pivot.position, 1, 0x7fe8ff, 1.5, 0.4, 0, 0.5);
  });
  if (group > 0) { pop(Math.round(group), pts[N], group > 250 ? 'big' : ''); }
  stroke.progress = 1; stroke.s.length = 0;
  G.lastDamage = Math.round(total);

  // back flip home
  const from = pivot.position.clone(), qf = pivot.quaternion.clone();
  heroRig.pose(HP.CROUCH, 10);
  tween(0.42, k => {
    const e = ease(k);
    pivot.position.lerpVectors(from, HOME, e); pivot.position.y += Math.sin(k * Math.PI) * 1.6;
    pivot.quaternion.slerpQuaternions(qf, HERO_Q, e);
    _q2.setFromAxisAngle(ZAXIS, -Math.sin(k * Math.PI) * 0.0); // keep upright on landing
  });
  await sleep(0.42);
  pivot.position.copy(HOME); pivot.quaternion.copy(HERO_Q);
  fx.burst(_a.set(HOME.x, 0.1, 0), 18, 0xbfe8ff, 2.5, 0.5, 2, 0.6);
  heroRig.pose(G.monHp <= 0 ? HP.WIN : HP.IDLE, 9);
  if (total > 0) {
    const rank = total > 1400 ? 'PERFECT!!' : total > 900 ? 'EXCELLENT!' : total > 500 ? 'GREAT!' : 'GOOD';
    banner(`${Math.round(total)} DAMAGE`, 'dmgTotal', `${rank}　${entries} HIT` + (critDone ? '　+CRITICAL' : ''));
  } else banner('MISS…', 'miss', '線がモンスターに当たっていない！');
  weakRing.visible = false;
  if (G.monHp <= 0) return win();
  await sleep(0.9);
  monsterTurn();
}

// ---------------------------------------------------------------- monster attack
const mirrorPose = p => { const o = {}; for (const k in p) { const v = p[k]; const k2 = k.endsWith('L') ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : k; o[k2] = [v[0], -v[1], -v[2]]; } return o; };
const CLAW_UP = mirrorPose(MP.CLAW_UP), CLAW_HIT = mirrorPose(MP.CLAW_HIT);

function guardTap() {
  if (G.guardTime != null) return;
  G.guardTime = time; G.guardDrop = time + 0.55;
  heroRig.pose(HP.GUARD, 28);
  if (time < G.warnTime) pop('早すぎる！', _a.copy(HOME).setY(2.4), 'miss');
}
function warn() {
  G.warnTime = time; sfx.warn();
  const e = $('alert'); e.classList.remove('show'); void e.offsetWidth; e.classList.add('show');
}
function impact(mult) {
  const base = G.monAtk * mult * rand(0.9, 1.1);
  const at = _a.copy(HOME).setY(1.3).clone(), front = at.clone(); front.x += 0.7;
  let f = 1, res = 'hit';
  if (G.guardTime != null && G.guardTime >= G.warnTime) { res = (time - G.guardTime) <= 0.2 ? 'perfect' : 'guard'; f = res === 'perfect' ? 0.1 : 0.45; }
  const d = Math.max(1, Math.round(base * f));
  G.heroHp = Math.max(0, G.heroHp - d); hud();
  G.guardDrop = Infinity;
  if (res === 'hit') {
    sfx.hurt(); vignette(); G.shake = 0.6; hitStop = 0.07;
    heroRig.pose(HP.HIT, 24); fx.flash(at, 0xff6644, 4.5, 0.35); fx.burst(at, 50, 0xff7744, 8, 0.6, -8, 0.3);
    pop('-' + d, at.setY(2.3), 'hurt');
    tween(0.5, k => { pivot.position.x = HOME.x - Math.sin(k * Math.PI) * 0.7; });
  } else {
    sfx.guard(res === 'perfect'); G.shake = 0.25; hitStop = 0.05;
    fx.flash(front, 0x9fefff, res === 'perfect' ? 6 : 4, 0.35); fx.burst(front, 40, 0x9fefff, 8, 0.5, -5, 0.2);
    pop(res === 'perfect' ? 'PERFECT GUARD!' : 'GUARD!', at.clone().setY(2.6), 'guard'); pop('-' + d, at.setY(2.1), 'hurt small');
    tween(0.35, k => { pivot.position.x = HOME.x - Math.sin(k * Math.PI) * 0.25; });
  }
}

async function monsterTurn() {
  G.state = 'monsterTurn'; G.guardTime = null; G.warnTime = Infinity; G.guardDrop = Infinity;
  banner('ENEMY TURN', 'enemy'); hint('「！」が出たらタップでガード！');
  await sleep(0.75);
  const kind = ['claw', 'tail', 'fire'][Math.floor(Math.random() * 3)];
  const mx = mon.root.position;
  if (kind === 'claw') {
    monRig.pose(CLAW_UP, 6); sfx.roar();
    await tween(0.65, k => { mx.x = lerp(MHOME.x, HOME.x + 2.7, ease(k)); mx.y = Math.sin(k * Math.PI) * 0.35; });
    G.shake = 0.2; await sleep(0.25);
    warn(); await sleep(0.3);
    monRig.pose(CLAW_HIT, 26); sfx.slash(); await sleep(0.1);
    impact(1.0);
    await sleep(0.55);
  } else if (kind === 'tail') {
    monRig.pose(MP.TAIL, 6); sfx.roar();
    await tween(0.6, k => { mx.x = lerp(MHOME.x, HOME.x + 3.3, ease(k)); mon.root.rotation.y = -Math.PI / 2 - 0.6 * ease(k); });
    await sleep(0.2);
    warn(); await sleep(0.22);
    sfx.dash();
    const r0 = mon.root.rotation.y;
    tween(0.5, k => { mon.root.rotation.y = r0 + (Math.PI * 2 + 0.6) * ease(k); });
    await sleep(0.18);
    impact(1.15);
    await sleep(0.6);
    mon.root.rotation.y = -Math.PI / 2;
  } else {
    monRig.pose(MP.FIRE_UP, 5); sfx.roar();
    const ch = tween(0.85, () => { jointPos('head', [0, -0.05, 0.6], _c); fx.burst(_c, 2, variant().glow, 2.5, 0.35, 3, 0.9); });
    await ch;
    warn(); monRig.pose(MP.FIRE, 22); await sleep(0.08);
    sfx.fire();
    const from = jointPos('head', [0, -0.1, 0.9], new V3()), to = new V3(HOME.x + 0.3, 1.3, 0);
    orb.visible = true; orb.material.color.set(variant().glow);
    await tween(0.32, k => { orb.position.lerpVectors(from, to, k); orb.scale.setScalar(1.6 + k * 1.4); fx.burst(orb.position, 4, variant().glow, 2, 0.4, 1, 0.3); });
    orb.visible = false; fx.burst(to, 60, variant().glow, 9, 0.7, -3, 0.4);
    impact(1.3);
    await sleep(0.55);
  }
  if (G.heroHp <= 0) return lose();
  monRig.pose(MP.IDLE, 5);
  const fx0 = mx.x;
  tween(0.5, k => { mx.x = lerp(fx0, MHOME.x, ease(k)); mx.y = Math.sin(k * Math.PI) * 0.25; });
  heroRig.pose(HP.IDLE, 8);
  await sleep(0.55);
  playerTurn();
}

// ---------------------------------------------------------------- results
async function win() {
  G.state = 'win'; G.wins++; hint('');
  if (G.wins > G.best) { G.best = G.wins; try { localStorage.setItem('lineslash.best', String(G.best)); } catch (e) { } }
  $('stageLabel').textContent = `STAGE ${G.stage}　${G.wins}連勝中`;
  timeScale = 0.35; monRig.pose(MP.ROAR, 8); sfx.roar(); G.shake = 0.6;
  for (let i = 0; i < 5; i++) { jointPos('body', [rand(-0.6, 0.6), rand(0, 1.2), 0.6], _c); fx.flash(_c, 0xfff0a0, 5, 0.4); fx.burst(_c, 30, variant().glow, 9, 0.8, -4, 0.4); await sleep(0.09); }
  timeScale = 1; monRig.pose(MP.DEAD, 3.5);
  await sleep(0.9); G.shake = 0.5; sfx.hit();
  fx.burst(MCENTER, 120, variant().glow, 9, 1.2, 2, 2.5);
  await tween(0.9, k => { mon.root.scale.setScalar(Math.max(0.01, 1 - ease(k))); mon.root.position.y = k * 1.2; });
  sfx.win(); heroRig.pose(HP.WIN, 8);
  banner('VICTORY!', 'win', `${G.wins} 連勝！`);
  await sleep(1.6);
  for (let n = 3; n >= 1; n--) { banner(`NEXT BATTLE ${n}`, 'next', 'さらに強い竜が現れる…'); sfx.count(); await sleep(0.8); }
  G.stage++;
  beginStage();
}
async function lose() {
  G.state = 'losing'; hint(''); sfx.lose();
  heroRig.pose(HP.DOWN, 5); timeScale = 0.5;
  await tween(0.7, k => { pivot.position.y = lerp(1, 0.32, ease(k)); pivot.position.x = HOME.x - 0.5 * ease(k); });
  timeScale = 1; monRig.pose(MP.ROAR, 6); sfx.roar();
  await sleep(0.9);
  G.state = 'gameover';
  $('overWins').textContent = `${G.wins} 連勝`; $('overStage').textContent = `STAGE ${G.stage} で力尽きた…`;
  $('overBest').textContent = `ベスト記録: ${G.best} 連勝`;
  show('over', true); show('hud', false);
  setTimeout(() => updater.check(), 2500); // game is over: safe moment to apply a pending update
}

$('btnStart').addEventListener('click', startGame);
$('btnRetry').addEventListener('click', startGame);
$('btnTitle').addEventListener('click', () => { sfx.ui(); goTitle(); });

// ---------------------------------------------------------------- fixed viewport guards
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick', 'selectstart']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
let lastTouch = 0;
document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouch < 320 && !(e.target.closest && e.target.closest('button'))) e.preventDefault(); lastTouch = n; }, { passive: false });

// ---------------------------------------------------------------- update check (never mid-game)
const updater = initUpdater(() => !inGame(), () => toast('新しいバージョンに更新しています…', 4000));

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
function idleAnim(t) {
  const a = heroRig.add;
  a.torso[0] += Math.sin(t * 2.2) * 0.03; a.armR[0] += Math.sin(t * 2.2 + 1) * 0.04; a.armL[0] += Math.sin(t * 2.2 + 2) * 0.04;
  a.cape[0] += Math.sin(t * 1.7) * 0.07; a.cape[2] += Math.sin(t * 1.1) * 0.04; a.head[1] += Math.sin(t * 0.9) * 0.05;
  hero.J.hips.position.y = 0.98 + Math.sin(t * 2.2) * 0.012;
  const m = monRig.add, f = G.flinch;
  m.body[0] += Math.sin(t * 1.4) * 0.035 - f * 0.3; m.body[2] += Math.sin(t * 31) * f * 0.06;
  m.neck1[1] += Math.sin(t * 0.8) * 0.14; m.neck1[0] += Math.sin(t * 1.4 + 1) * 0.05 - f * 0.4; m.neck2[1] += Math.sin(t * 0.8 + 0.7) * 0.1;
  m.head[1] += Math.sin(t * 0.8 + 1.4) * 0.12; m.head[2] += Math.sin(t * 0.6) * 0.08; m.jaw[0] += 0.06 + Math.sin(t * 1.4) * 0.06 + f * 0.5;
  for (let i = 1; i <= 7; i++) m['tail' + i][1] += Math.sin(t * 1.2 - i * 0.6) * 0.16;
  const fl = Math.sin(t * 1.6) * 0.1; m.wingL[2] += fl + f * 0.3; m.wingR[2] -= fl + f * 0.3; m.wingL[1] += Math.sin(t * 1.6 + 1) * 0.06; m.wingR[1] -= Math.sin(t * 1.6 + 1) * 0.06;
  m.armL[0] += Math.sin(t * 1.4 + 2) * 0.06; m.armR[0] += Math.sin(t * 1.4 + 2.6) * 0.06; m.foreL[0] += Math.sin(t * 1.9) * 0.08; m.foreR[0] += Math.sin(t * 1.9 + 1) * 0.08;
}
function frame() {
  requestAnimationFrame(frame);
  const raw = Math.min(clock.getDelta(), 0.05); realT += raw;
  let dt = raw * speedMul * timeScale;
  if (hitStop > 0) { hitStop -= raw * speedMul; dt *= 0.08; }
  time += dt;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i], k = Math.min(1, (time - tw.t0) / tw.dur);
    tw.fn(k); if (k >= 1) { tweens.splice(tweens.indexOf(tw), 1); tw.r(); }
  }
  for (let i = waiters.length - 1; i >= 0; i--) { const w = waiters[i]; if (time >= w.t) { waiters.splice(i, 1); w.r(); } }
  if (G.state === 'monsterTurn' && time > G.guardDrop) { G.guardDrop = Infinity; heroRig.pose(HP.IDLE, 10); }

  G.flinch = Math.max(0, G.flinch - dt * 3.5); G.shake = Math.max(0, G.shake - raw * 1.8);
  idleAnim(time);
  heroRig.update(dt); monRig.update(dt);
  if (weakRing.visible) {
    jointPos(G.weak.j, G.weak.o, weakRing.position);
    weakRing.scale.setScalar(1.25 + Math.sin(realT * 6) * 0.2); weakRing.material.rotation = realT * 1.5;
  }
  if (G.state !== 'playerAttack' && stroke.s.length && !stroke.active && G.state !== 'playerTurn') stroke.s.length = 0;
  fx.update(dt); stage.update(realT, raw);
  stage.heroShadow.position.set(pivot.position.x, 0.02, pivot.position.z);
  stage.heroShadow.scale.setScalar(clamp(2.4 - (pivot.position.y - 1) * 0.3, 0.8, 2.4));
  stage.monShadow.position.set(mon.root.position.x, 0.021, mon.root.position.z); stage.monShadow.scale.setScalar(6.5 * mon.root.scale.x);

  camera.position.copy(camBase);
  if (G.state === 'title' || G.state === 'gameover') { const a = Math.sin(realT * 0.25) * 0.22; camera.position.applyAxisAngle(UP, a); }
  if (G.shake > 0) { const s = G.shake * 0.35; camera.position.x += rand(-s, s); camera.position.y += rand(-s, s); }
  camera.lookAt(camTgt);
  renderer.render(scene, camera);
  drawInk();
}

// ---------------------------------------------------------------- debug / test hooks
window.__game = {
  G, updater, tris: { hero: hero.tris, monster: mon.tris },
  countTris(which) { let n = 0; (which === 'hero' ? hero.root : mon.root).traverse(o => { if (o.isMesh) n += o.geometry.attributes.position.count / 3; }); return n; },
  monsterScreen() { camera.position.copy(camBase); camera.lookAt(camTgt); camera.updateMatrixWorld(); return toScreen(MCENTER); },
  setSpeed(v) { speedMul = v; }, startGame, goTitle,
  drawCalls: () => renderer.info.render.calls,
};

goTitle();
frame();
