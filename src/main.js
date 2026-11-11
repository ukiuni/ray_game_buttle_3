import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Rig } from './geo.js';
import { buildHero, HERO_POSES as HP } from './hero.js';
import { MONSTERS } from './monsters.js';
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

const HOME = new V3(-2.6, 1, 0), MHOME = new V3(2.6, 0, 0), MCENTER = new V3(2.6, 2.1, 0), MYAW = -Math.PI / 2;
const UP = new V3(0, 1, 0), ZERO = new V3(), ZAXIS = new V3(0, 0, 1);
const HERO_Q = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2);

// hero
const hero = buildHero();
const pivot = new THREE.Group(); pivot.position.copy(HOME); pivot.quaternion.copy(HERO_Q);
hero.root.position.y = -1; pivot.add(hero.root); scene.add(pivot);
const heroRig = new Rig(hero.J); heroRig.pose(HP.IDLE); heroRig.snap();
const swordGlow = fx.glow(0x66e8ff, 0.9, 0.55); swordGlow.position.y = 0.75; hero.J.sword.add(swordGlow);
const coreGlow = fx.glow(0x66e8ff, 0.5, 0.6); coreGlow.position.set(0, 0.42, 0.22); hero.J.torso.add(coreGlow);

// enemies (all built up front; only the current one is visible)
const hueU = { value: new THREE.Matrix3() };
const setHue = a => hueU.value.setFromMatrix4(new THREE.Matrix4().makeRotationAxis(new V3(1, 1, 1).normalize(), a));
const mons = MONSTERS.map(def => {
  const m = def.build(); m.def = def;
  m.root.position.copy(MHOME); m.root.rotation.y = MYAW; m.root.visible = false; scene.add(m.root);
  m.rig = new Rig(m.J); m.rig.pose(def.poses.IDLE); m.rig.snap();
  for (const mat of Object.values(m.mats)) mat.onBeforeCompile = sh => {
    sh.uniforms.hueMat = hueU;
    sh.fragmentShader = 'uniform mat3 hueMat;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = max(hueMat * diffuseColor.rgb, vec3(0.0));');
  };
  m.glows = def.glows.map(g => { const s = fx.glow(g.c, g.s, g.a); s.position.set(g.o[0], g.o[1], g.o[2]); m.J[g.j].add(s); return s; });
  return m;
});
let cur = mons[0];
const weakRing = fx.ring(0xffee55, 1.3); weakRing.visible = false; scene.add(weakRing);
const HUES = [0, 2.1, 4.2, 1.05, 3.15], PREFIX = ['', '変異種 ', '真・', '極・', '神・'];

// ---------------------------------------------------------------- game state
const G = {
  state: 'title', stage: 1, wins: 0, best: 0, bid: 0,
  heroHp: 1000, heroMax: 1000, monHp: 1, monMax: 1, monAtk: 150,
  heroBusy: false, attacks: 0, weak: MONSTERS[0].weak[0], flinch: 0, shake: 0, guardUntil: -1, guardCd: -1, lastDamage: 0,
};
// the enemy's single line: idle -> draw (telegraph) -> dash (attack) -> return -> idle
const E = { phase: 'idle', path: null, shown: 0, progress: 0, hitDone: false, ai: true, lines: 0, log: [], yaw: MYAW };
const setPhase = p => { E.phase = p; E.log.push(p); if (E.log.length > 400) E.log.shift(); };
try { G.best = parseInt(localStorage.getItem('lineslash.best') || '0', 10) || 0; } catch (e) { }
const inGame = () => G.state !== 'title' && G.state !== 'gameover';
const INK_MAX = 20, ATK_PER_UNIT = 75, STEP = 0.15;

let time = 0, timeScale = 1, hitStop = 0, realT = 0;
let waiters = [], tweens = [];
const sleep = (s, tag) => new Promise(r => waiters.push({ t: time + s, r, tag }));
const tween = (dur, fn, tag) => new Promise(r => tweens.push({ t0: time, dur, fn, r, tag }));
const cancel = tag => { waiters = waiters.filter(w => w.tag !== tag); tweens = tweens.filter(t => t.tag !== tag); };
const resetSched = () => { waiters = []; tweens = []; };

