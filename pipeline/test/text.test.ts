import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanUrl, decodeEntities, normalize, truncate, xmlText } from '../src/domain/text.ts';

test('decodes named and numeric entities, keeps unknown ones', () => {
  assert.equal(decodeEntities('Ma&ntilde;ana &#8364; &#x1F600; &foo;'), 'Mañana € 😀 &foo;');
});

test('xmlText resolves CDATA literally and strips escaped HTML', () => {
  assert.equal(xmlText('<![CDATA[<p>Hola <b>mundo</b></p>]]>'), 'Hola mundo');
  assert.equal(xmlText('&lt;p&gt;A &amp;amp; B&lt;/p&gt;'), 'A & B');
  assert.equal(xmlText('<![CDATA[x]]> &amp; <![CDATA[y]]>'), 'x & y');
});

test('truncate cuts on a word boundary', () => {
  assert.equal(truncate('uno dos tres cuatro', 12), 'uno dos…');
  assert.equal(truncate('corto', 10), 'corto');
});

test('normalize removes accents and punctuation', () => {
  assert.equal(normalize('¡Apagón en ESPAÑA!'), 'apagon en espana');
});

test('cleanUrl drops tracking params and rejects non-http', () => {
  assert.equal(cleanUrl('https://a.es/x?utm_source=rss&id=7&fbclid=1#top'), 'https://a.es/x?id=7');
  assert.equal(cleanUrl('javascript:alert(1)'), '');
  assert.equal(cleanUrl('no es url'), '');
});
