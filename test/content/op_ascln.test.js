// test/content/op_ascln.test.js — the kit of 阿斯卡纶 (char_4132_ascln, 6★ 伏击客; server/sim/content/kits/ops/op-ascln.js),
// fielded the production way after OPEN-4 promoted her to a 「巴别塔」 shop chess: the record of chess_char_3_05_babel_a
// (E2 Lv1, skill rank 4) / _b (E2 Lv60, rank 7) in data/chess.json, registered by ops/chess_char_3_05_babel-ascln.js (her
// charId left `backups.json units` and `diy.ownedPool`, so the old 自选 slot path is gone). Newer numbers are read back from
// data/chess.json; the fidelity checklist of kits/README.md.
// 转正后的商店棋照官方 PRESET 惯例带模组（maintainer 2026-10-12「为维什戴尔等有模组的角色添加模组」）：精锐 `_b`
// `equipLevel` 1（T3）⇒ AMB-X 无形，无情活性（`module.active` true，`modules[]` = AMB-X + AMB-Y），普通 `_a` 保持
// `equipLevel` 0。AMB-X 一阶带来 maxHp +180 / atk +15 与隐藏天赋「攻击范围内所有敌人移动速度-20%」（`fromModule`
// talent −1，bb `move_speed` −0.2，kit 读它给范围内敌人挂 `ascln:ambx#<id>` 的 moveMul 0.8）；AMB-Y 是可选的另一个
// 模组（atk +55 / def +25，特性 bb `prob` 0.65 = 65 % 闪避）。下面按数据读回并**实跑**核对。
// Run: node test/content/op_ascln.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITTED_CHARS, KITS } from '../../server/sim/content/kits/index.js';
import { dreadKey, DREAD_TAG } from '../../server/sim/content/kits/ops/op-ascln.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../../data/${f}.json`, import.meta.url), 'utf8'));
const CHESS = load('chess');
const ASC = 'char_4132_ascln';
const A = 'chess_char_3_05_babel_a', B = 'chess_char_3_05_babel_b';
const rec = (elite) => CHESS[elite ? B : A];
const AX = 'uniequip_002_ascln', AY = 'uniequip_003_ascln';   // the elite's default and its other module choice
const S1 = 'skchr_ascln_1', S2 = 'skchr_ascln_2', S3 = 'skchr_ascln_3';
const skillOf = (elite, id) => rec(elite).skills.find((s) => s.skillId === id);
const dodgeOf = (elite) => Number(rec(elite).trait.bb.prob);
const approx = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
const dummy = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, mass: 0, ...o });
const ENEMIES = {
  enemy_dummy: dummy('enemy_dummy'), enemy_fly: dummy('enemy_fly', { motion: 'FLY' }), enemy_weak: dummy('enemy_weak', { hp: 10 }),
  enemy_hitter: dummy('enemy_hitter', { atk: 200, range: 1.5, bat: 0.5 }),
  enemy_walkslow: enemyRec({ key: 'enemy_walkslow', hp: 1e9, speed: 1, mass: 0 }),
};
const FORMS_ALL = [[false], [true]];
const label = ([elite]) => (elite ? 'elite' : 'normal');

/** 阿斯卡纶 as uid 1 at (row, col) facing RIGHT, plus `others`. */
function field({ elite = false, skill = 0, row = 10, col = 5, others = [], seed = 5 } = {}) {
  const h = makeBattle({
    defs: { enemies: ENEMIES }, timeLimit: 900, autoFinish: false, seed,
    flags: { dpPerSec: 0, dpMax: 999 }, hooks: ['damaged', 'skillStart', 'skillEnd', 'statusApplied', 'death', 'attack', 'heal', 'dodge'], captureNoisy: true,
    units: [{ uid: 1, chessId: elite ? B : A, skillIndex: skill, elite, row, col }, ...others],
  });
  h.step();
  return { h, u: h.unit(1) };
}
const atkHits = (h, u) => h.hooksOf('damaged').filter((c) => c.source === u && c.dmg?.isAttack);
function done(h) {
  checkInvariants(h.b);
  assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0]));
}
/** Keep her from casting (no SP). */
function noSkill(h, u) {
  u.skill.charges = 0; u.skill.sp = 0;
  h.b.addBuff(u, { key: 'test:noSp', flags: { noSp: true } });
}

