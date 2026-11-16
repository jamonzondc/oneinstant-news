import type { RegionId } from '../../../contract/news.ts';
import type { HttpClient } from '../infra/http.ts';
import type { SourceDefinition } from '../sources/types.ts';

/** What every adapter returns before cleaning: the common denominator of any feed. */
export interface RawItem {
  title: string;
  summary: string;
  url: string;
  /** Epoch ms; NaN when the feed does not say. */
  publishedAt: number;
  /** Epoch ms when it stops being valid (warnings). While in force it is kept whatever its age. */
  expiresAt?: number;
  /** When the item concerns one community and not the source's whole area (e.g. a warning). */
  region?: RegionId;
}

export interface SourceAdapter<S extends SourceDefinition = SourceDefinition> {
  read(source: S, http: HttpClient): Promise<RawItem[]>;
}
