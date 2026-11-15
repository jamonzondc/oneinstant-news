# ROADMAP

Cada iteración cabe en **una sesión de Claude Code** y termina con algo verificable. Si una crece, se divide en subiteraciones (`2a`, `2b`…). Al terminar: DoD de `CLAUDE.md`, actualizar `PROGRESS.md`, commit `iter-N: …` y PR.

Objetivo de producto: en una emergencia, abrir la app con datos móviles saturados y en pocos segundos saber qué pasa, filtrando por **tipo** (categoría) y **entidad** (fuente).

---

## Iter 0 — Fundamentos ✅
- `CLAUDE.md` (reglas, arquitectura, DoD), `ROADMAP`, `PROGRESS`, ADRs 0001-0003.
- Tooling sin dependencias de runtime: Node 22 con TS nativo, `tsc` solo para type-check, `node:test`.
- CI en GitHub Actions: type-check, tests y build con fixtures.
- **Aceptación:** CI en verde en el PR.

## Iter 1 — Pipeline de datos y adaptadores ✅
- `contract/news.ts`: contrato de `/news.json` v1 (formato compacto por arrays posicionales), `encode`/`decode` con validación.
- `SourceAdapter` + registry tipado; `RssAdapter` (RSS 2.0, RDF, Atom; CDATA, entidades, ISO-8859-1).
- Dominio: limpieza de texto, clasificador por palabras clave (13 categorías, "emergencias" manda), recorte, edad máxima, deduplicado, limpieza de URLs de tracking.
- Resiliencia: timeout + reintento; una fuente caída reutiliza sus noticias del snapshot anterior (`PREVIOUS_URL`); sin ninguna fuente OK no se publica.
- Catálogo inicial de medios nacionales.
- **Aceptación:** tests con fixtures; enchufar un adaptador falso en un test sin tocar el core; `news.json` a plena carga < 30 KB gzip.

## Iter 2 — PWA: lista y filtros
- `web/`: TS sin framework, por capas: `domain/` (filtros puros, formateo de tiempo), `data/` (repositorio: `fetch` con `cache: 'no-cache'` → 304 si no cambia; caché en `localStorage`), `ui/` (render por `innerHTML` de una sola pasada), `app.ts` (composición).
- `esbuild` empaqueta y minifica; el build mete JS y CSS **inline en un único `index.html`** (una sola petición).
- Filtros: **tipo** (categoría, con contador), **entidad** (fuente, agrupada por medios / oficiales / redes, con opción de grupo entero) y búsqueda de texto sin acentos. Persistidos en `localStorage` y en el hash de la URL (enlace compartible).
- Service worker: cascarón cache-first con versión por hash (no cambia con cada actualización de noticias), `news.json` sin interceptar (caché HTTP del navegador). Manifest + iconos PNG generados sin herramientas externas.
- Batería: sin timers ni polling; actualiza al abrir y al volver a la app si han pasado > 10 min, y con el botón. Fondo negro (OLED), sin animaciones.
- `lite.html` generado en el pipeline: sin JS, agrupado por categoría con anclas.
- **Aceptación:** `index.html` ≤ 12 KB gzip; Playwright en viewport móvil: carga, filtra, recarga sin red y muestra la última copia con su hora; capturas claro/oscuro revisadas.

## Iter 3 — Despliegue gratuito
- `firebase.json` (cabeceras: `index.html`/`news.json` con `max-age=0` + `s-maxage` en CDN; `sw.js` `no-cache`), `_headers` para Cloudflare.
- Workflow con cron cada 15 min + manual: build de datos (con `PREVIOUS_URL`) + web → deploy a Firebase Hosting (plan Spark) y espejo en Cloudflare Pages. Pasos condicionados a que existan los secrets.
- **Tareas del usuario:** crear proyecto Firebase, cuenta de servicio (Firebase Hosting Admin) → secret `FIREBASE_SERVICE_ACCOUNT`; variable `FIREBASE_PROJECT_ID`; token y account id de Cloudflare; limitar versiones retenidas en Hosting.
- Verificar desde CI qué URLs del catálogo responden; corregir o quitar las que fallen.
- **Aceptación:** `https://<proyecto>.web.app` y `https://<proyecto>.pages.dev` se actualizan solos; ≥ 80 % de fuentes OK.

## Iter 4 — Fuentes oficiales y redes sociales
- `TelegramAdapter` (vista pública `t.me/s/<canal>`), helpers de catálogo para Bluesky y Mastodon (son RSS).
- `CapAdapter` para avisos meteorológicos de AEMET (CAP) con nivel (amarillo/naranja/rojo) en el titular.
- Catálogo de entidades oficiales: 112 autonómicos, Protección Civil, DGT, AEMET, Red Eléctrica, Seguridad Nacional (las que publiquen en formato abierto).
- X/Twitter: confirmar que sigue sin lectura gratuita y documentarlo (ADR); alternativas vía Bluesky/Mastodon/Telegram de las mismas entidades.
- **Aceptación:** fixture + test por adaptador; al menos 5 entidades oficiales y 5 cuentas sociales en producción.

## Iter 5 — Modo emergencia (red mínima)
- `news-urgent.json` (solo emergencias + suministros + avisos, ≤ 3 KB gzip) y portada que lo carga primero; el resto bajo demanda.
- Detección de red lenta (`navigator.connection.effectiveType`/`saveData` donde exista) → solo urgente por defecto.
- Banner fijo arriba si hay noticias de emergencia de la última hora.
- Medir bytes por sesión (`PerformanceResourceTiming.transferSize`) y mostrarlo discretamente.
- **Aceptación:** con throttling 2G en Playwright, titulares urgentes visibles en < 5 s en primera visita y < 1 s en visitas siguientes.

## Iter 6 — Calidad de datos
- Corpus de titulares reales etiquetados para el clasificador (test de precisión mínima por categoría).
- Ámbito territorial (nacional / comunidad autónoma) como metadato de entidad y filtro.
- Indicador de fuentes caídas (usa `lastOk` del contrato) y página `/estado` generada en el build.
- **Aceptación:** precisión ≥ 85 % en el corpus; filtro por comunidad funcionando.

## Iter 7 — Pulido
- Accesibilidad (lectores de pantalla, tamaño de letra), compartir noticia (Web Share API, texto plano), auditoría de rendimiento y batería, README de uso.
- **Aceptación:** checklist de accesibilidad y presupuestos en verde; v1.0.0.
