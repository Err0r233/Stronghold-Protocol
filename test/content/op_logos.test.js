// test/content/op_logos.test.js — the kit of 逻各斯 (char_4133_logos, 6★ 中坚术师; server/sim/content/kits/ops/op-logos.js),
// fielded the production way after OPEN-4 promoted him to a 「巴别塔」 shop chess: the record of chess_char_5_07_babel_a
// (E2 Lv1, skill rank 4) / _b (E2 Lv60, rank 7) in data/chess.json, registered by ops/chess_char_5_07_babel-logos.js (his
// charId left `backups.json units` and `diy.ownedPool`, so the old 自选 slot path is gone). Every number is read back from
// data/chess.json; the fidelity checklist of kits/README.md item by item.
// 转正后的商店棋照官方 PRESET 惯例带模组（maintainer 2026-10-12「为维什戴尔等有模组的角色添加模组」）：精锐 `_b`
// `equipLevel` 1（T5）⇒ CCR-Δ 来自河谷的笔盒活性（`module.active` true，`modules[]` = CCR-Δ + CCR-Y），普通 `_a` 保持
// `equipLevel` 0。CCR-Δ 一阶带来 maxHp +100 / atk +36 与隐藏天赋「造成法术伤害时附带相当于8%伤害的凋亡损伤」
// （`fromModule` talent −1，bb `ep_damage_ratio` 0.08，kit 读它给每次法术伤害附 8 % 凋亡损伤），所以下面按
// `rec(elite).talents` / `trait.bb` 读回这些值并**实跑**核对元素伤害。
// Run: node test/content/op_logos.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITTED_CHARS, KITS } from '../../server/sim/content/kits/index.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../../data/${f}.json`, import.meta.url), 'utf8'));
const CHESS = load('chess');
const LOGOS = 'char_4133_logos';
const A = 'chess_char_5_07_babel_a', B = 'chess_char_5_07_babel_b';
const rec = (elite) => CHESS[elite ? B : A];
const CCRD = 'uniequip_002_logos', CCRY = 'uniequip_003_logos';   // the elite's default and its other module choice
const S1 = 'skchr_logos_1', S2 = 'skchr_logos_2', S3 = 'skchr_logos_3';
const skillOf = (elite, id) => rec(elite).skills.find((s) => s.skillId === id);
/** The talent bb of a form (the elite's `talents` also carry CCR-Δ's `fromModule` entry at index −1). */
const talentOf = (elite, i) => rec(elite).talents.find((t) => t.index === i).bb;
const approx = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
const dummy = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, mass: 0, ...o });
const ENEMIES = {
  enemy_dummy: dummy('enemy_dummy'), enemy_fly: dummy('enemy_fly', { motion: 'FLY' }), enemy_elite: dummy('enemy_elite', { rank: 'ELITE' }),
  enemy_boss: dummy('enemy_boss', { rank: 'BOSS' }), enemy_low: dummy('enemy_low', { hp: 300 }),
  enemy_gun: dummy('enemy_gun', { atk: 100, range: 3, bat: 1, applyWay: 'RANGED' }),
};
const FORMS_ALL = [[false], [true]];
const label = ([elite]) => (elite ? 'elite' : 'normal');

/** A battle with 逻各斯 as uid 1 at (row, col) facing RIGHT. */
function field({ elite = false, skill = 0, row = 10, col = 5, others = [], seed = 5, setup } = {}) {
  const h = makeBattle({
    defs: { enemies: ENEMIES }, timeLimit: 900, autoFinish: false, seed, setup,
    flags: { dpPerSec: 0 }, hooks: ['damaged', 'skillStart', 'skillEnd', 'statusApplied', 'attack', 'elementBurst'], captureNoisy: true,
    units: [{ uid: 1, chessId: elite ? B : A, skillIndex: skill, elite, row, col }, ...others],
  });
  h.step();
  return { h, u: h.unit(1) };
}
const atkHits = (h, u) => h.hooksOf('damaged').filter((c) => c.source === u && c.dmg?.isAttack);
const tagged = (h, u, tag) => h.hooksOf('damaged').filter((c) => c.source === u && (c.dmg?.tags || []).includes(tag));
function done(h) {
  checkInvariants(h.b);
  assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0]));
}
/** Start the skill now (SP filled, no enemy needed). */
function cast(u) { u.skill.gainSp(999); assert.ok(u.skill.activate('test')); }

