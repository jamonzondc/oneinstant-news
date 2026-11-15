// Pure filtering over a decoded snapshot: type (category), entity (source or whole group) and accent-insensitive text.
import { CATEGORIES, SOURCE_KINDS, type CategoryId, type NewsItem, type Snapshot, type Source, type SourceKind } from '../../../contract/news.ts';

/** `src` is '' (all), `k:<kind>` (a whole group) or `s:<sourceId>`. */
export interface Filters {
  cat: CategoryId | '';
  src: string;
  q: string;
}

export const NO_FILTERS: Filters = { cat: '', src: '', q: '' };

export interface Entry {
  item: NewsItem;
  source: Source;
  /** Folded title + summary + source name, for search. */
  text: string;
}

/** Lowercase without diacritics: "Apagón" and "apagon" match. */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function toEntries(snap: Snapshot): Entry[] {
  const byId = new Map(snap.sources.map((s) => [s.id, s]));
  const out: Entry[] = [];
  for (const item of snap.items) {
    const source = byId.get(item.sourceId);
    if (source) out.push({ item, source, text: fold(`${item.title} ${item.summary} ${source.name}`) });
  }
  return out;
}

const matchesSource = (e: Entry, src: string) => !src || src === `s:${e.source.id}` || src === `k:${e.source.kind}`;
const matchesCategory = (e: Entry, cat: Filters['cat']) => !cat || e.item.category === cat;

function matchesQuery(e: Entry, words: string[]) {
  return words.every((w) => e.text.includes(w));
}

const queryWords = (q: string) => fold(q).split(/\s+/).filter(Boolean);

export function filterEntries(entries: Entry[], f: Filters): Entry[] {
  const words = queryWords(f.q);
  return entries.filter((e) => matchesCategory(e, f.cat) && matchesSource(e, f.src) && matchesQuery(e, words));
}

/** Faceted counts per category: applies every filter except the category one. */
export function categoryCounts(entries: Entry[], f: Filters): Map<CategoryId, number> {
  const words = queryWords(f.q);
  const counts = new Map<CategoryId, number>();
  for (const e of entries) {
    if (matchesSource(e, f.src) && matchesQuery(e, words)) counts.set(e.item.category, (counts.get(e.item.category) ?? 0) + 1);
  }
  return counts;
}

/** Faceted counts per source (`s:<id>`) and group (`k:<kind>`): applies every filter except the entity one. */
export function sourceCounts(entries: Entry[], f: Filters): Map<string, number> {
  const words = queryWords(f.q);
  const counts = new Map<string, number>();
  const add = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const e of entries) {
    if (matchesCategory(e, f.cat) && matchesQuery(e, words)) {
      add(`s:${e.source.id}`);
      add(`k:${e.source.kind}`);
    }
  }
  return counts;
}

export interface SourceGroup {
  kind: SourceKind;
  label: string;
  sources: Source[];
}

/** Sources grouped by kind in display order, alphabetical inside each group; empty groups are left out. */
export function groupSources(sources: Source[]): SourceGroup[] {
  return (Object.keys(SOURCE_KINDS) as SourceKind[])
    .map((kind) => ({
      kind,
      label: SOURCE_KINDS[kind],
      sources: sources.filter((s) => s.kind === kind).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    }))
    .filter((g) => g.sources.length > 0);
}

const isCategory = (c: string): c is CategoryId => Object.hasOwn(CATEGORIES, c);

/** Drops values that no longer exist in this snapshot (renamed category, removed source) instead of showing nothing. */
export function sanitize(f: Filters, snap: Snapshot): Filters {
  const [type, id] = [f.src.slice(0, 2), f.src.slice(2)];
  const srcOk =
    !f.src ||
    (type === 's:' && snap.sources.some((s) => s.id === id)) ||
    (type === 'k:' && snap.sources.some((s) => s.kind === id));
  return { cat: f.cat, src: srcOk ? f.src : '', q: f.q };
}

/** Shareable state: `#c=emergency&s=k:official&q=apagon`. Empty values are omitted. */
export function toHash(f: Filters): string {
  const p = new URLSearchParams();
  if (f.cat) p.set('c', f.cat);
  if (f.src) p.set('s', f.src);
  if (f.q.trim()) p.set('q', f.q.trim());
  const s = p.toString();
  return s ? `#${s}` : '';
}

export function fromHash(hash: string): Filters {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const cat = p.get('c') ?? '';
  return { cat: isCategory(cat) ? cat : '', src: p.get('s') ?? '', q: p.get('q') ?? '' };
}

export const isEmpty = (f: Filters) => !f.cat && !f.src && !f.q.trim();
