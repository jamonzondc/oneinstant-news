// Version history shown in changelog.html ("Novedades"). Newest first; the first entry must match
// package.json (a test enforces it). Written in Spanish for readers: what changes for them, no internals.

export interface Release {
  version: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  changes: string[];
}

export const RELEASES: Release[] = [
  {
    version: '0.3.0',
    date: '2026-11-15',
    title: 'Publicada en internet',
    changes: [
      'La app se publica en dos direcciones independientes (principal y espejo): si una se cae o se satura, la otra sigue funcionando.',
      'Las noticias se actualizan solas cada 15 minutos, sin que nadie tenga que intervenir.',
      'Revisadas las direcciones de los medios: se corrigen o retiran las que no responden.',
      'Las noticias nuevas llegan antes a tu móvil y la app se actualiza sola cuando hay versión nueva.',
      'Más segura: la página solo ejecuta su propio código y no avisa a otras webs de dónde vienes al abrir una noticia.',
      'Nueva página de Novedades con el histórico de versiones, enlazada al pie.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-11-15',
    title: 'La app: lista y filtros',
    changes: [
      'Lista de noticias solo en texto, con fondo negro para gastar menos batería y tema claro si tu móvil lo usa.',
      'Filtros por tipo de noticia, por medio (o grupo de medios) y búsqueda de texto sin importar las tildes.',
      'Los filtros se guardan y viajan en el enlace: puedes compartir una vista concreta.',
      'Funciona sin conexión mostrando la última copia y su hora; avisa si los datos son antiguos.',
      'Se puede instalar en la pantalla de inicio.',
      'Versión ligera sin JavaScript para móviles antiguos o conexiones muy malas.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-15',
    title: 'Recogida de noticias',
    changes: [
      'Noticias de 9 medios nacionales, clasificadas en 13 tipos (emergencias, suministros, transporte…).',
      'Se eliminan duplicados y noticias de más de 36 horas.',
      'Si un medio no responde, se mantienen sus últimas noticias en lugar de dejar un hueco.',
    ],
  },
  {
    version: '0.0.0',
    date: '2026-11-15',
    title: 'Inicio del proyecto',
    changes: ['Objetivo: saber qué pasa en una emergencia con muy poca cobertura y batería, sin coste.'],
  },
];
