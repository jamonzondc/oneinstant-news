// Usage: node pipeline/src/cli.ts [--sources production|fixtures] [--out dist]
// Env: PREVIOUS_URL=https://<site>/news.json  -> failing sources reuse their last published items.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { decodeSnapshot, encodeSnapshot, type Snapshot } from '../../contract/news.ts';
import { buildSnapshot } from './build.ts';
import { decodeBody, FetchHttpClient } from './infra/http.ts';
import { FIXTURE_SOURCES } from './sources/fixtures.ts';
import { SOURCES } from './sources/index.ts';

/** news.json size budget, gzip (ADR 0002). */
const BUDGET_GZIP_BYTES = 30 * 1024;

const { values: args } = parseArgs({
  options: { sources: { type: 'string', default: 'production' }, out: { type: 'string', default: 'dist' } },
});

const http = new FetchHttpClient();

async function loadPrevious(url: string | undefined): Promise<Snapshot | null> {
  if (!url) return null;
  try {
    return decodeSnapshot(JSON.parse(decodeBody(await http.get(url))));
  } catch (e) {
    console.warn(`! previous snapshot unavailable: ${(e as Error).message}`);
    return null;
  }
}

const sources = args.sources === 'fixtures' ? FIXTURE_SOURCES : SOURCES;
const { snapshot, report } = await buildSnapshot({ sources, http, previous: await loadPrevious(process.env.PREVIOUS_URL) });

for (const r of report) {
  const extra = r.ok ? '' : ` ${r.error}${r.reused ? ` (reused ${r.reused} previous items)` : ''}`;
  console.log(`${r.ok ? '✓' : '✗'} ${r.id.padEnd(16)} ${String(r.items).padStart(3)}${extra}`);
}

const okCount = report.filter((r) => r.ok).length;
if (okCount === 0) {
  console.error('No source responded: refusing to publish an empty site.');
  process.exit(1);
}

const json = JSON.stringify(encodeSnapshot(snapshot));
const gz = gzipSync(json, { level: 9 }).length;
const out = resolve(args.out);
await mkdir(out, { recursive: true });
await writeFile(resolve(out, 'news.json'), json);

console.log(`→ ${snapshot.items.length} items, ${okCount}/${report.length} sources OK, news.json ${(json.length / 1024).toFixed(1)} KB (${(gz / 1024).toFixed(1)} KB gzip)`);
if (gz > BUDGET_GZIP_BYTES) console.warn(`! news.json exceeds the ${BUDGET_GZIP_BYTES / 1024} KB gzip budget`);
