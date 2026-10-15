import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step } from '../src/core/world.js';
import { createMonster } from '../src/core/monster.js';
import { applyDamage } from '../src/core/combat.js';
import { SPELLS, CHARGE_SPEED } from '../src/core/spells.js';

// A world holding only the given monsters (the real zone's are removed so
// each test controls the field). Entries: { type, x, y } at the home point.
function iopWorld(seed, monsters) {
  const world = createWorld('iop', seed);
  world.monsters = monsters.map((m, i) => createMonster(m.type, i + 1, { x: m.x, y: m.y }));
  return world;
}

function input(over = {}) {
  return {
    move: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    basic: false,
    s1: false,
    s2: false,
    s3: false,
    ...over,
  };
}

// Run n frames of 50 ms, pinning every monster at its home each frame so
// wander and aggro cannot move the scripted geometry. Records each event
// with the frame-start time, and tracks the max world.dots length.
function run(world, frames, inputAt = () => ({})) {
  const log = [];
  let maxDots = 0;
  for (let i = 0; i < frames; i++) {
    for (const m of world.monsters) {
      m.pos.x = m.home.x;
      m.pos.y = m.home.y;
    }
    const t = world.time;
    step(world, input(inputAt(t)), 0.05);
    maxDots = Math.max(maxDots, world.dots.length);
    for (const e of world.events) log.push({ t, ...e });
  }
  return { log, maxDots };
}

const A = { x: 900, y: 320 }; // far right: aims everything toward +x

test('spells: the table holds all six spells with the design names and cooldowns', () => {
  assert.deepEqual(SPELLS.iop, {
    s1: { name: 'Charge', cd: 4 },
    s2: { name: 'Coup Tonnerre', cd: 3 },
    s3: { name: 'Coup Maudit', cd: 8 },
  });
  assert.deepEqual(SPELLS.cra, {
    s1: { name: 'Boule de Feu', cd: 2 },
    s2: { name: 'Tornade', cd: 6 },
    s3: { name: 'Eau Vive', cd: 12 },
  });
});

test('iop: Charge fires once per cooldown; holding the key does nothing while it ticks', () => {
  const world = iopWorld(3, []);
  world.player.pos = { x: 480, y: 320 };
  const first = run(world, 3, () => ({ s1: true, aim: A })); // t=0.15 s: mid-dash
  // The cast happens in system 3 of the first frame, so by t=0.15 s the dash
  // has moved for two frames: 680 px/s * 0.1 s = 68 px.
  assert.ok(
    Math.abs(world.player.pos.x - (480 + CHARGE_SPEED * 0.1)) < 2,
    `at t=0.15 s the dash must be 68 px in (680 px/s = 170 px in 0.25 s), at ${world.player.pos.x}`
  );
  const { log } = run(world, 27, () => ({ s1: true, aim: A })); // 1.5 s total, cd is 4 s
  const casts = [...first.log, ...log].filter((e) => e.kind === 'cast' && e.name === 'Charge');
  assert.equal(casts.length, 1, 'recasting during the cooldown must do nothing');
  assert.equal(world.player.dash, null, 'the dash ends 0.25 s after the cast');
  assert.equal(Math.round(world.player.pos.x), 650, 'the dash did not travel its 170 px');
  assert.ok(world.player.cooldowns.s1 > 0, 'the cooldown is still ticking');
});

test('iop: Coup Tonnerre fires once per cooldown and spends it even on a whiff', () => {
  const world = iopWorld(4, []); // no monsters anywhere: every cast is a whiff
  world.player.pos = { x: 480, y: 320 };
  const { log } = run(world, 70, () => ({ s2: true, aim: A })); // 3.5 s, cd is 3 s
  const casts = log.filter((e) => e.kind === 'cast' && e.name === 'Coup Tonnerre');
  assert.equal(casts.length, 2, 'one cast at t=0 and one at t=3, no more');
  assert.equal(casts[0].t, 0);
  assert.ok(Math.abs(casts[1].t - 3) < 0.11, `second cast at ${casts[1].t}, want t=3`);
  assert.equal(log.filter((e) => e.kind === 'hit').length, 0, 'a whiff hits nothing');
});

test('iop: Coup Maudit with no enemy in 100 px does nothing and spends no cooldown', () => {
  const world = iopWorld(5, []);
  world.player.pos = { x: 480, y: 320 };
  const { log } = run(world, 10, () => ({ s3: true, aim: A }));
  assert.equal(log.length, 0, 'a whiffed curse emits no events at all');
  assert.equal(world.player.cooldowns.s3, 0, 'a whiff must not spend the cooldown');
  assert.equal(world.dots.length, 0);
});

test('iop: Charge deals 30 exactly once to each wolf crossed, nothing to the off-line wolf', () => {
  const world = iopWorld(6, [
    { type: 'wolf', x: 520, y: 320 }, // on the dash line
    { type: 'wolf', x: 570, y: 320 }, // on the dash line
    { type: 'wolf', x: 545, y: 360 }, // 40 px off the line
  ]);
  world.player.pos = { x: 480, y: 320 };
  const { log } = run(world, 10, () => ({ s1: true, aim: A }));
  const hits = (id) => log.filter((e) => e.kind === 'hit' && e.target === id);
  assert.deepEqual(hits(1).map((e) => e.damage), [30], 'first wolf: 30 exactly once');
  assert.deepEqual(hits(2).map((e) => e.damage), [30], 'second wolf: 30 exactly once');
  assert.equal(hits(3).length, 0, 'the off-line wolf took nothing');
  assert.equal(world.monsters.length, 3, '30 damage does not kill a 40 HP wolf');
});