test('阿斯卡纶 in both forms: her kit (all three skills authored), the record\'s stats (AMB-X on the elite only), y-1, 伏击客 (melee, every enemy in range, ground only, 50 % dodge, taunt level −1 — not −2), blocks 0, the data triggers', () => {
  assert.equal(typeof KITS[A], 'function');
  for (const f of FORMS_ALL) {
    const [elite] = f;
    for (const skill of [0, 1, 2]) {
      const { h, u } = field({ elite, skill });
      const r = rec(elite);
      assert.deepEqual([u.def.charId, u.def.baseId, u.skill.id, !!u.kit.generic, u.kit.skillSource], [ASC, A, r.skills[skill].skillId, false, 'skills'], label(f));
      assert.deepEqual([u.base.maxHp, u.base.atk, u.base.def, u.base.res], [r.stats.maxHp, r.stats.atk, r.stats.def, 30], `${label(f)}: stats`);
      assert.deepEqual([u.s.blockCnt, u.profile.attack, u.profile.canHitFly, u.profile.dmgType, u.profile.allInRange, u.profile.sub, u.base.bat],
        [0, 'melee', false, 'phys', true, 'stalker', 3.5], `${label(f)}: 伏击客`);
      // her dodge is the data's trait `prob` through the kit (`traitBb(chess).prob`, default 0.5) — 50 % in both forms
      assert.deepEqual([u.s.dodgePhys, u.s.dodgeArts, u.s.taunt], [dodgeOf(elite), dodgeOf(elite), -1], `${label(f)}: dodge, taunt −1`);
      assert.deepEqual(u.liveRangeGrid, r.rangeGrid, `${label(f)}: y-1`);
      assert.equal(u.skill.rule, r.skills[skill].trigger.rule, `${label(f)}: the data's trigger`);
      assert.ok(!u.s.flags.liftoff && !u.s.flags.camou && !u.s.flags.stealth && !u.s.flags.untargetable, `${label(f)}: ground enemies can target her`);
      done(h);
    }
  }
  assert.deepEqual(rec(true).skills.map((s) => s.trigger.rule), ['DEFAULT', 'DEFAULT', 'ACTIVE_RANGE']);
});

test('a 商店棋: 阿斯卡纶 is the visible T3 巴别塔 preset with a hand-authored kit — and is no longer a 自选 pick', () => {
  for (const id of [A, B]) {
    const r = CHESS[id];
    assert.deepEqual([r.charId, r.tier, r.visible, r.chessType, r.isDiy], [ASC, 3, true, 'PRESET', false], id);
    assert.ok(r.bonds.includes('babelShip') && r.bonds.includes('raidShip'), id);
  }
  // OPEN-4: her charId left `backups.json diy.ownedPool`, so the 自选 picker no longer offers her (KITTED_CHARS lists the
  // picks a 自选 slot may field — the shop chess is fielded by its chess id instead, ops/chess_char_3_05_babel-ascln.js)
  assert.equal(KITTED_CHARS.includes(ASC), false);
  // the registry key is the pair's base id (`_a`): the elite `_b` record resolves through it (content/index.js kitOf)
  assert.equal(Object.prototype.hasOwnProperty.call(KITS, B), false);
});

