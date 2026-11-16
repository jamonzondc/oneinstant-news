// lite.html: the same snapshot as static HTML, no JavaScript, grouped by category with anchors.
// For browsers without JS, very old phones or when the app shell fails to load.
import { CATEGORIES, CATEGORY_IDS, itemRegion, REGIONS, type CategoryId, type NewsItem, type Snapshot, type Source } from '../../../contract/news.ts';

export const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]!);
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : '');

// The build runs in UTC (GitHub Actions); readers expect Spanish peninsular time.
const hm = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });
const dayHm = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const CSS =
  'body{margin:0 auto;max-width:44rem;padding:.5rem .75rem 2rem;background:#000;color:#e8e8e8;font:1rem/1.4 system-ui,sans-serif}' +
  'a{color:#8cb4ff}h1{font-size:1.15rem}h2{font-size:1.05rem;margin:1.5rem 0 .25rem}ul{padding-left:1.1rem}li{margin:.5rem 0}' +
  'small{color:#a0a0a0}nav a{display:inline-block;margin:.15rem 0}body{overflow-wrap:anywhere}' +
  '@supports (font:-apple-system-body) and (-webkit-touch-callout:none){html{font:-apple-system-body}}' +
  '@media(prefers-color-scheme:light){body{background:#fff;color:#111}a{color:#0645ad}small{color:#595959}}';

function itemHtml(it: NewsItem, source: Source): string {
  const region = itemRegion(it, source);
  const url = safeUrl(it.url);
  const title = url ? `<a href="${esc(url)}">${esc(it.title)}</a>` : esc(it.title);
  const summary = it.summary ? ` — ${esc(it.summary)}` : '';
  return `<li>${title}${summary} <small>${esc(source.name)}${region ? ` · ${REGIONS[region]}` : ''} · ${dayHm.format(it.publishedAt * 1000)}</small></li>`;
}

export function renderLite(snap: Snapshot): string {
  const names = new Map(snap.sources.map((s) => [s.id, s]));
  const groups = new Map<CategoryId, NewsItem[]>();
  for (const it of snap.items) {
    if (!names.has(it.sourceId)) continue;
    const list = groups.get(it.category) ?? [];
    list.push(it);
    groups.set(it.category, list);
  }
  const cats = CATEGORY_IDS.filter((c) => groups.has(c));
  const nav = cats.map((c) => `<a href="#${c}">${CATEGORIES[c]} (${groups.get(c)!.length})</a>`).join(' · ');
  const sections = cats
    .map((c) => `<h2 id="${c}">${CATEGORIES[c]}</h2><ul>${groups.get(c)!.map((it) => itemHtml(it, names.get(it.sourceId)!)).join('')}</ul><p><a href="#top">Subir</a></p>`)
    .join('');
  return (
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>OneInstant News (ligera)</title><meta name="theme-color" content="#000000"><meta name="color-scheme" content="dark light">' +
    `<style>${CSS}</style><h1 id="top">OneInstant News</h1>` +
    `<p>Datos de las ${hm.format(snap.generatedAt * 1000)} (hora peninsular) · <a href="./">Versión completa</a> · <a href="estado.html">Estado de las fuentes</a></p>` +
    `<nav>${nav || 'No hay noticias.'}</nav>${sections}</html>`
  );
}
