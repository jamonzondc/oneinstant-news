import type { CategoryId, SourceKind } from '../../../contract/news.ts';

interface BaseSource {
  /** Stable id: never rename it, the frontend stores it in saved filters. */
  id: string;
  name: string;
  kind: SourceKind;
  /** Forces a category (e.g. a weather-warnings feed); otherwise the classifier decides. */
  category?: CategoryId;
  enabled?: boolean;
}

/** RSS 2.0, RDF or Atom. Also covers Bluesky and Mastodon profiles, which publish RSS. */
export interface RssSource extends BaseSource {
  adapter: 'rss';
  url: string;
}

// A new feed format = a new member here + its adapter in adapters/registry.ts (the compiler enforces both).
export type SourceDefinition = RssSource;
export type AdapterType = SourceDefinition['adapter'];
