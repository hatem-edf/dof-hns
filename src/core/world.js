// The whole simulation state. step() runs the fixed system order from
// docs/design.md, every frame:
//   1. Cooldowns tick down.
//   2. Player moves (clamped to the map diamond).
//   3. Player casts (basic attack for now, spells from step 4).
//   4. Projectiles fly and hit (step 5).
//   5. Monsters decide and act (wolf AI from step 3, the rest wander).
//   6. Damage-over-time spells tick (step 4).
//   7. Pickups collect on touch (step 6).
//   8. Win and lose checks (defeat now, victory in step 8).
// Once status leaves 'playing' the simulation is frozen.
import { createRng } from './rng.js';
import { createPlayer, CLASSES } from './player.js';
import { spawnMonsters } from './zone.js';
import { monsterStep } from './monster.js';
import { hitTest, rollDamage, applyDamage } from './combat.js';
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
  if (world.status !== 'playing') return;

  const p = world.player;

  // 1. Cooldowns tick down.
  for (const key of Object.keys(p.cooldowns)) {
    p.cooldowns[key] = Math.max(0, p.cooldowns[key] - dt);
  }

  // 2. Player moves.
  const len = Math.hypot(input.move.x, input.move.y);
  if (len > 0) {
    const c = clampToMap(
      p.pos.x + (input.move.x / len) * p.stats.speed * dt,
      p.pos.y + (input.move.y / len) * p.stats.speed * dt
    );
    p.pos.x = c.x;
    p.pos.y = c.y;
  }

  // 3. Player basic attack (Frappe). Hits every living monster in range and
  //    arc; a whiffed swing (no target) does not spend the cooldown.
  if (input.basic && p.cooldowns.basic <= 0) {
    const t = CLASSES[p.class];
    const targets = world.monsters.filter((m) =>
      m.hp > 0 && hitTest(p.pos, input.aim, m.pos, t.basicRange, t.basicArc)
    );
    if (targets.length > 0) {
      p.cooldowns.basic = t.basicCd;
      world.events.push({ kind: 'cast' });
      for (const m of targets) {
        applyDamage(world, m, rollDamage(p.stats.damage, p.stats.crit, world.rng), 0);
      }
    }
  }

  // 4. Projectiles fly and hit (step 5, list is empty for now).

  // 5. Monsters decide and act.
  for (const m of world.monsters) {
    monsterStep(m, world, dt);
  }

  // 6. Damage-over-time spells tick (step 4).
  // 7. Pickups collect on touch (step 6).

  // 8. Win and lose checks: hp at 0 ends the run.
  if (p.hp <= 0) world.status = 'defeat';

  world.time += dt;
}
