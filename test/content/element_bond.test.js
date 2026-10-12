// test/content/element_bond.test.js — the 「元素」add-on bond (elementShip), a 自研盟约 of the maintainer:
// server/sim/content/bonds/addon/element.js, its data in tools/content/custom.mjs / data/bonds.json
// (docs/research/17-element-bond.md).
//
// Covered here, one test per clause:
//   一档  member element damage ×(1 + element_damage_base + element_damage_per_stack·min(L, element_damage_cap_layers))
//         — +10 % at 0 layers, the 150-layer cap at +55 %, and 151 / 300 layers no higher;
//   二档  凋亡 (burst damage ×(base + per·L) + 攻击力额外最终 ×0.7), 灼燃 (×… + 法抗额外 −20),
//         神经 (×… + 冷却期每秒元素持续伤害), 侵蚀 (DEF 额外永久 −120 + 0.3 s 内 10 跳物理持续伤害);
//   二档  the 200-layer clamp (L = 201 / 400 give the cap's numbers, never more);
//   off   an inactive bond and a NON-member dealing the same damage do nothing;
//   data  the seven members, the [2, 3] thresholds, the mode whitelist and 珊比's promotion (a data-table guard).
//
// Every number is read back from data/bonds.json (`bondBb()`), never repeated in the assertions.
// Run: node test/content/element_bond.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, chessRec, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { bondBb, elementDamageMul, tier2Value, ID, KEY as ELEMENT_KEY } from '../../server/sim/content/bonds/addon/element.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../../data/${f}.json`, import.meta.url), 'utf8'));
const CHESS = load('chess');
const BONDS = load('bonds');
const GARRISONS = load('garrisons');
const CONFIG = load('config');
const BACKUPS = load('backups');
const BB = bondBb();

const close = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${msg ?? ''}: expected ${b}, got ${a}`);
const approx = (a, b, msg, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${msg ?? ''}: expected ${b}, got ${a}`);
const bondState = (tier, layers = 0) => ({ count: tier >= 2 ? 3 : 2, active: tier > 0, tier, layers });

const ENEMY = 'enemy_elem_dummy';
// A still enemy with a non-zero DEF / RES: the 侵蚀 DEF cut and the 灼燃 RES cut are clamped at 0, so a base of 0
// would hide both (units.js `res = clamp((base + Σflat) × Πmul, 0, 100)`).
const DEFS = { enemies: { [ENEMY]: enemyRec({ key: ENEMY, hp: 1e9, speed: 0, atk: 0, def: 500, res: 50 }) } };

/**
 * A battle with `members` 【元素】 operators on the board (`0` = one NON-member, the negative control), the bond at
 * `tier` / `layers`, and one still enemy far from every operator — nothing auto-attacks, so every gauge fill below is
 * the test's own.
 */
function field({ members = 2, tier = 1, layers = 0, seed = 11 } = {}) {
  const defs = { chess: {}, enemies: DEFS.enemies };
  const units = [];
  for (let i = 0; i < Math.max(1, members); i++) {
    const id = `e_m${i}`;
    defs.chess[id] = chessRec({ id, bonds: members === 0 ? [] : [ID.element], skill: null, stats: { atk: 0 } });
    units.push({ chessId: id, row: 10, col: 3 + i });
  }
  const h = makeBattle({
    defs, units, timeLimit: 900, autoFinish: false, seed, captureNoisy: true,
    flags: { dpPerSec: 0, dpMax: 999, layerGainsEnabled: true },
    hooks: ['damaged', 'hit', 'elementBurst', 'elementHit'],
    enemies: [{ key: ENEMY, time: 0, route: 1, pos: [10, 18] }],
    bonds: members === 0 ? {} : { [ID.element]: bondState(tier, layers) },
  });
  h.step();
  return h;
}
const enemyOf = (h) => h.enemy(ENEMY);
const memberOf = (h) => h.unit('e_m0');

/** One 元素损伤 instance of `amount` from `from` (the `element` damage type routes to damage.js applyElement). */
function elementHit(h, amount, element = 'apoptosis', from = null) {
  const src = from ?? memberOf(h);
  return h.b.dealDamage(src, enemyOf(h), { amount, type: 'element', element });
}
/** The `elementHit` hook contexts of the last fill (the module's multiplier is `dmg.mul` before the gauge is filled). */
function lastHit(h) {
  const list = h.hooksOf('elementHit');
  return list[list.length - 1];
}
const hits = (h, tag) => h.hooksOf('damaged').filter((c) => c.dmg?.tags?.includes(tag));
/** The burst's OWN 元素伤害 instance of `el` (damage.js resolveBurst's `hit(…, 'elemental')`), as the `hit` hook saw it. */
const burstInstance = (h, el) => h.hooksOf('hit').filter((c) => c.dmg?.type === 'elemental' && c.dmg.element === el);

