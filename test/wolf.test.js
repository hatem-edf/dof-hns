import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step } from '../src/core/world.js';
import { createMonster } from '../src/core/monster.js';

// A world holding only the given wolves, at the given points. The real zone's
// other wolves are removed so each test controls who can aggro.
function wolfWorld(className, seed, homes) {
  const world = createWorld(className, seed);
  world.monsters = homes.map((h, i) => createMonster('wolf', i + 1, h));
  return world;
}

function placePlayer(world, x, y) {
  world.player.pos.x = x;
  world.player.pos.y = y;
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

// The map centre (480, 320) is tile (5.5, 5.5); points up to ~130 px left of
// it stay inside the diamond, and the distances below are exact on the x axis.
const HOME = { x: 480, y: 320 };

test('wolf: a fresh wolf 130 px from an idle player stays idle for one step', () => {
  const world = wolfWorld('iop', 11, [HOME]);
  placePlayer(world, 350, 320); // 130 px, outside the 120 px aggro radius
  step(world, input(), 0.05);
  assert.equal(world.monsters[0].state, 'idle');
});

test('wolf: a fresh wolf 110 px away chases after one step', () => {
  const world = wolfWorld('iop', 11, [HOME]);
  placePlayer(world, 370, 320); // 110 px, inside the 120 px aggro radius
  step(world, input(), 0.05);
  assert.equal(world.monsters[0].state, 'chase');
});

test('wolf: a second idle wolf within 150 px of the aggroed one aggros too (pack alert)', () => {
  const world = wolfWorld('iop', 11, [HOME, { x: 530, y: 320 }]);
  const [a, b] = world.monsters;
  placePlayer(world, 370, 320);
  // b is 160 px from the player (no direct aggro) but 50 px from a (pack alert).
  assert.ok(Math.hypot(b.pos.x - 370, b.pos.y - 320) > 120);
  assert.ok(Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y) <= 150);
  step(world, input(), 0.05);
  assert.equal(a.state, 'chase');
  assert.equal(b.state, 'chase');
});

test('wolf: no player damage mid-windup; the hit lands only once the 0.5 s windup ends', () => {
  const world = wolfWorld('iop', 55, [{ x: 500, y: 320 }]); // 20 px, point blank
  placePlayer(world, 480, 320);
  const m = world.monsters[0];
  const fullHp = world.player.hp;

  let windupStart = null;
  let firstHitFrame = null;
  for (let i = 0; i < 200 && firstHitFrame === null; i++) {
    const frameStart = world.time;
    const hpBefore = world.player.hp;
    step(world, input(), 0.05);
    if (m.state === 'windup' && windupStart === null) windupStart = frameStart;
    const hit = world.events.find((e) => e.kind === 'hit' && e.target === 'player');
    if (hit) {
      firstHitFrame = frameStart;
    } else {
      assert.equal(world.player.hp, hpBefore,
        `hp changed on frame ${i} (${frameStart} s) without a player hit event`);
    }
  }

  assert.ok(windupStart !== null, 'wolf never entered the windup');
  assert.ok(firstHitFrame !== null, 'wolf never struck the player');
  assert.ok(firstHitFrame >= windupStart + 0.5 - 1e-9,
    `strike at ${firstHitFrame} s came before the ${windupStart} s windup finished`);
  assert.ok(firstHitFrame <= windupStart + 0.7, 'strike came far too late');
  // Wolf deals 8, Iop defense 6 -> exactly 2.
  assert.equal(world.player.hp, fullHp - 2);
});

test('wolf: a point-blank Iop kills a 40 HP wolf with at most 3 Frappes, with kill event and gold pickup', () => {
  const world = wolfWorld('iop', 777, [{ x: 500, y: 320 }]);
  placePlayer(world, 480, 320);
  const wolf = world.monsters[0];

  let casts = 0;
  let killSeen = null;
  let deathPos = null;
  for (let i = 0; i < 120 && world.monsters.length > 0; i++) {
    // Aim tracks the wolf; Frappe is held down and the cooldown gates the casts.
    step(world, input({ aim: { x: wolf.pos.x, y: wolf.pos.y }, basic: true }), 0.05);
    for (const e of world.events) {
      if (e.kind === 'cast') casts++;
      if (e.kind === 'kill' && e.id === wolf.id) {
        killSeen = e;
        deathPos = { x: wolf.pos.x, y: wolf.pos.y };
      }
    }
  }

  assert.equal(world.monsters.length, 0, 'wolf survived 6 s of point-blank Frappes');
  assert.ok(killSeen !== null, 'no kill event for the wolf');
  assert.ok(casts >= 1 && casts <= 3, `kill took ${casts} casts, want at most 3`);
  assert.equal(world.player.kills, 1);
  assert.equal(world.pickups.length, 1);
  const g = world.pickups[0];
  assert.equal(g.kind, 'gold');
  assert.ok(Number.isInteger(g.value) && g.value >= 3 && g.value <= 6, `gold ${g.value} outside [3, 6]`);
  assert.deepEqual(g.pos, deathPos, 'gold dropped somewhere other than the death position');
});
