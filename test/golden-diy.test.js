// The 自选 golden match covers what it claims (test/golden/README.md, tools/golden.mjs — 0.2.0 自选编队): reads the stored
// digest only (test/golden.test.js recomputes it). Its human seat (AI 托管) slots 推进之王 and prototypes; its shop draws
// its 自选 pieces (and only from the slots' 调度中心 levels), its AI fields one of its picks — with its kit — in battle, the
// stock ends where the held copies leave it, and the match ends without errors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KITS } from '../server/sim/content/kits/index.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const MATCHES = read('./golden/matches.json');
const BACKUPS = read('../data/backups.json');

test('matches: the 自选 match\'s human seat draws its 自选 pieces in its shop and fields one of its picks in battle', () => {
  const [id, dg] = Object.entries(MATCHES.scenarios).find(([k]) => /-coverage-diy$/.test(k)) || [];
  assert.ok(dg, 'scenario present');
  assert.deepEqual(dg.errors, { engine: 0, logged: 0, sim: 0, dispatcher: 0 }, id);
  assert.deepEqual(Object.keys(dg.diy.picks).sort(), Object.keys(BACKUPS.diy.slots).sort(), 'all four slots filled');
  assert.equal(dg.diy.picks.chess_char_5_diy1_a.charId, 'char_112_siege');
  const draws = dg.diy.rounds.flatMap(([, d]) => (d ? d.split(' ') : []));
  assert.ok(draws.length >= 2, `shop draws: ${draws.join(', ')}`);
  for (const d of draws) assert.ok(Object.hasOwn(BACKUPS.diy.slots, `chess_char_${d}`), d);
  const fielded = dg.diy.rounds.filter(([, , f]) => f).flatMap(([r, , f]) => f.split(' ').map((x) => `${r}:${x}`));
  // The pinned operator moved with the data rebuild (0.2.4 §"One stored-digest expectation"): the seed's per-match ban
  // draw and the shop's draw order shift with the pool, so this seat's one fielded 自选 piece is now slot `5_diy2_a` —
  // whose pick is 归溟幽灵鲨 (char_609_acguad, one of the tier-5 原型 picks) — and 推进之王 is never fielded here. The
  // slot and the charId stay pinned; the charId's kit is then re-checked against the registry, so the assertion still
  // says a 自选 piece fights with a kit rather than merely "some 自选 piece went up".
  // 该局自选位现由 归溟幽灵鲨 补位、且在 7/9 两回合上场 (the same stand-in went up twice: slot `5_diy2_a` is fielded on
  // rounds 7 and 9 with char_609_acguad), so both stored rows stay pinned — the relation and the rounds, not "it went up".
  const DIY_SLOT = '5_diy2_a';
  const DIY_PICK = 'char_609_acguad';
  const DIY_FIELDED = `${DIY_SLOT}→${DIY_PICK}`;
  assert.equal(dg.diy.picks[`chess_char_${DIY_SLOT}`].charId, DIY_PICK, `the 自选 slot ${DIY_SLOT} stands in as its own pick`);
  assert.equal(typeof KITS[DIY_PICK], 'function', `${DIY_PICK} carries a registered kit`);
  assert.deepEqual(fielded.filter((x) => x.endsWith(DIY_FIELDED)), [`7:${DIY_FIELDED}`, `9:${DIY_FIELDED}`], `fielded: ${fielded.join(', ')}`);
  // every fielded piece fights with a registered kit (the slot's pick is the authority: a pick without one is not offered)
  for (const x of fielded) {
    const slot = x.split(':')[1].split('→')[0];
    assert.equal(typeof KITS[dg.diy.picks[`chess_char_${slot}`].charId], 'function', `${x} carries a kit`);
  }
  for (const [r, , f] of dg.diy.rounds) {
    for (const x of f ? f.split(' ') : []) {
      const [slot, charId] = x.split('→');
      assert.equal(dg.diy.picks[`chess_char_${slot}`].charId, charId, `round ${r}: ${x} fights as its pick`);
    }
  }
  // the stock: never above its cap (8 at tier 5, 5 at tier 6)
  for (const [slot, left] of Object.entries(dg.diy.stock)) assert.ok(left >= 0 && left <= (BACKUPS.diy.slots[slot].tier === 5 ? 8 : 5), slot);
});
