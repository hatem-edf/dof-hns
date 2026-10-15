import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step } from '../src/core/world.js';
import { createMonster } from '../src/core/monster.js';

const idle = {
  move: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  basic: false,
  s1: false,
  s2: false,
  s3: false,
};

test('defeat: a lone wolf near an idle Cra player eventually defeats the player', () => {
  const world = createWorld('cra', 2024);
  world.monsters = [createMonster('wolf', 1, { x: 500, y: 320 })]; // 20 px, point blank
  world.player.pos.x = 480;
  world.player.pos.y = 320;

  for (let i = 0; i < 5000 && world.status === 'playing'; i++) {
    step(world, idle, 0.1);
  }

  // Cra: 150 hp, defense 2; wolf hits for 8 - 2 = 6, so 25 strikes.
  assert.equal(world.status, 'defeat', `player still standing after 500 s (hp ${world.player.hp})`);
  assert.equal(world.player.hp, 0);
});

test('defeat: after defeat the simulation is frozen — more steps change nothing', () => {
  const world = createWorld('cra', 2024);
  world.monsters = [createMonster('wolf', 1, { x: 500, y: 320 })];
  world.player.pos.x = 480;
  world.player.pos.y = 320;
  for (let i = 0; i < 5000 && world.status === 'playing'; i++) {
    step(world, idle, 0.1);
  }
  assert.equal(world.status, 'defeat');

  const time = world.time;
  const playerPos = { ...world.player.pos };
  const monsterPos = world.monsters.map((m) => ({ ...m.pos }));

  for (let i = 0; i < 5; i++) step(world, idle, 0.1);

  assert.equal(world.time, time, 'world.time advanced after defeat');
  assert.deepEqual(world.player.pos, playerPos, 'player moved after defeat');
  world.monsters.forEach((m, i) =>
    assert.deepEqual(m.pos, monsterPos[i], `monster ${m.id} moved after defeat`)
  );
  assert.equal(world.status, 'defeat');
});
