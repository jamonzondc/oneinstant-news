// Service worker: cache-first app shell. news.json is NOT intercepted: it goes through the browser's
// HTTP cache (revalidation, 304) and the app keeps its own last copy in localStorage.
// SHELL_VERSION is a hash of the shell files injected at build time, so the worker (and its cache)
// only changes when the app changes, never when the news do.
declare const self: ServiceWorkerGlobalScope;
declare const SHELL_VERSION: string;

const CACHE = `shell-${SHELL_VERSION}`;
const SHELL = ['./', 'changelog.html', 'guia.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const scope = new URL(self.registration.scope);
const shellUrls = new Set(SHELL.map((p) => new URL(p, scope).href));
const indexUrl = new URL('./', scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // `reload` bypasses the HTTP cache so a new version never stores a stale copy.
      .then((cache) => cache.addAll(SHELL.map((p) => new Request(new URL(p, scope), { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  url.hash = '';
  url.search = '';
  const isIndex = req.mode === 'navigate' && (url.href === indexUrl || url.href === `${indexUrl}index.html`);
  const key = isIndex ? indexUrl : url.href;
  if (!isIndex && !shellUrls.has(key)) return;
  event.respondWith(caches.match(key, { cacheName: CACHE }).then((hit) => hit ?? fetch(req)));
});
