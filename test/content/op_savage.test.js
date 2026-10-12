// 暴行 (char_230_savage) — the 「巴别塔」 T1 shop chess chess_char_1_05_babel_a / _b: kits/ops/op-savage.js
// (S1 强力击·β型, S2 微差爆破 on the 技能范围 3-2, 天赋 山谷's two-高地-tiles check). Numbers come from data/chess.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITS } from '../../server/sim/content/kits/index.js';

const C = 'char_230_savage';
const A = 'chess_char_1_05_babel_a', B = 'chess_char_1_05_babel_b';
const CHESS = JSON.parse(readFileSync(new URL('../../data/chess.json', import.meta.url), 'utf8'));
const rec = (elite) => CHESS[elite ? B : A];
const approx = (a, b, label = '') => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${label}: ${a} != ${b}`);
const dummy = enemyRec({ key: 'dummy', hp: 1e8, atk: 0, speed: 0 });
const defs = { enemies: { dummy } };

function field({ elite = false, skill = 0, potential = 6, row = 10, col = 4, dir = 'RIGHT', enemies = [] } = {}) {
  const h = makeBattle({
    seed: 5, defs, timeLimit: 60, captureNoisy: true,
    units: [{ uid: 1, chessId: elite ? B : A, skillIndex: skill, elite, potential, row, col, dir }],
    enemies,
  });
  h.step();
  return { h, u: h.unit(1) };
}
const done = (h) => { checkInvariants(h.b); assert.deepEqual(h.b.errors, []); };
const start = (u) => u.skill.gainSp(999, 'init');
/** The damage instances of `u`'s own skill / attack on `e`. */
const hits = (h, u, e, filter = () => true) => h.hooksOf('damaged').filter((c) => c.source === u && c.target === e && filter(c));

test('暴行 is the authored T1 巴别塔 chess in both forms and both skills', () => {
  assert.equal(typeof KITS[A], 'function');
  for (const elite of [false, true]) for (const skill of [0, 1]) {
    const { h, u } = field({ elite, skill });
    const r = rec(elite);
    assert.equal(u.def.charId, C);
    assert.ok(!u.kit.generic);
    assert.equal(u.kit.skillSource, 'skills');
    assert.equal(u.skill.id, `skchr_savage_${skill + 1}`);
    assert.equal(u.skill.rule, skill === 0 ? 'DEFAULT' : 'SKILL_RANGE');
    assert.deepEqual([u.profile.dmgType, u.profile.canHitFly, u.s.blockCnt, u.s.bat, u.s.atk, u.s.def],
      ['phys', false, r.stats.blockCnt, r.stats.bat, r.stats.atk, r.stats.def]);
    assert.ok(u.def.bonds.includes('babelShip') && u.def.bonds.includes('deputShip'));
    done(h);
  }
});

test('强力击·β型 is the stock 强力击: the next attack at bb.atk_scale', () => {
  for (const elite of [false, true]) {
    const { h, u } = field({ elite, skill: 0 });
    const r = rec(elite), scale = r.skills[0].bb.atk_scale;
    const e = h.spawn('dummy', { pos: [10, 5] });
    start(u);
    assert.ok(h.runUntil(() => u.skill.activations === 1, 5), 'the AUTO skill fires before the attack');
    h.run(0.6);
    const attack = hits(h, u, e, (c) => c.dmg.isAttack);
    assert.equal(attack.length, 1);
    approx(attack[0].amount, r.stats.atk * scale, 'atk_scale');
    assert.equal(u.skill.active, false);
    done(h);
  }
});

test('微差爆破 hits at most max_target enemies on its 3-2 grid, never her own attack range', () => {
  for (const elite of [false, true]) {
    const { h, u } = field({ elite, skill: 1 });
    const r = rec(elite), bb = r.skills[1].bb;
    const es = [h.spawn('dummy', { pos: [10, 5] }), h.spawn('dummy', { pos: [10, 5] }),
      h.spawn('dummy', { pos: [10, 6] }), h.spawn('dummy', { pos: [10, 7] }), h.spawn('dummy', { pos: [10, 7] })];
    const outside = h.spawn('dummy', { pos: [10, 8] });   // four tiles in front: outside the 技能范围
    const behind = h.spawn('dummy', { pos: [10, 2] });    // behind her: outside it too
    assert.ok(es.every((e) => e.blockedBy !== u), 'no contact: the blocked-first rule cannot pick one of them');
    start(u);
    assert.ok(h.runUntil(() => u.skill.activations === 1, 5));
    h.step();
    assert.deepEqual(es.map((e) => hits(h, u, e, (c) => c.dmg.isSkill).length), [1, 1, 1, 1, 0], 'exactly the first four');
    assert.equal(hits(h, u, outside, () => true).length, 0);
    assert.equal(hits(h, u, behind, () => true).length, 0);
    for (const e of es.slice(0, 4)) {
      const c = hits(h, u, e, (c) => c.dmg.isSkill)[0];
      approx(c.amount, r.stats.atk * bb.atk_scale, 'atk_scale');
      assert.ok(!c.dmg.isAttack, 'the skill deals its own damage, not a normal attack');
    }
    assert.equal(u.rangeKeySet.has(10 * 21 + 6), false, 'her own attack range stays 1-1 (the 3-2 grid is a 技能范围)');
    done(h);
  }
});

test('微差爆破 prefers the enemy she blocks over an earlier-spawned one (PRTS 此技能的索敌不受仇恨值影响)', () => {
  const { h, u } = field({ skill: 1 });
  const far = [h.spawn('dummy', { pos: [10, 5] }), h.spawn('dummy', { pos: [10, 5] }),
    h.spawn('dummy', { pos: [10, 6] }), h.spawn('dummy', { pos: [10, 7] })];
  // in contact (0.6 tiles) and spawned last: only the blocked-first rule takes it, dropping the latest `far` one
  const blocked = h.spawn('dummy', { pos: [10, 4.6] });
  h.step();
  assert.equal(blocked.blockedBy, u, 'the engine blocks it by contact');
  start(u);
  assert.ok(h.runUntil(() => u.skill.activations === 1, 5));
  h.step();
  assert.equal(hits(h, u, blocked, (c) => c.dmg.isSkill).length, 1);
  assert.deepEqual(far.map((e) => hits(h, u, e, (c) => c.dmg.isSkill).length), [1, 1, 1, 0]);
  done(h);
});

test('微差爆破 opens on an enemy inside its 技能范围 only', () => {
  const { h, u } = field({ skill: 1 });
  start(u);
  h.spawn('dummy', { pos: [10, 8] });
  h.run(2);
  assert.equal(u.skill.activations, 0, 'four tiles in front are outside the 3-2 grid');
  h.spawn('dummy', { pos: [10, 7] });
  assert.ok(h.runUntil(() => u.skill.activations === 1, 3));
  done(h);
});

test('山谷 gives +atk / +def where two of the four tiles next to her are 高地 (her own tile never counts)', () => {
  // the flat stage: (12,3) has the 高地 tiles (12,2)='h' and (13,3)='X' next to it, (10,3) has only (10,2)='h'
  for (const elite of [false, true]) {
    const r = rec(elite);
    const high = field({ elite, row: 12, col: 3 });
    approx(high.u.s.atk, r.stats.atk * 1.1, 'atk');
    approx(high.u.s.def, r.stats.def * 1.1, 'def');
    assert.equal(high.u.findBuff('talent:savage:valley')?.mods?.atkPct, r.talents[0].bb.atk);
    done(high.h);

    const low = field({ elite, row: 10, col: 3 });
    assert.equal(low.u.findBuff('talent:savage:valley'), null);
    approx(low.u.s.atk, r.stats.atk, 'atk');
    approx(low.u.s.def, r.stats.def, 'def');
    done(low.h);
  }
});
