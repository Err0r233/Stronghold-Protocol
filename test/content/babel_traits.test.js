// 巴别塔 「承伤 + 治疗 + 伤害输出」axes — the THREE new IN_BATTLE handlers of server/sim/content/garrisons/battle.js,
// and the data wiring of the maintainer's revised 特质 table (tools/content/custom.mjs;
// docs/research/15-babel-bond.md §2 as revised on 2026-10-12):
//
//   act1autochess_gar_event_takedamage   奥达 garrison_163_a/_b       每累计承受 800 点伤害 → 巴别塔 +1 / +2 (cap 8 / 16)
//   act1autochess_gar_event_healamount   阿米娅·医疗 garrison_164_a/_b 每累计实际治疗 1200 点 → 巴别塔 / 奥术 各 +2 / +4 (cap 10 / 20)
//   act1autochess_gar_event_dealdamage   逻各斯 garrison_169_a/_b     每累计造成 5000 点伤害 → 巴别塔 / 奥术 / 精准 各 +6 / +8 (cap 24 / 32)
//                                        阿斯卡纶 garrison_166_a/_b   每累计造成 4000 点伤害 → 巴别塔 / 突袭 各 +2 / +4 (cap 6 / 12)
//
// Every number below comes from data/garrisons.json (bb.check_hp / bb.check_damage / bb.bond_add_count /
// bb.max_add_count_per_battle) — the handlers read the same blackboard, no threshold is hard-coded anywhere. The last
// test is the rebuild guard of the whole 11-trait table: owners, the replaced rows being gone, and no orphan
// (ownerless) fiat garrison row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { getData } from '../../server/data.js';
import { garrisonKeep } from '../../tools/content/custom.mjs';

