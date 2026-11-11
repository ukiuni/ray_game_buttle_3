// Enemy roster. Every enemy is exactly 30000 triangles and shares one interface:
// build(), poses {IDLE, ROAR, WIND, DASH, DEAD}, idle(), hit zones, weak points.
import { buildMonster, MON_POSES as MP } from './monster.js';
import { GOLEM } from './golem.js';
import { REAPER } from './reaper.js';

const mirrorPose = p => { const o = {}; for (const k in p) { const v = p[k]; const k2 = k.endsWith('L') ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : k; o[k2] = [v[0], -v[1], -v[2]]; } return o; };

export const DRAGON = {
  name: '紅蓮竜ヴォルガ', build: buildMonster, center: 2.1, minY: 1.95, reach: 2.1, shadow: 6.5, glowColor: 0xff8a2a,
  glows: [{ j: 'body', o: [0, 0.3, 1.0], s: 2.4, c: 0xff8a2a, a: 0.55 }, { j: 'head', o: [0.27, 0.2, 0.45], s: 0.7, c: 0xffe060, a: 0.8 }, { j: 'head', o: [-0.27, 0.2, 0.45], s: 0.7, c: 0xffe060, a: 0.8 }],
  hits: [ // joint, local offset, radius, damage multiplier
    ['head', [0, 0.1, 0.45], 0.62, 1.6], ['neck2', [0, 0.2, 0.1], 0.45, 1.2], ['neck1', [0, 0.2, 0.1], 0.5, 1.1],
    ['body', [0, 0.85, 0.35], 0.95, 1], ['body', [0, 0.1, -0.05], 0.95, 1],
    ['shinL', [0, -0.2, 0], 0.5, 0.8], ['shinR', [0, -0.2, 0], 0.5, 0.8],
    ['tail2', [0, 0, -0.3], 0.5, 0.6], ['tail4', [0, 0, -0.3], 0.4, 0.6], ['tail6', [0, 0, -0.3], 0.35, 0.6],
    ['wingL', [1.6, 0.6, -0.6], 1.05, 0.5], ['wingR', [-1.6, 0.6, -0.6], 1.05, 0.5],
  ],
  weak: [
    { j: 'head', o: [0, 0.25, 0.55] }, { j: 'body', o: [0, 0.3, 0.95] }, { j: 'body', o: [0, 1.05, 0.85] },
    { j: 'wingL', o: [1.7, 0.8, -0.6] }, { j: 'tail3', o: [0, 0.1, -0.3] }, { j: 'neck2', o: [0, 0.2, 0.3] }, { j: 'legL', o: [0.2, -0.4, 0.4] },
  ],
  poses: { IDLE: MP.IDLE, ROAR: MP.ROAR, WIND: mirrorPose(MP.CLAW_UP), DASH: mirrorPose(MP.CLAW_HIT), DEAD: MP.DEAD },
  idle(m, t, f) {
    m.body[0] += Math.sin(t * 1.4) * 0.035 - f * 0.3; m.body[2] += Math.sin(t * 31) * f * 0.06;
    m.neck1[1] += Math.sin(t * 0.8) * 0.14; m.neck1[0] += Math.sin(t * 1.4 + 1) * 0.05 - f * 0.4; m.neck2[1] += Math.sin(t * 0.8 + 0.7) * 0.1;
    m.head[1] += Math.sin(t * 0.8 + 1.4) * 0.12; m.head[2] += Math.sin(t * 0.6) * 0.08; m.jaw[0] += 0.06 + Math.sin(t * 1.4) * 0.06 + f * 0.5;
    for (let i = 1; i <= 7; i++) m['tail' + i][1] += Math.sin(t * 1.2 - i * 0.6) * 0.16;
    const fl = Math.sin(t * 1.6) * 0.1; m.wingL[2] += fl + f * 0.3; m.wingR[2] -= fl + f * 0.3; m.wingL[1] += Math.sin(t * 1.6 + 1) * 0.06; m.wingR[1] -= Math.sin(t * 1.6 + 1) * 0.06;
    m.armL[0] += Math.sin(t * 1.4 + 2) * 0.06; m.armR[0] += Math.sin(t * 1.4 + 2.6) * 0.06; m.foreL[0] += Math.sin(t * 1.9) * 0.08; m.foreR[0] += Math.sin(t * 1.9 + 1) * 0.08;
  },
};

export const MONSTERS = [DRAGON, GOLEM, REAPER];
