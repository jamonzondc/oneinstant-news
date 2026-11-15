# 0003 — Hosting gratuito: Firebase Hosting + espejo en Cloudflare Pages + GitHub Actions

## Contexto
Requisito: coste 0, desplegado en Firebase, con presencia en varios continentes y resistente a picos de tráfico en una catástrofe.

## Decisión
- **Firebase Hosting, plan Spark**: CDN global incluida (no hace falta elegir región; la región solo importa para Functions/Firestore, que no usamos). Sin Cloud Functions (no disponibles en Spark).
- **GitHub Actions** (gratis e ilimitado en repos públicos) ejecuta el pipeline con cron y despliega.
- **Espejo en Cloudflare Pages** (ancho de banda sin límite en el plan gratuito): el plan Spark tiene un tope diario de transferencia y, si se supera, el sitio deja de servirse hasta el día siguiente — justo en un pico por catástrofe.

## Consecuencias
- Dos URLs públicas; la app puede indicar la alternativa si una falla.
- GitHub desactiva los cron de repos públicos tras 60 días sin actividad: hay que reactivarlo o mantener actividad.
- Cada deploy crea una versión en Hosting: configurar la retención de versiones en la consola para no llenar los 10 GB.
- Retraso de datos ligado al cron (los cron de GitHub pueden retrasarse en horas punta).
