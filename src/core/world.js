// The whole simulation state. step() runs the fixed system order from
// docs/design.md, every frame:
//   1. Cooldowns tick down.
//   2. Player moves (clamped to the map diamond; a Charge dash replaces
//      normal movement while active).
//   3. Player casts (basic attack, then spells 1 to 3).
//   4. Projectiles fly and hit (system 4 below).
//   5. Monsters decide and act (wolf AI from step 3, the rest wander).
//   6. Damage-over-time spells tick (Coup Maudit).
//   7. Pickups collect on touch (step 6).
//   8. Win and lose checks (defeat now, victory in step 8).
// Once status leaves 'playing' the simulation is frozen.
import { createRng } from './rng.js';
import { createPlayer, CLASSES } from './player.js';
import { spawnMonsters } from './zone.js';
import { monsterStep, MONSTER_TYPES } from './monster.js';
import { hitTest, rollDamage, applyDamage } from './combat.js';
import { castSpells, dashStep, dotTick, pointSegDist, FIREBALL_RADIUS } from './spells.js';
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

  // 2. Player moves. A Charge dash replaces normal movement while active.
  if (p.dash) {
    dashStep(world, dt);
  } else {
    const len = Math.hypot(input.move.x, input.move.y);
    if (len > 0) {
      const c = clampToMap(
        p.pos.x + (input.move.x / len) * p.stats.speed * dt,
        p.pos.y + (input.move.y / len) * p.stats.speed * dt
      );
      p.pos.x = c.x;
      p.pos.y = c.y;
    }
  }

  // 3. Player casts: basic attack (Frappe), then spells 1 to 3. The basic
  //    attack hits every living monster in range and arc; a whiffed swing
  //    (no target) does not spend the cooldown.
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
  castSpells(world, input);

  // 4. Projectiles fly and hit.
  projectileStep(world, dt);

  // 5. Monsters decide and act.
  for (const m of world.monsters) {
    monsterStep(m, world, dt);
  }

  // 6. Damage-over-time spells tick (Coup Maudit).
  dotTick(world);
  // 7. Pickups collect on touch (step 6).

  // 8. Win and lose checks: hp at 0 ends the run.
  if (p.hp <= 0) world.status = 'defeat';

  world.time += dt;
}

// System 4: each projectile moves straight along dir by speed*dt (no further
// than rangeLeft), and dies when rangeLeft runs out. A projectile hits the
// first living enemy whose body — bodyRadius plus the fireball's own radius —
// comes within the flight segment this frame, so a fast projectile cannot
// tunnel a wolf between frames (the same segment test Charge uses).
function projectileStep(world, dt) {
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const pr = world.projectiles[i];
    const stepDist = Math.min(pr.speed * dt, pr.rangeLeft);
    const ex = pr.pos.x + pr.dir.x * stepDist;
    const ey = pr.pos.y + pr.dir.y * stepDist;
    const hit = firstEnemyOnSegment(world, pr.pos.x, pr.pos.y, ex, ey);
    if (hit) {
      applyDamage(world, hit, pr.damage, 0);
      world.projectiles.splice(i, 1); // the projectile vanishes on hit
      continue;
    }
    pr.pos.x = ex;
    pr.pos.y = ey;
    pr.rangeLeft -= stepDist;
    if (pr.rangeLeft <= 0) world.projectiles.splice(i, 1);
  }
}

// The first living enemy on the segment: the one whose centre is within
// bodyRadius + FIREBALL_RADIUS of it and whose closest point on the segment
// is nearest the muzzle. Ties are impossible in practice (monsters don't
// overlap), so the first match wins.
function firstEnemyOnSegment(world, sx, sy, ex, ey) {
  const abx = ex - sx;
  const aby = ey - sy;
  const l2 = abx * abx + aby * aby;
  let best = null;
  let bestT = Infinity;
  for (const m of world.monsters) {
    if (m.hp <= 0) continue;
    const touch = MONSTER_TYPES[m.type].bodyRadius + FIREBALL_RADIUS;
    if (pointSegDist(m.pos.x, m.pos.y, sx, sy, ex, ey) > touch) continue;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((m.pos.x - sx) * abx + (m.pos.y - sy) * aby) / l2));
    if (t < bestT) {
      best = m;
      bestT = t;
    }
  }
  return best;
}
