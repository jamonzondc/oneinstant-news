import type { NewsItem } from '../../../contract/news.ts';
import type { RawItem } from '../adapters/source-adapter.ts';
import type { SourceDefinition } from '../sources/types.ts';
import { classify } from './classifier.ts';
import { cleanUrl, normalize, truncate } from './text.ts';

export const LIMITS = {
  perSource: 12,
  maxAgeHours: 36,
  total: 260,
  titleChars: 180,
  summaryChars: 170,
} as const;

const maxAgeMs = LIMITS.maxAgeHours * 3600_000;

/** Cleans, classifies and trims one source's raw items. `now` in epoch ms. */
export function prepareItems(raw: RawItem[], source: SourceDefinition, now: number): NewsItem[] {
  const out: NewsItem[] = [];
  for (const it of raw) {
    let { title, summary } = it;
    if (!title && summary) {
      // Social posts have no headline: the first sentence-ish chunk becomes the title.
      title = truncate(summary, LIMITS.titleChars);
      summary = summary.length > LIMITS.titleChars ? summary.slice(title.length - 1).replace(/^[\s.,;:—–-]+/, '') : '';
    }
    if (!title) continue;
    const publishedAt = Number.isFinite(it.publishedAt) ? Math.min(it.publishedAt, now) : now;
    if (publishedAt < now - maxAgeMs) continue;
    if (summary && normalize(summary).startsWith(normalize(title))) summary = summary.slice(title.length).trim();
    out.push({
      sourceId: source.id,
      category: source.category ?? classify(title, summary),
      publishedAt: Math.round(publishedAt / 1000),
      title: truncate(title, LIMITS.titleChars),
      summary: summary ? truncate(summary, LIMITS.summaryChars) : '',
      url: cleanUrl(it.url),
    });
  }
  return out.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, LIMITS.perSource);
}

/** Drops repeats by normalised headline or URL, keeping the first (most recent if sorted). */
export function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((it) => {
    const keys = [normalize(it.title).slice(0, 90), it.url].filter(Boolean);
    if (keys.some((k) => seen.has(k))) return false;
    for (const k of keys) seen.add(k);
    return true;
  });
}

export const isFresh = (it: NewsItem, now: number) => it.publishedAt * 1000 >= now - maxAgeMs;
