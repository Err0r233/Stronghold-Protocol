// test/content/op_hodrer.test.js — the kit of 赫德雷 (char_4088_hodrer, 6★ 重剑手; server/sim/content/kits/ops/op-hodrer.js),
// fielded the production way after OPEN-4 promoted him to a 「巴别塔」 shop chess: the record of chess_char_5_06_babel_a
// (E2 Lv1, skill rank 4) / _b (E2 Lv60, rank 7) in data/chess.json, registered by ops/chess_char_5_06_babel-hodrer.js
// (his charId left `backups.json units` and `diy.ownedPool`, so the old 自选 slot path is gone). Every number is read back
// from data/chess.json; the fidelity checklist of kits/README.md item by item.
// 转正后的商店棋照官方 PRESET 惯例带模组（maintainer 2026-10-12「为维什戴尔等有模组的角色添加模组」）：精锐 `_b`
// `equipLevel` 1（T5）⇒ CRU-X 新的生活活性（`module.active` true，`modules[]` = CRU-X + CRU-Y），普通 `_a` 保持
// `equipLevel` 0（`module.id` 有、`active` false、不建 `modules`）。CRU-X 一阶带来 maxHp +290 / atk +92 与特性
// 「受到的治疗效果提升20%」（trait bb heal_scale 1.2，他自己的 S1 / S3 自回也算），所以精锐分支按
// `rec(true).trait.bb.heal_scale` 读回这些值。
// Run: node test/content/op_hodrer.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITTED_CHARS, KITS } from '../../server/sim/content/kits/index.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../../data/${f}.json`, import.meta.url), 'utf8'));
const CHESS = load('chess');
const HOD = 'char_4088_hodrer';
const A = 'chess_char_5_06_babel_a', B = 'chess_char_5_06_babel_b';
const rec = (elite) => CHESS[elite ? B : A];
const CRUX = 'uniequip_002_hodrer', CRUY = 'uniequip_003_hodrer';   // the elite's default and its other module choice
const S1 = 'skchr_hodrer_1', S2 = 'skchr_hodrer_2', S3 = 'skchr_hodrer_3';
const PROTECT = 'protect';                 // the shared 庇护 of every source (kits/shared/tier1.js holdProtect)
const DMG_UP = 'talent:hodrer:dmgUp';      // CRU-X stage 3's 物理伤害 + (its own one instance per ally)
const skillOf = (elite, id) => rec(elite).skills.find((s) => s.skillId === id);
const approx = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
const dummy = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, mass: 0, ...o });
const ENEMIES = {
  enemy_dummy: dummy('enemy_dummy'),
  enemy_fly: dummy('enemy_fly', { motion: 'FLY' }),
  enemy_walk: enemyRec({ key: 'enemy_walk', hp: 1e9, speed: 0.6, mass: 0 }),
  enemy_brute: enemyRec({ key: 'enemy_brute', hp: 1e9, speed: 0.6, mass: 0, atk: 300, bat: 1 }),
};
const FORMS_ALL = [[false], [true]];

/** A battle with 赫德雷 as uid 1 at (row, col) facing RIGHT, plus `others`. */
function field({ elite = false, skill = 0, row = 10, col = 5, others = [], seed = 5, noSp = false } = {}) {
  const h = makeBattle({
    defs: { enemies: ENEMIES }, timeLimit: 900, autoFinish: false, seed,
    flags: { dpPerSec: 0, dpMax: 999 }, hooks: ['damaged', 'heal', 'skillStart', 'skillEnd', 'statusApplied', 'attack'], captureNoisy: true,
    units: [{ uid: 1, chessId: elite ? B : A, skillIndex: skill, elite, row, col }, ...others],
  });
  h.step();
  const u = h.unit(1);
  if (noSp) h.b.on('spGain', (c) => { if (c.unit === u) c.amount = 0; });
  return { h, u };
}
const atkHits = (h, u) => h.hooksOf('damaged').filter((c) => c.source === u && c.dmg?.isAttack);
const byAttack = (hits) => { const m = new Map(); for (const c of hits) { const k = c.dmg.attackId; if (!m.has(k)) m.set(k, []); m.get(k).push(c); } return [...m.values()]; };
function done(h) {
  checkInvariants(h.b);
  assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0]));
}
const label = ([elite]) => (elite ? 'elite' : 'normal');
const t0Of = (u) => u.def.raw.talents.find((t) => t.index === 0).bb;
const t1Of = (u) => u.def.raw.talents.find((t) => t.index === 1).bb;
/** 余火之氅 on his own tile: CRU-X stage 3 "造成的物理伤害提升10%" (damage_scale) — 1 without a module. */
const ownPhys = (u) => t1Of(u).damage_scale ?? 1;

