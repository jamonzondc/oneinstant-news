// HTML string templates. Pure: no DOM access, so they are unit-tested in Node.
// Every piece of feed text goes through `esc`; URLs are restricted to http(s).
import { CATEGORIES, CATEGORY_IDS, type CategoryId, type Snapshot } from '../../../contract/news.ts';
import type { Entry, Filters, SourceGroup } from '../domain/filters.ts';
import { clockTime, relativeTime } from '../domain/time.ts';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]!);

const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : '');

const option = (value: string, label: string, selected: boolean) =>
  `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;

/** Categories with results (plus the selected one, even at zero, so the select reflects the state).
 * The "all" options carry no count: the list header already shows it and labels must fit half a phone width. */
export function categoryOptions(counts: Map<CategoryId, number>, selected: Filters['cat']): string {
  let html = option('', 'Tipo: todos', !selected);
  for (const id of CATEGORY_IDS) {
    const n = counts.get(id) ?? 0;
    if (n || id === selected) html += option(id, `${CATEGORIES[id]} (${n})`, id === selected);
  }
  return html;
}

/** The first option of each group selects the whole group. */
export function sourceOptions(groups: SourceGroup[], counts: Map<string, number>, selected: string): string {
  let html = option('', 'Entidad: todas', !selected);
  for (const g of groups) {
    const k = `k:${g.kind}`;
    html += `<optgroup label="${esc(g.label)}">${option(k, `${g.label} (${counts.get(k) ?? 0})`, k === selected)}`;
    for (const s of g.sources) {
      const v = `s:${s.id}`;
      html += option(v, `${s.name} (${counts.get(v) ?? 0})`, v === selected);
    }
    html += '</optgroup>';
  }
  return html;
}

/** Visual weight by category: emergencies stand out, supplies and weather are highlighted. */
const tone = (c: CategoryId) => (c === 'emergency' ? ' class="e"' : c === 'utilities' || c === 'weather' ? ' class="w"' : '');

export function itemsHtml(entries: Entry[], now: number): string {
  let html = '';
  for (const { item, source } of entries) {
    const url = safeUrl(item.url);
    const title = url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(item.title)}</a>` : esc(item.title);
    const when = new Date(item.publishedAt * 1000).toISOString();
    html +=
      `<article${tone(item.category)}><h2>${title}</h2>` +
      (item.summary ? `<p>${esc(item.summary)}</p>` : '') +
      `<p class="m"><b>${CATEGORIES[item.category]}</b> · ${esc(source.name)} · ` +
      `<time datetime="${when}" title="${clockTime(item.publishedAt, now)}">${relativeTime(item.publishedAt, now)}</time></p></article>`;
  }
  return html;
}

export type Connection = 'loading' | 'ok' | 'offline';

export interface StatusView {
  text: string;
  warn: boolean;
}

/** Data older than this means the publisher stopped updating: worth flagging even when online. */
const STALE_SECONDS = 3600;

export function status(snap: Snapshot | null, conn: Connection, busy: boolean, now: number): StatusView {
  if (!snap) {
    if (busy || conn === 'loading') return { text: 'Cargando noticias…', warn: false };
    return { text: 'No se pudieron cargar las noticias. Comprueba la conexión y pulsa Actualizar.', warn: true };
  }
  const at = `${clockTime(snap.generatedAt, now)} (${relativeTime(snap.generatedAt, now)})`;
  if (busy) return { text: `Actualizando… Datos de las ${at}`, warn: false };
  if (conn === 'offline') return { text: `Sin conexión. Última copia: ${at}`, warn: true };
  return { text: `Datos de las ${at}`, warn: now - snap.generatedAt > STALE_SECONDS };
}

export function countText(shown: number, total: number): string {
  if (shown === total) return `${total} noticias`;
  return `${shown} de ${total} noticias`;
}
