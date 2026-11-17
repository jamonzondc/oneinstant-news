// guia.html ("Qué hacer en una emergencia"): static page, no JavaScript, styled with the app's CSS.
// The service worker stores it with the app shell, so it opens with no network.
import { esc } from '../ui/render.ts';
import { GUIDE_REVIEWED, PHONES, SECTIONS, SOURCES, type GuideSection, type GuideSource, type Phone } from './guide.ts';

/** Gzip budget: the worker downloads it on the first visit, possibly over 2G. */
export const GUIDE_BUDGET_GZIP_BYTES = 8 * 1024;

export interface GuideContent {
  reviewed: string;
  phones: Phone[];
  sections: GuideSection[];
  sources: GuideSource[];
}

export const GUIDE: GuideContent = { reviewed: GUIDE_REVIEWED, phones: PHONES, sections: SECTIONS, sources: SOURCES };

const day = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const list = (items: string[]) => `<ul>${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
const digits = (n: string) => n.replace(/\D/g, '');

function phonesHtml(phones: Phone[]): string {
  const rows = phones.map(
    (p) => `<li><a href="tel:${digits(p.number)}">${esc(p.number)}</a> ${esc(p.label)}${p.note ? `<span class="m">${esc(p.note)}</span>` : ''}</li>`,
  );
  return `<section id="telefonos"><h2>Teléfonos</h2><ul class="tel">${rows.join('')}</ul></section>`;
}

const sectionHtml = (s: GuideSection) =>
  `<section id="${esc(s.id)}"><h2>${esc(s.title)}</h2>${s.intro ? `<p><b>${esc(s.intro)}</b></p>` : ''}${list(s.steps)}</section>`;

const safeUrl = (u: string) => (/^https:\/\//i.test(u) ? u : '');

export function renderGuide(guide: GuideContent, css: string): string {
  const toc = [{ id: 'telefonos', title: 'Teléfonos' }, ...guide.sections, { id: 'fuentes', title: 'Fuentes' }]
    .map((s) => `<li><a href="#${esc(s.id)}">${esc(s.title)}</a></li>`)
    .join('');
  const sources = guide.sources
    .filter((s) => safeUrl(s.url))
    .map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.name)}</a></li>`)
    .join('');
  return (
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Qué hacer en una emergencia · OneInstant News</title><meta name="theme-color" content="#000000"><meta name="color-scheme" content="dark light">' +
    `<style>${css}</style><header><h1>Qué hacer en una emergencia</h1><a href="./">Volver a las noticias</a></header>` +
    `<main><p class="m">Esta página funciona sin conexión. Revisada el ${day.format(new Date(`${guide.reviewed}T00:00:00Z`))} con las fuentes oficiales del final.</p>` +
    `<nav aria-label="Contenido"><ul class="toc">${toc}</ul></nav>` +
    phonesHtml(guide.phones) +
    guide.sections.map(sectionHtml).join('') +
    `<section id="fuentes"><h2>Fuentes</h2><ul>${sources}</ul></section></main></html>`
  );
}
