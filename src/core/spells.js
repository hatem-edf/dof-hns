// Spell table (all six, docs/design.md) plus the Iop cast resolution.
// Cra's entries get name and cooldown now but cast nothing; their effects
// land in step 5.
// Fixed spell damage: 30 / 45 / 15. Monsters have no defense stat
// (MONSTER_TYPES defines none), so like the step 3 basic attack, 0 goes into
// applyDamage and the full fixed amount is dealt.
import { hitTest, applyDamage } from './combat.js';
import { clampToMap } from './map.js';

export const SPELLS = {
  iop: {
    s1: { name: 'Charge', cd: 4 },
    s2: { name: 'Coup Tonnerre', cd: 3 },
    s3: { name: 'Coup Maudit', cd: 8 },
  },
  cra: {
    s1: { name: 'Boule de Feu', cd: 2 },
    s2: { name: 'Tornade', cd: 6 },
    s3: { name: 'Eau Vive', cd: 12 },
  },
};

// Charge: 170 px in 0.25 s. A monster counts as "crossed" when its centre
// comes within DASH_HIT_RADIUS px of the dash path (the plan and design are
// silent on a radius; the player body is 14 px half-wide, a wolf 9).
export const CHARGE_DIST = 170;
export const CHARGE_TIME = 0.25;
export const CHARGE_SPEED = CHARGE_DIST / CHARGE_TIME; // 680 px/s
export const CHARGE_DAMAGE = 30;
export const DASH_HIT_RADIUS = 16;

// Coup Tonnerre: 45 in a 90 px, ±50° arc toward the aim.
export const TONNERRE_DAMAGE = 45;
export const TONNERRE_RANGE = 90;
export const TONNERRE_ARC = 50;

// Coup Maudit: 15 now, then 15 more at +1 s and +2 s on the same target.
export const MAUDIT_DAMAGE = 15;
export const MAUDIT_RANGE = 100;
export const MAUDIT_TICKS = 2;
export const MAUDIT_INTERVAL = 1;

// Distance from point (px, py) to the segment a->b. A zero-length segment
// (a dash step fully eaten by the map clamp) degrades to the point distance.
function pointSegDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const l2 = abx * abx + aby * aby;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / l2));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

// System 2, while a Charge is active: move the player along the dash
// direction instead of normal movement, clamp to the diamond (the border
// stops the dash), and hit each crossed enemy once per cast.
export function dashStep(world, dt) {
  const p = world.player;
  const d = p.dash;
  if (!d) return;

  const stepDist = Math.min(d.distLeft, CHARGE_SPEED * dt);
  const nx = p.pos.x + d.dirX * stepDist;
  const ny = p.pos.y + d.dirY * stepDist;
  const c = clampToMap(nx, ny);
  const crossed = world.monsters.filter(
    (m) =>
      m.hp > 0 &&
      !d.hitIds.includes(m.id) &&
      pointSegDist(m.pos.x, m.pos.y, p.pos.x, p.pos.y, c.x, c.y) <= DASH_HIT_RADIUS
  );

  p.pos.x = c.x;
  p.pos.y = c.y;
  d.distLeft -= stepDist;
  // The clamp moved the player less than requested: the border stopped the dash.
  if (c.x !== nx || c.y !== ny) d.distLeft = 0;
  if (d.distLeft <= 0) p.dash = null;

  for (const m of crossed) {
    d.hitIds.push(m.id);
    applyDamage(world, m, CHARGE_DAMAGE, 0);
  }
}

// System 3: resolve inputs s1 to s3 against the cooldowns. Called after the
// basic attack. Each slot acts at most once per frame and is gated by its
// own cooldown, so a held key recasts exactly when the cooldown runs out.
export function castSpells(world, input) {
  const p = world.player;
  for (const slot of ['s1', 's2', 's3']) {
    if (!input[slot] || p.cooldowns[slot] > 0) continue;
    if (p.class !== 'iop') continue; // Cra spells cast nothing until step 5.
    const spell = SPELLS.iop[slot];
    if (slot === 's1') castCharge(world, input.aim, spell);
    else if (slot === 's2') castTonnerre(world, input.aim, spell);
    else castMaudit(world, spell);
  }
}

// System 6: Coup Maudit ticks. The curse vanishes when its target is gone;
// refreshes happen at cast time, so world.dots holds at most one entry.
export function dotTick(world) {
  for (let i = world.dots.length - 1; i >= 0; i--) {
    const dot = world.dots[i];
    const m = world.monsters.find((mm) => mm.id === dot.targetId);
    if (!m) {
      world.dots.splice(i, 1); // the target died: the curse vanishes
      continue;
    }
    if (world.time < dot.nextAt) continue;
    applyDamage(world, m, MAUDIT_DAMAGE, 0);
    if (!world.monsters.includes(m)) {
      world.dots.splice(i, 1); // this tick was the killing blow
      continue;
    }
    dot.ticksLeft -= 1;
    if (dot.ticksLeft <= 0) world.dots.splice(i, 1);
    else dot.nextAt = world.time + MAUDIT_INTERVAL;
  }
}

function castCharge(world, aim, spell) {
  const p = world.player;
  const dx = aim.x - p.pos.x;
  const dy = aim.y - p.pos.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return; // the aim is exactly on the player: no direction to dash
  p.dash = { dirX: dx / len, dirY: dy / len, distLeft: CHARGE_DIST, hitIds: [] };
  p.cooldowns.s1 = spell.cd;
  world.events.push({ kind: 'cast', name: spell.name });
}

function castTonnerre(world, aim, spell) {
  const p = world.player;
  const targets = world.monsters.filter(
    (m) => m.hp > 0 && hitTest(p.pos, aim, m.pos, TONNERRE_RANGE, TONNERRE_ARC)
  );
  // A full cast: it spends the cooldown even when the arc hits nothing. The
  // design's whiff rule covers melee swings, and Coup Maudit is the Iop
  // spell that explicitly requires a target.
  p.cooldowns.s2 = spell.cd;
  world.events.push({ kind: 'cast', name: spell.name });
  for (const m of targets) {
    applyDamage(world, m, TONNERRE_DAMAGE, 0);
  }
}

function castMaudit(world, spell) {
  const p = world.player;
  let nearest = null;
  let best = Infinity;
  for (const m of world.monsters) {
    if (m.hp <= 0) continue;
    const dist = Math.hypot(m.pos.x - p.pos.x, m.pos.y - p.pos.y);
    if (dist <= MAUDIT_RANGE && dist < best) {
      nearest = m;
      best = dist;
    }
  }
  // Like the basic-attack whiff rule: no enemy in range, nothing happens and
  // no cooldown is spent.
  if (!nearest) return;
  p.cooldowns.s3 = spell.cd;
  world.events.push({ kind: 'cast', name: spell.name });
  applyDamage(world, nearest, MAUDIT_DAMAGE, 0);
  if (!world.monsters.includes(nearest)) return; // the strike itself killed it
  // A new cast refreshes the curse in place; it never stacks.
  const dot = world.dots[0];
  if (dot) {
    dot.targetId = nearest.id;
    dot.ticksLeft = MAUDIT_TICKS;
    dot.nextAt = world.time + MAUDIT_INTERVAL;
  } else {
    world.dots.push({
      targetId: nearest.id,
      ticksLeft: MAUDIT_TICKS,
      nextAt: world.time + MAUDIT_INTERVAL,
    });
  }
}
