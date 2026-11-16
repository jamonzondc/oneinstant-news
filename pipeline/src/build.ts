// Orchestrates one data build: reads every source through its adapter and assembles the snapshot.
// No I/O besides the injected HttpClient, so it is fully testable with fakes.
import type { NewsItem, Snapshot, Source } from '../../contract/news.ts';
import { adapterFor, ADAPTERS, type AdapterRegistry } from './adapters/registry.ts';
import { dedupe, isFresh, LIMITS, prepareItems, unusableReason } from './domain/items.ts';
import type { HttpClient } from './infra/http.ts';
import type { SourceDefinition } from './sources/types.ts';

export interface SourceReport {
  id: string;
  ok: boolean;
  items: number;
  error?: string;
  /** Items reused from the previous snapshot because this source failed. */
  reused?: number;
}

export interface BuildOptions {
  sources: SourceDefinition[];
  http: HttpClient;
  now?: number;
  registry?: AdapterRegistry;
  /** Last published snapshot: failing sources keep their previous (still fresh) items. */
  previous?: Snapshot | null;
}

export interface BuildResult {
  snapshot: Snapshot;
  report: SourceReport[];
}

const errorText = (e: unknown) =>
  e instanceof Error ? ((e.cause as { code?: string } | undefined)?.code ?? e.message) : String(e);

export async function buildSnapshot({ sources, http, now = Date.now(), registry = ADAPTERS, previous = null }: BuildOptions): Promise<BuildResult> {
  const active = sources.filter((s) => s.enabled !== false);
  const nowSec = Math.round(now / 1000);

  const results = await Promise.all(
    active.map(async (source): Promise<{ items: NewsItem[]; lastOk: number; report: SourceReport }> => {
      try {
        const raw = await adapterFor(registry, source).read(source, http);
        const items = prepareItems(raw, source, now);
        // Answering with only stale or untitled entries is a failure too (frozen feed): keep the previous items
        // instead. Sparse sources (warnings, quiet official accounts) legitimately have nothing recent.
        if (!items.length && !source.sparse) throw new Error(raw.length ? unusableReason(raw, now) : 'empty feed');
        return { items, lastOk: nowSec, report: { id: source.id, ok: true, items: items.length } };
      } catch (e) {
        const items = previous?.items.filter((it) => it.sourceId === source.id && isFresh(it, now)) ?? [];
        const lastOk = previous?.sources.find((s) => s.id === source.id)?.lastOk ?? 0;
        return { items, lastOk, report: { id: source.id, ok: false, items: items.length, error: errorText(e), reused: items.length } };
      }
    }),
  );

  const items = dedupe(results.flatMap((r) => r.items).sort((a, b) => b.publishedAt - a.publishedAt)).slice(0, LIMITS.total);
  const outSources: Source[] = active.map((s, i) => {
    const out: Source = { id: s.id, name: s.name, kind: s.kind, lastOk: results[i]!.lastOk };
    if (s.region) out.region = s.region;
    return out;
  });

  return {
    snapshot: { generatedAt: nowSec, sources: outSources, items },
    report: results.map((r) => r.report),
  };
}
