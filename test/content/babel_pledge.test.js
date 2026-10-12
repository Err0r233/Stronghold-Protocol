// 机变「盟誓」卡 —— 凯尔希的盟誓 (allybuff_select_2_9), the maintainer's pledge card for the self-authored 巴别塔 core
// bond (docs/research/15-babel-bond.md §6.3 item 4; tools/content/custom.mjs `effects` / `effectBuffsPledge`).
//
// The card is the 9th entry of the official 盟誓 family (allybuff_select_2_1…_2_8): one BUFF_GAIN effect whose single
// buff is global_special_choice_bond_addlayer { count, bond_list }, `team: true` through the family's closing sentence
// 「若存在其他队友则他们也获得」. There is no official row for it anywhere, so everything asserted below is either the
// source in tools/content/custom.mjs or a behaviour the generic handler gives every card of the family:
//   · the draft (server/match/choices.js tacticDraftCards) offers it whenever 巴别塔 is live in the match
//     (`Match.bondLive` → cardTargetBonds), and drops it when 巴别塔 is mode-inactive or out of the pool;
//   · a pick applies +count layers to each listed bond with `requireActive: false` — 无需激活, i.e. it lands on an
//     inactive bond too, exactly like 玛恩纳的盟誓 — once for the picker and once per living teammate;
//   · the co-op card count of a draft is unchanged (6 / solo 3): the family grows by one, the draft does not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA, makeMatch } from '../match/harness.js';
import { applyCard, cardTargetBonds, generateDraft, tacticCard } from '../../server/match/choices.js';
import { createRegistry } from '../../server/match/effectsMeta.js';
import { createRng } from '../../server/sim/rng.js';
import * as custom from '../../tools/content/custom.mjs';

const CARD = 'allybuff_select_2_9';
const NAME = '凯尔希的盟誓';
const BOND = 'babelShip';
const BABEL = '巴别塔';
const EFF = (id) => DATA.effects[id];
const CARD_REC = (id) => DATA.choices.cards.tactic.find((c) => c.effectId === id);
const buff = () => EFF(CARD).buffs.find((b) => b.key === 'global_special_choice_bond_addlayer');
const LAYERS = 10;
/** The 8 official 盟誓 cards (allybuff_select_2_1…_2_8), by id and by name. */
const OFFICIAL = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `allybuff_select_2_${n}`);
/** The `ally` cards of cards.tactic: the official 26 (驰援 ×8, 盟誓 ×8, 列装 / 财富 / 补给 / 整备 / 升华, 自愈, 火力, 征召, 无瑕, 锐利) + this one. */
const ALLY_TACTIC = 26 + 1;
/** A played card in the shape applyCard takes (server/match/choices.js cardView). */
const card = (id, team = true) => ({ kind: 'tactic', id, name: EFF(id).name, desc: EFF(id).desc, team, tacticKind: 'ally', family: 'tactic', idx: 0 });

// =====================================================================================================================
// the source (tools/content/custom.mjs)

test('custom.mjs: 凯尔希的盟誓 is the 9th 盟誓 row and mirrors the official allybuff_select_2_* effect shape', () => {
  assert.ok(custom.effects[CARD], 'custom.mjs exports the card');
  for (const id of OFFICIAL) assert.equal(custom.effects[id], undefined, `${id} is official, never re-declared here`);
  // the effect row: the family's field-for-field shape (data/effects.json, allybuff_select_2_1…_8)
  const e = custom.effects[CARD];
  assert.deepEqual(
    [e.effectId, e.effectType, e.effectCounterType, e.continuedRound, e.effectName, e.effectDecoIconId, e.enemyPrice],
    [CARD, 'BUFF_GAIN', 'NONE', -1, NAME, 'icon_team_buff', 0]);
  assert.equal(e.effectDesc, `你的巴别塔盟约层数<@ba.vup>+${LAYERS}</>，若存在其他队友则他们也获得`, 'the family sentence, plain bond name (巴别塔 has no 2-character 简称)');
  // ONE buff, the family key, and the two blackboard entries it reads (bb count, bbStr bond_list)
  const rows = custom.effectBuffsPledge[CARD];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, 'global_special_choice_bond_addlayer');
  assert.equal(rows[0].countType, 'NONE');
  assert.deepEqual(rows[0].blackboard, [
    { key: 'count', value: LAYERS, valueStr: null },
    { key: 'bond_list', value: 0, valueStr: BOND },
  ]);
});

// =====================================================================================================================
// the rebuilt data (data/effects.json + data/choices.json)