// ---------------------------------------------------------------- UI helpers
let W = 1, H = 1, dpr = 1;
const ink = $('ink'), ictx = ink.getContext('2d');
const camBase = new V3(), camTgt = new V3();
const plane = new THREE.Plane(), _n = new V3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function layout() {
  W = window.innerWidth; H = window.innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
  ink.width = Math.round(W * dpr); ink.height = Math.round(H * dpr);
  const a = W / H, t = clamp((a - 0.7) / 0.9, 0, 1), k = ease(t);
  camBase.set(lerp(-8.8, -0.2, k), lerp(4.7, 2.7, k), lerp(8.6, 9.8, k));
  camTgt.set(lerp(0.05, 0.3, k), lerp(1.6, 2.25, k), 0);
  camera.fov = lerp(67, 42, k); camera.aspect = a; camera.updateProjectionMatrix();
  camera.position.copy(camBase); camera.lookAt(camTgt); camera.updateMatrixWorld();
  // the player's lines live on a camera-facing plane through the enemy's home position
  camera.getWorldDirection(_n).negate(); plane.setFromNormalAndCoplanarPoint(_n, MCENTER);
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
function inkUI() {
  $('inkGauge').classList.toggle('show', G.state === 'battle');
  $('inkGauge').classList.toggle('busy', G.heroBusy);
  $('inkFill').style.width = (G.heroBusy && !stroke.active ? 0 : (1 - stroke.len / INK_MAX) * 100) + '%';
}
function vignette() { const v = $('vignette'); v.classList.remove('show'); void v.offsetWidth; v.classList.add('show'); }
function show(id, on) { $(id).classList.toggle('hidden', !on); }

// ---------------------------------------------------------------- flow
const monCenter = out => out.set(cur.root.position.x, cur.root.position.y + cur.def.center, cur.root.position.z);
function resetActors() {
  cancel('hero'); cancel('enemy');
  pivot.position.copy(HOME); pivot.quaternion.copy(HERO_Q);
  for (const m of mons) m.root.visible = false;
  cur = mons[(G.stage - 1) % mons.length];
  const variant = Math.floor((G.stage - 1) / mons.length);
  setHue(HUES[variant % HUES.length]);
  cur.root.visible = true; cur.root.position.copy(MHOME); cur.root.rotation.set(0, MYAW, 0); cur.root.scale.setScalar(1);
  cur.rig.pose(cur.def.poses.IDLE); heroRig.pose(HP.IDLE);
  $('monName').textContent = PREFIX[Math.min(variant, PREFIX.length - 1)] + cur.def.name + ' Lv.' + G.stage;
  fx.trailBreak(); weakRing.visible = false;
  stroke.s.length = 0; stroke.w.length = 0; stroke.len = 0; stroke.active = false; stroke.progress = 0;
  E.path = null; E.shown = 0; E.progress = 0; E.yaw = MYAW; E.phase = 'idle';
  G.flinch = 0; G.heroBusy = false; G.guardUntil = -1; G.guardCd = -1; timeScale = 1;
}
function goTitle() {
  resetSched(); G.state = 'title'; G.stage = 1; resetActors();
  show('title', true); show('over', false); show('hud', false); hint(''); inkUI();
  $('bestTitle').textContent = G.best > 0 ? `ベスト記録: ${G.best} 連勝` : '';
  updater.check();
}
function startGame(fromStage) {
  sfx.unlock(); sfx.ui(); resetSched();
  G.stage = typeof fromStage === 'number' ? fromStage : 1; G.wins = 0;
  show('title', false); show('over', false); show('hud', true);
  beginStage();
}
async function beginStage() {
  G.state = 'intro'; resetActors(); const id = ++G.bid;
  G.heroMax = 1000; G.heroHp = G.heroMax;
  G.monMax = Math.round(4000 * Math.pow(1.28, G.stage - 1)); G.monHp = G.monMax;
  G.monAtk = 150 * Math.pow(1.16, G.stage - 1);
  $('stageLabel').textContent = `STAGE ${G.stage}` + (G.wins ? `　${G.wins}連勝中` : '');
  hud(); inkUI();
  banner(`STAGE ${G.stage}`, 'stage', $('monName').textContent);
  cur.root.scale.setScalar(0.01);
  tween(0.7, k => cur.root.scale.setScalar(Math.max(0.01, ease(k))));
  fx.burst(MCENTER, 60, cur.def.glowColor, 7, 0.9, 1, 1.5);
  await sleep(0.6);
  cur.rig.pose(cur.def.poses.ROAR, 7); sfx.roar(); G.shake = 0.25;
  await sleep(1.0);
  cur.rig.pose(cur.def.poses.IDLE, 5);
  await sleep(0.3);
  // real-time battle: both sides may draw a line whenever their previous line is finished
  G.state = 'battle'; pickWeak(); weakRing.visible = true;
  banner('FIGHT!', 'you');
  hint('線を引いて攻撃！ 赤い線は敵の攻撃・タップでガード');
  inkUI();
  enemyLoop(id, 1.2);
}
function pickWeak() { const w = cur.def.weak; G.weak = w[Math.floor(Math.random() * w.length)]; }

// ---------------------------------------------------------------- the player's line
const stroke = { active: false, id: -1, s: [], w: [], len: 0, progress: 0 };
const canDraw = () => G.state === 'battle' && !G.heroBusy;
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
  stroke.s.push({ x, y }); stroke.w.push(p); inkUI();
}
function strokeEnd() {
  if (!stroke.active) return;
  stroke.active = false;
  if (!canDraw()) { stroke.s.length = 0; stroke.w.length = 0; stroke.len = 0; return; }
  if (stroke.len < 1.2 || stroke.w.length < 2) { // a tap (or a tiny line) is a guard, not a line
    stroke.s.length = 0; stroke.w.length = 0; stroke.len = 0; inkUI(); guardTap(); return;
  }
  playerAttack(stroke.w.slice());
}
window.addEventListener('pointerdown', e => {
  sfx.unlock();
  if (e.target.closest && e.target.closest('button')) return;
  if (canDraw() && !stroke.active) { // one line at a time: ignored while the previous line is still being executed
    stroke.active = true; stroke.id = e.pointerId; stroke.s.length = 0; stroke.w.length = 0; stroke.len = 0; stroke.progress = 0;
    strokeAdd(e.clientX, e.clientY);
  }
});
window.addEventListener('pointermove', e => {
  if (!stroke.active || e.pointerId !== stroke.id) return;
  if (!canDraw()) { strokeEnd(); return; }
  const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
  if (list && list.length) { for (const c of list) { if (!stroke.active) break; strokeAdd(c.clientX, c.clientY); } }
  else strokeAdd(e.clientX, e.clientY);
});
const pend = e => { if (e.pointerId === stroke.id) strokeEnd(); };
window.addEventListener('pointerup', pend); window.addEventListener('pointercancel', pend);