test('逻各斯 in both forms: his operator kit (all three skills authored), the record\'s stats (no module attributes), 3-1 range, ranged arts that hits air units, targetable by ground enemies, 巴别塔 + 奥术, 特质 garrison_169', () => {
  assert.equal(typeof KITS[A], 'function');
  for (const f of FORMS_ALL) {
    const [elite] = f;
    for (const skill of [0, 1, 2]) {
      const { h, u } = field({ elite, skill });
      const r = rec(elite);
      assert.deepEqual([u.def.charId, u.def.baseId, u.skill.id, !!u.kit.generic, u.kit.skillSource], [LOGOS, A, r.skills[skill].skillId, false, 'skills'], label(f));
      assert.deepEqual([u.base.maxHp, u.base.atk, u.base.def, u.base.res], [r.stats.maxHp, r.stats.atk, r.stats.def, r.stats.res], `${label(f)}: stats`);
      assert.deepEqual([u.s.blockCnt, u.profile.attack, u.profile.dmgType, u.profile.canHitFly, u.base.bat], [1, 'ranged', 'arts', true, 1.6], `${label(f)}: 中坚术师`);
      assert.deepEqual(u.liveRangeGrid, r.rangeGrid, `${label(f)}: 3-1`);
      assert.deepEqual([u.def.bonds, u.def.raw.garrisonIds], [['babelShip', 'arcaneShip'], [elite ? 'garrison_169_b' : 'garrison_169_a']], `${label(f)}: bonds / 特质`);
      assert.ok(!u.s.flags.liftoff && !u.s.flags.camou && !u.s.flags.stealth, `${label(f)}: ground enemies target him`);
      done(h);
    }
  }
  // the numbers of the forms (zh_CN, full potential): E2 Lv1 1297 / 583, E2 Lv60 1540 / 659 no-module base, + CCR-Δ
  // stage 1 (maxHp +100 / atk +36) on the elite = 1640 / 695
  assert.deepEqual([rec(false).stats.maxHp, rec(false).stats.atk, rec(true).stats.maxHp, rec(true).stats.atk], [1297, 583, 1640, 695]);
  assert.deepEqual([rec(true).statsBase.maxHp, rec(true).statsBase.atk], [1540, 659]);
});

test('a 商店棋: 逻各斯 is the visible T5 巴别塔 preset with a hand-authored kit — and is no longer a 自选 pick', () => {
  for (const id of [A, B]) {
    const r = CHESS[id];
    assert.deepEqual([r.charId, r.tier, r.visible, r.chessType, r.isDiy], [LOGOS, 5, true, 'PRESET', false], id);
    assert.ok(r.bonds.includes('babelShip') && r.bonds.includes('arcaneShip'), id);
  }
  // OPEN-4: his charId left `backups.json diy.ownedPool`, so the 自选 picker no longer offers him (KITTED_CHARS lists the
  // picks a 自选 slot may field — the shop chess is fielded by its chess id instead, ops/chess_char_5_07_babel-logos.js)
  assert.equal(KITTED_CHARS.includes(LOGOS), false);
  // the registry key is the pair's base id (`_a`): the elite `_b` record resolves through it (content/index.js kitOf)
  assert.equal(Object.prototype.hasOwnProperty.call(KITS, B), false);
});

