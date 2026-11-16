// Colour contrast (WCAG 2.2 AA) of every pair the app and the static pages use, in dark and light mode,
// read from the real stylesheets. Text needs 4.5:1; control borders and the focus ring need 3:1 (1.4.11).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { CSS as STATIC_CSS } from '../../pipeline/src/render/lite.ts';

function luminance(hex: string): number {
  const full = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const vars = (block: string) => Object.fromEntries([...block.matchAll(/--(\w+):\s*(#[0-9a-f]+)/gi)].map((m) => [m[1]!, m[2]!]));

/** [foreground, background, minimum ratio, where]. */
const PAIRS: [string, string, number, string][] = [
  ['fg', 'bg', 4.5, 'text'],
  ['mu', 'bg', 4.5, 'secondary text, visited headlines'],
  ['ln', 'bg', 4.5, 'links'],
  ['em', 'bg', 4.5, '"Emergencias" label'],
  ['wa', 'bg', 4.5, 'supplies and weather labels, warnings'],
  ['bg', 'em', 4.5, 'emergency banner'],
  ['fg', 'ctl', 4.5, 'controls'],
  ['mu', 'ctl', 4.5, 'search placeholder'],
  ['bg', 'fg', 4.5, 'pressed "Aa" button'],
  ['cb', 'bg', 3, 'control borders'],
  ['ln', 'ctl', 3, 'focus ring on a control'],
];

test('app colours meet WCAG AA in dark and light mode', async () => {
  const css = await readFile(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
  const dark = vars(css.slice(0, css.indexOf('@media')));
  const light = { ...dark, ...vars(css.slice(css.indexOf('@media (prefers-color-scheme: light)'))) };
  for (const [scheme, colors] of [['dark', dark], ['light', light]] as const) {
    for (const [fg, bg, min, where] of PAIRS) {
      const ratio = contrast(colors[fg]!, colors[bg]!);
      assert.ok(ratio >= min, `${scheme} ${where}: ${fg} on ${bg} = ${ratio.toFixed(2)} < ${min}`);
    }
  }
});

test('static pages (lite, estado) meet WCAG AA in dark and light mode', () => {
  const [dark, light] = STATIC_CSS.split('@media');
  for (const part of [dark!, light!]) {
    const bg = /background:(#[0-9a-f]+)/i.exec(part)![1]!;
    const colors = [...part.matchAll(/[{;]color:(#[0-9a-f]+)/gi)].map((m) => m[1]!);
    assert.ok(colors.length >= 3, part);
    for (const c of colors) assert.ok(contrast(c, bg) >= 4.5, `${c} on ${bg} = ${contrast(c, bg).toFixed(2)}`);
  }
});

test('contrast formula matches known values', () => {
  assert.equal(contrast('#000', '#fff').toFixed(0), '21');
  assert.equal(contrast('#767676', '#fff').toFixed(2), '4.54');
});
