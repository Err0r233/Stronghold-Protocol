// tools/content/custom.mjs — HAND-MAINTAINED FIAT CONTENT (the 自研 content layer).
//
// This module is the one place where the data build deviates from the official tables, at the maintainer's decision
// only (AGENTS.md 「Deliberate deviations from the official mode are the maintainer's decision only」). It carries three
// fiat blocks of equal standing, none of which exists in any build source:
//
//   · 巴别塔 — the maintainer's 自研 core bond, from docs/research/15-babel-bond.md (「巴别塔」自研核心盟约 · 设计定稿 v1),
//     the single authority for the bond, its 11 members and their 特质. Each block below names the section it implements.
//   · 元素 — the maintainer's 自研 ADD-ON bond (elementShip) and its 7 members, from docs/research/17-element-bond.md.
//     Everything about it is in the `element`-prefixed block near the end of this file: the bond, its effect blackboard,
//     the 特质 of its members, and 珊比's promotion out of the 自选 pool into a T4 shop chess.
//   · 克莱门莎 (char_4231_clemnt) — a 自选 (DIY) operator the maintainer turned into a visible T5 盟约/商店棋 with the
//     official 特质 garrison_161_a/_b (Codex, 2026-10-12). The official tables list neither her chess nor the trait,
//     so without this file every rebuild of data/ drops an operator the maintainer deliberately added.
//
// tools/build-data.mjs `applyCustom(ctx)` merges this module into the loaded official tables BEFORE the builders run:
//   bond / modeBond                   → act.bondInfoDict / ac.bondInfoDict            (buildBonds reads both)
//   elementBond / elementModeBond     → the same two tables, for 元素
//   effect + effectBuffs              → effectInfoDataDict / effectBuffInfoDataDict  (buildEffects reads both)
//   elementEffect / elementEffectBuffs→ the same two tables, for 元素's card
//   effects + effectBuffsPledge       → the same two tables, for the 机变「盟誓」card (buildChoices → cards.tactic)
//   garrisons / elementGarrisons      → act.garrisonDataDict                         (buildGarrisons)
//   chess + shopRows + normalLookup   → charChessDataDict / charShopChessDatas / chessNormalIdLookupDict (buildChess)
//   elementChess / elementShopRows /  → the same three tables, for 珊比's promotion
//     elementNormalLookup
//   clemensa.chess / .shopRows / …    → the same three tables, for 克莱门莎
//   characters                        → charTable   (阿米娅·医疗, a form the official zh_CN table does not carry)
//   chessBonds / elementChessBonds    → official members that gain the bond
//   chessGarrisons / elementChess…    → official members whose trait is overridden
//   bondChessIds                      → the official bonds those fiat members carry (the member-list mirror)
//   modeBonds                         → config.modes[*].activeBondIds (a build-level overlay of the mode tables)
//   garrisonKeep                      → data/garrisons.json (read directly by buildGarrisons: the official rows the
//                                       replacements above leave unreferenced but the dataset must keep)
//
// ADD-IF-ABSENT is the rule for every table: an id the official table already has wins, this file's row is dropped, and
// the build reports a `custom:` warning — so a future source update (or an official 克莱门莎 row) takes over by itself.
// The character table is the one exception in shape, and gets its own rule: `characters` is a ROW add-if-absent plus
// FIELD-level corrections of an existing row (克莱门莎's `appellation`, which upstream spells "Clementia"), each
// reported as `custom: character … replaced …`.
//
// Three arrays ON rows the official table already has cannot be expressed as add-if-absent at all; they are the only
// places this file ever modifies an official row, and all three are documented design decisions:
//   `chessBonds`      adds 巴别塔 to the official row's `bondIds` — a UNION, it never removes a bond.
//   `bondChessIds`    adds the fiat chess to an official bond's `chessIdList` — a UNION too, the member-list mirror
//                     of `chessBonds` (the build derives data/bonds.json `members` from it and the bond panel lists
//                     its 成员 from those).
//   `chessGarrisons`  REPLACES the official row's `garrisonIds` — the design overrides 华法琳's trait text
//                     (docs/research/15-babel-bond.md §2 「与现有数据的差异」: the per-battle cap is 4 / 8, the data's is
//                     7 / 14), so her `garrison_72_a` / `_b` give way to this file's pair rather than being kept alongside
//                     it (keeping both would double-count the layer gain).
//
// ONE SCALAR on an official row is a fourth such field, and it needs no mechanism at all: the chess's DEFAULT SKILL
// (`defaultSkillIndex`, mirrored into `backupCharSkillIndex`). The maintainer's ruling of 2026-10-13 picks one per chess
// of a THIRTEEN-operator batch; the ten 自研 pairs state it in their own rows (the `skill` field of `members`, 珊比's,
// 克莱门莎's and 可露希尔's), while the three OFFICIAL chess of the batch (华法琳 / 伊内丝 / 魔王) are NOT listed here
// because the official rows already carry the wanted index (0 / 1 / 2) — this file extends their `bondIds` only. A
// future official update that moved one of those indices would therefore be a silent change of the shipped default,
// and would have to be dealt with by a deliberate override (see the 棋子 block header for the values checked).
//
// REMOVING a bond is impossible through either union table, and only a FIAT chess of this module (one whose whole row
// this file owns: `chess` / `elementChess` / `clemensa.chess`) ever needs it. Such a chess states its **exact final
// `bondIds`** in its own record — there is no union to defeat, and the list is what `buildChess` copies verbatim into
// data/chess.json `bonds` (`tools/build-data.mjs` line `bonds: [...(cd.bondIds || [])]`) — while `chessBonds` /
// `elementChessBonds` simply do NOT name it. That is how 克莱门莎 left 不屈 (indomShip) with the maintainer's ruling of
// 2026-10-12: her two records below read `['egirShip', 'swiftShip', 'elementShip']` exactly, `bondChessIds` no longer
// lists her under 不屈, and no union entry mentions her.
//
// DATA ONLY. The simulation of the bond (一档 编制 / 二档 指挥) is written in server/sim/ by the maintainer separately;
// nothing here encodes behaviour, only the official-table shapes the builders already read.

/**
 * Official blackboard list shape: [{ key, value, valueStr }] — the input of build-data.mjs flattenBB().
 * @param {Record<string, number>} bb numeric values
 * @param {Record<string, string>} [bbStr] string values (their numeric `value` is 0, as in the official tables)
 * @returns {Array<{key:string, value:number, valueStr:string|null}>}
 */
function blackboard(bb, bbStr = {}) {
  const out = [];
  for (const [key, value] of Object.entries(bb)) out.push({ key, value, valueStr: null });
  for (const [key, valueStr] of Object.entries(bbStr)) out.push({ key, value: 0, valueStr });
  return out;
}

/**
 * A 特质 (garrison) row in the official garrisonDataDict shape.
 * `eventTypeIcon` follows the official pairing of (eventType, effectType): an IN_BATTLE row is `icon_bond` when it adds
 * layers (effectType ADD_BOND, eventTypeDesc 持续叠加 — 华法琳 72, 送葬人 38, 缇缇 125 …) and `icon_battle` when it grants
 * stats (GAIN_BUFF, 作战能力 — 迷迭香 03/09, 魔王 59 …). A row may still pass its own icon.
 * @param {string} garrisonId
 * @param {string} desc rich text (descRaw; numbers wrapped in `<@ba.vup>N</>` exactly as the official rows of the family do)
 * @param {{eventType:string, eventTypeDesc:string, effectType:string, bb:object, bbStr?:object, battleRuneKey?:string|null, eventTypeIcon?:string, key?:string}} row
 *   `key` is the trait's `garrison_key` (the layer cap's identity); it is written into the blackboard's `bbStr` so the
 *   rows that need it do not repeat the same string twice.
 */
function garrison(garrisonId, desc, { eventType, eventTypeDesc, effectType, bb, bbStr = {}, battleRuneKey = null, eventTypeIcon, key }) {
  const def = eventType !== 'IN_BATTLE' ? 'icon_bond' : (effectType === 'ADD_BOND' ? 'icon_bond' : 'icon_battle');
  return {
    garrisonId, garrisonDesc: desc, description: desc,
    eventType, eventTypeDesc,
    eventTypeIcon: eventTypeIcon || def,
    effectType, charLevel: 0, battleRuneKey,
    blackboard: blackboard(bb, key ? { ...bbStr, garrison_key: key } : bbStr),
  };
}

/** A 特性 candidate of a character record (build-data.mjs traitRecord reads `char.trait.candidates`). */
const traitCandidate = (description, bb = {}) => ({
  unlockCondition: { phase: 'PHASE_0', level: 1 }, requiredPotentialRank: 0,
  prefabKey: null, rangeId: null, overrideDescripton: description,
  blackboard: Object.entries(bb).map(([key, value]) => ({ key, value, valueStr: null })),
});

/** A character attribute frame: the official keys the builders read, with the frozen boolean block statsFrom ignores. */
function attrs({ maxHp, atk, def, magicResistance, cost = 19, baseAttackTime = 1.6 }) {
  return {
    maxHp, atk, def, magicResistance, cost, blockCnt: 1, moveSpeed: 1, attackSpeed: 100, baseAttackTime,
    respawnTime: 70, hpRecoveryPerSec: 0, spRecoveryPerSec: 1, maxDeployCount: 1, maxDeckStackCnt: 0,
    tauntLevel: 0, massLevel: 0, baseForceLevel: 0,
    stunImmune: false, silenceImmune: false, sleepImmune: false, frozenImmune: false, levitateImmune: false,
    disarmedCombatImmune: false, fearedImmune: false, palsyImmune: false, attractImmune: false,
    teleportImmune: false, groundBoundImmune: false,
  };
}

// ===== 巴别塔 — the bond (docs/research/15-babel-bond.md §1) ======================================================
//
// 一档 (L layers, both attributes)  ATK / maxHP × (1 + 0.12 + 0.008·L)
// 一档 rider                        +2% ATK per distinct OTHER bond kind carried by a member, capped at +10%
// 二档 指挥 (L layers, 八格)        allies' damage → 1.10 + 0.0007·L (cap 1.80); DEF/RES ignore → 0.20 + 0.0004·L (cap 0.60)
//
// `other_bond_kind_atk` / `other_bond_kind_atk_cap` are new keys — no official bond has the rider, so the sim reads
// them again by name. OPEN-1 of the research file resolves the rider's counting to 「只计本局可用」 (a bond in
// mode.inactiveBondIds does not count): a simulation rule, not a data one.
const BABEL = 'babelShip';

const bond = {
  [BABEL]: {
    bondId: BABEL, name: '巴别塔',
    desc: '【巴别塔】干员<@ba.vup>攻击力</>、<@ba.vup>生命值</>提升<@autochess.gray>（受层数影响）</>\n'
      + '每有一名【巴别塔】干员所属的其它盟约种类与已计入的不同，全体【巴别塔】干员额外获得<@ba.vup>攻击力</>提升（最高<@ba.vup>+10%</>）\n'
      + '<在场<@autochess.dgreen>6</>名不同【巴别塔】干员>战斗开始时，攻击力最高的【巴别塔】干员成为<@ba.vup>【指挥】</>，'
      + '其周围八格内的友方干员造成的伤害提升至<@ba.vup>110%</>，攻击时无视<@ba.vup>20%</>的防御力和法术抗性；'
      + '<@ba.vup>【指挥】</>被击倒时，指挥权移交给场上攻击力最高的下一名【巴别塔】干员',
    iconId: 'icon_babelShip',
    activeCount: 3,
    activeCondition: 'BOARD',
    activeConditionTemplate: 'count_threshold_upward',
    activeParamList: ['3'],   // 一档; the 二档 threshold 6 comes from the 「在场6名」 in `desc` — buildBonds reads both
    effectId: 'bondeffect_babel',
    activeType: 'BATTLE',
    identifier: 24,           // after all 23 official bonds: buildBonds sorts by identifier
    weight: 10,               // participates in the per-match 每局随机禁用 draw
    isActiveInDeck: false,
    maxInactiveBondCount: -1,
    // Positional `{i:fmt}` params of effectDesc = bb[baseParams[i]] + bb[perStackParams[i]] × L (build-data.mjs
    // effectDescParams, resolved by public/js/ui/richText.js formatBondEffect): the index of a placeholder in the
    // effect text IS the position in these two lists, so both keep one entry per index — `null` where the slot does not
    // scale with layers (the two 一档 rider numbers are flat, the 0.0004·L of the RES slot is read by name).
    descParamBaseList: ['base_atk', 'base_max_hp', 'base_damage_scale_show', 'base_def_penetrate', 'other_bond_kind_atk', 'other_bond_kind_atk_cap', 'base_res_penetrate'],
    descParamPerStackList: ['atk_per_stack', 'max_hp_per_stack', 'damage_scale_per_stack', 'def_penetrate_per_stack', null, null, 'res_penetrate_per_stack'],
    noStack: false,
    // Members are listed explicitly instead of being derived from `powerIdList` (docs/research/15-babel-bond.md §3, §7):
    // 「巴别塔」 is a groupId/subPower in the official powers, and adding `rhodes` would also make 名单外 operators
    // members, against OPEN-3. Both forms of every member are listed, exactly as the official bonds do; buildBonds
    // keeps the NORMAL ones for `members` (visibleMembers then drops the hidden ones). 华法琳 and 魔王 each also have
    // a HIDDEN T5 form in the official table (the same operator's other chess, which official bonds do list — 华法琳
    // chess_char_5_04_a sits in miraShip, 魔王 chess_char_5_09_a in emptyShip); `chessBonds` gives both forms 巴别塔
    // and this list mirrors it, so the two hidden forms are members too.
    chessIdList: [
      'chess_char_1_05_babel_a', 'chess_char_1_05_babel_b',   // 暴行
      'chess_char_1_06_babel_a', 'chess_char_1_06_babel_b',   // 奥达
      'chess_char_2_05_babel_a', 'chess_char_2_05_babel_b',   // 阿米娅·医疗
      'chess_char_4_26_a', 'chess_char_4_26_b',               // 华法琳   (official chess, bond added by `chessBonds`)
      'chess_char_5_04_a', 'chess_char_5_04_b',               // 华法琳 T5 hidden form (the same operator)
      'chess_char_3_05_babel_a', 'chess_char_3_05_babel_b',   // 阿斯卡纶
      'chess_char_3_06_babel_a', 'chess_char_3_06_babel_b',   // 可露希尔
      'chess_char_4_25_a', 'chess_char_4_25_b',               // 魔王     (official chess, bond added by `chessBonds`)
      'chess_char_5_09_a', 'chess_char_5_09_b',               // 魔王 T5 hidden form (the same operator)
      'chess_char_4_04_a', 'chess_char_4_04_b',               // 伊内丝   (official chess, bond added by `chessBonds`)
      'chess_char_5_06_babel_a', 'chess_char_5_06_babel_b',   // 赫德雷
      'chess_char_5_07_babel_a', 'chess_char_5_07_babel_b',   // 逻各斯
      'chess_char_6_04_babel_a', 'chess_char_6_04_babel_b',   // 维什戴尔
    ],
  },
};

