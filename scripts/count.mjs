// Verifies the polygon budgets of both characters.
import { buildHero } from '../src/hero.js';
import { buildMonster } from '../src/monster.js';
const count = r => { let n = 0; r.traverse(o => { if (o.isMesh) n += o.geometry.attributes.position.count / 3; }); return n; };
const filler = (r, name) => { let n = 0; r.traverse(o => { if (o.isMesh && o.parent.name.startsWith(name) && o.material.side === 2) n += o.geometry.attributes.position.count / 3; }); return n; };
const h = buildHero(), m = buildMonster();
console.log('hero', count(h.root), 'cape', filler(h.root, 'cape'));
console.log('monster', count(m.root), 'membranes', filler(m.root, 'wing'));
