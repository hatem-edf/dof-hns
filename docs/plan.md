# dof-hns plan

Build order for v0.1. The design lives in `docs/design.md`; this file is the
sequence. Work one step at a time. A step is done when its check passes and it
is committed.

## Ground rules (from AGENTS.md)

- Run `npm test` after every change. A step with a failing test is not done.
- After a visual change, take a screenshot, look at it, fix what is wrong, and
  only then mark the step done.
- Commit after each working step: `git add -A && git commit -m "<what changed>"`.
- Game rules go in `src/core/` as plain functions with no Phaser import.
  Scenes in `src/scenes/` only draw and read input.

## How to take screenshots

- Headless (what I run): `node tools/shot.mjs [keys]` saves
  `shots/auto-1..3.png`, 200 ms apart. Keys are `Key` or `Key:ms` tokens, held
  in sequence, for example `node tools/shot.mjs "Enter:200 W:800"`. From step 3
  it also takes `--mouse x,y` (aim point) and `--click` (left click).
- Real browser (what you do): press F9 in the game; the shot lands in
  `shots/`. Browser errors land in `logs/browser.log`.
- The dev server is yours to run: `npx vite --host 127.0.0.1 --port 5173`,
  tunneled to the laptop.

## Step 0, done

Scaffold: 12x12 isometric grid, dev bridge (F9 plus log capture), `tools/shot.mjs`
with headless Chromium, first `node --test` suite. See `git log`.

## Step 1. World, player movement, class select

Goal: a selectable Iop or Cra that walks around the grid with WASD.

Build:
- `src/core/rng.js`: seeded mulberry32.
- `src/core/map.js`: the diamond's corners, px to grid and grid to px, and
  `clampToMap(x, y)`.
- `src/core/player.js`: the two class stat tables from the design.
- `src/core/world.js`: `createWorld(class, seed)` and `step(world, input, dt)`
  with the system order from the design. Movement only for now.
- `src/scenes/MenuScene.js`: the two class panels, click or A/D plus Enter.
- `src/scenes/GameScene.js`: replace the bare grid scene; draw the player as a
  class-colored shape, capture WASD, mouse position, left click, and keys 1 to
  3 into `input`, pass the clamped frame dt to `step`, draw from `world`.

Check:
- `test/rng.test.js`: same seed gives the same sequence, different seeds
  differ.
- `test/map.test.js`: a point pushed past the top edge clamps to the diamond
  border; the px to grid round trip returns the starting point.
- `test/player.test.js`: the Iop table is 220/20/6/150/0.10, the Cra table
  150/14/2/165/0.15.
- `test/move.test.js`: one second of pure up movement moves the Iop exactly
  150 px; ten frames of 50 ms equal one frame of 500 ms; the player never
  leaves the diamond under diagonal input.
- Screenshots: `node tools/shot.mjs` shows the menu with both panels.
  `node tools/shot.mjs "Enter:200 W:800"` shows the Iop 800 ms up from the
  (10, 11) spawn, clamped if it hit the edge. F9 from your browser confirms the
  same.

## Step 2. Zone data, monsters spawn, idle wander

Goal: all 11 monsters standing in their Dofus-style clusters.

Build:
- `src/core/zone.js`: the spawn table, decor positions, `spawnMonsters(world)`.
- `src/core/monster.js`: per-type stat tables, idle wander within 40 px of
  home using the world rng.
- `GameScene`: draw each monster as a type-colored shape with a mini HP bar;
  top right shows the zone name and the kill counter, 0 of 11.

Check:
- `test/zone.test.js`: 6 wolves, 4 skeletons, 1 Orik, at the design's exact
  tiles; every spawn is inside the diamond; none is within 3 tiles of the
  player spawn; the two wolf packs each have all 3 members within 150 px.
- `test/wander.test.js`: 5 simulated seconds of idle keep every wolf within 40
  px of home, deterministically.
- Screenshot: `node tools/shot.mjs "Enter:200"` shows 11 monsters in two wolf
  packs, a skeleton band, and one larger Orik.

## Step 3. Combat: Frappe, wolf AI, player death

