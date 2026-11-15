# 0002 — Pipeline con adaptadores en build y contrato único `/news.json`

## Contexto
Queremos que añadir una entidad (periódico, organismo, cuenta social) sea trivial y que el móvil descargue el mínimo posible. Los feeds de origen son heterogéneos (RSS, Atom, ISO-8859-1, HTML de Telegram, CAP) y pesados (imágenes, HTML, tracking).

## Decisión
- Los adaptadores se ejecutan **en el pipeline** (GitHub Actions, cada 15 min), no en el cliente. El móvil hace **una** petición a un fichero pequeño ya normalizado, en vez de una por fuente.
- Patrón adaptador + registry tipado:
  - `SourceDefinition` (unión discriminada por `adapter`) describe cada entidad en el catálogo `pipeline/src/sources/`.
  - `SourceAdapter<S>.read(source, http) → RawItem[]` es el único contrato que implementa cada formato.
  - `AdapterRegistry` es un mapped type: un formato sin adaptador registrado no compila.
  - `buildSnapshot` recibe `HttpClient` y registry inyectados → testeable sin red.
- Contrato `contract/news.ts` compartido por pipeline y web; formato de transporte compacto (arrays posicionales, sin claves repetidas). Las etiquetas de categorías y tipos de fuente viajan en el bundle web, no en cada respuesta.
- Presupuesto: `news.json` ≤ 30 KB gzip a plena carga (260 noticias, 12 por fuente, 36 h).

## Consecuencias
- Añadir entidad con formato existente = 1 línea de catálogo. Formato nuevo = 1 clase + 1 miembro de la unión + 1 entrada del registry + fixture/test.
- Nuevas categorías requieren redeploy del cliente; los clientes antiguos las ven como "General" (decode tolerante).
- Las noticias tienen hasta ~15 min de retraso respecto al origen (frecuencia del cron).
