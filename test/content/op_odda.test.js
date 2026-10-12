// 奥达 (char_4131_odda) — the 「巴别塔」 T1 shop chess chess_char_1_06_babel_a / _b: kits/ops/op-odda.js
// (S1 火花溅射's widened splash, S2 锻锤之力's ATK/DEF and 浮空 rider, 天赋 落锤's 30-damage counter).
// Numbers come from data/chess.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITS } from '../../server/sim/content/kits/index.js';
import { performAttack, effectiveProfile } from '../../server/sim/ai.js';

const C = 'char_4131_odda';
const A = 'chess_char_1_06_babel_a', B = 'chess_char_1_06_babel_b';
const CHESS = JSON.parse(readFileSync(new URL('../../data/chess.json', import.meta.url), 'utf8'));
const rec = (elite) => CHESS[elite ? B : A];
const approx = (a, b, label = '') => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${label}: ${a} != ${b}`);
const enemy = (key, opts = {}) => enemyRec({ key, hp: 1e8, atk: 0, speed: 0, ...opts });
const defs = { enemies: { dummy: enemy('dummy'), light: enemy('light', { mass: 2 }), heavy: enemy('heavy', { mass: 5 }) } };

function field({ elite = false, skill = 0, potential = 6, row = 10, col = 4, dir = 'RIGHT' } = {}) {
  const h = makeBattle({
    seed: 7, defs, timeLimit: 60, captureNoisy: true,
    units: [{ uid: 1, chessId: elite ? B : A, skillIndex: skill, elite, potential, row, col, dir }],
  });
  h.step();
  return { h, u: h.unit(1) };
}
const done = (h) => { checkInvariants(h.b); assert.deepEqual(h.b.errors, []); };
const start = (u) => u.skill.gainSp(999, 'init');
const hits = (h, u, e, filter = () => true) => h.hooksOf('damaged').filter((c) => c.source === u && c.target === e && filter(c));
const HAMMERFALL = 'talent:odda:hammerfall';
/** The 落锤 ATK ratio of a potential: the record's own talent chain (potential < 5 gets `potBelow`). */
const talentAtk = (elite, potential) => {
  const t = rec(elite).talents[0];
  return potential < (t.potMin ?? 0) ? t.potBelow.bb.atk : t.bb.atk;
};

test('奥达 is the authored T1 巴别塔 chess in both forms and both skills', () => {
  assert.equal(typeof KITS[A], 'function');
  for (const elite of [false, true]) for (const skill of [0, 1]) {
    const { h, u } = field({ elite, skill });
    const r = rec(elite);
    assert.equal(u.def.charId, C);
    assert.ok(!u.kit.generic);
    assert.equal(u.kit.skillSource, 'skills');
    assert.equal(u.skill.id, `skchr_odda_${skill + 1}`);
    assert.deepEqual([u.profile.dmgType, u.profile.canHitFly, u.s.blockCnt, u.s.bat, u.s.atk, u.s.def],
      ['phys', false, r.stats.blockCnt, r.stats.bat, r.stats.atk, r.stats.def]);
    assert.deepEqual(u.def.bonds, ['babelShip']);
    approx(u.profile.splashScale, r.trait.bb['attack@atk_scale_2'], 'trait splashScale');
    approx(u.profile.splashRadius, r.trait.bb['attack@ability_range_radius'], 'trait splashRadius');
    done(h);
  }
});

test('落锤 counts her own physical damage instances and then holds +atk for the battle', () => {
  for (const potential of [1, 6]) {
    for (const elite of [false, true]) {
      const { h, u } = field({ elite, potential });
      const r = rec(elite), need = r.talents[0].bb.count, atk = talentAtk(elite, potential);
      const e = h.spawn('dummy', { pos: [10, 6] });
      for (let i = 0; i < need - 1; i++) h.b.dealDamage(u, e, { amount: 10, type: 'phys' });
      assert.equal(u.findBuff(HAMMERFALL), null, `${need - 1} instances are not enough`);
      // a 元素伤害 instance and a 流失 are no 物理伤害 she dealt; another unit's damage is not hers either
      h.b.dealDamage(u, e, { amount: 10, type: 'elemental' });
      h.b.loseHp(e, 10, { source: u });
      h.b.dealDamage(e, u, { amount: 10, type: 'phys' });
      assert.equal(u.s.atk, r.stats.atk, 'still no buff');
      h.b.dealDamage(u, e, { amount: 10, type: 'phys' });
      assert.ok(u.findBuff(HAMMERFALL), `the ${need}th physical instance grants it`);
      approx(u.s.atk, r.stats.atk * (1 + atk), 'atkPct');
      assert.equal(u.findBuff(HAMMERFALL).mods.atkPct, atk);
      done(h);
    }
  }
});

test('火花溅射 widens the next attack to atk_scale with the 1.5 splash radius (PRTS 技能溅射半径1.5)', () => {
  for (const elite of [false, true]) {
    const { h, u } = field({ elite, skill: 0 });
    const r = rec(elite), bb = r.skills[0].bb;
    const main = h.spawn('dummy', { pos: [10, 5] });
    const near = h.spawn('dummy', { pos: [10, 6.4] });     // 1.4 tiles from the main target: inside 1.5, outside the trait's 1.0
    const far = h.spawn('dummy', { pos: [10, 6.6] });      // 1.6 tiles: outside both
    start(u);
    assert.ok(h.runUntil(() => u.skill.activations === 1, 5));
    h.run(0.6);
    const mainHit = hits(h, u, main, (c) => c.dmg.isAttack);
    assert.equal(mainHit.length, 1);
    approx(mainHit[0].amount, r.stats.atk * bb.atk_scale, 'atk_scale');
    const nearHit = hits(h, u, near, (c) => c.dmg.isSplash);
    assert.equal(nearHit.length, 1);
    approx(nearHit[0].amount, r.stats.atk * bb.atk_scale * r.trait.bb['attack@atk_scale_2'], 'splash scale');
    assert.equal(hits(h, u, far, () => true).length, 0);
    assert.equal(typeof bb.ability_range_radius, 'number');
    done(h);
  }
});

test('锻锤之力 holds atk/def, and 浮空s the light units its splash catches only', () => {
  for (const elite of [false, true]) {
    const { h, u } = field({ elite, skill: 1 });
    const r = rec(elite), bb = r.skills[1].bb;
    start(u);
    assert.equal(u.skill.activate('test'), true);
    approx(u.s.atk, r.stats.atk * (1 + bb.atk), 'atk');
    approx(u.s.def, r.stats.def * (1 + bb.def), 'def');
    const main = h.spawn('dummy', { pos: [10, 5] });
    const light = h.spawn('light', { pos: [10, 5.8] });   // 0.8 from the main target: inside the trait's 1.0 splash
    const heavy = h.spawn('heavy', { pos: [10, 5.8] });   // 重量 5: over attack@value
    performAttack(h.b, u, effectiveProfile(u), [main]);
    assert.equal(light.s.flags.levitate, true, 'a ≤ attack@value splash victim is 浮空');
    approx(light.findBuff('levitate')?.timeLeft ?? 0, bb['attack@levitate_duration'], 'levitate duration');
    assert.ok(!heavy.s.flags.levitate, 'heavier than attack@value');
    assert.ok(!main.s.flags.levitate, 'the main target is not "splashed onto"');
    assert.ok(hits(h, u, main, (c) => c.dmg.isAttack).length === 1);
    done(h);
  }
});
