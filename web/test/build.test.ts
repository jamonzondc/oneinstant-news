import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { inflateSync } from 'node:zlib';
import { buildWeb, INDEX_BUDGET_GZIP_BYTES, type WebBuildResult } from '../tools/build.ts';
import { encodePng } from '../tools/png.ts';

let dir = '';
let result: WebBuildResult;
let html = '';

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'oin-web-'));
  result = await buildWeb(dir);
  html = await readFile(join(dir, 'index.html'), 'utf8');
});
after(() => rm(dir, { recursive: true, force: true }));

test('index.html stays within the gzip budget', () => {
  assert.ok(result.indexGzipBytes <= INDEX_BUDGET_GZIP_BYTES, `${result.indexGzipBytes} bytes gzip`);
});

test('index.html is self-contained: inline JS and CSS, nothing from third parties', () => {
  assert.ok(!/<script[^>]+src=/.test(html) && !/<link[^>]+stylesheet/.test(html));
  assert.ok(!/__(?:CSS|JS|FAVICON)__/.test(html));
  assert.ok(!/https?:\/\//.test(html), 'no absolute URLs');
  assert.match(html, /<style>[^<]+<\/style>/);
  assert.match(html, /<script>.+<\/script>/s);
});

test('service worker version depends on the shell only and is reproducible', async () => {
  const sw = await readFile(join(dir, 'sw.js'), 'utf8');
  assert.ok(sw.includes(result.version));
  assert.ok(!sw.includes('news.json'), 'news.json is never cached by the worker');
  const again = await buildWeb(dir);
  assert.equal(again.version, result.version);
});

test('manifest references icons that exist', async () => {
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.webmanifest'), 'utf8'));
  for (const icon of manifest.icons) {
    const png = await readFile(join(dir, icon.src));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});

test('PNG encoder writes valid scanlines', () => {
  const png = encodePng(2, 2, (x, y) => [x * 255, y * 255, 7]);
  const idat = png.indexOf('IDAT');
  const len = png.readUInt32BE(idat - 4);
  const raw = inflateSync(png.subarray(idat + 4, idat + 4 + len));
  assert.deepEqual([...raw], [0, 0, 0, 7, 255, 0, 7, 0, 0, 255, 7, 255, 255, 7]);
});
