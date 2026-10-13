// test/render/stun-hold.test.js — a stunned model must not crouch and stand up again every clip (maintainer report of
// 2026-10-12: 维什戴尔 被晕眩时 the model repeated a squat-stand cycle; the fix landed on the 自研 branch after 0.2.5 —
// docs/history/0.2.5.md §30.7a records it, the header below carries only the report's date). render/spine.js SpineActor
// plays the stun role
// as a loop (`_play(…, true)`) since it was written; her `Stun` clip is a ONE-SHOT: its last 0.2 s drop the waist 98
// skeleton units into the stunned crouch and hold it there, so the loop snaps back to the standing first frame once a
// second. spine.js clipHoldsEnd tells the two apart from the skeleton itself (its end pose against its start), and a
// clip that ends in a pose of its own is played once — its last frame stays on the track (the mechanism `die()` uses:
// the runtime clamps a finished non-looping track at its end) — while a seamless cycle (浊心斯卡蒂 / 凯尔希·思衡托 /
// 迷迭香) still loops. Headless fake PIXI (test/render/fakepixi.js); the real-roster half parses the skeletons on disk
// like test/assets.test.js does.
//
// Run: node test/render/stun-hold.test.js

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakePixi } from './fakepixi.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = path.join(ROOT, 'public');
const MANIFEST = path.join(ROOT, 'data', 'assets.json');
const require = createRequire(path.join(ROOT, 'package.json'));

/** A skeleton stand-in the fake spine hands to SpineActor (`spine.skeleton.constructor`). */
class FakeSkeleton {
  constructor(data) {
    this.bones = (data?.bones || []).map(() => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }));
    this.slots = [];
  }
  setToSetupPose() { for (const b of this.bones) { b.x = 0; b.y = 0; b.rotation = 0; b.scaleX = 1; b.scaleY = 1; } }
  updateWorldTransform() {}
}

/** An animation whose bones sit at `endX` from its last frame on (a clip that ends elsewhere), `beginX` before it. */
const clip = (name, duration, endX, beginX = 0) => ({
  name,
  duration,
  apply(sk, _lastTime, time) { for (const b of sk.bones) b.x = time >= duration - 1e-6 ? endX : beginX; },
});

/**
 * Skeleton data of a model with an `Idle` and a `Stun` clip; `endX` = how far the stun clip's last frame sits from its
 * first (0 with a `beginX` of 0 too: a seamless cycle).
 */
const data = (endX, names = ['Idle', 'Stun']) => {
  const animations = new Map(names.map((n) => [n, clip(n, 1, n === 'Idle' ? 0 : endX)]));
  return { animations: names.map((n) => ({ name: n })), bones: [{}, {}], findAnimation: (n) => animations.get(n) ?? null };
};

const entry = (anims, names) => ({
  skel: '/s/op.skel', atlas: '/s/op.atlas', textures: ['/s/op.png'],
  anims, animations: Object.fromEntries((names || ['Idle', 'Stun']).map((n) => [n, 1])),
});
const STUN = { idle: 'Idle', stun: { begin: null, loop: 'Stun', end: null } };

let fake, SpineActor, clipHoldsEnd;
before(async () => {
  fake = installFakePixi();
  const Base = fake.P.spine.Spine;
  // the actor reads the runtime's Skeleton class off `spine.skeleton.constructor` (spine.js _stunHolds)
  fake.P.spine.Spine = class extends Base {
    constructor(d) { super(d); this.skeleton = new FakeSkeleton(d); }
  };
  ({ SpineActor, clipHoldsEnd } = await import('../../public/js/render/spine.js'));
});
after(() => fake.restore());