// ac.bondInfoDict[bondId] — the supplements buildBonds reads (bondType / bondOrder / icon / powerIdList); `isPower`
// is what becomes data/bonds.json `isCore` (§6.3 item 3: the builders cannot know a fan core bond is core).
const modeBond = {
  [BABEL]: {
    bondId: BABEL, bondType: 'SEASON', bondOrder: 2, powerIdList: ['babel'],
    name: '巴别塔', icon: 'icon_babelShip', isPower: true, isHiddenCharList: false,
  },
};

// ===== the bond effect (effectInfoDataDict + effectBuffInfoDataDict) ==============================================
//
// The official rows carry the prose in effectInfoDataDict and the numbers in effectBuffInfoDataDict; buildEffects
// joins them, and buildBonds takes the buff's bb/bbStr as the bond's own blackboard. The effect text is the layered
// in-battle card: `{i:fmt}` is bb[descParamBaseList[i]] + bb[descParamPerStackList[i]] × L, so the index of a
// placeholder IS its position in these two lists and they keep one entry per index (the two 一档 rider numbers are FLAT
// — a null per-stack slot — and DEF/RES have a slot each so both halves of the 二档 穿透 line resolve).
const effect = {
  bondeffect_babel: {
    effectId: 'bondeffect_babel', effectType: 'BOND', effectCounterType: 'NONE', continuedRound: -1,
    effectName: '巴别塔',
    effectDesc: '【巴别塔】干员攻击力、生命值<@ba.vup>+{0:0%}</><@ba.acrem>（受层数影响）</>，'
      + '每有一名【巴别塔】干员所属的其它盟约种类与已计入的不同，全体【巴别塔】干员额外获得<@ba.vup>攻击力+{4:0%}</>（最高<@ba.vup>+{5:0%}</>）\n'
      + '<在场<@ba.vup>6</>名不同【巴别塔】干员>战斗开始时，攻击力最高的【巴别塔】干员成为【指挥】，'
      + '其周围八格内的友方干员造成的伤害提升至<@ba.vup>{2:0%}</><@ba.acrem>（受层数影响，最高180%）</>，'
      + '攻击时无视<@ba.vup>{3:0%}</>的防御力和<@ba.vup>{6:0%}</>的法术抗性<@ba.acrem>（均受层数影响，最高60%）</>',
    effectDecoIconId: null, enemyPrice: 0,
  },
};
// One `env_gbuff_new` buff, the key the official bond effects use (buildBonds collects every buff's bb/bbStr into the
// bond's bb/bbStr and its `buffs` list). The caps are data as well: the sim applies them, so they stay next to the slopes.
const effectBuffs = {
  bondeffect_babel: [{
    key: 'env_gbuff_new', countType: 'NONE',
    blackboard: blackboard({
      base_atk: 0.12, atk_per_stack: 0.008,             // 一档 ATK   × (1 + 0.12 + 0.008·L)
      base_max_hp: 0.12, max_hp_per_stack: 0.008,       // 一档 maxHP × (1 + 0.12 + 0.008·L)
      other_bond_kind_atk: 0.02,                        // 一档 rider +2% ATK per distinct other bond kind
      other_bond_kind_atk_cap: 0.10,                    //            capped at +10% (5 kinds)
      base_damage_scale_show: 1.10, damage_scale_per_stack: 0.0007,   // 二档 999 layers → 179.93%
      damage_scale_cap: 1.80,
      base_def_penetrate: 0.20, def_penetrate_per_stack: 0.0004,      // 二档 999 layers →  59.96%
      base_res_penetrate: 0.20, res_penetrate_per_stack: 0.0004,
      penetrate_cap: 0.60,
    }, { key: 'act2autochess_bond_eff_babel' }),
  }],
};

