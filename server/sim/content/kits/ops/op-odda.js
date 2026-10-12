// server/sim/content/kits/ops/op-odda.js — 奥达 (char_4131_odda) kit: the 「巴别塔」 T1 shop chess
// chess_char_1_06_babel_a / _b (近卫 · 撼地者 `hammer`), registered by ops/chess_char_1_06_babel-odda.js.
// Kit contract, naming and registration: ../README.md; the 自研 core bond and its members: docs/research/15-babel-bond.md §2.
//
// Sources: data/chess.json (the chess record's own skills / talents / trait at skill Lv4 normal and Lv7 elite — every number
// below is read from a blackboard) and PRTS 奥达 (https://prts.wiki/w/奥达 — the 落锤 备注, the 火花溅射 备注 "技能溅射半径1.5"
// and the 旧背包 module text quoted below). No module: the 巴别塔 chess carry `equipLevel` 0 (docs/research/15-babel-bond.md
// §6.3), so 旧背包 (HAM-X: the 115 % splash trait line and 落锤's +20 % / 20-hit upgrade) is out of scope here.
// Forms: normal = E2 Lv1, skills at rank 4; elite = E2 Lv60, rank 7 (tools/content/custom.mjs).
// - Trait (撼地者) "攻击使目标周围的其他敌人受到相当于攻击力50%的群体物理伤害": the profession default (professions.js
//   `hammer` — splashRadius `attack@ability_range_radius` 1, splashScale `attack@atk_scale_2` 0.5, splashOthersOnly: the
//   main target is not splashed). Nothing to add.
// - T1 落锤 "累计造成30次物理伤害后，攻击力+18%（+3%）" (bb `count` / `atk`; the record's `potMin` 4 chain gives 15 % below
//   潜能 5, applied by shared/potential.js before the kit sees the record): PRTS 备注 "仅在每次成功造成伤害后累计一次计数"
//   — every physical damage instance she deals that removes HP counts, her splash included, and the count is a battle-long
//   counter of that unit (unit.mem survives a redeploy; the buff itself is a persist talent buff, as the engine's other
//   one-off talent buffs are). [ASSUMED] a damage instance that removed no HP (a shield took it whole) does not count.
// - S1 火花溅射 (AUTO, 攻击回复, "下次攻击的攻击力提高至160%且溅射范围扩大"): the next attack at `bb.atk_scale` with the
//   splash radius widened to `bb.ability_range_radius` (PRTS 备注 "技能溅射半径1.5") — the splash scale stays the trait's
//   0.5. The blackboard key is `ability_range_radius`, which the generic kit does not read (it knows `attack@range_radius`),
//   which is why the spec is authored here.
// - S2 锻锤之力 (MANUAL, 时间回复, 18 s): ATK +`bb.atk`, DEF +`bb.def` while it runs; every enemy the attack SPLASHES onto
//   (not the main target — the trait only splashes the others) whose 重量等级 is at most `bb['attack@value']` is 浮空 for
//   `bb['attack@levitate_duration']` s. The engine halves a 浮空's duration on a unit of massLevel > 3 (buffs.js); every
//   target this kit levitates is at or below the threshold, so it always gets the full 0.5 s.

import { num, talentBb, skillRec, up, statBuff } from '../shared/tier1.js';
import { isHpLoss } from '../../../damage.js';

const S1 = 'skchr_odda_1';
const S2 = 'skchr_odda_2';
const HAMMERFALL = 'talent:odda:hammerfall';

export default {
  char_4131_odda: (bb, chess) => {
    const t0 = talentBb(chess, 0);
    const s1 = skillRec(chess, S1), s2 = skillRec(chess, S2);
    return {
      skills: {
        // 火花溅射: the next attack at atk_scale, its splash widened to ability_range_radius (1.5)
        [S1]: {
          kind: 'instant',
          attack: {
            atkScale: num(s1?.bb?.atk_scale, 1),
            splashRadius: num(s1?.bb?.ability_range_radius, 1),
          },
        },
        // 锻锤之力: ATK / DEF up, and the splash 浮空s the light units it catches
        [S2]: {
          kind: 'duration',
          mods: { atkPct: num(s2?.bb?.atk), defPct: num(s2?.bb?.def) },
          attack: {
            onEachHit({ battle, unit, target, kind }) {
              if (kind !== 'splash' || !target || !target.alive || target.side !== 'enemy') return;
              const dur = num(s2?.bb?.['attack@levitate_duration']);
              const maxMass = num(s2?.bb?.['attack@value'], 3);
              if (dur > 0 && target.s.massLevel <= maxMass + 1e-9) {
                battle.applyStatus(target, 'levitate', { duration: dur, source: unit });
              }
            },
          },
        },
      },
      talents: [{
        install(battle, unit) { // 落锤: count her physical damage instances, then a permanent ATK buff
          const need = Math.max(1, Math.floor(num(t0.count, 30)));
          const atk = num(t0.atk);
          if (!(atk > 0)) return;
          battle.on('damaged', (c) => {
            if (c.source !== unit || !up(unit) || unit.findBuff(HAMMERFALL)) return;
            if (!c.target || c.target.side !== 'enemy' || c.type !== 'phys' || !(c.amount > 0)) return;
            if (isHpLoss(c.dmg)) return;   // a 流失 is not damage she dealt (PRTS 伤害分类)
            const n = (unit.mem.oddaHits ?? 0) + 1;
            unit.mem.oddaHits = n;
            if (n >= need) statBuff(battle, unit, HAMMERFALL, { atkPct: atk });
          }, { owner: unit });
        },
      }],
    };
  },
};