/** Seed the enemy's gauge one point short of bursting, then fill it (the burst's own resolution is the engine's). */
function burstOn(h, element, { from = null } = {}) {
  const e = enemyOf(h);
  e.elem[element] = e.gaugeMax - 1;
  elementHit(h, 1e6, element, from);
  return e;
}

// ---------------------------------------------------------------------------------------------------------------------
// 一档

test('一档: member element damage ×(1 + base + per·L); 0 layers +10 %, 150 layers +55 %, inactive / non-member → nothing', () => {
  close(BB.element_damage_base, 0.10, 'element_damage_base');
  close(BB.element_damage_per_stack, 0.003, 'element_damage_per_stack');
  assert.equal(BB.element_damage_cap_layers, 150);
  close(elementDamageMul(BB, 0), 1.10, '0 layers');
  close(elementDamageMul(BB, 100), 1.40, '100 layers');
  close(elementDamageMul(BB, 150), 1.55, '150 layers');

  for (const [L, want] of [[0, 1.10], [100, 1.40], [150, 1.55]]) {
    const h = field({ members: 2, tier: 1, layers: L });
    approx(elementHit(h, 1000), 1000 * elementDamageMul(BB, L), `${L} layers: the amount actually added`);
    approx(lastHit(h).dmg.mul, elementDamageMul(BB, L), `${L} layers: the hook's multiplier`);
    checkInvariants(h.b);
  }
  // inactive: the bond is not active, so no member clause runs
  const off = field({ members: 2, tier: 0, layers: 500 });
  approx(elementHit(off, 1000), 1000, 'inactive bond: the raw amount');
  approx(lastHit(off).dmg.mul, 1, 'inactive bond: no multiplier');
  checkInvariants(off.b);
  // a NON-member (members: 0 → no elementShip bond at all)
  const none = field({ members: 0, tier: 1, layers: 500 });
  approx(elementHit(none, 1000), 1000, 'non-member: the raw amount');
  approx(lastHit(none).dmg.mul, 1, 'non-member: no multiplier');
  checkInvariants(none.b);
});

test('一档: the 150-layer clamp — 150 / 151 / 300 layers give the same +55 %', () => {
  const cap = elementDamageMul(BB, 150);
  close(cap, 1.55, 'the cap');
  const seen = [];
  for (const L of [150, 151, 300]) {
    const h = field({ members: 2, tier: 1, layers: L });
    seen.push(lastHitAfter(h));
    checkInvariants(h.b);
  }
  assert.deepEqual(seen, [seen[0], seen[0], seen[0]], '151 / 300 layers do not grow further');
  // and the closed form agrees with the clamp
  for (const L of [151, 300, 1000]) approx(elementDamageMul(BB, L), cap, `${L} layers clamp`);
  function lastHitAfter(h) {
    elementHit(h, 1000);
    return lastHit(h).dmg.mul;
  }
});

test('一档: the multiplier follows the live layer value (0 vs 100 layers in the battle state)', () => {
  const seen = [];
  for (const L of [0, 100]) {
    const h = field({ members: 2, tier: 1, layers: L });
    elementHit(h, 1000);
    approx(lastHit(h).dmg.mul, elementDamageMul(BB, L), `${L} layers`);
    seen.push(lastHit(h).dmg.mul);
    checkInvariants(h.b);
  }
  assert.notEqual(seen[0], seen[1], 'the two battles really differ');
  // and the value is the data's closed form, not a per-battle cache
  close(elementDamageMul(BB, 0), 1 + BB.element_damage_base, '0 layers');
  close(elementDamageMul(BB, 100), 1 + BB.element_damage_base + 100 * BB.element_damage_per_stack, '100 layers');
});

// ---------------------------------------------------------------------------------------------------------------------
// 二档 — 凋亡

