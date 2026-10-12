// 阿米娅·医疗 (char_1037_amiya3) — the 「巴别塔」 T2 shop chess chess_char_2_05_babel_a / _b: kits/ops/op-amiya3.js
// (S1 哀恸共情's ASPD and the 十二格 extra heal before the 咒愈师 trait, S2 慈悲愿景's burst / debuff / 真实 damage on two
// targets and its one cast per battle, 天赋 诚挚期许's max-HP aura and 生命回复速度). Numbers come from data/chess.json.
// Her 特质 (garrison_164_a/_b, another content module: content/garrisons) no longer touches her ATK / max HP — since the
// maintainer's revision of 2026-10-12 it is the 「承伤 + 治疗」axis' heal counter (每累计实际治疗 1200 点 → 【巴别塔】
// 【奥术】各 +2 / +4, docs/research/15-babel-bond.md §2), so the values a battle holds before a skill are the raw record
// stats plus whatever other content adds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITS } from '../../server/sim/content/kits/index.js';

const C = 'char_1037_amiya3';
const A = 'chess_char_2_05_babel_a', B = 'chess_char_2_05_babel_b';
const ALLY = 'chess_char_1_01_a';
const CHESS = JSON.parse(readFileSync(new URL('../../data/chess.json', import.meta.url), 'utf8'));
const rec = (elite) => CHESS[elite ? B : A];
const approx = (a, b, label = '') => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${label}: ${a} != ${b}`);
const dummy = enemyRec({ key: 'dummy', hp: 1e8, atk: 0, speed: 0 });
const walker = enemyRec({ key: 'walker', hp: 1e8, atk: 0, speed: 1 });
const defs = { enemies: { dummy, walker } };
const REGEN = (u) => `talent:amiya3:regen#${u.id}`;
const AURA = (u) => `talent:amiya3:aura#${u.id}`;
const S2_DEBUFF = 'skill:amiya3:s2debuff';

function field({ elite = false, skill = 0, potential = 6, row = 10, col = 5, dir = 'RIGHT', allies = [] } = {}) {
  const h = makeBattle({
    seed: 11, defs, timeLimit: 90, captureNoisy: true,
    units: [{ uid: 1, chessId: elite ? B : A, skillIndex: skill, elite, potential, row, col, dir },
      ...allies.map((a, i) => ({ uid: 2 + i, chessId: ALLY, row: a[0], col: a[1] }))],
  });
  h.step();
  return { h, u: h.unit(1), mate: h.unit(2) };
}
const done = (h) => { checkInvariants(h.b); assert.deepEqual(h.b.errors, []); };
const start = (u) => u.skill.gainSp(999, 'init');
const dmgOn = (h, u, e, filter = () => true) => h.hooksOf('damaged').filter((c) => c.source === u && c.target === e && filter(c));
/** Her own heals of the battle (never a target's own 生命回复速度 tick, whose source is that unit). */
const healsBy = (h, u) => h.hooksOf('heal').filter((c) => c.source === u);
const s1Heals = (h, u) => healsBy(h, u).filter((c) => c.opts?.tags?.includes('amiya3:s1'));

test('阿米娅·医疗 is the authored T2 巴别塔 chess in both forms and both skills', () => {
  assert.equal(typeof KITS[A], 'function');
  for (const elite of [false, true]) for (const skill of [0, 1]) {
    const { h, u } = field({ elite, skill });
    const r = rec(elite);
    assert.equal(u.def.charId, C);
    assert.ok(!u.kit.generic);
    assert.equal(u.kit.skillSource, 'skills');
    assert.equal(u.skill.id, `skchr_amiya3_${skill + 1}`);
    assert.deepEqual([u.profile.dmgType, u.profile.canHitFly, u.s.blockCnt, u.s.bat, u.base.atk, u.base.def, u.base.res],
      ['arts', true, r.stats.blockCnt, r.stats.bat, r.stats.atk, r.stats.def, r.stats.res]);
    approx(u.profile.healRatio, r.trait.bb.scale, '咒愈师 heal ratio');
    assert.ok(u.def.bonds.includes('babelShip') && u.def.bonds.includes('arcaneShip'));
    assert.equal(u.def.talents.length, 1, '诚挚期许 is in the rebuilt record');
    done(h);
  }
});