test('AMB-X 无形，无情 is the elite’s active default: maxHp +180 / atk +15 and 「攻击范围内所有敌人移动速度-20%」 live (AMB-Y 阿斯卡纶的眼睛, the other choice, is atk +55 / def +25 with 65 % dodge)', () => {
  const b = rec(true), a = rec(false);
  assert.deepEqual([a.status.equipLevel, a.module.id, a.module.active, a.modules], [0, AX, false, undefined]);
  assert.deepEqual([b.status.equipLevel, b.module.id, b.module.active, b.module.type, b.module.level], [1, AX, true, 'AMB-X', 1]);
  assert.deepEqual(b.modules.map((m) => [m.uniEquipId, m.isDefault, m.level]), [[AX, true, 1], [AY, false, 1]]);
  // AMB-X: the hidden talent −1 (`move_speed` −0.2) rides on the record's talents as `fromModule`; its trait part adds
  // the display line only, so the record's trait keeps the class bb (prob 0.5)
  const hidden = b.talents.find((t) => t.fromModule);
  assert.deepEqual([hidden.index, hidden.bb], [-1, { move_speed: -0.2 }]);
  assert.equal(a.talents.find((t) => t.fromModule), undefined, 'the normal form carries no module talent');
  assert.deepEqual([b.modules[0].attr, b.modules[1].attr], [{ maxHp: 180, atk: 15 }, { atk: 55, def: 25 }]);
  // the module's own trait line is a display-only addition: the record's trait keeps the class bb (prob 0.5)
  assert.equal(b.trait.bb.prob, 0.5, 'AMB-X leaves the class dodge');
  assert.match(b.trait.moduleDesc, /移动速度-20%/);
  // AMB-Y is not the default: it is the module with the 65 % dodge trait override
  assert.deepEqual(b.modules[1].traitOverride.bb, { prob: 0.65 });
  // the normal form keeps its own (E2 Lv1) body, the elite its E2 Lv60 base plus the module's attr
  assert.equal(a.stats.maxHp, 1393, 'the normal form keeps its own no-module body');
  assert.deepEqual([b.statsBase.maxHp + b.modules[0].attr.maxHp, b.statsBase.atk + b.modules[0].attr.atk], [b.stats.maxHp, b.stats.atk]);
  // live: the elite's AMB-X slows every enemy of her range ×0.8 (`ascln:ambx#<id>`, one per 阿斯卡纶); the normal form does not
  for (const elite of [false, true]) {
    const { h, u } = field({ elite, skill: 1 });
    noSkill(h, u);
    const e = h.spawn('enemy_dummy', { pos: [10, 7] });
    h.run(0.5);
    const ambx = e.buffs.filter((x) => String(x.key).startsWith('ascln:ambx'));
    assert.equal(ambx.length, elite ? 1 : 0, `${label([elite])}: AMB-X aura on an enemy of her range`);
    if (elite) approx(ambx[0].mods.moveMul, 0.8, `${label([elite])}: ×(1 − 20 %)`);
    done(h);
  }
});

test('trait 伏击客: one attack strikes every ground enemy of her y-1 at once (physical), never a flyer; her dodge lets 50 % of the enemy hits through as dodges', () => {
  for (const [elite] of FORMS_ALL) {
    const { h, u } = field({ elite, skill: 1 });
    noSkill(h, u);
    const a = h.spawn('enemy_dummy', { pos: [10, 6] }), b = h.spawn('enemy_dummy', { pos: [11, 4] }), c = h.spawn('enemy_dummy', { pos: [10, 7] });
    const fly = h.spawn('enemy_fly', { pos: [9, 5] });
    assert.ok(h.runUntil(() => atkHits(h, u).length >= 3, 6));
    const id = atkHits(h, u)[0].dmg.attackId;
    const hit = atkHits(h, u).filter((x) => x.dmg.attackId === id);
    assert.deepEqual(new Set(hit.map((x) => x.target)), new Set([a, b, c]), `${label([elite])}: every ground enemy of y-1 ([0,2] included)`);
    for (const x of hit) assert.equal(x.type, 'phys');
    assert.ok(!atkHits(h, u).some((x) => x.target === fly), 'never the flyer');
    // her dodge (65 % was AMB-Y's — see the skipped module case above)
    const hitter = h.spawn('enemy_hitter', { pos: [10, 6] });
    h.b.addBuff(u, { key: 'test:inv', mods: { defFlat: 1e6 } });
    h.run(200);
    const dodged = h.hooksOf('dodge').filter((x) => x.target === u && x.source === hitter).length;
    const landed = h.hooksOf('damaged').filter((x) => x.target === u && x.source === hitter).length;
    const r = dodged / (dodged + landed);
    assert.ok(dodged + landed > 200 && Math.abs(r - 0.5) < 0.06, `${label([elite])}: dodge rate ${r}`);
    done(h);
  }
});

