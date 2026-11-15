import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categoryCounts, groupSources, NO_FILTERS, sourceCounts, toEntries } from '../src/domain/filters.ts';
import { relativeTime } from '../src/domain/time.ts';
import { categoryOptions, countText, esc, itemsHtml, sourceOptions, status } from '../src/ui/render.ts';
import { sampleSnapshot } from './sample.ts';

const NOW = 1_800_000_000;

test('relative times', () => {
  assert.equal(relativeTime(NOW - 20, NOW), 'ahora');
  assert.equal(relativeTime(NOW - 5 * 60, NOW), 'hace 5 min');
  assert.equal(relativeTime(NOW - 3 * 3600, NOW), 'hace 3 h');
  assert.equal(relativeTime(NOW - 26 * 3600, NOW), 'hace 1 día');
  assert.equal(relativeTime(NOW - 50 * 3600, NOW), 'hace 2 días');
});

test('feed text is escaped and only http(s) links are rendered', () => {
  const snap = sampleSnapshot(NOW);
  snap.sources[0]!.name = '<img src=x onerror=alert(1)>';
  snap.items = [
    { sourceId: snap.sources[0]!.id, category: 'emergency', publishedAt: NOW, title: '"><script>x</script>', summary: 'a & b', url: 'javascript:alert(1)' },
    { sourceId: snap.sources[0]!.id, category: 'general', publishedAt: NOW, title: 'ok', summary: '', url: 'https://a.example/?x=1&y="2"' },
  ];
  const html = itemsHtml(toEntries(snap), NOW);
  assert.ok(!html.includes('<script>') && !html.includes('<img') && !html.includes('javascript:'));
  assert.ok(html.includes('&lt;script&gt;') && html.includes('a &amp; b'));
  assert.ok(html.includes('href="https://a.example/?x=1&amp;y=&quot;2&quot;"'));
  assert.ok(html.startsWith('<article class="e">'), 'emergencies are highlighted');
  assert.equal(esc(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
});

test('select options show faceted counts and hide empty categories', () => {
  const entries = toEntries(sampleSnapshot(NOW));
  const cats = categoryOptions(categoryCounts(entries, NO_FILTERS), 'weather');
  assert.ok(cats.startsWith('<option value="">Tipo: todos</option>'));
  assert.ok(cats.includes('<option value="weather" selected>Tiempo y avisos (1)</option>'));
  const f = { ...NO_FILTERS, src: 'k:official' };
  const onlyOfficial = categoryOptions(categoryCounts(entries, f), '');
  assert.ok(!onlyOfficial.includes('Deportes'));

  const srcs = sourceOptions(groupSources(sampleSnapshot(NOW).sources), sourceCounts(entries, NO_FILTERS), 'k:official');
  assert.ok(srcs.includes('<optgroup label="Fuentes oficiales"><option value="k:official" selected>Fuentes oficiales (2)</option>'));
  assert.ok(srcs.includes('<option value="s:rtve">RTVE (4)</option>'));
  assert.ok(srcs.startsWith('<option value="">Entidad: todas</option>'));
});

test('status line reflects data age and connectivity', () => {
  const snap = sampleSnapshot(NOW);
  assert.deepEqual(status(null, 'loading', true, NOW), { text: 'Cargando noticias…', warn: false });
  assert.equal(status(null, 'offline', false, NOW).warn, true);
  assert.match(status(snap, 'ok', false, NOW).text, /^Datos de las .+ \(hace 2 min\)$/);
  assert.equal(status(snap, 'ok', false, NOW).warn, false);
  assert.equal(status(snap, 'ok', false, NOW + 2 * 3600).warn, true, 'stale data is flagged');
  assert.match(status(snap, 'offline', false, NOW).text, /^Sin conexión\. Última copia: /);
  assert.match(status(snap, 'ok', true, NOW).text, /^Actualizando…/);
  assert.equal(countText(3, 14), '3 de 14 noticias');
  assert.equal(countText(14, 14), '14 noticias');
});
