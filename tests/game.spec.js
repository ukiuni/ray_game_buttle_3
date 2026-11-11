import { test, expect } from '@playwright/test';

const state = page => page.evaluate(() => window.__game.G.state);
const G = page => page.evaluate(() => { const g = window.__game.G, e = window.__game.E; return { state: g.state, stage: g.stage, wins: g.wins, heroHp: g.heroHp, monHp: g.monHp, monMax: g.monMax, heroMax: g.heroMax, busy: g.heroBusy, attacks: g.attacks, phase: e.phase, lines: e.lines, name: window.__game.current() }; });
const waitState = (page, s, timeout = 30000) => page.waitForFunction(x => window.__game.G.state === x, s, { timeout });
const heroReady = page => page.waitForFunction(() => window.__game.G.state === 'battle' && !window.__game.G.heroBusy, null, { timeout: 30000 });

async function open(page, query = '?fast=3') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./' + query);
  await page.waitForFunction(() => window.__game);
  return errors;
}
// ai=false keeps the enemy passive so a test can trigger its line explicitly
async function start(page, ai = true) {
  await page.evaluate(on => window.__game.setAI(on), ai);
  await page.click('#btnStart', { force: true });
  await waitState(page, 'battle');
}
// draw a zig-zag line across the enemy (or far away from it when miss=true)
async function draw(page, miss = false) {
  const { width: w, height: h } = page.viewportSize();
  const c = await page.evaluate(() => window.__game.monsterScreen());
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    pts.push(miss ? [w * 0.05 + t * w * 0.25, h * 0.12] : [c.x - w * 0.22 + t * w * 0.44, c.y + Math.sin(t * 10) * h * 0.1]);
  }
  await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
  for (const p of pts) await page.mouse.move(p[0], p[1]);
  await page.mouse.up();
}

test('title screen, fixed viewport, exact polygon budgets, PWA manifest', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#title')).toBeVisible();
  expect(await state(page)).toBe('title');
  // polygon budgets, counted from the real meshes: hero 20000, every enemy 30000
  expect(await page.evaluate(() => window.__game.countTris('hero'))).toBe(20000);
  const names = await page.evaluate(() => window.__game.monsters());
  expect(names.length).toBeGreaterThanOrEqual(3);
  expect(names.filter(n => !n.includes('竜')).length).toBeGreaterThanOrEqual(2); // enemies other than the dragon
  for (let i = 0; i < names.length; i++) expect(await page.evaluate(k => window.__game.countTris(k), i)).toBe(30000);
  expect(await page.evaluate(() => !!document.getElementById('gl').getContext('webgl2'))).toBe(true);
  await page.waitForFunction(() => window.__game.drawCalls() > 10);
  // fixed viewport
  const vp = await page.getAttribute('meta[name=viewport]', 'content');
  expect(vp).toContain('user-scalable=no'); expect(vp).toContain('maximum-scale=1');
  const fixed = await page.evaluate(() => ({ pos: getComputedStyle(document.body).position, ov: getComputedStyle(document.body).overflow, ta: getComputedStyle(document.body).touchAction, sw: document.documentElement.scrollWidth <= innerWidth, sh: document.documentElement.scrollHeight <= innerHeight }));
  expect(fixed).toEqual({ pos: 'fixed', ov: 'hidden', ta: 'none', sw: true, sh: true });
  const man = await (await page.request.get('./manifest.webmanifest')).json();
  expect(man.display).toBe('fullscreen'); expect(man.icons.length).toBeGreaterThanOrEqual(2);
  for (const i of man.icons) expect((await page.request.get('./' + i.src)).status()).toBe(200);
  expect(errors).toEqual([]);
});

test('no turns: the player can attack again and again without waiting for the enemy', async ({ page }) => {
  const errors = await open(page);
  await start(page, false);
  const g0 = await G(page);
  await draw(page); await page.waitForFunction(() => window.__game.G.heroBusy); await heroReady(page);
  const g1 = await G(page);
  expect(g1.monHp).toBeLessThan(g0.monHp); expect(g1.lines).toBe(0); // the enemy never acted in between
  await draw(page); await page.waitForFunction(() => window.__game.G.attacks === 2); await heroReady(page);
  const g2 = await G(page);
  expect(g2.monHp).toBeLessThan(g1.monHp); expect(g2.lines).toBe(0); expect(g2.heroHp).toBe(g0.heroHp);
  expect(errors).toEqual([]);
});

