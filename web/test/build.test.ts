import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { after, before, test } from 'node:test';
import { gzipSync, inflateSync } from 'node:zlib';
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
  assert.ok(!/__(?:CSS|JS|FAVICON|CSP|VERSION)__/.test(html));
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

test('the CSP only allows the exact inline script and style', () => {
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
  const hash = (s: string) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;
  const js = html.match(/<script>(.+)<\/script>/s)![1]!;
  const css = html.match(/<style>([^<]+)<\/style>/)![1]!;
  assert.ok(csp.includes(`script-src ${hash(js)};`), 'script hash');
  assert.ok(csp.includes(`style-src ${hash(css)};`), 'style hash');
  assert.ok(csp.includes("worker-src 'self'"), 'the service worker can register');
  assert.ok(!csp.includes('unsafe'));
});

test('footer shows the app version and links to the changelog, which the worker caches', async () => {
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(result.appVersion, pkg.version);
  assert.ok(html.includes(`<a href="changelog.html">Novedades</a> · <span id="d"></span>v${pkg.version}</footer>`));
  const changelog = await readFile(join(dir, 'changelog.html'), 'utf8');
  assert.ok(changelog.includes(`id="v${pkg.version}"`));
  // Off the critical path (the worker fetches it once per version) but it grows with every release.
  assert.ok(gzipSync(changelog).length < 8192, 'changelog stays small');
  assert.ok((await readFile(join(dir, 'sw.js'), 'utf8')).includes('changelog.html'));
});

test('emits Cloudflare _headers', async () => {
  assert.match(await readFile(join(dir, '_headers'), 'utf8'), /^\/sw\.js\n {2}Cache-Control: no-cache$/m);
});

test('with MIRRORS the app may fetch the news from the other hosts, and only from them', async () => {
  const out = await mkdtemp(join(tmpdir(), 'oin-web-mirrors-'));
  try {
    await buildWeb(out, { mirrors: ['https://oin.web.app/', 'https://oin.pages.dev'] });
    const page = await readFile(join(out, 'index.html'), 'utf8');
    assert.ok(page.includes("connect-src 'self' https://oin.web.app https://oin.pages.dev;"));
    assert.ok(page.includes('["https://oin.web.app","https://oin.pages.dev"]'), 'mirrors reach the script');
    assert.ok(!html.includes('connect-src'), 'no mirrors: default-src self only');
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test('accessibility basics in the markup: language, skip link, labelled controls, live regions', () => {
  assert.match(html, /^<!doctype html><html lang="es">/);
  assert.match(html, /<a id="sk" href="#l">Saltar a las noticias<\/a>/);
  assert.match(html, /<main id="l" tabindex="-1" aria-label="Noticias">/);
  assert.match(html, /<p id="st" role="status">/);
  assert.match(html, /<span id="nc" aria-live="polite">/);
  assert.match(html, /<p id="an" class="vh" aria-live="assertive">/);
  for (const id of ['c', 's', 'z', 'q']) assert.match(html, new RegExp(`id="${id}"[^>]* aria-label="[^"]+"`), id);
  assert.ok(!/user-scalable|maximum-scale/.test(html), 'zoom is never blocked');
});
