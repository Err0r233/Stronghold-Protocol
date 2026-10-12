// server/sim/content/bonds/addon/element.js — the 「元素」add-on bond (elementShip), a 自研盟约 of the maintainer
// (docs/research/17-element-bond.md; the rows live in tools/content/custom.mjs, the numbers in data/bonds.json `bb`).
// Battle side only: the bond has no prep effect.
//
//   一档 (2 distinct 【元素】 members on the board)
//     【元素】干员造成的元素损伤 ×(1 + element_damage_base + element_damage_per_stack·L), L clamped to
//     element_damage_cap_layers (150) — 0 layers +10 %, 150 layers +55 % (and no further gain above 150).
//
//   二档 (3 distinct) — 按元素损伤种类分别生效, L clamped to tier2_cap_layers (200):
//     凋亡 apoptosis  本次元素爆发造成的伤害提升至 apoptosis_burst_base + apoptosis_burst_per_stack·L
//                       (110 % → 325 %), and 目标攻击力额外最终降低至 ×apoptosis_atk_final_mul (0.7).
//     灼燃 burn       本次元素爆发造成的伤害提升至 burn_burst_base + burn_burst_per_stack·L (195 % → 494 %), and
//                       目标法术抗性额外 −burn_res_down (20).
//     神经 neural     本次元素爆发直接造成的伤害提升至 neural_burst_base + neural_burst_per_stack·L (110 % → 260 %),
//                       and 冷却期间每秒 neural_dot_base + neural_dot_per_stack·L (500 → 1300) 点无来源的元素持续伤害.
//     侵蚀 erosion    目标防御力额外永久 −erosion_def_down (120; stacks with the engine's own −120), and 冷却期间
//                       erosion_dot_hits (10) 次 erosion_dot_base + erosion_dot_per_stack·L (750 → 1950) 点无来源的
//                       物理持续伤害, one every erosion_dot_interval (0.03 s) — timing note below.
//
// Which units it touches. Membership is the data's (`isMember` — the chess's own `bonds`), so the operators
// tools/content/custom.mjs gives elementShip. A burst counts for the player whose member caused it: damage.js
// resolveBurst calls `battle.dealDamage(source, …)` with the unit that filled the gauge as `source`, and although a
// burst's DamageInfo is `sourceless` (the `hit` hook's `source` is null) the engine keeps it in `ctx.credit` — which is
// exactly the handle the 二档 clauses scale their damage through. Every clause is for ENEMY targets only
// (`target.side === 'enemy'`): the design's text is about the operator side bursting an enemy's gauge.
//
// Engine primitives reused, none invented: the `elementHit` hook (damage.js applyElement — the one mutable point on a
// gauge fill, where every "受到的元素损伤±N %" kit writes `dmg.mul`), `hit` + `credit` (the 元素伤害 instance of a
// burst), `battle.every` / `battle.after` (the cooldown riders), `defFlat` / `resFlat` / `atkMul` mods (the 额外 cuts).
//
// Timing note on the 侵蚀 DoT [ASSUMED]. The design asks for one hit every 0.03 s while the simulation's tick is
// TICK = 1/30 s (constants.js): 0.03 s of game time is 0.9 of a tick, so a literal 0.03 s dispatch cannot be
// expressed by the tick loop. `battle.after(seconds, fn)` runs its callbacks at the start of the first tick whose time
// has passed — which is still game-time accurate, unlike `battle.every` (whose interval is floored at one TICK) — so
// the 「0.3 秒内共 10 跳」 semantic is dispatched as erosion_dot_hits independent `after` callbacks at n·0.03 s
// (n = 1…10): ten distinct 无来源 damage instances inside the 0.3 s window, several of them landing in the same tick.
//
// Numbers are all data (`bb` of the bond's own buff in data/bonds.json): nothing is hardcoded below except the two
// burst cooldown lengths, which are engine constants (constants.js `ELEMENT`), not design values — they are read from
// the same table the engine's own burst uses, so a change there stays the single source of truth.
//
// Hooks and schedules are registered only when the bond is active at the tier that needs them, and every scheduled
// rider is owned by the member that caused it (Battle.offOwner cancels it when that member leaves the field).

import { ELEMENT } from '../../../constants.js';
import {
  num, bondRecord, buffParams, bondLayers, bondTier, isMember, onField, playerOps,
} from '../../support/index.js';

export const ID = Object.freeze({ element: 'elementShip' });
/** The bond's own buff key in data/bonds.json (`buffs[].key`); the blackboards live in it. */
export const BB_KEY = 'env_gbuff_new';
/** Buff keys this module owns (never a key another module or the engine uses). */
export const KEY = Object.freeze({
  resDown: 'bond:elementShip:resDown', atkDown: 'bond:elementShip:atkDown', defDown: 'bond:elementShip:defDown',
});
/** The engine's own 神经 burst cooldown buff (damage.js resolveBurst) — the window the neural DoT runs in. */
const NEURAL_LOCK = 'neuralBurst';

