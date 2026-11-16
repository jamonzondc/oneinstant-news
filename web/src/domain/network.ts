// Network-aware defaults and data usage. Pure: the browser objects are passed in.
import type { Mode } from './view.ts';

/** The part of `navigator.connection` (Network Information API, Chromium only) we read. */
export interface NetworkInfo {
  effectiveType?: string;
  /** Estimated Mbps. */
  downlink?: number;
  saveData?: boolean;
}

/** 2G-class bandwidth (EDGE tops out around 0.38 Mbps). */
export const SLOW_DOWNLINK_MBPS = 0.4;

/**
 * 2G-like links or the user's data saver. Unknown (Safari, Firefox) counts as not slow. The bandwidth check is
 * needed because Chromium labels a high-latency 2G link "3g" (its "2g" starts at 1400 ms of RTT).
 */
export const isSlow = (n: NetworkInfo | null | undefined): boolean =>
  !!n &&
  (n.saveData === true ||
    n.effectiveType === '2g' ||
    n.effectiveType === 'slow-2g' ||
    (typeof n.downlink === 'number' && n.downlink > 0 && n.downlink <= SLOW_DOWNLINK_MBPS));

/** The user's explicit choice, remembered separately for slow and normal networks. */
export type ModePrefs = Partial<Record<'slow' | 'fast', Mode>>;

const isMode = (m: unknown): m is Mode => m === 'urgent' || m === 'all';

export function parseModePrefs(raw: string | null): ModePrefs {
  const p = new URLSearchParams(raw ?? '');
  const out: ModePrefs = {};
  for (const k of ['slow', 'fast'] as const) {
    const m = p.get(k);
    if (isMode(m)) out[k] = m;
  }
  return out;
}

export const formatModePrefs = (p: ModePrefs) => new URLSearchParams(p as Record<string, string>).toString();

/** A choice made on a slow network does not carry over to a good one, and vice versa. */
export const chooseMode = (prefs: ModePrefs, slow: boolean): Mode => prefs[slow ? 'slow' : 'fast'] ?? (slow ? 'urgent' : 'all');

export const withChoice = (prefs: ModePrefs, slow: boolean, mode: Mode): ModePrefs => ({ ...prefs, [slow ? 'slow' : 'fast']: mode });

/** Bytes that went over the network: `transferSize` is 0 for anything served from a cache. */
export const transferredBytes = (entries: Iterable<{ transferSize?: number }>) => {
  let n = 0;
  for (const e of entries) n += e.transferSize ?? 0;
  return n;
};

const decimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${decimal.format(n / 1024)} KB`;
  return `${decimal.format(n / 1024 / 1024)} MB`;
}
