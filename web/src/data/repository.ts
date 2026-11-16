// Loads a news file (full or urgent) and keeps its last good copy so the app works without network.
import { decodeSnapshot, URGENT_FILE, type Snapshot } from '../../../contract/news.ts';

/** The subset of localStorage we use; injectable for tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Only what we pass to fetch; DOM and Node disagree on RequestInit (Node lacks `cache`). */
export interface FetchInit {
  cache: 'no-cache';
  signal: AbortSignal;
}
export type Fetcher = (url: string, init: FetchInit) => Promise<Response>;

export interface NewsFeed {
  url: string;
  /** localStorage key of the last good copy. */
  key: string;
}

export const FEEDS = {
  full: { url: 'news.json', key: 'oin:news' },
  urgent: { url: URGENT_FILE, key: 'oin:urgent' },
} as const satisfies Record<string, NewsFeed>;

const TIMEOUT_MS = 20_000;

export class NewsRepository {
  readonly #fetch: Fetcher;
  readonly #store: KeyValueStore | null;
  readonly #feed: NewsFeed;

  constructor(fetcher: Fetcher, store: KeyValueStore | null, feed: NewsFeed = FEEDS.full) {
    this.#fetch = fetcher;
    this.#store = store;
    this.#feed = feed;
  }

  /** Last good copy, or null if there is none or it is unreadable. */
  cached(): Snapshot | null {
    try {
      const raw = this.#store?.getItem(this.#feed.key);
      return raw ? decodeSnapshot(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  /**
   * `no-cache` revalidates with the server: an unchanged file costs a 304 with no body.
   * Throws on network errors, HTTP errors or invalid data; the cached copy is left untouched.
   */
  async refresh(): Promise<Snapshot> {
    const res = await this.#fetch(this.#feed.url, { cache: 'no-cache', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const snap = decodeSnapshot(JSON.parse(text));
    try {
      this.#store?.setItem(this.#feed.key, text);
    } catch {
      // Quota exceeded or storage disabled (private mode): the app still works online.
    }
    return snap;
  }
}

/** Small preferences store (filters) that never throws. */
export function prefs(store: KeyValueStore | null) {
  return {
    get: (key: string) => {
      try {
        return store?.getItem(`oin:${key}`) ?? null;
      } catch {
        return null;
      }
    },
    set: (key: string, value: string) => {
      try {
        store?.setItem(`oin:${key}`, value);
      } catch {
        // ignore
      }
    },
  };
}