/** The bond's blackboard `{ ...bb, ...bbStr }`, or {} when the data record is missing. */
export function bondBb() {
  return buffParams(bondRecord(ID.element), BB_KEY) ?? {};
}

/** L capped at `cap` (the design's 「L 以 N 封顶」). */
const capped = (layers, cap) => Math.min(Math.max(0, layers), Math.max(0, cap));

/**
 * 一档 — the element-damage multiplier of a member:
 * `1 + element_damage_base + element_damage_per_stack · min(L, element_damage_cap_layers)` (1.10 … 1.55).
 */
export function elementDamageMul(bb, layers) {
  return Math.max(0, 1 + num(bb.element_damage_base) + num(bb.element_damage_per_stack) * capped(layers, num(bb.element_damage_cap_layers, 0)));
}

/**
 * 二档 — `base + per_stack · min(L, tier2_cap_layers)`, the shape of all four clauses' burst multipliers and flat DoTs.
 */
export function tier2Value(bb, baseKey, perKey, layers) {
  return Math.max(0, num(bb[baseKey]) + num(bb[perKey]) * capped(layers, num(bb.tier2_cap_layers, 0)));
}

/** The engine's own burst cooldown length for the enemy side of `el` (constants.js ELEMENT), 0 when unknown. */
export const burstCooldown = (el) => num(ELEMENT[el]?.enemy?.duration ?? ELEMENT[el]?.duration, 0);