function guardTap() {
  if (time < G.guardCd) return;
  G.guardUntil = time + 0.6; G.guardCd = time + 1.0;
  heroRig.pose(HP.GUARD, 28); sfx.ui();
}

function polyline(pts, i0, i1, layers) {
  if (i1 - i0 < 1) return;
  ictx.lineCap = 'round'; ictx.lineJoin = 'round';
  for (const [w, col, blur, glow] of layers) {
    ictx.strokeStyle = col; ictx.lineWidth = w; ictx.shadowColor = glow; ictx.shadowBlur = blur;
    ictx.beginPath(); ictx.moveTo(pts[i0].x, pts[i0].y);
    for (let i = i0 + 1; i <= i1; i++) ictx.lineTo(pts[i].x, pts[i].y);
    ictx.stroke();
  }
  ictx.shadowBlur = 0;
}
const BLUE = [[16, 'rgba(60,200,255,0.25)', 0, '#4cf'], [8, 'rgba(110,235,255,0.85)', 14, '#4cf'], [3, '#ffffff', 0, '#4cf']];
const RED = [[18, 'rgba(255,60,40,0.28)', 0, '#f42'], [9, 'rgba(255,95,60,0.9)', 14, '#f42'], [3, '#ffe9d8', 0, '#f42']];
function drawInk() {
  ictx.setTransform(dpr, 0, 0, dpr, 0, 0); ictx.clearRect(0, 0, W, H);
  if (E.path) { // the enemy's line, projected from its 3D path
    const sp = E.path.screen, n = E.path.pts.length;
    for (let i = 0; i < n; i++) { const s = toScreen(E.path.pts[i]); sp[i].x = s.x; sp[i].y = s.y; }
    const i0 = Math.floor(E.progress * (n - 1)), i1 = Math.floor(E.shown * (n - 1));
    polyline(sp, i0, i1, RED);
    if (E.phase === 'draw' && i1 > 0) { ictx.fillStyle = '#fff'; ictx.beginPath(); ictx.arc(sp[i1].x, sp[i1].y, 7, 0, 7); ictx.fill(); }
  }
  const n = stroke.s.length;
  if (n >= 2) polyline(stroke.s, Math.min(n - 2, Math.floor(stroke.progress * (n - 1))), n - 1, BLUE);
}

