import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step } from '../src/core/world.js';
import { createMonster } from '../src/core/monster.js';

// A world holding only the given monsters (the real zone's are removed so
// each test controls the field). Entries: { type, x, y } at the home point.
function craWorld(seed, className, monsters) {
  const world = createWorld(className, seed);
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
// with the frame-start time.
function run(world, frames, inputAt = () => ({})) {
  const log = [];
  for (let i = 0; i < frames; i++) {
    for (const m of world.monsters) {
      m.pos.x = m.home.x;
      m.pos.y = m.home.y;
    }
    const t = world.time;
    step(world, input(inputAt(t)), 0.05);
    for (const e of world.events) log.push({ t, ...e });
  }
  return log;
}

const S = { x: 480, y: 320 }; // scripted player spot, mid-map
const A = { x: 900, y: 320 }; // far right: aims everything toward +x

test('cra: the fireball flies at 320 px/s toward the aim', () => {
  const world = craWorld(21, 'cra', [{ type: 'wolf', x: 880, y: 320 }]); // 400 px: out of range
  world.player.pos = { ...S };
  run(world, 10, () => ({ s1: true, aim: A })); // 0.5 s of flight
  assert.equal(world.projectiles.length, 1, 'the fireball is still in flight at 0.5 s');
  const pr = world.projectiles[0];
  assert.ok(Math.abs(pr.pos.x - (S.x + 320 * 0.5)) < 1, `at t=0.5 s x must be ~640, at ${pr.pos.x}`);
  assert.equal(pr.pos.y, S.y, 'a horizontal aim stays on the horizontal line');
  const casts = run(world, 10, () => ({ s1: true, aim: A })).filter((e) => e.kind === 'cast');
  assert.equal(casts.length, 0, 'the 2 s cooldown blocks a second cast within 1 s');
});

test('cra: the fireball dies at 300 px when nothing is in its way', () => {
  const world = craWorld(22, 'cra', []);
  world.player.pos = { ...S };
  run(world, 18, () => ({ s1: true, aim: A })); // t=0.9 s: 288 px travelled
  assert.equal(world.projectiles.length, 1, 'still alive 288 px out');
  assert.ok(Math.abs(world.projectiles[0].pos.x - (S.x + 288)) < 1);
  const log = run(world, 3, () => ({ s1: true, aim: A })); // t=1.05 s: past 300 px
  assert.equal(world.projectiles.length, 0, 'the fireball must die at its 300 px range');
  assert.equal(log.filter((e) => e.kind === 'hit').length, 0, 'a whiffed fireball hits nothing');
});

test('cra: the fireball hits only the first of two wolves in its line, for 25', () => {
  const world = craWorld(23, 'cra', [
    { type: 'wolf', x: 550, y: 320 }, // 70 px out, on the line
    { type: 'wolf', x: 650, y: 320 }, // 170 px out, behind the first
  ]);
  world.player.pos = { ...S };
  const log = run(world, 30, () => ({ s1: true, aim: A })); // 1.5 s, past the hit
  const hits = (id) => log.filter((e) => e.kind === 'hit' && e.target === id);
  assert.deepEqual(hits(1).map((e) => e.damage), [25], 'the nearer wolf takes 25 exactly once');
  assert.equal(hits(2).length, 0, 'the farther wolf keeps full HP');
  assert.equal(world.monsters[0].hp, 40 - 25);
  assert.equal(world.monsters[1].hp, 40);
  assert.equal(world.projectiles.length, 0, 'the fireball vanishes on the hit');
  assert.equal(log.filter((e) => e.kind === 'cast').length, 1, 'one cast in 1.5 s (cd is 2 s)');
});

test('cra: Tornade hits every monster within 110 px of the player for 30, none outside', () => {
  const world = craWorld(24, 'cra', [
    { type: 'wolf', x: 540, y: 320 }, // 60 px: inside
    { type: 'skeleton', x: 500, y: 400 }, // 82 px: inside
    { type: 'wolf', x: 430, y: 260 }, // 78 px: inside
    { type: 'skeleton', x: 650, y: 320 }, // 170 px: outside
  ]);
  world.player.pos = { ...S };
  const log = run(world, 10, () => ({ s2: true, aim: A }));
  const casts = log.filter((e) => e.kind === 'cast' && e.name === 'Tornade');
  assert.equal(casts.length, 1, 'one cast in 0.5 s (cd is 6 s)');
  const hits = (id) => log.filter((e) => e.kind === 'hit' && e.target === id);
  assert.deepEqual(hits(1).map((e) => e.damage), [30]);
  assert.deepEqual(hits(2).map((e) => e.damage), [30]);
  assert.deepEqual(hits(3).map((e) => e.damage), [30]);
  assert.equal(hits(4).length, 0, 'the skeleton outside 110 px took nothing');
  assert.ok(world.player.cooldowns.s2 > 5, 'the tornado spent its 6 s cooldown');
});

test('cra: Tornade spends the cooldown even when it hits nothing', () => {
  const world = craWorld(25, 'cra', [{ type: 'skeleton', x: 650, y: 320 }]); // 170 px: outside
  world.player.pos = { ...S };
  const log = run(world, 10, () => ({ s2: true, aim: A }));
  assert.equal(log.filter((e) => e.kind === 'cast' && e.name === 'Tornade').length, 1);
  assert.equal(log.filter((e) => e.kind === 'hit').length, 0);
  assert.ok(world.player.cooldowns.s2 > 5, 'a whiffed tornado still spends the cooldown');
});

test('cra: Eau Vive heals 70 at half HP, capped at maxHp', () => {
  const world = craWorld(26, 'cra', []);
  world.player.pos = { ...S };
  world.player.hp = 75; // half of 150
  const log = run(world, 3, () => ({ s3: true, aim: A }));
  assert.equal(world.player.hp, 145, '75 + 70 = 145');
  const heals = log.filter((e) => e.kind === 'heal');
  assert.equal(heals.length, 1);
  assert.equal(heals[0].amount, 70);
  assert.equal(log.filter((e) => e.kind === 'cast' && e.name === 'Eau Vive').length, 1);
});

test('cra: Eau Vive at full HP heals 0 but still spends the 12 s cooldown and emits a cast', () => {
  const world = craWorld(27, 'cra', []);
  world.player.pos = { ...S };
  const log = run(world, 2, () => ({ s3: true, aim: A }));
  assert.equal(world.player.hp, 150, 'full HP stays full');
  const heals = log.filter((e) => e.kind === 'heal');
  assert.equal(heals.length, 1, 'the heal event is emitted even when nothing is restored');
  assert.equal(heals[0].amount, 0);
  assert.equal(log.filter((e) => e.kind === 'cast' && e.name === 'Eau Vive').length, 1);
  assert.ok(world.player.cooldowns.s3 > 11.8, `the full-HP cast still spent the cooldown, at ${world.player.cooldowns.s3}`);
});

test('iop regression: pressing 1-3 as an Iop still gets only Iop spells', () => {
  const world = craWorld(28, 'iop', [{ type: 'orik', x: 520, y: 320 }]); // 40 px: in Maudit range
  world.player.pos = { ...S };
  const log = run(world, 10, () => ({ s1: true, s2: true, s3: true, aim: A }));
  const names = log.filter((e) => e.kind === 'cast').map((e) => e.name).sort();
  assert.deepEqual(names, ['Charge', 'Coup Maudit', 'Coup Tonnerre']);
  assert.equal(world.projectiles.length, 0, 'the Iop casts no projectiles');
  assert.equal(log.filter((e) => e.kind === 'heal').length, 0, 'the Iop casts no heal');
});
