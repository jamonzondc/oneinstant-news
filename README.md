# OneInstant News

Noticias en texto para emergencias. Carga en segundos con cobertura 2G, gasta muy pocos datos y batería, y sin conexión muestra la última copia. Pensada para días como el apagón del 28-04-2025.

Reúne en una sola lista medios nacionales y regionales, organismos oficiales (AEMET, DGT, Interior, Red Eléctrica, IGN…) y cuentas de emergencias en redes abiertas (Bluesky, Telegram). Se actualiza cada 15 minutos.

## Cómo se usa

### Instalarla
Abre la dirección de la app y añádela a la pantalla de inicio:
- **iPhone (Safari):** botón Compartir → «Añadir a pantalla de inicio».
- **Android (Chrome):** menú ⋮ → «Instalar aplicación» o «Añadir a pantalla de inicio».

Una vez abierta, la app queda guardada en el teléfono: se abre aunque no haya red y enseña la última copia de las noticias con su hora.

### Lo urgente primero
- Las **emergencias**, los **cortes de luz, agua o telecomunicaciones** y los **avisos meteorológicos** llegan primero, en un archivo de menos de 3 KB.
- Si hay una emergencia de la última hora, aparece un **aviso rojo** fijo arriba. Al tocarlo, se ven solo las emergencias.
- Con la red muy lenta o el ahorro de datos activado, solo se descargan las urgentes. Para ver el resto, toca «Ver todas las noticias» al final de la lista. Con buena conexión puedes elegir lo contrario: «Solo urgentes (ahorra datos)». La app recuerda la elección.
- El pie indica cuántos datos ha gastado la app desde que la abriste.

### Filtrar
- **Tipo:** emergencias, luz/agua/telecom, tiempo y avisos, transporte, salud…
- **Entidad:** un medio u organismo concreto, o un grupo entero (medios, oficiales, redes sociales).
- **Zona:** tu comunidad autónoma. Se ven las noticias de toda España más las de tu comunidad.
- **Buscar:** por palabras, sin importar las tildes («apagon» encuentra «apagón»).

Los filtros quedan en la dirección de la página: si la copias o la guardas en favoritos, se abre con los mismos filtros.

### Guía de emergencia
El botón **«Guía»** (y el pie) abre «Qué hacer en una emergencia»: teléfonos que se marcan con un toque, consejos ante un apagón, inundaciones, un terremoto o una ola de calor, y cómo preparar un kit para 3 días. Se guarda en el teléfono la primera vez que abres la app, así que funciona sin ninguna conexión. Los consejos salen de fuentes oficiales, enlazadas al final.

### Lo nuevo desde tu última visita
Las noticias publicadas desde la última vez que abriste la app llevan la marca **«Nueva»**, y arriba de la lista ves cuántas hay.

### Compartir
Cada noticia tiene un botón **«Compartir»**. Envía el titular, el resumen, la fuente y la hora como texto, para que lo entienda quien no pueda abrir el enlace. En los ordenadores sin menú de compartir, el texto se copia al portapapeles.

### Letra y accesibilidad
- El botón **«Aa»** agranda la letra. La app también respeta el tamaño de letra del teléfono y el zoom del navegador.
- Funciona con lectores de pantalla (VoiceOver, TalkBack):
  - enlace para saltar a las noticias;
  - aviso hablado de las emergencias nuevas;
  - todos los controles con nombre.
  Detalle en [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md).

### Si algo falla
- **Sin conexión:** verás «Sin conexión. Última copia: HH:MM». Pulsa «Actualizar» cuando vuelva la cobertura. La app también se actualiza sola al recuperar la conexión o al volver a ella tras 10 minutos.
- **Servidor caído:** la app pide las noticias a un servidor alternativo y lo indica. El pie enlaza a la app en ese otro servidor: guárdalo por si acaso.
- **Fuentes sin actualizar:** el pie dice cuántas hay y enlaza a «Estado de las fuentes», con el motivo y la última vez que respondieron.
- **Móvil antiguo o sin JavaScript:** usa la **versión sin JavaScript** (`lite.html`, enlazada en el pie). Es una sola página con todas las noticias agrupadas por tipo.

### Privacidad
Sin cuentas, sin anuncios y sin seguimiento. La app no carga nada de terceros. Tus filtros y preferencias se guardan solo en tu teléfono.

## Desarrollo

Node 22 con TypeScript nativo, sin dependencias en runtime. Arquitectura, reglas y Definition of Done en [`CLAUDE.md`](CLAUDE.md); decisiones en [`docs/decisions/`](docs/decisions/).

```sh
npm ci
npm test && npm run typecheck
npm run build:data:fixtures   # datos sin red (fixtures) → dist/
npm run build:web             # app → dist/ (MIRRORS=https://a.web.app,https://b.pages.dev para el servidor alternativo)
npm run serve                 # http://localhost:8080
npm run test:e2e              # Playwright (Chromium); CHROMIUM_PATH si usas un binario propio
```

- Estado y plan: [`docs/PROGRESS.md`](docs/PROGRESS.md) · [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Despliegue gratuito (Firebase Hosting y espejo en Cloudflare Pages, cada 15 min con GitHub Actions): [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Rendimiento y batería: [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md)
- Añadir una fuente: una entrada en `pipeline/src/sources/*.ts` (ver `CLAUDE.md`).
