// test/content/op_wisdel.test.js — the kit of 维什戴尔 (char_1035_wisdel, 6★ 投掷手; server/sim/content/kits/ops/op-wisdel.js)
// and of her summon “魂灵之影” (token_10035_wisdel_wward), fielded the production way after OPEN-4 promoted her to a
// 「巴别塔」 shop chess: the record of chess_char_6_04_babel_a (E2 Lv1, skill rank 4) / _b (E2 Lv60, rank 7) in
// data/chess.json, registered by ops/chess_char_6_04_babel-wisdel.js (her charId left `backups.json units` and
// `diy.ownedPool`, so the old 自选 slot path is gone). The summon's variants are keyed by the chess pair in data/tokens.json.
// Every number is read back from data/chess.json / data/tokens.json; the fidelity checklist of kits/README.md.
// 转正后的商店棋照官方 PRESET 惯例带模组（maintainer 2026-10-12「为维什戴尔等有模组的角色添加模组」）：精锐 `_b`
// `equipLevel` 3（T6）⇒ `uniequip_002_wisdel` BOM-X 活性（`module.active` true，`modules[]` 按官方给全），普通 `_a`
// 保持 `equipLevel` 0 + `module.active` false —— 模组从不改普通棋子的数值。BOM-X 三阶带来 atk +65 / 攻速 +7、特性
// 「三次物理伤害」（两次余震）与好礼 125 % / 185 %，所以下面的精英分支按 t0Of(elite) 读回这些值。
// Run: node test/content/op_wisdel.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITTED_CHARS, KITS } from '../../server/sim/content/kits/index.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../../data/${f}.json`, import.meta.url), 'utf8'));
const CHESS = load('chess');
const GARRISONS = load('garrisons');
const TOKENS = load('tokens');
const WD = 'char_1035_wisdel';
const SHADOW = 'token_10035_wisdel_wward';
const A = 'chess_char_6_04_babel_a', B = 'chess_char_6_04_babel_b';
const rec = (elite) => CHESS[elite ? B : A];
const BOM = 'uniequip_002_wisdel';   // her only ADVANCED module: the elite's default and its whole `modules[]`
const S1 = 'skchr_wisdel_1', S2 = 'skchr_wisdel_2', S3 = 'skchr_wisdel_3';
/** Her trait's aftershock count: BOM-X's 「三次物理伤害」 trait override gives two, the plain trait one. */
const shocks = (elite) => (Number(rec(elite).trait.bb['attack@enable_third_attack']) > 0 ? 2 : 1);
const skillOf = (elite, id) => rec(elite).skills.find((s) => s.skillId === id);
const shadowOf = (elite) => TOKENS[SHADOW].variants[elite ? B : A];
const approx = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
const dummy = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, mass: 0, ...o });
const ENEMIES = { enemy_dummy: dummy('enemy_dummy'), enemy_fly: dummy('enemy_fly', { motion: 'FLY' }), enemy_atk: dummy('enemy_atk', { atk: 100, range: 3 }) };
const FORMS_ALL = [[false], [true]];

/** 维什戴尔 as uid 1 at (10, 4) facing RIGHT (3-9: rows 8–12; (10, 4..8), (9 / 11, 4..7), (8 / 12, 4..6)). */
function field({ elite = false, skill = 0, row = 10, col = 4, others = [], seed = 5 } = {}) {
  const h = makeBattle({
    defs: { enemies: ENEMIES }, timeLimit: 1200, autoFinish: false, seed,
    flags: { dpPerSec: 0, dpMax: 999 }, hooks: ['damaged', 'skillStart', 'skillEnd', 'statusApplied', 'death', 'deploy', 'heal'], captureNoisy: true,
    units: [{ uid: 1, chessId: elite ? B : A, skillIndex: skill, elite, row, col }, ...others],
  });
  h.step();
  return { h, u: h.unit(1) };
}
const from = (h, src) => h.hooksOf('damaged').filter((c) => c.source === src);
const on = (h, e) => h.hooksOf('damaged').filter((c) => c.target === e);
const shadowsOf = (h, u) => h.b.allyUnits.filter((t) => t.kind === 'token' && t.defId === SHADOW && t.ownerUnit === u);
const tag = (c, t) => !!c.dmg.tags?.includes(t);
const markKey = (u) => `wisdel:mark:${u.id}`;
function done(h) {
  checkInvariants(h.b);
  assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0]));
}
const label = ([elite]) => (elite ? 'elite' : 'normal');
const t0Of = (elite) => rec(elite).talents[0].bb;

