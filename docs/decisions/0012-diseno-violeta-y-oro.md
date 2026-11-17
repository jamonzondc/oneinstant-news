# 0012 — Diseño visual: azul casi negro, tarjetas, violeta y oro

## Contexto
El usuario ve la interfaz anticuada: fondo negro puro, lista plana con separadores y un único color de enlace. Pide algo más atractivo, solo con CSS y con lo mínimo: sombras, un fondo azul oscuro o gris casi negro y un acento fuerte en violeta y amarillo.

## Decisión
- **Paleta** en variables CSS (`web/src/ui/styles.css`):
  - Oscuro:
    - fondo `#0d0f1e` (azul casi negro) y tarjetas `#171a30`;
    - acento violeta `#5b2a9e` (con `#c4a8ff` para enlaces y etiquetas de tipo) y oro `#fdb927`.
  - Claro: fondo lavanda `#f3f1f9`, tarjetas blancas, violeta `#5b2bb5`/`#552583` para enlaces y título.
  - Los colores con significado no cambian de función: rojo para emergencias; naranja (`#ff9f43` / `#a04a00`) para suministros y avisos, distinto del oro de la marca.
- **Elementos:**
  - cada noticia y cada sección de las páginas estáticas es una tarjeta con radio y sombra suave;
  - el título va en oro (violeta en claro);
  - bajo la cabecera, una línea con degradado de violeta a oro;
  - «Actualizar» va en oro sobre violeta, y «Nueva» y «Aa» pulsado en una píldora dorada;
  - los teléfonos de la guía van en oro.
- **Mismo estilo en todo:** `lite.html` y `estado.html` (CSS propio), `theme-color`, el manifest y el icono (un «!» dorado sobre un disco violeta).
- Sin fuentes web, imágenes ni animaciones. El fondo deja de ser negro puro: en OLED, `#0d0f1e` apenas gasta más.

## Consecuencias
- El test de contraste (`web/test/a11y.test.ts`) comprueba los pares nuevos en claro y oscuro: texto, etiquetas y enlaces sobre las tarjetas, tinta sobre oro, oro sobre violeta y foco.
- `index.html`: 9,3 KB gzip (antes 9,0), dentro del presupuesto de 12 KB.
- Las sombras (`box-shadow`) solo se pintan al hacer scroll o renderizar; no hay coste en reposo (sin timers ni animaciones).
