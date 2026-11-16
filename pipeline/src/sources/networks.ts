// Catalogue helpers for social networks that publish RSS: an entry stays one line of data.
import type { RssSource } from './types.ts';

type Entry = Omit<RssSource, 'adapter' | 'url'>;

/** Bluesky profile feed: https://bsky.app/profile/<handle>/rss (own posts, no title, text in <description>). */
export const bluesky = (handle: string, entry: Entry): RssSource => ({
  ...entry,
  adapter: 'rss',
  url: `https://bsky.app/profile/${encodeURIComponent(handle)}/rss`,
});

/** Mastodon account feed: https://<instance>/@<user>.rss. */
export const mastodon = (account: `${string}@${string}`, entry: Entry): RssSource => {
  const [user, instance] = account.replace(/^@/, '').split('@') as [string, string];
  return { ...entry, adapter: 'rss', url: `https://${instance}/@${encodeURIComponent(user)}.rss` };
};
