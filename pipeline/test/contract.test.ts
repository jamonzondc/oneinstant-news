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
