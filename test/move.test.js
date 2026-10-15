import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step } from '../src/core/world.js';
import { pxToGrid } from '../src/core/map.js';

const SPAWN = { x: 448, y: 480 }; // grid tile (10, 11) in px

const input = (move) => ({
  move,
  aim: { x: 0, y: 0 },
  basic: false,
  s1: false,
  s2: false,
  s3: false,
});

test('move: one second of pure up moves the Iop exactly 150 px', () => {
  const world = createWorld('iop', 123);
  assert.deepEqual(world.player.pos, SPAWN);
  step(world, input({ x: 0, y: -1 }), 1);
  assert.deepEqual(world.player.pos, { x: 448, y: 330 });
  assert.equal(world.time, 1);
});

test('move: ten frames of 50 ms equal one frame of 500 ms', () => {
  const one = createWorld('iop', 7);
  step(one, input({ x: 0, y: -1 }), 0.5);

  const many = createWorld('iop', 7);
  for (let i = 0; i < 10; i++) step(many, input({ x: 0, y: -1 }), 0.05);

  assert.deepEqual(one.player.pos, { x: 448, y: 405 });
  assert.deepEqual(many.player.pos, one.player.pos);
  assert.ok(Math.abs(many.time - 0.5) < 1e-9);
});

test('move: the player never leaves the diamond under diagonal input', () => {
  const world = createWorld('iop', 42);
  const diag = input({ x: 1, y: 1 });
  for (let i = 0; i < 300; i++) {
    step(world, diag, 0.1);
    const g = pxToGrid(world.player.pos.x, world.player.pos.y);
    assert.ok(g.col >= -0.5 - 1e-9 && g.col <= 11.5 + 1e-9,
      `col ${g.col} left the diamond at t=${world.time}`);
    assert.ok(g.row >= -0.5 - 1e-9 && g.row <= 11.5 + 1e-9,
      `row ${g.row} left the diamond at t=${world.time}`);
  }
  // 30 s of down-right diagonal runs into the bottom corner and sticks.
  assert.deepEqual(world.player.pos, { x: 480, y: 512 });
});