test('赫德雷 in both forms: his operator kit (all three skills authored), the record\'s stats (CRU-X on the elite only), 1-1, blocks 2, melee physical ground-only hitting all he blocks, 巴别塔 + 不屈, 特质 garrison_168', () => {
  assert.equal(typeof KITS[A], 'function');
  for (const f of FORMS_ALL) {
    const [elite] = f;
    for (const skill of [0, 1, 2]) {
      const { h, u } = field({ elite, skill });
      const r = rec(elite);
      assert.deepEqual([u.def.charId, u.def.baseId, u.skill.id, !!u.kit.generic, u.kit.skillSource], [HOD, A, r.skills[skill].skillId, false, 'skills'], label(f));
      // the module rides on the data record (CRU-X active at stage 1 on the elite); a normal chess carries no module
      // choices at all, so `r.modules` is undefined and only the record's `module.id` names the id with `active: false`
      assert.deepEqual([r.module.id, r.module.active, r.modules === undefined], [CRUX, elite, !elite], `${label(f)}: module`);
      assert.deepEqual([u.base.maxHp, u.base.atk, u.base.def], [r.stats.maxHp, r.stats.atk, r.stats.def], `${label(f)}: stats`);
      assert.deepEqual([u.s.blockCnt, u.profile.attack, u.profile.dmgType, u.profile.canHitFly, u.profile.hitAllBlocked, u.base.bat], [2, 'melee', 'phys', false, true, 2.5], `${label(f)}: 重剑手`);
      assert.deepEqual(u.liveRangeGrid, r.rangeGrid, `${label(f)}: 1-1`);
      assert.deepEqual([u.def.bonds, u.def.raw.garrisonIds], [['babelShip', 'indomShip'], [elite ? 'garrison_168_b' : 'garrison_168_a']], `${label(f)}: bonds / 特质`);
      assert.ok(!u.s.flags.liftoff && !u.s.flags.camou && !u.s.flags.stealth, `${label(f)}: ground enemies target him`);
      done(h);
    }
  }
  // zh_CN (full potential: HP +250, ATK +45): E2 Lv1 4920 / 1368 / 0, E2 Lv60 5794 / 1536 / 0 no-module base, + CRU-X
  // stage 1 (maxHp +290 / atk +92) on the elite = 6084 / 1628
  assert.deepEqual([rec(false).stats.maxHp, rec(false).stats.atk, rec(true).stats.maxHp, rec(true).stats.atk], [4920, 1368, 6084, 1628]);
  assert.deepEqual([rec(true).statsBase.maxHp, rec(true).statsBase.atk], [5794, 1536]);
});

test('a 商店棋: 赫德雷 is the visible T5 巴别塔 preset with a hand-authored kit — and is no longer a 自选 pick', () => {
  for (const id of [A, B]) {
    const r = CHESS[id];
    assert.deepEqual([r.charId, r.tier, r.visible, r.chessType, r.isDiy], [HOD, 5, true, 'PRESET', false], id);
    assert.ok(r.bonds.includes('babelShip'), id);
  }
  // OPEN-4: his charId left `backups.json diy.ownedPool`, so the 自选 picker no longer offers him (KITTED_CHARS lists the
  // picks a 自选 slot may field — the shop chess is fielded by its chess id instead, ops/chess_char_5_06_babel-hodrer.js)
  assert.equal(KITTED_CHARS.includes(HOD), false);
  // the registry key is the pair's base id (`_a`): the elite `_b` record resolves through it (content/index.js kitOf)
  assert.equal(typeof KITS[A], 'function');
  assert.equal(Object.prototype.hasOwnProperty.call(KITS, B), false);
});

