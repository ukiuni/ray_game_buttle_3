// Dev helper: captures screenshots of every enemy for visual review. Usage: node scripts/shots.mjs <outDir>
import { chromium } from '@playwright/test';
const out = process.argv[2] || '.', base = 'http://localhost:4173/';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu'] });
for (const [name, w, h] of [['portrait', 390, 844], ['landscape', 844, 390]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message)); page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.goto(base); await page.waitForFunction(() => window.__game);
  for (const st of [1, 2, 3]) {
    await page.evaluate(s => { window.__game.setAI(false); window.__game.startGame(s); }, st);
    await page.waitForFunction(() => window.__game.G.state === 'battle', null, { timeout: 15000 });
    await page.waitForTimeout(1300); await page.screenshot({ path: `${out}/${name}-s${st}-idle.png` });
    await page.evaluate(() => { window.__game.enemyAttack(); });
    await page.waitForFunction(() => window.__game.E.phase === 'dash' && window.__game.E.progress > 0.3);
    await page.screenshot({ path: `${out}/${name}-s${st}-dash.png` });
    await page.waitForFunction(() => window.__game.E.phase === 'idle');
    const c = await page.evaluate(() => window.__game.monsterScreen());
    const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([c.x - w * 0.25 + t * w * 0.5, c.y + Math.sin(t * 12) * h * 0.13]); }
    await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
    for (const p of pts) await page.mouse.move(p[0], p[1]);
    await page.mouse.up();
    await page.waitForFunction(() => !window.__game.G.heroBusy, null, { timeout: 15000 });
    console.log(name, st, await page.evaluate(() => JSON.stringify({ n: window.__game.current(), m: Math.round(window.__game.G.monHp), h: window.__game.G.heroHp, d: window.__game.G.lastDamage, calls: window.__game.drawCalls() })));
  }
  await ctx.close();
}
await browser.close();