export function install(battle) {
  if (!battle || !Array.isArray(battle.players) || !battle.players.length) return;
  const bb = bondBb();
  if (!Object.keys(bb).length) return;

  /** Per player: the bond's tier and the members that count for it (units, not chess records). */
  const states = [];
  for (const p of battle.players) {
    const pid = p.playerId;
    const tier = bondTier(battle, pid, ID.element);
    if (tier <= 0) continue;
    const members = new Set(playerOps(battle, pid).filter((u) => isMember(battle, u, ID.element)));
    if (!members.size) continue;
    states.push({ pid, tier, members });
  }
  if (!states.length) return;
  const byUnit = new Map();
  for (const st of states) for (const u of st.members) byUnit.set(u, st);
  const topTier = Math.max(...states.map((s) => s.tier));

  // ===== 一档: 【元素】干员造成的元素损伤 ×(1 + base + per·L) =========================================================
  // `elementHit` fires before the gauge is filled (damage.js applyElement) and `dmg.mul` multiplies the amount there, so
  // this is the same axis the kits' own "受到的元素损伤±N %" handlers write (菲莱 / 余 / 珊比 / 淤困). A burst's own
  // 元素伤害 goes through `hit`, never this hook, so the two tiers can never double-count one another.
  battle.on('elementHit', (c) => {
    const st = byUnit.get(c.source);
    if (!st || !c.dmg || c.dmg.cancel) return;
    if (!c.target || c.target.side !== 'enemy') return;
    c.dmg.mul *= elementDamageMul(bb, bondLayers(battle, st.pid, ID.element));
  });

  // ===== 二档: the four element bursts ==============================================================================
  if (topTier < 2) return;

  /**
   * The 二档 burst multiplier a member's burst currently owes the target: the `hit` handler below reads it back through
   * `credit` (the member — a burst's damage is `sourceless`, so `hit`'s `source` is null) and, for 灼燃 / 神经, clears
   * it, so ONE instance is scaled exactly once. 凋亡 keeps its entry for the whole cooldown: its damage is the engine
   * lock's per-second 元素伤害 tick (15 of them), and each one must carry the multiplier.
   */
  const pending = new Map(); // target → { burn?, neural?, apoptosis? }
  const setSlot = (target, el, mul) => {
    let m = pending.get(target);
    if (!m) pending.set(target, m = {});
    m[el] = mul;
  };

  /** 无来源 damage of a burst rider (PRTS 元素: 元素爆发通常造成无来源的伤害), credited to the member that burst it. */
  const rider = (src, target, amount, type, tag) => {
    if (!(amount > 0) || !target.alive) return;
    battle.dealDamage(src, target, { amount, type, canDodge: false, sourceless: true, tags: ['burst', 'bond:elementShip', tag] });
  };
  const durOf = (el) => { const d = burstCooldown(el); return d > 0 ? d : Infinity; };

  battle.on('elementBurst', (c) => {
    const src = c.source, target = c.target;
    const st = byUnit.get(src);
    if (!st || st.tier < 2 || !onField(src)) return;
    if (!target || target.side !== 'enemy' || !target.alive) return;
    const L = bondLayers(battle, st.pid, ID.element);
    const el = c.element;

    if (el === 'apoptosis') {
      // 凋亡. The burst's own damage is the 800 元素伤害 per second the engine's 15 s cooldown lock deals. 攻击力额外最终
      // 降低至 70 %: the engine's own 凋亡 weaken (50 % → 0 % over the cooldown) is an `atkMul` mod on the lock buff;
      // this module adds a second, multiplicative `atkMul` buff of its own instead of fighting for that field
      // (buffs.js sums mods per key only — two buffs' `atkMul` multiply, which is what 「额外最终」 describes). It is
      // refreshed by every burst and lives exactly as long as the cooldown it was burst in.
      setSlot(target, el, tier2Value(bb, 'apoptosis_burst_base', 'apoptosis_burst_per_stack', L));
      battle.addBuff(target, {
        key: KEY.atkDown, duration: durOf(el), refresh: 'replace', visible: true,
        mods: { atkMul: num(bb.apoptosis_atk_final_mul, 1) },
      });
      return;
    }

    if (el === 'burn') {
      // 灼燃. resolveBurst deals the burst's own `elemental` instance right after this hook; the multiplier is handed to
      // the `hit` handler through the per-target slot. 法术抗性额外 −20: a separate `resFlat` buff (the engine's own
      // 灼燃 lock already carries −20, so the two add up to the 「额外」 layer the design asks for).
      setSlot(target, el, tier2Value(bb, 'burn_burst_base', 'burn_burst_per_stack', L));
      battle.addBuff(target, {
        key: KEY.resDown, duration: durOf(el), refresh: 'replace', visible: true,
        mods: { resFlat: -num(bb.burn_res_down) },
      });
      return;
    }

    if (el === 'neural') {
      // 神经. The multiplier scales the burst's direct instance through the same slot. The cooldown rider is a fresh
      // 无来源 元素伤害 every second, for as long as the engine's own 神经 lock runs on that target.
      setSlot(target, el, tier2Value(bb, 'neural_burst_base', 'neural_burst_per_stack', L));
      const dps = tier2Value(bb, 'neural_dot_base', 'neural_dot_per_stack', L);
      if (!(dps > 0)) return;
      let left = Math.max(1, Math.ceil(durOf(el)));
      const s = battle.every(1, () => {
        left -= 1;
        if (left < 0 || !target.alive || !target.findBuff(NEURAL_LOCK)) { s.cancel(); return; }
        rider(src, target, dps, 'elemental', 'element:neural');
      }, { owner: src });
      return;
    }

    if (el === 'erosion') {
      // 侵蚀. 防御力额外永久 −120: a permanent, stacking buff of its own — the engine's burst already applies its own
      // permanent `erosionDown` −120, and this is the 「额外」 one on top.
      battle.addBuff(target, {
        key: KEY.defDown, refresh: 'stack', stacks: 1, maxStacks: 1e6, visible: true,
        mods: { defFlat: -num(bb.erosion_def_down) },
      });
      // 冷却期间每 0.03 秒一次、共 10 次的物理持续伤害 (header: the timing note).
      const dmg = tier2Value(bb, 'erosion_dot_base', 'erosion_dot_per_stack', L);
      const hits = Math.max(0, Math.floor(num(bb.erosion_dot_hits)));
      const step = Math.max(0, num(bb.erosion_dot_interval));
      if (!(dmg > 0)) return;
      for (let n = 1; n <= hits; n++) {
        battle.after(n * step, () => { if (target.alive) rider(src, target, dmg, 'phys', 'element:erosion'); }, { owner: src });
      }
    }
  });

  /**
   * The `elemental` instances of a burst this module scales, read off the `hit` hook (damage.js creates them as
   * `sourceless`, so `source` is null and the filling unit travels in `credit`).
   *
   * 灼燃 / 神经 deal ONE such instance at the burst (resolveBurst's `hit(c.elemDamage, 'elemental')`), so their slot is
   * consumed on the first instance and can never leak onto a later one.
   *
   * 凋亡 deals one instance PER SECOND for the whole 15 s cooldown (the lock's `onTick`), so its slot stays for the
   * cooldown's length and every tick carries the multiplier. It is applied here and **not** on `damaged`: the pipeline
   * applies `dmg.mul` on `hit` and only then emits `damaged` with the finished amount, so a `damaged` handler sees the
   * number after it was already decided (the first draft of this module did that and scaled nothing).
   * A tick is recognised by the element + the member's credit; nothing else deals `elemental apoptosis` credited to a
   * 元素 member. The slot dies with the battle (the map is per install).
   */
  battle.on('hit', (c) => {
    const m = c.target ? pending.get(c.target) : null;
    if (!m || !c.dmg || c.dmg.cancel || c.dmg.type !== 'elemental') return;
    if (!c.credit || !byUnit.has(c.credit)) return;
    const el = c.dmg.element;
    if (!(m[el] > 0)) return;
    c.dmg.mul *= m[el];
    if (el !== 'apoptosis') m[el] = 0;
  });
}