test('no turns: the enemy draws its own lines and attacks without any player input', async ({ page }) => {
  await open(page);
  await start(page, true);
  const g0 = await G(page);
  await page.waitForFunction(() => window.__game.E.lines >= 2 && window.__game.G.heroHp < window.__game.G.heroMax, null, { timeout: 40000 });
  const g = await G(page);
  expect(g.heroHp).toBeLessThan(g0.heroHp); expect(g.monHp).toBe(g0.monHp); expect(g.attacks).toBe(0);
});

test('one line at a time: the player cannot draw a second line until the attack has finished', async ({ page }) => {
  await open(page, '?fast=1');
  await start(page, false);
  await draw(page);
  await page.waitForFunction(() => window.__game.G.heroBusy);
  await draw(page); await draw(page);            // attempts while the first line is still being executed
  expect((await G(page)).attacks).toBe(1);
  await heroReady(page);
  expect((await G(page)).attacks).toBe(1);        // the ignored lines were not queued either
  await draw(page);                               // after the attack is over a new line is accepted
  await page.waitForFunction(() => window.__game.G.attacks === 2);
});

test('one line at a time: the enemy finishes draw -> dash -> return before its next line', async ({ page }) => {
  await open(page, '?fast=4');
  await start(page, true);
  await page.waitForFunction(() => window.__game.E.lines >= 3 || window.__game.G.state !== 'battle', null, { timeout: 60000 });
  const log = await page.evaluate(() => window.__game.E.log.slice());
  const cycles = log.join(',').split('idle').map(s => s.replace(/^,|,$/g, '')).filter(Boolean);
  expect(cycles.length).toBeGreaterThanOrEqual(2);
  for (const c of cycles.slice(0, -1)) expect(c).toBe('draw,dash,return');
  // while a line is active, asking for another one is refused
  await page.evaluate(() => window.__game.setAI(false));
  await page.waitForFunction(() => window.__game.E.phase === 'idle' || window.__game.G.state !== 'battle');
  if ((await state(page)) === 'battle') {
    const n = (await G(page)).lines;
    await page.evaluate(() => { window.__game.enemyAttack(); window.__game.enemyAttack(); window.__game.enemyAttack(); });
    expect((await G(page)).lines).toBe(n + 1);
  }
});

test('both sides act at the same time; being away on a line dodges the enemy', async ({ page }) => {
  await open(page, '?fast=1');
  await start(page, false);
  await page.evaluate(() => { window.__game.enemyAttack(); });
  await page.waitForFunction(() => window.__game.E.phase === 'draw');
  await draw(page);                                // the player draws while the enemy's line is active
  await page.waitForFunction(() => window.__game.G.heroBusy && ['draw', 'dash'].includes(window.__game.E.phase));
  const g = await G(page);
  expect(g.busy).toBe(true); expect(['draw', 'dash']).toContain(g.phase);
  await page.waitForFunction(() => window.__game.E.phase === 'idle' && !window.__game.G.heroBusy, null, { timeout: 30000 });
});

test('a line that misses deals no damage; a tap guards and reduces damage', async ({ page }) => {
  await open(page, '?fast=1');
  await start(page, false);
  await draw(page, true); await page.waitForFunction(() => window.__game.G.heroBusy); await heroReady(page);
  let g = await G(page); expect(g.monHp).toBe(g.monMax);
  // unguarded hit
  await page.evaluate(() => { window.__game.enemyAttack(); });
  await page.waitForFunction(() => window.__game.E.hitDone || window.__game.E.phase === 'return', null, { timeout: 20000 });
  g = await G(page); const full = g.heroMax - g.heroHp;
  expect(full).toBeGreaterThanOrEqual(150 * 0.9 - 1);
  await page.waitForFunction(() => window.__game.E.phase === 'idle');
  // guarded hit: tap once as the enemy closes in (a guard lasts 0.6s and then has a short cooldown)
  await page.evaluate(() => { window.__game.enemyAttack(); });
  await page.waitForFunction(() => window.__game.E.phase === 'dash' && window.__game.E.progress > 0.25);
  await page.mouse.click(100, 300);
  await page.waitForFunction(() => window.__game.E.hitDone || window.__game.E.phase !== 'dash', null, { timeout: 20000 });
  const g2 = await G(page); const guarded = g.heroHp - g2.heroHp;
  expect(guarded).toBeGreaterThan(0); expect(guarded).toBeLessThanOrEqual(Math.ceil(150 * 1.1 * 0.3));
  expect(g2.attacks).toBe(1);                      // taps are guards, not lines
});

