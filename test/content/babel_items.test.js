// The three 「巴别塔」 专属装备 of the self-authored layer (tools/content/custom.mjs, docs/research/15-babel-bond.md
// §6.4). Every number below is read from data/items.json — no threshold or scale is hard-coded in the item handlers:
//
//   巴别塔誓言       chess_item_2_08_e_a/_b  2 阶  BOND_GRANT  ATK/HP +5 % / +10 %
//                                                  + with 变形同构体 (the official canGiveBond item): the carrier counts
//                                                  as a 【巴别塔】 member     (`giveBondId` of the OATH item)
//   “魔王的祭器”     chess_item_5_10_e_a/_b  5 阶  SET         HP +25 % / +40 %
//                                                  + with “文明的存续”: an ally heal ⇒ a shield of 40 % of the HP
//                                                  actually restored, the pool capped at 30 % of the carrier's max HP
//   “文明的存续”     chess_item_6_12_e_a/_b  6 阶  SET         ATK/HP +20 % / +35 %
//                                                  + with “魔王的祭器”: every 3000 HP actually lost ⇒ +5 % ATK / +5
//                                                  ASPD, at most 4 layers, until the battle ends; the 进阶 (_b)
//                                                  quality additionally amplifies every TRUE-damage instance its OWNER
//                                                  deals to an enemy by ×2.5 (the global 真伤 amplifier)
//
// The 套装 condition is the official SET mechanism of 天马之盔 / 天马之枪: the partner item key (WITHOUT the `_a` / `_b`
// suffix) sits in the item's own buff blackboard as `equip_chess_id`, so either quality of the partner satisfies it and
// the condition is SAME-CARRIER only — never the team. `requiresBondId` is a different, official field (a bond the
// carrier must be a member of); none of these three items uses it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, chessRec, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { unitBonds, itemRecord, itemKeyOf } from '../../server/sim/content/support/index.js';
import { itemGrants } from '../../server/sim/content/items/battle.js';

const ITEMS = JSON.parse(readFileSync(new URL('../../data/items.json', import.meta.url), 'utf8'));
// The 变形同构体 pair (the official `canGiveBond` item every bond grant goes through) and the three fiat items.
const TRANSFORM = 'chess_item_6_09_e_a';
const OATH = 'chess_item_2_08_e_a', OATH_B = 'chess_item_2_08_e_b';
const VESSEL = 'chess_item_5_10_e_a', VESSEL_B = 'chess_item_5_10_e_b';
const LEGACY = 'chess_item_6_12_e_a', LEGACY_B = 'chess_item_6_12_e_b';
const VESSEL_KEY = itemKeyOf(VESSEL), LEGACY_KEY = itemKeyOf(LEGACY);

