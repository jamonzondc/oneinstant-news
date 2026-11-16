import { bluesky } from './networks.ts';
import type { RssSource, SourceDefinition } from './types.ts';

// One outlet per autonomous community: its public broadcaster when it has a working feed, otherwise the leading regional
// daily. Feeds found by autodiscovery and verified from CI on 2026-11-16 (ADR 0009). Fewer items each (LIMITS.perRegionalSource).
// Vocento papers share the "last hour" feed: https://<site>/rss/2.0/?section=/ultima-hora.
const vocento = (site: string, entry: Omit<RssSource, 'adapter' | 'url' | 'kind'>): RssSource => ({
  ...entry, kind: 'media', adapter: 'rss', url: `https://www.${site}/rss/2.0/?section=/ultima-hora`,
});

export const REGIONAL: SourceDefinition[] = [
  { id: 'diariodesevilla', name: 'Diario de Sevilla', kind: 'media', region: 'an', adapter: 'rss', url: 'https://www.diariodesevilla.es/rss/' },
  { id: 'heraldo', name: 'Heraldo de Aragón', kind: 'media', region: 'ar', adapter: 'rss', url: 'https://www.heraldo.es/rss/' },
  vocento('elcomercio.es', { id: 'elcomercio', name: 'El Comercio', region: 'as' }),
  { id: 'ib3', name: 'IB3', kind: 'media', region: 'ib', adapter: 'rss', url: 'https://www.ib3.org/rss' },
  vocento('canarias7.es', { id: 'canarias7', name: 'Canarias7', region: 'cn' }),
  vocento('eldiariomontanes.es', { id: 'eldiariomontanes', name: 'El Diario Montañés', region: 'cb' }),
  vocento('elnortedecastilla.es', { id: 'elnortedecastilla', name: 'El Norte de Castilla', region: 'cl' }),
  { id: 'encastillalamancha', name: 'EnCastillaLaMancha', kind: 'media', region: 'cm', adapter: 'rss', url: 'https://www.encastillalamancha.es/feed/' },
  {
    id: '3cat', name: '3Cat', kind: 'media', region: 'ct', adapter: 'rss',
    url: 'https://api.3cat.cat/noticies?_format=rss&origen=frontal&frontal=n324-portada-noticia&version=2.0',
  },
  vocento('hoy.es', { id: 'hoy', name: 'Hoy', region: 'ex' }),
  { id: 'lavozdegalicia', name: 'La Voz de Galicia', kind: 'media', region: 'ga', adapter: 'rss', url: 'https://www.lavozdegalicia.es/index.xml' },
  { id: 'telemadrid', name: 'Telemadrid', kind: 'media', region: 'md', adapter: 'rss', url: 'https://www.telemadrid.es/rss/' },
  vocento('laverdad.es', { id: 'laverdad', name: 'La Verdad', region: 'mc' }),
  // Diario de Navarra's feeds (rss.xml, rss/contenidos.xml) carry no titles; Prensa Ibérica's Noticias de Navarra answers 406.
  { id: 'navarracom', name: 'Navarra.com', kind: 'media', region: 'nc', adapter: 'rss', url: 'https://navarra.okdiario.com/rss/' },
  vocento('elcorreo.com', { id: 'elcorreo', name: 'El Correo', region: 'pv' }),
  vocento('larioja.com', { id: 'larioja', name: 'La Rioja', region: 'ri' }),
  vocento('lasprovincias.es', { id: 'lasprovincias', name: 'Las Provincias', region: 'vc' }),
  { id: 'elfarodeceuta', name: 'El Faro de Ceuta', kind: 'media', region: 'ce', adapter: 'rss', url: 'https://elfarodeceuta.es/feed/' },
  { id: 'elfarodemelilla', name: 'El Faro de Melilla', kind: 'media', region: 'ml', adapter: 'rss', url: 'https://elfarodemelilla.es/feed/' },
  // Regional emergency services with an open channel (most 112 services only publish on X, ADR 0006).
  bluesky('112andalucia.bsky.social', { id: '112andalucia', name: '112 Andalucía', kind: 'official', region: 'an', sparse: true }),
];
