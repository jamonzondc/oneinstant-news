// AEMET weather warnings (Plan Meteoalerta). AEMET lists its CAP 1.2 messages in an RSS/Atom feed, one entry per
// warning and zone, e.g. title "Aviso. Nivel amarillo. Costeros. Costa granadina" and summary
// "Aviso de costeros de nivel amarillo de 00:00 18-11-2026 CET (UTC+1) a 23:59 18-11-2026 CET (UTC+1)."
// Everything a reader needs is in the feed, so the CAP files themselves are not downloaded (80+ requests per run).
// Zones sharing community, level, phenomenon and validity become one item:
// "Aviso naranja por lluvias en Castilla-La Mancha: Valle del Tajo, …", tagged with that community.
import { REGIONS, type RegionId } from '../../../contract/news.ts';
import { decodeBody, type HttpClient } from '../infra/http.ts';
import type { CapSource } from '../sources/types.ts';
import { parseFeed } from './rss-adapter.ts';
import type { RawItem, SourceAdapter } from './source-adapter.ts';

export const LEVELS = ['rojo', 'naranja', 'amarillo'] as const;
export type Level = (typeof LEVELS)[number];

export interface Warning {
  level: Level;
  /** As AEMET names it, lowercase: "costeros", "vientos", "lluvias", "temperaturas máximas"… */
  phenomenon: string;
  zone: string;
  /** Validity as written by AEMET, e.g. "de 00:00 18-11-2026 CET (UTC+1) a 23:59 18-11-2026 CET (UTC+1)". */
  window: string;
  onset: number;
  expires: number;
  publishedAt: number;
  url: string;
  region?: RegionId;
}

// Each CAP message is named after its zone, e.g. ".../Z_CAP_C_LEMM_20261115105001_AFAZ684501PRPR1823.xml": AFAZ, then the
// Meteoalerta area (68 = Castilla-La Mancha), the province (45 = Toledo, INE code) and the zone number.
const ZONE_CODE = /AFAZ(\d{2})(\d{2})\d{2}/;
/** INE province code -> community. */
const PROVINCE: Record<string, RegionId> = {
  '01': 'pv', '02': 'cm', '03': 'vc', '04': 'an', '05': 'cl', '06': 'ex', '07': 'ib', '08': 'ct', '09': 'cl', '10': 'ex',
  '11': 'an', '12': 'vc', '13': 'cm', '14': 'an', '15': 'ga', '16': 'cm', '17': 'ct', '18': 'an', '19': 'cm', '20': 'pv',
  '21': 'an', '22': 'ar', '23': 'an', '24': 'cl', '25': 'ct', '26': 'ri', '27': 'ga', '28': 'md', '29': 'an', '30': 'mc',
  '31': 'nc', '32': 'ga', '33': 'as', '34': 'cl', '35': 'cn', '36': 'ga', '37': 'cl', '38': 'cn', '39': 'cb', '40': 'cl',
  '41': 'an', '42': 'cl', '43': 'ct', '44': 'ar', '45': 'cm', '46': 'vc', '47': 'cl', '48': 'pv', '49': 'cl', '50': 'ar',
  '51': 'ce', '52': 'ml',
};
/**
 * Meteoalerta area -> community, only for zones whose second pair is not an INE province (Mallorca 54, Menorca 55).
 * Only areas seen in AEMET's feed (2026-11-16) are listed: the province is the reliable part of the code.
 */
const AREA: Record<string, RegionId> = {
  '61': 'an', '63': 'as', '64': 'ib', '66': 'cb', '67': 'cl', '68': 'cm', '69': 'ct', '70': 'ex', '71': 'ga', '74': 'nc', '76': 'ri',
};

/** Community of a CAP message from its file name; undefined if the name does not follow the pattern. */
export function zoneRegion(url: string): RegionId | undefined {
  const m = ZONE_CODE.exec(url);
  return m ? (PROVINCE[m[2]!] ?? AREA[m[1]!]) : undefined;
}

const TITLE = /^Aviso\.\s*Nivel\s+(\p{L}+)\.\s*([^.]+?)\.\s*(.+)$/u;
const STAMP = String.raw`(\d{1,2}):(\d{2}) (\d{2})-(\d{2})-(\d{4}) [A-Z]+ \(UTC([+-]\d{1,2})\)`;
const WINDOW = new RegExp(`de ${STAMP} a ${STAMP}`);

