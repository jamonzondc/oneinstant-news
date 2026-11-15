# 0005 — Despliegue desde CI, cabeceras compartidas, CSP y página de novedades

## Contexto
Iter 3: publicar en Firebase Hosting (Spark) con espejo en Cloudflare Pages (ADR 0003), regenerando los datos cada 15 min con GitHub Actions. Restricciones: cero dependencias de runtime y solo `typescript`, `esbuild` y `playwright` como devDependencies; los dos hosts tienen sintaxis de cabeceras distinta; el usuario quiere un histórico de versiones visible.

## Decisión
- **Herramientas de deploy solo en CI**, sin entrar en `package.json`: `npx firebase-tools@<versión fija>` y `npx wrangler@<versión fija>` (versiones verificadas con `npm view` y fijadas en `.github/workflows/deploy.yml`). Nada llega al navegador ni al lockfile.
- **Workflow `deploy.yml`**: cron `*/15` (datos → Firebase), cron `5 */2` (además espejo en Cloudflare), `push` a `main` y manual (ambos hosts). En PR solo construye con feeds reales: así se verifica el catálogo desde la red de GitHub (tabla en el resumen del job). Cada deploy solo corre si existen sus secrets; un fallo de Firebase no impide el espejo.
- **Cadencia del espejo cada 2 h** (≈ 360 deploys/mes + pushes): el plan gratuito de Cloudflare Pages limita a 500 *builds*/mes y la documentación no aclara si los *direct uploads* cuentan. Si se confirma que no cuentan, la variable `CLOUDFLARE_EVERY_RUN=true` lo pone cada 15 min (útil también durante una emergencia).
- **`PREVIOUS_URL` acepta varias URLs** (Firebase y luego el espejo): si el principal se queda sin cuota, las fuentes caídas siguen reutilizando sus noticias.
- **Cabeceras definidas una vez** en `web/tools/hosting.ts`: `firebase.json` debe coincidir (lo comprueba un test) y el build genera `_headers` para Cloudflare. Documentos (`/`, `index.html`, `news.json`, `lite.html`, `changelog.html`): `max-age=0, s-maxage=300, must-revalidate` (el navegador revalida con 304; el CDN absorbe picos y ambos hosts lo purgan en cada deploy). `sw.js`: `no-cache`. Manifest e iconos: 1 día. Todas: `nosniff` y `Referrer-Policy: no-referrer` (al abrir una noticia no se revela desde dónde).
- **CSP por `<meta>`** en `index.html` con hash SHA-256 del script y del estilo inline, calculados en el build. Vale para los dos hosts sin duplicar configuración. Incluye `worker-src 'self'` (si no, el hash de `script-src` bloquearía el service worker).
- **Página `changelog.html` (Novedades)** generada en el build desde `web/src/changelog/releases.ts` (datos tipados, en español y para el lector). Estática, sin JS, con el CSS de la app, cacheada por el service worker. El pie muestra `vX.Y.Z`. Un test exige que la primera entrada sea la versión de `package.json`.
- **Keepalive**: job semanal que llama a la API `enable` del propio workflow para que GitHub no desactive el cron a los 60 días sin actividad.

## Consecuencias
- Cada subida de versión exige su entrada en `releases.ts` (añadido al DoD).
- La versión en el pie cambia el hash del cascarón: cada versión nueva actualiza el service worker (deseado).
- Sin secrets, el workflow construye y avisa (`::notice::`) pero no publica.
- El keepalive vía API es la técnica habitual, pero GitHub no documenta que reinicie el contador: si un día se desactiva el cron, basta reactivarlo en la pestaña Actions.
- Verificación del catálogo: los RSS de RTVE están congelados desde 2022 → `rtve` queda `enabled: false` (id reservado) hasta tener su Telegram/Bluesky en la iter 4. Una fuente que responde sin noticias usables cuenta ahora como caída.
- `firebase.json` se regenera con el comando que indica el test si cambian las reglas.
