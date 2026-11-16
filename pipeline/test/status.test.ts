import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Snapshot } from '../../contract/news.ts';
import { reasonText, renderStatus } from '../src/render/status.ts';

const NOW = Date.parse('2026-11-16T12:00:00Z') / 1000;
const snap: Snapshot = {
  generatedAt: NOW,
  sources: [
    { id: 'a', name: 'Diario <A>', kind: 'media', lastOk: NOW },
    { id: 'b', name: 'Telemadrid', kind: 'media', lastOk: NOW - 7200, region: 'md' },
    { id: 'c', name: 'Nunca', kind: 'official', lastOk: 0 },
  ],
  items: [],
};
const report = [
  { id: 'a', ok: true, items: 5 },
  { id: 'b', ok: false, items: 3, error: 'HTTP 503', reused: 3 },
  { id: 'c', ok: false, items: 0, error: 'ETIMEDOUT' },
];

test('estado.html lists down sources first, with a readable reason and last success, and escapes names', () => {
  const html = renderStatus(snap, report);
  assert.ok(!/<script/i.test(html));
  assert.ok(html.includes('1 de 3 fuentes al día'));
  assert.ok(html.includes('<h2>Sin actualizar (2)</h2>') && html.includes('<h2>Al día (1)</h2>'));
  assert.ok(html.indexOf('Nunca') < html.indexOf('Diario &lt;A&gt;'), 'down sources first');
  assert.ok(html.includes('<b>Telemadrid</b> <small>(Madrid, medio)</small><br>Error del servidor (503). Última vez: 16 nov, 11:00. 3 noticias guardadas.'));
  assert.ok(html.includes('Última vez: nunca. Sin noticias guardadas.</li>'));
  assert.ok(html.includes('(Nacional, medio)</small><br>5 noticias'));
});

test('feed errors become reader-facing reasons', () => {
  assert.equal(reasonText('no usable items (12 raw: 12 older than 36 h)'), 'sin noticias recientes');
  assert.equal(reasonText('The operation was aborted due to timeout'), 'no responde a tiempo');
  assert.equal(reasonText('ENOTFOUND'), 'no accesible');
});
