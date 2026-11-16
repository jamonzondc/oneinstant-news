import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeSnapshot, encodeSnapshot, isUrgent, type Snapshot } from '../../contract/news.ts';

const snap: Snapshot = {
  generatedAt: 100,
  sources: [{ id: 'a', name: 'A', kind: 'official', lastOk: 90 }],
  items: [
    { sourceId: 'a', category: 'weather', publishedAt: 80, title: 'Aviso', summary: '', url: '', expiresAt: 500 },
    { sourceId: 'a', category: 'general', publishedAt: 70, title: 'Noticia', summary: 's', url: 'https://a.example/' },
  ],
};

test('round trip keeps expiresAt only where present', () => {
  const wire = encodeSnapshot(snap);
  assert.equal(wire.i[0]!.length, 7);
  assert.equal(wire.i[1]!.length, 6, 'regular news pay no extra bytes');
  assert.deepEqual(decodeSnapshot(JSON.parse(JSON.stringify(wire))), snap);
});

test('urgent categories', () => {
  assert.deepEqual((['emergency', 'utilities', 'weather', 'transport', 'general'] as const).map(isUrgent), [true, true, true, false, false]);
});

test('regions: on sources and items, only when present, and old rows stay valid', () => {
  const regional: Snapshot = {
    generatedAt: 100,
    sources: [
      { id: 'a', name: 'A', kind: 'official', lastOk: 90 },
      { id: 'b', name: 'B', kind: 'media', lastOk: 90, region: 'vc' },
    ],
    items: [
      { sourceId: 'a', category: 'weather', publishedAt: 80, title: 'Aviso', summary: '', url: '', expiresAt: 500, region: 'an' },
      { sourceId: 'a', category: 'general', publishedAt: 75, title: 'Sin caducidad', summary: '', url: '', region: 'ga' },
      { sourceId: 'b', category: 'general', publishedAt: 70, title: 'Local', summary: '', url: '' },
    ],
  };
  const wire = encodeSnapshot(regional);
  assert.equal(wire.s[0]!.length, 4);
  assert.equal(wire.s[1]![4], 'vc');
  assert.deepEqual(wire.i[0]!.slice(6), [500, 'an']);
  assert.deepEqual(wire.i[1]!.slice(6), [null, 'ga'], 'a region without expiry keeps position 6 empty');
  assert.equal(wire.i[2]!.length, 6);
  assert.deepEqual(decodeSnapshot(JSON.parse(JSON.stringify(wire))), regional);
});

test('unknown regions are ignored (national) instead of rejecting the file', () => {
  const wire = { v: 1, t: 1, s: [['a', 'A', 'media', 1, 'zz']], i: [[0, 'general', 1, 'T', '', '', null, 'zz']] };
  const decoded = decodeSnapshot(wire);
  assert.equal(decoded.sources[0]!.region, undefined);
  assert.equal(decoded.items[0]!.region, undefined);
  assert.equal(decoded.items[0]!.expiresAt, undefined);
});
