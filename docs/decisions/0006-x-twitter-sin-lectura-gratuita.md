# 0006 — X/Twitter no se lee: sin API gratuita de lectura

## Contexto
Muchas entidades oficiales (112 autonómicos, DGT, Protección Civil) publican sus avisos sobre todo en X. La iter 4 pide confirmar si se pueden leer gratis.

Estado comprobado en noviembre de 2026:
- El nivel *Free* de la API de X cerró a desarrolladores nuevos el 6-2-2026; el plan por defecto pasó a ser **pago por uso** (del orden de 0,005 $ por post leído, con tope mensual). El antiguo *Basic* (200 $/mes) dejó de admitir altas y se está migrando también a pago por uso. El acceso gratuito solo se concede caso a caso a "aplicaciones de utilidad pública", sin garantía.
- Los accesos sin API (scraping de `x.com`, instancias de Nitter, RSS de terceros) exigen sesión, se rompen con frecuencia y violan los términos de uso.
- Con cron cada 15 min y ~20 cuentas, incluso pagando serían ~2.000 lecturas/día: incompatible con "gratis" (ADR 0003).

## Decisión
- **No se integra X.** Ningún adaptador ni fuente usa `x.com`/`twitter.com`.
- Para cada entidad se usa, por este orden de preferencia: **RSS/Atom/CAP propio** (web oficial), **Telegram** (vista pública `t.me/s/<canal>`, sin cuenta ni API), **Bluesky** (`bsky.app/profile/<handle>/rss`) o **Mastodon** (`<instancia>/@<usuario>.rss`).
- Si una entidad solo publica en X, queda fuera del catálogo y se apunta en `docs/PROGRESS.md` para revisarla.

## Consecuencias
- Algunos 112 autonómicos no tienen alternativa abierta: su información llega indirectamente por medios y agencias.
- Si X reabre un nivel gratuito de lectura, bastaría un `XAdapter` nuevo (miembro en `SourceDefinition` + registry), sin tocar el resto.
- Telegram no tiene API pública de lectura sin cuenta: la vista web `t.me/s/` es HTML y puede cambiar. El adaptador se protege con fixture y test, y un cambio de marcado solo deja esa fuente caída (reutiliza sus noticias previas), nunca rompe el build.
