# OneInstant News — reglas del proyecto

Lector de noticias para emergencias (p. ej. el apagón del 28-04-2025): solo texto, mínimo consumo de red y batería, funciona con datos móviles saturados y sin conexión con la última copia. Gratis: Firebase Hosting (plan Spark) + espejo en Cloudflare Pages + GitHub Actions (repo público).

## Documentos (léelos cuando la tarea lo requiera)
- `docs/ROADMAP.md` — iteraciones con criterios de aceptación.
- `docs/PROGRESS.md` — estado actual. **Léelo al empezar cualquier sesión. Actualízalo al terminar.**
- `docs/decisions/` — ADRs (`NNNN-titulo.md`: contexto, decisión, consecuencias). Crea uno para cada decisión no trivial.

## Arquitectura (ADR 0001, 0002, 0003)
```
contract/news.ts     Contrato de /news.json (tipos + encode/decode). Única frontera entre pipeline y web.
pipeline/            Node 22 + TS nativo (sin compilar). Se ejecuta en GitHub Actions, nunca en el móvil.
  src/sources/       Catálogo de entidades (medios, oficiales, redes). Datos tipados, no lógica.
  src/adapters/      Un adaptador por formato (RSS/Atom, Telegram, CAP…) + registry tipado.
  src/domain/        TS puro: limpieza de texto, clasificador, preparar/deduplicar items.
  src/infra/         Efectos: HTTP (timeout, reintento, file: para fixtures), decodificación.
  src/build.ts       Orquestación testeable (HttpClient y registry inyectados). cli.ts escribe dist/.
web/                 PWA en TS sin framework (ADR 0001). Build → un único index.html con JS y CSS inline.
  src/domain/        Filtros (tipo, entidad, texto), facetas, hash de URL, tiempos. Puro y testeado.
  src/data/          NewsRepository: fetch no-cache + última copia en localStorage.
  src/ui/            Plantillas HTML puras (escape obligatorio) y CSS.
  src/changelog/     Histórico de versiones (releases.ts) → changelog.html estática ("Novedades").
  src/app.ts         Composición y eventos del DOM. Sin timers.
  sw/                Service worker: cascarón cache-first versionado por hash; news.json no se intercepta.
  tools/             build (esbuild, CSP por hash), iconos PNG, cabeceras de hosting (hosting.ts), servidor para e2e.
  e2e/               Playwright + node:test en viewport móvil (ADR 0004).
```
- **Añadir una entidad con formato soportado:** una entrada en `pipeline/src/sources/*.ts`. Nada más.
  Cuentas de Bluesky/Mastodon con `bluesky()`/`mastodon()` (`sources/networks.ts`); canales de Telegram con `adapter: 'telegram'`. Fuentes de poco volumen: `sparse: true` (ADR 0007). Nunca X (ADR 0006).
- **Añadir un formato nuevo:** miembro nuevo en `SourceDefinition` (`sources/types.ts`) + clase `XxxAdapter implements SourceAdapter<XxxSource>` + entrada en `adapters/registry.ts` (el compilador obliga) + fixture y test.
- El frontend **nunca** conoce los adaptadores ni las fuentes: solo `contract/news.ts`.

## Reglas de ingeniería
- Código, identificadores, commits y comentarios en **inglés**. Docs y explicaciones al usuario en **español**.
- **Cero dependencias en runtime.** Nada de terceros llega al navegador (ni JS, ni CSS, ni fuentes, ni imágenes remotas). En desarrollo solo `typescript`, `esbuild` y `playwright` (ADR 0004). Cualquier dependencia nueva necesita ADR.
- TS con `erasableSyntaxOnly`: nada de `enum`, `namespace` ni parameter properties (Node ejecuta los `.ts` quitando tipos). Imports con extensión `.ts`.
- Lógica de dominio pura y testeada con `node:test`; efectos en los bordes (`infra/`, `cli.ts`).
- Presupuestos (fallan en test o avisan en build): `news.json` ≤ 30 KB gzip; `lite.html` ≤ 30 KB gzip; `index.html` ≤ 12 KB gzip.
- Una fuente caída **nunca** rompe el build; si no responde ninguna, no se publica.
- Versiones: usa siempre las últimas estables verificadas al instalar (`npm view <pkg> version`), no de memoria.
- Comentarios solo en lógica no obvia.

## Definition of Done
1. `npm run typecheck` y `npm test` en verde.
2. Tests para cada adaptador nuevo (con fixture real recortado) y para la lógica de dominio tocada.
3. Si hay UI: capturas de Playwright en viewport móvil (claro y oscuro) revisadas, y presupuesto de bytes cumplido.
4. `docs/PROGRESS.md` actualizado (qué se hizo, qué falta, problemas conocidos).
5. Versión en `package.json`: `0.N.0` al empezar la iteración N, +1 en patch por subiteración. Cada versión añade su entrada, la primera, en `web/src/changelog/releases.ts` (página Novedades): en español, sobre lo que cambia para quien lee, sin detalles técnicos. Un test falla si falta.
6. Commit `iter-N: <resumen>`.

## Reglas de sesión
- Una sesión = una iteración (o subiteración). Al terminar, recuerda al usuario hacer `/clear` o abrir sesión nueva.
- **Merge automático:** al terminar una iteración con el DoD cumplido y el CI del PR en verde, mergea el PR a `main` sin preguntar (squash, título `iter-N: <resumen>`) y avísalo. Si falla algo (tests, CI, DoD), no mergees: explica qué falta. Las tareas pendientes del usuario (cuentas, secrets) no bloquean el merge si quedan en `PROGRESS.md`.
- Antes de algo grande: plan corto (tareas + aceptación) y espera aprobación.
- Si algo no encaja con la realidad (API de pago, feed que no existe, límite del plan gratuito), para, explica la alternativa y registra un ADR.

## Comandos
- `npm test` · `npm run typecheck`
- `npm run build:data` — feeds reales → `dist/news.json` (`PREVIOUS_URL` opcional para reutilizar fuentes caídas).
- `npm run build:data:fixtures` — sin red, con `pipeline/test/fixtures` (incluye `lite.html`).
- `npm run build:web` — `dist/index.html`, `sw.js`, manifest e iconos. `npm run build` = datos + web.
- `npm run serve` — sirve `dist/` en http://localhost:8080.
- Despliegue: `.github/workflows/deploy.yml` (cron 15 min). Configuración y secrets en `docs/DEPLOY.md`. Si cambian las cabeceras (`web/tools/hosting.ts`), regenera `firebase.json` (el test indica el comando).
- `npm run test:e2e` — Playwright; capturas en `web/screenshots/` (no versionadas). Con Chromium propio: `CHROMIUM_PATH=/opt/pw-browsers/chromium`.
