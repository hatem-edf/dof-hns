import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TILE_W,
  TILE_H,
  gridToScreen,
  gridOrigin,
  diamondCorners,
} from '../src/core/iso.js';

test('tile constants: 64x32 diamond', () => {
  assert.equal(TILE_W, 64);
  assert.equal(TILE_H, 32);
});

test('gridToScreen: tile (0,0) sits at the origin', () => {
  assert.deepEqual(gridToScreen(0, 0, 10, 20), { x: 10, y: 20 });
});

test('gridToScreen: +1 col goes down-right, +1 row goes down-left', () => {
  assert.deepEqual(gridToScreen(1, 0, 0, 0), { x: TILE_W / 2, y: TILE_H / 2 });
  assert.deepEqual(gridToScreen(0, 1, 0, 0), { x: -TILE_W / 2, y: TILE_H / 2 });
});

test('gridOrigin: centres an N x N grid on the given point', () => {
  const o = gridOrigin(12, 480, 320);
  const mid = gridToScreen((12 - 1) / 2, (12 - 1) / 2, o.x, o.y);
  assert.equal(mid.x, 480);
  assert.equal(mid.y, 320);
});

test('diamondCorners: west, north, east, south around the centre', () => {
  assert.deepEqual(diamondCorners(100, 50), [
    { x: 100 - TILE_W / 2, y: 50 },
    { x: 100, y: 50 - TILE_H / 2 },
    { x: 100 + TILE_W / 2, y: 50 },
    { x: 100, y: 50 + TILE_H / 2 },
  ]);
});
