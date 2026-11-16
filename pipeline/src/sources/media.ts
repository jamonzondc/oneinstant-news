import { bluesky } from './networks.ts';
import type { SourceDefinition } from './types.ts';

// Spanish news outlets. URLs verified from CI (pull request runs of the Deploy workflow) on 2026-11-15; RTVE and EFE on 2026-11-16.
// A failing feed never breaks the build.
export const MEDIA: SourceDefinition[] = [
  // Every RTVE RSS feed still online stopped updating in 2022: its Bluesky account replaces it.
  bluesky('rtvenoticias.rtve.es', { id: 'rtve', name: 'RTVE', kind: 'media' }),
  bluesky('efe.com', { id: 'efe', name: 'EFE', kind: 'media' }),
  { id: 'elpais', name: 'El País', kind: 'media', adapter: 'rss', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
  { id: 'elmundo', name: 'El Mundo', kind: 'media', adapter: 'rss', url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml' },
  { id: '20minutos', name: '20minutos', kind: 'media', adapter: 'rss', url: 'https://www.20minutos.es/rss/' },
  { id: 'europapress', name: 'Europa Press', kind: 'media', adapter: 'rss', url: 'https://www.europapress.es/rss/rss.aspx' },
  { id: 'eldiario', name: 'elDiario.es', kind: 'media', adapter: 'rss', url: 'https://www.eldiario.es/rss/' },
  { id: 'lavanguardia', name: 'La Vanguardia', kind: 'media', adapter: 'rss', url: 'https://www.lavanguardia.com/rss/home.xml' },
  { id: 'abc', name: 'ABC', kind: 'media', adapter: 'rss', url: 'https://www.abc.es/rss/2.0/portada/' },
  { id: 'elconfidencial', name: 'El Confidencial', kind: 'media', adapter: 'rss', url: 'https://rss.elconfidencial.com/espana/' },
];