test('trait + T1 及锋而试: every attack hits all he blocks; ×1.1 (CRU-Y stage 3 ×1.3), ×1.4 (×1.6) on a stunned or bound target — not a frozen one, never a flyer', () => {
  for (const f of FORMS_ALL) {
    const [elite] = f;
    const { h, u } = field({ elite, skill: 0, noSp: true });
    const t0 = t0Of(u);
    assert.deepEqual([t0.atk_scale_2, t0.atk_scale], [1.1, 1.4], label(f));
    const e = h.spawn('enemy_dummy', { pos: [10, 6] });
    h.spawn('enemy_fly', { pos: [10, 6] });
    const hitOn = () => { const n = atkHits(h, u).length; h.runUntil(() => atkHits(h, u).length > n, 3); return atkHits(h, u).slice(n); };
    let hs = hitOn();
    assert.ok(hs.length === 1 && hs[0].target === e, `${label(f)}: the ground dummy only`);
    approx(hs[0].amount, u.s.atk * t0.atk_scale_2 * ownPhys(u), `${label(f)}: ×${t0.atk_scale_2}`);
    for (const [st, mul] of [['stun', t0.atk_scale], ['bind', t0.atk_scale], ['freeze', t0.atk_scale_2]]) {
      h.b.applyStatus(e, st, { duration: 60, source: null });
      hs = hitOn();
      approx(hs[0].amount, u.s.atk * mul * ownPhys(u), `${label(f)}: ${st} ×${mul}`);
      h.b.removeStatus(e, st);
    }
    done(h);
  }
  // all he blocks, at once
  const { h, u } = field({ elite: true, skill: 0, row: 9, col: 5, noSp: true });
  h.spawn('enemy_walk', { routeIndex: 0 });
  h.spawn('enemy_walk', { routeIndex: 0, time: 0 });
  assert.ok(h.runUntil(() => u.blocking.length === 2, 40), 'blocks two');
  const n = atkHits(h, u).length;
  h.run(6);
  const att = byAttack(atkHits(h, u).slice(n));
  assert.ok(att.length >= 2 && att.every((a) => a.length === 2 && new Set(a.map((c) => c.target)).size === 2), '同时攻击阻挡的所有敌人');
  done(h);
});

test('both modules are data on the record: CRU-X is the elite’s active default (maxHp +290 / atk +92, 受到的治疗提升20 %), CRU-Y is the other choice (maxHp +300 / atk +110, 对被阻挡的敌人伤害提升至110 %)', () => {
  const b = rec(true), a = rec(false);
  // the normal form names the module but builds no phase (equipLevel 0): no `modules[]`, `active` false
  assert.deepEqual([a.status.equipLevel, a.module.id, a.module.active, a.modules], [0, CRUX, false, undefined]);
  assert.deepEqual([b.status.equipLevel, b.module.id, b.module.active, b.module.type, b.module.level], [1, CRUX, true, 'CRU-X', 1]);
  assert.deepEqual(b.modules.map((m) => [m.uniEquipId, m.isDefault, m.level]), [[CRUX, true, 1], [CRUY, false, 1]]);
  // CRU-X's own trait line (heal_scale) is the record's trait on the elite; CRU-Y's (damage_scale on the enemies HE
  // blocks) is not, because CRU-Y is not the default — both stay implemented in kits/ops/op-hodrer.js (`traitBb` /
  // `moduleBb`), and a caller that wants CRU-Y swaps the record's attr/traitOverride/talentChanges
  assert.deepEqual(b.trait.bb, { heal_scale: 1.2 });
  assert.equal(b.trait.moduleDesc, '受到的治疗效果提升20%');
  assert.equal(a.trait.bb.heal_scale, undefined, 'the normal form keeps the plain 重剑手 trait');
  const crux = b.modules[0], cruy = b.modules[1];
  assert.deepEqual([crux.attr, cruy.attr], [{ maxHp: 290, atk: 92 }, { maxHp: 300, atk: 110 }]);
  assert.deepEqual(cruy.traitOverride.bb, { damage_scale: 1.1 });
  assert.match(cruy.traitOverride.moduleDesc, /对被阻挡的敌人伤害提升至110%/);
  // every selectable module composes the record's own numbers back (the data invariant test/data.test.js also proves)
  assert.deepEqual([b.statsBase.maxHp + crux.attr.maxHp, b.statsBase.atk + crux.attr.atk], [b.stats.maxHp, b.stats.atk]);
});

