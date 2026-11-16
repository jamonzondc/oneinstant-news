// Tiny static server for local preview and e2e tests. Not used in production (Firebase/Cloudflare serve dist/).
// Usage: node web/tools/serve.ts [--dir dist] [--port 8080]
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

/** `overrides` maps a URL path to in-memory content (e.g. a generated /news.json in tests). */
export function serve(dir: string, port = 0, overrides = new Map<string, string>()): Promise<Server> {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    const rel = normalize(path === '/' ? '/index.html' : path);
    try {
      const body = overrides.get(rel) ?? (await readFile(join(root, rel)));
      const type = TYPES[extname(rel)] ?? 'application/octet-stream';
      // Like the real hosts: text is compressed, so throttled e2e runs see production-like sizes.
      const gzip = /gzip/.test(String(req.headers['accept-encoding'])) && !type.startsWith('image/');
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache', ...(gzip && { 'content-encoding': 'gzip' }) });
      res.end(gzip ? gzipSync(body) : body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { dir: { type: 'string', default: 'dist' }, port: { type: 'string', default: '8080' } } });
  await serve(values.dir, Number(values.port));
  console.log(`Serving ${values.dir} on http://localhost:${values.port}`);
}