const D = getData({ log: { warn() {}, error() {}, info() {} } });
const GR = (gid) => D.garrisons[gid];
const num = (v, d = 0) => (Number.isFinite(+v) && v !== '' && v != null ? +v : d);
const ids = (s) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const B = (layers = 0, active = true) => ({ count: active ? 3 : 0, active, tier: active ? 1 : 0, layers });
const gains = (h, pid = 'p1') => h.result().perPlayer[pid].layerGains;
const approx = (a, b, msg = '') => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${msg}: ${a} != ${b}`);
/** A static, harmless dummy: 1e7 HP, no attack, no movement. */
const dummy = (o = {}) => ({ ...enemyRec({ key: 'e_dummy', hp: 1e7, speed: 0, atk: 0, ...o }), tags: o.tags ?? [] });

/** Battle of synthetic operators: units = [{ id, g, row, col, bonds?, stats? }]. */
function battle({ units, bonds = {}, seed = 5 }) {
  const chess = {};
  for (const u of units) chess[u.id] = { ...chessRec({ id: u.id, stats: u.stats }), bonds: u.bonds ?? [], garrisonIds: u.g ?? [] };
  const h = makeBattle({
    seed, bonds, autoFinish: false, timeLimit: 400, captureNoisy: true,
    defs: { chess, enemies: { dummy: dummy() } },
    units: units.map((u) => ({ chessId: u.id, row: u.row, col: u.col })),
    enemies: [],
  });
  h.step(1);
  return h;
}

// ---------------------------------------------------------------------------------------------------------------------
// 承伤 (奥达 garrison_163)

test('takedamage 163: every check_hp (800) of damage the holder takes adds 巴别塔 +1 / +2, capped at 8 / 16', () => {
  for (const [gid, per, cap] of [['garrison_163_a', 1, 8], ['garrison_163_b', 2, 16]]) {
    const bb = GR(gid).bb;
    assert.deepEqual([bb.check_hp, bb.bond_add_count, bb.max_add_count_per_battle], [800, per, cap], `${gid}: the data`);
    assert.equal(GR(gid).effectKey, 'act1autochess_gar_event_takedamage');
    const h = battle({ units: [{ id: 'odda', g: [gid], row: 10, col: 4, stats: { maxHp: 1e6 } }], bonds: { babelShip: B(0) } });
    const u = h.unit('odda');
    const hit = (n) => h.b.dealDamage(null, u, { amount: n, type: 'true' });
    hit(bb.check_hp - 1);
    assert.deepEqual(gains(h), {}, `${gid}: one point short of the threshold`);
    hit(1);
    assert.deepEqual(gains(h), { babelShip: per }, `${gid}: the ${bb.check_hp}th point fires`);
    approx(u.hp, 1e6 - bb.check_hp, 'the HP really went down');
    // the accumulator carries over the events and fires once per whole threshold
    for (let i = 0; i < 2; i++) hit(bb.check_hp);
    assert.deepEqual(gains(h), { babelShip: 3 * per }, `${gid}: three thresholds`);
    // a gauge chip (type 'element') is not HP loss although it does emit `damaged`
    const elem = h.hooksOf('damaged').length;
    h.b.dealDamage(null, u, { amount: 100, type: 'element', element: 'burn' });
    assert.equal(h.hooksOf('damaged').filter((c) => c.type === 'element').length, 1, 'an element `damaged` event happened');
    assert.equal(h.hooksOf('damaged').length, elem + 1);
    // a 流失 loses HP but is no 受到伤害 (damage.js isHpLoss / PRTS 作战机制)
    const hp = u.hp;
    h.b.loseHp(u, 5000);
    assert.ok(u.hp < hp, 'the 流失 did lose HP');
    assert.deepEqual(gains(h), { babelShip: 3 * per }, `${gid}: neither an element chip nor a 流失 counts`);
    // the per-battle cap
    const need = Math.ceil(cap / per) + 2;
    for (let i = 0; i < need; i++) hit(bb.check_hp * 2);
    assert.deepEqual(gains(h), { babelShip: cap }, `${gid}: capped at ${cap}`);
    checkInvariants(h.b);
  }
});

test('takedamage 163: only the holder\'s own damage counts, and an inactive 巴别塔 takes nothing', () => {
  const h = battle({
    units: [
      { id: 'odda', g: ['garrison_163_a'], row: 10, col: 4, stats: { maxHp: 1e6 } },
      { id: 'other', row: 11, col: 4, stats: { maxHp: 1e6 } },
    ],
    bonds: { babelShip: B(0) },
  });
  h.b.dealDamage(null, h.unit('other'), { amount: 1200 * 4, type: 'true' });
  assert.deepEqual(gains(h), {}, 'a teammate\'s HP loss is not the holder\'s 承伤');
  h.b.dealDamage(null, h.unit('odda'), { amount: 1200, type: 'true' });
  assert.deepEqual(gains(h), { babelShip: 1 });
  // 巴别塔 inactive: the crossings are consumed, nothing lands
  const off = battle({ units: [{ id: 'odda', g: ['garrison_163_a'], row: 10, col: 4, stats: { maxHp: 1e6 } }], bonds: { babelShip: B(0, false) } });
  off.b.dealDamage(null, off.unit('odda'), { amount: 1200 * 3, type: 'true' });
  assert.deepEqual(gains(off), {}, 'no active 巴别塔 ⇒ no layers');
  checkInvariants(off.b);
});

// ---------------------------------------------------------------------------------------------------------------------
// 治疗 (阿米娅·医疗 garrison_164)

test('healamount 164: every check_hp (1200) of ACTUAL healing adds 巴别塔 AND 奥术 +2 / +4, capped at 10 / 20', () => {
  for (const [gid, per, cap] of [['garrison_164_a', 2, 10], ['garrison_164_b', 4, 20]]) {
    const bb = GR(gid).bb;
    assert.deepEqual([bb.check_hp, bb.bond_add_count, bb.max_add_count_per_battle], [1200, per, cap], `${gid}: the data`);
    assert.equal(GR(gid).effectKey, 'act1autochess_gar_event_healamount');
    const h = battle({
      units: [
        { id: 'amiya', g: [gid], row: 10, col: 4, stats: { maxHp: 1e6 } },
        { id: 'mate', row: 10, col: 6, stats: { maxHp: 1e6 } },
      ],
      bonds: { babelShip: B(0), arcaneShip: B(0), raidShip: B(0) },
    });
    const a = h.unit('amiya'), m = h.unit('mate');
    m.hp = 1;
    h.b.heal(a, m, bb.check_hp - 1);
    assert.deepEqual(gains(h), {}, `${gid}: one point short`);
    h.b.heal(a, m, 1);
    assert.deepEqual(gains(h), { babelShip: per, arcaneShip: per }, `${gid}: both bonds, once each`);
    // 过量治疗: a full-HP target restores nothing, so nothing accumulates — `overheal` only makes a shield
    m.hp = m.s.maxHp;
    h.b.heal(a, m, bb.check_hp);
    h.b.heal(a, m, bb.check_hp, { overheal: true });
    assert.ok(m.findBuff('overheal'), 'the over-heal became a shield');
    assert.deepEqual(gains(h), { babelShip: per, arcaneShip: per }, `${gid}: no HP restored ⇒ no count`);
    // her own self-heal counts
    a.hp = 1;
    h.b.heal(a, a, bb.check_hp, { self: true });
    assert.deepEqual(gains(h), { babelShip: 2 * per, arcaneShip: 2 * per }, `${gid}: healing herself counts`);
    // the per-battle cap
    m.hp = 1;
    for (let i = 0; i < Math.ceil(cap / per) + 2; i++) h.b.heal(a, m, bb.check_hp);
    assert.deepEqual(gains(h), { babelShip: cap, arcaneShip: cap }, `${gid}: capped at ${cap} each`);
    checkInvariants(h.b);
  }
});

test('healamount 164: one heal event per target — a multi-target heal counts each target once, never twice', () => {
  const gid = 'garrison_164_a', per = num(GR(gid).bb.bond_add_count), need = num(GR(gid).bb.check_hp);
  const h = battle({
    units: [
      { id: 'amiya', g: [gid], row: 10, col: 4, stats: { maxHp: 1000 } },
      { id: 'm1', row: 10, col: 6, stats: { maxHp: 1e6 } },
      { id: 'm2', row: 10, col: 8, stats: { maxHp: 1e6 } },
    ],
    bonds: { babelShip: B(0), arcaneShip: B(0) },
  });
  const a = h.unit('amiya'), m1 = h.unit('m1'), m2 = h.unit('m2');
  m1.hp = 1; m2.hp = 1;
  // one event for m1 (half a threshold): nothing yet, and no double count of the single event
  h.b.heal(a, m1, need / 2);
  assert.deepEqual(gains(h), {}, 'half a threshold');
  assert.equal(h.hooksOf('heal').filter((c) => c.source === a).length, 1, 'one heal event for one target');
  // the second target's event completes the threshold exactly once
  h.b.heal(a, m2, need / 2);
  assert.deepEqual(gains(h), { babelShip: per, arcaneShip: per }, 'the two events sum to one crossing');
  // a single event of a whole threshold is counted once (not once per target of a "multi-target" heal)
  m1.hp = 1;
  h.b.heal(a, m1, need);
  assert.deepEqual(gains(h), { babelShip: 2 * per, arcaneShip: 2 * per }, 'one event, one crossing');
  checkInvariants(h.b);
});

test('healamount 164: 生命回复速度 ticks, other healers and non-干员 targets do not count', () => {
  const gid = 'garrison_164_a', per = num(GR(gid).bb.bond_add_count), need = num(GR(gid).bb.check_hp);
  const h = battle({
    units: [
      { id: 'amiya', g: [gid], row: 10, col: 4, stats: { maxHp: 1000 } },
      { id: 'other', row: 11, col: 4, stats: { maxHp: 1000 } },
      { id: 'mate', row: 10, col: 6, stats: { maxHp: 1e6 } },
    ],
    bonds: { babelShip: B(0), arcaneShip: B(0) },
  });
  const a = h.unit('amiya'), o = h.unit('other'), m = h.unit('mate');
  m.hp = 1;
  h.b.heal(o, m, need);                                   // another healer
  h.b.heal(a, m, need, { regen: true });                  // 生命回复速度 is no 治疗 (damage.js heal header)
  assert.deepEqual(gains(h), {}, 'neither another source nor a regen tick counts');
  h.b.heal(a, m, need);
  assert.deepEqual(gains(h), { babelShip: per, arcaneShip: per }, 'her own real heal does');
  // 巴别塔 inactive, 奥术 active: only the active bond takes its share
  const off = battle({
    units: [
      { id: 'amiya', g: [gid], row: 10, col: 4, stats: { maxHp: 1000 } },
      { id: 'mate', row: 10, col: 6, stats: { maxHp: 1e6 } },
    ],
    bonds: { babelShip: B(0, false), arcaneShip: B(0) },
  });
  off.unit('mate').hp = 1;
  off.b.heal(off.unit('amiya'), off.unit('mate'), need);
  assert.deepEqual(gains(off), { arcaneShip: per }, 'an inactive bond takes nothing');
  checkInvariants(off.b);
});

// ---------------------------------------------------------------------------------------------------------------------
// 伤害输出 (逻各斯 garrison_169 / 阿斯卡纶 garrison_166)

test('dealdamage 169/166: every check_damage of ACTUAL damage dealt adds both bonds, capped per id', () => {
  for (const [gid, per, cap, check, bonds] of [
    ['garrison_166_a', 2, 6, 4000, ['babelShip', 'raidShip']],
    ['garrison_166_b', 4, 12, 4000, ['babelShip', 'raidShip']],
    ['garrison_169_a', 6, 24, 5000, ['babelShip', 'arcaneShip', 'preciShip']],
    ['garrison_169_b', 8, 32, 5000, ['babelShip', 'arcaneShip', 'preciShip']],
  ]) {
    const bb = GR(gid).bb;
    assert.deepEqual([bb.check_damage, bb.bond_add_count, bb.max_add_count_per_battle], [check, per, cap], `${gid}: the data`);
    assert.equal(GR(gid).effectKey, 'act1autochess_gar_event_dealdamage');
    assert.deepEqual(ids(GR(gid).bbStr.bond_id), bonds, gid);
    const h = battle({
      units: [{ id: 'op', g: [gid], row: 10, col: 4 }, { id: 'mate', row: 11, col: 4 }],
      bonds: Object.fromEntries(bonds.map((b) => [b, B(0)])),
    });
    const u = h.unit('op'), mate = h.unit('mate');
    const e = h.spawn('dummy', { pos: [9, 9] });
    const hit = (n) => h.b.dealDamage(u, e, { amount: n, type: 'true', canDodge: false });
    const want = (k) => Object.fromEntries(bonds.map((b) => [b, k * per]));
    hit(check - 1);
    assert.deepEqual(gains(h), {}, `${gid}: one point short`);
    hit(1);
    assert.deepEqual(gains(h), want(1), `${gid}: the ${check}th point fires`);
    // the accumulator carries across events
    hit(check); hit(check);
    assert.deepEqual(gains(h), want(3), `${gid}: three thresholds`);
    // only the holder's own damage counts
    h.b.dealDamage(mate, e, { amount: check * 3, type: 'true', canDodge: false });
    assert.deepEqual(gains(h), want(3), `${gid}: a teammate's damage does not count`);
    // an element gauge chip is not 造成伤害, and a 流失 is no 造成伤害 either
    h.b.dealDamage(u, e, { amount: 5000, type: 'element', element: 'burn' });
    h.b.loseHp(e, 5000);
    assert.deepEqual(gains(h), want(3), `${gid}: neither an element chip nor a 流失 counts`);
    // the per-battle cap
    for (let i = 0; i < Math.ceil(cap / per) + 3; i++) hit(check);
    assert.deepEqual(gains(h), want(cap / per), `${gid}: capped at ${cap} each`);
    checkInvariants(h.b);
  }
});