test('CRU-Y 笔迹 stage 3 (×1.3 / ×1.6 and the first-hit 2.5 s stun) is source data this chess cannot reach', { skip: 'the elite is T5: equipLevel 1 only, and CRU-Y stage 3 exists only at equipLevel 3 (CRU-X / CRU-Y stage-1 parts carry TRAIT data only, so no live battle of this chess can show it)' }, () => {
  // Kept as a marker, never as a silent pass: the kit keeps the behaviour (kits/ops/op-hodrer.js `moduleBb(...).stun`
  // and the CRU-Y `damage_scale` hit handler) and the day the mode fields a stage-3 赫德雷 these cases must be restored.
  assert.equal(CRUY, 'uniequip_003_hodrer');
});

test('T2 余火之氅: he and the ally on the tile behind him get 21 % 庇护; not the ally beside him; gone once he leaves', () => {
  const others = [{ uid: 2, chessId: 'chess_char_1_08_a', row: 10, col: 4 }, { uid: 3, chessId: 'chess_char_1_10_a', row: 11, col: 5 }];
  for (const f of FORMS_ALL) {
    const [elite] = f;
    const { h, u } = field({ elite, skill: 0, others });
    const behind = h.unit(2), beside = h.unit(3);
    h.run(0.5);
    const dr = t1Of(u).damage_resistance;
    assert.equal(dr, 0.21, `${label(f)}: 21 % (潜能 6)`);
    for (const a of [u, behind]) {
      const m = a.findBuff(PROTECT)?.mods;
      assert.ok(m, `${label(f)}: ${a.def.charId} protected`);
      approx(m.physTakenMul, 1 - dr, `${label(f)}: phys`);
      approx(m.artsTakenMul, 1 - dr, `${label(f)}: arts`);
      // CRU-X stage 3's 物理伤害 +10 % 对同一批目标 is a stage-3 part (equipLevel 1 here): never on this chess
      assert.equal(a.findBuff(DMG_UP)?.mods.physDealtMul ?? 1, 1, `${label(f)}: no CRU-X stage-3 物理伤害 +`);
    }
    assert.equal(beside.findBuff(PROTECT), null, `${label(f)}: not beside him`);
    const hp = behind.hp;
    h.b.dealDamage(null, behind, { amount: 1000, type: 'arts' });
    approx(hp - behind.hp, 1000 * (1 - behind.s.res / 100) * (1 - dr), `${label(f)}: arts taken behind him`);
    h.b.retreat(u);
    h.run(0.5);
    assert.equal(behind.findBuff(PROTECT), null, `${label(f)}: gone with him`);
    done(h);
  }
});

test('CRU-X 新的生活 stage 3 (31 % 庇护 and 物理伤害 +10 % 对同一批目标) is source data this chess cannot reach', { skip: 'the elite is T5: equipLevel 1, so CRU-X stage 3 (its damage_resistance 0.31 + damage_scale_up part) is never the record\'s phase' }, () => {
  // Kept as a marker (was: "the promoted shop chess carries no module"): the kit holds both under the shared 庇护 key /
  // the DMG_UP instance, and the elite's own stage-1 庇护 (t1 damage_resistance 0.21) is asserted live above.
  assert.equal(CRUX, 'uniequip_002_hodrer');
});

test('S1 重锋不熄 (AUTO, hit SP 3, DEFAULT): every 4th attack hits all he blocks at 180 % / 200 % (× 及锋而试) and heals 15 % / 20 % of his max HP once', () => {
  for (const [elite] of FORMS_ALL) {
    const sk = skillOf(elite, S1);
    const { h, u } = field({ elite, skill: 0, row: 9, col: 5 });
    assert.deepEqual([u.skill.rule, u.skill.spType, u.skill.spCost, sk.bb.atk_scale, sk.bb.hp_ratio], ['DEFAULT', 'attack', 3, elite ? 2 : 1.8, elite ? 0.2 : 0.15], label([elite]));
    h.spawn('enemy_walk', { routeIndex: 0 });
    h.spawn('enemy_walk', { routeIndex: 0, time: 0 });
    assert.ok(h.runUntil(() => u.blocking.length === 2, 40));
    u.hp = u.s.maxHp * 0.3;
    const n0 = atkHits(h, u).length;
    h.run(2.5 * 8 + 0.1);
    const att = byAttack(atkHits(h, u).slice(n0));
    const sk1 = att.filter((a) => a[0].dmg.isSkill);
    assert.ok(sk1.length >= 2, `${label([elite])}: casts (${sk1.length} in ${att.length} attacks)`);
    const idx = att.map((a, i) => (a[0].dmg.isSkill ? i : -1)).filter((i) => i >= 0);
    for (let i = 1; i < idx.length; i++) assert.equal(idx[i] - idx[i - 1], 4, `${label([elite])}: one cast every 4 attacks`);
    for (const c of sk1[0]) approx(c.amount, u.s.atk * sk.bb.atk_scale * 1.1 * ownPhys(u), `${label([elite])}: ${sk.bb.atk_scale * 100} % × 1.1`);
    assert.equal(sk1[0].length, 2, `${label([elite])}: both blocked enemies`);
    const heals = h.hooksOf('heal').filter((c) => c.target === u && c.source === u);
    assert.equal(heals.length, sk1.length, `${label([elite])}: one heal per cast`);
    // CRU-X's "受到的治疗效果提升20%" (trait bb heal_scale 1.2, applied by the kit as `healingTakenMul`) multiplies
    // every heal he takes, his own S1 included; the normal form has no heal_scale and heals the plain ratio
    const healScale = Number(rec(elite).trait.bb.heal_scale) || 1;
    approx(heals[0].amount, u.s.maxHp * sk.bb.hp_ratio * healScale, `${label([elite])}: ${sk.bb.hp_ratio * 100} % max HP × ${healScale}`);
    done(h);
  }
});

