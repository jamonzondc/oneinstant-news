# 0007 — Fuentes oficiales y redes: Telegram, avisos CAP de AEMET y fuentes "sparse"

## Contexto
Iter 4: añadir entidades oficiales y cuentas de redes sociales sin APIs de pago (ADR 0006) ni dependencias. La red del entorno de desarrollo no llega a los feeds; las fuentes se verificaron desde GitHub Actions con un workflow temporal (16-11-2026).

Hallazgos:
- **AEMET** publica sus avisos CAP 1.2 en un RSS/Atom (`CAP_AFAE_wah_RSS.xml`, ~80 entradas: una por aviso y zona) cuyo título y resumen ya traen nivel, fenómeno, zona y validez. Cada entrada enlaza a un XML CAP.
- **MeteoAlarm** tiene Atom de España, pero en inglés y menos detallado que AEMET. Descartado.
- **Telegram** sirve una vista HTML pública por canal (`t.me/s/<canal>`). Canales activos encontrados: Policía Nacional, Maldito Bulo, El País, elDiario.es, Público. No hay canales de DGT, AEMET, Protección Civil (estatal) ni 112 autonómicos (el canal "proteccioncivil" es de ámbito provincial y sin respaldo claro: no se usa). Guardia Civil lleva meses sin publicar.
- **Bluesky** (RSS por perfil): cuentas oficiales de AEMET, DGT, Red Eléctrica, Renfe, Interior, Sanidad, Policía (también), La Moncloa; y RTVE Noticias, EFE, VOST Spain, Cruz Roja, Newtral. **Mastodon**: ninguna cuenta oficial española relevante.
- RSS oficiales propios: La Moncloa y Seguridad Nacional (pocas entradas); el de Red Eléctrica está congelado desde 2024.
- Muchas cuentas oficiales publican pocas veces: con la regla de la iter 3 ("responde sin noticias recientes = caída") saldrían como caídas aunque estén sanas.

## Decisión
- **`TelegramAdapter`**: descarga `t.me/s/<canal>` y extrae cada post (`data-post`, `js-message_text`, `<time datetime>`). Ignora posts solo multimedia y el texto citado de respuestas. Enlace = `https://t.me/<canal>/<id>`.
- **`CapAdapter`** (avisos de AEMET): lee el RSS índice, no descarga los ~80 XML CAP por ejecución. Agrupa las zonas con mismo nivel, fenómeno y validez en una noticia: *"Aviso naranja por lluvias: Valle del Tajo, Montes de Toledo"* (lista de zonas hasta ~170 caracteres y "y N más"), resumen *"Del 15/11 17:00 al 15/11 23:59 (CET). 2 zonas."*. Orden: rojo, naranja, amarillo y, dentro, el que empieza antes. Enlace al CAP del primer aviso del grupo (único, para que el deduplicado por URL no fusione grupos).
- **Caducidad**: `RawItem.expiresAt` opcional. Un aviso vigente se publica aunque tenga más de 36 h y uno caducado se quita aunque sea reciente (`prepareItems`).
- **Fuentes `sparse`**: marca de catálogo para fuentes de poco volumen (avisos, cuentas oficiales). Si responden sin nada reciente están **sanas** (0 noticias, `lastOk` actualizado) y no reutilizan noticias previas. Sin la marca se mantiene la detección de feeds congelados.
- **Titular de posts sin título** (Bluesky, Telegram): si la primera línea mide 12-180 caracteres, es el titular y el resto el resumen; si no, se deriva como antes.
- **`kind` = naturaleza de la entidad**, no el canal: AEMET por Bluesky es `official`, RTVE por Bluesky es `media`; `social` queda para cuentas que no son ni medio ni organismo (voluntarios, ONG, verificadores). Así el filtro "Fuentes oficiales" reúne todo lo oficial. El criterio "5 cuentas sociales" de la iter 4 se cuenta como cuentas leídas de redes sociales.
- Helpers de catálogo `bluesky(handle, …)` y `mastodon('usuario@instancia', …)` en `sources/networks.ts`.

## Consecuencias
- Telegram y Bluesky pueden cambiar su HTML/RSS: fixture + test por adaptador; si cambian, la fuente sale caída y reutiliza sus noticias, nunca rompe el build.
- Un aviso de AEMET reutilizado (AEMET caída) se filtra por antigüedad, no por caducidad, porque el contrato no guarda `expiresAt`: puede mostrarse hasta 36 h un aviso ya vencido, con su validez visible en el resumen. Aceptable hasta la iter 5 (`news-urgent.json`).
- El enlace de un aviso abre un XML CAP (técnico pero oficial y verificable). Mejorable en la iter 7 si AEMET ofrece URLs de zona estables.
- Pendiente: 112 autonómicos y Protección Civil estatal (solo en X o WhatsApp), terremotos del IGN (RSS sin titular útil y con muchos sismos menores: requiere filtro por magnitud, iter 6).
