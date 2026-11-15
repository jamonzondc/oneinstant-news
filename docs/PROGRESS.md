# PROGRESS

**Versión:** 0.2.0 · **Siguiente:** iter 3 (despliegue gratuito)

## Hecho
- **Iter 0 — Fundamentos**
  - `CLAUDE.md`, `docs/ROADMAP.md`, ADRs 0001 (frontend sin framework), 0002 (pipeline con adaptadores y contrato), 0003 (hosting gratuito).
  - Node 22 con TS nativo (`erasableSyntaxOnly`), `typescript` 7 solo para type-check, tests con `node:test`. CI (`.github/workflows/ci.yml`): typecheck, tests, build con fixtures.
- **Iter 1 — Pipeline de datos y adaptadores**
  - `contract/news.ts`: contrato v1 compacto con `encodeSnapshot`/`decodeSnapshot` (valida JSON no confiable; categorías desconocidas → `general`).
  - `pipeline/src`: `SourceAdapter` + `ADAPTERS` (registry tipado), `RssAdapter` (RSS/RDF/Atom, CDATA, entidades, ISO-8859-1 por declaración XML o `Content-Type`), `FetchHttpClient` (timeout 15 s, 1 reintento, `file:` para fixtures).
  - Dominio: clasificador de 13 categorías (emergencias y suministros mandan si están en el titular), recorte de título (180) y resumen (170), edad máxima 36 h, 12 por fuente, 260 en total, deduplicado por titular normalizado o URL, limpieza de `utm_*`/`fbclid`/…; posts sin título (Bluesky/Mastodon) derivan el titular del texto.
  - Resiliencia: fuentes caídas reutilizan sus noticias frescas del snapshot anterior (`PREVIOUS_URL`) y conservan su `lastOk`; si no responde ninguna, el CLI sale con error.
  - Catálogo inicial: 9 medios nacionales (`pipeline/src/sources/media.ts`).
- **Iter 2 — PWA: lista y filtros**
  - `web/` por capas: `domain/filters.ts` (tipo, entidad o grupo entero, búsqueda sin acentos con todas las palabras, contadores por faceta, estado ↔ hash `#c=…&s=…&q=…`, `sanitize` si una fuente desaparece), `domain/time.ts`, `data/repository.ts` (`fetch` con `cache: 'no-cache'` y timeout de 20 s; última copia en `localStorage`; tolera storage roto o lleno), `ui/render.ts` (plantillas puras con escape y solo enlaces http(s)), `app.ts`.
  - Filtros persistidos en el hash (enlace compartible) y en `localStorage`. Si el snapshot no cambia (304), no se repinta.
  - Batería: sin timers. Actualiza al abrir, al volver a la app si pasaron más de 10 min, al recuperar conexión (`online`) y con el botón. Fondo negro (OLED) con variante clara por `prefers-color-scheme` y sin animaciones. Las emergencias llevan borde rojo; suministros y avisos, etiqueta ámbar. Aviso en ámbar si los datos tienen más de 1 h (el pipeline se paró) o si no hay conexión.
  - Build (`web/tools/build.ts`, esbuild): **`index.html` de 10,5 KB, 5,1 KB gzip** (presupuesto 12), con JS, CSS y favicon inline, más `sw.js`, `manifest.webmanifest` e iconos 180/192/512 dibujados por código (`tools/png.ts` + `tools/icon.ts`, válidos como `maskable`).
  - Service worker: cascarón cache-first con versión = hash del cascarón (solo cambia si cambia la app), `skipWaiting` + `clients.claim`, borra cachés viejas. `news.json` no se intercepta.
  - `lite.html` generado en el pipeline (`pipeline/src/render/lite.ts`): sin JS, agrupado por categoría con anclas, hora peninsular. Enlazado desde el pie y desde `<noscript>`.
  - ADR 0004: Playwright (devDependency) para e2e con `node:test`. Job `e2e` en CI que publica las capturas como artefacto.
  - Tests: 50 unitarios (22 nuevos de web/lite, incluido el presupuesto) + 5 e2e en viewport móvil 390×844 (carga, filtros, enlace compartido, botón Actualizar, recarga sin red con SW mostrando "Sin conexión. Última copia: HH:MM", página sin JS, capturas claro/oscuro).

## Pendiente / problemas conocidos
- Las URLs del catálogo **no están verificadas**: la red de las sesiones de Claude Code bloquea esos dominios. Se verifican desde CI en la iter 3.
- Cabeceras HTTP (`max-age=0` + `s-maxage`, `sw.js` `no-cache`) pendientes de la iter 3. Sin ellas el SW se actualiza igual, pero la caché del CDN no está afinada.
- `build:data:fixtures` depende de la fecha de los fixtures (15-11-2026): pasadas 36 h descarta sus noticias por antiguas. No rompe CI, pero `dist/` sale casi vacío. Se puede hacer configurable `now` si molesta.
- E2E solo en Chromium. Safari/iOS no se prueba automáticamente.
- En selects estrechos (390 px) un nombre largo de entidad se corta con elipsis nativa.
- Faltan entidades oficiales y redes sociales (iter 4).
- `README.md` mínimo hasta la iter 7.
