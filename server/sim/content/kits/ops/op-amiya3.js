// server/sim/content/kits/ops/op-amiya3.js — 阿米娅·医疗 (char_1037_amiya3) kit: the 「巴别塔」 T2 shop chess
// chess_char_2_05_babel_a / _b (医疗 · 咒愈师 `incantationmedic`), registered by ops/chess_char_2_05_babel-amiya3.js.
// Kit contract, naming and registration: ../README.md; the 自研 core bond and its members: docs/research/15-babel-bond.md §2.
//
// Sources: data/chess.json (her record's skills at Lv4 normal / Lv7 elite and the 诚挚期许 talent row — every number below is
// read from a blackboard), PRTS 阿米娅(医疗) (https://prts.wiki/w/阿米娅(医疗) — 天赋 诚挚期许 with its 备注, 技能 哀恸共情's
// 备注 "于普通攻击命中计算伤害时（先于特性）触发额外治疗，作用范围为周围十二格（碰撞判定）", 技能 慈悲愿景's 备注 "攻击范围内不存在
// 可选目标时，技能可照常开启" / "先按范围内敌人数量提升攻击力，后造成范围技能伤害", and the INC-X module text) and
// docs/research/15-babel-bond.md §6.2. Her own character record is a 自研 synthesis of this mode (the official zh_CN
// character_table never carried the 「升变」 form — §6.1): tools/content/custom.mjs builds it, 诚挚期许 included.
// Forms: normal = E2 Lv1, skills at rank 4; elite = E2 Lv60, rank 7 (tools/content/custom.mjs). No module: the 巴别塔 chess
// carry `equipLevel` 0 (§6.3), so INC-X (the 咒愈师 trait's 60 %, 诚挚期许's 9 % / 3 % and 10 % / 3.5 %) is out of scope here.
// - Trait (咒愈师) "攻击造成法术伤害，攻击敌人时为攻击范围内一名友方干员治疗相当于50%伤害的生命值": the engine's
//   (professions.js `installIncantation`, `bb.scale`) — never repeated here.
// - T1 诚挚期许 "在场时所有友方单位最大生命+8%，技能期间所有友方单位每秒恢复2.5%最大生命" (bb `max_hp` /
//   `hp_recovery_per_sec_by_max_hp_ratio`; 精英1 5 % / 1.5 % at PHASE_1 — the chess records are PHASE_2, so both forms of the
//   chess carry the 8 % / 2.5 % row). "所有友方单位" = the units of her own player (the 联防 field is shared; the bond's own
//   rule of docs/research/15-babel-bond.md §1.2 filters by owner the same way) — an aura of `hpPct` refreshed every 0.25 s
//   while she is on the field, and, while HER skill runs, the per-second recovery. PRTS 备注 "生命恢复的提供方式为增加目标的
//   '生命回复速度（百分比）'属性（直接加算），不受治疗加成和禁疗影响" — so the recovery is an `hpRegenRatio` buff, never a
//   `battle.heal`: 禁疗 / 无法被友方治疗 units get it too and no 治疗加成 scales it (docs/SIM.md §4; the 吟游者 trait, 调香师,
//   洁莉娜 兼职工作 and kits/shared/tier1.js installAura's convention). "直接加算" = one buff per 阿米娅 (the key carries her
//   unit id), so two of them add up.
// - S1 哀恸共情 (MANUAL, 时间回复, 50 s, 技能范围 x-1): ASPD +`attack_speed` while it runs, and EVERY normal attack additionally
//   heals all allies on the twelve tiles around her for `heal_scale` × ATK. The skill's x-1 grid carries her own tile (0,0)
//   beside the twelve tiles around her; PRTS names the 作用范围 「周围十二格」, so the centre tile is dropped (AROUND below =
//   the record's grid without (0,0)) — she is healed by the 咒愈师 trait only. The trigger is "于普通攻击命中计算伤害时（先于
//   特性）": the extra heal runs in a `hit` handler of her own normal attacks — the `hit` hook fires inside the damage pipeline,
//   BEFORE the `damaged` hook the 咒愈师 trait heals from (ai.js resolveHit / damage.js), and before the dodge roll, so it
//   lands on every attack, dodged or not, once per attack (`attackId`). The skill's rangeId x-1 is a 技能范围, not an
//   attack-range change (docs/DATA.md §2.2: her text says nothing of 攻击范围 / 攻击距离): it is the SKILL_RANGE trigger grid
//   the data resolved, and the kit leaves her own 3-3 attack range alone — the generic spec would have switched it to x-1.
// - S2 慈悲愿景 (MANUAL, 时间回复, 32 s): on activation one arts hit of `atk_scale` × ATK on every selectable enemy in her
//   attack range, and each of them 攻击速度 −60 / 移动速度 −60 % for the debuff's `amiya3_s_2[debuff].duration` s. The ATK
//   gain `atk` × the number of those enemies (at most `max_stack_cnt`) is taken BEFORE that damage and holds for the whole
//   skill (PRTS 备注 "先按范围内敌人数量提升攻击力，后造成范围技能伤害"); from then on her attacks are 真实 damage
//   (`attack.dmgType`) and take 2 enemies at once (`attack.maxTargets`). `bb.skill_max_trigger_time` 1 = "整场战斗中该技能
//   只能释放一次": after the cast no SP comes back, so a redeployment cannot cast it again (the 淬羽赫默 S3 pattern,
//   op-slent2.js). [ASSUMED] PRTS 备注 "攻击范围内不存在可选目标时，技能可照常开启" describes manual activation; the sim's
//   auto-cast keeps the DATA's rule (DEFAULT — a targetable enemy, or one she blocks, in the initial range; the 技能策略 is the
//   data's, README checklist item 5: change tools/build-data.mjs rather than hand-code a trigger in the kit). The burst is
//   技能伤害 (`isSkill`, the generic kit's own bursts are written so) and her attacks during the window stay 普通攻击.

