# 16 · The fixed "+20 %" 特质 row: `garrison_03` is a MULTIPLIER, not a fraction — investigation, no fix applied

Written 2026-10-12 as research. **No engine, data or test file was changed for it.** It settles a question raised
while the 自研 巴别塔 layer moved 维什戴尔's fixed half from an official `garrison_03`-family row into an `attrByBond`
`base_*` key: whether the OFFICIAL carriers of that family get the +20 % their text promises, or a `atkPct`
`1.2` = +120 % the number would mean in the neighbouring reader.

**Tags** (as in research 11)
- **[DATA]**: read from `data/*.json` (the generated official tables).
- **[CODE]**: the engine's own read path, with file and line.
- **[MEASURED]**: a one-off probe on the production content path (real `data/chess.json` records, `content: 'full'`,
  all bonds inactive and 0 layers unless stated), deleted afterwards.

---

## 0. TL;DR

| # | Question | Answer | Tag |
|---|---|---|---|
| 1 | Do the official `garrison_03` carriers get +20 % or +120 %? | **+20 %.** `bb { atk: 1.2, max_hp: 1.2 }` reaches the engine as `{ atkMul: 1.2, hpMul: 1.2 }` and multiplies the base attributes: measured **+20.000 % ATK and max HP** on every normal carrier and **+40.000 %** on every elite. The text and the number agree. | MEASURED + CODE |
| 2 | Is any OFFICIAL row read as a fraction with a multiplier-scale number? | **No.** Scanning `garrisons` / `items` / `bonds` / `effects` / `choices` for `|atk|`, `|def|`, `|max_hp|` ≥ 1 finds only families whose reader is a multiplier or a flat term (§1, §5). | DATA |
| 3 | Then where did the reported `atkPct = 1.2` come from? | From a 1.2 written into the **fraction** reader (`attrByBond` / `attr_common_global_buff`), whose values are `base_atk` + `atk × steps` **fractions**. Re-keying `garrison_03_a`'s blackboard to `attrByBond` reproduces the report exactly: **`atkPct 1.2` → +120.000 %** at one step, +360 % at three. The number `1.2` means different things in the two families — `0.2` is the fraction twin. | MEASURED |
| 4 | Does the official per-layer row (`garrison_09`, `divide_num 3, atk 0.01`) read correctly? | **Yes.** It is an `attrByBond` row and gives `atkPct 0.03` at 9 炎 layers (+1 % per 3 layers) → **+23.600 %** total with the fixed ×1.2 on top (elite: `0.06` → +48.400 %). | MEASURED |
| 5 | Is it a bug? | **Not for official content — nothing to fix there.** The one live follow-up is a semantic divergence between the OFFICIAL two-row arrangement (fixed half = multiplier) and the maintainer's fiat one-row fix (`base_atk`, additive): they agree exactly at 0 layers and the official form gives up to **+33 % more ATK at high layers** (§4.3, §6). | MEASURED |

---

## 1. The family: every official row at issue

`data/garrisons.json` rows whose `effectKey` is `GAIN_BUFF` (⇒ `server/sim/content/garrisons/battle.js` `INSTALLERS.GAIN_BUFF`,
`atkMul` / `hpMul` / `defMul`) and whose numbers are multipliers:

| `garrisonId` | `bb` | `desc` | normal / elite holder (`data/chess.json`) |
|---|---|---|---|
| `garrison_03_a` | `{ atk: 1.2, max_hp: 1.2 }` | 攻击力和生命值+20% | `chess_char_1_15_a` 盟约·辅助干员 (T1) · `chess_char_2_05_a` 哈洛德 (T2) · `chess_char_2_19_a` 锡人 (T2) · `chess_char_6_12_a` 迷迭香 (T6) |
| `garrison_03_b` | `{ atk: 1.4, max_hp: 1.4 }` | 攻击力和生命值+40% | the four `_b` ids of the same operators |
| `garrison_137_a` | `{ atk: 1.25, max_hp: 1.25 }` | `<战斗中>攻击力和生命值+25%，造成的伤害变为弱点伤害…` | `chess_char_3_17_a` 流星 (T3, with `garrison_01_a` 弱点伤害) |
| `garrison_137_b` | `{ atk: 1.5, max_hp: 1.5 }` | 同上的 +50 % | `chess_char_3_17_b` |

`battleRuneKey` is `char_attribute_mul` on all four, and `bbStr` is empty — the whole sentence is the blackboard.