test('T1 死亡拘审: every hit of her attacks adds a layer (≤ 3, the duration reset): move ×(1 − 0.18 × layers), layers × 10 % of her current ATK as arts every second (法术持续伤害: not dodgeable) for 25 s; all of it ends the moment she leaves', () => {
  for (const f of FORMS_ALL) {
    const [elite] = f;
    // AMB-X stage 3 raised these to 11 % / 30 s — see the skipped module case above
    const [ratio, dur] = [0.1, 25];
    const tb = rec(elite).talents.find((t) => t.index === 0).bb;
    assert.deepEqual(tb, { move_speed: -0.18, atk_ratio: 0.1, max_stack_cnt: 3, debuff_duration: 25, interval: 1 }, label(f));
    const { h, u } = field({ elite, skill: 1 });
    noSkill(h, u);
    const e = h.spawn('enemy_dummy', { pos: [10, 6] });
    h.b.addBuff(e, { key: 'test:dodge', mods: { dodgePhys: 1, dodgeArts: 1 } });
    const key = dreadKey(u);
    // a dodged attack lands nothing and adds nothing
    h.run(4);
    assert.equal(e.findBuff(key), null, `${label(f)}: dodged hits add no layer`);
    h.b.removeBuff(e, 'test:dodge');
    const n0 = atkHits(h, u).length;
    assert.ok(h.runUntil(() => atkHits(h, u).length > n0, 5));
    let b = e.findBuff(key);
    assert.deepEqual([b.data.n, b.duration], [1, dur], 'one layer');
    approx(b.mods.moveMul, 0.82, 'move ×0.82');
    // its ticks: 10 % × layers of her current ATK, arts, not dodgeable
    const ticks = () => h.hooksOf('damaged').filter((c) => c.source === u && c.dmg.tags?.includes(DREAD_TAG));
    h.run(1.05);
    const t1 = ticks();
    assert.ok(t1.length >= 1, 'a tick');
    approx(t1[0].amount, u.s.atk * ratio * 1, `${label(f)}: ${ratio * 100} % ATK × 1`);
    assert.deepEqual([t1[0].type, t1[0].dmg.canDodge, t1[0].dmg.isAttack], ['arts', false, false]);
    assert.ok(h.runUntil(() => e.findBuff(key)?.data.n === 3, 15), 'three layers');
    b = e.findBuff(key);
    approx(b.mods.moveMul, 1 - 0.18 * 3, 'move ×0.46');
    h.run(5);
    assert.equal(e.findBuff(key).data.n, 3, '≤ 3 layers');
    const last = ticks().slice(-1)[0];
    approx(last.amount, u.s.atk * ratio * 3, 'three layers tick ×3');
    approx(e.findBuff(key).timeLeft, dur, 'reset on each hit', 0.15);
    // no more hits: it runs out after its duration
    h.b.addBuff(u, { key: 'test:disarm', flags: { disarm: true } });
    const tLast = atkHits(h, u).filter((c) => c.target === e).slice(-1)[0].t;
    h.run(tLast + dur - 0.3 - h.b.time);
    assert.ok(e.findBuff(key), 'still there');
    h.run(0.6);
    assert.equal(e.findBuff(key), null, `gone ${dur} s after the last hit`);
    // she leaves: every layer of hers ends at once
    h.b.removeBuff(u, 'test:disarm');
    h.runUntil(() => e.findBuff(key), 5);
    h.b.retreat(u);
    assert.equal(e.findBuff(key), null, 'ends the moment she leaves');
    done(h);
  }
});

test('T2 噬光残影: ASPD +10; +6 more with 高台 (HIGHLAND) among the four tiles next to her — the ranged wall on her left, the forbidden rim below', () => {
  for (const [row, col, high] of [[10, 5, false], [10, 3, true], [12, 6, true], [11, 5, false]]) {
    const { h, u } = field({ elite: true, skill: 1, row, col });
    approx(u.s.aspd, 100 + 10 + (high ? 6 : 0), `(${row},${col}): ASPD`);
    approx(u.s.interval, 3.5 * 100 / u.s.aspd, 'interval');
    done(h);
  }
  assert.deepEqual(rec(false).talents.find((t) => t.index === 1).bb, { attack_speed: 10, attack_speed_add: 6, cnt: 1 });
});

