import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseTelegram, TelegramAdapter, telegramUrl } from '../src/adapters/telegram-adapter.ts';
import type { HttpClient } from '../src/infra/http.ts';

const fixtureUrl = new URL('fixtures/telegram.html', import.meta.url);
const html = async () => (await readFile(fixtureUrl)).toString('utf8');

test('parses posts with text; skips media-only posts', async () => {
  const items = parseTelegram(await html());
  assert.deepEqual(items.map((i) => i.url), [
    'https://t.me/proteccioncivil/2515',
    'https://t.me/policianacional/17380',
    'https://t.me/malditobulo/3605',
  ]);
  assert.equal(items[0]!.publishedAt, Date.parse('2026-11-15T10:06:25Z'));
});

test('the first line becomes the headline, emoji kept as text', async () => {
  const [warning] = parseTelegram(await html());
  assert.equal(warning!.title, '⚠️ AVISO METEOROLÓGICO – PROVINCIA DE TOLEDO');
  assert.match(warning!.summary, /^📅 Hoy, 15 de noviembre 🕔 Desde las 17:00/);
  assert.match(warning!.summary, /🟠 NIVEL NARANJA • Valle del Tajo • Montes de Toledo/);
  assert.doesNotMatch(warning!.summary, /<|background-image/);
});

test('a single-paragraph post has no headline yet and ignores the quoted reply', async () => {
  const post = parseTelegram(await html())[1]!;
  assert.equal(post.title, '');
  assert.match(post.summary, /^POLICÍA NACIONAL\.- Desarticulado un grupo criminal/);
  assert.doesNotMatch(post.summary, /citado/);
});

test('the video duration <time> is not taken as the post date', async () => {
  const post = parseTelegram(await html())[2]!;
  assert.equal(post.publishedAt, Date.parse('2026-11-15T07:26:50Z'));
  assert.equal(post.title, '❌ «Una mujer pide el voto para poder seguir cobrando paguitas»');
});

test('a page without posts (unknown channel) yields nothing', () => {
  assert.deepEqual(parseTelegram('<html><head><title>Telegram: Contact @nadie</title></head></html>'), []);
});

test('reads https://t.me/s/<channel> unless a URL is given', async () => {
  const asked: string[] = [];
  const http: HttpClient = { get: async (url) => (asked.push(url), { bytes: await readFile(fixtureUrl), contentType: 'text/html; charset=utf-8' }) };
  const items = await new TelegramAdapter().read({ id: 'x', name: 'X', kind: 'official', adapter: 'telegram', channel: 'policianacional' }, http);
  assert.equal(items.length, 3);
  assert.deepEqual(asked, ['https://t.me/s/policianacional']);
  assert.equal(telegramUrl('canal raro'), 'https://t.me/s/canal%20raro');
});