test('CCR-Δ 来自河谷的笔盒 is the elite’s active default (maxHp +100 / atk +36, 8 % 凋亡损伤) and CCR-Y 《语义范式百科》 the other choice (atk +35 / res +5, 精英·领袖 SP +1)', () => {
  const b = rec(true), a = rec(false);
  assert.deepEqual([a.status.equipLevel, a.module.id, a.module.active, a.modules], [0, CCRD, false, undefined]);
  assert.deepEqual([b.status.equipLevel, b.module.id, b.module.active, b.module.type, b.module.level], [1, CCRD, true, 'CCR-D', 1]);
  assert.deepEqual(b.modules.map((m) => [m.uniEquipId, m.isDefault, m.level]), [[CCRD, true, 1], [CCRY, false, 1]]);
  assert.deepEqual([b.modules[0].attr, b.modules[1].attr], [{ maxHp: 100, atk: 36 }, { atk: 35, res: 5 }]);
  // CCR-Δ's rider is a hidden talent (`fromModule`, index −1) that the kit reads as `moduleBb(chess).ep_damage_ratio`
  assert.deepEqual(b.talents.find((t) => t.fromModule).bb, { ep_damage_ratio: 0.08 });
  assert.equal(a.talents.find((t) => t.fromModule), undefined, 'the normal form carries no module talent');
  // CCR-Y is not the default: its traitOverride (`sp` 1 on an elite / leader hit) is off this record
  assert.deepEqual(b.modules[1].traitOverride.bb, { sp: 1 });
  assert.equal(b.trait.bb.sp, undefined);
});

test('S1 殁亡 (AUTO, data DEFAULT): 74 / 68 SP from 0, cast as he is about to attack an enemy of his 3-1; then for good the 3-3 range and ATK +40 % / +70 %', () => {
  for (const [elite] of FORMS_ALL) {
    const sk = skillOf(elite, S1);
    const { h, u } = field({ elite, skill: 0 });
    assert.deepEqual([u.skill.rule, u.skill.kind, u.skill.spCost, sk.initSp, sk.bb.atk, sk.rangeId], ['DEFAULT', 'toggle', elite ? 68 : 74, 0, elite ? 0.7 : 0.4, '3-3'], label([elite]));
    h.run(sk.spCost - 1);
    assert.equal(u.skill.activations, 0, `${label([elite])}: not before its SP is full`);
    h.run(3);
    assert.equal(u.skill.activations, 0, `${label([elite])}: full SP, no enemy: no cast`);
    h.spawn('enemy_dummy', { pos: [10, 8] });
    assert.ok(h.runUntil(() => u.skill.active, 3), `${label([elite])}: cast with an enemy in his range`);
    assert.deepEqual(u.liveRangeGrid, sk.rangeGrid, `${label([elite])}: 3-3 while on`);
    approx(u.s.atk, u.base.atk * (1 + sk.bb.atk), `${label([elite])}: ATK`);
    h.run(200);
    assert.ok(u.skill.active, `${label([elite])}: 持续时间无限`);
    assert.deepEqual(u.liveRangeGrid, sk.rangeGrid, `${label([elite])}: still 3-3`);
    done(h);
  }
});

test('S1 殁亡 execution: an enemy of his range under 90 % / 120 % of his ATK falls at once (9999999 无来源 true damage, no dodge), then another random enemy of the range takes arts damage equal to the HP it had left; one try only on a survivor; air units too', () => {
  for (const [elite] of FORMS_ALL) {
    const sk = skillOf(elite, S1);
    let guard = null;
    const { h, u } = field({ elite, skill: 0, setup: (b) => b.on('fatal', (c) => { if (c.unit === guard) c.prevented = true; }) });
    cast(u);
    const thr = sk.bb['attack@kill_atk_scale'] * u.s.atk;
    assert.equal(sk.bb['attack@kill_damage'], 9999999);
    const big = h.spawn('enemy_dummy', { pos: [11, 8] });   // a 3-3 tile outside the 3-1 (the toggle's range counts)
    const low = h.spawn('enemy_fly', { pos: [10, 7] });
    const hp0 = thr * 0.6;
    low.hp = hp0;
    const high = h.spawn('enemy_dummy', { pos: [9, 6] });
    h.step();
    assert.ok(!low.alive, `${label([elite])}: the flyer under the threshold fell`);
    const kill = h.hooksOf('damaged').find((c) => c.target === low && (c.dmg?.tags || []).includes('execute'));
    assert.ok(kill && kill.source === null && kill.credit === u && kill.type === 'true' && kill.dmg.sourceless && !kill.dmg.canDodge, `${label([elite])}: 无来源 true, credited to him`);
    assert.equal(low.removeReason, 'killed');
    const follow = tagged(h, u, 'logosPerish');
    assert.equal(follow.length, 1, `${label([elite])}: one follow-up`);
    assert.ok([big, high].includes(follow[0].target) && follow[0].type === 'arts', `${label([elite])}: on another enemy of his range`);
    approx(follow[0].amount, hp0, `${label([elite])}: the HP the fallen one had left`);
    assert.ok(![big, high].some((e) => h.hooksOf('damaged').some((c) => c.target === e && (c.dmg?.tags || []).includes('execute'))), `${label([elite])}: above the threshold: no execution`);
    // an enemy that falls under the threshold while on his range is executed then (the aura checks every tick)
    high.hp = thr * 0.9;
    h.step();
    assert.ok(!high.alive, `${label([elite])}: executed once under the threshold`);
    // a survivor (不死) is never tried again
    guard = h.spawn('enemy_dummy', { pos: [10, 6] });
    guard.hp = thr * 0.5;
    h.step();
    const tries = () => h.hooksOf('damaged').filter((c) => c.target === guard && (c.dmg?.tags || []).includes('execute')).length;
    assert.equal(tries(), 1, `${label([elite])}: tried once`);
    assert.ok(guard.alive && guard.hp <= 1 + 1e-9, `${label([elite])}: held at 1 HP`);
    h.run(3);
    assert.equal(tries(), 1, `${label([elite])}: never again`);
    done(h);
  }
});

