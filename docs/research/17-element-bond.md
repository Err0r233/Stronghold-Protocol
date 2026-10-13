# 17 — 「元素」自研附加盟约 · 设计定稿 v1

**Status: implemented (2026-10-12).** The maintainer fixed this version on 2026-10-12; this file is the single
authority for it. It records a **deliberate deviation from the official mode** (the official `act2autochess` has 23
bonds and none of them is 元素), which `AGENTS.md` leaves to the maintainer alone; the implementation is
`tools/content/custom.mjs` (the data) plus `server/sim/content/bonds/addon/element.js` (the behaviour), and the data
notes live in `docs/DATA.md` §19.4–§19.6.

Unlike 巴别塔 (`docs/research/15-babel-bond.md`), this bond is an **add-on (非核心) alliance**: `isCore` false,
`bondType` `REGULAR`, the same family as 迅捷 / 远见 / 协防干员. It therefore joins each mode's `activeBondIds`
(`modeBonds.active`) and takes part in the per-match 每局随机禁用 draw at weight 10, exactly like an official small
bond.

---

## 1. The bond

| field | value | note |
|---|---|---|
| `bondId` | `elementShip` | matches `server/match/effectsMeta.js`'s `KEY_RE` (`[A-Za-z0-9_\-.:#]`) |
| name | 元素 | |
| category | 附加盟约 (`isPower` false, `bondType` `REGULAR`, `bondOrder` 2) | the 迅捷 / 远见 family |
| `activeCount` / `thresholds` | 2 / `[2, 3]` | 一档 at 2 distinct members, 二档 at 3 |
| `countMode` | `BOARD` | distinct base chess on the board (the hand does not count) |
| `weight` | 10 | the common small-bond value, participates in the ban draw |
| `identifier` | 25 | after the 23 official bonds and 巴别塔's 24; `buildBonds` sorts by it |
| `iconId` | `icon_elementShip` | `public/assets/bond/elementShip.png` (§6) |
| `effectId` | `bondeffect_element` | one `env_gbuff_new` buff carries the whole blackboard |
| layers | 0–999 (`BOND_LAYER_CAP`) | the global cap, as for every bond |

### 1.1 一档 — 2 distinct 【元素】 operators on the board

> **【元素】干员造成的元素损伤提升（受层数影响，150层达到最大增益）**

| item | value |
|---|---|
| main effect | a member's 元素损伤 (the gauge fill) ×`(1 + 0.10 + 0.003·L)`, **L clamped to 150** |
| at 0 / 100 / 150 layers | +10 % / +40 % / **+55 %** (the maximum) |

The slope is data (`element_damage_base` 0.10, `element_damage_per_stack` 0.003, `element_damage_cap_layers` 150); the
cap is applied **inside the formula** (`min(L, 150)`), so 151 or 300 layers give the same +55 %.

### 1.2 二档 — 3 distinct 【元素】 operators: one clause per element burst

All four clauses share the design's **200-layer clamp** (`tier2_cap_layers`), i.e. `L = min(L, 200)`; the per-stack
slopes are derived from the two endpoints the design names (`slope(base, top, cap) = (top − base) / cap`), so the
endpoints are the only numbers typed in the source.

| element | clause | at 0 layers | at 200 layers |
|---|---|---|---|
| 凋亡 `apoptosis` | 本次元素爆发造成的伤害提升至 `1.10 + 0.01075·L`; 目标的**攻击力额外最终降低至 70 %** | 110 % | **325 %** |
| 灼燃 `burn` | 本次元素爆发造成的伤害提升至 `1.95 + 0.01495·L`; 目标的**法术抗性额外 −20** | 195 % | **494 %** |
| 神经 `neural` | 本次元素爆发**直接**造成的伤害提升至 `1.10 + 0.0075·L`; **冷却期间每秒**额外受到 `500 + 4·L` 点无来源的元素持续伤害 | 110 % / 500 | **260 %** / 1300 |
| 侵蚀 `erosion` | 目标的**防御力额外永久 −120**; **冷却期间每 0.03 秒受到一次、共 10 次、每次 `750 + 6·L`** 点无来源的物理持续伤害 | 750 | **1950** |

