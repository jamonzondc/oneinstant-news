import type { AdapterType, SourceDefinition } from '../sources/types.ts';
import { CapAdapter } from './cap-adapter.ts';
import { RssAdapter } from './rss-adapter.ts';
import type { SourceAdapter } from './source-adapter.ts';
import { TelegramAdapter } from './telegram-adapter.ts';

export type AdapterRegistry = { [K in AdapterType]: SourceAdapter<Extract<SourceDefinition, { adapter: K }>> };

/** One instance per adapter type. Missing an entry here is a compile error. */
export const ADAPTERS: AdapterRegistry = {
  rss: new RssAdapter(),
  telegram: new TelegramAdapter(),
  cap: new CapAdapter(),
};

export function adapterFor<S extends SourceDefinition>(registry: AdapterRegistry, source: S): SourceAdapter<S> {
  return registry[source.adapter] as SourceAdapter<S>;
}
