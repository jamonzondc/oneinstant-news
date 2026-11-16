// Evaluation of the classifier against the hand-labelled corpus of real headlines (fixtures/classifier-corpus.tsv).
import { readFileSync } from 'node:fs';
import { CATEGORY_IDS, type CategoryId } from '../../contract/news.ts';
import { classify } from '../src/domain/classifier.ts';
import { SOURCES } from '../src/sources/index.ts';

const FALLBACK = new Map(SOURCES.map((s) => [s.id, s.fallbackCategory]));

export interface Sample {
  expected: CategoryId;
  source: string;
  title: string;
  summary: string;
  /** Every third line is held out: never looked at while tuning the rules, reported apart. */
  heldOut: boolean;
}

export function loadCorpus(): Sample[] {
  const text = readFileSync(new URL('./fixtures/classifier-corpus.tsv', import.meta.url), 'utf8');
  return text
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l, i) => {
      const [expected, source, title, summary = ''] = l.split('\t') as [CategoryId, string, string, string?];
      if (!CATEGORY_IDS.includes(expected)) throw new Error(`Unknown category "${expected}" on corpus line ${i + 1}`);
      return { expected, source, title, summary, heldOut: i % 3 === 2 };
    });
}

export interface Score {
  total: number;
  accuracy: number;
  /** Per predicted category: right / predicted. */
  precision: Map<CategoryId, { right: number; predicted: number }>;
  recall: Map<CategoryId, { right: number; expected: number }>;
  misses: { sample: Sample; got: CategoryId }[];
}

export function score(samples: Sample[]): Score {
  const precision = new Map(CATEGORY_IDS.map((c) => [c, { right: 0, predicted: 0 }]));
  const recall = new Map(CATEGORY_IDS.map((c) => [c, { right: 0, expected: 0 }]));
  const misses: Score['misses'] = [];
  let right = 0;
  for (const sample of samples) {
    // As in production (prepareItems): the source's usual topic replaces "general".
    const got = classify(sample.title, sample.summary, FALLBACK.get(sample.source));
    precision.get(got)!.predicted++;
    recall.get(sample.expected)!.expected++;
    if (got === sample.expected) {
      right++;
      precision.get(got)!.right++;
      recall.get(got)!.right++;
    } else {
      misses.push({ sample, got });
    }
  }
  return { total: samples.length, accuracy: samples.length ? right / samples.length : 0, precision, recall, misses };
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');

/** Markdown-ish table for the console: `node pipeline/test/classifier-corpus.ts [--misses]`. */
export function report(s: Score): string {
  const rows = CATEGORY_IDS.map((c) => {
    const p = s.precision.get(c)!;
    const r = s.recall.get(c)!;
    return `${c.padEnd(11)} precision ${pct(p.right, p.predicted).padStart(5)} (${p.right}/${p.predicted})  recall ${pct(r.right, r.expected).padStart(5)} (${r.right}/${r.expected})`;
  });
  return [`accuracy ${pct(s.accuracy * s.total, s.total)} over ${s.total}`, ...rows].join('\n');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const all = loadCorpus();
  for (const [name, part] of [['all', all], ['tuning', all.filter((x) => !x.heldOut)], ['held out', all.filter((x) => x.heldOut)]] as const) {
    console.log(`\n## ${name}\n${report(score(part))}`);
  }
  if (process.argv.includes('--misses')) {
    for (const m of score(all.filter((x) => !x.heldOut)).misses) console.log(`${m.sample.expected} → ${m.got}\t${m.sample.title.slice(0, 110)}`);
  }
}
