import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, PLAYER_SPAWN } from '../src/core/world.js';
import { SPAWN_TABLE, DECOR } from '../src/core/zone.js';
import { gridToPx, pxToGrid, MAP_SIZE } from '../src/core/map.js';

// The design's spawn table (docs/design.md, "Map: Forêt d'Astrub"), copied
// here so a typo in zone.js fails the build instead of the zone.
const DESIGN_SPAWNS = [
  { type: 'wolf', pack: 'A', col: 2, row: 1 },
  { type: 'wolf', pack: 'A', col: 3, row: 2 },
  { type: 'wolf', pack: 'A', col: 4, row: 1 },
  { type: 'wolf', pack: 'B', col: 8, row: 1 },
  { type: 'wolf', pack: 'B', col: 9, row: 2 },
  { type: 'wolf', pack: 'B', col: 10, row: 2 },
  { type: 'skeleton', col: 2, row: 4 },
  { type: 'skeleton', col: 5, row: 3 },
  { type: 'skeleton', col: 8, row: 4 },
  { type: 'skeleton', col: 10, row: 3 },
  { type: 'orik', col: 6, row: 3 },
];

const world = createWorld('iop', 999);

test('zone: 6 wolves, 4 skeletons, 1 Orik', () => {
  assert.equal(world.monsters.length, 11);
  const counts = {};
  for (const m of world.monsters) counts[m.type] = (counts[m.type] || 0) + 1;
  assert.deepEqual(counts, { wolf: 6, skeleton: 4, orik: 1 });
});

test('zone: the spawn table matches the design tiles', () => {
  assert.equal(SPAWN_TABLE.length, DESIGN_SPAWNS.length);
  SPAWN_TABLE.forEach((s, i) => {
    assert.equal(s.type, DESIGN_SPAWNS[i].type);
    assert.equal(s.col, DESIGN_SPAWNS[i].col);
    assert.equal(s.row, DESIGN_SPAWNS[i].row);
    if (DESIGN_SPAWNS[i].pack) assert.equal(s.pack, DESIGN_SPAWNS[i].pack);
  });
});

test('zone: every monster stands on its design tile', () => {
  world.monsters.forEach((m, i) => {
    const s = DESIGN_SPAWNS[i];
    assert.deepEqual(m.home, gridToPx(s.col, s.row), `monster ${m.id} (${m.type}) not on (${s.col}, ${s.row})`);
    assert.deepEqual(m.pos, m.home, `monster ${m.id} not at its home before the first step`);
    const g = pxToGrid(m.home.x, m.home.y);
    assert.deepEqual(g, { col: s.col, row: s.row });
  });
});

test('zone: every spawn is inside the diamond', () => {
  for (const m of world.monsters) {
    const { col, row } = pxToGrid(m.home.x, m.home.y);
    assert.ok(col >= -0.5 && col <= MAP_SIZE - 0.5, `${m.type} at col ${col} left the diamond`);
    assert.ok(row >= -0.5 && row <= MAP_SIZE - 0.5, `${m.type} at row ${row} left the diamond`);
  }
});

test('zone: no spawn is within 3 tiles of the player spawn', () => {
  for (const m of world.monsters) {
    const g = pxToGrid(m.home.x, m.home.y);
    const dist = Math.hypot(g.col - PLAYER_SPAWN.col, g.row - PLAYER_SPAWN.row);
    assert.ok(dist >= 3, `${m.type} at (${g.col}, ${g.row}) is only ${dist} tiles from the player spawn`);
  }
});

test('zone: each wolf pack has all 3 members within 150 px', () => {
  for (const pack of ['A', 'B']) {
    const members = world.monsters.filter((m) => m.type === 'wolf' && m.pack === pack);
    assert.equal(members.length, 3, `wolf pack ${pack} should have 3 members`);
    for (const a of members) {
      for (const b of members) {
        if (a.id === b.id) continue;
        const d = Math.hypot(a.home.x - b.home.x, a.home.y - b.home.y);
        assert.ok(d <= 150, `pack ${pack}: wolves ${a.id} and ${b.id} are ${d} px apart`);
      }
    }
  }
});

test('zone: decor is four trees and two rocks on fixed tiles', () => {
  const kinds = DECOR.map((d) => d.kind).sort();
  assert.deepEqual(kinds, ['rock', 'rock', 'tree', 'tree', 'tree', 'tree']);
  assert.deepEqual(world.zone.decor, DECOR);
  assert.deepEqual(world.zone.spawns, SPAWN_TABLE);
});