The per-layer halves that ride along on the same operators never carry the fixed half themselves:
`garrison_09_a/_b` (迷迭香, 哈洛德; the 8 核心盟约, `divide_num 3`, `atk`/`max_hp` 0.01 / 0.02) and
`garrison_151_a/_b` (锡人; 投资人+迅捷, `divide_num 3`, 0.01 / 0.02) both repeat the `+20 % / +40 %` sentence in their
`desc` while their `bb` holds only the per-step fractions — the fixed half is `garrison_03`, on the same chess.

Two neighbours in the same table that are NOT this family (they carry multiplier-scale numbers under other readers, and
both are correct):

| Row | `bb` | Reader | Meaning |
|---|---|---|---|
| `garrison_18_a/_b` 深巡, `garrison_19_a/_b` 跃跃 | `{ atk: 1.5 }` / `{ atk: 2 }` | `act1autochess_gar_eff_attack_enemy` (`battle.js:667-679`): `dmg.amount *= bb.atk` | "攻击海怪 / 无人机敌人时攻击力**提升至**150 % / 200 %" — a hit multiplier |
| `garrison_115_a/_b` 玛恩纳 | `{ atk: 10, max_hp: 50 }` | `act2autochess_gar_eff_attrByBond_add_onstart` (`battle.js:603-608`): `atkFlat` / `hpFlat` | 基础攻击力/生命值 **+10 / +50** — a flat term |

The family-wide scan also crosses `chess_item_6_10_e_a` 骑士戒律 (`{ atk: 1 }` under
`act2autochess_equip_acarm119_global_buff`, text 攻击力**+100 %** — here `1` IS a fraction), `yanShip`'s
`bb.atk: 1.5` (炎佑 攻击力**提升至**1.5 倍, `bonds.addon`) and `enemy_attribute_mul` — i.e. the `1.x` convention is
**per family**, and the text is the only thing that tells them apart. None of them sits in a fraction reader by mistake.

---

## 2. The engine's read path

| Where | What it does |
|---|---|
| `data/garrisons.json` (`garrison_03_a`: `effectType` `GAIN_BUFF`, `effectKey` `GAIN_BUFF`, `battleRuneKey` `char_attribute_mul`, `bb { atk: 1.2, max_hp: 1.2 }`) | the official row, unchanged |
| `server/sim/content/garrisons/battle.js:86` | `it.key = g.effectKey` — **the key is `effectKey` (else `effectType`, `data/garrisons.json` writes both as `GAIN_BUFF`), never the `battleRuneKey`** |
| `server/sim/content/garrisons/battle.js:112-121` | dispatch: the instances are grouped by that key and the matching `INSTALLERS` entry runs once per key |
| `server/sim/content/garrisons/battle.js:494-502` | `GAIN_BUFF`: `S.num(it.bb.atk, 0) > 0` ⇒ `mods.atkMul = 1.2`; `max_hp` ⇒ `mods.hpMul`; `def` ⇒ `mods.defMul`. **`atkMul` — a multiplier, exactly as the number is written** |
| `server/sim/content/support/index.js:298-300` | `passiveBuff()` → `battle.addBuff(u, { key: 'gar:garrison_03_a', mods, persist, refresh: 'replace' })` |
| `server/sim/units.js:140,143` | `_recalc`: `maxHp = … × m('hpMul') × cm.hp`, `atk = ((base + Σflat) × (1 + ΣatkPct) + ΣatkFinal) × m('atkMul') × cm.atk` — the multiplier sits **outside** the additive percentage bucket ⇒ `×1.2` = the text's **+20 %** on the base panel |
| `server/sim/content/garrisons/battle.js:551-567` (`attrMods`) | the OTHER family: `base_atk + bb.atk × k` etc., fed to `S.directMods` |
| `server/sim/content/support/index.js:284-295` (`directMods`) | `put('atkPct','atkMul', atk)` — with `DIRECT_BONUS_STACKING` `'add'` (**`server/sim/constants.js:248`**) it writes **`atkPct`**, i.e. the value is a FRACTION (+0.2 = +20 %). `atk: 1.2` here would be **+120 %** |
| `server/sim/content/garrisons/battle.js:570-573, 583-586` | `attrByBond` applies that row from step 0 only when it has a `base_*` key, else only when `k > 0` |

The two families are documented as such in `docs/DATA.md` §4 (lines 319-331) and `server/sim/constants.js:245-246`
("the `char_attribute_mul` 特质 … stay multipliers"), and the code comment in `battle.js:43-48` says the same.

---

## 3. Measurements (production content path)

