// HTTP headers for both hosts, defined once: firebase.json must match `firebaseConfig()` (a test checks it)
// and the web build writes `_headers` for Cloudflare Pages from the same rules.
// Paths never overlap for the same header name: Cloudflare merges every matching rule.

export interface HeaderRule {
  /** Exact path, or `**` for every path. Valid both as a Firebase glob and (mapped) as a Cloudflare rule. */
  path: string;
  headers: Record<string, string>;
}

/** CDN cache for documents that change on every deploy. Both hosts purge their CDN on deploy. */
export const CDN_SECONDS = 300;
const DOCUMENT = `public, max-age=0, s-maxage=${CDN_SECONDS}, must-revalidate`;
const STATIC = 'public, max-age=86400';

export const HEADER_RULES: HeaderRule[] = [
  { path: '**', headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } },
  ...['/', '/index.html', '/lite.html', '/estado.html', '/changelog.html', '/guia.html'].map((path) => ({ path, headers: { 'Cache-Control': DOCUMENT } })),
  // Public data that the app's other host reads when its own fails (mirror fallback, ADR 0010).
  ...['/news.json', '/news-urgent.json'].map((path) => ({ path, headers: { 'Cache-Control': DOCUMENT, 'Access-Control-Allow-Origin': '*' } })),
  // The browser must always revalidate the worker, or a new app version could take a day to arrive.
  { path: '/sw.js', headers: { 'Cache-Control': 'no-cache' } },
  { path: '/manifest.webmanifest', headers: { 'Cache-Control': STATIC } },
  { path: '/icon-*.png', headers: { 'Cache-Control': STATIC } },
];

export function firebaseConfig(rules: HeaderRule[] = HEADER_RULES) {
  return {
    hosting: {
      public: 'dist',
      ignore: ['_headers', '**/.*'],
      headers: rules.map((r) => ({
        source: r.path,
        headers: Object.entries(r.headers).map(([key, value]) => ({ key, value })),
      })),
    },
  };
}

/** Cloudflare Pages `_headers` file. */
export function cloudflareHeaders(rules: HeaderRule[] = HEADER_RULES): string {
  return rules
    .map((r) => [r.path === '**' ? '/*' : r.path, ...Object.entries(r.headers).map(([k, v]) => `  ${k}: ${v}`)].join('\n'))
    .join('\n\n') + '\n';
}
