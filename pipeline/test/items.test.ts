import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareItems } from '../src/domain/items.ts';
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
