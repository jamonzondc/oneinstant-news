// Contract of /news.json: the only thing the frontend knows about the data pipeline.
// The wire format uses positional arrays to keep the payload small; consumers use the decoded types.

export const CONTRACT_VERSION = 1;

export const SOURCE_KINDS = {
  media: 'Medios',
  official: 'Fuentes oficiales',
  social: 'Redes sociales',
} as const;
export type SourceKind = keyof typeof SOURCE_KINDS;

/** Display order is also the priority used by the classifier on ties. */
export const CATEGORIES = {
  emergency: 'Emergencias',
  utilities: 'Luz, agua y telecom',
  weather: 'Tiempo y avisos',
  transport: 'Transporte y tráfico',
  health: 'Salud',
  crime: 'Sucesos y justicia',
  world: 'Internacional',
  politics: 'Política',
  economy: 'Economía',
  technology: 'Tecnología',
  sports: 'Deportes',
  culture: 'Cultura y sociedad',
  general: 'General',
} as const;
export type CategoryId = keyof typeof CATEGORIES;
export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];

export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  /** Epoch seconds of the last successful fetch, 0 if never. */
  lastOk: number;
}

export interface NewsItem {
  sourceId: string;
  category: CategoryId;
  /** Epoch seconds. */
  publishedAt: number;
  title: string;
  summary: string;
  url: string;
}

export interface Snapshot {
  /** Epoch seconds. */
  generatedAt: number;
  sources: Source[];
  items: NewsItem[];
}

type SourceRow = [id: string, name: string, kind: SourceKind, lastOk: number];
type ItemRow = [sourceIndex: number, category: CategoryId, publishedAt: number, title: string, summary: string, url: string];

export interface NewsFile {
  v: typeof CONTRACT_VERSION;
  t: number;
  s: SourceRow[];
  i: ItemRow[];
}

export function encodeSnapshot(snap: Snapshot): NewsFile {
  const index = new Map(snap.sources.map((s, i) => [s.id, i]));
  return {
    v: CONTRACT_VERSION,
    t: snap.generatedAt,
    s: snap.sources.map((s) => [s.id, s.name, s.kind, s.lastOk]),
    i: snap.items.map((it) => {
      const si = index.get(it.sourceId);
      if (si === undefined) throw new Error(`Unknown source "${it.sourceId}"`);
      return [si, it.category, it.publishedAt, it.title, it.summary, it.url];
    }),
  };
}

const isKind = (k: unknown): k is SourceKind => typeof k === 'string' && Object.hasOwn(SOURCE_KINDS, k);
const isCategory = (c: unknown): c is CategoryId => typeof c === 'string' && Object.hasOwn(CATEGORIES, c);

/** Validates untrusted JSON. Unknown categories fall back to "general" so old clients survive new categories. */
export function decodeSnapshot(data: unknown): Snapshot {
  const f = data as Partial<NewsFile> | null;
  if (!f || f.v !== CONTRACT_VERSION || typeof f.t !== 'number' || !Array.isArray(f.s) || !Array.isArray(f.i)) {
    throw new Error('Invalid news file');
  }
  const sources: Source[] = f.s.map((r) => {
    if (!Array.isArray(r) || typeof r[0] !== 'string' || typeof r[1] !== 'string' || !isKind(r[2])) throw new Error('Invalid source row');
    return { id: r[0], name: r[1], kind: r[2], lastOk: Number(r[3]) || 0 };
  });
  const items: NewsItem[] = [];
  for (const r of f.i) {
    const src = Array.isArray(r) ? sources[r[0]] : undefined;
    if (!src || typeof r[2] !== 'number' || typeof r[3] !== 'string') continue;
    items.push({
      sourceId: src.id,
      category: isCategory(r[1]) ? r[1] : 'general',
      publishedAt: r[2],
      title: r[3],
      summary: typeof r[4] === 'string' ? r[4] : '',
      url: typeof r[5] === 'string' ? r[5] : '',
    });
  }
  return { generatedAt: f.t, sources, items };
}
