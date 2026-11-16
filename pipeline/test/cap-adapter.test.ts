import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { CapAdapter, parseWarning, summarizeWarnings, zoneRegion, type Warning } from '../src/adapters/cap-adapter.ts';
import type { HttpClient } from '../src/infra/http.ts';
import type { CapSource } from '../src/sources/types.ts';

const url = new URL('fixtures/aemet-cap.xml', import.meta.url).href;
const http: HttpClient = { get: async (u) => ({ bytes: await readFile(new URL(u)), contentType: 'application/xml' }) };
const source: CapSource = { id: 'aemet-avisos', name: 'AEMET', kind: 'official', adapter: 'cap', url, category: 'weather' };

test('parses an AEMET entry: level, phenomenon, zone and validity with its UTC offset', () => {
  const w = parseWarning({
    title: 'Aviso. Nivel naranja. Lluvias. Valle del Tajo',
    summary: 'Aviso de lluvias de nivel naranja de 17:00 15-11-2026 CET (UTC+1) a 23:59 15-11-2026 CET (UTC+1).',
    url: 'https://x.example/cap.xml',
    publishedAt: 0,
  })!;
  assert.equal(w.level, 'naranja');
  assert.equal(w.phenomenon, 'lluvias');
  assert.equal(w.zone, 'Valle del Tajo');
  assert.equal(w.onset, Date.parse('2026-11-15T16:00:00Z'));
  assert.equal(w.expires, Date.parse('2026-11-15T22:59:00Z'));
});

test('ignores entries that are not a warning (index, green level, unknown text)', () => {
  const base = { url: '', publishedAt: 0 };
  assert.equal(parseWarning({ ...base, title: 'AEMET - Avisos', summary: '' }), null);
  assert.equal(parseWarning({ ...base, title: 'Aviso. Nivel verde. Lluvias. Zona', summary: 'de 00:00 15-11-2026 CET (UTC+1) a 01:00 15-11-2026 CET (UTC+1)' }), null);
  assert.equal(parseWarning({ ...base, title: 'Aviso. Nivel amarillo. Lluvias. Zona', summary: 'sin fechas' }), null);
});

test('community from the CAP file name: INE province, else Meteoalerta area', () => {
  assert.equal(zoneRegion('https://x/Z_CAP_C_LEMM_20261115105001_AFAZ684501PRPR1823.xml'), 'cm', 'Toledo');
  assert.equal(zoneRegion('https://x/Z_CAP_C_LEMM_20261115105001_AFAZ711501COCO1823.xml'), 'ga', 'A Coruña');
  assert.equal(zoneRegion('https://x/Z_CAP_C_LEMM_20261116090001_AFAZ645401COCO1823.xml'), 'ib', 'Mallorca (54, not INE)');
  assert.equal(zoneRegion('https://x/Z_CAP_C_LEMM_20261116090001_AFAZ645501COCO1823.xml'), 'ib', 'Menorca (55)');
  assert.equal(zoneRegion('https://x/Z_CAP_C_LEMM_20261116090001_AFAZ999901COCO1823.xml'), undefined, 'unknown codes: national');
  assert.equal(zoneRegion('https://x/other.xml'), undefined);
});

test('groups zones by community, level, phenomenon and validity; most severe first; level in the headline', async () => {
  const items = await new CapAdapter().read(source, http);
  assert.deepEqual(items.map((i) => [i.title, i.region]), [
    ['Aviso naranja por lluvias en Castilla-La Mancha: Valle del Tajo, Montes de Toledo', 'cm'],
    ['Aviso amarillo por nieblas en Andalucía: Campiña cordobesa', 'an'],
    ['Aviso amarillo por vientos en Canarias: Cumbres de Gran Canaria', 'cn'],
    ['Aviso amarillo por fenómenos costeros en Andalucía: Poniente y Almería Capital, Costa granadina', 'an'],
    ['Aviso amarillo por fenómenos costeros en Galicia: Noroeste de A Coruña', 'ga'],
  ]);
  assert.equal(items[0]!.summary, 'Del 15/11 17:00 al 15/11 23:59 (CET). 2 zonas.');
  assert.equal(items[2]!.summary, 'Del 15/11 12:00 al 15/11 21:00 (WET). 1 zona.');
  assert.equal(items[0]!.expiresAt, Date.parse('2026-11-15T22:59:00Z'));
  assert.match(items[0]!.url, /AFAZ684501PRPR1823\.xml$/);
  assert.equal(new Set(items.map((i) => i.url)).size, items.length, 'unique URLs survive de-duplication');
});

test('long zone lists end with "y N más" within the title budget', () => {
  const zones = Array.from({ length: 30 }, (_, i) => `Zona de prueba número ${i + 1}`);
  const warnings: Warning[] = zones.map((zone) => ({
    level: 'amarillo', phenomenon: 'vientos', zone, window: 'de 00:00 16-11-2026 CET (UTC+1) a 23:59 16-11-2026 CET (UTC+1)',
    onset: 0, expires: 1, publishedAt: 0, url: `https://x.example/${zone}`,
  }));
  const [item] = summarizeWarnings(warnings);
  assert.ok(item!.title.length <= 170, item!.title);
  assert.match(item!.title, /^Aviso amarillo por vientos: Zona de prueba número 1, .* y \d+ más$/);
  assert.equal(item!.summary, 'Del 16/11 00:00 al 16/11 23:59 (CET). 30 zonas.');
});

test('no active warnings is an empty list, not an error', async () => {
  const empty: HttpClient = { get: async () => ({ bytes: Buffer.from('<rss><channel><title>AEMET</title></channel></rss>'), contentType: '' }) };
  assert.deepEqual(await new CapAdapter().read(source, empty), []);
});
