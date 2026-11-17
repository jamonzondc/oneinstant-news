import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { PHONES, SECTIONS, SOURCES } from '../src/guide/guide.ts';
import { GUIDE, GUIDE_BUDGET_GZIP_BYTES, renderGuide } from '../src/guide/page.ts';

test('the guide is well formed: unique anchors, numbers that can be dialled, official https sources', () => {
  const ids = SECTIONS.map((s) => s.id);
  assert.equal(new Set([...ids, 'telefonos', 'fuentes']).size, ids.length + 2, 'unique anchors');
  for (const s of SECTIONS) {
    assert.match(s.id, /^[a-z]+$/);
    assert.ok(s.title && s.steps.length && s.steps.every((x) => x.trim()), s.id);
  }
  assert.equal(PHONES[0]?.number, '112', '112 goes first');
  for (const p of PHONES) assert.match(p.number, /^\d{3}$/);
  assert.ok(SOURCES.length >= 3);
  for (const s of SOURCES) assert.match(s.url, /^https:\/\/[^/]+\.(?:es|cat|eu)\//, s.url);
  assert.match(GUIDE.reviewed, /^\d{4}-\d{2}-\d{2}$/);
});

test('the page has every section with its anchor, tappable numbers, no script, and stays small', () => {
  const html = renderGuide(GUIDE, 'body{}');
  assert.match(html, /^<!doctype html><html lang="es">/);
  assert.ok(!html.includes('<script'));
  assert.ok(html.includes('<a href="./">Volver a las noticias</a>'));
  for (const id of ['telefonos', ...SECTIONS.map((s) => s.id), 'fuentes']) {
    assert.ok(html.includes(`<section id="${id}">`), id);
    assert.ok(html.includes(`<li><a href="#${id}">`), `contents link to ${id}`);
  }
  assert.ok(html.includes('<a href="tel:112">112</a> Emergencias'));
  assert.equal(html.match(/<h1>/g)?.length, 1);
  assert.ok(html.includes('Revisada el 17 de noviembre de 2026'));
  const size = gzipSync(renderGuide(GUIDE, 'x'.repeat(0))).length;
  assert.ok(size <= GUIDE_BUDGET_GZIP_BYTES, `${size} bytes gzip`);
});

test('text is escaped and only https links are kept', () => {
  const html = renderGuide(
    {
      reviewed: '2026-01-02',
      phones: [{ number: '112', label: 'A & B', note: '<i>' }],
      sections: [{ id: 'x', title: 'T "1"', intro: '<b>', steps: ['a < b'] }],
      sources: [{ name: 'ok', url: 'https://a.es/' }, { name: 'bad', url: 'javascript:alert(1)' }],
    },
    '',
  );
  assert.ok(html.includes('112</a> A &amp; B<span class="m">&lt;i&gt;</span>'));
  assert.ok(html.includes('<h2>T &quot;1&quot;</h2><p><b>&lt;b&gt;</b></p><ul><li>a &lt; b</li></ul>'));
  assert.ok(html.includes('href="https://a.es/"') && !html.includes('javascript:') && !html.includes('>bad<'));
});
