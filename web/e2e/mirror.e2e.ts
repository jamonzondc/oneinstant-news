// Mirror fallback with two real origins (two local servers, like Firebase and Cloudflare Pages): when this host's
// news files fail, the app (shell already loaded) reads them from the other host; if both fail it offers the link.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium, type Browser } from 'playwright';
import { encodeSnapshot, URGENT_FILE } from '../../contract/news.ts';
import { urgentSnapshot } from '../../pipeline/src/domain/urgent.ts';
import { sampleSnapshot } from '../test/sample.ts';
import { buildWeb } from '../tools/build.ts';
import { serve } from '../tools/serve.ts';
import { MOBILE, ready } from './harness.ts';

let dir = '';
let servers: Server[] = [];
let browser: Browser;
let main = '';
let mirror = '';

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'oin-mirror-'));
  const snap = sampleSnapshot(Math.floor(Date.now() / 1000));
  const files = new Map([
    ['/news.json', JSON.stringify(encodeSnapshot(snap))],
    [`/${URGENT_FILE}`, JSON.stringify(encodeSnapshot(urgentSnapshot(snap, () => true)))],
  ]);
  servers = await Promise.all([serve(dir, 0, files), serve(dir, 0, files)]);
  [main, mirror] = servers.map((s) => `http://127.0.0.1:${(s.address() as AddressInfo).port}`) as [string, string];
  // Both hosts get the same build listing both, as the deploy workflow does.
  await buildWeb(dir, { mirrors: [main, mirror] });
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});

after(async () => {
  await browser?.close();
  for (const s of servers) s.close();
  await rm(dir, { recursive: true, force: true });
});

test('this host fails (e.g. daily quota exceeded): the news come from the mirror, CSP and CORS allow it', async () => {
  const ctx = await browser.newContext(MOBILE);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/503/.test(m.text())) errors.push(m.text());
  });
  const fromMirror: string[] = [];
  page.on('requestfinished', (r) => {
    if (r.url().startsWith(mirror)) fromMirror.push(new URL(r.url()).pathname);
  });
  await page.route(`${main}/news*.json`, (route) => route.fulfill({ status: 503, body: 'quota exceeded' }));
  await page.goto(`${main}/`);
  await ready(page);
  assert.equal(await page.locator('article').count(), 14);
  assert.match(await page.locator('#st').innerText(), /^Datos de las .+ \(servidor alternativo\)$/);
  assert.deepEqual(fromMirror.sort(), ['/news-urgent.json', '/news.json']);
  assert.equal(await page.locator('#mi').isHidden(), true, 'the news arrived: no need for the link');
  assert.equal(await page.locator('#mf a').getAttribute('href'), `${mirror}/`);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('both hosts fail: the status offers the mirror as a link', async () => {
  const ctx = await browser.newContext(MOBILE);
  const page = await ctx.newPage();
  await page.route('**/news*.json', (route) => route.abort());
  await page.goto(`${main}/`);
  await page.locator('#st', { hasText: 'No se pudieron cargar las noticias' }).waitFor();
  assert.equal(await page.locator('#mi').isVisible(), true);
  assert.equal(await page.locator('#mi').getAttribute('href'), `${mirror}/`);
  await ctx.close();
});
