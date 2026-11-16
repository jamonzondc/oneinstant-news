import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bluesky, mastodon } from '../src/sources/networks.ts';
import { SOURCES } from '../src/sources/index.ts';

test('Bluesky and Mastodon helpers build their RSS URLs', () => {
  assert.deepEqual(bluesky('aemet.es', { id: 'aemet', name: 'AEMET', kind: 'official' }), {
    id: 'aemet', name: 'AEMET', kind: 'official', adapter: 'rss', url: 'https://bsky.app/profile/aemet.es/rss',
  });
  assert.equal(mastodon('@cuenta@mastodon.social', { id: 'm', name: 'M', kind: 'social' }).url, 'https://mastodon.social/@cuenta.rss');
});

test('production catalogue: unique ids, never x.com, and the iter 4 minimums', () => {
  const ids = SOURCES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  const active = SOURCES.filter((s) => s.enabled !== false);
  const target = (s: (typeof SOURCES)[number]) => ('url' in s && s.url) || ('channel' in s ? `t.me/${s.channel}` : '');
  assert.ok(active.every((s) => !/(^|\/\/|\.)(x|twitter)\.com/.test(target(s))), 'X is not readable for free (ADR 0006)');
  assert.ok(active.filter((s) => s.kind === 'official').length >= 5);
  const fromSocialNetworks = active.filter((s) => /bsky\.app|t\.me|@[^/]+\.rss$/.test(target(s)));
  assert.ok(fromSocialNetworks.length >= 5);
});
