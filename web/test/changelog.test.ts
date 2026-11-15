import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { renderChangelog } from '../src/changelog/page.ts';
import { RELEASES } from '../src/changelog/releases.ts';

const semver = (v: string) => v.split('.').map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! > y[i]!;
  return false;
};

test('the latest release is the version in package.json (add an entry with every version bump)', async () => {
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(RELEASES[0]?.version, pkg.version);
});

test('releases are well formed and ordered newest first', () => {
  RELEASES.forEach((r, i) => {
    assert.match(r.version, /^\d+\.\d+\.\d+$/);
    assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!Number.isNaN(Date.parse(r.date)), r.date);
    assert.ok(r.title && r.changes.length && r.changes.every(Boolean), r.version);
    const next = RELEASES[i + 1];
    if (next) {
      assert.ok(newer(r.version, next.version), `${r.version} > ${next.version}`);
      assert.ok(r.date >= next.date, `${r.version} date`);
    }
  });
});

test('the page lists every release with an anchor, escapes text and has no script', () => {
  const html = renderChangelog(
    [{ version: '1.0.0', date: '2026-01-02', title: 'A <b>', changes: ['x & y', '"z"'] }],
    'body{}',
  );
  assert.match(html, /<section id="v1\.0\.0"><h2>1\.0\.0 · A &lt;b&gt;<\/h2>/);
  assert.match(html, /<time datetime="2026-01-02">2 de enero de 2026<\/time>/);
  assert.ok(html.includes('<li>x &amp; y</li><li>&quot;z&quot;</li>'));
  assert.ok(!html.includes('<script'));
  assert.ok(html.includes('href="./"'));
});
