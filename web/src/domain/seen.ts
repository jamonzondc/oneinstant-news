// "New since your last visit". The watermark is the publication time of the newest item the reader has had on
// screen; a visit starts when the app opens or comes back after a while (app.ts), and items published after the
// previous visit's watermark are flagged as new. Items that reach a feed late (published before the watermark)
// are not flagged: an occasional miss, never a false "new".
import type { NewsItem } from '../../../contract/news.ts';

/** Stored watermark (epoch seconds), or null: first visit or unreadable value. */
export function parseSeen(raw: string | null): number | null {
  const n = raw ? Number(raw) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Watermark after showing `items`. It never goes back (an older cached copy must not flag again what was seen),
 * and ignores items dated in the future (a feed with a wrong clock would hide the real new ones).
 */
export function advanceSeen(seen: number | null, items: readonly Pick<NewsItem, 'publishedAt'>[], now: number): number | null {
  let newest = seen ?? 0;
  for (const { publishedAt } of items) if (publishedAt <= now && publishedAt > newest) newest = publishedAt;
  return newest || seen;
}

/** On a first visit (`since` null) nothing is new: everything would be. */
export const isNew = (item: Pick<NewsItem, 'publishedAt'>, since: number | null) => since !== null && item.publishedAt > since;

export const countNew = (entries: readonly { item: Pick<NewsItem, 'publishedAt'> }[], since: number | null) =>
  since === null ? 0 : entries.reduce((n, e) => n + (isNew(e.item, since) ? 1 : 0), 0);
