# dof-hns design, v0.1

dof-hns is a real-time isometric hack & slash in the browser, with Dofus classes,
spells, monsters, and names. v0.1 is one beatable zone with two playable classes.
You move with the keyboard, aim with the mouse, cast spells on cooldowns, kill
every monster in Forêt d'Astrub, and see a victory screen.

## Core loop

Pick a class. Hunt the forest. Kill, pick up, repeat. All 11 monsters dead is
the win.

One tight sentence for the moment-to-moment loop: move into range, swing, keep
moving, spend a spell when the cooldown is ready, pick up the gold, repeat.

The game runs a single simulation in `src/core/`. Phaser never makes a rule
decision. The loop:

1. The scene reads input (WASD, mouse position, left click, keys 1 to 3) and
   passes it to the core as an `input` object.
2. The core advances the world by the frame's `dt` with `step(world, input, dt)`.
3. The scene draws the world: tiles, monsters, player, projectiles, pickups,
   effects, HUD.

Systems inside `step` run in this fixed order, every frame:

1. Cooldowns tick down.
2. Player moves (clamped to the map diamond).
3. Player casts (basic attack or a spell, if the input asks and the cooldown
   allows).
4. Projectiles fly and hit.
5. Monsters decide and act (idle, chase, wind up, strike, return).
6. Damage-over-time spells tick.
7. Pickups collect on touch.
8. Win and lose checks.

The core is deterministic. It uses a seeded RNG (`mulberry32`), never
`Math.random`, and never `Date`. The same seed and the same input sequence
always produce the same fight. That is what makes the tests and the headless
screenshot tool meaningful.

## The world, one data shape

Everything the scene draws and everything the tests assert on lives in one
plain object:

```js
world = {
  seed: 12345,
  rng: () => number,        // seeded, deterministic
  time: 0,                  // seconds since the run started
  status: 'playing',        // or 'victory', 'defeat'
  zone: { size: 12, spawns: [...], decor: [...] },
  player: {
    class: 'iop',           // or 'cra'
    pos: { x, y },          // iso screen space, px
    hp: 220, maxHp: 220,
    stats: { damage: 20, defense: 6, speed: 150, crit: 0.10 },
    equipment: { weapon: null, armor: null },
    kills: 0, gold: 0,
    cooldowns: { basic: 0, s1: 0, s2: 0, s3: 0 },
    dash: null,             // active Charge: { dirX, dirY, distLeft, hitIds };
                            // an enemy is "crossed" within 16 px of the dash path
  },
  dots: [{ targetId, ticksLeft, nextAt }],   // active Coup Maudit, on monsters
  monsters: [{ id, type, home: { x, y }, pos, hp, maxHp, state, windupT, atkCd, heavyCd }],
  projectiles: [{ owner, pos, dir, speed, rangeLeft, damage }],
  pickups: [{ kind: 'gold' | 'item', value, pos }],
  effects: [{ kind, pos, text, t }],   // hit flashes, damage numbers, death fades
  events: [],               // appended this tick: 'hit', 'kill', 'cast', 'pickup', ...
}

input = {
  move: { x: -1..1, y: -1..1 },   // from WASD
  aim: { x, y },                  // mouse position, px
  basic: bool, s1: bool, s2: bool, s3: bool,
}
```

`world.events` is the test surface. Tests script inputs, run `step` for N
seconds, and assert on `events`, positions, hp, and `status`. They never reach
into renderer state.

## Controls

- WASD or arrow keys: move, screen-relative.
- Mouse: aim. Everything hits toward the cursor.
- Left click: basic attack (Frappe).
- Keys `1`, `2`, and `3`: the class's three spells.
- `R`: restart the run (end screens only). `C`: back to class select (end screens only).

## Classes

Both classes share the stat model: max HP, damage (with ±10% variance per hit),
defense (flat reduction per hit, minimum 1 damage), move speed (px/s), and
crit chance (crits deal 2x damage). No AP, no mana, no grid costs. Spells are
limited by cooldowns only. A whiffed swing (no target in range and arc) does
not spend the cooldown. Spell casts are fully committed: Charge and Coup
Tonnerre spend their cooldown even when they hit nothing; Coup Maudit is the
exception — with no enemy within 100 px it casts nothing and spends nothing.

