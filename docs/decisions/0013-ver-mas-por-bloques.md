# 0013 — Lista larga: «Ver más» por bloques de 40

## Contexto
Con el catálogo completo, la lista llega a 260 noticias (el máximo del pipeline). Cada repintado (filtrar, buscar, actualizar) crea todas las tarjetas: unos 6.300 nodos DOM tras añadir la etiqueta de tipo como botón. `content-visibility: auto` ya evita maquetar y pintar lo que está fuera de pantalla. Aun así, el usuario temía que la app fuera lenta con tantos elementos y pidió paginación o scroll virtual sin librerías.

## Decisión
- **«Ver más» por bloques** (`web/src/domain/paging.ts`, `PAGE_SIZE = 40`):
  - Se pintan las primeras 40 noticias del resultado filtrado. Al final aparece «Ver 40 más (quedan N)».
  - Cada toque añade el siguiente bloque con `insertAdjacentHTML`, sin repintar lo ya pintado, y lleva el foco a la primera noticia nueva (teclado y lectores de pantalla).
  - Filtros, contadores, búsqueda y banner trabajan siempre sobre todas las noticias; solo se pagina el pintado.
  - Un filtro, un cambio de modo o un enlace con filtros vuelve a un bloque. Al llegar noticias nuevas o al volver a la app se respeta lo que el lector ya había ampliado.
  - El botón va centrado y sin ocupar todo el ancho, para no quedar bajo el botón flotante «Volver arriba».
  - «Compartir» conserva la posición en la lista completa (`start` en `itemsHtml`).
- **Descartado:**
  - **Scroll virtual** (reciclar ~20 tarjetas): las alturas varían con el texto, «Aa» y Dynamic Type. Rompe Ctrl+F, la navegación de VoiceOver y TalkBack y la posición al volver. Mucho código para poco sobre `content-visibility`.
  - **Carga automática al llegar al final** (con `IntersectionObserver`): se puede añadir encima si hace falta. Aleja el pie cada vez y el botón explícito es más predecible.
  - **Secciones plegables por tipo:** cambian la lectura cronológica.

## Consecuencias
- Medido con 260 noticias y la CPU 4× más lenta (`perf.e2e.ts`):
  - nodos DOM de 6.308 a 2.391;
  - heap de 3,0 a 2,5 MB;
  - CPU por tecla de 64 a ~48 ms;
  - «Ver más», ~100-130 ms.
  - El primer pintado mejora poco (478 → ~400 ms) porque `content-visibility` ya hacía la mayor parte.
- Ctrl+F solo encuentra lo que está pintado; el buscador de la app busca en todo.
- La lite (`lite.html`) no cambia: es estática y sin JS, con todas las noticias agrupadas.
