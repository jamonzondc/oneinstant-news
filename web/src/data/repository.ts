// Loads a news file (full or urgent) and keeps its last good copy so the app works without network.
import { decodeSnapshot, URGENT_FILE, type Snapshot } from '../../../contract/news.ts';
import { Origins } from './origins.ts';

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
  readonly #origins: Origins;
  /** generatedAt of the saved copy, once known (avoids re-reading storage on every refresh). */
  #savedAt: number | undefined;

  /** `origins` is shared by both feeds, so once a mirror answers the other file is asked there first. */
  constructor(fetcher: Fetcher, store: KeyValueStore | null, feed: NewsFeed = FEEDS.full, origins = new Origins('', [])) {
    this.#fetch = fetcher;
    this.#store = store;
    this.#feed = feed;
    this.#origins = origins;
  }

  /** Last good copy, or null if there is none or it is unreadable. */
  cached(): Snapshot | null {
    try {
      const raw = this.#store?.getItem(this.#feed.key);
      const snap = raw ? decodeSnapshot(JSON.parse(raw)) : null;
      this.#savedAt = snap?.generatedAt ?? 0;
      return snap;
    } catch {
      return null;
    }
  }

  /**
   * `no-cache` revalidates with the server: an unchanged file costs a 304 with no body.
   * Tries this site, then each mirror. Throws if none gives valid data; the cached copy is left untouched.
   * A copy older than the saved one (a mirror updates less often) does not replace it.
   */
  async refresh(): Promise<Snapshot> {
    let error: unknown;
    for (const url of this.#origins.urls(this.#feed.url)) {
      let text: string;
      let snap: Snapshot;
      try {
        const res = await this.#fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
        snap = decodeSnapshot(JSON.parse(text));
      } catch (e) {
        error = e;
        continue;
      }
      this.#origins.answered(url);
      if ((this.#savedAt ?? this.cached()?.generatedAt ?? 0) > snap.generatedAt) {
        const saved = this.cached();
        if (saved) return saved;
      }
      try {
        this.#store?.setItem(this.#feed.key, text);
        this.#savedAt = snap.generatedAt;
      } catch {
        // Quota exceeded or storage disabled (private mode): the app still works online.
      }
      return snap;
    }
    throw error;
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