test('S1 追袭 (AUTO, 2 / 3 charges, data DEFAULT): the next attack strikes every enemy of her range twice at 130 % / 170 % ATK — two 死亡拘审 layers', () => {
  for (const [elite] of FORMS_ALL) {
    const sk = skillOf(elite, S1);
    assert.deepEqual([sk.spCost, sk.initSp, sk.maxChargeTime, sk.bb.atk_scale, sk.skillType], elite ? [8, 4, 3, 1.7, 'AUTO'] : [10, 2, 2, 1.3, 'AUTO'], label([elite]));
    const { h, u } = field({ elite, skill: 0 });
    assert.deepEqual([u.skill.kind, u.skill.rule, u.skill.maxCharges], ['charges', 'DEFAULT', elite ? 3 : 2]);
    const a = h.spawn('enemy_dummy', { pos: [10, 6] }), b = h.spawn('enemy_dummy', { pos: [11, 5] });
    u.skill.gainSp(999);
    assert.ok(h.runUntil(() => u.skill.activations === 1, 3), `${label([elite])}: cast on her next attack`);
    h.step();
    const hits = atkHits(h, u).filter((c) => c.dmg.isSkill);
    assert.equal(hits.length, 4, `${label([elite])}: 2 enemies × 2 strikes`);
    for (const c of hits) approx(c.amount, u.s.atk * sk.bb.atk_scale, `${label([elite])}: ×${sk.bb.atk_scale}`);
    assert.deepEqual([a.findBuff(dreadKey(u)).data.n, b.findBuff(dreadKey(u)).data.n], [2, 2], `${label([elite])}: two layers each`);
    assert.equal(u.skill.charges, u.skill.maxCharges - 1, 'one charge spent');
    done(h);
  }
});

test('S2 恩赐 (MANUAL, 35 s, data DEFAULT): ATK +50 % / +90 %; every enemy of her range — air units too (PRTS 修正) — moves ×0.7 / ×0.6; a ground enemy of her range knocked out gives one 死亡拘审 layer to the ground enemies within 1.3 of it (not flyers, not beyond)', () => {
  for (const [elite] of FORMS_ALL) {
    const sk = skillOf(elite, S2);
    assert.deepEqual([sk.duration, sk.spCost, sk.initSp, sk.bb.atk, sk.bb.move_speed, sk.bb.range_radius], [35, elite ? 24 : 27, elite ? 10 : 5, elite ? 0.9 : 0.5, elite ? -0.4 : -0.3, 1.3], label([elite]));
    const { h, u } = field({ elite, skill: 1 });
    assert.deepEqual([u.skill.kind, u.skill.rule], ['duration', 'DEFAULT']);
    const weak = h.spawn('enemy_weak', { pos: [10, 6] });
    h.b.addBuff(weak, { key: 'test:dodge', mods: { dodgePhys: 1 } });
    const near = h.spawn('enemy_dummy', { pos: [11, 6] });   // 1 tile from it, in her range too
    const fly = h.spawn('enemy_fly', { pos: [10, 7] });      // in her range (air), 1 tile from it
    const out = h.spawn('enemy_dummy', { pos: [9, 8] });     // outside her range, √5 from it
    h.b.addBuff(near, { key: 'test:dodge', mods: { dodgePhys: 1 } });
    u.skill.gainSp(999);
    assert.ok(h.runUntil(() => u.skill.active, 5), `${label([elite])}: cast`);
    approx(u.skill.timeLeft, 35, '35 s', 0.01);
    approx(u.s.atk, u.base.atk * (1 + sk.bb.atk), `${label([elite])}: ATK`);
    h.run(0.3);
    for (const e of [weak, near, fly]) approx(e.findBuff('ascln:s2slow')?.mods.moveMul ?? 1, 1 + sk.bb.move_speed, `${label([elite])}: ${e.defId} slowed`);
    assert.equal(out.findBuff('ascln:s2slow'), null, 'not outside her range');
    // the knock-out: one layer on the ground enemy next to it; the flyer and the far one get none
    h.b.removeBuff(weak, 'test:dodge');
    assert.ok(h.runUntil(() => !weak.alive, 10), 'knocked out');
    assert.equal(near.findBuff(dreadKey(u))?.data.n, 1, `${label([elite])}: a layer on the ground enemy within 1.3`);
    assert.equal(fly.findBuff(dreadKey(u)), null, 'never a flyer');
    assert.equal(out.findBuff(dreadKey(u)), null, 'not beyond 1.3');
    u.skill.extend(-999);
    h.step(2);
    h.run(0.5);
    assert.equal(near.findBuff('ascln:s2slow'), null, `${label([elite])}: the slow ends with the skill`);
    done(h);
  }
});