test('S2 余烬重荷 (MANUAL, DEFAULT, a 状态切换 toggle): ATK +16 % / 28 % from the deployment on; switched on once and kept — interval 2.5 + 0.5 s, block 3, every attack stuns its targets 1 s before 及锋而试 reads them (×1.4)', () => {
  for (const [elite] of FORMS_ALL) {
    const sk = skillOf(elite, S2);
    const { h, u } = field({ elite, skill: 1, row: 9, col: 5 });
    assert.deepEqual([u.skill.rule, u.skill.kind, sk.spCost, sk.initSp, sk.bb.atk, sk.bb.base_attack_time, sk.bb.block_cnt, sk.bb['attack@stun']], ['DEFAULT', 'toggle', elite ? 8 : 9, 0, elite ? 0.28 : 0.16, 0.5, 1, 1], label([elite]));
    approx(u.s.atk, u.base.atk * (1 + sk.bb.atk), `${label([elite])}: the passive ATK`);
    for (let i = 0; i < 3; i++) h.spawn('enemy_walk', { routeIndex: 0, time: 0 });
    assert.ok(h.runUntil(() => u.skill.active, 30), `${label([elite])}: switched on with an enemy`);
    approx(u.s.interval, 3.0, `${label([elite])}: 攻击间隔略微增大(+0.5)`);
    assert.equal(u.s.blockCnt, 3, `${label([elite])}: 阻挡数+1`);
    assert.ok(h.runUntil(() => u.blocking.length === 3, 30), `${label([elite])}: blocks three`);
    const n0 = atkHits(h, u).length;
    h.run(9.1);
    const att = byAttack(atkHits(h, u).slice(n0));
    assert.ok(att.length >= 3 && att.every((a) => a.length === 3), `${label([elite])}: all three each attack`);
    for (const a of att) for (const c of a) approx(c.amount, u.s.atk * 1.4, `${label([elite])}: stunned first ⇒ ×1.4`);
    const stuns = h.hooksOf('statusApplied').filter((s) => s.source === u && s.status === 'stun');
    assert.ok(stuns.length >= 9 && stuns.every((s) => s.duration === 1), `${label([elite])}: 晕眩1秒 on every target`);
    h.run(60);
    assert.ok(u.skill.active, `${label([elite])}: kept on`);
    assert.equal(u.skill.activations, 1, `${label([elite])}: switched on once`);
    done(h);
  }
});