test('dealdamage: friendly fire, self damage and 无来源 damage never count; over-kill is not counted', () => {
  const gid = 'garrison_166_a', per = num(GR(gid).bb.bond_add_count), need = num(GR(gid).bb.check_damage);
  const h = battle({
    units: [{ id: 'op', g: [gid], row: 10, col: 4, stats: { maxHp: 1e6 } }, { id: 'mate', row: 11, col: 4, stats: { maxHp: 1e6 } }],
    bonds: { babelShip: B(0), raidShip: B(0) },
  });
  const u = h.unit('op'), mate = h.unit('mate');
  const e = h.spawn('dummy', { pos: [9, 9] });
  h.b.dealDamage(u, mate, { amount: need * 4, type: 'true', canDodge: false });   // friendly fire
  h.b.dealDamage(u, u, { amount: need * 4, type: 'true', canDodge: false });      // self damage
  h.b.dealDamage(null, e, { amount: need * 4, type: 'true' });                    // 无来源
  assert.deepEqual(gains(h), {}, 'none of them is 该干员造成的伤害');
  // over-kill: a target with 1 HP left takes one point of HP, whatever the instance says
  e.hp = 1;
  h.b.dealDamage(u, e, { amount: need * 5, type: 'true', canDodge: false });
  assert.deepEqual(gains(h), {}, 'the instance is clamped to the HP the bar actually lost');
  const e2 = h.spawn('dummy', { pos: [9, 10] });
  h.b.dealDamage(u, e2, { amount: need, type: 'true', canDodge: false });
  assert.deepEqual(gains(h), { babelShip: per, raidShip: per }, 'a full threshold still fires');
  checkInvariants(h.b);
});