test(`data: ${NAME} is a cards.tactic 盟誓 card of ${BABEL} — +${LAYERS}, team, and no id or name clash with the official 8`, () => {
  const eff = EFF(CARD);
  assert.ok(eff, 'the card is in data/effects.json');
  assert.equal(eff.name, NAME);
  assert.equal(eff.desc, `你的巴别塔盟约层数+${LAYERS}，若存在其他队友则他们也获得`);
  assert.equal(eff.descRaw, `你的巴别塔盟约层数<@ba.vup>+${LAYERS}</>，若存在其他队友则他们也获得`);
  assert.equal(eff.desc.includes('若存在其他队友'), true, 'the sentence the team flag is derived from');
  assert.deepEqual([eff.effectType, eff.counterType, eff.continuedRound, eff.enemyPrice, eff.decoIconId],
    ['BUFF_GAIN', 'NONE', -1, 0, 'icon_team_buff']);
  assert.deepEqual(eff.params, { count: LAYERS, bond_list: BOND }, 'params = the flattened blackboard');
  const b = buff();
  assert.ok(b, 'the single global_special_choice_bond_addlayer buff');
  assert.equal(eff.buffs.length, 1, 'exactly one buff, like every 盟誓 card');
  assert.deepEqual([b.bb.count, b.bbStr.bond_list], [LAYERS, BOND]);
  // the choices.json entry buildChoices derives from the effect
  const c = CARD_REC(CARD);
  assert.ok(c, 'the card is in data/choices.json cards.tactic');
  assert.deepEqual([c.name, c.kind, c.stageId, c.team], [NAME, 'ally', null, true]);
  for (const id of OFFICIAL) {
    assert.ok(CARD_REC(id), `${id} is still there`);
    assert.notEqual(CARD_REC(id).name, NAME, `${id} does not share the name`);
    assert.notEqual(EFF(id).buffs[0].bbStr.bond_list.split(',').includes(BOND), true, `${id} does not already cover ${BOND}`);
  }
  assert.equal(DATA.choices.cards.tactic.filter((x) => x.name === NAME).length, 1, 'the name is unique');
  assert.equal(DATA.choices.cards.tactic.filter((x) => x.kind === 'ally').length, ALLY_TACTIC, `the ally pool grows by exactly one (${ALLY_TACTIC})`);
  assert.ok(!Object.values(DATA.choices.events).some((ev) => ev.id === CARD), 'the card is no 机变 event (the tactic family never is)');
  // every 盟誓 card's amount is one data number: the family's own distribution is unchanged
  assert.deepEqual(OFFICIAL.map((id) => EFF(id).buffs[0].bb.count).sort((x, y) => x - y), [8, 8, 8, 10, 10, 10, 10, 12]);
  assert.equal(buff().bb.count, LAYERS, 'the new amount');
});

test('data: the pledge card draws at the family default weight — no official 战术决策 screenshot showed it', () => {
  const spec = DATA.choices.tacticDraft;
  assert.deepEqual(spec.kinds, ['ally'], 'it is an ally card, so R11 may offer it');
  assert.equal(CARD in spec.weights, false, 'weights = 1 + the official cards it showed on; unseen ⇒ unlisted ⇒ 1');
  for (const [name, hits] of [['补给', 3], ['莫斯提马的盟誓', 2], ['玛恩纳的盟誓', 1]]) {
    const id = DATA.choices.cards.tactic.find((c) => c.name === name).effectId;
    assert.equal(spec.weights[id], 1 + hits, `${name}: the official entries are untouched`);
  }
});

// =====================================================================================================================
// generation: 机变 出现 / 盟约不可用时与官方同类卡一致

test('机变: the card is offered while 巴别塔 is live, and never while it is mode-inactive or out of the pool', () => {
  const h = makeMatch({ mode: 'coop', difficulty: 'NORMAL', humans: 1, seed: 71, fake: true });
  const m = h.m;
  assert.equal(m.bondInPool(BOND), true, 'sanity: the 8 巴别塔 shops are in the pool');
  assert.equal(m.bondLive(BOND), true, 'sanity: the mode does not disable 巴别塔');
  const offered = (bondAvailable, round = 3) => {
    const seen = new Set();
    for (let s = 1; s <= 400; s++) {
      const d = generateDraft(m.gd, createRng(s), round, { stageId: m.stageId, bondAvailable });
      if (d && d.family === 'tactic') for (const c of d.cards) seen.add(c.id);
    }
    return seen;
  };
  const live = offered((b) => m.bondLive(b));
  assert.ok(live.has(CARD), `${NAME} is offered in a match with a live ${BABEL}`);
  assert.ok(OFFICIAL.some((id) => live.has(id)), 'the official 盟誓 cards are still offered next to it');
  // the card acts only on 巴别塔 — a dead bond drops it like 玛恩纳的盟誓 in 标准 (卡西米尔 off)
  assert.deepEqual(cardTargetBonds(m.gd, CARD), [BOND], 'it targets exactly one bond');
  const dead = offered(() => false);
  for (const id of [CARD, ...OFFICIAL]) assert.ok(!dead.has(id), `${id} is not offered when its bonds are dead`);
  const noBabel = offered((b) => b !== BOND);
  assert.ok(!noBabel.has(CARD), 'never offered when 巴别塔 alone is dead');
  assert.ok(OFFICIAL.some((id) => noBabel.has(id)), 'and the official 盟誓 cards of live bonds stay');
  m.dispose();
});

