import { bluesky } from './networks.ts';
import type { SourceDefinition } from './types.ts';

// Other accounts on social networks: volunteers, NGOs and fact-checkers useful in an emergency.
export const SOCIAL: SourceDefinition[] = [
  bluesky('vostspain.bsky.social', { id: 'vost', name: 'VOST Spain', kind: 'social', sparse: true }),
  bluesky('cruzrojaesp.bsky.social', { id: 'cruzroja', name: 'Cruz Roja', kind: 'social', sparse: true }),
  bluesky('newtral.es', { id: 'newtral', name: 'Newtral', kind: 'social' }),
  { id: 'malditobulo', name: 'Maldito Bulo', kind: 'social', adapter: 'telegram', channel: 'malditobulo', sparse: true },
];
