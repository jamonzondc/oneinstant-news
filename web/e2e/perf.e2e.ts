// Performance and battery audit at full load (260 news) on a phone-class CPU (4× slower than the CI machine).
// Prints the measurements (copied to docs/PERFORMANCE.md) and asserts generous ceilings, so it catches
// regressions without being flaky. Battery: the page must do no work while idle and use no timers.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium, type Browser, type CDPSession, type Page } from 'playwright';
import { encodeSnapshot, URGENT_FILE } from '../../contract/news.ts';
import { urgentSnapshot } from '../../pipeline/src/domain/urgent.ts';
import { largeSnapshot } from '../test/sample.ts';
import { buildWeb } from '../tools/build.ts';
import { serve } from '../tools/serve.ts';
import { MOBILE, ready } from './harness.ts';

const CPU_SLOWDOWN = 4;

let dir = '';
let server: Server;
let browser: Browser;
let base = '';

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'oin-perf-'));
  await buildWeb(dir);
  const snap = largeSnapshot(Math.floor(Date.now() / 1000));
  const files = new Map([
    ['/news.json', JSON.stringify(encodeSnapshot(snap))],
    [`/${URGENT_FILE}`, JSON.stringify(encodeSnapshot(urgentSnapshot(snap, () => true)))],
  ]);
  server = await serve(dir, 0, files);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});

after(async () => {
  await browser?.close();
  server?.close();
  await rm(dir, { recursive: true, force: true });
});

type Metrics = Record<string, number>;
async function metrics(cdp: CDPSession): Promise<Metrics> {
  const { metrics: list } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(list.map((m) => [m.name, m.value]));
}
/** Main-thread busy time between two samples, in ms. */
const busyMs = (a: Metrics, b: Metrics) => ((b.TaskDuration ?? 0) - (a.TaskDuration ?? 0)) * 1000;
const transferred = (page: Page) =>
  page.evaluate<number>(
    "[...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].reduce((n, e) => n + e.transferSize, 0)",
  );

// Counts every timer the page's own scripts start (the app must start none).
const COUNT_TIMERS = `(() => {
  const calls = (window.__timers = { setTimeout: 0, setInterval: 0, requestAnimationFrame: 0 });
  for (const name of Object.keys(calls)) {
    const original = window[name].bind(window);
    window[name] = (...args) => { calls[name]++; return original(...args); };
  }
})()`;

test('full load on a slow CPU: fast first render and filtering, no work while idle, no timers', async () => {
  const ctx = await browser.newContext(MOBILE);
  await ctx.addInitScript(COUNT_TIMERS);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });

  const t0 = Date.now();
  await page.goto(base);
  await ready(page);
  const loadMs = Date.now() - t0;
  const loaded = await metrics(cdp);
  assert.equal(await page.locator('article').count(), 260);
  const firstBytes = await transferred(page);

  // Idle: no timers, no polling, nothing to do until the user acts.
  await page.waitForTimeout(3000);
  const idle = await metrics(cdp);
  const idleMs = busyMs(loaded, idle);

  // Typing a search: one full re-render per key.
  const query = 'emergencia';
  await page.locator('#q').pressSequentially(query);
  await page.locator('#nc', { hasText: /^\d+ de 260 noticias$/ }).waitFor();
  const typed = await metrics(cdp);
  const perKeyMs = busyMs(idle, typed) / query.length;

  await page.fill('#q', '');
  const cleared = await metrics(cdp);
  await page.selectOption('#c', 'transport');
  await page.locator('#nc', { hasText: /^\d+ de 260 noticias$/ }).waitFor();
  const selectMs = busyMs(cleared, await metrics(cdp));

  const timers = await page.evaluate<Record<string, number>>('window.__timers');

  // Second visit: the shell comes from the service worker, the news revalidate (304).
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
  await page.reload();
  await ready(page);
  const nextBytes = await transferred(page);

  const report = {
    cpu: `${CPU_SLOWDOWN}×`,
    loadMs,
    scriptMs: Math.round((loaded.ScriptDuration ?? 0) * 1000),
    layoutMs: Math.round(((loaded.LayoutDuration ?? 0) + (loaded.RecalcStyleDuration ?? 0)) * 1000),
    domNodes: loaded.Nodes,
    heapKB: Math.round((loaded.JSHeapUsedSize ?? 0) / 1024),
    idleBusyMs: Math.round(idleMs),
    perKeyMs: Math.round(perKeyMs),
    selectMs: Math.round(selectMs),
    firstVisitKB: +(firstBytes / 1024).toFixed(1),
    nextVisitKB: +(nextBytes / 1024).toFixed(1),
    timers,
  };
  console.log(`perf: ${JSON.stringify(report)}`);

  assert.deepEqual(timers, { setTimeout: 0, setInterval: 0, requestAnimationFrame: 0 }, 'no timers: the CPU sleeps between user actions');
  assert.ok(idleMs < 50, `idle page busy for ${Math.round(idleMs)} ms in 3 s`);
  assert.ok(loadMs < 3000, `list on screen after ${loadMs} ms`);
  assert.ok(perKeyMs < 150, `${Math.round(perKeyMs)} ms per key while searching`);
  assert.ok(selectMs < 300, `${Math.round(selectMs)} ms to apply a filter`);
  await ctx.close();
});
