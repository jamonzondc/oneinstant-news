import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isUrgent, type Snapshot } from '../../contract/news.ts';
import { currentView, emergencyAlert } from '../src/domain/view.ts';
import { sampleSnapshot } from './sample.ts';

const NOW = 1_800_000_000;

function urgentOf(s: Snapshot): Snapshot {
  const items = s.items.filter((it) => isUrgent(it.category));
  return { ...s, sources: s.sources.filter((src) => items.some((it) => it.sourceId === src.id)), items };
}

test('no copy at all: nothing to show', () => {
  assert.equal(currentView('all', null, null, NOW), null);
  assert.equal(currentView('urgent', null, null, NOW), null);
});

test('urgent mode shows only urgent items, from whichever copy is newer', () => {
  const full = sampleSnapshot(NOW);
  const v = currentView('urgent', full, null, NOW)!;
  assert.deepEqual(v.snap.items.map((it) => it.category), ['emergency', 'utilities', 'weather']);
  assert.deepEqual(v.snap.sources.map((s) => s.id), ['elpais', 'aemet', '112madrid'], 'only the sources in use');

  const newer = urgentOf(sampleSnapshot(NOW + 600));
  assert.equal(currentView('urgent', full, newer, NOW + 600)!.snap.generatedAt, newer.generatedAt);
  const older = urgentOf(sampleSnapshot(NOW - 600));
  assert.equal(currentView('urgent', full, older, NOW)!.snap.generatedAt, full.generatedAt);
});

test('all mode: the full copy wins unless the urgent one is newer, then both are combined', () => {
  const full = sampleSnapshot(NOW);
  assert.deepEqual(currentView('all', full, urgentOf(full), NOW), { snap: full });

  const later = sampleSnapshot(NOW + 900);
  later.items.unshift({ sourceId: 'vost', category: 'emergency', publishedAt: NOW + 850, title: 'Incendio en la sierra', summary: '', url: '' });
  later.sources.push({ id: 'vost', name: 'VOST Spain', kind: 'social', lastOk: NOW + 850 });
  const v = currentView('all', full, urgentOf(later), NOW + 900)!;
  assert.equal(v.snap.generatedAt, later.generatedAt);
  assert.equal(v.restAt, full.generatedAt, 'the rest is from the older copy');
  assert.equal(v.snap.items.length, 15);
  assert.equal(v.snap.items[0]!.title, 'Incendio en la sierra');
  assert.ok(v.snap.sources.some((s) => s.id === 'vost'), 'sources new in the urgent file are added');
  assert.deepEqual(v.snap.items.map((it) => it.publishedAt), v.snap.items.map((it) => it.publishedAt).toSorted((a, b) => b - a));

  const onlyUrgent = currentView('all', null, urgentOf(full), NOW)!;
  assert.equal(onlyUrgent.restAt, 0, 'the rest never loaded');
});

test('expired warnings are hidden even in an old copy', () => {
  const full = sampleSnapshot(NOW);
  full.items[2]!.expiresAt = NOW - 1;
  full.items[1]!.expiresAt = NOW + 3600;
  const titles = currentView('all', full, null, NOW)!.snap.items.map((it) => it.title);
  assert.ok(!titles.includes(full.items[2]!.title));
  assert.ok(titles.includes(full.items[1]!.title));
});

test('the banner counts emergencies of the last hour', () => {
  const items = sampleSnapshot(NOW).items;
  assert.deepEqual(emergencyAlert(items, NOW), { count: 1, latest: items[0] });
  assert.equal(emergencyAlert(items, NOW + 3600), null, 'more than an hour later');
  const two = [{ ...items[0]!, publishedAt: NOW - 60, title: 'Nueva' }, ...items];
  assert.equal(emergencyAlert(two, NOW)!.count, 2);
  assert.equal(emergencyAlert(two, NOW)!.latest.title, 'Nueva');
});