Every clause is for **enemy targets only** (`target.side === 'enemy'`): the design's text is the operator side bursting
an enemy's gauge. The 「额外」 in three of them is literal — the engine's own burst already applies 灼燃 RES −20, 侵蚀
DEF −120 and 凋亡's 50 % → 0 % attack weaken (`server/sim/constants.js` `ELEMENT`, `server/sim/damage.js`
`resolveBurst`), and this bond adds its own layer on top:

- 凋亡's 「攻击力额外最终降低至 70 %」 is a **second, multiplicative `atkMul` buff** (`bond:elementShip:atkDown`). The
  engine's own weaken lives on the `<el>Burst` lock buff as a `mods.atkMul` the burst recomputes every second; a second
  buff multiplies with it (`server/sim/units.js _recalc` multiplies `m('atkMul')` over every buff), which is what
  「额外最终」 describes.
- 灼燃's RES cut is a separate `resFlat` buff (`bond:elementShip:resDown`) — the final RES is base − 40 for the cooldown.
- 侵蚀's DEF cut is a permanent, **stacking** `defFlat` buff (`bond:elementShip:defDown`): a later burst adds another
  −120, as the design's 「永久」 says.

The burst-damage multiplier reaches the engine's own DamageInfo through the `hit` hook and the filling unit's `credit`
(a burst's damage is `sourceless`, so `hit`'s `source` is null but `credit` keeps the member that filled the gauge —
`server/sim/damage.js` line "无来源 damage credited to `source`").

---

## 2. The roster (7 operators, 8 records)

「分类」 is the garrison data's `eventTypeDesc` (the in-game trait category).

| 阶 | 干员 | charId | chess | other bonds | trait (普通 ｜ 精锐) | 分类 | source |
|---|---|---|---|---|---|---|---|
| 3 | 菲莱 | `char_4148_philae` | `chess_char_3_06_a/_b` | 萨尔贡 | `<战斗中>开启技能时，使已激活的【萨尔贡】层数+6、【元素】层数+3` ｜ **+12 / +6** | 持续叠加 | **EXTENDED** (official `garrison_43_a/_b` + the 元素 clause, same row) |
| 4 | 珊比 | `char_4235_thumpy` | `chess_char_4_27_a/_b` | — | `<获得时>使【元素】层数+6` ｜ **+12** | 单次叠加 | **NEW** (promoted from 自选, §3) |
| 5 | 烛煌 | `char_1040_blaze2` | `chess_char_5_03_a/_b` | 维多利亚、炎 | `<获得时>【炎】【维多利亚】【元素】层数+5（无需激活盟约）` ｜ **+10** | 单次叠加 | **EXTENDED** (official `garrison_35_a/_b`) |
| 5 | 妮芙 | `char_4146_nymph` | `chess_char_5_22_a/_b` (+ hidden `6_10_a/_b`) | 迅捷 | `<休整期结束时>整备区每有1个干员，使已激活的【迅捷】【元素】层数+2` ｜ **+4** | 持续叠加 | **EXTENDED** (official `garrison_56_a/_b`) |
| 5 | 克莱门莎 | `char_4231_clemnt` | `chess_char_5_clemnt_a/_b` | 阿戈尔、迅捷、**元素** | `<战斗中>每击倒3名敌人，使已激活的【阿戈尔】【迅捷】【元素】层数+2（每场战斗至多+14）` ｜ **+4（至多+28）** | 持续叠加 | **REPLACED** (§5) |
| 6 | 余 | `char_2026_yu` | `chess_char_6_03_a/_b` | 炎、坚守 | 特质不变 (official `garrison_37_a/_b`) | 整备能力 | **bonds only** |
| 6 | 塑心 | `char_245_cello` | `chess_char_6_09_a/_b` | 拉特兰 | 特质不变 (official `garrison_90_a/_b`) | 持续叠加 | **bonds only** |

The trait ids continue this project's own sequence: 巴别塔 holds `garrison_162…174`, 克莱门莎 `garrison_161`, so the
new rows are `garrison_175` … `garrison_179` (one pair each for 菲莱 / 烛煌 / 妮芙 / 克莱门莎 / 珊比).

**Why the existing rows were extended rather than duplicated.** `bbStr.bond_id` and `bbStr.bond` are comma-separated
lists (`server/sim/content/garrisons/battle.js` `targetBonds()` splits them), so one official-shaped row can carry the
元素 clause next to the official one — one handler, one detail-card block, no double-counting. 巴别塔's 阿米娅·医疗
precedent (one row for a trait that would otherwise need two) is the same idea.