test('维什戴尔 in both forms: her kit (all three skills authored), the record\'s stats (BOM-X on the elite only), 3-9, 投掷手 (ground-only 0.9 splash, never air), blocks 1, the data triggers, a 魂灵之影 beside her at once', () => {
  assert.equal(typeof KITS[A], 'function');
  for (const f of FORMS_ALL) {
    const [elite] = f;
    for (const skill of [0, 1, 2]) {
      const { h, u } = field({ elite, skill });
      const r = rec(elite);
      assert.deepEqual([u.def.charId, u.def.baseId, u.skill.id, !!u.kit.generic, u.kit.skillSource], [WD, A, r.skills[skill].skillId, false, 'skills'], label(f));
      assert.deepEqual([u.base.maxHp, u.base.atk, u.base.def, u.base.res, u.base.aspd], [r.stats.maxHp, r.stats.atk, r.stats.def, r.stats.res, r.stats.aspd], `${label(f)}: stats`);
      assert.deepEqual([u.s.blockCnt, u.profile.attack, u.profile.canHitFly, u.profile.groundOnly, u.profile.dmgType, u.base.bat, u.profile.splashRadius, u.profile.sub],
        [1, 'ranged', false, true, 'phys', 2.1, 0.9, 'bombarder'], `${label(f)}: 投掷手`);
      assert.deepEqual(u.liveRangeGrid, r.rangeGrid, `${label(f)}: 3-9`);
      assert.equal(u.skill.rule, r.skills[skill].trigger.rule, `${label(f)}: the data's trigger`);
      const sh = shadowsOf(h, u);
      assert.deepEqual(sh.map((t) => [t.tileR, t.tileC]), [[9, 4]], `${label(f)}: a shadow on the nearest free tile of her range (lower row first)`);
      assert.ok(u.s.flags.camou && !u.s.flags.liftoff && !u.s.flags.stealth, `${label(f)}: 迷彩 beside it, ground-targetable otherwise`);
      done(h);
    }
  }
  assert.deepEqual(rec(true).skills.map((s) => [s.skillType, s.trigger.rule, s.trigger.rawRule]), [['AUTO', 'DEFAULT', 'DEFAULT'], ['MANUAL', 'DEFAULT', 'DEFAULT'], ['MANUAL', 'SP_FULL', 'ALWAYS']]);
  // zh_CN (full potential): E2 Lv1 1434 / 615, E2 Lv60 1735 / 684 no-module + BOM-X stage 3 atk +65 = 749 / aspd 107
  assert.deepEqual([rec(false).stats.maxHp, rec(false).stats.atk, rec(true).stats.maxHp, rec(true).stats.atk], [1434, 615, 1735, 749]);
  assert.deepEqual([rec(true).statsBase.maxHp, rec(true).statsBase.atk, rec(true).statsBase.aspd], [1735, 684, 100]);
  assert.deepEqual([rec(true).stats.aspd, rec(true).module.level, rec(true).module.active], [107, 3, true]);
  // her 特质 garrison_170 (ONE merged 作战能力 row since the maintainer's 2026-10-12 decision: the fixed half and the
  // 【巴别塔】per-3-layers half in the same row, both 直接乘算 fractions) is a battle buff in the engine's additive
  // percentage bucket — measured on the field, not on the record
  assert.deepEqual([rec(false).garrisonIds, rec(true).garrisonIds], [['garrison_170_a'], ['garrison_170_b']]);
  for (const elite of [false, true]) {
    const { u } = field({ elite, skill: 0 });
    const gar = GARRISONS[rec(elite).garrisonIds[0]].bb;   // the row's fixed half (the bond is off in this battle)
    approx(u.s.atk, u.base.atk * (1 + gar.base_atk), `${label([elite])}: base × (1 + ${gar.base_atk})`);
    approx(u.s.maxHp, u.base.maxHp * (1 + gar.base_max_hp), `${label([elite])}: max HP × (1 + ${gar.base_max_hp})`);
  }
});

