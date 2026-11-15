// Minimal RSS 2.0 / RDF / Atom parser. Regexes are scoped to each <item>/<entry>, which is enough for news feeds.
import { decodeBody, type HttpClient } from '../infra/http.ts';
import { decodeEntities, xmlText } from '../domain/text.ts';
import type { RssSource } from '../sources/types.ts';
import type { RawItem, SourceAdapter } from './source-adapter.ts';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function firstTag(block: string, names: string[]): string {
  for (const n of names) {
    const m = new RegExp(`<${escapeRe(n)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRe(n)}>`, 'i').exec(block);
    if (m?.[1]?.trim()) return m[1];
  }
  return '';
}

function attributes(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out[m[1]!.toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? '');
  }
  return out;
}

const isHttp = (s: string) => /^https?:\/\//i.test(s);

function link(block: string): string {
  const rss = xmlText(firstTag(block, ['link']));
  if (isHttp(rss)) return rss;
  let fallback = '';
  for (const m of block.matchAll(/<link\b([^>]*?)\/?>/gi)) {
    const a = attributes(m[1] ?? '');
    if (!a.href) continue;
    if (!a.rel || a.rel === 'alternate') return a.href;
    fallback ||= a.href;
  }
  if (fallback) return fallback;
  const guid = /<guid\b([^>]*)>([\s\S]*?)<\/guid>/i.exec(block);
  if (guid && !/ispermalink\s*=\s*["']false/i.test(guid[1] ?? '')) {
    const g = xmlText(guid[2] ?? '');
    if (isHttp(g)) return g;
  }
  return '';
}

export function parseFeed(xml: string): RawItem[] {
  const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)];
  const blocks = items.length ? items : [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)];
  return blocks.map(([, b = '']) => ({
    title: xmlText(firstTag(b, ['title'])),
    summary: xmlText(firstTag(b, ['description', 'summary', 'content:encoded', 'content'])),
    url: link(b),
    publishedAt: Date.parse(xmlText(firstTag(b, ['pubDate', 'published', 'updated', 'dc:date']))),
  }));
}

export class RssAdapter implements SourceAdapter<RssSource> {
  async read(source: RssSource, http: HttpClient): Promise<RawItem[]> {
    return parseFeed(decodeBody(await http.get(source.url)));
  }
}
