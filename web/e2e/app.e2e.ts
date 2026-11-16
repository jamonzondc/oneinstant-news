// End-to-end in a mobile viewport: load, filter, share state via URL, refresh, offline reload, 2G link and screenshots.
// Requires Chromium: `npx playwright install chromium`, or CHROMIUM_PATH pointing to an existing binary.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import { encodeSnapshot, URGENT_FILE, type Snapshot } from '../../contract/news.ts';
import { urgentSnapshot } from '../../pipeline/src/domain/urgent.ts';
import { renderLite } from '../../pipeline/src/render/lite.ts';
import { renderStatus } from '../../pipeline/src/render/status.ts';
import { sampleSnapshot } from '../test/sample.ts';
import { buildWeb } from '../tools/build.ts';
import { serve } from '../tools/serve.ts';
import { MOBILE, ready } from './harness.ts';

const SHOTS = fileURLToPath(new URL('../screenshots/', import.meta.url));
/** WebPageTest's 2G profile: 280 kbps down, 256 kbps up, 800 ms RTT. */
const TWO_G = { offline: false, latency: 800, downloadThroughput: (280 * 1024) / 8, uploadThroughput: (256 * 1024) / 8, connectionType: 'cellular2g' } as const;

let dir = '';
let server: Server;
let browser: Browser;
let base = '';
const files = new Map<string, string>();

function publish(snap: Snapshot) {
  files.set('/news.json', JSON.stringify(encodeSnapshot(snap)));
  files.set(`/${URGENT_FILE}`, JSON.stringify(encodeSnapshot(urgentSnapshot(snap, () => true))));
  files.set('/lite.html', renderLite(snap));
  const report = snap.sources.map((s) => ({ id: s.id, ok: s.lastOk >= snap.generatedAt, items: 1, error: 'HTTP 503' }));
  files.set('/estado.html', renderStatus(snap, report));
}

