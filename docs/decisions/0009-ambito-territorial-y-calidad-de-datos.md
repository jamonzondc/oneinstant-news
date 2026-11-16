# 0009 — Ámbito territorial, fuentes regionales y calidad de datos

## Contexto
Iter 6. Hasta ahora todas las fuentes eran nacionales. En una emergencia local (la dana de Valencia, un incendio en Galicia), quien lee necesita lo de su comunidad y no lo de las demás. Los avisos de AEMET cubren toda España desde una sola fuente, así que una región por fuente no basta. Además, el clasificador por palabras clave no se había medido nunca con titulares reales.

## Decisión
- **Regiones en el contrato** (`contract/news.ts`). `REGIONS` recoge las 17 comunidades más Ceuta y Melilla, con códigos ISO 3166-2:ES en minúscula.
  - `Source.region` es el 5.º elemento de la fila de fuente.
  - `NewsItem.region` es el 8.º elemento de la fila de item y solo se usa si difiere de la de su fuente. Si un item tiene región pero no caducidad, la posición 6 va a `null`: los clientes de la 0.5 leen `expiresAt` solo si es número.
  - Sin región = nacional. No se sube `CONTRACT_VERSION`. Una región desconocida se ignora (nacional) en lugar de invalidar el fichero.
- **Filtro «Zona»** (web). Elegir una comunidad muestra las noticias nacionales más las de esa comunidad, nunca las de otra. Es el uso real: «lo que me afecta aquí».
  - Se guarda en el hash (`r=`) y tiene contadores por faceta.
  - Siempre se listan las 19 zonas, para que la lista no cambie según haya noticias o no.
  - Con una zona elegida, el selector de entidad solo ofrece fuentes nacionales y de esa zona.
- **Avisos de AEMET por comunidad**. Cada mensaje CAP se llama `…AFAZ<área><provincia><zona>…`. La comunidad sale del código INE de provincia, que es fiable. Si la provincia no es un código INE (Mallorca 54, Menorca 55), se usa el área Meteoalerta, pero solo las áreas vistas en el feed real. Los grupos pasan a ser por comunidad, nivel, fenómeno y validez («Aviso naranja por lluvias en Galicia: …»). El tope de AEMET sube a 24 y se recorta por gravedad (orden del adaptador), no por fecha.
- **Una fuente por comunidad** (`sources/regional.ts`). Criterio: la radiotelevisión pública si tiene feed útil; si no, el diario regional de referencia.
  - Descartados: Canal Sur (fechas 5 h en el futuro), À Punt (mezcla la programación), CMM, CRTVG, EITB, RTVC y Canal Extremadura (sin RSS accesible), y los diarios de Prensa Ibérica (responden 406 a clientes automáticos).
  - Encontrados por *autodiscovery* y verificados desde GitHub Actions el 16-11-2026.
  - Tope de 5 noticias por fuente regional.
  - Única cuenta de emergencias autonómica con canal abierto: 112 Andalucía (Bluesky). El resto de 112 solo publica en X (ADR 0006) y sus canales de Telegram están vacíos o parados.
- **Presupuesto de `news.json`**. Con 46 fuentes, 260 noticias superarían los 30 KB gzip. `fitSnapshot` recorta lo más antiguo y no urgente hasta cumplirlo, con búsqueda binaria sobre el tamaño gzip real.
- **Clasificador medido con un corpus** (`pipeline/test/fixtures/classifier-corpus.tsv`). Son 338 titulares reales de todas las fuentes, etiquetados a mano con reglas escritas en la cabecera.
  - Un tercio queda reservado: no se miró para ajustar y se informa aparte.
  - Cambios al clasificador:
    - Términos con peso: «!» vale 2 y «~» vale 0,5.
    - Una emergencia pasada con fecha («el apagón de abril de 2025», «la dana de 2024») no cuenta como en curso.
    - El nombre «Protección Civil y Emergencias» no es un suceso.
    - Una sola palabra en el resumen no decide.
    - `fallbackCategory` por fuente: Sanidad → salud, Policía → sucesos, Moncloa y Newtral → política.
- **Limpieza de publicaciones**. Se quitan los enlaces (acortadores incluidos) y las líneas iniciales que solo tienen etiquetas. Antes, «#FMA #Lluvias» llegaba a ser el titular.
- **IGN**: adaptador nuevo para terremotos de magnitud ≥ 3,5, con titular legible. Magnitud ≥ 5 → `emergency`. Para eso, `RawItem.category` permite que el adaptador decida la categoría en vez del clasificador. Las horas del catálogo del IGN se interpretan como UTC.
- **Estado de fuentes**. `estado.html` se genera en el pipeline, sin JS, y lista primero las caídas, con un motivo legible y la última vez que respondieron. La app cuenta como caídas las fuentes con `lastOk < generatedAt` en el fichero más reciente y lo enlaza desde el pie.

## Consecuencias
- Precisión global en el corpus: **86 %** (con un mínimo exigido del 85 % en test).
  - Por categoría (≥ 10 predicciones): ≥ 85 % salvo emergencias (73 %), internacional (77 %) y tecnología (70 %). Estas tienen suelos propios en el test y la causa está documentada.
  - En la parte reservada: 77 %. Las reglas se ajustaron al vocabulario del momento (campaña electoral). Hay que añadir titulares de otras épocas al corpus.
- Los clientes de la 0.5 siguen funcionando con los ficheros nuevos, pero no muestran ni filtran por región.
- Las fuentes regionales hacen crecer `news.json`. El recorte automático garantiza el presupuesto a costa de las noticias más antiguas.
- Por definición, el filtro por zona no puede mostrar una noticia nacional que solo afecte a una comunidad, salvo los avisos de AEMET.