test('二档 凋亡: the burst damage ×(1.10 + per·L) and the target 攻击力额外最终 ×0.70; 200-layer clamp', () => {
  close(BB.apoptosis_burst_base, 1.10);
  close(BB.apoptosis_atk_final_mul, 0.70);
  close(tier2Value(BB, 'apoptosis_burst_base', 'apoptosis_burst_per_stack', 200), 3.25, '325 % at 200 layers');
  assert.equal(BB.tier2_cap_layers, 200);

  for (const L of [0, 100, 200, 201, 400]) {
    const h = field({ members: 3, tier: 2, layers: L });
    const e = enemyOf(h);
    const atk0 = e.s.atk;
    burstOn(h, 'apoptosis');
    h.step();
    // 攻击力额外最终降低至 ×apoptosis_atk_final_mul: a second, multiplicative `atkMul` buff (the engine's own 凋亡
    // weaken keeps its own 50 % → 0 % profile on the cooldown buff, so this one is the 「额外最终」 layer).
    approx(e.s.atk, atk0 * BB.apoptosis_atk_final_mul, `${L} layers: final ATK ×0.7`);
    assert.equal(e.findBuff(ELEMENT_KEY.atkDown)?.mods.atkMul, BB.apoptosis_atk_final_mul, `${L} layers: the ATK buff`);
    // the burst's own 元素伤害 tick is scaled by the burst multiplier (the engine's 凋亡 cooldown deals one 800 元素伤害
    // instance per second, and the module scales each of them on the `hit` hook — the pipeline applies `dmg.mul` there
    // and emits `damaged` with the finished number)
    h.run(1.2);
    const tick = hits(h, 'apoptosis');
    assert.ok(tick.length >= 1, `${L} layers: at least one burst tick`);
    const want = tier2Value(BB, 'apoptosis_burst_base', 'apoptosis_burst_per_stack', Math.min(L, BB.tier2_cap_layers));
    approx(tick[0].amount, 800 * want, `${L} layers: the tick ${tick[0].amount}`);   // constants.js ELEMENT.apoptosis.enemy.elemDps
    checkInvariants(h.b);
  }
  // tier 1 (2 members): no 二档 clause at all
  const one = field({ members: 2, tier: 1, layers: 200 });
  const e1 = enemyOf(one);
  const atk1 = e1.s.atk;
  burstOn(one, 'apoptosis');
  one.step();
  approx(e1.s.atk, atk1, 'tier 1: the target ATK is untouched');
  assert.equal(e1.findBuff(ELEMENT_KEY.atkDown), null, 'tier 1: no ATK buff');
  checkInvariants(one.b);
});

// ---------------------------------------------------------------------------------------------------------------------
// 二档 — 灼燃

test('二档 灼燃: the burst damage ×(1.95 + per·L) and the target 法术抗性额外 −20; 200-layer clamp', () => {
  close(BB.burn_burst_base, 1.95);
  assert.equal(BB.burn_res_down, 20);
  close(tier2Value(BB, 'burn_burst_base', 'burn_burst_per_stack', 200), 4.94, '494 % at 200 layers');

  for (const L of [0, 200, 400]) {
    const h = field({ members: 3, tier: 2, layers: L });
    const e = enemyOf(h);
    const res0 = e.s.res;
    burstOn(h, 'burn');
    h.step();
    // The engine's own 灼燃 cooldown applies its OWN permanent −20 (`burnBurst`, constants.js ELEMENT.burn.enemy
    // .resDown); this clause is the 「额外」 −burn_res_down on top, so the final RES is base − 2 × 20.
    const engine = e.findBuff('burnBurst');
    assert.equal(engine?.mods?.resFlat, -20, `${L} layers: the engine's own cut (premise)`);
    assert.equal(e.findBuff(ELEMENT_KEY.resDown)?.mods.resFlat, -BB.burn_res_down, `${L} layers: the extra RES buff`);
    approx(e.s.res, res0 - 20 - BB.burn_res_down, `${L} layers: RES −${20 + BB.burn_res_down}`);
    // the burst's own 元素伤害 instance carries the burst multiplier (read from the `hit` hook: the DamageInfo is the
    // engine's, and only the multiplier is this module's)
    const want = tier2Value(BB, 'burn_burst_base', 'burn_burst_per_stack', Math.min(L, BB.tier2_cap_layers));
    const own = burstInstance(h, 'burn');
    assert.equal(own.length, 1, `${L} layers: one burst instance`);
    approx(own[0].dmg.amount * own[0].dmg.mul, 7000 * want, `${L} layers: the burst instance ×${want}`);
    // and the next instance of that member is NOT scaled again (the slot is consumed)
    const src = memberOf(h);
    const before = e.hp;
    h.b.dealDamage(src, e, { amount: 1000, type: 'elemental', element: 'burn', sourceless: true, canDodge: false, tags: ['burst', 'burn'] });
    approx(before - e.hp, 1000, `${L} layers: only one instance is scaled`);
    checkInvariants(h.b);
  }
  // tier 1 (2 members): no 二档 clause at all, so only the ENGINE's own −20 applies (constants.js ELEMENT.burn)
  const one = field({ members: 2, tier: 1, layers: 200 });
  const e1 = enemyOf(one);
  const res1 = e1.s.res;
  burstOn(one, 'burn');
  one.step();
  approx(res1 - e1.s.res, 20, 'tier 1: only the engine\u2019s own cut');
  assert.equal(e1.findBuff(ELEMENT_KEY.resDown), null, 'tier 1: no extra RES buff');
  assert.equal(e1.findBuff('burnBurst')?.mods.resFlat, -20, 'tier 1: the engine\u2019s buff alone');
  checkInvariants(one.b);
});