**余 and 塑心 are 「特质不变」**: their `garrisonIds` still name their official rows (`garrison_37_a/_b`,
`garrison_90_a/_b`) and those rows are still in `data/garrisons.json` with owners; only `bonds` gained `elementShip`.

**妮芙's hidden T6 form** (`chess_char_6_10_a/_b`, the 精锐-in-险境 form the shop never shows) is the same operator, so
it takes the bond too and keeps the shared `garrison_56_a/_b` pair.

**Default skill (maintainer, 2026-10-13).** Two of the seven carry a new default skill on **both** records of their pair
(`defaultSkillIndex` and `backupCharSkillIndex`, which must agree): 珊比 `chess_char_4_27_a/_b` → **S2 「慢慢走~」**
(index 1) and 克莱门莎 `chess_char_5_clemnt_a/_b` → **S2 「风暴潮」** (index 1). Their shop rows are this module's own
(`custom.mjs` `elementShopRows` / `clemensa.shopRows`), so the index is stated there — no official row is overridden and
no exception mechanism is involved. The other five members keep S1 (they are not in that batch; 妮芙's hidden T6 form is
not named by it either). The whole 12-operator batch, including the three official chess, is tabulated in
`docs/DATA.md` §19.8.

---

## 3. 珊比's promotion (自选 6★ → visible T4 shop chess)

珊比 (`char_4235_thumpy`) was a 自选 owned-6★ pick (`data/backups.json diy.ownedPool` carried her and her kit fought at
the tier-5 / tier-6 DIY slots). The maintainer promotes her to a regular T4 shop chess of the 元素 bond, exactly as
OPEN-4 promoted 阿斯卡纶 / 可露希尔 / 赫德雷 / 逻各斯 / 维什戴尔 into 巴别塔
(`docs/research/15-babel-bond.md` §6.3 item 1).

| record | value |
|---|---|
| chess | `chess_char_4_27_a` (普, `identifier` 309) / `chess_char_4_27_b` (精锐, 310), both `chessType PRESET`, `bonds: ['elementShip']`, `garrisonIds` `garrison_179_a/_b`, `status` E2 Lv1 rank 4 / E2 Lv60 rank 7, `upgradeNum` 3, `module` **null** |
| shop row | two rows (one per record — `buildChess` resolves every id through `chessNormalIdLookupDict` and then looks the result up in `charShopChessDatas`), tier 4, `shopLevelSortId` 27, `defaultSkillIndex` 0, no module, own backup |
| normal lookup | `chess_char_4_27_b → chess_char_4_27_a` (the official `chessNormalIdLookupDict` shape; without it the elite's `baseId` names itself and `test/data.test.js`'s golden-pair invariant fails) |
| kit | unchanged, the single implementation in `server/sim/content/kits/ops/op-thumpy.js`; the chess id is served by the shim `kits/ops/chess_char_4_27-thumpy.js` (the 克莱门莎 / 巴别塔 pattern), and the file left `OPERATOR_KIT_FILES` |
| assets | `tools/assets/extra-operators.json` lists her — once she leaves `diy.ownedPool` nothing else names her, so without that record a manifest rebuild drops her avatar, portrait, both Spines, her skill icons, her SFX and her whole voice set (`docs/ASSETS.md`, third source) |

Consequences: `diy.ownedPool` 66 → 65 and `backups.units` 83 → 82 (automatic through `buildBackups`' `roster` rule —
her charId is a shop row now); `chess` 284 → 286, visible non-DIY 121 → 122 (the tier histogram becomes
18/18/21/23/22/20). Her three skills now go through the **chess** route, which changes their auto-cast trigger from the
自选 layer's owner-exception `DEFAULT` to the 重装 (TANK) class row `TAKE_DAMAGE` (`tools/build-data.mjs`
`TRIGGER_DEVIATIONS` lists only 深巡 / 雷蛇 / 灰毫 / 号角 / 余) — S1 受击回复, S2 / S3 `ACTIVE_RANGE` on their own
larger ranges. `test/content/op_thumpy.test.js` was migrated to the chess route and asserts the new rule.

---

## 4. Mode whitelist

