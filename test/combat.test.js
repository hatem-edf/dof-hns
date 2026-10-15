import test from 'node:test';
import assert from 'node:assert/strict';
import { hitTest, rollDamage, applyDamage } from '../src/core/combat.js';
import { createMonster } from '../src/core/monster.js';
import { createRng } from '../src/core/rng.js';

// Iop numbers from the class table: 70 px range, ±40° arc (docs/design.md).
const IOP = { range: 70, arc: 40 };
const playerPos = { x: 0, y: 0 };
const aimRight = { x: 100, y: 0 };

test('combat: a target 60 px toward the aim is in range, 80 px is not', () => {
  assert.equal(hitTest(playerPos, aimRight, { x: 60, y: 0 }, IOP.range, IOP.arc), true);
  assert.equal(hitTest(playerPos, aimRight, { x: 80, y: 0 }, IOP.range, IOP.arc), false);
});

test('combat: a target 45 degrees off the aim direction misses the 40 degree arc', () => {
  const a = (45 * Math.PI) / 180;
  const off = { x: Math.cos(a) * 50, y: Math.sin(a) * 50 };
  assert.equal(hitTest(playerPos, aimRight, off, IOP.range, IOP.arc), false);
  // ...while 30 degrees off, at the same distance, still lands.
  const b = (30 * Math.PI) / 180;
  const inside = { x: Math.cos(b) * 60, y: Math.sin(b) * 60 };
  assert.equal(hitTest(playerPos, aimRight, inside, IOP.range, IOP.arc), true);
});

// A stub rng that replays fixed rolls — no Math.random, fully deterministic.
function stubRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test('combat: a crit deals exactly double the non-crit path at the same variance', () => {
  // Variance roll 0.5 is exactly +0%, so the only difference is the crit roll.
  const crit = rollDamage(20, 0.10, stubRng([0.5, 0.0]));
  const plain = rollDamage(20, 0.10, stubRng([0.5, 0.9]));
  assert.equal(plain, 20);
  assert.equal(crit, 40);
  assert.equal(crit, plain * 2);
});

test('combat: variance stays within ±10% of base when no crit rolls', () => {
  const rng = createRng(4242);
  for (let i = 0; i < 200; i++) {
    const d = rollDamage(20, 0, rng);
    assert.ok(d >= 18 - 1e-9 && d <= 22 + 1e-9, `roll ${d} outside ±10% of 20`);
  }
});

function fakeWorld(monster) {
  return {
    monsters: [monster],
    events: [],
    pickups: [],
    player: { kills: 0 },
    rng: createRng(1234),
  };
}

test('combat: defense subtracts and never goes below 1', () => {
  const m = createMonster('wolf', 1, { x: 0, y: 0 });
  const world = fakeWorld(m);
  const dealt = applyDamage(world, m, 2, 6);
  assert.equal(dealt, 1);
  assert.equal(m.hp, 39);
  assert.deepEqual(world.events, [{ kind: 'hit', target: 1, damage: 1 }]);
  assert.equal(world.pickups.length, 0);
  assert.equal(world.player.kills, 0);
});

test('combat: a killing blow emits kill, drops gold in the type range, and removes the monster', () => {
  const m = createMonster('wolf', 1, { x: 12.5, y: 33.5 });
  m.hp = 1;
  const world = fakeWorld(m);
  const dealt = applyDamage(world, m, 2, 0);
  assert.equal(dealt, 2);
  assert.ok(world.events.some((e) => e.kind === 'kill' && e.id === 1), 'no kill event');
  assert.equal(world.monsters.length, 0);
  assert.equal(world.player.kills, 1);
  assert.equal(world.pickups.length, 1);
  const g = world.pickups[0];
  assert.equal(g.kind, 'gold');
  assert.ok(Number.isInteger(g.value) && g.value >= 3 && g.value <= 6, `wolf gold ${g.value}`);
  assert.deepEqual(g.pos, { x: 12.5, y: 33.5 });
});
