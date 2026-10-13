// Real production Match + Battle, legal normal intents from an empty board. Seed 8 fixes the shop/wave route.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../../server/sim/Battle.js';
import { makeMatch } from './harness.js';

test('Rockrock killed by a real enemy and automatically revived by Ermengard starts the same target at init', () => {
  const observed = [];
  class ObservedBattle extends Battle {
    constructor(opts) {
      super(opts);
      const log = { round: opts.round, deaths: [], deploys: [], firstHits: [] };
      observed.push(log);
      const seen = new Set(), launches = new Map();
      this.on('death', c => {
        if (c.unit.defId === 'chess_char_2_10_a') log.deaths.push({ t: this.time, seq: c.unit.deploySeq,
          target: c.unit.trait.funnelTarget, scale: c.unit.trait.funnelScale, reason: c.reason });
      }, { priority: 1000 });
      this.on('death', c => {
        if (c.unit.defId === 'chess_char_2_10_a') log.deaths.at(-1).revivedBy = c.revivedBy;
      }, { priority: -1000 });
      this.on('deploy', c => {
        if (c.unit.defId === 'chess_char_2_10_a') log.deploys.push({ seq: c.unit.deploySeq,
          target: c.unit.trait.funnelTarget, scale: c.unit.trait.funnelScale });
      }, { priority: -1000 });
      this.on('attack', c => {
        if (c.attacker.defId !== 'chess_char_2_10_a') return;
        // This unmodified Rockrock route has no nested attack callback. The attack hook follows its shot creation.
        // The drone's ramp scale is read HERE, at launch: by the time the projectile lands the same unit may already have
        // advanced `trait.funnelScale` with a later attack (the body shot and the drone shot share one attackId).
        launches.set(this._attackSeq, { t: this.time, seq: c.attacker.deploySeq, scale: c.attacker.trait.funnelScale });
      });
      this.on('damaged', c => {
        const u = c.source;
        const launch = launches.get(c.dmg?.attackId);
        if (u?.defId !== 'chess_char_2_10_a' || seen.has(u.deploySeq) || launch?.seq !== u.deploySeq) return;
        seen.add(u.deploySeq);
        log.firstHits.push({ t: this.time, launchAt: launch.t, seq: u.deploySeq, target: c.target.id,
          scale: launch.scale, hpBefore: c.target.hp + c.amount });
      });
    }
  }
  const h = makeMatch({ mode: 'solo', seed: 8 });
  h.m.BattleClass = ObservedBattle; // read-only observers, no combat state writes
  const p = h.ps('p_0'), act = msg => assert.deepEqual(h.m.handle('p_0', msg), { ok: true });
  try {
    h.start().toPrep(1, { band: 'band_ermengard' });
    act({ t: 'g.buy', slot: 0 });
    // Whatever the R1 shop's first slot holds: it is a T1 pool chess fielded through its 补位 stand-in, so the id moves with
    // the pool contents (chess_char_1_09_a on the 0.2.5 upstream pool, chess_char_1_08_a on this workspace's). Deploy whatever
    // landed in the hand, the observer only tracks 洛洛.
    const first = p.hand.find(x => x?.id === p.shop.slots[0].id) ?? p.hand.find(Boolean);
    act({ t: 'g.move', uid: first.uid, to: { area: 'board', row: 12, col: 6 }, dir: 'RIGHT' });
    h.toPrep(2, { band: 'band_ermengard' });
    act({ t: 'g.levelUp' });
    h.toPrep(5, { band: 'band_ermengard' });
    // 洛洛 is a T2 pool chess, not a fixed shop slot: the shared pool's roll order over seed 8 moves her index whenever the
    // pool contents change (she sits at 3 on the 0.2.5 upstream pool, at 2 on this workspace's). Take her own slot.
    const rockrSlot = p.shop.slots.findIndex(s => s?.id === 'chess_char_2_10_a');
    assert.ok(rockrSlot >= 0, `洛洛 is in the R5 shop: ${p.shop.slots.map(s => s?.id).join(',')}`);
    act({ t: 'g.buy', slot: rockrSlot });
    act({ t: 'g.move', uid: p.hand.find(x => x?.id === 'chess_char_2_10_a').uid,
      to: { area: 'board', row: 12, col: 8 }, dir: 'RIGHT' });
    // R6 is this route's last round: the player is eliminated at its end (LP 0), so PREP R7 never arrives — but the
    // observed R6 battle runs to completion first (`phase RESULT R6`), which is all the log below needs. Tolerate only
    // that specific "cannot reach R7" harness assertion; a genuine failure of the R6 battle would surface as its own
    // assertion from inside toPrep (and every observer assertion after this one is untouched).
    try { h.toPrep(7, { band: 'band_ermengard' }); } catch (e) {
      if (!(e instanceof assert.AssertionError && /could not reach PREP R7/.test(e.message))) throw e;
      assert.ok(h.ended, 'the match ended at R6 (the player was eliminated)');
    }
    const log = observed.find(x => x.round === 6);
    assert.ok(log?.deaths.length > 0);
    const paired = log.deaths.map(d => ({ death: d, hit: log.firstHits.find(x => x.seq > d.seq) }))
      .filter(x => x.hit && x.death.target === x.hit.target && x.death.scale > 0.2);
    assert.ok(paired.length > 0, JSON.stringify(log));
    for (const { death, hit } of paired) {
      assert.equal(death.reason, 'killed');
      assert.equal(death.revivedBy, 'band');
      assert.ok(hit.launchAt >= death.t, 'fresh attack after the knockout and revival');
      assert.ok(hit.hpBefore > 0, 'the same enemy was alive when the fresh drone hit');
      const deploy = log.deploys.find(x => x.seq === hit.seq);
      assert.equal(deploy.target, null);
      assert.ok(Math.abs(deploy.scale - 0.2) < 1e-8);
      assert.ok(Math.abs(hit.scale - 0.2) < 1e-8, JSON.stringify({ death, hit }));
    }
    assert.deepEqual(h.logs.error, []);
    h.invariants();
  } finally { h.m.dispose(); }
});
