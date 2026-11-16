import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { cloudflareHeaders, firebaseConfig, HEADER_RULES } from '../tools/hosting.ts';

const root = new URL('../../', import.meta.url);

test('firebase.json is generated from the shared header rules', async () => {
  const committed = JSON.parse(await readFile(new URL('firebase.json', root), 'utf8'));
  assert.deepEqual(committed, firebaseConfig(), 'regenerate it: node -e "import(\'./web/tools/hosting.ts\').then(m=>console.log(JSON.stringify(m.firebaseConfig(),null,2)))" > firebase.json');
});

test('documents revalidate in the browser, live briefly in the CDN, and the worker is never cached', () => {
  const cacheFor = (path: string) => HEADER_RULES.find((r) => r.path === path)?.headers['Cache-Control'];
  for (const path of ['/', '/index.html', '/news.json', '/lite.html', '/changelog.html']) {
    assert.match(cacheFor(path) ?? '', /max-age=0, s-maxage=\d+/, path);
  }
  assert.equal(cacheFor('/sw.js'), 'no-cache');
});

test('no header is set twice for the same path (Cloudflare would merge both values)', () => {
  const seen = new Set<string>();
  for (const r of HEADER_RULES) {
    for (const name of Object.keys(r.headers)) {
      const key = `${r.path === '**' ? '' : r.path}|${name.toLowerCase()}`;
      const global = `|${name.toLowerCase()}`;
      assert.ok(!seen.has(key) && (r.path === '**' || !seen.has(global)), `${r.path} ${name}`);
      seen.add(key);
    }
  }
});

test('Cloudflare _headers uses its own syntax for the catch-all rule', () => {
  const file = cloudflareHeaders([
    { path: '**', headers: { A: '1' } },
    { path: '/sw.js', headers: { B: '2', C: '3' } },
  ]);
  assert.equal(file, '/*\n  A: 1\n\n/sw.js\n  B: 2\n  C: 3\n');
});

test('only the news files can be read from another origin (the mirror fallback)', () => {
  const cors = HEADER_RULES.filter((r) => r.headers['Access-Control-Allow-Origin']).map((r) => r.path);
  assert.deepEqual(cors, ['/news.json', '/news-urgent.json']);
  assert.match(HEADER_RULES.find((r) => r.path === '/news-urgent.json')!.headers['Cache-Control']!, /max-age=0, s-maxage=\d+/);
});
