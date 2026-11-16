// AEMET weather warnings (Plan Meteoalerta). AEMET lists its CAP 1.2 messages in an RSS/Atom feed, one entry per
// warning and zone, e.g. title "Aviso. Nivel amarillo. Costeros. Costa granadina" and summary
// "Aviso de costeros de nivel amarillo de 00:00 18-11-2026 CET (UTC+1) a 23:59 18-11-2026 CET (UTC+1)."
// Everything a reader needs is in the feed, so the CAP files themselves are not downloaded (80+ requests per run).
// Zones sharing level, phenomenon and validity become one item: "Aviso naranja por lluvias: Valle del Tajo, …".
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
  return {
    level: level as Level,
    phenomenon: t[2]!.trim().toLowerCase(),
    zone: t[3]!.trim(),
    window: w[0],
    onset: epoch(w, 1),
    expires: epoch(w, 7),
    publishedAt: item.publishedAt,
    url: item.url,
  };
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

/** Groups zones with the same level, phenomenon and validity. Most severe first, then soonest. */
export function summarizeWarnings(warnings: Warning[]): RawItem[] {
  const groups = new Map<string, Warning[]>();
  for (const w of warnings) {
    const key = `${w.level}|${w.phenomenon}|${w.window}`;
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }
  return [...groups.values()]
    .sort((a, b) => LEVELS.indexOf(a[0]!.level) - LEVELS.indexOf(b[0]!.level) || a[0]!.onset - b[0]!.onset)
    .map((group) => {
      const { level, phenomenon, window, expires } = group[0]!;
      const zones = [...new Set(group.map((w) => w.zone))];
      const head = `Aviso ${level} por ${PHENOMENON_LABEL[phenomenon] ?? phenomenon}: `;
      const published = group.map((w) => w.publishedAt).filter(Number.isFinite);
      return {
        title: head + zoneList(zones, TITLE_BUDGET - head.length),
        summary: `${validity(window)}. ${zones.length} ${zones.length === 1 ? 'zona' : 'zonas'}.`,
        // Each CAP message has its own URL; the group links to its first one (unique, so de-duplication keeps every group).
        url: group[0]!.url,
        publishedAt: published.length ? Math.max(...published) : NaN,
        expiresAt: expires,
      };
    });
}

export class CapAdapter implements SourceAdapter<CapSource> {
  async read(source: CapSource, http: HttpClient): Promise<RawItem[]> {
    const warnings = parseFeed(decodeBody(await http.get(source.url))).map(parseWarning).filter((w) => w !== null);
    return summarizeWarnings(warnings);
  }
}