| mode | 元素 in `activeBondIds` | in `inactiveBondIds` |
|---|---|---|
| `mode_training_1` | yes | no |
| `mode_single_funny` | yes | no |
| `mode_single_normal` / `_hard` / `_abyss` | yes | no |
| `mode_multi_funny` | yes | no |
| `mode_multi_normal` / `_hard` / `_abyss` | yes | no |

`buildConfig`'s `extraActiveBonds` (the module's `modeBonds.active`) appends it to **every** mode, the 巴别塔 rule
(`docs/research/15-babel-bond.md` §6.3 item 5). `inactiveBondIds` is never touched — that list is the official
「本局禁用」 set the 巴别塔 rider's OPEN-1 counting reads. The ban draw sees one more weight-10 add-on candidate, which
moves `test/golden/matches.json`, the bot's focus-bond choice and the seeded scenario records; that is intended. It also
means 元素 itself can be **drawn** as a per-match ban (it is an ordinary weight-10 add-on bond, `pool.js
drawDisabledBonds`), and when it is, 珊比's chess is banned for that match like any other single-bond shop chess.

---

## 5. Implementation notes, deviations and `[ASSUMED]`

1. **`[ASSUMED]` — the per-battle cap's unit (克莱门莎).** `S.gainLayers` caps per `(garrison instance, BOND)`
   (`server/sim/content/support/index.js`, `ck = ${capKey}|${b}`), so the design's 「每场战斗最多 +14」 read as a value
   on `max_add_count_per_battle` gives each of her three bonds its own 14 (42 across the three). A single cap over the
   row's total would need a new cap mode in that shared primitive — a pull request of its own — and is **not**
   introduced here. The data carries the design's number; the maintainer may rule on the unit.
2. **`[ASSUMED]` — 克莱门莎's trait was REPLACED, not extended.** Her committed pair `garrison_161_a/_b` read
   `<战斗中>击倒敌人时，使已激活的【阿戈尔】【迅捷】【不屈】层数+2 / +3` — the official
   `act1autochess_gar_event_selfkillenemy` row with `check_cnt` 1, i.e. **every** kill and **no cap**. The maintainer's
   version adds a rhythm and a cap (`check_cnt` 3, `max_add_count_per_battle` 14 / 28). The old pair stays declared
   (`clemensa.garrisons`) and stays in `data/garrisons.json` through `garrisonKeep`, with no owners (the new pair is
   forced by the `clemensa.design` override, §5 item 10). **Follow-up
   (maintainer, 2026-10-12):** its TARGET LIST converged on her new bond list — `bbStr.bond_id` and the text now read
   【阿戈尔】【迅捷】【元素】, so the trait no longer adds layers to 不屈 (§5 item 9).
3. **`[ASSUMED]` — 侵蚀's 0.03 s dispatch.** The design asks for a hit every 0.03 s while the simulation's tick is
   `TICK = 1/30 s` (0.03 s is 0.9 of a tick), so a literal per-tick dispatch cannot express it. The module dispatches
   `erosion_dot_hits` independent `battle.after(n · erosion_dot_interval)` callbacks (n = 1…10): ten distinct 无来源
   damage instances over the 0.3 s window, the last around 0.30 s of game time. `test/content/element_bond.test.js`
   asserts exactly ten hits and their amounts and span.
4. **The 「已激活」 flag of the EXTENDED rows (was `[ASSUMED]`, settled 2026-10-12).** `server/sim/content/garrisons/
   meta.js` `requireActiveOf()` derives the gain's `requireActive` from the row's TEXT, one flag for all of a row's
   bonds, and `BOND_REQUIRE_OVERRIDE` lists the per-row, per-bond exceptions. Only ONE is load-bearing: 菲莱's row
   reads 「使已激活的【萨尔贡】…【元素】…」 for both, but 元素 needs two distinct members on the board to be active and
   she is usually the only one there, so a text-derived `true` would make the 元素 half a silent no-op (萨尔贡 `true`,
   元素 `false`). 烛煌's three and 珊比's one are text-equivalent (their rows say 「无需激活盟约」) and stay as the
   explicit record of the intended path. **妮芙's entry is gone:** the maintainer's ruling of 2026-10-12 makes her 元素
   clause require an ACTIVE bond, exactly as her text 「使已激活的【迅捷】【元素】」 says — the text and the effect now
   agree, and `requireActiveForBond` falls through to `requireActiveOf` (`true` for both bonds).