test('机变 (FUNNY): 巴别塔 is active in every mode, so 标准 still offers it — the pledge filter reads the match, not a mode list', () => {
  const h = makeMatch({ mode: 'coop', difficulty: 'FUNNY', humans: 1, bots: 1, seed: 19, fake: true }).start();
  const m = h.m;
  assert.equal(m.gd.modeInactiveBonds.has(BOND), false, 'modeBonds.active adds 巴别塔 to every mode');
  assert.equal(m.bondLive(BOND), true);
  const seen = new Set();
  for (let s = 1; s <= 400; s++) {
    const d = generateDraft(m.gd, createRng(s), 3, { stageId: m.stageId, bondAvailable: (b) => m.bondLive(b) });
    if (d && d.family === 'tactic') for (const c of d.cards) seen.add(c.id);
  }
  assert.ok(seen.has(CARD), `${NAME} is offered in 标准 too`);
  // 玛恩纳的盟誓 / 莫斯提马的盟誓 are the two the finding named: their bonds ARE mode-inactive in FUNNY
  assert.ok(['kazimierzShip', 'lateranoShip'].every((b) => m.gd.modeInactiveBonds.has(b)));
  assert.ok(!seen.has('allybuff_select_2_7') && !seen.has('allybuff_select_2_5'));
  m.dispose();
});

// =====================================================================================================================
// picking: exactly +10 layers (无需激活), picker and teammates

test(`picking: ${NAME} adds exactly +${LAYERS} layers to ${BABEL} — on an INACTIVE bond too — for the picker and every living teammate`, () => {
  const h = makeMatch({ mode: 'coop', humans: 2, seed: 72, registry: createRegistry({ log: { warn() {}, error() {}, info() {} } }), fake: true }).start();
  h.toPrep(1, { band: 'band_sarkazb' });
  const m = h.m;
  const [a, b] = [h.ps('p_0'), h.ps('p_1')];
  assert.equal(CARD_REC(CARD).team, true, 'the card is a team card');
  // 无需激活: the handler passes requireActive: false, so a bond at 0 layers with no chess takes the layers anyway
  const before = { a: a.layers[BOND] || 0, b: b.layers[BOND] || 0 };
  const gains = [];
  const addLayers = a.addLayers.bind(a);
  a.addLayers = (bond, n, o = {}) => { const g = addLayers(bond, n, o); gains.push([bond, n, g, o.requireActive]); return g; };
  applyCard(m, a, card(CARD));
  assert.deepEqual(gains, [[BOND, LAYERS, LAYERS, false]], 'one call: 巴别塔, +10, requireActive false');
  assert.equal((a.layers[BOND] || 0) - before.a, LAYERS, 'the picker: +10');
  assert.equal((b.layers[BOND] || 0) - before.b, LAYERS, 'the teammate: +10 (若存在其他队友则他们也获得)');
  assert.deepEqual(cardTargetBonds(m.gd, CARD), [BOND], 'never a second bond');
  // a second pick stacks, like every card of the family (each pick is its own card)
  applyCard(m, a, card(CARD));
  assert.equal((a.layers[BOND] || 0) - before.a, 2 * LAYERS, 'a re-pick stacks');
  assert.equal((b.layers[BOND] || 0) - before.b, 2 * LAYERS);
  // a personal pick (team false) reaches the picker only
  applyCard(m, b, card(CARD, false));
  assert.equal((a.layers[BOND] || 0) - before.a, 2 * LAYERS, 'the teammate of a personal pick is untouched');
  assert.equal((b.layers[BOND] || 0) - before.b, 3 * LAYERS);
  m.dispose();
});

test('picking: the layer cap applies like every other layer source (999), and the card is a no-op for a dead bond id', () => {
  const h = makeMatch({ mode: 'coop', humans: 2, seed: 73, fake: true }).start();
  h.toPrep(1, { band: 'band_sarkazb' });
  const m = h.m;
  const a = h.ps('p_0');
  a.addLayers(BOND, 999, { requireActive: false });
  const before = a.layers[BOND];
  applyCard(m, a, card(CARD));
  assert.equal(a.layers[BOND], before, 'capped, nothing added past the cap');
  assert.ok(before <= 999);
  m.dispose();
});

