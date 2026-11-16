// The urgent file: emergencies, supplies and warnings only, small enough to arrive first on a 2G link.
import { isUrgent, URGENT_CATEGORIES, type NewsItem, type Snapshot } from '../../../contract/news.ts';

/** news-urgent.json size budget, gzip (ADR 0008). */
export const URGENT_BUDGET_GZIP_BYTES = 3 * 1024;

const rank = (it: NewsItem) => URGENT_CATEGORIES.indexOf(it.category);

/**
 * Urgent items of `snap`, trimmed until `fits` accepts the result: the least severe category goes first and,
 * inside a category, the oldest item. Keeps the original (newest first) order and only the sources referenced.
 */
export function urgentSnapshot(snap: Snapshot, fits: (s: Snapshot) => boolean): Snapshot {
  const urgent = snap.items.filter((it) => isUrgent(it.category));
  // Stable sort: items of the same category keep their newest-first order.
  const priority = urgent.toSorted((a, b) => rank(a) - rank(b));
  const build = (n: number): Snapshot => {
    const keep = new Set(priority.slice(0, n));
    const items = urgent.filter((it) => keep.has(it));
    const used = new Set(items.map((it) => it.sourceId));
    return { generatedAt: snap.generatedAt, sources: snap.sources.filter((s) => used.has(s.id)), items };
  };
  for (let n = priority.length; n > 0; n--) {
    const candidate = build(n);
    if (fits(candidate)) return candidate;
  }
  return build(0);
}