test('a 商店棋: 维什戴尔 is the visible T6 巴别塔 preset with a hand-authored kit — and is no longer a 自选 pick', () => {
  for (const id of [A, B]) {
    const r = CHESS[id];
    assert.deepEqual([r.charId, r.tier, r.visible, r.chessType, r.isDiy], [WD, 6, true, 'PRESET', false], id);
    assert.ok(r.bonds.includes('babelShip'), id);
  }
  // OPEN-4: her charId left `backups.json diy.ownedPool`, so the 自选 picker no longer offers her (KITTED_CHARS lists the
  // picks a 自选 slot may field — the shop chess is fielded by its chess id instead, ops/chess_char_6_04_babel-wisdel.js)
  assert.equal(KITTED_CHARS.includes(WD), false);
  // the registry key is the pair's base id (`_a`): the elite `_b` record resolves through it (content/index.js kitOf)
  assert.equal(Object.prototype.hasOwnProperty.call(KITS, B), false);
});

test('BOM-X “‘祖宗发射器’”: the elite’s active default at stage 3 (atk +65 / aspd +7, the 「三次物理伤害」 trait and 好礼 ×1.25 / 1.85), the normal form’s equip-level-0 record without module numbers', () => {
  const a = rec(false), b = rec(true);
  assert.deepEqual([a.status.equipLevel, a.module.id, a.module.active, a.modules], [0, BOM, false, undefined]);
  assert.deepEqual([b.status.equipLevel, b.module.id, b.module.active, b.module.name, b.module.type, b.module.level], [3, BOM, true, '“祖宗发射器”', 'BOM-X', 3]);
  assert.deepEqual(b.modules.map((m) => [m.uniEquipId, m.typeName, m.isDefault, m.level]), [[BOM, 'BOM-X', true, 3]]);
  assert.deepEqual(b.modules[0].attr, { atk: 65, aspd: 7 });
  // the module trait override is the record's own trait on the elite (`stats` / `trait` keep the default module)
  assert.deepEqual([b.trait.bb['attack@enable_third_attack'], a.trait.bb['attack@enable_third_attack']], [1, 0]);
  assert.match(b.trait.desc, /三次/); assert.match(a.trait.desc, /两次/);
  assert.equal(b.stats.atk, b.statsBase.atk + 65);
  assert.equal(b.stats.aspd, b.statsBase.aspd + 7);
  assert.equal(a.stats.atk, 615, 'the normal form keeps its own E2 Lv1 no-module ATK (not the elite base)');
  assert.equal(a.stats.aspd, 100);
});

test('trait 投掷手 + T1 好礼: the main target ×1.15 (精锐 ×1.25 with BOM-X), the 0.9 splash in full, then 0.3 s later the aftershock(s) at 50 % ATK on the spot (×main on the main one); flyers never hit; her 残影 on the main target', () => {
  for (const f of FORMS_ALL) {
    const [elite] = f;
    const t0 = t0Of(elite);
    assert.deepEqual([t0['attack@main_atk_scale'], t0['attack@bomb_atk_scale']], elite ? [1.25, 1.85] : [1.15, 1.6], label(f));
    assert.equal(rec(elite).trait.bb['attack@append_atk_scale'], 0.5, label(f));
    const nShock = shocks(elite);
    const { h, u } = field({ elite, skill: 1, seed: 21 });
    const main = h.spawn('enemy_dummy', { pos: [10, 8] });
    const sp = h.spawn('enemy_dummy', { pos: [10, 8.85] });   // 0.85: her splash, outside her range
    const out = h.spawn('enemy_dummy', { pos: [11, 8.75] });  // √(1 + 0.5625) = 1.25
    const fly = h.spawn('enemy_fly', { pos: [9, 8] });          // in her range, an air unit
    assert.ok(h.runUntil(() => on(h, main).length > 0, 4), `${label(f)}: an attack`);
    const t = h.b.time;
    h.run(0.8);
    const atk = u.s.atk;
    const ms = t0['attack@main_atk_scale'];
    const plain = (c) => !tag(c, 'wisdel:bomb');
    const first = from(h, u).filter((c) => plain(c) && c.t <= t + 1e-9);
    assert.deepEqual(new Set(first.map((c) => c.target)), new Set([main, sp]), `${label(f)}: the main target and the splash`);
    approx(first.find((c) => c.target === main).amount, atk * ms, `${label(f)}: main ×${ms}`);
    approx(first.find((c) => c.target === sp).amount, atk, `${label(f)}: splash in full`);
    const shockHits = from(h, u).filter((c) => plain(c) && tag(c, 'aftershock') && c.t <= t + 0.75);
    // BOM-X's 「三次物理伤害」 trait gives the elite two aftershocks, the plain trait one (both at 50 %)
    assert.equal(shockHits.filter((c) => c.target === main).length, nShock, `${label(f)}: ${nShock} aftershock(s)`);
    for (const c of shockHits) approx(c.amount, atk * 0.5 * (c.target === main ? ms : 1), `${label(f)}: 50 %`);
    assert.ok(Math.abs(shockHits[0].t - t - 0.3) < 0.04, `${label(f)}: 0.3 s later`);
    assert.deepEqual([on(h, out).length, on(h, fly).length], [0, 0], `${label(f)}: 1.25 away and the flyer untouched`);
    assert.ok(main.findBuff(markKey(u)) || on(h, main).some((c) => tag(c, 'wisdel:bomb')), `${label(f)}: marked (or the mark went off)`);
    done(h);
  }
});

