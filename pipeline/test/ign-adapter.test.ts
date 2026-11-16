import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { IgnAdapter, parseQuake, placeName } from '../src/adapters/ign-adapter.ts';
import type { HttpClient } from '../src/infra/http.ts';

const url = new URL('fixtures/ign-sismologia.xml', import.meta.url).href;
const http: HttpClient = { get: async (u) => ({ bytes: await readFile(new URL(u)), contentType: 'application/xml' }) };

test('parses magnitude, place, UTC time and epicentre from the IGN description', () => {
  const q = parseQuake('Se ha producido un terremoto de magnitud 3.4 en AZORES-CABO DE SAN VICENTE en la fecha 16/11/2026 7:59:46 en la siguiente localización: 37.0435,-13.2589')!;
  assert.deepEqual(q, { magnitude: 3.4, place: 'AZORES-CABO DE SAN VICENTE', at: Date.parse('2026-11-16T07:59:46Z'), lat: '37.0435', lon: '-13.2589' });
  assert.equal(parseQuake('texto sin datos'), null);
});

test('place names become readable', () => {
  assert.equal(placeName('ATLÁNTICO-MARRUECOS'), 'Atlántico-Marruecos');
  assert.equal(placeName('SW SANTA FE.GR'), 'SW Santa Fe (GR)');
  assert.equal(placeName('AZORES-CABO DE SAN VICENTE'), 'Azores-Cabo de San Vicente');
});

test('keeps only quakes over the threshold; 5 or more is an emergency', async () => {
  const items = await new IgnAdapter().read({ id: 'ign', name: 'IGN', kind: 'official', adapter: 'ign', url }, http);
  assert.deepEqual(items.map((i) => [i.title, i.category]), [
    ['Terremoto de magnitud 4,6 en Atlántico-Marruecos', 'general'],
    ['Terremoto de magnitud 5,1 en SW Santa Fe (GR)', 'emergency'],
  ]);
  assert.equal(items[1]!.summary, 'Epicentro: 37.18, -3.72. Fuente: catálogo sísmico del IGN.');
  const lower = await new IgnAdapter().read({ id: 'ign', name: 'IGN', kind: 'official', adapter: 'ign', url, minMagnitude: 3 }, http);
  assert.equal(lower.length, 3);
});
