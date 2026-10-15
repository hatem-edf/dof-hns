import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../src/core/player.js';

test('player: the Iop table is 220/20/6/150/0.10', () => {
  const t = CLASSES.iop;
  assert.equal(t.maxHp, 220);
  assert.equal(t.damage, 20);
  assert.equal(t.defense, 6);
  assert.equal(t.speed, 150);
  assert.equal(t.crit, 0.10);
  assert.equal(t.basicRange, 70);
  assert.equal(t.basicArc, 40);
  assert.equal(t.basicCd, 0.45);
});

test('player: the Cra table is 150/14/2/165/0.15', () => {
  const t = CLASSES.cra;
  assert.equal(t.maxHp, 150);
  assert.equal(t.damage, 14);
  assert.equal(t.defense, 2);
  assert.equal(t.speed, 165);
  assert.equal(t.crit, 0.15);
  assert.equal(t.basicRange, 95);
  assert.equal(t.basicArc, 35);
  assert.equal(t.basicCd, 0.4);
});