test('dealdamage 169/166: an inactive bond takes nothing, and the pair fires from one handler', () => {
  // 巴别塔 off, 奥术 and 精准 on: only the ACTIVE bonds take their share — 169's target list is 巴别塔 / 奥术 / 精准
  // since the maintainer's ruling of 2026-10-13 (the same ruling that gave 逻各斯 the 精准 bond itself)
  const off = battle({
    units: [{ id: 'logos', g: ['garrison_169_a'], row: 10, col: 4 }],
    bonds: { babelShip: B(0, false), arcaneShip: B(0), preciShip: B(0) },
  });
  const e = off.spawn('dummy', { pos: [9, 9] });
  off.b.dealDamage(off.unit('logos'), e, { amount: num(GR('garrison_169_a').bb.check_damage), type: 'true', canDodge: false });
  assert.deepEqual(gains(off), { arcaneShip: 6, preciShip: 6 }, 'only the active bonds take their share');
  checkInvariants(off.b);
  // 阿斯卡纶's 击倒 pair is gone: a kill alone no longer grants 巴别塔 / 突袭
  const kill = battle({
    units: [{ id: 'ascln', g: ['garrison_166_a'], row: 10, col: 4 }],
    bonds: { babelShip: B(0), raidShip: B(0) },
  });
  const k = kill.spawn('dummy', { pos: [9, 9] });
  kill.b.emit('kill', { killer: kill.unit('ascln'), victim: k });
  assert.deepEqual(gains(kill), {}, 'the replaced 前3次击倒 row is really gone');
  checkInvariants(kill.b);
});

