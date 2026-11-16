import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isFresh, LIMITS, prepareItems } from '../src/domain/items.ts';
import type { SourceDefinition } from '../src/sources/types.ts';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const source: SourceDefinition = { id: 'w', name: 'W', kind: 'official', adapter: 'cap', url: 'unused', category: 'weather' };
const hours = (h: number) => h * 3600_000;

test('a warning in force is kept whatever its age; an expired one is dropped', () => {
  const items = prepareItems(
    [
      { title: 'Aviso vigente emitido hace dos días', summary: '', url: '', publishedAt: NOW - hours(48), expiresAt: NOW + hours(1) },
      { title: 'Aviso caducado reciente', summary: '', url: '', publishedAt: NOW - hours(1), expiresAt: NOW - 1 },
      { title: 'Noticia sin caducidad de hace dos días', summary: '', url: '', publishedAt: NOW - hours(48) },
    ],
    source,
    NOW,
  );
  assert.deepEqual(items.map((i) => i.title), ['Aviso vigente emitido hace dos días']);
});

test('expiresAt reaches the contract, and reused warnings stay while in force', () => {
  const [w] = prepareItems([{ title: 'Aviso', summary: '', url: '', publishedAt: NOW - hours(48), expiresAt: NOW + hours(2) }], source, NOW);
  assert.equal(w!.expiresAt, (NOW + hours(2)) / 1000);
  assert.equal(isFresh(w!, NOW + hours(1)), true);
  assert.equal(isFresh(w!, NOW + hours(2)), false);
  const { expiresAt: _, ...news } = w!;
  assert.equal(isFresh(news, NOW), false, 'without expiresAt the 36 h rule applies');
});

test('per-source cut: news keep the newest, warnings keep the adapter order (most severe first)', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  const raw = (n: number, extra = {}) => Array.from({ length: n }, (_, i) => ({ title: `Titular número ${i}`, summary: '', url: `https://x.example/${i}`, publishedAt: now - i * 60_000, ...extra }));
  const regional = prepareItems(raw(9), { id: 'r', name: 'R', kind: 'media', adapter: 'rss', url: '', region: 'vc' }, now);
  assert.equal(regional.length, LIMITS.perRegionalSource);
  assert.equal(regional[0]!.title, 'Titular número 0');
  const warnings = raw(5, { expiresAt: now + 3600_000 }).map((w, i) => ({ ...w, publishedAt: now - (5 - i) * 60_000 }));
  const kept = prepareItems(warnings, { id: 'w', name: 'W', kind: 'official', adapter: 'cap', url: '', maxItems: 2 }, now);
  assert.deepEqual(kept.map((k) => k.title), ['Titular número 1', 'Titular número 0'], 'the first two of the adapter, newest first');
});