One battle per case on the flat stage with the REAL `data/chess.json` record; the baseline is the same record with the
garrison ids stripped, so the difference is the 特质 alone. Bonds: none active, layers 0 (⇒ every 盟约 including
巴别塔 off).

| Chess | `garrisonIds` | baseline ATK / maxHP | measured ATK / maxHP | actual | `desc` |
|---|---|---|---|---|---|
| `chess_char_6_12_a` 迷迭香 | `garrison_09_a, garrison_03_a` | 616 / 1477 | 739.2 / 1772.4 | **+20.000 %** | +20 % |
| `chess_char_6_12_b` 迷迭香 精锐 | `garrison_09_b, garrison_03_b` | 760 / 2062 | 1064 / 2886.8 | **+40.000 %** | +40 % |
| `chess_char_2_19_a` 锡人 | `garrison_151_a, garrison_03_a` | 366 / 851 | 439.2 / 1021.2 | **+20.000 %** | +20 % |
| `chess_char_2_19_b` 锡人 精锐 | `garrison_151_b, garrison_03_b` | 461 / 1120 | 645.4 / 1568 | **+40.000 %** | +40 % |
| `chess_char_2_05_a` 哈洛德 | `garrison_09_a, garrison_03_a` | 295 / 1176 | 354 / 1411.2 | **+20.000 %** | +20 % |
| `chess_char_2_05_b` 哈洛德 精锐 | `garrison_09_b, garrison_03_b` | 381 / 1408 | 533.4 / 1971.2 | **+40.000 %** | +40 % |
| `chess_char_1_15_a` 盟约·辅助干员 | `garrison_03_a` | 347 / 836 | 416.4 / 1003.2 | **+20.000 %** | +20 % |
| `chess_char_1_15_b` 盟约·辅助干员 精锐 | `garrison_03_b` | 429 / 1117 | 600.6 / 1563.8 | **+40.000 %** | +40 % |
| `chess_char_3_17_a` 流星 | `garrison_137_a, garrison_01_a` | 404 / 1123 | 505 / 1403.75 | **+25.000 %** | +25 % |
| `chess_char_3_17_b` 流星 精锐 | `garrison_137_b, garrison_01_b` | 498 / 1434 | 747 / 2151 | **+50.000 %** | +50 % |

The buff recorded on the unit is `gar:garrison_03_a { atkMul: 1.2, hpMul: 1.2 }` — never `atkPct`.

**The per-layer row is right too.** 迷迭香 普通 with 炎 at 9 layers (⇒ `floor(9/3) = 3` steps): the unit carries
`gar:garrison_03_a { atkMul: 1.2 }` **and** `gar:garrison_09_a { atkPct: 0.03 }` → ATK 761.376 against the 616 baseline
= **+23.600 %** (i.e. `616 × 1.03 × 1.2`). Elite: `atkPct 0.06` → 1127.84 / 760 = **+48.400 %**. 锡人 with 投资人 9
layers: `atkPct 0.03` → +23.600 % (+48.400 % elite) — `divide_num 3, atk 0.01 / 0.02` read as fractions, exactly as
`docs/DATA.md` §4 says.

**The reported `atkPct = 1.2` reproduced.** Taking `garrison_03_a`'s own blackboard (`atk 1.2`, `max_hp 1.2`) and
re-keying that row to `effectKey: act1autochess_gar_eff_attrByBond` (an `attrByBond` row, 投资人 layers) on 锡人:

| steps | buff | ATK vs 366 baseline |
|---|---|---|
| 0 | *(no `base_*` ⇒ no buff at all, `battle.js:583-586`)* | +0.000 % |
| 1 | `{ atkPct: 1.2, hpPct: 1.2 }` | **+120.000 %** |
| 3 | `{ atkPct: 3.6, hpPct: 3.6 }` | **+360.000 %** |

That is the whole of the "+120 %, and it grows with the layers" observation: the same digits in the fraction family,
where `1.2` means +120 % instead of ×1.2 (and where `× steps` makes it worse). **No official row does this** (§1).

**The repo already locks the correct reading**: `test/content/garrisons_battle.test.js:570-590`
("GAIN_BUFF … direct multipliers") asserts `garrison_03_a` ⇒ ATK `500 × 1.2 = 600`, `garrison_03_b` ⇒ maxHP `2800`,
`garrison_137_a` ⇒ `625`, `garrison_137_b` ⇒ `3000`; lines 592-644 do the same for the 26 `attrByBond` ids as
fractions. All 28 tests of that file pass unchanged on this tree (run in-process; the `node --test` runner's child
spawn is blocked in this sandbox).

