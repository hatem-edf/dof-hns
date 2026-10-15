import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';

test('rng: same seed gives the same sequence', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 16; i++) assert.equal(a(), b());
});

test('rng: different seeds give different sequences', () => {
  const a = createRng(1);
  const b = createRng(2);
  const same = [0, 1, 2, 3, 4, 5, 6, 7].every((i) => a() === b());
  assert.ok(!same, 'seeds 1 and 2 produced identical sequences');
});