// ---------------------------------------------------------------------------------------------------------------------
// the revised table in the rebuilt data

test('data: the revised 特质 table — owners, replaced rows gone, 独行 membership (阿斯卡纶 out, 2026-10-13), no orphan fiat garrison', () => {
  for (const [gid, owner] of [['garrison_163_a', 'chess_char_1_06_babel_a'], ['garrison_163_b', 'chess_char_1_06_babel_b'],
    ['garrison_164_a', 'chess_char_2_05_babel_a'], ['garrison_164_b', 'chess_char_2_05_babel_b'],
    ['garrison_166_a', 'chess_char_3_05_babel_a'], ['garrison_166_b', 'chess_char_3_05_babel_b'],
    ['garrison_169_a', 'chess_char_5_07_babel_a'], ['garrison_169_b', 'chess_char_5_07_babel_b']]) {
    assert.deepEqual(GR(gid).owners, [owner], gid);
    assert.deepEqual([GR(gid).eventType, GR(gid).effectType, GR(gid).eventTypeDesc, GR(gid).eventTypeIcon],
      ['IN_BATTLE', 'ADD_BOND', '持续叠加', 'icon_bond'], `${gid}: the official 持续叠加 row shape`);
  }
  // 奥达 / 阿米娅·医疗: the old (承伤 / 治疗-unrelated) rows are replaced, not left behind
  for (const id of ['garrison_165_a', 'garrison_165_b', 'garrison_171_a', 'garrison_171_b', 'garrison_172_a', 'garrison_172_b']) {
    assert.equal(GR(id), undefined, `${id} must be gone`);
  }
  assert.deepEqual(D.chess['chess_char_1_06_babel_a'].garrisonIds, ['garrison_163_a']);
  assert.deepEqual(D.chess['chess_char_2_05_babel_a'].garrisonIds, ['garrison_164_a']);
  // 华法琳: the OFFICIAL granting pair (72 → 95) with the data's own 7 / 14 cap — the 4 / 8 cap override and its
  // garrison_173_a/_b → garrison_174_a/_b pair were WITHDRAWN (maintainer, 2026-10-13), so the visible T4 pair is back
  // on plain official data and the fiat rows are gone from the dataset
  assert.deepEqual([GR('garrison_72_a').bbStr.give_garrison_id, GR('garrison_72_b').bbStr.give_garrison_id], ['garrison_95_a', 'garrison_95_b']);
  assert.deepEqual([num(GR('garrison_95_a').bb.max_add_count_per_battle), num(GR('garrison_95_b').bb.max_add_count_per_battle)], [7, 14]);
  assert.deepEqual([num(GR('garrison_95_a').bb.bond_add_count), num(GR('garrison_95_b').bb.bond_add_count)], [1, 2]);
  assert.deepEqual([D.chess['chess_char_4_26_a'].garrisonIds, D.chess['chess_char_4_26_b'].garrisonIds], [['garrison_72_a'], ['garrison_72_b']]);
  assert.deepEqual([GR('garrison_173_a'), GR('garrison_173_b'), GR('garrison_174_a'), GR('garrison_174_b')],
    [undefined, undefined, undefined, undefined], 'the withdrawn 华法琳 override is gone');
  // 逻各斯 169 / 阿斯卡纶 166: the 休整期 / 前3次击倒 rows give way to the 造成伤害 counter under the same ids (no orphan)
  for (const [gid, check, per, cap] of [['garrison_169_a', 5000, 6, 24], ['garrison_169_b', 5000, 8, 32],
    ['garrison_166_a', 4000, 2, 6], ['garrison_166_b', 4000, 4, 12]]) {
    assert.deepEqual([num(GR(gid).bb.check_damage), num(GR(gid).bb.bond_add_count), num(GR(gid).bb.max_add_count_per_battle)],
      [check, per, cap], gid);
    assert.equal(GR(gid).bb.count ?? null, null, `${gid}: the old 休整期 count key is gone`);
    assert.equal(GR(gid).eventType, 'IN_BATTLE', gid);
  }
  // 逻各斯's 169 target list gained 精准 on 2026-10-13 (maintainer): the row now writes 【巴别塔】【奥术】【精准】, and the
  // handler's `bond_id` lists the three in the ORDER OF THE TEXT (the same order the 'each of them +6 / +8' payment walks).
  // check_damage / bond_add_count / max_add_count_per_battle are untouched by this ruling (asserted just above).
  for (const [gid, per] of [['garrison_169_a', 6], ['garrison_169_b', 8]]) {
    assert.deepEqual(ids(GR(gid).bbStr.bond_id), ['babelShip', 'arcaneShip', 'preciShip'], gid);
    assert.match(GR(gid).descRaw, /^<战斗中>每累计造成5000点伤害，使已激活的【巴别塔】【奥术】【精准】层数<@ba\.vup>\+\d+<\/>（每场作战至多\d+层）$/, `${gid}: the three-bond text`);
    assert.match(GR(gid).desc, new RegExp(`【巴别塔】【奥术】【精准】层数\\+${per}（每场作战至多`), `${gid}: the plain text`);
  }
  // 阿斯卡纶 no longer carries 独行: the maintainer's ruling of 2026-10-13 (docs/DATA.md §19.10) drops soloShip from her to
  // take that covenant's OWN bonuses away (its ×1.6 ATK / HP and its +15 SP on deploy); 独行 had pushed her ATK up, which
  // made her the likely 【指挥】, and a 指挥's fixed aura sits badly on a 突袭 unit. NOTHING here asserts the election: the
  // pick is purely the highest-ATK 巴别塔 member at battle start, she may still be chosen, and the assertions below only
  // read her `bonds` and the member lists. Her row is this file's (a FIAT chess), so the EXACT final `bondIds` is what
  // data/chess.json carries, and soloShip's own member list drops both of her ids; the bond's own numbers (maxCount 1,
  // 越少越强) do not move. She keeps 巴别塔 and 突袭.
  assert.deepEqual(D.chess['chess_char_3_05_babel_a'].bonds, ['babelShip', 'raidShip']);
  assert.deepEqual(D.chess['chess_char_3_05_babel_b'].bonds, ['babelShip', 'raidShip']);
  assert.ok(!D.bonds.soloShip.members.includes('chess_char_3_05_babel_a'), 'soloShip no longer lists her chessId');
  assert.ok(!D.bonds.soloShip.members.includes('chess_char_3_05_babel_b'), 'soloShip no longer lists her elite id');
  assert.ok(D.bonds.raidShip.members.includes('chess_char_3_05_babel_a'), 'she is still a 突袭 member');
  assert.ok(D.bonds.babelShip.members.includes('chess_char_3_05_babel_a'), 'she is still a 巴别塔 member');
  assert.deepEqual([D.bonds.soloShip.members.length, D.bonds.soloShip.visibleMembers.length], [6, 6]);
  assert.equal(D.bonds.soloShip.maxCount, 1);
  assert.deepEqual([D.bonds.babelShip.members.length, D.bonds.babelShip.visibleMembers.length], [13, 11]);
  // 精准 preciShip: 逻各斯 and 维什戴尔 gained the ADD-ON bond (maintainer's ruling of 2026-10-13, docs/DATA.md §19.10),
  // appended at the END of their own `bonds` and mirrored into the official member list by the `bondChessIds` union.
  // The bond itself is untouched: still the add-on 在场 2 名 / 3 名 threshold pair, never core.
  assert.deepEqual(D.chess['chess_char_5_07_babel_a'].bonds, ['babelShip', 'arcaneShip', 'preciShip']);
  assert.deepEqual(D.chess['chess_char_5_07_babel_b'].bonds, ['babelShip', 'arcaneShip', 'preciShip']);
  assert.deepEqual(D.chess['chess_char_6_04_babel_a'].bonds, ['babelShip', 'preciShip']);
  assert.deepEqual(D.chess['chess_char_6_04_babel_b'].bonds, ['babelShip', 'preciShip']);
  // `members` / `visibleMembers` keep the NORMAL ids only (buildBonds drops the elites), so both `_a` ids must be there
  // and the `_b` ids are covered by the `bonds` assertions above.
  for (const id of ['chess_char_5_07_babel_a', 'chess_char_6_04_babel_a']) {
    assert.ok(D.bonds.preciShip.members.includes(id), `preciShip lists ${id}`);
  }
  assert.deepEqual([D.bonds.preciShip.members.length, D.bonds.preciShip.visibleMembers.length], [14, 14]);
  assert.deepEqual([D.bonds.preciShip.thresholds, D.bonds.preciShip.thresholdTemplate, D.bonds.preciShip.maxCount, D.bonds.preciShip.isCore],
    [[2, 3], 'count_threshold_upward', null, false], '精准 stays the add-on 2 / 3 bond');
  // 维什戴尔: ONE 作战能力 row (the fixed +20 / +40 % half and the per-3-layers half of the same sentence), so the
  // detail card never draws two 作战能力 blocks; the layer judgement takes 精准 too since 2026-10-13 (maintainer) —
  // stepsOf() SUMS the listed bonds' layers before `divide_num`, so the text reads 【巴别塔】【精准】每叠加3层 and the
  // row is STILL one row with the same base_* / per-step numbers. 赫德雷 keeps his own per-layer pair unchanged.
  for (const [id, gid, base, per] of [['chess_char_6_04_babel_a', 'garrison_170_a', 0.2, 0.01],
    ['chess_char_6_04_babel_b', 'garrison_170_b', 0.4, 0.02]]) {
    assert.deepEqual(D.chess[id].garrisonIds, [gid], `${id}: a single 特质 id`);
    assert.deepEqual([GR(gid).eventTypeDesc, GR(gid).effectKey, GR(gid).battleRuneKey], ['作战能力', 'act1autochess_gar_eff_attrByBond', 'env_gbuff_new_with_verify'], gid);
    assert.deepEqual([num(GR(gid).bb.base_atk), num(GR(gid).bb.base_max_hp), num(GR(gid).bb.divide_num), num(GR(gid).bb.atk), num(GR(gid).bb.max_hp)],
      [base, base, 3, per, per], `${gid}: both halves in one blackboard`);
    assert.deepEqual(ids(GR(gid).bbStr.bond_id), ['babelShip', 'preciShip'], gid);
    assert.match(GR(gid).descRaw, /^攻击力和生命值\+<@ba\.vup>(20|40)%<\/>；【巴别塔】【精准】每叠加3层/, `${gid}: the one-line text`);
  }
  for (const gid of ['garrison_168_a', 'garrison_168_b']) {
    assert.deepEqual(GR(gid).owners, [gid.endsWith('_a') ? 'chess_char_5_06_babel_a' : 'chess_char_5_06_babel_b'], `${gid}: 赫德雷 only`);
    assert.equal(GR(gid).bb.base_atk ?? null, null, `${gid}: no fixed half`);
  }
  // no ownerless row in the fiat id range (161 克莱门莎 … 170 维什戴尔) except a granted half, which is
  // never listed in a chess's garrisonIds and is reached through the granting row's blackboard instead — and except the
  // rows tools/content/custom.mjs keeps on purpose (`garrisonKeep`: the official 特质 a 自研 replacement took over, plus
  // 克莱门莎's own old pair; docs/DATA.md §19.4)
  const granted = new Set();
  for (const g of Object.values(D.garrisons)) if (g.bbStr && g.bbStr.give_garrison_id) granted.add(g.bbStr.give_garrison_id);
  const kept = new Set(garrisonKeep);
  for (const id of Object.keys(D.garrisons)) {
    const n = num(String(id).replace(/^garrison_/, '').replace(/_[ab]$/, ''));
    if (!(n >= 161 && n <= 174) || granted.has(id) || kept.has(id)) continue;
    assert.ok(GR(id).owners.length > 0, `${id}: orphan fiat garrison row`);
  }
  // the keep list itself really is in the dataset, with no owners (the documented orphan shape)
  for (const id of garrisonKeep) {
    assert.ok(GR(id), `${id}: kept row is present`);
    assert.deepEqual(GR(id).owners, [], `${id}: kept row has no owners`);
  }
  // the three new keys are owned by exactly the 巴别塔 shops above
  const ownersOfKey = (key) => Object.values(D.garrisons).filter((g) => g.effectKey === key).flatMap((g) => g.owners).sort();
  for (const gid of ['garrison_163_a', 'garrison_163_b', 'garrison_164_a', 'garrison_164_b', 'garrison_166_a', 'garrison_166_b',
    'garrison_169_a', 'garrison_169_b']) assert.equal(GR(gid).owners.length, 1, gid);
  assert.deepEqual(ownersOfKey('act1autochess_gar_event_takedamage'), ['chess_char_1_06_babel_a', 'chess_char_1_06_babel_b']);
  assert.deepEqual(ownersOfKey('act1autochess_gar_event_healamount'), ['chess_char_2_05_babel_a', 'chess_char_2_05_babel_b']);
  assert.deepEqual(ownersOfKey('act1autochess_gar_event_dealdamage'),
    ['chess_char_3_05_babel_a', 'chess_char_3_05_babel_b', 'chess_char_5_07_babel_a', 'chess_char_5_07_babel_b']);
});

