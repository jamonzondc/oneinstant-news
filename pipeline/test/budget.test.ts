import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NewsItem, Snapshot } from '../../contract/news.ts';
import { fitSnapshot } from '../src/domain/budget.ts';

const item = (title: string, category: NewsItem['category'], publishedAt: number): NewsItem =>
  ({ sourceId: 'a', category, publishedAt, title, summary: '', url: '' });
const snap: Snapshot = {
  generatedAt: 100,
  sources: [{ id: 'a', name: 'A', kind: 'media', lastOk: 100 }],
  items: [item('n1', 'general', 90), item('u1', 'emergency', 80), item('n2', 'sports', 70), item('u2', 'weather', 60), item('n3', 'general', 50)],
};
const titles = (s: Snapshot) => s.items.map((it) => it.title);

test('untouched when it already fits', () => {
  assert.equal(fitSnapshot(snap, () => true), snap);
});

test('drops the oldest non-urgent items first and keeps the order', () => {
  assert.deepEqual(titles(fitSnapshot(snap, (s) => s.items.length <= 3)), ['n1', 'u1', 'u2']);
  assert.deepEqual(titles(fitSnapshot(snap, (s) => s.items.length <= 4)), ['n1', 'u1', 'n2', 'u2']);
});

test('urgent items are the last to go', () => {
  assert.deepEqual(titles(fitSnapshot(snap, (s) => s.items.length <= 1)), ['u1']);
  assert.deepEqual(titles(fitSnapshot(snap, () => false)), []);
});