5. **`[ASSUMED]` — the 元素 membership list.** Membership is explicit (`bond.chessIdList` +
   `elementChessBonds`), never derived from a `powerIdList`: the official 本源 branches
   (`primprotector` / `primguard` / `primcaster`) are sub-professions, not factions, and 珊比's official `powers` is
   `['rim']` while the design's roster is the seven operators above. `elementModeBond.powerIdList` is `[]`.
6. **A new build mechanism: `garrisonKeep`.** `buildGarrisons()` emits a row only while some chess names it, so
   replacing a `garrisonIds` entry silently dropped the official row from `data/garrisons.json`. The module now lists
   the ids that must survive (`garrison_35_a/_b`, `garrison_43_a/_b`, `garrison_161_a/_b`) and the builder reads them
   directly. They come out as orphans (`owners: []`), the shape the dataset already carries (29 / 95 / 96 / 108 /
   117_b / 174). 妮芙's `garrison_56` needs no entry: her hidden T6 form still names it.
7. **Where the numbers live.** Every value the simulation reads is a key of the bond's own `env_gbuff_new` blackboard
   (`data/bonds.json` `elementShip.bb`); `server/sim/content/bonds/addon/element.js` hardcodes nothing but the two
   engine cooldown lengths, which it reads from `server/sim/constants.js` `ELEMENT` instead of restating them. A retune
   is a `tools/content/custom.mjs` edit plus a rebuild.
8. **The icon's source is not a GitHub dump.** `public/assets/bond/elementShip.png` comes from PRTS's
   `media.prts.wiki` (the 本源术师 branch icon) — the second use of that host (`char_1037_amiya3`'s voice was the
   first), recorded in `docs/research/07-assets.json` and `docs/ASSETS.md`.
9. **克莱门莎's bond list and trait target list (maintainer, 2026-10-12).** She is 阿戈尔 / 迅捷 / **元素**: 不屈
   (`indomShip`) is **removed**, and the same three bonds are her trait's targets. Both halves are data:
   - her records (`tools/content/custom.mjs` `clemensa.chess`) state the **exact final `bondIds`**
     `['egirShip', 'swiftShip', 'elementShip']`, and the `clemensa.design` override enforces the same list on whichever
     row is in `charChessDataDict` (§5 item 10) — the module header's REMOVING rule, because the union tables
     (`chessBonds` / `elementChessBonds`) can only ADD a bond. `elementChessBonds` therefore no longer names her, and
     `bondChessIds.indomShip` no longer carries her two records;
   - `garrison_178_a/_b`'s `bbStr.bond_id` is `egirShip,swiftShip,elementShip` and their text reads
     【阿戈尔】【迅捷】【元素】+2 / +4 (每击倒 3 名, 每场战斗至多 +14 / +28, still per (instance, bond)) — she no
     longer adds layers to a bond she has left.
   Member tables after the ruling: `elementShip` 8 `members` / 7 `visibleMembers` (unchanged — she was listed there
   from the start) and `indomShip` 11 / 9 → **10 / 8** (the two removed ids are one operator, and `members` carries
   the NORMAL id of each pair). `docs/DATA.md` §19.5 and `docs/history/0.2.4.md` §29.21/§29.23 carry the same record.
