import type { SourceDefinition } from './types.ts';

const fixture = (name: string) => new URL(`../../test/fixtures/${name}`, import.meta.url).href;

/** Offline catalogue for local development and tests (`npm run build:data:fixtures`). */
export const FIXTURE_SOURCES: SourceDefinition[] = [
  { id: 'rss-utf8', name: 'Diario UTF-8', kind: 'media', adapter: 'rss', url: fixture('rss-utf8.xml') },
  { id: 'rss-latin1', name: 'Diario Latin-1', kind: 'media', adapter: 'rss', url: fixture('rss-latin1.xml') },
  { id: 'atom', name: 'Organismo Atom', kind: 'official', adapter: 'rss', url: fixture('atom.xml'), category: 'weather' },
  { id: 'bluesky', name: 'Cuenta Bluesky', kind: 'social', adapter: 'rss', url: fixture('bluesky.xml') },
  { id: 'telegram', name: 'Canal Telegram', kind: 'official', adapter: 'telegram', channel: 'fixture', url: fixture('telegram.html') },
  { id: 'aemet-cap', name: 'Avisos CAP', kind: 'official', adapter: 'cap', url: fixture('aemet-cap.xml'), category: 'weather', sparse: true },
  { id: 'broken', name: 'Feed caído', kind: 'media', adapter: 'rss', url: fixture('does-not-exist.xml') },
];
