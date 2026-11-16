import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseMode, formatBytes, formatModePrefs, isSlow, parseModePrefs, transferredBytes, withChoice } from '../src/domain/network.ts';

test('slow networks: 2G or data saver; unknown is not slow', () => {
  assert.equal(isSlow(undefined), false);
  assert.equal(isSlow({ effectiveType: '4g' }), false);
  assert.equal(isSlow({ effectiveType: '3g' }), false);
  assert.equal(isSlow({ effectiveType: '2g' }), true);
  assert.equal(isSlow({ effectiveType: 'slow-2g' }), true);
  assert.equal(isSlow({ effectiveType: '4g', saveData: true }), true);
  assert.equal(isSlow({ effectiveType: '3g', downlink: 0.3 }), true, 'Chromium calls 2G bandwidth with 800 ms RTT "3g"');
  assert.equal(isSlow({ effectiveType: '3g', downlink: 1.5 }), false);
  assert.equal(isSlow({ effectiveType: '4g', downlink: 0 }), false, '0 means unknown');
});

test('urgent only by default on slow networks; an explicit choice is remembered per kind of network', () => {
  assert.equal(chooseMode({}, true), 'urgent');
  assert.equal(chooseMode({}, false), 'all');
  const p = withChoice({}, true, 'all');
  assert.equal(chooseMode(p, true), 'all');
  assert.equal(chooseMode(p, false), 'all');
  const q = withChoice(p, false, 'urgent');
  assert.equal(chooseMode(q, false), 'urgent');
  assert.equal(chooseMode(q, true), 'all');
  assert.deepEqual(parseModePrefs(formatModePrefs(q)), q);
  assert.deepEqual(parseModePrefs('slow=bogus&fast=all'), { fast: 'all' });
  assert.deepEqual(parseModePrefs(null), {});
});

test('data usage counts only what crossed the network', () => {
  assert.equal(transferredBytes([{ transferSize: 5400 }, { transferSize: 0 }, {}, { transferSize: 1200 }]), 6600);
  assert.equal(formatBytes(850), '850 B');
  assert.equal(formatBytes(4300), '4,2 KB');
  assert.equal(formatBytes(3 * 1024 * 1024), '3 MB');
});
