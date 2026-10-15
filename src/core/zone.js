// Forêt d'Astrub: the spawn table and decor. docs/design.md is the source of
// truth for these tiles; test/zone.test.js mirrors the table so a typo fails.
import { gridToPx } from './map.js';
import { createMonster } from './monster.js';

export const ZONE_NAME = "Forêt d'Astrub";

export const SPAWN_TABLE = [
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

// Visual only, no collision (docs/design.md: four trees, two rocks).
export const DECOR = [
  { kind: 'tree', col: 1, row: 6 },
  { kind: 'tree', col: 6, row: 7 },
  { kind: 'tree', col: 3, row: 8 },
  { kind: 'tree', col: 11, row: 5 },
  { kind: 'rock', col: 7, row: 6 },
  { kind: 'rock', col: 4, row: 10 },
];

// Fills world.zone.spawns/decor and builds world.monsters from the table.
export function spawnMonsters(world) {
  world.zone.spawns = SPAWN_TABLE;
  world.zone.decor = DECOR;
  world.monsters = SPAWN_TABLE.map((s, i) => {
    const m = createMonster(s.type, i + 1, gridToPx(s.col, s.row));
    if (s.pack) m.pack = s.pack;
    return m;
  });
  return world.monsters;
}