test('S2 提喻 (MANUAL, data DEFAULT): 20 s, RES +40 / +50; locks one target with a hit every 0.5 s whatever the attack speed, 35 %→105 % / 50 %→150 % of ATK and its speed down to 40 % over 10 hits; a stun breaks the lock', () => {
  for (const [elite] of FORMS_ALL) {
    const sk = skillOf(elite, S2);
    const b = sk.bb;
    const { h, u } = field({ elite, skill: 1, seed: 7 });
    assert.deepEqual([u.skill.rule, u.skill.kind, sk.duration, b.magic_resistance, b['attack@cooldown'], b['attack@atk_scale_base'], b['attack@atk_scale_delta'], b['attack@move_speed'], b['attack@max_stack_cnt']],
      ['DEFAULT', 'duration', 20, elite ? 50 : 40, 0.5, elite ? 0.5 : 0.35, elite ? 0.1 : 0.07, -0.06, 10], label([elite]));
    const e = h.spawn('enemy_dummy', { pos: [10, 7] });
    h.b.addBuff(u, { key: 'test:aspd', mods: { aspd: 300 } });   // the lock ignores the attack speed
    const res0 = u.s.res;
    cast(u);
    approx(u.s.res, res0 + b.magic_resistance, `${label([elite])}: RES`);
    const n0 = atkHits(h, u).length;
    h.run(6.02);
    const hits = atkHits(h, u).slice(n0);
    assert.ok(hits.length >= 12 && hits.length <= 13, `${label([elite])}: ${hits.length} hits in 6 s (one per 0.5 s)`);
    for (let i = 1; i < hits.length; i++) approx(hits[i].t - hits[i - 1].t, 0.5, `${label([elite])}: cadence`, 0.07);
    hits.forEach((c, i) => {
      assert.equal(c.target, e, `${label([elite])}: the locked target`);
      // + 剜魂具辞's 165 (the first hit marks it already); the target's RES 0
      approx(c.amount, u.s.atk * (b['attack@atk_scale_base'] + b['attack@atk_scale_delta'] * Math.min(10, i)) + 165, `${label([elite])}: hit ${i}`, 1e-4);
    });
    assert.ok(Math.abs(hits[10].amount - (u.s.atk * b['attack@atk_scale_base'] * 3 + 165)) < 1e-3 * hits[10].amount, `${label([elite])}: 3× after 5 s`);
    approx(e.findBuff(`logos:lockSlow:${u.id}`).mods.moveMul, 0.4, `${label([elite])}: 40 % speed`);
    // a stun breaks it: the slow goes, the next hits start over
    h.b.applyStatus(u, 'stun', { duration: 1, source: e });
    h.step();
    assert.equal(e.findBuff(`logos:lockSlow:${u.id}`), null, `${label([elite])}: slow gone with the lock`);
    const n1 = atkHits(h, u).length;
    h.run(1.6);
    const after = atkHits(h, u).slice(n1);
    approx(after[0].amount, u.s.atk * b['attack@atk_scale_base'] + 165, `${label([elite])}: reset`, 1e-4);
    // beam: the hit lands as the attack is made (no bolt in flight)
    const atks = h.hooksOf('attack').filter((c) => c.attacker === u);
    assert.ok(Math.abs(atks[atks.length - 1].t - after[after.length - 1].t) < 1e-9, `${label([elite])}: instant`);
    h.runUntil(() => !u.skill.active, 25);
    approx(u.s.res, res0, `${label([elite])}: RES back`);
    done(h);
  }
});

