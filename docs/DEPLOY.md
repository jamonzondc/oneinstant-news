# Despliegue

Workflow: `.github/workflows/deploy.yml` (ADR 0003 y 0005). Sin secrets construye pero no publica.

## Configuración (una vez)

### Firebase Hosting (principal)
1. [console.firebase.google.com](https://console.firebase.google.com) → crear proyecto (plan Spark, sin Analytics). Apunta el **ID del proyecto**.
2. Compilación → Hosting → Comenzar (no hace falta ejecutar nada en local).
3. Hosting → menú ⋮ del sitio → **Configuración de retención de versiones** → p. ej. 5. Cada deploy crea una versión y el plan tiene 10 GB.
4. Google Cloud Console → IAM → Cuentas de servicio → crear `github-deploy` con el rol **Administrador de Firebase Hosting** (`roles/firebasehosting.admin`). Si el primer deploy falla por un permiso `serviceusage.*`, añade también **Consumidor de Service Usage** (`roles/serviceusage.serviceUsageConsumer`). Claves → Añadir clave → JSON.
5. GitHub → Settings → Secrets and variables → Actions:
   - Secret `FIREBASE_SERVICE_ACCOUNT` = contenido completo del JSON.
   - Variable `FIREBASE_PROJECT_ID` = ID del proyecto.

### Cloudflare Pages (espejo)
1. [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Crear → Pages → **Subir recursos (Direct Upload)** → nombre `oneinstant-news` (o el que quieras) → sube cualquier carpeta para crearlo.
2. Mi perfil → API Tokens → Crear token → plantilla **Edit Cloudflare Workers** o permiso personalizado *Account → Cloudflare Pages → Edit*.
3. GitHub → Settings → Secrets and variables → Actions:
   - Secret `CLOUDFLARE_API_TOKEN`.
   - Variable `CLOUDFLARE_ACCOUNT_ID` (en la barra lateral del panel de Cloudflare).
   - Variable `CLOUDFLARE_PAGES_PROJECT` solo si el proyecto no se llama `oneinstant-news`.

### Primer deploy
Actions → Deploy → Run workflow. Después corre solo cada 15 min (Firebase) y cada 2 h (espejo).

## Variables opcionales
| Variable | Efecto |
|---|---|
| `CLOUDFLARE_EVERY_RUN=true` | El espejo se publica cada 15 min. Ojo: el plan gratuito limita a 500 builds/mes y no está claro si los direct uploads cuentan. |
| `PREVIOUS_URL` | Sustituye a las URLs calculadas para recuperar el snapshot anterior (lista separada por comas). |
| `MIRRORS` | Sustituye a las direcciones calculadas de la app (`https://<proyecto>.web.app`, `https://<proyecto>.pages.dev`), p. ej. si usas un dominio propio. Lista separada por comas. Cada copia de la app pide las noticias a las demás cuando la suya falla (ADR 0010). |

## URLs
- Principal: `https://<FIREBASE_PROJECT_ID>.web.app`
- Espejo: `https://<CLOUDFLARE_PAGES_PROJECT>.pages.dev`

## Servidor alternativo (espejo)
La app publicada en cada host conoce la dirección del otro (`MIRRORS`, calculada en el workflow). Si `news.json` o `news-urgent.json` fallan en su host (caído, cuota diaria de Spark agotada), los pide al otro. Los dos JSON llevan `Access-Control-Allow-Origin: *` (`web/tools/hosting.ts`) y la CSP de `index.html` permite `connect-src` solo a esos hosts. Si no hay espejo configurado, la app funciona igual sin esta opción.

## Problemas conocidos
- GitHub retrasa los cron en horas punta y los desactiva tras 60 días sin actividad (hay un keepalive semanal; si aun así se desactiva, reactívalo en Actions).
- Spark tiene un tope diario de transferencia: si se supera, Firebase deja de servir hasta el día siguiente. Quien ya tenga la app instalada recibe las noticias del espejo (pueden ir hasta 2 h por detrás); el resto tiene que abrir el espejo directamente.