test('T1 好礼: each aftershock on a marked enemy goes off 15 % of the time — 160 % (精锐 185 %) ATK physical to every enemy within 1.1, air too, stun 1 s, the mark spent; the 残影 leave with her', () => {
  for (const f of FORMS_ALL) {
    const [elite] = f;
    const t0 = t0Of(elite);
    const { h, u } = field({ elite, skill: 1, seed: 33 });
    const main = h.spawn('enemy_dummy', { pos: [10, 8] });
    const fly = h.spawn('enemy_fly', { pos: [10, 9] });   // 1.0 from the main target: only the explosion reaches it
    h.run(400);
    const bombs = from(h, u).filter((c) => tag(c, 'wisdel:bomb') && c.target === main);
    const rolls = from(h, u).filter((c) => tag(c, 'aftershock') && c.target === main).length;
    assert.ok(rolls > 150, `${label(f)}: ${rolls} rolls`);
    const r = bombs.length / rolls;
    assert.ok(r > 0.09 && r < 0.21, `${label(f)}: ${bombs.length} / ${rolls} ≈ 15 %`);
    for (const c of bombs) assert.equal(c.type, 'phys', label(f));
    const flyBombs = on(h, fly).filter((c) => tag(c, 'wisdel:bomb'));
    assert.equal(flyBombs.length, bombs.length, `${label(f)}: the flyer 1.0 away takes every explosion`);
    assert.equal(on(h, fly).length, flyBombs.length, `${label(f)}: and nothing else`);
    const stuns = h.hooksOf('statusApplied').filter((c) => c.source === u && c.status === 'stun' && c.target === fly);
    assert.equal(stuns.length, bombs.length, `${label(f)}: each explosion stuns`);
    for (const c of stuns) approx(c.duration, t0['attack@stun'], `${label(f)}: 1 s`);
    // the amounts: her ATK × bomb_atk_scale (the explosion is no attack: no ×main), and the explosion spends the mark of
    // the enemy it rolled on — her attacks are disarmed and the 魂灵之影 silenced (nothing can attach a new 残影), and
    // every 好礼 roll is forced to succeed so the one enemy marked here is rolled on and spent deterministically
    h.b.addBuff(u, { key: 'test:disarm', flags: { disarm: true } });
    h.b.addBuff(shadowsOf(h, u)[0], { key: 'test:silence', flags: { silence: true } });
    h.run(2);
    main.buffs = main.buffs.filter((b) => b.key !== markKey(u));
    const e = h.spawn('enemy_dummy', { pos: [10, 7] });
    h.b.addBuff(e, { key: markKey(u), source: u });
    h.b.rng.chance = () => true;
    h.b.removeBuff(u, 'test:disarm');
    assert.ok(h.runUntil(() => on(h, e).some((c) => tag(c, 'wisdel:bomb')), 200), `${label(f)}: it goes off on a marked one`);
    const b = on(h, e).find((c) => tag(c, 'wisdel:bomb'));
    approx(b.amount, u.s.atk * t0['attack@bomb_atk_scale'], `${label(f)}: ×${t0['attack@bomb_atk_scale']}`);
    assert.equal(e.findBuff(markKey(u)), null, `${label(f)}: the mark is spent by its own explosion`);
    h.b.addBuff(e, { key: markKey(u), source: u });
    h.b.retreat(u);
    assert.ok(!e.findBuff(markKey(u)) && !main.findBuff(markKey(u)), `${label(f)}: her 残影 leave with her`);
    done(h);
  }
});

