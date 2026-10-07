import assert from 'node:assert/strict';
import test from 'node:test';
import { MECHANISM_COPY, MECHANISM_STORYBOARD, noActionPose } from '../src/domain/hillsideMechanism.js';

test('mechanism copy is illustrative and does not forecast collapse', () => {
  assert.match(MECHANISM_COPY.caption, /not a site-specific collapse forecast/i);
  const joined = JSON.stringify(MECHANISM_STORYBOARD);
  assert.doesNotMatch(joined, /houses will fall|collapse expected|failure year/i);
  assert.equal(MECHANISM_STORYBOARD.length, 4);
});

test('no-action pose stays bounded', () => {
  const pose = noActionPose(1, { delay: 0 });
  assert.ok(pose.lean <= 1.52);
  assert.ok(pose.dy > 0);
});