10. **克莱门莎 is an EXPLICIT OVERRIDE of the official mode (maintainer 裁决 (a), 2026-10-13).** The official client data
    ships her **character** (`character_table.char_4231_clemnt`, official `appellation` "Clementia") and her 盟约策略
    (`band_clementia`), but — checked against `origin/master` 0.2.5 on 2026-10-13 — **no chess at all**: no
    `charChessDataDict` / `charShopChessDatas` / `chessNormalIdLookupDict` / `garrisonDataDict` row of hers under any id
    (official `data/chess.json` has 266 records against this dataset's 286). Until a source update ships one, this
    project's fiat row is the only thing that puts her in the shop.
    Because that update could arrive at any time and the rulings above must hold if it does, `custom.mjs` states her four
    ruled fields a second time as `clemensa.design` and `tools/build-data.mjs` `applyClemensaDesign` forces them onto
    whichever row the two chess tables hold — **after** every other custom merge, so neither the `chessBonds` unions nor
    the `chessGarrisons` / `elementChessGarrisons` REPLACE tables can undo it. The four fields are `bondIds` (item 9),
    `garrisonIds` (`garrison_178_a/_b`, item 2), `defaultSkillIndex` and `backupCharSkillIndex` (both 1 — S2 风暴潮,
    `docs/DATA.md` §19.8/§19.9). Everything else about her row (identifier, status, tier, `shopSortId`, upgrade pair,
    hidden flag, backup charId) stays inheritance: only the ruled fields are forced, which is why this is an override and
    not a row replacement.
    This is 克莱门莎's second deliberate deviation from the official mode: her `appellation` has been fiat since
    2026-10-12 (`custom.mjs characters` → "Clemensa"; the build's
    `custom: character char_4231_clemnt is in the official data; the custom values replaced appellation="Clemensa"` line
    is that correction and is **expected**). `AGENTS.md` 「Deliberate deviations from the official mode are the
    maintainer's decision only」 is the standing authority; `docs/DATA.md` §19.9 is the reference.

---

## 6. Assets

| item | value |
|---|---|
| file | `public/assets/bond/elementShip.png` — 104×104, 8 825 B, 8-bit RGBA |
| source | `https://media.prts.wiki/1/18/职业分支图标_本源术师.png` (54×54, already a white glyph on transparency) |
| processing | `tools/build-element-bond-icon.py` (Pillow): white → transparent if the source is opaque, alpha crop, long side → 104 px (the 24 shipped bond icons measure 96–110, median 102; 巴别塔 is 104×90) |
| manifest | `docs/research/07-assets.json` `bonds.elementShip` (`iconId` `icon_elementShip`, `fallbackCampLogo: null`); `tools/fetch-assets.mjs --asset-source=mirror --add-only` reports `bonds 25` and loses no key |
| operator | `tools/assets/extra-operators.json` `char_4235_thumpy` (see §3) |

## 7. Tests

`test/content/element_bond.test.js` (12 cases): the 一档 multiplier and its 150-layer clamp, the live-layer read, the
four 二档 clauses with their 200-layer clamps and their negative controls (inactive bond, non-member, tier 1), and the
data guard (the bond row, the seven members' `bonds` / `garrisonIds` / trait text — 克莱门莎's exact three-bond list and
her member-list mirror included — the mode whitelist, 珊比's promotion, her asset record and the manifest).
`test/content/op_thumpy.test.js` was migrated to the chess route; `test/content/garrisons_battle.test.js` and
`test/content/garrisons_meta.test.js` cover the trait rows (`garrison_175` … `garrison_179` and the kept orphans)
through their existing per-effect-key sweeps, and the 妮芙 case additionally asserts that **both** her bonds (迅捷 and
元素) gain nothing while inactive.

## 8. Change log

| version | date | content |
|---|---|---|
| v1 | 2026-10-12 | First version: the bond, the four 二档 clauses, the seven members and their traits, 珊比's promotion, the mode whitelist, the icon, the `[ASSUMED]` list. |
| v1.1 | 2026-10-12 | Maintainer's two rulings (§5 item 9, §2): 克莱门莎's bonds and trait targets become 阿戈尔 / 迅捷 / 元素 (不屈 removed, exact `bondIds` on the fiat record), and 妮芙's 元素 clause requires an activated bond like 迅捷 (her `BOND_REQUIRE_OVERRIDE` entry removed, §5 item 4). |
| v1.2 | 2026-10-13 | Maintainer's default-skill batch (§2): 珊比 → S2 「慢慢走~」 and 克莱门莎 → S2 「风暴潮」, on both records of each pair (`defaultSkillIndex` = `backupCharSkillIndex`). Both rows are this module's own, so no official row is overridden; the other five members keep S1. |
| v1.3 | 2026-10-13 | Maintainer 裁决 (a) (§5 item 10): 克莱门莎 becomes an EXPLICIT OVERRIDE of the official mode. The official 0.2.5 data ships her character and her 盟约策略 but no chess row, so `clemensa.design` + `applyClemensaDesign` force her four ruled fields (`bondIds`, `garrisonIds`, both skill indices) onto whichever row the chess tables hold, after every other merge; her `appellation= 'Clemensa'` fiat correction stays. Her ids are dropped from `elementChessGarrisons` so the design block is the single statement of the pair. |
