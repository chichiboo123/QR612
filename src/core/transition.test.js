import test from 'node:test';
import assert from 'node:assert/strict';

import { TRANSITION, TransitionController } from './transition.js';

test('QR reveal cannot collapse into a 0.1 second jump', () => {
  const transition = new TransitionController();
  transition.setTarget(1);

  transition.update(0.1);

  assert.equal(transition.settled, false);
  assert.ok(transition.progress > 0);
  assert.ok(transition.progress < 0.03);
});

test('default reveal uses the complete cinematic duration', () => {
  const transition = new TransitionController();
  transition.setTarget(1);

  let elapsed = 0;
  while (!transition.settled && elapsed < 10) {
    transition.update(1 / 60);
    elapsed += 1 / 60;
  }

  assert.ok(elapsed >= TRANSITION.duration);
  assert.ok(elapsed < TRANSITION.duration + 1 / 30);
  assert.equal(transition.progress, 1);
});