const close = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} ≠ ${b}`);
/** Buff params `{ ...bb, ...bbStr }` of the item buff whose bbStr.key is `key`. */
const bp = (id, key) => ITEMS[id].buffs.map((b) => ({ ...b.bb, ...b.bbStr })).find((p) => p.key === key);
const VESSEL_BUFF = 'act2autochess_equip_acbabel_vessel_global_buff';
const LEGACY_ABILITY = 'act2autochess_equip_acbabel_legacy_ability';
const LEGACY_AMP = 'act2autochess_equip_acbabel_legacy_global_buff';

/** Synthetic operator (2000 HP / 500 ATK, the items.test.js numbers) and a sturdy dummy enemy. */
const OP = (id, o = {}) => chessRec({
  id, profession: 'WARRIOR', bonds: o.bonds ?? [], tier: 1,
  stats: { maxHp: 2000, atk: 500, def: 200, res: 10, aspd: 100, bat: 1, respawnTime: 20, spRecovery: 1, blockCnt: 2, ...(o.stats || {}) },
});
const DUMMY = (key = 'e_d', o = {}) => enemyRec({ key, hp: 1e9, speed: 0, atk: 0, ...o });

/**
 * One battle with `ops` (synthetic records), board `units` and one dummy in front. `players` overrides the default
 * single-player field (the 联防 tests).
 */
function fight({ ops = {}, units, foes = [[9, 9]], players, enemies = {} } = {}) {
  const defs = { chess: { t_op: OP('t_op'), t_mate: OP('t_mate'), ...ops }, enemies: { e_d: DUMMY(), ...enemies } };
  const input = players ?? [{ playerId: 'p1', seat: 0, side: 'L', colOffset: 0, bonds: {}, units }];
  const h = makeBattle({
    defs, players: input, enemies: foes.map(([r, c, key]) => ({ key: key ?? 'e_d', pos: [r, c] })),
    timeLimit: 999, autoFinish: false, captureNoisy: true,
  });
  h.step(1);
  return h;
}
/** HP `amount` removed from `tgt` by `src`; returns the loss. Shields/DEF apply (true damage skips DEF/RES). */
const lost = (h, src, tgt, amount, type = 'true') => {
  const before = tgt.hp;
  h.b.dealDamage(src, tgt, { amount, type, canDodge: false });
  return before - tgt.hp;
};
const done = (h) => { checkInvariants(h.b); assert.deepEqual(h.b.errors, []); };

// ---------------------------------------------------------------------------------------------------------------------
// the data

test('data: the three 巴别塔 items are in items.json with their names, tiers, set partners and 进阶 fields', () => {
  const rows = [
    [OATH, OATH_B, '巴别塔誓言', 2, 'BOND_GRANT', 5, 10, null],
    [VESSEL, VESSEL_B, '“魔王的祭器”', 5, 'SET', 25, 40, LEGACY_KEY],
    [LEGACY, LEGACY_B, '“文明的存续”', 6, 'SET', 20, 35, VESSEL_KEY],
  ];
  for (const [normal, adv, name, tier, category, pct, pctAdv] of rows) {
    for (const [id, advQ, want] of [[normal, false, pct], [adv, true, pctAdv]]) {
      const it = ITEMS[id];
      assert.ok(it, `${id} missing`);
      assert.equal(it.name, name, `${id} name (the punctuation is part of it)`);
      assert.equal(it.tier, tier, id);
      assert.equal(it.category, category, id);
      assert.equal(it.itemType, 'EQUIP', id);
      assert.equal(it.isGolden, advQ, id);
      // the official self-reference: a golden row's `goldenId` is its own id (see 天马之盔_b)
      assert.equal(it.goldenId, advQ ? id : adv, `${id}: golden link`);
      assert.equal(it.mergeable, !advQ, id);
      assert.equal(it.upgradeChessId, advQ ? null : adv, id);
      assert.equal(it.price, advQ ? 5 : ITEMS[normal].price, id);
      assert.ok(it.desc.includes(`+${want}%`), `${id}: the stat line ${it.desc}`);
      // `requiresBondId` is the official "must be a member of bond X" field — the 套装 condition is NOT that
      assert.equal(it.requiresBondId, null, `${id}: no bond requirement`);
      assert.equal(it.canGiveBond, false, `${id}: only 变形同构体 carries canGiveBond`);
    }
  }
  // 巴别塔誓言 is the `giveBondId` half of the official grant pair; the two SET items carry no bond at all
  for (const id of [OATH, OATH_B]) assert.equal(ITEMS[id].giveBondId, 'babelShip', id);
  for (const id of [VESSEL, VESSEL_B, LEGACY, LEGACY_B]) assert.equal(ITEMS[id].giveBondId, null, id);
  assert.equal(ITEMS[TRANSFORM].canGiveBond, true, '变形同构体 is the canGiveBond item');
  // the SET condition is the official `equip_chess_id` (suffix-less partner key), on the item's own buff blackboard
  assert.equal(bp(VESSEL, VESSEL_BUFF).equip_chess_id, LEGACY_KEY, '祭器 → 存续');
  assert.equal(bp(VESSEL_B, VESSEL_BUFF).equip_chess_id, LEGACY_KEY, 'either quality');
  assert.equal(bp(LEGACY, LEGACY_ABILITY).equip_chess_id, VESSEL_KEY, '存续 → 祭器');
  assert.equal(bp(LEGACY_B, LEGACY_ABILITY).equip_chess_id, VESSEL_KEY, 'either quality');
  // the 进阶 keeps the condition effect unchanged and adds the amplifier — the official 天马 relationship
  assert.deepEqual(bp(LEGACY_B, LEGACY_ABILITY), bp(LEGACY, LEGACY_ABILITY), 'the condition blackboard is the same');
  assert.equal(bp(LEGACY, LEGACY_AMP), undefined, 'the normal quality has no amplifier buff');
  assert.equal(bp(LEGACY_B, LEGACY_AMP).true_damage_mul, 2.5, 'the 进阶 amplifier');
  assert.deepEqual(
    [bp(VESSEL, VESSEL_BUFF).heal_scale, bp(VESSEL, VESSEL_BUFF).max_hp_scale], [0.4, 0.3], '祭器 shield numbers');
  assert.deepEqual(
    [bp(LEGACY, LEGACY_ABILITY).check_hp, bp(LEGACY, LEGACY_ABILITY).atk_per_stack,
      bp(LEGACY, LEGACY_ABILITY).attack_speed_per_stack, bp(LEGACY, LEGACY_ABILITY).max_stack_cnt],
    [3000, 0.05, 5, 4], '存续 layering numbers');
  // every item's trap character record exists (the item name and card come from it)
  for (const it of Object.values(ITEMS)) if (it.trapId.startsWith('trap_112')) assert.ok(it.trapId, it.id);
});

// ---------------------------------------------------------------------------------------------------------------------
// ① 巴别塔誓言 — the 转职 through the official canGiveBond pair

test('oath 2_08: 攻防 +5 % / +10 %; the carrier becomes a 【巴别塔】 member ONLY with 变形同构体', () => {
  for (const [id, pct] of [[OATH, 0.05], [OATH_B, 0.1]]) {
    // alone: the stats yes, the bond NO
    const alone = fight({ units: [{ chessId: 't_op', row: 10, col: 5, items: [id] }, { chessId: 't_mate', row: 10, col: 7 }] });
    const a = alone.unit('t_op');
    close(a.s.atk, 500 * (1 + pct), `${id} alone ATK`);
    close(a.s.maxHp, 2000 * (1 + pct), `${id} alone max HP`);
    assert.deepEqual(unitBonds(a), [], `${id} alone is not a 巴别塔 member`);
    assert.deepEqual(unitBonds(alone.unit('t_mate')), [], 'nor is a neighbour');
    done(alone);
    // with 变形同构体 on the SAME carrier: the bond appears
    const pair = fight({ units: [{ chessId: 't_op', row: 10, col: 5, items: [id, TRANSFORM] }, { chessId: 't_mate', row: 10, col: 7, items: [TRANSFORM] }] });
    const p = pair.unit('t_op');
    assert.deepEqual(unitBonds(p), ['babelShip'], `${id} + 变形同构体 ⇒ 巴别塔`);
    close(p.s.atk, 500 * (1 + pct), 'the stat line is unchanged by the grant');
    // 变形同构体 alone (no giveBondId partner) grants nothing — the canonical negative control
    assert.deepEqual(unitBonds(pair.unit('t_mate')), [], '变形同构体 without a giveBondId item grants nothing');
    done(pair);
  }
  // the grant is a battlefield-level effect too: the bond is what the garrison / bond handlers read (unitBonds)
  const h = fight({ units: [{ chessId: 't_op', row: 10, col: 5, items: [OATH, TRANSFORM] }] });
  assert.ok(itemGrants(h.b, h.unit('t_op')).some((g) => g.id === OATH), 'the item is installed as a grant');
  assert.equal(itemRecord(OATH).giveBondId, 'babelShip');
  done(h);
});

// ---------------------------------------------------------------------------------------------------------------------
// ② “魔王的祭器” — the ally-heal shield, capped at 30 % of the carrier's own max HP

test('vessel 5_10: an ally heal grants a shield of 40 % of the HP restored, the pool capped at 30 % max HP', () => {
  for (const [id, pct] of [[VESSEL, 0.25], [VESSEL_B, 0.4]]) {
    const h = fight({ ops: { t_heal: OP('t_heal') }, units: [
      { chessId: 't_op', row: 10, col: 5, items: [id, LEGACY] }, { chessId: 't_heal', row: 10, col: 7 }] });
    const u = h.unit('t_op'), healer = h.unit('t_heal');
    const key = `item:${id}:set`;
    // the item's own HP% and 存续's are both 直接乘算 percentages: one additive bucket, not (1+a)(1+b)
    close(u.s.maxHp, 2000 * (1 + pct + 0.2), `${id}: its own HP + 存续's`);
    assert.equal(bp(id, VESSEL_BUFF).heal_scale, 0.4, `${id}: heal_scale is the same on both qualities`);
    // 40 % of 1000 restored
    u.hp = 100;
    h.b.heal(healer, u, 1000);
    close(u.findBuff(key).shield, 400, `${id}: 40 % of the heal`);
    // the cap is 30 % of the carrier's max HP; a huge heal cannot pass it
    h.b.heal(healer, u, 1e6);
    close(u.findBuff(key).shield, u.s.maxHp * 0.3, `${id}: capped at 30 % max HP`);
    // 过量治疗 restores nothing ⇒ no shield; a 生命回复速度 tick is no 治疗 at all
    u.findBuff(key).shield = 0;
    u.markDirty();
    u.hp = u.s.maxHp;
    h.b.heal(healer, u, 1000);
    h.b.heal(healer, u, 1000, { overheal: true });
    h.b.heal(healer, u, 1000, { regen: true });
    assert.ok(!u.findBuff(key) || u.findBuff(key).shield <= 0, `${id}: over-heal and regen grant nothing`);
    // the carrier's own heal does not count (自身治疗 ≠ 友方治疗), nor does an enemy's
    u.hp = 100;
    h.b.heal(u, u, 1000, { self: true });
    h.b.heal(h.b.enemies[0], u, 1000);
    assert.ok(!u.findBuff(key) || u.findBuff(key).shield <= 0, `${id}: neither self-heal nor an enemy heal counts`);
    done(h);
  }
});

