# 0011 — Guía de emergencia sin conexión y marca de noticias nuevas

## Contexto
Iter 8, primera después de la 1.0. En una emergencia real (el apagón del 28-04-2025, la dana de 2024) la gente no solo busca noticias: también qué hacer, y a menudo sin red. La app ya funciona sin conexión, pero solo con noticias. Además, al reabrirla no se distingue lo que ya se había leído de lo nuevo.

## Decisión
- **Guía estática `guia.html`**, generada en el build web como `changelog.html`, sin JS y con el CSS de la app.
  - **Contenido** como datos tipados (`web/src/guide/guide.ts`): teléfonos, secciones y fuentes. Fecha de revisión visible. Secciones:
    - lo primero;
    - apagón;
    - lluvias e inundaciones;
    - terremoto;
    - calor;
    - kit para 72 horas.
  - **Solo consejos de fuentes oficiales**, citadas al final:
    - Protección Civil / Ministerio del Interior (guía de inundaciones);
    - IGN (terremoto y tsunami);
    - Ministerio de Sanidad (calor);
    - Protecció Civil de Catalunya (kit de 72 h, 1,5 l de agua por persona y día como mínimo);
    - Comisión Europea (Estrategia de la Unión de Preparación, autosuficiencia mínima de 72 h).
  - Sin cifras dudosas: por ejemplo, no se dice cuánta agua arrastra un coche, ni cuántas horas aguanta una nevera.
  - **Verificación del contenido:** la red de desarrollo no llega a esos dominios. Se contrastó con búsquedas que citan los documentos oficiales. Conviene que una persona lo relea contra las fuentes en cada revisión.
  - **Disponible sin red desde la primera visita:** está en el `SHELL` del service worker, así que la versión del SW cambia si cambia la guía. Cabecera de documento (`hosting.ts`, `firebase.json` regenerado).
  - **Presupuesto de 8 KB gzip**, con test: hoy pesa 4,7 KB. La descarga el SW una vez por versión, fuera del camino crítico.
  - **Teléfonos como enlaces `tel:`**, grandes. El 112 va primero.
  - **Enlaces:**
    - botón «Guía» en la cabecera (≥ 44 px);
    - pie de la app;
    - `lite.html`.
  - **Alternativas descartadas:**
    - Meter la guía en `index.html`: sumaría ~5 KB gzip a cada visita y rompería el presupuesto de 12 KB.
    - Generarla en el pipeline: no depende de los datos.
- **«Nueva» desde la última visita** (`web/src/domain/seen.ts`).
  - **Marca de agua:** la hora de publicación de la noticia más reciente que se ha mostrado, guardada en `localStorage` (`oin:seen`).
    - No retrocede: una copia antigua no vuelve a marcar lo ya visto.
    - Ignora fechas futuras: un feed con el reloj mal no oculta las nuevas.
  - **Visita:** empieza al abrir la app o al volver a ella tras más de 10 minutos, el mismo umbral que el refresco automático. Se marcan como nuevas las noticias publicadas después de la marca de la visita anterior. En la primera visita no se marca nada.
  - **Señal:** la palabra «Nueva» en la línea de datos de la noticia (no solo el color), y «· N nuevas» en el contador, que es región viva.
  - **Límites:**
    - No se marca una noticia que llega tarde a su feed con fecha anterior a la marca.
    - En modo «Solo urgentes», la marca avanza con las urgentes: las no urgentes anteriores a esa hora no saldrán como nuevas al pasar a «todas».
    - Se aceptan a cambio de no guardar una lista de identificadores.
- **`--now` en el CLI del pipeline:** los fixtures se construyen en su fecha de captura (`FIXTURES_NOW`), así que `build:data:fixtures` ya no sale vacío pasadas 36 h.
- **Enlace de los avisos de AEMET:** sigue apuntando al XML CAP. La única página legible que da el feed es el mapa nacional (`/es/eltiempo/prediccion/avisos`). Si todos los avisos compartieran esa URL, el deduplicado por URL los fundiría en uno, y no se ha podido verificar una URL estable por comunidad: aemet.es no es accesible desde la red de desarrollo.

## Consecuencias
- `index.html`: 9,0 KB gzip (antes 8,6): botón «Guía», marca «Nueva» y su lógica. Presupuesto de 12 KB cumplido.
- La instalación del SW descarga ≈ 5 KB más por versión.
- La guía hay que revisarla cuando cambien las recomendaciones oficiales. La fecha de revisión está en `GUIDE_REVIEWED`.