test('winning starts the next battle automatically against a different kind of enemy; losing ends the run', async ({ page }) => {
  const errors = await open(page, '?fast=4');
  await start(page, false);
  const seen = [(await G(page)).name];
  for (let st = 1; st <= 3; st++) {
    const g = await G(page); expect(g.stage).toBe(st); expect(g.monHp).toBe(g.monMax); expect(g.heroHp).toBe(g.heroMax);
    await page.evaluate(() => { window.__game.G.monHp = 1; });
    await draw(page);
    await waitState(page, 'win');
    // no input from here on: the next game must start by itself
    await page.waitForFunction(s => window.__game.G.stage === s + 1 && window.__game.G.state === 'battle', st, { timeout: 40000 });
    seen.push((await G(page)).name);
  }
  expect(new Set(seen.slice(0, 3)).size).toBe(3);    // dragon, golem, reaper
  expect(seen[3]).toBe(seen[0]);                     // then the roster repeats, stronger
  const g4 = await G(page); expect(g4.wins).toBe(3);
  await expect(page.locator('#over')).toBeHidden();
  // now lose to the enemy's line
  await page.evaluate(() => { window.__game.G.heroHp = 1; window.__game.enemyAttack(); });
  await waitState(page, 'gameover', 40000);
  await expect(page.locator('#over')).toBeVisible();
  await expect(page.locator('#overWins')).toHaveText('3 連勝');
  expect(await page.evaluate(() => localStorage.getItem('lineslash.best'))).toBe('3');
  await page.click('#btnRetry', { force: true });
  await waitState(page, 'battle');
  const again = await G(page);
  expect(again.stage).toBe(1); expect(again.wins).toBe(0); expect(again.heroHp).toBe(again.heroMax); expect(again.name).toBe(seen[0]);
  expect(errors).toEqual([]);
});

test('PWA: works offline, and updates are applied only when no game is running', async ({ page, context, request }) => {
  await request.get('./__reset');
  await open(page, '?fast=4');
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
  const swVersion = () => page.evaluate(() => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = e => r(e.data); navigator.serviceWorker.controller.postMessage('VERSION', [c.port2]); }));
  const v1 = await swVersion();
  await context.setOffline(true);
  await page.reload(); await page.waitForFunction(() => window.__game);
  await context.setOffline(false);

  await start(page, false);
  await page.evaluate(() => { window.__marker = 'same-page'; });
  await request.get('./__bump');                       // a new version is deployed mid-game
  await page.evaluate(() => window.__game.updater.check());
  await page.waitForFunction(() => window.__game.updater.st.pending, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__marker)).toBe('same-page');   // not reloaded
  expect(await page.evaluate(() => window.__game.updater.st.applying)).toBe(false);
  expect(await swVersion()).toBe(v1);                  // old version still in control
  expect(await state(page)).toBe('battle');
  await draw(page); await page.waitForFunction(() => window.__game.G.heroBusy); await heroReady(page);  // the game keeps working
  expect(await page.evaluate(() => window.__marker)).toBe('same-page');
  // finish the game -> update is applied and the page reloads onto the new version
  await page.evaluate(() => { window.__game.G.heroHp = 1; window.__game.enemyAttack(); });
  await page.waitForFunction(() => window.__game && window.__marker === undefined && window.__game.G.state === 'title', null, { timeout: 60000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  expect(await swVersion()).toBe(v1 + '-b1');
  await request.get('./__reset');
});
