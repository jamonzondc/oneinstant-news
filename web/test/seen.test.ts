import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanceSeen, countNew, isNew, parseSeen } from '../src/domain/seen.ts';

const NOW = 1_800_000_000;
const at = (...times: number[]) => times.map((publishedAt) => ({ publishedAt }));

test('parseSeen reads a stored watermark and rejects anything else', () => {
  assert.equal(parseSeen(String(NOW)), NOW);
  for (const raw of [null, '', 'abc', '-5', '0', '1.5', '1e30']) assert.equal(parseSeen(raw), null, String(raw));
});

test('the watermark moves to the newest item shown and never goes back', () => {
  assert.equal(advanceSeen(null, at(NOW - 300, NOW - 60, NOW - 900), NOW), NOW - 60);
  assert.equal(advanceSeen(NOW - 60, at(NOW - 3600), NOW), NOW - 60, 'an older cached copy does not move it back');
  assert.equal(advanceSeen(NOW - 60, at(NOW - 10), NOW), NOW - 10);
  assert.equal(advanceSeen(null, [], NOW), null, 'nothing shown yet: still a first visit');
});

test('items dated in the future do not move the watermark', () => {
  assert.equal(advanceSeen(NOW - 600, at(NOW + 7200, NOW - 120), NOW), NOW - 120);
});

test('first visit: nothing is new; later, only what was published after the watermark', () => {
  const entries = at(NOW - 10, NOW - 100, NOW - 1000).map((item) => ({ item }));
  assert.equal(countNew(entries, null), 0);
  assert.equal(isNew({ publishedAt: NOW }, null), false);
  assert.equal(countNew(entries, NOW - 100), 1, 'the item at the watermark itself was already seen');
  assert.equal(countNew(entries, NOW - 5000), 3);
  assert.equal(isNew({ publishedAt: NOW - 10 }, NOW - 100), true);
});
