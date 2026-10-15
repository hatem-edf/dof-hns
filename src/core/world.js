// The whole simulation state. step() runs the fixed system order from
// docs/design.md; step 1 implements movement only, the rest slot in later.
import { createRng } from './rng.js';
import { createPlayer } from './player.js';
import { MAP_SIZE, gridToPx, clampToMap } from './map.js';

// Player spawn tile, bottom corner of the diamond (docs/design.md).
export const PLAYER_SPAWN = { col: 10, row: 11 };

export function createWorld(className, seed) {
  return {
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

  world.time += dt;
}