Goal: you can hit and kill wolves; wolves can hit and kill you.

Build:
- `src/core/combat.js`: arc and range hit tests, damage roll with crit and
  defense, `applyDamage`.
- Basic attack (left click) with cooldown, in `step`.
- Wolf AI: idle to chase at 120 px, pack alert within 150 px, chase, 0.5 s
  windup with a telegraph, 8 damage on strike, 1.2 s cooldown, leash at 280 px.
- Player hp at 0 sets `status: 'defeat'` and freezes the simulation.
- Extend `tools/shot.mjs`: `--mouse x,y` sets the aim point, `--click` sends a
  left click before the frames, both optional.

Check:
- `test/combat.test.js`: a hit at 60 px toward the aim lands, at 80 px it
  misses; a hit at 45 degrees off-aim misses; crit doubles (fixed seed);
  defense subtracts, never below 1.
- `test/wolf.test.js`: a wolf at 130 px ignores you, at 110 px chases; a
  second wolf within 150 px aggros too; no strike damage before the 0.5 s
  windup ends; a point-blank Iop kills a 40 HP wolf in at most 3 Frappes
  (fixed seed) with a `kill` event; the wolf's 3 to 6 gold appears as a
  pickup.
- `test/defeat.test.js`: a lone wolf beats an idle player to defeat, and the
  world stops changing after.
- Screenshot: `node tools/shot.mjs "Enter:200" --mouse <wolf> --click` shows a
  reduced wolf HP bar or a dead wolf with a gold pickup. F9 mid-fight from
  your browser shows the telegraph flash.

## Step 4. Iop kit and the skill HUD

Goal: Charge, Coup Tonnerre, Coup Maudit all work; the HUD shows cooldowns.

