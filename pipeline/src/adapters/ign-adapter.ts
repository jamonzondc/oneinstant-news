// Earthquakes from the IGN (Instituto Geográfico Nacional): GeoRSS of the last ten days, every recorded quake.
// Its headline is useless ("-Info.terremoto: 16/11/2026 7:59:46") and most quakes are tiny or far at sea, so only those
// of `minMagnitude` or more are kept, with a readable headline: "Terremoto de magnitud 4,6 en Atlántico-Marruecos".
import type { CategoryId } from '../../../contract/news.ts';
import { decodeBody, type HttpClient } from '../infra/http.ts';
import type { IgnSource } from '../sources/types.ts';
import { parseFeed } from './rss-adapter.ts';
import type { RawItem, SourceAdapter } from './source-adapter.ts';

export const DEFAULT_MIN_MAGNITUDE = 3.5;
/** From here a quake is felt widely and can cause damage: it goes to Emergencias (and the urgent file). */
export const EMERGENCY_MAGNITUDE = 5;

export interface Quake {
  magnitude: number;
  place: string;
  /** Epoch ms. The IGN catalogue gives times in UTC. */
  at: number;
  lat: string;
  lon: string;
}

const TEXT = /magnitud\s+([\d.,]+)\s+en\s+(.+?)\s+en la fecha\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:.*?localizaci[oó]n:\s*([-\d.]+),\s*([-\d.]+))?/i;

export function parseQuake(description: string): Quake | null {
  const m = TEXT.exec(description);
  if (!m) return null;
  const [d, mo, y, h, mi, s] = m.slice(3, 9).map(Number) as [number, number, number, number, number, number];
  return { magnitude: Number(m[1]!.replace(',', '.')), place: m[2]!, at: Date.UTC(y, mo - 1, d, h, mi, s), lat: m[9] ?? '', lon: m[10] ?? '' };
}

/** "SW SANTA FE.GR" -> "SW Santa Fe (GR)": words in title case, compass points and the province/country code kept. */
export function placeName(raw: string): string {
  const [name, code] = raw.split(/\.(?=[A-Z]{1,3}$)/);
  const words = name!.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
  const fixed = words.replace(/\b(N|S|E|W|Ne|Nw|Se|Sw)\b/g, (w) => w.toUpperCase()).replace(/\b(De|Del|La|Las|El|Los|Y)\b/g, (w) => w.toLowerCase());
  return code ? `${fixed} (${code})` : fixed;
}

export function quakeItem(q: Quake, url: string): RawItem & { category: CategoryId } {
  return {
    title: `Terremoto de magnitud ${q.magnitude.toFixed(1).replace('.', ',')} en ${placeName(q.place)}`,
    summary: q.lat ? `Epicentro: ${q.lat}, ${q.lon}. Fuente: catálogo sísmico del IGN.` : 'Fuente: catálogo sísmico del IGN.',
    url,
    publishedAt: q.at,
    category: q.magnitude >= EMERGENCY_MAGNITUDE ? 'emergency' : 'general',
  };
}

export class IgnAdapter implements SourceAdapter<IgnSource> {
  async read(source: IgnSource, http: HttpClient): Promise<RawItem[]> {
    const min = source.minMagnitude ?? DEFAULT_MIN_MAGNITUDE;
    return parseFeed(decodeBody(await http.get(source.url))).flatMap((it) => {
      const q = parseQuake(it.summary);
      return q && q.magnitude >= min ? [quakeItem(q, it.url)] : [];
    });
  }
}