test('iop: the dash stops at the map border when aimed off the diamond', () => {
  const world = iopWorld(7, []);
  const s = { x: 448, y: 480 }; // the player spawn (tile 10,11), near the bottom corner
  world.player.pos = { x: s.x, y: s.y };
  const { log } = run(world, 15, () => ({ s1: true, aim: { x: 700, y: 600 } }));
  const p = world.player;
  assert.equal(p.dash, null, 'the dash must end at the border');
  const travelled = Math.hypot(p.pos.x - s.x, p.pos.y - s.y);
  assert.ok(travelled > 40 && travelled < 60, `travelled ${travelled} px, want the ~55 px to the border`);
  // The bottom-right border is the line -0.5x - y + 752 = 0.
  assert.ok(Math.abs(-0.5 * p.pos.x - p.pos.y + 752) < 1, 'final position is not on the border');
  assert.equal(log.filter((e) => e.kind === 'cast').length, 1);
});

test('iop: Coup Tonnerre hits both targets in the arc for 45, none outside', () => {
  const world = iopWorld(8, [
    { type: 'skeleton', x: 540, y: 300 }, // 63 px, -18 degrees: inside
    { type: 'skeleton', x: 560, y: 340 }, // 82 px, +14 degrees: inside
    { type: 'skeleton', x: 500, y: 400 }, // 82 px, +76 degrees: outside the ±50° arc
    { type: 'skeleton', x: 590, y: 320 }, // 110 px: outside the 90 px range
  ]);
  world.player.pos = { x: 480, y: 320 };
  const { log } = run(world, 10, () => ({ s2: true, aim: A }));
  const hits = (id) => log.filter((e) => e.kind === 'hit' && e.target === id);
  assert.deepEqual(hits(1).map((e) => e.damage), [45]);
  assert.deepEqual(hits(2).map((e) => e.damage), [45]);
  assert.equal(hits(3).length, 0, 'the off-arc skeleton took nothing');
  assert.equal(hits(4).length, 0, 'the out-of-range skeleton took nothing');
  assert.equal(world.monsters.length, 4, '45 damage does not kill a 70 HP skeleton');
});

test('iop: Coup Maudit deals 15 at t=0, 1 and 2, then the curse is gone', () => {
  const world = iopWorld(9, [{ type: 'orik', x: 520, y: 320 }]); // 40 px, in range
  world.player.pos = { x: 480, y: 320 };
  const { log } = run(world, 60, () => ({ s3: true, aim: A })); // 3 s, cd is 8 s
  const casts = log.filter((e) => e.kind === 'cast' && e.name === 'Coup Maudit');
  assert.equal(casts.length, 1, 'the 8 s cooldown blocks a recast for the whole run');
  const hits = log.filter((e) => e.kind === 'hit' && e.target === 1);
  assert.equal(hits.length, 3, `expected 3 hits, got ${JSON.stringify(hits.map((e) => e.t))}`);
  assert.deepEqual(hits.map((e) => e.damage), [15, 15, 15]);
  assert.ok(hits[0].t < 0.06, `first hit at ${hits[0].t}, want t=0`);
  assert.ok(Math.abs(hits[1].t - 1) < 0.11, `second hit at ${hits[1].t}, want t=1`);
  assert.ok(Math.abs(hits[2].t - 2) < 0.11, `third hit at ${hits[2].t}, want t=2`);
  assert.equal(world.dots.length, 0, 'the curse must expire after the third hit');
  assert.equal(world.monsters[0].hp, 400 - 45, 'Orik took exactly the three curse hits');
});

test('iop: a second Coup Maudit refreshes the curse; its total ticks stay 3', () => {
  const world = iopWorld(10, [{ type: 'orik', x: 520, y: 320 }]);
  world.player.pos = { x: 480, y: 320 };
  let reset = false;
  const { log, maxDots } = run(world, 60, (t) => {
    if (!reset && t >= 0.5) {
      world.player.cooldowns.s3 = 0; // let the refresh cast through at t=0.5
      reset = true;
    }
    return { s3: true, aim: A };
  });
  assert.ok(reset, 'the forced recast never happened');
  assert.equal(maxDots, 1, 'two curses must never be active at once');
  const casts = log.filter((e) => e.kind === 'cast' && e.name === 'Coup Maudit');
  assert.equal(casts.length, 2);
  const hits = log.filter((e) => e.kind === 'hit' && e.target === 1);
  const after = hits.filter((e) => e.t >= 0.49);
  assert.equal(after.length, 3, `the refreshed curse ticks 3 times, got ${JSON.stringify(after.map((e) => e.t))}`);
  assert.ok(!hits.some((e) => Math.abs(e.t - 1) < 0.11), 'the stale tick at t=1 survived the refresh');
  assert.equal(world.dots.length, 0);
  assert.equal(world.monsters[0].hp, 400 - 4 * 15, 'the refresh discards the stale tick: 4 hits total');
});

test('iop: the curse vanishes when its target dies — no further hits, world.dots empty', () => {
  const world = iopWorld(11, [{ type: 'wolf', x: 520, y: 320 }]);
  world.player.pos = { x: 480, y: 320 };
  const { log, maxDots } = run(world, 60, (t) => {
    if (t >= 0.5 && t < 0.55) {
      // Kill the cursed wolf out of band between frames, before the +1 s tick.
      const m = world.monsters[0];
      if (m) applyDamage(world, m, 100, 0);
    }
    return { s3: true, aim: A };
  });
  assert.equal(maxDots, 1);
  const hits = log.filter((e) => e.kind === 'hit' && e.target === 1);
  assert.equal(hits.length, 1, `no DoT tick after the target died, got ${hits.length}`);
  assert.equal(hits[0].damage, 15);
  assert.equal(world.dots.length, 0, 'the curse must be removed with its target');
  assert.equal(world.monsters.length, 0, 'the wolf died');
  assert.equal(world.player.kills, 1);
});
