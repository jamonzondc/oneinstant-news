import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeSnapshot } from '../../contract/news.ts';
import { FEEDS, NewsRepository, prefs, type Fetcher, type FetchInit, type KeyValueStore } from '../src/data/repository.ts';
import { sampleSnapshot } from './sample.ts';

const NOW = 1_800_000_000;
const body = JSON.stringify(encodeSnapshot(sampleSnapshot(NOW)));

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

test('refresh revalidates, decodes and keeps a copy for offline use', async () => {
  const calls: FetchInit[] = [];
  const fetcher: Fetcher = async (_url, init) => {
    calls.push(init);
    return new Response(body);
  };
  const store = memoryStore();
  const repo = new NewsRepository(fetcher, store);
  assert.equal(repo.cached(), null);
  const snap = await repo.refresh();
  assert.equal(snap.items.length, 14);
  assert.equal(calls[0]!.cache, 'no-cache');
  assert.deepEqual(new NewsRepository(fetcher, store).cached(), snap);
});

test('network, HTTP and data errors throw and leave the cached copy intact', async () => {
  const store = memoryStore();
  await new NewsRepository(async () => new Response(body), store).refresh();
  const failing: Fetcher[] = [
    async () => { throw new TypeError('Failed to fetch'); },
    async () => new Response('oops', { status: 503 }),
    async () => new Response('{"v":99}'),
    async () => new Response('<html>captive portal</html>'),
  ];
  for (const f of failing) {
    const repo = new NewsRepository(f, store);
    await assert.rejects(repo.refresh());
    assert.equal(repo.cached()?.items.length, 14);
  }
});

test('works without storage and survives storage errors', async () => {
  const broken: KeyValueStore = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
  };
  for (const store of [null, broken]) {
    const repo = new NewsRepository(async () => new Response(body), store);
    assert.equal(repo.cached(), null);
    assert.equal((await repo.refresh()).items.length, 14);
    const p = prefs(store);
    p.set('filters', '#c=emergency');
    assert.equal(p.get('filters'), null);
  }
  const corrupt = memoryStore();
  corrupt.data.set('oin:news', '{not json');
  assert.equal(new NewsRepository(async () => new Response(body), corrupt).cached(), null);
});

test('the urgent and full copies are stored apart', async () => {
  const store = memoryStore();
  const urgentBody = JSON.stringify(encodeSnapshot({ ...sampleSnapshot(NOW), items: sampleSnapshot(NOW).items.slice(0, 2) }));
  const urls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    urls.push(url);
    return new Response(url === FEEDS.urgent.url ? urgentBody : body);
  };
  await new NewsRepository(fetcher, store, FEEDS.urgent).refresh();
  await new NewsRepository(fetcher, store, FEEDS.full).refresh();
  assert.deepEqual(urls, ['news-urgent.json', 'news.json']);
  assert.equal(new NewsRepository(fetcher, store, FEEDS.urgent).cached()?.items.length, 2);
  assert.equal(new NewsRepository(fetcher, store).cached()?.items.length, 14);
});