describe('clipHoldsEnd', () => {
  test('a clip whose last frame differs from its first holds its end; a seamless cycle does not', () => {
    const d = data(98);
    assert.equal(clipHoldsEnd(d, 'Stun', FakeSkeleton), true, '维什戴尔\'s Stun: the waist is 98 units from where it started');
    assert.equal(clipHoldsEnd(d, 'Idle', FakeSkeleton), false, 'every bone ends where it started');
    assert.equal(clipHoldsEnd(data(0), 'Stun', FakeSkeleton), false);
    // a difference at any bone counts, however small the others are
    assert.equal(clipHoldsEnd(data(5.5), 'Stun', FakeSkeleton), true);
    assert.equal(clipHoldsEnd(data(5), 'Stun', FakeSkeleton), false, 'at POSE_EPS the pose is the same');
  });

  test('an unknown runtime shape answers false (loop, the behaviour before the check)', () => {
    const d = data(98);
    assert.equal(clipHoldsEnd(d, 'Nope', FakeSkeleton), false, 'no such animation');
    assert.equal(clipHoldsEnd(null, 'Stun', FakeSkeleton), false);
    assert.equal(clipHoldsEnd(d, 'Stun', null), false);
    assert.equal(clipHoldsEnd({ findAnimation: () => ({ duration: 1 }) }, 'Stun', FakeSkeleton), false, 'no apply');
    assert.equal(clipHoldsEnd({ findAnimation: () => ({ duration: 0, apply() {} }) }, 'Stun', FakeSkeleton), false, 'no length');
    assert.equal(clipHoldsEnd({ findAnimation: () => { throw new Error('broken'); } }, 'Stun', FakeSkeleton), false);
    class NoBones {}
    assert.equal(clipHoldsEnd(d, 'Stun', NoBones), false, 'a skeleton that cannot be sampled');
  });
});

describe('SpineActor stun', () => {
  test('a stun clip that ends in a pose of its own plays ONCE, and its last frame is held', () => {
    const a = new SpineActor(data(98), entry(STUN));
    a.setBase('stun');
    assert.equal(a.mode, 'stun');
    assert.equal(a.current, 'Stun');
    assert.equal(a.spine.state.tracks[0].loop, false, 'not a loop: the crouch stays');
    assert.equal(a.poseHeld(), false, 'held by the finished track, not by the poseHeld optimisation');
  });

  test('a seamless stun cycle keeps looping (浊心斯卡蒂 / 凯尔希·思衡托 / 迷迭香)', () => {
    const a = new SpineActor(data(0), entry(STUN));
    a.setBase('stun');
    assert.equal(a.spine.state.tracks[0].loop, true);
  });

  test('the stun clip is chosen once: a sync every frame does not restart it', () => {
    // (the per-frame re-selection the crouch-and-stand report suspected: _enterStun returns while the mode is already
    // 'stun', so render/units.js sync() calling setBase('stun') on every snapshot is a no-op)
    const a = new SpineActor(data(98), entry(STUN));
    a.setBase('stun');
    let plays = 0;
    const orig = a.spine.state.setAnimation;
    a.spine.state.setAnimation = (...args) => { plays++; return orig.apply(a.spine.state, args); };
    for (let i = 0; i < 10; i++) a.setBase('stun');
    assert.equal(plays, 0, 'no restart while the stun lasts');
    assert.equal(a.current, 'Stun');
    a.setBase('idle');
    assert.equal(plays, 1, 'the resting state plays again once the stun ends');
    assert.equal(a.current, 'Idle');
    assert.equal(a.spine.state.tracks[0].loop, true);
  });

  test('a stun Begin clip plays once and queues the stun clip with the same play mode', () => {
    const names = ['Idle', 'Stun', 'Stun_Begin'];
    const anims = { idle: 'Idle', stun: { begin: 'Stun_Begin', loop: 'Stun', end: null } };
    const a = new SpineActor(data(98, names), entry(anims, names));
    const queued = [];
    a.spine.state.addAnimation = (t, name, loop) => { queued.push([name, loop]); return { loop, timeScale: 1 }; };
    a.setBase('stun');
    assert.equal(a.current, 'Stun_Begin');
    assert.equal(a.spine.state.tracks[0].loop, false, 'the Begin clip is a one-shot');
    assert.deepEqual(queued, [['Stun', false]], 'the stun clip that ends crouched waits for it');
    const b = new SpineActor(data(0, names), entry(anims, names));
    const queued2 = [];
    b.spine.state.addAnimation = (t, name, loop) => { queued2.push([name, loop]); return { loop, timeScale: 1 }; };
    b.setBase('stun');
    assert.deepEqual(queued2, [['Stun', true]], 'a seamless cycle keeps looping');
  });

  test('a stun role with no clip of its own freezes the current track', () => {
    const a = new SpineActor(data(0), entry({ idle: 'Idle', stun: null }));
    a.setBase('stun');
    assert.equal(a.frozen, true);
    assert.equal(a.current, 'Idle');
    a.setBase('idle');
    assert.equal(a.frozen, false, 'and thaws when it ends');
  });

  test('a form switched onto a stun clip keeps the play mode (setForm / syncFormPose)', () => {
    const a = new SpineActor(data(98, ['Idle', 'Stun', 'Stun_B']), entry({ idle: 'Idle', stun: null }));
    a.setBase('stun');
    assert.equal(a.frozen, true, 'no stun clip on the manifest roles');
    a.setForm({ stun: { begin: null, loop: 'Stun_B', end: null } });
    assert.equal(a.mode, 'stun');
    assert.equal(a.current, 'Stun_B');
    assert.equal(a.frozen, false);
    assert.equal(a.spine.state.tracks[0].loop, false, 'the form\'s stun clip holds its crouch too');
  });
});