test('诚挚期许 raises every ally’s max HP while she is on the field, and the recovery is a 生命回复速度 that ignores 禁疗', () => {
  const { h, u, mate } = field({ elite: true, allies: [[10, 6]] });
  const bb = rec(true).talents[0].bb, mateHp = CHESS[ALLY].stats.maxHp;
  approx(mate.s.maxHp, mateHp * (1 + bb.max_hp), 'ally max HP');
  assert.equal(mate.s.hpRegen, 0, 'no 生命回复速度 while no skill runs');
  assert.equal(mate.findBuff(REGEN(u)), null);
  // 所有友方单位 includes her: dropping the aura takes exactly its hpPct back (her 特质's own +20 % / +40 % is another
  // module's, content/garrisons — never asserted here)
  assert.ok(u.findBuff(AURA(u)));
  const withAura = u.s.maxHp;
  h.b.removeBuff(u, AURA(u));
  approx(u.s.maxHp, withAura / (1 + bb.max_hp), 'her own aura');
  // the ally holds 禁疗 + 无法被友方治疗: the aura is no 治疗, so both still apply (PRTS 天赋备注)
  h.b.addBuff(mate, { key: 'test:healFree', flags: { noHeal: true, healFree: true } });
  h.step();
  assert.ok(mate.findBuff(AURA(u)), 'the max-HP aura reaches a 禁疗 ally');
  start(u);
  assert.equal(u.skill.activate('test'), true);
  approx(mate.s.hpRegen, bb.hp_recovery_per_sec_by_max_hp_ratio * mate.s.maxHp, '生命回复速度 (百分比)');
  mate.hp = 10;
  h.run(1);
  assert.ok(mate.hp > 10 + 0.9 * bb.hp_recovery_per_sec_by_max_hp_ratio * mate.s.maxHp, 'and it really ticks');
  u.skill.stop();
  h.step();
  assert.equal(mate.findBuff(REGEN(u)), null, 'the recovery ends with the skill');
  assert.ok(mate.findBuff(AURA(u)), 'the max-HP aura stays');
  done(h);
});

test('哀恸共情 holds ASPD and heals the twelve tiles around her on every attack, before the 咒愈师 trait', () => {
  for (const elite of [false, true]) {
    // (10,4), (10,6) and (9,5) are three of the twelve tiles around (10,5); (10,8) is inside her range but outside them,
    // (12,6) outside both
    const { h, u } = field({ elite, skill: 0, allies: [[10, 4], [10, 6], [9, 5], [10, 8], [12, 6]] });
    const r = rec(elite), bb = r.skills[0].bb;
    const inside = [h.unit(2), h.unit(3), h.unit(4)], inRange = h.unit(5), outside = h.unit(6);
    const e = h.spawn('dummy', { pos: [9, 6] });   // inside the x-1 技能范围 and her 3-3 range
    start(u);
    assert.ok(h.runUntil(() => u.skill.active, 5), 'the SKILL_RANGE trigger opens it');
    approx(u.s.aspd, r.stats.aspd + bb.attack_speed, 'aspd');
    approx(u.s.interval, (r.stats.bat * 100) / u.s.aspd, 'interval');
    for (const a of [...inside, inRange, outside]) a.hp = 1;
    assert.ok(h.runUntil(() => u.stats.attacks >= 2, 8), 'two attacks');
    h.run(0.5);   // let the second projectile land
    const heals = s1Heals(h, u);
    assert.deepEqual(heals.map((c) => c.target.id).sort(), [...inside, ...inside].map((a) => a.id).sort(), 'three allies, twice');
    for (const c of heals) approx(c.amount, u.s.atk * bb.heal_scale, 'heal_scale × ATK');
    assert.equal(heals.some((c) => c.target === inRange), false, 'her own 3-3 range is not the 十二格 ring');
    assert.equal(heals.some((c) => c.target === outside), false, 'nor is the tile past it');
    // 于普通攻击命中计算伤害时（先于特性）: the extra heals of one attack precede the 咒愈师 trait's heal of its damage
    const order = healsBy(h, u).map((c) => (c.opts?.tags?.includes('amiya3:s1') ? 's1' : 'trait'));
    assert.deepEqual(order.slice(0, 4), ['s1', 's1', 's1', 'trait']);
    assert.ok(healsBy(h, u).some((c) => c.opts?.tags?.includes('incantation')), 'the trait heals 50 % of the damage dealt');
    u.skill.stop();
    h.step();
    assert.equal(s1Heals(h, u).length, heals.length, 'the hook is gone with the skill');
    assert.ok(e.alive);
    done(h);
  }
});

