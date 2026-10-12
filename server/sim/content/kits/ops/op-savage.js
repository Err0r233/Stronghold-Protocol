// server/sim/content/kits/ops/op-savage.js — 暴行 (char_230_savage) kit: the 「巴别塔」 T1 shop chess
// chess_char_1_05_babel_a / _b (近卫 · 强攻手 `centurion`), registered by ops/chess_char_1_05_babel-savage.js.
// Kit contract, naming and registration: ../README.md; the 自研 core bond and its members: docs/research/15-babel-bond.md §2.
//
// Sources: data/chess.json (the chess record's own skills / talents / trait at skill Lv4 normal and Lv7 elite — every number
// below is read from a blackboard), PRTS 暴行 (https://prts.wiki/w/暴行 — 天赋 山谷's 备注, the 微差爆破 备注 and the
// 未竟的旅程 module text quoted below), and the official zh_CN character_table / skill_table through that record.
// No module: the 巴别塔 chess carry `equipLevel` 0 (docs/research/15-babel-bond.md §6.3: DESIGN §6.1 「不要写模组」), so the
// 山谷 / 微差爆破 numbers are the base ones and 未竟的旅程 (CEN-X, +13 % / +15 % and the 110 % vs a blocked enemy) is out
// of scope here. Forms: normal = E2 Lv1, skills at rank 4; elite = E2 Lv60, rank 7 (tools/content/custom.mjs).
// - Trait (强攻手) "同时攻击阻挡的所有敌人": the profession default (professions.js `centurion`, `hitAllBlocked` — up to the
//   block count, the blocked ones first). Nothing to add.
// - T1 山谷 "周围四格中有两格以上的高地地形时攻击力和防御力+10%" (bb `cnt` / `atk` / `def`): PRTS 备注 "地块的判定条件为
//   '高度类型为高地'的地块；不判定暴行所在的这一地块" — the four tiles next to her, her own tile never counted (the data
//   carries no talent rangeGrid, so the grid is the named constant ADJ4); the text's correction 「部署时」 — the verdict is
//   taken at each deployment, as 阿斯卡纶's 噬光残影 does for the same shape (op-ascln.js). [ASSUMED] a 【移动】 re-checks it
//   (the `deploy` hook fires for one), a mere relocation does not; she has no 【移动】 skill.
// - S1 强力击·β型 (AUTO, 攻击回复, iconId `skcom_powerstrike[2]`): exactly the stock 强力击 the generic kit builds from
//   `bb.atk_scale` ("下次攻击的攻击力提高至185%" normal / 200% elite) — the one-line spec below is the generic spec, kept
//   here only because a kit must carry the spec of its DEFAULT skill (docs/SIM.md §7.2: only a NON-default skill falls back
//   to the generic spec). No effect of hers is added to it.
// - S2 微差爆破 (MANUAL, 攻击回复, 技能范围 3-2): "对前方三格范围内至多4个敌人造成相当于攻击力330%的物理伤害" (elite
//   360 %; bb `atk_scale` / `max_target`). Its `rangeId` 3-2 is a 技能范围, not an attack-range change (docs/DATA.md §2.2:
//   the text says neither 攻击范围… nor 攻击距离…), so the skill deals its own damage over that grid when it is cast — it is
//   NOT a "next attack" (the text does not say 下次攻击, and PRTS 备注 speaks of the skill's own 索敌: "此技能的索敌不受仇恨值
//   影响"), as 流星's S2 碎甲击·扩散 is implemented (chess_char_3_17-shotst.js). PRTS 备注: "技能范围包括本格" — the 3-2 grid
//   carries her own tile (0,0) beside the three in front, and the targets are the selectable enemies on those tiles, taken by
//   "优先选择自身阻挡的单位 > 更早出现的单位，不受仇恨值影响" — the kit's own selector below (the engine's sortEnemyTargets
//   would consult taunt and the remaining route distance before the spawn order, which this skill ignores; the damage is
//   ground-only as her whole profile is).
//   [ASSUMED] the four targets are cut at activation, before the damage (the PRTS note describes the skill's selection), the
//   damage is 技能伤害 (`isSkill`, as the generic kit's own bursts are) and the same selector governs her normal attacks —
//   it cannot: ai.js `acquireTargets` cuts a normal attack's targets before any kit hook runs, so a normal attack keeps the
//   engine's order (blocked → taunt → route → spawn; the PRTS note on her 天赋 备注 asks for blocked → spawn, no taunt).

