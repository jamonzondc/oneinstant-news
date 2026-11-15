// End-to-end in a mobile viewport: load, filter, share state via URL, refresh, offline reload and screenshots.
// Requires Chromium: `npx playwright install chromium`, or CHROMIUM_PATH pointing to an existing binary.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContextOptions, type Page } from 'playwright';
import { encodeSnapshot, type Snapshot } from '../../contract/news.ts';
import { renderLite } from '../../pipeline/src/render/lite.ts';
import { sampleSnapshot } from '../test/sample.ts';
import { buildWeb } from '../tools/build.ts';
import { serve } from '../tools/serve.ts';

const SHOTS = fileURLToPath(new URL('../screenshots/', import.meta.url));
const MOBILE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid' };

let dir = '';
let server: Server;
let browser: Browser;
let base = '';
const files = new Map<string, string>();

function publish(snap: Snapshot) {
  files.set('/news.json', JSON.stringify(encodeSnapshot(snap)));
  files.set('/lite.html', renderLite(snap));
}

const now = () => Math.floor(Date.now() / 1000);
const articles = (page: Page) => page.locator('article').count();

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'oin-e2e-'));
  await buildWeb(dir);
  publish(sampleSnapshot(now()));
  server = await serve(dir, 0, files);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});

after(async () => {
  await browser?.close();
  server?.close();
  await rm(dir, { recursive: true, force: true });
});

describe('app', () => {
  test('loads the news and filters by type, entity and text; the state lives in the URL', async () => {
    const ctx = await browser.newContext(MOBILE);
    const page = await ctx.newPage();
    await page.goto(base);
    await page.locator('article').first().waitFor();
    assert.equal(await articles(page), 14);
    assert.match(await page.locator('#st').innerText(), /^Datos de las \d\d:\d\d \(hace 2 min\)$/);
    assert.equal(await page.locator('#x').isHidden(), true);

    await page.selectOption('#c', 'transport');
    assert.equal(await articles(page), 2);
    assert.match(page.url(), /#c=transport$/);

    await page.selectOption('#s', 'k:official');
    assert.equal(await articles(page), 1);
    assert.equal(await page.locator('#nc').innerText(), '1 de 14 noticias');

    await page.selectOption('#c', '');
    await page.selectOption('#s', '');
    await page.fill('#q', 'apagon');
    assert.equal(await articles(page), 4, 'accent-insensitive search');

    // A shared link restores the same view.
    const shared = await ctx.newPage();
    await shared.goto(`${base}#c=emergency&s=k%3Asocial`);
    await shared.locator('article').first().waitFor();
    assert.equal(await articles(shared), 1);
    assert.equal(await shared.inputValue('#c'), 'emergency');
    assert.equal(await shared.inputValue('#s'), 'k:social');

    await page.click('#x');
    assert.equal(await articles(page), 14);
    assert.equal(new URL(page.url()).hash, '');
    await ctx.close();
  });

  test('the refresh button picks up a new snapshot', async () => {
    const ctx = await browser.newContext(MOBILE);
    const page = await ctx.newPage();
    await page.goto(base);
    await page.locator('article').first().waitFor();
    const next = sampleSnapshot(now());
    next.generatedAt = now();
    next.items.unshift({ sourceId: 'rtve', category: 'emergency', publishedAt: now(), title: 'Última hora: restablecido el 112', summary: '', url: '' });
    publish(next);
    await page.click('#r');
    await page.getByText('Última hora: restablecido el 112').waitFor();
    assert.equal(await articles(page), 15);
    publish(sampleSnapshot(now()));
    await ctx.close();
  });

  test('reloads without network and shows the last copy with its time', async () => {
    const ctx = await browser.newContext({ ...MOBILE, colorScheme: 'dark', deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(base);
    await page.locator('article').first().waitFor();
    // String expressions: this file is type-checked with Node types, not DOM.
    await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
    await page.reload(); // now controlled by the service worker
    await page.locator('article').first().waitFor();
    assert.equal(await page.evaluate('!!navigator.serviceWorker.controller'), true, 'page is controlled by the service worker');

    await ctx.setOffline(true);
    await page.reload();
    await page.locator('article').first().waitFor();
    assert.equal(await articles(page), 14);
    await page.getByText(/^Sin conexión\. Última copia: \d\d:\d\d/).waitFor();
    await mkdir(SHOTS, { recursive: true });
    await page.screenshot({ path: join(SHOTS, 'offline-dark.png') });
    await ctx.close();
  });

  test('without JavaScript the lite page lists everything by category', async () => {
    const ctx = await browser.newContext({ ...MOBILE, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(base);
    assert.equal(await page.locator('noscript a[href="lite.html"]').count(), 1);
    await page.goto(`${base}lite.html`);
    assert.equal(await page.locator('li').count(), 14);
    assert.equal(await page.locator('h2').first().innerText(), 'Emergencias');
    await ctx.close();
  });

  test('screenshots in light and dark mode', async () => {
    await mkdir(SHOTS, { recursive: true });
    for (const colorScheme of ['dark', 'light'] as const) {
      const ctx = await browser.newContext({ ...MOBILE, colorScheme, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await page.goto(base);
      await page.locator('article').first().waitFor();
      await page.screenshot({ path: join(SHOTS, `list-${colorScheme}.png`) });
      await page.selectOption('#s', 'k:official');
      await page.fill('#q', 'aviso');
      await page.screenshot({ path: join(SHOTS, `filtered-${colorScheme}.png`) });
      await page.goto(`${base}lite.html`);
      await page.screenshot({ path: join(SHOTS, `lite-${colorScheme}.png`) });
      await ctx.close();
    }
  });
});