test('S3 死境硝烟 (MANUAL, data ACTIVE_RANGE): cast with an enemy 2 tiles ahead; 70 s, max HP +30 / 45 %, ATK +60 / 90 %, range +1; heals 5 % per attack, 25 % stuns 3 / 4 s; −100 HP / s and 200 无来源 true / s on the enemies he attacked or that attacked him', () => {
  for (const [elite] of FORMS_ALL) {
    const sk = skillOf(elite, S3);
    const { h, u } = field({ elite, skill: 2, seed: 19 });
    assert.deepEqual([u.skill.rule, sk.duration, sk.bb.max_hp, sk.bb.atk, sk.bb['attack@hp_ratio'], sk.bb['attack@buff_prob'], sk.bb['attack@stun'], sk.bb.ability_range_forward_extend, sk.bb['attack@value'], sk.bb['attack@damage']],
      ['ACTIVE_RANGE', 70, elite ? 0.45 : 0.3, elite ? 0.9 : 0.6, 0.05, 0.25, elite ? 4 : 3, 1, 100, 200], label([elite]));
    assert.deepEqual(sk.trigger.customRangeGrid, [[0, 0], [0, 1], [0, 2]], `${label([elite])}: the running range`);
    u.skill.gainSp(999);
    const near = h.spawn('enemy_dummy', { pos: [9, 6] });        // beside his range: never attacked
    h.run(1);
    assert.equal(u.skill.activations, 0, `${label([elite])}: nothing in his range`);
    const far = h.spawn('enemy_dummy', { pos: [10, 7] });
    assert.ok(h.runUntil(() => u.skill.active, 1), `${label([elite])}: an enemy 2 tiles ahead (the running range)`);
    assert.deepEqual(u.liveRangeGrid, [[0, 0], [0, 1], [0, 2]], `${label([elite])}: 攻击距离+1`);
    approx(u.skill.timeLeft, 70, `${label([elite])}: 70 s`, 0.01);
    approx(u.s.maxHp, u.base.maxHp * (1 + sk.bb.max_hp), `${label([elite])}: max HP`);
    approx(u.s.atk, u.base.atk * (1 + sk.bb.atk), `${label([elite])}: ATK`);
    const t0 = h.hooksOf('skillStart').find((c) => c.unit === u).t;
    h.run(10);
    const ticks = (e) => h.hooksOf('damaged').filter((c) => c.target === e && c.credit === u && c.source === null && (c.dmg?.tags ?? []).includes('periodic'));
    const onFar = ticks(far);
    assert.ok(onFar.length >= 8 && onFar.every((c) => c.amount === 200 && c.type === 'true'), `${label([elite])}: 200 无来源 true / s on the enemy he attacked (${onFar.length})`);
    assert.equal(ticks(near).length, 0, `${label([elite])}: none on an enemy he never attacked`);
    const losses = h.hooksOf('damaged').filter((c) => c.target === u && (c.dmg?.tags ?? []).includes('hpLoss') && c.t >= t0);
    assert.ok(losses.length >= 9 && losses.every((c) => c.amount === 100), `${label([elite])}: 每秒流失100点生命 (${losses.length})`);
    const heals = h.hooksOf('heal').filter((c) => c.target === u && c.source === u && c.t >= t0);
    const attacks = h.hooksOf('attack').filter((c) => c.attacker === u && c.t >= t0);
    assert.ok(heals.length >= 2 && Math.abs(heals.length - attacks.length) <= 1, `${label([elite])}: one heal per attack (${heals.length} / ${attacks.length})`);
    // an enemy that attacks him joins
    const brute = h.spawn('enemy_brute', { routeIndex: 1 });
    assert.ok(h.runUntil(() => ticks(brute).length >= 2, 40), `${label([elite])}: the brute that hit him burns too`);
    h.b.kill(brute, null);
    u.hp = u.s.maxHp;
    // the stun roll over many attacks ≈ 25 %
    u.skill.extend(600);
    const s0 = h.hooksOf('statusApplied').filter((s) => s.source === u && s.status === 'stun' && s.target === far).length;
    const a0 = atkHits(h, u).filter((c) => c.target === far).length;
    h.run(500);
    const sN = h.hooksOf('statusApplied').filter((s) => s.source === u && s.status === 'stun' && s.target === far);
    const aN = atkHits(h, u).filter((c) => c.target === far).length - a0;
    const rate = (sN.length - s0) / aN;
    assert.ok(rate > 0.17 && rate < 0.33 && sN.every((s) => s.duration === sk.bb['attack@stun']), `${label([elite])}: stun ${(rate * 100).toFixed(1)} % ≈ 25 %, ${sk.bb['attack@stun']} s`);
    u.skill.end('test');
    const n = ticks(far).length;
    h.run(3);
    assert.equal(ticks(far).length, n, `${label([elite])}: no tick after the skill`);
    assert.deepEqual(u.liveRangeGrid, [[0, 0], [0, 1]], `${label([elite])}: 1-1 again`);
    done(h);
  }
});
