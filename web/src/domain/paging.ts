// "Ver más": only the first PAGE_SIZE news are painted and each tap paints the next block. Filters, counts and
// search always work on every news item; only the painting is paged (fewer DOM nodes, faster renders). ADR 0013.
export const PAGE_SIZE = 40;

export interface Page {
  /** How many of the filtered news are painted. */
  end: number;
  /** How many are still unpainted. */
  left: number;
  /** How many the next tap paints. */
  next: number;
}

/** `limit`: how many the reader asked to see (PAGE_SIZE, then + PAGE_SIZE per tap). */
export function page(total: number, limit: number): Page {
  const end = Math.min(Math.max(limit, PAGE_SIZE), Math.max(total, 0));
  const left = Math.max(total, 0) - end;
  return { end, left, next: Math.min(PAGE_SIZE, left) };
}