import { num, talentBb, skillRec } from '../shared/tier1.js';
import { absoluteRangeKeys } from '../../../targeting.js';

const S1 = 'skchr_savage_1';
const S2 = 'skchr_savage_2';
/** 山谷's grid: the four tiles next to her — PRTS 天赋 备注 never counts her own tile. */
const ADJ4 = Object.freeze([Object.freeze([0, 1]), Object.freeze([0, -1]), Object.freeze([1, 0]), Object.freeze([-1, 0])]);
const VALLEY = 'talent:savage:valley';

export default {
  char_230_savage: (bb, chess) => {
    const t0 = talentBb(chess, 0);
    const s1 = skillRec(chess, S1), s2 = skillRec(chess, S2);
    return {
      skills: {
        // 强力击·β型: the stock 强力击 — the generic kit's spec, nothing of hers added (see the header)
        [S1]: { kind: 'instant', attack: { atkScale: num(s1?.bb?.atk_scale, 1) } },
        // 微差爆破: one burst over the 技能范围 3-2, at most max_target of the enemies on those tiles
        [S2]: {
          kind: 'instant',
          onStart({ battle, unit }) {
            const grid = s2?.rangeGrid;
            const scale = num(s2?.bb?.atk_scale, 1);
            const max = Math.max(0, Math.floor(num(s2?.bb?.max_target, 1)));
            if (!grid || max <= 0) return;
            const keys = absoluteRangeKeys(grid, unit.tileR, unit.tileC, unit.dir, 0);
            // PRTS 备注 "优先选择自身阻挡的单位 > 更早出现的单位"，不受仇恨值影响 (the engine's sort would consult taunt)
            const list = battle.enemiesInKeys(keys, unit, unit.profile)
              .sort((a, b) => (a.blockedBy === unit ? 0 : 1) - (b.blockedBy === unit ? 0 : 1) || a.spawnSeq - b.spawnSeq)
              .slice(0, max);
            for (const e of list) {
              battle.dealDamage(unit, e, { amount: unit.s.atk * scale, type: 'phys', isSkill: true, tags: ['skill', 'burst'] });
            }
          },
        },
      },
      talents: [{
        install(battle, unit) { // 山谷: +atk / +def while two of the four tiles next to her are 高地 (at each deployment)
          const cnt = Math.max(1, Math.floor(num(t0.cnt, 2)));
          const mods = { atkPct: num(t0.atk), defPct: num(t0.def) };
          if (!(mods.atkPct > 0) && !(mods.defPct > 0)) return;
          const apply = (r, c) => {
            let n = 0;
            for (const [dr, dc] of ADJ4) {
              const rr = r + dr, cc = c + dc;
              if (battle.grid.inBounds(rr, cc) && battle.grid.tile(rr, cc).height === 'HIGH') n++;
            }
            if (n >= cnt) battle.addBuff(unit, { key: VALLEY, mods: { ...mods }, persist: true, allowDead: true, tags: ['talent'] });
            else if (unit.findBuff(VALLEY)) battle.removeBuff(unit, VALLEY);
          };
          apply(unit.homeR ?? unit.tileR, unit.homeC ?? unit.tileC);
          battle.on('deploy', (ctx) => { if (ctx.unit === unit) apply(unit.tileR, unit.tileC); }, { owner: unit });
        },
      }],
    };
  },
};