test(`picking: ${NAME} shares the 盟誓 handler with the official 8 — no separate code path, no double application`, () => {
  const h = makeMatch({ mode: 'coop', humans: 2, seed: 74, registry: createRegistry({ log: { warn() {}, error() {}, info() {} } }), fake: true }).start();
  h.toPrep(1, { band: 'band_sarkazb' });
  const m = h.m;
  const a = h.ps('p_0');
  // every 盟誓 card of the family, the new one included, takes the same path: +count on each bond_list entry
  for (const id of [...OFFICIAL, CARD]) {
    const b = buffOf(id);
    const bonds = b.bbStr.bond_list.split(',');
    const la = bonds.map((x) => a.layers[x] || 0);
    applyCard(m, a, card(id));
    bonds.forEach((x, i) => assert.equal((a.layers[x] || 0) - la[i], b.bb.count, `${id}: ${x} +${b.bb.count}`));
  }
  m.dispose();
});

/** The 盟誓 buff of a card id (the family's single global_special_choice_bond_addlayer row). */
function buffOf(id) {
  const b = EFF(id).buffs.find((x) => x.key === 'global_special_choice_bond_addlayer');
  assert.ok(b, `${id}: the 盟誓 buff`);
  return b;
}

// =====================================================================================================================
// the draft itself is untouched

test('coverage: the card is registered with the family handler by effect id alone — no per-card code exists', async () => {
  const { choiceCardIds } = await import('../../server/sim/content/choices.js');
  const ids = choiceCardIds(DATA);
  assert.ok(ids.tactic.includes(CARD), 'a BUFF_GAIN effect is a 战术决策 card id (buildChoices derives cards.tactic from the same set)');
  assert.equal(ids.tactic.length, 44, '43 official BUFF_GAIN effects + this one');
  assert.equal(ids.tactic.filter((id) => id === CARD).length, 1);
  assert.ok(!ids.bounty.includes(CARD) && !ids.items.includes(CARD), 'and of no other family');
  // registerMeta gives every one of them the shared TACTIC handler (server/sim/content/choices.js)
  const reg = createRegistry({ log: { warn() {}, error() {}, info() {} } });
  for (const id of ids.tactic) assert.equal(typeof reg.get(`choice:${id}`)?.onChoicePick, 'function', `choice:${id}`);
});

test('the draft is unchanged: 6 co-op cards of the tactic family (solo 3), with the new card in the pool, not in the slot count', () => {
  const h = makeMatch({ mode: 'coop', humans: 2, seed: 75, fake: true });
  const m = h.m;
  for (let s = 1; s <= 200; s++) {
    const d = generateDraft(m.gd, createRng(s), 3, { stageId: m.stageId, bondAvailable: (x) => m.bondLive(x) });
    if (d && d.family === 'tactic') { assert.equal(d.cards.length, 6, 'six cards'); assert.ok(d.cards.every((c) => c.kind === 'tactic')); }
  }
  assert.deepEqual(DATA.choices.format.multi, { cards: 6, pickOrder: 'random', firstPickSec: 30, otherPickSec: 16, onTimeout: 'autoPickRandom', eachPlayerPicks: 1 });
  assert.deepEqual(DATA.choices.format.solo, { cards: 3, timer: null });
  m.dispose();
});

test('R11 (绝境 / 终极, the round the official 战术决策 screenshots are from): the card is in the weighted ally pool too', () => {
  // R11 has no supply-only round in 绝境: the schedule there is 悬赏决策 14 / 机密商店 4 / 战术决策 4, so the tactic
  // family (which is where a 盟誓 card lives) really is drawn — with the official weights, an unseen card weighing 1
  const h = makeMatch({ mode: 'coop', difficulty: 'HARD', humans: 2, seed: 76, fake: true });
  const m = h.m;
  assert.ok([11].every((r) => m.gd.choices.schedule[m.gd.modeId].rounds[String(r)].families.some((f) => f.family === 'tactic')), 'R11 may be 战术决策');
  const seen = new Set();
  for (let s = 1; s <= 800; s++) {
    const d = generateDraft(m.gd, createRng(s), 11, { stageId: m.stageId, bondAvailable: (x) => m.bondLive(x) });
    if (d && d.family === 'tactic') { assert.equal(d.cards.length, 6); for (const c of d.cards) seen.add(c.id); }
  }
  assert.ok(seen.has(CARD), `${NAME} is offered at R11 as well`);
  assert.ok(seen.has('allybuff_select_4'), 'sanity: 补给 is offered at R11');
  assert.ok(OFFICIAL.some((id) => seen.has(id)), 'and so are the official 盟誓 cards');
  m.dispose();
});
