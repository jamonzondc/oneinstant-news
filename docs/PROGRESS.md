# PROGRESS

**Versión:** 0.1.0 · **Siguiente:** iter 2 (PWA: lista y filtros)

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
  - 28 tests (texto, clasificador, adaptador RSS, build, contrato y presupuesto: 260 noticias de tamaño máximo < 30 KB gzip).

## Pendiente / problemas conocidos
- Las URLs del catálogo **no están verificadas**: la red de las sesiones de Claude Code bloquea esos dominios. Se verifican desde CI en la iter 3.
- Faltan entidades oficiales y redes sociales (iter 4).
- `README.md` mínimo hasta la iter 7.
