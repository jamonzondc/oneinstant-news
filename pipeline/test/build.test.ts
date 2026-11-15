import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { decodeSnapshot, encodeSnapshot, type Snapshot } from '../../contract/news.ts';
import { ADAPTERS, type AdapterRegistry } from '../src/adapters/registry.ts';
import { buildSnapshot } from '../src/build.ts';
import { LIMITS } from '../src/domain/items.ts';
import type { HttpClient } from '../src/infra/http.ts';
import { FIXTURE_SOURCES } from '../src/sources/fixtures.ts';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const http: HttpClient = { get: async (url) => ({ bytes: await readFile(new URL(url)), contentType: '' }) };

test('builds a snapshot from fixtures: cleans, classifies, filters old items and de-duplicates', async () => {
  const { snapshot, report } = await buildSnapshot({ sources: FIXTURE_SOURCES, http, now: NOW });
  const titles = snapshot.items.map((i) => i.title);

  assert.ok(!titles.includes('Noticia muy antigua'), 'items older than maxAge are dropped');
  assert.equal(titles.filter((t) => /apagón/i.test(t)).length, 1, 'same headline from two links is kept once');

  const blackout = snapshot.items.find((i) => i.title.startsWith('Gran apagón'))!;
  assert.equal(blackout.category, 'emergency');
  assert.equal(blackout.url, 'https://diario.example/apagon?id=7');

  assert.equal(snapshot.items.find((i) => i.sourceId === 'atom')!.category, 'weather', 'forced source category wins');

  const post = snapshot.items.find((i) => i.sourceId === 'bluesky')!;
  assert.ok(post.title.startsWith('Terremoto de magnitud 4,2'), 'social posts get a derived title');
  assert.ok(post.title.length <= LIMITS.titleChars && post.summary.length > 0);

  assert.deepEqual(
    report.map((r) => [r.id, r.ok]),
    [['rss-utf8', true], ['rss-latin1', true], ['atom', true], ['bluesky', true], ['broken', false]],
  );
  assert.equal(snapshot.sources.find((s) => s.id === 'broken')!.lastOk, 0);
  assert.deepEqual(snapshot.items.map((i) => i.publishedAt), snapshot.items.map((i) => i.publishedAt).toSorted((a, b) => b - a));
});

test('a failing source reuses its fresh items from the previous snapshot', async () => {
  const previous: Snapshot = {
    generatedAt: NOW / 1000 - 900,
    sources: [{ id: 'broken', name: 'Feed caído', kind: 'media', lastOk: NOW / 1000 - 900 }],
    items: [
      { sourceId: 'broken', category: 'general', publishedAt: NOW / 1000 - 3600, title: 'Sigue aquí', summary: '', url: '' },
      { sourceId: 'broken', category: 'general', publishedAt: NOW / 1000 - 40 * 3600, title: 'Caducada', summary: '', url: '' },
    ],
  };
  const { snapshot, report } = await buildSnapshot({ sources: FIXTURE_SOURCES, http, now: NOW, previous });
  const titles = snapshot.items.map((i) => i.title);
  assert.ok(titles.includes('Sigue aquí'));
  assert.ok(!titles.includes('Caducada'));
  assert.equal(report.find((r) => r.id === 'broken')!.reused, 1);
  assert.equal(snapshot.sources.find((s) => s.id === 'broken')!.lastOk, NOW / 1000 - 900);
});

test('a new adapter plugs in through the registry without touching the core', async () => {
  const registry = {
    ...ADAPTERS,
    rss: { read: async () => [{ title: 'Desde un adaptador falso', summary: '', url: 'https://x.example', publishedAt: NOW }] },
  } satisfies AdapterRegistry;
  const { snapshot } = await buildSnapshot({
    sources: [{ id: 'fake', name: 'Fake', kind: 'social', adapter: 'rss', url: 'unused' }],
    http,
    now: NOW,
    registry,
  });
  assert.equal(snapshot.items[0]!.title, 'Desde un adaptador falso');
});

test('wire format round-trips and a full payload stays within the gzip budget', () => {
  const words = 'el gobierno anuncia nuevas medidas para restablecer el suministro electrico en varias comunidades'.split(' ');
  const text = (n: number, seed: number) => Array.from({ length: n }, (_, k) => words[(k * 7 + seed) % words.length]).join(' ');
  const snapshot: Snapshot = {
    generatedAt: NOW / 1000,
    sources: Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, name: `Fuente ${i}`, kind: 'media' as const, lastOk: NOW / 1000 })),
    items: Array.from({ length: LIMITS.total }, (_, i) => ({
      sourceId: `s${i % 20}`,
      category: 'general' as const,
      publishedAt: NOW / 1000 - i * 60,
      title: `${i} ${text(14, i)}`.slice(0, LIMITS.titleChars),
      summary: text(26, i + 3).slice(0, LIMITS.summaryChars),
      url: `https://www.periodico-${i % 20}.example/seccion/2026/11/15/noticia-${i}-${text(6, i).replaceAll(' ', '-')}.html`,
    })),
  };
  const json = JSON.stringify(encodeSnapshot(snapshot));
  assert.deepEqual(decodeSnapshot(JSON.parse(json)), snapshot);
  const gz = gzipSync(json, { level: 9 }).length;
  assert.ok(gz < 30 * 1024, `gzip ${gz} bytes`);
});

test('decodeSnapshot rejects garbage and maps unknown categories to general', () => {
  assert.throws(() => decodeSnapshot({ v: 99 }));
  const snap = decodeSnapshot({ v: 1, t: 1, s: [['a', 'A', 'media', 0]], i: [[0, 'aliens', 1, 'T', 'S', 'U'], [5, 'general', 1, 'orphan', '', '']] });
  assert.equal(snap.items.length, 1);
  assert.equal(snap.items[0]!.category, 'general');
});