function epoch(m: RegExpExecArray, at: number): number {
  const [hh, mm, dd, mo, yyyy, offset] = m.slice(at, at + 6).map(Number) as [number, number, number, number, number, number];
  return Date.UTC(yyyy, mo - 1, dd, hh - offset, mm);
}

/** One feed entry -> warning, or null for the index entry, "verde" (no warning) or anything unexpected. */
export function parseWarning(item: RawItem): Warning | null {
  const t = TITLE.exec(item.title.trim());
  const w = WINDOW.exec(item.summary);
  if (!t || !w) return null;
  const level = t[1]!.toLowerCase();
  if (!(LEVELS as readonly string[]).includes(level)) return null;
  const warning: Warning = {
    level: level as Level,
    phenomenon: t[2]!.trim().toLowerCase(),
    zone: t[3]!.trim(),
    window: w[0],
    onset: epoch(w, 1),
    expires: epoch(w, 7),
    publishedAt: item.publishedAt,
    url: item.url,
  };
  const region = zoneRegion(item.url);
  if (region) warning.region = region;
  return warning;
}

const PHENOMENON_LABEL: Record<string, string> = { costeros: 'fenómenos costeros' };
const pad = (n: number) => String(n).padStart(2, '0');

/** "de 00:00 18-11-2026 CET (UTC+1) a 23:59 18-11-2026 CET (UTC+1)" -> "Del 18/11 00:00 al 18/11 23:59 (CET)". */
function validity(window: string): string {
  const m = WINDOW.exec(window)!;
  const zone = /[A-Z]+(?= \(UTC)/.exec(window)?.[0] ?? '';
  const at = (i: number) => `${pad(Number(m[i + 2]))}/${pad(Number(m[i + 3]))} ${pad(Number(m[i]))}:${m[i + 1]}`;
  return `Del ${at(1)} al ${at(7)}${zone ? ` (${zone})` : ''}`;
}

/** Lists zones until the title budget, then "y N más". */
function zoneList(zones: string[], budget: number): string {
  let out = '';
  for (let i = 0; i < zones.length; i++) {
    const rest = zones.length - i - 1;
    const next = (out ? `${out}, ` : '') + zones[i];
    const tail = rest ? ` y ${rest} más` : '';
    if (out && next.length + tail.length > budget) return `${out} y ${zones.length - i} más`;
    out = next;
  }
  return out;
}

const TITLE_BUDGET = 170;

/** Groups zones with the same community, level, phenomenon and validity. Most severe first, then soonest. */
export function summarizeWarnings(warnings: Warning[]): RawItem[] {
  const groups = new Map<string, Warning[]>();
  for (const w of warnings) {
    const key = `${w.region ?? ''}|${w.level}|${w.phenomenon}|${w.window}`;
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }
  return [...groups.values()]
    .sort((a, b) => LEVELS.indexOf(a[0]!.level) - LEVELS.indexOf(b[0]!.level) || a[0]!.onset - b[0]!.onset)
    .map((group) => {
      const { level, phenomenon, window, expires, region } = group[0]!;
      const zones = [...new Set(group.map((w) => w.zone))];
      const where = region ? ` en ${REGIONS[region]}` : '';
      const head = `Aviso ${level} por ${PHENOMENON_LABEL[phenomenon] ?? phenomenon}${where}: `;
      const published = group.map((w) => w.publishedAt).filter(Number.isFinite);
      const item: RawItem = {
        title: head + zoneList(zones, TITLE_BUDGET - head.length),
        summary: `${validity(window)}. ${zones.length} ${zones.length === 1 ? 'zona' : 'zonas'}.`,
        // Each CAP message has its own URL; the group links to its first one (unique, so de-duplication keeps every group).
        url: group[0]!.url,
        publishedAt: published.length ? Math.max(...published) : NaN,
        expiresAt: expires,
      };
      if (region) item.region = region;
      return item;
    });
}

export class CapAdapter implements SourceAdapter<CapSource> {
  async read(source: CapSource, http: HttpClient): Promise<RawItem[]> {
    const warnings = parseFeed(decodeBody(await http.get(source.url))).map(parseWarning).filter((w) => w !== null);
    return summarizeWarnings(warnings);
  }
}