import { num, talentBb, skillRec, up, alliesInGridOf } from '../shared/tier1.js';

const S1 = 'skchr_amiya3_1';
const S2 = 'skchr_amiya3_2';
/** The x-1 grid of 哀恸共情 without her own tile: the twelve tiles 「周围十二格」 (PRTS 技能备注). */
const AROUND = Object.freeze([[2, 0], [1, -1], [1, 0], [1, 1], [0, -2], [0, -1], [0, 1], [0, 2], [-1, -1], [-1, 0], [-1, 1], [-2, 0]]
  .map((p) => Object.freeze(p)));
const AURA_IV = 0.25;
/** The hold of the aura buffs: longer than the refresh interval, so they lapse just after she leaves / the skill ends. */
const AURA_HOLD = 0.5;
const S2_ATK = 'skill:amiya3:s2atk';
const S2_DEBUFF = 'skill:amiya3:s2debuff';
const auraKey = (unit) => `talent:amiya3:aura#${unit.id}`;
const regenKey = (unit) => `talent:amiya3:regen#${unit.id}`;

export default {
  char_1037_amiya3: (bb, chess) => {
    const t0 = talentBb(chess, 0);
    const s1 = skillRec(chess, S1), s2 = skillRec(chess, S2);
    return {
      skills: {
        // 哀恸共情: ASPD up, and every attack heals the twelve tiles around her (before the 咒愈师 trait's heal)
        [S1]: {
          kind: 'duration',
          mods: { aspd: num(s1?.bb?.attack_speed) },
          onStart({ battle, unit }) {
            const ratio = num(s1?.bb?.heal_scale);
            const grid = (s1?.rangeGrid ?? AROUND).filter(([dr, dc]) => !(dr === 0 && dc === 0));
            if (unit.mem.amiya3Heal) { battle.off(unit.mem.amiya3Heal); unit.mem.amiya3Heal = null; }   // one hook per cast
            unit.mem.amiya3Heal = battle.on('hit', (c) => {
              const d = c.dmg;
              if (c.source !== unit || !d || !d.isAttack || !c.target || c.target.side !== 'enemy') return;
              if (d.attackId && unit.mem.amiya3HealAttack === d.attackId) return;   // 每次攻击 heals once
              unit.mem.amiya3HealAttack = d.attackId;
              if (!(ratio > 0)) return;
              for (const a of alliesInGridOf(battle, unit, grid)) battle.heal(unit, a, unit.s.atk * ratio, { tags: ['skill', 'amiya3:s1'] });
            }, { owner: unit });
          },
          onEnd({ battle, unit }) {
            if (unit.mem.amiya3Heal) { battle.off(unit.mem.amiya3Heal); unit.mem.amiya3Heal = null; }
          },
        },
        // 慈悲愿景: one burst over her range, then 真实 damage on two targets at once — once per battle
        [S2]: {
          kind: 'duration',
          attack: { dmgType: 'true', maxTargets: 2 },
          onStart({ battle, unit, skill }) {
            if (!unit.mem.amiya3Once) { // 整场战斗中该技能只能释放一次: after it, no SP comes back
              const uses = Math.max(1, Math.floor(num(s2?.bb?.skill_max_trigger_time, 1)));
              unit.mem.amiya3Once = true;
              battle.on('spGain', (c) => { if (c.unit === unit && !unit.skill.active && unit.skill.activations >= uses) c.amount = 0; }, { owner: unit });
            }
            // PRTS 备注 "先按范围内敌人数量提升攻击力，后造成范围技能伤害"
            const list = battle.enemiesInKeys(unit.rangeKeys, unit, unit.profile);
            const per = num(s2?.bb?.atk), maxStack = Math.max(0, Math.floor(num(s2?.bb?.max_stack_cnt, 0)));
            const n = Math.min(list.length, maxStack);
            if (n > 0 && per > 0) {
              battle.addBuff(unit, { key: S2_ATK, duration: Math.max(0.01, skill.timeLeft), mods: { atkPct: per * n }, source: unit, tags: ['skill'] });
            }
            const atk = unit.s.atk, scale = num(s2?.bb?.atk_scale, 1);
            const dd = num(s2?.bb?.['amiya3_s_2[debuff].duration']);
            const debuff = {
              aspd: num(s2?.bb?.['amiya3_s_2[debuff].attack_speed']),
              moveMul: Math.max(0, 1 + num(s2?.bb?.['amiya3_s_2[debuff].move_speed'])),
            };
            for (const e of list) {
              battle.dealDamage(unit, e, { amount: atk * scale, type: 'arts', isSkill: true, tags: ['skill', 'burst'] });
              if (e.alive && dd > 0) battle.addBuff(e, { key: S2_DEBUFF, duration: dd, mods: { ...debuff }, source: unit, tags: ['skill'] });
            }
          },
          onEnd({ battle, unit }) { if (unit.findBuff(S2_ATK)) battle.removeBuff(unit, S2_ATK); },
        },
      },
      talents: [{
        install(battle, unit) { // 诚挚期许: max HP aura while she is on the field, and the per-second recovery while a skill runs
          const hpPct = num(t0.max_hp), regen = num(t0.hp_recovery_per_sec_by_max_hp_ratio);
          if (!(hpPct > 0) && !(regen > 0)) return;
          const aura = auraKey(unit), regenBuff = regenKey(unit);
          const refresh = () => {
            if (!up(unit)) return;
            const running = !!(unit.skill && unit.skill.active);
            for (const a of battle.alliesFor(unit, unit.ownerId)) {
              if (hpPct > 0) battle.addBuff(a, { key: aura, duration: AURA_HOLD, source: unit, mods: { hpPct }, tags: ['talent'] });
              if (running && regen > 0) battle.addBuff(a, { key: regenBuff, duration: AURA_HOLD, source: unit, mods: { hpRegenRatio: regen }, tags: ['talent'] });
              else if (a.findBuff(regenBuff)) battle.removeBuff(a, regenBuff);
            }
          };
          battle.every(AURA_IV, refresh, { owner: unit, immediate: true });
          battle.on('skillStart', (c) => { if (c.unit === unit) refresh(); }, { owner: unit });
          battle.on('skillEnd', (c) => { if (c.unit === unit) refresh(); }, { owner: unit });
        },
      }],
    };
  },
};
