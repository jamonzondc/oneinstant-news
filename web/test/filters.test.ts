import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  categoryCounts, filterEntries, fold, fromHash, groupSources, NO_FILTERS, sanitize, sourceCounts, toEntries, toHash,
} from '../src/domain/filters.ts';
import { sampleSnapshot } from './sample.ts';

const NOW = 1_800_000_000;
const snap = sampleSnapshot(NOW);
const entries = toEntries(snap);
const titles = (f = NO_FILTERS) => filterEntries(entries, f).map((e) => e.item.title);

test('fold removes accents and case', () => {
  assert.equal(fold('Apagón ELÉCTRICO Ñandú'), 'apagon electrico nandu');
});

test('no filters keeps every item in order', () => {
  assert.equal(titles().length, snap.items.length);
});

test('filters by category, single source and whole group', () => {
  assert.deepEqual(titles({ ...NO_FILTERS, cat: 'transport' }).length, 2);
  assert.ok(filterEntries(entries, { ...NO_FILTERS, src: 's:rtve' }).every((e) => e.source.id === 'rtve'));
  const official = filterEntries(entries, { ...NO_FILTERS, src: 'k:official' });
  assert.deepEqual([...new Set(official.map((e) => e.source.id))].sort(), ['aemet', 'dgt']);
});

test('search is accent-insensitive, matches every word and also the source name', () => {
  assert.equal(titles({ ...NO_FILTERS, q: 'APAGON' }).length, 4);
  assert.deepEqual(titles({ ...NO_FILTERS, q: 'apagon proteccion' }), [snap.items[0]!.title]);
  assert.equal(titles({ ...NO_FILTERS, q: 'aemet' }).length, 1);
  assert.equal(titles({ ...NO_FILTERS, q: '   ' }).length, snap.items.length);
});

test('counts are faceted: each facet ignores its own filter', () => {
  const f = { cat: 'transport' as const, src: 'k:media', q: '' };
  const byCat = categoryCounts(entries, f);
  assert.equal(byCat.get('transport'), 1, 'only the media item');
  assert.equal(byCat.get('politics'), 1, 'other categories still counted under the source filter');
  assert.equal(byCat.get('weather'), undefined, 'official-only category not counted');
  const bySrc = sourceCounts(entries, f);
  assert.equal(bySrc.get('s:dgt'), 1);
  assert.equal(bySrc.get('s:rtve'), 1);
  assert.equal(bySrc.get('k:official'), 1);
  assert.equal(bySrc.get('k:media'), 1);
});

test('sources are grouped by kind in display order and sorted by name', () => {
  const groups = groupSources(snap.sources);
  assert.deepEqual(groups.map((g) => g.kind), ['media', 'official', 'social']);
  assert.deepEqual(groups[0]!.sources.map((s) => s.name), ['El País', 'elDiario.es', 'RTVE']);
});

test('hash round-trips and ignores unknown categories', () => {
  const f = { cat: 'emergency' as const, src: 's:112madrid', q: 'luz agua' };
  assert.equal(toHash(f), '#c=emergency&s=s%3A112madrid&q=luz+agua');
  assert.deepEqual(fromHash(toHash(f)), f);
  assert.equal(toHash(NO_FILTERS), '');
  assert.deepEqual(fromHash('#c=aliens&s=k:media'), { cat: '', src: 'k:media', q: '' });
});

test('sanitize drops entities that are not in the snapshot', () => {
  assert.equal(sanitize({ ...NO_FILTERS, src: 's:gone' }, snap).src, '');
  assert.equal(sanitize({ ...NO_FILTERS, src: 'k:official' }, snap).src, 'k:official');
  assert.equal(sanitize({ ...NO_FILTERS, src: 'k:nope' }, snap).src, '');
  assert.equal(sanitize({ ...NO_FILTERS, src: 's:dgt' }, snap).src, 's:dgt');
});
