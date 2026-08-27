import test from 'node:test';
import assert from 'node:assert/strict';

import { TRANSITION, TransitionController } from './transition.js';
import { getTheme } from '../themes/index.js';

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

test('night themes provide a brighter dawn reveal', () => {
  for (const id of ['starry-night', 'city-night']) {
    const theme = getTheme(id);
    const palette = theme.getPalette();
    const lighting = theme.getRevealLighting();

    assert.ok(palette.revealSky);
    assert.ok(palette.revealGround);
    assert.ok(lighting.sun > 1);
    assert.ok(lighting.fill > 0.2);
  }
});