// ---------------------------------------------------------------- the hero rides the player's line
const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
function jointPos(name, off, out) { return cur.J[name].localToWorld(out.set(off[0], off[1], off[2])); }
function orient(dir, roll, k) {
  _m4.lookAt(dir, ZERO, UP); _q.setFromRotationMatrix(_m4); _q2.setFromAxisAngle(ZAXIS, roll); _q.multiply(_q2);
  pivot.quaternion.slerp(_q, k);
}
function damageMonster(d) {
  if (G.state !== 'battle') return;
  G.monHp = Math.max(0, G.monHp - d); hud();
  if (G.monHp <= 0) { // defeated: the enemy's line is void; the hero finishes the current line and then celebrates
    G.state = 'win'; cancel('enemy'); E.path = null; setPhase('idle'); weakRing.visible = false; hint(''); inkUI();
  }
}

async function playerAttack(raw) {
  G.heroBusy = true; G.attacks++; G.guardUntil = -1; inkUI(); cancel('knock');
  const T = 'hero';
  const dec = [raw[0]];
  for (const p of raw) if (p.distanceTo(dec[dec.length - 1]) > 0.55) dec.push(p);
  if (dec.length < 2 || raw[raw.length - 1].distanceTo(dec[dec.length - 1]) > 0.1) dec.push(raw[raw.length - 1]);
  const curve = new THREE.CatmullRomCurve3(dec, false, 'centripetal');
  const L = curve.getLength(), N = Math.max(8, Math.ceil(L / STEP)), pts = curve.getSpacedPoints(N);
  for (const p of pts) p.y = Math.max(p.y, 0.5);
  const step = L / N;

  // wind-up, then leap to the start of the line
  heroRig.pose(HP.CROUCH, 24); await sleep(0.14, T);
  sfx.dash(); heroRig.pose(HP.FLY, 16);
  fx.burst(_a.set(HOME.x, 0.1, 0), 24, 0xbfe8ff, 3, 0.5, 2, 0.6);
  const dir0 = _d.copy(pts[1]).sub(pts[0]).normalize().clone();
  await tween(0.24, k => {
    pivot.position.lerpVectors(HOME, pts[0], ease(k)); pivot.position.y += Math.sin(k * Math.PI) * 0.8;
    orient(dir0, 0, 0.25);
  }, T);

  // ride the line
  let last = 0, entries = 0, total = 0, group = 0, inside = false, critDone = false, lastSlash = -1;
  const dur = clamp(L / 15, 0.5, 1.7), dir = dir0.clone();
  const hitTest = p => {
    if (G.state !== 'battle') return;
    let m = 0;
    for (const [j, o, r, mult] of cur.def.hits) { projToPlane(jointPos(j, o, _a), _b); if (_b.distanceTo(p) < r && mult > m) m = mult; }
    projToPlane(jointPos(G.weak.j, G.weak.o, _a), _b);
    const weak = _b.distanceTo(p) < 0.6;
    if (weak) m = 3;
    if (m > 0) {
      if (!inside) {
        entries++; inside = true; sfx.slash(); G.shake = Math.max(G.shake, 0.22); G.flinch = 1; hitStop = 0.03;
        fx.flash(p, 0xaef4ff, 3.2); fx.burst(p, 26, 0xffd27a, 7, 0.5, -9, 0.2);
        if (time - lastSlash > 0.08) { sfx.hit(); lastSlash = time; }
      }
      const combo = 1 + 0.12 * Math.min(entries - 1, 8);
      let d = ATK_PER_UNIT * step * m * combo;
      if (weak && !critDone) {
        critDone = true; d += 160 * combo; sfx.crit(); hitStop = 0.08; G.shake = 0.5;
        fx.flash(p, 0xfff27a, 6, 0.4); fx.burst(p, 60, 0xfff27a, 10, 0.7, -6, 0.3);
        pop('CRITICAL!', p, 'crit');
        if (E.phase === 'draw') interruptEnemy(p); // a critical hit breaks the line the enemy is still drawing
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
    orient(dir, k * dur * Math.PI * 2 * 1.5, 0.6);
    const end = i + (k >= 1 ? 1 : 0);
    for (let q = last + 1; q <= end; q++) hitTest(pts[q]);
    last = Math.max(last, end);
    stroke.progress = k;
    hero.J.sword.localToWorld(_a.set(0, 0.12, 0)); hero.J.sword.localToWorld(_b.set(0, 1.34, 0)); fx.trailPush(_a, _b);
    if (Math.random() < 0.6) fx.burst(pivot.position, 1, 0x7fe8ff, 1.5, 0.4, 0, 0.5);
  }, T);
  if (group > 0) pop(Math.round(group), pts[N], group > 250 ? 'big' : '');
  stroke.s.length = 0; stroke.w.length = 0; stroke.len = 0; stroke.progress = 0;
  G.lastDamage = Math.round(total);
  if (total > 0) {
    const rank = total > 1400 ? 'PERFECT!!' : total > 900 ? 'EXCELLENT!' : total > 500 ? 'GREAT!' : 'GOOD';
    monCenter(_a); _a.y += 2.2; pop(`${rank} ${Math.round(total)}`, _a, 'total');
  } else pop('MISS', pts[N], 'miss');

  // flip back home; the line is finished only when the hero has landed
  const from = pivot.position.clone(), qf = pivot.quaternion.clone();
  heroRig.pose(HP.CROUCH, 10);
  await tween(0.36, k => {
    const e = ease(k);
    pivot.position.lerpVectors(from, HOME, e); pivot.position.y += Math.sin(k * Math.PI) * 1.6;
    pivot.quaternion.slerpQuaternions(qf, HERO_Q, e);
  }, T);
  pivot.position.copy(HOME); pivot.quaternion.copy(HERO_Q);
  fx.burst(_a.set(HOME.x, 0.1, 0), 18, 0xbfe8ff, 2.5, 0.5, 2, 0.6);
  heroRig.pose(G.state === 'win' ? HP.WIN : HP.IDLE, 9);
  G.heroBusy = false;
  if (G.state === 'win') return win();
  pickWeak(); inkUI();
}

// ---------------------------------------------------------------- the enemy draws its own line and rides it
function enemyPath() {
  const minY = cur.def.minY, S = monCenter(new V3());
  const T = new V3(HOME.x + 0.2, Math.max(minY, 1.3), 0);
  const kind = Math.floor(Math.random() * 3);
  let P;
  if (kind === 0) P = [S, new V3(lerp(S.x, T.x, 0.5), S.y + 1.5, rand(-0.6, 0.6)), T, new V3(T.x - 1.5, minY + 0.4, rand(-0.5, 0.5))];
  else if (kind === 1) P = [S, new V3(S.x - 0.8, S.y + 2.3, 1.6), new V3(lerp(S.x, T.x, 0.6), minY + 1.3, -1.2), T, new V3(T.x - 1.2, minY + 1.2, 0.8)];
  else P = [S, new V3(1.0, minY + 0.1, 1.9), new V3(-0.7, minY + 0.6, -1.6), T, new V3(T.x - 1.0, minY + 0.2, 1.0)];
  const curve = new THREE.CatmullRomCurve3(P, false, 'centripetal'), L = curve.getLength(), N = Math.max(10, Math.ceil(L / 0.2));
  const pts = curve.getSpacedPoints(N);
  for (const p of pts) p.y = Math.max(p.y, minY);
  return { pts, L, screen: pts.map(() => ({ x: 0, y: 0 })) };
}
function hitHero(at) {
  const guarded = time < G.guardUntil;
  const d = Math.max(1, Math.round(G.monAtk * rand(0.9, 1.1) * (guarded ? 0.3 : 1)));
  G.heroHp = Math.max(0, G.heroHp - d); hud();
  const p = pivot.position.clone(), front = p.clone().lerp(at, 0.3);
  if (guarded) {
    sfx.guard(true); G.shake = 0.25; hitStop = 0.05;
    fx.flash(front, 0x9fefff, 5, 0.35); fx.burst(front, 40, 0x9fefff, 8, 0.5, -5, 0.2);
    pop('GUARD!', p.clone().setY(p.y + 1.6), 'guard'); pop('-' + d, p.clone().setY(p.y + 1.1), 'hurt small');
  } else {
    sfx.hurt(); vignette(); G.shake = 0.6; hitStop = 0.07;
    fx.flash(p, 0xff6644, 4.5, 0.35); fx.burst(p, 50, 0xff7744, 8, 0.6, -8, 0.3);
    pop('-' + d, p.clone().setY(p.y + 1.3), 'hurt');
    if (!G.heroBusy && G.heroHp > 0) {
      heroRig.pose(HP.HIT, 24);
      tween(0.45, k => { pivot.position.x = HOME.x - Math.sin(k * Math.PI) * 0.6; if (k >= 1 && !G.heroBusy && G.state === 'battle') heroRig.pose(HP.IDLE, 8); }, 'knock');
    }
  }
  if (G.heroHp <= 0) lose();
}
async function enemyCycle(id) {
  const T = 'enemy', def = cur.def, root = cur.root, ok = () => G.state === 'battle' && G.bid === id;
  if (!ok() || E.phase !== 'idle') return;
  // 1) draw the line (visible to the player while it grows)
  E.path = enemyPath(); E.shown = 0; E.progress = 0; E.hitDone = false; E.lines++; setPhase('draw');
  cur.rig.pose(def.poses.WIND, 6); sfx.warn();
  const al = $('alert'); al.classList.remove('show'); void al.offsetWidth; al.classList.add('show');
  await tween(Math.max(0.55, 1.0 - G.stage * 0.04), k => { E.shown = k; }, T);
  // 2) ride it
  setPhase('dash'); cur.rig.pose(def.poses.DASH, 14); sfx.roar(); sfx.dash();
  const pts = E.path.pts, N = pts.length - 1, dur = E.path.L / (8.5 + G.stage * 0.4);
  await tween(dur, k => {
    const f = k * N, i = Math.min(N - 1, Math.floor(f)), u = f - i;
    _c.lerpVectors(pts[i], pts[i + 1], u);
    root.position.set(_c.x, _c.y - def.center, _c.z);
    _d.copy(pts[Math.min(N, i + 2)]).sub(pts[Math.max(0, i - 1)]);
    if (_d.x * _d.x + _d.z * _d.z > 0.01) { let dy = Math.atan2(_d.x, _d.z) - E.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); E.yaw += dy * 0.18; }
    root.rotation.y = E.yaw; root.rotation.z = Math.sin(k * Math.PI) * 0.18;
    E.progress = k;
    if (Math.random() < 0.7) fx.burst(_c, 1, def.glowColor, 2, 0.5, 0, 1.2);
    if (!E.hitDone && G.state === 'battle') {
      const p = pivot.position, dx = _c.x - p.x, dy = (_c.y - p.y) * 0.5, dz = _c.z - p.z;
      if (dx * dx + dy * dy + dz * dz < def.reach * def.reach) { E.hitDone = true; hitHero(_c.clone()); }
    }
  }, T);
  if (!E.hitDone && ok()) pop('DODGE!', pivot.position.clone().setY(pivot.position.y + 1.4), 'guard');
  // 3) return; only then may the enemy draw again
  E.path = null; setPhase('return'); cur.rig.pose(def.poses.IDLE, 5);
  const from = root.position.clone(), y0 = E.yaw, dyaw = Math.atan2(Math.sin(MYAW - y0), Math.cos(MYAW - y0));
  await tween(0.55, k => {
    const e = ease(k); root.position.lerpVectors(from, MHOME, e); root.position.y += Math.sin(k * Math.PI) * 0.4;
    E.yaw = y0 + dyaw * e; root.rotation.y = E.yaw; root.rotation.z = 0;
  }, T);
  E.yaw = MYAW; setPhase('idle');
}
async function enemyLoop(id, delay) {
  const ok = () => G.state === 'battle' && G.bid === id;
  await sleep(delay, 'enemy');
  while (ok()) {
    if (E.ai) await enemyCycle(id);
    if (!ok()) return;
    await sleep(rand(1.4, 2.6) * Math.max(0.5, 1 - G.stage * 0.05), 'enemy');
  }
}
function interruptEnemy(p) {
  cancel('enemy'); E.path = null; setPhase('idle'); cur.rig.pose(cur.def.poses.IDLE, 8);
  pop('BREAK!', p.clone().setY(p.y + 0.8), 'guard');
  enemyLoop(G.bid, 1.6);
}