test('慈悲愿景 bursts every enemy in range, debuffs them and takes its ATK per target hit', () => {
  for (const elite of [false, true]) {
    const { h, u } = field({ elite, skill: 1 });
    const r = rec(elite), bb = r.skills[1].bb;
    const es = [h.spawn('dummy', { pos: [10, 6] }), h.spawn('dummy', { pos: [10, 7] }), h.spawn('walker', { pos: [10, 8] })];
    h.step();   // the enemy tile index is built per tick
    const before = u.s.atk;
    start(u);
    assert.equal(u.skill.activate('test'), true);
    assert.equal(u.skill.activations, 1);
    approx(u.skill.timeLeft, r.skills[1].duration, 'duration');
    approx(u.s.atk, before * (1 + bb.atk * es.length), 'atk per enemy hit');
    for (const e of es) {
      const burst = dmgOn(h, u, e, (c) => c.dmg.isSkill);
      assert.equal(burst.length, 1);
      approx(burst[0].amount, before * (1 + bb.atk * es.length) * bb.atk_scale, 'burst damage on the raised ATK');
      assert.equal(burst[0].type, 'arts');
      const debuff = e.findBuff(S2_DEBUFF);
      assert.ok(debuff, '攻速/移速 −60 %');
      approx(debuff.mods.aspd, bb['amiya3_s_2[debuff].attack_speed'], 'attack_speed');
      approx(debuff.mods.moveMul, 1 + bb['amiya3_s_2[debuff].move_speed'], 'move_speed');
      approx(debuff.timeLeft, bb['amiya3_s_2[debuff].duration'], 'debuff duration');
      approx(e.s.aspd, 100 + bb['amiya3_s_2[debuff].attack_speed'], 'the target really loses ASPD');
      approx(e.s.moveSpeed, e.base.moveSpeed * (1 + bb['amiya3_s_2[debuff].move_speed']), 'and movement speed');
    }
    assert.equal(s1Heals(h, u).length, 0);
    done(h);
  }
});

test('慈悲愿景 caps the ATK gain at max_stack_cnt', () => {
  const { h, u } = field({ skill: 1 });
  const bb = rec(false).skills[1].bb;
  for (let i = 0; i < bb.max_stack_cnt + 2; i++) h.spawn('dummy', { pos: [10, 6 + (i % 3)] });
  h.step();
  const before = u.s.atk;
  start(u);
  assert.equal(u.skill.activate('test'), true);
  approx(u.s.atk, before * (1 + bb.atk * bb.max_stack_cnt), 'capped');
  done(h);
});

test('慈悲愿景 turns her attacks 真实 and two-targeted, and the whole battle casts it once', () => {
  const { h, u } = field({ skill: 1 });
  for (const pos of [[10, 6], [10, 7], [10, 8]]) h.spawn('dummy', { pos });
  h.step();
  start(u);
  assert.equal(u.skill.activate('test'), true);
  h.run(4);
  const attacks = h.hooksOf('damaged').filter((c) => c.source === u && c.dmg.isAttack && c.dmg.isSkill);
  assert.ok(attacks.length >= 4, 'at least two attacks of two targets');
  const groups = new Map();
  for (const c of attacks) {
    assert.equal(c.type, 'true', '伤害类型变为真实');
    const g = groups.get(c.dmg.attackId) ?? new Set();
    g.add(c.target.id);
    groups.set(c.dmg.attackId, g);
  }
  assert.ok([...groups.values()].every((g) => g.size === 2), '可以同时攻击2名敌人');
  // 整场战斗中该技能只能释放一次: neither the recharge nor a redeployment brings it back
  u.skill.stop();
  u.skill.gainSp(999, 'init');
  h.run(3);
  assert.equal(u.skill.activations, 1, 'no second cast');
  h.b.retreat(u, { reason: 'retreat' });
  assert.equal(h.b.redeploy(u, { free: true }), true);
  h.step();
  u.skill.gainSp(999, 'init');
  h.run(3);
  assert.equal(u.skill.activations, 1, 'nor after a redeployment');
  assert.equal(u.skill.active, false);
  done(h);
});
