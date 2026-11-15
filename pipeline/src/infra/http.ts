import { readFile } from 'node:fs/promises';

export interface HttpResponse {
  bytes: Uint8Array;
  contentType: string;
}

export interface HttpClient {
  get(url: string): Promise<HttpResponse>;
}

const UA = 'Mozilla/5.0 (compatible; OneInstantNews/1.0; feed reader)';
const ACCEPT = 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.8, */*;q=0.5';

/** fetch with timeout and one retry; `file:` URLs are read from disk (fixtures). */
export class FetchHttpClient implements HttpClient {
  readonly timeoutMs: number;
  readonly retries: number;

  constructor({ timeoutMs = 15_000, retries = 1 } = {}) {
    this.timeoutMs = timeoutMs;
    this.retries = retries;
  }

  async get(url: string): Promise<HttpResponse> {
    if (url.startsWith('file:')) return { bytes: await readFile(new URL(url)), contentType: '' };
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { 'user-agent': UA, accept: ACCEPT },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? '' };
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }
}

/** Honours the declared encoding: many Spanish feeds are still ISO-8859-1. */
export function decodeBody({ bytes, contentType }: HttpResponse): string {
  const head = Buffer.from(bytes.subarray(0, 256)).toString('latin1');
  const encoding =
    /encoding=["']([\w-]+)["']/i.exec(head)?.[1] ??
    /charset=([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ??
    'utf-8';
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