// ---------------------------------------------------------------------------------------------------------------------
// the 精准 inclusion of 2026-10-13, measured in the engine (not only read off the data)

test('attrByBond 170: the layer judgement takes 精准 as well — stepsOf() SUMS the two bonds before divide_num', () => {
  for (const [gid, base, per] of [['garrison_170_a', 0.2, 0.01], ['garrison_170_b', 0.4, 0.02]]) {
    // 6 巴别塔 + 3 精准 = 9 → 9 / 3 = 3 steps. The 巴别塔-only control on the same board reads 6 / 3 = 2, so the
    // assertion below fails if the reader ever ignores the second id again.
    const both = battle({ units: [{ id: 'wd', g: [gid], row: 10, col: 4 }], bonds: { babelShip: B(6), preciShip: B(3) } });
    assert.deepEqual(both.unit('wd').findBuff(`gar:${gid}`).mods,
      { atkPct: base + 3 * per, hpPct: base + 3 * per }, `${gid}: 巴别塔 6 + 精准 3 = 3 steps`);
    const babelOnly = battle({ units: [{ id: 'wd', g: [gid], row: 10, col: 4 }], bonds: { babelShip: B(6) } });
    assert.deepEqual(babelOnly.unit('wd').findBuff(`gar:${gid}`).mods,
      { atkPct: base + 2 * per, hpPct: base + 2 * per }, `${gid}: the same 巴别塔 count alone is 2 steps`);
    checkInvariants(both.b);
    checkInvariants(babelOnly.b);
  }
});
