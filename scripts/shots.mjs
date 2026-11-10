// Dev helper: captures screenshots of the running build for visual review.
import { chromium } from '@playwright/test';
const out = process.argv[2] || '.', base = 'http://localhost:4173/';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu'] });
for (const [name, w, h] of [['portrait', 390, 844], ['landscape', 844, 390], ['ipad', 1024, 768]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message)); page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.goto(base); await page.waitForFunction(() => window.__game);
  await page.waitForTimeout(800); await page.screenshot({ path: `${out}/${name}-title.png` });
  await page.click('#btnStart', { force: true });
  await page.waitForFunction(() => window.__game.G.state === 'playerTurn', null, { timeout: 15000 });
  await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/${name}-turn.png` });
  const c = await page.evaluate(() => window.__game.monsterScreen());
  const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([c.x - w * 0.3 + t * w * 0.6, c.y + Math.sin(t * 12) * h * 0.14]); }
  await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
  for (const p of pts) await page.mouse.move(p[0], p[1]);
  await page.screenshot({ path: `${out}/${name}-draw.png` });
  await page.mouse.up();
  await page.waitForTimeout(750); await page.screenshot({ path: `${out}/${name}-attack.png` });
  await page.waitForFunction(() => window.__game.G.state === 'monsterTurn', null, { timeout: 15000 });
  await page.waitForTimeout(1900); await page.screenshot({ path: `${out}/${name}-enemy.png` });
  console.log(name, await page.evaluate(() => JSON.stringify({ s: window.__game.G.state, m: window.__game.G.monHp, h: window.__game.G.heroHp, d: window.__game.G.lastDamage, calls: window.__game.drawCalls() })));
  await ctx.close();
}
await browser.close();