test('S2 提喻 keeps its lock while another enemy comes first in the order, and locks anew when its target leaves the field', () => {
  const { h, u } = field({ elite: true, skill: 1 });
  const a = h.spawn('enemy_dummy', { pos: [10, 8] });
  cast(u);
  h.run(1.1);
  assert.ok(atkHits(h, u).every((c) => c.target === a));
  h.spawn('enemy_dummy', { pos: [10, 6], routeIndex: 0 });   // nearer the goal: first in the order
  const n0 = atkHits(h, u).length;
  h.run(1.6);
  assert.ok(atkHits(h, u).slice(n0).every((c) => c.target === a), 'still the locked one');
  h.b.kill(a, null);
  const n1 = atkHits(h, u).length;
  h.run(1.1);
  const next = atkHits(h, u).slice(n1);
  assert.ok(next.length >= 2 && next.every((c) => c.target !== a));
  approx(next[0].amount, u.s.atk * 0.5 + 165, 'a new lock starts at the base scale', 1e-4);
  done(h);
});

test('S3 延异视阈 (MANUAL, data ACTIVE_RANGE on its 3-4): cast with an enemy on the 3-4 only, 30 s, ATK +160 % / +220 %, 3 targets at once', () => {
  for (const [elite] of FORMS_ALL) {
    const sk = skillOf(elite, S3);
    const { h, u } = field({ elite, skill: 2 });
    assert.deepEqual([u.skill.rule, sk.rangeId, sk.duration, sk.bb.atk, sk.bb['attack@max_target'], sk.bb.projectile_move_scale], ['ACTIVE_RANGE', '3-4', 30, elite ? 2.2 : 1.6, 3, 0.05], label([elite]));
    assert.deepEqual(u.skill.triggerGrid, sk.rangeGrid, `${label([elite])}: the trigger grid is the 3-4`);
    u.skill.gainSp(999);
    h.run(1);
    assert.equal(u.skill.activations, 0, `${label([elite])}: no enemy`);
    const far = h.spawn('enemy_dummy', { pos: [12, 6] });   // dRow +2: the 3-4 only
    assert.ok(h.runUntil(() => u.skill.active, 1), `${label([elite])}: cast for an enemy outside his own range`);
    assert.deepEqual(u.liveRangeGrid, sk.rangeGrid, `${label([elite])}: 3-4 while on`);
    approx(u.s.atk, u.base.atk * (1 + sk.bb.atk), `${label([elite])}: ATK`);
    const more = [h.spawn('enemy_dummy', { pos: [10, 6] }), h.spawn('enemy_fly', { pos: [9, 7] }), h.spawn('enemy_dummy', { pos: [11, 8] })];
    const a0 = h.hooksOf('attack').filter((c) => c.attacker === u).length;
    h.run(5);
    const atks = h.hooksOf('attack').filter((c) => c.attacker === u).slice(a0);
    assert.ok(atks.length >= 2 && atks.every((c) => c.targets.length === 3), `${label([elite])}: 3 targets per attack`);
    assert.ok(atks.every((c) => c.targets.every((e) => [far, ...more].includes(e))));
    h.runUntil(() => !u.skill.active, 40);
    assert.deepEqual(u.liveRangeGrid, rec(elite).rangeGrid, `${label([elite])}: back to 3-1`);
    done(h);
  }
});

