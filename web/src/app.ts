// Composition root: wires the repositories, the pure domain and the templates to the DOM.
// No timers or polling: data is refreshed on open, on returning to the app after a while, when the
// connection comes back, and with the button. The small urgent file always goes first; the full file
// follows unless the network is slow (or the user chose urgent only).
import type { Snapshot } from '../../contract/news.ts';
import { Origins } from './data/origins.ts';
import { FEEDS, prefs, NewsRepository, type Fetcher, type KeyValueStore } from './data/repository.ts';
import {
  categoryCounts, filterEntries, fromHash, groupSources, isEmpty, NO_FILTERS, regionCounts, sanitize, sourceCounts, toEntries, toHash,
  type Entry, type Filters,
} from './domain/filters.ts';
import { chooseMode, formatBytes, formatModePrefs, isSlow, parseModePrefs, transferredBytes, withChoice, type NetworkInfo } from './domain/network.ts';
import { page, PAGE_SIZE, type Page } from './domain/paging.ts';
import { advanceSeen, countNew, parseSeen } from './domain/seen.ts';
import { plainText, shareContent } from './domain/share.ts';
import { currentView, emergencyAlert, type Mode, type View } from './domain/view.ts';
import {
  alertHtml, categoryOptions, countText, downSources, downText, itemsHtml, modeButtonText, moreText, regionOptions, sourceOptions, status,
  type Connection,
} from './ui/render.ts';

/** Other hosts of this same app (build-time `MIRRORS`), for when this one fails. */
declare const MIRRORS: readonly string[];

const REFRESH_AFTER_MS = 10 * 60_000;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const [banner, statusEl, refreshBtn, form, catSel, srcSel, regSel, queryInput, countEl, clearBtn, list, modeBtn, usageEl, healthLink] = [
  $<HTMLAnchorElement>('b'), $<HTMLParagraphElement>('st'), $<HTMLButtonElement>('r'), $<HTMLFormElement>('f'),
  $<HTMLSelectElement>('c'), $<HTMLSelectElement>('s'), $<HTMLSelectElement>('z'), $<HTMLInputElement>('q'),
  $<HTMLSpanElement>('nc'), $<HTMLButtonElement>('x'), $<HTMLElement>('l'), $<HTMLButtonElement>('m'), $<HTMLSpanElement>('d'),
  $<HTMLAnchorElement>('h'),
];
const [skipLink, announcer, textBtn, mirrorLink, mirrorFooter, upBtn, moreBtn] = [
  $<HTMLAnchorElement>('sk'), $<HTMLParagraphElement>('an'), $<HTMLButtonElement>('t'), $<HTMLAnchorElement>('mi'), $<HTMLSpanElement>('mf'),
  $<HTMLButtonElement>('up'), $<HTMLButtonElement>('mo'),
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
const origins = new Origins(location.origin, MIRRORS);
const fullRepo = new NewsRepository(fetcher, store, FEEDS.full, origins);
const urgentRepo = new NewsRepository(fetcher, store, FEEDS.urgent, origins);
const saved = prefs(store);
// Web Share where available (phones); otherwise the clipboard; otherwise no share buttons.
const canShare = typeof navigator.share === 'function' || typeof navigator.clipboard?.writeText === 'function';

let full: Snapshot | null = fullRepo.cached();
let urgent: Snapshot | null = urgentRepo.cached();
let modePrefs = parseModePrefs(saved.get('mode'));
let mode: Mode = chooseMode(modePrefs, isSlow(network));
let view: View | null = null;
let viewKey = '';
let entries: Entry[] = [];
let shown: Entry[] = [];
/** How many of `shown` the reader asked to see: one block, plus one per "Ver más". New filters start over. */
let limit = PAGE_SIZE;
let announced = '';
let conn: Connection = 'loading';
let busy = false;
let lastAttempt = 0;
// Watermark of what has been on screen (stored) and the previous visit's one, which flags items as new.
let seen = parseSeen(saved.get('seen'));
let since = seen;
let filters: Filters = location.hash.length > 1 ? fromHash(location.hash) : fromHash(saved.get('filters') ?? '');

const nowSec = () => Math.floor(Date.now() / 1000);

function renderStatus() {
  const s = status(view, conn, busy, nowSec(), mode, origins.usingMirror);
  statusEl.textContent = s.text;
  statusEl.classList.toggle('warn', s.warn);
  refreshBtn.disabled = busy;
  list.setAttribute('aria-busy', String(busy && !view));
  mirrorLink.hidden = conn !== 'offline' || !origins.mirror;
  // Real network bytes of this page: navigation plus every fetch; anything served from a cache counts 0.
  const timings = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')] as PerformanceResourceTiming[];
  const bytes = transferredBytes(timings);
  usageEl.textContent = bytes ? `${formatBytes(bytes)} usados · ` : '';
}

// Source health comes from the newest file: the build that wrote it knows which sources answered.
const latestFile = () => (!full || (urgent && urgent.generatedAt > full.generatedAt) ? urgent : full);
const keyOf = (v: View | null) =>
  v ? `${mode}|${v.snap.generatedAt}|${v.restAt}|${v.snap.items.length}|${downSources(latestFile()).map((s) => s.id)}|${since}` : '';

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
  const next = advanceSeen(seen, view.snap.items, now);
  if (next !== seen) saved.set('seen', String((seen = next)));
  const alert = emergencyAlert(view.snap.items, now);
  banner.hidden = !alert;
  if (alert) banner.innerHTML = alertHtml(alert, now);
  // Screen readers hear each new emergency once, not on every repaint of the banner.
  const latest = alert ? `${alert.latest.publishedAt}|${alert.latest.title}` : '';
  if (latest && latest !== announced) announcer.textContent = `Emergencia: ${alert!.latest.title}`;
  announced = latest || announced;
  const f = sanitize(filters, view.snap);
  const down = downSources(latestFile());
  healthLink.hidden = !down.length;
  healthLink.textContent = downText(down.length);
  // With a community chosen, the entity list only offers national sources and that community's.
  const listed = view.snap.sources.filter((s) => !f.reg || !s.region || s.region === f.reg);
  catSel.innerHTML = categoryOptions(categoryCounts(entries, f), f.cat);
  srcSel.innerHTML = sourceOptions(groupSources(listed), sourceCounts(entries, f), f.src, new Set(down.map((s) => s.id)));
  regSel.innerHTML = regionOptions(regionCounts(entries, f), f.reg);
  if (queryInput.value !== f.q) queryInput.value = f.q;
  shown = filterEntries(entries, f);
  countEl.textContent = countText(shown.length, entries.length, mode, countNew(shown, since));
  clearBtn.hidden = isEmpty(f);
  const p = page(shown.length, limit);
  list.innerHTML = shown.length
    ? itemsHtml(shown.slice(0, p.end), now, { share: canShare, since })
    : '<p>Ninguna noticia con estos filtros.</p>';
  showMore(p);
}

