// HTML string templates. Pure: no DOM access, so they are unit-tested in Node.
// Every piece of feed text goes through `esc`; URLs are restricted to http(s).
import { CATEGORIES, CATEGORY_IDS, REGIONS, type CategoryId, type RegionId, type Snapshot, type Source } from '../../../contract/news.ts';
import { REGIONS_BY_NAME, type Entry, type Filters, type SourceGroup } from '../domain/filters.ts';
import { clockTime, relativeTime } from '../domain/time.ts';
import type { EmergencyAlert, Mode, View } from '../domain/view.ts';

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

/** Every community, so the list is stable; the count is what choosing it would show. */
export function regionOptions(counts: Map<RegionId, number>, selected: Filters['reg']): string {
  let html = option('', 'Zona: toda España', !selected);
  for (const id of REGIONS_BY_NAME) html += option(id, `${REGIONS[id]} (${counts.get(id) ?? 0})`, id === selected);
  return html;
}

/** The first option of each group selects the whole group. Sources in `down` are marked as not updating. */
export function sourceOptions(groups: SourceGroup[], counts: Map<string, number>, selected: string, down: ReadonlySet<string> = new Set()): string {
  let html = option('', 'Entidad: todas', !selected);
  for (const g of groups) {
    const k = `k:${g.kind}`;
    html += `<optgroup label="${esc(g.label)}">${option(k, `${g.label} (${counts.get(k) ?? 0})`, k === selected)}`;
    for (const s of g.sources) {
      const v = `s:${s.id}`;
      html += option(v, `${s.name} (${counts.get(v) ?? 0})${down.has(s.id) ? ' · caída' : ''}`, v === selected);
    }
    html += '</optgroup>';
  }
  return html;
}

/** Visual weight by category: emergencies stand out, supplies and weather are highlighted. */
const tone = (c: CategoryId) => (c === 'emergency' ? ' class="e"' : c === 'utilities' || c === 'weather' ? ' class="w"' : '');

/** With `share`, each news item gets a button whose `data-i` is its index in `entries`. */
export function itemsHtml(entries: Entry[], now: number, share = false): string {
  let html = '';
  for (const [i, { item, source, region }] of entries.entries()) {
    const url = safeUrl(item.url);
    const title = url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(item.title)}</a>` : esc(item.title);
    const when = new Date(item.publishedAt * 1000).toISOString();
    html +=
      `<article${tone(item.category)}><h2>${title}</h2>` +
      (item.summary ? `<p>${esc(item.summary)}</p>` : '') +
      `<p class="m"><b>${CATEGORIES[item.category]}</b> · ${esc(source.name)}${region ? ` · ${REGIONS[region]}` : ''} · ` +
      `<time datetime="${when}" title="${clockTime(item.publishedAt, now)}">${relativeTime(item.publishedAt, now)}</time>` +
      (share ? ` <button type="button" class="sh" data-i="${i}">Compartir</button>` : '') +
      '</p></article>';
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

/** `mirror`: the data came from the app's other host because this one failed. */
export function status(view: View | null, conn: Connection, busy: boolean, now: number, mode: Mode = 'all', mirror = false): StatusView {
  if (!view) {
    if (busy || conn === 'loading') return { text: 'Cargando noticias…', warn: false };
    return { text: 'No se pudieron cargar las noticias. Comprueba la conexión y pulsa Actualizar.', warn: true };
  }
  const { snap, restAt } = view;
  const at = `${clockTime(snap.generatedAt, now)} (${relativeTime(snap.generatedAt, now)})`;
  const prefix = mode === 'urgent' ? 'Solo urgentes. ' : '';
  // In "all" mode the rest of the news can lag behind the urgent ones (slow or failed download).
  const rest = restAt === undefined ? '' : restAt ? `. Resto: ${clockTime(restAt, now)}` : '. El resto aún no se ha cargado';
  if (busy) return { text: `${prefix}Actualizando… Datos de las ${at}${rest}`, warn: false };
  if (conn === 'offline') return { text: `${prefix}Sin conexión. Última copia: ${at}${rest}`, warn: true };
  const from = mirror ? ' (servidor alternativo)' : '';
  return { text: `${prefix}Datos de las ${at}${from}${rest}`, warn: mirror || now - snap.generatedAt > STALE_SECONDS || restAt !== undefined };
}

export function countText(shown: number, total: number, mode: Mode = 'all'): string {
  const noun = mode === 'urgent' ? (total === 1 ? 'noticia urgente' : 'noticias urgentes') : total === 1 ? 'noticia' : 'noticias';
  return shown === total ? `${total} ${noun}` : `${shown} de ${total} ${noun}`;
}

/** Inner HTML of the banner link (which itself filters by emergencies). */
export function alertHtml(a: EmergencyAlert, now: number): string {
  const more = a.count > 1 ? ` <span>(+${a.count - 1} más)</span>` : '';
  return `<b>Emergencia, ${relativeTime(a.latest.publishedAt, now)}:</b> ${esc(a.latest.title)}${more}`;
}

/** Sources whose last fetch failed in the build that produced `snap` (they show older items or none). */
export const downSources = (snap: Snapshot | null): Source[] => (snap ? snap.sources.filter((s) => s.lastOk < snap.generatedAt) : []);

export const downText = (n: number) => (n === 1 ? '1 fuente sin actualizar' : `${n} fuentes sin actualizar`);

export const modeButtonText = (mode: Mode) => (mode === 'urgent' ? 'Ver todas las noticias' : 'Solo urgentes (ahorra datos)');
