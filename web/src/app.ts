// Composition root: wires the repositories, the pure domain and the templates to the DOM.
// No timers or polling: data is refreshed on open, on returning to the app after a while, when the
// connection comes back, and with the button. The small urgent file always goes first; the full file
// follows unless the network is slow (or the user chose urgent only).
import type { Snapshot } from '../../contract/news.ts';
import { FEEDS, prefs, NewsRepository, type Fetcher, type KeyValueStore } from './data/repository.ts';
import {
  categoryCounts, filterEntries, fromHash, groupSources, isEmpty, NO_FILTERS, regionCounts, sanitize, sourceCounts, toEntries, toHash,
  type Entry, type Filters,
} from './domain/filters.ts';
import { chooseMode, formatBytes, formatModePrefs, isSlow, parseModePrefs, transferredBytes, withChoice, type NetworkInfo } from './domain/network.ts';
import { currentView, emergencyAlert, type Mode, type View } from './domain/view.ts';
import {
  alertHtml, categoryOptions, countText, downSources, downText, itemsHtml, modeButtonText, regionOptions, sourceOptions, status,
  type Connection,
} from './ui/render.ts';

const REFRESH_AFTER_MS = 10 * 60_000;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const [banner, statusEl, refreshBtn, form, catSel, srcSel, regSel, queryInput, countEl, clearBtn, list, modeBtn, usageEl, healthLink] = [
  $<HTMLAnchorElement>('b'), $<HTMLParagraphElement>('st'), $<HTMLButtonElement>('r'), $<HTMLFormElement>('f'),
  $<HTMLSelectElement>('c'), $<HTMLSelectElement>('s'), $<HTMLSelectElement>('z'), $<HTMLInputElement>('q'),
  $<HTMLSpanElement>('nc'), $<HTMLButtonElement>('x'), $<HTMLElement>('l'), $<HTMLButtonElement>('m'), $<HTMLSpanElement>('d'),
  $<HTMLAnchorElement>('h'),
];

function storage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

type NetworkConnection = NetworkInfo & EventTarget;
const network = (navigator as Navigator & { connection?: NetworkConnection }).connection;

const store = storage();
const fetcher: Fetcher = (url, init) => fetch(url, init);
const fullRepo = new NewsRepository(fetcher, store, FEEDS.full);
const urgentRepo = new NewsRepository(fetcher, store, FEEDS.urgent);
const saved = prefs(store);

let full: Snapshot | null = fullRepo.cached();
let urgent: Snapshot | null = urgentRepo.cached();
let modePrefs = parseModePrefs(saved.get('mode'));
let mode: Mode = chooseMode(modePrefs, isSlow(network));
let view: View | null = null;
let viewKey = '';
let entries: Entry[] = [];
let conn: Connection = 'loading';
let busy = false;
let lastAttempt = 0;
let filters: Filters = location.hash.length > 1 ? fromHash(location.hash) : fromHash(saved.get('filters') ?? '');

const nowSec = () => Math.floor(Date.now() / 1000);

function renderStatus() {
  const s = status(view, conn, busy, nowSec(), mode);
  statusEl.textContent = s.text;
  statusEl.classList.toggle('warn', s.warn);
  refreshBtn.disabled = busy;
  // Real network bytes of this page: navigation plus every fetch; anything served from a cache counts 0.
  const timings = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')] as PerformanceResourceTiming[];
  const bytes = transferredBytes(timings);
  usageEl.textContent = bytes ? `${formatBytes(bytes)} usados · ` : '';
}

const keyOf = (v: View | null) => (v ? `${mode}|${v.snap.generatedAt}|${v.restAt}|${v.snap.items.length}` : '');

function render() {
  const now = nowSec();
  view = currentView(mode, full, urgent, now);
  viewKey = keyOf(view);
  entries = view ? toEntries(view.snap) : [];
  renderStatus();
  modeBtn.hidden = !view;
  modeBtn.textContent = modeButtonText(mode);
  modeBtn.className = mode === 'urgent' ? '' : 'lnk';
  if (!view) return;
  const alert = emergencyAlert(view.snap.items, now);
  banner.hidden = !alert;
  if (alert) banner.innerHTML = alertHtml(alert, now);
  const f = sanitize(filters, view.snap);
  // Source health comes from the newest file: the build that wrote it knows which sources answered.
  const latest = !full || (urgent && urgent.generatedAt > full.generatedAt) ? urgent : full;
  const down = downSources(latest);
  healthLink.hidden = !down.length;
  healthLink.textContent = downText(down.length);
  // With a community chosen, the entity list only offers national sources and that community's.
  const listed = view.snap.sources.filter((s) => !f.reg || !s.region || s.region === f.reg);
  catSel.innerHTML = categoryOptions(categoryCounts(entries, f), f.cat);
  srcSel.innerHTML = sourceOptions(groupSources(listed), sourceCounts(entries, f), f.src, new Set(down.map((s) => s.id)));
  regSel.innerHTML = regionOptions(regionCounts(entries, f), f.reg);
  if (queryInput.value !== f.q) queryInput.value = f.q;
  const shown = filterEntries(entries, f);
  countEl.textContent = countText(shown.length, entries.length, mode);
  clearBtn.hidden = isEmpty(f);
  list.innerHTML = shown.length
    ? itemsHtml(shown, now)
    : '<p>Ninguna noticia con estos filtros.</p>';
}

/** Re-renders only if what is on screen would change (an unchanged file is the typical 304): keeps scroll and battery. */
function update() {
  if (keyOf(currentView(mode, full, urgent, nowSec())) === viewKey) renderStatus();
  else render();
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
  let reached = false;
  try {
    urgent = await urgentRepo.refresh();
    reached = true;
  } catch {
    // The full file may still answer (e.g. an older deploy without the urgent file).
  }
  if (mode === 'all') {
    update(); // urgent headlines on screen while the full file downloads
    try {
      full = await fullRepo.refresh();
      reached = true;
    } catch {
      // keep the urgent copy; the status shows the rest is older
    }
  }
  conn = reached ? 'ok' : 'offline';
  busy = false;
  update();
}

function setMode(next: Mode) {
  mode = next;
  render();
  if (mode === 'all') void refresh();
}

const readForm = (): Filters => ({
  cat: catSel.value as Filters['cat'], src: srcSel.value, q: queryInput.value, reg: regSel.value as Filters['reg'],
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  queryInput.blur();
});
form.addEventListener('change', () => setFilters(readForm()));
queryInput.addEventListener('input', () => setFilters(readForm()));
clearBtn.addEventListener('click', () => setFilters(NO_FILTERS));
refreshBtn.addEventListener('click', () => void refresh());
modeBtn.addEventListener('click', () => {
  const next: Mode = mode === 'urgent' ? 'all' : 'urgent';
  modePrefs = withChoice(modePrefs, isSlow(network), next);
  saved.set('mode', formatModePrefs(modePrefs));
  setMode(next);
});
addEventListener('hashchange', () => {
  filters = fromHash(location.hash);
  saved.set('filters', toHash(filters));
  render();
});
addEventListener('online', () => void refresh());
network?.addEventListener('change', () => {
  const next = chooseMode(modePrefs, isSlow(network));
  if (next !== mode) setMode(next);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastAttempt > REFRESH_AFTER_MS) void refresh();
  else render(); // relative times ("hace 5 min") are only computed on render
});

render();
// The worker installs after the first refresh: on a 2G first visit its shell download must not compete with the news.
void refresh().finally(() => {
  if ('serviceWorker' in navigator) void navigator.serviceWorker.register('sw.js').catch(() => {});
});
