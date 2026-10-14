# dof-hns: isometric hack & slash in the browser, Dofus-inspired (private project)

## Stack
- Phaser 3.90 + Vite, plain JavaScript ES modules. npm always with --registry=https://registry.npmmirror.com
- Game rules (stats, damage, spells, cooldowns, AI decisions, loot) live in src/core/ as plain functions
  with no Phaser import, tested with `node --test`. Phaser scenes in src/scenes/ only draw and read input.
- Dofus classes, spells, monsters and names are welcome. Art: placeholder shapes until sprites exist in public/assets/.

## Seeing the game
- I run the dev server myself: npx vite --host 127.0.0.1 --port 5173 (hot reload, tunnelled to my laptop).
- You can't see my screen. Look at shots/ (I press F9 in the game to save a screenshot there), or run
  `node tools/shot.mjs` once it exists. Read logs/browser.log for errors from my browser.
- Screenshots show visuals, not game feel: ask me about feel.

## Working rules
- One step at a time from docs/plan.md. Run node --test after every change; a step with a failing test is not done.
- After a visual change: take a screenshot, look at it, fix what's wrong, then tell me what I should see.
- Commit after each working step: git add -A && git commit -m "<what changed>"
