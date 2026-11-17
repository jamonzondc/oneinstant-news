import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categoryCounts, groupSources, NO_FILTERS, sourceCounts, toEntries } from '../src/domain/filters.ts';
import { relativeTime } from '../src/domain/time.ts';
import { alertHtml, categoryOptions, countText, esc, itemsHtml, modeButtonText, sourceOptions, status } from '../src/ui/render.ts';
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
  const snap = { snap: sampleSnapshot(NOW) };
  assert.deepEqual(status(null, 'loading', true, NOW), { text: 'Cargando noticias…', warn: false });
  assert.equal(status(null, 'offline', false, NOW).warn, true);
  assert.match(status(snap, 'ok', false, NOW).text, /^Datos de las .+ \(hace 2 min\)$/);
  assert.equal(status(snap, 'ok', false, NOW).warn, false);
  assert.equal(status(snap, 'ok', false, NOW + 2 * 3600).warn, true, 'stale data is flagged');
  assert.match(status(snap, 'offline', false, NOW).text, /^Sin conexión\. Última copia: /);
  assert.match(status(snap, 'ok', true, NOW).text, /^Actualizando…/);
  const fromMirror = status(snap, 'ok', false, NOW, 'all', true);
  assert.match(fromMirror.text, /^Datos de las .+ \(hace 2 min\) \(servidor alternativo\)$/);
  assert.equal(fromMirror.warn, true, 'this host failed: worth noticing');
  assert.equal(countText(3, 14), '3 de 14 noticias');
  assert.equal(countText(14, 14), '14 noticias');
  assert.equal(countText(3, 3, 'urgent'), '3 noticias urgentes');
  assert.equal(countText(1, 1, 'urgent'), '1 noticia urgente');
  assert.equal(countText(14, 14, 'all', 1), '14 noticias · 1 nueva');
  assert.equal(countText(3, 14, 'all', 2), '3 de 14 noticias · 2 nuevas');
});

test('news published after the previous visit are labelled "Nueva", in text', () => {
  const entries = toEntries(sampleSnapshot(NOW));
  assert.ok(!itemsHtml(entries, NOW).includes('Nueva'), 'no watermark: first visit');
  const html = itemsHtml(entries, NOW, false, NOW - 10 * 60);
  assert.equal(html.match(/<span class="nw">Nueva<\/span> · /g)?.length, 2, 'the two items of the last 10 minutes');
  assert.match(html, /^<article class="e"><h2>.+?<\/h2><p>.+?<\/p><p class="m"><span class="nw">Nueva<\/span> · <b>Emergencias<\/b>/);
});

test('status line in urgent mode and when the rest of the news lags behind', () => {
  const snap = sampleSnapshot(NOW);
  assert.match(status({ snap }, 'ok', false, NOW, 'urgent').text, /^Solo urgentes\. Datos de las /);
  const behind = status({ snap, restAt: snap.generatedAt - 3600 }, 'ok', false, NOW);
  assert.match(behind.text, /\. Resto: \d\d:\d\d$/);
  assert.equal(behind.warn, true);
  assert.match(status({ snap, restAt: 0 }, 'offline', false, NOW).text, /^Sin conexión\. .+\. El resto aún no se ha cargado$/);
});

test('emergency banner text is escaped and counts the others', () => {
  const latest = { sourceId: 'x', category: 'emergency' as const, publishedAt: NOW - 180, title: 'Fuego <b>', summary: '', url: '' };
  assert.equal(alertHtml({ count: 1, latest }, NOW), '<b>Emergencia, hace 3 min:</b> Fuego &lt;b&gt;');
  assert.ok(alertHtml({ count: 3, latest }, NOW).endsWith(' <span>(+2 más)</span>'));
  assert.equal(modeButtonText('urgent'), 'Ver todas las noticias');
});