test('S3 延异视阈: enemy shots on his range fly at 5 % of their speed (back once they leave it) and are cleared when the skill ends — not when he is disarmed then', () => {
  for (const disarm of [false, true]) {
    const { h, u } = field({ elite: true, skill: 2 });
    h.spawn('enemy_gun', { pos: [10, 7] });
    h.run(1.5);
    cast(u);
    h.run(0.2);
    h.run(3);
    const shots = h.b.projectiles.list.filter((p) => p.source && p.source.side === 'enemy');
    assert.ok(shots.length >= 2, `${shots.length} enemy shots held`);
    for (const p of shots) approx(p.speed, 10 * 0.05, 'slowed to 0.05×');
    if (disarm) h.b.applyStatus(u, 'disarm', { duration: 40, source: null });
    h.runUntil(() => u.skill.timeLeft < 0.5, 40);
    for (const g of h.enemies()) h.b.applyStatus(g, 'stun', { duration: 99, source: null });   // no new shot
    const held = h.b.projectiles.list.filter((p) => p.source && p.source.side === 'enemy').length;
    assert.ok(held >= 1, `${held} shots in the air as it ends`);
    h.runUntil(() => !u.skill.active, 2);
    h.step();
    // (until the end a held shot still reaches him at its 5 % speed — one a second from the gun 2 tiles away)
    const taken = u.stats.taken;
    const left = h.b.projectiles.list.filter((p) => p.source && p.source.side === 'enemy');
    if (!disarm) {
      assert.equal(left.length, 0, 'cleared');
      h.run(5);
      assert.equal(u.stats.taken, taken, 'none of the held shots hit him');
    } else {
      assert.ok(left.length > 0 && left.every((p) => Math.abs(p.speed - 10) < 1e-9), 'disarmed: kept, at full speed again');
    }
    done(h);
  }
});

test('T1 语汇演化: 40 % per attacked target for an extra 65 % ATK arts hit on a random enemy of his range + 停顿 0.8 s', () => {
  for (const f of FORMS_ALL) {
    const [elite] = f;
    const t = talentOf(elite, 0);
    const { h, u } = field({ elite, skill: 0, seed: 21 });
    h.b.addBuff(u, { key: 'test:aspd', mods: { aspd: 500 } });
    const es = [h.spawn('enemy_dummy', { pos: [10, 7] }), h.spawn('enemy_fly', { pos: [11, 6] })];
    h.run(50);
    const attacks = h.hooksOf('attack').filter((c) => c.attacker === u).reduce((n, c) => n + c.targets.length, 0);
    const extra = tagged(h, u, 'logosLexicon').filter((c) => c.type === 'arts');
    const emit = t.emit_count ?? 1;
    const ratio = extra.length / (attacks * emit);
    assert.ok(attacks > 150 && Math.abs(ratio - t.prob) < 0.08, `${label(f)}: ${extra.length} / ${attacks}×${emit} ≈ ${t.prob}`);
    for (const c of extra.slice(0, 6)) {
      assert.ok(es.includes(c.target), `${label(f)}: an enemy of his range (air too)`);
      const marked = h.hooksOf('damaged').some((d) => d.source === u && d.target === c.target && d.dmg?.isAttack && d.t <= c.t && c.t - d.t <= 5);
      approx(c.amount, u.s.atk * t.atk_scale + (marked ? 165 : 0), `${label(f)}: ${t.atk_scale * 100} % ATK (+ 剜魂具辞 on a marked one)`, 1e-4);
    }
    const slug = h.hooksOf('statusApplied').filter((c) => c.source === u && c.status === 'sluggish');
    assert.ok(slug.length >= extra.length * 0.95 && slug.every((c) => Math.abs(c.duration - t.sluggish) < 1e-9), `${label(f)}: 停顿 ${t.sluggish} s`);
    // 语汇演化 carries no element_atk_scale of its own (that is CCR-Δ stage 3's 凋亡 rider) and emits one hit per target
    // (CCR-Y stage 3's two executions) — both stay in the kit, see the module test above. The hits ARE arts damage, so
    // the elite's active CCR-Δ attaches its 8 % 凋亡 损伤 to each of them (tag `logosCcrd`).
    assert.equal(t.element_atk_scale, undefined, `${label(f)}: the module's 元素伤害 key`);
    const artsExtra = tagged(h, u, 'logosLexicon').filter((c) => c.type === 'arts');
    // the rider is `type: 'element'`, `element: 'apoptosis'`, tagged `logosCcrd` (every arts damage he deals, 语汇演化's
    // extra hits included)
    const apopt = tagged(h, u, 'logosCcrd').filter((c) => c.dmg?.element === 'apoptosis');
    if (elite) {
      const ep = rec(true).talents.find((x) => x.fromModule).bb.ep_damage_ratio;
      const artsAll = h.hooksOf('damaged').filter((c) => c.source === u && c.type === 'arts');
      assert.ok(apopt.length > 0 && artsExtra.length > 0, `${label(f)}: ${apopt.length} 凋亡 / ${artsAll.length} arts`);
      // every rider needs an arts hit of his on that target before it (a gauge that is locked while its burst resolves
      // legitimately skips some), and the amount is exactly ep × the damage that triggered it
      let paired = 0;
      for (const c of apopt) {
        const src = artsAll.filter((a) => a.target === c.target && a.t <= c.t + 1e-9).pop();
        if (!src) continue;
        paired++;
        if (paired <= 6) approx(c.amount, src.amount * ep, `${label(f)}: ${ep * 100} % of ${src.amount}`, 1e-6);
      }
      assert.equal(paired, apopt.length, `${label(f)}: every 凋亡 rider follows an arts hit of his`);
      assert.deepEqual(apopt.every((c) => c.dmg.element === 'apoptosis'), true, `${label(f)}: element`);
    } else {
      assert.equal(apopt.length, 0, `${label(f)}: the normal form has no 凋亡 rider`);
    }
    done(h);
  }
});

