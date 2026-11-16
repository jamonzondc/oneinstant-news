// news.json must stay within its gzip budget however many sources answer: the oldest non-urgent items go first.
import { isUrgent, type Snapshot } from '../../../contract/news.ts';

/** news.json size budget, gzip (ADR 0002). */
export const NEWS_BUDGET_GZIP_BYTES = 30 * 1024;
/** lite.html size budget, gzip: same items as HTML weigh a bit more than the JSON, so it may hold fewer. */
export const LITE_BUDGET_GZIP_BYTES = 30 * 1024;

/**
 * Largest prefix of `snap.items` by priority (urgent first, then newest) that `fits` accepts, in the original order.
 * Size grows with the item count, so a binary search needs ~log2(n) checks instead of n.
 */
export function fitSnapshot(snap: Snapshot, fits: (s: Snapshot) => boolean): Snapshot {
  // Stable sort: inside each group the newest-first order is kept.
  const priority = snap.items.toSorted((a, b) => Number(isUrgent(b.category)) - Number(isUrgent(a.category)));
  const build = (n: number): Snapshot => {
    const keep = new Set(priority.slice(0, n));
    return { ...snap, items: snap.items.filter((it) => keep.has(it)) };
  };
  if (fits(snap)) return snap;
  let lo = 0;
  let hi = priority.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(build(mid))) lo = mid;
    else hi = mid - 1;
  }
  return build(lo);
}
