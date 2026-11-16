# 0010 — Servidor alternativo, accesibilidad sin dependencias y versión 1.0.0

## Contexto
Iter 7, el pulido antes de la 1.0. Quedaba pendiente desde la iter 3 que la app usara el espejo cuando el host principal falla. El caso típico es Firebase Spark con la cuota diaria de transferencia agotada: justo en una emergencia, cuando más se usa. Además el ROADMAP pide accesibilidad, compartir noticias, una auditoría de rendimiento y batería, y la v1.0.0.

## Decisión
- **Fallback al espejo dentro de la app** (`web/src/data/origins.ts`).
  - El build recibe `MIRRORS`, las direcciones de todos los hosts de la app. El workflow las calcula a partir de `FIREBASE_PROJECT_ID` y del proyecto de Cloudflare, y la variable `MIRRORS` las sustituye.
  - Cada copia de la app las lleva dentro y descarta la suya (`location.origin`).
  - Las noticias se piden primero al propio host y después al otro. El host que responde pasa a ser el primero durante la sesión, para que el segundo fichero no repita el fallo. Las dos copias se guardan juntas en `localStorage`, sea cual sea el origen.
  - Una copia más antigua que la guardada no la sustituye: el espejo se publica cada 2 h.
  - Cuando los datos vienen del espejo, el estado lo dice («servidor alternativo»). Si no responde ningún host, aparece el enlace a la app en el otro servidor. El pie siempre enlaza al espejo.
  - Lo que hace falta en los hosts y en la página:
    - `Access-Control-Allow-Origin: *` solo en `news.json` y `news-urgent.json`. Son datos públicos y, al ser GET simples, no hay preflight.
    - La CSP añade `connect-src 'self' <espejos>` solo si hay espejos. Sin `MIRRORS`, el build queda igual que antes.
  - Alternativa descartada: un service worker que reescriba las peticiones. Sería más complejo y no lo cubriría el SW actual, que no intercepta las noticias a propósito.
  - Límite: quien no tiene la app en caché no puede llegar a ella si el host principal no sirve el `index.html`. Para ese caso está el enlace del pie, que se puede guardar antes.
- **Accesibilidad sin `axe-core`**: añadirlo sería una dependencia nueva solo para comprobar cosas que ya se pueden medir directamente. Se comprueba con:
  - test unitario de contraste WCAG (AA) que lee los colores reales del CSS, en claro y oscuro, incluidas las páginas estáticas;
  - e2e:
    - controles sin nombre accesible, según el árbol de accesibilidad de Playwright (`ariaSnapshot`);
    - encabezados;
    - teclado;
    - región viva del aviso de emergencia;
    - tamaño mínimo de las zonas táctiles;
    - texto al 200 % (`Page.setFontSizes`) sin scroll horizontal.
  - Checklist en `docs/ACCESSIBILITY.md`.
- **Tamaño de letra**. Los tamaños de letra pasan a `em` relativos a `body`, para que todo escale junto, zonas táctiles incluidas. Lo escalan tres cosas:
  - el tamaño del navegador (`rem`);
  - Dynamic Type en iOS (`font: -apple-system-body`, limitado a iOS con `-webkit-touch-callout`, porque en Safari de macOS daría 13 px);
  - el botón «Aa» (×1,25, guardado en `localStorage`).
- **Compartir**. Web Share API con `title`, `text` y `url`. El texto incluye el resumen, la fuente y la fecha completa, porque quien lo recibe en una emergencia puede no tener datos para abrir el enlace. Si no hay Web Share, se copia al portapapeles. Si tampoco hay portapapeles, no se muestra el botón. Un único listener en la lista atiende todos los botones.
- **Rendimiento**. `content-visibility: auto` en los artículos: el navegador no maqueta ni pinta los que están fuera de pantalla, y el layout de la lista completa baja de 149 a 55 ms con la CPU 4× más lenta. Un e2e con 260 noticias vigila los tiempos, que el uso de CPU en reposo sea nulo y que no haya timers (`docs/PERFORMANCE.md`).
- **Versión 1.0.0** directamente, en lugar de 0.7.0 y después 1.0.0. El DoD pide `0.N.0` al empezar cada iteración, pero el ROADMAP fija la v1.0.0 como aceptación de esta, que es la última. Es la única excepción.

## Consecuencias
- El shell (y su hash) depende de `MIRRORS`: cambiar los hosts publica una versión nueva del service worker.
- `index.html` sube de 7,3 a 8,6 KB gzip (presupuesto: 12).
- Cada noticia lleva un botón más en el DOM. Con 260 noticias, los nodos pasan de unos 4.700 a unos 5.700, sin efecto medible gracias a `content-visibility`.
- El aviso de un servidor alternativo usa el color de advertencia: hay que saber que los datos pueden ir por detrás.
- Desde la 1.0.0 las versiones siguen semver: minor por funcionalidad nueva y patch por corrección. La regla `0.N.0` por iteración del DoD ya no aplica (`CLAUDE.md` actualizado).
