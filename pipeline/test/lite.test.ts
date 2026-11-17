import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import type { Snapshot } from '../../contract/news.ts';
import { LIMITS } from '../src/domain/items.ts';
import { renderLite } from '../src/render/lite.ts';

const NOW = Date.parse('2026-11-15T12:00:00Z') / 1000;

const snap: Snapshot = {
  generatedAt: NOW,
  sources: [{ id: 'a', name: 'Diario <A>', kind: 'media', lastOk: NOW }],
  items: [
    { sourceId: 'a', category: 'sports', publishedAt: NOW - 60, title: 'Gol & victoria', summary: '', url: 'https://a.example/1' },
    { sourceId: 'a', category: 'emergency', publishedAt: NOW - 120, title: '<b>Alerta</b>', summary: 'Resumen', url: 'javascript:alert(1)' },
    { sourceId: 'gone', category: 'general', publishedAt: NOW, title: 'Huérfana', summary: '', url: '' },
  ],
};

test('lite.html has no scripts, groups by category in priority order and escapes feed text', () => {
  const html = renderLite(snap);
  assert.ok(!/<script/i.test(html) && !html.includes('javascript:'));
  assert.ok(html.indexOf('id="emergency"') < html.indexOf('id="sports"'), 'emergencies first');
  assert.ok(html.includes('<a href="#emergency">Emergencias (1)</a>'));
  assert.ok(html.includes('&lt;b&gt;Alerta&lt;/b&gt; — Resumen'));
  assert.ok(html.includes('Gol &amp; victoria') && html.includes('Diario &lt;A&gt;'));
  assert.ok(!html.includes('Huérfana'));
  assert.ok(html.includes('Datos de las 13:00 (hora peninsular)'), 'peninsular time regardless of the build machine');
  assert.ok(html.includes('<a href="guia.html">Qué hacer en una emergencia</a>'), 'links the offline emergency guide');
});

test('lite.html at full load stays under 30 KB gzip', () => {
  const words = 'el gobierno anuncia nuevas medidas para restablecer el suministro electrico en varias comunidades'.split(' ');
  const text = (n: number, seed: number) => Array.from({ length: n }, (_, k) => words[(k * 7 + seed) % words.length]).join(' ');
  const full: Snapshot = {
    generatedAt: NOW,
    sources: Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, name: `Fuente ${i}`, kind: 'media' as const, lastOk: NOW })),
    items: Array.from({ length: LIMITS.total }, (_, i) => ({
      sourceId: `s${i % 20}`,
      category: 'general' as const,
      publishedAt: NOW - i * 60,
      title: `${i} ${text(14, i)}`.slice(0, LIMITS.titleChars),
      summary: text(26, i + 3).slice(0, LIMITS.summaryChars),
      url: `https://www.periodico-${i % 20}.example/seccion/2026/11/15/noticia-${i}-${text(6, i).replaceAll(' ', '-')}.html`,
    })),
  };
  const gz = gzipSync(renderLite(full), { level: 9 }).length;
  assert.ok(gz < 30 * 1024, `gzip ${gz} bytes`);
});
