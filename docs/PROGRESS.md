# PROGRESS

**Versión:** 0.4.0 · **Siguiente:** iter 5 (modo emergencia, red mínima). Sigue pendiente: configurar los secrets de `docs/DEPLOY.md`.

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
- **Iter 3 — Despliegue gratuito + Novedades**
  - `.github/workflows/deploy.yml`: cron `*/15` (datos → Firebase), `5 */2` (además espejo Cloudflare, por el límite de 500 builds/mes), push a `main` y manual. Herramientas de deploy fijadas y solo en CI (`npx firebase-tools@15.36.0`, `npx wrangler@4.162.0`, ADR 0005). Cada deploy solo si existen sus secrets; un fallo de Firebase no frena el espejo; comprobación `curl` de `news.json` tras publicar. En PR solo construye con feeds reales y publica la tabla de fuentes en el resumen del job. Keepalive semanal contra la desactivación de crons a los 60 días.
  - `PREVIOUS_URL` admite lista (Firebase, luego espejo). Resumen Markdown de fuentes en `GITHUB_STEP_SUMMARY` y aviso si < 80 % OK (`pipeline/src/report.ts`).
  - Una fuente que responde pero sin noticias usables pasa a ✗ con motivo (`no usable items (N raw: X older than 36 h, Y untitled; newest …)`) y reutiliza sus noticias previas.
  - Cabeceras en un único sitio (`web/tools/hosting.ts`) → `firebase.json` (un test exige que coincida) y `dist/_headers` (Cloudflare). Documentos `max-age=0, s-maxage=300, must-revalidate`; `sw.js` `no-cache`; manifest/iconos 1 día; `nosniff` y `Referrer-Policy: no-referrer` en todo.
  - CSP por `<meta>` con hash SHA-256 del script y del estilo inline (sin `unsafe-*`), `worker-src 'self'`. E2E comprueba que no hay errores de consola.
  - **Novedades**: `changelog.html` estática generada desde `web/src/changelog/releases.ts`, cacheada por el SW, enlazada desde el pie junto a `vX.Y.Z`. Test: la primera entrada = versión de `package.json` (regla añadida al DoD).
  - Actions actualizadas a `checkout`/`setup-node`/`upload-artifact` v7 (las v4 usaban Node 20, obsoleto).
  - `index.html` 10,8 KB (5,3 KB gzip). Tests: 65 unitarios + 7 e2e.
  - Docs: ADR 0005, `docs/DEPLOY.md` (pasos del usuario).
  - Verificación del catálogo desde CI (15-11-2026): **7-8 de 8 activas OK** (≥ 87 %). El Confidencial es intermitente: a veces su CDN sirve una copia antigua (4 noticias, la última del 10-11); se marca caída y se reutilizan sus noticias previas. Si persiste, buscar otra URL suya. **RTVE desactivada**: todos sus RSS aún en línea (`temas_noticias`, `temas_espana`) tienen la última noticia en 2022; el resto de URLs probadas dan 404. Se recupera en la iter 4 por Telegram/Bluesky.
