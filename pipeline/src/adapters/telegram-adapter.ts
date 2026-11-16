// Public web preview of a Telegram channel (https://t.me/s/<channel>): plain HTML, no account or API key (ADR 0006).
// Each post is a `tgme_widget_message` block with `data-post="<channel>/<id>"`, its text and a <time datetime>.
import { decodeBody, type HttpClient } from '../infra/http.ts';
import { htmlToText, splitHeadline } from '../domain/text.ts';
import type { TelegramSource } from '../sources/types.ts';
import type { RawItem, SourceAdapter } from './source-adapter.ts';

export const telegramUrl = (channel: string) => `https://t.me/s/${encodeURIComponent(channel)}`;

/** Inner HTML of the first <div> whose class list contains `cls`, balancing nested divs. */
function divByClass(html: string, cls: string): string {
  const open = new RegExp(`<div\\b[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`).exec(html);
  if (!open) return '';
  const start = open.index + open[0].length;
  let depth = 1;
  for (const m of html.slice(start).matchAll(/<(\/?)div\b[^>]*>/g)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, start + m.index);
  }
  return html.slice(start);
}

/** Emoji are images with the character inside <b>: keep the character, drop the markup. */
const postText = (html: string) => htmlToText(html.replace(/<i class="emoji"[^>]*>([\s\S]*?)<\/i>/g, '$1'));

export function parseTelegram(html: string): RawItem[] {
  const out: RawItem[] = [];
  // Split at each post; the first chunk is the page header.
  for (const block of html.split(/<div class="tgme_widget_message_wrap\b/).slice(1)) {
    const post = /data-post="([^"]+)"/.exec(block)?.[1];
    // `js-message_text` is the post itself; a quoted reply uses `js-message_reply_text`.
    const { title, summary } = splitHeadline(divByClass(block, 'js-message_text').split(/<br\s*\/?>/i).map(postText).filter(Boolean));
    if (!post || (!title && !summary)) continue; // photo/video without caption, polls, service messages
    const datetime = /<time\b[^>]*datetime="([^"]+)"/.exec(block)?.[1] ?? '';
    out.push({ title, summary, url: `https://t.me/${post}`, publishedAt: Date.parse(datetime) });
  }
  return out;
}

export class TelegramAdapter implements SourceAdapter<TelegramSource> {
  async read(source: TelegramSource, http: HttpClient): Promise<RawItem[]> {
    return parseTelegram(decodeBody(await http.get(source.url ?? telegramUrl(source.channel))));
  }
}
