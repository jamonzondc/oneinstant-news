import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { encodeSnapshot, type NewsItem, type Snapshot } from '../../contract/news.ts';
import { URGENT_BUDGET_GZIP_BYTES, urgentSnapshot } from '../src/domain/urgent.ts';

const T = 1_800_000_000;
const item = (sourceId: string, category: NewsItem['category'], min: number, title = `${category} ${min}`): NewsItem =>
  ({ sourceId, category, publishedAt: T - min * 60, title, summary: '', url: '' });

const snap: Snapshot = {
  generatedAt: T,
  sources: [
    { id: 'a', name: 'A', kind: 'media', lastOk: T },
    { id: 'b', name: 'B', kind: 'official', lastOk: T },
    { id: 'c', name: 'C', kind: 'social', lastOk: T },
  ],
  items: [item('a', 'politics', 1), item('b', 'weather', 2), item('c', 'emergency', 3), item('a', 'utilities', 4), item('b', 'weather', 5)],
};

test('keeps only urgent items and the sources they use, in the original order', () => {
  const u = urgentSnapshot(snap, () => true);
  assert.deepEqual(u.items.map((i) => i.title), ['weather 2', 'emergency 3', 'utilities 4', 'weather 5']);
  assert.deepEqual(u.sources.map((s) => s.id), ['a', 'b', 'c']);
  assert.equal(u.generatedAt, T);
});

test('trims the least severe category first, oldest first inside it', () => {
  const at = (n: number) => urgentSnapshot(snap, (s) => s.items.length <= n).items.map((i) => i.title);
  assert.deepEqual(at(3), ['weather 2', 'emergency 3', 'utilities 4']);
  assert.deepEqual(at(2), ['emergency 3', 'utilities 4']);
  assert.deepEqual(at(1), ['emergency 3']);
  const none = urgentSnapshot(snap, () => false);
  assert.deepEqual([none.items, none.sources], [[], []]);
});

test('a big episode still fits the 3 KB gzip budget, emergencies first', () => {
  // Pseudo-random words: realistic headlines compress far worse than repeated text.
  let seed = 7;
  const word = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return 'abcdefghijklmnopqrstuvwxyz'.slice(seed % 20, (seed % 20) + 3 + (seed % 6)) + (seed % 997);
  };
  const words = (n: number) => Array.from({ length: n }, word).join(' ');
  const big: Snapshot = { ...snap, items: [] };
  for (let i = 0; i < 150; i++) {
    big.items.push({ ...item(i % 2 ? 'b' : 'c', i % 3 ? 'weather' : 'emergency', i), title: words(10), summary: words(16), url: `https://x.example/${word()}` });
  }
  const size = (s: Snapshot) => gzipSync(JSON.stringify(encodeSnapshot(s)), { level: 9 }).length;
  const u = urgentSnapshot(big, (s) => size(s) <= URGENT_BUDGET_GZIP_BYTES);
  assert.ok(size(u) <= URGENT_BUDGET_GZIP_BYTES);
  assert.ok(u.items.length >= 10 && u.items.length < 50, `${u.items.length} items`);
  assert.ok(u.items.every((i) => i.category === 'emergency'), 'warnings make room for emergencies');
});