Build:
- `src/core/spells.js`: the six-spell table (Iop's three active now), cast
  resolution, cooldown bookkeeping.
- Charge: 0.25 s dash, 30 damage once per enemy crossed. Coup Tonnerre: 45
  in a 90 px, ±50° arc. Coup Maudit: 15 damage now plus two 15 damage ticks at
  1 s and 2 s, refreshes instead of stacking, drops off a dead target.
- `GameScene`: the four bottom boxes (basic plus 1 to 3) with names, keys,
  and cooldown fill.

Check:
- `test/iop.test.js`: each spell fires once per cooldown; recasting during the
  cooldown does nothing. Charge crosses two wolves in a line, both take 30
  exactly once, a wolf off the line takes nothing, and the dash stops at the
  map edge. Coup Tonnerre hits both targets in the arc for 45, none outside.
  Coup Maudit ticks at t=0, 1, and 2 in the events; a second cast refreshes,
  total ticks stay 3; the curse vanishes with the target.
- Screenshot: `node tools/shot.mjs "Enter:200" --mouse <edge> "1:100"` catches
  the dash mid-flight in one of the three frames. F9 with all three boxes
  showing partial cooldowns.

## Step 5. Cra kit and projectiles

Goal: fireball, tornado, and heal work; projectiles are a first-class entity.

Build:
- `src/core/world.js`: the projectile list, straight flight, range cap, first
  enemy hit.
- Cra casts: Boule de Feu 25 damage, 320 px/s, 300 px; Tornade 30 in a 110 px
  radius around the player; Eau Vive heals 70, capped, and still spends the
  12 s cooldown at full HP.
- `GameScene`: draw the Cra's staff and a fireball.

Check:
- `test/cra.test.js`: the fireball flies 320 px/s, dies at 300 px with no
  target, and hits only the first of two wolves in its path for 25; the second
  wolf keeps full HP. Tornade damages three monsters inside 110 px, none
  outside. Eau Vive heals 70 at half HP, heals 0 at full HP while still
  setting the cooldown.
- Screenshot: `node tools/shot.mjs "Enter:200" --mouse <wolf> "1:80"` shows
  the fireball in flight in an early frame and the hit in a later one.

## Step 6. Loot, equipment, full HUD

Goal: kills pay gold and the four items; the HUD shows everything.

Build:
- `src/core/loot.js`: gold ranges, the drop table, the four items, the equip
  rule (equip if empty, else convert to the gold value), vest heal on equip.
- Pickups collect at 24 px.
- `GameScene`: gold count, equipped weapon and armor names, HP bar tracking
  max HP changes.

Check:
- `test/loot.test.js` (fixed seed): 200 simulated kills match the table
  exactly, gold per wolf is always 3 to 6, Orik always drops Épée d'Orik.
  First weapon equips and Iop damage becomes 20 plus 9; the second weapon
  converts to 12 gold; the vest adds 30 max HP and heals 30.
- Screenshot: scripted wolf kill shows the gold pickup, then F9 with gold
  above 0 and an item name under the HP bar.

## Step 7. Skeletons ranged, Orik elite

Goal: all three AI flavors are on the field.

Build:
- Skeleton: keep a 130 to 200 px band, back off inside 130, throw a 12 damage
  bone at 260 px/s on a 2.2 s cooldown, 0.4 s windup.
- Orik: slow chase, slash 20 damage on 0.6 s windup and 1.4 s cooldown, heavy
  40 damage on 1.5 s windup and 6 s cooldown, heavy first whenever ready and
  in range, distinct red telegraph.

Check:
- `test/skeleton.test.js`: over 5 simulated seconds the skeleton holds the
  band (inside 130 to 200 px between casts); a bone in the line hits for 12;
  no second throw before 2.2 s.
- `test/orik.test.js`: the heavy deals exactly 40, never before its 1.5 s
  windup ends; the slash pattern fills gaps on its own cooldown; both land on
  a kiting player only inside 60 px.
- Screenshot: F9 with a bone mid-flight, and F9 on Orik's red heavy telegraph.

## Step 8. Win, lose, restart, and the full-zone simulation

Goal: the zone is provably beatable from a clean start.

Build:
- Win check: last monster dead sets `status: 'victory'` and records the time.
- End overlay in `GameScene`: Victoire or Défaite with time, gold, kills, and
  the seed; R restarts with a fresh seed, C returns to the menu.

Check:
- `test/zone-sim.test.js`, the big one: a scripted Iop run (walk to each
  monster, aim at it, basic attack, cast 1 to 3 whenever ready) clears all 11
  from a clean world and ends in victory with 11 kill events and gold above 0.
  A second scripted Cra run does the same. This is the proof the loop closes.
- `test/restart.test.js`: after victory and defeat, a fresh world has the
  spawn layout, full HP, zero gold, and a different seed.
- Screenshot: you play both classes to the end; F9 on the Victoire screen for
  each.

## Step 9. Feedback and the Dofus skin

Goal: the fight reads at a glance and looks like a Dofus placeholder.

Build:
- Hit flash 80 ms, floating damage numbers (crits bigger and orange), death
  fade, 2 px screen shake on Orik's heavy.
- Placeholder art pass: red Iop with sword, green Cra with staff, brown
  wolves, bone-white skeletons, larger darker Orik, three grass tones plus a
  path, four trees and two rocks.
- Dofus-styled panels for the HUD and menu: rounded, wood and brown tones,
  French names (Victoire, Défaite, Forêt d'Astrub).

Check:
- `npm test` stays green. This step is judged on pictures: F9 on a hit (number
  and flash), on a death (fade plus pickup), on Orik's heavy (shake plus red
  telegraph), on the menu (panels). Read each shot, fix what is off, re-shoot.

## Step 10. Balance and the v0.1 pass

Goal: it plays well and the done list is true.

Build:
- Full runs of both classes; tune the numbers in `docs/design.md` (the design
  is the source of truth for stats) until: Iop clear 3 to 6 minutes, Cra 4 to
  7, the first wolf pack is reachable without dying, Orik's fight lasts at
  least 20 seconds.
- `README.md`: install, run, controls, F9, `tools/shot.mjs`, `npm test`.

Check, the v0.1 done list from `docs/design.md`:
- Two full playthroughs (Iop, Cra) with F9 at start, mid-fight, and victory.
- `grep -ci error logs/browser.log` after clearing the log reads 0.
- A headless run prints no console errors.
- `npm test` green.
- Every line of the design's done list checked with its evidence. Commit with
  "v0.1 done".