- **Iter 4 — Fuentes oficiales y redes sociales**
  - Fuentes verificadas desde GitHub Actions con un workflow temporal (la red de desarrollo no llega a los feeds), ya eliminado. Detalle de lo encontrado y descartado en ADR 0007.
  - `TelegramAdapter` (`t.me/s/<canal>`): posts con texto, ignora solo multimedia y citas de respuestas; enlace `t.me/<canal>/<id>`.
  - `CapAdapter` (avisos AEMET, RSS índice de mensajes CAP): agrupa zonas con mismo nivel, fenómeno y validez → *"Aviso naranja por lluvias: Valle del Tajo, Montes de Toledo"*, resumen con validez y nº de zonas; rojo > naranja > amarillo. `RawItem.expiresAt`: vigente se queda aunque tenga > 36 h, caducado se quita.
  - Fuentes `sparse` (poco volumen): responder sin nada reciente = sana (0 noticias), no reutiliza previas. Sin la marca sigue detectándose el feed congelado.
  - Posts sin título (Bluesky, Telegram): la primera línea (12-180 caracteres) pasa a titular.
  - Helpers `bluesky()` y `mastodon()` (`sources/networks.ts`). `kind` = naturaleza de la entidad, no el canal.
  - Catálogo: **10 oficiales** (AEMET avisos CAP, AEMET, DGT, Red Eléctrica, Renfe, Interior, Sanidad por Bluesky; Policía Nacional por Telegram; La Moncloa y Seguridad Nacional por RSS), **4 sociales** (VOST Spain, Cruz Roja, Newtral por Bluesky; Maldito Bulo por Telegram), **RTVE vuelve** (Bluesky) y **EFE** (Bluesky). 13 cuentas leídas de redes sociales.
  - ADR 0006: X/Twitter sin lectura gratuita (pago por uso desde 2-2026); ADR 0007: adaptadores, `sparse`, criterio de `kind`.
  - Tests: 84 unitarios (19 nuevos: Telegram, CAP, helpers/catálogo, titulares, caducidad, `sparse`) + 7 e2e. Fixtures reales recortados: `telegram.html`, `aemet-cap.xml`.
  - Build con feeds reales desde CI (16-11-2026 05:42 UTC): **24/24 fuentes OK**, 149 noticias, `news.json` 20,8 KB gzip, `lite.html` 21,5 KB gzip. Con noticias en ese momento: AEMET avisos (12, tope por fuente), AEMET, DGT, Interior, Cruz Roja, Newtral, Maldito Bulo y todos los medios; el resto de oficiales respondió bien pero sin nada en las últimas 36 h (normal en `sparse`).
  - Regla nueva en `CLAUDE.md`: merge automático del PR al terminar la iteración con DoD y CI en verde.

## Pendiente / problemas conocidos
- **Tareas del usuario (bloquean la aceptación de la iter 3):** crear proyecto Firebase + cuenta de servicio y proyecto de Cloudflare Pages, y cargar secrets/variables según `docs/DEPLOY.md`. Hasta entonces el workflow construye pero no publica. Comprobar después que `<proyecto>.web.app` y `<proyecto>.pages.dev` se actualizan solos.
- No está documentado si los *direct uploads* de Cloudflare Pages cuentan para los 500 builds/mes: mirar el contador en el panel tras unos días; si no cuentan, `CLOUDFLARE_EVERY_RUN=true`.
- La app aún no ofrece el enlace al espejo cuando el principal falla (iter 5/7).
- `build:data:fixtures` depende de la fecha de los fixtures (15-11-2026): pasadas 36 h descarta sus noticias por antiguas. No rompe CI, pero `dist/` sale casi vacío. Se puede hacer configurable `now` si molesta.
- E2E solo en Chromium. Safari/iOS no se prueba automáticamente.
- En selects estrechos (390 px) un nombre largo de entidad se corta con elipsis nativa.
- Sin canal abierto: 112 autonómicos, Protección Civil estatal (solo X/WhatsApp) y Guardia Civil (Telegram parado desde 08-2026). Revisar de vez en cuando.
- Terremotos del IGN (`ign.es/ign/RssTools/sismologia.xml`): RSS válido pero titular inútil y muchos sismos menores; necesita filtro por magnitud (iter 6).
- Un aviso de AEMET reutilizado cuando AEMET falla se filtra por antigüedad (36 h), no por caducidad: el contrato no lleva `expiresAt`. Revisar en la iter 5 con `news-urgent.json`.
- El enlace de un aviso abre su XML CAP (oficial pero técnico).
- Los avisos de AEMET comparten el tope de 12 por fuente: en un episodio con muchos grupos solo salen los 12 más graves. Valorar un tope propio en la iter 5.
- Telegram/Bluesky pueden cambiar su HTML/RSS: la fuente saldría caída (reutiliza previas) hasta ajustar el adaptador.
- `README.md` mínimo hasta la iter 7.
