// Verifies the polygon budgets of every character (hero 20000, each monster 30000).
import { buildHero } from '../src/hero.js';
import { buildMonster } from '../src/monster.js';
import { buildGolem } from '../src/golem.js';
import { buildReaper } from '../src/reaper.js';
const count = r => { let n = 0; r.traverse(o => { if (o.isMesh) n += o.geometry.attributes.position.count / 3; }); return n; };
const filler = r => { let n = 0; r.traverse(o => { if (o.isMesh && o.material.side === 2 && ['cape', 'wingL', 'wingR', 'cloth', 'robe'].includes(o.parent.name)) n += o.geometry.attributes.position.count / 3; }); return n; };
let ok = true;
for (const [name, build, want] of [['hero', buildHero, 20000], ['dragon', buildMonster, 30000], ['golem', buildGolem, 30000], ['reaper', buildReaper, 30000]]) {
  try { const c = build(); const n = count(c.root); console.log(name, n, 'filler sheet', filler(c.root)); if (n !== want) ok = false; }
  catch (e) { console.log(name, 'ERROR', e.message); ok = false; }
}
if (!ok) process.exit(1);
