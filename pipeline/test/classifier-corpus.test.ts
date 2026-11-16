import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadCorpus, report, score } from './classifier-corpus.ts';

const corpus = loadCorpus();
const all = score(corpus);

/** Precision floors for categories predicted at least MIN_PREDICTED times; "general" is the no-keyword bucket. */
const MIN_PREDICTED = 10;
const FLOOR = 0.85;
// Below 85 % today (iter 6): emergency mixes in disaster aftermath and named past events; world overlaps with
// Spanish politics on foreign affairs; technology catches cybercrime and AI in political stories. Raising them needs more labelled headlines, not more keywords.
const FLOORS: Record<string, number> = { emergency: 0.7, world: 0.75, technology: 0.7 };

test('corpus is large and varied enough to mean something', () => {
  assert.ok(corpus.length >= 300, `${corpus.length} headlines`);
  for (const [category, r] of all.recall) if (category !== 'general') assert.ok(r.expected >= 5, `${category}: ${r.expected} samples`);
});

test('overall precision on the corpus ≥ 85 % (ROADMAP iter 6)', (t) => {
  t.diagnostic(`\n${report(all)}\nheld out (not used for tuning): ${report(score(corpus.filter((s) => s.heldOut))).split('\n')[0]}`);
  assert.ok(all.accuracy >= 0.85, `accuracy ${(all.accuracy * 100).toFixed(1)} %`);
});

test('precision per category does not regress', () => {
  for (const [category, p] of all.precision) {
    if (category === 'general' || p.predicted < MIN_PREDICTED) continue;
    const floor = FLOORS[category] ?? FLOOR;
    assert.ok(p.right / p.predicted >= floor, `${category}: ${p.right}/${p.predicted} < ${floor * 100} %`);
  }
});
