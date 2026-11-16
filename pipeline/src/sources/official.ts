import { bluesky } from './networks.ts';
import type { SourceDefinition } from './types.ts';

// Public bodies. Preference: own open feed > Telegram > Bluesky/Mastodon; X is not readable for free (ADR 0006).
// Verified from CI on 2026-11-16. Most publish a few times a day at most, hence `sparse` (ADR 0007).
export const OFFICIAL: SourceDefinition[] = [
  {
    id: 'aemet-avisos', name: 'AEMET · Avisos', kind: 'official', adapter: 'cap', category: 'weather', sparse: true,
    // One item per community, level, phenomenon and validity: a stormy day easily yields more than 12.
    maxItems: 24,
    url: 'https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAE_wah_RSS.xml',
  },
  // Earthquakes: magnitude 3.5 or more only; 5 or more counts as an emergency (adapters/ign-adapter.ts).
  { id: 'ign', name: 'IGN · Terremotos', kind: 'official', adapter: 'ign', url: 'https://www.ign.es/ign/RssTools/sismologia.xml', sparse: true, maxItems: 5 },
  bluesky('aemet.es', { id: 'aemet', name: 'AEMET', kind: 'official', category: 'weather', sparse: true }),
  bluesky('dgtes.bsky.social', { id: 'dgt', name: 'DGT', kind: 'official', category: 'transport', sparse: true }),
  bluesky('redelectricare.bsky.social', { id: 'ree', name: 'Red Eléctrica', kind: 'official', category: 'utilities', sparse: true }),
  bluesky('renfeoperadora.bsky.social', { id: 'renfe', name: 'Renfe', kind: 'official', category: 'transport', sparse: true }),
  bluesky('interior.gob.es', { id: 'interior', name: 'Ministerio del Interior', kind: 'official', sparse: true }),
  bluesky('sanidad.gob.es', { id: 'sanidad', name: 'Ministerio de Sanidad', kind: 'official', fallbackCategory: 'health', sparse: true }),
  { id: 'policia', name: 'Policía Nacional', kind: 'official', adapter: 'telegram', channel: 'policianacional', fallbackCategory: 'crime', sparse: true },
  { id: 'moncloa', name: 'La Moncloa', kind: 'official', adapter: 'rss', url: 'https://www.lamoncloa.gob.es/Paginas/rss.aspx', fallbackCategory: 'politics', sparse: true },
  { id: 'dsn', name: 'Seguridad Nacional', kind: 'official', adapter: 'rss', url: 'https://www.dsn.gob.es/es/rss.xml', sparse: true },
];