---

## 4. Why the multiplier reading is the right one

1. **[DATA] The rune key says so.** `battleRuneKey: "char_attribute_mul"` — *mul(tiply)*. The siblings of the family in
   `data/effects.json` use the very same key with values that cannot be fractions: `aceffect_char_1…4` (练度)
   `{ atk: 1 }`, `{ atk: 1.05, def: 1.05 }`, `{ atk: 1.1, def: 1.05, max_hp: 1.05 }`, `{ atk: 1.1, def: 1.1, max_hp: 1.1 }`
   with the descs 无相关加成 / 攻击力和防御力+5 % / +10 %. Read as fractions those would be +105 % / +110 %; read as
   multipliers they are the documented +5 % / +10 % (`docs/DATA.md` §7, `shared/potential.js cultivateMul`,
   `server/sim/units.js:109-111`).
2. **[DATA] The text matches the measurement to the digit**: "+20 %" ⇒ ×1.2 ⇒ +20.000 % on the panel with nothing else
   in the bucket (§3). A `atkPct` reading would have to be written `0.2`, as the maintainer's own `base_atk: 0.2` is.
3. **[CODE] It is the documented design**, not an accident: `server/sim/constants.js:236-248` splits the systems
   ("盟约, 策略, 装备 … 直接乘算" stay in the additive bucket) from `char_attribute_mul` ("a rune on the base
   attributes"), and `docs/DATA.md` §4 spells out the same split for these rows.
4. **[CODE] The other view of the same table agrees**: where a row really means "提升至 X %", the number is also a
   multiplier and reaches a different reader (`garrison_18/19`'s hit multiplier, §1).

---

## 5. Blast radius (for the record, if anyone proposes changing it)

`test/golden/` **does** field these operators, so their numbers encode the ×1.2 / ×1.4 reading:

| Golden file | Scenarios fielding the family's carriers |
|---|---|
| `test/golden/bonds.json` | 投资人 low / high — `chess_char_2_19_a` / `_b` (锡人, whose `garrison_151` reads 投资人); 谢拉格, 维多利亚 — `chess_char_2_05_a` / `_b`; 助力, 卡西米尔, 调和 — `chess_char_3_17_a` / `_b` |
| `test/golden/fields.json` | 假想敌：胄 / 管, 卢西恩·猩红血钻, 萨米的意志, 假想敌：铳 — `chess_char_6_12_b` (迷迭香 精锐) |
| `test/golden/roster.json` | band 2 / 3 / 4 / 6 / 7 passes — 迷迭香, 锡人, 哈洛德, 流星, normal and elite |
| `test/golden/standins.json` | `chess_char_6_12_a` / `_b` as stand-ins |

(The high-layer cases are the sensitive ones: `投资人 high` runs 999 layers, i.e. `atkPct 6.66` for 锡人 精锐's
`garrison_151_b` in the same unit as the ×1.4.) No golden file has to move for the *official* reading — it is already
the one recorded.

---

## 6. Open item and options

**Nothing to fix for official content.** The remaining question is a *content-semantics* one, raised by the fiat
巴别塔 layer, and it is the maintainer's call:

The official way to spell 「攻击力和生命值+20 %；【X】每叠加3层…+1 %」 is **two rows**: `garrison_03` (fixed +20 % as a
**multiplier**, `atkMul`) + `garrison_09` / `garrison_151` (per-layer **fractions** in the additive bucket). The fiat
one-row form the maintainer adopted for 维什戴尔 (`garrison_170_a/_b`: `base_atk 0.2` / `0.4` + `atk 0.01` / `0.02`,
`tools/content/custom.mjs:318-329`) puts **both halves in the additive bucket**.

Both were measured on `chess_char_1_15_a` (盟约·辅助干员, whose only 特质 is the fixed row) and on 锡人 精锐
(`garrison_151_b` + the fixed row, 投资人 layers), each arm carrying the same garrison profile and the same bonds:

| Arm | official form (`garrison_03_a` + `garrison_151_b`) | fiat form (`garrison_170_a` + `garrison_151_b`) |
|---|---|---|
| `chess_char_1_15_a`, 0 layers, nothing else in the bucket | ATK 416.4 = **+20.000 %** of the 347 baseline | ATK 416.4 = **+20.000 %** — identical |
| `chess_char_1_15_a` + one more +100 % 直接乘算 source | ATK 832.8 = `347 × 2 × 1.2` = **+20.000 %** of the 694 baseline | ATK 763.4 = `347 × (2 + 0.2)` = **+10.000 %** of the 694 baseline — the official arm is **×1.0909** |
| 锡人 精锐, 投资人 999 layers (`garrison_151_b` `atkPct` 6.66 = +666 %) | ATK 4943.76 = **+972.40 %** of the 461 baseline | ATK 3715.66 = **+706.00 %** — the official arm is **×1.3305** |
| 锡人 普通, 投资人 999 layers (`atkPct` 3.33 = +333 %) | ATK 1901.74 = **+419.60 %** of the 366 baseline | ATK 1657.98 = **+353.00 %** — **×1.1470** |

So the two spellings agree exactly at 0 layers and diverge as the additive bucket grows: the official (multiplier)
form keeps the fixed +20 % *of the base* and the fiat form lets the +20 % be diluted by — and never multiply — the
other 直接乘算 sources. This is the mechanism behind "the two-row form gives more than expected at high layers"; it is
a property of the OFFICIAL data, not a misread.

Options:

- **(A) Change the engine so `garrison_03`'s `1.2` is a `atkPct` (+120 % → or a `0.2`-style fraction).** Rejected on
  the evidence: it contradicts the rune key, the 练度 table that shares it, `docs/DATA.md`, the code comments and the
  text of all four rows; it would also move `test/golden/bonds.json` (投资人 / 谢拉格 / 维多利亚 / 助力 / 卡西米尔 /
  调和), `fields.json` (迷迭香), `roster.json` and `standins.json`, and rewrite
  `test/content/garrisons_battle.test.js:570-590`. The +20 % the players see today is the number the card promises.
- **(B) Keep the engine (recommended for official content).** The official reading stands; the same reading is what
  the golden numbers and the unit tests already encode. Nothing to do.
- **(C) Align the 自研 fiat rows with the official arrangement** — the only real decision here. Either keep
  `base_atk` (one 特质 block on the detail card, `tools/content/custom.mjs:225-238`'s stated reason; slightly weaker
  than the official form at high layers, ×1.33 at 999 投资人 layers on the measurement above, [ASSUMED] no official
  evidence either way) or split the fixed half back into its own `char_attribute_mul` row (identical to the official
  maths, but two 特质 blocks on the detail card — the very thing the merge was for). **My preference: keep the fiat
  one-row `base_*` form and mark the divergence in the content comment**, because the maintainer's own reason for the
  merge is UI (one 特质 block) and the difference only appears in layer-rich late rounds; the alternative is to
  re-check what the official client shows for 迷迭香 at high layers first.

---

## 7. How to re-measure (recipe)

A one-off ESM script next to the repo root, run with plain `node` (the sandbox here denies the `node --test` runner's
child spawn, but a direct script is fine):

```js
import { makeBattle } from './test/helpers/battleHarness.js';
import { DataSource, getDefaultSource } from './server/sim/simdata.js';
import { getData } from './server/data.js';
const D = getData({ log: { warn() {}, error() {}, info() {} } });
// the harness DataSource overrides chess records only; garrisons come from the process singleton
// (server/sim/content/support/index.js garrisonRecord → gameData(); setGameData() re-keys one for the hazard test)
const rec = JSON.parse(JSON.stringify(D.chess['chess_char_6_12_a']));
const h = makeBattle({
  data: new DataSource({ chess: { 'chess_char_6_12_a': rec } }, getDefaultSource()),
  bonds: {}, content: 'full', timeLimit: 30, autoFinish: false,
  units: [{ chessId: 'chess_char_6_12_a', row: 10, col: 4 }],
});
h.step(1);
const u = h.unit('chess_char_6_12_a');
console.log(u.s.atk, u.s.maxHp, u.buffs.filter((b) => b.key.startsWith('gar:')));
// baseline: same record with rec.garrisonIds = [] in a second battle
```

`h.b.addBuff(u, { key: 'probe:x', mods: { atkPct: 1 } })` supplies the "one more 直接乘算 source" of §6, and
`setGameData({ ...D, garrisons: { ...D.garrisons, garrison_03_a: { ...D.garrisons.garrison_03_a, effectKey:
'act1autochess_gar_eff_attrByBond', bbStr: { key: 'act1autochess_gar_eff_attrByBond', bond_id: 'investShip' } } } })`
reproduces §3's `atkPct = 1.2` (restore with `setGameData(D)`); keep the probe's `bonds` object empty for the
"everything off, 0 layers" condition.