test('vessel 5_10: the set shield exists only while “文明的存续” is carried by the SAME operator', () => {
  // the shield buff key carries the CONCRETE item id (a normal and a golden copy install separate grants)
  const run = (carrierItems, mateItems = []) => {
    const h = fight({ ops: { t_heal: OP('t_heal') }, units: [
      { chessId: 't_op', row: 10, col: 5, items: carrierItems }, { chessId: 't_heal', row: 10, col: 7, items: mateItems }] });
    const u = h.unit('t_op'), healer = h.unit('t_heal');
    const key = `item:${carrierItems[0]}:set`;
    u.hp = 100;
    h.b.heal(healer, u, 1000);
    const shield = u.findBuff(key)?.shield ?? 0;
    done(h);
    return shield;
  };
  close(run([VESSEL]), 0, '祭器 alone: no shield');
  close(run([VESSEL, LEGACY]), 400, '祭器 + 存续 on the same carrier: the shield');
  close(run([VESSEL, LEGACY_B]), 400, 'either quality of the partner satisfies the set');
  close(run([VESSEL_B, LEGACY]), 400, 'and either quality of the 祭器');
  close(run([VESSEL_B, LEGACY_B]), 400, 'both 进阶');
  close(run([VESSEL], [LEGACY]), 0, '存续 on a TEAMMATE does not satisfy the set (same carrier only)');
});