// ---------------------------------------------------------------------------------------------------------------------
// 二档 — 神经

test('二档 神经: the burst DIRECT damage ×(1.10 + per·L) and 冷却期每秒 ×(500 + 4·L) 元素持续伤害; 200-layer clamp', () => {
  close(BB.neural_burst_base, 1.10);
  close(BB.neural_dot_base, 500);
  close(tier2Value(BB, 'neural_burst_base', 'neural_burst_per_stack', 200), 2.60, '260 % at 200 layers');
  close(tier2Value(BB, 'neural_dot_base', 'neural_dot_per_stack', 200), 1300, '1300 per second at 200 layers');

  for (const L of [0, 100, 200, 400]) {
    const h = field({ members: 3, tier: 2, layers: L });
    burstOn(h, 'neural');
    h.step();
    const dots = () => hits(h, 'element:neural');
    assert.equal(dots().length, 0, `${L} layers: nothing before the first second`);
    h.run(1.05);
    const want = tier2Value(BB, 'neural_dot_base', 'neural_dot_per_stack', Math.min(L, BB.tier2_cap_layers));
    assert.equal(dots().length, 1, `${L} layers: one tick per second`);
    approx(dots()[0].amount, want, `${L} layers: the tick amount`);
    h.run(3);
    assert.equal(dots().length, 4, `${L} layers: a tick every second of the cooldown`);
    // the burst's own DIRECT instance carries the same multiplier (read off the `hit` hook)
    const direct = tier2Value(BB, 'neural_burst_base', 'neural_burst_per_stack', Math.min(L, BB.tier2_cap_layers));
    const own = burstInstance(h, 'neural');
    assert.equal(own.length, 1, `${L} layers: one direct instance`);
    approx(own[0].dmg.amount * own[0].dmg.mul, 6000 * direct, `${L} layers: the direct instance ×${direct}`);
    checkInvariants(h.b);
  }
  const one = field({ members: 2, tier: 1, layers: 200 });
  burstOn(one, 'neural');
  one.step();
  one.run(2.5);
  assert.equal(hits(one, 'element:neural').length, 0, 'tier 1: no DoT');
  checkInvariants(one.b);
});

// ---------------------------------------------------------------------------------------------------------------------
// 二档 — 侵蚀

