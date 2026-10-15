// Monster stat tables and idle wander. docs/design.md is the source of truth
// for the numbers; the aggro/attack/gold fields are data for the step 3+ AI.

// Idle wander stays within this many px of the monster's home point.
export const WANDER_RADIUS = 40;

export const MONSTER_TYPES = {
  wolf: {
    maxHp: 40,
    damage: 8,
    speed: 130,
    aggroRadius: 120,
    attackRange: 45,
    windup: 0.5,
    atkCd: 1.2,
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