// ---------------------------------------------------------------------------------------------------------------------
// ③ “文明的存续” — the 承伤 layering

test('legacy 6_12: every 3000 HP actually lost ⇒ +5 % ATK / +5 ASPD, at most 4 layers, for the battle', () => {
  for (const [id, pct] of [[LEGACY, 0.2], [LEGACY_B, 0.35]]) {
    // a carrier with room to lose 12000 HP (the 承伤 counter is about HP actually lost)
    const h = fight({ ops: { t_op: OP('t_op', { stats: { maxHp: 1e6 } }) },
      units: [{ chessId: 't_op', row: 10, col: 5, items: [id, VESSEL] }] });
    const u = h.unit('t_op');
    const key = `item:${id}:stacks`;
    const base = u.s.atk, baseAspd = u.s.aspd;
    close(base, 500 * (1 + pct), `${id}: its own ATK (+ 祭器's HP only)`);
    // one point short of the threshold: nothing
    u.hp = u.s.maxHp;
    lost(h, null, u, 2999);
    assert.equal(u.findBuff(key), null, `${id}: one point short`);
    // the 3000th point fires the first layer. The layer is a 直接乘算 percentage too, so it is SUMMED with the item's
    // own ATK% (500 × (1 + pct + 0.05)), never multiplied on top of it (the official 直接乘算 rule).
    lost(h, null, u, 1);
    close(u.findBuff(key).mods.atkPct, 0.05, `${id}: layer 1 ATK`);
    close(u.findBuff(key).mods.aspd, 5, `${id}: layer 1 ASPD`);
    close(u.s.atk, 500 * (1 + pct + 0.05), `${id}: the ATK really moved (additive with the item's own %)`);
    close(u.s.aspd, baseAspd + 5, `${id}: and the ASPD`);
    assert.ok(u.s.atk > base, `${id}: the layer raised the ATK`);
    // the accumulator carries ACROSS events: 1500 + 1500 is one whole threshold
    lost(h, null, u, 1500);
    lost(h, null, u, 1500);
    close(u.findBuff(key).mods.atkPct, 0.1, `${id}: crossing spread over two hits`);
    // up to four layers, then the cap
    for (let i = 0; i < 12; i++) lost(h, null, u, 3000);
    close(u.findBuff(key).mods.atkPct, 0.2, `${id}: capped at 4 layers of ATK`);
    close(u.findBuff(key).mods.aspd, 20, `${id}: capped at 4 layers of ASPD`);
    assert.equal(bp(id, LEGACY_ABILITY).max_stack_cnt, 4, id);
    // an element gauge chip is not HP loss, and a 流失 is no 受到伤害 — neither advances the counter
    const before = u.findBuff(key).mods.atkPct;
    h.b.dealDamage(null, u, { amount: 5000, type: 'element', element: 'burn' });
    const hp = u.hp;
    h.b.loseHp(u, 5000);
    assert.ok(u.hp < hp, 'the 流失 did lose HP');
    close(u.findBuff(key).mods.atkPct, before, `${id}: neither an element chip nor a 流失 counts`);
    done(h);
  }
});

