import type { CategoryId, RegionId, SourceKind } from '../../../contract/news.ts';

interface BaseSource {
  /** Stable id: never rename it, the frontend stores it in saved filters. */
  id: string;
  name: string;
  /** What the entity is (media outlet, public body, other account), not the channel it is read from (ADR 0007). */
  kind: SourceKind;
  /** Forces a category (e.g. a weather-warnings feed); otherwise the classifier decides. */
  category?: CategoryId;
  /** The source's usual topic: used instead of "general" when the classifier finds no keyword. */
  fallbackCategory?: CategoryId;
  enabled?: boolean;
  /** Regional entity (autonomous community); absent = national. */
  region?: RegionId;
  /** Items kept per run; defaults to LIMITS.perSource, or LIMITS.perRegionalSource when `region` is set. */
  maxItems?: number;
  /**
   * Publishes rarely (warnings, low-traffic official accounts): answering with nothing recent is healthy,
   * not a failure. Off by default so a frozen feed (e.g. RTVE's RSS) is still detected.
   */
  sparse?: boolean;
}

/** RSS 2.0, RDF or Atom. Also covers Bluesky and Mastodon profiles, which publish RSS (see sources/networks.ts). */
export interface RssSource extends BaseSource {
  adapter: 'rss';
  url: string;
}

/** Public Telegram channel, read from its web preview https://t.me/s/<channel>. */
export interface TelegramSource extends BaseSource {
  adapter: 'telegram';
  channel: string;
  /** Overrides the preview URL (fixtures). */
  url?: string;
}

/** AEMET's feed of CAP warning messages (RSS or Atom), one entry per warning and zone. */
export interface CapSource extends BaseSource {
  adapter: 'cap';
  url: string;
}

// A new feed format = a new member here + its adapter in adapters/registry.ts (the compiler enforces both).
export type SourceDefinition = RssSource | TelegramSource | CapSource;
export type AdapterType = SourceDefinition['adapter'];
