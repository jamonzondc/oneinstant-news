import type { SourceDefinition } from './types.ts';

// Spanish news outlets. URLs are verified from CI (iter 3); a failing feed never breaks the build.
export const MEDIA: SourceDefinition[] = [
  { id: 'rtve', name: 'RTVE', kind: 'media', adapter: 'rss', url: 'https://api2.rtve.es/rss/temas_noticias.xml' },
  { id: 'elpais', name: 'El País', kind: 'media', adapter: 'rss', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
  { id: 'elmundo', name: 'El Mundo', kind: 'media', adapter: 'rss', url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml' },
  { id: '20minutos', name: '20minutos', kind: 'media', adapter: 'rss', url: 'https://www.20minutos.es/rss/' },
  { id: 'europapress', name: 'Europa Press', kind: 'media', adapter: 'rss', url: 'https://www.europapress.es/rss/rss.aspx' },
  { id: 'eldiario', name: 'elDiario.es', kind: 'media', adapter: 'rss', url: 'https://www.eldiario.es/rss/' },
  { id: 'lavanguardia', name: 'La Vanguardia', kind: 'media', adapter: 'rss', url: 'https://www.lavanguardia.com/rss/home.xml' },
  { id: 'abc', name: 'ABC', kind: 'media', adapter: 'rss', url: 'https://www.abc.es/rss/2.0/portada/' },
  { id: 'elconfidencial', name: 'El Confidencial', kind: 'media', adapter: 'rss', url: 'https://rss.elconfidencial.com/espana/' },
];
