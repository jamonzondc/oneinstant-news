# oneinstant-news

Lector de noticias para emergencias: solo texto, mínimo consumo de red y batería, funciona sin conexión con la última copia.

- Estado y plan: [`docs/PROGRESS.md`](docs/PROGRESS.md) · [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Despliegue (Firebase + Cloudflare, secrets): [`docs/DEPLOY.md`](docs/DEPLOY.md) · Novedades: `changelog.html` en la web
- Arquitectura y reglas: [`CLAUDE.md`](CLAUDE.md) · decisiones en [`docs/decisions/`](docs/decisions/)

```sh
npm ci
npm test && npm run typecheck
npm run build:data:fixtures   # sin red → dist/news.json
```