test('二档 侵蚀: DEF 额外永久 −120 and 0.3 s 内 10 跳 ×(750 + 6·L) 物理持续伤害; 200-layer clamp', () => {
  assert.equal(BB.erosion_def_down, 120);
  assert.equal(BB.erosion_dot_hits, 10);
  close(BB.erosion_dot_interval, 0.03, 'erosion_dot_interval');
  close(tier2Value(BB, 'erosion_dot_base', 'erosion_dot_per_stack', 200), 1950, '1950 per hit at 200 layers');

  for (const L of [0, 200, 400]) {
    const h = field({ members: 3, tier: 2, layers: L });
    const e = enemyOf(h);
    const def0 = e.s.def;
    burstOn(h, 'erosion');
    h.step();
    // DEF 额外永久 −120: the engine's own 侵蚀 burst (resolveBurst) applies its own permanent −120 in `erosionDown`,
    // this clause adds a second, separate permanent cut → base − 2 × 120 on an enemy whose DEF is high enough to show it.
    assert.deepEqual(e.findBuff('erosionDown')?.mods, { defFlat: -120 }, `${L} layers: the engine's own cut (premise)`);
    assert.equal(e.findBuff(ELEMENT_KEY.defDown)?.mods.defFlat, -BB.erosion_def_down, `${L} layers: the extra DEF buff`);
    approx(e.s.def, def0 - 120 - BB.erosion_def_down, `${L} layers: DEF −${120 + BB.erosion_def_down}`);
    assert.equal(e.findBuff(ELEMENT_KEY.defDown).timeLeft, Infinity, `${L} layers: permanent`);
    // the burst's own instance is NOT scaled by a 侵蚀 multiplier — the design gives this element no burst-damage term
    const own = burstInstance(h, 'erosion');
    assert.equal(own.length, 1, `${L} layers: the engine's instance`);
    approx(own[0].dmg.mul, 1, `${L} layers: the 侵蚀 clause leaves the burst instance alone`);
    // 10 physical ticks inside 0.3 s (the header's timing note: `battle.after(n · erosion_dot_interval)` per hit).
    // They are ordinary 物理伤害: the DEF cut above mitigates them, so the expected HP loss per tick is
    // max(dot − max(0, DEF), 5 % · dot) with the DEF the enemy had when the burst landed.
    const ticks = () => hits(h, 'element:erosion').filter((c) => c.type === 'phys');
    h.run(0.5);
    const all = ticks();
    const raw = tier2Value(BB, 'erosion_dot_base', 'erosion_dot_per_stack', Math.min(L, BB.tier2_cap_layers));
    const want = Math.max(raw - Math.max(0, e.s.def), 0.05 * raw);
    assert.equal(all.length, BB.erosion_dot_hits, `${L} layers: exactly ${BB.erosion_dot_hits} hits`);
    for (const c of all) approx(c.amount, want, `${L} layers: the mitigated tick amount`);
    assert.ok(raw > want, `${L} layers: premise — the DEF cut really bites (${raw} → ${want})`);
    // the ten land inside the 0.3 s window the design names. The sim tick is 1/30 s and `battle.after` fires a due
    // callback on the NEXT tick, so the first hit lands on the second tick (0.0667 s) and the last on the tenth — the
    // span from the first hit back to the burst is the design's 0.3 s plus at most one tick of dispatch latency.
    const span = all[all.length - 1].t - (all[0].t - BB.erosion_dot_interval);
    assert.ok(span <= 0.3 + 2 / 30 + 1e-9, `${L} layers: the ten hits span ${span.toFixed(4)} s`);
    assert.ok(all[0].t <= 0.1, `${L} layers: the first hit is at ${all[0].t.toFixed(4)} s`);
    checkInvariants(h.b);
  }
  // tier 1 (2 members): no 二档 clause at all, so only the ENGINE's own permanent −120 applies
  const one = field({ members: 2, tier: 1, layers: 200 });
  const e1 = enemyOf(one);
  const def1 = e1.s.def;
  burstOn(one, 'erosion');
  one.step();
  approx(def1 - e1.s.def, 120, 'tier 1: only the engine\u2019s own cut');
  assert.equal(e1.findBuff(ELEMENT_KEY.defDown), null, 'tier 1: no extra DEF buff');
  one.run(0.5);
  assert.equal(hits(one, 'element:erosion').length, 0, 'tier 1: no DoT');
  checkInvariants(one.b);
});

// ---------------------------------------------------------------------------------------------------------------------
// 数据表守卫

