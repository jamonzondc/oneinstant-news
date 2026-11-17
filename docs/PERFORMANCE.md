# Rendimiento y batería — auditoría (iter 7, v1.0.0; actualizada en la 1.5.0)

Las mediciones salen de `web/e2e/perf.e2e.ts` y del test de 2G de `web/e2e/app.e2e.ts`, ejecutados con `npm run test:e2e`, que imprime las cifras. Escenario de carga completa:
- 260 noticias (el máximo del pipeline) de 45 fuentes;
- viewport de móvil 390×844;
- CPU 4× más lenta que la máquina de desarrollo, para aproximar un Android de gama baja.

Las cifras varían un ±20 % entre ejecuciones. El test solo falla con umbrales holgados: lista < 3 s, < 150 ms por tecla, < 300 ms por filtro o por «Ver más», < 50 ms de CPU en 3 s de reposo y 0 timers.

## Resultados

| Medida (CPU 4×, 260 noticias) | 0.6.0 | 1.0.0 | 1.4.0 | 1.5.0 («Ver más») |
|---|---|---|---|---|
| Lista visible desde la navegación (local) | 546 ms | 374-504 ms | 478 ms | 397-424 ms |
| JavaScript hasta tener la lista | 90 ms | 67-74 ms | 81 ms | 72-82 ms |
| Estilo y layout hasta tener la lista | 149 ms | 55-82 ms | 88 ms | 77-78 ms |
| CPU por tecla al buscar (repinta la lista) | 84 ms | 47-56 ms | 64 ms | 47-48 ms |
| CPU al cambiar un filtro | 100 ms | 66-70 ms | 88 ms | 63-96 ms |
| CPU al pulsar «Ver más» (añade 40) | — | — | — | 102-134 ms |
| CPU en reposo (3 s sin tocar nada) | 18 ms | 12-18 ms (ruido del navegador) | 10 ms | 14-17 ms |
| Timers del código de la página (`setTimeout`, `setInterval`, `requestAnimationFrame`) | 0 | 0 | 0 | 0 |
| Nodos DOM | 4.682 | 5.656 (botón «Compartir» por noticia) | 6.308 (etiqueta de tipo como botón) | **2.391** (40 noticias pintadas) |
| Heap JS | 2,8 MB | 3,0 MB | 3,0 MB | 2,5 MB |

| Red | 1.0.0 |
|---|---|
| Primera visita, con las 260 noticias y gzip (sin iconos, que el SW baja después) | 15,4 KB |
| Visita siguiente (cascarón desde el SW, noticias sin cambios → 304) | 0,6 KB |
| Titulares urgentes en 2G (280 kbps, 800 ms de RTT), primera visita | ≈ 2,2 s (objetivo < 5 s) |
| Titulares urgentes en 2G, visita siguiente | ≈ 50 ms (objetivo < 1 s) |
| `index.html` | 19,1 KB, **8,6 KB gzip** (presupuesto 12) |
| `news.json` / `news-urgent.json` / `lite.html` con datos reales (16-11) | 29,9 / 2,9 / 29,9 KB gzip (presupuestos 30 / 3 / 30, se recortan solos) |

## Qué se cambió
- `content-visibility: auto` en cada noticia: lo que está fuera de pantalla no se maqueta ni se pinta hasta acercarse. El layout baja a la mitad y la búsqueda por teclado pasa de 84 a ~50 ms por tecla. La búsqueda del navegador (Ctrl+F) y los lectores de pantalla siguen viendo todo el contenido.
- **1.5.0, «Ver más» (ADR 0013):** se pintan 40 noticias y cada toque añade 40 más sin repintar las anteriores. Filtros, contadores y búsqueda siguen trabajando sobre todas. Los nodos DOM bajan a un tercio, la memoria un 17 % y cada tecla un 25 %. El primer pintado gana poco porque `content-visibility` ya evitaba maquetar lo que no se ve.
- El servidor local (`serve.ts`) responde con ETag/304 como Firebase y Cloudflare. Antes, la segunda visita medía 6,5 KB porque el servidor de pruebas volvía a enviar las noticias. Ahora la cifra es la real.

## Batería: por qué la app no gasta en segundo plano
- Ni timers ni polling. Las noticias se actualizan solo:
  - al abrir;
  - al volver a la app tras más de 10 min;
  - al recuperar la conexión;
  - con el botón.
  El e2e comprueba que la página no llama a `setTimeout`, `setInterval` ni `requestAnimationFrame` y que no usa CPU en reposo.
- Sin animaciones, transiciones, fuentes web ni imágenes remotas. Fondo azul casi negro en modo oscuro (`#0d0f1e`: en OLED gasta casi como el negro). Las sombras y el degradado de la cabecera son CSS estático, sin repintados (ADR 0012).
- La radio del móvil se despierta lo mínimo:
  - una petición del archivo urgente (≤ 3 KB) y otra del completo;
  - si no cambian, un 304 sin cuerpo;
  - el cascarón sale del service worker sin red.
  - En red lenta, solo el urgente.
- Un repintado solo ocurre si cambia lo que hay en pantalla (si llega un 304, se actualiza solo la línea de estado).

## Ideas descartadas (por ahora)
- Esperar a que se deje de teclear antes de filtrar: exige un timer y ~50 ms por tecla en un móvil lento ya es fluido.
- Lista virtual (reciclar unas pocas tarjetas): alturas variables («Aa», Dynamic Type), rompe Ctrl+F, los lectores de pantalla y la posición al volver, y apenas mejora lo que ya dan `content-visibility` y «Ver más» (ADR 0013).
- Repintar solo las noticias que cambian (diff del DOM): el repintado completo cuesta ~50 ms con la CPU 4× más lenta, sin retraso apreciable al teclear; el diff añadiría código a cada carga.

## Sin medir
- Dispositivos reales (Android de gama baja, iPhone antiguo) y Safari: los e2e solo usan Chromium.
- Lo que descarga el service worker al instalarse (≈ 27 KB gzip una vez por versión: `index.html`, `changelog.html`, `guia.html`, iconos y manifest) no cuenta en «KB usados».