describe('the roster on disk (skip without public/assets)', () => {
  const skip = !existsSync(MANIFEST) ? 'data/assets.json not generated'
    : !existsSync(PUBLIC) ? 'public/assets missing (run npm run assets)' : false;
  const r38 = skip ? null : require('@pixi-spine/runtime-3.8');
  const loader = () => new r38.SkeletonBinary({
    newRegionAttachment: (s, n) => new r38.RegionAttachment(n),
    newMeshAttachment: (s, n) => new r38.MeshAttachment(n),
    newBoundingBoxAttachment: (s, n) => new r38.BoundingBoxAttachment(n),
    newPathAttachment: (s, n) => new r38.PathAttachment(n),
    newPointAttachment: (s, n) => new r38.PointAttachment(n),
    newClippingAttachment: (s, n) => new r38.ClippingAttachment(n),
  });
  /** clipHoldsEnd on the model's own skeleton file (skipped when the file is not downloaded). */
  function holds(manifest, charId, side = 'front') {
    const s = manifest.chars[charId].spine[side];
    const file = path.join(PUBLIC, s.skel);
    if (!existsSync(file)) return null;
    const d = loader().readSkeletonData(new Uint8Array(readFileSync(file)));
    const name = s.anims.stun.loop;
    return { name, holds: clipHoldsEnd(d, name, r38.Skeleton) };
  }

  test('维什戴尔 / 引星棘刺 / W / 泡泡 hold their stun crouch; 浊心斯卡蒂 / 凯尔希·思衡托 / 迷迭香 loop', { skip }, () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    const held = ['char_1035_wisdel', 'char_1039_thorn2', 'char_113_cqbw', 'char_381_bubble'];
    const cycled = ['char_1012_skadi2', 'char_1052_kalts2', 'char_391_rosmon'];
    let seen = 0;
    for (const id of held) {
      const r = holds(manifest, id);
      if (!r) continue;
      seen++;
      assert.equal(r.name, 'Stun', `${id} stun clip`);
      assert.equal(r.holds, true, `${id}.${r.name} ends in a pose of its own: playing it as a loop snaps back`);
    }
    for (const side of ['front', 'back']) {
      const r = manifest.chars.char_113_cqbw.spine[side] && holds(manifest, 'char_113_cqbw', side);
      if (r) assert.equal(r.holds, true, `char_113_cqbw.${side}.Stun`);
    }
    for (const id of cycled) {
      const r = holds(manifest, id);
      if (!r) continue;
      seen++;
      assert.equal(r.holds, false, `${id}.${r.name} ends where it started: a seamless cycle`);
    }
    assert.ok(seen >= 7, `models checked (${seen})`);
  });
});