test('data: 元素 (elementShip) is an add-on bond with [2, 3], 7 visible members and the derived blackboard', () => {
  const b = BONDS[ID.element];
  assert.ok(b, 'elementShip in data/bonds.json');
  assert.equal(b.name, '元素');
  assert.equal(b.isCore, false, 'an add-on (非核心) bond');
  assert.equal(b.bondType, 'REGULAR');
  assert.equal(b.activeCount, 2);
  assert.deepEqual(b.thresholds, [2, 3], '一档 2 名 / 二档 3 名');
  assert.equal(b.countMode, 'BOARD');
  assert.equal(b.weight, 10, 'the small-bond weight');
  assert.equal(b.identifier, 25, 'after the 23 official bonds and 巴别塔');
  assert.equal(b.iconId, 'icon_elementShip');
  assert.equal(b.effectId, 'bondeffect_element');
  assert.deepEqual(b.members, ['chess_char_3_06_a', 'chess_char_4_27_a', 'chess_char_5_03_a', 'chess_char_5_22_a',
    'chess_char_5_clemnt_a', 'chess_char_6_03_a', 'chess_char_6_09_a', 'chess_char_6_10_a'],
  'seven visible operators + 妮芙\u2019s hidden T6 form (the same operator)');
  assert.deepEqual(b.visibleMembers, ['chess_char_3_06_a', 'chess_char_4_27_a', 'chess_char_5_03_a', 'chess_char_5_22_a',
    'chess_char_5_clemnt_a', 'chess_char_6_03_a', 'chess_char_6_09_a'], 'seven visible members');
  // the blackboard the sim reads: every key of the design, nothing hardcoded in the module
  for (const k of ['element_damage_base', 'element_damage_per_stack', 'element_damage_cap_layers', 'tier2_cap_layers',
    'apoptosis_burst_base', 'apoptosis_burst_per_stack', 'apoptosis_atk_final_mul',
    'burn_burst_base', 'burn_burst_per_stack', 'burn_res_down',
    'neural_burst_base', 'neural_burst_per_stack', 'neural_dot_base', 'neural_dot_per_stack',
    'erosion_def_down', 'erosion_dot_base', 'erosion_dot_per_stack', 'erosion_dot_hits', 'erosion_dot_interval']) {
    assert.ok(k in b.bb, `bb.${k}`);
  }
  // the derived slopes hit the design's two endpoints exactly
  close(tier2Value(BB, 'apoptosis_burst_base', 'apoptosis_burst_per_stack', 200), 3.25);
  close(tier2Value(BB, 'burn_burst_base', 'burn_burst_per_stack', 200), 4.94);
  close(tier2Value(BB, 'neural_burst_base', 'neural_burst_per_stack', 200), 2.60);
  close(tier2Value(BB, 'neural_dot_base', 'neural_dot_per_stack', 200), 1300);
  close(tier2Value(BB, 'erosion_dot_base', 'erosion_dot_per_stack', 200), 1950);
});

test('data: the seven members carry elementShip and their 特质; 余 / 塑心 keep their official traits', () => {
  const want = {
    chess_char_3_06_a: { name: '菲莱', bonds: ['sargonShip', 'elementShip'], garrisons: ['garrison_175_a'] },
    chess_char_4_27_a: { name: '珊比', bonds: ['elementShip'], garrisons: ['garrison_179_a'] },
    chess_char_5_03_a: { name: '烛煌', bonds: ['victoriaShip', 'yanShip', 'elementShip'], garrisons: ['garrison_176_a'] },
    chess_char_5_22_a: { name: '妮芙', bonds: ['swiftShip', 'elementShip'], garrisons: ['garrison_177_a'] },
    // 克莱门莎's exact list, the maintainer's ruling of 2026-10-12 (tools/content/custom.mjs `clemensa.chess`): an
    // exact final `bondIds` on her own fiat record, 不屈 dropped and 元素 kept — the mechanism the module header
    // documents for REMOVING a bond (a union table can only add).
    chess_char_5_clemnt_a: { name: '克莱门莎', bonds: ['egirShip', 'swiftShip', 'elementShip'], garrisons: ['garrison_178_a'] },
    chess_char_6_03_a: { name: '余', bonds: ['yanShip', 'steadShip', 'elementShip'], garrisons: ['garrison_37_a'] },
    chess_char_6_09_a: { name: '塑心', bonds: ['lateranoShip', 'elementShip'], garrisons: ['garrison_90_a'] },
  };
  for (const [id, w] of Object.entries(want)) {
    const c = CHESS[id];
    assert.ok(c, id);
    assert.equal(c.name, w.name, `${id}: name`);
    assert.deepEqual(c.bonds, w.bonds, `${id}: bonds (元素 appended)`);
    assert.deepEqual(c.garrisonIds, w.garrisons, `${id}: garrisonIds`);
  }
  // 余 / 塑心 are the 「特质不变」 two: their own official rows still exist and still name them
  for (const [gid, owner] of [['garrison_37_a', 'chess_char_6_03_a'], ['garrison_90_a', 'chess_char_6_09_a']]) {
    assert.ok(GARRISONS[gid], `${gid} present`);
    assert.ok(GARRISONS[gid].owners.includes(owner), `${gid}: still owned by ${owner}`);
  }
  // 妮芙's hidden T6 form is the same operator: the bond follows, her shared 特质 pair is untouched
  assert.deepEqual(CHESS.chess_char_6_10_a.bonds, ['swiftShip', 'elementShip']);
  assert.deepEqual(CHESS.chess_char_6_10_a.garrisonIds, ['garrison_56_a']);
  // 克莱门莎's two records: the exact three-bond list on BOTH forms, and the member-list mirror that goes with it
  // (maintainer's ruling of 2026-10-12 — see the note in the `want` table above).
  assert.deepEqual(CHESS.chess_char_5_clemnt_b.bonds, ['egirShip', 'swiftShip', 'elementShip'], 'the elite record too');
  assert.deepEqual(CHESS.chess_char_5_clemnt_b.garrisonIds, ['garrison_178_b']);
  assert.ok(BONDS.elementShip.members.includes('chess_char_5_clemnt_a'), '元素 lists her normal record');
  assert.ok(BONDS.elementShip.visibleMembers.includes('chess_char_5_clemnt_a'));
  // 不屈 lost her, and `bondChessIds` dropped both of her ids: `members` carries the NORMAL id of each pair, so the
  // two ids collapse into ONE row — 11 → 10 members, 9 → 8 visible (data/bonds.json, assert-not-loose).
  assert.ok(!BONDS.indomShip.members.includes('chess_char_5_clemnt_a'), '不屈 no longer lists her');
  assert.ok(!BONDS.indomShip.visibleMembers.includes('chess_char_5_clemnt_a'));
  assert.deepEqual([BONDS.indomShip.members.length, BONDS.indomShip.visibleMembers.length], [10, 8]);
  assert.deepEqual([BONDS.elementShip.members.length, BONDS.elementShip.visibleMembers.length], [8, 7],
    '元素 8 records / 7 visible: she was already a member before the ruling');
});

