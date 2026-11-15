# 0001 — Frontend en TypeScript sin framework (no Angular)

## Contexto
La app debe funcionar con datos móviles saturados (apagón del 28-04-2025) y gastar la mínima batería. El usuario propuso Angular salvo que hubiera una opción mejor para la red.

## Decisión
PWA en TypeScript sin framework, empaquetada con `esbuild` (solo en desarrollo) en un único `index.html` con JS y CSS inline. Sin dependencias de runtime.

- Angular, incluso en su configuración mínima (standalone, sin router ni `HttpClient`), añade decenas de KB comprimidos de runtime antes de escribir una línea de la app; el objetivo de toda la app es ≤ 12 KB gzip.
- El service worker solo ahorra en visitas posteriores: la **primera** visita (un enlace recibido por WhatsApp en plena emergencia) paga el bundle completo.
- Parsear y ejecutar JS cuesta CPU y batería en móviles modestos; Zone/detección de cambios no aportan nada a una lista con filtros.
- La complejidad de "añadir entidades" vive en el pipeline (ADR 0002), no en el cliente: el frontend solo pinta un contrato estable.

Alternativas descartadas: Preact/Lit/Svelte (pequeños, pero siguen siendo terceros en runtime y no resuelven nada que no resuelvan 200 líneas de TS).

## Consecuencias
- Arquitectura por capas a mano (`domain/`, `data/`, `ui/`, `app.ts`) con disciplina en vez de framework.
- Render con plantillas de string e `innerHTML` (escape obligatorio de todo texto del feed).
- Si la UI creciera mucho (cuentas, ajustes complejos) se reevaluaría con otro ADR.
