// Class stat tables. docs/design.md is the source of truth for these numbers.

export const CLASSES = {
  iop: {
    maxHp: 220,
    damage: 20,
    defense: 6,
    speed: 150,
    crit: 0.10,
    basicRange: 70,
    basicArc: 40,
    basicCd: 0.45,
  },
  cra: {
    maxHp: 150,
    damage: 14,
    defense: 2,
    speed: 165,
    crit: 0.15,
    basicRange: 95,
    basicArc: 35,
    basicCd: 0.4,
  },
};

export function createPlayer(className, pos) {
  const t = CLASSES[className];
  if (!t) throw new Error('unknown class: ' + className);
  return {
    class: className,
    pos: { x: pos.x, y: pos.y },
    hp: t.maxHp,
    maxHp: t.maxHp,
    stats: { damage: t.damage, defense: t.defense, speed: t.speed, crit: t.crit },
    equipment: { weapon: null, armor: null },
    kills: 0,
    gold: 0,
    cooldowns: { basic: 0, s1: 0, s2: 0, s3: 0 },
    dash: null, // active Charge: { dirX, dirY, distLeft, hitIds }
  };
}