test('S3 降临 (MANUAL, 45 s, data ACTIVE_RANGE on y-10): an enemy only on y-10 casts it; range y-10; ATK +20 %, interval 3.5 − 1.2 / 1.5 s, taunt level −1 → +1; ground enemies of her range miss 15 % / 30 % of their attacks (one roll per attack), and a miss on her or a dodge of hers heals 4 % / 5 % of her max HP', () => {
  for (const [elite] of FORMS_ALL) {
    const sk = skillOf(elite, S3);
    assert.deepEqual([sk.duration, sk.spCost, sk.initSp, sk.bb.atk, sk.bb.base_attack_time, sk.bb.taunt_level, sk.bb['attack@hp_ratio'], sk.bb['attack@damage_hitrate_physical'], sk.rangeId],
      [45, elite ? 49 : 53, elite ? 30 : 25, 0.2, elite ? -1.5 : -1.2, 2, elite ? 0.05 : 0.04, elite ? -0.3 : -0.15, 'y-10'], label([elite]));
    const { h, u } = field({ elite, skill: 2 });
    assert.deepEqual([u.skill.kind, u.skill.rule], ['duration', 'ACTIVE_RANGE']);
    u.skill.gainSp(999);
    const far = h.spawn('enemy_dummy', { pos: [12, 5] });   // [2,0]: in y-10, not in y-1
    assert.ok(h.runUntil(() => u.skill.active, 1), `${label([elite])}: cast for [2,0]`);
    assert.deepEqual(u.liveRangeGrid, sk.rangeGrid, `${label([elite])}: y-10 while it runs`);
    approx(u.s.atk, u.base.atk * 1.2, 'ATK +20 %');
    approx(u.s.interval, (3.5 + sk.bb.base_attack_time) * 100 / u.s.aspd, 'interval');
    assert.equal(u.s.taunt, 1, 'taunt level +1');
    h.b.kill(far, null);
    // a ground hitter in her range: count its attacks before and after the 命中率 roll
    const hitter = h.spawn('enemy_hitter', { pos: [10, 6] });
    h.b.addBuff(hitter, { key: 'test:dodge', mods: { dodgePhys: 1 } });   // she never kills it
    const seen = new Set(), passed = new Set();
    h.b.on('hit', (c) => { if (c.source === hitter && c.dmg.isAttack) seen.add(c.dmg.attackId); }, { priority: 295 });
    h.b.on('hit', (c) => { if (c.source === hitter && c.dmg.isAttack && !c.dmg.cancel) passed.add(c.dmg.attackId); }, { priority: 280 });
    h.b.on('fatal', (c) => { if (c.unit === u) c.prevented = true; });
    h.b.addBuff(u, { key: 'test:tough', mods: { defFlat: 1e6 } });
    const heals0 = h.hooksOf('heal').filter((c) => c.target === u).length;
    u.skill.extend(400);
    h.run(300);
    const r = 1 - passed.size / seen.size;
    assert.ok(seen.size > 400 && Math.abs(r - Math.abs(sk.bb['attack@damage_hitrate_physical'])) < 0.05, `${label([elite])}: miss rate ${r} (${seen.size} attacks)`);
    const dodges = h.hooksOf('dodge').filter((c) => c.target === u && c.source === hitter).length;
    const heals = h.hooksOf('heal').filter((c) => c.target === u).length - heals0;
    assert.equal(heals, (seen.size - passed.size) + dodges, `${label([elite])}: a heal per miss on her and per dodge`);
    approx(h.hooksOf('heal').filter((c) => c.target === u).slice(-1)[0].amount, u.s.maxHp * sk.bb['attack@hp_ratio'], `${label([elite])}: ${sk.bb['attack@hp_ratio'] * 100} % max HP`, 1e-3);
    u.skill.extend(-999);
    h.step(2);
    assert.deepEqual([u.s.taunt, u.liveRangeGrid], [-1, rec(elite).rangeGrid], `${label([elite])}: back`);
    done(h);
  }
});

