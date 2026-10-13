import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioManager } from '../../public/js/audio.js';
import { indexAudio, pickModeAttacks } from '../../tools/assets/audio.mjs';
import { buildPlan } from '../../tools/assets/plan.mjs';

const id = 'char_1043_leizi2';
function rig() {
  const entry = { attack: '/normal_n.mp3', hit: '/normal_hit_n.mp3', attacks: { 2: '/mode_s.mp3' }, hits: { 2: '/impact_s.mp3' }, mix: { attack: { p: 0 }, hit: { vol: 0.1 } }, attackMix: { 2: { vol: 0.6 } } };
  const a = new AudioManager({ getManifest: () => ({ audio: { sfx: { units: { [id]: entry } } } }), random: () => 0.5 });
  a.ctx = {};
  const played = [];
  a._play = (url, opts) => played.push({ url, ...opts });
  const units = [{ id: 1, spine: id, side: 'ally', kind: 'chess', skillIndex: 2 }, { id: 2, spine: 'enemy_1_test', side: 'enemy' }];
  a.setFieldUnits(units);
  return { a, entry, played, units };
}

test('mode uses its own chance and volume, never the normal bank mix', () => {
  const { a, entry, played } = rig();
  a.unit(id, 'attack', 1, 2, true);
  a.unit(id, 'hit', 1, 2, true);
  assert.deepEqual(played.map((p) => [p.url, p.volume]), [['/mode_s.mp3', 0.33], ['/impact_s.mp3', 0.55]]);
  entry.attackMix[2].p = 0;
  a.unit(id, 'attack', 1, 2, true);
  assert.equal(played.length, 2, 'silent mode does not fall back to normal');
});

test('an in-flight impact remembers the mode at attack time after skill end', () => {
  const { a, played } = rig();
  a.handleBattleEvents([['skill', 1, 1], ['atk', 1, 2, 'none'], ['skill', 1, 0], ['dmg', 2, 10, 'phys']]);
  assert.deepEqual(played.map((p) => p.url), ['/mode_s.mp3', '/impact_s.mp3']);
  assert.equal(a.units.get(1).skillActive, false);
});

test('end before spawn cancels a queued start; field changes discard stale modes', () => {
  const { a, played, units } = rig();
  a.setFieldUnits([]);
  a.handleBattleEvents([['skill', 1, 1], ['skill', 1, 0], ['spawn', units[0]], ['atk', 1, 2, 'none']]);
  assert.equal(a.pendingSkill.size, 0);
  assert.equal(a.units.get(1).skillActive, false);
  assert.equal(played.length, 0);
  a.setFieldUnits([{ ...units[0], skillActive: true }, units[1]]);
  a.handleBattleEvents([['atk', 1, 2, 'none']]);
  assert.equal(played.at(-1).url, '/mode_s.mp3', 'late join snapshot restores active mode');
  a.setFieldUnits(units);
  assert.equal(a.lastAttacker.size, 0);
  assert.equal(a.units.get(1).skillActive, false);
});

test('mixed mode banks are not guessed; the selected official bank retains its mix in the plan', () => {
  assert.deepEqual(pickModeAttacks(new Map([['ON_ABILITY_START.attack', ['/a_s.mp3', '/b_h.mp3']]])), {});
  const audio = indexAudio({ soundFXBanks: [{ name: `battle.ON_ABILITY_START.${id}.attack.7`, sounds: [
    { asset: 'Audio/Sound_Beta_2/Player/p_atk/test_s', weight: 1, minVolume: 0.6, maxVolume: 0.6 },
    { asset: '', weight: 1 },
  ] }] });
  const { template } = buildPlan({ assets07: {}, ops03: {}, extraOperators: { [id]: { skills: [{ index: 2, skillId: 'test' }] } }, enemies05: {}, maps05: {}, audio, modelsData: {} });
  assert.deepEqual(template.audio.sfx.units[id].attackMix, { 2: { p: 0.5, vol: 0.6 } });
});

// 奥达's only ON_SKILL_START bank belongs to her S2 (`skchr_odda_2` → `b_char_atkboost`), so `skillSfx` = {1: …}:
// the `> 1` rule wrote neither `skill` (the primary slot 0 has no bank) nor `skills`, and her skill ran silent on a
// file that sits on disk (audio audit of 2026-10-12; 琳琅诗怀雅 / 银灰 / 古米 / 泥岩 / 至简 / 薇薇安娜 / 莎草 / Mon3tr /
// 灰毫 alike). The per-index map carries it; `skill` stays the primary's fallback (public/js/audio.js unit).
test('a single activation bank of a NON-primary slot is carried as `skills`, not dropped', () => {
  const oid = 'char_4131_odda';
  const bank = (skillId) => ({ name: `battle.ON_SKILL_START.${skillId}`, sounds: [{ asset: 'Audio/Sound_Beta_2/Battle/b_char/b_char_atkboost.mp3', weight: 1 }] });
  const skills = [{ index: 0, skillId: 'skchr_odda_1' }, { index: 1, skillId: 'skchr_odda_2' }];
  const plan = (banks) => buildPlan({
    assets07: {}, ops03: {}, extraOperators: { [oid]: { skills } }, enemies05: {}, maps05: {},
    audio: indexAudio({ soundFXBanks: banks }), modelsData: {},
  }).template.audio.sfx.units[oid];

  const onlyS2 = plan([bank('skchr_odda_2')]);
  assert.deepEqual(Object.keys(onlyS2.skills), ['1'], 'S2 keeps its own activation sound');
  assert.equal(onlyS2.skill, undefined, 'no primary-slot bank, so no `skill` fallback');

  const primaryOnly = plan([bank('skchr_odda_1')]);
  assert.ok(primaryOnly.skill, 'the primary slot’s bank is the unit’s skill sound');
  assert.equal(primaryOnly.skills, undefined, 'a single primary-slot bank needs no map');

  const both = plan([bank('skchr_odda_1'), bank('skchr_odda_2')]);
  assert.deepEqual(Object.keys(both.skills), ['0', '1'], 'several banks were already written as a map');
});
