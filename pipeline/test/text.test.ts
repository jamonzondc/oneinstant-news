import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanPostLines, cleanUrl, decodeEntities, normalize, splitHeadline, truncate, xmlLines, xmlText } from '../src/domain/text.ts';

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

test('xmlLines splits at newlines and <br>, dropping empty lines', () => {
  assert.deepEqual(xmlLines('Titular corto aquí&#xD;&#xA;&#xD;&#xA;Segunda &amp; línea'), ['Titular corto aquí', 'Segunda & línea']);
  assert.deepEqual(xmlLines('<![CDATA[Uno<br/>Dos <b>tres</b>]]>'), ['Uno', 'Dos tres']);
});

test('splitHeadline uses the first line as title only when it looks like one', () => {
  assert.deepEqual(splitHeadline(['El comienzo de la semana será nuboso', 'Más detalles']), { title: 'El comienzo de la semana será nuboso', summary: 'Más detalles' });
  assert.deepEqual(splitHeadline(['Un párrafo único sin titular']), { title: '', summary: 'Un párrafo único sin titular' });
  assert.deepEqual(splitHeadline(['¡Ojo!', 'Texto']), { title: '', summary: '¡Ojo! Texto' }, 'too short');
  assert.equal(splitHeadline(['x'.repeat(181), 'Texto']).title, '', 'too long');
});

test('post lines lose links and leading hashtag-only lines (real Bluesky posts, 2026-11-16)', () => {
  assert.deepEqual(
    cleanPostLines(['Repsol demanda a las eléctricas por el apagón de abril de 2025 dozz.es/fp3gt4', 'http://dozz.es/fp3gt4']),
    ['Repsol demanda a las eléctricas por el apagón de abril de 2025'],
  );
  assert.deepEqual(cleanPostLines(['#FMA #Lluvias', '🔴 Aviso rojo por lluvias muy abundantes mañana martes']), ['🔴 Aviso rojo por lluvias muy abundantes mañana martes']);
  assert.deepEqual(cleanPostLines(['#BalanceFinSemana #SiniestralidadVial 13-15 de noviembre:', '🔴 13 fallecidos']), ['#BalanceFinSemana #SiniestralidadVial 13-15 de noviembre:', '🔴 13 fallecidos'], 'has words besides tags');
  assert.deepEqual(cleanPostLines(['Consulta en tu centro de salud. universal.sanidad.gob.es', '🌐 https://f.mtr.cool/hlqb617f4f']), ['Consulta en tu centro de salud. universal.sanidad.gob.es']);
  assert.deepEqual(cleanPostLines(['#Solo #Tags']), ['#Solo #Tags'], 'never empties a post');
  assert.deepEqual(splitHeadline(['#DANA #Autoprotección', '🌧️ AEMET avisa de lluvias que podrían ser intensas', 'Infórmate']).title, '🌧️ AEMET avisa de lluvias que podrían ser intensas');
});