test('T2 死魂灵的余息: a 魂灵之影 (the form\'s stats, 禁疗, no attack, attackable) at each deployment on the nearest free tile of her range, at most 3; 迷彩 while one that came in on her x-5 stands; the shadows stay when she leaves', () => {
  for (const [elite] of FORMS_ALL) {
    const v = shadowOf(elite);
    assert.deepEqual([v.stats.maxHp, v.stats.atk, v.stats.def, v.stats.res, v.stats.respawnTime, v.stats.deployLimit], [3500, elite ? 738 : 660, elite ? 628 : 585, 50, 5, 3], label([elite]));
    const { h, u } = field({ elite, skill: 1 });
    const [t] = shadowsOf(h, u);
    assert.deepEqual([t.base.maxHp, t.base.atk, t.base.def, t.base.res, t.s.blockCnt, !!t.s.flags.noHeal, !!t.s.flags.untargetable, t.profile.noAttack],
      [3500, v.stats.atk, v.stats.def, 50, 0, true, false, true], `${label([elite])}: stats, 禁疗, attackable, no attack`);
    assert.ok(u.findBuff(`wisdel:camou:${t.id}`) && u.s.flags.camou, `${label([elite])}: 迷彩`);
    // a ranged enemy in reach: she is not its target while camouflaged and not blocking
    const shooter = h.spawn('enemy_atk', { pos: [10, 6] });
    h.run(4);
    assert.ok(!h.hooksOf('damaged').some((c) => c.source === shooter && c.target === u), `${label([elite])}: 迷彩: the shooter does not pick her`);
    h.b.kill(shooter, null);
    h.b.kill(t, null);
    assert.ok(!u.s.flags.camou, `${label([elite])}: gone with its shadow`);
    for (let i = 0; i < 4; i++) {
      h.b.retreat(u);
      h.run(0.2);
      assert.ok(h.b.redeploy(u, { free: true }), `${label([elite])}: redeploy ${i}`);
      h.run(0.2);
    }
    assert.equal(shadowsOf(h, u).filter((s) => s.alive).length, 3, `${label([elite])}: at most 3 (they stay when she leaves)`);
    done(h);
  }
  // no free tile next to her: the shadow lands on the next nearest (lower row first) and gives no 迷彩
  const others = [[9, 4], [11, 4], [10, 5]].map(([r, c], i) => ({ uid: 10 + i, chessId: 'chess_char_1_02_a', row: r, col: c }));
  const { h, u } = field({ skill: 1, others });
  assert.deepEqual(shadowsOf(h, u).map((t) => [t.tileR, t.tileC]), [[9, 5]], 'the nearest free one: √2 away, lower row first');
  assert.ok(!u.s.flags.camou, 'not on its x-5: no 迷彩');
  done(h);
});

test('魂灵之影\'s skill: every 5 SP (time; +0–2 after each cast) a ground enemy of 维什戴尔\'s range — unmarked first — takes its ATK as arts damage, 停顿 1 s and her 残影; never an air unit', () => {
  for (const [elite] of FORMS_ALL) {
    const v = shadowOf(elite);
    assert.deepEqual([v.skill.skillType, v.skill.spType, v.skill.spCost, v.skill.bb], ['AUTO', 'INCREASE_WITH_TIME', 5, { sluggish: 1, sp_min: 0, sp_max: 3 }], label([elite]));
    const { h, u } = field({ elite, skill: 1 });
    h.b.addBuff(u, { key: 'test:disarm', flags: { disarm: true } });
    const [t] = shadowsOf(h, u);
    const fly = h.spawn('enemy_fly', { pos: [10, 6] });
    h.run(8);
    assert.deepEqual([t.skill.activations, on(h, fly).length], [0, 0], `${label([elite])}: an air unit only: nothing, SP kept`);
    assert.equal(t.skill.charges, 1, label([elite]));
    const a = h.spawn('enemy_dummy', { pos: [10, 7] });
    const b = h.spawn('enemy_dummy', { pos: [11, 7] });
    const outside = h.spawn('enemy_dummy', { pos: [10, 9] });   // outside her 3-9
    h.b.addBuff(a, { key: markKey(u), source: u });             // already marked
    h.step();
    assert.equal(t.skill.activations, 1, `${label([elite])}: cast at once`);
    const hit = from(h, t);
    assert.deepEqual(hit.map((c) => c.target), [b], `${label([elite])}: the unmarked one`);
    approx(hit[0].amount, t.s.atk, `${label([elite])}: its ATK`);
    assert.deepEqual([hit[0].type, hit[0].dmg.isSkill], ['arts', true], `${label([elite])}: arts`);
    assert.ok(b.findBuff(markKey(u)), `${label([elite])}: her 残影`);
    const slow = h.hooksOf('statusApplied').find((c) => c.source === t && c.target === b);
    assert.deepEqual([slow?.status, slow?.duration], ['sluggish', 1], `${label([elite])}: 停顿 1 s`);
    h.run(60);
    const casts = t.skill.activations;
    assert.ok(casts >= 60 / 5 + 1 && casts <= 60 / 3 + 2, `${label([elite])}: 5 SP a cast, 0–2 back each time (${casts} in 60 s)`);
    assert.equal(on(h, outside).length, 0, `${label([elite])}: outside her range: never`);
    done(h);
  }
});

