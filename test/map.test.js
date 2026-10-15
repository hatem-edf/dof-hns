import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORIGIN,
  gridToPx,
  pxToGrid,
  clampToMap,
  mapCorners,
} from '../src/core/map.js';

test('map: grid origin is (480, 144) on the 960x640 canvas', () => {
  assert.deepEqual(ORIGIN, { x: 480, y: 144 });
  assert.deepEqual(gridToPx(0, 0), { x: 480, y: 144 });
});

test('map: diamond corners are top, right, bottom, left', () => {
  assert.deepEqual(mapCorners(), [
    { x: 480, y: 128 },
    { x: 864, y: 320 },
    { x: 480, y: 512 },
    { x: 96, y: 320 },
  ]);
});

test('map: a point pushed past the top edge clamps to the diamond border', () => {
  const spawn = gridToPx(10, 11);
  const p = clampToMap(spawn.x, spawn.y - 400);
  assert.deepEqual(p, { x: 480, y: 128 });
});

test('map: points pushed past the top-left and top-right edges clamp onto them', () => {
  assert.deepEqual(clampToMap(300, 68), { x: 450, y: 143 });
  assert.deepEqual(clampToMap(692, 84), { x: 542, y: 159 });
});

test('map: a point already on an edge is unchanged', () => {
  assert.deepEqual(clampToMap(400, 168), { x: 400, y: 168 });
  assert.deepEqual(clampToMap(592, 184), { x: 592, y: 184 });
});

test('map: a point inside the diamond is unchanged', () => {
  assert.deepEqual(clampToMap(480, 320), { x: 480, y: 320 });
});

test('map: px to grid round trip returns the starting point', () => {
  const p = pxToGrid(500, 300);
  assert.deepEqual(gridToPx(p.col, p.row), { x: 500, y: 300 });
});
