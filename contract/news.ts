// Contract of /news.json: the only thing the frontend knows about the data pipeline.
// The wire format uses positional arrays to keep the payload small; consumers use the decoded types.

export const CONTRACT_VERSION = 1;

export const SOURCE_KINDS = {
  media: 'Medios',
  official: 'Fuentes oficiales',
  social: 'Redes sociales',
} as const;
export type SourceKind = keyof typeof SOURCE_KINDS;

/** Autonomous communities and cities (ISO 3166-2:ES codes, lowercase). A source or item without one is national. */
export const REGIONS = {
  an: 'Andalucía',
  ar: 'Aragón',
  as: 'Asturias',
  ib: 'Illes Balears',
  cn: 'Canarias',
  cb: 'Cantabria',
  cl: 'Castilla y León',
  cm: 'Castilla-La Mancha',
  ct: 'Cataluña',
  ex: 'Extremadura',
  ga: 'Galicia',
  md: 'Madrid',
  mc: 'Murcia',
  nc: 'Navarra',
  pv: 'País Vasco',
  ri: 'La Rioja',
  vc: 'Comunitat Valenciana',
  ce: 'Ceuta',
  ml: 'Melilla',
} as const;
export type RegionId = keyof typeof REGIONS;
export const REGION_IDS = Object.keys(REGIONS) as RegionId[];
export const isRegion = (r: unknown): r is RegionId => typeof r === 'string' && Object.hasOwn(REGIONS, r);

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

/** Categories published again in the small urgent file, most severe first. */
export const URGENT_CATEGORIES: readonly CategoryId[] = ['emergency', 'utilities', 'weather'];
export const isUrgent = (c: CategoryId) => URGENT_CATEGORIES.includes(c);

/** Same format as /news.json with only urgent items (≤ 3 KB gzip); loaded first on slow networks. */
export const URGENT_FILE = 'news-urgent.json';

export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  /** Epoch seconds of the last successful fetch, 0 if never. */
  lastOk: number;
  /** Regional entity; absent = national. */
  region?: RegionId;
}

export interface NewsItem {
  sourceId: string;
  category: CategoryId;
  /** Epoch seconds. */
  publishedAt: number;
  title: string;
  summary: string;
  url: string;
  /** Epoch seconds when it stops being valid (warnings). Absent for regular news. */
  expiresAt?: number;
  /** Only when it differs from its source's (e.g. a national body's warning for one community). */
  region?: RegionId;
}

/** Where an item belongs: its own region, else its source's; undefined = national. */
export const itemRegion = (it: NewsItem, source: Source | undefined): RegionId | undefined => it.region ?? source?.region;

export interface Snapshot {
  /** Epoch seconds. */
  generatedAt: number;
  sources: Source[];
  items: NewsItem[];
}

// Optional positions are appended only when present, and older clients ignore extra positions:
// `expiresAt` since 0.5.0, the regions since 0.6.0. An item with a region but no expiry carries `null` at 6.
type SourceRow = [id: string, name: string, kind: SourceKind, lastOk: number, region?: RegionId];
type ItemRow = [
  sourceIndex: number, category: CategoryId, publishedAt: number, title: string, summary: string, url: string,
  expiresAt?: number | null, region?: RegionId,
];

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
    s: snap.sources.map((s) => {
      const row: SourceRow = [s.id, s.name, s.kind, s.lastOk];
      if (s.region) row.push(s.region);
      return row;
    }),
    i: snap.items.map((it) => {
      const si = index.get(it.sourceId);
      if (si === undefined) throw new Error(`Unknown source "${it.sourceId}"`);
      const row: ItemRow = [si, it.category, it.publishedAt, it.title, it.summary, it.url];
      if (it.expiresAt !== undefined || it.region) row.push(it.expiresAt ?? null);
      if (it.region) row.push(it.region);
      return row;
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
    const source: Source = { id: r[0], name: r[1], kind: r[2], lastOk: Number(r[3]) || 0 };
    if (isRegion(r[4])) source.region = r[4];
    return source;
  });
  const items: NewsItem[] = [];
  for (const r of f.i) {
    const src = Array.isArray(r) ? sources[r[0]] : undefined;
    if (!src || typeof r[2] !== 'number' || typeof r[3] !== 'string') continue;
    const item: NewsItem = {
      sourceId: src.id,
      category: isCategory(r[1]) ? r[1] : 'general',
      publishedAt: r[2],
      title: r[3],
      summary: typeof r[4] === 'string' ? r[4] : '',
      url: typeof r[5] === 'string' ? r[5] : '',
    };
    if (typeof r[6] === 'number') item.expiresAt = r[6];
    if (isRegion(r[7])) item.region = r[7];
    items.push(item);
  }
  return { generatedAt: f.t, sources, items };
}