test('S1 定点清算 (AUTO, attack SP 4 / 3, data DEFAULT): the next attack splashes 1.1, makes 2 more aftershocks at 75 % / 90 % ATK and stuns every enemy it hits 0.5 / 1 s', () => {
  for (const f of FORMS_ALL) {
    const [elite] = f;
    const sk = skillOf(elite, S1), t0 = t0Of(elite);
    assert.deepEqual([sk.spType, sk.spCost, sk.bb.append_atk_scale, sk.bb.stun_duration], ['INCREASE_WHEN_ATTACK', elite ? 3 : 4, elite ? 0.9 : 0.75, elite ? 1 : 0.5], label(f));
    const { h, u } = field({ elite, skill: 0, seed: 2 });
    assert.deepEqual([u.skill.kind, u.skill.rule], ['instant', 'DEFAULT'], label(f));
    h.b.addBuff(shadowsOf(h, u)[0], { key: 'test:silence', flags: { silence: true } });
    const main = h.spawn('enemy_dummy', { pos: [10, 8] });
    const sp = h.spawn('enemy_dummy', { pos: [10, 9.05] });   // 1.05: only the 1.1 splash
    u.skill.gainSp(999);
    assert.ok(h.runUntil(() => u.skill.activations === 1, 4), `${label(f)}: cast on her next attack`);
    h.run(2);
    const atk = u.s.atk;
    const hits = from(h, u).filter((c) => !tag(c, 'wisdel:bomb') && c.dmg.isSkill);
    // the trait's aftershocks (one plain, two with BOM-X) + the two this skill adds
    assert.equal(hits.filter((c) => c.target === main && tag(c, 'aftershock')).length, shocks(elite) + 2, `${label(f)}: ${shocks(elite) + 2} aftershocks`);
    for (const c of hits.filter((x) => tag(x, 'aftershock'))) approx(c.amount, atk * sk.bb.append_atk_scale * (c.target === main ? t0['attack@main_atk_scale'] : 1), `${label(f)}: ${sk.bb.append_atk_scale * 100} %`);
    assert.ok(hits.some((c) => c.target === sp && !tag(c, 'aftershock')), `${label(f)}: the 1.1 splash`);
    const stuns = h.hooksOf('statusApplied').filter((c) => c.source === u && c.status === 'stun' && c.target === sp);
    assert.ok(stuns.length >= 1 && stuns.every((c) => Math.abs(c.duration - sk.bb.stun_duration) < 1e-9), `${label(f)}: stunned ${sk.bb.stun_duration} s`);
    done(h);
  }
});

