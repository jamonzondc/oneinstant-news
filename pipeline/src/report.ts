// Human-readable build report: console lines and a Markdown table for the GitHub Actions job summary.
import type { SourceReport } from './build.ts';

/** Share of healthy sources below which the build warns (ROADMAP iter 3: ≥ 80 %). */
export const MIN_OK_RATIO = 0.8;

export const okRatio = (report: SourceReport[]) => (report.length ? report.filter((r) => r.ok).length / report.length : 0);

export function reportLines(report: SourceReport[]): string[] {
  return report.map((r) => {
    const extra = r.ok ? '' : ` ${r.error}${r.reused ? ` (reused ${r.reused} previous items)` : ''}`;
    return `${r.ok ? '✓' : '✗'} ${r.id.padEnd(16)} ${String(r.items).padStart(3)}${extra}`;
  });
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ');

export function reportMarkdown(report: SourceReport[]): string {
  const ok = report.filter((r) => r.ok).length;
  const rows = [...report]
    .sort((a, b) => Number(a.ok) - Number(b.ok) || a.id.localeCompare(b.id))
    .map((r) => `| ${r.ok ? '✅' : '❌'} | ${cell(r.id)} | ${r.items} | ${r.ok ? '' : cell(`${r.error ?? ''}${r.reused ? ` (reused ${r.reused})` : ''}`)} |`);
  return [
    `### Sources: ${ok}/${report.length} OK (${Math.round(okRatio(report) * 100)} %)`,
    '',
    '| | Source | Items | Error |',
    '|---|---|---:|---|',
    ...rows,
    '',
  ].join('\n');
}

/** `PREVIOUS_URL` accepts a comma-separated list (primary site, then mirror): the first that answers wins. */
export const previousUrls = (env: string | undefined) => (env ?? '').split(',').map((u) => u.trim()).filter(Boolean);