// ===== 机变「盟誓」卡 — 凯尔希的盟誓 (the pledge card) =============================================================
//
// The official 盟誓 family is EIGHT `BUFF_GAIN` effects `allybuff_select_2_1`…`_2_8` (data/effects.json), each ONE buff
// (no `bbStr.key` — the match applies it in `applyDefault`, server/match/choices.js
// `case 'global_special_choice_bond_addlayer'`):
//
//   { key: 'global_special_choice_bond_addlayer', countType: 'NONE',
//     bb: { count: 8 | 10 | 12 }, bbStr: { bond_list: '<bond>[,<bond>…]' } }        +count layers per listed bond
//
// with effectType 'BUFF_GAIN', counterType 'NONE', continuedRound −1, enemyPrice 0 and `decoIconId` 'icon_team_buff'
// for the team copies (their text carries 「若存在其他队友则他们也获得」 — that sentence is exactly what
// buildChoices' / test/content/choices.test.js's `team: true` flag is derived from). The card's text is the family
// sentence 「你的<盟约>盟约层数+N，若存在其他队友则他们也获得」, and `count` = N appears verbatim in it.
//
// Everything else about a card is DERIVED, so this file supplies no more than the effect:
//   · buildChoices() turns every `effectType === 'BUFF_GAIN'` effect into a `cards.tactic` entry
//     { effectId, name, desc, kind: 'ally', stageId: null, team } — no choice-event row exists or is needed (the tactic
//     family is drawn from `cards.tactic`, never from `effectChoiceInfoDict`);
//   · the layer application, the 无需激活 semantics (`addLayers(..., { requireActive: false })`), the team fan-out and
//     the dead-bond filter (`Match.bondLive` → `cardTargetBonds`) are all generic handler code, nothing per card;
//   · the draft weight is GENERIC too: 1 + the official 战术决策 it showed on (build-data `TACTIC_DRAFT.seen`;
//     `tacticDraft.weights`). No seen list names this card, so it draws at weight 1 like every official card the four
//     screenshots did not show. No new weight / order field exists to set.
//
// 层数 = +10 [ASSUMED: the amount is the maintainer's; no source carries the card]. The family's own amounts decide it:
// +12 only for the ONE single-bond card (玛恩纳的盟誓, 卡西米尔), +10 for a two-bond card, +8 for the three-bond ones —
// i.e. the amount is `10 − 2·(bonds − 1)` with the single-bond slot rounded UP to 12. 巴别塔 is ONE bond, so the family
// parallel is 玛恩纳的 +12; the value written here is the maintainer's +10 (the requested 层数 +10), one step below that
// single-bond slot. +10 is also the odd-signature card convention (斯卡蒂/风笛/银灰 are the even +8).
const effects = {
  allybuff_select_2_9: {
    effectId: 'allybuff_select_2_9', effectType: 'BUFF_GAIN', effectCounterType: 'NONE', continuedRound: -1,
    effectName: '凯尔希的盟誓',
    effectDesc: '你的巴别塔盟约层数<@ba.vup>+10</>，若存在其他队友则他们也获得',
    effectDecoIconId: 'icon_team_buff', enemyPrice: 0,
  },
};
const effectBuffsPledge = {
  allybuff_select_2_9: [{
    key: 'global_special_choice_bond_addlayer', countType: 'NONE',
    blackboard: blackboard({ count: 10 }, { bond_list: BABEL }),
  }],
};
// ===== 特质 (garrisons) ==========================================================================================
//
// The 键 palette is the official one (server/sim/content/garrisons/** reads it); no new effect key is invented:
//   资金 (整备能力)          SERVER_CHESS_SOLD / SERVER_ONCE_GOLD            bb {count}
//   休整期结束 / 进入休整期   SERVER_PREP_FIN | SERVER_PREP_START / SERVER_ADD_BOND   bb {count}, bbStr {bond, conditionkey}
//   获得时 (自身所属盟约)      SERVER_GAIN / SERVER_ADD_BOND_CHESS_ALL        bb {count}
//   获得时 (指定盟约)          SERVER_GAIN / SERVER_ADD_BOND                  bb {count}, bbStr {bond}  — no activation needed
//   战斗中 前 N 次击倒        IN_BATTLE / ADD_BOND                            bb {check_cnt, bond_add_count, max_add_count_per_battle},
//                                                                            bbStr {key, bond_type, bond_id, bond_add_type, garrison_key}
//   战斗中 累计承伤           IN_BATTLE / ADD_BOND                            bb {check_hp, bond_add_count, max_add_count_per_battle},
//   战斗中 累计实际治疗       IN_BATTLE / ADD_BOND                            bb {check_hp, bond_add_count, max_add_count_per_battle},
//                                                                            bbStr as 前 N 次击倒 — the two 承伤 / 治疗 counters are the
//                                                                            two new handlers of server/sim/content/garrisons/battle.js
//                                                                            (act1autochess_gar_event_takedamage / _healamount)
//   战斗中 累计造成伤害       IN_BATTLE / ADD_BOND                            bb {check_damage, bond_add_count, max_add_count_per_battle},
//                                                                            bbStr as 前 N 次击倒 — the third new handler,
//                                                                            act1autochess_gar_event_dealdamage (逻各斯 169 /
//                                                                            阿斯卡纶 166)
//   作战能力 (固定值)         IN_BATTLE / GAIN_BUFF                           bb {atk, max_hp}  (1.2 = +20%)
//   作战能力 (按层数)         IN_BATTLE / GAIN_BUFF                           bb {divide_num, atk, max_hp | attack_speed},
//                                                                            bbStr {key, bond_id}
//   作战能力 (固定 + 按层数)  IN_BATTLE / GAIN_BUFF                           bb {base_atk, base_max_hp, divide_num,
//                                                                            atk, max_hp}, bbStr {key, bond_id} — ONE
//                                                                            row for both halves, read by attrMods() of
//                                                                            server/sim/content/garrisons/battle.js:
//                                                                            `base_*` is the fixed fraction (+0.4 = +40 %),
//                                                                            the bare keys are the fraction per step
//
// The per-garrison ids: garrison_a = 普通 (the NORMAL chess), garrison_b = 精锐 (the golden chess), the official
// convention (and `_b` is also how the sim tells the two apart). The official data spells a 作战能力 whose text has
// both a fixed and a per-layer half as TWO ids (the 迷迭香 combination garrison_03_a + garrison_09_a) and repeats the
// fixed sentence on the per-layer row — which makes the detail card (`public/js/ui/detailPanel.js` draws the FIRST id,
// `public/js/screens/loadout.js` draws EVERY id) show the block twice. The fiat rows below instead carry BOTH halves in
// ONE row (`base_*` = the fixed fraction, the bare keys = the fraction per step, attrMods() of
// server/sim/content/garrisons/battle.js), so a member has a single 特质 id and a single block.
const garrisons = {
  // ── 暴行 T1 (新增, §2): <售出时> 资金 +1 / +2  — the 格雷伊/泥岩 economy family (garrison_67_a/_b) ──
  garrison_162_a: garrison('garrison_162_a', '<售出时>进入下个休整期额外获得1资金',
    { eventType: 'SERVER_CHESS_SOLD', eventTypeDesc: '整备能力', effectType: 'SERVER_ONCE_GOLD', bb: { count: 1 }, eventTypeIcon: 'icon_gold' }),
  garrison_162_b: garrison('garrison_162_b', '<售出时>进入下个休整期额外获得2资金',
    { eventType: 'SERVER_CHESS_SOLD', eventTypeDesc: '整备能力', effectType: 'SERVER_ONCE_GOLD', bb: { count: 2 }, eventTypeIcon: 'icon_gold' }),

  // ── 奥达 T1 (新增, §2 revised 2026-10-12): <战斗中> 每累计承受 800 点伤害【巴别塔】+1 / +2 (每场至多 8 / 16 层) ──
  //    The maintainer replaced her first pair (the 休整期结束时 +1 / +2 of research 15 §2) with the 承伤 counter of the
  //    「承伤 + 治疗」axis: the row below REPLACES it outright, no orphan row is left in data/garrisons.json. The
  //    threshold (bb.check_hp) and both amounts are the data's; the handler is the new
  //    act1autochess_gar_event_takedamage of server/sim/content/garrisons/battle.js.
  //    The threshold is 800 (was 1200 at first landing, raised on the maintainer's 实测: one standard battle let her bank
  //    5823 damage, which filled only half of the 8-layer cap — 800 makes the cap reachable in a normal round).
  garrison_163_a: garrison('garrison_163_a',
    '<战斗中>本干员每累计承受800点伤害，使已激活的【巴别塔】层数<@ba.vup>+1</>（每场战斗至多8层）',
    { eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', effectType: 'ADD_BOND', bb: { check_hp: 800, bond_add_count: 1, max_add_count_per_battle: 8 }, bbStr: { key: 'act1autochess_gar_event_takedamage', bond_type: 'bond_by_id', bond_id: BABEL, bond_add_type: 'by_count', garrison_key: 'garrison_163_a' }, battleRuneKey: 'env_gbuff_new_with_verify' }),
  garrison_163_b: garrison('garrison_163_b',
    '<战斗中>本干员每累计承受800点伤害，使已激活的【巴别塔】层数<@ba.vup>+2</>（每场战斗至多16层）',
    { eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', effectType: 'ADD_BOND', bb: { check_hp: 800, bond_add_count: 2, max_add_count_per_battle: 16 }, bbStr: { key: 'act1autochess_gar_event_takedamage', bond_type: 'bond_by_id', bond_id: BABEL, bond_add_type: 'by_count', garrison_key: 'garrison_163_b' }, battleRuneKey: 'env_gbuff_new_with_verify' }),

  // ── 阿米娅·医疗 T2 (新增, §2 revised 2026-10-12): <战斗中> 每累计实际治疗 1200 点生命，
  //    【巴别塔】【奥术】各 +2 / +4 (每场至多 10 / 20 层) ──
  //    Also a replacement: her first pair (the 作战能力 +20 / +40 % ATK & maxHP and the 「每 3 层攻速 +1 / +2」 pair of
  //    garrison_164 / garrison_165) gives way to the single 治疗 counter of the 「承伤 + 治疗」axis — both old ids are
  //    gone from this file, so the rebuilt data/garrisons.json carries no orphan (a garrison whose `owners` is empty).
  //    The threshold is 1200 (was 3000 at first landing, on the maintainer's 实测: 5840 actual healing in one standard
  //    battle triggered the 3000 threshold only once = 2 layers).
  garrison_164_a: garrison('garrison_164_a',
    '<战斗中>每累计实际治疗友方干员1200点生命，使已激活的【巴别塔】【奥术】层数各<@ba.vup>+2</>（每场战斗至多10层）',
    { eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', effectType: 'ADD_BOND', bb: { check_hp: 1200, bond_add_count: 2, max_add_count_per_battle: 10 }, bbStr: { key: 'act1autochess_gar_event_healamount', bond_type: 'bond_by_id', bond_id: `${BABEL},arcaneShip`, bond_add_type: 'by_count', garrison_key: 'garrison_164_a' }, battleRuneKey: 'env_gbuff_new_with_verify' }),
  garrison_164_b: garrison('garrison_164_b',
    '<战斗中>每累计实际治疗友方干员1200点生命，使已激活的【巴别塔】【奥术】层数各<@ba.vup>+4</>（每场战斗至多20层）',
    { eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', effectType: 'ADD_BOND', bb: { check_hp: 1200, bond_add_count: 4, max_add_count_per_battle: 20 }, bbStr: { key: 'act1autochess_gar_event_healamount', bond_type: 'bond_by_id', bond_id: `${BABEL},arcaneShip`, bond_add_type: 'by_count', garrison_key: 'garrison_164_b' }, battleRuneKey: 'env_gbuff_new_with_verify' }),

  // ── 阿斯卡纶 T3 (新增, §2 revised 2026-10-12): <战斗中> 每累计造成 4000 点伤害【巴别塔】【突袭】+2 / +4
  //    (每场作战至多 6 / 12) ──
  //    Her first pair (the 前 3 次击倒 counter, garrison_50's official shape) gives way to the 造成伤害 counter of the
  //    「伤害输出」axis. The row REPLACES it outright under the same ids, so no orphan row is left behind. The handler
  //    is the new act1autochess_gar_event_dealdamage of server/sim/content/garrisons/battle.js — the mirror of
  //    _takedamage on the output side, shared with 逻各斯.
  //    The threshold is 4000 (was 3000 at first landing, on the maintainer's 实测: 3000 filled the 6-layer cap by r6,
  //    so it was a small fixed-return rather than a long-term source).
  garrison_166_a: garrison('garrison_166_a',
    '<战斗中>每累计造成4000点伤害，使已激活的【巴别塔】【突袭】层数<@ba.vup>+2</>（每场作战至多6层）',
    { eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', effectType: 'ADD_BOND', bb: { check_damage: 4000, bond_add_count: 2, max_add_count_per_battle: 6 }, bbStr: { key: 'act1autochess_gar_event_dealdamage', bond_type: 'bond_by_id', bond_id: `${BABEL},raidShip`, bond_add_type: 'by_count', garrison_key: 'garrison_166_a' }, battleRuneKey: 'env_gbuff_new_with_verify' }),
  garrison_166_b: garrison('garrison_166_b',
    '<战斗中>每累计造成4000点伤害，使已激活的【巴别塔】【突袭】层数<@ba.vup>+4</>（每场作战至多12层）',
    { eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', effectType: 'ADD_BOND', bb: { check_damage: 4000, bond_add_count: 4, max_add_count_per_battle: 12 }, bbStr: { key: 'act1autochess_gar_event_dealdamage', bond_type: 'bond_by_id', bond_id: `${BABEL},raidShip`, bond_add_type: 'by_count', garrison_key: 'garrison_166_b' }, battleRuneKey: 'env_gbuff_new_with_verify' }),

  // ── 可露希尔 T3 (新增, §2): <获得时> 自身所属盟约 +4 / +8（无需激活盟约） ──
  //    SERVER_ADD_BOND_CHESS_ALL (the 伊内丝/星熊 family) applies to the piece's OWN bonds, which is the text's
  //    「自身所属盟约」; SERVER_ADD_BOND would need an explicit bond id.
  garrison_167_a: garrison('garrison_167_a', '<获得时>自身所属盟约层数<@ba.vup>+4</>（无需激活盟约）',
    { eventType: 'SERVER_GAIN', eventTypeDesc: '单次叠加', effectType: 'SERVER_ADD_BOND_CHESS_ALL', bb: { count: 4 } }),
  garrison_167_b: garrison('garrison_167_b', '<获得时>自身所属盟约层数<@ba.vup>+8</>（无需激活盟约）',
    { eventType: 'SERVER_GAIN', eventTypeDesc: '单次叠加', effectType: 'SERVER_ADD_BOND_CHESS_ALL', bb: { count: 8 } }),

  // ── 赫德雷 T5 (新增, §2): 作战能力 【巴别塔】每 3 层攻防 +1% / +2% ──
  garrison_168_a: garrison('garrison_168_a', '【巴别塔】每叠加3层，本干员攻击力和生命值<@ba.vup>+1%</>',
    { eventType: 'IN_BATTLE', eventTypeDesc: '作战能力', effectType: 'GAIN_BUFF', bb: { divide_num: 3, atk: 0.01, max_hp: 0.01 }, bbStr: { key: 'act1autochess_gar_eff_attrByBond', bond_id: BABEL }, battleRuneKey: 'env_gbuff_new_with_verify' }),
  garrison_168_b: garrison('garrison_168_b', '【巴别塔】每叠加3层，本干员攻击力和生命值<@ba.vup>+2%</>',
    { eventType: 'IN_BATTLE', eventTypeDesc: '作战能力', effectType: 'GAIN_BUFF', bb: { divide_num: 3, atk: 0.02, max_hp: 0.02 }, bbStr: { key: 'act1autochess_gar_eff_attrByBond', bond_id: BABEL }, battleRuneKey: 'env_gbuff_new_with_verify' }),

  // ── 逻各斯 T5 (新增, §2 revised 2026-10-12): <战斗中> 每累计造成 5000 点伤害【巴别塔】【奥术】+6 / +8 ──
  //    (每场作战至多 24 / 32)
  //    His first pair (the 进入休整期时 +6 / +12 of research 15 §2) gives way to the 造成伤害 counter of the
  //    「伤害输出」axis — the maintainer's decision of 2026-10-12 after a mode sweep: a battle-only counter is part of
  //    the 战斗内 axis, and the 休整期 half of the fiat layer is left to 伊内丝 (the official 现成 source). The row
  //    REPLACES it outright under the same ids. Handler: act1autochess_gar_event_dealdamage (shared with 阿斯卡纶).
  //    The threshold is 5000 (was 8000 at first landing, on the maintainer's 实测: 8000 triggered only once in a
  //    standard-difficulty r13 wave).
  garrison_169_a: garrison('garrison_169_a',
    '<战斗中>每累计造成5000点伤害，使已激活的【巴别塔】【奥术】层数<@ba.vup>+6</>（每场作战至多24层）',
    { eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', effectType: 'ADD_BOND', bb: { check_damage: 5000, bond_add_count: 6, max_add_count_per_battle: 24 }, bbStr: { key: 'act1autochess_gar_event_dealdamage', bond_type: 'bond_by_id', bond_id: `${BABEL},arcaneShip`, bond_add_type: 'by_count', garrison_key: 'garrison_169_a' }, battleRuneKey: 'env_gbuff_new_with_verify' }),
  garrison_169_b: garrison('garrison_169_b',
    '<战斗中>每累计造成5000点伤害，使已激活的【巴别塔】【奥术】层数<@ba.vup>+8</>（每场作战至多32层）',
    { eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', effectType: 'ADD_BOND', bb: { check_damage: 5000, bond_add_count: 8, max_add_count_per_battle: 32 }, bbStr: { key: 'act1autochess_gar_event_dealdamage', bond_type: 'bond_by_id', bond_id: `${BABEL},arcaneShip`, bond_add_type: 'by_count', garrison_key: 'garrison_169_b' }, battleRuneKey: 'env_gbuff_new_with_verify' }),

  // ── 维什戴尔 T6 (新增, §2): 作战能力 攻防 +20% / +40%  与 【巴别塔】每 3 层攻防 +1% / +2% 写在同一行 ──
  //    The fixed half is `base_atk` / `base_max_hp` (fractions, attrMods()), the per-layer half the bare keys. Her
  //    fixed half used to be its own `garrison_170_a/_b` row whose `atk: 1.2` was a MULTIPLIER through
  //    char_attribute_mul, and the per-layer half borrowed 赫德雷's `garrison_168_a/_b`: two ids ⇒ two 「作战能力」
  //    blocks on the detail card, and the +20 % counted as a second, multiplicative term. Both halves now live in this
  //    one row, and 168 belongs to 赫德雷 alone again.
  garrison_170_a: garrison('garrison_170_a',
    '攻击力和生命值+<@ba.vup>20%</>；【巴别塔】每叠加3层，本干员攻击力和生命值<@ba.vup>+1%</>',
    { eventType: 'IN_BATTLE', eventTypeDesc: '作战能力', effectType: 'GAIN_BUFF', bb: { base_atk: 0.2, base_max_hp: 0.2, divide_num: 3, atk: 0.01, max_hp: 0.01 }, bbStr: { key: 'act1autochess_gar_eff_attrByBond', bond_id: BABEL }, battleRuneKey: 'env_gbuff_new_with_verify' }),
  garrison_170_b: garrison('garrison_170_b',
    '攻击力和生命值+<@ba.vup>40%</>；【巴别塔】每叠加3层，本干员攻击力和生命值<@ba.vup>+2%</>',
    { eventType: 'IN_BATTLE', eventTypeDesc: '作战能力', effectType: 'GAIN_BUFF', bb: { base_atk: 0.4, base_max_hp: 0.4, divide_num: 3, atk: 0.02, max_hp: 0.02 }, bbStr: { key: 'act1autochess_gar_eff_attrByBond', bond_id: BABEL }, battleRuneKey: 'env_gbuff_new_with_verify' }),

  // ── 华法琳: NO row here. Her trait cap override (our `garrison_173_a/_b` → `garrison_174_a/_b`, 4 / 8 layers) was
  //    WITHDRAWN on 2026-10-13 (maintainer): the official pair already IS the wanted semantics — `garrison_72_a/_b`
  //    (<战斗开始时> 授予身前一格「开启技能时使自身所属已激活盟约层数 +1 / +2」，每场战斗至多 7 / 14 层,
  //    `battleRuneKey` give_garrison_to_front) hands over the official `garrison_95_a/_b`
  //    (`bond_self`，`bond_add_count` 1 / 2，`max_add_count_per_battle` **7 / 14**), so the visible T4 pair
  //    chess_char_4_26_a/_b names `garrison_72_a/_b` again through plain official data (see `chessGarrisons` below).
  //    The withdrawn 173 / 174 rows are gone from this file and therefore from data/garrisons.json.
};

// ===== 专属装备 (items) ==========================================================================================
//
// The three 巴别塔 signature items of the 「巴别塔」 self-authored layer (docs/research/15-babel-bond.md §6.4, the
// maintainer's 2026-10-12 定稿). An item is FOUR official tables, exactly as 克莱门莎's chess is three:
//
//   effect   + effectBuffs   → act.effectInfoDataDict / act.effectBuffInfoDataDict  (buildEffects joins them; the item's
//                              `desc` / `descRaw` / `buffs` / `params` of data/items.json come from here)
//   items                    → act.trapChessDataDict + act.trapShopChessDatas      (buildItems; `identifier`, prices,
//                              `upgradeChessId`, `giveBondId`, `canGiveBond`, itemType, duration)
//   traps                    → charTable                                           (buildItems reads the trap's `name`
//                              for the item name and the client draws the item card / the board token from it)
//   researchItems            → docs/research/04-items.json                          (category / kind / implFormula /
//                              flavor / rangeGrid — buildItems' optional 04 annotation, warned about when missing)
//
// ADD-IF-ABSENT as everywhere else. The ids deliberately continue the official ranges: the shop sort id is the next free
// one of the tier, the identifier the next two past the official 266–380, and the trap characters sit past the highest
// official `trap_*_acarm*` (1122) as `trap_11xx_acbabel`. The two 套装 (SET) partners name each other through the
// official mechanism 天马之盔 / 天马之枪 use — see the comment on `trapChess` below.
//
// 巴别塔誓言 is the 2 阶 BOND_GRANT item of the pair `canGiveBond` belongs to: the engine's membership rule
// (server/sim/content/support/index.js unitBonds, server/match/bondsMeta.js pieceBonds, research 02 §2.1) is "an item
// with `canGiveBond` worn TOGETHER WITH an item that carries `giveBondId` ⇒ the carrier additionally counts as a member
// of that bond". 变形同构体 (chess_item_6_09_e_a/_b) is the official `canGiveBond` item; this one carries
// `giveBondId: 'babelShip'`, so ONLY the carrier wearing both becomes a 巴别塔 member. Nothing else is needed.
const BABEL_ITEMS = Object.freeze({
  // ── 巴别塔誓言 (2 阶): 攻防 +5 % / +10 %, and — with 变形同构体 — the carrier counts as a 【巴别塔】 member ──
  oath: { key: 'chess_item_2_08_e', trap: 'trap_1123_acbabel', identifier: 381, tier: 2, sortId: 8, price: 3, name: '巴别塔誓言',
    cat: 'BOND_GRANT', kind: 'passive', family: null, pct: [5, 10],
    effectId: { a: 'eff_acbabel_oath', b: 'eff_acgbabel_oath' },
    formula: 'ATK% += atk, maxHP% += max_hp (either quality, 直接乘算). `giveBondId` = babelShip: with 变形同构体 '
      + '(the official canGiveBond item) equipped on the same operator, the carrier additionally counts as a member of '
      + 'the 巴别塔 bond — the engine rule of research 02 §2.1 (server/sim/content/support/index.js unitBonds). Alone it '
      + 'gives the stats only.',
    flavor: '“……以我们的名义起誓。”',
    desc: (p) => `攻击力和生命值+${p}%，同时装备【变形同构体】时，装备者视为【巴别塔】成员`,
    raw: (p) => `攻击力和生命值<@ba.vup>+${p}%</>，同时装备【变形同构体】时，装备者视为<@ba.vup>【巴别塔】</>成员` },
  // ── “魔王的祭器” (5 阶): 生命值 +25 % / +40 %, and — with “文明的存续” — 受到友方治疗时按 40 % 治疗量给护盾 ──
  vessel: { key: 'chess_item_5_10_e', trap: 'trap_1124_acbabel', identifier: 383, tier: 5, sortId: 10, price: 3, name: '“魔王的祭器”',
    cat: 'SET', kind: 'passive', family: null, pct: [25, 40],
    effectId: { a: 'eff_acbabel_vessel', b: 'eff_acgbabel_vessel' },
    formula: 'maxHP% += max_hp (either quality). If the carrier also holds “文明的存续” (either quality): every heal it '
      + 'RECEIVES from an ally grants a shield of heal_scale × the HP actually restored, the shield pool capped at '
      + 'max_hp_scale × the carrier\'s own max HP. [ASSUMED: the cap is the shield pool\'s, not one grant\'s, so a later '
      + 'ally heal tops the same pool up again once damage has spent part of it — the item text names a 护盾上限.]',
    flavor: '“它盛着一位魔王最后的注视。”',
    desc: (p) => `生命值+${p}%，若与「“文明的存续”」一起装备，装备者受到友方治疗时，额外获得相当于该次治疗量40%的护盾（护盾上限不超过自身最大生命值的30%）`,
    raw: (p) => `生命值<@ba.vup>+${p}%</>，若与「“文明的存续”」一起装备，装备者受到友方治疗时，额外获得相当于该次治疗量<@ba.vup>40%</>`
      + '的护盾（护盾上限不超过自身最大生命值的<@ba.vup>30%</>）' },
  // ── “文明的存续” (6 阶): 攻防 +20 % / +35 %; 承伤叠层; 进阶: 全局敌人真伤放大器 (see below) ──
  legacy: { key: 'chess_item_6_12_e', trap: 'trap_1125_acbabel', identifier: 385, tier: 6, sortId: 12, price: 4, name: '“文明的存续”',
    cat: 'SET', kind: 'passive', family: null, pct: [20, 35],
    effectId: { a: 'eff_acbabel_legacy', b: 'eff_acgbabel_legacy' },
    formula: 'ATK% += atk, maxHP% += max_hp (either quality). If the carrier also holds “魔王的祭器” (either quality): '
      + 'every check_hp of HP the carrier actually loses (the garrison _takedamage rule: amount > 0, not an element chip, '
      + 'not a 流失) grants one layer — ATK +atk_per_stack and ASPD +attack_speed_per_stack, at most max_stack_cnt, for '
      + 'the rest of the battle. The ADVANCED (进阶, `_b`) quality additionally multiplies every TRUE-damage instance its '
      + 'owner deals to an enemy by true_damage_mul — one player-scoped global amplifier in the `hit` hook, never a '
      + 're-scaling of damage the same carrier takes.',
    flavor: '“只要还有人记得，它就仍然存在。”',
    desc: (p, adv) => `攻击力和生命值+${p}%，若与「“魔王的祭器”」一起装备，装备者每累计承受3000点伤害，攻击力+5%、攻击速度+5，至多4层，持续到战斗结束`
      + (adv ? '；所有敌方单位受到的真实伤害+150%' : ''),
    raw: (p, adv) => `攻击力和生命值<@ba.vup>+${p}%</>，若与「“魔王的祭器”」一起装备，装备者每累计承受<@ba.vup>3000</>点伤害，`
      + '攻击力<@ba.vup>+5%</>、攻击速度<@ba.vup>+5</>，至多<@ba.vup>4</>层，持续到战斗结束'
      + (adv ? '\n所有敌方单位受到的真实伤害<@ba.vup>+150%</>' : '') },
});

/**
 * The `trapChessDataDict` row of one item (`quality` 'a' = 普通, 'b' = 进阶). The two SET partners name each other in the
 * item's own buff blackboard (`equip_chess_id`), which is the official mechanism 天马之盔 / 天马之枪 use: the key is the
 * partner item id WITHOUT the `_a` / `_b` suffix, so either quality of the partner satisfies the condition, and the
 * engine's `carries()` (server/sim/content/items/battle.js) reads it per unit. The condition is same-carrier only —
 * never the team.
 */
function trapItemRow(it, quality) {
  const adv = quality === 'b';
  // 巴别塔誓言's `giveBondId` is the bond it grants through the official canGiveBond item (变形同构体) — the BOND_GRANT
  // category. The two SET items carry no bond: their condition is the partner item, not a bond.
  const giveBondId = it.cat === 'BOND_GRANT' ? BABEL : null;
  return {
    chessId: `${it.key}_${quality}`, identifier: it.identifier + (adv ? 1 : 0),
    charId: it.trap, isGolden: adv, purchasePrice: adv ? 5 : it.price,
    status: { evolvePhase: 'PHASE_0', trapLevel: 1, skillIndex: adv ? 1 : 0, skillLevel: adv ? 2 : 1 },
    upgradeChessId: adv ? null : `${it.key}_b`, upgradeNum: adv ? 0 : 2,
    trapDuration: adv ? 0 : -1, effectId: it.effectId[quality],
    giveBondId, givePowerId: null, canGiveBond: false, itemType: 'EQUIP',
  };
}

/**
 * The `effectBuffInfoDataDict` rows of one item quality. Every numeric value lives here, exactly as in the official item
 * effects (docs/DATA.md §5), and the sim reads them back by their `bbStr.key`:
 *
 *   attr_common_global_buff          the plain stat line (ATK% / max HP%), the family every +X% item uses
 *   act2autochess_equip_acbabel_vessel_global_buff   the 祭器's set shield (equip_chess_id = the 存续 key)
 *   act2autochess_equip_acbabel_legacy_ability       the 存续's 承伤 layering (equip_chess_id = the 祭器 key)
 *   act2autochess_equip_acbabel_legacy_global_buff   the 存续 进阶's global TRUE-damage amplifier
 *
 * The keys are 自研 and read again by name in server/sim/content/items/battle.js — the official palette has no
 * set-shield / on-damage-layering / true-damage-amplifier family to reuse.
 * @param {object} it a BABEL_ITEMS entry @param {boolean} adv the 进阶 (_b) quality
 */
function itemBuffs(it, adv) {
  const p = it.pct[adv ? 1 : 0] / 100;
  const stat = (bb) => ({ key: 'env_gbuff_new_with_verify', countType: 'NONE', blackboard: blackboard(bb, { key: 'attr_common_global_buff' }) });
  switch (it.key) {
    case 'chess_item_2_08_e': // 巴别塔誓言: ATK% / max HP% only; the bond grant is the item row's `giveBondId`
      return [stat({ atk: p, max_hp: p })];
    case 'chess_item_5_10_e': // “魔王的祭器”: max HP%, and the set shield while “文明的存续” is carried
      return [
        stat({ max_hp: p }),
        { key: 'env_gbuff_new_with_verify', countType: 'NONE',
          blackboard: blackboard({ heal_scale: 0.4, max_hp_scale: 0.3 }, { key: 'act2autochess_equip_acbabel_vessel_global_buff', equip_chess_id: 'chess_item_6_12_e' }) },
      ];
    default: { // “文明的存续”: ATK% / max HP%, the layering while “魔王的祭器” is carried, and (_b) the global amplifier
      const out = [
        stat({ atk: p, max_hp: p }),
        { key: 'env_gbuff_new_with_verify', countType: 'NONE',
          blackboard: blackboard({ check_hp: 3000, atk_per_stack: 0.05, attack_speed_per_stack: 5, max_stack_cnt: 4 },
            { key: 'act2autochess_equip_acbabel_legacy_ability', equip_chess_id: 'chess_item_5_10_e' }) },
      ];
      // The 进阶-only global amplifier. It is deliberately the LAST buff so it never shadows the shared ability key.
      if (adv) {
        out.push({ key: 'env_gbuff_new_with_verify', countType: 'NONE',
          blackboard: blackboard({ true_damage_mul: 2.5 }, { key: 'act2autochess_equip_acbabel_legacy_global_buff' }) });
      }
      return out;
    }
  }
}

const items = {};
const itemShopRows = {};
const itemTraps = {};
const itemEffects = {};
const itemEffectBuffs = {};
const researchItems = [];
for (const it of Object.values(BABEL_ITEMS)) {
  for (const q of ['a', 'b']) {
    const adv = q === 'b';
    const row = trapItemRow(it, q);
    items[row.chessId] = row;
    itemShopRows[row.chessId] = {
      itemId: `${it.key}_a`, goldenItemId: `${it.key}_b`, hideInShop: false,
      itemLevel: it.tier, iconLevel: 0, shopLevelSortId: it.sortId, itemType: 'EQUIP', trapId: it.trap,
    };
    const p = it.pct[adv ? 1 : 0];
    itemEffects[row.effectId] = {
      effectId: row.effectId, effectType: 'ITEM', effectCounterType: 'NONE', continuedRound: -1,
      effectName: it.name, effectDesc: it.raw(p, adv),
      effectDecoIconId: null, enemyPrice: 0,
    };
    itemEffectBuffs[row.effectId] = itemBuffs(it, adv);
    researchItems.push({
      id: row.chessId, goldenId: adv ? null : `${it.key}_b`, trapId: it.trap, name: it.name,
      itemType: 'EQUIP', tier: it.tier, shopLevelSortId: it.sortId, hideInShop: false,
      price: it.price, goldenPrice: 5, upgradeNum: adv ? 0 : 2, mergeable: !adv, trapDuration: adv ? 0 : -1,
      giveBondId: row.giveBondId, giveBondName: row.giveBondId ? '巴别塔' : null, canGiveBond: false,
      category: it.cat, kind: it.kind, requiresBond: null, requiresBondName: null, family: it.family,
      rangeId: '0-1', rangeGrids: [{ row: 0, col: 0 }], flavor: it.flavor, talentNotes: [],
      implFormula: it.formula,
    });
  }
}
// The trap character records: `buildItems` takes the item's NAME from its trap's `name`, and the client's item card (the
// board token it deploys) is drawn from `iconId`/`trapId` = that charId. Shape and every value mirror an official trap
// row (trap_1118_acarm118, 天马之盔): TRAP / notchar2 / NONE position / one PHASE_0 frame / no talent / one skill per
// quality. `sortIndex` continues past the official item range so the item list keeps a stable order.
for (const it of Object.values(BABEL_ITEMS)) {
  itemTraps[it.trap] = {
    name: it.name, description: null, sortIndex: 1000 + Object.keys(itemTraps).length,
    spTargetType: 'NONE', spTargetId: null, canUseGeneralPotentialItem: true, canUseActivityPotentialItem: false,
    potentialItemId: null, activityPotentialItemId: null, classicPotentialItemId: null,
    nationId: null, groupId: null, teamId: null, mainPower: { nationId: null, groupId: null, teamId: null },
    subPower: null, displayNumber: null, appellation: '', position: 'NONE', tagList: null,
    itemUsage: null, itemDesc: it.flavor, itemObtainApproach: null, isNotObtainable: false, isSpChar: false,
    maxPotentialLevel: 0, rarity: 'TIER_1', profession: 'TRAP', subProfessionId: 'notchar2',
    trait: null,
    phases: [{
      characterPrefabKey: it.trap, rangeId: '0-1', maxLevel: 30,
      attributesKeyFrames: [
        { level: 1, data: attrs({ maxHp: 100, atk: 0, def: 0, magicResistance: 0, cost: 0, baseAttackTime: 1 }) },
        { level: 30, data: attrs({ maxHp: 100, atk: 0, def: 0, magicResistance: 0, cost: 0, baseAttackTime: 1 }) },
      ],
    }],
    skills: [1, 2].map((n) => ({
      skillId: `sktok_acbabel_${it.trap.slice(-8)}_${n}`, overridePrefabKey: null, overrideTokenKey: null,
      levelUpCostCond: [], unlockCond: { phase: 'PHASE_0', level: 1 },
    })),
    displayTokenDict: null, talents: null, potentialRanks: [], favorKeyFrames: null, allSkillLvlup: [],
  };
}

// ===== 棋子 (chess) — the 8 new members (§2, §6.3 OPEN-4) ========================================================
//
// A chess is three official entries: the charChessDataDict row, the charShopChessDatas row of its NORMAL id (prices
// come from act.shopCharChessInfoData by tier — never written here) and the chessNormalIdLookupDict back-link of the
// elite. `base` names the chess pair (`<base>_a` NORMAL, `<base>_b` elite); `tier` is the design's; `charId` the
// operator; `bonds` the extra 盟约 the design gives them (巴别塔 is added to every member by this file); `garrisons`
// the trait pair above, split into `_a` / `_b` below. `skill` is the chess's DEFAULT skill — a 0-based index into the
// operator's `skills` order (「第 N 个技能」 = `N − 1`) — and it is the ONE field of this table that is a scalar on the
// shop row rather than a row of its own, so it needs no exception mechanism (unlike `bondIds` / `garrisonIds`): both
// `defaultSkillIndex` AND `backupCharSkillIndex` are written from it below, because a PRESET chess's backup is itself
// and `checkUnitFormParity` fails the build when the two disagree. 华法琳 / 伊内丝 / 魔王, the three OFFICIAL shop chess
// of the same batch of 2026-10-13, are deliberately NOT touched by this file: their official rows already carry the
// index the maintainer asked for (华法琳 `chess_char_4_26_a` 0 = S1 「紧急包扎」, 伊内丝 `chess_char_4_04_a` 1 = S2
// 「暗夜无明」, 魔王 `chess_char_4_25_a` 2 = S3 「编织重构现世」 — and the hidden T5 twins `chess_char_5_04_a` 0 /
// `chess_char_5_09_a` 2 agree), so there is no deviation to declare and no official row to override. `identifier` /
// `shopSortId` are display order: the identifiers
// continue past the official range (0–265) so a source update inserting rows cannot collide, the sort ids continue each
// tier's own range. `status` / `upgradeNum` follow the official module-carrying chess (the owner's instruction of
// 2026-10-12: 「为维什戴尔等有模组的角色添加模组」): NORMAL = PHASE_2 Lv1 skill 4 with `equipLevel` 0 and a null
// `module` — a module never changes a NORMAL chess's numbers (docs/design/match.md 「Modules only matter for the elite」,
// docs/DATA.md §2.2); elite = PHASE_2 Lv60 skill 7 with `equipLevel` 1 (`eliteEquipLevel`: 3 at T6) so its `module` is
// active and `modules[]` lists every ADVANCED 模组 of the character. `mod` is that character's default ADVANCED
// uniequip — always its `uniequip_002_*` (the first ADVANCED module; docs/research/03-operators.md 「The module used is
// always `defaultUniEquipId` (always the operator's `uniequip_002_*`)」), read from the official uniequip_table.json
// `charEquip`. The elite's `defaultUniEquipId` and `backupCharUniEquipId` are that same id, as on every official PRESET
// row (e.g. chess_char_4_25_a, 魔王: both `uniequip_002_cetsyr`), which is what `checkUnitFormParity` recomposes.
// `skill` is the member's default skill (0-based, see the header above); it defaults to 0 = S1 so an entry that keeps
// the official convention states nothing.
const member = (base, tier, charId, identifier, shopSortId, bonds, garrisonsOf, mod, skill = 0) => ({
  idA: `${base}_a`, idB: `${base}_b`, tier, charId, identifier, shopSortId, bonds, garrisons: garrisonsOf, mod, skill,
});

/** The elite member's 训练 status module stage: T6 elites carry theirs at stage 3, every other tier at stage 1 (DATA.md §2.2). */
const eliteEquipLevel = (tier) => (tier === 6 ? 3 : 1);

const members = [
  // 暴行 T1 — 助力 (deputShip); <售出时> 资金 +1 / +2 (the only economy trait of the list, §2 「暴行的特质是经济类 … 不是层数来源」)
  // default S2 微差爆破 (maintainer, 2026-10-13; S1 强力击·β型 stays selectable)
  member('chess_char_1_05_babel', 1, 'char_230_savage', 300, 21, ['deputShip'], ['garrison_162_a', 'garrison_162_b'], 'uniequip_002_savage', 1),
  // 奥达 T1 — 无其它盟约; <战斗中> 每累计承受 800 点伤害【巴别塔】+1 / +2 — default S2 锻锤之力 (maintainer, 2026-10-13)
  member('chess_char_1_06_babel', 1, 'char_4131_odda', 301, 22, [], ['garrison_163_a', 'garrison_163_b'], 'uniequip_002_odda', 1),
  // 阿米娅·医疗 T2 — 奥术; <战斗中> 每累计实际治疗 1200 点生命【巴别塔】【奥术】各 +2 / +4 — default S1 哀恸共情 (unchanged)
  // (升变 form: the official charEquip table DOES carry her module — `uniequip_002_amiya3`, listed under `char_002_amiya`,
  //  the base 阿米娅 row, since the form shares her equip slots — so this is official data, not a synthesis)
  member('chess_char_2_05_babel', 2, 'char_1037_amiya3', 302, 23, ['arcaneShip'], ['garrison_164_a', 'garrison_164_b'], 'uniequip_002_amiya3'),
  // 阿斯卡纶 T3 — 突袭 + 独行; <战斗中> 每累计造成 3000 点伤害【巴别塔】【突袭】+2 / +4 — default S2 恩赐 (maintainer, 2026-10-13)
  // (the maintainer's member table adds 独行 soloShip to her three bonds, in the order 巴别塔, 突袭, 独行)
  member('chess_char_3_05_babel', 3, 'char_4132_ascln', 303, 22, ['raidShip', 'soloShip'], ['garrison_166_a', 'garrison_166_b'], 'uniequip_002_ascln', 1),
  // 可露希尔 T3 — 投资人; <获得时> 自身所属盟约 +4 / +8 — default S3 「Q.E.D.」 (maintainer, 2026-10-13)
  member('chess_char_3_06_babel', 3, 'char_4228_closur', 304, 23, ['investShip'], ['garrison_167_a', 'garrison_167_b'], 'uniequip_002_closur', 2),
  // 赫德雷 T5 — 不屈; 【巴别塔】每 3 层攻防 +1% / +2% — default S3 死境硝烟 (maintainer, 2026-10-13)
  member('chess_char_5_06_babel', 5, 'char_4088_hodrer', 305, 50, ['indomShip'], ['garrison_168_a', 'garrison_168_b'], 'uniequip_002_hodrer', 2),
  // 逻各斯 T5 — 奥术; <战斗中> 每累计造成 8000 点伤害【巴别塔】【奥术】+6 / +8 — default S3 延异视阈 (maintainer, 2026-10-13)
  member('chess_char_5_07_babel', 5, 'char_4133_logos', 306, 51, ['arcaneShip'], ['garrison_169_a', 'garrison_169_b'], 'uniequip_002_logos', 2),
  // 维什戴尔 T6 — 无其它盟约; 攻防 +20 / +40% 与 【巴别塔】每 3 层攻防 +1% / +2% 写在同一行（不再借 168 那一对，
  // 单一 garrisonId，详情卡只有一个「作战能力」块）— default S3 爆裂黎明 (maintainer, 2026-10-13)
  member('chess_char_6_04_babel', 6, 'char_1035_wisdel', 307, 23, [], ['garrison_170_a', 'garrison_170_b'], 'uniequip_002_wisdel', 2),
];

const chess = {};
const shopRows = {};
const normalLookup = {};
for (const m of members) {
  const aId = m.idA;
  const bId = m.idB;
  const normalGarrisons = m.garrisons.filter((g) => g.endsWith('_a'));
  const goldenGarrisons = m.garrisons.filter((g) => g.endsWith('_b'));
  chess[aId] = {
    chessId: aId, identifier: m.identifier, isGolden: false,
    status: { evolvePhase: 'PHASE_2', charLevel: 1, skillLevel: 4, favorPoint: 0, equipLevel: 0 },
    upgradeChessId: bId, upgradeNum: 3,
    bondIds: [BABEL, ...m.bonds], garrisonIds: normalGarrisons,
  };
  chess[bId] = {
    chessId: bId, identifier: m.identifier + 1, isGolden: true,
    status: { evolvePhase: 'PHASE_2', charLevel: 60, skillLevel: 7, favorPoint: 0, equipLevel: eliteEquipLevel(m.tier) },
    upgradeChessId: null, upgradeNum: 0,
    bondIds: [BABEL, ...m.bonds], garrisonIds: goldenGarrisons,
  };
  // Both forms name the same default module: the NORMAL one never builds a module phase (equipLevel 0), the elite's is
  // active at its stage. `backupChar*` = the official PRESET convention (the chess is its own stand-in: same charId,
  // same skill, same module — docs/DATA.md §2.1). The default skill (`m.skill`) is the one selection both forms share:
  // it is the shop row's `defaultSkillIndex` AND its `backupCharSkillIndex`, never one without the other.
  shopRows[aId] = {
    chessId: aId, goldenChessId: bId, chessLevel: m.tier, shopLevelSortId: m.shopSortId, chessType: 'PRESET',
    charId: m.charId, tmplId: null, defaultSkillIndex: m.skill, defaultUniEquipId: m.mod,
    backupCharId: m.charId, backupTmplId: null, backupCharSkillIndex: m.skill, backupCharUniEquipId: m.mod, backupCharPotRank: 0,
    isHidden: false,
  };
  normalLookup[bId] = aId;
}

// ===== 干员 records ==============================================================================================
//
// Only one form is missing from the official zh_CN character_table, so only one full record is assembled here:
// 阿米娅·医疗 (`char_1037_amiya3`), a 「升变」 form the table has never carried (docs/research/15-babel-bond.md §6.1/§6.2 —
// probe result: 1382 rows and no such id, while skill_table.json has her two skills and the art pipeline has her Spine).
// The record below is built from PRTS 阿米娅(医疗) at the shape every other operator record has, and merged
// add-if-absent: the day the official table carries her, that row wins and this one is dropped. The second entry is a
// FIELD-level correction of an existing official row instead (see its comment).
//
// PRTS numbers (E0 Lv1 / E0 Lv50 / E1 Lv70 / E2 Lv80; trust +120 maxHp, +45 atk): 776/186/46 — 1022/306/67 —
// 1217/425/84 — 1416/532/106, 法抗 10/10/15/20. Range 3-1 at E0, 3-3 at E1/E2. 5★ 医疗 · 咒愈师
// (subProfessionId incantationmedic, position RANGED, nationId rhodes). Cost 19 is the 咒愈师 branch cost of the
// table's own 6★ 咒愈师 (缇缇, 15 + the E1 step's 2 — [ASSUMED] for her: PRTS lists no cost for the form).
// Trait: the branch text (攻击造成法术伤害, 攻击敌人时为攻击范围内一名友方干员治疗相当于50%伤害的生命值) — the text
// the engine's 咒愈师 kits are written against. Talents: 诚挚期许, the same 自研 synthesis as the rest of the record — the
// official zh_CN character_table has no row for this 「升变」 form (§6.1), so PRTS is the only source (its 天赋 table,
// read 2026-10-12): 精英1 "在场时所有友方单位最大生命+5%，技能期间所有友方单位每秒恢复1.5%最大生命", 精英2 +8% / 2.5%
// (the X module's 9 % / 3 % and 10 % / 3.5 % are out of scope: the chess carries no module, §6.3 「不要写模组」), with
// PRTS's 备注 "生命恢复的提供方式为增加目标的'生命回复速度（百分比）'属性（直接加算），不受治疗加成和禁疗影响".
// The blackboard keys are the official ones of that wording — `max_hp` and `hp_recovery_per_sec_by_max_hp_ratio`
// (幽灵鲨 深海再生力 "生命上限+10%，每秒回复最大生命2%的生命" carries exactly this pair), flattened by
// tools/build-data.mjs's flattenBB into the chess record's `talents[0].bb`, which kits/ops/op-amiya3.js reads.
// 潜能 5 of hers (PRTS) is not a 天赋效果增强 step, so there is one candidate per phase (requiredPotentialRank 0).
// Skills: the two ids skill_table.json carries, both 1-indexed at E0/E1. No module and no tokens
// (`displayTokenDict: {}`), so no uniequip_table dependency.
const characters = {
  char_1037_amiya3: {
    name: '阿米娅', appellation: 'Amiya', rarity: 'TIER_5', profession: 'MEDIC',
    subProfessionId: 'incantationmedic', position: 'RANGED', nationId: 'rhodes',
    groupId: null, teamId: null, displayNumber: 'R1037',
    description: '攻击造成法术伤害，攻击敌人时为攻击范围内一名友方干员治疗相当于50%伤害的生命值',
    mainPower: { nationId: 'rhodes', groupId: null, teamId: null },
    subPower: [{ nationId: 'rim', groupId: null, teamId: null }, { nationId: null, groupId: 'babel', teamId: null }],
    tagList: ['治疗', '支援'], isSpChar: true, isNotObtainable: false, maxPotentialLevel: 5,
    canUseGeneralPotentialItem: true, canUseActivityPotentialItem: false,
    potentialItemId: 'p_char_1037_amiya3', activityPotentialItemId: null, classicPotentialItemId: null,
    itemUsage: '罗德岛医疗干员阿米娅，以咒愈之术守护同伴。',
    itemDesc: '她仍在寻找那个答案。',
    itemObtainApproach: '升变系统',
    sortIndex: null, spTargetType: 'NONE', spTargetId: null,
    trait: { candidates: [traitCandidate('攻击造成<@ba.kw>法术伤害</>，攻击敌人时为攻击范围内一名友方干员治疗相当于<@ba.kw>{scale:0%}</>伤害的生命值', { scale: 0.5 })] },
    phases: [
      { characterPrefabKey: 'char_1037_amiya3', rangeId: '3-1', maxLevel: 50, evolveCost: null, attributesKeyFrames: [
        { level: 1, data: attrs({ maxHp: 776, atk: 186, def: 46, magicResistance: 10 }) },
        { level: 50, data: attrs({ maxHp: 1022, atk: 306, def: 67, magicResistance: 10 }) },
      ] },
      { characterPrefabKey: 'char_1037_amiya3', rangeId: '3-3', maxLevel: 70, evolveCost: null, attributesKeyFrames: [
        { level: 1, data: attrs({ maxHp: 1217, atk: 425, def: 84, magicResistance: 15 }) },
        { level: 70, data: attrs({ maxHp: 1217, atk: 425, def: 84, magicResistance: 15 }) },
      ] },
      { characterPrefabKey: 'char_1037_amiya3', rangeId: '3-3', maxLevel: 80, evolveCost: null, attributesKeyFrames: [
        { level: 1, data: attrs({ maxHp: 1416, atk: 532, def: 106, magicResistance: 20 }) },
        { level: 80, data: attrs({ maxHp: 1416, atk: 532, def: 106, magicResistance: 20 }) },
      ] },
    ],
    skills: [
      { skillId: 'skchr_amiya3_1', overridePrefabKey: null, overrideTokenKey: null, levelUpCostCond: [], unlockCond: { phase: 'PHASE_0', level: 1 } },
      { skillId: 'skchr_amiya3_2', overridePrefabKey: null, overrideTokenKey: null, levelUpCostCond: [], unlockCond: { phase: 'PHASE_1', level: 1 } },
    ],
    displayTokenDict: {},
    talents: [
      {
        candidates: [
          {
            unlockCondition: { phase: 'PHASE_1', level: 1 }, requiredPotentialRank: 0, prefabKey: '1', name: '诚挚期许',
            description: '在场时所有友方单位最大生命+5%，技能期间所有友方单位每秒恢复1.5%最大生命',
            rangeId: null, tokenKey: null, isHideTalent: false,
            blackboard: [
              { key: 'max_hp', value: 0.05, valueStr: null },
              { key: 'hp_recovery_per_sec_by_max_hp_ratio', value: 0.015, valueStr: null },
            ],
          },
          {
            unlockCondition: { phase: 'PHASE_2', level: 1 }, requiredPotentialRank: 0, prefabKey: '1', name: '诚挚期许',
            description: '在场时所有友方单位最大生命+8%，技能期间所有友方单位每秒恢复2.5%最大生命',
            rangeId: null, tokenKey: null, isHideTalent: false,
            blackboard: [
              { key: 'max_hp', value: 0.08, valueStr: null },
              { key: 'hp_recovery_per_sec_by_max_hp_ratio', value: 0.025, valueStr: null },
            ],
          },
        ],
      },
    ],
    potentialRanks: [],
    favorKeyFrames: [
      { level: 0, data: attrs({ maxHp: 0, atk: 0, def: 0, magicResistance: 0, cost: 0 }) },
      { level: 50, data: attrs({ maxHp: 120, atk: 45, def: 0, magicResistance: 0, cost: 0 }) },
    ],
    allSkillLvlup: [],
  },
  // 克莱门莎's committed appellation. The upstream character_table spells her "Clementia" (an upstream transliteration
  // the maintainer corrected to the official one when she became a shop chess), so a rebuild from that table alone
  // would silently change a field of a shipped operator. Only `appellation` is listed: applyCustom() adds a character
  // row that is absent and otherwise applies exactly the fields listed here, reporting the change.
  char_4231_clemnt: { appellation: 'Clemensa' },
};

// ===== official rows this file EXTENDS (the three documented exceptions) ========================================
//
// `bondIds` is a field of a row the official table already has, so 巴别塔 cannot be added add-if-absent: these are
// UNIONS (the official list plus 巴别塔, never less). The three operators are the design's 「现成的 3 名」 (§2):
// 华法琳 chess_char_4_26_a/_b, 魔王 chess_char_4_25_a/_b, 伊内丝 chess_char_4_04_a/_b.
//
// 华法琳 and 魔王 each also have a HIDDEN T5 form of the same operator in the official table (华法琳 chess_char_5_04_a/_b,
// 魔王 chess_char_5_09_a/_b — the 精锐-in-险境 forms the shop never shows). A bond belongs to the OPERATOR, not to one of
// their chess records: whichever form is on the board is the 巴别塔 member, so both hidden forms carry the union too.
// (伊内丝 has no hidden form; the 8 new members of this file are fiat rows that already list 巴别塔 themselves.)
const chessBonds = {
  chess_char_4_26_a: [BABEL], chess_char_4_26_b: [BABEL],   // 华法琳 (official 奇迹 member)
  chess_char_5_04_a: [BABEL], chess_char_5_04_b: [BABEL],   // 华法琳 T5 hidden form (same operator)
  chess_char_4_25_a: [BABEL], chess_char_4_25_b: [BABEL],   // 魔王
  chess_char_5_09_a: [BABEL], chess_char_5_09_b: [BABEL],   // 魔王 T5 hidden form (same operator)
  chess_char_4_04_a: [BABEL], chess_char_4_04_b: [BABEL],   // 伊内丝 (official 远见/突袭 member)
  // NOT listed, on purpose: 克莱门莎. A union entry can only ADD a bond, and the maintainer's ruling of 2026-10-12
  // needs her to LOSE 不屈 — so her whole row is fiat (`clemensa.chess` below) and states her EXACT final `bondIds`
  // there; an entry here would add 不屈 straight back. The header's REMOVING note is the rule.
};

// ===== official bonds this file EXTENDS (the member-list mirror) ================================================
//
// The mirror image of `chessBonds`: a fiat chess that carries an OFFICIAL bond must also appear in that bond's own
// member list, because build-data.mjs buildBonds() derives data/bonds.json `members` / `visibleMembers` from the
// official `chessIdList` and the bond panel builds its 成员 rows from those (public/js/ui/gameLogic/bonds.js
// bondMembers). A chess whose `bonds` names a bond it is missing from is exactly the inconsistency test/data.test.js
// guards (「Every chess bond membership is mirrored in the bond member list」), so `chessIdList` is extended as a UNION,
// like `bondIds` above, never rewritten.
//
// Only the fiat chess of this file that the design gives an OFFICIAL bond are listed (babelShip's own list is in
// `bond.chessIdList` above; 奥达 / 维什戴尔 carry no other bond):
//   暴行 助力 · 阿米娅·医疗 奥术 · 阿斯卡纶 突袭 + 独行 · 可露希尔 投资人 · 赫德雷 不屈 · 逻各斯 奥术
//   克莱门莎 阿戈尔 / 迅捷 / 元素 (her committed records, `clemensa.chess` below)
// 克莱门莎 is NOT listed under 不屈 any more: the maintainer's ruling of 2026-10-12 gives her 阿戈尔 / 迅捷 / 元素, so
// indomShip's member list drops her two records and elementShip's own `chessIdList` (above) carries them instead.
const bondChessIds = {
  deputShip: ['chess_char_1_05_babel_a', 'chess_char_1_05_babel_b'],                                     // 暴行
  arcaneShip: ['chess_char_2_05_babel_a', 'chess_char_2_05_babel_b',                                     // 阿米娅·医疗
    'chess_char_5_07_babel_a', 'chess_char_5_07_babel_b'],                                               // 逻各斯
  raidShip: ['chess_char_3_05_babel_a', 'chess_char_3_05_babel_b'],                                     // 阿斯卡纶
  soloShip: ['chess_char_3_05_babel_a', 'chess_char_3_05_babel_b'],                                     // 阿斯卡纶 (maintainer's table: 独行)
  investShip: ['chess_char_3_06_babel_a', 'chess_char_3_06_babel_b'],                                   // 可露希尔
  indomShip: ['chess_char_5_06_babel_a', 'chess_char_5_06_babel_b'],                                    // 赫德雷 (克莱门莎 left 不屈)
  egirShip: ['chess_char_5_clemnt_a', 'chess_char_5_clemnt_b'],                                         // 克莱门莎
  swiftShip: ['chess_char_5_clemnt_a', 'chess_char_5_clemnt_b'],                                        // 克莱门莎
};

// `garrisonIds` is likewise rewritable, by design. This table holds NO entry any more: 华法琳's 7 / 14 → 4 / 8 cap
// override was WITHDRAWN (maintainer, 2026-10-13), so her visible T4 pair chess_char_4_26_a/_b keeps its official
// `garrison_72_a/_b` (which grants the official `garrison_95_a/_b`, +1 / +2 per skill cast, cap 7 / 14) and her hidden
// T5 pair chess_char_5_04_a/_b is untouched official data either way. The channel itself stays: the 元素 table
// (`elementChessGarrisons`: 菲莱 43 → 175, 烛煌 35 → 176, 妮芙 56 → 177, 克莱门莎 161 → 178) uses the same replace call,
// and `elementChessGarrisons` is why `garrisonKeep` exists at all (docs/DATA.md §19.4).
const chessGarrisons = {};

// ===== 元素 — the bond (docs/research/17-element-bond.md §1) =======================================================
//
// 附加（非核心）盟约, the same family as 迅捷 / 远见: `isPower` false (`bondType` REGULAR, identifier past the official
// 23 + 巴别塔's 24), 在场 2 名一档 / 3 名二档, weight 10, countMode BOARD.
//
// 一档 (2 名)   【元素】干员造成的元素损伤 ×(1 + 0.10 + 0.003·L), L clamped to 150  → +55 % at 150
// 二档 (3 名)   按元素损伤种类, L clamped to 200:
//               凋亡 爆发伤害 → 110 % + 1.075 %·L (325 % at 200) + 目标攻击力额外最终 ×0.70
//               灼燃 爆发伤害 → 195 % + 1.495 %·L (494 % at 200) + 目标法术抗性额外 −20
//               神经 爆发伤害 → 110 % + 0.75 %·L (260 % at 200) + 冷却期每秒 500 + 4·L 元素持续伤害
//               侵蚀 目标防御力额外永久 −120 + 冷却期 0.3 s 内 10 次 750 + 6·L 物理持续伤害
//
// The per-stack slopes are DERIVED from the design's two endpoints (0 and the cap), never typed as magic numbers:
// a per-stack value is `(top − base) / cap`. The simulation reads every one of these keys by name
// (server/sim/content/bonds/addon/element.js) — nothing about the effect is hardcoded there.
const ELEMENT = 'elementShip';
/** `(top − base) / cap` — the slope of a clause that runs base → top over `cap` layers. */
const slope = (base, top, cap) => Math.round(((top - base) / cap) * 1e7) / 1e7;

const elementBond = {
  [ELEMENT]: {
    bondId: ELEMENT, name: '元素',
    desc: '【元素】干员造成的元素损伤提升<@autochess.gray>（受层数影响，150层达到最大增益）</>\n'
      + '<在场<@autochess.dgreen>3</>名不同【元素】干员>按元素损伤种类分别生效<@autochess.gray>（受层数影响，200层达到最大增益）</>：\n'
      + '凋亡损伤爆发：本次元素爆发造成的伤害提升至<@ba.vup>110%</>，目标的攻击力额外最终降低至<@ba.vup>70%</>\n'
      + '灼燃损伤爆发：本次元素爆发造成的伤害提升至<@ba.vup>195%</>，目标的法术抗性额外<@ba.vup>-20</>\n'
      + '神经损伤爆发：本次元素爆发直接造成的伤害提升至<@ba.vup>110%</>，冷却期间每秒额外受到<@ba.vup>500</>点无来源的元素持续伤害\n'
      + '侵蚀损伤爆发：目标的防御力额外永久<@ba.vup>-120</>，冷却期间每<@ba.vup>0.03</>秒受到一次、共<@ba.vup>10</>次、每次<@ba.vup>750</>点无来源的物理持续伤害',
    iconId: 'icon_elementShip',
    activeCount: 2,
    activeCondition: 'BOARD',
    activeConditionTemplate: 'count_threshold_upward',
    activeParamList: ['2', '3'],   // 一档 2 名 / 二档 3 名 (buildBonds reads both; thresholds = [2, 3])
    effectId: 'bondeffect_element',
    activeType: 'BATTLE',
    identifier: 25,           // after the 23 official bonds and 巴别塔's 24: buildBonds sorts by identifier
    weight: 10,               // participates in the per-match 每局随机禁用 draw, like every other small bond
    isActiveInDeck: false,
    maxInactiveBondCount: -1,
    // Positional `{i:fmt}` params of effectDesc = bb[baseParams[i]] + bb[perStackParams[i]] × L (build-data.mjs
    // effectDescParams). One entry per placeholder index, `null` where the slot does not scale with layers (the
    // 攻击力最终乘区 and the 侵蚀 −120 are flat; the 侵蚀 per-hit cap is NOT a layer slot, so it stays out of these lists).
    descParamBaseList: ['element_damage_base', 'apoptosis_burst_base', 'apoptosis_atk_final_mul', 'burn_burst_base', 'burn_res_down',
      'neural_burst_base', 'neural_dot_base', 'erosion_def_down', 'erosion_dot_base'],
    descParamPerStackList: ['element_damage_per_stack', 'apoptosis_burst_per_stack', null, 'burn_burst_per_stack', null,
      'neural_burst_per_stack', 'neural_dot_per_stack', null, 'erosion_dot_per_stack'],
    noStack: false,
    // Membership is explicit. An operator joins 元素 by being listed here (and by `elementChessBonds` below, or — for
    // the fiat 克莱门莎 — by her own record's `bondIds`), never by a `powerIdList` guess: the official 本源 branches
    // (primprotector / primguard / primcaster) are not a faction, and 珊比's own `powers` is `['rim']` while the
    // design's list is the seven operators below.
    chessIdList: [
      'chess_char_3_06_a', 'chess_char_3_06_b',           // 菲莱 T3  (official chess, 元素 added by `elementChessBonds`)
      'chess_char_5_03_a', 'chess_char_5_03_b',           // 烛煌 T5  (official chess)
      'chess_char_5_22_a', 'chess_char_5_22_b',           // 妮芙 T5  (official chess)
      'chess_char_6_10_a', 'chess_char_6_10_b',           // 妮芙 T6 hidden form (same operator; the shop never shows it)
      'chess_char_5_clemnt_a', 'chess_char_5_clemnt_b',   // 克莱门莎 T5 (the maintainer's own chess; `clemensa.chess`)
      'chess_char_6_03_a', 'chess_char_6_03_b',           // 余   T6  (official chess)
      'chess_char_6_09_a', 'chess_char_6_09_b',           // 塑心 T6  (official chess)
      'chess_char_4_27_a', 'chess_char_4_27_b',           // 珊比 T4  (promoted from 自选, below)
    ],
  },
};

// ac.bondInfoDict[bondId] — the tag row buildBonds reads for bondType / bondOrder / powerIdList / isPower.
const elementModeBond = {
  [ELEMENT]: {
    bondId: ELEMENT, bondType: 'REGULAR', bondOrder: 2, powerIdList: [],
    name: '元素', icon: 'icon_elementShip', isPower: false, isHiddenCharList: false,
  },
};

// ===== 元素 — the bond effect (effectInfoDataDict + effectBuffInfoDataDict) ========================================
//
// Every number the simulation uses lives in this one `env_gbuff_new` blackboard (the official key), exactly as the
// other bonds do — a retune is an edit of the values below plus a rebuild, never a code change. The keys are the
// readable成套 names of the design: `element_damage_*` (一档), `apoptosis_*` / `burn_*` / `neural_*` / `erosion_*`
// (二档's four clauses) and `tier2_cap_layers` (the 二档 clamp).
const elementEffect = {
  bondeffect_element: {
    effectId: 'bondeffect_element', effectType: 'BOND', effectCounterType: 'NONE', continuedRound: -1,
    effectName: '元素',
    effectDesc: '【元素】干员造成的元素损伤<@ba.vup>+{0:0%}</><@ba.acrem>（受层数影响，150层达到最大增益）</>\n'
      + '<在场<@ba.vup>3</>名不同【元素】干员>按元素损伤种类分别生效<@ba.acrem>（受层数影响，200层达到最大增益）</>：\n'
      + '凋亡损伤爆发：本次元素爆发造成的伤害提升至<@ba.vup>{1:0%}</>，目标的攻击力额外最终降低至<@ba.vup>{2:0%}</>\n'
      + '灼燃损伤爆发：本次元素爆发造成的伤害提升至<@ba.vup>{3:0%}</>，目标的法术抗性额外<@ba.vup>-{4:0}</>\n'
      + '神经损伤爆发：本次元素爆发直接造成的伤害提升至<@ba.vup>{5:0%}</>，冷却期间每秒额外受到<@ba.vup>{6:0}</>点无来源的元素持续伤害\n'
      + '侵蚀损伤爆发：目标的防御力额外永久<@ba.vup>-{7:0}</>，冷却期间每0.03秒受到一次、共10次、每次<@ba.vup>{8:0}</>点无来源的物理持续伤害',
    effectDecoIconId: null, enemyPrice: 0,
  },
};
const elementEffectBuffs = {
  bondeffect_element: [{
    key: 'env_gbuff_new', countType: 'NONE',
    blackboard: blackboard({
      // 一档: element damage ×(1 + base + per·min(L, cap)) — 0.10 at 0, 0.55 at the 150-layer cap
      element_damage_base: 0.10, element_damage_per_stack: 0.003, element_damage_cap_layers: 150,
      // 二档 clamp for all four clauses
      tier2_cap_layers: 200,
      // 凋亡: the burst's own damage 110 % → 325 %, and the target's final ATK ×0.70 (额外最终降低至 70 %)
      apoptosis_burst_base: 1.10, apoptosis_burst_per_stack: slope(1.10, 3.25, 200), apoptosis_atk_final_mul: 0.70,
      // 灼燃: 195 % → 494 %, and the target's RES −20 more
      burn_burst_base: 1.95, burn_burst_per_stack: slope(1.95, 4.94, 200), burn_res_down: 20,
      // 神经: the burst's DIRECT damage 110 % → 260 %, and 500 → 1300 元素持续伤害 per second while the cooldown runs
      neural_burst_base: 1.10, neural_burst_per_stack: slope(1.10, 2.60, 200),
      neural_dot_base: 500, neural_dot_per_stack: slope(500, 1300, 200),
      // 侵蚀: the target's DEF −120 more (permanent), and 750 → 1950 物理持续伤害 ×10 hits inside 0.3 s
      erosion_def_down: 120,
      erosion_dot_base: 750, erosion_dot_per_stack: slope(750, 1950, 200), erosion_dot_hits: 10, erosion_dot_interval: 0.03,
    }, { key: 'act2autochess_bond_eff_element' }),
  }],
};

// ===== 元素 — the 特质 of its members ==============================================================================
//
// Three traits are families the official data already has; the ids continue this file's sequence (巴别塔 holds
// garrison_162…174, 克莱门莎 161) at **175** — see the per-row comments. `garrison_key` is the per-battle layer cap's
// identity, not decoration: S.gainLayers keys its cap on `gar:<garrison_key>:<unit.id>|<bond>`, so a row whose
// `garrison_key` is missing silently loses its cap (克莱门莎's 161 rows carry it). The helper writes it from `key`.
const elementGarrisons = {
  // ── 菲莱 T3 (existing shop chess, 特质 EXTENDED): her official garrison_43_a/_b (萨尔贡 +6 / +12 on skill start)
  //    gains the 元素 clause. The two target bonds are added to the SAME row — `bbStr.bond_id` is a comma-separated
  //    list and garrisons/battle.js targetBonds() splits it — so one skill start grants both, on the official handler
  //    act1autochess_gar_event_useskill; no new mechanic, no second row and no second detail-card block.
  garrison_175_a: garrison('garrison_175_a',
    '<战斗中>开启技能时，使已激活的【萨尔贡】层数<@ba.vup>+6</>、【元素】层数<@ba.vup>+3</>',
    { eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', effectType: 'ADD_BOND', bb: { bond_add_count: 6 }, bbStr: { key: 'act1autochess_gar_event_useskill', bond_type: 'bond_by_id', bond_id: 'sargonShip,elementShip', bond_add_type: 'by_count' }, battleRuneKey: 'env_gbuff_new_with_verify', key: 'garrison_175_a' }),
  garrison_175_b: garrison('garrison_175_b',
    '<战斗中>开启技能时，使已激活的【萨尔贡】层数<@ba.vup>+12</>、【元素】层数<@ba.vup>+6</>',
    { eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', effectType: 'ADD_BOND', bb: { bond_add_count: 12 }, bbStr: { key: 'act1autochess_gar_event_useskill', bond_type: 'bond_by_id', bond_id: 'sargonShip,elementShip', bond_add_type: 'by_count' }, battleRuneKey: 'env_gbuff_new_with_verify', key: 'garrison_175_b' }),

  // ── 烛煌 T5 (existing shop chess): her official garrison_35_a/_b (炎/维多利亚 +5 / +10 「无需激活盟约」, the
  //    SERVER_ADD_BOND family 艾丝黛尔 / 深靛 use) gains 元素. Same row, one more id in `bbStr.bond`.
  garrison_176_a: garrison('garrison_176_a',
    '<获得时>【炎】【维多利亚】【元素】层数<@ba.vup>+5</>（无需激活盟约）',
    { eventType: 'SERVER_GAIN', eventTypeDesc: '单次叠加', effectType: 'SERVER_ADD_BOND', bb: { count: 5 }, bbStr: { bond: 'yanShip,victoriaShip,elementShip' } }),
  garrison_176_b: garrison('garrison_176_b',
    '<获得时>【炎】【维多利亚】【元素】层数<@ba.vup>+10</>（无需激活盟约）',
    { eventType: 'SERVER_GAIN', eventTypeDesc: '单次叠加', effectType: 'SERVER_ADD_BOND', bb: { count: 10 }, bbStr: { bond: 'yanShip,victoriaShip,elementShip' } }),

  // ── 妮芙 T5 (existing shop chess): her official garrison_56_a/_b (整备区每有 1 个干员 → 【迅捷】+2 / +4, the
  //    SERVER_ADD_BOND_METHOD / hand_count family) gains 元素. Same row, one more id in `bbStr.bond`; the 精锐's
  //    hidden T6 form (chess_char_6_10_a/_b) shares the same pair, so both forms follow.
  garrison_177_a: garrison('garrison_177_a',
    '<休整期结束时>整备区每有1个干员，使已激活的【迅捷】【元素】层数<@ba.vup>+2</>',
    { eventType: 'SERVER_PREP_FIN', eventTypeDesc: '持续叠加', effectType: 'SERVER_ADD_BOND_METHOD', bb: { multi: 2 }, bbStr: { add_method: 'hand_count', bond: 'swiftShip,elementShip', conditionkey: 'character_target_inboard' } }),
  garrison_177_b: garrison('garrison_177_b',
    '<休整期结束时>整备区每有1个干员，使已激活的【迅捷】【元素】层数<@ba.vup>+4</>',
    { eventType: 'SERVER_PREP_FIN', eventTypeDesc: '持续叠加', effectType: 'SERVER_ADD_BOND_METHOD', bb: { multi: 4 }, bbStr: { add_method: 'hand_count', bond: 'swiftShip,elementShip', conditionkey: 'character_target_inboard' } }),

  // ── 克莱门莎 T5 (the maintainer's own chess, REPLACED): her committed 特质 garrison_161_a/_b was
  //    `<战斗中>击倒敌人时，使已激活的【阿戈尔】【迅捷】【不屈】层数+2 / +3` — the official
  //    act1autochess_gar_event_selfkillenemy shape with `check_cnt` 1, i.e. EVERY kill. The maintainer's 元素 version
  //    adds a rhythm and a cap: 每击倒 3 名敌人 → +2 / +4, 每场战斗至多 +14 / +28. `check_cnt` 3 is the "每 3 名"
  //    rhythm (the handler fires every `check_cnt`-th kill of the holder); `max_add_count_per_battle` 14 / 28 is the
  //    cap. [ASSUMED — the per-battle cap's unit] S.gainLayers caps per (garrison instance, BOND), so the value read
  //    as 「每场战斗最多 +14」 per bond gives each of the three bonds its own 14 (42 across the three). A single cap
  //    over the row's total would need a new cap mode in server/sim/content/support/index.js gainLayers() and is NOT
  //    introduced here (a change of that shared primitive is a pull request of its own); the data carries the design's
  //    number and the deviation is recorded in docs/research/17-element-bond.md §5.
  //    The TARGET LIST follows her bond list (maintainer's ruling of 2026-10-12): 阿戈尔 / 迅捷 / 元素, not 不屈 —
  //    the trait and the membership converged on the same three bonds, so she no longer adds layers to a bond she has
  //    left. `bond_id` is a comma-separated list the official handler splits (`garrisons/battle.js targetBonds()`),
  //    so the three clauses are one row and one detail-card block, as before; 元素 still requires activation, like the
  //    other two (the text says 「已激活」, and `requireActiveOf` reads it).
  garrison_178_a: garrison('garrison_178_a',
    '<战斗中>每击倒3名敌人，使已激活的【阿戈尔】【迅捷】【元素】层数<@ba.vup>+2</>（每场战斗至多<@ba.vup>+14</>）',
    { eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', effectType: 'ADD_BOND', bb: { check_cnt: 3, bond_add_count: 2, max_add_count_per_battle: 14 }, bbStr: { key: 'act1autochess_gar_event_selfkillenemy', bond_type: 'bond_by_id', bond_id: 'egirShip,swiftShip,elementShip', bond_add_type: 'by_count' }, battleRuneKey: 'env_gbuff_new_with_verify', key: 'garrison_178_a' }),
  garrison_178_b: garrison('garrison_178_b',
    '<战斗中>每击倒3名敌人，使已激活的【阿戈尔】【迅捷】【元素】层数<@ba.vup>+4</>（每场战斗至多<@ba.vup>+28</>）',
    { eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', effectType: 'ADD_BOND', bb: { check_cnt: 3, bond_add_count: 4, max_add_count_per_battle: 28 }, bbStr: { key: 'act1autochess_gar_event_selfkillenemy', bond_type: 'bond_by_id', bond_id: 'egirShip,swiftShip,elementShip', bond_add_type: 'by_count' }, battleRuneKey: 'env_gbuff_new_with_verify', key: 'garrison_178_b' }),

  // ── 珊比 T4 (promoted from 自选, below): <获得时> 使【元素】层数 +6 / +12（无需激活盟约） ──
  //    The 可露希尔 / 灵知 family is SERVER_ADD_BOND (an explicit bond id). 「（无需激活盟约）」 is written in the text
  //    because it IS the row's behaviour and because the handler derives `requireActive` from the text
  //    (server/sim/content/garrisons/meta.js requireActiveOf): 元素 is a bond whose only member is the piece being
  //    acquired, so a 「使已激活的」 reading would make the gain a silent no-op [ASSUMED: the design's line reads
  //    「使已激活的【元素】层数+6」; 烛煌's 35 family — the same SERVER_ADD_BOND path — carries the note, and 珊比 is the
  //    first member of her bond. Recorded in docs/research/17-element-bond.md §5.]
  garrison_179_a: garrison('garrison_179_a',
    '<获得时>使【元素】层数<@ba.vup>+6</>（无需激活盟约）',
    { eventType: 'SERVER_GAIN', eventTypeDesc: '单次叠加', effectType: 'SERVER_ADD_BOND', bb: { count: 6 }, bbStr: { bond: 'elementShip' } }),
  garrison_179_b: garrison('garrison_179_b',
    '<获得时>使【元素】层数<@ba.vup>+12</>（无需激活盟约）',
    { eventType: 'SERVER_GAIN', eventTypeDesc: '单次叠加', effectType: 'SERVER_ADD_BOND', bb: { count: 12 }, bbStr: { bond: 'elementShip' } }),

  // ── 克莱门莎's PREVIOUS pair is NOT declared here ──
  //    garrison_161_a/_b is 克莱门莎's own committed record and lives in `clemensa.garrisons` at the end of this file,
  //    field for field as data/garrisons.json carries it (the block the maintainer asked to keep untouched). Declaring
  //    it again through this helper would only add a `custom: … already in the official data` warning. `garrisonKeep`
  //    below is what keeps it in the rebuilt dataset once her chess stops naming it. Her 特质 since this change is
  //    garrison_178_a/_b.
};

// ===== 元素 — the official 特质 rows the replacement above must keep in data/garrisons.json ========================
//
// buildGarrisons() emits a garrison row only while some CHESS names it, so a replacement (the `elementChessGarrisons`
// union, above) leaves the official row it used to carry unreferenced — and this builder would drop it. That is not
// acceptable: the row is a shipped record other consumers read by id (the prep-side meta registry,
// `test/content/garrisons_battle.test.js`'s per-effect-key sweeps, the 魔王 顺位 case that fields 菲莱's row as a side
// operator). `garrisonKeep` below lists them, and buildGarrisons reads it; the rows themselves are the OFFICIAL
// garrisonDataDict rows (this file declares none of them, so there is nothing to keep in sync).
//
// They come out as ORPHANS — `owners` (a build OUTPUT) is empty for 35 / 43 / 161 now — exactly like the other orphan
// rows the dataset already carries (29, 95, 96, 108, 117_b, 174: halves of a granting pair, or a trait the data itself
// no longer attaches).
//
// 「特质不变」的两名（余 chess_char_6_03, 塑心 chess_char_6_09）从未被替换：他们的 `garrisonIds` 仍指向 garrison_37 /
// garrison_90（官方行，带 owners），本文件只给他们的 `bonds` 追加了 elementShip。妮芙的官方 garrison_56_a/_b 同理仍在
// （她的隐藏 T6 棋 chess_char_6_10_a/_b 仍带着它）。

/**
 * Ids `data/garrisons.json` must keep even though no chess names them any more (build-data.mjs buildGarrisons reads
 * this list): the traits the four replacements above took over — 菲莱's 43, 烛煌's 35, 克莱门莎's 161. 妮芙's 56 is
 * deliberately absent (her hidden T6 form still names it). build-data.mjs reports a `custom:` warning for an entry the
 * official table does not carry.
 */
const garrisonKeep = ['garrison_43_a', 'garrison_43_b', 'garrison_35_a', 'garrison_35_b', 'garrison_161_a', 'garrison_161_b'];

// ===== 元素 — 珊比, the promotion of a 自选 6★ into a visible T4 shop chess =========================================
//
// 珊比 (char_4235_thumpy) was a 自选 (DIY) pick — data/backups.json `diy.ownedPool` carried her and her kit
// (server/sim/content/kits/ops/op-thumpy.js) fought at the tier-5 / tier-6 DIY slots. The maintainer promotes her to a
// regular T4 shop chess of the 元素 bond, exactly as OPEN-4 promoted 阿斯卡纶 / 可露希尔 / 赫德雷 / 逻各斯 / 维什戴尔
// into 巴别塔 (docs/research/15-babel-bond.md §6.3 item 1). Three consequences, all of them automatic or here:
//
//   · `charShopChessDatas` gains her row, which puts her charId on `buildBackups`'s `roster` — she therefore leaves
//     `diy.ownedPool` (and `diy.operators`) by itself. Nothing in this file removes her from there.
//   · her kit stays the single implementation in op-thumpy.js; the chess id is served by the shim
//     server/sim/content/kits/ops/chess_char_4_27-thumpy.js, the 克莱门莎 / 巴别塔 pattern (kits/index.js).
//   · tools/assets/extra-operators.json must list her in the same change: she is now named by no `diy.ownedPool` entry,
//     so without a record a manifest rebuild would drop every one of her assets (docs/ASSETS.md, third source).
//
// `module` is null: a PRESET chess's module comes from `defaultUniEquipId`, which
// she does not carry, so the elite gets the module STATS without a module PHASE — the same shape as 克莱门莎's row.
// Her default skill is S2 「慢慢走~」 (index 1, maintainer 2026-10-13) on BOTH rows: `defaultSkillIndex` and
// `backupCharSkillIndex` carry the same index, as on every PRESET row (`checkUnitFormParity` requires it).
const ELEMENT_MEMBER = { a: 'chess_char_4_27_a', b: 'chess_char_4_27_b' };

/**
 * The elite → normal link of 珊比's pair (the official `chessNormalIdLookupDict` shape: the key is the ELITE id and the
 * value the NORMAL one). Without it the elite record's `baseId` falls back to itself, and `test/data.test.js` asserts
 * that a base id names a NORMAL record. Each of the two records still needs its own `charShopChessDatas` row — the
 * builder resolves every id through this dictionary and then looks the RESULT up there (克莱门莎's pair carries the
 * same two links).
 */
const elementNormalLookup = { [ELEMENT_MEMBER.b]: ELEMENT_MEMBER.a };

const elementChess = {
  [ELEMENT_MEMBER.a]: {
    chessId: ELEMENT_MEMBER.a, identifier: 309, isGolden: false,
    status: { evolvePhase: 'PHASE_2', charLevel: 1, skillLevel: 4, favorPoint: 0, equipLevel: 0 },
    upgradeChessId: ELEMENT_MEMBER.b, upgradeNum: 3,
    bondIds: [ELEMENT], garrisonIds: ['garrison_179_a'],
  },
  [ELEMENT_MEMBER.b]: {
    chessId: ELEMENT_MEMBER.b, identifier: 310, isGolden: true,
    status: { evolvePhase: 'PHASE_2', charLevel: 60, skillLevel: 7, favorPoint: 0, equipLevel: 0 },
    upgradeChessId: null, upgradeNum: 0,
    bondIds: [ELEMENT], garrisonIds: ['garrison_179_b'],
  },
};

const elementShopRows = {
  [ELEMENT_MEMBER.a]: {
    chessId: ELEMENT_MEMBER.a, goldenChessId: ELEMENT_MEMBER.b, chessLevel: 4, shopLevelSortId: 27,
    chessType: 'PRESET', charId: 'char_4235_thumpy', tmplId: null, defaultSkillIndex: 1, defaultUniEquipId: null,
    backupCharId: 'char_4235_thumpy', backupTmplId: null, backupCharSkillIndex: 1, backupCharUniEquipId: null,
    backupCharPotRank: 0, isHidden: false,
  },
  // The elite's OWN row. buildChess resolves EVERY record through `chessNormalIdLookupDict[id] || id` and then looks
  // that id up in charShopChessDatas, so a pair whose elite has no row of its own is dropped from the build with
  // 「no charShopChessDatas entry」 — the same shape every official pair carries (and 克莱门莎's, below).
  [ELEMENT_MEMBER.b]: {
    chessId: ELEMENT_MEMBER.b, goldenChessId: ELEMENT_MEMBER.b, chessLevel: 4, shopLevelSortId: 27,
    chessType: 'PRESET', charId: 'char_4235_thumpy', tmplId: null, defaultSkillIndex: 1, defaultUniEquipId: null,
    backupCharId: 'char_4235_thumpy', backupTmplId: null, backupCharSkillIndex: 1, backupCharUniEquipId: null,
    backupCharPotRank: 0, isHidden: false,
  },
};

// ===== 元素 — official chess rows this file EXTENDS ================================================================
//
// The five official shop chess of the design's roster carry 元素 through `chessBonds` (the same UNION the 巴别塔
// members use). 菲莱 / 烛煌 / 妮芙 additionally REPLACE their `garrisonIds` with this file's extended pair — their
// official rows (garrison_43 / 35 / 56) already do everything else, and `chessGarrisons` is the documented
// REPLACE exception (华法琳's cap override opened it). 余 and 塑心 keep their own 特质 untouched: the design only adds
// the bond to them.
//
// 妮芙's HIDDEN T6 form (chess_char_6_10_a/_b, the 精锐-in-险境 form the shop never shows) is the same operator, so it
// takes the bond too — her 特质 pair (garrison_56) is shared with the visible T5 row, so no `chessGarrisons` entry is
// needed for it.
const elementChessBonds = {
  chess_char_3_06_a: [ELEMENT], chess_char_3_06_b: [ELEMENT],     // 菲莱
  chess_char_5_03_a: [ELEMENT], chess_char_5_03_b: [ELEMENT],     // 烛煌
  chess_char_5_22_a: [ELEMENT], chess_char_5_22_b: [ELEMENT],     // 妮芙
  chess_char_6_10_a: [ELEMENT], chess_char_6_10_b: [ELEMENT],     // 妮芙 T6 hidden form (same operator)
  chess_char_6_03_a: [ELEMENT], chess_char_6_03_b: [ELEMENT],     // 余
  chess_char_6_09_a: [ELEMENT], chess_char_6_09_b: [ELEMENT],     // 塑心
  // 克莱门莎 is NOT listed here. She is a FIAT chess of this same module, whose whole row this file owns, so her
  // 元素 membership is stated in the record itself (`clemensa.chess` below, `bondIds`), not unioned onto it: a union
  // could only ADD a bond, and her ruling of 2026-10-12 needs her to LOSE 不屈 (the header's REMOVING note). The
  // member-list side still has her (`elementBond.chessIdList` and `bondChessIds` above).
};

const elementChessGarrisons = {
  chess_char_3_06_a: ['garrison_175_a'], chess_char_3_06_b: ['garrison_175_b'],   // 菲莱
  chess_char_5_03_a: ['garrison_176_a'], chess_char_5_03_b: ['garrison_176_b'],   // 烛煌
  chess_char_5_22_a: ['garrison_177_a'], chess_char_5_22_b: ['garrison_177_b'],   // 妮芙 (T6 hidden form shares the pair)
  chess_char_5_clemnt_a: ['garrison_178_a'], chess_char_5_clemnt_b: ['garrison_178_b'],   // 克莱门莎
};

// ===== mode overlay ==============================================================================================
//
// The official mode tables list exactly the 23 official bonds (13 active + 10 inactive in the two FUNNY modes, 23
// active elsewhere). 巴别塔 and 元素 are appended to `activeBondIds` of EVERY mode (docs/research/15-babel-bond.md
// §6.3 item 5; docs/research/17-element-bond.md §4): the standard simulation must be able to draw them, and no mode
// lists either as inactive. `inactiveBondIds` is never touched — that list is the official 「本局禁用」 set the
// 巴别塔 rider's OPEN-1 counting reads.
const modeBonds = { active: [BABEL, ELEMENT] };

// ===== 克莱门莎 — maintainer fiat content (自选 → 盟约/商店棋) ======================================================
//
// 克莱门莎 (char_4231_clemnt) was a 自选 (DIY) operator; the maintainer turned her into a 盟约 operator — a visible
// T5 shop chess with the official 特质 garrison_161_a/_b — with Codex on 2026-10-12. That decision is FIAT content of
// exactly the same standing as 巴别塔 above: it exists in no build source (the official charChessDataDict has no
// `clemnt`, and data/*.json was produced by a build that carried her as a local patch which has since been reverted),
// so WITHOUT this file every rebuild of data/ silently drops an operator the maintainer deliberately added. Keep these
// three records maintained here for good — do NOT "fix them up": they are the committed records of data/chess.json and
// data/garrisons.json, field for field (bonds order, status, identifier, shopSortId, backup, upgradeNum/upgradeChessId
// included), and the reviewer can diff them against it.
//
// Add-if-absent as everywhere else: if a future official table (or a source update) does list her, the official row
// wins and the build reports a `custom:` warning, so this copy can then be deleted. Until that day it is the only
// thing keeping her in the shop.
//
// `descFlattened` / `bb` / `bbStr` of the garrisons are the committed data/garrisons.json record (its desc/descRaw);
// applyCustom() rebuilds the raw blackboard list the official garrisonDataDict holds — same values, one shape away.
// `owners` is an OUTPUT of the current build (the chess that carry the trait), never an input.
//
// `bondIds` is the EXACT final list, the maintainer's ruling of 2026-10-12: 阿戈尔 / 迅捷 / 元素. It is written here
// and nowhere else — 不屈 is gone (no union table may name her, or it would add it back; see the header's REMOVING
// note) and 元素 is NOT unioned on by `elementChessBonds`. data/chess.json `bonds` copies this array verbatim, so the
// record stays field for field with the dataset as this block promises.
const clemensa = {
  chess: {
    chess_char_5_clemnt_a: {
      chessId: 'chess_char_5_clemnt_a', identifier: 129, isGolden: false,
      status: { evolvePhase: 'PHASE_2', charLevel: 1, skillLevel: 4, favorPoint: 0, equipLevel: 0 },
      upgradeChessId: 'chess_char_5_clemnt_b', upgradeNum: 3,
      bondIds: ['egirShip', 'swiftShip', 'elementShip'], garrisonIds: ['garrison_161_a'],
    },
    chess_char_5_clemnt_b: {
      chessId: 'chess_char_5_clemnt_b', identifier: 262, isGolden: true,
      status: { evolvePhase: 'PHASE_2', charLevel: 60, skillLevel: 7, favorPoint: 0, equipLevel: 0 },
      upgradeChessId: null, upgradeNum: 0,
      bondIds: ['egirShip', 'swiftShip', 'elementShip'], garrisonIds: ['garrison_161_b'],
    },
  },
  // The charShopChessDatas row of her NORMAL id (a build output has no raw shop row; these are the fields buildChess
  // reads plus the shop-only ones the row carries: tier 5, sort 999, 本源近卫, no module, own backup, and the default
  // skill S2 风暴潮 — index 1, maintainer 2026-10-13 — in `defaultSkillIndex` and `backupCharSkillIndex` alike).
  shopRows: {
    chess_char_5_clemnt_a: {
      chessId: 'chess_char_5_clemnt_a', goldenChessId: 'chess_char_5_clemnt_b', chessLevel: 5, shopLevelSortId: 999,
      chessType: 'PRESET', charId: 'char_4231_clemnt', tmplId: null, defaultSkillIndex: 1, defaultUniEquipId: null,
      backupCharId: 'char_4231_clemnt', backupTmplId: null, backupCharSkillIndex: 1, backupCharUniEquipId: null,
      backupCharPotRank: 0, isHidden: false,
    },
  },
  normalLookup: { chess_char_5_clemnt_b: 'chess_char_5_clemnt_a' },
  garrisons: {
    garrison_161_a: {
      garrisonId: 'garrison_161_a',
      desc: '<战斗中>击倒敌人时，使已激活的【阿戈尔】、【迅捷】、【不屈】层数<@ba.vup>+2</>',
      descRaw: '<战斗中>击倒敌人时，使已激活的【阿戈尔】、【迅捷】、【不屈】层数<@ba.vup>+2</>',
      eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', eventTypeIcon: 'icon_bond',
      effectType: 'ADD_BOND', effectKey: 'act1autochess_gar_event_selfkillenemy',
      battleRuneKey: 'env_gbuff_new_with_verify', charLevel: 0,
      bb: { check_cnt: 1, bond_add_count: 2 },
      bbStr: { key: 'act1autochess_gar_event_selfkillenemy', bond_type: 'bond_by_id', bond_id: 'egirShip,swiftShip,indomShip', bond_add_type: 'by_count', garrison_key: 'garrison_161_a' },
    },
    garrison_161_b: {
      garrisonId: 'garrison_161_b',
      desc: '<战斗中>击倒敌人时，使已激活的【阿戈尔】、【迅捷】、【不屈】层数<@ba.vup>+3</>',
      descRaw: '<战斗中>击倒敌人时，使已激活的【阿戈尔】、【迅捷】、【不屈】层数<@ba.vup>+3</>',
      eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加', eventTypeIcon: 'icon_bond',
      effectType: 'ADD_BOND', effectKey: 'act1autochess_gar_event_selfkillenemy',
      battleRuneKey: 'env_gbuff_new_with_verify', charLevel: 0,
      bb: { check_cnt: 1, bond_add_count: 3 },
      bbStr: { key: 'act1autochess_gar_event_selfkillenemy', bond_type: 'bond_by_id', bond_id: 'egirShip,swiftShip,indomShip', bond_add_type: 'by_count', garrison_key: 'garrison_161_b' },
    },
  },
};

export { bond, modeBond, effect, effectBuffs, effects, effectBuffsPledge, garrisons, chess, shopRows, normalLookup, characters, chessBonds, bondChessIds, chessGarrisons, modeBonds, clemensa, items, itemShopRows, itemEffects, itemEffectBuffs, itemTraps, researchItems };
export { elementBond, elementModeBond, elementEffect, elementEffectBuffs, elementGarrisons, elementChess, elementShopRows, elementNormalLookup, elementChessBonds, elementChessGarrisons, garrisonKeep };