test('S2 饱和复仇 (MANUAL, 32 / 29 SP from 15, 25 s, data DEFAULT): ATK +16 % / +25 %, interval −0.5 / −0.7 s, 3 targets; 过载 the second half: every attack 4 rounds of 65 % / 70 % on random enemies of her range', () => {
  for (const [elite] of FORMS_ALL) {
    const sk = skillOf(elite, S2);
    assert.deepEqual([sk.spCost, sk.initSp, sk.duration, sk.bb.atk, sk.bb.base_attack_time, sk.bb['attack@atk_scale_ol']], elite ? [29, 15, 25, 0.25, -0.7, 0.7] : [32, 15, 25, 0.16, -0.5, 0.65], label([elite]));
    const { h, u } = field({ elite, skill: 1, seed: 8 });
    h.b.addBuff(shadowsOf(h, u)[0], { key: 'test:silence', flags: { silence: true } });
    assert.deepEqual([u.skill.kind, u.skill.rule], ['duration', 'DEFAULT'], label([elite]));
    for (const p of [[10, 6], [11, 6], [9, 6], [12, 5]]) h.spawn('enemy_dummy', { pos: p });
    // her 特质 (garrison_170: 攻击力和生命值 +20 % / +40 %) is a battle buff on the record's base ATK. Its `atkPct` is
    // ADDITIVE with the skill's own +atk % on that same base (server/sim/units.js: atk = base.atk × (1 + Σ atkPct)) —
    // `garPct` reads the garrison's share back off the live ATK (base.atk × (1 + garPct) at full HP), so both branches
    // assert the engine's arithmetic instead of a stacking model.
    const before = u.s.atk;
    const garPct = before / u.base.atk - 1;
    u.skill.gainSp(999);
    assert.ok(h.runUntil(() => u.skill.active, 4), `${label([elite])}: cast`);
    const ts = h.b.time;
    const castAtk = u.base.atk * (1 + garPct + sk.bb.atk);
    approx(u.s.interval, (2.1 + sk.bb.base_attack_time) * 100 / u.s.aspd, `${label([elite])}: interval`);
    approx(u.s.atk, castAtk, `${label([elite])}: ATK ${before} + ${sk.bb.atk * 100} % of the base (特质 ${garPct * 100} % + 技能 ${sk.bb.atk * 100} %, additive)`);
    h.run(26);
    const mains = from(h, u).filter((c) => c.dmg.isAttack && !c.dmg.isSplash && c.dmg.isSkill);
    const early = mains.filter((c) => c.t < ts + 12.4), late = mains.filter((c) => c.t > ts + 12.6 && c.t < ts + 25);
    const byAttack = (list) => { const m = new Map(); for (const c of list) m.set(c.dmg.attackId, [...(m.get(c.dmg.attackId) ?? []), c]); return [...m.values()]; };
    for (const g of byAttack(early)) {
      assert.equal(new Set(g.map((c) => c.target)).size, 3, `${label([elite])}: 3 targets at once`);
      for (const c of g) approx(c.amount, castAtk * t0Of(elite)['attack@main_atk_scale'], `${label([elite])}: ×${t0Of(elite)['attack@main_atk_scale']} on each main target`);
    }
    const lg = byAttack(late);
    assert.ok(lg.length >= 5, `${label([elite])}: overload attacks`);
    for (const g of lg) {
      assert.equal(g.length, 4, `${label([elite])}: 4 rounds`);
      for (const c of g) approx(c.amount, castAtk * sk.bb['attack@atk_scale_ol'] * t0Of(elite)['attack@main_atk_scale'], `${label([elite])}: ${sk.bb['attack@atk_scale_ol'] * 100} %`);
    }
    assert.ok(lg.some((g) => new Set(g.map((c) => c.target)).size < 4), `${label([elite])}: random picks (repeats happen)`);
    assert.ok(new Set(lg.flatMap((g) => g.map((c) => c.target))).size === 4, `${label([elite])}: every enemy of her range drawn some time`);
    assert.ok(!u.skill.active, `${label([elite])}: ends after 25 s`);
    done(h);
  }
});

