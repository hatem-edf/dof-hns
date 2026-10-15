// The whole simulation state. step() runs the fixed system order from
// docs/design.md; step 2 adds monster idle wander, the rest slot in later.
import { createRng } from './rng.js';
import { createPlayer } from './player.js';
import { spawnMonsters } from './zone.js';
import { wanderStep } from './monster.js';
import { MAP_SIZE, gridToPx, clampToMap } from './map.js';

// Player spawn tile, bottom corner of the diamond (docs/design.md).
export const PLAYER_SPAWN = { col: 10, row: 11 };

export function createWorld(className, seed) {
  const world = {
    seed,
    rng: createRng(seed),
    time: 0,
    status: 'playing',
    zone: { size: MAP_SIZE, spawns: [], decor: [] },
    player: createPlayer(className, gridToPx(PLAYER_SPAWN.col, PLAYER_SPAWN.row)),
    dots: [],
    monsters: [],
    projectiles: [],
    pickups: [],
    effects: [],
    events: [],
  };
  spawnMonsters(world);
  return world;
}

export function step(world, input, dt) {
  world.events.length = 0;

  const p = world.player;
  const len = Math.hypot(input.move.x, input.move.y);
  if (len > 0) {
    const c = clampToMap(
      p.pos.x + (input.move.x / len) * p.stats.speed * dt,
      p.pos.y + (input.move.y / len) * p.stats.speed * dt
    );
    p.pos.x = c.x;
    p.pos.y = c.y;
  }

  // 5. Monsters decide and act: idle wander only until step 3 adds aggro.
  for (const m of world.monsters) {
    if (m.state === 'idle') wanderStep(m, world.rng, dt);
  }

  world.time += dt;
}