test('T1 语汇演化 also follows 殁亡\'s follow-up hit (备注 "可触发第一天赋") and works while he is disarmed', () => {
  const { h, u } = field({ elite: true, skill: 0, seed: 3 });
  cast(u);
  h.b.applyStatus(u, 'disarm', { duration: 999, source: null });
  const thr = 1.2 * u.s.atk;
  let rolls = 0;
  for (let i = 0; i < 40; i++) {
    h.spawn('enemy_dummy', { pos: [9, 7] });
    const low = h.spawn('enemy_dummy', { pos: [10, 7] });
    low.hp = thr * 0.5;
    h.step();
    rolls++;
    for (const e of h.enemies()) h.b.kill(e, null);
    h.step();
  }
  assert.equal(atkHits(h, u).length, 0, 'disarmed: no attack');
  assert.equal(tagged(h, u, 'logosPerish').length, rolls);
  const extra = tagged(h, u, 'logosLexicon');
  assert.ok(extra.length > rolls * 0.2 && extra.length < rolls * 0.6, `${extra.length} / ${rolls} ≈ 40 %`);
  done(h);
});

test('T2 剜魂具辞: each of his attack hits gives the target RES −10 and +165 on every arts damage it takes for 5 s — the hit itself included, other casters\' arts too; one instance per enemy', () => {
  for (const [elite] of FORMS_ALL) {
    const t = talentOf(elite, 1);
    assert.deepEqual(t, { duration: 5, magic_resistance: -10, atk_addition: 165 });
    const { h, u } = field({ elite, skill: 0, seed: 9 });
    const e = h.spawn('enemy_dummy', { pos: [10, 7] });
    e.base.res = 30; e.markDirty();
    const first = () => atkHits(h, u)[0];
    assert.ok(h.runUntil(() => !!first(), 4));
    const c = first();
    approx(c.amount, (u.s.atk + 165) * (1 - 0.2), `${label([elite])}: (ATK + 165) × (1 − (30 − 10) %) on the very hit`, 1e-4);
    const mark = e.findBuff('logos:soulRend');
    assert.ok(mark && Math.abs(mark.mods.resFlat + 10) < 1e-9 && mark.data.value === 165);
    approx(e.s.res, 20, `${label([elite])}: RES −10`);
    // another source's arts damage gets the 165 too; physical does not
    approx(h.b.dealDamage(null, e, { amount: 1000, type: 'arts', canDodge: false }), (1000 + 165) * 0.8, 'arts +165');
    approx(h.b.dealDamage(null, e, { amount: 1000, type: 'phys', canDodge: false }), 1000, 'phys unchanged');
    // it lapses 5 s after his last hit
    h.b.applyStatus(u, 'stun', { duration: 20, source: null });
    h.run(5.2);
    assert.equal(e.findBuff('logos:soulRend'), null, `${label([elite])}: gone after 5 s`);
    approx(e.s.res, 30, `${label([elite])}: RES back`);
    done(h);
  }
});
