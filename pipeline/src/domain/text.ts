// Dependency-free text helpers: entities, HTML stripping, truncation, normalisation.

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  agrave: 'à', egrave: 'è', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
  Agrave: 'À', Egrave: 'È', Ograve: 'Ò',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', ccedil: 'ç', Ccedil: 'Ç',
  iexcl: '¡', iquest: '¿', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”',
  lsquo: '‘', rsquo: '’', sbquo: '‚', bdquo: '„', hellip: '…', mdash: '—',
  ndash: '–', euro: '€', middot: '·', deg: '°', ordf: 'ª', ordm: 'º',
  copy: '©', reg: '®', trade: '™', bull: '•', shy: '', zwj: '', zwnj: '',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e: string) => {
    if (e.startsWith('#')) {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return NAMED[e] ?? m;
  });
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|figure|figcaption|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, ' ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Raw XML node content -> plain text. CDATA is literal; outside it entities may encode HTML. */
export function xmlText(raw: string): string {
  if (!raw) return '';
  let out = '';
  let last = 0;
  for (const m of raw.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)) {
    out += decodeEntities(raw.slice(last, m.index)) + m[1];
    last = m.index + m[0].length;
  }
  return htmlToText(out + decodeEntities(raw.slice(last)));
}

/** Raw XML node content -> plain-text lines (split at newlines and <br>), empty lines dropped. */
export function xmlLines(raw: string): string[] {
  const decoded = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return decodeEntities(decoded).split(/\r?\n|<br\s*\/?>/i).map(htmlToText).filter(Boolean);
}

export const HEADLINE = { min: 12, max: 180 } as const;

// Links inside a post are noise in a text-only reader (the item already links to the post): "dozz.es/fp3gt4",
// "🌐 https://f.mtr.cool/x". A bare domain without a path ("sanidad.gob.es") is kept: it reads as text.
const LINK = /(?:https?:\/\/|\b(?:[a-z0-9-]+\.)+[a-z]{2,}\/)\S*/gi;
// A line made only of hashtags, mentions, emoji and punctuation ("#FMA #Lluvias") says nothing as a headline.
const TAGS_ONLY = /^(?:[#@][\p{L}\p{N}_.]+|[\p{Extended_Pictographic}\p{P}\p{S}\uFE0F\u200D\s])*$/u;

/** Post lines without links, and without the leading lines made only of hashtags. */
export function cleanPostLines(lines: string[]): string[] {
  const out = lines.map((l) => l.replace(LINK, '').replace(/\s+/g, ' ').trim()).filter((l) => l && !/^[\p{P}\p{S}\s]*$/u.test(l));
  while (out.length > 1 && TAGS_ONLY.test(out[0]!)) out.shift();
  return out;
}

/**
 * Posts without a headline (Telegram, Bluesky) usually open with one on its own line: it becomes the title and
 * the rest the summary. Otherwise everything is summary and the title is derived later (prepareItems).
 */
export function splitHeadline(raw: string[]): { title: string; summary: string } {
  const lines = cleanPostLines(raw);
  const first = lines[0] ?? '';
  if (lines.length > 1 && first.length >= HEADLINE.min && first.length <= HEADLINE.max) {
    return { title: first, summary: lines.slice(1).join(' ') };
  }
  return { title: '', summary: lines.join(' ') };
}

/** Cuts at a word boundary and appends an ellipsis. */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[\s.,;:—–-]+$/, '') + '…';
}

/** Lowercase, no accents, no punctuation: for classification and de-duplication. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ns_|_ga$|xtor$)/i;

/** Accepts only http(s) and drops tracking params (useless bytes on the wire). */
export function cleanUrl(u: string): string {
  try {
    const url = new URL(u.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    for (const k of [...url.searchParams.keys()]) if (TRACKING.test(k)) url.searchParams.delete(k);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}
