// Composition root: wires the repository, the pure domain and the templates to the DOM.
// No timers or polling: data is refreshed on open, on returning to the app after a while, when the
// connection comes back, and with the button.
import type { Snapshot } from '../../contract/news.ts';
import { prefs, NewsRepository, type KeyValueStore } from './data/repository.ts';
import {
  categoryCounts, filterEntries, fromHash, groupSources, isEmpty, NO_FILTERS, sanitize, sourceCounts, toEntries, toHash,
  type Entry, type Filters,
} from './domain/filters.ts';
import { categoryOptions, countText, itemsHtml, sourceOptions, status, type Connection } from './ui/render.ts';

const REFRESH_AFTER_MS = 10 * 60_000;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const [statusEl, refreshBtn, form, catSel, srcSel, queryInput, countEl, clearBtn, list] = [
  $<HTMLParagraphElement>('st'), $<HTMLButtonElement>('r'), $<HTMLFormElement>('f'), $<HTMLSelectElement>('c'),
  $<HTMLSelectElement>('s'), $<HTMLInputElement>('q'), $<HTMLSpanElement>('nc'), $<HTMLButtonElement>('x'), $<HTMLElement>('l'),
];

function storage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const store = storage();
const repo = new NewsRepository((url, init) => fetch(url, init), store);
const saved = prefs(store);

let snap: Snapshot | null = repo.cached();
let entries: Entry[] = snap ? toEntries(snap) : [];
let conn: Connection = 'loading';
let busy = false;
let lastAttempt = 0;
let filters: Filters = location.hash.length > 1 ? fromHash(location.hash) : fromHash(saved.get('filters') ?? '');

const nowSec = () => Math.floor(Date.now() / 1000);

function renderStatus() {
  const s = status(snap, conn, busy, nowSec());
  statusEl.textContent = s.text;
  statusEl.classList.toggle('warn', s.warn);
  refreshBtn.disabled = busy;
}

function render() {
  renderStatus();
  if (!snap) return;
  const f = sanitize(filters, snap);
  catSel.innerHTML = categoryOptions(categoryCounts(entries, f), f.cat);
  srcSel.innerHTML = sourceOptions(groupSources(snap.sources), sourceCounts(entries, f), f.src);
  if (queryInput.value !== f.q) queryInput.value = f.q;
  const shown = filterEntries(entries, f);
  countEl.textContent = countText(shown.length, entries.length);
  clearBtn.hidden = isEmpty(f);
  list.innerHTML = shown.length
    ? itemsHtml(shown, nowSec())
    : '<p>Ninguna noticia con estos filtros.</p>';
}

function setFilters(next: Filters) {
  filters = next;
  const hash = toHash(next);
  history.replaceState(null, '', hash || location.pathname + location.search);
  saved.set('filters', hash);
  render();
}

async function refresh() {
  if (busy) return;
  busy = true;
  lastAttempt = Date.now();
  renderStatus();
  try {
    const next = await repo.refresh();
    conn = 'ok';
    // Same snapshot as on screen (typical 304): skip the re-render, keep scroll and battery.
    if (next.generatedAt !== snap?.generatedAt) {
      snap = next;
      entries = toEntries(next);
    }
  } catch {
    conn = 'offline';
  }
  busy = false;
  render();
}

const readForm = (): Filters => ({ cat: catSel.value as Filters['cat'], src: srcSel.value, q: queryInput.value });

form.addEventListener('submit', (e) => {
  e.preventDefault();
  queryInput.blur();
});
form.addEventListener('change', () => setFilters(readForm()));
queryInput.addEventListener('input', () => setFilters(readForm()));
clearBtn.addEventListener('click', () => setFilters(NO_FILTERS));
refreshBtn.addEventListener('click', () => void refresh());
addEventListener('hashchange', () => {
  filters = fromHash(location.hash);
  saved.set('filters', toHash(filters));
  render();
});
addEventListener('online', () => void refresh());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastAttempt > REFRESH_AFTER_MS) void refresh();
  else render(); // relative times ("hace 5 min") are only computed on render
});

render();
void refresh();

if ('serviceWorker' in navigator) {
  addEventListener('load', () => void navigator.serviceWorker.register('sw.js').catch(() => {}));
}
