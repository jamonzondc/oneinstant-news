// changelog.html ("Novedades"): static page, no JavaScript, styled with the app's CSS.
import { esc } from '../ui/render.ts';
import type { Release } from './releases.ts';

const day = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });

function releaseHtml(r: Release): string {
  const date = day.format(new Date(`${r.date}T00:00:00Z`));
  return (
    `<section id="v${esc(r.version)}"><h2>${esc(r.version)} · ${esc(r.title)}</h2>` +
    `<p class="m"><time datetime="${esc(r.date)}">${date}</time></p>` +
    `<ul>${r.changes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></section>`
  );
}

export function renderChangelog(releases: Release[], css: string): string {
  return (
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Novedades · OneInstant News</title><meta name="theme-color" content="#0d0f1e"><meta name="color-scheme" content="dark light">' +
    `<style>${css}</style><header><h1>Novedades</h1><a href="./">Volver a las noticias</a></header>` +
    `<main>${releases.map(releaseHtml).join('')}</main></html>`
  );
}