test('data: the traits the replacements took over are still in data/garrisons.json (orphans, never dropped)', () => {
  // 菲莱's official 萨尔贡 row: the 元素 version EXTENDS it (the sargon clause is intact on garrison_175_a/_b)
  const g175 = GARRISONS.garrison_175_a;
  assert.equal(g175.bb.bond_add_count, 6, '菲莱: 萨尔贡 +6 kept');
  assert.equal(g175.bbStr.bond_id, 'sargonShip,elementShip', '菲莱: both bonds on the one official-shaped row');
  assert.equal(g175.bbStr.key, 'act1autochess_gar_event_useskill', 'the official handler');
  assert.equal(g175.bbStr.garrison_key, 'garrison_175_a');
  assert.equal(GARRISONS.garrison_175_b.bb.bond_add_count, 12, '精锐 keeps +12');
  assert.deepEqual(GARRISONS.garrison_43_a.bb, { bond_add_count: 6 }, 'the official row is kept as it was');
  assert.equal(GARRISONS.garrison_43_a.bbStr.bond_id, 'sargonShip');
  assert.deepEqual(GARRISONS.garrison_43_a.owners, [], 'orphan: no chess names it any more');
  assert.deepEqual(GARRISONS.garrison_35_a.owners, [], '烛煌 official row kept');
  assert.deepEqual(GARRISONS.garrison_161_a.owners, [], '克莱门莎 official row kept');
  // 烛煌: 炎 / 维多利亚 + 元素, all 「无需激活盟约」
  assert.equal(GARRISONS.garrison_176_a.bb.count, 5);
  assert.equal(GARRISONS.garrison_176_a.bbStr.bond, 'yanShip,victoriaShip,elementShip');
  assert.ok(GARRISONS.garrison_176_a.desc.includes('无需激活盟约'));
  // 妮芙: 迅捷 kept, 元素 added, the 整备区 counter unchanged
  assert.equal(GARRISONS.garrison_177_a.bb.multi, 2);
  assert.equal(GARRISONS.garrison_177_a.bbStr.bond, 'swiftShip,elementShip');
  assert.equal(GARRISONS.garrison_177_a.bbStr.add_method, 'hand_count');
  // 克莱门莎: the 每 3 名 / 上限 version of the maintainer's spec, with the cap's garrison_key, and the TARGET LIST
  // that followed her bonds onto 元素 (maintainer's ruling of 2026-10-12: 阿戈尔 / 迅捷 / 元素, no 不屈 layer any more)
  assert.equal(GARRISONS.garrison_178_a.bb.check_cnt, 3, '每击倒 3 名');
  assert.equal(GARRISONS.garrison_178_a.bb.bond_add_count, 2);
  assert.equal(GARRISONS.garrison_178_a.bb.max_add_count_per_battle, 14, '每场战斗至多 +14');
  assert.equal(GARRISONS.garrison_178_a.bbStr.garrison_key, 'garrison_178_a');
  assert.equal(GARRISONS.garrison_178_a.bbStr.bond_id, 'egirShip,swiftShip,elementShip', 'the three bonds she has');
  assert.ok(!GARRISONS.garrison_178_a.bbStr.bond_id.includes('indomShip'), '不屈 is not a target any more');
  assert.match(GARRISONS.garrison_178_a.desc, /【阿戈尔】【迅捷】【元素】层数\+2/, 'the text names the same three');
  assert.equal(GARRISONS.garrison_178_b.bb.check_cnt, 3);
  assert.equal(GARRISONS.garrison_178_b.bb.bond_add_count, 4);
  assert.equal(GARRISONS.garrison_178_b.bb.max_add_count_per_battle, 28);
  assert.equal(GARRISONS.garrison_178_b.bbStr.bond_id, 'egirShip,swiftShip,elementShip');
  assert.match(GARRISONS.garrison_178_b.desc, /【阿戈尔】【迅捷】【元素】层数\+4/);
  // her OLD pair is still the committed record (unchanged by this change)
  assert.equal(GARRISONS.garrison_161_a.bb.check_cnt, 1);
  assert.equal(GARRISONS.garrison_161_a.bb.bond_add_count, 2);
  assert.equal(GARRISONS.garrison_161_a.bb.max_add_count_per_battle, undefined, 'the old row had no cap');
  // 珊比: <获得时> 元素 +6 / +12, no activation needed (the text is what the handler reads)
  assert.equal(GARRISONS.garrison_179_a.bb.count, 6);
  assert.equal(GARRISONS.garrison_179_a.bbStr.bond, 'elementShip');
  assert.ok(GARRISONS.garrison_179_a.desc.includes('无需激活盟约'));
  assert.equal(GARRISONS.garrison_179_b.bb.count, 12);
});

