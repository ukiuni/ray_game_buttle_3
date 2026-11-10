import { test, expect } from '@playwright/test';

const state = page => page.evaluate(() => window.__game.G.state);
const G = page => page.evaluate(() => { const g = window.__game.G; return { state: g.state, stage: g.stage, wins: g.wins, heroHp: g.heroHp, monHp: g.monHp, monMax: g.monMax, heroMax: g.heroMax }; });
const waitState = (page, s, timeout = 30000) => page.waitForFunction(x => window.__game.G.state === x, s, { timeout });

async function open(page, query = '?fast=3') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./' + query);
  await page.waitForFunction(() => window.__game);
  return errors;
}
async function start(page) {
  await page.click('#btnStart', { force: true });
  await waitState(page, 'playerTurn');
}
// draw a zig-zag line across the monster (or far away from it when miss=true)
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
  // polygon budgets: counted from the real meshes in the scene
  expect(await page.evaluate(() => window.__game.countTris('hero'))).toBe(20000);
  expect(await page.evaluate(() => window.__game.countTris('monster'))).toBe(30000);
  // WebGL is really rendering
  expect(await page.evaluate(() => !!document.getElementById('gl').getContext('webgl2'))).toBe(true);
  await page.waitForFunction(() => window.__game.drawCalls() > 10);
  // fixed viewport
  const vp = await page.getAttribute('meta[name=viewport]', 'content');
  expect(vp).toContain('user-scalable=no'); expect(vp).toContain('maximum-scale=1');
  const fixed = await page.evaluate(() => ({ pos: getComputedStyle(document.body).position, ov: getComputedStyle(document.body).overflow, ta: getComputedStyle(document.body).touchAction, sw: document.documentElement.scrollWidth <= innerWidth, sh: document.documentElement.scrollHeight <= innerHeight }));
  expect(fixed).toEqual({ pos: 'fixed', ov: 'hidden', ta: 'none', sw: true, sh: true });
  // manifest + icons
  const man = await (await page.request.get('./manifest.webmanifest')).json();
  expect(man.display).toBe('fullscreen'); expect(man.icons.length).toBeGreaterThanOrEqual(2);
  for (const i of man.icons) expect((await page.request.get('./' + i.src)).status()).toBe(200);
  expect(errors).toEqual([]);
});

test('turns alternate: drawn line damages the monster, then the monster damages the hero', async ({ page }) => {
  const errors = await open(page);
  await start(page);
  const before = await G(page);
  expect(before.heroHp).toBe(before.heroMax); expect(before.monHp).toBe(before.monMax);
  await draw(page);
  await waitState(page, 'playerAttack');
  await waitState(page, 'monsterTurn');
  const mid = await G(page);
  expect(mid.monHp).toBeLessThan(before.monHp);   // the hero's line attack hit
  expect(mid.heroHp).toBe(before.heroHp);
  await waitState(page, 'playerTurn');
  const after = await G(page);
  expect(after.heroHp).toBeLessThan(before.heroHp); // the monster's attack hit
  expect(after.monHp).toBe(mid.monHp);
  expect(errors).toEqual([]);
});

test('a line that misses the monster deals no damage; a tiny line is rejected', async ({ page }) => {
  await open(page);
  await start(page);
  await page.mouse.move(50, 200); await page.mouse.down(); await page.mouse.move(53, 202); await page.mouse.up();
  expect(await state(page)).toBe('playerTurn');
  await draw(page, true);
  await waitState(page, 'monsterTurn');
  const g = await G(page); expect(g.monHp).toBe(g.monMax);
});

test('guarding after the warning reduces damage', async ({ page }) => {
  await open(page, '?fast=1');
  await start(page);
  await draw(page, true);
  await waitState(page, 'monsterTurn');
  await page.waitForFunction(() => window.__game.G.warnTime !== Infinity, null, { timeout: 20000 });
  await page.mouse.click(100, 300);
  await waitState(page, 'playerTurn');
  const g = await G(page);
  const lost = g.heroMax - g.heroHp;
  expect(lost).toBeGreaterThan(0); expect(lost).toBeLessThan(150 * 1.3 * 1.1 * 0.46); // guarded: at most 45% of the strongest attack
});

test('winning automatically starts the next, stronger battle; losing ends the run', async ({ page }) => {
  const errors = await open(page, '?fast=4');
  await start(page);
  const first = await G(page);
  await page.evaluate(() => { window.__game.G.monHp = 1; });
  await draw(page);
  await waitState(page, 'win');
  expect((await G(page)).monHp).toBe(0);
  // no input from here on: the next game must start by itself
  await page.waitForFunction(() => window.__game.G.stage === 2 && window.__game.G.state === 'playerTurn', null, { timeout: 40000 });
  const second = await G(page);
  expect(second.wins).toBe(1); expect(second.monMax).toBeGreaterThan(first.monMax);
  expect(second.monHp).toBe(second.monMax); expect(second.heroHp).toBe(second.heroMax);
  await expect(page.locator('#over')).toBeHidden();
  // now lose
  await page.evaluate(() => { window.__game.G.heroHp = 1; });
  await draw(page, true);
  await waitState(page, 'gameover', 40000);
  await expect(page.locator('#over')).toBeVisible();
  await expect(page.locator('#overWins')).toHaveText('1 連勝');
  expect(await page.evaluate(() => localStorage.getItem('lineslash.best'))).toBe('1');
  // retry starts over from stage 1
  await page.click('#btnRetry', { force: true });
  await waitState(page, 'playerTurn');
  const again = await G(page);
  expect(again.stage).toBe(1); expect(again.wins).toBe(0); expect(again.heroHp).toBe(again.heroMax);
  expect(errors).toEqual([]);
});

test('PWA: works offline, and updates are applied only when no game is running', async ({ page, context, request }) => {
  await request.get('./__reset');
  await open(page, '?fast=4');
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
  const swVersion = () => page.evaluate(() => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = e => r(e.data); navigator.serviceWorker.controller.postMessage('VERSION', [c.port2]); }));
  const v1 = await swVersion();
  // offline reload still boots the game from the cache
  await context.setOffline(true);
  await page.reload(); await page.waitForFunction(() => window.__game);
  await context.setOffline(false);

  await start(page);
  await page.evaluate(() => { window.__marker = 'same-page'; });
  await request.get('./__bump');                       // a new version is deployed mid-game
  await page.evaluate(() => window.__game.updater.check());
  await page.waitForFunction(() => window.__game.updater.st.pending, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__marker)).toBe('same-page');   // not reloaded
  expect(await page.evaluate(() => window.__game.updater.st.applying)).toBe(false);
  expect(await swVersion()).toBe(v1);                  // old version still in control
  expect(await state(page)).toBe('playerTurn');
  await draw(page);                                    // the game keeps working
  await waitState(page, 'playerTurn');
  expect(await page.evaluate(() => window.__marker)).toBe('same-page');
  // finish the game -> update is applied and the page reloads onto the new version
  await page.evaluate(() => { window.__game.G.heroHp = 1; });
  await draw(page, true);
  await page.waitForFunction(() => window.__game && window.__marker === undefined && window.__game.G.state === 'title', null, { timeout: 60000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  expect(await swVersion()).toBe(v1 + '-b1');
  await request.get('./__reset');
});
