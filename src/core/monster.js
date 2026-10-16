// Monster stat tables, idle wander, and the step 3 wolf AI. docs/design.md
// is the source of truth for the numbers.
import { clampToMap } from './map.js';

// Idle wander stays within this many px of the monster's home point.
export const WANDER_RADIUS = 40;

// bodyRadius is the monster's half-width: the projectile hit test in system 4
// (and the scene's body drawing) use it, so a fireball touches the wolf's body
// edge, not its centre point.
export const MONSTER_TYPES = {
  wolf: {
    maxHp: 40,
    damage: 8,
    speed: 130,
    aggroRadius: 120,
    attackRange: 45,
    windup: 0.5,
    atkCd: 1.2,
    bodyRadius: 9,
    gold: [3, 6],
  },
  skeleton: {
    maxHp: 70,
    damage: 12,
    speed: 90,
    aggroRadius: 160,
    attackRange: 220,
    windup: 0.4,
    atkCd: 2.2,
    bodyRadius: 11,
    gold: [5, 10],
  },
  orik: {
    maxHp: 400,
    damage: 20,
    heavyDamage: 40,
    speed: 75,
    aggroRadius: 150,
    attackRange: 60,
    windup: 0.6,
    atkCd: 1.4,
    heavyWindup: 1.5,
    heavyCd: 6,
    bodyRadius: 17,
    gold: [15, 25],
  },
};

export function createMonster(type, id, home) {
  const t = MONSTER_TYPES[type];
  if (!t) throw new Error('unknown monster type: ' + type);
  return {
    id,
    type,
    home: { x: home.x, y: home.y },
    pos: { x: home.x, y: home.y },
    hp: t.maxHp,
    maxHp: t.maxHp,
    state: 'idle',
    windupT: 0,
    atkCd: 0,
    heavyCd: 0,
    wanderTarget: null,
    wanderT: 0,
  };
}

// Pack alert: an aggroing wolf pulls every other idle wolf within this many
// px into the fight. Leash: past this distance from home, a chasing wolf
// gives up and walks back. Both from docs/design.md.
export const PACK_ALERT_RADIUS = 150;
export const LEASH_RADIUS = 280;

// Idle wander: walk to a random point inside the WANDER_RADIUS disc around
// home, pause, repeat. All randomness comes from the world's seeded rng so
// the simulation stays deterministic. The disc is convex, so the straight
// line between two points inside it never leaves it; the final clamp is a
// safety net for the overshoot at frame boundaries.
export function wanderStep(m, rng, dt) {
  const t = MONSTER_TYPES[m.type];

  if (!m.wanderTarget && m.wanderT <= 0) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * WANDER_RADIUS;
    m.wanderTarget = {
      x: m.home.x + Math.cos(angle) * dist,
      y: m.home.y + Math.sin(angle) * dist,
    };
    m.wanderT = 0.6 + rng() * 1.8;
  }

  if (m.wanderTarget) {
    const dx = m.wanderTarget.x - m.pos.x;
    const dy = m.wanderTarget.y - m.pos.y;
    const d = Math.hypot(dx, dy);
    const dist = t.speed * dt;
    if (d <= dist) {
      m.pos.x = m.wanderTarget.x;
      m.pos.y = m.wanderTarget.y;
      m.wanderTarget = null; // stand still until the pause timer expires
    } else {
      m.pos.x += (dx / d) * dist;
      m.pos.y += (dy / d) * dist;
    }
  }

  m.wanderT -= dt;

  const hdx = m.pos.x - m.home.x;
  const hdy = m.pos.y - m.home.y;
  const hd = Math.hypot(hdx, hdy);
  if (hd > WANDER_RADIUS) {
    m.pos.x = m.home.x + (hdx / hd) * WANDER_RADIUS;
    m.pos.y = m.home.y + (hdy / hd) * WANDER_RADIUS;
  }
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function moveToward(m, target, speed, dt) {
  const dx = target.x - m.pos.x;
  const dy = target.y - m.pos.y;
  const d = Math.hypot(dx, dy);
  const step = speed * dt;
  if (d <= step) {
    m.pos.x = target.x;
    m.pos.y = target.y;
  } else {
    m.pos.x += (dx / d) * step;
    m.pos.y += (dy / d) * step;
  }
}

// Wolf state machine (docs/design.md): idle -> (aggro at aggroRadius) chase ->
// (in attackRange, off cooldown) windup -> strike 8 damage -> chase, with a
// pack alert on the idle->chase transition and a leash back home past
// LEASH_RADIUS. Damage only lands when the windup ends; the windup is the
// dodge window. Whiffed windups still pay the attack cooldown.
export function wolfStep(m, world, dt) {
  const t = MONSTER_TYPES.wolf;
  const p = world.player;
  const dPlayer = dist(m.pos, p.pos);

  if (m.state === 'idle') {
    if (dPlayer <= t.aggroRadius) {
      m.state = 'chase';
      for (const other of world.monsters) {
        if (other !== m && other.type === 'wolf' && other.state === 'idle' &&
            dist(m.pos, other.pos) <= PACK_ALERT_RADIUS) {
          other.state = 'chase';
        }
      }
      return; // the wolf turns; it moves from the next frame on
    }
    wanderStep(m, world.rng, dt);
    return;
  }

  // Leash: any time in chase/windup, past LEASH_RADIUS from home gives up.
  if ((m.state === 'chase' || m.state === 'windup') && dist(m.pos, m.home) > LEASH_RADIUS) {
    m.state = 'return';
  }

  if (m.state === 'chase') {
    if (dPlayer <= t.attackRange && m.atkCd <= 0) {
      m.state = 'windup';
      m.windupT = t.windup;
      return; // a winding-up wolf stops moving
    }
    moveToward(m, p.pos, t.speed, dt);
    return;
  }

  if (m.state === 'windup') {
    m.windupT -= dt;
    if (m.windupT <= 0) {
      if (dist(m.pos, p.pos) <= t.attackRange) {
        const dealt = Math.max(1, t.damage - p.stats.defense);
        p.hp = Math.max(0, p.hp - dealt);
        world.events.push({ kind: 'hit', target: 'player', damage: dealt });
      }
      m.atkCd = t.atkCd;
      m.state = 'chase';
    }
    return;
  }

  // 'return': walk back to home at full speed, idle on arrival.
  if (dist(m.pos, m.home) <= t.speed * dt) {
    m.pos.x = m.home.x;
    m.pos.y = m.home.y;
    m.state = 'idle';
  } else {
    moveToward(m, m.home, t.speed, dt);
  }
}

// One frame for one monster: tick the attack cooldown, run the type's AI
// (wolves get the full state machine, the others keep their idle wander
// until steps 4-7 give them AI), then clamp into the diamond as a cheap
// safety net. world.js calls this for every monster, in list order.
export function monsterStep(m, world, dt) {
  m.atkCd = Math.max(0, m.atkCd - dt);
  if (m.type === 'wolf') {
    wolfStep(m, world, dt);
  } else if (m.state === 'idle') {
    wanderStep(m, world.rng, dt);
  }
  const c = clampToMap(m.pos.x, m.pos.y);
  m.pos.x = c.x;
  m.pos.y = c.y;
}