test('AMB-Y 阿斯卡纶的眼睛: the 拥有该效果的敌人被击倒时阿斯卡纶回复10%生命 talent change is stage-3 source data, and the kit honours a record that carries `hp_ratio` (10 % of her max HP whoever knocks the marked enemy out)', () => {
  // AMB-Y's stage-1 `talentChanges` are empty: the heal is stage 3's (`hp_ratio` 0.1), and this chess is T3, so the
  // elite's module stage is 1 and the shipped record cannot show it. The kit reads `talentBb(chess, 0).hp_ratio`
  // (kits/ops/op-ascln.js: `const hr = num(t0.hp_ratio)` on the marked enemy's death), so the case is exercised by a
  // record that carries the stage-3 value — the shape the data would have the day a stage-3 阿斯卡纶 is fielded.
  const b = rec(true);
  const ay = b.modules.find((m) => m.uniEquipId === AY);
  assert.deepEqual(ay.talentChanges, [], 'AMB-Y at stage 1 changes no talent (the heal is stage 3)');
  assert.equal(b.talents.find((t) => t.index === 0).bb.hp_ratio, undefined, 'the shipped elite (AMB-X) has none either');
  const bd = b.statsBase ?? b.stats;
  const pct = 0.1;
  const variant = {
    ...b,
    stats: { ...bd, maxHp: bd.maxHp + ay.attr.maxHp, atk: bd.atk + ay.attr.atk, def: bd.def + ay.attr.def, res: bd.res + (ay.attr.res ?? 0) },
    trait: ay.traitOverride ?? b.traitBase ?? b.trait,
    talents: b.talentsBase.map((t) => (t.index === 0 ? { ...t, bb: { ...t.bb, hp_ratio: pct }, fromModule: true } : t)),
    module: { id: AY, name: ay.name, type: ay.typeName, level: 1, active: true },
  };
  const h = makeBattle({
    defs: { enemies: ENEMIES, chess: { [B]: variant } }, timeLimit: 900, autoFinish: false, seed: 5,
    flags: { dpPerSec: 0, dpMax: 999 }, hooks: ['damaged', 'death', 'heal', 'attack'], captureNoisy: true,
    units: [{ uid: 1, chessId: B, skillIndex: 1, elite: true, row: 10, col: 5 }],
  });
  h.step();
  const u = h.unit(1);
  assert.equal(variant.module.active, true, 'the AMB-Y variant is the active module');
  const e = h.spawn('enemy_dummy', { pos: [10, 6] });
  h.b.addBuff(e, { key: dreadKey(u), source: u, tags: [DREAD_TAG] });
  assert.ok(e.findBuff(dreadKey(u)), '死亡拘审 on the enemy');
  u.hp = 100;
  const before = u.hp;
  h.b.dealDamage(u, e, { amount: 1e12, type: 'phys' });
  assert.equal(e.alive, false, 'knocked out');
  const heal = h.hooksOf('heal').find((c) => c.target === u);
  assert.ok(heal, '阿斯卡纶 healed');
  approx(heal.amount, u.s.maxHp * pct, `${pct * 100} % of her max HP`);
  assert.ok(u.hp > before, 'her HP went up');
  done(h);
});

test('without the 死亡拘审 hp_ratio (the shipped AMB-X default) a knock-out of a marked enemy heals nothing', () => {
  for (const [elite] of FORMS_ALL) {
    const { h, u } = field({ elite, skill: 1 });
    noSkill(h, u);
    const e = h.spawn('enemy_dummy', { pos: [10, 6] });
    assert.ok(h.runUntil(() => e.findBuff(dreadKey(u)), 6), `${label([elite])}: marked`);
    u.hp = 100;
    const h0 = h.hooksOf('heal').filter((c) => c.target === u).length;
    h.b.kill(e, null);   // knocked out by anybody
    assert.equal(h.hooksOf('heal').filter((c) => c.target === u).length, h0, `${label([elite])}: no heal`);
    // an unmarked enemy: nothing either
    const plain = h.spawn('enemy_dummy', { pos: [12, 8] });
    h.b.kill(plain, null);
    assert.equal(h.hooksOf('heal').filter((c) => c.target === u).length, h0, `${label([elite])}: still none`);
    done(h);
  }
});