test('legacy 6_12: the layering needs “魔王的祭器” on the SAME carrier, and only the carrier’s own damage counts', () => {
  const layersOf = (carrierItems, mateItems = []) => {
    const h = fight({ units: [{ chessId: 't_op', row: 10, col: 5, items: carrierItems },
      { chessId: 't_mate', row: 11, col: 5, items: mateItems }] });
    const u = h.unit('t_op');
    u.hp = u.s.maxHp;
    lost(h, null, u, 3000);
    const mate = h.unit('t_mate');
    lost(h, null, mate, 9000);                       // a teammate's HP loss is not the carrier's 承伤
    const v = u.findBuff(`item:${LEGACY}:stacks`)?.mods.atkPct ?? 0;
    done(h);
    return v;
  };
  close(layersOf([LEGACY]), 0, '存续 alone: no layering');
  close(layersOf([LEGACY, VESSEL]), 0.05, 'the pair on the same carrier');
  close(layersOf([LEGACY, VESSEL_B]), 0.05, 'either quality of 祭器');
  close(layersOf([LEGACY], [VESSEL]), 0, '祭器 on a TEAMMATE does not satisfy the set');
});

// ---------------------------------------------------------------------------------------------------------------------
// ④ the 进阶 global TRUE-damage amplifier

test('legacy 6_12_b: 所有敌方单位受到的真实伤害 +150 % — ×2.5, only for the owner, never twice', () => {
  const multi = (items) => fight({
    players: [
      { playerId: 'p1', seat: 0, side: 'L', colOffset: 0, bonds: {}, units: [
        { uid: 1, chessId: 't_op', row: 10, col: 5, items },
        { uid: 2, chessId: 't_mate', row: 10, col: 7 }] },
      { playerId: 'p2', seat: 1, side: 'R', colOffset: 0, bonds: {}, units: [
        { uid: 3, chessId: 't_op', row: 10, col: 15 }] },
    ],
  });
  // the 进阶: the owner's true damage ×2.5 …
  const adv = multi([LEGACY_B]);
  const owner = adv.unit(1), mate = adv.unit(2), other = adv.b.allyUnits.find((x) => x.ownerId === 'p2'), e = adv.b.enemies[0];
  close(lost(adv, owner, e, 1000), 2500, '进阶: the carrier\'s true damage ×2.5');
  // … a teammate of the SAME player counts as "该玩家造成的伤害" too
  close(lost(adv, mate, e, 1000), 2500, '进阶: any unit of the owner player');
  // … but the other player's operator is untouched
  close(lost(adv, other, e, 1000), 1000, '进阶: the other player is never amplified');
  // only TRUE damage
  close(lost(adv, owner, e, 1000, 'arts'), 1000, '进阶: arts damage is not amplified');
  close(lost(adv, owner, e, 1000, 'phys'), 1000, '进阶: physical damage is not amplified');
  // damage the carrier TAKES is not amplified either (an enemy's true damage vs. the carrier)
  const carrierHp = owner.hp;
  adv.b.dealDamage(adv.b.enemies[0], owner, { amount: 1000, type: 'true', canDodge: false });
  close(carrierHp - owner.hp, 1000, '进阶: incoming true damage is unchanged');
  // never applied twice to one instance (no re-entry, no squaring)
  const hooks = [];
  adv.b.on('hit', (c) => hooks.push(c.dmg.mul));
  lost(adv, owner, e, 1000);
  assert.deepEqual(hooks, [2.5], 'the multiplier is written exactly once per instance');
  done(adv);
  // the normal quality has no amplifier at all
  const norm = multi([LEGACY]);
  const nOwner = norm.unit(1), nE = norm.b.enemies[0];
  close(lost(norm, nOwner, nE, 1000), 1000, 'normal quality: no amplifier');
  done(norm);
  // the amplifier is per-CARRIER, not per-unit: a teammate of the same player is amplified too (the item's scope is
  // "该玩家造成的伤害"), while an operator of the other player is not.
  const withOne = fight({ units: [{ chessId: 't_op', row: 10, col: 5, items: [LEGACY_B] },
    { chessId: 't_mate', row: 10, col: 7 }] });
  close(lost(withOne, withOne.unit('t_op'), withOne.b.enemies[0], 1000), 2500, 'the carrier');
  close(lost(withOne, withOne.unit('t_mate'), withOne.b.enemies[0], 1000), 2500, 'another unit of the same player');
  done(withOne);
  // ... and a player with NO carrier is untouched even in the same battle as one
  const twoPlayers = multi([LEGACY_B]);
  const p2 = twoPlayers.b.allyUnits.find((x) => x.ownerId === 'p2');
  close(lost(twoPlayers, p2, twoPlayers.b.enemies[0], 1000), 1000, 'a player with no carrier');
  done(twoPlayers);
});

test('legacy 6_12_b: two carriers of the same player do NOT square the amplifier', () => {
  const h = fight({ units: [
    { chessId: 't_op', row: 10, col: 5, items: [LEGACY_B] },
    { chessId: 't_mate', row: 10, col: 7, items: [LEGACY_B] }] });
  const u = h.unit('t_op'), e = h.b.enemies[0];
  close(lost(h, u, e, 1000), 2500, '×2.5 once, whatever the number of carriers');
  done(h);
});

// ---------------------------------------------------------------------------------------------------------------------
// no other item or bond is disturbed by the new keys

test('the two new battle keys are read by the fiat handlers only (no official item carries them)', () => {
  const withVessel = Object.values(ITEMS).filter((it) => it.buffs.some((b) => b.bbStr?.key === VESSEL_BUFF));
  const withAmp = Object.values(ITEMS).filter((it) => it.buffs.some((b) => b.bbStr?.key === LEGACY_AMP));
  assert.deepEqual(withVessel.map((i) => i.id).sort(), [VESSEL, VESSEL_B].sort());
  assert.deepEqual(withAmp.map((i) => i.id).sort(), [LEGACY_B].sort(), 'the amplifier is 进阶-only');
});
