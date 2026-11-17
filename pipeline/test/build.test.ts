import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { decodeSnapshot, encodeSnapshot, type Snapshot } from '../../contract/news.ts';
import { ADAPTERS, type AdapterRegistry } from '../src/adapters/registry.ts';
import { buildSnapshot } from '../src/build.ts';
import { LIMITS } from '../src/domain/items.ts';
import type { HttpClient } from '../src/infra/http.ts';
import { FIXTURE_SOURCES, FIXTURES_NOW } from '../src/sources/fixtures.ts';
import { SOURCES } from '../src/sources/index.ts';

const NOW = Date.parse(FIXTURES_NOW);
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
    [['rss-utf8', true], ['rss-latin1', true], ['atom', true], ['bluesky', true], ['telegram', true], ['aemet-cap', true], ['ign', true], ['broken', false]],
  );

  const quake = snapshot.items.find((i) => i.sourceId === 'ign' && i.title.includes('Santa Fe'));
  assert.equal(quake?.category, 'emergency', 'the adapter category (by magnitude) beats the keyword classifier');
  assert.ok(snapshot.items.some((i) => i.sourceId === 'ign' && i.category === 'general'), 'a 4.6 at sea is not an emergency');

  const warnings = snapshot.items.filter((i) => i.sourceId === 'aemet-cap');
  assert.ok(warnings.every((i) => i.category === 'weather'));
  assert.ok(!warnings.some((i) => /nieblas/.test(i.title)), 'expired warnings are dropped');
  const tajo = warnings.find((i) => i.title === 'Aviso naranja por lluvias en Castilla-La Mancha: Valle del Tajo, Montes de Toledo');
  assert.equal(tajo?.region, 'cm', 'warnings carry their community');
  assert.equal(snapshot.sources.find((s) => s.id === 'aemet-cap')!.region, undefined, 'the source itself is national');
  assert.ok(snapshot.items.some((i) => i.sourceId === 'telegram' && i.title === '⚠️ AVISO METEOROLÓGICO – PROVINCIA DE TOLEDO'));
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
    sources: Array.from({ length: SOURCES.length }, (_, i) => ({ id: `s${i}`, name: `Fuente ${i}`, kind: 'media' as const, lastOk: NOW / 1000 })),
    items: Array.from({ length: LIMITS.total }, (_, i) => ({
      sourceId: `s${i % SOURCES.length}`,
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

test('a feed that answers with only stale or untitled entries counts as failed and says why', async () => {
  const registry = {
    ...ADAPTERS,
    rss: {
      read: async () => [
        { title: 'Vieja', summary: '', url: '', publishedAt: Date.parse('2025-03-01T10:00:00Z') },
        { title: '', summary: '', url: 'https://x.example', publishedAt: NOW },
      ],
    },
  } satisfies AdapterRegistry;
  const { report } = await buildSnapshot({ sources: FIXTURE_SOURCES.slice(0, 1), http, now: NOW, registry });
  assert.equal(report[0]!.ok, false);
  assert.equal(report[0]!.error, 'no usable items (2 raw: 1 older than 36 h, 1 untitled; newest 2026-11-15T12:00:00Z)');
});

test('a sparse source with nothing recent is healthy and reuses nothing', async () => {
  const registry = { ...ADAPTERS, rss: { read: async () => [] } } satisfies AdapterRegistry;
  const quiet = { id: 'quiet', name: 'Quiet', kind: 'official', adapter: 'rss', url: 'unused', sparse: true } as const;
  const previous: Snapshot = {
    generatedAt: NOW / 1000 - 900,
    sources: [{ id: 'quiet', name: 'Quiet', kind: 'official', lastOk: 1 }],
    items: [{ sourceId: 'quiet', category: 'general', publishedAt: NOW / 1000 - 3600, title: 'Ya no está en el feed', summary: '', url: '' }],
  };
  const { snapshot, report } = await buildSnapshot({ sources: [quiet], http, now: NOW, registry, previous });
  assert.deepEqual(report, [{ id: 'quiet', ok: true, items: 0 }]);
  assert.equal(snapshot.items.length, 0);
  assert.equal(snapshot.sources[0]!.lastOk, NOW / 1000);
});

test('the same empty answer from a regular source is a failure', async () => {
  const registry = { ...ADAPTERS, rss: { read: async () => [] } } satisfies AdapterRegistry;
  const { report } = await buildSnapshot({ sources: FIXTURE_SOURCES.slice(0, 1), http, now: NOW, registry });
  assert.equal(report[0]!.error, 'empty feed');
});

test('the fixtures build is reproducible at any date: the CLI builds them at their capture date', async () => {
  const out = await mkdtemp(join(tmpdir(), 'oin-cli-'));
  try {
    const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
    await new Promise<void>((done, fail) => execFile(process.execPath, [cli, '--sources', 'fixtures', '--out', out], (e) => (e ? fail(e) : done())));
    const snap = decodeSnapshot(JSON.parse(await readFile(join(out, 'news.json'), 'utf8')));
    assert.equal(snap.generatedAt, Date.parse(FIXTURES_NOW) / 1000);
    assert.ok(snap.items.length >= 10, `${snap.items.length} items`);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