// ---------------------------------------------------------------- results
async function win() {
  G.wins++; hint(''); inkUI();
  if (G.wins > G.best) { G.best = G.wins; try { localStorage.setItem('lineslash.best', String(G.best)); } catch (e) { } }
  $('stageLabel').textContent = `STAGE ${G.stage}　${G.wins}連勝中`;
  const def = cur.def, root = cur.root;
  timeScale = 0.35; cur.rig.pose(def.poses.ROAR, 8); sfx.roar(); G.shake = 0.6;
  for (let i = 0; i < 5; i++) { monCenter(_c); _c.x += rand(-0.7, 0.7); _c.y += rand(-0.8, 0.8); _c.z += 0.6; fx.flash(_c, 0xfff0a0, 5, 0.4); fx.burst(_c, 30, def.glowColor, 9, 0.8, -4, 0.4); await sleep(0.09); }
  timeScale = 1; cur.rig.pose(def.poses.DEAD, 3.5);
  await sleep(0.9); G.shake = 0.5; sfx.hit();
  fx.burst(monCenter(_c), 120, def.glowColor, 9, 1.2, 2, 2.5);
  const y0 = root.position.y;
  await tween(0.9, k => { root.scale.setScalar(Math.max(0.01, 1 - ease(k))); root.position.y = y0 + k * 1.2; });
  sfx.win(); heroRig.pose(HP.WIN, 8);
  banner('VICTORY!', 'win', `${G.wins} 連勝！`);
  await sleep(1.6);
  for (let n = 3; n >= 1; n--) { banner(`NEXT BATTLE ${n}`, 'next', 'さらに強い敵が現れる…'); sfx.count(); await sleep(0.8); }
  G.stage++;
  beginStage();
}
async function lose() {
  G.state = 'losing'; cancel('hero'); cancel('enemy'); cancel('knock');
  G.heroBusy = true; E.path = null; setPhase('idle'); weakRing.visible = false;
  stroke.active = false; stroke.s.length = 0; stroke.w.length = 0; stroke.len = 0; hint(''); inkUI(); sfx.lose();
  heroRig.pose(HP.DOWN, 5); timeScale = 0.5; cur.rig.pose(cur.def.poses.ROAR, 6);
  const from = pivot.position.clone(), qf = pivot.quaternion.clone(), to = new V3(clamp(from.x - 0.5, -5, 5), 0.32, from.z * 0.5);
  await tween(0.7, k => { pivot.position.lerpVectors(from, to, ease(k)); pivot.quaternion.slerpQuaternions(qf, HERO_Q, ease(k)); });
  timeScale = 1; sfx.roar();
  await sleep(0.9);
  G.state = 'gameover';
  $('overWins').textContent = `${G.wins} 連勝`; $('overStage').textContent = `STAGE ${G.stage} で力尽きた…`;
  $('overBest').textContent = `ベスト記録: ${G.best} 連勝`;
  show('over', true); show('hud', false);
  setTimeout(() => updater.check(), 2500); // game is over: safe moment to apply a pending update
}