test('S3 爆裂黎明 (MANUAL, data SP_FULL: at once, no enemy needed): 1 / 2 shadows (the first with 3 SP), ATK +120 % / +150 %, interval +2.9 s, 6 attacks at 175 % / 190 % with a 2.5 splash on air units too, 好礼 at 100 %', () => {
  for (const [elite] of FORMS_ALL) {
    const sk = skillOf(elite, S3);
    assert.deepEqual([sk.spCost, sk.initSp, sk.bb.max_cnt, sk.bb.atk, sk.bb.base_attack_time, sk.bb['attack@atk_scale_3'], sk.bb['attack@trigger_time'], sk.bb['attack@prob'], sk.bb.sp],
      elite ? [58, 35, 2, 1.5, 2.9, 1.9, 6, 1, 3] : [64, 30, 1, 1.2, 2.9, 1.75, 6, 1, 3], label([elite]));
    const { h, u } = field({ elite, skill: 2, seed: 4 });
    assert.deepEqual([u.skill.kind, u.skill.rule], ['ammo', 'SP_FULL'], label([elite]));
    for (const t of shadowsOf(h, u)) h.b.addBuff(t, { key: 'test:silence', flags: { silence: true } });
    const before = u.s.atk;   // her 特质 (garrison_170 +20 % / +40 %) is a buff on the record's base ATK
    const garPct = before / u.base.atk - 1;
    u.skill.gainSp(999);
    h.step();
    assert.ok(u.skill.active, `${label([elite])}: cast at once, no enemy on the field`);
    const sh = shadowsOf(h, u);
    assert.equal(sh.length, 1 + sk.bb.max_cnt, `${label([elite])}: the talent's + ${sk.bb.max_cnt}`);
    assert.ok(Math.floor(sh[1].skill.sp) === 3 && (sh.length < 3 || Math.floor(sh[2].skill.sp) === 0), `${label([elite])}: the first S3 shadow with 3 SP`);
    approx(u.s.interval, (2.1 + 2.9) * 100 / u.s.aspd, `${label([elite])}: interval +2.9 s`);
    const fly = h.spawn('enemy_fly', { pos: [10, 7] });
    assert.ok(h.runUntil(() => on(h, fly).length > 0, 2), `${label([elite])}: an air unit alone in her range is her target now`);
    const g = h.spawn('enemy_dummy', { pos: [11, 8] });          // √2 from the flyer: her 2.5 splash, her aftershocks
    const ring = h.spawn('enemy_fly', { pos: [11.5, 8.9] });     // 2.42 from the flyer, outside her range
    h.b.addBuff(g, { key: markKey(u), source: u });
    assert.ok(h.runUntil(() => !u.skill.active, 60), `${label([elite])}: 6 attacks and done`);
    h.run(1);
    const mains = from(h, u).filter((c) => c.dmg.isAttack && !c.dmg.isSplash);
    assert.equal(new Set(mains.map((c) => c.dmg.attackId)).size, 6, `${label([elite])}: 6 attacks`);
    // ATK +atk while it runs (the last shell lands after its 6th bullet ended it: the engine's ammo rule, skills.js).
    // Additive with the 特质 (units.js): base × (1 + garPct [+ skill %]) — the pre-cast ATK × (1 + skill %) would only
    // hold if the two percentages multiplied.
    const tEnd = h.hooksOf('skillEnd').find((c) => c.unit === u).t;
    const atkAt = (t) => u.base.atk * (1 + garPct + (t <= tEnd + 1e-9 ? sk.bb.atk : 0));
    const ms = t0Of(elite)['attack@main_atk_scale'];
    for (const c of mains) approx(c.amount, atkAt(c.t) * sk.bb['attack@atk_scale_3'] * ms, `${label([elite])}: ×${sk.bb['attack@atk_scale_3']} × main`);
    assert.ok(mains.filter((c) => c.t <= tEnd).length >= 5, `${label([elite])}: five land while it runs`);
    assert.ok(mains.every((c) => c.target === fly), `${label([elite])}: the flyer was her target throughout`);
    const splash = from(h, u).filter((c) => c.dmg.isSplash && !tag(c, 'aftershock') && !tag(c, 'wisdel:bomb'));
    assert.ok(splash.some((c) => c.target === ring) && splash.some((c) => c.target === g), `${label([elite])}: the 2.5 splash reaches the air unit 2.42 away and the ground one`);
    for (const c of splash) approx(c.amount, atkAt(c.t) * sk.bb['attack@atk_scale_3'], `${label([elite])}: splash in full`);
    assert.ok(on(h, fly).every((c) => !tag(c, 'aftershock')) && on(h, ring).every((c) => !tag(c, 'aftershock')), `${label([elite])}: aftershocks only on ground enemies`);
    const shockHits = from(h, u).filter((c) => tag(c, 'aftershock') && c.target === g);
    // the trait's aftershocks per attack (1 plain, 2 with BOM-X) over the 6 attacks of the skill
    assert.equal(shockHits.length, shocks(elite) * 6, `${label([elite])}: every aftershock reaches the ground one (it came before the first one)`);
    for (const c of shockHits) approx(c.amount, atkAt(c.t) * sk.bb['attack@atk_scale_3'] * 0.5, `${label([elite])}: 50 % of the boosted ATK`);
    assert.ok(on(h, g).some((c) => tag(c, 'wisdel:bomb') && Math.abs(c.t - shockHits[0].t) < 1e-9), `${label([elite])}: 好礼 at 100 %: the marked one went off on the first aftershock`);
    done(h);
  }
});
