// Shared settings for the e2e suites (not a test file: no `.e2e.ts` suffix).
import type { BrowserContextOptions, Page } from 'playwright';

export const MOBILE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid' };

/** News on screen and no download in progress (the urgent file renders before the full one arrives). */
export async function ready(page: Page) {
  await page.locator('article').first().waitFor();
  await page.locator('#r:not([disabled])').waitFor();
}