$('btnStart').addEventListener('click', () => startGame());
$('btnRetry').addEventListener('click', () => startGame());
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
  cur.def.idle(cur.rig.add, t, G.flinch, cur.J);
}
function frame() {
  requestAnimationFrame(frame);
  const raw = Math.min(clock.getDelta(), 0.05); realT += raw;
  let dt = raw * speedMul * timeScale;
  if (hitStop > 0) { hitStop -= raw * speedMul; dt *= 0.08; }
  time += dt;
  for (const tw of tweens.slice()) {
    if (!tweens.includes(tw)) continue; // cancelled by an earlier callback this frame
    const k = Math.min(1, (time - tw.t0) / tw.dur);
    tw.fn(k);
    if (k >= 1) { const i = tweens.indexOf(tw); if (i >= 0) { tweens.splice(i, 1); tw.r(); } }
  }
  for (const w of waiters.slice()) if (time >= w.t) { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); w.r(); } }
  if (G.guardUntil > 0 && time > G.guardUntil) { G.guardUntil = -1; if (!G.heroBusy && G.state === 'battle') heroRig.pose(HP.IDLE, 10); }

  G.flinch = Math.max(0, G.flinch - dt * 3.5); G.shake = Math.max(0, G.shake - raw * 1.8);
  idleAnim(time);
  heroRig.update(dt); cur.rig.update(dt);
  if (weakRing.visible) {
    jointPos(G.weak.j, G.weak.o, weakRing.position);
    weakRing.scale.setScalar(1.25 + Math.sin(realT * 6) * 0.2); weakRing.material.rotation = realT * 1.5;
  }
  fx.update(dt); stage.update(realT, raw);
  stage.heroShadow.position.set(pivot.position.x, 0.02, pivot.position.z);
  stage.heroShadow.scale.setScalar(clamp(2.4 - (pivot.position.y - 1) * 0.3, 0.8, 2.4));
  stage.monShadow.position.set(cur.root.position.x, 0.021, cur.root.position.z); stage.monShadow.scale.setScalar(cur.def.shadow * cur.root.scale.x);

  camera.position.copy(camBase);
  if (G.state === 'title' || G.state === 'gameover') { const a = Math.sin(realT * 0.25) * 0.22; camera.position.applyAxisAngle(UP, a); }
  if (G.shake > 0) { const s = G.shake * 0.35; camera.position.x += rand(-s, s); camera.position.y += rand(-s, s); }
  camera.lookAt(camTgt); camera.updateMatrixWorld();
  renderer.render(scene, camera);
  drawInk();
}

// ---------------------------------------------------------------- debug / test hooks
window.__game = {
  G, E, updater,
  countTris(which) { let n = 0; (which === 'hero' ? hero.root : mons[which].root).traverse(o => { if (o.isMesh) n += o.geometry.attributes.position.count / 3; }); return n; },
  monsters: () => mons.map(m => m.def.name), current: () => cur.def.name,
  monsterScreen() { camera.position.copy(camBase); camera.lookAt(camTgt); camera.updateMatrixWorld(); return toScreen(monCenter(new V3())); },
  setSpeed(v) { speedMul = v; }, setAI(on) { E.ai = on; }, enemyAttack() { return enemyCycle(G.bid); },
  startGame, goTitle, drawCalls: () => renderer.info.render.calls,
};

goTitle();
frame();
