import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SourceReport } from '../src/build.ts';
import { okRatio, previousUrls, reportLines, reportMarkdown } from '../src/report.ts';

const report: SourceReport[] = [
  { id: 'b', ok: true, items: 12 },
  { id: 'a', ok: false, items: 3, error: 'HTTP 404 | gone', reused: 3 },
  { id: 'c', ok: true, items: 5 },
];

test('ratio of healthy sources', () => {
  assert.equal(okRatio(report), 2 / 3);
  assert.equal(okRatio([]), 0);
});

test('console lines keep the original order and explain failures', () => {
  assert.deepEqual(reportLines(report), [
    '✓ b                 12',
    '✗ a                  3 HTTP 404 | gone (reused 3 previous items)',
    '✓ c                  5',
  ]);
});

test('Markdown summary lists failures first and escapes table separators', () => {
  const md = reportMarkdown(report);
  assert.match(md, /^### Sources: 2\/3 OK \(67 %\)/);
  const rows = md.split('\n').filter((l) => /^\| (✅|❌)/.test(l));
  assert.deepEqual(rows, [
    '| ❌ | a | 3 | HTTP 404 \\| gone (reused 3) |',
    '| ✅ | b | 12 |  |',
    '| ✅ | c | 5 |  |',
  ]);
});

test('PREVIOUS_URL accepts a comma-separated list', () => {
  assert.deepEqual(previousUrls(undefined), []);
  assert.deepEqual(previousUrls(' https://a/news.json , ,https://b/news.json'), ['https://a/news.json', 'https://b/news.json']);
});
