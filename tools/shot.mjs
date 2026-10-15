#!/usr/bin/env node
// Headless screenshot tool.
//
// Usage: node tools/shot.mjs [KEYS] [--mouse x,y] [--click]
//   KEYS: space-separated tokens "Key" or "Key:ms", held in sequence before
//         shooting, e.g. node tools/shot.mjs "ArrowRight:800 Space"
//   A bare key (no :ms) is held for 1000 ms.
//   --mouse x,y: move the mouse to canvas coordinates (the canvas is the
//                full 960x640 game) before the key sequence; sets the aim.
//   --click: one left mouse down+up at the current mouse position, after the
//           key sequence (before the first frame if there are no keys).
//           Optional "--click:ms" holds the button that long, so a held
//           Frappe auto-fires (handy for killing a wolf in a shot).
//
// Opens http://127.0.0.1:5173 (override with URL=...), waits until a Phaser
// scene is active (window.__game, set in src/main.js), holds the keys, then
// saves 3 frames of the game canvas 200 ms apart to shots/auto-1..3.png.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.URL || 'http://127.0.0.1:5173';
const DEFAULT_HOLD_MS = 1000;
const FRAMES = 3;
const FRAME_GAP_MS = 200;

function parseKeys(spec) {
  if (!spec) return [];
  return spec.split(/\s+/).filter(Boolean).map((tok) => {
    const [key, ms] = tok.split(':');
    const hold = ms ? Number(ms) : DEFAULT_HOLD_MS;
    if (!key || !Number.isFinite(hold) || hold < 0)
      throw new Error(`bad key token "${tok}" (expected Key or Key:ms)`);
    return { key, ms: hold };
  });
}

// Hand-rolled arg loop: the first bare token is the KEYS spec, --mouse takes
// an "x,y" value, --click is a flag. Anything else is an error.
function parseArgs(argv) {
  const opts = { keys: '', mouse: null, click: false, clickMs: 50 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mouse') {
      const next = argv[++i];
      const [x, y] = (next || '').split(',').map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y))
        throw new Error('--mouse expects "x,y" canvas coordinates');
      opts.mouse = { x, y };
    } else if (a === '--click' || a.startsWith('--click:')) {
      opts.click = true;
      if (a.includes(':')) {
        const ms = Number(a.split(':')[1]);
        if (!Number.isFinite(ms) || ms < 0)
          throw new Error('--click expects an optional ":ms" hold duration');
        opts.clickMs = ms;
      }
    } else if (!opts.keys) {
      opts.keys = a;
    } else {
      throw new Error(`unexpected argument "${a}"`);
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const keys = parseKeys(opts.keys);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  page.on('pageerror', (e) => console.log('[browser pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      console.log(`[browser ${m.type()}]`, m.text());
  });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  } catch (e) {
    throw new Error(`cannot reach ${url} — is the dev server running? (npx vite --host 127.0.0.1 --port 5173)\n  ${e.message}`);
  }

  await page.waitForFunction(
    () =>
      window.__game &&
      window.__game.scene &&
      window.__game.scene.getScenes(true).length > 0,
    { timeout: 15000 },
    'Phaser game running with an active scene'
  );

  const shotsDir = path.join(rootDir, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });
  const canvas = page.locator('canvas').first();

  if (opts.mouse) {
    // Canvas coordinates -> page coordinates via the canvas bounding box.
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + opts.mouse.x, box.y + opts.mouse.y);
    console.log(`aiming at ${opts.mouse.x},${opts.mouse.y}`);
  }

  for (const { key, ms } of keys) {
    console.log(`holding ${key} for ${ms} ms`);
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  }

  if (opts.click) {
    console.log(`left click${opts.clickMs !== 50 ? ` (held ${opts.clickMs} ms)` : ''}`);
    // Hold the button across at least one game tick: input.basic is only
    // sampled during an update, so a back-to-back down+up can be lost.
    await page.mouse.down();
    await page.waitForTimeout(opts.clickMs);
    await page.mouse.up();
  }

  for (let n = 1; n <= FRAMES; n++) {
    const file = path.join(shotsDir, `auto-${n}.png`);
    await canvas.screenshot({ path: file });
    console.log(`saved ${path.relative(rootDir, file)}`);
    if (n < FRAMES) await page.waitForTimeout(FRAME_GAP_MS);
  }
} finally {
  await browser.close();
}
