import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step } from '../src/core/world.js';
import { WANDER_RADIUS } from '../src/core/monster.js';

const idle = {
  move: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  basic: false,
  s1: false,
  s2: false,
  s3: false,
};

function runIdle(world, frames = 100, dt = 0.05) {
  for (let i = 0; i < frames; i++) step(world, idle, dt);
}

test('wander: 5 simulated seconds of idle keep every wolf within 40 px of home', () => {
  const world = createWorld('iop', 4242);
  runIdle(world);
  assert.ok(Math.abs(world.time - 5) < 1e-9);
  const wolves = world.monsters.filter((m) => m.type === 'wolf');
  assert.equal(wolves.length, 6);
  for (const m of wolves) {
    const d = Math.hypot(m.pos.x - m.home.x, m.pos.y - m.home.y);
    assert.ok(d <= WANDER_RADIUS + 1e-9, `wolf ${m.id} wandered ${d} px from home`);
  }
});

test('wander: skeletons and Orik also stay within 40 px of home', () => {
  const world = createWorld('cra', 777);
  runIdle(world);
  for (const m of world.monsters) {
    const d = Math.hypot(m.pos.x - m.home.x, m.pos.y - m.home.y);
    assert.ok(d <= WANDER_RADIUS + 1e-9, `${m.type} ${m.id} wandered ${d} px from home`);
  }
});

test('wander: idle monsters actually move', () => {
  const world = createWorld('iop', 4242);
  runIdle(world);
  assert.ok(
    world.monsters.some((m) => m.pos.x !== m.home.x || m.pos.y !== m.home.y),
    'every monster is still at home after 5 s'
  );
});

test('wander: the same seed replays the same positions', () => {
  const a = createWorld('iop', 31337);
  const b = createWorld('iop', 31337);
  for (let i = 0; i < 100; i++) {
    step(a, idle, 0.05);
    step(b, idle, 0.05);
  }
  a.monsters.forEach((m, i) => {
    assert.deepEqual(m.pos, b.monsters[i].pos, `monster ${m.id} (${m.type}) diverged between identical seeds`);
  });
});

test('wander: a different seed wanders differently', () => {
  const a = createWorld('iop', 31337);
  const c = createWorld('iop', 31338);
  runIdle(a);
  runIdle(c);
  const differs = a.monsters.some(
    (m, i) => m.pos.x !== c.monsters[i].pos.x || m.pos.y !== c.monsters[i].pos.y
  );
  assert.ok(differs, 'seeds 31337 and 31338 produced identical wander paths');
});