/** The sample with DGT not answering in the last build (its items reused). */
function withDownSource(): Snapshot {
  const snap = sampleSnapshot(now());
  snap.sources = snap.sources.map((s) => (s.id === 'dgt' ? { ...s, lastOk: snap.generatedAt - 3600 } : s));
  return snap;
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
    await ready(page);
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
    await ready(shared);
    assert.equal(await articles(shared), 1);
    assert.equal(await shared.inputValue('#c'), 'emergency');
    assert.equal(await shared.inputValue('#s'), 'k:social');

    await page.click('#x');
    assert.equal(await articles(page), 14);
    assert.equal(new URL(page.url()).hash, '');
    await ctx.close();
  });

  test('area filter: a community shows national news plus its own; the entity list follows', async () => {
    const ctx = await browser.newContext(MOBILE);
    const page = await ctx.newPage();
    await page.goto(base);
    await ready(page);
    assert.equal(await page.locator('#z option').count(), 20, '"toda España" + 19 areas');
    await page.selectOption('#z', 'vc');
    assert.match(page.url(), /#r=vc$/);
    assert.equal(await articles(page), 13);
    assert.equal(await page.locator('article', { hasText: 'Aviso naranja por tormentas en Valencia' }).count(), 1);
    assert.equal(await page.locator('article', { hasText: 'Protección Civil pide no colapsar' }).count(), 0, 'Madrid item hidden');
    assert.equal(await page.locator('#s option[value="s:112madrid"]').count(), 0);
    assert.match(await page.locator('article', { hasText: 'Valencia' }).locator('.m').innerText(), /AEMET · Comunitat Valenciana/);

    await page.selectOption('#z', 'md');
    assert.equal(await articles(page), 13);
    await page.selectOption('#s', 's:112madrid');
    assert.equal(await articles(page), 1);
    await page.selectOption('#z', 'vc');
    assert.equal(await page.inputValue('#s'), '', 'a source of another community is dropped');
    assert.equal(await articles(page), 13);
    await ctx.close();
  });

  test('sources that did not update are flagged and the status page explains them', async () => {
    publish(withDownSource());
    const ctx = await browser.newContext(MOBILE);
    const page = await ctx.newPage();
    await page.goto(base);
    await ready(page);
    assert.equal(await page.locator('#h').innerText(), '1 fuente sin actualizar');
    assert.match(await page.locator('#s option[value="s:dgt"]').innerText(), /^DGT \(1\) · caída$/);
    await page.click('#h');
    await page.locator('h1', { hasText: 'Estado de las fuentes' }).waitFor();
    assert.match(await page.locator('ul').first().innerText(), /DGT.*Error del servidor \(503\)\. Última vez: .*1 noticia guardada\./s);
    publish(sampleSnapshot(now()));
    await page.goto(base);
    await ready(page);
    assert.equal(await page.locator('#h').isHidden(), true);
    await ctx.close();
  });

  test('the refresh button picks up a new snapshot', async () => {
    const ctx = await browser.newContext(MOBILE);
    const page = await ctx.newPage();
    await page.goto(base);
    await ready(page);
    const next = sampleSnapshot(now());
    next.generatedAt = now();
    next.items.unshift({ sourceId: 'rtve', category: 'emergency', publishedAt: now(), title: 'Última hora: restablecido el 112', summary: '', url: '' });
    publish(next);
    await page.click('#r');
    await page.locator('article', { hasText: 'Última hora: restablecido el 112' }).waitFor();
    assert.equal(await articles(page), 15);
    publish(sampleSnapshot(now()));
    await ctx.close();
  });

  test('reloads without network and shows the last copy with its time', async () => {
    const ctx = await browser.newContext({ ...MOBILE, colorScheme: 'dark', deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(base);
    await ready(page);
    // String expressions: this file is type-checked with Node types, not DOM.
    await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
    await page.reload(); // now controlled by the service worker
    await ready(page);
    assert.equal(await page.evaluate('!!navigator.serviceWorker.controller'), true, 'page is controlled by the service worker');

    await ctx.setOffline(true);
    await page.reload();
    await ready(page);
    assert.equal(await articles(page), 14);
    await page.getByText(/^Sin conexión\. Última copia: \d\d:\d\d/).waitFor();
    await mkdir(SHOTS, { recursive: true });
    await page.screenshot({ path: join(SHOTS, 'offline-dark.png') });
    await ctx.close();
  });

  test('a banner on top flags the emergencies of the last hour and filters by them', async () => {
    const ctx = await browser.newContext(MOBILE);
    const page = await ctx.newPage();
    await page.goto(base);
    await ready(page);
    const banner = page.locator('#b');
    assert.equal(await banner.innerText(), 'Emergencia, hace 3 min: Apagón general: Protección Civil pide no colapsar las líneas del 112');
    await page.mouse.wheel(0, 2000);
    assert.equal((await banner.boundingBox())?.y, 0, 'stays on top while scrolling');
    await banner.click();
    // hashchange fires in a later task than the URL update: wait for the filtered list, not the URL.
    await page.locator('#nc', { hasText: '1 de 14 noticias' }).waitFor();
    assert.match(page.url(), /#c=emergency$/);
    assert.equal(await articles(page), 1);
    assert.match(await page.locator('footer').innerText(), / KB usados · v/);
    await ctx.close();
  });

  test('on a 2G link: urgent headlines in < 5 s on the first visit and < 1 s on the next, the rest on demand', async () => {
    const ctx = await browser.newContext(MOBILE);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', TWO_G);
    const requested: string[] = [];
    page.on('request', (r) => requested.push(new URL(r.url()).pathname));

    const visit = async () => {
      const t0 = performance.now();
      await page.goto(base, { waitUntil: 'commit' });
      await page.locator('article').first().waitFor();
      return performance.now() - t0;
    };
    const first = await visit();
    assert.ok(first < 5000, `first visit: ${Math.round(first)} ms`);
    await ready(page);
    assert.equal(await articles(page), 3);
    assert.match(await page.locator('#st').innerText(), /^Solo urgentes\. Datos de las /);
    assert.equal(await page.locator('#nc').innerText(), '3 noticias urgentes');
    assert.ok(requested.includes(`/${URGENT_FILE}`) && !requested.includes('/news.json'), requested.join(' '));

    await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
    const next = await visit();
    assert.ok(next < 1000, `next visit: ${Math.round(next)} ms`);
    console.log(`2G: first visit ${Math.round(first)} ms, next ${Math.round(next)} ms`);

    await ready(page);
    await page.click('#m');
    await page.locator('#nc', { hasText: '14 noticias' }).waitFor({ timeout: 15_000 });
    assert.ok(requested.includes('/news.json'));
    assert.equal(await page.locator('#m').innerText(), 'Solo urgentes (ahorra datos)');
    await page.reload();
    await ready(page);
    assert.equal(await articles(page), 14, 'the choice is remembered on slow networks');
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

  test('the CSP blocks nothing the app needs', async () => {
    const ctx = await browser.newContext(MOBILE);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(base);
    await ready(page);
    await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test('the changelog page is linked from the footer and lists the current version', async () => {
    const ctx = await browser.newContext(MOBILE);
    const page = await ctx.newPage();
    await page.goto(base);
    const footer = await page.locator('footer').innerText();
    const version = footer.match(/v(\d+\.\d+\.\d+)$/)?.[1];
    assert.ok(version, footer);
    await page.click('footer a[href="changelog.html"]');
    await page.locator(`section#v${version.replaceAll('.', '\\.')}`).waitFor();
    assert.equal(await page.locator('h1').innerText(), 'Novedades');
    await page.click('header a[href="./"]');
    await ready(page);
    await ctx.close();
  });

  test('accessibility: named controls, headings, skip link, keyboard, announced emergency, touch targets', async () => {
    const ctx = await browser.newContext(MOBILE);
    const page = await ctx.newPage();
    await page.goto(base);
    await ready(page);
    const tree = await page.locator('body').ariaSnapshot();
    const unnamed = tree.split('\n').filter((l) => /^\s*- (button|link|combobox|searchbox|textbox|checkbox)\s*(:|$)/.test(l));
    assert.deepEqual(unnamed, [], 'every control has an accessible name');
    assert.match(tree, /- button "Aa letra grande"( \[pressed=false\])?/);
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('main h2').count(), await articles(page), 'one heading per news item');
    assert.equal(await page.locator('#an').innerText(), 'Emergencia: Apagón general: Protección Civil pide no colapsar las líneas del 112');

    // Keyboard: the first Tab reveals the skip link, which jumps to the list without touching the filters (hash).
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate('document.activeElement.id'), 'sk');
    assert.ok(((await page.locator('#sk').boundingBox())?.height ?? 0) > 20, 'visible when focused');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate('document.activeElement.id'), 'l');
    assert.equal(new URL(page.url()).hash, '');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate("document.activeElement.closest('article') !== null"), true, 'next stop: the first headline');

    // Touch targets: 44 px for the main controls, 24 px (WCAG 2.5.8) for the inline share buttons.
    for (const sel of ['#t', '#r', '#c', '#s', '#z', '#q', '#m']) {
      assert.ok(((await page.locator(sel).boundingBox())?.height ?? 0) >= 44, sel);
    }
    const share = await page.locator('.sh').first().boundingBox();
    assert.ok(share && share.height >= 24 && share.width >= 24, JSON.stringify(share));
    await ctx.close();
  });

  test('text size: follows the browser setting at 200 % and the "Aa" toggle, without horizontal scrolling', async () => {
    const ctx = await browser.newContext(MOBILE);
    const page = await ctx.newPage();
    const overflow = () => page.evaluate<number>('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    const bodyPx = () => page.evaluate<string>('getComputedStyle(document.body).fontSize');
    await page.goto(base);
    await ready(page);
    assert.equal(await bodyPx(), '16px');

    await page.click('#t');
    assert.equal(await page.getAttribute('#t', 'aria-pressed'), 'true');
    assert.equal(await bodyPx(), '20px');
    await page.reload();
    await ready(page);
    assert.equal(await bodyPx(), '20px', 'the choice is remembered');
    assert.equal(await overflow(), 0);

    // 200 % browser text size (Chromium's font settings) plus the toggle: 40 px text on a 390 px screen.
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32 } });
    await page.reload();
    await ready(page);
    assert.equal(await bodyPx(), '40px');
    assert.equal(await overflow(), 0, 'no horizontal scrolling');
    await page.click('#t');
    assert.equal(await bodyPx(), '32px');
    assert.equal(await overflow(), 0);
    await ctx.close();
  });

  test('share: Web Share with plain text where available, clipboard otherwise', async () => {
    const ctx = await browser.newContext(MOBILE);
    await ctx.addInitScript("Object.defineProperty(Navigator.prototype, 'share', { value: async (d) => { window.__shared = d; } })");
    const page = await ctx.newPage();
    await page.goto(base);
    await ready(page);
    await page.selectOption('#c', 'transport');
    await page.locator('article').nth(1).locator('.sh').click();
    const shared = await page.evaluate<{ title: string; text: string; url: string }>('window.__shared');
    assert.equal(shared.title, 'Renfe suspende los Cercanías en Madrid y Barcelona');
    assert.match(shared.text, /^Renfe suspende .+\nLos trenes detenidos .+\n— RTVE, \d+ \w+, \d\d:\d\d$/);
    assert.equal(shared.url, 'https://noticias.example/rtve/4');
    await ctx.close();

    const plain = await browser.newContext(MOBILE);
    await plain.addInitScript("delete Navigator.prototype.share");
    await plain.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
    const p2 = await plain.newPage();
    await p2.goto(base);
    await ready(p2);
    const button = p2.locator('article').first().locator('.sh');
    await button.click();
    await p2.locator('article').first().locator('.sh', { hasText: 'Copiado' }).waitFor();
    assert.match(await p2.evaluate<string>('navigator.clipboard.readText()'), /^Apagón general: .+\n.+\n— 112 Comunidad de Madrid, .+\nhttps:\/\/noticias\.example\/112madrid\/0$/);
    await plain.close();
  });

  test('screenshots in light and dark mode', async () => {
    await mkdir(SHOTS, { recursive: true });
    for (const colorScheme of ['dark', 'light'] as const) {
      const ctx = await browser.newContext({ ...MOBILE, colorScheme, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await page.goto(base);
      await ready(page);
      await page.screenshot({ path: join(SHOTS, `list-${colorScheme}.png`) });
      await page.evaluate("localStorage.setItem('oin:mode', 'fast=urgent')");
      await page.reload();
      await ready(page);
      await page.screenshot({ path: join(SHOTS, `urgent-${colorScheme}.png`) });
      await page.evaluate("localStorage.removeItem('oin:mode')");
      await page.reload();
      await ready(page);
      await page.selectOption('#s', 'k:official');
      await page.fill('#q', 'aviso');
      await page.screenshot({ path: join(SHOTS, `filtered-${colorScheme}.png`) });
      await page.click('#x');
      publish(withDownSource());
      await page.reload();
      await ready(page);
      await page.selectOption('#z', 'vc');
      await page.screenshot({ path: join(SHOTS, `area-${colorScheme}.png`) });
      await page.locator('footer').scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(SHOTS, `footer-${colorScheme}.png`) });
      await page.goto(`${base}estado.html`);
      await page.screenshot({ path: join(SHOTS, `status-${colorScheme}.png`) });
      publish(sampleSnapshot(now()));
      await page.goto(`${base}lite.html`);
      await page.screenshot({ path: join(SHOTS, `lite-${colorScheme}.png`) });
      await page.goto(`${base}changelog.html`);
      await page.screenshot({ path: join(SHOTS, `changelog-${colorScheme}.png`) });
      await page.goto(base);
      await ready(page);
      await page.click('#t');
      await page.screenshot({ path: join(SHOTS, `bigtext-${colorScheme}.png`) });
      await page.click('#t');
      await page.reload();
      await ready(page);
      await page.keyboard.press('Tab');
      await page.screenshot({ path: join(SHOTS, `skiplink-${colorScheme}.png`) });
      await ctx.close();
    }
  });
});
