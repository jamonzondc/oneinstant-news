# 0004 — Playwright como dependencia de desarrollo para e2e

## Contexto
La iter 2 exige verificar en un navegador real y en viewport móvil que la PWA carga, filtra y, sin red, muestra la última copia (service worker + `localStorage`), además de capturas en tema claro y oscuro. Las reglas solo permiten `typescript` y `esbuild` en desarrollo; cualquier otra dependencia necesita ADR.

## Decisión
- `playwright` (la librería, no `@playwright/test`) como **devDependency**. Los e2e se escriben con `node:test`, igual que el resto (`web/e2e/*.e2e.ts`, `npm run test:e2e`), así no hay un segundo runner ni más configuración.
- Solo Chromium. En CI se instala con `npx playwright install --with-deps chromium`. En local se puede usar un Chromium ya instalado con `CHROMIUM_PATH=/ruta/al/binario`.
- Los e2e levantan `web/tools/serve.ts` (servidor estático en memoria con `node:http`) con un `news.json` sintético de horas relativas a "ahora". Así no dependen de la fecha de los fixtures del pipeline.
- Las capturas se guardan en `web/screenshots/` y **no se versionan**: muestran la hora y cambiarían en cada ejecución (≈ 1 MB por pasada). CI las publica como artefacto `screenshots`.

## Consecuencias
- Nada llega al navegador del usuario: el presupuesto de runtime sigue en cero dependencias.
- El job de e2e en CI tarda más que el de tests unitarios (descarga de Chromium), por eso va en un job aparte.
- Se cubre Chromium (Android). Safari/iOS no se prueba automáticamente: si algo falla allí, se valora añadir WebKit.
