// What a shared news item says, as plain text. It carries the summary too: whoever receives it during an
// emergency may have no data to open the link.
import { dayTime } from './time.ts';
import type { Entry } from './filters.ts';

/** Same shape as the Web Share API's ShareData (only the fields we send). */
export interface ShareContent {
  title: string;
  text: string;
  url?: string;
}

export function shareContent({ item, source }: Entry): ShareContent {
  const text = [item.title, item.summary, `— ${source.name}, ${dayTime(item.publishedAt)}`].filter(Boolean).join('\n');
  return /^https?:\/\//i.test(item.url) ? { title: item.title, text, url: item.url } : { title: item.title, text };
}

/** Clipboard fallback: everything in one block of text. */
export const plainText = (c: ShareContent): string => (c.url ? `${c.text}\n${c.url}` : c.text);
