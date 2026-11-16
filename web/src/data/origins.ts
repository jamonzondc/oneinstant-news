// Where the news files can be downloaded from: this site first, then its mirrors (the same app on other hosts,
// e.g. Firebase and Cloudflare Pages). If this host fails (down, daily quota exceeded) the app, already cached by
// the service worker, still gets fresh news from a mirror. The host that answered is tried first next time.

/** Normalizes a configured mirror to its origin ("https://x.pages.dev"); throws if it is not an http(s) URL. */
export function toOrigin(url: string): string {
  const u = new URL(url);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`not an http(s) mirror: ${url}`);
  return u.origin;
}

export class Origins {
  /** '' = this site (relative URLs). */
  #bases: string[];

  /** `here` is location.origin; mirrors equal to it are skipped. */
  constructor(here: string, mirrors: readonly string[]) {
    this.#bases = ['', ...mirrors.filter((m) => m !== here)];
  }

  urls(file: string): string[] {
    return this.#bases.map((b) => (b ? `${b}/${file}` : file));
  }

  /** The URL answered: its host goes first from now on (this session only). */
  answered(url: string): void {
    const base = this.#bases.find((b) => b && url.startsWith(`${b}/`)) ?? '';
    this.#bases = [base, ...this.#bases.filter((b) => b !== base)];
  }

  /** True when the last answer came from a mirror. */
  get usingMirror(): boolean {
    return this.#bases[0] !== '';
  }

  /** The first mirror (another host of the app), to offer as a link. */
  get mirror(): string | undefined {
    return this.#bases.find((b) => b);
  }
}