test('data: every mode whitelists elementShip in activeBondIds, and never in inactiveBondIds', () => {
  for (const [id, m] of Object.entries(CONFIG.modes)) {
    assert.ok(m.activeBondIds.includes('elementShip'), `${id}: elementShip active`);
    assert.ok(m.activeBondIds.includes('babelShip'), `${id}: babelShip active (premise)`);
    assert.ok(!m.inactiveBondIds.includes('elementShip'), `${id}: not disabled`);
  }
});

test('data: 珊比 is promoted — a visible T4 PRESET shop chess, gone from the 自选 pool, kit and asset record in place', () => {
  const a = CHESS.chess_char_4_27_a;
  const b = CHESS.chess_char_4_27_b;
  for (const [c, golden] of [[a, false], [b, true]]) {
    assert.ok(c, 'the chess record exists');
    assert.equal(c.charId, 'char_4235_thumpy');
    assert.equal(c.tier, 4);
    assert.equal(c.isGolden, golden);
    assert.equal(c.visible, true);
    assert.equal(c.chessType, 'PRESET');
    assert.equal(c.isDiy, false);
    assert.deepEqual(c.bonds, ['elementShip']);
    assert.equal(c.baseId, 'chess_char_4_27_a', 'the elite names the normal record as its base');
    assert.equal(c.name, '珊比');
  }
  assert.equal(a.goldenId, 'chess_char_4_27_b');
  assert.deepEqual(a.garrisonIds, ['garrison_179_a']);
  assert.deepEqual(b.garrisonIds, ['garrison_179_b']);
  assert.equal(a.upgradeChessId, 'chess_char_4_27_b');
  // she left the 自选 pool (buildBackups' roster rule), so no unit / operator record names her any more
  assert.ok(!BACKUPS.diy.ownedPool.includes('char_4235_thumpy'), 'out of ownedPool');
  assert.ok(!('char_4235_thumpy' in BACKUPS.diy.operators), 'out of diy.operators');
  assert.ok(!('char_4235_thumpy' in BACKUPS.units), 'out of backups.units');
  // …which is exactly why the asset plan must name her itself (docs/ASSETS.md, third source)
  const extra = JSON.parse(readFileSync(new URL('../../tools/assets/extra-operators.json', import.meta.url), 'utf8'));
  const rec = extra.operators['char_4235_thumpy'];
  assert.ok(rec, 'tools/assets/extra-operators.json lists her');
  assert.equal(rec.subProfessionId, 'primprotector');
  assert.deepEqual(rec.skills.map((s) => s.skillId), ['skchr_thumpy_1', 'skchr_thumpy_2', 'skchr_thumpy_3']);
  // her assets survive in the manifest, and the bond icon is there
  const assets = load('assets');
  assert.ok(assets.chars['char_4235_thumpy'], 'the manifest still carries her avatar / portrait / spine');
  assert.equal(assets.stats.bonds, 25, 'every bond has an icon (24 official + 巴别塔 + 元素)');
  assert.ok(assets.bonds.elementShip, 'the bond icon is in the manifest');
  assert.ok(assets.bonds.babelShip, 'premise: the 巴别塔 icon');
});
