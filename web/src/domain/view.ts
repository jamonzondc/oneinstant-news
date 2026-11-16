// What the list shows: the full copy, the urgent copy or both combined, depending on the mode and on which
// copy is newer. Expired warnings are dropped here, so a stale copy never shows a warning out of force.
import { isUrgent, type NewsItem, type Snapshot, type Source } from '../../../contract/news.ts';

/** `urgent`: only news-urgent.json is downloaded. `all`: the urgent file first, then news.json. */
export type Mode = 'urgent' | 'all';

export interface View {
  snap: Snapshot;
  /** Set when the non-urgent news are older than the urgent ones: their time, or 0 if they never loaded. */
  restAt?: number;
}

const inForce = (it: NewsItem, now: number) => it.expiresAt === undefined || it.expiresAt > now;
const newestFirst = (a: NewsItem, b: NewsItem) => b.publishedAt - a.publishedAt;

function onlyUsedSources(sources: Source[], items: NewsItem[]): Source[] {
  const used = new Set(items.map((it) => it.sourceId));
  return sources.filter((s) => used.has(s.id));
}

function urgentPart(s: Snapshot): Snapshot {
  const items = s.items.filter((it) => isUrgent(it.category));
  return { generatedAt: s.generatedAt, sources: onlyUsedSources(s.sources, items), items };
}

const newer = (a: Snapshot | null, b: Snapshot | null) => (!a ? b : !b || a.generatedAt >= b.generatedAt ? a : b);

function combine(full: Snapshot | null, urgent: Snapshot | null): View | null {
  if (!full) return urgent && { snap: urgent, restAt: 0 };
  if (!urgent || urgent.generatedAt <= full.generatedAt) return { snap: full };
  // The urgent file is newer (the full download failed or is still on its way): newest urgent items on top
  // of the older non-urgent ones.
  const sources = new Map(full.sources.map((s) => [s.id, s]));
  for (const s of urgent.sources) sources.set(s.id, s);
  const items = [...urgent.items, ...full.items.filter((it) => !isUrgent(it.category))].sort(newestFirst);
  return { snap: { generatedAt: urgent.generatedAt, sources: [...sources.values()], items }, restAt: full.generatedAt };
}

/** `now` in epoch seconds. */
export function currentView(mode: Mode, full: Snapshot | null, urgent: Snapshot | null, now: number): View | null {
  const view = mode === 'urgent' ? wrap(newer(urgent, full && urgentPart(full))) : combine(full, urgent);
  if (!view) return null;
  return { ...view, snap: { ...view.snap, items: view.snap.items.filter((it) => inForce(it, now)) } };
}

const wrap = (snap: Snapshot | null): View | null => snap && { snap };

export interface EmergencyAlert {
  count: number;
  latest: NewsItem;
}

export const ALERT_WINDOW_SECONDS = 3600;

/** Emergencies published in the last hour, for the banner. `items` newest first, `now` in epoch seconds. */
export function emergencyAlert(items: NewsItem[], now: number): EmergencyAlert | null {
  const recent = items.filter((it) => it.category === 'emergency' && now - it.publishedAt <= ALERT_WINDOW_SECONDS);
  return recent.length ? { count: recent.length, latest: recent[0]! } : null;
}
