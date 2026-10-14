#!/usr/bin/env node
// Headless screenshot tool.
//
// Usage: node tools/shot.mjs [KEYS]
//   KEYS: space-separated tokens "Key" or "Key:ms", held in sequence before
//         shooting, e.g. node tools/shot.mjs "ArrowRight:800 Space"
//   A bare key (no :ms) is held for 1000 ms.
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

const keys = parseKeys(process.argv[2]);

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

  for (const { key, ms } of keys) {
    console.log(`holding ${key} for ${ms} ms`);
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  }

  const shotsDir = path.join(rootDir, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });
  const canvas = page.locator('canvas').first();
  for (let n = 1; n <= FRAMES; n++) {
    const file = path.join(shotsDir, `auto-${n}.png`);
    await canvas.screenshot({ path: file });
    console.log(`saved ${path.relative(rootDir, file)}`);
    if (n < FRAMES) await page.waitForTimeout(FRAME_GAP_MS);
  }
} finally {
  await browser.close();
}
