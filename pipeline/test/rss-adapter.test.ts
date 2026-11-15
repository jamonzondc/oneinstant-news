import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseFeed, RssAdapter } from '../src/adapters/rss-adapter.ts';
import { decodeBody, type HttpClient } from '../src/infra/http.ts';

const fixture = (n: string) => readFile(new URL(`fixtures/${n}`, import.meta.url));
const http: HttpClient = { get: async (url) => ({ bytes: await readFile(new URL(url)), contentType: '' }) };

test('parses RSS 2.0 with CDATA, escaped HTML and dc:date', async () => {
  const items = parseFeed(decodeBody({ bytes: await fixture('rss-utf8.xml'), contentType: '' }));
  assert.equal(items.length, 4);
  assert.equal(items[0]!.title, 'Gran apagón deja sin luz a toda la Península');
  assert.equal(items[0]!.summary, 'Red Eléctrica trabaja para restablecer el suministro.');
  assert.equal(items[0]!.publishedAt, Date.parse('2026-11-15T09:00:00Z'));
  assert.equal(items[1]!.title, 'El Gobierno aprueba los presupuestos & la reforma fiscal');
  assert.equal(items[1]!.summary, 'El Consejo de Ministros da luz verde…');
  assert.equal(items[1]!.publishedAt, Date.parse('2026-11-15T08:30:00Z'));
});

test('decodes ISO-8859-1 feeds', async () => {
  const [item] = parseFeed(decodeBody({ bytes: await fixture('rss-latin1.xml'), contentType: '' }));
  assert.match(item!.title, /autovía A-6/);
  assert.equal(item!.summary, 'Se recomienda no viajar. Mañana más información.');
});

test('parses Atom preferring rel="alternate" links', async () => {
  const [item] = parseFeed(decodeBody({ bytes: await fixture('atom.xml'), contentType: '' }));
  assert.equal(item!.url, 'https://organismo.example/avisos/1');
  assert.equal(item!.summary, 'Acumulados de 120 l/m² en 12 horas.');
});

test('Bluesky RSS has no title and a non-permalink guid', async () => {
  const [item] = parseFeed(decodeBody({ bytes: await fixture('bluesky.xml'), contentType: '' }));
  assert.equal(item!.title, '');
  assert.equal(item!.url, 'https://bsky.app/profile/cuenta.example/post/abc');
});

test('charset from Content-Type is used when there is no XML declaration', () => {
  const bytes = Buffer.from('<rss><item><title>Espa\xf1a</title></item></rss>', 'latin1');
  assert.equal(parseFeed(decodeBody({ bytes, contentType: 'text/xml; charset=ISO-8859-1' }))[0]!.title, 'España');
});

test('RssAdapter reads through the injected HttpClient', async () => {
  const url = new URL('fixtures/atom.xml', import.meta.url).href;
  const items = await new RssAdapter().read({ id: 'x', name: 'X', kind: 'official', adapter: 'rss', url }, http);
  assert.equal(items.length, 1);
});