### Iop, the warrior

Close range, high HP, high damage, one dash. The tanky bruiser.

| stat | value |
| --- | --- |
| max HP | 220 |
| damage | 20 |
| defense | 6 |
| speed | 150 |
| crit | 10% |
| basic range | 70 px, arc ±40° |
| basic cooldown | 0.45 s |

Spells:

| key | name | cooldown | effect |
| --- | --- | --- | --- |
| 1 | Charge | 4 s | dash 170 px toward the cursor in 0.25 s; 30 damage to each enemy crossed, once per enemy per cast |
| 2 | Coup Tonnerre (thunder strike) | 3 s | 45 damage to everything within 90 px in a ±50° arc toward the cursor |
| 3 | Coup Maudit (cursed strike) | 8 s | 15 damage to the nearest enemy within 100 px, then 15 more at 1 s and 2 s; a new cast refreshes, never stacks |

### Cra, the druid

Mid range, low HP, a projectile, a nova, and a heal. The squishy sustain.

| stat | value |
| --- | --- |
| max HP | 150 |
| damage | 14 |
| defense | 2 |
| speed | 165 |
| crit | 15% |
| basic range | 95 px, arc ±35° |
| basic cooldown | 0.4 s |

Spells:

| key | name | cooldown | effect |
| --- | --- | --- | --- |
| 1 | Boule de Feu (fireball) | 2 s | projectile at 320 px/s, 300 px max range, 25 damage to the first enemy it touches |
| 2 | Tornade (tornado) | 6 s | 30 damage to everything within 110 px of the player |
| 3 | Eau Vive (living water) | 12 s | heal 70 HP, capped at max; casting at full HP still spends the cooldown |

The Dofus names and spirits are kept. The mechanics are retuned for
real-time: Dofus spells cost AP on a grid, here they cost time.

## Monsters, first zone

Three types, 11 total. No respawns. Kills are final, which is what makes the
zone beatable.

| | Loup (wolf) | Squelette (skeleton) | Orik (undead warrior) |
| --- | --- | --- | --- |
| count | 6 | 4 | 1 |
| max HP | 40 | 70 | 400 |
| damage | 8 (melee) | 12 (bone throw) | 20 slash, 40 heavy |
| speed | 130 | 90 | 75 |
| aggro radius | 120 px | 160 px | 150 px |
| attack range | 45 px | 220 px throw | 60 px |
| windup (telegraph) | 0.5 s | 0.4 s before the throw | 0.6 s slash, 1.5 s heavy |
| attack cooldown | 1.2 s | 2.2 s | 1.4 s slash, 6 s heavy |
| gold | 3 to 6 | 5 to 10 | 15 to 25 |
| item drop | Gilet de Cuir, 20% | Épée d'Astrub 20%, Bâton de Feu 15% | Épée d'Orik, 100% |

Behavior, shared by all three:

- **idle**: wander within 40 px of the home point.
- **aggro**: the player enters the aggro radius. The monster chases.
- **pack alert**: when a wolf aggros, every other wolf within 150 px aggros too.
- **windup**: the monster stops and telegraphs (flash, exclamation mark;
  Orik's heavy uses a distinct red flash). Damage lands only when the windup
  ends. The windup is the dodge window.
- **leash**: 280 px from home, the monster gives up and walks back to idle.
  No respawn.
- **type flavor**: skeletons keep a 130 to 200 px band, backing off when you
  get close, and throw bones instead of touching you. Orik uses the heavy
  whenever it is ready and you are in range; the slash fills the gaps.

Total monster HP in the zone: 920 (240 wolves, 280 skeletons, 400 Orik).

## Map: Forêt d'Astrub

The existing 12x12 isometric grid, all tiles walkable. The walkable area is
the grid's diamond; the core clamps positions into it (convert to grid
coordinates, clamp both axes to 0.5 tile past the last tile, convert back).

Spawns, in (col, row) grid coordinates. The player spawns at the bottom
corner, (10, 11).

| entity | tiles |
| --- | --- |
| player spawn | (10, 11) |
| wolves, pack A | (2, 1), (3, 2), (4, 1) |
| wolves, pack B | (8, 1), (9, 2), (10, 2) |
| skeletons | (2, 4), (5, 3), (8, 4), (10, 3) |
| Orik | (6, 3) |

