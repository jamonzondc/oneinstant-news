# Accesibilidad — checklist

Objetivo: WCAG 2.2 AA en la app (`index.html`) y en las páginas estáticas (`lite.html`, `estado.html`, `changelog.html` y `guia.html`). Cada punto indica cómo se comprueba. Los automáticos fallan en CI si se rompen.

Leyenda: **U** test unitario (`npm test`), **E** e2e (`npm run test:e2e`), **M** revisión manual.

| # | Criterio | Cómo se cumple | Comprobación |
|---|---|---|---|
| 1 | Idioma de la página (3.1.1) | `<html lang="es">` en las cinco páginas | U `build.test.ts`, `guide.test.ts` |
| 2 | Contraste de texto ≥ 4,5:1 (1.4.3) | Pares de colores en claro y oscuro, banner incluido | U `a11y.test.ts` (lee `styles.css` y el CSS de las páginas estáticas) |
| 3 | Contraste de controles y foco ≥ 3:1 (1.4.11) | Borde de controles `--cb`, anillo de foco `--ln` | U `a11y.test.ts` |
| 4 | El color no es la única señal (1.4.1) | Cada noticia lleva su tipo escrito («Emergencias») además del color; las nuevas, la palabra «Nueva» | M; U `render.test.ts` («Nueva») |
| 5 | Nombre accesible en todos los controles (4.1.2) | `aria-label` en selectores y búsqueda; texto visible en botones | E (`ariaSnapshot`: ningún botón, enlace, combobox ni searchbox sin nombre) |
| 6 | El nombre contiene la etiqueta visible (2.5.3) | «Aa» se lee «Aa letra grande» | E |
| 7 | Estado de los conmutadores | `aria-pressed` en «Aa» | E |
| 8 | Estructura de encabezados (1.3.1) | Un `h1` y un `h2` por noticia; regiones `header`, `search`, `main` y `footer` | E |
| 9 | Saltar bloques (2.4.1) | «Saltar a las noticias»: primer elemento enfocable, visible al enfocarlo, no toca el hash de filtros | E |
| 10 | Orden del foco (2.4.3) | Tras saltar, el siguiente Tab va al primer titular | E |
| 11 | Foco visible (2.4.7) | `:focus-visible` con un contorno de 3 px | M (captura `skiplink-*`) |
| 12 | Foco no tapado (2.4.11) | `scroll-padding-top` mientras el banner fijo está visible | M |
| 13 | Mensajes de estado (4.1.3) | Estado de la carga en `role="status"`, número de noticias en `aria-live="polite"`, emergencia nueva en `aria-live="assertive"` (una vez por emergencia) | E (región del aviso); U (marcado) |
| 14 | Redimensionar texto al 200 % (1.4.4) y reflujo (1.4.10) | Tamaños en `em`; `overflow-wrap: anywhere`; sin anchos fijos | E (`Page.setFontSizes` a 32 px con «Aa» activado: 40 px de letra sin scroll horizontal) |
| 15 | Tamaño de letra del sistema | Dynamic Type en iOS (`-apple-system-body`); zoom nunca bloqueado (sin `user-scalable=no`) | U (viewport); M en iPhone |
| 16 | Zonas táctiles (2.5.8) | Controles principales ≥ 44 px (también «Guía» y «Volver arriba»); «Compartir», la etiqueta de tipo y los teléfonos de la guía ≥ 24 px | E |
| 17 | Sin movimiento (2.3.3) | Sin animaciones ni transiciones | M (no hay `animation` ni `transition` en el CSS) |
| 18 | Sin límites de tiempo (2.2.1) | Nada caduca ni se actualiza solo mientras se lee (sin timers) | E `perf.e2e.ts` (0 timers) |
| 19 | Sin JavaScript | `lite.html` enlazada desde `<noscript>` y el pie | E |
| 20 | Etiqueta de tipo como botón | Nombre «Ver solo <tipo>» (contiene el texto visible); el emoji va con `aria-hidden` | U `render.test.ts`; E |
| 21 | «Volver arriba» | Botón flotante con nombre «Volver arriba»; lleva el foco al título, no solo el scroll | E |
| 22 | «Ver más» | Botón con el número de noticias que añade y las que quedan; el foco pasa a la primera noticia nueva | E |

## Pendiente de probar a mano
- VoiceOver en iPhone y TalkBack en Android: lectura de la lista, el banner y los selectores (los e2e son solo de Chromium).
- Dynamic Type en tamaños de accesibilidad (AX1 a AX5) en un iPhone real.
- Lectores de pantalla en escritorio (NVDA o JAWS) con la región viva del aviso: la verbosidad varía entre lectores.
