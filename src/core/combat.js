// Combat rules: arc/range hit test, damage roll with crit, damage application.
// Plain functions, no Phaser, no Math.random — every roll comes through the
// rng passed in (world.rng), so the same seed + input sequence always
// produces the same fight.
import { MONSTER_TYPES } from './monster.js';

// True if targetPos is within `range` px of playerPos AND within ±arcDeg of
// the direction from playerPos toward aim.
export function hitTest(playerPos, aim, targetPos, range, arcDeg) {
  const dist = Math.hypot(targetPos.x - playerPos.x, targetPos.y - playerPos.y);
  if (dist > range) return false;
  const toAim = Math.atan2(aim.y - playerPos.y, aim.x - playerPos.x);
  const toTarget = Math.atan2(targetPos.y - playerPos.y, targetPos.x - playerPos.x);
  let diff = toTarget - toAim;
  if (diff > Math.PI) diff -= Math.PI * 2;
  else if (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= (arcDeg * Math.PI) / 180;
}

// base with ±10% variance, then doubled if the crit roll lands under
// critChance. Two rng calls per hit: one for variance, one for the crit.
export function rollDamage(base, critChance, rng) {
  let dmg = base * (1 + (rng() * 2 - 1) * 0.1);
  if (rng() < critChance) dmg *= 2;
  return dmg;
}

// Subtract defense (floor 1 min), apply to the monster, and emit a 'hit'
// event. On the killing blow emit 'kill', drop the type's gold as a pickup
// at the death position, bump the kill counter, and remove the monster.
// Returns the damage actually dealt.
export function applyDamage(world, monster, dmg, defense) {
  const dealt = Math.max(1, dmg - defense);
  monster.hp -= dealt;
  world.events.push({ kind: 'hit', target: monster.id, damage: dealt });
  if (monster.hp > 0) return dealt;

  const t = MONSTER_TYPES[monster.type];
  const [goldMin, goldMax] = t.gold;
  world.events.push({ kind: 'kill', id: monster.id });
  world.pickups.push({
    kind: 'gold',
    value: Math.floor(goldMin + world.rng() * (goldMax - goldMin + 1)),
    pos: { x: monster.pos.x, y: monster.pos.y },
  });
  world.player.kills += 1;
  world.monsters.splice(world.monsters.indexOf(monster), 1);
  return dealt;
}