function showMore(p: Page) {
  moreBtn.hidden = !p.left;
  moreBtn.textContent = moreText(p);
}

/** Re-renders only if what is on screen would change (an unchanged file is the typical 304): keeps scroll and battery. */
function update() {
  if (keyOf(currentView(mode, full, urgent, nowSec())) === viewKey) renderStatus();
  else render();
}

function setFilters(next: Filters) {
  filters = next;
  limit = PAGE_SIZE;
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
  limit = PAGE_SIZE;
  render();
  if (mode === 'all') void refresh();
}

async function share(button: HTMLButtonElement) {
  const entry = shown[Number(button.dataset.i)];
  if (!entry) return;
  const content = shareContent(entry);
  try {
    if (typeof navigator.share === 'function') await navigator.share(content);
    else {
      await navigator.clipboard.writeText(plainText(content));
      button.textContent = 'Copiado';
    }
  } catch {
    // Share sheet dismissed, or clipboard denied: nothing to do.
  }
}

function setBigText(on: boolean) {
  document.documentElement.classList.toggle('big', on);
  textBtn.setAttribute('aria-pressed', String(on));
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
list.addEventListener('click', (e) => {
  const target = e.target as Element;
  const button = target.closest<HTMLButtonElement>('button.sh');
  if (button) void share(button);
  // Tapping a type label filters by it; back to the top, where the filters show it.
  const type = target.closest<HTMLButtonElement>('button.k')?.dataset.c;
  if (type) {
    setFilters({ ...filters, cat: type as Filters['cat'] });
    scrollTo(0, 0);
  }
});
// "Ver más" appends the next block without repainting the rest, and moves focus to its first item.
moreBtn.addEventListener('click', () => {
  const from = page(shown.length, limit).end;
  limit = from + PAGE_SIZE;
  const p = page(shown.length, limit);
  list.insertAdjacentHTML('beforeend', itemsHtml(shown.slice(from, p.end), nowSec(), { share: canShare, since, start: from }));
  showMore(p);
  list.children[from]?.querySelector<HTMLElement>('a, button')?.focus();
});
// The "back to top" button only shows while the header is off screen: an observer, no scroll handler or timers.
new IntersectionObserver(([e]) => (upBtn.hidden = !!e?.isIntersecting)).observe(document.querySelector('header')!);
upBtn.addEventListener('click', () => {
  scrollTo(0, 0);
  document.querySelector('h1')!.focus();
});
// The skip link must not touch the hash: it holds the filters.
skipLink.addEventListener('click', (e) => {
  e.preventDefault();
  list.focus();
});
textBtn.addEventListener('click', () => {
  const on = textBtn.getAttribute('aria-pressed') !== 'true';
  setBigText(on);
  saved.set('text', on ? 'big' : '');
});
modeBtn.addEventListener('click', () => {
  const next: Mode = mode === 'urgent' ? 'all' : 'urgent';
  modePrefs = withChoice(modePrefs, isSlow(network), next);
  saved.set('mode', formatModePrefs(modePrefs));
  setMode(next);
});
addEventListener('hashchange', () => {
  filters = fromHash(location.hash);
  limit = PAGE_SIZE;
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
  if (Date.now() - lastAttempt > REFRESH_AFTER_MS) {
    since = seen; // back after a while: a new visit, so what was on screen is no longer new
    render();
    void refresh();
  } else render(); // relative times ("hace 5 min") are only computed on render
});

setBigText(saved.get('text') === 'big');
if (origins.mirror) {
  mirrorLink.href = `${origins.mirror}/`;
  mirrorFooter.hidden = false;
  mirrorFooter.querySelector('a')!.href = `${origins.mirror}/`;
}
render();
// The worker installs after the first refresh: on a 2G first visit its shell download must not compete with the news.
void refresh().finally(() => {
  if ('serviceWorker' in navigator) void navigator.serviceWorker.register('sw.js').catch(() => {});
});