Decor is visual only, no collision: four trees and two rocks in fixed spots.

## Loot and equipment

Gold and items drop as pickups where the monster died. Walk over a pickup
(24 px) and it collects. No inventory: the equipment slots fill the moment an
item is picked up.

| item | slot | effect | drops from | gold value |
| --- | --- | --- | --- | --- |
| Gilet de Cuir (leather vest) | armor | +3 defense, +30 max HP | wolf, 20% | 8 |
| Épée d'Astrub | weapon | +9 damage | skeleton, 20% | 12 |
| Bâton de Feu | weapon | +6 damage, +8% crit | skeleton, 15% | 10 |
| Épée d'Orik | weapon | +12 damage, +1 defense | Orik, 100% | 20 |

Equip rule: if the slot is empty, the item equips and stats recompute. The
vest's +30 max HP also heals 30 HP on equip. If the slot is filled, the item
turns into its gold value instead. Two weapon drops therefore never fight for
screen space.

## Screens and UI

- **Menu** (`MenuScene`): title, zone name, one panel per class with the stat
  blurb and the three spell names. Click a panel or use A/D plus Enter.
- **Game** (`GameScene`): the HUD, drawn over the grid.
  - top left: class name, HP bar, gold count.
  - top right: zone name, run timer, kill counter (n of 11).
  - bottom: four boxes, the basic attack and spells 1 to 3, each with name,
    key, and a cooldown fill.
  - equipment: the equipped weapon and armor names under the HP bar.
- **End** (overlay in `GameScene`): Victoire shows time, gold, kills, and the
  run seed. Défaite shows the same minus the brag. R restarts with a fresh
  seed, C goes back to the menu.

Placeholder art until real sprites exist: the Iop is a red warrior shape with
a sword, the Cra a green shape with a staff, wolves brown, skeletons
bone-white, Orik larger and darker. Each monster has a mini HP bar; hit
flashes, floating damage numbers (bigger and orange on crits), and death
fades are in v0.1.

## Architecture

- `src/core/`: pure JS, no Phaser import, everything rule-level. Files:
  `rng.js`, `map.js`, `zone.js`, `player.js`, `spells.js`, `monster.js`,
  `combat.js`, `loot.js`, `world.js` (create plus `step`).
- `src/scenes/`: `MenuScene`, `GameScene`, and later `EndScene` if the overlay
  earns its own scene. Scenes draw the world and read input; they do not
  decide anything.
- `tools/shot.mjs`: headless Playwright screenshots, already built. It grows a
  mouse position and click option in step 3 of the plan.
- `test/`: `node --test`. One file per core module.

Determinism is the load-bearing wall: seeded RNG, fixed system order, no
clocks inside the core. The scene clamps the frame `dt` to 50 ms so a
backgrounded tab cannot tunnel a dash through a wolf.

## What done means for v0.1

Every line below is checked, with the evidence (test run or screenshot) noted
next to it, when v0.1 closes:

1. Class select offers Iop and Cra; each has its own stats and three working
   spells matching the tables above, including cooldowns, ranges, and
   effects.
2. 11 monsters spawn at the table's positions. Wolves chase in packs,
   skeletons keep distance and throw, Orik alternates slash and heavy with
   readable telegraphs. All three leash and return.
3. Combat: Frappe, crits, defense, and all six spells deal the specified
   damage. The player can die.
4. Loot: gold collects on touch, the four items drop per the table, the equip
   rule holds, and the HUD shows gold and equipped items.
5. Win and lose: the last kill shows Victoire with time, gold, and kills.
   HP 0 shows Défaite. R and C work.
6. A full Iop clear takes 3 to 6 minutes and a Cra clear 4 to 7 minutes,
   tuned in the final step, with Orik's fight lasting at least 20 seconds.
7. `npm test` green, `logs/browser.log` free of errors across two full
   playthroughs, no console errors in a headless run, README with a quick
   start.

## Not in v0.1

Multiplayer, leveling and XP, saving, audio, more zones, a separate boss
arena, crowd control (roots, stuns), an inventory screen, and mouse-based
item use. The boss is Orik, the last enemy, not a separate encounter.
