import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeSnapshot } from '../../contract/news.ts';
import { Origins, toOrigin } from '../src/data/origins.ts';
import { FEEDS, NewsRepository, type Fetcher, type KeyValueStore } from '../src/data/repository.ts';
import { parseMirrors } from '../tools/build.ts';
import { sampleSnapshot } from './sample.ts';

const NOW = 1_800_000_000;
const A = 'https://oin.web.app';
const B = 'https://oin.pages.dev';
const bodyAt = (generatedAt: number) => JSON.stringify(encodeSnapshot({ ...sampleSnapshot(NOW), generatedAt }));

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

test('mirrors: this site first, its own origin skipped, the host that answered goes first', () => {
  const o = new Origins(A, [A, B]);
  assert.deepEqual(o.urls('news.json'), ['news.json', `${B}/news.json`]);
  assert.equal(o.usingMirror, false);
  assert.equal(o.mirror, B);
  o.answered(`${B}/news.json`);
  assert.deepEqual(o.urls('news-urgent.json'), [`${B}/news-urgent.json`, 'news-urgent.json']);
  assert.equal(o.usingMirror, true);
  o.answered('news.json');
  assert.equal(o.usingMirror, false);
  assert.equal(new Origins(A, []).mirror, undefined);
});

test('MIRRORS are normalized to origins and must be http(s)', () => {
  assert.deepEqual(parseMirrors(` ${A}/ , ${B}/news.json,,${A}`), [A, B]);
  assert.deepEqual(parseMirrors(''), []);
  assert.equal(toOrigin('http://127.0.0.1:8080/x'), 'http://127.0.0.1:8080');
  assert.throws(() => parseMirrors('javascript:alert(1)'));
  assert.throws(() => parseMirrors('oin.pages.dev'));
});

test('when this site fails, the news come from the mirror; both files then ask the mirror first', async () => {
  const urls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    urls.push(url);
    return url.startsWith(B) ? new Response(bodyAt(NOW)) : new Response('quota exceeded', { status: 503 });
  };
  const origins = new Origins(A, [B]);
  const urgent = new NewsRepository(fetcher, memoryStore(), FEEDS.urgent, origins);
  const full = new NewsRepository(fetcher, memoryStore(), FEEDS.full, origins);
  assert.equal((await urgent.refresh()).generatedAt, NOW);
  assert.equal((await full.refresh()).generatedAt, NOW);
  assert.deepEqual(urls, ['news-urgent.json', `${B}/news-urgent.json`, `${B}/news.json`]);
  assert.equal(origins.usingMirror, true);
});

test('all hosts failing keeps the saved copy and throws', async () => {
  const store = memoryStore();
  await new NewsRepository(async () => new Response(bodyAt(NOW)), store).refresh();
  const down = new NewsRepository(async () => { throw new TypeError('Failed to fetch'); }, store, FEEDS.full, new Origins(A, [B]));
  await assert.rejects(down.refresh(), TypeError);
  assert.equal(down.cached()?.generatedAt, NOW);
});

test('a copy older than the saved one (the mirror updates less often) does not replace it', async () => {
  const store = memoryStore();
  await new NewsRepository(async () => new Response(bodyAt(NOW)), store).refresh();
  const repo = new NewsRepository(async () => new Response(bodyAt(NOW - 3600)), store);
  assert.equal((await repo.refresh()).generatedAt, NOW);
  assert.equal(repo.cached()?.generatedAt, NOW);
  const newer = new NewsRepository(async () => new Response(bodyAt(NOW + 60)), store);
  assert.equal((await newer.refresh()).generatedAt, NOW + 60);
  assert.equal(repo.cached()?.generatedAt, NOW + 60);
});
