import type { NewsItem } from '../../../contract/news.ts';
import type { RawItem } from '../adapters/source-adapter.ts';
import type { SourceDefinition } from '../sources/types.ts';
import { classify } from './classifier.ts';
import { cleanUrl, normalize, truncate } from './text.ts';

export const LIMITS = {
  perSource: 12,
  /** Regional outlets add many sources: fewer items each keeps news.json within budget. */
  perRegionalSource: 5,
  maxAgeHours: 36,
  total: 260,
  titleChars: 180,
  summaryChars: 170,
} as const;

const maxAgeMs = LIMITS.maxAgeHours * 3600_000;

const newestFirst = (a: NewsItem, b: NewsItem) => b.publishedAt - a.publishedAt;

export const maxItems = (s: SourceDefinition) => s.maxItems ?? (s.region ? LIMITS.perRegionalSource : LIMITS.perSource);

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
    if (it.expiresAt !== undefined ? it.expiresAt <= now : publishedAt < now - maxAgeMs) continue;
    if (summary && normalize(summary).startsWith(normalize(title))) summary = summary.slice(title.length).trim();
    const item: NewsItem = {
      sourceId: source.id,
      category: source.category ?? classify(title, summary, source.fallbackCategory),
      publishedAt: Math.round(publishedAt / 1000),
      title: truncate(title, LIMITS.titleChars),
      summary: summary ? truncate(summary, LIMITS.summaryChars) : '',
      url: cleanUrl(it.url),
    };
    if (it.expiresAt !== undefined) item.expiresAt = Math.round(it.expiresAt / 1000);
    if (it.region && it.region !== source.region) item.region = it.region;
    out.push(item);
  }
  // Warnings come most severe first from their adapter: the cut keeps that order. News keep the newest.
  const ranked = out.length && out.every((it) => it.expiresAt !== undefined) ? out : out.toSorted(newestFirst);
  return ranked.slice(0, maxItems(source)).sort(newestFirst);
}

/** Why a feed that answered yields nothing usable, e.g. "12 raw: 12 older than 36 h (newest 2025-03-01T10:00:00Z)". */
export function unusableReason(raw: RawItem[], now: number): string {
  const untitled = raw.filter((it) => !it.title && !it.summary).length;
  const dated = raw.filter((it) => Number.isFinite(it.publishedAt));
  const stale = dated.filter((it) => it.publishedAt < now - maxAgeMs).length;
  const newest = dated.length ? new Date(Math.max(...dated.map((it) => it.publishedAt))).toISOString().replace('.000', '') : 'none';
  return `no usable items (${raw.length} raw: ${stale} older than ${LIMITS.maxAgeHours} h, ${untitled} untitled; newest ${newest})`;
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

/** Same rule as `prepareItems`: a warning lasts while in force, anything else up to `maxAgeHours`. `now` in epoch ms. */
export const isFresh = (it: NewsItem, now: number) =>
  it.expiresAt !== undefined ? it.expiresAt * 1000 > now : it.publishedAt * 1000 >= now - maxAgeMs;
