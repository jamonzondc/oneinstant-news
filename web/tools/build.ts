// Web build: bundles the app with esbuild and inlines JS + CSS into a single index.html (one request),
// then emits the service worker, the manifest and the icons.
// Usage: node web/tools/build.ts [--out dist]
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { build, transform } from 'esbuild';
import { iconPng } from './icon.ts';

/** index.html size budget, gzip (ADR 0001). */
export const INDEX_BUDGET_GZIP_BYTES = 12 * 1024;

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const SW = fileURLToPath(new URL('../sw/sw.ts', import.meta.url));
const TARGET = ['es2022', 'safari15', 'chrome100', 'firefox100'];

async function bundle(entry: string, define: Record<string, string> = {}): Promise<string> {
  const out = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'iife',
    target: TARGET,
    define,
    write: false,
    legalComments: 'none',
  });
  return out.outputFiles[0]!.text.trim();
}

const MANIFEST = {
  name: 'OneInstant News',
  short_name: 'OneInstant',
  description: 'Noticias en texto para emergencias.',
  lang: 'es',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#000000',
  theme_color: '#000000',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
};

export interface WebBuildResult {
  indexBytes: number;
  indexGzipBytes: number;
  version: string;
}

export async function buildWeb(outDir: string): Promise<WebBuildResult> {
  const [template, css, js] = await Promise.all([
    readFile(resolve(SRC, 'index.html'), 'utf8'),
    readFile(resolve(SRC, 'ui/styles.css'), 'utf8').then((c) => transform(c, { loader: 'css', minify: true, target: TARGET })),
    bundle(resolve(SRC, 'app.ts')),
  ]);
  const favicon = `data:image/png;base64,${iconPng(32).toString('base64')}`;
  const html = template
    .replace(/>\s*\n\s*</g, '><')
    .replace('__FAVICON__', favicon)
    .replace('__CSS__', () => css.code.trim())
    .replace('__JS__', () => js.replaceAll('</script', '<\\/script'));

  const files: Record<string, string | Buffer> = {
    'index.html': html,
    'manifest.webmanifest': JSON.stringify(MANIFEST),
    'icon-180.png': iconPng(180),
    'icon-192.png': iconPng(192),
    'icon-512.png': iconPng(512),
  };
  const hash = createHash('sha256');
  for (const name of Object.keys(files).sort()) hash.update(name).update(files[name]!);
  const version = hash.digest('hex').slice(0, 12);
  files['sw.js'] = await bundle(SW, { SHELL_VERSION: JSON.stringify(version) });

  await mkdir(outDir, { recursive: true });
  await Promise.all(Object.entries(files).map(([name, data]) => writeFile(resolve(outDir, name), data)));
  return { indexBytes: Buffer.byteLength(html), indexGzipBytes: gzipSync(html, { level: 9 }).length, version };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { out: { type: 'string', default: 'dist' } } });
  const r = await buildWeb(resolve(values.out));
  console.log(`→ index.html ${(r.indexBytes / 1024).toFixed(1)} KB (${(r.indexGzipBytes / 1024).toFixed(1)} KB gzip), shell ${r.version}`);
  if (r.indexGzipBytes > INDEX_BUDGET_GZIP_BYTES) {
    console.error(`! index.html exceeds the ${INDEX_BUDGET_GZIP_BYTES / 1024} KB gzip budget`);
    process.exitCode = 1;
  }
}
