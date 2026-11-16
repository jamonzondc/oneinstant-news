# 0008 — Modo emergencia: `news-urgent.json` primero, el resto bajo demanda

## Contexto
Iter 5: con datos móviles saturados o cobertura 2G, `news.json` (≈ 21 KB gzip con 150-260 noticias) tarda varios segundos y compite con todo lo demás. En una emergencia lo que importa son unas pocas noticias: emergencias, suministros y avisos. Además, en la iter 4 quedó pendiente un problema: un aviso de AEMET reutilizado cuando AEMET falla se filtraba por antigüedad (36 h), no por caducidad, porque el contrato no llevaba `expiresAt`.

## Decisión
- **`news-urgent.json`**: mismo formato v1 que `news.json` (mismo `encode/decodeSnapshot`) con solo las categorías `URGENT_CATEGORIES` (`emergency`, `utilities`, `weather`) y solo las fuentes que aparecen. Presupuesto: **3 KB gzip**. `urgentSnapshot(snap, fits)` (puro, `pipeline/src/domain/urgent.ts`) recorta primero la categoría menos grave y, dentro de ella, lo más antiguo. Así, en un episodio con muchos avisos amarillos, las emergencias no se quedan fuera. El CLI inyecta `fits` con el tamaño gzip real.
- **Contrato**: 7.º elemento opcional `expiresAt` (segundos) en la fila del item. Solo va cuando existe, así que las noticias normales no pagan bytes, y los clientes anteriores ignoran las posiciones extra (no se sube `CONTRACT_VERSION`). El pipeline reutiliza un aviso mientras sigue vigente (`isFresh`) y el cliente oculta los caducados aunque la copia guardada sea antigua.
- **Cliente, dos modos** (`web/src/domain/view.ts`):
  - `all`: pide `news-urgent.json`, lo pinta y después pide `news.json`. Si la copia urgente es más reciente que la completa (descarga lenta o fallida), se combinan: urgentes nuevos más el resto antiguo, y el estado indica la hora del resto.
  - `urgent`: solo `news-urgent.json`. Si la copia completa guardada es más reciente, se usa su parte urgente.
  - Cada fichero tiene su copia en `localStorage` (`oin:urgent`, `oin:news`).
- **Detección de red lenta** (`domain/network.ts`): `saveData`, `effectiveType` `2g`/`slow-2g`, o `downlink` ≤ 0,4 Mbps. Lo último es necesario porque Chromium llama `3g` a un enlace 2G real con 800 ms de RTT (su `2g` empieza en 1400 ms). Safari y Firefox no exponen la API: allí el modo por defecto es `all`.
- **Preferencia**: la elección explícita (botón al final de la lista) se recuerda **por tipo de red** (`oin:mode` = `slow=all&fast=urgent`). Elegir «ver todas» una vez con 2G no desactiva el modo urgente cuando vuelve la buena conexión, ni al revés. El modo se recalcula con el evento `change` de `navigator.connection`.
- **Banner**: enlace fijo (`position: sticky`) a `#c=emergency` si hay emergencias de la última hora. Se calcula en cada render, sin timers.
- **Bytes por sesión**: suma de `transferSize` de las entradas `navigation` y `resource` de la página. Lo servido desde caché o service worker cuenta 0, que es lo que se gasta de verdad. No incluye las descargas del propio service worker al instalarse.
- **Service worker**: se registra **después** del primer refresco, no en `load`, para que en la primera visita con 2G la descarga del cascarón no compita con las noticias urgentes.

## Consecuencias
- E2E con throttling 2G por CDP (perfil 2G de WebPageTest: 280/256 kbps, 800 ms de RTT) y gzip en el servidor de pruebas, como en producción. Medido: urgentes visibles en ≈ 2,2 s en la primera visita y ≈ 50 ms en las siguientes. En modo urgente no se descarga `news.json`.
- Un despliegue sin `news-urgent.json` (p. ej. un espejo atrasado) sigue funcionando en modo `all`: el fallo del urgente no impide pedir el completo.
- `index.html` pasa de 5,3 a 6,6 KB gzip (presupuesto: 12).
- La detección automática solo funciona en Chromium (Android). En iOS el modo urgente es manual.
